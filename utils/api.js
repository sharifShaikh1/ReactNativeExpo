import axios from 'axios';
import Constant from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 60000,
});

let isRefreshing = false;
let failedQueue = [];
let currentAccessToken = null;
let currentRefreshToken = null;

// Function to set the refresh token from AuthContext
export const setApiRefreshToken = (token) => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('setApiRefreshToken:', token ? 'Token received' : 'Token cleared');
  currentRefreshToken = token;
};

export const setAuthToken = (token) => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('setAuthToken:', token ? 'Token received' : 'Token cleared');
  currentAccessToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[API] Authorization header set');
  } else {
    delete api.defaults.headers.common['Authorization'];
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[API] Authorization header cleared');
  }
};

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.request.use(async (config) => {
  // Get app key
  const appKey = Constant.expoConfig?.extra?.APP_KEY_MOBILE || 
                 Constant.expoConfig?.extra?.API_KEY_MOBILE ||
                 Constant.manifest?.extra?.APP_KEY_MOBILE || 
                 Constant.manifest?.extra?.API_KEY_MOBILE ||
                 Constant.manifest2?.extra?.user?.APP_KEY_MOBILE ||
                 process.env.EXPO_PUBLIC_APP_KEY_MOBILE;
  
  config.headers['x-app-key'] = appKey;

  // Add app metadata headers (version/release/release-channel/ownership)
  try {
    const appVersion = Constant.expoConfig?.version || Constant.manifest?.version || process.env.EXPO_PUBLIC_APP_VERSION;
    const releaseId = Constant.manifest?.revisionId || Constant.expoConfig?.extra?.EXPO_RELEASE_ID || process.env.EXPO_PUBLIC_RELEASE_ID;
    const appOwnership = Constant.appOwnership || 'expo';
    if (appVersion) config.headers['x-app-version'] = appVersion;
    if (releaseId) config.headers['x-release-id'] = releaseId;
    if (appOwnership) config.headers['x-app-ownership'] = appOwnership;
  } catch (e) {
    // ignore
  }

  // Attach a per-device identifier if available
  try {
    const deviceId = await SecureStore.getItemAsync('deviceId');
    if (deviceId) config.headers['x-device-id'] = deviceId;
  } catch (e) {
    // ignore SecureStore errors
  }

  // Ensure public auth routes don't get proxied; everything else should be
  // forwarded to the server proxy so the server can sign internal requests.
  const PUBLIC_AUTH_PATHS = [
    '/auth/login',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/request-password-reset',
    '/auth/refresh-token',
    '/auth/reset-password',
  ];

  try {
    const reqPath = config.url || '';
    const isPublicAuth = PUBLIC_AUTH_PATHS.some(p => reqPath.startsWith(p));
    // If not a public auth path and the path starts with '/', proxy via /api/proxy/api<path>
    if (!isPublicAuth && reqPath.startsWith('/')) {
      // Rewrite '/tickets/..' to '/api/proxy/api/tickets/..' so backend's proxy
      // will sign the forwarded request using the server HMAC secret.
      if (!reqPath.startsWith('/proxy/api') && !reqPath.startsWith('/api/proxy')) {
        config.url = `/proxy/api${reqPath}`; // baseURL contains /api already -> final /api/proxy/api/...
      }
    }
  } catch (e) { /* ignore rewrite errors */ }

  // Use current access token stored in memory (most up-to-date)
  if (currentAccessToken) {
    config.headers['Authorization'] = `Bearer ${currentAccessToken}`;
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[API Request] Using current access token');
  } else {
    // Fallback: try to get from axios default headers
    const headerToken = api.defaults.headers.common['Authorization']?.split(' ')[1];
    if (headerToken) {
      config.headers['Authorization'] = `Bearer ${headerToken}`;
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[API Request] Using fallback token from headers');
    }
  }
  
  // Lightweight request logging for debugging upload issues
  try {
    const safeHeaders = { ...config.headers };
    if (safeHeaders.Authorization) safeHeaders.Authorization = 'Bearer [REDACTED]';
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[API DEBUG] Request:', { method: config.method, url: config.url, headers: safeHeaders, timeout: config.timeout });
  } catch (e) {}

  return config;
}, (error) => {
  return Promise.reject(error);
});

