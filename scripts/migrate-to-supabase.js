import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const db = JSON.parse(readFileSync('db.json', 'utf-8'));

async function migrate() {
  console.log('Starting migration...');

  // 1. Users
  const userEntries = Object.entries(db.users || {});
  console.log(`Migrating ${userEntries.length} users...`);
  for (const [spotifyId, user] of userEntries) {
    const timeline = db.timeline?.[spotifyId] || null;
    const { error } = await supabase.from('users').upsert({
      spotify_id: spotifyId,
      display_name: user.displayName,
      profile_image: user.profileImage,
      access_token: user.accessToken,
      refresh_token: user.refreshToken,
      token_expires_at: user.tokenExpiresAt,
      last_sync_at: user.lastSyncAt || null,
      last_added_at: user.lastAddedAt || null,
      timeline: timeline,
    });
    if (error) console.error(`User ${spotifyId} error:`, error.message);
    else console.log(`  User ${user.displayName} OK`);
  }

  // 2. Artists
  const artistEntries = Object.entries(db.artists || {});
  console.log(`Migrating ${artistEntries.length} artists...`);
  const artistRows = artistEntries.map(([spotifyId, a]) => ({
    spotify_id: spotifyId,
    name: a.name,
    spotify_genres: a.spotifyGenres || [],
    lastfm_tags: a.lastfmTags || [],
    macro_genres: a.macroGenres || [],
    genre_source: a.genreSource || 'unknown',
    fetched_at: a.fetchedAt || null,
  }));

  // 500'lük chunk'lar halinde
  for (let i = 0; i < artistRows.length; i += 500) {
    const chunk = artistRows.slice(i, i + 500);
    const { error } = await supabase.from('artists').upsert(chunk);
    if (error) console.error(`Artists batch ${i} error:`, error.message);
    else console.log(`  Artists ${i}-${i + chunk.length} OK`);
  }

  // 3. Liked Songs
  for (const [userId, songs] of Object.entries(db.likedSongs || {})) {
    console.log(`Migrating ${songs.length} songs for user ${userId}...`);
    const rows = songs.map(s => ({
      user_id: userId,
      track_id: s.trackId,
      name: s.name,
      added_at: s.addedAt,
      artist_ids: s.artistIds,
      artist_names: s.artistNames || [],
      album_release_date: s.albumReleaseDate || null,
      isrc: s.isrc || null,
    }));

    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from('liked_songs').upsert(chunk, {
        onConflict: 'user_id,track_id',
        ignoreDuplicates: true,
      });
      if (error) console.error(`Songs batch ${i} error:`, error.message);
      else console.log(`  Songs ${i}-${i + chunk.length} OK`);
    }
  }

  console.log('Migration complete!');
}

migrate().catch(console.error);
