import supabase from './db.js';
import { getValidToken } from './auth.js';
import { spotifyLimiter, lastfmLimiter, mbLimiter } from './rateLimiter.js';
import { normalizeGenre, getArtistMacroGenres } from './genreMap.js';

const LASTFM_KEY = process.env.LASTFM_API_KEY;

// Per-user sync lock with timeout (max 10 dk)
const syncLocks = new Map();

function acquireLock(userId) {
  const existing = syncLocks.get(userId);
  // 10 dk'dan eski lock'ları temizle
  if (existing && Date.now() - existing > 10 * 60 * 1000) {
    syncLocks.delete(userId);
  }
  if (syncLocks.has(userId)) return false;
  syncLocks.set(userId, Date.now());
  return true;
}

// Spotify API fetch with rate limiting and error handling
async function spotifyFetch(url, accessToken) {
  return spotifyLimiter.schedule(async () => {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (res.status === 429) {
      const error = new Error('Rate limited');
      error.status = 429;
      error.headers = Object.fromEntries(res.headers);
      throw error;
    }

    if (!res.ok) {
      throw new Error(`Spotify API error: ${res.status} ${res.statusText}`);
    }

    return res.json();
  });
}

// 1. Tüm liked songs'u çek
async function fetchAllLikedSongs(accessToken, lastAddedAt, onProgress, abortSignal) {
  const songs = [];
  let nextUrl = 'https://api.spotify.com/v1/me/tracks?limit=50&offset=0';
  let total = null;
  let done = false;
  let fetched = 0;

  while (!done && nextUrl) {
    if (abortSignal?.aborted) break;

    const data = await spotifyFetch(nextUrl, accessToken);

    if (total === null) {
      total = data.total;
      onProgress?.({ step: 'songs', message: `${total} liked song bulundu`, total });
    }

    for (const item of data.items) {
      // Incremental: eski sync'ten önceki şarkıya ulaştıysan dur
      if (lastAddedAt && item.added_at <= lastAddedAt) {
        done = true;
        break;
      }
      songs.push({
        trackId: item.track.id,
        name: item.track.name,
        addedAt: item.added_at,
        artistIds: item.track.artists.map(a => a.id),
        artistNames: item.track.artists.map(a => a.name),
        albumReleaseDate: item.track.album.release_date,
        isrc: item.track.external_ids?.isrc || null
      });
    }

    fetched += data.items.length;
    onProgress?.({ step: 'songs', current: fetched, total });

    // next URL'i kullan (Spotify'ın cursor'u), yoksa dur
    nextUrl = data.next;
    if (!nextUrl || data.items.length === 0) done = true;
  }

  console.log(`Fetched ${songs.length} songs (total on Spotify: ${total})`);
  return songs;
}

