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

  // O yılın şarkılarını çek
  const yearStart = `${year}-01-01T00:00:00Z`;
  const yearEnd = `${year + 1}-01-01T00:00:00Z`;
  const { data: songs } = await supabase
    .from('liked_songs')
    .select('name, artist_ids, added_at')
    .eq('user_id', req.userId)
    .gte('added_at', yearStart)
    .lt('added_at', yearEnd)
    .order('added_at');

  // İlgili artist'leri çek
  const artistIds = [...new Set((songs || []).flatMap(s => s.artist_ids))];
  let artists = [];
  for (const chunk of chunkArray(artistIds, 300)) {
    const { data } = await supabase
      .from('artists')
      .select('spotify_id, name, macro_genres')
      .in('spotify_id', chunk);
    if (data) artists.push(...data);
  }
  const artistMap = new Map(artists.map(a => [a.spotify_id, a]));

  const enriched = (songs || []).map(s => ({
    name: s.name,
    artist: artistMap.get(s.artist_ids[0])?.name || 'Unknown',
    genres: s.artist_ids.flatMap(id => artistMap.get(id)?.macro_genres || []),
    addedAt: s.added_at,
  }));

  res.json({ ...yearData, songs: enriched });
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

    res.json({
      userCount: userCount || 0,
      songCount: songCount || 0,
      artistCount: artistCount || 0,
      recentUsers: (recentUsers || []).map(u => ({
        displayName: u.display_name,
        profileImage: u.profile_image,
      })),
      topArtists,
      topGenres,
    });
  } catch (err) {
    console.error('Public stats error:', err);
    res.json({ userCount: 0, songCount: 0, artistCount: 0, recentUsers: [], topArtists: [], topGenres: [] });
  }
});

export default router;
