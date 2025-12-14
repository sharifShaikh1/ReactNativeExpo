import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import AvailableTicketsScreen from '../screens/AvailableTicketsScreen';
// TicketHistory accessible from Ticket tab 'Completed' — remove dedicated bottom nav entry
import ProfileScreen from '../screens/ProfileScreen';
import CertificatesScreen from '../screens/CertificatesScreen';
import CertificateDetailScreen from '../screens/CertificateDetailScreen';

import TicketChatScreen from '../screens/TicketChatScreen';
import ParticipantListScreen from '../screens/ParticipantListScreen';
import PaymentsScreen from '../screens/PaymentsScreen';
import ChatListScreen from '../screens/ChatListScreen';
import PendingAssignmentsScreen from '../screens/PendingAssignmentsScreen';

import MapScreen from '../screens/MapScreen';
import TicketScreen from '../screens/TicketScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const DashboardStack = createStackNavigator();
const TicketStack = createStackNavigator();

const DashboardStackScreen = () => (
  <DashboardStack.Navigator screenOptions={{ headerShown: false }}>
    <DashboardStack.Screen name="Home" component={HomeScreen} />
    <DashboardStack.Screen name="PendingAssignments" component={PendingAssignmentsScreen} />
    <DashboardStack.Screen name="Chat" component={ChatListScreen} />
    <DashboardStack.Screen name="TicketChat" component={TicketChatScreen} />
    <DashboardStack.Screen name="ParticipantList" component={ParticipantListScreen} />
    <DashboardStack.Screen name="Profile" component={ProfileScreen} />
  </DashboardStack.Navigator>
);

const TicketStackScreen = () => (
  <TicketStack.Navigator screenOptions={{ headerShown: false }}>
    <TicketStack.Screen name="TicketList" component={TicketScreen} />
  </TicketStack.Navigator>
);

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Dashboard') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Payments') iconName = focused ? 'card' : 'card-outline';
          else if (route.name === 'Ticket') iconName = focused ? 'pricetag' : 'pricetag-outline';
          // Tab bar does not include Profile anymore - Profile lives in the header
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
        tabBarStyle: { backgroundColor: '#FFFFFF', borderTopWidth: 0, elevation: 10, height: 60, paddingBottom: 5 },
        tabBarLabelStyle: { fontSize: 12 },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardStackScreen} />
      <Tab.Screen name="Payments" component={PaymentsScreen} />
      <Tab.Screen name="Ticket" component={TicketStackScreen} />
      {/* Profile is intentionally in the header and available via navigation.navigate('Profile') */}
    </Tab.Navigator>
  );
};

import CommonHeader from '../components/CommonHeader';

const AppNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ header: (props) => <CommonHeader {...props} /> }}>
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen name="Available" component={AvailableTicketsScreen} />
      <Stack.Screen name="Certificates" component={CertificatesScreen} />
      <Stack.Screen name="CertificateDetail" component={CertificateDetailScreen} />
      <Stack.Screen name="Payments" component={PaymentsScreen} />
      <Stack.Screen name="MapScreen" component={MapScreen} />
    </Stack.Navigator>
  );
};

export default AppNavigator;