// config/apiConfig.js

// Define your possible backend IP addresses here
const locations = {
  LOCATION_A: '', 
  LOCATION_B: '', 
  LOCATION_C: '',

  Production: '',
};

// --- THIS IS THE ONLY LINE YOU NEED TO CHANGE WHEN YOU SWITCH NETWORKS ---
const CURRENT_LOCATION = 'LOCATION_C'; // Change this to your current location key

// --- No need to touch below this line ---
const devApiUrl = locations[CURRENT_LOCATION];
const prodApiUrl = ''; // For the future

// This automatically selects the correct URL based on whether you are in development or production

export const API_BASE_URL = __DEV__ ? devApiUrl : prodApiUrl;