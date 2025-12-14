import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, SafeAreaView, ScrollView, ActivityIndicator, TouchableOpacity, Linking, Alert, Modal, TextInput, RefreshControl, Image } from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import * as FileSystem from 'expo-file-system';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { usePreventScreenCapture } from 'expo-screen-capture';
import IdCard from '../components/IdCard';

// --- Sub-Components ---

const ProfileHeader = ({ profile }) => (
  <View className="items-center pt-2 pb-6 bg-white rounded-b-3xl shadow-sm mb-5">
    <View className="relative">
      <View className="w-28 h-28 bg-indigo-50 rounded-full items-center justify-center border-4 border-white shadow-sm">
        <Text className="text-4xl font-bold text-indigo-600">
          {profile.fullName?.charAt(0)?.toUpperCase() || 'U'}
        </Text>
      </View>
      <View className={`absolute bottom-0 right-0 w-6 h-6 rounded-full border-2 border-white ${profile.status === 'Active' ? 'bg-green-500' : 'bg-gray-400'}`} />
    </View>
    
    <Text className="text-2xl font-bold text-gray-900 mt-3">{profile.fullName}</Text>
    <Text className="text-sm text-gray-500 font-medium">{profile.role}</Text>
    
    {profile.employeeId && (
      <View className="mt-2 px-3 py-1 bg-gray-100 rounded-full">
        <Text className="text-xs text-gray-600 font-mono">ID: {profile.employeeId}</Text>
      </View>
    )}
  </View>
);

const SectionCard = ({ title, icon, children, action }) => (
  <View className="bg-white mx-4 mb-4 rounded-2xl p-5 shadow-sm">
    <View className="flex-row items-center justify-between mb-4">
      <View className="flex-row items-center">
        <View className="w-8 h-8 bg-indigo-50 rounded-lg items-center justify-center mr-3">
          <Ionicons name={icon} size={18} color="#4F46E5" />
        </View>
        <Text className="text-lg font-bold text-gray-800">{title}</Text>
      </View>
      {action}
    </View>
    <View className="space-y-4">
      {children}
    </View>
  </View>
);

const DetailRow = ({ label, value, icon, onEdit, isLast }) => (
  <View className={`flex-row items-start ${!isLast ? 'border-b border-gray-50 pb-3 mb-1' : ''}`}>
    <View className="mt-1 mr-3 w-5 items-center">
      <Ionicons name={icon} size={16} color="#9CA3AF" />
    </View>
    <View className="flex-1">
      <Text className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">{label}</Text>
      <Text className="text-base text-gray-800 font-medium leading-6">{value || 'Not provided'}</Text>
    </View>
    {onEdit && (
      <TouchableOpacity onPress={onEdit} className="p-2 -mr-2">
        <Text className="text-indigo-600 text-xs font-bold">EDIT</Text>
      </TouchableOpacity>
    )}
  </View>
);

