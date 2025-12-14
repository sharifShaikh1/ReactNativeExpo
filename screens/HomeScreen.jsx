import React, { useState, useCallback, useEffect,useRef } from 'react';

import { View, Text, ScrollView, SafeAreaView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, StyleSheet, AppState, Platform, StatusBar } from 'react-native';

import { useFocusEffect } from '@react-navigation/native';

import * as Location from 'expo-location';

import * as TaskManager from 'expo-task-manager';

import api from '../utils/api';

import { LOCATION_CONFIG } from '../config/locationConfig';

import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { Ionicons } from '@expo/vector-icons';
import { Card, Title, Paragraph } from 'react-native-paper';

import ActiveTicketCard from '../components/ActiveTicketCard';
import HomeQuickStats from '../components/HomeQuickStats';
import HomeFeed from '../components/HomeFeed';
import NoticeDetailsModal from '../components/NoticeDetailsModal';
import { MaterialIcons } from '@expo/vector-icons';

import { LOCATION_TASK_NAME } from '../services/locationTask';
import { showMessage } from "react-native-flash-message";





const startBackgroundTracking = async (ticketId) => {

    const isTracking = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);

  const trackedTicketId = await SecureStore.getItemAsync('activeTicketId');



    if (isTracking && trackedTicketId === ticketId) {

        console.log(`Background tracking is already active for the correct ticket: ${ticketId}`);

        return;

    }



    if (isTracking) {

        console.log(`Switching tracked ticket from ${trackedTicketId} to ${ticketId}.`);

        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);

    }



    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

    if (foregroundStatus !== 'granted') {

        showMessage({
            message: "Permission Denied",
            description: "Location permission is required for active tickets.",
            type: "danger",
        });

        return;

    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

    if (backgroundStatus !== 'granted') {

        showMessage({
            message: "Permission Denied",
            description: "Background location permission is essential for tracking.",
            type: "danger",
        });

        return;

    }

  await SecureStore.setItemAsync('activeTicketId', ticketId);

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, LOCATION_CONFIG);

    console.log("✅ Background location tracking started with optimized config for ticket:", ticketId);

};



const stopBackgroundTracking = async () => {

    const isTracking = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);

    if (isTracking) {

        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);

  await SecureStore.deleteItemAsync('activeTicketId');

        console.log("Background location tracking has been stopped.");

    }

};



