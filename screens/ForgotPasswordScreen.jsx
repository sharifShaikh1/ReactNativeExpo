
// screens/ForgotPasswordScreen.jsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, SafeAreaView, ActivityIndicator } from 'react-native';
import api from '../utils/api';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async () => {
    if (!email) {
      return Alert.alert('Error', 'Please enter your email address.');
    }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      Alert.alert(
        'Check Your Email',
        'If an account with that email exists, a password reset link has been sent.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
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
        <Text className="text-4xl font-bold text-center text-white mb-2">Forgot Password</Text>
        <Text className="text-lg text-center text-gray-400 mb-10">Enter your email to reset your password</Text>

        <TextInput
          className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4 text-white text-base"
          placeholder="Email"
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TouchableOpacity
          className="bg-indigo-600 rounded-lg p-4"
          onPress={handleForgotPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white text-center text-lg font-bold">Send Reset Link</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center mt-8">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text className="text-indigo-400 font-bold">Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ForgotPasswordScreen;
