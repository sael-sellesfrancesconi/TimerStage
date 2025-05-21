const express = require('express');
const http = require('http');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

const SECRET = 'ecos_secret';
const sessions = {};
const admins = {
  // username: hashed_password
  'admin': bcrypt.hashSync('adminpass', 10)
};

const users = [
  // Admin
  { username: 'admin1', password: bcrypt.hashSync('azerty', 10), role: 'admin' },
  // Spectator
  { username: 'spectator1', password: bcrypt.hashSync('spectapass1', 10), role: 'spectator' }
];

// Middleware to check admin JWT
function authenticateAdmin(req, res, next) {
  let token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'No token' });
  // Support 'Bearer <token>' format
  if (token.startsWith('Bearer ')) {
    token = token.slice(7).trim();
  }
  try {
    const decoded = jwt.verify(token, SECRET);
    if (!decoded.admin) throw new Error();
    req.admin = decoded.username;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  // Recherche dans la base users (et non admins)
  const user = users.find(u => u.username === username && u.role === 'admin');
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ username, admin: true }, SECRET, { expiresIn: '8h' });
  res.json({ token });
});

// Nouvelle route pour lister toutes les sessions (admin)
app.get('/api/sessions', authenticateAdmin, (req, res) => {
  const details = Object.entries(sessions).map(([name, s]) => ({ name, admin: s.admin }));
  res.json({ sessions: Object.keys(sessions), sessionDetails: details });
});

// Nouvelle création de session : refuse si le nom est déjà pris, sinon crée la session
app.post('/api/session', authenticateAdmin, (req, res) => {
  // Correction : le champ s'appelle sessionType dans le backend, pas type
  // Correction : accepter aussi 'type' pour compatibilité frontend
  const { sessionName, sessionType, type, stationDuration, pauseDuration, debriefDuration } = req.body;
  const realSessionType = sessionType || type || 'ecos_nationales';
  if (!sessionName) {
    return res.status(400).json({ error: 'Nom obligatoire' });
  }
  if (sessions[sessionName]) {
    return res.status(409).json({ error: 'Session already exists' });
  }
  sessions[sessionName] = {
    timer: {
      state: 'stopped',
      // Commence toujours par une phase de pause
      timeLeft: Number(pauseDuration) * 60,
      phase: 'pause',
      sessionType: realSessionType,
      stationDuration: Number(stationDuration),
      pauseDuration: Number(pauseDuration),
      debriefDuration: (realSessionType === 'ecos_facultaires' || realSessionType === 'epos') ? Number(debriefDuration) : 0
    },
    admin: req.admin
  };
  res.json({ success: true });
});

