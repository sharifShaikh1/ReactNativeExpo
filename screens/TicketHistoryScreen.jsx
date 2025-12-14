import React, { useState, useCallback } from 'react';
import { SafeAreaView, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, Title, Paragraph, ActivityIndicator as PaperActivityIndicator } from 'react-native-paper';
import api from '../utils/api';
import TicketCard from '../components/TicketCard';

const TicketHistoryScreen = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const { data } = await api.get('/tickets/engineer/history');
      setHistory(data);
    } catch (error) {
      console.error("Failed to fetch ticket history:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchHistory();
    }, [fetchHistory])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  if (loading) {
    return (
      <Card style={styles.loadingContainer}>
        <PaperActivityIndicator size="large" />
        <Paragraph style={styles.loadingText}>Loading Ticket History...</Paragraph>
      </Card>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {history.length === 0 ? (
        <Card style={styles.emptyContainer}>
          <Title style={styles.emptyTitle}>No Completed Tickets</Title>
          <Paragraph style={styles.emptyText}>Your closed tickets will appear here.</Paragraph>
        </Card>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <TicketCard ticket={item} style={styles.ticketCardWrapper} />}
          contentContainerStyle={{ paddingVertical: 20, paddingHorizontal: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#6c757d',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 20,
    padding: 20,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#343a40',
  },
  emptyText: {
    marginTop: 5,
    color: '#6c757d',
  },
  ticketCardWrapper: {
    marginBottom: 10,
    elevation: 1,
  },
});

export default TicketHistoryScreen;
