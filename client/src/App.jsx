import { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useSync } from './hooks/useSync';
import { useTimeline } from './hooks/useTimeline';
import { useRouter } from './hooks/useRouter';
import LoginButton from './components/LoginButton';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ExplorePage from './pages/ExplorePage';
import MatchPage from './pages/MatchPage';
import PlaylistsPage from './pages/PlaylistsPage';
import UploadPage from './pages/UploadPage';
import './App.css';

export default function App() {
  const { user, loading: authLoading, login, logout, refetch } = useAuth();
  const { progress, isRunning, error: syncError, startSync } = useSync();
  const { page, navigate } = useRouter();
  const [showUpload, setShowUpload] = useState(false);
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
    if (showUpload) {
      return (
        <UploadPage
          onComplete={() => {
            setShowUpload(false);
            refetch();
          }}
          onBack={() => setShowUpload(false)}
        />
      );
    }
    return <LoginButton onLogin={login} onUpload={() => setShowUpload(true)} />;
  }

  const renderPage = () => {
    switch (page) {
      case '/explore':
        return <ExplorePage />;
      case '/match':
        return <MatchPage />;
      case '/playlists':
        return <PlaylistsPage stats={stats} />;
      default:
        return (
          <HomePage
            user={user}
            navigate={navigate}
            progress={progress}
            isRunning={isRunning}
            syncError={syncError}
            startSync={startSync}
            timeline={timeline}
            stats={stats}
            timelineLoading={timelineLoading}
            fetchTimeline={fetchTimeline}
            fetchStats={fetchStats}
            fetchYearDetail={fetchYearDetail}
            yearDetail={yearDetail}
            clearYearDetail={clearYearDetail}
          />
        );
    }
  };

  return (
    <Layout page={page} navigate={navigate} user={user} onLogout={logout}>
      {renderPage()}
    </Layout>
  );
}
