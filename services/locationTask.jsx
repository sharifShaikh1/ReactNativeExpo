import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Constant from 'expo-constants';
import api from '../utils/api';
import socketManager from './socketManager';
import {
  LOCATION_CONFIG,
  LOCATION_FILTER_CONFIG,
  isValidLocation,
  calculateDistance,
  weightedAverageLocations,
} from '../config/locationConfig';

export const LOCATION_TASK_NAME = 'background-location-task';

// Track last valid location for filtering
let lastValidLocation = null;

// Smoothing buffer: accumulate readings before sending
let locationBuffer = [];
let lastSentLocation = null;
let bufferCheckTimeout = null;

const stopBackgroundTracking = async () => {
  const isTracking = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (isTracking) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    try { await SecureStore.deleteItemAsync('activeTicketId'); } catch (e) { /* ignore */ }
    try { socketManager.disconnect(); } catch (e) { /* ignore */ }
  }
};

export const startLocationTracking = async (ticketId) => {
  const { granted } = await Location.getForegroundPermissionsAsync();
  if (!granted) {
    return;
  }

  const { granted: backgroundGranted } = await Location.getBackgroundPermissionsAsync();
  if (!backgroundGranted) {
    return;
  }

  const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (isTaskRunning) {
    return;
  }

  await SecureStore.setItemAsync('activeTicketId', ticketId);

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, LOCATION_CONFIG);
};

