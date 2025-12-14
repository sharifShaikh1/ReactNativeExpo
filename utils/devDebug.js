import api from './api';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';

// Send masked token (default) — safe for non-admin troubleshooting
export async function logCurrentUserMasked(user) {
  try {
    const token = await SecureStore.getItemAsync('token');
    const body = { userId: user?._id || user?.id, token };
    // Use API proxy (server signs and forwards) — no client-side signature
    await api.post('/debug/log-token', body);

    console.log('[DEV DEBUG] Sent masked token to backend for user', user?._id || user?.id, ' — masked on server.');
    Alert.alert('Dev Debug', 'Masked token sent to server logs.');
  } catch (e) {
    console.error('[DEV DEBUG] failed to send masked token:', e?.message || e);
    Alert.alert('Dev Debug Error', String(e?.message || e));
  }
}

// Send full (raw) token - requires server env and Admin permissions, use sparingly
export async function logCurrentUserRaw(user) {
  try {
    const token = await SecureStore.getItemAsync('token');
    const body = { userId: user?._id || user?.id, token };
    await api.post('/debug/log-token-raw', body);

    console.log('[DEV DEBUG] Sent RAW token to backend for user', user?._id || user?.id, ' — check server logs');
    Alert.alert('Dev Debug', 'RAW token sent to server logs (admin only).');
  } catch (e) {
    console.error('[DEV DEBUG] failed to send raw token:', e?.message || e);
    Alert.alert('Dev Debug Error', String(e?.message || e));
  }
}
