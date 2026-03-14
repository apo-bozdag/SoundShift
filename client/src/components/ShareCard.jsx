import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { useI18n } from '../i18n/index.jsx';

const GENRE_COLORS = {
  'Pop': '#FF6B8A', 'Rock': '#E74C3C', 'Hip-Hop': '#9B59B6',
  'Electronic': '#3498DB', 'R&B/Soul': '#F39C12', 'Indie': '#2ECC71',
  'Jazz': '#1ABC9C', 'Folk': '#8B7355', 'Classical': '#7F8C8D',
  'Latin': '#E91E63', 'Country': '#FF9800', 'Blues': '#5C6BC0',
  'Reggae': '#66BB6A', 'World': '#AB47BC', 'Unknown': '#444', 'Other': '#BDC3C7'
};

const FORMATS = [
  { id: 'story', label: 'Story', w: 1080, h: 1920, ratio: '9:16' },
  { id: 'post', label: 'Post', w: 1080, h: 1080, ratio: '1:1' },
  { id: 'twitter', label: 'Twitter', w: 1200, h: 675, ratio: '16:9' },
];

export default function ShareCard({ stats, timeline, user, onClose }) {
  const { t } = useI18n();
  const cardRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [format, setFormat] = useState('story');

  if (!stats || !timeline?.years?.length) return null;

  const fmt = FORMATS.find(f => f.id === format);
  const isWide = format === 'twitter';
  const isSquare = format === 'post';

  // Top 5 genre
  const genreTotals = {};
  timeline.years.forEach(y => {
    Object.entries(y.genres).forEach(([g, c]) => {
      if (g !== 'Unknown') genreTotals[g] = (genreTotals[g] || 0) + c;
    });
  });
  const grandTotal = Object.values(genreTotals).reduce((a, b) => a + b, 0) || 1;
  const topGenres = Object.entries(genreTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Yil bazli dominant genre
  const yearDominants = timeline.years.map(y => {
    const top = Object.entries(y.genres)
      .filter(([g]) => g !== 'Unknown')
      .sort((a, b) => b[1] - a[1])[0];
    return { year: y.year, genre: top?.[0] || '?' };
  });

  const handleSave = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const scale = fmt.w / cardRef.current.offsetWidth;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: scale,
        useCORS: true,
        width: cardRef.current.offsetWidth,
        height: cardRef.current.offsetHeight,
      });
      const link = document.createElement('a');
      link.download = `soundshift-${format}-${user?.displayName || 'me'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Share card save failed:', err);
    }
    setSaving(false);
  };

  const handleShare = async () => {
    if (!cardRef.current || !navigator.share) return;
    setSaving(true);
    try {
      const scale = fmt.w / cardRef.current.offsetWidth;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: scale,
        useCORS: true,
      });
      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'soundshift.png', { type: 'image/png' });
        await navigator.share({
          title: 'SoundShift',
          text: t('share.text'),
          files: [file],
        });
        setSaving(false);
      });
    } catch (err) {
      setSaving(false);
    }
  };

  // Preview boyutu (ekrana sığdır)
  const previewWidth = isWide ? 420 : isSquare ? 340 : 300;
  const previewHeight = Math.round(previewWidth * (fmt.h / fmt.w));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>

        {/* Format seçici */}
        <div className="share-formats">
          {FORMATS.map(f => (
            <button
              key={f.id}
              className={`format-btn ${format === f.id ? 'active' : ''}`}
              onClick={() => setFormat(f.id)}
            >
              <span className="format-label">{f.label}</span>
              <span className="format-ratio">{f.ratio}</span>
            </button>
          ))}
        </div>

        {/* Card preview */}
        <div
          className={`share-card share-${format}`}
          ref={cardRef}
          style={{ width: previewWidth, height: previewHeight }}
        >
          <div className={`share-card-inner ${isWide ? 'wide' : ''}`}>
            {/* Header */}
            <div className="share-header">
              <div className="share-logo">SoundShift</div>
              <div className="share-user">{user?.displayName}</div>
            </div>

            {/* Stats row */}
            <div className="share-stats-row">
              <div className="share-stat">
                <span className="share-stat-val">{stats.totalTracks?.toLocaleString()}</span>
                <span className="share-stat-lbl">{t('stats.totalTracks')}</span>
              </div>
              <div className="share-stat">
                <span className="share-stat-val">{stats.uniqueArtists?.toLocaleString()}</span>
                <span className="share-stat-lbl">{t('stats.artists')}</span>
              </div>
              <div className="share-stat">
                <span className="share-stat-val">{stats.yearsSpan}</span>
                <span className="share-stat-lbl">{t('stats.timespan')}</span>
              </div>
            </div>

            {/* Genre bars */}
            <div className="share-genres">
              <div className="share-section-title">{t('share.topGenres')}</div>
              {topGenres.map(([genre, count]) => {
                const pct = Math.round((count / grandTotal) * 100);
                return (
                  <div key={genre} className="share-genre-row">
                    <span className="share-genre-name">{genre}</span>
                    <div className="share-genre-bar">
                      <div
                        className="share-genre-fill"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: GENRE_COLORS[genre] || '#BDC3C7'
                        }}
                      />
                    </div>
                    <span className="share-genre-pct">{pct}%</span>
                  </div>
                );
              })}
            </div>

            {/* Year journey */}
            <div className="share-journey">
              <div className="share-section-title">{t('share.journey')}</div>
              <div className={`share-journey-flow ${isWide ? 'horizontal' : ''}`}>
                {yearDominants.map((yd) => (
                  <div key={yd.year} className="share-journey-item">
                    <span className="share-journey-year">{yd.year}</span>
                    <span
                      className="share-journey-dot"
                      style={{ backgroundColor: GENRE_COLORS[yd.genre] || '#BDC3C7' }}
                    />
                    <span className="share-journey-genre">{yd.genre}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="share-footer">
              soundshift-4no7.onrender.com
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="share-actions">
          <button className="share-btn primary" onClick={handleSave} disabled={saving}>
            {saving ? '...' : t('share.download')}
          </button>
          {navigator.share && (
            <button className="share-btn secondary" onClick={handleShare} disabled={saving}>
              {t('share.share')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
