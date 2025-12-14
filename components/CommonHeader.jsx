import React from 'react';
import { View, Text, TouchableOpacity, Platform, StatusBar, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const CommonHeader = ({ navigation, route }) => {
  const { user } = useAuth() || {};
  return (
    <View style={styles.headerWrap}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={styles.name}>{user?.fullName || 'Engineer'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'Dashboard', params: { screen: 'Chat' } })} style={{ marginRight: 16 }}>
            <Ionicons name="chatbox-outline" size={30} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'Dashboard', params: { screen: 'Profile' } })}>
            <Ionicons name="person-circle-outline" size={36} color="#333" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerWrap: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 34 : ((StatusBar.currentHeight || 24) + 8),
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    zIndex: 10,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
  }
});

export default CommonHeader;