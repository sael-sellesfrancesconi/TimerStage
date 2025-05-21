import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import collegiumSante from '../assets/Screenshot from 2025-05-21 13-53-49.png';
import pharmacie from '../assets/Pharmacie.png';

function SpectatorPanel({ onBack }) {
  const [session, setSession] = useState({ name: '' });
  const [joined, setJoined] = useState(false);
  const [timerState, setTimerState] = useState(null);
  const [socket, setSocket] = useState(null);
  const [sessionType, setSessionType] = useState('ecos_nationales');
  const [showLogo, setShowLogo] = useState('sante');
  const [isPaused, setIsPaused] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [validationErrors, setValidationErrors] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true); // État pour contrôler le son
  const [audioContext, setAudioContext] = useState(null); // Contexte audio

  // Configuration sécurisée pour éviter l'erreur process
  const getServerUrl = () => {
    // Vérification sécurisée de l'environnement
    try {
      return import.meta.env?.VITE_SERVER_URL || 
             (typeof window !== 'undefined' && window.REACT_APP_SERVER_URL) ||
             'http://cbs-timer.cbs.site.univ-lorraine.fr';
    } catch {
      return 'http://cbs-timer.cbs.site.univ-lorraine.fr';
    }
  };

  const isDevelopment = () => {
    try {
      return import.meta.env?.DEV || 
             (typeof window !== 'undefined' && window.location.hostname === 'localhost') ||
             false;
    } catch {
      return false;
    }
  };

  const testServerConnectivity = async (serverUrl) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${serverUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('Test de connectivité échoué:', error);
      return false;
    }
  };

  // Fonction pour initialiser le contexte audio
  const initializeAudio = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext && !audioContext) {
        const ctx = new AudioContext();
        setAudioContext(ctx);
        return ctx;
      }
      return audioContext;
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du contexte audio:', error);
      return null;
    }
  };

  // Fonction pour jouer un bip sonore
  const playBeep = async () => {
    if (!soundEnabled) return;

    try {
      let ctx = audioContext;
      
      // Initialiser le contexte audio si nécessaire
      if (!ctx) {
        ctx = initializeAudio();
        if (!ctx) return;
      }

      // Reprendre le contexte audio si il est suspendu (requis par les navigateurs modernes)
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Créer un oscillateur pour générer le bip
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      // Connecter oscillateur -> gain -> destination
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Configuration du son
      oscillator.frequency.setValueAtTime(800, ctx.currentTime); // Fréquence de 800Hz
      oscillator.type = 'sine'; // Onde sinusoïdale pour un son propre

      // Configuration du volume avec fade in/out
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1); // Fade in
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.9); // Maintien
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0); // Fade out

      // Jouer le son pendant 1 seconde
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 1.0);

      console.log('Bip sonore joué');
    } catch (error) {
      console.error('Erreur lors de la lecture du bip:', error);
    }
  };

  // Fonction pour activer/désactiver le son
  const toggleSound = async () => {
    if (!soundEnabled) {
      // Activer le son et initialiser le contexte audio
      setSoundEnabled(true);
      const ctx = initializeAudio();
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
      }
      // Jouer un bip de test
      setTimeout(() => playBeep(), 100);
    } else {
      setSoundEnabled(false);
    }
  };

  const connectSocket = (name) => {
    const serverUrl = getServerUrl();
    
    try {
      const s = io(serverUrl, {
        timeout: 10000,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
      });
      
      s.on('connect', () => {
        console.log('Socket connecté avec succès');
        setConnectionError('');
      });

      s.on('connect_error', (error) => {
        console.error('Erreur de connexion socket:', error);
        setConnectionError('Impossible de se connecter au serveur en temps réel');
      });

      s.on('disconnect', (reason) => {
        console.log('Socket déconnecté:', reason);
        if (reason === 'io server disconnect') {
          // Reconnexion manuelle si le serveur ferme la connexion
          s.connect();
        }
      });

      s.emit('join', { sessionName: name });
      s.on('timer', setTimerState);
      s.on('phaseChange', (timer) => {
        console.log('Changement de phase:', timer);
        // Jouer le bip sonore lors du changement de phase
        playBeep();
      });
      s.on('sessionDeleted', () => {  
        alert('La session a été supprimée.');
        setJoined(false);
        setTimerState(null);
        s.disconnect();
        setSocket(null);
      });
      
      setSocket(s);
    } catch (error) {
      console.error('Erreur lors de la création du socket:', error);
      setConnectionError('Erreur lors de l\'initialisation de la connexion');
    }
  };

  const validateSessionInput = (sessionName) => {
    const errors = [];
    
    if (!sessionName || !sessionName.trim()) {
      errors.push('Le nom de la session est requis');
    }
    
    if (sessionName && sessionName.trim().length < 2) {
      errors.push('Le nom de la session doit contenir au moins 2 caractères');
    }
    
    if (sessionName && !/^[a-zA-Z0-9_-]+$/.test(sessionName.trim())) {
      errors.push('Le nom de la session ne peut contenir que des lettres, chiffres, tirets et underscores');
    }
    
    return errors;
  };

  const handleJoinSession = async (e) => {
    e.preventDefault();
    setIsConnecting(true);
    setValidationErrors([]);
    setConnectionError('');
    
    const sessionName = session.name.trim();
    
    const errors = validateSessionInput(sessionName);
    
    if (errors.length > 0) {
      setValidationErrors(errors);
      setIsConnecting(false);
      return;
    }
    
    try {
      // Test de connectivité avant de se connecter
      const serverUrl = getServerUrl();
      const isServerReachable = await testServerConnectivity(serverUrl);
      
      if (!isServerReachable) {
        setConnectionError('Impossible de joindre le serveur. Vérifiez votre connexion.');
        setRetryCount(prev => prev + 1);
        setIsConnecting(false);
        return;
      }
      
      // Connexion à la session
      connectSocket(sessionName);
      setJoined(true);
      setIsConnecting(false);
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      setConnectionError('Erreur lors de la connexion à la session');
      setRetryCount(prev => prev + 1);
      setIsConnecting(false);
    }
  };

  const handleRetry = async () => {
    if (retryCount < 3) {
      await handleJoinSession({ preventDefault: () => {} });
    }
  };

  const handleDisconnect = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    setJoined(false);
    setTimerState(null);
    setConnectionError('');
    setRetryCount(0);
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

  // ALL useEffect hooks MUST be called before any conditional returns
  useEffect(() => {
    if (timerState && timerState.sessionType) {
      if (timerState.sessionType === 'epos') setShowLogo('pharma');
      else setShowLogo('sante');
    }
    if (timerState && timerState.isPaused !== undefined) {
      setIsPaused(timerState.isPaused);
    }
  }, [timerState]);

  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

  // Initialiser le contexte audio au premier clic utilisateur
  useEffect(() => {
    const handleFirstInteraction = () => {
      initializeAudio();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  // Nettoyer le contexte audio lors du démontage
  useEffect(() => {
    return () => {
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  }, [audioContext]);

  // Conditional rendering AFTER all hooks have been called
  if (!joined) {
    return (
      <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
        <button onClick={onBack} style={{ marginBottom: '20px' }}>Retour</button>
        <h2>Rejoindre une session</h2>
        
        <form onSubmit={handleJoinSession} style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '15px' }}>
            <input 
              name="sessionName"
              placeholder="Nom de la session" 
              value={session.name} 
              onChange={e => setSession({ name: e.target.value })}
              disabled={isConnecting}
              style={{ 
                width: '100%', 
                padding: '10px', 
                marginBottom: '10px',
                border: (connectionError || validationErrors.length > 0) ? '2px solid #d32f2f' : '1px solid #ccc',
                borderRadius: '4px'
              }}
              required
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isConnecting || !session.name.trim()}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: isConnecting ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isConnecting ? 'not-allowed' : 'pointer'
            }}
          >
            {isConnecting ? 'Connexion en cours...' : 'Rejoindre'}
          </button>
        </form>

        {/* Affichage des erreurs de validation */}
        {validationErrors.length > 0 && (
          <div style={{
            padding: '15px',
            backgroundColor: '#ffebee',
            border: '1px solid #d32f2f',
            borderRadius: '4px',
            color: '#d32f2f',
            marginBottom: '15px'
          }}>
            <strong>Erreurs de validation:</strong>
            <ul style={{ margin: '5px 0 0 0', paddingLeft: '20px' }}>
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Affichage des erreurs de connexion */}
        {connectionError && (
          <div style={{
            padding: '15px',
            backgroundColor: '#ffebee',
            border: '1px solid #d32f2f',
            borderRadius: '4px',
            color: '#d32f2f',
            marginBottom: '15px'
          }}>
            <strong>Erreur:</strong> {connectionError}
            {retryCount > 0 && retryCount < 3 && (
              <div style={{ marginTop: '10px' }}>
                <button 
                  onClick={handleRetry}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#ff9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Réessayer ({retryCount}/3)
                </button>
              </div>
            )}
            {retryCount >= 3 && (
              <div style={{ marginTop: '10px', fontSize: '14px' }}>
                Nombre maximum de tentatives atteint. Vérifiez votre connexion et réessayez plus tard.
              </div>
            )}
          </div>
        )}

        {/* Informations de debug en mode développement */}
        {isDevelopment() && (
          <div style={{
            padding: '10px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#666'
          }}>
            <strong>Debug Info:</strong><br/>
            Server URL: {getServerUrl()}<br/>
            Retry Count: {retryCount}<br/>
            Is Connecting: {isConnecting.toString()}<br/>
            Development Mode: {isDevelopment().toString()}
          </div>
        )}

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
      {/* Boutons de contrôle en haut à droite */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        display: 'flex',
        gap: '10px',
        zIndex: 1001
      }}>
        {/* Bouton pour activer/désactiver le son */}
        <button
          onClick={toggleSound}
          style={{
            padding: '10px 15px',
            backgroundColor: soundEnabled ? '#4caf50' : '#757575',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
          title={soundEnabled ? 'Désactiver le son' : 'Activer le son'}
        >
          {soundEnabled ? '🔊' : '🔇'} Son
        </button>

        {/* Bouton de déconnexion */}
        <button
          onClick={handleDisconnect}
          style={{
            padding: '10px 20px',
            backgroundColor: '#d32f2f',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Déconnexion
        </button>
      </div>

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
