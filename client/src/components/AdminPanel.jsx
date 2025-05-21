import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import collegiumSante from '../assets/Screenshot from 2025-05-21 13-53-49.png';
import pharmacie from '../assets/Pharmacie.png';

function AdminPanel({ onBack }) {
        <h1>ECOS Nationnales</h1>
  const [token, setToken] = useState('');
  const [login, setLogin] = useState({ username: '', password: '' });
  const [session, setSession] = useState({ name: '', password: '' });
  const [sessionCreated, setSessionCreated] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [timerState, setTimerState] = useState(null);
  const [socket, setSocket] = useState(null);
  const [lastError, setLastError] = useState('');
  const [sessionsList, setSessionsList] = useState([]);
  const [sessionDetails, setSessionDetails] = useState([]);
  const [durations, setDurations] = useState({ capsule: 8, pause: 2 });
  const [sessionType, setSessionType] = useState('ecos_nationales');
  const [showLogo, setShowLogo] = useState('sante'); // 'sante' | 'pharma' | null
  const [debriefDuration, setDebriefDuration] = useState(5);
  const [stationDuration, setStationDuration] = useState(10);
  const [pauseDuration, setPauseDuration] = useState(2);
  const [monitorSession, setMonitorSession] = useState(null);
  const [isPaused, setIsPaused] = useState(true); // Timer à l'arrêt au début

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://cbs-timer.cbs.site.univ-lorraine.fr:4000/api/admin/login', login);
      setToken(res.data.token);
    } catch {
      alert('Identifiants invalides');
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    setLastError('');
    if (!session.name) {
      alert('Veuillez remplir le nom de la session');
      return;
    }
    try {
      await axios.post('http://cbs-timer.cbs.site.univ-lorraine.fr:4000/api/session', {
        sessionName: session.name,
        type: sessionType,
        pauseDuration: Number(pauseDuration),
        stationDuration: Number(stationDuration),
        debriefDuration: sessionType === 'ecos_facultaires' || sessionType === 'epos' ? Number(debriefDuration) : undefined
      }, { headers: { Authorization: `Bearer ${token.trim()}` } });
    } catch (err) { 
      // Ignore errors and always redirect
    }
    setSessionCreated(true);
    setSessionName(session.name);
    connectSocket(session.name);
  };

  const connectSocket = (name) => {
    const s = io('http://cbs-timer.cbs.site.univ-lorraine.fr');
    s.emit('join', { sessionName: name });
    s.on('timer', setTimerState);
    // Suppression de l'alerte lors du changement de phase
    s.on('phaseChange', (timer) => {
      // Ne rien faire ici
    });
    setSocket(s);
  };

  const startTimer = () => {
    if (socket) socket.emit('admin:start', { sessionName });
  };
  const stopTimer = () => {
    if (socket) socket.emit('admin:stop', { sessionName });
  };
  const togglePause = () => {
    if (!socket) return;
    if (isPaused) {
      socket.emit('admin:start', { sessionName });
      setIsPaused(false);
    } else {
      socket.emit('admin:pause', { sessionName });
      setIsPaused(true);
    }
  };
  const resetTimer = () => {
    if (socket) socket.emit('admin:reset', { sessionName });
  };
  const deleteSession = async () => {
    if(window.confirm('Supprimer cette session ?')) {
      try {
        await axios.delete(`http://cbs-timer.cbs.site.univ-lorraine.fr:4000/api/session/${sessionName}`, { headers: { Authorization: `Bearer ${token.trim()}` } });
        setSessionCreated(false);
        setSessionName('');
        setTimerState(null);
        if(socket) { socket.disconnect(); setSocket(null); }
        alert('Session supprimée');
      } catch (err) {
        alert('Erreur suppression session');
      }
    }
  };

  // Fetch sessions from backend
  const fetchSessions = async (jwtToken) => {
    try {
      const res = await axios.get('http://cbs-timer.cbs.site.univ-lorraine.fr:4000/api/sessions', { headers: { Authorization: `Bearer ${jwtToken.trim()}` } });
      setSessionsList(res.data.sessions || []);
      setSessionDetails(res.data.sessionDetails || []);
    } catch {
      setSessionsList([]);
      setSessionDetails([]);
    }
  };

  // Fetch sessions after login or after any session change
  useEffect(() => {
    if (token) fetchSessions(token);
  }, [token, sessionCreated]);

  // Correction : le spectateur doit pouvoir rejoindre la session en cours
  useEffect(() => {
    if (sessionCreated && sessionName) {
      // Mettre à jour la liste des sessions pour que la session nouvellement créée apparaisse côté spectateur
      fetchSessions(token);
    }
    // eslint-disable-next-line
  }, [sessionCreated, sessionName]);

  useEffect(() => {
    if (sessionCreated && sessionName && !socket) {
      connectSocket(sessionName);
    }
    // eslint-disable-next-line
  }, [sessionCreated, sessionName]);

  useEffect(() => {
    if (socket) {
      const handleSessionDeleted = () => {
        alert('La session a été supprimée.');
        setSessionCreated(false);
        setSessionName('');
        setTimerState(null);
        socket.disconnect();
        setSocket(null);
      };
      socket.on('sessionDeleted', handleSessionDeleted);
      return () => {
        socket.off('sessionDeleted', handleSessionDeleted);
      };
    }
  }, [socket]);

  useEffect(() => {
    if (sessionType === 'epos') setShowLogo('pharma');
    else setShowLogo('sante');
  }, [sessionType]);

  useEffect(() => {
    if (timerState) {
      setIsPaused(timerState.state !== 'running');
    }
  }, [timerState]);

  if (!token) {
    return (
      <div>
        <button onClick={onBack}>Retour</button>
        <h2>Connexion Administrateur</h2>
        <form onSubmit={handleLogin}>
          <input placeholder="Nom d'utilisateur" value={login.username} onChange={e => setLogin({ ...login, username: e.target.value })} />
          <input type="password" placeholder="Mot de passe" value={login.password} onChange={e => setLogin({ ...login, password: e.target.value })} />
          <button type="submit">Connexion</button>
        </form>
      </div>
    );
  }

  if (!sessionCreated) {
    return (
      <div className="card fade-in-up" style={{ maxWidth: 480, margin: '40px auto', position: 'relative', background: 'rgba(255,255,255,0.95)', boxShadow: '0 4px 24px rgba(90,103,216,0.08)', borderRadius: 16, padding: 32 }}>
        <button onClick={onBack} style={{ position: 'absolute', top: 18, right: 18, background: '#eee', color: '#333', borderRadius: 8, border: 'none', padding: '6px 16px', fontWeight: 500, cursor: 'pointer' }}>Retour</button>
        <h2 style={{ marginTop: 0, marginBottom: 24, color: '#1a365d', fontWeight: 600, fontSize: '2rem', letterSpacing: '-1px' }}>Créer une session</h2>
        <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <label style={{ fontWeight: 500, color: '#2d3748' }}>
            Type de session :
            <select value={sessionType} onChange={e => setSessionType(e.target.value)} style={{ marginLeft: 8, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1' }}>
              <option value="ecos_nationales">ECOS nationales</option>
              <option value="ecos_facultaires">ECOS facultaires</option>
              <option value="epos">EPOS</option>
            </select>
          </label>
          <label style={{ fontWeight: 500, color: '#2d3748' }}>
            Durée de la pause (minutes) :
            <input
              type="number"
              min="1"
              value={pauseDuration}
              onChange={e => setPauseDuration(e.target.value)}
              style={{ marginLeft: 8, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', width: 80 }}
            />
          </label>
          {(sessionType === 'ecos_facultaires' || sessionType === 'epos') && (
            <label style={{ fontWeight: 500, color: '#2d3748' }}>
              Durée de débrief (minutes) :
              <input
                type="number"
                min="0"
                value={debriefDuration}
                onChange={e => setDebriefDuration(e.target.value)}
                style={{ marginLeft: 8, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', width: 80 }}
              />
            </label>
          )}
          <label style={{ fontWeight: 500, color: '#2d3748' }}>
            Durée d'une station (minutes) :
            <input
              type="number"
              min="1"
              value={stationDuration}
              onChange={e => setStationDuration(e.target.value)}
              style={{ marginLeft: 8, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', width: 80 }}
            />
          </label>
          <input placeholder="Nom de la session" value={session.name} onChange={e => setSession({ ...session, name: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 16 }} />
          <button type="submit" style={{ background: '#5a67d8', color: 'white', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 600, fontSize: '1.1em', marginTop: 10 }}>Créer</button>
        </form>
        {sessionsList.length > 0 && (
          <div style={{ marginTop: 32, background: '#f7fafc', borderRadius: 10, boxShadow: '0 1px 6px rgba(90,103,216,0.06)', padding: 18 }}>
            <h3 style={{ color: '#1a365d', fontWeight: 600, marginTop: 0 }}>Sessions en cours</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#e9eafc' }}>
                  <th style={{ padding: 8, borderRadius: 6, color: '#2d3748', fontWeight: 500 }}>Nom de la session</th>
                  <th style={{ padding: 8, borderRadius: 6, color: '#2d3748', fontWeight: 500 }}>Admin</th>
                  <th style={{ padding: 8, borderRadius: 6 }}></th>
                </tr>
              </thead>
              <tbody>
                {sessionsList.map(name => (
                  <tr key={name} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: 8 }}>
                      <a href="#" style={{ color: '#5a67d8', textDecoration: 'underline', cursor: 'pointer', fontWeight: 500, fontSize: '1.08em' }} onClick={() => { setSessionCreated(true); setSessionName(name); setMonitorSession(name); }}>
                        {name}
                      </a>
                    </td>
                    <td style={{ padding: 8, color: '#444', fontSize: '0.98em' }}>{sessionDetails.find(s => s.name === name)?.admin || '-'}</td>
                    <td style={{ padding: 8 }}>
                      <button style={{ background: '#e53e3e', color: 'white', border: 'none', borderRadius: 6, padding: '4px 12px', fontWeight: 500, cursor: 'pointer' }} onClick={async () => {
                        if(window.confirm('Supprimer cette session ?')) {
                          try {
                            await axios.delete(`http://cbs-timer.cbs.site.univ-lorraine.fr/api/session/${name}`, { headers: { Authorization: `Bearer ${token.trim()}` } });
                            setSessionsList(sessionsList.filter(n => n !== name));
                          } catch (err) {
                            alert('Erreur suppression session');
                          }
                        }
                      }}>Supprimer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {showLogo === 'sante' && (
          <img src={collegiumSante} alt="Collegium Santé" style={{ position: 'fixed', bottom: 20, left: 20, width: 240, zIndex: 1000 }} />
        )}
        {showLogo === 'pharma' && (
          <img src={pharmacie} alt="Pharmacie" style={{ position: 'fixed', bottom: 20, left: 20, width: 240, zIndex: 1000 }} />
        )}
      </div>
    );
  }

  // Affichage dynamique du bouton start/stop
  const isRunning = timerState && timerState.state === 'running';

  return (
    <div>
      <button onClick={onBack}>Retour</button>
      <h2>Session : {sessionName}</h2>
      <button onClick={togglePause} style={{ background: isPaused ? '#38a169' : '#e53e3e', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, marginRight: 10 }}>
        {isPaused ? 'Reprendre' : 'Pause'}
      </button>
      <button onClick={resetTimer} style={{ background: '#3182ce', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, marginRight: 10 }}>Reset</button>
      <button onClick={deleteSession} style={{ background: '#e53e3e', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600 }}>Supprimer la session</button>
      {/* Tableau des sessions en cours avec noms cliquables */}
      <div style={{ marginTop: 20 }}>
        <h3>Timer</h3>
        {timerState && (
          <div>
            <div style={{
              color: timerState.phase === 'debrief' ? '#e6b800' : timerState.phase === 'pause' ? '#d32f2f' : timerState.phase === 'station' ? '#388e3c' : '#388e3c',
              fontWeight: 'bold',
              fontSize: '1.2em',
              marginBottom: 8
            }}>
              Phase : {timerState.phase === 'station'
                ? `Station (${timerState.stationDuration || 8} min)`
                : timerState.phase === 'pause'
                  ? (timerState.sessionType === 'ecos_facultaires' || timerState.sessionType === 'epos')
                    ? `Pause (${timerState.debriefDuration || 2} min)`
                    : 'Pause (2 min)'
                  : timerState.phase === 'debrief'
                    ? 'Débrief (5 min)'
                    : timerState.phase}
            </div>
            <div style={{
              color: timerState.phase === 'debrief' ? '#e6b800' : undefined,
              fontWeight: timerState.phase === 'debrief' ? 'bold' : undefined
            }}>
              Temps restant : {Math.floor(timerState.timeLeft / 60).toString().padStart(2, '0')}:{(timerState.timeLeft % 60).toString().padStart(2, '0')}
            </div>
            <div>État : {timerState.state}</div>
          </div>
        )}
      </div>
    </div>
  );
}

const API_BASE = process.env.NODE_ENV === 'development' 
  ? `http://${window.location.hostname}:4000`
  : 'cbs-timer.cbs.site.univ-lorraine.fr:4000';

export default AdminPanel;

