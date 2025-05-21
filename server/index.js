// Import necessary modules
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware setup
app.use(cors());

// Define routes
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Define PORT with environment variable fallback (declared once)
const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0'; // Listen on all network interfaces

// Socket.IO configuration for LAN access
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

// Start server listening on all interfaces
server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 LAN access: cbs-timer.cbs.site.univ-lorraine.fr:${PORT}`);
  console.log(`📡 Listening on all interfaces (${HOST})`);
});
