import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import socketManager from '../services/socketManager';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    console.warn('[SocketContext] useSocket must be used within SocketProvider');
    return null;
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { token: authToken } = useAuth();
  const [socket, setSocket] = useState(null);
  const mountedRef = useRef(true);
  const lastTokenRef = useRef(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // If no token, disconnect
    if (!authToken) {
      console.log('[SocketContext] No auth token, cleaning up socket');
      lastTokenRef.current = null;
      socketManager.disconnect();
      setSocket(null);
      return;
    }

    // If token is the same as last time, don't reinitialize
    if (lastTokenRef.current === authToken) {
      console.log('[SocketContext] Same token, socket already initialized');
      return;
    }

    // Token changed (or first initialization)
    console.log('[SocketContext] Token changed/initialized, connecting socket...');
    lastTokenRef.current = authToken;

    socketManager
      .connect(authToken)
      .then((connectedSocket) => {
        if (mountedRef.current) {
          console.log('[SocketContext] Socket connected:', connectedSocket?.id);
          setSocket(connectedSocket);
        }
      })
      .catch((err) => {
        console.error('[SocketContext] Connection failed:', err?.message);
        if (mountedRef.current) {
          setSocket(null);
        }
      });

    return () => {
      // On unmount, don't disconnect—let socket persist
      // It will disconnect when user logs out (token becomes null)
    };
  }, [authToken]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
