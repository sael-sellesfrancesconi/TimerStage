import { useState } from 'react';
import AdminPanel from './components/AdminPanel';
import SpectatorPanel from './components/SpectatorPanel';
import './App.css';

function App() {
  const [mode, setMode] = useState(null);

  return (
    <>
      <div className="app-container">
        {!mode && (
          <>
            <h1 style={{ fontSize: '2.5rem', color: '#1a365d', fontWeight: 700, marginBottom: 32, letterSpacing: '-1px' }}>Chronomètre ECOS</h1>
            <div className="mode-select card fade-in-up">
              <button onClick={() => setMode('admin')}>Administrateur</button>
              <button onClick={() => setMode('spectator')}>Spectateur</button>
            </div>
          </>
        )}
        {mode === 'admin' && <AdminPanel onBack={() => setMode(null)} />}
        {mode === 'spectator' && <SpectatorPanel onBack={() => setMode(null)} />}
      </div>
    </>
  );
}

export default App;

/*
 / _| |            
| |_| | __ _ _ __  
|  _| |/ _` | '_ \ 
| | | | (_| | | | |
|_| |_|\__,_|_| |_|
*/
