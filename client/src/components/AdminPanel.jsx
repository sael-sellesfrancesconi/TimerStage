import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const SERVER_URL = 'http://cbs-timer.cbs.site.univ-lorraine.fr:4000';

const AdminPanel = ({ onBack }) => {
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
  const [showLogo, setShowLogo] = useState('sante');
  const [debriefDuration, setDebriefDuration] = useState(5);
  const [stationDuration, setStationDuration] = useState(10);
  const [pauseDuration, setPauseDuration] = useState(2);
  const [monitorSession, setMonitorSession] = useState(null);
  const [isPaused, setIsPaused] = useState(true);

  // Login logic
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${SERVER_URL}/api/admin/login`, login);
      setToken(res.data.token);
    } catch {
      alert('Identifiants invalides');
    }
  };

  // Create session logic
  const handleCreateSession = async (e) => {
    e.preventDefault();
    setLastError('');
    if (!session.name) {
      alert('Veuillez remplir le nom de la session');
      return;
    }
    try {
      await axios.post(`${SERVER_URL}/api/session`, {
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

  // Socket logic
  const connectSocket = (name) => {
    const s = io(SERVER_URL);
    s.emit('join', { sessionName: name });
    s.on('timer', setTimerState);
    s.on('phaseChange', () => {});
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

  // Defensive: always check and encode sessionName
  const deleteSession = async () => {
    console.log("Delete button clicked. sessionName:", sessionName);
    if (!sessionName) {
      alert("Aucune session sélectionnée.");
      return;
    }
    if(window.confirm('Supprimer cette session ?')) {
      try {
        const resp = await axios.delete(
          `${SERVER_URL}/api/session/${encodeURIComponent(sessionName)}`,
          { headers: { Authorization: `Bearer ${token.trim()}` } }
        );
        console.log('Réponse suppression session:', resp.data);
        setSessionCreated(false);
        setSessionName('');
        setTimerState(null);
        if(socket) { socket.disconnect(); setSocket(null); }
        alert('Session supprimée');
        fetchSessions(token);
      } catch (err) {
        if (err.response) {
          alert('Erreur suppression session : ' + (err.response.data?.message || err.response.status));
          console.error('Erreur suppression session:', err.response);
        } else {
          alert('Erreur suppression session (pas de réponse serveur)');
          console.error('Erreur suppression session:', err);
        }
      }
    }
  };

  // Fetch sessions from backend
  const fetchSessions = async (jwtToken) => {
    try {
      const res = await axios.get(`${SERVER_URL}/api/sessions`, { headers: { Authorization: `Bearer ${jwtToken.trim()}` } });
      setSessionsList(res.data.sessions || []);
      setSessionDetails(res.data.sessionDetails || []);
    } catch {
      setSessionsList([]);
      setSessionDetails([]);
    }
  };

  useEffect(() => {
    if (token) fetchSessions(token);
  }, [token, sessionCreated]);

  useEffect(() => {
    if (sessionCreated && sessionName) {
      fetchSessions(token);
    }
  }, [sessionCreated, sessionName]); // eslint-disable-line

  useEffect(() => {
    if (sessionCreated && sessionName && !socket) {
      connectSocket(sessionName);
    }
  }, [sessionCreated, sessionName]); // eslint-disable-line

  useEffect(() => {
    if (socket) {
      const handleSessionDeleted = () => {
        alert('La session a été supprimée.');
        setSessionCreated(false);
        setSessionName('');
        setTimerState(null);
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
        <button type="button" onClick={onBack}>Retour</button>
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
        <button type="button" onClick={onBack} style={{ position: 'absolute', top: 18, right: 18, background: '#eee', color: '#333', borderRadius: 8, border: 'none', padding: '6px 16px', fontWeight: 500, cursor: 'pointer' }}>Retour</button>
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
                      <button
                        type="button"
                        style={{ background: '#e53e3e', color: 'white', border: 'none', borderRadius: 6, padding: '4px 12px', fontWeight: 500, cursor: 'pointer' }}
                        onClick={async () => {
                          console.log("Table row delete clicked. Name:", name);
                          if(window.confirm('Supprimer cette session ?')) {
                            try {
                              const resp = await axios.delete(
                                `${SERVER_URL}/api/session/${encodeURIComponent(name)}`,
                                { headers: { Authorization: `Bearer ${token.trim()}` } }
                              );
                              console.log('Réponse suppression session:', resp.data);
                              setSessionsList(sessionsList.filter(n => n !== name));
                              if (sessionName === name) {
                                setSessionCreated(false);
                                setSessionName('');
                                setTimerState(null);
                                if(socket) { socket.disconnect(); setSocket(null); }
                              }
                              fetchSessions(token);
                            } catch (err) {
                              if (err.response) {
                                alert('Erreur suppression session : ' + (err.response.data?.message || err.response.status));
                                console.error('Erreur suppression session:', err.response);
                              } else {
                                alert('Erreur suppression session (pas de réponse serveur)');
                                console.error('Erreur suppression session:', err);
                              }
                            }
                          }
                        }}
                      >Supprimer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // Session is created, show timer controls
  return (
    <div>
      <button type="button" onClick={togglePause} style={{ background: isPaused ? '#38a169' : '#e53e3e', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, marginRight: 10 }}>
        {isPaused ? 'Reprendre' : 'Pause'}
      </button>
      <button type="button" onClick={resetTimer} style={{ background: '#3182ce', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, marginRight: 10 }}>Reset</button>
      <button type="button" onClick={deleteSession} style={{ background: '#e53e3e', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600 }}>Supprimer la session</button>
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
};

export default AdminPanel;
