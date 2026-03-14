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

  // Unique artists
  const { data: artistData } = await supabase
    .from('liked_songs')
    .select('artist_ids')
    .eq('user_id', req.userId);

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

export default router;
