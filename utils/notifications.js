import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  let expoPushToken;
  let devicePushToken;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    
    // Learn more about projectId:
    // https://docs.expo.dev/push-notifications/push-notifications-setup/#configure-projectid
    // You might need to set projectId in app.json if not using EAS
    try {
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      if (!projectId) {
         console.log('Project ID not found, trying to get Expo push token without it');
      }
      expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log('Expo Push Token:', expoPushToken);
    } catch (e) {
      console.error('Error getting Expo push token:', e);
    }

    try {
      const deviceTokenResponse = await Notifications.getDevicePushTokenAsync();
      devicePushToken = deviceTokenResponse?.data;
      console.log('Device push token (FCM/APNS):', deviceTokenResponse);
    } catch (e) {
      console.error('Error getting device push token:', e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

    return { expoPushToken, devicePushToken };
}

export const updatePushToken = async () => {
    try {
      const { expoPushToken, devicePushToken } = await registerForPushNotificationsAsync();
      if (expoPushToken || devicePushToken) {
        await api.post('/users/push-token', { pushToken: expoPushToken, fcmToken: devicePushToken });
        console.log('Push token(s) updated on server');
      } else {
        console.log('No push tokens available to send');
      }
    } catch (error) {
        console.error('Error updating push token on server:', error);
    }
};
