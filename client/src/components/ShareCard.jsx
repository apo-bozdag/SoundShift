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

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const generateCanvas = async () => {
    const scale = fmt.w / cardRef.current.offsetWidth;
    return html2canvas(cardRef.current, {
      backgroundColor: '#121212',
      scale,
      useCORS: true,
      width: cardRef.current.offsetWidth,
      height: cardRef.current.offsetHeight,
    });
  };

  const handleSave = async () => {
    if (!cardRef.current) return;
    setSaving(true);

    // iOS: window.open MUST be called synchronously in user gesture, before any await
    let newWindow = null;
    if (isIOS) {
      newWindow = window.open('', '_blank');
    }

    try {
      const canvas = await generateCanvas();

      if (isIOS && newWindow) {
        // Blob URL kullan (dataURL iOS'ta bellek sınırına takılabiliyor)
        canvas.toBlob((blob) => {
          if (!blob) { setSaving(false); return; }
          const blobUrl = URL.createObjectURL(blob);
          newWindow.location.href = blobUrl;
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
          setSaving(false);
        }, 'image/png');
        return;
      } else {
        // Desktop: blob URL ile indir
        canvas.toBlob((blob) => {
          if (!blob) { setSaving(false); return; }
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `soundshift-${format}-${user?.displayName || 'me'}.png`;
          link.href = url;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
          setSaving(false);
        }, 'image/png');
        return;
      }
    } catch (err) {
      console.error('Share card save failed:', err);
      if (newWindow) newWindow.close();
    }
    setSaving(false);
  };

  const handleShare = async () => {
    if (!cardRef.current || !navigator.share) return;
    setSaving(true);
    try {
      const canvas = await generateCanvas();
      canvas.toBlob(async (blob) => {
        try {
          const file = new File([blob], 'soundshift.png', { type: 'image/png' });
          await navigator.share({
            title: 'SoundShift',
            text: t('share.text'),
            files: [file],
          });
        } catch {}
        setSaving(false);
      });
    } catch (err) {
      setSaving(false);
    }
  };

  // Preview boyutu
  const previewWidth = isWide ? 420 : isSquare ? 340 : 300;
  const previewHeight = Math.round(previewWidth * (fmt.h / fmt.w));

  // Dynamic base font size - scales all em values proportionally
  const baseFontSize = previewWidth * (isWide ? 0.038 : isSquare ? 0.042 : 0.046);

  // Inline styles (html2canvas CSS class'ları yakalayamıyor)
  const S = {
    card: {
      width: previewWidth,
      height: previewHeight,
      borderRadius: 0,
      overflow: 'hidden',
      flexShrink: 0,
      fontSize: baseFontSize,
    },
    inner: {
      width: '100%',
      height: '100%',
      background: 'linear-gradient(145deg, #121212 0%, #1e1e1e 50%, #181818 100%)',
      display: 'flex',
      flexDirection: 'column',
      padding: isWide ? '4% 5%' : '7%',
      boxSizing: 'border-box',
      gap: isWide ? '3%' : '4%',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    logo: {
      fontSize: '1.3em',
      fontWeight: 800,
      color: '#1DB954',
      letterSpacing: '-0.5px',
    },
    user: {
      color: '#b3b3b3',
      fontSize: '0.75em',
      fontWeight: 500,
    },
    statsRow: {
      display: 'flex',
      justifyContent: 'space-around',
      gap: 8,
    },
    stat: {
      textAlign: 'center',
    },
    statVal: {
      display: 'block',
      fontSize: '1.4em',
      fontWeight: 800,
      color: '#ffffff',
    },
    statLbl: {
      display: 'block',
      fontSize: '0.55em',
      color: '#b3b3b3',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      marginTop: 2,
    },
    sectionTitle: {
      fontSize: '0.6em',
      color: '#b3b3b3',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 4,
      fontWeight: 600,
    },
    genreRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    },
    genreName: {
      width: 65,
      fontSize: '0.6em',
      color: '#ffffff',
      textAlign: 'right',
      flexShrink: 0,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    genreBar: {
      flex: 1,
      height: 8,
      background: 'rgba(255,255,255,0.06)',
      borderRadius: 4,
      overflow: 'hidden',
    },
    genrePct: {
      width: 30,
      fontSize: '0.55em',
      color: '#b3b3b3',
      textAlign: 'left',
    },
    journeyFlow: {
      display: 'flex',
      flexWrap: isWide ? 'nowrap' : 'wrap',
      gap: 6,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    journeyItem: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 3,
    },
    journeyYear: {
      fontSize: '0.5em',
      color: '#b3b3b3',
      fontWeight: 600,
    },
    journeyDot: {
      width: 10,
      height: 10,
      borderRadius: '50%',
    },
    journeyGenre: {
      fontSize: '0.42em',
      color: '#b3b3b3',
      whiteSpace: 'nowrap',
    },
    footer: {
      textAlign: 'center',
      fontSize: '0.5em',
      color: '#666',
      letterSpacing: 1,
    },
  };

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

        {/* Card preview - tüm stiller inline (html2canvas için) */}
        <div ref={cardRef} style={S.card}>
          <div style={S.inner}>
            {/* Header */}
            <div style={S.header}>
              <div style={S.logo}>SoundShift</div>
              <div style={S.user}>{user?.displayName}</div>
            </div>

            {/* Stats row */}
            <div style={S.statsRow}>
              <div style={S.stat}>
                <span style={S.statVal}>{stats.totalTracks?.toLocaleString()}</span>
                <span style={S.statLbl}>{t('stats.totalTracks')}</span>
              </div>
              <div style={S.stat}>
                <span style={S.statVal}>{stats.uniqueArtists?.toLocaleString()}</span>
                <span style={S.statLbl}>{t('stats.artists')}</span>
              </div>
              <div style={S.stat}>
                <span style={S.statVal}>{stats.yearsSpan}</span>
                <span style={S.statLbl}>{t('stats.timespan')}</span>
              </div>
            </div>

            {/* Genre bars */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 4 }}>
              <div style={S.sectionTitle}>{t('share.topGenres')}</div>
              {topGenres.map(([genre, count]) => {
                const pct = Math.round((count / grandTotal) * 100);
                return (
                  <div key={genre} style={S.genreRow}>
                    <span style={S.genreName}>{genre}</span>
                    <div style={S.genreBar}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          borderRadius: 4,
                          backgroundColor: GENRE_COLORS[genre] || '#BDC3C7',
                        }}
                      />
                    </div>
                    <span style={S.genrePct}>{pct}%</span>
                  </div>
                );
              })}
            </div>

            {/* Year journey */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={S.sectionTitle}>{t('share.journey')}</div>
              <div style={S.journeyFlow}>
                {yearDominants.map((yd) => (
                  <div key={yd.year} style={S.journeyItem}>
                    <span style={S.journeyYear}>{yd.year}</span>
                    <span
                      style={{
                        ...S.journeyDot,
                        backgroundColor: GENRE_COLORS[yd.genre] || '#BDC3C7',
                      }}
                    />
                    <span style={S.journeyGenre}>{yd.genre}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={S.footer}>
              soundshift-4no7.onrender.com
            </div>
          </div>
        </div>

        {/* Actions — mobilde Share öne çıkar */}
        <div className="share-actions">
          {navigator.share ? (
            <>
              <button className="share-btn primary" onClick={handleShare} disabled={saving}>
                {saving ? '...' : t('share.share')}
              </button>
              <button className="share-btn secondary" onClick={handleSave} disabled={saving}>
                {saving ? '...' : (isIOS ? t('share.preview') : t('share.download'))}
              </button>
            </>
          ) : (
            <button className="share-btn primary" onClick={handleSave} disabled={saving}>
              {saving ? '...' : t('share.download')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
