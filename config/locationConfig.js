import * as Location from 'expo-location';

/**
 * Optimized location tracking configuration
 * Balances accuracy (15-20m range) with battery consumption
 */

export const LOCATION_CONFIG = {
  // High accuracy for precise position tracking
  accuracy: Location.Accuracy.Highest,
  
  // Time interval: 5 seconds - more frequent updates reduce averaging error
  // This gives GPS more samples to lock onto true position
  timeInterval: 5000,
  
  // Distance interval: 5 meters - send update if moved 5m+
  // Prevents batching of noisy data; captures real movement
  distanceInterval: 5,
  
  // Deferred updates: 1 second - batch updates for efficiency
  deferredUpdatesInterval: 1000,
  
  // Enable background location indicator on iOS
  showsBackgroundLocationIndicator: true,
  
  // Foreground service notification for Android
  foregroundService: {
    notificationTitle: 'Net Covet TT Tracking Active',
    notificationBody: 'Your location is being tracked for the active ticket.',
    notificationColor: '#2196F3',
  },
};

/**
 * Location filtering configuration
 * Reduces fluctuations by filtering out outliers and smoothing
 */
export const LOCATION_FILTER_CONFIG = {
  // Maximum acceptable accuracy (meters)
  // Reject readings with accuracy worse than 35m (stricter to reduce noise)
  maxAccuracy: 20,
  
  // Minimum number of good samples before considering stable
  minSamples: 3,
  
  // Maximum distance jump (meters) to consider same location
  // If new reading is >50m from previous, it's likely a jump, not drift
  maxDistanceJump: 50,
  
  // Horizontal dilution of precision threshold
  // Only use readings with HDOP < 3 (excellent) or < 5 (good)
  maxHDOP: 5,
  
  // Smoothing buffer: number of readings to average
  // Higher = smoother but slower response (5 readings = ~25 seconds of data)
  smoothingBufferSize: 5,
  
  // Accuracy threshold for considering position "stable"
  // If accuracy is good (< stableAccuracyThreshold), send more frequently
  stableAccuracyThreshold: 20,
  
  // Minimum distance movement required to send update (meters)
  // Don't send if moved less than this (avoid sending identical positions)
  minMovementThreshold: 3,
};

/**
 * Helper function to calculate distance between two coordinates
 * Using Haversine formula
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
};

/**
 * Filter location based on accuracy and reasonable movement
 */
export const isValidLocation = (
  currentLocation,
  lastLocation,
  filterConfig = LOCATION_FILTER_CONFIG
) => {
  // Check accuracy threshold
  if (currentLocation.accuracy > filterConfig.maxAccuracy) {
    console.warn(
      `📍 Rejecting location: accuracy ${Math.round(currentLocation.accuracy)}m exceeds max ${filterConfig.maxAccuracy}m`
    );
    return false;
  }

  // If no previous location, accept (first reading)
  if (!lastLocation) {
    return true;
  }

  // Check for unreasonable jumps (likely GPS errors)
  const distance = calculateDistance(
    lastLocation.latitude,
    lastLocation.longitude,
    currentLocation.latitude,
    currentLocation.longitude
  );

  if (distance > filterConfig.maxDistanceJump) {
    console.warn(
      `📍 Rejecting location: jumped ${Math.round(distance)}m from previous position (likely GPS error)`
    );
    return false;
  }

  return true;
};

/**
 * Average multiple location readings to reduce fluctuation
 */
export const averageLocations = (locations) => {
  if (!locations || locations.length === 0) return null;
  if (locations.length === 1) return locations[0];

  const avgLat = locations.reduce((sum, loc) => sum + loc.latitude, 0) / locations.length;
  const avgLon = locations.reduce((sum, loc) => sum + loc.longitude, 0) / locations.length;
  const avgAccuracy = locations.reduce((sum, loc) => sum + loc.accuracy, 0) / locations.length;

  return {
    latitude: avgLat,
    longitude: avgLon,
    accuracy: Math.round(avgAccuracy),
    timestamp: locations[locations.length - 1].timestamp, // Use latest timestamp
  };
};

/**
 * Kalman-filter-like weighted averaging
 * Gives more weight to recent readings with better accuracy
 */
export const weightedAverageLocations = (locations) => {
  if (!locations || locations.length === 0) return null;
  if (locations.length === 1) return locations[0];

  // Weight = inverse of accuracy (lower accuracy = lower weight)
  // More recent readings get higher weight
  let totalWeight = 0;
  let weightedLat = 0;
  let weightedLon = 0;

  locations.forEach((loc, index) => {
    // Recency weight: exponential increase towards end (most recent = highest)
    const recencyWeight = Math.pow(1.5, index);
    // Accuracy weight: inverse (better accuracy = higher weight)
    const accuracyWeight = 100 / (loc.accuracy || 20);
    const weight = recencyWeight * accuracyWeight;
    
    totalWeight += weight;
    weightedLat += loc.latitude * weight;
    weightedLon += loc.longitude * weight;
  });

  return {
    latitude: weightedLat / totalWeight,
    longitude: weightedLon / totalWeight,
    accuracy: Math.round(Math.min(...locations.map(l => l.accuracy))), // Use best accuracy
    timestamp: locations[locations.length - 1].timestamp,
  };
};
