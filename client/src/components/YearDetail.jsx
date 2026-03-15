import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';

function SpotifyIcon({ size = 14 }) {
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
  'Reggae': '#66BB6A', 'World': '#AB47BC', 'Unknown': '#444', 'Other': '#BDC3C7'
};

export default function YearDetail({ data, onClose }) {
  const { t } = useI18n();
  const [selectedGenre, setSelectedGenre] = useState(null);

  // ESC ile kapat / genre'dan cik
  useEffect(() => {
    if (!data) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (selectedGenre) setSelectedGenre(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [data, onClose, selectedGenre]);

  // Modal kapaninca genre secimini sifirla
  useEffect(() => {
    if (!data) setSelectedGenre(null);
  }, [data]);

  if (!data) return null;

  if (data.loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>&times;</button>
          <div className="modal-header">
            <h2>{data.year}</h2>
            <span className="skeleton skeleton-year-badge" />
          </div>
          <div className="year-section">
            <div className="skeleton skeleton-section-title" />
            <div className="genre-bars">
              {[0,1,2,3,4,5].map(i => (
                <div key={i} className="genre-bar-row">
                  <span className="skeleton skeleton-genre-label" />
                  <div className="genre-bar-track">
                    <div className="skeleton skeleton-genre-fill" style={{ width: `${90 - i * 12}%` }} />
                  </div>
                  <span className="skeleton skeleton-genre-count" />
                </div>
              ))}
            </div>
          </div>
          <div className="year-section">
            <div className="skeleton skeleton-section-title" />
            <div className="top-artists-grid">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="artist-card">
                  <span className="skeleton skeleton-artist-rank" />
                  <div className="artist-info">
                    <span className="skeleton skeleton-artist-name" />
                    <span className="skeleton skeleton-artist-count" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="year-section">
            <div className="bookends-row">
              {[0,1].map(i => (
                <div key={i} className="bookend-card">
                  <span className="skeleton skeleton-bookend-emoji" />
                  <div>
                    <span className="skeleton skeleton-bookend-label" />
                    <span className="skeleton skeleton-bookend-track" />
                    <span className="skeleton skeleton-bookend-meta" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sortedGenres = Object.entries(data.genres)
    .filter(([g]) => g !== 'Unknown')
    .sort((a, b) => b[1] - a[1]);

  const totalGenreCount = sortedGenres.reduce((sum, [, count]) => sum + count, 0);
  const maxCount = sortedGenres[0]?.[1] || 1;

  // Secili genre'in sarkilari
  const genreSongs = selectedGenre && data.songs
    ? data.songs.filter(s => s.genres?.includes(selectedGenre))
    : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>

        <div className="modal-header">
          <h2>{data.year}</h2>
          <span className="year-badge">{t('year.songs', { count: data.totalLikes })}</span>
        </div>

        {/* Genre seciliyse sarki listesi goster */}
        {selectedGenre ? (
          <div className="genre-detail-view">
            <button
              className="back-btn"
              onClick={() => setSelectedGenre(null)}
            >
              &larr; {t('year.back')}
            </button>
            <div className="genre-detail-header">
              <span
                className="genre-detail-dot"
                style={{ backgroundColor: GENRE_COLORS[selectedGenre] || '#BDC3C7' }}
              />
              <h3>{selectedGenre}</h3>
              <span className="genre-detail-count">{t('year.songs', { count: genreSongs.length })}</span>
            </div>
            <div className="genre-songs-list">
              {genreSongs.map((song, i) => {
                const otherGenres = [...new Set(song.genres || [])]
                  .filter(g => g !== 'Unknown');
                return (
                  <div key={`${song.name}-${i}`} className="genre-song-row">
                    <span className="song-index">{i + 1}</span>
                    <div className="song-info">
                      <span className="song-name">{song.name}</span>
                      <span className="song-artist">{song.artist}</span>
                      {otherGenres.length > 0 && (
                        <div className="song-tags">
                          {otherGenres.map(g => (
                            <span
                              key={g}
                              className={`song-tag ${g === selectedGenre ? 'active' : ''}`}
                              style={{
                                '--tag-color': GENRE_COLORS[g] || '#BDC3C7'
                              }}
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {song.trackId && (
                      <a
                        href={`https://open.spotify.com/track/${song.trackId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="playlist-track-spotify"
                        title="Open in Spotify"
                      >
                        <SpotifyIcon size={14} />
                      </a>
                    )}
                    <span className="song-date">
                      {song.addedAt?.split('T')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {/* Genre Bars */}
            <div className="year-section">
              <h3>{t('year.genreBreakdown')}</h3>
              <div className="genre-bars">
                {sortedGenres.map(([genre, count]) => {
                  const percent = Math.round((count / totalGenreCount) * 100);
                  const width = Math.round((count / maxCount) * 100);
                  return (
                    <div
                      key={genre}
                      className="genre-bar-row clickable"
                      onClick={() => setSelectedGenre(genre)}
                    >
                      <span className="genre-label">{genre}</span>
                      <div className="genre-bar-track">
                        <div
                          className="genre-bar-fill"
                          style={{
                            width: `${width}%`,
                            backgroundColor: GENRE_COLORS[genre] || '#BDC3C7'
                          }}
                        />
                      </div>
                      <span className="genre-count">{count} ({percent}%)</span>
                      <span className="genre-arrow">&rsaquo;</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Artists */}
            <div className="year-section">
              <h3>{t('year.topArtists')}</h3>
              <div className="top-artists-grid">
                {data.topArtists?.map((artist, i) => (
                  <div key={artist.name} className="artist-card">
                    <span className="artist-rank-badge">{i + 1}</span>
                    <div className="artist-info">
                      <span className="artist-name">{artist.name}</span>
                      <span className="artist-count">{t('year.songs', { count: artist.count })}</span>
                    </div>
                    {artist.artistId && (
                      <a
                        href={`https://open.spotify.com/artist/${artist.artistId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="playlist-track-spotify"
                        title="Open in Spotify"
                        onClick={e => e.stopPropagation()}
                      >
                        <SpotifyIcon size={14} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Bookends */}
            <div className="year-section">
              <div className="bookends-row">
                {data.firstLike && (
                  <div className="bookend-card">
                    <span className="bookend-emoji">&#9654;</span>
                    <div>
                      <span className="bookend-label">Ilk begeni</span>
                      <span className="bookend-track">{data.firstLike.track}</span>
                      <span className="bookend-meta">{data.firstLike.artist} &middot; {data.firstLike.date}</span>
                    </div>
                  </div>
                )}
                {data.lastLike && (
                  <div className="bookend-card">
                    <span className="bookend-emoji">&#9632;</span>
                    <div>
                      <span className="bookend-label">Son begeni</span>
                      <span className="bookend-track">{data.lastLike.track}</span>
                      <span className="bookend-meta">{data.lastLike.artist} &middot; {data.lastLike.date}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