// 2. Artist genre'larını çek (Spotify + Last.fm fallback)
async function enrichArtistGenre(artistId, artistName, accessToken, cachedMap) {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const cached = cachedMap.get(artistId);
  if (cached && new Date(cached.fetched_at).getTime() > thirtyDaysAgo) {
    return; // cache hit
  }

  const entry = {
    name: artistName,
    spotifyGenres: [],
    lastfmTags: [],
    macroGenres: [],
    genreSource: 'unknown',
    fetchedAt: new Date().toISOString()
  };

  try {
    // Spotify'dan çek
    const artist = await spotifyFetch(
      `https://api.spotify.com/v1/artists/${artistId}`,
      accessToken
    );

    entry.name = artist.name;
    entry.spotifyGenres = artist.genres || [];
  } catch (err) {
    console.warn(`Spotify artist fetch failed for ${artistId}:`, err.message);
  }

  // Last.fm her zaman dene (Spotify genre'ları yetersiz, Last.fm daha zengin)
  if (LASTFM_KEY) {
    try {
      const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getTopTags`
        + `&artist=${encodeURIComponent(entry.name)}`
        + `&api_key=${LASTFM_KEY}&format=json&autocorrect=1`;

      const lfmData = await lastfmLimiter.schedule(() =>
        fetch(url).then(r => r.json())
      );

      if (lfmData.toptags?.tag) {
        entry.lastfmTags = lfmData.toptags.tag
          .filter(t => t.count >= 10)
          .slice(0, 15)
          .map(t => ({ name: t.name, count: parseInt(t.count) }));

        if (entry.lastfmTags.length > 0) {
          entry.macroGenres = getArtistMacroGenres(entry.lastfmTags);
          entry.genreSource = 'lastfm';
        }
      }
    } catch (err) {
      console.warn(`Last.fm fetch failed for ${entry.name}:`, err.message);
    }
  }

  // Last.fm boşsa Spotify'a bak
  if (entry.macroGenres.length === 0 && entry.spotifyGenres.length > 0) {
    entry.macroGenres = getArtistMacroGenres(
      entry.spotifyGenres.map(g => ({ name: g, count: 50 }))
    );
    entry.genreSource = 'spotify';
  }

  // MusicBrainz fallback
  if (entry.macroGenres.length === 0) {
    try {
      const searchUrl = `https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(entry.name)}&fmt=json&limit=1`;

      const mbData = await mbLimiter.schedule(() =>
        fetch(searchUrl, {
          headers: { 'User-Agent': 'SpotifyGenreEvolution/1.0 (personal project)' }
        }).then(r => r.json())
      );

      const mbArtist = mbData.artists?.[0];
      if (mbArtist?.tags?.length > 0) {
        const mbTags = mbArtist.tags
          .filter(t => t.count > 0)
          .map(t => ({ name: t.name, count: t.count }));

        entry.macroGenres = getArtistMacroGenres(mbTags);
        entry.genreSource = 'musicbrainz';
      }
    } catch (err) {
      console.warn(`MusicBrainz fetch failed for ${entry.name}:`, err.message);
    }
  }

  if (entry.macroGenres.length === 0) {
    entry.macroGenres = ['Unknown'];
  }

  // Supabase'e upsert
  await supabase.from('artists').upsert({
    spotify_id: artistId,
    name: entry.name,
    spotify_genres: entry.spotifyGenres,
    lastfm_tags: entry.lastfmTags,
    macro_genres: entry.macroGenres,
    genre_source: entry.genreSource,
    fetched_at: entry.fetchedAt
  });
}

// 3. Timeline hesapla
function computeTimeline(songs, artistsMap) {
  const yearMap = {};

  for (const song of songs) {
    const year = new Date(song.added_at).getFullYear();
    if (!yearMap[year]) {
      yearMap[year] = { songs: [], genres: {} };
    }
    yearMap[year].songs.push(song);

    for (const artistId of song.artist_ids) {
      const artist = artistsMap.get(artistId);
      if (!artist) continue;
      for (const genre of artist.macro_genres) {
        yearMap[year].genres[genre] = (yearMap[year].genres[genre] || 0) + 1;
      }
    }
  }

  const years = Object.entries(yearMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, data]) => {
      const sorted = data.songs.sort(
        (a, b) => new Date(a.added_at) - new Date(b.added_at)
      );

      // Top artists by frequency
      const artistCount = {};
      for (const s of data.songs) {
        for (const aid of s.artist_ids) {
          const name = artistsMap.get(aid)?.name || 'Unknown';
          artistCount[name] = (artistCount[name] || 0) + 1;
        }
      }
      const topArtists = Object.entries(artistCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      return {
        year: parseInt(year),
        totalLikes: data.songs.length,
        genres: data.genres,
        topArtists,
        firstLike: sorted[0] ? {
          track: sorted[0].name,
          artist: artistsMap.get(sorted[0].artist_ids[0])?.name,
          date: sorted[0].added_at?.split('T')[0]
        } : null,
        lastLike: sorted.at(-1) ? {
          track: sorted.at(-1).name,
          artist: artistsMap.get(sorted.at(-1).artist_ids[0])?.name,
          date: sorted.at(-1).added_at?.split('T')[0]
        } : null
      };
    });

  // Summary
  const allSongs = songs.sort((a, b) => new Date(a.added_at) - new Date(b.added_at));
  const summary = {
    totalTracks: songs.length,
    firstLikeDate: allSongs[0]?.added_at?.split('T')[0] || null,
    lastLikeDate: allSongs.at(-1)?.added_at?.split('T')[0] || null
  };

  return { generatedAt: new Date().toISOString(), years, summary };
}

// Helper: Supabase'den 1000+ satır çekmek için paginated select
async function fetchAll(query) {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// Helper: chunk array for .in() queries (Supabase limit ~300)
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// Ana sync fonksiyonu
export async function syncUser(userId, onProgress, abortSignal) {
  if (!acquireLock(userId)) {
    throw new Error('Sync already in progress');
  }

  try {
    const accessToken = await getValidToken(userId);

    const { data: user } = await supabase
      .from('users')
      .select('last_added_at')
      .eq('spotify_id', userId)
      .single();

    onProgress?.({ step: 'songs', message: 'Liked songs çekiliyor...' });

    const newSongs = await fetchAllLikedSongs(accessToken, user?.last_added_at, onProgress, abortSignal);

    // Bulk upsert new songs (500'lük chunk'lar halinde)
    if (newSongs.length > 0) {
      const rows = newSongs.map(s => ({
        user_id: userId,
        track_id: s.trackId,
        name: s.name,
        added_at: s.addedAt,
        artist_ids: s.artistIds,
        artist_names: s.artistNames,
        album_release_date: s.albumReleaseDate,
        isrc: s.isrc,
      }));

      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        await supabase.from('liked_songs').upsert(chunk, {
          onConflict: 'user_id,track_id',
          ignoreDuplicates: true,
        });
      }
    }

    // Tüm şarkılardan unique artist ID'leri topla (1000+ satır için paginate)
    const allSongs = await fetchAll(
      supabase.from('liked_songs').select('artist_ids, artist_names').eq('user_id', userId)
    );

    const artistMap = new Map();
    for (const song of allSongs) {
      song.artist_ids.forEach((id, i) => {
        if (!artistMap.has(id)) {
          artistMap.set(id, song.artist_names?.[i] || 'Unknown');
        }
      });
    }

    onProgress?.({
      step: 'artists',
      message: `${artistMap.size} sanatçının genre'ları çekiliyor...`,
      total: artistMap.size,
      current: 0
    });

    // Tüm cached artist'leri bir seferde çek
    const artistIds = [...artistMap.keys()];
    let cachedArtists = [];
    for (const chunk of chunkArray(artistIds, 300)) {
      const { data } = await supabase
        .from('artists')
        .select('spotify_id, fetched_at')
        .in('spotify_id', chunk);
      if (data) cachedArtists.push(...data);
    }
    const cachedMap = new Map(cachedArtists.map(a => [a.spotify_id, a]));

    let processed = 0;
    const currentToken = await getValidToken(userId);
    const BATCH_SIZE = 20;
    const artistEntries = [...artistMap.entries()];

    for (let i = 0; i < artistEntries.length; i += BATCH_SIZE) {
      if (abortSignal?.aborted) {
        console.log('Sync aborted by client disconnect');
        break;
      }
      const batch = artistEntries.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async ([artistId, artistName]) => {
          await enrichArtistGenre(artistId, artistName, currentToken, cachedMap);
          processed++;
          if (processed % 20 === 0) {
            onProgress?.({ step: 'artists', current: processed, total: artistMap.size });
          }
        })
      );
    }

    onProgress?.({ step: 'timeline', message: 'Timeline hesaplanıyor...' });

    // Timeline hesapla: tüm şarkıları ve artist'leri çek (paginated)
    const allUserSongs = await fetchAll(
      supabase.from('liked_songs').select('*').eq('user_id', userId)
    );

    const allArtistIds = [...new Set(allUserSongs.flatMap(s => s.artist_ids))];
    let allArtists = [];
    for (const chunk of chunkArray(allArtistIds, 300)) {
      const { data } = await supabase
        .from('artists')
        .select('*')
        .in('spotify_id', chunk);
      if (data) allArtists.push(...data);
    }
    const artistsMap = new Map(allArtists.map(a => [a.spotify_id, a]));

    const timeline = computeTimeline(allUserSongs, artistsMap);

    // Timeline ve sync state'i güncelle
    const aborted = abortSignal?.aborted;
    const updates = {
      timeline,
      last_sync_at: new Date().toISOString(),
    };
    // last_added_at'ı sadece tam sync'te güncelle, yarıda kaldıysa güncelleme
    if (newSongs.length > 0 && !aborted) {
      updates.last_added_at = newSongs[0].addedAt;
    }
    await supabase.from('users').update(updates).eq('spotify_id', userId);

    onProgress?.({ step: 'done', message: aborted ? 'Kısmi sync tamamlandı' : 'Tamamlandı!' });
  } finally {
    syncLocks.delete(userId);
  }
}
