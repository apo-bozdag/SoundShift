import { useI18n } from '../i18n/index.jsx';
import LangSwitch from './LangSwitch';

const NAV_ITEMS = [
  { path: '/', icon: 'home', labelKey: 'nav.home' },
  { path: '/explore', icon: 'explore', labelKey: 'nav.explore' },
  { path: '/match', icon: 'match', labelKey: 'nav.match' },
  { path: '/playlists', icon: 'playlists', labelKey: 'nav.playlists' },
];

function NavIcon({ icon, active }) {
  const color = active ? '#fff' : '#b3b3b3';
  if (icon === 'home') return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
      {active
        ? <path d="M13.5 1.515a3 3 0 0 0-3 0L3 5.845a2 2 0 0 0-1 1.732V21a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6h4v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7.577a2 2 0 0 0-1-1.732l-7.5-4.33z"/>
        : <path d="M12.5 3.247a1 1 0 0 0-1 0L4 7.577V20h4.5v-6a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v6H20V7.577l-7.5-4.33zm-2-1.732a3 3 0 0 1 3 0l7.5 4.33a2 2 0 0 1 1 1.732V21a1 1 0 0 1-1 1h-6.5a1 1 0 0 1-1-1v-6h-3v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7.577a2 2 0 0 1 1-1.732l7.5-4.33z"/>
      }
    </svg>
  );
  if (icon === 'explore') return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
      {active
        ? <path d="M15.356 10.558a1.5 1.5 0 0 0-1.914-1.914l-5.444 1.632a1.5 1.5 0 0 0-1.06 1.06l-1.632 5.444a1.5 1.5 0 0 0 1.914 1.914l5.444-1.632a1.5 1.5 0 0 0 1.06-1.06l1.632-5.444zM12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22z"/>
        : <path d="M15.356 10.558a1.5 1.5 0 0 0-1.914-1.914l-5.444 1.632a1.5 1.5 0 0 0-1.06 1.06l-1.632 5.444a1.5 1.5 0 0 0 1.914 1.914l5.444-1.632a1.5 1.5 0 0 0 1.06-1.06l1.632-5.444zM12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/>
      }
    </svg>
  );
  if (icon === 'match') return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
      {active
        ? <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        : <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/>
      }
    </svg>
  );
  if (icon === 'playlists') return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
      {active
        ? <path d="M3 3h8v8H3V3zm0 10h8v8H3v-8zm10-10h8v8h-8V3zm4 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>
        : <path d="M4 4h6v6H4V4zm1 1v4h4V5H5zm-1 9h6v6H4v-6zm1 1v4h4v-4H5zm9-10h6v6h-6V4zm1 1v4h4V5h-4zm3 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm-5 3a5 5 0 1 1 10 0 5 5 0 0 1-10 0z"/>
      }
    </svg>
  );
  return null;
}

export default function Layout({ page, navigate, user, onLogout, children }) {
  const { t } = useI18n();

  return (
    <div className="layout">
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo" onClick={() => navigate('/')}>
          <svg viewBox="0 0 24 24" width="32" height="32" fill="#1DB954">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          <span>SoundShift</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              className={`sidebar-nav-item ${page === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <NavIcon icon={item.icon} active={page === item.path} />
              <span>{t(item.labelKey)}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-footer">
          <div className="sidebar-user-row">
            <div className="sidebar-user">
              {user.profileImage ? (
                <img src={user.profileImage} alt="" className="sidebar-user-avatar" />
              ) : (
                <div className="sidebar-user-avatar-placeholder">
                  {user.displayName?.[0] || '?'}
                </div>
              )}
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user.displayName}</span>
                <LangSwitch />
              </div>
            </div>
            <button className="sidebar-logout" onClick={onLogout} title={t('header.logout')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h6a1 1 0 1 0 0-2H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6a1 1 0 1 0 0-2H5zm11.293 4.293a1 1 0 0 1 1.414 0l4 4a1 1 0 0 1 0 1.414l-4 4a1 1 0 0 1-1.414-1.414L18.586 13H9a1 1 0 1 1 0-2h9.586l-2.293-2.293a1 1 0 0 1 0-1.414z"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="bottom-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.path}
            className={`bottom-nav-item ${page === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <NavIcon icon={item.icon} active={page === item.path} />
            <span>{t(item.labelKey)}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
