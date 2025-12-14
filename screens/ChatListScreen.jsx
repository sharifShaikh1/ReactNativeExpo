import React, { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const ChatListScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/conversations');
      // Filter: only show ticket conversations that are Pending Payment (stay until paid)
      const pendingChats = res.data.filter(c => c.ticket && c.ticket.status === 'Pending Payment');
      setConversations(pendingChats);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchConversations();
    const unsub = navigation.addListener('focus', () => fetchConversations());
    return unsub;
  }, [navigation]);

  const renderItem = ({ item }) => {
    const ticket = item.ticket;
    const title = ticket ? `Ticket ${ticket.ticketId}` : 'Conversation';
    return (
      <TouchableOpacity
        onPress={() => {
          if (ticket) {
            navigation.navigate('TicketChat', { ticketId: ticket._id, chatTitle: title });
          }
        }}
        style={styles.row}
      >
        <MaterialCommunityIcons name="chat" size={20} color="#4F46E5" />
        <View style={styles.meta}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{ticket ? `Status: ${ticket.status}` : 'Direct chat'}</Text>
        </View>
        <Text style={styles.ts}>{item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleString() : ''}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) return (
    <SafeAreaView style={styles.container}><ActivityIndicator size="large" color="#4F46E5" /></SafeAreaView>
  );

  if (!conversations.length) return (
    <SafeAreaView style={styles.container}>
      <Text style={{ textAlign: 'center', marginTop: 40, color: '#666' }}>No pending chats (Pending Payment) at the moment.</Text>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={item => item._id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12 }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  meta: { marginLeft: 12, flex: 1 },
  title: { fontWeight: 'bold', fontSize: 16 },
  subtitle: { color: '#666', fontSize: 12, marginTop: 2 },
  ts: { color: '#999', fontSize: 11 }
});

export default ChatListScreen;
