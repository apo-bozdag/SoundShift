import { useEffect, useState, useMemo } from 'react';
import { useI18n } from '../i18n/index.jsx';

function SpotifyIcon({ size = 16 }) {
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

export default function ExplorePage() {
  const { t } = useI18n();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [communityPlaylists, setCommunityPlaylists] = useState(null);
  const [artistModal, setArtistModal] = useState(null);
  const [likedByModal, setLikedByModal] = useState(null);
  const [allArtists, setAllArtists] = useState(null);
  const [playlistDetail, setPlaylistDetail] = useState(null);
  const [playlistDetailLoading, setPlaylistDetailLoading] = useState(false);
  const [plGenreFilter, setPlGenreFilter] = useState(null);
  const [plSort, setPlSort] = useState('tracks'); // 'tracks' | 'compat' | 'name'

  // All unique genres from community playlists
  const plAllGenres = useMemo(() => {
    if (!communityPlaylists) return [];
    const set = new Set();
    for (const pl of communityPlaylists) {
      for (const g of (pl.topGenres || [])) set.add(g);
    }
    return [...set].sort();
  }, [communityPlaylists]);

  // Filtered & sorted playlists
  const filteredPlaylists = useMemo(() => {
    if (!communityPlaylists) return [];
    let list = [...communityPlaylists];

    if (plGenreFilter) {
      list = list.filter(pl => pl.topGenres?.includes(plGenreFilter));
    }

    if (plSort === 'tracks') list.sort((a, b) => (b.trackCount || 0) - (a.trackCount || 0));
    else if (plSort === 'compat') list.sort((a, b) => (b.compatibility ?? -1) - (a.compatibility ?? -1));
    else if (plSort === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return list;
  }, [communityPlaylists, plGenreFilter, plSort]);

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

  const handleShowAllArtists = () => {
    setAllArtists({ loading: true });
    fetch('/api/public-top-artists?limit=50')
      .then(r => r.json())
      .then(data => setAllArtists({ loading: false, artists: data.artists, total: data.total }))
      .catch(() => setAllArtists(null));
  };

  const handlePlaylistClick = async (pl) => {
    setPlaylistDetailLoading(true);
    setPlaylistDetail({ playlist: pl });
    try {
      // Use public-playlists data - we already have genre info from the card
      // For tracks, try fetching if user is logged in
      const res = await fetch(`/api/playlists/${pl.id}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPlaylistDetail(data);
      }
    } catch {}
    setPlaylistDetailLoading(false);
  };

  const handleArtistClick = (artist) => {
    setArtistModal({ name: artist.name, artistId: artist.id, loading: true });
    fetch(`/api/public-artist-songs/${artist.id}`)
      .then(r => r.json())
      .then(data => setArtistModal({ name: artist.name, artistId: artist.id, loading: false, data }))
      .catch(() => setArtistModal(null));
  };

  return (
    <div className="page-explore">
      <h1 className="page-title">{t('nav.explore')}</h1>

      {/* Counters */}
      {loading && (
        <div className="explore-counters">
          {[0,1,2,3].map(i => (
            <div key={i} className="explore-counter">
              <span className="skeleton skeleton-counter" />
              <span className="skeleton skeleton-label" />
            </div>
          ))}
        </div>
      )}

      {!loading && stats && (
        <>
          <div className="explore-counters">
            <div className="explore-counter">
              <span className="counter-val">{formatNumber(stats.songCount)}</span>
              <span className="counter-lbl">{t('landing.totalSongs')}</span>
            </div>
            <div className="explore-counter">
              <span className="counter-val">{formatNumber(stats.artistCount)}</span>
              <span className="counter-lbl">{t('landing.totalArtists')}</span>
            </div>
            <div className="explore-counter">
              <span className="counter-val">{stats.userCount}</span>
              <span className="counter-lbl">{t('landing.totalUsers')}</span>
            </div>
            {stats.yearsOfMusic && (
              <div className="explore-counter">
                <span className="counter-val">{stats.yearsOfMusic}</span>
                <span className="counter-lbl">{t('landing.yearsOfMusic')}</span>
              </div>
            )}
            {stats.recentUsers?.length > 0 && (
              <div className="explore-counter explore-counter-avatars">
                <div className="counter-avatar-row">
                  {stats.recentUsers.slice(0, 5).map((u, i) => (
                    u.profileImage ? (
                      <img key={i} src={u.profileImage} alt={u.displayName} className="counter-avatar" title={u.displayName} />
                    ) : (
                      <span key={i} className="counter-avatar placeholder" title={u.displayName}>{u.displayName?.[0] || '?'}</span>
                    )
                  ))}
                </div>
                <span className="counter-lbl">{t('landing.recentUsers')}</span>
              </div>
            )}
          </div>

          <div className="explore-grid">
            {/* Community Playlists */}
            {communityPlaylists?.length > 0 && (
              <section className="explore-card explore-card-wide">
                <h3 className="explore-card-title">{t('community.playlists')}</h3>

                {/* Filters */}
                <div className="pl-filters">
                  <div className="pl-filter-chips">
                    <button
                      className={`match-chip ${!plGenreFilter ? 'active' : ''}`}
                      onClick={() => setPlGenreFilter(null)}
                    >
                      {t('match.filterAll')}
                    </button>
                    {plAllGenres.map(g => (
                      <button
                        key={g}
                        className={`match-chip ${plGenreFilter === g ? 'active' : ''}`}
                        style={plGenreFilter === g ? { borderColor: GENRE_COLORS[g] || '#666', color: GENRE_COLORS[g] || '#fff' } : {}}
                        onClick={() => setPlGenreFilter(plGenreFilter === g ? null : g)}
                      >
                        <span className="list-genre-dot" style={{ backgroundColor: GENRE_COLORS[g] || '#666' }} />
                        {g}
                      </button>
                    ))}
                  </div>
                  <div className="pl-filter-controls">
                    <select
                      className="pl-sort-select"
                      value={plSort}
                      onChange={(e) => setPlSort(e.target.value)}
                    >
                      <option value="tracks">{t('explore.sortTracks')}</option>
                      <option value="compat">{t('explore.sortCompat')}</option>
                      <option value="name">{t('explore.sortName')}</option>
                    </select>
                    <span className="pl-result-count">{filteredPlaylists.length} {t('match.results', { count: filteredPlaylists.length }).replace(/^\d+ /, '')}</span>
                  </div>
                </div>

                <div className="explore-playlists-grid">
                  {filteredPlaylists.map((pl) => (
                    <div key={pl.id} className="explore-playlist-card" onClick={() => handlePlaylistClick(pl)}>
                      <div className="explore-playlist-img">
                        {pl.imageUrl ? (
                          <img src={pl.imageUrl} alt="" />
                        ) : (
                          <div className="explore-playlist-img-placeholder">&#9835;</div>
                        )}
                        {pl.compatibility !== null && (
                          <span
                            className="explore-playlist-compat-badge"
                            style={{ color: getCompatColor(pl.compatibility) }}
                          >
                            {pl.compatibility}%
                          </span>
                        )}
                        <a
                          href={`https://open.spotify.com/playlist/${pl.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="explore-playlist-spotify-link"
                          onClick={e => e.stopPropagation()}
                          title="Open in Spotify"
                        >
                          <SpotifyIcon size={18} />
                        </a>
                      </div>
                      <div className="explore-playlist-body">
                        <span className="explore-playlist-name">{pl.name}</span>
                        <span className="explore-playlist-meta">
                          {pl.trackCount} {t('landing.songs')}
                        </span>
                        {pl.owner && (
                          <span className="explore-playlist-owner">
                            {pl.owner.profileImage && (
                              <img src={pl.owner.profileImage} alt="" className="explore-playlist-owner-img" />
                            )}
                            {pl.owner.displayName}
                          </span>
                        )}
                        {pl.topGenres?.length > 0 && (
                          <div className="explore-playlist-genres">
                            {pl.topGenres.map(g => (
                              <span
                                key={g}
                                className="playlist-genre-dot"
                                style={{ backgroundColor: GENRE_COLORS[g] || '#666' }}
                                title={g}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Top Artists */}
            {stats.topArtists?.length > 0 && (
              <section className="explore-card">
                <h3 className="explore-card-title">{t('landing.topArtists')}</h3>
                <div className="community-list">
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

            {/* Top Genres */}
            {stats.topGenres?.length > 0 && (
              <section className="explore-card">
                <h3 className="explore-card-title">{t('landing.topGenres')}</h3>
                <div className="landing-genres">
                  {stats.topGenres.map((g) => {
                    const max = stats.topGenres[0].count;
                    const pct = Math.round((g.count / max) * 100);
                    return (
                      <div key={g.name} className="landing-genre-row">
                        <span className="landing-genre-name">{g.name}</span>
                        <div className="landing-genre-bar">
                          <div className="landing-genre-fill" style={{ width: `${pct}%`, backgroundColor: GENRE_COLORS[g.name] || '#666' }} />
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

      {/* Sub-modals (artist, all artists, liked by) */}
      {allArtists && (
        <div className="modal-overlay" onClick={() => setAllArtists(null)}>
          <div className="modal-content all-artists-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setAllArtists(null)}>&times;</button>
            <div className="modal-header"><h2>{t('landing.allArtists')}</h2></div>
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
                <a
                  href={`https://open.spotify.com/artist/${artistModal.artistId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="spotify-open-link"
                  style={{ marginLeft: 8 }}
                >
                  <SpotifyIcon size={16} /> Spotify
                </a>
              )}
            </div>
            {artistModal.loading ? (
              <div className="artist-modal-skeleton">
                <div className="skeleton skeleton-artist-modal-sub" />
                {[...Array(8)].map((_, i) => (
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
                        <a
                          href={`https://open.spotify.com/track/${s.trackId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="playlist-track-spotify"
                          title="Open in Spotify"
                        >
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

      {/* Playlist Detail Modal */}
      {playlistDetail && (
        <div className="modal-overlay" onClick={() => setPlaylistDetail(null)}>
          <div className="modal-content playlist-detail-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPlaylistDetail(null)}>&times;</button>

            {playlistDetailLoading ? (
              <div className="playlist-detail-skeleton">
                <div className="skeleton skeleton-playlist-detail-header" />
                <div className="skeleton skeleton-playlist-detail-bars" />
                <div className="skeleton skeleton-playlist-detail-list" />
              </div>
            ) : (
              <>
                <div className="playlist-detail-header">
                  <div className="playlist-detail-img">
                    {(playlistDetail.playlist?.imageUrl || playlistDetail.playlist?.image_url) ? (
                      <img src={playlistDetail.playlist.imageUrl || playlistDetail.playlist.image_url} alt="" />
                    ) : (
                      <div className="playlist-card-img-placeholder lg">&#9835;</div>
                    )}
                  </div>
                  <div className="playlist-detail-info">
                    <span className="playlist-detail-name">{playlistDetail.playlist?.name}</span>
                    <span className="playlist-detail-count">
                      {playlistDetail.playlist?.trackCount || playlistDetail.playlist?.trackCount || ''} {t('landing.songs')}
                    </span>
                    {playlistDetail.playlist?.owner && (
                      <span className="explore-playlist-owner" style={{ marginTop: 4 }}>
                        {playlistDetail.playlist.owner.profileImage && (
                          <img src={playlistDetail.playlist.owner.profileImage} alt="" className="explore-playlist-owner-img" />
                        )}
                        {playlistDetail.playlist.owner.displayName}
                      </span>
                    )}
                    <a
                      href={`https://open.spotify.com/playlist/${playlistDetail.playlist?.id || playlistDetail.playlist?.spotify_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="spotify-open-link"
                    >
                      <SpotifyIcon size={16} /> Open in Spotify
                    </a>
                  </div>
                </div>

                {/* Genre Breakdown from community data */}
                {playlistDetail.playlist?.genreDistribution && Object.keys(playlistDetail.playlist.genreDistribution).length > 0 && (
                  <div className="playlist-genre-breakdown">
                    <h4>{t('playlist.genres')}</h4>
                    {Object.entries(playlistDetail.playlist.genreDistribution)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 8)
                      .map(([genre, value]) => (
                        <div key={genre} className="playlist-genre-bar-row">
                          <span className="playlist-genre-bar-label">{genre}</span>
                          <div className="playlist-genre-bar-track">
                            <div
                              className="playlist-genre-bar-fill"
                              style={{
                                width: `${Math.round(value * 100)}%`,
                                backgroundColor: GENRE_COLORS[genre] || '#666',
                              }}
                            />
                          </div>
                          <span className="playlist-genre-bar-pct">{Math.round(value * 100)}%</span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Track list if available */}
                {playlistDetail.tracks?.length > 0 && (
                  <div className="playlist-track-list">
                    <h4>{playlistDetail.tracks.length} {t('landing.songs')}</h4>
                    {playlistDetail.tracks.slice(0, 50).map((track, i) => (
                      <div key={`${track.trackId}-${i}`} className="playlist-track-row">
                        <span className="playlist-track-name">{track.name}</span>
                        <span className="playlist-track-artist">{track.artists?.join(', ')}</span>
                        {track.genre && (
                          <span
                            className="playlist-track-genre-dot"
                            style={{ backgroundColor: GENRE_COLORS[track.genre] || '#666' }}
                            title={track.genre}
                          />
                        )}
                        {track.trackId && (
                          <a
                            href={`https://open.spotify.com/track/${track.trackId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="playlist-track-spotify"
                            title="Open in Spotify"
                          >
                            <SpotifyIcon size={14} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
