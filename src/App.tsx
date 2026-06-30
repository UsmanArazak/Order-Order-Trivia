import { useState } from 'react';
import { HostView } from './components/HostView';
import { PlayerView } from './components/PlayerView';
import { AdminView } from './components/AdminView';
import { hasSupabaseConfig } from './lib/supabase';
import { Gavel, Play, Users, BookOpen, Sparkles, Database } from 'lucide-react';
import './App.css';

type ViewState = 'select' | 'host' | 'player' | 'admin';

function App() {
  const [view, setView] = useState<ViewState>('select');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Brand Header */}
      <header className="app-header">
        <div className="brand">
          <Gavel className="brand-logo" />
          <div>
            <span className="brand-text">Order! Order!</span>
            <div className="tagline" style={{ fontSize: '0.65rem' }}>Daura Students Parliamentary Club</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {hasSupabaseConfig ? (
            <span style={{ fontSize: '0.75rem', backgroundColor: '#e2f7e5', color: '#1b8a32', padding: '0.3rem 0.6rem', borderRadius: '4px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Database size={12} /> Connected
            </span>
          ) : (
            <span style={{ fontSize: '0.75rem', backgroundColor: '#fff9e6', color: '#b27a00', padding: '0.3rem 0.6rem', borderRadius: '4px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem', border: '1px solid #ffe89e' }}>
              <Sparkles size={12} /> Sandbox Mode
            </span>
          )}
          <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700 }}>
            Session: 2026 Assembly
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        {view === 'select' && (
          <div className="container" style={{ maxWidth: '650px', textAlign: 'center', justifyContent: 'center' }}>
            
            {/* Database Warning Banner */}
            {!hasSupabaseConfig && (
              <div style={{ 
                padding: '1.25rem', 
                backgroundColor: 'rgba(212, 175, 55, 0.08)', 
                border: '1.5px solid var(--gold)', 
                borderRadius: 'var(--radius-md)', 
                color: 'var(--text-primary)', 
                marginBottom: '2rem', 
                textAlign: 'left',
                display: 'flex',
                gap: '1rem',
                alignItems: 'center'
              }}>
                <Sparkles size={36} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                <div>
                  <h4 style={{ color: 'var(--primary-dark)', marginBottom: '0.25rem', fontWeight: 700 }}>Running in Sandbox Mode</h4>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    No database credentials detected. All buttons are fully clickable, running a <strong>simulated game</strong> locally so you can preview the design and trivia flow. Add keys to <code style={{ color: 'var(--primary-dark)', backgroundColor: 'var(--bg-card)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>.env.local</code> to connect live phones.
                  </p>
                </div>
              </div>
            )}

            <div className="hero-section">
              <div className="hero-logo-wrapper">
                <Gavel size={36} />
              </div>
              <h1 className="hero-title">
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
