
// screens/ResetPasswordScreen.jsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, SafeAreaView, ActivityIndicator } from 'react-native';
import api from '../utils/api';

const ResetPasswordScreen = ({ route, navigation }) => {
  const { token } = route.params;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      return Alert.alert('Error', 'Please enter and confirm your new password.');
    }
    if (password !== confirmPassword) {
      return Alert.alert('Error', 'Passwords do not match.');
    }
    setLoading(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password });
      Alert.alert(
        'Password Reset Successful',
        'You can now log in with your new password.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'An error occurred. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 justify-center px-6 bg-gray-900">
      <View>
        <Text className="text-4xl font-bold text-center text-white mb-2">Reset Password</Text>
        <Text className="text-lg text-center text-gray-400 mb-10">Enter your new password</Text>

        <TextInput
          className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4 text-white text-base"
          placeholder="New Password"
          placeholderTextColor="#9CA3AF"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4 text-white text-base"
          placeholder="Confirm New Password"
          placeholderTextColor="#9CA3AF"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <TouchableOpacity
          className="bg-indigo-600 rounded-lg p-4"
          onPress={handleResetPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white text-center text-lg font-bold">Reset Password</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ResetPasswordScreen;
