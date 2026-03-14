import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts';
import { useI18n } from '../i18n/index.jsx';

const GENRE_COLORS = {
  'Pop': '#FF6B8A',
  'Rock': '#E74C3C',
  'Hip-Hop': '#9B59B6',
  'Electronic': '#3498DB',
  'R&B/Soul': '#F39C12',
  'Indie': '#2ECC71',
  'Turkish': '#E67E22',
  'Jazz': '#1ABC9C',
  'Folk': '#8B7355',
  'Classical': '#7F8C8D',
  'Latin': '#E91E63',
  'Country': '#FF9800',
  'Blues': '#5C6BC0',
  'Reggae': '#66BB6A',
  'World': '#AB47BC',
  'Unknown': '#444',
  'Other': '#BDC3C7'
};

function CustomTooltip({ active, payload, label, t }) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);
  const items = payload
    .filter(entry => entry.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div className="chart-tooltip">
      <div className="tooltip-header">
        <span className="tooltip-year">{label}</span>
        <span className="tooltip-total">{t('chart.songs', { count: total })}</span>
      </div>
      <div className="tooltip-items">
        {items.map(entry => {
          const pct = Math.round((entry.value / total) * 100);
          return (
            <div key={entry.name} className="tooltip-row">
              <span className="tooltip-dot" style={{ backgroundColor: entry.color }} />
              <span className="tooltip-name">{entry.name}</span>
              <span className="tooltip-val">{entry.value} ({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TimelineChart({ data, onYearClick, selectedYear }) {
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState('percent'); // stacked | percent

  const { chartData, allGenres } = useMemo(() => {
    if (!data?.years?.length) return { chartData: [], allGenres: [] };

    // Genre toplam sıralama
    const genreTotals = {};
    data.years.forEach(y => {
      Object.entries(y.genres).forEach(([genre, count]) => {
        genreTotals[genre] = (genreTotals[genre] || 0) + count;
      });
    });

    const sorted = Object.entries(genreTotals)
      .filter(([g]) => g !== 'Unknown')
      .sort((a, b) => b[1] - a[1])
      .map(([genre]) => genre);

    const formatted = data.years.map(y => {
      const row = { year: y.year };
      if (viewMode === 'percent') {
        const total = Object.values(y.genres).reduce((s, v) => s + v, 0) || 1;
        sorted.forEach(g => {
          row[g] = Math.round(((y.genres[g] || 0) / total) * 100);
        });
      } else {
        sorted.forEach(g => { row[g] = y.genres[g] || 0; });
      }
      return row;
    });

    return { chartData: formatted, allGenres: sorted };
  }, [data, viewMode]);

  if (!data?.years?.length) return null;

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h2>{t('chart.title')}</h2>
        <div className="chart-toggles">
          <button
            className={`toggle-btn ${viewMode === 'stacked' ? 'active' : ''}`}
            onClick={() => setViewMode('stacked')}
          >
            {t('chart.count')}
          </button>
          <button
            className={`toggle-btn ${viewMode === 'percent' ? 'active' : ''}`}
            onClick={() => setViewMode('percent')}
          >
            {t('chart.percent')}
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={440}>
        <AreaChart
          data={chartData}
          margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          onClick={(e) => {
            if (e?.activeLabel) onYearClick?.(e.activeLabel);
          }}
          style={{ cursor: 'pointer' }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
          <XAxis
            dataKey="year"
            stroke="#555"
            tick={{ fill: '#888', fontSize: 13 }}
            tickLine={false}
            axisLine={{ stroke: '#333' }}
          />
          <YAxis
            stroke="#555"
            tick={{ fill: '#888', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => viewMode === 'percent' ? `${v}%` : v}
          />
          <Tooltip
            content={<CustomTooltip t={t} />}
            cursor={{ stroke: '#1DB954', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          {allGenres.map(genre => (
            <Area
              key={genre}
              type="monotone"
              dataKey={genre}
              stackId="1"
              fill={GENRE_COLORS[genre] || '#BDC3C7'}
              stroke="none"
              fillOpacity={0.85}
              animationDuration={800}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      {/* Genre Legend */}
      <div className="chart-legend">
        {allGenres.map(genre => {
          const total = data.years.reduce((s, y) => s + (y.genres[genre] || 0), 0);
          const grandTotal = data.years.reduce((s, y) =>
            s + Object.values(y.genres).reduce((a, b) => a + b, 0), 0) || 1;
          const pct = Math.round((total / grandTotal) * 100);
          return (
            <span key={genre} className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: GENRE_COLORS[genre] || '#BDC3C7' }} />
              <span className="legend-name">{genre}</span>
              <span className="legend-pct">{pct}%</span>
            </span>
          );
        })}
      </div>

      <p className="chart-hint">{t('chart.hint')}</p>
    </div>
  );
}
