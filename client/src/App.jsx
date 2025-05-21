import { useState } from 'react';
import AdminPanel from './components/AdminPanel';
import SpectatorPanel from './components/SpectatorPanel';
import './App.css';

function App() {
  const [mode, setMode] = useState(null);

  const handleModeSelect = (selectedMode) => {
    setMode(selectedMode);
  };

  const handleBack = () => {
    setMode(null);
  };

  return (
    <div className="app-container">
      {!mode && (
        <>
          <h1 style={{ 
            fontSize: '2.5rem', 
            color: '#1a365d', 
            fontWeight: 700, 
            marginBottom: 32, 
            letterSpacing: '-1px' 
          }}>
            Chronomètre ECOS
          </h1>
          <div className="mode-select card fade-in-up">
            <button 
              onClick={() => handleModeSelect('admin')}
              style={{
                padding: '15px 30px',
                fontSize: '18px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                margin: '10px',
                transition: 'background-color 0.3s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#0056b3'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#007bff'}
            >
              Administrateur
            </button>
            <button 
              onClick={() => handleModeSelect('spectator')}
              style={{
                padding: '15px 30px',
                fontSize: '18px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                margin: '10px',
                transition: 'background-color 0.3s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#1e7e34'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#28a745'}
            >
              Spectateur
            </button>
          </div>
        </>
      )}
      {mode === 'admin' && <AdminPanel onBack={handleBack} />}
      {mode === 'spectator' && <SpectatorPanel onBack={handleBack} />}
    </div>
  );
}

export default App;
