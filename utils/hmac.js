import Constant from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/apiConfig';

// Get HMAC secret from app config
// Request a server-side HMAC signature for the provided method/path/body.
// This avoids embedding the private HMAC secret in the client build.
export async function generateSignature(method, path, body = {}) {
  try {
    // Use device-stored access token to authenticate the signing request
    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      console.warn('[MOBILE HMAC] No access token available for server-side signing');
      return { signature: '', timestamp: Date.now().toString() };
    }

    const url = `${API_BASE_URL}/api/hmac/sign`;
    // Add x-app-key and device id headers so backend appKey middleware accepts the request
    const appKey = Constant.expoConfig?.extra?.APP_KEY_MOBILE ||
                   Constant.expoConfig?.extra?.API_KEY_MOBILE ||
                   Constant.manifest?.extra?.APP_KEY_MOBILE ||
                   Constant.manifest?.extra?.API_KEY_MOBILE ||
                   process.env.EXPO_PUBLIC_APP_KEY_MOBILE;

    const deviceId = await SecureStore.getItemAsync('deviceId');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(appKey ? { 'x-app-key': appKey } : {}),
        ...(deviceId ? { 'x-device-id': deviceId } : {}),
      },
      body: JSON.stringify({ method: (method || 'POST'), path, body: body || {} })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[MOBILE HMAC] Server signing failed:', res.status, text);
      return { signature: '', timestamp: Date.now().toString() };
    }

    const bodyJson = await res.json();
    return { signature: bodyJson.signature || '', timestamp: bodyJson.timestamp || Date.now().toString() };
  } catch (err) {
    console.warn('[MOBILE HMAC] Error requesting signature from server:', err?.message || err);
    return { signature: '', timestamp: Date.now().toString() };
  }
}
