import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider, useAuth } from './context/AuthContext'; // Import the provider and hook
import { SocketProvider } from './context/SocketContext'; // Import the SocketProvider
import { Linking, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler'; // Import GestureHandlerRootView
import DevDiagnostics from './components/DevDiagnostics';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import AppNavigator from './navigators/AppNavigator';
import { View, ActivityIndicator } from 'react-native';
import './services/locationTask';
// Global error handler & diagnostics: helps detect uncaught exceptions and JS thread stalls during development
if (typeof global !== 'undefined' && process.env.NODE_ENV !== 'production') {
  try {
    const originalHandler = ErrorUtils.getGlobalHandler && ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      console.error('[GLOBAL ERROR HANDLER] Uncaught JS error:', error, 'isFatal:', isFatal);
      if (originalHandler) originalHandler(error, isFatal);
    });
  } catch (e) { /* ignore */ }
}
import './global.css'
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';
import { PaperProvider, DefaultTheme } from 'react-native-paper';
import FlashMessage from "react-native-flash-message";

const Stack = createStackNavigator();

// This should match the EXPO_GO_URL in your backend .env file
const EXPO_GO_URL = '';

const linking = {
  prefixes: [`${EXPO_GO_URL}/--`],
  config: {
    screens: {
      ResetPassword: 'reset-password/:token',
    },
  },
};

// This component decides which navigator to show
const AppContent = () => {
  const { token, isLoading } = useAuth();

  // Show a loading spinner while checking for a saved session
  if (isLoading) {
    return (
      
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {token ? (
        // If a token exists, the user is logged in. Show the main app.
        <Stack.Screen name="AppNavigator" component={AppNavigator}  />
      ) : (
        // If no token, show the authentication screens.
        [
          <Stack.Screen key="Login" name="Login" component={LoginScreen} />,
          <Stack.Screen key="Register" name="Register" component={RegisterScreen} />,
          <Stack.Screen key="ForgotPassword" name="ForgotPassword" component={ForgotPasswordScreen} />,
          <Stack.Screen key="ResetPassword" name="ResetPassword" component={ResetPasswordScreen} />
        ]
      )}
    </Stack.Navigator>
  );
};


const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#4F46E5', // Indigo-600
    accent: '#10B981', // Green-500
    background: '#F3F4F6', // Gray-100
    surface: '#FFFFFF',
    text: '#1F2937', // Gray-800
    placeholder: '#6B7280', // Gray-500
    backdrop: 'rgba(0, 0, 0, 0.5)',
  },
  roundness: 8,
};

// The main App component now just sets up the providers
function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <SocketProvider>
          <PaperProvider theme={theme}>
            <NavigationContainer linking={linking} fallback={<Text>Loading...</Text>}>
              <AppContent />
            </NavigationContainer>
          </PaperProvider>
          <DevDiagnostics />
        </SocketProvider>
        <FlashMessage position="top" />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

export default App;