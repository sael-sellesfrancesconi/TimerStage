import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());

const ADMIN_USER = process.env.ADMIN_USER || "admin1";
const ADMIN_PASS = process.env.ADMIN_PASS || "azerty";
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';

const sessions = {};

function cleanTimer(timer) {
  if (!timer) return null;
  return {
    phase: timer.phase,
    timeLeft: timer.timeLeft,
    state: timer.state,
    sessionType: timer.sessionType,
    stationDuration: timer.stationDuration,
    pauseDuration: timer.pauseDuration,
    debriefDuration: timer.debriefDuration
  };
}

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    server: 'ECOS Timer Server'
  });
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = jwt.sign({ user: username }, JWT_SECRET, { expiresIn: '6h' });
    res.json({ token });
  } else {
    res.status(401).json({ message: "Identifiants invalides" });
  }
});

app.post('/api/session', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = auth.substring(7);
  try {
    jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const { sessionName, type, pauseDuration, stationDuration, debriefDuration } = req.body;
  if (!sessionName || !type) {
    return res.status(400).json({ message: "Missing parameters" });
  }
  sessions[sessionName] = {
    timer: {
      phase: 'pause',
      timeLeft: Number(pauseDuration) * 60,
      state: 'stopped',
      sessionType: type,
      stationDuration,
      pauseDuration,
      debriefDuration
    },
    admin: ADMIN_USER
  };
  res.status(201).json({ message: "Session created" });
});

app.get('/api/sessions', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = auth.substring(7);
  try {
    jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
  res.json({
    sessions: Object.keys(sessions),
    sessionDetails: Object.entries(sessions).map(([name, data]) => ({
      name,
      admin: data.admin
    }))
  });
});

app.delete('/api/session/:sessionName', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = auth.substring(7);
  try {
    jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const { sessionName } = req.params;
  if (sessions[sessionName]) {
    delete sessions[sessionName];
    res.json({ message: "Session deleted" });
    io.to(sessionName).emit('sessionDeleted');
  } else {
    res.status(404).json({ message: "Session not found" });
  }
});

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
    const timer = session.timer;
    if (timer.state === 'running') return;
    timer.state = 'running';
    if (timer.interval) clearInterval(timer.interval);
    timer.interval = setInterval(() => {
      if (timer.state !== 'running') return;
      timer.timeLeft--;
      if (timer.timeLeft <= 0) {
        if ((timer.sessionType === 'ecos_facultaires' || timer.sessionType === 'epos')) {
          if (timer.phase === 'pause') {
            timer.phase = 'station';
            timer.timeLeft = Number(timer.stationDuration) * 60;
          } else if (timer.phase === 'station') {
            timer.phase = 'debrief';
            timer.timeLeft = Number(timer.debriefDuration) * 60;
          } else if (timer.phase === 'debrief') {
            timer.phase = 'pause';
            timer.timeLeft = Number(timer.pauseDuration) * 60;
          }
        } else {
          if (timer.phase === 'pause') {
            timer.phase = 'station';
            timer.timeLeft = Number(timer.stationDuration) * 60;
          } else {
            timer.phase = 'pause';
            timer.timeLeft = Number(timer.pauseDuration) * 60;
          }
        }
        io.to(sessionName).emit('phaseChange', cleanTimer(timer));
      }
      io.to(sessionName).emit('timer', cleanTimer(timer));
    }, 1000);
  });

  socket.on('admin:pause', ({ sessionName }) => {
    const session = sessions[sessionName];
    if (!session) return;
    const timer = session.timer;
    timer.state = 'paused';
    io.to(sessionName).emit('timer', cleanTimer(timer));
  });

  socket.on('admin:continue', ({ sessionName }) => {
    const session = sessions[sessionName];
    if (!session) return;
    const timer = session.timer;
    if (timer.state === 'paused') {
      timer.state = 'running';
    }
    io.to(sessionName).emit('timer', cleanTimer(timer));
  });

  socket.on('admin:stop', ({ sessionName }) => {
    const session = sessions[sessionName];
    if (!session) return;
    const timer = session.timer;
    timer.state = 'stopped';
    if (timer.interval) clearInterval(timer.interval);
    io.to(sessionName).emit('timer', cleanTimer(timer));
  });

  socket.on('admin:reset', ({ sessionName }) => {
    const session = sessions[sessionName];
    if (!session) return;
    const timer = session.timer;
    timer.state = 'stopped';
    timer.phase = 'pause';
    timer.timeLeft = Number(timer.pauseDuration) * 60;
    if (timer.interval) {
      clearInterval(timer.interval);
      timer.interval = null;
    }
    io.to(sessionName).emit('timer', cleanTimer(timer));
  });
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});