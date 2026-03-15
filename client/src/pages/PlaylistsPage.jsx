import PlaylistSection from '../components/PlaylistSection';

export default function PlaylistsPage({ stats }) {
  return (
    <div className="page-playlists">
      <PlaylistSection stats={stats} />
    </div>
  );
}
