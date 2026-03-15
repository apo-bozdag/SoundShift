import { useState, useEffect } from 'react';
import { useI18n } from '../i18n/index.jsx';
import LangSwitch from './LangSwitch';

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

function SpotifyIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#1DB954">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

export default function LoginButton({ onLogin }) {
  const { t } = useI18n();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [artistModal, setArtistModal] = useState(null);
  const [likedByModal, setLikedByModal] = useState(null);
  const [allArtists, setAllArtists] = useState(null);

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
  }, []);

  const handleArtistClick = (artist) => {
    setArtistModal({ name: artist.name, artistId: artist.id, genre: artist.genre, loading: true });
    fetch(`/api/public-artist-songs/${artist.id}`)
      .then(r => r.json())
      .then(data => setArtistModal({ name: artist.name, artistId: artist.id, genre: artist.genre, loading: false, data }))
      .catch(() => setArtistModal(null));
  };

  return (
    <div className="landing">
      {/* Top bar */}
      <header className="landing-topbar">
        <div className="landing-topbar-logo">
          <SpotifyIcon size={28} />
          <span>SoundShift</span>
        </div>
        <div className="landing-topbar-right">
          <LangSwitch />
          <button className="landing-topbar-login" onClick={onLogin}>
            {t('login.button')}
          </button>
        </div>
      </header>

      {/* Hero with gradient */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <h1 className="landing-title">{t('landing.hero')}</h1>
          <p className="landing-subtitle">{t('landing.heroSub')}</p>
          <button className="login-btn" onClick={onLogin}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            {t('login.button')}
          </button>
          <div className="landing-dev-notice">
            <p>{t('landing.devNotice')}</p>
            <p>
              {t('landing.wantAccess')}{' '}
              <a href="https://x.com/apo_bozdag" target="_blank" rel="noopener noreferrer" className="twitter-link">
                @apo_bozdag
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="landing-content">
        {/* Counters */}
        {loading && (
          <section className="landing-counters">
            {[0,1,2,3].map(i => (
              <div key={i} className="landing-counter">
                <span className="skeleton skeleton-counter" />
                <span className="skeleton skeleton-label" />
              </div>
            ))}
          </section>
        )}

        {!loading && stats && stats.userCount > 0 && (
          <>
            <section className="landing-counters">
              <div className="landing-counter">
                <span className="counter-val">{formatNumber(stats.songCount)}</span>
                <span className="counter-lbl">{t('landing.totalSongs')}</span>
              </div>
              <div className="landing-counter">
                <span className="counter-val">{formatNumber(stats.artistCount)}</span>
                <span className="counter-lbl">{t('landing.totalArtists')}</span>
              </div>
              <div className="landing-counter">
                <span className="counter-val">{stats.userCount}</span>
                <span className="counter-lbl">{t('landing.totalUsers')}</span>
              </div>
              {stats.yearsOfMusic && (
                <div className="landing-counter">
                  <span className="counter-val">{stats.yearsOfMusic}</span>
                  <span className="counter-lbl">{t('landing.yearsOfMusic')}</span>
                </div>
              )}
              {stats.recentUsers?.length > 0 && (
                <div className="landing-counter landing-counter-avatars">
                  <div className="landing-counter-avatar-row">
                    {stats.recentUsers.slice(0, 5).map((u, i) => (
                      u.profileImage ? (
                        <img key={i} src={u.profileImage} alt={u.displayName} className="landing-counter-avatar" title={u.displayName} />
                      ) : (
                        <span key={i} className="landing-counter-avatar placeholder" title={u.displayName}>{u.displayName?.[0] || '?'}</span>
                      )
                    ))}
                  </div>
                  <span className="counter-lbl">{t('landing.recentUsers')}</span>
                </div>
              )}
            </section>

            {/* Grid sections */}
            <div className="landing-grid">
              {stats.topArtists?.length > 0 && (
                <section className="landing-card">
                  <h3 className="landing-card-title">{t('landing.topArtists')}</h3>
                  <div className="landing-list">
                    {stats.topArtists.map((a, i) => (
                      <div key={i} className="landing-list-item clickable" onClick={() => handleArtistClick(a)}>
                        <span className="list-rank">#{i + 1}</span>
                        <div className="list-info">
                          <span className="list-name">{a.name}</span>
                          <span className="list-meta">
                            <span className="list-genre-dot" style={{ backgroundColor: GENRE_COLORS[a.genre] || '#666' }} />
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
                </section>
              )}

              {stats.topGenres?.length > 0 && (
                <section className="landing-card">
                  <h3 className="landing-card-title">{t('landing.topGenres')}</h3>
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
                </section>
              )}
            </div>
          </>
        )}

        {/* Skeleton grid */}
        {loading && (
          <div className="landing-grid">
            <section className="landing-card">
              <div className="skeleton skeleton-title" />
              {[0,1,2,3,4].map(i => (
                <div key={i} className="skeleton skeleton-list-row" />
              ))}
            </section>
            <section className="landing-card">
              <div className="skeleton skeleton-title" />
              {[0,1,2,3,4].map(i => (
                <div key={i} className="skeleton skeleton-list-row" />
              ))}
            </section>
          </div>
        )}
      </div>

      {/* Modals — allArtists first, artistModal on top (later in DOM = higher z) */}
      {allArtists && (
        <div className="modal-overlay" onClick={() => setAllArtists(null)}>
          <div className="modal-content all-artists-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setAllArtists(null)}>&times;</button>
            <div className="modal-header">
              <h2>{t('landing.allArtists')}</h2>
              {allArtists.total && <span className="year-badge">{allArtists.total} {t('landing.totalArtists').toLowerCase()}</span>}
            </div>
            {allArtists.loading ? (
              <div className="artist-modal-skeleton">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="artist-modal-song-skeleton">
                    <span className="skeleton skeleton-song-idx" />
                    <div style={{ flex: 1 }}><span className="skeleton skeleton-song-name-lg" /><span className="skeleton skeleton-song-artists" /></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="all-artists-list">
                {allArtists.artists?.map((a, i) => (
                  <div key={a.id} className="landing-list-item clickable" onClick={() => handleArtistClick(a)}>
                    <span className="list-rank">#{i + 1}</span>
                    <div className="list-info">
                      <span className="list-name">{a.name}</span>
                      <span className="list-meta"><span className="list-genre-dot" style={{ backgroundColor: GENRE_COLORS[a.genre] || '#666' }} />{a.genre}</span>
                    </div>
                    <span className="list-count">{a.count} {t('landing.songs')} &rsaquo;</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {artistModal && (
        <div className="modal-overlay" onClick={() => setArtistModal(null)}>
          <div className="modal-content artist-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setArtistModal(null)}>&times;</button>
            <div className="modal-header">
              <h2>{artistModal.name}</h2>
              {artistModal.artistId && (
                <a href={`https://open.spotify.com/artist/${artistModal.artistId}`} target="_blank" rel="noopener noreferrer" className="spotify-open-link" style={{ marginLeft: 8 }}>
                  <SpotifyIcon size={16} /> Spotify
                </a>
              )}
            </div>
            {artistModal.loading ? (
              <div className="artist-modal-skeleton">
                <div className="skeleton skeleton-artist-modal-sub" />
                {[0,1,2,3,4,5,6,7].map(i => (
                  <div key={i} className="artist-modal-song-skeleton">
                    <span className="skeleton skeleton-song-idx" />
                    <div style={{ flex: 1 }}><span className="skeleton skeleton-song-name-lg" /><span className="skeleton skeleton-song-artists" /></div>
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
                      {s.trackId && (
                        <a href={`https://open.spotify.com/track/${s.trackId}`} target="_blank" rel="noopener noreferrer" className="playlist-track-spotify" title="Open in Spotify">
                          <SpotifyIcon size={14} />
                        </a>
                      )}
                      {s.likedBy?.length > 0 && (
                        <div className="song-liked-avatars">
                          {s.likedBy.slice(0, 3).map((u, j) => (
                            u.profileImage ? (
                              <img key={j} src={u.profileImage} alt={u.displayName} title={u.displayName} className="song-liked-avatar" />
                            ) : (
                              <span key={j} className="song-liked-avatar placeholder" title={u.displayName}>{u.displayName?.[0] || '?'}</span>
                            )
                          ))}
                          {s.likedBy.length > 3 && (
                            <span className="song-liked-avatar more" title={s.likedBy.slice(3).map(u => u.displayName).join(', ')} onClick={(e) => { e.stopPropagation(); setLikedByModal(s.likedBy); }}>
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

      {likedByModal && (
        <div className="modal-overlay" onClick={() => setLikedByModal(null)}>
          <div className="modal-content liked-by-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setLikedByModal(null)}>&times;</button>
            <div className="modal-header"><h2>{t('landing.likedBy', { count: likedByModal.length })}</h2></div>
            <div className="liked-by-list">
              {likedByModal.map((u, i) => (
                <div key={i} className="liked-by-row">
                  {u.profileImage ? <img src={u.profileImage} alt="" className="liked-by-avatar" /> : <span className="liked-by-avatar placeholder">{u.displayName?.[0] || '?'}</span>}
                  <span className="liked-by-name">{u.displayName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <footer className="landing-footer">
        soundshift-4no7.onrender.com
      </footer>
    </div>
  );
}
