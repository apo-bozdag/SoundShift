import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';

function SpotifyIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#1DB954">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

const GENRE_COLORS = {
  'Pop': '#FF6B8A', 'Rock': '#E74C3C', 'Hip-Hop': '#9B59B6',
  'Electronic': '#3498DB', 'R&B/Soul': '#F39C12', 'Indie': '#2ECC71',
  'Jazz': '#1ABC9C', 'Folk': '#8B7355', 'Classical': '#7F8C8D',
  'Latin': '#E91E63', 'Country': '#FF9800', 'Blues': '#5C6BC0',
  'Reggae': '#66BB6A', 'World': '#AB47BC',
};

function getCompatColor(pct) {
  if (pct >= 80) return '#1DB954';
  if (pct >= 60) return '#F39C12';
  if (pct >= 40) return '#E74C3C';
  return '#7F8C8D';
}

function cosineSimilarity(distA, distB) {
  if (!distA || !distB) return null;
  const totalA = Object.values(distA).reduce((a, b) => a + b, 0) || 1;
  const totalB = Object.values(distB).reduce((a, b) => a + b, 0) || 1;
  const allGenres = new Set([...Object.keys(distA), ...Object.keys(distB)]);
  let dp = 0, mA = 0, mB = 0;
  for (const g of allGenres) {
    const a = (distA[g] || 0) / totalA;
    const b = (distB[g] || 0) / totalB;
    dp += a * b;
    mA += a * a;
    mB += b * b;
  }
  return (mA && mB) ? Math.round((dp / (Math.sqrt(mA) * Math.sqrt(mB))) * 100) : 0;
}

