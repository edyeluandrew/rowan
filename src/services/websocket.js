import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import matchingEngine from '../services/matchingEngine.js';

let io = null;

/**
 * Initialize Socket.io on top of the HTTP server.
 * Two namespaces of rooms:
 *   - `user:<userId>`   — wallet users get tx status updates
 *   - `trader:<traderId>` — traders get new request pushes
 */
function init(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN.split(',').map(o => o.trim()), // [AUDIT FIX] from env, comma-separated, no wildcard
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Auth middleware — validate JWT on connection
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
      socket.userId = payload.sub;
      socket.role = payload.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // Join the appropriate room
    if (socket.role === 'user') {
      socket.join(`user:${socket.userId}`);
      logger.info(`[WS] User ${socket.userId} connected`);
    } else if (socket.role === 'trader') {
      socket.join(`trader:${socket.userId}`);
      logger.info(`[WS] Trader ${socket.userId} connected`);
    }

    socket.on('disconnect', () => {
      logger.info(`[WS] ${socket.role} ${socket.userId} disconnected`);
    });
  });

  // Inject io into the matching engine so it can push events
  matchingEngine.setIo(io);

  logger.info('[WS] Socket.io initialized');
  return io;
}

/**
 * Get the Socket.io instance (for use in other modules).
 */
function getIo() {
  return io;
}

/**
 * Emit a transaction status update to a user.
 */
function emitToUser(userId, event, data) {
  if (io) io.to(`user:${userId}`).emit(event, data);
}

/**
 * Emit to a trader.
 */
function emitToTrader(traderId, event, data) {
  if (io) io.to(`trader:${traderId}`).emit(event, data);
}

/**
 * Broadcast an event to all connected sockets of a given role.
 * Used for admin notifications (e.g., new trader submissions).
 */
function broadcast(role, event, data) {
  if (!io) return;
  // Iterate all connected sockets and emit to those matching the role
  for (const [, socket] of io.sockets.sockets) {
    if (socket.role === role) {
      socket.emit(event, data);
    }
  }
}

export default { init, getIo, emitToUser, emitToTrader, broadcast };
