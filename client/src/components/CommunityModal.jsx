import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';

const GENRE_COLORS = {
  'Pop': '#FF6B8A', 'Rock': '#E74C3C', 'Hip-Hop': '#9B59B6',
  'Electronic': '#3498DB', 'R&B/Soul': '#F39C12', 'Indie': '#2ECC71',
  'Jazz': '#1ABC9C', 'Folk': '#8B7355', 'Classical': '#7F8C8D',
  'Latin': '#E91E63', 'Country': '#FF9800', 'Blues': '#5C6BC0',
  'Reggae': '#66BB6A', 'World': '#AB47BC',
};

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function getCompatColor(pct) {
  if (pct >= 80) return '#1DB954';
  if (pct >= 60) return '#F39C12';
  if (pct >= 40) return '#E74C3C';
  return '#7F8C8D';
}

export default function CommunityModal({ onClose }) {
  const { t } = useI18n();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [artistModal, setArtistModal] = useState(null);
  const [likedByModal, setLikedByModal] = useState(null);
  const [allArtists, setAllArtists] = useState(null);
  const [communityPlaylists, setCommunityPlaylists] = useState(null);

  const handleShowAllArtists = () => {
    setAllArtists({ loading: true });
    fetch('/api/public-top-artists?limit=50')
      .then(r => r.json())
      .then(data => setAllArtists({ loading: false, artists: data.artists, total: data.total }))
      .catch(() => setAllArtists(null));
  };

  useEffect(() => {
    fetch('/api/public-stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch('/api/public-playlists', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setCommunityPlaylists(data.playlists || []))
      .catch(() => setCommunityPlaylists([]));
  }, []);

  const handleArtistClick = (artist) => {
    setArtistModal({ name: artist.name, loading: true });
    fetch(`/api/public-artist-songs/${artist.id}`)
      .then(r => r.json())
      .then(data => setArtistModal({ name: artist.name, loading: false, data }))
      .catch(() => setArtistModal(null));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content community-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>

        <div className="modal-header">
          <h2>{t('header.community')}</h2>
        </div>

        {/* Skeleton */}
        {loading && (
          <>
            <div className="community-counters">
              {[0,1,2,3].map(i => (
                <div key={i} className="community-counter">
                  <span className="skeleton skeleton-counter" />
                  <span className="skeleton skeleton-label" />
                </div>
              ))}
            </div>
            <div className="community-cards">
              <div className="community-card">
                <div className="skeleton skeleton-title" />
                {[0,1,2,3,4].map(i => (
                  <div key={i} className="skeleton skeleton-list-row" />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Loaded */}
        {!loading && stats && (
          <>
            <div className="community-counters">
              <div className="community-counter">
                <span className="counter-val">{formatNumber(stats.songCount)}</span>
                <span className="counter-lbl">{t('landing.totalSongs')}</span>
              </div>
              <div className="community-counter">
                <span className="counter-val">{formatNumber(stats.artistCount)}</span>
                <span className="counter-lbl">{t('landing.totalArtists')}</span>
              </div>
              <div className="community-counter">
                <span className="counter-val">{stats.userCount}</span>
                <span className="counter-lbl">{t('landing.totalUsers')}</span>
              </div>
              {stats.yearsOfMusic && (
                <div className="community-counter">
                  <span className="counter-val">{stats.yearsOfMusic}</span>
                  <span className="counter-lbl">{t('landing.yearsOfMusic')}</span>
                </div>
              )}
            </div>

            {/* Recent Users */}
            {stats.recentUsers?.length > 0 && (
              <div className="community-card">
                <h4 className="community-card-title">{t('landing.recentUsers')}</h4>
                <div className="community-avatars">
                  {stats.recentUsers.map((u, i) => (
                    <div key={i} className="community-avatar">
                      {u.profileImage ? (
                        <img src={u.profileImage} alt="" />
                      ) : (
                        <div className="avatar-placeholder">{u.displayName?.[0] || '?'}</div>
                      )}
                      <span className="avatar-name">{u.displayName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Artists */}
            {stats.topArtists?.length > 0 && (
              <div className="community-card">
                <h4 className="community-card-title">{t('landing.topArtists')}</h4>
                <div className="community-list">
                  {stats.topArtists.map((a, i) => (
                    <div key={i} className="landing-list-item clickable" onClick={() => handleArtistClick(a)}>
                      <span className="list-rank">#{i + 1}</span>
                      <div className="list-info">
                        <span className="list-name">{a.name}</span>
                        <span className="list-meta">
                          <span
                            className="list-genre-dot"
                            style={{ backgroundColor: GENRE_COLORS[a.genre] || '#666' }}
                          />
                          {a.genre}
                        </span>
                      </div>
                      <span className="list-count">{a.count} {t('landing.songs')} &rsaquo;</span>
                    </div>
                  ))}
                </div>
                <button className="show-all-btn" onClick={handleShowAllArtists}>
                  {t('landing.showAll')}
                </button>
              </div>
            )}

            {/* Top Genres */}
            {stats.topGenres?.length > 0 && (
              <div className="community-card">
                <h4 className="community-card-title">{t('landing.topGenres')}</h4>
                <div className="landing-genres">
                  {stats.topGenres.map((g) => {
                    const max = stats.topGenres[0].count;
                    const pct = Math.round((g.count / max) * 100);
                    return (
                      <div key={g.name} className="landing-genre-row">
                        <span className="landing-genre-name">{g.name}</span>
                        <div className="landing-genre-bar">
                          <div
                            className="landing-genre-fill"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: GENRE_COLORS[g.name] || '#666'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Community Playlists */}
            {communityPlaylists?.length > 0 && (
              <div className="community-card">
                <h4 className="community-card-title">{t('community.playlists')}</h4>
                <div className="community-playlists-list">
                  {communityPlaylists.map((pl) => (
                    <div key={pl.id} className="community-playlist-item">
                      <div className="community-playlist-img">
                        {pl.imageUrl ? (
                          <img src={pl.imageUrl} alt="" />
                        ) : (
                          <div className="community-playlist-img-placeholder">&#9835;</div>
                        )}
                      </div>
                      <div className="community-playlist-info">
                        <span className="community-playlist-name">{pl.name}</span>
                        <span className="community-playlist-meta">
                          {pl.trackCount} {t('landing.songs')}
                          {pl.topGenres?.length > 0 && (
                            <>
                              {' · '}
                              {pl.topGenres.map(g => (
                                <span
                                  key={g}
                                  className="community-playlist-genre-dot"
                                  style={{ backgroundColor: GENRE_COLORS[g] || '#666' }}
                                  title={g}
                                />
                              ))}
                            </>
                          )}
                        </span>
                        {pl.owner && (
                          <span className="community-playlist-owner">
                            {pl.owner.profileImage && (
                              <img src={pl.owner.profileImage} alt="" className="community-playlist-owner-avatar" />
                            )}
                            {pl.owner.displayName}
                          </span>
                        )}
                      </div>
                      {pl.compatibility !== null && (
                        <span
                          className="community-playlist-compat"
                          style={{ color: getCompatColor(pl.compatibility) }}
                        >
                          {pl.compatibility}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* All Artists Modal */}
        {allArtists && (
          <div className="modal-overlay" onClick={() => setAllArtists(null)}>
            <div className="modal-content all-artists-modal" onClick={e => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setAllArtists(null)}>&times;</button>
              <div className="modal-header">
                <h2>{t('landing.allArtists')}</h2>
              </div>
              {allArtists.loading ? (
                <div className="artist-modal-skeleton">
                  {[0,1,2,3,4,5,6,7,8,9].map(i => (
                    <div key={i} className="artist-modal-song-skeleton">
                      <span className="skeleton skeleton-song-idx" />
                      <div style={{ flex: 1 }}>
                        <span className="skeleton skeleton-song-name-lg" />
                        <span className="skeleton skeleton-song-artists" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="all-artists-list">
                  {allArtists.artists?.map((a, i) => (
                    <div
                      key={a.id}
                      className="landing-list-item clickable"
                      onClick={() => { setAllArtists(null); handleArtistClick(a); }}
                    >
                      <span className="list-rank">#{i + 1}</span>
                      <div className="list-info">
                        <span className="list-name">{a.name}</span>
                        <span className="list-meta">
                          <span
                            className="list-genre-dot"
                            style={{ backgroundColor: GENRE_COLORS[a.genre] || '#666' }}
                          />
                          {a.genre}
                        </span>
                      </div>
                      <span className="list-count">{a.count} {t('landing.songs')} &rsaquo;</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Liked By Modal */}
        {likedByModal && (
          <div className="modal-overlay" onClick={() => setLikedByModal(null)}>
            <div className="modal-content liked-by-modal" onClick={e => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setLikedByModal(null)}>&times;</button>
              <div className="modal-header">
                <h2>{t('landing.likedBy', { count: likedByModal.length })}</h2>
              </div>
              <div className="liked-by-list">
                {likedByModal.map((u, i) => (
                  <div key={i} className="liked-by-row">
                    {u.profileImage ? (
                      <img src={u.profileImage} alt="" className="liked-by-avatar" />
                    ) : (
                      <span className="liked-by-avatar placeholder">{u.displayName?.[0] || '?'}</span>
                    )}
                    <span className="liked-by-name">{u.displayName}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Artist Songs Sub-Modal */}
        {artistModal && (
          <div className="modal-overlay" onClick={() => setArtistModal(null)}>
            <div className="modal-content artist-modal" onClick={e => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setArtistModal(null)}>&times;</button>
              <div className="modal-header">
                <h2>{artistModal.name}</h2>
              </div>
              {artistModal.loading ? (
                <div className="artist-modal-skeleton">
                  <div className="skeleton skeleton-artist-modal-sub" />
                  {[0,1,2,3,4,5,6,7].map(i => (
                    <div key={i} className="artist-modal-song-skeleton">
                      <span className="skeleton skeleton-song-idx" />
                      <div style={{ flex: 1 }}>
                        <span className="skeleton skeleton-song-name-lg" />
                        <span className="skeleton skeleton-song-artists" />
                      </div>
                      <span className="skeleton skeleton-song-likes" />
                    </div>
                  ))}
                </div>
              ) : artistModal.data ? (
                <>
                  <p className="artist-modal-sub">
                    {t('landing.artistSongs')} &middot; {t('landing.likedBy', { count: artistModal.data.totalLikes })}
                  </p>
                  <div className="artist-songs-list">
                    {artistModal.data.songs.map((s, i) => (
                      <div key={i} className="artist-song-row">
                        <span className="song-index">{i + 1}</span>
                        <div className="song-info">
                          <span className="song-name">{s.name}</span>
                          <span className="song-artist">{s.artists.join(', ')}</span>
                        </div>
                        {s.likedBy?.length > 0 && (
                          <div className="song-liked-avatars">
                            {s.likedBy.slice(0, 3).map((u, j) => (
                              u.profileImage ? (
                                <img key={j} src={u.profileImage} alt={u.displayName} title={u.displayName} className="song-liked-avatar" />
                              ) : (
                                <span key={j} className="song-liked-avatar placeholder" title={u.displayName}>
                                  {u.displayName?.[0] || '?'}
                                </span>
                              )
                            ))}
                            {s.likedBy.length > 3 && (
                              <span
                                className="song-liked-avatar more"
                                title={s.likedBy.slice(3).map(u => u.displayName).join(', ')}
                                onClick={(e) => { e.stopPropagation(); setLikedByModal(s.likedBy); }}
                              >
                                +{s.likedBy.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
