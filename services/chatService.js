import socketManager from './socketManager';
import * as SecureStore from 'expo-secure-store';

export const initiateSocketConnection = async () => {
  try {
    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      console.error('[chatService] No authentication token found for socket connection.');
      return null;
    }

    console.log('[chatService] Initiating socket connection via socketManager...');
    const socket = await socketManager.connect(token);
    console.log('[chatService] Socket connected:', socket?.id);
    return socket;
  } catch (e) {
    console.error('[chatService] Failed to initiate socket connection:', e?.message || e);
    return null;
  }
};

export const disconnectSocket = () => {
  console.log('[chatService] Disconnecting socket...');
  socketManager.disconnect();
};

export const joinTicketRoom = (ticketId, callback) => {
  if (socketManager.socket && socketManager.socket.connected) {
    console.log('[chatService] Joining ticket room:', ticketId);
    socketManager.socket.emit('joinTicketRoom', ticketId, callback);
  } else {
    console.warn('[chatService] Socket not connected, cannot join room');
  }
};

export const sendMessage = (messageData, callback) => {
  if (socketManager.socket && socketManager.socket.connected) {
    socketManager.socket.emit('sendMessage', messageData, callback);
  } else {
    console.warn('[chatService] Socket not connected, cannot send message');
  }
};

export const fetchMessages = (data, callback) => {
  if (socketManager.socket && socketManager.socket.connected) {
    socketManager.socket.emit('fetchMessages', data, callback);
  } else {
    console.warn('[chatService] Socket not connected, cannot fetch messages');
  }
};

export const onReceiveMessage = (callback) => {
  if (socketManager.socket) {
    console.log('[chatService] Registering receiveMessage listener');
    socketManager.socket.on('receiveMessage', callback);
  }
};

export const offReceiveMessage = (callback) => {
  if (socketManager.socket) {
    console.log('[chatService] Unregistering receiveMessage listener');
    socketManager.socket.off('receiveMessage', callback);
  }
};