const ActionButton = ({ title, subtitle, icon, onPress, color = "indigo" }) => (
  <TouchableOpacity 
    onPress={onPress}
    className="bg-white mx-4 mb-3 p-4 rounded-2xl shadow-sm flex-row items-center"
  >
    <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${color === 'red' ? 'bg-red-50' : 'bg-indigo-50'}`}>
      <Ionicons name={icon} size={24} color={color === 'red' ? '#EF4444' : '#4F46E5'} />
    </View>
    <View className="flex-1">
      <Text className={`text-base font-bold ${color === 'red' ? 'text-red-600' : 'text-gray-900'}`}>{title}</Text>
      {subtitle && <Text className="text-xs text-gray-500 mt-0.5">{subtitle}</Text>}
    </View>
    <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
  </TouchableOpacity>
);

const ProfileScreen = ({ navigation }) => {
  usePreventScreenCapture();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Modals state
  const [isUpiModalVisible, setUpiModalVisible] = useState(false);
  const [newUpiId, setNewUpiId] = useState('');
  const [isExpertiseModalVisible, setExpertiseModalVisible] = useState(false);
  const [expertiseSelection, setExpertiseSelection] = useState([]);
  const [isIdCardVisible, setIsIdCardVisible] = useState(false);
  const [isServiceAreaModalVisible, setServiceAreaModalVisible] = useState(false);
  const [serviceAreasInput, setServiceAreasInput] = useState('');

  const EXPERTISE_OPTIONS = ['Networking', 'CCTV', 'Access Control', 'Electrical', 'IT Support', 'Cabling'];

  const fetchProfile = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/auth/me');
      setProfile(response.data);
      setNewUpiId(response.data.upiId || '');
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile.');
      if (err.response?.status === 401) logout();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [logout]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  const handleUpdateUpiId = async () => {
    if (!newUpiId.trim()) return Alert.alert('Invalid Input', 'UPI ID cannot be empty.');
    if (!/^[a-zA-Z0-9.-]+@[a-zA-Z]+$/.test(newUpiId)) return Alert.alert('Invalid Format', 'Enter a valid UPI ID (e.g., name@bank).');

    try {
      const response = await api.put('/auth/me/upi', { upiId: newUpiId });
      Alert.alert('Success', response.data.message);
      setProfile(prev => ({ ...prev, upiId: newUpiId }));
      setUpiModalVisible(false);
    } catch (err) {
      Alert.alert('Update Failed', err.response?.data?.message || 'An error occurred.');
    }
  };

  const toggleExpertise = (value) => {
    setExpertiseSelection(prev => prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value]);
  };

  const handleSaveExpertise = async () => {
    try {
      const response = await api.put('/auth/me/expertise', { expertise: expertiseSelection });
      Alert.alert('Success', response.data.message);
      setProfile(prev => ({ ...prev, expertise: expertiseSelection }));
      setExpertiseModalVisible(false);
    } catch (err) {
      Alert.alert('Update Failed', err.response?.data?.message || 'An error occurred.');
    }
  };

  const openExpertiseModal = () => {
    setExpertiseSelection(Array.isArray(profile?.expertise) ? [...profile.expertise] : []);
    setExpertiseModalVisible(true);
  };

  const openServiceAreaModal = () => {
    setServiceAreasInput(Array.isArray(profile?.serviceAreas) ? profile.serviceAreas.join(', ') : '');
    setServiceAreaModalVisible(true);
  };

  const handleSaveServiceAreas = async () => {
    try {
      const areas = serviceAreasInput.split(',').map(item => item.trim()).filter(Boolean);
      const response = await api.put('/auth/me/service-areas', { serviceAreas: areas });
      Alert.alert('Success', response.data.message);
      setProfile(prev => ({ ...prev, serviceAreas: areas }));
      setServiceAreaModalVisible(false);
    } catch (err) {
      Alert.alert('Update Failed', err.response?.data?.message || 'An error occurred.');
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text className="text-gray-500 mt-4 font-medium">Loading profile...</Text>
      </SafeAreaView>
    );
  }

  if (error && !profile) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center p-6">
        <View className="w-16 h-16 bg-red-100 rounded-full items-center justify-center mb-4">
          <Ionicons name="alert" size={32} color="#EF4444" />
        </View>
        <Text className="text-gray-900 text-lg font-bold mb-2">Something went wrong</Text>
        <Text className="text-gray-500 text-center mb-6">{error}</Text>
        <TouchableOpacity onPress={fetchProfile} className="bg-indigo-600 px-6 py-3 rounded-xl">
          <Text className="text-white font-bold">Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4F46E5']} />}
      >
        <ProfileHeader profile={profile} />

        <SectionCard title="Contact Info" icon="person-outline">
          <DetailRow label="Email" value={profile.email} icon="mail-outline" />
          <DetailRow label="Phone" value={profile.phoneNumber} icon="call-outline" />
          <DetailRow 
            label="UPI ID" 
            value={profile.upiId} 
            icon="wallet-outline" 
            onEdit={() => setUpiModalVisible(true)} 
            isLast
          />
        </SectionCard>

        <SectionCard 
          title="Professional" 
          icon="briefcase-outline"
          action={
            <TouchableOpacity onPress={openExpertiseModal}>
              <Text className="text-indigo-600 text-xs font-bold">MANAGE</Text>
            </TouchableOpacity>
          }
        >
          <View className="flex-row flex-wrap gap-2">
            {profile.expertise?.length > 0 ? (
              profile.expertise.map((skill, idx) => (
                <View key={idx} className="bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                  <Text className="text-indigo-700 text-xs font-semibold">{skill}</Text>
                </View>
              ))
            ) : (
              <Text className="text-gray-400 italic">No expertise listed</Text>
            )}
          </View>
          
          <View className="mt-3 pt-3 border-t border-gray-50">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-xs text-gray-400 font-medium uppercase">Service Areas</Text>
              <TouchableOpacity onPress={openServiceAreaModal}>
                <Text className="text-indigo-600 text-xs font-bold">EDIT</Text>
              </TouchableOpacity>
            </View>
            {profile.serviceAreas?.length > 0 ? (
              <Text className="text-gray-800">{profile.serviceAreas.join(', ')}</Text>
            ) : (
              <Text className="text-gray-400 italic">No service areas listed</Text>
            )}
          </View>
        </SectionCard>

        <Text className="mx-6 mb-2 mt-2 text-xs font-bold text-gray-400 uppercase tracking-widest">Actions</Text>

        <ActionButton 
          title="Digital ID Card" 
          subtitle="View your official engineer ID"
          icon="id-card-outline" 
          onPress={() => setIsIdCardVisible(true)} 
        />

        <ActionButton 
          title="Certificates" 
          subtitle="Manage your qualifications"
          icon="ribbon-outline" 
          onPress={() => navigation.navigate('Certificates', { certificates: profile.certificates })} 
        />

        {profile.documents && (
          <SectionCard title="Documents" icon="document-text-outline">
            {['aadhaar', 'governmentId', 'addressProof'].map((docKey, idx, arr) => (
              profile.documents[docKey] ? (
                <TouchableOpacity 
                  key={docKey} 
                  onPress={() => Linking.openURL(profile.documents[docKey])}
                  className={`flex-row items-center justify-between py-3 ${idx !== arr.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <View className="flex-row items-center">
                    <Ionicons name="document-attach-outline" size={20} color="#6B7280" />
                    <Text className="ml-3 text-gray-700 capitalize">{docKey.replace(/([A-Z])/g, ' $1').trim()}</Text>
                  </View>
                  <Ionicons name="open-outline" size={18} color="#4F46E5" />
                </TouchableOpacity>
              ) : null
            ))}
          </SectionCard>
        )}

        <TouchableOpacity 
          onPress={logout}
          className="mx-4 mt-4 bg-red-50 p-4 rounded-2xl flex-row items-center justify-center border border-red-100"
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text className="ml-2 text-red-600 font-bold text-base">Log Out</Text>
        </TouchableOpacity>

        <Text className="text-center text-gray-400 text-xs mt-8 mb-4">App Version 1.0.0</Text>
      </ScrollView>

      {/* UPI Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isUpiModalVisible}
        onRequestClose={() => setUpiModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl">
            <Text className="text-xl font-bold text-gray-900 mb-2">Update UPI ID</Text>
            <Text className="text-gray-500 text-sm mb-6">Enter your UPI ID to receive payments directly.</Text>
            
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-base text-gray-900 mb-6"
              onChangeText={setNewUpiId}
              value={newUpiId}
              placeholder="e.g. username@bank"
              autoCapitalize="none"
              placeholderTextColor="#9CA3AF"
            />
            
            <View className="flex-row gap-3">
              <TouchableOpacity 
                className="flex-1 bg-gray-100 py-3.5 rounded-xl items-center"
                onPress={() => setUpiModalVisible(false)}
              >
                <Text className="text-gray-700 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className="flex-1 bg-indigo-600 py-3.5 rounded-xl items-center"
                onPress={handleUpdateUpiId}
              >
                <Text className="text-white font-bold">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Expertise Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isExpertiseModalVisible}
        onRequestClose={() => setExpertiseModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6 h-3/5">
            <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center mb-6" />
            <Text className="text-xl font-bold text-gray-900 mb-1">Select Expertise</Text>
            <Text className="text-gray-500 text-sm mb-6">Choose skills relevant to your field work.</Text>
            
            <ScrollView className="flex-1 mb-6">
              <View className="flex-row flex-wrap gap-3">
                {EXPERTISE_OPTIONS.map(opt => {
                  const isSelected = expertiseSelection.includes(opt);
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => toggleExpertise(opt)}
                      className={`px-4 py-3 rounded-xl border ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-200'}`}
                    >
                      <Text className={`font-semibold ${isSelected ? 'text-white' : 'text-gray-700'}`}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            
            <View className="flex-row gap-3">
              <TouchableOpacity 
                className="flex-1 bg-gray-100 py-4 rounded-xl items-center"
                onPress={() => setExpertiseModalVisible(false)}
              >
                <Text className="text-gray-700 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className="flex-1 bg-indigo-600 py-4 rounded-xl items-center"
                onPress={handleSaveExpertise}
              >
                <Text className="text-white font-bold">Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Service Areas Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isServiceAreaModalVisible}
        onRequestClose={() => setServiceAreaModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl">
            <Text className="text-xl font-bold text-gray-900 mb-2">Edit Service Areas</Text>
            <Text className="text-gray-500 text-sm mb-6">Enter areas where you provide service, separated by commas.</Text>
            
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-base text-gray-900 mb-6"
              onChangeText={setServiceAreasInput}
              value={serviceAreasInput}
              placeholder="e.g. New York, Brooklyn, Queens"
              autoCapitalize="words"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            
            <View className="flex-row gap-3">
              <TouchableOpacity 
                className="flex-1 bg-gray-100 py-3.5 rounded-xl items-center"
                onPress={() => setServiceAreaModalVisible(false)}
              >
                <Text className="text-gray-700 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className="flex-1 bg-indigo-600 py-3.5 rounded-xl items-center"
                onPress={handleSaveServiceAreas}
              >
                <Text className="text-white font-bold">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ID Card Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isIdCardVisible}
        onRequestClose={() => setIsIdCardVisible(false)}
      >
        <View className="flex-1 bg-black/80 justify-center items-center p-4">
          <TouchableOpacity 
            className="absolute top-12 right-6 z-10 bg-white/20 p-2 rounded-full"
            onPress={() => setIsIdCardVisible(false)}
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          <IdCard user={profile} />
        </View>
      </Modal>
    </View>
  );
};

export default ProfileScreen;


