import { useEffect, useState } from 'react';
import { initDb } from './lib/db';
import Dashboard from './pages/Dashboard';
import LogWorkout from './pages/LogWorkout';
import LiveSession from './pages/LiveSession';
import History from './pages/History';
import ExerciseLibrary from './pages/ExerciseLibrary';
import Templates from './pages/Templates';
import Stats from './pages/Stats';
import { IconBook, IconCalendar, IconChart, IconDumbbell, IconHome, IconLogo, IconTemplate } from './components/icons';
import LoadingState from './components/LoadingState';

export type Page = 'dashboard' | 'log' | 'session' | 'history' | 'library' | 'templates' | 'stats';

// `mobileNav: false` keeps the bottom nav at 5 items (the gym-floor thumb-zone
// budget) — Templates is a setup/planning action, not a mid-workout one, so it
// only needs the sidebar on desktop. Still reachable on mobile via the "Manage
// templates" link inside the Use Template picker (see TemplatePickerModal).
const NAV_ITEMS: { id: Page; label: string; icon: typeof IconHome; mobileNav?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: IconHome },
  { id: 'log', label: 'Log Workout', icon: IconDumbbell },
  { id: 'history', label: 'History', icon: IconCalendar },
  { id: 'library', label: 'Library', icon: IconBook },
  { id: 'templates', label: 'Templates', icon: IconTemplate, mobileNav: false },
  { id: 'stats', label: 'Stats', icon: IconChart },
];

function App() {
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState<Page>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    initDb().then(() => setReady(true));
  }, []);

  const bump = () => setRefreshKey((k) => k + 1);

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <LoadingState label="Loading Evolve…" />
      </div>
    );
  }

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-logo"><IconLogo size={26} /><span>Evolve</span></div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${page === item.id ? 'active' : ''}`}
            onClick={() => setPage(item.id)}
          >
            <span className="icon"><item.icon size={20} /></span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <main className="main-content">
        {page === 'dashboard' && <Dashboard key={refreshKey} onNavigate={setPage} />}
        {page === 'log' && <LogWorkout onSaved={bump} onNavigate={setPage} />}
        {page === 'session' && <LiveSession onEnded={() => { bump(); setPage('dashboard'); }} onNavigate={setPage} />}
        {page === 'history' && <History key={refreshKey} />}
        {page === 'library' && <ExerciseLibrary />}
        {page === 'templates' && <Templates />}
        {page === 'stats' && <Stats key={refreshKey} />}
      </main>

      <nav className="bottom-nav">
        {NAV_ITEMS.filter((item) => item.mobileNav !== false).map((item) => (
          <button
            key={item.id}
            className={`nav-item ${page === item.id ? 'active' : ''}`}
            onClick={() => setPage(item.id)}
          >
            <span className="icon"><item.icon size={20} /></span>
            <span>{item.label.split(' ')[0]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