// Suppression d'une session (admin)
app.delete('/api/session/:sessionName', authenticateAdmin, (req, res) => {
  const { sessionName } = req.params;
  if (sessions[sessionName]) {
    const timer = sessions[sessionName].timer;
    // Log pour debug
    console.log(`[SUPPRESSION] Suppression de la session ${sessionName}`);
    // Reset timer before deleting and notify clients
    timer.state = 'stopped';
    timer.timeLeft = 480;
    timer.phase = 'capsule';
    if (timer.interval) {
      clearInterval(timer.interval);
      timer.interval = null;
      console.log(`[SUPPRESSION] Interval cleared for session ${sessionName}`);
    }
    io.to(sessionName).emit('timer', timer); // Notifie tous les clients du reset avant suppression
    io.to(sessionName).emit('sessionDeleted'); // Notifie tous les clients de la suppression
    // Nettoyage complet de la session (y compris tout interval résiduel)
    delete sessions[sessionName];
    console.log(`[SUPPRESSION] Session ${sessionName} deleted from sessions object`);
    global.gc && global.gc(); // Si le GC est exposé (optionnel)
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// Vérification d'existence d'une session (admin)
app.get('/api/session/:sessionName', authenticateAdmin, (req, res) => {
  const { sessionName } = req.params;
  if (sessions[sessionName]) {
    res.json({ exists: true });
  } else {
    res.json({ exists: false });
  }
});

// Join session (spectator)
app.post('/api/session/join', (req, res) => {
  const { sessionName } = req.body;
  const session = sessions[sessionName];
  if (!session) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  res.json({ success: true });
});

// Supprimer toutes les sessions (endpoint admin)
app.delete('/api/sessions', authenticateAdmin, (req, res) => {
  for (const key in sessions) {
    delete sessions[key];
  }
  res.json({ success: true });
});

// Page d'accueil simple pour tester le backend
app.get('/', (req, res) => {
  res.send('<h1>Timer ECOS API - Backend opérationnel</h1>');
});

// Utilitaire pour ne pas envoyer l'objet interval (setInterval) dans le timer
function cleanTimer(timer) {
  const { interval, ...rest } = timer;
  return rest;
}

// WebSocket logic
io.on('connection', (socket) => {
  socket.on('join', ({ sessionName }) => {
    socket.join(sessionName);
    if (sessions[sessionName]) {
      socket.emit('timer', cleanTimer(sessions[sessionName].timer));
    }
  });

  socket.on('admin:start', ({ sessionName }) => {
    const session = sessions[sessionName];
    if (!session) return;
    if (session.timer.state === 'running') return;
    session.timer.state = 'running';
    session.timer.isPaused = false;
    // Commence toujours par une phase de pause
    session.timer.phase = 'pause';
    session.timer.timeLeft = Number(session.timer.pauseDuration) * 60;
    io.to(sessionName).emit('timer', cleanTimer(session.timer));
    session.timer.interval = setInterval(() => {
      if (session.timer.state !== 'running') return;
      session.timer.timeLeft--;
      if (session.timer.timeLeft <= 0) {
        // PHASE LOGIC: la première phase est toujours une pause, puis on boucle
        if ((session.timer.sessionType === 'ecos_facultaires' || session.timer.sessionType === 'epos')) {
          if (session.timer.phase === 'pause') {
            session.timer.phase = 'station';
            session.timer.timeLeft = Number(session.timer.stationDuration) * 60;
          } else if (session.timer.phase === 'station') {
            session.timer.phase = 'debrief';
            session.timer.timeLeft = Number(session.timer.debriefDuration) * 60;
          } else if (session.timer.phase === 'debrief') {
            session.timer.phase = 'pause';
            session.timer.timeLeft = Number(session.timer.pauseDuration) * 60;
          }
        } else {
          // ECOS nationales : pause -> station -> pause -> station ...
          if (session.timer.phase === 'pause') {
            session.timer.phase = 'station';
            session.timer.timeLeft = Number(session.timer.stationDuration) * 60;
          } else {
            session.timer.phase = 'pause';
            session.timer.timeLeft = Number(session.timer.pauseDuration) * 60;
          }
        }
        io.to(sessionName).emit('phaseChange', cleanTimer(session.timer));
      }
      io.to(sessionName).emit('timer', cleanTimer(session.timer));
    }, 1000);
  });

  socket.on('admin:stop', ({ sessionName }) => {
    const session = sessions[sessionName];
    if (!session) return;
    session.timer.state = 'stopped';
    if (session.timer.interval) clearInterval(session.timer.interval);
    session.timer.timeLeft = Number(session.timer.pauseDuration) * 60;
    session.timer.phase = 'pause';
    io.to(sessionName).emit('timer', cleanTimer(session.timer));
  });

  socket.on('admin:pause', ({ sessionName }) => {
    const session = sessions[sessionName];
    if (!session) return;
    session.timer.state = 'paused';
    session.timer.isPaused = true;
    if (session.timer.interval) {
      clearInterval(session.timer.interval);
      session.timer.interval = null;
    }
    io.to(sessionName).emit('timer', cleanTimer(session.timer));
  });
  socket.on('admin:continue', ({ sessionName }) => {
    const session = sessions[sessionName];
    if (!session) return;
    if (session.timer.state === 'running') return;
    session.timer.state = 'running';
    session.timer.isPaused = false;
    io.to(sessionName).emit('timer', cleanTimer(session.timer));
    // Redémarrer l'intervalle si besoin, mais NE PAS réinitialiser timeLeft ni phase !
    if (!session.timer.interval) {
      session.timer.interval = setInterval(() => {
        if (session.timer.state !== 'running') return;
        session.timer.timeLeft--;
        if (session.timer.timeLeft <= 0) {
          // PHASE LOGIC identique à admin:start
          if ((session.timer.sessionType === 'ecos_facultaires' || session.timer.sessionType === 'epos')) {
            if (session.timer.phase === 'pause') {
              session.timer.phase = 'station';
              session.timer.timeLeft = Number(session.timer.stationDuration) * 60;
            } else if (session.timer.phase === 'station') {
              session.timer.phase = 'debrief';
              session.timer.timeLeft = Number(session.timer.debriefDuration) * 60;
            } else if (session.timer.phase === 'debrief') {
              session.timer.phase = 'pause';
              session.timer.timeLeft = Number(session.timer.pauseDuration) * 60;
            }
          } else {
            if (session.timer.phase === 'pause') {
              session.timer.phase = 'station';
              session.timer.timeLeft = Number(session.timer.stationDuration) * 60;
            } else {
              session.timer.phase = 'pause';
              session.timer.timeLeft = Number(session.timer.pauseDuration) * 60;
            }
          }
          io.to(sessionName).emit('phaseChange', cleanTimer(session.timer));
        }
        io.to(sessionName).emit('timer', cleanTimer(session.timer));
      }, 1000);
    }
  });
  socket.on('admin:reset', ({ sessionName }) => {
    const session = sessions[sessionName];
    if (!session) return;
    session.timer.state = 'stopped';
    session.timer.isPaused = false;
    session.timer.phase = 'pause';
    session.timer.timeLeft = Number(session.timer.pauseDuration) * 60;
    if (session.timer.interval) {
      clearInterval(session.timer.interval);
      session.timer.interval = null;
    }
    io.to(sessionName).emit('timer', cleanTimer(session.timer));
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
 
/*
 / _| |            
| |_| | __ _ _ __  
|  _| |/ _` | '_ \ 
| | | | (_| | | | |
|_| |_|\__,_|_| |_|
*/