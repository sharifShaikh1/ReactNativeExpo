import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store'; // <--- ADD THIS
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import api, { setAuthToken, setApiRefreshToken } from '../utils/api';
import { LOCATION_TASK_NAME } from '../services/locationTask';
import { LOCATION_CONFIG } from '../config/locationConfig';
import { Alert, AppState } from 'react-native'; // <--- ADD THIS for Alerts if needed in startBackgroundTracking
import { updatePushToken } from '../utils/notifications';

const AuthContext = createContext();

// Helper function to stop the background task
export const stopBackgroundTracking = async () => {
    const isTracking = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (isTracking) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    await SecureStore.deleteItemAsync('activeTicketId'); // Move activeTicketId to SecureStore
        if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug("Background location tracking has been stopped.");
    }
};


export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // NEW: Central state for all dashboard data
const [dashboardData, setDashboardData] = useState({
    pendingAssignments: [],
    activeTicket: null,
    stats: { available: 0 },
    notices: [],
  });

  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [pendingTrackingTicketId, setPendingTrackingTicketId] = useState(null);

 
  const fetchUser = useCallback(async () => {
    if (!token) return;
    try {
      const response = await api.get('/auth/me');
      const updatedUser = response.data;
      setUser(updatedUser);
  // Persist user profile securely
  await SecureStore.setItemAsync('user', JSON.stringify(updatedUser));
    } catch (error) {
      console.error("Failed to fetch user data in AuthContext:", error);
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        console.warn("Authentication failed during user fetch, logging out.");
        await logout();
      }
    }
  }, [token]);

  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      if (nextAppState === 'active' && pendingTrackingTicketId) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('App became active, attempting to start deferred tracking.');
        await startBackgroundTracking(pendingTrackingTicketId);
        setPendingTrackingTicketId(null); 
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [pendingTrackingTicketId]);



  // NEW: Central function to fetch all dashboard data
  const fetchDashboardData = useCallback(async () => {
if (!token) return; // Don't fetch if not logged in
setIsDashboardLoading(true);
const overallStart = Date.now();
    try {
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[fetchDashboardData] Starting dashboard data fetch');
        
      const [pendingRes, activeRes, availableRes] = await Promise.all([
        api.get('/tickets/engineer/pending-assignments'),
        api.get('/tickets/engineer/active-ticket'),
        api.get('/tickets/engineer/available'),
      ]);

      // Additional engineer-level counts: accepted and completed
      let acceptedRes = { data: [] };
      let historyRes = { data: [] };
      try {
        acceptedRes = await api.get('/tickets/engineer/accepted');
      } catch (e) { console.warn('[fetchDashboardData] Failed to load accepted tickets:', e?.message); }
      try {
        historyRes = await api.get('/tickets/engineer/history');
      } catch (e) { console.warn('[fetchDashboardData] Failed to load history:', e?.message); }

      // Notices
      let noticesRes = { data: { notices: [] } };
      try {
        noticesRes = await api.get('/notices?limit=3');
      } catch (e) { console.warn('[fetchDashboardData] Failed to load notices:', e?.message); }

      if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[fetchDashboardData] All requests completed');

      // Always replace activeTicket with the server result (may be null).
      // Previously we fell back to the old value when server returned null,
      // causing stale activeTicket state to persist after release.
      const newActiveTicket = activeRes?.data === undefined ? dashboardData.activeTicket : activeRes?.data || null;

      if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[fetchDashboardData] pending assignments received:', pendingRes?.data?.length || 0);
      setDashboardData({
        pendingAssignments: pendingRes?.data || [],
        activeTicket: newActiveTicket,
        stats: { available: availableRes?.data?.length || (dashboardData.stats?.available || 0), accepted: (acceptedRes?.data || []).length || 0, completed: (historyRes?.data || []).length || 0 },
        notices: noticesRes?.data?.notices || []
      });



    // Manage background tracking based on fetched data

    if (newActiveTicket) {
      // Prefer the model's ticket identifier (ticketId) but fall back to _id.
      const ticketIdentifier = newActiveTicket.ticketId || newActiveTicket._id;

      const isTracking = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);

      if (!isTracking) { // Only start if not already tracking

        if (AppState.currentState === 'active') {
          // Start background tracking but do not await it — permission
          // prompts and startLocationUpdatesAsync can be slow and should
          // not block the dashboard fetch. Handle errors quietly.
          startBackgroundTracking(ticketIdentifier).catch(e => console.warn('startBackgroundTracking (deferred) failed:', e?.message || e));
        } else {
          if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('App is in background, deferring location tracking start.');
          setPendingTrackingTicketId(ticketIdentifier);
        }

      }

    } else {

      await stopBackgroundTracking();

    }

    } catch (error) {
        console.error("Failed to fetch dashboard data in AuthContext:", error?.message || error);
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          console.warn("Authentication failed during dashboard data fetch, logging out.");
          await logout();
        }
    } finally {
        const overallDuration = Date.now() - overallStart;
        if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug(`[fetchDashboardData] Overall duration: ${overallDuration}ms`);
        setIsDashboardLoading(false);
    }
  }, [token]);

  // Ensure a persistent deviceId exists for this installation. Used to bind refresh tokens to device.
  const ensureDeviceId = useCallback(async () => {
    try {
      const existing = await SecureStore.getItemAsync('deviceId');
      if (!existing) {
        // Simple unique id: timestamp + random. Not cryptographically perfect but sufficient as a device identifier.
        const newId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        await SecureStore.setItemAsync('deviceId', newId);
        if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[AuthContext] Generated new deviceId');
        return newId;
      }
      return existing;
    } catch (e) {
      console.warn('[AuthContext] Failed to read/create deviceId', e);
      return null;
    }
  }, []);



  // NEW: Central function to start background tracking

  const startBackgroundTracking = async (ticketId) => {

    const hasStarted = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);

    if (hasStarted) {

        if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug("Attempted to start tracking, but it is already active.");

        return;

    }

    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

    if (foregroundStatus !== 'granted') {

        Alert.alert('Permission Denied', 'Foreground location permission is required.');

        return;

    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

    if (backgroundStatus !== 'granted') {

        Alert.alert('Permission Denied', 'Background location permission is essential.');

        return;

    }

  await SecureStore.setItemAsync('activeTicketId', ticketId);

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, LOCATION_CONFIG);

    if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug("✅ Background location tracking started with optimized config for ticket:", ticketId);

  };



  // Function to load user and token from secure storage

  const loadSession = useCallback(async () => {
    try {
      const storedAccessToken = await SecureStore.getItemAsync('token');
      const storedRefreshToken = await SecureStore.getItemAsync('refreshToken');
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('loadSession: tokens present:', !!storedAccessToken, !!storedRefreshToken);
    const storedUser = await SecureStore.getItemAsync('user');

      if (storedAccessToken && storedRefreshToken && storedUser) {
        const parsedUser = JSON.parse(storedUser);
       // console.log('AuthContext: Parsed user from SecureStore:', parsedUser);
        setAuthToken(storedAccessToken);
        setApiRefreshToken(storedRefreshToken); // Ensure api.js knows the refresh token
        setToken(storedAccessToken);
        setUser(parsedUser);
        updatePushToken();
      } else {
        // If any part is missing, ensure tokens are cleared in api.js
        setAuthToken(null);
        setApiRefreshToken(null);
      }
    } catch (error) {
      console.error('Failed to load user session from secure storage', error);
      setAuthToken(null);
      setApiRefreshToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);



  useEffect(() => {

    loadSession();

  }, [loadSession]);



  // When the token changes (i.e., on login), fetch the initial dashboard data

  useEffect(() => {

      if(token) {

          fetchDashboardData();

      }

  }, [token, fetchDashboardData]);



  const login = async (userData, accessToken, refreshToken) => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[AuthContext] Login called with new credentials');
    
    // CRITICAL: Clear old tokens from secure storage FIRST
    try {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('refreshToken');
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[AuthContext] Old tokens cleared from SecureStore');
    } catch (error) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[AuthContext] No old tokens to clear');
    }

    // Update state
    setUser(userData);
    setToken(accessToken);
    
    // CRITICAL: Set tokens in API immediately BEFORE storing
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[AuthContext] Setting new tokens in API module');
    setAuthToken(accessToken);
    setApiRefreshToken(refreshToken);
    
    // Store new tokens securely
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[AuthContext] Storing new tokens in SecureStore');
  // Persist user securely
  await SecureStore.setItemAsync('user', JSON.stringify(userData));
    await SecureStore.setItemAsync('token', accessToken);
    await SecureStore.setItemAsync('refreshToken', refreshToken);
    
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[AuthContext] Login complete - new tokens active');
    updatePushToken();
    };

  
  const logout = async () => {

    await stopBackgroundTracking(); // Stop tracking on logout

    setUser(null);

    setToken(null);

    setAuthToken(null); // Clear token from Axios headers
    setApiRefreshToken(null); // Clear refresh token from api.js
  // Clean up legacy AsyncStorage keys (if any)
  try { await AsyncStorage.removeItem('userToken'); } catch (e) { /* ignore */ }

  // Remove secure items
  await SecureStore.deleteItemAsync('token');
  await SecureStore.deleteItemAsync('refreshToken');
  await SecureStore.deleteItemAsync('user');
  await SecureStore.deleteItemAsync('activeTicketId');

  };



  return (

    <AuthContext.Provider value={{ user, token, isLoading, login, logout, fetchUser, dashboardData, isDashboardLoading, fetchDashboardData, startBackgroundTracking }}>

      {children}

    </AuthContext.Provider>

  );

};



export const useAuth = () => {

  return useContext(AuthContext);

};