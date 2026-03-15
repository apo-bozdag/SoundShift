import { Router } from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import crypto from 'crypto';
import supabase from './db.js';
import { enrichArtistGenre } from './sync.js';
import { spotifyLimiter } from './rateLimiter.js';

const router = Router();
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_SECRET_KEY;

// Multer: 50MB limit, memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed' || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'));
    }
  }
});

// In-memory store for parsed upload data (between upload/start and upload/process)
const uploadDataStore = new Map();

// Clean stale entries after 30 minutes
setInterval(() => {
  const stale = Date.now() - 30 * 60 * 1000;
  for (const [key, val] of uploadDataStore) {
    if (val.createdAt < stale) uploadDataStore.delete(key);
  }
}, 5 * 60 * 1000);

// ============ HELPERS ============

// Spotify Client Credentials token (no user auth needed)
let clientTokenCache = { token: null, expiresAt: 0 };

async function getClientToken() {
  if (clientTokenCache.token && clientTokenCache.expiresAt > Date.now() + 60000) {
    return clientTokenCache.token;
  }
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (data.error) throw new Error(`Client credentials failed: ${data.error}`);
  clientTokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function spotifyFetch(url, token) {
  return spotifyLimiter.schedule(async () => {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 429) {
      const err = new Error('Rate limited');
      err.status = 429;
      throw err;
    }
    if (!res.ok) throw new Error(`Spotify API: ${res.status}`);
    return res.json();
  });
}

function parseZip(buffer) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const result = { library: null, playlists: [], streaming: [], userdata: null };

  for (const entry of entries) {
    const name = entry.entryName.split('/').pop();
    if (entry.isDirectory) continue;
    try {
      const content = entry.getData().toString('utf8');
      const json = JSON.parse(content);
      if (name === 'YourLibrary.json') result.library = json;
      else if (name.startsWith('Playlist') && name.endsWith('.json')) result.playlists.push(json);
      else if (name.startsWith('StreamingHistory') && name.endsWith('.json')) result.streaming.push(...(Array.isArray(json) ? json : []));
      else if (name === 'Userdata.json') result.userdata = json;
    } catch {}
  }
  return result;
}

function extractLibraryTracks(library) {
  if (!library) return [];
  const tracks = library.tracks || [];
  return tracks.map(t => {
    const uri = t.uri || t.trackUri || '';
    const trackId = uri.startsWith('spotify:track:') ? uri.replace('spotify:track:', '') : null;
    return {
      trackId,
      name: t.track || t.trackName || t.name || 'Unknown',
      artistName: t.artist || t.artistName || 'Unknown',
    };
  }).filter(t => t.trackId);
}

function extractPlaylists(playlistFiles) {
  const all = [];
  for (const file of playlistFiles) {
    for (const pl of (file.playlists || [])) {
      const items = (pl.items || [])
        .filter(item => item.track?.trackUri)
        .map(item => ({
          trackId: item.track.trackUri.startsWith('spotify:track:') ? item.track.trackUri.replace('spotify:track:', '') : null,
          name: item.track.trackName || '',
          artistName: item.track.artistName || '',
          addedDate: item.addedDate || null,
        }))
        .filter(t => t.trackId);

      if (items.length > 0) {
        all.push({ name: pl.name || 'Untitled', description: pl.description || null, tracks: items });
      }
    }
  }
  return all;
}

