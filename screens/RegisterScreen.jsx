import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import api from '../utils/api';



const RegisterScreen = ({ navigation }) => {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [upiId, setUpiId] = useState('');
  const [aadhaarFile, setAadhaarFile] = useState(null);
  const [governmentIdFile, setGovernmentIdFile] = useState(null);
  const [addressProofFile, setAddressProofFile] = useState(null)
  const [profilePicture, setProfilePicture] = useState(null);
  const [expertise, setExpertise] = useState([]);
  const [serviceAreas, setServiceAreas] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);


  const validateStep1 = () => {
    if (!fullName || fullName.length < 2) return 'Full Name must be at least 2 characters';
    if (!phoneNumber.match(/^\d{10}$/)) return 'Phone Number must be 10 digits';
    if (!email.match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/)) return 'Invalid Email';
    if (!upiId.match(/^[a-zA-Z0-9.-]+@[a-zA-Z]+$/)) return 'Invalid UPI ID';
    if (!aadhaarFile) return 'Aadhaar file is required';
    if (!governmentIdFile) return ' Government ID  is required';
    if (!addressProofFile) return 'Address Proof is required';
    if (!profilePicture) return 'Profile Picture is required';
    if (expertise.length === 0) return 'Select at least one expertise';
    if (!serviceAreas) return 'Service Areas are required';
    return null;
  };

  const handleExpertiseChange = (value) => {
    setExpertise((prev) =>
      prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value]
    );
  };

  const pickDocument = async (setFile) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/png', 'image/jpeg', 'application/pdf'],
      });
      if (!result.canceled) {
        const asset = result.assets[0];
        const mimeType = asset.mimeType || (asset.name.endsWith('.pdf') ? 'application/pdf' : asset.name.endsWith('.png') ? 'image/png' : 'image/jpeg');
        setFile({ ...asset, mimeType });
        console.log(`Picked file: ${asset.name}, type: ${mimeType}`);
      } else {
        Alert.alert('Info', 'No file selected');
      }
    } catch (err) {
      Alert.alert('Error', `Failed to pick document: ${err.message}`);
      console.error('Document picker error:', err);
    }
  };

  const fileToBase64 = async (uri) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const mimeType = uri.endsWith('.pdf') ? 'application/pdf' : uri.endsWith('.png') ? 'image/png' : 'image/jpeg';
      return `data:${mimeType};base64,${base64}`;
    } catch (err) {
      throw new Error(`Failed to convert file to base64: ${err.message}`);
    }
  };

  const handleNext = () => {
    const error = validateStep1();
    if (error) {
      Alert.alert('Error', error);
      return;
    }
    setStep(2);
  };

  // In RegisterScreen.js

