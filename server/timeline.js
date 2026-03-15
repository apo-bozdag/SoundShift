import { Router } from 'express';
import supabase from './db.js';
import { requireAuth } from './auth.js';

const router = Router();

// Helper: chunk array for .in() queries
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// Helper: Supabase'den 1000+ satır çekmek için paginated select
async function fetchAll(queryFn) {
  const PAGE = 1000;
  let all = [];
  let from = 0;
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

// Hesaplanmış timeline verisi
router.get('/timeline', requireAuth, async (req, res) => {
  const { data: user } = await supabase
    .from('users')
    .select('timeline')
    .eq('spotify_id', req.userId)
    .single();

  res.json(user?.timeline || { years: [], summary: null });
});

// Yıl detayı
router.get('/timeline/:year', requireAuth, async (req, res) => {
  const year = parseInt(req.params.year);

  const { data: user } = await supabase
    .from('users')
    .select('timeline')
    .eq('spotify_id', req.userId)
    .single();

  if (!user?.timeline) {
    return res.status(404).json({ error: 'No timeline data' });
  }

  const yearData = user.timeline.years.find(y => y.year === year);
  if (!yearData) {
    return res.status(404).json({ error: 'Year not found' });
  }

  // O yılın şarkılarını çek (liked songs + playlist tracks)
  const yearStart = `${year}-01-01T00:00:00Z`;
  const yearEnd = `${year + 1}-01-01T00:00:00Z`;

  const { data: likedSongs } = await supabase
    .from('liked_songs')
    .select('track_id, name, artist_ids, added_at')
    .eq('user_id', req.userId)
    .gte('added_at', yearStart)
    .lt('added_at', yearEnd)
    .order('added_at');

  // Playlist track'lerini de çek (aynı yıl aralığında)
  const playlistTracks = await fetchAll(() =>
    supabase.from('playlist_tracks')
      .select('track_id, name, artist_ids, added_at')
      .like('playlist_id', `${req.userId}:%`)
      .gte('added_at', yearStart)
      .lt('added_at', yearEnd)
      .order('added_at')
  );

  // Birleştir (duplicate'siz)
  const seenTrackIds = new Set((likedSongs || []).map(s => s.track_id));
  const allSongs = [...(likedSongs || [])];
  for (const pt of playlistTracks) {
    if (pt.track_id && !seenTrackIds.has(pt.track_id)) {
      seenTrackIds.add(pt.track_id);
      allSongs.push(pt);
    }
  }

  // İlgili artist'leri çek
  const artistIds = [...new Set(allSongs.flatMap(s => s.artist_ids || []))];
  let artists = [];
  for (const chunk of chunkArray(artistIds, 300)) {
    const { data } = await supabase
      .from('artists')
      .select('spotify_id, name, macro_genres')
      .in('spotify_id', chunk);
    if (data) artists.push(...data);
  }
  const artistMap = new Map(artists.map(a => [a.spotify_id, a]));

  const enriched = allSongs.map(s => {
    const mainArtist = artistMap.get((s.artist_ids || [])[0]);
    const genres = (s.artist_ids || []).flatMap(id => artistMap.get(id)?.macro_genres || []).filter(g => g !== 'Unknown');
    return {
      trackId: s.track_id || null,
      name: s.name,
      artist: mainArtist?.name || null,
      artistId: (s.artist_ids || [])[0] || null,
      genres,
      addedAt: s.added_at,
    };
  }).filter(s => s.artist);

  // topArtists'tan Unknown filtrele + artistId ekle (songs'tan bul)
  const artistNameToId = new Map();
  for (const s of allSongs) {
    for (const aid of (s.artist_ids || [])) {
      const a = artistMap.get(aid);
      if (a?.name && !artistNameToId.has(a.name)) artistNameToId.set(a.name, aid);
    }
  }
  const filteredTopArtists = (yearData.topArtists || [])
    .filter(a => a.name && a.name !== 'Unknown')
    .map(a => ({ ...a, artistId: artistNameToId.get(a.name) || null }));

  res.json({ ...yearData, topArtists: filteredTopArtists, songs: enriched });
});

// Genel istatistikler
router.get('/stats', requireAuth, async (req, res) => {
  const { data: user } = await supabase
    .from('users')
    .select('timeline, last_sync_at')
    .eq('spotify_id', req.userId)
    .single();

  const { count: songCount } = await supabase
    .from('liked_songs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', req.userId);

  if (!user?.timeline || songCount === 0) {
    return res.json({ totalTracks: 0 });
  }

  const timeline = user.timeline;

  // En çok dinlenen genre
  const genreTotals = {};
  for (const year of timeline.years) {
    for (const [genre, count] of Object.entries(year.genres)) {
      genreTotals[genre] = (genreTotals[genre] || 0) + count;
    }
  }

  const topGenre = Object.entries(genreTotals)
    .filter(([g]) => g !== 'Unknown')
    .sort((a, b) => b[1] - a[1])[0];

  // Unique artists (paginated, 1000+ şarkı olabilir)
  const artistData = await fetchAll(() =>
    supabase.from('liked_songs').select('artist_ids').eq('user_id', req.userId).order('id')
  );

  const uniqueArtists = new Set();
  for (const song of (artistData || [])) {
    song.artist_ids.forEach(id => uniqueArtists.add(id));
  }

  res.json({
    totalTracks: songCount,
    uniqueArtists: uniqueArtists.size,
    topGenre: topGenre ? topGenre[0] : null,
    genreBreakdown: genreTotals,
    yearsSpan: timeline.years.length > 0
      ? `${timeline.years[0].year} - ${timeline.years.at(-1).year}`
      : null,
    lastSyncAt: user.last_sync_at,
    ...timeline.summary
  });
});

// Kullanıcı eşleştirme (genre benzerliği)
router.get('/matches', requireAuth, async (req, res) => {
  try {
    const { data: me } = await supabase
      .from('users')
      .select('spotify_id, display_name, profile_image, timeline')
      .eq('spotify_id', req.userId)
      .single();

    if (!me?.timeline?.years?.length) {
      return res.json({ matches: [] });
    }

    // Benim genre dağılımım
    const myGenres = {};
    for (const y of me.timeline.years) {
      for (const [g, c] of Object.entries(y.genres)) {
        if (g !== 'Unknown') myGenres[g] = (myGenres[g] || 0) + c;
      }
    }
    const myTotal = Object.values(myGenres).reduce((a, b) => a + b, 0) || 1;

    // Fetch my playlists for playlist-based scoring
    const { data: myPlaylists } = await supabase
      .from('playlists')
      .select('genre_distribution')
      .eq('user_id', req.userId);

    // Diğer kullanıcılar
    const { data: others } = await supabase
      .from('users')
      .select('spotify_id, display_name, profile_image, timeline')
      .neq('spotify_id', req.userId);

    // Pre-fetch all other users' playlists
    const otherIds = (others || []).map(u => u.spotify_id);
    let allOtherPlaylists = [];
    if (otherIds.length > 0) {
      for (const chunk of chunkArray(otherIds, 300)) {
        const { data } = await supabase
          .from('playlists')
          .select('user_id, genre_distribution')
          .in('user_id', chunk);
        if (data) allOtherPlaylists.push(...data);
      }
    }
    const playlistsByUser = new Map();
    for (const p of allOtherPlaylists) {
      if (!playlistsByUser.has(p.user_id)) playlistsByUser.set(p.user_id, []);
      playlistsByUser.get(p.user_id).push(p.genre_distribution);
    }

    const matches = (others || [])
      .filter(u => u.timeline?.years?.length > 0)
      .map(u => {
        // Onun genre dağılımı
        const theirGenres = {};
        for (const y of u.timeline.years) {
          for (const [g, c] of Object.entries(y.genres)) {
            if (g !== 'Unknown') theirGenres[g] = (theirGenres[g] || 0) + c;
          }
        }
        const theirTotal = Object.values(theirGenres).reduce((a, b) => a + b, 0) || 1;

        // Cosine similarity (liked songs)
        const allGenres = new Set([...Object.keys(myGenres), ...Object.keys(theirGenres)]);
        let dotProduct = 0, magA = 0, magB = 0;
        for (const g of allGenres) {
          const a = (myGenres[g] || 0) / myTotal;
          const b = (theirGenres[g] || 0) / theirTotal;
          dotProduct += a * b;
          magA += a * a;
          magB += b * b;
        }
        const likedSimilarity = (magA && magB)
          ? (dotProduct / (Math.sqrt(magA) * Math.sqrt(magB))) * 100
          : 0;

        // Playlist overlap score
        const myPls = (myPlaylists || []).map(p => p.genre_distribution).filter(d => d && Object.keys(d).length > 0);
        const theirPls = (playlistsByUser.get(u.spotify_id) || []).filter(d => d && Object.keys(d).length > 0);

        let playlistScore = 0;
        if (myPls.length > 0 && theirPls.length > 0) {
          let totalSim = 0;
          let comparisons = 0;
          for (const myDist of myPls) {
            for (const theirDist of theirPls) {
              const pGenres = new Set([...Object.keys(myDist), ...Object.keys(theirDist)]);
              const myPTotal = Object.values(myDist).reduce((a, b) => a + b, 0) || 1;
              const thPTotal = Object.values(theirDist).reduce((a, b) => a + b, 0) || 1;
              let dp = 0, mA = 0, mB = 0;
              for (const g of pGenres) {
                const va = (myDist[g] || 0) / myPTotal;
                const vb = (theirDist[g] || 0) / thPTotal;
                dp += va * vb;
                mA += va * va;
                mB += vb * vb;
              }
              if (mA && mB) totalSim += (dp / (Math.sqrt(mA) * Math.sqrt(mB))) * 100;
              comparisons++;
            }
          }
          playlistScore = comparisons > 0 ? totalSim / comparisons : 0;
        }

        // Combined: 60% liked songs + 40% playlist overlap (fallback to 100% liked if no playlists)
        const hasPlaylists = myPls.length > 0 && theirPls.length > 0;
        const similarity = hasPlaylists
          ? Math.round(likedSimilarity * 0.6 + playlistScore * 0.4)
          : Math.round(likedSimilarity);

        // Ortak en güçlü genre
        let topCommon = null;
        let topCommonScore = 0;
        for (const g of allGenres) {
          const score = Math.min(myGenres[g] || 0, theirGenres[g] || 0);
          if (score > topCommonScore) {
            topCommonScore = score;
            topCommon = g;
          }
        }

        // Genre karşılaştırma detayları
        const genreComparison = [];
        for (const g of allGenres) {
          const myPct = Math.round(((myGenres[g] || 0) / myTotal) * 100);
          const theirPct = Math.round(((theirGenres[g] || 0) / theirTotal) * 100);
          if (myPct > 0 || theirPct > 0) {
            genreComparison.push({ genre: g, myPct, theirPct });
          }
        }
        genreComparison.sort((a, b) => (b.myPct + b.theirPct) - (a.myPct + a.theirPct));

        return {
          userId: u.spotify_id,
          displayName: u.display_name,
          profileImage: u.profile_image,
          matchPercent: similarity,
          topCommonGenre: topCommon,
          genreComparison: genreComparison.slice(0, 8),
        };
      })
      .sort((a, b) => b.matchPercent - a.matchPercent);

    res.json({ matches });
  } catch (err) {
    console.error('Matches error:', err);
    res.status(500).json({ error: 'Failed to calculate matches' });
  }
});

// Public: anasayfa istatistikleri (auth gerektirmez)
router.get('/public-stats', async (req, res) => {
  try {
    // Toplam kullanıcı sayısı
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Toplam şarkı sayısı
    const { count: songCount } = await supabase
      .from('liked_songs')
      .select('*', { count: 'exact', head: true });

    // Toplam artist sayısı
    const { count: artistCount } = await supabase
      .from('artists')
      .select('*', { count: 'exact', head: true });

    // Son üye olanlar (display_name + profile_image)
    const { data: recentUsers } = await supabase
      .from('users')
      .select('display_name, profile_image, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    // En popüler artist'ler (en çok şarkıda geçen)
    const allSongs = await fetchAll(() =>
      supabase.from('liked_songs').select('artist_ids').order('id')
    );

    const artistFreq = {};
    for (const song of allSongs) {
      for (const id of song.artist_ids) {
        artistFreq[id] = (artistFreq[id] || 0) + 1;
      }
    }
    const topArtistIds = Object.entries(artistFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);

    let topArtists = [];
    if (topArtistIds.length > 0) {
      const { data } = await supabase
        .from('artists')
        .select('spotify_id, name, macro_genres')
        .in('spotify_id', topArtistIds);
      topArtists = (data || []).map(a => ({
        id: a.spotify_id,
        name: a.name,
        genre: a.macro_genres?.[0] || 'Unknown',
        count: artistFreq[a.spotify_id],
      })).sort((a, b) => b.count - a.count);
    }

    // Genel genre dağılımı
    const { data: allArtists } = await supabase
      .from('artists')
      .select('macro_genres');

    const genreTotals = {};
    for (const a of (allArtists || [])) {
      for (const g of (a.macro_genres || [])) {
        if (g !== 'Unknown') genreTotals[g] = (genreTotals[g] || 0) + 1;
      }
    }
    const topGenres = Object.entries(genreTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));

    // Yıl aralığı: en eski ve en yeni liked song
    const { data: oldest } = await supabase
      .from('liked_songs')
      .select('added_at')
      .order('added_at', { ascending: true })
      .limit(1)
      .single();

    const { data: newest } = await supabase
      .from('liked_songs')
      .select('added_at')
      .order('added_at', { ascending: false })
      .limit(1)
      .single();

    let yearsOfMusic = null;
    if (oldest?.added_at && newest?.added_at) {
      const from = new Date(oldest.added_at).getFullYear();
      const to = new Date(newest.added_at).getFullYear();
      yearsOfMusic = to - from + 1;
    }

    res.json({
      userCount: userCount || 0,
      songCount: songCount || 0,
      artistCount: artistCount || 0,
      yearsOfMusic,
      recentUsers: (recentUsers || []).map(u => ({
        displayName: u.display_name,
        profileImage: u.profile_image,
      })),
      topArtists,
      topGenres,
    });
  } catch (err) {
    console.error('Public stats error:', err);
    res.json({ userCount: 0, songCount: 0, artistCount: 0, yearsOfMusic: null, recentUsers: [], topArtists: [], topGenres: [] });
  }
});

// Public: tüm top sanatçılar (auth gerektirmez)
router.get('/public-top-artists', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    const allSongs = await fetchAll(() =>
      supabase.from('liked_songs').select('artist_ids').order('id')
    );

    const artistFreq = {};
    for (const song of allSongs) {
      for (const id of song.artist_ids) {
        artistFreq[id] = (artistFreq[id] || 0) + 1;
      }
    }

    const topArtistIds = Object.entries(artistFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    let topArtists = [];
    if (topArtistIds.length > 0) {
      const chunks = [];
      for (let i = 0; i < topArtistIds.length; i += 300) {
        chunks.push(topArtistIds.slice(i, i + 300));
      }
      for (const chunk of chunks) {
        const { data } = await supabase
          .from('artists')
          .select('spotify_id, name, macro_genres')
          .in('spotify_id', chunk);
        if (data) topArtists.push(...data);
      }
      topArtists = topArtists.map(a => ({
        id: a.spotify_id,
        name: a.name,
        genre: a.macro_genres?.[0] || 'Unknown',
        count: artistFreq[a.spotify_id],
      })).sort((a, b) => b.count - a.count);
    }

    res.json({ artists: topArtists, total: Object.keys(artistFreq).length });
  } catch (err) {
    console.error('Public top artists error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// Public: sanatçının şarkıları (auth gerektirmez)
router.get('/public-artist-songs/:artistId', async (req, res) => {
  try {
    const { artistId } = req.params;

    // Artist bilgisi
    const { data: artist } = await supabase
      .from('artists')
      .select('spotify_id, name, macro_genres')
      .eq('spotify_id', artistId)
      .single();

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    // Bu sanatçının geçtiği şarkıları bul (jsonb array contains)
    const allSongs = await fetchAll(() =>
      supabase
        .from('liked_songs')
        .select('track_id, name, artist_ids, artist_names, added_at, user_id')
        .filter('artist_ids', 'cs', JSON.stringify([artistId]))
        .order('added_at', { ascending: false })
    );

    // Beğenen kullanıcıların bilgilerini çek
    const userIds = [...new Set(allSongs.map(s => s.user_id))];
    let usersMap = new Map();
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('spotify_id, display_name, profile_image')
        .in('spotify_id', userIds);
      for (const u of (users || [])) {
        usersMap.set(u.spotify_id, {
          displayName: u.display_name,
          profileImage: u.profile_image,
        });
      }
    }

    // Unique şarkılar (farklı kullanıcılardan aynı şarkı gelebilir)
    const seen = new Map();
    for (const s of allSongs) {
      const key = `${s.name}-${(s.artist_names || [])[0]}`;
      if (!seen.has(key)) {
        seen.set(key, {
          trackId: s.track_id,
          name: s.name,
          artists: s.artist_names || [],
          addedAt: s.added_at,
          likedBy: [],
        });
      }
      const user = usersMap.get(s.user_id);
      if (user && !seen.get(key).likedBy.find(u => u.displayName === user.displayName)) {
        seen.get(key).likedBy.push(user);
      }
    }

    const uniqueSongs = [...seen.values()]
      .sort((a, b) => b.likedBy.length - a.likedBy.length)
      .slice(0, 50);

    res.json({
      artist: {
        name: artist.name,
        genres: artist.macro_genres || [],
      },
      songs: uniqueSongs,
      totalLikes: allSongs.length,
    });
  } catch (err) {
    console.error('Public artist songs error:', err);
    res.status(500).json({ error: 'Failed to fetch artist songs' });
  }
});

// Public: tüm community playlist'leri (opsiyonel auth ile uyum yüzdesi)
router.get('/public-playlists', async (req, res) => {
  try {
    // Tüm playlist'leri kullanıcı bilgisiyle çek
    const { data: playlists } = await supabase
      .from('playlists')
      .select('id, spotify_id, user_id, name, description, image_url, track_count, genre_distribution, synced_at')
      .order('track_count', { ascending: false });

    if (!playlists?.length) {
      return res.json({ playlists: [] });
    }

    // Playlist sahiplerinin bilgilerini çek
    const ownerIds = [...new Set(playlists.map(p => p.user_id))];
    let owners = [];
    for (const chunk of chunkArray(ownerIds, 300)) {
      const { data } = await supabase
        .from('users')
        .select('spotify_id, display_name, profile_image')
        .in('spotify_id', chunk);
      if (data) owners.push(...data);
    }
    const ownerMap = new Map(owners.map(u => [u.spotify_id, u]));

    // Login olan kullanıcı varsa uyum yüzdesi hesapla
    let userGenres = null;
    let userTotal = 1;
    const userId = req.cookies?.spotify_user_id;
    if (userId) {
      const { data: user } = await supabase
        .from('users')
        .select('timeline')
        .eq('spotify_id', userId)
        .single();

      if (user?.timeline?.years?.length) {
        userGenres = {};
        for (const y of user.timeline.years) {
          for (const [g, c] of Object.entries(y.genres)) {
            if (g !== 'Unknown') userGenres[g] = (userGenres[g] || 0) + c;
          }
        }
        userTotal = Object.values(userGenres).reduce((a, b) => a + b, 0) || 1;
      }
    }

    const result = playlists.map(p => {
      const owner = ownerMap.get(p.user_id);
      const topGenres = Object.entries(p.genre_distribution || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);

      let compatibility = null;
      if (userGenres && p.genre_distribution) {
        const plGenres = p.genre_distribution;
        const plTotal = Object.values(plGenres).reduce((a, b) => a + b, 0) || 1;
        const allG = new Set([...Object.keys(userGenres), ...Object.keys(plGenres)]);
        let dp = 0, mA = 0, mB = 0;
        for (const g of allG) {
          const a = (userGenres[g] || 0) / userTotal;
          const b = (plGenres[g] || 0) / plTotal;
          dp += a * b;
          mA += a * a;
          mB += b * b;
        }
        compatibility = (mA && mB)
          ? Math.round((dp / (Math.sqrt(mA) * Math.sqrt(mB))) * 100)
          : 0;
      }

      return {
        id: p.spotify_id,
        name: p.name,
        imageUrl: p.image_url,
        trackCount: p.track_count,
        topGenres,
        compatibility,
        owner: owner ? {
          displayName: owner.display_name,
          profileImage: owner.profile_image,
        } : null,
      };
    });

    res.json({ playlists: result });
  } catch (err) {
    console.error('Public playlists error:', err);
    res.json({ playlists: [] });
  }
});

export default router;
