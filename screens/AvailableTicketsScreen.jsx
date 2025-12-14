import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  SafeAreaView, 
  FlatList, 
  Alert, 
  ActivityIndicator, 
  RefreshControl,
  TextInput,
  TouchableOpacity,
  Dimensions,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../utils/api';
import TicketCard from '../components/TicketCard';
import { useAuth } from '../context/AuthContext';
import { startLocationTracking } from '../services/locationTask';
import { useSocket } from '../context/SocketContext';

const { width } = Dimensions.get('window');

const AvailableTicketsScreen = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasActiveTicket, setHasActiveTicket] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExpertise, setSelectedExpertise] = useState([]);
  const [sortBy, setSortBy] = useState('recent');
  const [availableExpertise, setAvailableExpertise] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [acceptedTickets, setAcceptedTickets] = useState([]);
  const [pendingAcceptIds, setPendingAcceptIds] = useState(new Set());
  const { user } = useAuth();
  const socket = useSocket();

  const fetchActiveTicketStatus = useCallback(async () => {
    try {
      // Use role-specific active-ticket endpoint for Service Providers
      const activePath = (user && user.role === 'Service Provider') ? '/tickets/serviceprovider/active-ticket' : '/tickets/engineer/active-ticket';
      const { data } = await api.get(activePath);
      setHasActiveTicket(!!data);
      setActiveTicket(data || null);
    } catch (err) {
      console.error("Error fetching active ticket status:", err);
      setHasActiveTicket(false);
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const availPath = (user && user.role === 'Service Provider') ? '/tickets/serviceprovider/available' : '/tickets/engineer/available';
      const { data } = await api.get(availPath);
      setTickets(data);
      
      const allExpertise = new Set();
      data.forEach(ticket => {
        if (ticket.expertiseRequired && Array.isArray(ticket.expertiseRequired)) {
          ticket.expertiseRequired.forEach(exp => allExpertise.add(exp));
        }
      });
      setAvailableExpertise(Array.from(allExpertise).sort());
      // fetch engineer accepted tickets too to prevent conflicts
      try {
        const { data: accepted } = await api.get('/tickets/engineer/accepted');
        setAcceptedTickets(accepted || []);
      } catch (err) {
        setAcceptedTickets([]);
      }
    } catch (err) {
      console.error('Error fetching tickets:', err);
      Alert.alert('Error', 'Could not fetch available tickets.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    fetchActiveTicketStatus();
  }, [fetchTickets, fetchActiveTicketStatus]);

  // Listen for ticket updates to refresh the Available list in realtime
  useEffect(() => {
    if (!socket) return;
    const handler = (updated) => {
      try {
        // Avoid unneeded refresh for unrelated company tickets
        if (updated && updated.companyId && updated.companyId.toString() !== user?.companyId?.toString()) return;
        fetchTickets();
      } catch (e) { console.warn('ticket_updated handler error', e); }
    };
    socket.on('ticket_updated', handler);
    return () => socket.off('ticket_updated', handler);
  }, [socket, user?.companyId, fetchTickets]);
  
  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets();
    fetchActiveTicketStatus();
  };

  const filteredAndSortedTickets = useMemo(() => {
    let result = [...tickets];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(ticket => 
        ticket.ticketId?.toLowerCase().includes(query) ||
        ticket.companyName?.toLowerCase().includes(query) ||
        ticket.siteAddress?.toLowerCase().includes(query) ||
        ticket.workDescription?.toLowerCase().includes(query)
      );
    }

    if (selectedExpertise.length > 0) {
      result = result.filter(ticket =>
        selectedExpertise.some(exp => 
          ticket.expertiseRequired?.includes(exp)
        )
      );
    }

    result.sort((a, b) => {
      if (sortBy === 'amount-high') {
        return (b.amount || 0) - (a.amount || 0);
      } else if (sortBy === 'amount-low') {
        return (a.amount || 0) - (b.amount || 0);
      }
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    return result;
  }, [tickets, searchQuery, selectedExpertise, sortBy]);

  const handleAcceptTicket = async (ticket) => {
    const ticketId = ticket._id;
    // Prevent duplicate rapid accepts
    if (pendingAcceptIds.has(ticketId)) return;
    if (hasActiveTicket) {
      Alert.alert('Cannot Accept Ticket', 'You already have an active ticket. Please complete it before accepting another.');
      return;
    }
    // mark pending
    setPendingAcceptIds(prev => new Set(prev).add(ticketId));
    try {
      // If the logged-in user is a Service Provider, call the SP acceptance endpoint
      let resp;
      if (user && user.role === 'Service Provider') {
        resp = await api.post(`/tickets/${ticketId}/accept-by-service-provider?workType=self`);
      } else {
        resp = await api.put(`/tickets/${ticketId}/accept`);
      }
      // Only start background tracking if activity is within 2 hours
      try {
        // find ticket in local tickets
        const sold = tickets.find(t => t._id === ticketId) || ticket || {};
        const win = (function(u){
          if (!u) return null;
          if (u.activityStart && u.activityEnd) return { start: new Date(u.activityStart), end: new Date(u.activityEnd) };
          if (Array.isArray(u.activityWindows) && u.activityWindows.length) {
            const w = u.activityWindows[0];
            const d = w?.date ? new Date(w.date) : null;
            if (d) {
              const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
              if (w.timeFrom) { const [h,m] = String(w.timeFrom).split(':').map(Number); start.setHours(h, m, 0); }
              return { start, end: new Date(start.getTime() + 3600000) };
            }
          }
          return null;
        })(sold);
        const now = new Date();
        if (win && (win.start.getTime() - now.getTime()) <= 2 * 60 * 60 * 1000) {
          await startLocationTracking(ticketId);
        } else {
          // No automatic tracking for tickets more than 2 hours away
        }
      } catch (e) { console.warn('startLocationTracking error:', e); }
      Alert.alert('Success', 'Ticket accepted successfully!');
      // Optimistically add accepted ticket to local list and refresh
      try {
        const added = resp?.data?.ticket || null;
        if (added) setAcceptedTickets(prev => { const ids = new Set(prev.map(p => p._id)); if (ids.has(added._id)) return prev; return [...prev, added]; });
      } catch (e) { /* ignore */ }
      fetchTickets();
      fetchActiveTicketStatus();
      // also refresh list after a short delay to ensure backend consistency
      setTimeout(() => { fetchTickets(); fetchActiveTicketStatus(); }, 1000);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not accept ticket.');
    } finally {
      // clear pending regardless
      setPendingAcceptIds(prev => {
        const next = new Set(prev);
        next.delete(ticketId);
        return next;
      });
    }
  };

  const getPrimaryWindow = (ticket) => {
    if (!ticket) return null;
    if (ticket.activityStart && ticket.activityEnd) {
      return { start: new Date(ticket.activityStart), end: new Date(ticket.activityEnd) };
    }
    if (Array.isArray(ticket.activityWindows) && ticket.activityWindows.length > 0) {
      const normalized = ticket.activityWindows.map(w => {
        const d = w.date ? new Date(w.date) : null;
        if (!d || isNaN(d.getTime())) return null;
        let start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        let end = new Date(start);
        if (w.timeFrom) {
          const [h,m] = String(w.timeFrom).split(':').map(Number);
          start.setHours(isNaN(h) ? 0 : h, isNaN(m) ? 0 : m);
        }
        if (w.timeTo) {
          const [h2,m2] = String(w.timeTo).split(':').map(Number);
          end.setHours(isNaN(h2) ? 23 : h2, isNaN(m2) ? 59 : m2);
        } else {
          end = new Date(start.getTime() + 3600000);
        }
        return { start, end };
      }).filter(Boolean);
      if (normalized.length === 0) return null;
      normalized.sort((a,b) => a.start - b.start);
      return normalized[0];
    }
    if (ticket.activityDate) {
      const d = new Date(ticket.activityDate);
      const start = ticket.activityTimeFrom ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), ...String(ticket.activityTimeFrom).split(':').map(Number)) : d;
      const end = ticket.activityTimeTo ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), ...String(ticket.activityTimeTo).split(':').map(Number)) : new Date(start.getTime() + 3600000);
      return { start, end };
    }
    return null;
  };

  const hasSufficientGap = (w1, w2) => {
    if (!w1 || !w2) return false;
    if (w1.start.getFullYear() !== w2.start.getFullYear() || w1.start.getMonth() !== w2.start.getMonth() || w1.start.getDate() !== w2.start.getDate()) return true;
    const hour = 60 * 60 * 1000;
    const required = 2 * hour; // require at least 2 hours gap
    if (w1.end <= w2.start) return (w2.start - w1.end) >= required;
    if (w2.end <= w1.start) return (w1.start - w2.end) >= required;
    return false;
  };

  const canAcceptTicketLocal = (candidate) => {
    if (!hasActiveTicket && acceptedTickets.length === 0 && pendingAcceptIds.size === 0) return true;
    const winCandidate = getPrimaryWindow(candidate);
    if (!winCandidate) return false;
    // If this ticket is currently pending (we just tapped accept) treat as conflict
    if (pendingAcceptIds.has(candidate._id)) return false;
    // Check against accepted tickets
    for (let t of acceptedTickets) {
      if (t._id === candidate._id) continue;
      const winT = getPrimaryWindow(t);
      if (!winT) continue; // skip accepted tickets that don't have a time window
      if (!hasSufficientGap(winT, winCandidate)) return false;
    }
    // Also check against active ticket
    if (activeTicket) {
      const winActive = getPrimaryWindow(activeTicket);
      if (winActive && !hasSufficientGap(winActive, winCandidate)) return false;
    }
    // check pending accept ids for potential conflicts (tickets user just requested)
    for (let pId of Array.from(pendingAcceptIds)) {
      if (pId === candidate._id) continue;
      const pendingTicket = acceptedTickets.find(t => t._id === pId) || tickets.find(t => t._id === pId);
      if (!pendingTicket) continue;
      const winP = getPrimaryWindow(pendingTicket);
      if (!winP) continue;
      if (!hasSufficientGap(winP, winCandidate)) return false;
    }
    return true;
  };

  const toggleExpertiseFilter = (expertise) => {
    setSelectedExpertise(prev => 
      prev.includes(expertise) 
        ? prev.filter(e => e !== expertise)
        : [...prev, expertise]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedExpertise([]);
    setSortBy('recent');
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text className="text-gray-600 mt-4">Loading tickets...</Text>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <SafeAreaView className="flex-1 bg-gray-50">
        {/* Fixed Header */}
        <View className="bg-gradient-to-b from-indigo-600 to-indigo-500 px-4 py-4 shadow-lg">
          <Text className="text-2xl font-bold text-white mb-1">Available Tickets</Text>
          <Text className="text-indigo-100 text-sm">{filteredAndSortedTickets.length} tickets available</Text>
        </View>

        {/* Search Bar - Sticky */}
        <View className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
          <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2 border border-gray-300">
            <MaterialCommunityIcons name="magnify" size={20} color="#6B7280" />
            <TextInput
              placeholder="Search ID, company, location..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 ml-2 text-base text-gray-800"
              placeholderTextColor="#9CA3AF"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialCommunityIcons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Collapsible Filter Section */}
        {(searchQuery || selectedExpertise.length > 0 || sortBy !== 'recent') && (
          <View className="bg-blue-50 border-b border-blue-200 px-4 py-2">
            <Text className="text-xs text-blue-700 font-medium">
              <Text className="font-bold">{filteredAndSortedTickets.length}</Text> result(s)
              {selectedExpertise.length > 0 && ` • ${selectedExpertise.join(', ')}`}
            </Text>
          </View>
        )}

        {/* Tickets List */}
        <FlatList
          data={filteredAndSortedTickets}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TicketCard 
                ticket={item} 
                // Always render accept button (so users see why it is unavailable). Disable if conflict
                  onAction={() => handleAcceptTicket(item)}
                  hasRequested={pendingAcceptIds.has(item._id)}
                  disabled={!canAcceptTicketLocal(item)}
                  disabledLabel={!canAcceptTicketLocal(item) ? 'Accept' : undefined}
                  showDisabledLabel={false}
              actionLabel="Accept"
            />
          )}
          contentContainerStyle={{ 
            paddingHorizontal: 12, 
            paddingTop: 8, 
            paddingBottom: 20 
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          scrollIndicatorInsets={{ right: 1 }}
          ListEmptyComponent={() => (
            <View className="flex-1 items-center justify-center mt-16 px-4">
              <MaterialCommunityIcons name="inbox-outline" size={48} color="#D1D5DB" />
              <Text className="text-lg font-semibold text-gray-800 mt-4 mb-2">No Tickets Found</Text>
              <Text className="text-sm text-gray-500 text-center">
                {searchQuery || selectedExpertise.length > 0
                  ? 'Try adjusting your search or filter criteria'
                  : 'No tickets match your expertise right now'}
              </Text>
              {(searchQuery || selectedExpertise.length > 0) && (
                <TouchableOpacity 
                  onPress={clearFilters} 
                  className="bg-indigo-600 px-6 py-3 rounded-lg mt-4"
                >
                  <Text className="text-white font-medium text-sm">Clear Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />

        {/* Floating Filter Button */}
        {availableExpertise.length > 0 && (
          <View className="absolute bottom-6 right-4 z-40">
            <TouchableOpacity 
              onPress={() => setShowFilters(!showFilters)}
              className="bg-indigo-600 rounded-full w-14 h-14 items-center justify-center shadow-lg"
            >
              <MaterialCommunityIcons 
                name={showFilters ? "close" : "filter-variant"} 
                size={24} 
                color="white" 
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom Sheet Filter Panel */}
        {showFilters && (
          <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl max-h-96 z-50">
            <View className="px-4 py-4 border-b border-gray-200 flex-row justify-between items-center">
              <Text className="text-lg font-bold text-gray-900">Filters & Sort</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Scrollable Content */}
            <View className="flex-1 px-4 py-4">
              {/* Sort Options */}
              <View className="mb-5">
                <Text className="text-sm font-bold text-gray-700 mb-2">Sort By</Text>
                <View className="flex-row gap-2 flex-wrap">
                  {[
                    { key: 'recent', label: 'Recent', icon: 'clock-outline' },
                    { key: 'amount-high', label: 'High Pay', icon: 'trending-up' },
                    { key: 'amount-low', label: 'Low Pay', icon: 'trending-down' }
                  ].map(option => (
                    <TouchableOpacity
                      key={option.key}
                      onPress={() => setSortBy(option.key)}
                      className={`px-4 py-2 rounded-full flex-row items-center gap-1.5 ${
                        sortBy === option.key 
                          ? 'bg-indigo-600' 
                          : 'bg-gray-100 border border-gray-300'
                      }`}
                    >
                      <MaterialCommunityIcons 
                        name={option.icon} 
                        size={16} 
                        color={sortBy === option.key ? 'white' : '#6B7280'}
                      />
                      <Text className={`text-sm font-medium ${
                        sortBy === option.key ? 'text-white' : 'text-gray-700'
                      }`}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Expertise Filter */}
              {availableExpertise.length > 0 && (
                <View className="mb-5">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-sm font-bold text-gray-700">Expertise</Text>
                    {selectedExpertise.length > 0 && (
                      <TouchableOpacity onPress={() => setSelectedExpertise([])}>
                        <Text className="text-xs text-indigo-600 font-bold">Clear All</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View className="flex-row gap-2 flex-wrap">
                    {availableExpertise.map(expertise => (
                      <TouchableOpacity
                        key={expertise}
                        onPress={() => toggleExpertiseFilter(expertise)}
                        className={`px-3 py-1.5 rounded-full border ${
                          selectedExpertise.includes(expertise)
                            ? 'bg-indigo-600 border-indigo-600'
                            : 'bg-white border-gray-300'
                        }`}
                      >
                        <Text className={`text-xs font-medium ${
                          selectedExpertise.includes(expertise)
                            ? 'text-white'
                            : 'text-gray-700'
                        }`}>
                          {expertise}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Clear All Filters */}
              {(searchQuery || selectedExpertise.length > 0 || sortBy !== 'recent') && (
                <TouchableOpacity 
                  onPress={clearFilters} 
                  className="bg-red-50 border border-red-300 rounded-lg p-3 mt-4"
                >
                  <Text className="text-center text-sm font-bold text-red-700">Clear All Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Overlay when filter panel is open */}
        {showFilters && (
          <TouchableOpacity 
            activeOpacity={1}
            onPress={() => setShowFilters(false)}
            className="absolute inset-0 bg-black/30 z-40"
          />
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

export default AvailableTicketsScreen;
