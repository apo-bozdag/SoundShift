import { Router } from 'express';
import supabase from './db.js';

const router = Router();

// List user's synced playlists
router.get('/playlists', async (req, res) => {
  try {
    const { data: playlists } = await supabase
      .from('playlists')
      .select('id, spotify_id, name, description, image_url, track_count, genre_distribution, synced_at')
      .eq('user_id', req.userId)
      .order('synced_at', { ascending: false });

    res.json({ playlists: playlists || [] });
  } catch (err) {
    console.error('Playlists list error:', err);
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

// Playlist detail: tracks with genres, genre breakdown
router.get('/playlists/:id', async (req, res) => {
  try {
    const playlistId = `${req.userId}:${req.params.id}`;

    const { data: playlist } = await supabase
      .from('playlists')
      .select('*')
      .eq('id', playlistId)
      .single();

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    const { data: tracks } = await supabase
      .from('playlist_tracks')
      .select('track_id, name, artists, genre, added_at')
      .eq('playlist_id', playlistId)
      .order('added_at', { ascending: false });

    res.json({
      playlist: {
        id: playlist.spotify_id,
        name: playlist.name,
        description: playlist.description,
        imageUrl: playlist.image_url,
        trackCount: playlist.track_count,
        genreDistribution: playlist.genre_distribution,
        syncedAt: playlist.synced_at,
      },
      tracks: (tracks || []).map(t => ({
        trackId: t.track_id,
        name: t.name,
        artists: t.artists,
        genre: t.genre,
        addedAt: t.added_at,
      })),
    });
  } catch (err) {
    console.error('Playlist detail error:', err);
    res.status(500).json({ error: 'Failed to fetch playlist detail' });
  }
});

// Playlist compatibility: compare playlist genres vs user's overall taste
router.get('/playlists/:id/compatibility', async (req, res) => {
  try {
    const playlistId = `${req.userId}:${req.params.id}`;

    const { data: playlist } = await supabase
      .from('playlists')
      .select('genre_distribution')
      .eq('id', playlistId)
      .single();

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // User's overall genre distribution from timeline
    const { data: user } = await supabase
      .from('users')
      .select('timeline')
      .eq('spotify_id', req.userId)
      .single();

    if (!user?.timeline?.years?.length) {
      return res.json({ compatibility: 0 });
    }

    // Build user genre distribution (normalized)
    const userGenres = {};
    for (const y of user.timeline.years) {
      for (const [g, c] of Object.entries(y.genres)) {
        if (g !== 'Unknown') userGenres[g] = (userGenres[g] || 0) + c;
      }
    }
    const userTotal = Object.values(userGenres).reduce((a, b) => a + b, 0) || 1;

    const playlistGenres = playlist.genre_distribution || {};
    const playlistTotal = Object.values(playlistGenres).reduce((a, b) => a + b, 0) || 1;

    // Cosine similarity
    const allGenres = new Set([...Object.keys(userGenres), ...Object.keys(playlistGenres)]);
    let dotProduct = 0, magA = 0, magB = 0;
    for (const g of allGenres) {
      const a = (userGenres[g] || 0) / userTotal;
      const b = (playlistGenres[g] || 0) / playlistTotal;
      dotProduct += a * b;
      magA += a * a;
      magB += b * b;
    }
    const compatibility = (magA && magB)
      ? Math.round((dotProduct / (Math.sqrt(magA) * Math.sqrt(magB))) * 100)
      : 0;

    res.json({ compatibility });
  } catch (err) {
    console.error('Playlist compatibility error:', err);
    res.status(500).json({ error: 'Failed to calculate compatibility' });
  }
});

export default router;
