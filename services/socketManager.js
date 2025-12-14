import io from 'socket.io-client';
import { API_BASE_URL } from '../config/apiConfig';

// Global state that survives Expo Go hot reloads
let globalSocket = null;
let globalToken = null;
let globalConnecting = false;

// Singleton socket manager: ensures ONE socket per token, reuses it, prevents duplicate connections.
class SocketManager {
  constructor() {
    // Restore from global state on each instantiation (survives Expo reloads)
    this.socket = globalSocket;
    this.currentToken = globalToken;
    this.connecting = globalConnecting;
  }

  async connect(token) {
    console.log('[SocketManager.connect] token:', !!token, 'socket:', !!this.socket?.id, 'connected:', !!this.socket?.connected, 'connecting:', this.connecting);

    // If we already have a connected socket for this token, return it immediately
    if (this.socket && this.currentToken === token && this.socket.connected) {
      console.log('[SocketManager] ✅ Socket already connected:', this.socket.id);
      return this.socket;
    }

    // If token changed, disconnect old socket
    if (this.currentToken !== token) {
      console.log('[SocketManager] Token changed, disconnecting old socket');
      if (this.socket) {
        try {
          this.socket.disconnect();
        } catch (e) {
          console.warn('[SocketManager] Error disconnecting:', e?.message);
        }
      }
      this.socket = null;
      globalSocket = null;
      this.connecting = false;
      globalConnecting = false;
    }

    this.currentToken = token;
    globalToken = token;

    // If already connecting, wait for the connection
    if (this.connecting && this.socket) {
      console.log('[SocketManager] Already connecting, waiting...');
      return new Promise((resolve) => {
        const checkConnection = setInterval(() => {
          if (this.socket && this.socket.connected) {
            clearInterval(checkConnection);
            console.log('[SocketManager] Socket is now connected:', this.socket.id);
            resolve(this.socket);
          }
        }, 100);
        setTimeout(() => clearInterval(checkConnection), 30000);
      });
    }

    // Start new connection
    console.log('[SocketManager] 🔌 Creating new socket...');
    this.connecting = true;
    globalConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.socket = io(API_BASE_URL, {
          auth: { token },
          transports: ['websocket'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 30000,
          reconnectionAttempts: Infinity,
          autoConnect: true,
        });

        globalSocket = this.socket;

        // If socket is already connected (unlikely with autoConnect: true, but check anyway)
        if (this.socket.connected) {
          console.log('[SocketManager] ✅ Socket connected immediately:', this.socket.id);
          this.connecting = false;
          globalConnecting = false;
          resolve(this.socket);
          return;
        }

        // Listen for successful connection
        const handleConnect = () => {
          console.log('[SocketManager] ✅ Socket connected:', this.socket.id);
          this.socket.off('connect', handleConnect);
          this.socket.off('connect_error', handleConnectError);
          this.connecting = false;
          globalConnecting = false;
          resolve(this.socket);
        };

        // Handle connection errors
        const handleConnectError = (err) => {
          console.warn('[SocketManager] ⚠️ Connect error:', err?.message || err);
          this.socket.off('connect', handleConnect);
          this.socket.off('connect_error', handleConnectError);
          this.connecting = false;
          globalConnecting = false;
          // Resolve with socket anyway; socket.io will keep trying to reconnect
          resolve(this.socket);
        };

        this.socket.once('connect', handleConnect);
        this.socket.once('connect_error', handleConnectError);

        // General ongoing disconnect/error handlers
        this.socket.on('disconnect', (reason) => {
          console.log('[SocketManager] Socket disconnected:', reason);
        });

        this.socket.on('connect_error', (err) => {
          console.warn('[SocketManager] Ongoing connect_error:', err?.message || err);
        });
      } catch (e) {
        console.error('[SocketManager] ❌ Failed to create socket:', e?.message || e);
        this.connecting = false;
        globalConnecting = false;
        reject(e);
      }
    });
  }

  async emit(event, data, token) {
    try {
      // Ensure we have a socket (wait for connection if needed)
      if (!this.socket || this.currentToken !== token) {
        await this.connect(token);
      }

      // Emit the event (socket.io queues if not connected yet)
      if (this.socket) {
        this.socket.emit(event, data);
        return true;
      }
    } catch (e) {
      console.warn('[SocketManager] emit failed:', e?.message || e);
    }
    return false;
  }

  disconnect() {
    console.log('[SocketManager] Disconnecting...');
    if (this.socket) {
      try {
        this.socket.disconnect();
      } catch (e) {
        console.warn('[SocketManager] Error disconnecting:', e?.message);
      }
    }
    this.socket = null;
    this.currentToken = null;
    this.connecting = false;
    globalSocket = null;
    globalToken = null;
    globalConnecting = false;
  }
}

const singleton = new SocketManager();
export default singleton;
