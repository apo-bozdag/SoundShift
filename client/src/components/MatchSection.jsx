import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';

const GENRE_COLORS = {
  'Pop': '#FF6B8A', 'Rock': '#E74C3C', 'Hip-Hop': '#9B59B6',
  'Electronic': '#3498DB', 'R&B/Soul': '#F39C12', 'Indie': '#2ECC71',
  'Jazz': '#1ABC9C', 'Folk': '#8B7355', 'Classical': '#7F8C8D',
  'Latin': '#E91E63', 'Country': '#FF9800', 'Blues': '#5C6BC0',
  'Reggae': '#66BB6A', 'World': '#AB47BC',
};

function getMatchColor(pct) {
  if (pct >= 80) return '#1DB954';
  if (pct >= 60) return '#F39C12';
  if (pct >= 40) return '#E74C3C';
  return '#7F8C8D';
}

export default function MatchSection() {
  const { t } = useI18n();
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch('/api/matches')
      .then(r => r.json())
      .then(data => setMatches(data.matches || []))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="match-section">
        <h3 className="match-title">{t('match.title')}</h3>
        <p className="match-subtitle">{t('match.subtitle')}</p>
        <div className="match-list">
          {[0,1,2].map(i => (
            <div key={i} className="match-card">
              <div className="skeleton skeleton-match-avatar" />
              <div style={{ flex: 1 }}>
                <span className="skeleton skeleton-match-name" />
                <span className="skeleton skeleton-match-genre" />
              </div>
              <div className="skeleton skeleton-match-pct" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!matches?.length) return null;

  return (
    <div className="match-section">
      <h3 className="match-title">{t('match.title')}</h3>
      <p className="match-subtitle">{t('match.subtitle')}</p>
      <div className="match-list">
        {matches.map(m => (
          <div key={m.userId} className="match-card" onClick={() => setSelected(m)}>
            <div className="match-avatar">
              {m.profileImage ? (
                <img src={m.profileImage} alt="" />
              ) : (
                <div className="match-avatar-placeholder">
                  {m.displayName?.[0] || '?'}
                </div>
              )}
            </div>
            <div className="match-info">
              <span className="match-name">{m.displayName}</span>
              {m.topCommonGenre && (
                <span className="match-common">
                  <span
                    className="match-genre-dot"
                    style={{ backgroundColor: GENRE_COLORS[m.topCommonGenre] || '#666' }}
                  />
                  {t('match.common')} {m.topCommonGenre}
                </span>
              )}
            </div>
            <div className="match-percent" style={{ color: getMatchColor(m.matchPercent) }}>
              <svg viewBox="0 0 36 36" className="match-ring">
                <path
                  d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0-31.831"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0-31.831"
                  fill="none"
                  stroke={getMatchColor(m.matchPercent)}
                  strokeWidth="3"
                  strokeDasharray={`${m.matchPercent}, 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="match-pct-text">{m.matchPercent}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Match Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-content match-detail-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)}>&times;</button>

            {/* Header: avatar + match ring */}
            <div className="match-detail-header">
              <div className="match-detail-avatar">
                {selected.profileImage ? (
                  <img src={selected.profileImage} alt="" />
                ) : (
                  <div className="match-avatar-placeholder lg">
                    {selected.displayName?.[0] || '?'}
                  </div>
                )}
              </div>
              <div className="match-detail-info">
                <span className="match-detail-name">{selected.displayName}</span>
                <span className="match-detail-pct" style={{ color: getMatchColor(selected.matchPercent) }}>
                  {selected.matchPercent}% match
                </span>
              </div>
            </div>

            {/* Genre comparison bars */}
            <h4 className="match-detail-section-title">{t('match.genreBreakdown')}</h4>
            <div className="match-genre-comparison">
              {selected.genreComparison?.map(g => {
                const maxPct = Math.max(g.myPct, g.theirPct, 1);
                return (
                  <div key={g.genre} className="match-genre-row">
                    <span className="match-genre-label">{g.genre}</span>
                    <div className="match-genre-bars">
                      <div className="match-bar-pair">
                        <div className="match-bar-track">
                          <div
                            className="match-bar-fill mine"
                            style={{
                              width: `${(g.myPct / maxPct) * 100}%`,
                              backgroundColor: GENRE_COLORS[g.genre] || '#666',
                            }}
                          />
                        </div>
                        <div className="match-bar-track">
                          <div
                            className="match-bar-fill theirs"
                            style={{
                              width: `${(g.theirPct / maxPct) * 100}%`,
                              backgroundColor: GENRE_COLORS[g.genre] || '#666',
                              opacity: 0.45,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="match-genre-pcts">
                      <span className="mine">{g.myPct}%</span>
                      <span className="theirs">{g.theirPct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="match-legend">
              <span className="match-legend-item">
                <span className="match-legend-dot mine" /> {t('match.you')}
              </span>
              <span className="match-legend-item">
                <span className="match-legend-dot theirs" /> {selected.displayName}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