async function batchFetchTracks(trackIds, token, onProgress) {
  const results = new Map();
  const unique = [...new Set(trackIds)];

  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    try {
      // Refresh token every 500 tracks
      if (i > 0 && i % 500 === 0) {
        try { token = await getClientToken(); } catch {}
      }
      const data = await spotifyFetch(`https://api.spotify.com/v1/tracks?ids=${batch.join(',')}`, token);
      for (const track of (data.tracks || [])) {
        if (!track) continue;
        results.set(track.id, {
          name: track.name,
          artistIds: track.artists.map(a => a.id),
          artistNames: track.artists.map(a => a.name),
          albumReleaseDate: track.album?.release_date || null,
          isrc: track.external_ids?.isrc || null,
        });
      }
    } catch (err) {
      console.warn(`Batch track fetch failed at ${i}:`, err.message);
    }
    onProgress?.(Math.min(i + 50, unique.length), unique.length);
  }
  return results;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function fetchAll(queryFn) {
  const PAGE = 1000;
  let all = [], from = 0;
  while (true) {
    const { data, error } = await queryFn().range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

function computeTimeline(songs, artistsMap) {
  const yearMap = {};
  for (const song of songs) {
    const year = new Date(song.added_at).getFullYear();
    if (!yearMap[year]) yearMap[year] = { songs: [], genres: {} };
    yearMap[year].songs.push(song);
    for (const artistId of song.artist_ids) {
      const artist = artistsMap.get(artistId);
      if (!artist) continue;
      for (const genre of artist.macro_genres) {
        if (genre === 'Unknown') continue;
        yearMap[year].genres[genre] = (yearMap[year].genres[genre] || 0) + 1;
      }
    }
  }

  const years = Object.entries(yearMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, data]) => {
      const sorted = data.songs.sort((a, b) => new Date(a.added_at) - new Date(b.added_at));
      const artistCount = {};
      for (const s of data.songs) {
        for (const aid of s.artist_ids) {
          const artist = artistsMap.get(aid);
          if (!artist?.name) continue;
          artistCount[artist.name] = (artistCount[artist.name] || 0) + 1;
        }
      }
      const topArtists = Object.entries(artistCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
      return {
        year: parseInt(year), totalLikes: data.songs.length, genres: data.genres, topArtists,
        firstLike: sorted[0] ? { track: sorted[0].name, artist: artistsMap.get(sorted[0].artist_ids[0])?.name, date: sorted[0].added_at?.split('T')[0] } : null,
        lastLike: sorted.at(-1) ? { track: sorted.at(-1).name, artist: artistsMap.get(sorted.at(-1).artist_ids[0])?.name, date: sorted.at(-1).added_at?.split('T')[0] } : null,
      };
    });

  const allSorted = [...songs].sort((a, b) => new Date(a.added_at) - new Date(b.added_at));
  return {
    generatedAt: new Date().toISOString(), years,
    summary: { totalTracks: songs.length, firstLikeDate: allSorted[0]?.added_at?.split('T')[0] || null, lastLikeDate: allSorted.at(-1)?.added_at?.split('T')[0] || null },
  };
}

// ============ ROUTES ============

// Step 1: Upload ZIP — parse, create user, store data for processing
router.post('/upload/start', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const parsed = parseZip(req.file.buffer);
    if (!parsed.library && parsed.playlists.length === 0) {
      return res.status(400).json({ error: 'ZIP içinde YourLibrary.json veya Playlist dosyası bulunamadı' });
    }

    const libraryTracks = extractLibraryTracks(parsed.library);
    const playlists = extractPlaylists(parsed.playlists);

    if (libraryTracks.length === 0 && playlists.length === 0) {
      return res.status(400).json({ error: 'Export verisinde hiç track bulunamadı' });
    }

    const userId = `upload_${crypto.randomBytes(8).toString('hex')}`;
    const displayName = parsed.userdata?.username || 'Uploaded User';

    await supabase.from('users').upsert({
      spotify_id: userId,
      display_name: displayName,
      profile_image: null,
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      last_sync_at: null,
      last_added_at: null,
    });

    uploadDataStore.set(userId, { libraryTracks, playlists, createdAt: Date.now() });

    res.cookie('spotify_user_id', userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });

    res.json({ ok: true, userId, displayName, trackCount: libraryTracks.length, playlistCount: playlists.length });
  } catch (err) {
    console.error('Upload parse error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// Step 2: Process uploaded data (SSE) — fetch Spotify details, enrich genres, build timeline
router.get('/upload/process', async (req, res) => {
  const userId = req.cookies.spotify_user_id;
  if (!userId || !userId.startsWith('upload_')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let closed = false;
  const send = (data) => { if (!closed) try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch {} };
  req.on('close', () => { closed = true; });

  try {
    const pendingData = uploadDataStore.get(userId);
    if (!pendingData) {
      send({ step: 'error', message: 'Upload verisi bulunamadı, lütfen tekrar yükleyin.' });
      if (!closed) res.end();
      return;
    }

    const { libraryTracks, playlists } = pendingData;
    uploadDataStore.delete(userId);

    // Get client credentials token for Spotify API
    let token = await getClientToken();

    // Collect all unique track IDs
    const allTrackIds = [
      ...libraryTracks.map(t => t.trackId),
      ...playlists.flatMap(p => p.tracks.map(t => t.trackId)),
    ].filter(Boolean);
    const uniqueTrackIds = [...new Set(allTrackIds)];

    send({ step: 'tracks', message: `${uniqueTrackIds.length} track detayı Spotify'dan çekiliyor...`, total: uniqueTrackIds.length, current: 0 });

    const trackDetails = await batchFetchTracks(uniqueTrackIds, token, (current, total) => {
      send({ step: 'tracks', current, total });
    });

    send({ step: 'tracks', message: `${trackDetails.size} track detayı alındı`, current: trackDetails.size, total: uniqueTrackIds.length });

    // Insert liked songs
    if (libraryTracks.length > 0) {
      send({ step: 'songs', message: `${libraryTracks.length} liked song kaydediliyor...` });

      const songRows = [];
      const now = new Date();
      for (let i = 0; i < libraryTracks.length; i++) {
        const lt = libraryTracks[i];
        const details = trackDetails.get(lt.trackId);
        if (!details) continue;

        // Library export doesn't have addedAt dates; approximate by position (index 0 = newest)
        const addedAt = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString();

        songRows.push({
          user_id: userId,
          track_id: lt.trackId,
          name: details.name || lt.name,
          added_at: addedAt,
          artist_ids: details.artistIds,
          artist_names: details.artistNames,
          album_release_date: details.albumReleaseDate,
          isrc: details.isrc,
        });
      }

      for (let i = 0; i < songRows.length; i += 500) {
        await supabase.from('liked_songs').upsert(songRows.slice(i, i + 500), {
          onConflict: 'user_id,track_id', ignoreDuplicates: true,
        });
      }
      send({ step: 'songs', message: `${songRows.length} liked song kaydedildi` });
    }

    // Collect unique artist IDs for genre enrichment
    const artistMap = new Map();
    const allSongs = await fetchAll(() =>
      supabase.from('liked_songs').select('artist_ids, artist_names').eq('user_id', userId).order('id')
    );
    for (const song of allSongs) {
      song.artist_ids.forEach((id, i) => {
        if (!artistMap.has(id)) artistMap.set(id, song.artist_names?.[i] || 'Unknown');
      });
    }

    // Also collect artists from playlists
    for (const pl of playlists) {
      for (const t of pl.tracks) {
        const details = trackDetails.get(t.trackId);
        if (details) {
          details.artistIds.forEach((id, i) => {
            if (!artistMap.has(id)) artistMap.set(id, details.artistNames[i] || 'Unknown');
          });
        }
      }
    }

    send({ step: 'artists', message: `${artistMap.size} sanatçının genre'ları çekiliyor...`, total: artistMap.size, current: 0 });

    const artistIds = [...artistMap.keys()];
    let cachedArtists = [];
    for (const chunk of chunkArray(artistIds, 300)) {
      const { data } = await supabase.from('artists').select('spotify_id, fetched_at').in('spotify_id', chunk);
      if (data) cachedArtists.push(...data);
    }
    const cachedMap = new Map(cachedArtists.map(a => [a.spotify_id, a]));

    let processed = 0;
    const BATCH_SIZE = 20;
    const artistEntries = [...artistMap.entries()];
    let enrichToken = await getClientToken();

    for (let i = 0; i < artistEntries.length; i += BATCH_SIZE) {
      if (closed) break;
      if (i > 0 && i % 200 === 0) try { enrichToken = await getClientToken(); } catch {}
      const batch = artistEntries.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async ([artistId, artistName]) => {
          await enrichArtistGenre(artistId, artistName, enrichToken, cachedMap);
          processed++;
          if (processed % 20 === 0) send({ step: 'artists', current: processed, total: artistMap.size });
        })
      );
    }
    send({ step: 'artists', current: artistMap.size, total: artistMap.size });

    // Insert playlists
    if (playlists.length > 0) {
      send({ step: 'playlists', message: `${playlists.length} playlist kaydediliyor...` });

      let allArtistsData = [];
      for (const chunk of chunkArray(artistIds, 300)) {
        const { data } = await supabase.from('artists').select('*').in('spotify_id', chunk);
        if (data) allArtistsData.push(...data);
      }
      const artistsMap = new Map(allArtistsData.map(a => [a.spotify_id, a]));

      for (let pi = 0; pi < playlists.length; pi++) {
        if (closed) break;
        const pl = playlists[pi];
        const playlistId = `${userId}:playlist_${pi}`;

        const trackRows = [];
        const genreCounts = {};
        let genreTotal = 0;

        for (const t of pl.tracks) {
          const details = trackDetails.get(t.trackId);
          const tArtistIds = details?.artistIds || [];
          const tArtistNames = details?.artistNames || [t.artistName];
          let trackGenre = null;

          for (const aid of tArtistIds) {
            const ar = artistsMap.get(aid);
            if (!ar) continue;
            for (const g of (ar.macro_genres || [])) {
              if (g === 'Unknown') continue;
              genreCounts[g] = (genreCounts[g] || 0) + 1;
              genreTotal++;
              if (!trackGenre) trackGenre = g;
            }
          }

          trackRows.push({
            playlist_id: playlistId, track_id: t.trackId,
            name: details?.name || t.name, artists: tArtistNames,
            artist_ids: tArtistIds,
            added_at: t.addedDate ? new Date(t.addedDate).toISOString() : new Date().toISOString(),
            genre: trackGenre,
          });
        }

        const gd = {};
        if (genreTotal > 0) for (const [g, c] of Object.entries(genreCounts)) gd[g] = Math.round((c / genreTotal) * 100) / 100;

        await supabase.from('playlists').upsert({
          id: playlistId, user_id: userId, spotify_id: `playlist_${pi}`,
          name: pl.name, description: pl.description, image_url: null,
          track_count: trackRows.length, snapshot_id: null,
          genre_distribution: gd, synced_at: new Date().toISOString(),
        });

        if (trackRows.length > 0) {
          await supabase.from('playlist_tracks').delete().eq('playlist_id', playlistId);
          for (let j = 0; j < trackRows.length; j += 500) {
            await supabase.from('playlist_tracks').insert(trackRows.slice(j, j + 500));
          }
        }
        send({ step: 'playlists', current: pi + 1, total: playlists.length, playlistName: pl.name });
      }
    }

    // Compute timeline
    send({ step: 'timeline', message: 'Timeline hesaplanıyor...' });

    const allUserSongs = await fetchAll(() =>
      supabase.from('liked_songs').select('*').eq('user_id', userId).order('id')
    );
    const finalArtistIds = [...new Set(allUserSongs.flatMap(s => s.artist_ids))];
    let finalArtists = [];
    for (const chunk of chunkArray(finalArtistIds, 300)) {
      const { data } = await supabase.from('artists').select('*').in('spotify_id', chunk);
      if (data) finalArtists.push(...data);
    }
    const finalArtistsMap = new Map(finalArtists.map(a => [a.spotify_id, a]));
    const timeline = computeTimeline(allUserSongs, finalArtistsMap);

    await supabase.from('users').update({
      timeline, last_sync_at: new Date().toISOString(),
    }).eq('spotify_id', userId);

    send({ step: 'done', message: 'Tamamlandı!' });
  } catch (err) {
    console.error('Upload process error:', err);
    send({ step: 'error', message: err.message || 'İşleme hatası' });
  }

  if (!closed) res.end();
});

export default router;