export default function PlaylistSection({ stats }) {
  const { t } = useI18n();
  const [playlists, setPlaylists] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [compatibility, setCompatibility] = useState(null);

  // Build user's genre distribution from stats for client-side compatibility calc
  const userGenreDist = stats?.genreBreakdown || null;

  useEffect(() => {
    fetch('/api/playlists', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setPlaylists(data.playlists || []))
      .catch(() => setPlaylists([]))
      .finally(() => setLoading(false));
  }, []);

  const openDetail = async (playlist) => {
    setSelected(playlist);
    setDetailLoading(true);
    setDetail(null);
    setCompatibility(null);

    try {
      const [detailRes, compatRes] = await Promise.all([
        fetch(`/api/playlists/${playlist.spotify_id}`, { credentials: 'include' }).then(r => r.json()),
        fetch(`/api/playlists/${playlist.spotify_id}/compatibility`, { credentials: 'include' }).then(r => r.json()),
      ]);
      setDetail(detailRes);
      setCompatibility(compatRes.compatibility);
    } catch {
      setDetail(null);
      setCompatibility(null);
    }
    setDetailLoading(false);
  };

  const getTopGenres = (genreDistribution) => {
    if (!genreDistribution) return [];
    return Object.entries(genreDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);
  };

  if (loading) {
    return (
      <div className="playlist-section">
        <h3 className="playlist-title">{t('playlist.title')}</h3>
        <div className="playlist-grid">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="playlist-card">
              <div className="skeleton skeleton-playlist-img" />
              <div style={{ flex: 1, padding: '12px' }}>
                <span className="skeleton skeleton-playlist-name" />
                <span className="skeleton skeleton-playlist-tracks" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!playlists?.length) return null;

  return (
    <div className="playlist-section">
      <h3 className="playlist-title">{t('playlist.title')}</h3>
      <div className="playlist-grid">
        {playlists.map(pl => {
          const topGenres = getTopGenres(pl.genre_distribution);
          const compat = userGenreDist ? cosineSimilarity(userGenreDist, pl.genre_distribution) : null;
          return (
            <div key={pl.id} className="playlist-card" onClick={() => openDetail(pl)}>
              {compat !== null && (
                <div className="playlist-card-compat" style={{ color: getCompatColor(compat) }}>
                  {compat}%
                </div>
              )}
              <a
                href={`https://open.spotify.com/playlist/${pl.spotify_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="playlist-card-spotify-link"
                onClick={e => e.stopPropagation()}
                title="Open in Spotify"
              >
                <SpotifyIcon size={18} />
              </a>
              <div className="playlist-card-img">
                {pl.image_url ? (
                  <img src={pl.image_url} alt="" />
                ) : (
                  <div className="playlist-card-img-placeholder">&#9835;</div>
                )}
              </div>
              <div className="playlist-card-body">
                <span className="playlist-card-name">{pl.name}</span>
                <span className="playlist-card-count">
                  {t('playlist.tracks', { count: pl.track_count })}
                </span>
                {topGenres.length > 0 && (
                  <div className="playlist-card-genres">
                    {topGenres.map(g => (
                      <span
                        key={g}
                        className="playlist-genre-dot"
                        style={{ backgroundColor: GENRE_COLORS[g] || '#666' }}
                        title={g}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Playlist Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-content playlist-detail-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)}>&times;</button>

            {detailLoading ? (
              <div className="playlist-detail-skeleton">
                <div className="skeleton skeleton-playlist-detail-header" />
                <div className="skeleton skeleton-playlist-detail-bars" />
                <div className="skeleton skeleton-playlist-detail-list" />
              </div>
            ) : detail ? (
              <>
                {/* Header */}
                <div className="playlist-detail-header">
                  <div className="playlist-detail-img">
                    {selected.image_url ? (
                      <img src={selected.image_url} alt="" />
                    ) : (
                      <div className="playlist-card-img-placeholder lg">&#9835;</div>
                    )}
                  </div>
                  <div className="playlist-detail-info">
                    <span className="playlist-detail-name">{detail.playlist.name}</span>
                    <span className="playlist-detail-count">
                      {t('playlist.tracks', { count: detail.playlist.trackCount })}
                    </span>
                    {compatibility !== null && (
                      <span className="playlist-detail-compat">
                        {t('playlist.compatibility')}: {compatibility}%
                      </span>
                    )}
                    <a
                      href={`https://open.spotify.com/playlist/${selected.spotify_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="spotify-open-link"
                    >
                      <SpotifyIcon size={16} /> Open in Spotify
                    </a>
                  </div>
                </div>

                {/* Genre Breakdown */}
                {detail.playlist.genreDistribution && Object.keys(detail.playlist.genreDistribution).length > 0 && (
                  <div className="playlist-genre-breakdown">
                    <h4>{t('playlist.genres')}</h4>
                    {Object.entries(detail.playlist.genreDistribution)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 8)
                      .map(([genre, value]) => (
                        <div key={genre} className="playlist-genre-bar-row">
                          <span className="playlist-genre-bar-label">{genre}</span>
                          <div className="playlist-genre-bar-track">
                            <div
                              className="playlist-genre-bar-fill"
                              style={{
                                width: `${Math.round(value * 100)}%`,
                                backgroundColor: GENRE_COLORS[genre] || '#666',
                              }}
                            />
                          </div>
                          <span className="playlist-genre-bar-pct">{Math.round(value * 100)}%</span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Track list */}
                <div className="playlist-track-list">
                  <h4>{t('playlist.tracks', { count: detail.tracks.length })}</h4>
                  {detail.tracks.slice(0, 50).map((track, i) => (
                    <div key={`${track.trackId}-${i}`} className="playlist-track-row">
                      <span className="playlist-track-name">{track.name}</span>
                      <span className="playlist-track-artist">{track.artists?.join(', ')}</span>
                      {track.genre && (
                        <span
                          className="playlist-track-genre-dot"
                          style={{ backgroundColor: GENRE_COLORS[track.genre] || '#666' }}
                          title={track.genre}
                        />
                      )}
                      {track.trackId && (
                        <a
                          href={`https://open.spotify.com/track/${track.trackId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="playlist-track-spotify"
                          title="Open in Spotify"
                        >
                          <SpotifyIcon size={14} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="playlist-detail-empty">{t('playlist.empty')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