const handleRegister = async () => {
  if (!consent) {
    Alert.alert('Error', 'You must agree to the consent form');
    return;
  }

  setLoading(true);
  try {
  const aadhaarBase64 = await fileToBase64(aadhaarFile.uri);
  const governmentIdBase64 = await fileToBase64(governmentIdFile.uri);
  const addressProofBase64 = await fileToBase64(addressProofFile.uri);
  const profilePictureBase64 = await fileToBase64(profilePicture.uri);

    const data = {
      fullName,
      phoneNumber,
      email,
      upiId,
      expertise: expertise.join(','),
      serviceAreas,
      aadhaarFile: aadhaarBase64,
      governmentIdFile: governmentIdBase64,
      addressProofFile: addressProofBase64,
      profilePicture: profilePictureBase64
    };

    
    const resp = await api.post('/auth/register', data, { timeout: 15000 });
    const responseData = resp.data;
    setLoading(false);
    Alert.alert(
      'Registration Submitted!',
      `${responseData.message}\nYour Employee ID: ${responseData.employeeId}`,
      [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
    );

  } catch (err) {
    setLoading(false);
    // The catch block will now correctly handle only real errors.
    const errorMessage = err.message || 'An unknown error occurred';
    Alert.alert('Error', errorMessage);
    console.error('Registration error:', err);
  }
};

  const renderStepIndicator = () => (
    <View className="flex-row justify-center items-center mb-8 mt-4">
      <View className={`w-8 h-8 rounded-full items-center justify-center ${step >= 1 ? 'bg-blue-600' : 'bg-gray-700'}`}>
        <Text className="text-white font-bold">1</Text>
      </View>
      <View className={`w-12 h-1 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-700'}`} />
      <View className={`w-8 h-8 rounded-full items-center justify-center ${step >= 2 ? 'bg-blue-600' : 'bg-gray-700'}`}>
        <Text className="text-white font-bold">2</Text>
      </View>
    </View>
  );

  const renderInput = (placeholder, value, setValue, icon, keyboardType = 'default', maxLength = undefined, autoCapitalize = 'sentences') => (
    <View className="mb-4">
      <Text className="text-gray-400 text-xs mb-1 ml-1">{placeholder}</Text>
      <View className="flex-row items-center bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
        <Ionicons name={icon} size={20} color="#9CA3AF" style={{ marginRight: 10 }} />
        <TextInput
          className="flex-1 text-white text-base"
          placeholder={placeholder}
          placeholderTextColor="#6B7280"
          value={value}
          onChangeText={setValue}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
        />
      </View>
    </View>
  );

  const renderFileUpload = (label, file, setFile) => (
    <TouchableOpacity
      className={`mb-4 border border-dashed rounded-xl p-4 flex-row items-center justify-between ${file ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 bg-gray-800'}`}
      onPress={() => pickDocument(setFile)}
    >
      <View className="flex-row items-center flex-1">
        <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${file ? 'bg-blue-500' : 'bg-gray-700'}`}>
          <Ionicons name={file ? "checkmark" : "cloud-upload-outline"} size={20} color="white" />
        </View>
        <View className="flex-1">
          <Text className="text-white font-medium text-sm">{label}</Text>
          <Text className="text-gray-400 text-xs" numberOfLines={1}>
            {file ? file.name : 'Tap to upload'}
          </Text>
        </View>
      </View>
      {file && (
        <TouchableOpacity onPress={() => setFile(null)}>
          <Ionicons name="close-circle" size={20} color="#EF4444" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, backgroundColor: '#111827' }} showsVerticalScrollIndicator={false}>
      <View className="p-6">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mb-6 mt-2">
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        
        <Text className="text-3xl font-bold text-white mb-2">Create Account</Text>
        <Text className="text-gray-400 mb-6">Join our network of professional field engineers.</Text>

        {renderStepIndicator()}

        {step === 1 && (
          <View>
            {renderInput("Full Name", fullName, setFullName, "person-outline")}
            {renderInput("Phone Number", phoneNumber, setPhoneNumber, "call-outline", "numeric", 10)}
            {renderInput("Email Address", email, setEmail, "mail-outline", "email-address", undefined, "none")}
            {renderInput("UPI ID", upiId, setUpiId, "wallet-outline", "default", undefined, "none")}
            
            <Text className="text-white font-semibold text-lg mt-4 mb-3">Documents</Text>
            {renderFileUpload("Aadhaar Card", aadhaarFile, setAadhaarFile)}
            {renderFileUpload("Government ID", governmentIdFile, setGovernmentIdFile)}
            {renderFileUpload("Address Proof", addressProofFile, setAddressProofFile)}
            {renderFileUpload("Profile Picture", profilePicture, setProfilePicture)}

            <Text className="text-white font-semibold text-lg mt-4 mb-3">Expertise & Area</Text>
            <View className="flex-row flex-wrap mb-4 gap-2">
              {['Networking', 'CCTV'].map((item) => (
                <TouchableOpacity
                  key={item}
                  className={`flex-row items-center px-4 py-2 rounded-full border ${expertise.includes(item) ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-gray-600'}`}
                  onPress={() => handleExpertiseChange(item)}
                >
                  <Ionicons name={expertise.includes(item) ? "checkbox" : "square-outline"} size={16} color="white" style={{ marginRight: 6 }} />
                  <Text className="text-white font-medium">{item}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {renderInput("Service Areas (e.g. Mumbai, Thane)", serviceAreas, setServiceAreas, "map-outline")}

            <TouchableOpacity
              className="bg-blue-600 rounded-xl p-4 mt-4 shadow-lg shadow-blue-900/50"
              onPress={handleNext}
            >
              <View className="flex-row justify-center items-center">
                <Text className="text-white text-center text-lg font-bold mr-2">Continue</Text>
                <Ionicons name="arrow-forward" size={20} color="white" />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View>
            <View className="bg-gray-800 rounded-xl p-6 mb-6 border border-gray-700">
              <View className="items-center mb-4">
                <View className="w-16 h-16 bg-blue-500/20 rounded-full items-center justify-center mb-3">
                  <Ionicons name="shield-checkmark-outline" size={32} color="#3B82F6" />
                </View>
                <Text className="text-xl font-bold text-white">Terms & Consent</Text>
              </View>
              
              <Text className="text-gray-300 leading-6 mb-6 text-center">
                I agree that the company is not responsible for any physical harm during fieldwork. I consent to location tracking when accepting tickets to ensure site visits.
              </Text>
              
              <TouchableOpacity
                className={`flex-row items-center justify-center p-4 rounded-xl border ${consent ? 'bg-blue-600/20 border-blue-500' : 'bg-gray-700 border-gray-600'}`}
                onPress={() => setConsent(!consent)}
              >
                <Ionicons name={consent ? "checkbox" : "square-outline"} size={24} color={consent ? "#3B82F6" : "#9CA3AF"} />
                <Text className={`ml-3 font-semibold ${consent ? 'text-blue-400' : 'text-gray-400'}`}>I agree to the terms</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              className={`rounded-xl p-4 shadow-lg ${consent ? 'bg-blue-600 shadow-blue-900/50' : 'bg-gray-700'}`}
              onPress={handleRegister}
              disabled={!consent || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View className="flex-row justify-center items-center">
                  <Text className="text-white text-center text-lg font-bold mr-2">Complete Registration</Text>
                  <Ionicons name="checkmark-circle-outline" size={24} color="white" />
                </View>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="mt-4 p-4"
              onPress={() => setStep(1)}
            >
              <Text className="text-gray-400 text-center">Back to Step 1</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View className="mt-8 flex-row justify-center">
          <Text className="text-gray-400">Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text className="text-blue-400 font-bold">Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

export default RegisterScreen;