export const stopLocationTracking = async () => {
  await stopBackgroundTracking();
};

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('❌ Background location task error:', error.message);
    return;
  }

  if (!data?.locations?.length) {
    console.warn('⚠️ No location data received');
    return;
  }

  const location = data.locations[0];
  const { latitude, longitude, accuracy } = location.coords;
  const accuracyLabel = typeof accuracy === 'number' ? `${Math.round(accuracy)}m` : 'unknown';

  // Filter location for validity (accuracy, movement, etc.)
  const currentLocationData = {
    latitude,
    longitude,
    accuracy,
    timestamp: location.timestamp,
  };

  if (!isValidLocation(currentLocationData, lastValidLocation)) {
    console.log(
      `📍 Filtered out location update (accuracy=${accuracyLabel}). Last valid: ${
        lastValidLocation
          ? `${Math.round(lastValidLocation.latitude * 10000) / 10000}, accuracy=${lastValidLocation.accuracy}m`
          : 'none'
      }`
    );
    return;
  }

  lastValidLocation = currentLocationData;

  // Add to smoothing buffer
  locationBuffer.push(currentLocationData);
  console.log(`📊 Added to buffer (size: ${locationBuffer.length}/${LOCATION_FILTER_CONFIG.smoothingBufferSize}, accuracy=${accuracyLabel})`);

  // If buffer is full or accuracy is excellent, process immediately
  const isBufferFull = locationBuffer.length >= LOCATION_FILTER_CONFIG.smoothingBufferSize;
  const isExcellentAccuracy = accuracy <= LOCATION_FILTER_CONFIG.stableAccuracyThreshold;

  if (!isBufferFull && !isExcellentAccuracy) {
    console.log(`⏳ Buffering... (need ${LOCATION_FILTER_CONFIG.smoothingBufferSize} readings or better accuracy)`);
    return; // Wait for more readings
  }

  // Process buffer: average readings to reduce noise
  const smoothedLocation = weightedAverageLocations(locationBuffer);
  console.log(`✨ Smoothed location (${locationBuffer.length} readings): lat=${smoothedLocation.latitude.toFixed(6)}, lon=${smoothedLocation.longitude.toFixed(6)}, accuracy=${smoothedLocation.accuracy}m`);

  // Check if moved far enough to warrant sending
  if (lastSentLocation) {
    const movementDistance = calculateDistance(
      lastSentLocation.latitude,
      lastSentLocation.longitude,
      smoothedLocation.latitude,
      smoothedLocation.longitude
    );

    if (movementDistance < LOCATION_FILTER_CONFIG.minMovementThreshold) {
      console.log(`⏭️ Movement only ${Math.round(movementDistance)}m (need ${LOCATION_FILTER_CONFIG.minMovementThreshold}m), skipping send`);
      locationBuffer = []; // Clear buffer but don't send
      return;
    }
  }

  // Clear buffer for next batch
  locationBuffer = [];

  try {
    const activeTicketId = await SecureStore.getItemAsync('activeTicketId');
    if (!activeTicketId) {
      console.warn('⚠️ No activeTicketId in SecureStore, stopping task.');
      await stopBackgroundTracking();
      return;
    }

    let ticketIdentifier = activeTicketId;
    const objectIdLike = typeof activeTicketId === 'string' && /^[0-9a-fA-F]{24}$/.test(activeTicketId);

    if (objectIdLike) {
      const lastAttemptRaw = await SecureStore.getItemAsync('activeTicketId_lastMapping');
      const lastAttemptTs = lastAttemptRaw ? parseInt(lastAttemptRaw, 10) : 0;
      const oneHour = 1000 * 60 * 60;
      if (!lastAttemptTs || (Date.now() - lastAttemptTs) >= oneHour) {
        try {
          let tokenForLookup = null;
          try { tokenForLookup = await SecureStore.getItemAsync('token'); } catch (e) { tokenForLookup = null; }
          if (!tokenForLookup) {
            try { tokenForLookup = await AsyncStorage.getItem('userToken'); } catch (e) { tokenForLookup = null; }
          }

          if (tokenForLookup) {
            const apiPath = `/tickets/ticket/${activeTicketId}`;
            try {
              const appKey = Constant.expoConfig?.extra?.APP_KEY_MOBILE || process.env.EXPO_PUBLIC_APP_KEY_MOBILE;
              if (!appKey) {
                console.warn('No APP_KEY available in runtime; skipping legacy ticket mapping to avoid backend rejects.');
              } else {
                const resp = await api.get(apiPath, {
                  headers: { Authorization: `Bearer ${tokenForLookup}` },
                  timeout: 3000,
                });
                if (resp && resp.data && resp.data.ticketId) {
                  ticketIdentifier = resp.data.ticketId;
                  try { await SecureStore.setItemAsync('activeTicketId', ticketIdentifier); } catch (e) { /* ignore */ }
                  console.log(`Mapped legacy ObjectId ${activeTicketId} -> ticketId ${ticketIdentifier} and updated SecureStore.`);
                }
              }
            } catch (e) {
              console.warn('Ticket lookup failed or timed out (axios):', e?.message || e);
            }
          }
        } catch (e) {
          console.warn('Could not map activeTicketId to ticketId:', e.message || e);
        } finally {
          try { await SecureStore.setItemAsync('activeTicketId_lastMapping', Date.now().toString()); } catch (er) { /* ignore */ }
        }
      }
    }

    console.log(`🎯 Attempting location update for ticket ${ticketIdentifier} (smoothed accuracy=${smoothedLocation.accuracy}m, socketConnected=${!!(socketManager.socket && socketManager.socket.connected)})`);

    // Ensure we have a token
    let token = null;
    try { token = await SecureStore.getItemAsync('token'); } catch (e) { token = null; }
    if (!token) {
      try { token = await AsyncStorage.getItem('userToken'); } catch (e) { token = null; }
    }
    if (!token) {
      console.log('No token, stopping tracking');
      await stopBackgroundTracking();
      return;
    }

    // Emit smoothed location via socketManager (it will queue if disconnected)
    try {
      const emitted = socketManager.emit('send_location', {
        ticketId: ticketIdentifier,
        location: { 
          latitude: smoothedLocation.latitude,
          longitude: smoothedLocation.longitude,
          accuracy: smoothedLocation.accuracy 
        },
      }, token);
      if (emitted) {
        lastSentLocation = smoothedLocation; // Track sent location
        console.log(`🚀 Sent smoothed location update for ticket ${ticketIdentifier}`);
      }
      else console.log(`🔁 Queued smoothed location update for ticket ${ticketIdentifier}`);
    } catch (e) {
      console.warn('Failed to emit location via socketManager:', e?.message || e);
    }

  } catch (err) {
    console.error('❌ Failed to process location update:', err?.message || err);
  }
});