const HomeScreen = ({ navigation }) => {

    const { user, dashboardData, isDashboardLoading, fetchDashboardData } = useAuth() || {};
    const socket = useSocket();

    const [stats, setStats] = useState({ available: 0, pendingPayments: 0, totalEarned: 0, totalClosedTickets: 0 });

    const [historyData, setHistoryData] = useState([]);

    const [loading, setLoading] = useState(true);

    const [refreshing, setRefreshing] = useState(false);
    const [previewNotices, setPreviewNotices] = useState(false);
    const [selectedNotice, setSelectedNotice] = useState(null);

    

    // Fetch only the history data (dashboard data comes from AuthContext)
    const fetchHistoryData = useCallback(async () => {

        try {

            const historyRes = await api.get('/tickets/engineer/history');

            const historyArray = Array.isArray(historyRes.data) ? historyRes.data : [];

            setHistoryData(historyArray);

            

            // Calculate totalEarned and totalClosedTickets

            const totalEarned = historyArray.reduce((sum, ticket) => sum + (ticket.amount || 0), 0);

            const totalClosedTickets = historyArray.length;

            

            setStats(prevStats => ({

                ...prevStats,

                available: dashboardData?.stats?.available || 0,

                totalEarned: totalEarned,

                totalClosedTickets: totalClosedTickets,

            }));

        } catch (error) {

            console.error("Fetch History Data Error:", error);

            showMessage({

                message: "Error",

                description: 'Failed to fetch history data.',

                type: "danger",

            });

        }

    }, [dashboardData?.stats?.available]);

    

    const fetchData = useCallback(async () => {

        setLoading(true);

        try {

            // Fetch dashboard data from AuthContext (handles pending, active, available)

            await fetchDashboardData();

            

            // Fetch history separately

            await fetchHistoryData();

        } catch (error) {

            console.error("Fetch Data Error:", error);

            showMessage({

                message: "Error",

                description: 'Failed to fetch dashboard data.',

                type: "danger",

            });

        } finally {

            setLoading(false);

            setRefreshing(false);

        }

    }, [fetchDashboardData, fetchHistoryData]);



    useFocusEffect(

        useCallback(() => {

            void fetchData();

        }, [fetchData])

    );



    // This effect hook now handles all tracking logic.

    // It runs only when the `dashboardData.activeTicket` changes.

  useEffect(() => {
    if (!socket) return;
    const handler = (updated) => {
      try {
        // If this update is not for our company, ignore
        if (updated && updated.companyId && updated.companyId.toString() !== user?.companyId?.toString()) return;
        // Re-fetch dashboard when a targeted ticket update occurs so pending assignments are shown
        void fetchDashboardData();
      } catch (e) { console.warn('ticket_updated handler error in HomeScreen', e); }
    };
    socket.on('ticket_updated', handler);
      const noticeHandler = (payload) => {
        try {
          // re-fetch dashboard so the feed refreshes
          void fetchDashboardData();
        } catch (e) { console.warn('notice_created handler error', e); }
      };
      socket.on('notice_created', noticeHandler);
      return () => {
        socket.off('ticket_updated', handler);
        socket.off('notice_created', noticeHandler);
      };
  }, [socket, user?.companyId, fetchDashboardData]);

    useEffect(() => {
    const manageTracking = async () => {

      if (dashboardData?.activeTicket) {

        // Prefer model ticket id when available for logging/storage.
        const ticketIdentifier = dashboardData.activeTicket?.ticketId || dashboardData.activeTicket?._id;

        // Only attempt to start background tracking when the app is in the foreground.
        // Start it asynchronously so permission prompts or native startup do not
        // block the UI or make dashboard loads slow.
        if (AppState.currentState === 'active') {
          try {
            startBackgroundTracking(ticketIdentifier).catch(e => console.warn('startBackgroundTracking failed (ignored):', e.message || e));
          } catch (e) {
            console.warn('startBackgroundTracking scheduling failed (ignored):', e.message || e);
          }
        } else {
          console.log('App not active; deferring startBackgroundTracking for ticket', ticketIdentifier);
        }

      } else {

        try {
          await stopBackgroundTracking();
        } catch (e) {
          console.warn('stopBackgroundTracking failed:', e.message || e);
        }

      }

    };

    void manageTracking();

  }, [dashboardData?.activeTicket]);

    

    const onRefresh = () => {

        setRefreshing(true);

        fetchData();

    };



    const handleAssignmentResponse = async (ticketId, response) => {

        try {

            const { data } = await api.put(`/tickets/engineer/respond-assignment/${ticketId}`, { response });

            showMessage({
                message: "Success",
                description: data.message,
                type: "success",
            });

            if (response === 'accepted') {

                showMessage({
                    message: "Assignment Accepted",
                    description: "The ticket is now active.",
                    type: "info",
                });

            }

            void fetchData(); // Refresh all data

        } catch (error) {

            showMessage({
                message: "Error",
                description: error.response?.data?.message || 'Could not respond to assignment.',
                type: "danger",
            });

        }

    };

    

    // Build feed items and container style so we can control height for demo
    const feedItems = previewNotices || !(dashboardData?.notices && dashboardData.notices.length > 0)
      ? [
          { _id: 'demo1', title: 'Planned Maintenance', body: 'Scheduled maintenance: Nov 20, 10:00–14:00 IST. Some dashboards and ticket creation may be unavailable. Please plan assignments accordingly.', type: 'important', publishAt: '2025-11-20T02:00:00Z', companyName: 'NetCovet', authorName: 'Operations' },
          { _id: 'demo2', title: 'Payments processed on Nov 22', body: 'A batch payment will be processed for completed invoices on Nov 22. Check the Payments tab for details and expected settlement dates.', type: 'info', publishAt: '2025-11-17T08:00:00Z', companyName: null, authorName: 'Finance' },
          { _id: 'demo3', title: 'Urgent: K12 site shutdown', body: 'Emergency safety shutdown at Site K12. Do not enter the affected area. Follow instructions from the site supervisor and await further updates.', type: 'urgent', publishAt: '2025-11-17T12:30:00Z', companyName: 'NetCovet Field', authorName: 'Site Supervisor' }
        ]
      : (dashboardData?.notices || []);

    const ITEM_HEIGHT = 100; // tuned item height so the meta line is visible reliably
    // reduce container padding and add it to the calculated height so 3 items fit fully
    const ITEM_PADDING = 8; // top+bottom padding applied per container
    const feedContainerStyle = (previewNotices && feedItems.length <= 3)
      ? { height: (feedItems.length * ITEM_HEIGHT) + (2 * ITEM_PADDING), paddingTop: ITEM_PADDING, paddingBottom: ITEM_PADDING }
      : {};

    return (

        <SafeAreaView className="flex-1 bg-gray-100">

      <View style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 20 }}>
        {(loading || isDashboardLoading) && !refreshing ? (
          <ActivityIndicator size="large" color="#4F46E5" className="my-16" />
        ) : (
          <View style={{ flex: 1 }}>
            {Array.isArray(dashboardData?.pendingAssignments) && dashboardData.pendingAssignments.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <TouchableOpacity onPress={() => navigation.navigate('PendingAssignments')} style={{ padding: 12, borderRadius: 12, backgroundColor: '#fff', borderLeftWidth: 4, borderLeftColor: '#f97316' }}>
                  <Text style={{ fontWeight: '700', color: '#b45309' }}>You have {dashboardData.pendingAssignments.length} accept request{dashboardData.pendingAssignments.length > 1 ? 's' : ''} — tap to view</Text>
                </TouchableOpacity>
              </View>
            )}

            <HomeQuickStats
              stats={{
                available: dashboardData?.stats?.available,
                accepted: dashboardData?.stats?.accepted,
                active: dashboardData?.activeTicket ? true : false,
                completed: dashboardData?.stats?.completed,
              }}
            />


            {/* Notices heading fixed above the scrollable feed */}
            <View style={{ marginTop: 4, marginBottom: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.header}>Notices</Text>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => setPreviewNotices(p => !p)}>
                <MaterialIcons name={previewNotices ? 'visibility-off' : 'visibility'} size={18} color="#6B7280" />
                <Text style={{ marginLeft: 8, color: '#6B7280', fontSize: 12 }}>{previewNotices ? 'Preview ON' : 'Preview'}</Text>
              </TouchableOpacity>
            </View>

            {/* The ScrollView is now specifically for the feed, allowing it to scroll independently */}
            <ScrollView style={{ flex: 1, marginTop: 0 }}>
              <HomeFeed
                previewNotices={previewNotices}
                setPreviewNotices={setPreviewNotices}
                useFlatList={false} // Render inline to avoid nested VirtualizedList and make items visible
                hideHeader={true}
                containerStyle={feedContainerStyle}
                onItemPress={(item) => setSelectedNotice(item)}
                items={feedItems}
              />
            </ScrollView>

            <NoticeDetailsModal notice={selectedNotice} visible={!!selectedNotice} onClose={() => setSelectedNotice(null)} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};


export default HomeScreen;

const styles = StyleSheet.create({
  header: {
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 8,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  infoCard: {
    flex: 1,
    marginHorizontal: 5,
    elevation: 2,
    minWidth: 100, // Ensure a minimum width
  },
  infoCardContent: {
    alignItems: 'center',
    paddingVertical: 10, // Reduce vertical padding
    paddingHorizontal: 5, // Add horizontal padding
  },
  infoCardTitle: {
    fontSize: 14, // Reduce font size slightly
    fontWeight: 'bold',
    marginTop: 5, // Reduce margin top
    textAlign: 'center',
    flexWrap: 'nowrap', // Prevent text from wrapping
  },
});