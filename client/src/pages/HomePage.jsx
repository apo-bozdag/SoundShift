import { useI18n } from '../i18n/index.jsx';
import SyncButton from '../components/SyncButton';
import StatsCards from '../components/StatsCards';
import TimelineChart from '../components/TimelineChart';
import MatchSection from '../components/MatchSection';
import YearDetail from '../components/YearDetail';
import ShareCard from '../components/ShareCard';
import { useState } from 'react';

function getGreeting(t) {
  const hour = new Date().getHours();
  if (hour < 12) return t('home.goodMorning');
  if (hour < 18) return t('home.goodAfternoon');
  return t('home.goodEvening');
}

export default function HomePage({ user, navigate, progress, isRunning, syncError, startSync, timeline, stats, timelineLoading, fetchTimeline, fetchStats, fetchYearDetail, yearDetail, clearYearDetail }) {
  const { t } = useI18n();
  const [showShare, setShowShare] = useState(false);
  const hasData = timeline?.years?.length > 0;

  return (
    <div className="page-home">
      {/* Greeting + Sync Row */}
      <div className="home-top">
        <h1 className="home-greeting">{getGreeting(t)}</h1>
        <div className="home-actions">
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
      </div>

      {/* Skeleton */}
      {timelineLoading && !hasData && (
        <div className="home-skeleton">
          <div className="stats-row">
            {[0,1,2,3].map(i => (
              <div key={i} className="stat-item">
                <div className="skeleton" style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0 }} />
                <div className="stat-text">
                  <span className="skeleton" style={{ width: '60%', height: 16, borderRadius: 4 }} />
                  <span className="skeleton" style={{ width: '80%', height: 10, borderRadius: 4, marginTop: 4 }} />
                </div>
              </div>
            ))}
          </div>
          <div className="home-card">
            <div className="skeleton" style={{ width: '100%', height: 300, borderRadius: 8 }} />
          </div>
        </div>
      )}

      {hasData && (
        <>
          {/* Stats */}
          <StatsCards stats={stats} />

          {/* Timeline */}
          <div className="home-card">
            <TimelineChart data={timeline} onYearClick={fetchYearDetail} />
          </div>

          {/* Match Preview */}
          <div className="home-card home-card-flush">
            <MatchSection limit={3} onNavigate={() => navigate('/match')} />
          </div>
        </>
      )}

      {!hasData && !isRunning && !timelineLoading && (
        <div className="empty-state">
          <p>{t('empty.noData')}</p>
        </div>
      )}

      <YearDetail data={yearDetail} onClose={clearYearDetail} />
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
