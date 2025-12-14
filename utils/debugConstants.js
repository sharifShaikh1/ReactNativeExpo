import Constants from 'expo-constants';

export const debugConstants = () => {
  // Try to get APP_KEY_MOBILE from different locations and names
  const appKey1 = Constants.expoConfig?.extra?.APP_KEY_MOBILE;
  const appKey1Legacy = Constants.expoConfig?.extra?.API_KEY_MOBILE;
  const appKey2 = Constants.manifest?.extra?.APP_KEY_MOBILE;
  const appKey2Legacy = Constants.manifest?.extra?.API_KEY_MOBILE;
  const appKey3 = Constants.manifest2?.extra?.user?.APP_KEY_MOBILE;
  const appKeyEnv = process.env.EXPO_PUBLIC_APP_KEY_MOBILE;
  
  // Do not print application secrets to logs. Values are resolved below.
  
  const finalAppKey = appKey1 || appKey1Legacy || appKey2 || appKey2Legacy || appKey3 || appKeyEnv || null;
  // Never expose HMAC_SECRET from client-side debug helpers
  return { appKey: finalAppKey };
};