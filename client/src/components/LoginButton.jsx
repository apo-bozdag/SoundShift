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

export default function LoginButton({ onLogin }) {
  const { t } = useI18n();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch('/api/public-stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div className="landing">
      <div className="landing-lang">
        <LangSwitch />
      </div>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-logo">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="#1DB954">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          <span>SoundShift</span>
        </div>
        <h1 className="landing-title">{t('landing.hero')}</h1>
        <p className="landing-subtitle">{t('landing.heroSub')}</p>
        <button className="login-btn" onClick={onLogin}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          {t('login.button')}
        </button>
      </section>

      {/* Public stats */}
      {stats && stats.userCount > 0 && (
        <>
          {/* Counters */}
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
          </section>

          <div className="landing-grid">
            {/* Recent Users */}
            {stats.recentUsers?.length > 0 && (
              <section className="landing-card">
                <h3 className="landing-card-title">{t('landing.recentUsers')}</h3>
                <div className="landing-avatars">
                  {stats.recentUsers.map((u, i) => (
                    <div key={i} className="landing-avatar">
                      {u.profileImage ? (
                        <img src={u.profileImage} alt="" />
                      ) : (
                        <div className="avatar-placeholder">{u.displayName?.[0] || '?'}</div>
                      )}
                      <span className="avatar-name">{u.displayName}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Top Artists */}
            {stats.topArtists?.length > 0 && (
              <section className="landing-card">
                <h3 className="landing-card-title">{t('landing.topArtists')}</h3>
                <div className="landing-list">
                  {stats.topArtists.map((a, i) => (
                    <div key={i} className="landing-list-item">
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
                      <span className="list-count">{a.count} {t('landing.songs')}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Genre Breakdown */}
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

      <footer className="landing-footer">
        soundshift-4no7.onrender.com
      </footer>
    </div>
  );
}
