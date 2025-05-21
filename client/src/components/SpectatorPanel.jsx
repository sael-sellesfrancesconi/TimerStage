import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import collegiumSante from '../assets/Screenshot from 2025-05-21 13-53-49.png';
import pharmacie from '../assets/Pharmacie.png';

function SpectatorPanel({ onBack }) {
  const [session, setSession] = useState({ name: '', password: '' });
  const [joined, setJoined] = useState(false);
  const [timerState, setTimerState] = useState(null);
  const [socket, setSocket] = useState(null);
  const [sessionType, setSessionType] = useState('ecos_nationales');
  const [showLogo, setShowLogo] = useState('sante');
  const [isPaused, setIsPaused] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const handleJoin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:4000/api/session/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionName: session.name, password: session.password })
      });
      if (!res.ok) throw new Error();
      connectSocket(session.name);
      setJoined(true);
    } catch {
      alert('Erreur de connexion à la session');
    }
  };

  const connectSocket = (name) => {
    const s = io('http://localhost:4000');
    s.emit('join', { sessionName: name });
    s.on('timer', setTimerState);
    s.on('phaseChange', (timer) => {
    });
    s.on('sessionDeleted', () => {  
      alert('La session a été supprimée.');
      setJoined(false);
      setTimerState(null);
      s.disconnect();
      setSocket(null);
    });
    setSocket(s);
  };

  const handlePauseResume = () => {
    if (!socket) return;
    if (!hasStarted) {
      socket.emit('admin:continue', { sessionName: session.name });
      setHasStarted(true);
      setIsPaused(false);
    } else if (isPaused) {
      socket.emit('admin:continue', { sessionName: session.name });
      setIsPaused(false);
    } else {
      socket.emit('admin:pause', { sessionName: session.name });
      setIsPaused(true);
    }
  };

  const handleReset = () => {
    if (!socket) return;
    socket.emit('admin:reset', { sessionName: session.name });
    setHasStarted(false);
  };

  useEffect(() => {
    if (timerState && timerState.sessionType) {
      if (timerState.sessionType === 'epos') setShowLogo('pharma');
      else setShowLogo('sante');
    }
    if (timerState && timerState.isPaused !== undefined) {
      setIsPaused(timerState.isPaused);
    }
  }, [timerState]);

  if (!joined) {
    return (
      <div>
        <button onClick={onBack}>Retour</button>
        <h2>Rejoindre une session</h2>
        <form onSubmit={handleJoin}>
          <input placeholder="Nom de la session" value={session.name} onChange={e => setSession({ ...session, name: e.target.value })} />
          <button type="submit">Rejoindre</button>
        </form>
        <img 
          src="https://factuel.univ-lorraine.fr/sites/factuel.univ-lorraine.fr/files/field/image/2021/02/fmmms-vertical-degrade.png" 
          alt="Logo Université de Lorraine" 
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            width: '150px',
            zIndex: 1000
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', width: '100vw', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', fontFamily: 'Segoe UI, Arial, sans-serif', margin: 0, padding: 0, boxSizing: 'border-box', position: 'relative' }}>
      {timerState && (
        <>
          <h1 style={{
            position: 'fixed',
            top: '20px',
            left: 0,
            right: 0,
            textAlign: 'center',
            color:
              timerState.phase === 'debrief' ? '#e6b800' :
              timerState.phase === 'pause' ? '#d32f2f' :
              timerState.phase === 'station' ? '#388e3c' :
              '#388e3c',
            fontFamily: 'Lato, Arial, sans-serif',
            fontSize: '2.5em',
            margin: 0,
            zIndex: 1000
          }}>
            {timerState.phase === 'station' ? 'Station'
              : timerState.phase === 'pause' ? 'Pause'
              : timerState.phase === 'debrief' ? 'Débrief' : 'Phase'}
          </h1>
          <div style={{
            fontSize: '18vw',
            fontWeight: 900,
            color:
              timerState.phase === 'debrief' ? '#e6b800' :
              timerState.phase === 'pause' ? '#d32f2f' :
              timerState.phase === 'station' ? '#388e3c' :
              '#388e3c',
            letterSpacing: 2,
            textShadow: '0 2px 32px #fff',
            fontFamily: 'Lato, Arial, sans-serif',
            userSelect: 'none',
            width: '100vw',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            height: '100vh',
            paddingLeft: '100px',
            marginTop: '-500px',
            marginLeft: '100px',
          }}>
            {Math.floor(timerState.timeLeft / 60).toString().padStart(2, '0')}:{(timerState.timeLeft % 60).toString().padStart(2, '0')}
          </div>
          {showLogo === 'sante' && (
            <img src={collegiumSante} alt="Collegium Santé" style={{ position: 'fixed', bottom: 20, left: 20, width: 240, zIndex: 1000 }} />
          )}
          {showLogo === 'pharma' && (
            <img src={pharmacie} alt="Pharmacie" style={{ position: 'fixed', bottom: 20, left: 20, width: 240, zIndex: 1000 }} />
          )}
        </>
      )}
    </div>
  );
}

export default SpectatorPanel;

/*
 / _| |            
| |_| | __ _ _ __  
|  _| |/ _` | '_ \ 
| | | | (_| | | | |
|_| |_|\__,_|_| |_|
*/