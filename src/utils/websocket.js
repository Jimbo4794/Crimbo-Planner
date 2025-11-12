import { io } from 'socket.io-client';
import logger from './logger.js';

// Create a singleton socket connection
let socket = null;

export const getSocket = () => {
  if (!socket) {
    // Connect to the server - use the same origin so it goes through Vite proxy in dev
    // In development, Vite proxies /socket.io to the backend server
    // In production, same origin means it connects directly to the server
    const serverUrl = window.location.origin;
    
    logger.info('Connecting WebSocket to:', serverUrl);
    
    socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      path: '/socket.io/'
    });

    socket.on('connect', () => {
      logger.info('WebSocket connected, socket ID:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      logger.warn('WebSocket disconnected, reason:', reason);
    });

    socket.on('connect_error', (error) => {
      logger.error('WebSocket connection error:', error);
    });
  }
  
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