// Global response logger to help debug uploads
api.interceptors.response.use(
  (response) => {
    try {
      const url = response.config && response.config.url;
      // Log responses for invoice endpoints more verbosely (dev-only)
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        if (url && url.includes('/invoice')) {
          console.debug('[API DEBUG] Response for', url, { status: response.status, data: response.data });
        } else {
          console.debug('[API DEBUG] Response:', { url, status: response.status });
        }
      }
    } catch (e) {}
    return response;
  },
  (error) => {
    try {
      const cfg = error.config || {};
      const url = cfg.url;
      console.error('[API DEBUG] Response error for', url, { message: error.message, status: error.response?.status, data: error.response?.data });
    } catch (e) {}
    return Promise.reject(error);
  }
);

// Response Interceptor: Handles expired access tokens and refreshes them
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 (Unauthorized) and not a retry already
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[API] 401 Unauthorized - Attempting token refresh');
      originalRequest._retry = true;

      if (isRefreshing) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[API] Token refresh already in progress, queuing request');
        // If a token refresh is already in progress, queue the original request
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
        .then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return api(originalRequest);
        })
        .catch(err => {
          return Promise.reject(err);
        });
      }

      // If no refresh in progress, start one
      isRefreshing = true;
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[API] Starting token refresh...');

      try {
        const refreshToken = currentRefreshToken;
        if (!refreshToken) {
          console.error('[API] No refresh token available');
          throw new Error('No refresh token available. Please log in.');
        }

        if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[API] Refresh token found, calling refresh endpoint');

        // Create a separate axios instance for refresh token call to avoid interceptors
        const refreshApi = axios.create({
          baseURL: `${API_BASE_URL}/api`,
          timeout: 30000,
        });

        // Add HMAC signature for refresh token request
        const appKey = Constant.expoConfig?.extra?.APP_KEY_MOBILE || 
                       Constant.expoConfig?.extra?.API_KEY_MOBILE;
        
        const refreshBody = { refreshToken };
        // Attach deviceId to refresh body if available so backend can bind refresh tokens to device
        try {
          const deviceId = await SecureStore.getItemAsync('deviceId');
          if (deviceId) refreshBody.deviceId = deviceId;
        } catch (e) { /* ignore */ }
        const res = await refreshApi.post('/auth/refresh-token', refreshBody, {
          headers: {
            'x-app-key': appKey,
            // Also include device id header if available
            ...(await (async () => { try { const d = await SecureStore.getItemAsync('deviceId'); return d ? { 'x-device-id': d } : {}; } catch(e){ return {}; } })()),
          }
        });

        const { token: accessToken, refreshToken: newRefreshToken } = res.data;
        if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[API] Token refresh successful, updating tokens');

        // Store new tokens securely
        await SecureStore.setItemAsync('token', accessToken);
        await SecureStore.setItemAsync('refreshToken', newRefreshToken);

        // Update in-memory tokens FIRST
        currentAccessToken = accessToken;
        currentRefreshToken = newRefreshToken;
        
        // Then update axios headers
        setAuthToken(accessToken);
        setApiRefreshToken(newRefreshToken);

        if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[API] New tokens set in memory and axios headers');

        // Process all queued requests with the new access token
        processQueue(null, accessToken);

        // Retry the original failed request
        originalRequest.headers['Authorization'] = 'Bearer ' + accessToken;
        return api(originalRequest);

      } catch (refreshError) {
        console.error('[API] Token refresh failed:', refreshError.message);

        // Invalidate tokens and redirect to login if refresh fails
  // Remove secure tokens and stored user/profile
  await SecureStore.deleteItemAsync('token');
  await SecureStore.deleteItemAsync('refreshToken');
  await SecureStore.deleteItemAsync('user');
  await SecureStore.deleteItemAsync('activeTicketId');
  // Clean up legacy AsyncStorage keys if present
  try { await AsyncStorage.removeItem('userToken'); } catch (e) { /* ignore */ }
        
        // Clear in-memory tokens
        currentAccessToken = null;
        currentRefreshToken = null;
        
        // Clear axios headers
        setAuthToken(null);
        setApiRefreshToken(null);

        if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[API] Tokens cleared due to refresh failure');

        // Process the queue, rejecting all promises
        processQueue(refreshError);

        // Re-throw the original error after handling refresh failure
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    // For any other error, just re-throw it
    return Promise.reject(error);
  }
);

export default api;
