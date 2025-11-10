import { io } from 'socket.io-client';

// Create a singleton socket connection
let socket = null;

export const getSocket = () => {
  if (!socket) {
    // Connect to the server - use the same origin so it goes through Vite proxy in dev
    // In development, Vite proxies /socket.io to the backend server
    // In production, same origin means it connects directly to the server
    const serverUrl = window.location.origin;
    
    console.log('🔌 Connecting WebSocket to:', serverUrl);
    
    socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      path: '/socket.io/'
    });

    socket.on('connect', () => {
      console.log('✅ WebSocket connected, socket ID:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected, reason:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
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

