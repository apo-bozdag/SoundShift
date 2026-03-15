import { useEffect, useState, useMemo } from 'react';
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

export default function MatchSection({ fullPage = false, limit, onNavigate }) {
  const { t } = useI18n();
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  // Filters (only used in fullPage)
  const [genreFilter, setGenreFilter] = useState(null);
  const [sortDir, setSortDir] = useState('desc'); // desc = highest first
  const [minMatch, setMinMatch] = useState(0);

  useEffect(() => {
    fetch('/api/matches', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setMatches(data.matches || []))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, []);

  // Extract all genres from matches for filter chips
  const allGenres = useMemo(() => {
    if (!matches?.length) return [];
    const genreSet = new Set();
    for (const m of matches) {
      if (m.topCommonGenre) genreSet.add(m.topCommonGenre);
      m.genreComparison?.forEach(g => genreSet.add(g.genre));
    }
    return [...genreSet].sort();
  }, [matches]);

  // Filtered + sorted matches
  const filteredMatches = useMemo(() => {
    if (!matches) return [];
    let result = [...matches];

    // Genre filter
    if (genreFilter) {
      result = result.filter(m =>
        m.topCommonGenre === genreFilter ||
        m.genreComparison?.some(g => g.genre === genreFilter)
      );
    }

    // Min match threshold
    if (minMatch > 0) {
      result = result.filter(m => m.matchPercent >= minMatch);
    }

    // Sort
    result.sort((a, b) =>
      sortDir === 'desc'
        ? b.matchPercent - a.matchPercent
        : a.matchPercent - b.matchPercent
    );

    return result;
  }, [matches, genreFilter, sortDir, minMatch]);

  const displayMatches = limit ? filteredMatches.slice(0, limit) : filteredMatches;

  if (loading) {
    return (
      <div className={fullPage ? 'match-page-grid' : 'match-section'}>
        {fullPage && <h1 className="page-title">{t('match.title')}</h1>}
        {!fullPage && (
          <>
            <h3 className="match-title">{t('match.title')}</h3>
            <p className="match-subtitle">{t('match.subtitle')}</p>
          </>
        )}
        <div className={fullPage ? 'match-grid' : 'match-list'}>
          {[0,1,2].map(i => (
            <div key={i} className={fullPage ? 'match-grid-card' : 'match-card'}>
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

  if (!matches?.length) {
    if (fullPage) {
      return (
        <div className="match-page-grid">
          <h1 className="page-title">{t('match.title')}</h1>
          <p className="match-empty">{t('match.noUsers')}</p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className={fullPage ? 'match-page-grid' : 'match-section'}>
      {fullPage && (
        <>
          <h1 className="page-title">{t('match.title')}</h1>
          <p className="match-page-subtitle">{t('match.subtitle')}</p>

          {/* Filter toolbar */}
          <div className="match-filters">
            {/* Genre chips */}
            <div className="match-filter-chips">
              <button
                className={`match-chip ${!genreFilter ? 'active' : ''}`}
                onClick={() => setGenreFilter(null)}
              >
                {t('match.filterAll')}
              </button>
              {allGenres.map(g => (
                <button
                  key={g}
                  className={`match-chip ${genreFilter === g ? 'active' : ''}`}
                  style={genreFilter === g ? { borderColor: GENRE_COLORS[g] || '#666', color: GENRE_COLORS[g] || '#666' } : {}}
                  onClick={() => setGenreFilter(genreFilter === g ? null : g)}
                >
                  <span className="match-chip-dot" style={{ backgroundColor: GENRE_COLORS[g] || '#666' }} />
                  {g}
                </button>
              ))}
            </div>

            {/* Sort + min match */}
            <div className="match-filter-controls">
              <button
                className="match-sort-btn"
                onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                title={sortDir === 'desc' ? t('match.sortHighest') : t('match.sortLowest')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  {sortDir === 'desc' ? (
                    <path d="M7 14l5-5 5 5z"/>
                  ) : (
                    <path d="M7 10l5 5 5-5z"/>
                  )}
                </svg>
                {sortDir === 'desc' ? t('match.sortHighest') : t('match.sortLowest')}
              </button>

              <div className="match-min-slider">
                <span className="match-min-label">{t('match.minMatch', { pct: minMatch })}</span>
                <input
                  type="range"
                  min="0"
                  max="80"
                  step="10"
                  value={minMatch}
                  onChange={e => setMinMatch(Number(e.target.value))}
                  className="match-range"
                />
              </div>

              <span className="match-result-count">
                {t('match.results', { count: displayMatches.length })}
              </span>
            </div>
          </div>
        </>
      )}

      {!fullPage && (
        <div className="match-header-row">
          <div>
            <h3 className="match-title">{t('match.title')}</h3>
            <p className="match-subtitle">{t('match.subtitle')}</p>
          </div>
          {onNavigate && matches.length > (limit || 0) && (
            <button className="match-show-all-btn" onClick={onNavigate}>
              {t('landing.showAll')}
            </button>
          )}
        </div>
      )}

      <div className={fullPage ? 'match-grid' : 'match-list'}>
        {displayMatches.map(m => (
          <div
            key={m.userId}
            className={fullPage ? 'match-grid-card' : 'match-card'}
            onClick={() => setSelected(m)}
          >
            {/* Avatar */}
            <div className={fullPage ? 'match-grid-avatar' : 'match-avatar'}>
              {m.profileImage ? (
                <img src={m.profileImage} alt="" />
              ) : (
                <div className={`match-avatar-placeholder ${fullPage ? 'lg' : ''}`}>
                  {m.displayName?.[0] || '?'}
                </div>
              )}
            </div>

            {/* Info */}
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
              {fullPage && m.genreComparison && (
                <div className="match-grid-genres">
                  {m.genreComparison.slice(0, 4).map(g => (
                    <span
                      key={g.genre}
                      className="match-grid-genre-tag"
                      style={{ borderColor: GENRE_COLORS[g.genre] || '#666', color: GENRE_COLORS[g.genre] || '#666' }}
                    >
                      {g.genre}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Match ring */}
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

      {fullPage && displayMatches.length === 0 && (
        <p className="match-empty">{t('match.noUsers')}</p>
      )}

      {/* Match Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-content match-detail-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)}>&times;</button>

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
