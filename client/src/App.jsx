import { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useSync } from './hooks/useSync';
import { useTimeline } from './hooks/useTimeline';
import { useI18n } from './i18n/index.jsx';
import LoginButton from './components/LoginButton';
import SyncButton from './components/SyncButton';
import StatsCards from './components/StatsCards';
import TimelineChart from './components/TimelineChart';
import YearDetail from './components/YearDetail';
import ShareCard from './components/ShareCard';
import MatchSection from './components/MatchSection';
import CommunityModal from './components/CommunityModal';
import LangSwitch from './components/LangSwitch';
import './App.css';

export default function App() {
  const { t } = useI18n();
  const { user, loading: authLoading, login, logout } = useAuth();
  const { progress, isRunning, error: syncError, startSync } = useSync();
  const [showShare, setShowShare] = useState(false);
  const [showCommunity, setShowCommunity] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const {
    timeline, stats, yearDetail, loading: timelineLoading,
    fetchTimeline, fetchStats, fetchYearDetail, clearYearDetail
  } = useTimeline();

  useEffect(() => {
    if (user) {
      fetchTimeline();
      fetchStats();
    }
  }, [user, fetchTimeline, fetchStats]);

  useEffect(() => {
    if (progress?.step === 'done') {
      fetchTimeline();
      fetchStats();
    }
  }, [progress, fetchTimeline, fetchStats]);

  if (authLoading) {
    return (
      <div className="app loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <LoginButton onLogin={login} />;
  }

  const hasData = timeline?.years?.length > 0;

  return (
    <div className="app">
      <header className="app-header">
        <h1>SoundShift</h1>
        <div className="header-right desktop-only">
          <LangSwitch />
          <button className="community-btn" onClick={() => setShowCommunity(true)}>{t('header.community')}</button>
          <span className="user-name">
            {user.profileImage && (
              <img src={user.profileImage} alt="" className="user-avatar" />
            )}
            {user.displayName}
          </span>
          <button className="logout-btn" onClick={logout}>{t('header.logout')}</button>
        </div>
        {/* Mobile */}
        <div className="header-right mobile-only">
          <button className="community-btn" onClick={() => setShowCommunity(true)}>{t('header.community')}</button>
          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
            {user.profileImage ? (
              <img src={user.profileImage} alt="" className="user-avatar" />
            ) : (
              <span className="menu-hamburger">&#9776;</span>
            )}
          </button>
        </div>
        {menuOpen && (
          <div className="mobile-menu" onClick={() => setMenuOpen(false)}>
            <div className="mobile-menu-header">
              {user.profileImage && (
                <img src={user.profileImage} alt="" className="mobile-menu-avatar" />
              )}
              <span className="mobile-menu-name">{user.displayName}</span>
            </div>
            <div className="mobile-menu-items">
              <button onClick={() => { setShowCommunity(true); setMenuOpen(false); }}>
                {t('header.community')}
              </button>
              <div className="mobile-menu-lang">
                <LangSwitch />
              </div>
              <button className="mobile-menu-logout" onClick={logout}>
                {t('header.logout')}
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="app-main">
        <div className="sync-share-row">
          <SyncButton
            progress={progress}
            isRunning={isRunning}
            error={syncError}
            onSync={startSync}
            onReset={() => { fetchTimeline(); fetchStats(); }}
          />
          {hasData && (
            <button className="share-trigger-btn" onClick={() => setShowShare(true)}>
              {t('share.button')}
            </button>
          )}
        </div>

        {timelineLoading && !hasData && (
          <div className="dashboard-skeleton">
            <div className="stats-grid">
              {[0,1,2,3].map(i => (
                <div key={i} className="stat-card">
                  <div className="skeleton skeleton-stat-accent" />
                  <span className="skeleton skeleton-stat-value" />
                  <span className="skeleton skeleton-stat-label" />
                </div>
              ))}
            </div>
            <div className="chart-container">
              <div className="skeleton skeleton-chart-header" />
              <div className="skeleton skeleton-chart" />
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                {[0,1,2,3,4,5].map(i => (
                  <span key={i} className="skeleton skeleton-legend" />
                ))}
              </div>
            </div>
          </div>
        )}

        {hasData && (
          <>
            <StatsCards stats={stats} />
            <TimelineChart data={timeline} onYearClick={fetchYearDetail} />
            <MatchSection />
          </>
        )}

        {!hasData && !isRunning && !timelineLoading && (
          <div className="empty-state">
            <p>{t('empty.noData')}</p>
          </div>
        )}
      </main>

      <YearDetail data={yearDetail} onClose={clearYearDetail} />
      {showCommunity && (
        <CommunityModal onClose={() => setShowCommunity(false)} />
      )}
      {showShare && (
        <ShareCard
          stats={stats}
          timeline={timeline}
          user={user}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
