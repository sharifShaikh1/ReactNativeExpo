import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, SafeAreaView, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import PendingAssignmentCard from '../components/PendingAssignmentCard';
import api from '../utils/api';
import { showMessage } from 'react-native-flash-message';

const PendingAssignmentsScreen = ({ navigation }) => {
  const { dashboardData, fetchDashboardData } = useAuth() || {};
  const [items, setItems] = useState(dashboardData?.pendingAssignments || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Keep local items in sync with AuthContext dashboardData
    setItems(dashboardData?.pendingAssignments || []);
  }, [dashboardData?.pendingAssignments]);

  const loadFresh = useCallback(async () => {
    setLoading(true);
    try {
      // If auth context has a fetch helper, call it to refresh dashboard payload
      if (fetchDashboardData) await fetchDashboardData();
      // Fallback: fetch pending assignments directly
      const res = await api.get('/tickets/engineer/pending-assignments');
      if (res && res.data) setItems(res.data || []);
    } catch (e) {
      console.warn('Failed to load pending assignments', e?.message || e);
      showMessage({ message: 'Error', description: 'Failed to load pending assignments', type: 'danger' });
    } finally { setLoading(false); }
  }, [fetchDashboardData]);

  useEffect(() => { void loadFresh(); }, []);

  const handleAssignmentResponse = async (ticketId, response) => {
    try {
      const { data } = await api.put(`/tickets/engineer/respond-assignment/${ticketId}`, { response });
      showMessage({ message: 'Success', description: data.message, type: 'success' });
      await loadFresh();
    } catch (error) {
      showMessage({ message: 'Error', description: error.response?.data?.message || 'Could not respond to assignment.', type: 'danger' });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
      <View style={{ padding: 16, flex: 1 }}>
          <Text style={styles.title}>Accept Requests</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 24 }} />
        ) : (
          <ScrollView style={{ marginTop: 12 }}>
            {items && items.length > 0 ? items.map(t => (
              <PendingAssignmentCard
                key={t._id}
                ticket={t}
                onAccept={() => handleAssignmentResponse(t._id, 'accepted')}
                onReject={() => handleAssignmentResponse(t._id, 'rejected')}
              />
            )) : (
                  <View style={{ marginTop: 40 }}>
                    <Text style={{ textAlign: 'center', color: '#6B7280' }}>You have no accept requests right now.</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
};

export default PendingAssignmentsScreen;

const styles = StyleSheet.create({
  title: { fontWeight: '800', fontSize: 20 }
});
