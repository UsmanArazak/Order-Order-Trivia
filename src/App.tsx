import { useState } from 'react';
import { HostView } from './components/HostView';
import { PlayerView } from './components/PlayerView';
import { AdminView } from './components/AdminView';
import { Play, Users, BookOpen } from 'lucide-react';
import './App.css';

type ViewState = 'select' | 'host' | 'player' | 'admin';

function App() {
  const [view, setView] = useState<ViewState>('select');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Brand Header */}
      <header className="app-header">
        <div className="brand">
          <img src="/logo.png" alt="Daura Students Parliamentary Club" className="brand-logo" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
          <div>
            <span className="brand-text">Order! Order!</span>
            <div className="tagline" style={{ fontSize: '0.65rem' }}>Daura Students Parliamentary Club</div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        {view === 'select' && (
          <div className="container" style={{ maxWidth: '650px', textAlign: 'center', justifyContent: 'center' }}>
            
            <div className="hero-section">
              <div className="hero-logo-wrapper" style={{ padding: '0', background: 'transparent', boxShadow: 'none' }}>
                <img src="/logo.png" alt="Logo" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)' }} />
              </div>
              <h1 className="hero-title" style={{ marginTop: '0.5rem' }}>
                Parliamentary Trivia
              </h1>
              <p className="hero-subtitle">
                A live, speed-based multiplayer trivia quiz for the Daura Students assembly.
              </p>
            </div>

            {/* Selection Grid */}
            <div className="selection-grid">
              {/* Player Card */}
              <button 
                onClick={() => setView('player')}
                className="btn btn-gold selection-btn-player"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Users size={22} />
                  <span>Join Chambers as Player</span>
                </div>
                <span className="selection-btn-desc" style={{ color: 'var(--primary-dark)' }}>
                  Enter room code to cast your votes on your phone
                </span>
              </button>

              {/* Host Card */}
              <button 
                onClick={() => setView('host')}
                className="btn btn-primary selection-btn-host"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Play size={22} />
                  <span>Host New Game session</span>
                </div>
                <span className="selection-btn-desc">
                  Project the questions, timer, and leaderboard live
                </span>
              </button>

              {/* Admin Card */}
              <button 
                onClick={() => setView('admin')}
                className="btn btn-secondary"
                style={{ 
                  padding: '1rem', 
                  borderRadius: 'var(--radius-md)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: '0.75rem',
                  fontSize: '1.05rem',
                  width: '100%'
                }}
              >
                <BookOpen size={18} />
                <span>Manage Questions Bank</span>
              </button>
            </div>

            {/* Footer info */}
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Make sure to configure <code style={{ fontSize: '0.85rem' }}>.env.local</code> with your Supabase credentials.
            </div>
          </div>
        )}

        {view === 'host' && <HostView onBack={() => setView('select')} />}
        {view === 'player' && <PlayerView onBack={() => setView('select')} />}
        {view === 'admin' && <AdminView onBack={() => setView('select')} />}
      </main>
    </div>
  );
}

export default App;
