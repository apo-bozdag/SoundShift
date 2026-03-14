import { useI18n } from '../i18n/index.jsx';

export default function StatsCards({ stats }) {
  const { t } = useI18n();

  if (!stats || !stats.totalTracks) return null;

  const cards = [
    { label: t('stats.totalTracks'), value: stats.totalTracks.toLocaleString(), color: '#1DB954' },
    { label: t('stats.artists'), value: stats.uniqueArtists?.toLocaleString() || '-', color: '#3498DB' },
    { label: t('stats.topGenre'), value: stats.topGenre || '-', color: '#E74C3C' },
    { label: t('stats.timespan'), value: stats.yearsSpan || '-', color: '#F39C12' },
  ];

  return (
    <div className="stats-grid">
      {cards.map(card => (
        <div key={card.label} className="stat-card">
          <div className="stat-accent" style={{ backgroundColor: card.color }} />
          <span className="stat-value">{card.value}</span>
          <span className="stat-label">{card.label}</span>
        </div>
      ))}
    </div>
  );
}
