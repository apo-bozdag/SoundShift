-- Supabase Schema for SoundShift

CREATE TABLE users (
  spotify_id       TEXT PRIMARY KEY,
  display_name     TEXT,
  profile_image    TEXT,
  access_token     TEXT NOT NULL,
  refresh_token    TEXT NOT NULL,
  token_expires_at BIGINT NOT NULL,
  last_sync_at     TIMESTAMPTZ,
  last_added_at    TIMESTAMPTZ,
  timeline         JSONB,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE artists (
  spotify_id      TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  spotify_genres  JSONB DEFAULT '[]',
  lastfm_tags     JSONB DEFAULT '[]',
  macro_genres    JSONB DEFAULT '[]',
  genre_source    TEXT DEFAULT 'unknown',
  fetched_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE liked_songs (
  id                BIGINT GENERATED ALWAYS AS IDENTITY,
  user_id           TEXT NOT NULL REFERENCES users(spotify_id) ON DELETE CASCADE,
  track_id          TEXT NOT NULL,
  name              TEXT NOT NULL,
  added_at          TIMESTAMPTZ NOT NULL,
  artist_ids        JSONB NOT NULL DEFAULT '[]',
  artist_names      JSONB NOT NULL DEFAULT '[]',
  album_release_date TEXT,
  isrc              TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, track_id)
);

CREATE INDEX idx_liked_songs_user_id ON liked_songs(user_id);
CREATE INDEX idx_liked_songs_user_added ON liked_songs(user_id, added_at);
CREATE INDEX idx_artists_fetched_at ON artists(fetched_at);

-- Playlists
CREATE TABLE playlists (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(spotify_id) ON DELETE CASCADE,
  spotify_id        TEXT NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  image_url         TEXT,
  track_count       INT DEFAULT 0,
  snapshot_id       TEXT,
  genre_distribution JSONB DEFAULT '{}',
  synced_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE playlist_tracks (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id   TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id      TEXT NOT NULL,
  name          TEXT NOT NULL,
  artists       TEXT[] DEFAULT '{}',
  artist_ids    JSONB DEFAULT '[]',
  added_at      TIMESTAMPTZ,
  genre         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_playlists_user_id ON playlists(user_id);
CREATE INDEX idx_playlist_tracks_playlist_id ON playlist_tracks(playlist_id);
