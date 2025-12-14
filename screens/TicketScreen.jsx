import React, { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, TextInput, Alert } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { showMessage } from 'react-native-flash-message';
import { startLocationTracking } from '../services/locationTask';
import { useAuth } from '../context/AuthContext';
import { logCurrentUserMasked, logCurrentUserRaw } from '../utils/devDebug';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import { hasEnoughAssigned, getAssignedEngineerCount } from '../utils/ticketHelpers';
import TicketCard from '../components/TicketCard';
import ActiveTicketCard from '../components/ActiveTicketCard';

const TicketScreen = ({ navigation }) => {
  const { user } = useAuth();
  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
  const socket = useSocket();
  const [tab, setTab] = useState('Available');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);
  const [hasActiveTicket, setHasActiveTicket] = useState(false);
  const [acceptedTicketsList, setAcceptedTicketsList] = useState([]);
  const fetchInProgressRef = React.useRef(false);
  const fetchTimeoutRef = React.useRef(null);
  const isMountedRef = React.useRef(true);
  // Search/filter state for Available tab
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExpertise, setSelectedExpertise] = useState([]);
  const [sortBy, setSortBy] = useState('recent');
  const [availableExpertise, setAvailableExpertise] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  // Cleanup on unmount + set mounted on mount
  React.useEffect(() => {
    isMountedRef.current = true;  // Set to true when component mounts
    return () => {
      isMountedRef.current = false;  // Set to false only on true unmount
    };
  }, []);

  const fetchData = React.useCallback(async () => {
    // Prevent concurrent fetches — ignore if one is already in progress
    if (fetchInProgressRef.current) {
      console.log('[fetchData] Aborting fetch; fetch already in progress', { fetchInProgress: fetchInProgressRef.current });
      // If caller requested pull-to-refresh, ensure RefreshControl UI clears
      if (refreshing) setRefreshing(false);
      return;
    }
    if (!isMountedRef.current) {
      console.log('[fetchData] Aborting fetch; component not mounted', { mounted: isMountedRef.current });
      if (refreshing) setRefreshing(false);
      return;
    }

    fetchInProgressRef.current = true;
    // Watchdog: clear in-progress flag if it gets stuck for too long
    try { clearTimeout(fetchTimeoutRef.current); } catch (e) {}
    fetchTimeoutRef.current = setTimeout(() => {
      if (fetchInProgressRef.current) {
        console.warn('[fetchData] fetch watchdog cleared stuck flag');
        fetchInProgressRef.current = false;
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
          showMessage({ message: 'Refresh timed out, please try again', type: 'warning' });
        }
      }
    }, 10000);
    // If we're already in a pull-to-refresh, don't show the top loading indicator
    if (!refreshing) setLoading(true);
    try {
      const actPath = (user && user.role === 'Service Provider') ? '/tickets/serviceprovider/active-ticket' : '/tickets/engineer/active-ticket';
      let activeRes = null;
      let accepted = null;
      
      if (!user || user.role !== 'Service Provider') {
        try {
          const res = await api.get('/tickets/engineer/accepted');
          if (!isMountedRef.current) return;
          accepted = res.data;
          setAcceptedTicketsList(accepted || []);
        } catch (err) {
          console.warn('[fetchData] Unable to load accepted tickets:', err?.message || err);
          if (isMountedRef.current) setAcceptedTicketsList([]);
          accepted = [];
        }
      } else {
        if (isMountedRef.current) setAcceptedTicketsList([]);
      }

      try {
        activeRes = await api.get(actPath);
        if (!isMountedRef.current) return;
        setHasActiveTicket(!!activeRes.data);
        setActiveTicket(activeRes.data || null);
      } catch (actErr) {
        console.warn('[fetchData] Unable to load active ticket:', actErr?.message || actErr);
        if (isMountedRef.current) {
          setHasActiveTicket(false);
          setActiveTicket(null);
        }
      }

      if (tab === 'Available') {
        const path = user && user.role === 'Service Provider' ? '/tickets/serviceprovider/available' : '/tickets/engineer/available';
        const { data } = await api.get(path);
        if (!isMountedRef.current) return;
        setTickets(data || []);
        // build list of available expertise for filters
        const allExpertise = new Set();
        (data || []).forEach(ticket => {
          if (ticket.expertiseRequired && Array.isArray(ticket.expertiseRequired)) {
            ticket.expertiseRequired.forEach(exp => allExpertise.add(exp));
          }
        });
        setAvailableExpertise(Array.from(allExpertise).sort());
      } else if (tab === 'Accepted') {
        setTickets(accepted || []);
      } else if (tab === 'Completed') {
        const { data } = await api.get('/tickets/engineer/history');
        if (!isMountedRef.current) return;
        setTickets(data || []);
      } else if (tab === 'Current') {
        // Already populated active ticket above
      }
      
      // AUTO-MOVE LOGIC: Run whenever we have accepted tickets and no active ticket exists yet
      if (accepted !== null) {
        try {
          if (!activeRes || !activeRes.data) {
            if (Array.isArray(accepted) && accepted.length > 0) {
              const now = new Date();
              const twoHours = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
              // Use local date to match backend's completedWindows format
              const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              console.log('[AUTO_MOVE] Checking', accepted.length, 'accepted tickets for auto-move. Current time:', now.toISOString(), 'todayLocal:', todayDateStr, 'Tab:', tab);
              for (const candidate of accepted) {
                try {
                  // Skip if today's window was already completed
                  if (Array.isArray(candidate.completedWindows) && candidate.completedWindows.includes(todayDateStr)) {
                    console.log('[AUTO_MOVE] ✗ Skipping', candidate.ticketId, '- today\'s window already completed');
                    continue;
                  }
                  
                  const win = getPrimaryWindow(candidate);
                  if (!win) {
                    console.log('[AUTO_MOVE] candidate', candidate._id, '(', candidate.ticketId, ') has NO primary window (skipped)');
                    continue;
                  }
                  const timeUntilStart = win.start.getTime() - now.getTime();
                  const isInsideWindow = now >= win.start && now <= win.end;
                  const isWithin2Hours = timeUntilStart > 0 && timeUntilStart <= twoHours;
                  
                  console.log('[AUTO_MOVE] candidate', { 
                    id: candidate._id, 
                    ticketId: candidate.ticketId, 
                    winStart: win.start?.toISOString?.(), 
                    winEnd: win.end?.toISOString?.(), 
                    now: now.toISOString(),
                    timeUntilStart: Math.round(timeUntilStart / 60000) + ' mins',
                    isInsideWindow,
                    isWithin2Hours,
                    completedWindows: candidate.completedWindows || []
                  });
                  
                  // If now is inside the primary window OR within 2 hours before it starts, attempt to move to current
                  if (isInsideWindow || isWithin2Hours) {
                    console.log('[AUTO_MOVE] ✓ Eligible for move-to-current:', isInsideWindow ? 'inside window' : 'within 2 hours before window', 'for candidate', candidate._id);
                    try {
                      if (!hasEnoughAssigned(candidate)) {
                        const assigned = getAssignedEngineerCount(candidate);
                        console.log('[AUTO_MOVE] ✗ skipping move-to-current — not enough assigned engineers', { id: candidate._id, required: candidate.requiredEngineers || 1, assigned });
                        continue; // skip this candidate
                      }
                    } catch (err) { console.warn('[AUTO_MOVE] hasEnoughAssigned check failed', err); }
                    try {
                      await api.post(`/tickets/${candidate._id}/move-to-current`);
                      console.log('[AUTO_MOVE] ✓ move-to-current SUCCEEDED for', candidate._id);
                      // schedule a refresh after the current fetch finishes
                      setTimeout(() => fetchData(), 800);
                      showMessage({ message: 'Ticket moved to current (auto)', type: 'info' });
                    } catch (e) {
                      // log errors such as 403 or already moved for debugging
                      console.warn('[AUTO_MOVE] ✗ move-to-current FAILED for', candidate._id, 'Status:', e?.response?.status, 'Error:', e?.response?.data || e?.message || e);
                    }
                    break;
                  } else {
                    console.log('[AUTO_MOVE] ✗ Not eligible for move-to-current (outside window and more than 2 hours away) for candidate', candidate._id);
                  }
                } catch (e) { console.warn('Auto move-to-current candidate check failed:', e?.message || e); }
              }
            }
          }
        } catch (e) { console.warn('Auto move-to-current runner failed (ignored):', e?.message || e); }
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Error fetching tickets for tab', tab, err);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
      fetchInProgressRef.current = false;
      try { clearTimeout(fetchTimeoutRef.current); } catch (e) {}
      console.log('[fetchData] finished', { tab, time: new Date().toISOString() });
    }
  }, [tab, user?.role, user?.companyId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Re-fetch when this screen gets focus in the bottom navigator; cleanup fetch flag on blur
  useFocusEffect(
    React.useCallback(() => {
      void fetchData();
      // Return cleanup function to run when screen loses focus (blur)
      return () => {
        // Clear stuck fetch flag and UI state when navigating away
        if (fetchInProgressRef.current) {
          console.log('[TicketScreen] Screen blur detected; clearing stuck fetch flag');
          fetchInProgressRef.current = false;
          try { clearTimeout(fetchTimeoutRef.current); } catch (e) {}
        }
      };
    }, [fetchData])
  );

  // Listen for global ticket updates — only re-fetch if not already fetching
  useEffect(() => {
    if (!socket) return;

    const handler = (updated) => {
      try {
        if (!updated) return;
        if (updated.companyId && updated.companyId.toString() !== user?.companyId?.toString()) return;
        // Only fetch if not already in progress
        if (!fetchInProgressRef.current && isMountedRef.current) {
          void fetchData();
        }
      } catch (e) { console.warn('ticket_updated handler error', e); }
    };

    socket.on('ticket_updated', handler);
    return () => socket.off('ticket_updated', handler);
  }, [socket, user?.companyId, fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // derive filtered and sorted tickets for Available tab
  const filteredAndSortedTickets = React.useMemo(() => {
    if (tab !== 'Available') return tickets;
    let result = [...tickets];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(ticket =>
        (ticket.ticketId || '').toLowerCase().includes(query) ||
        (ticket.companyName || '').toLowerCase().includes(query) ||
        (ticket.siteAddress || '').toLowerCase().includes(query) ||
        (ticket.workDescription || '').toLowerCase().includes(query)
      );
    }
    if (selectedExpertise.length > 0) {
      result = result.filter(ticket => selectedExpertise.some(exp => ticket.expertiseRequired?.includes(exp)));
    }
    result.sort((a, b) => {
      if (sortBy === 'amount-high') return (b.amount || 0) - (a.amount || 0);
      if (sortBy === 'amount-low') return (a.amount || 0) - (b.amount || 0);
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    return result;
  }, [tickets, searchQuery, selectedExpertise, sortBy, tab]);

  const renderContent = () => {
    if (tab === 'Current') {
      if (loading) return <ActivityIndicator />;
      return activeTicket ? <ActiveTicketCard ticket={activeTicket} onUpdate={() => fetchData()} /> : <Text style={{ padding: 20 }}>No current active ticket.</Text>;
    }

    return (
      <FlatList
        data={tab === 'Available' ? filteredAndSortedTickets : tickets}
        keyExtractor={(item) => `${item._id}`}
        renderItem={({ item }) => {
          const canAccept = tab === 'Available' ? canAcceptTicket(item) : false;
          let disabledReason;
          if (tab === 'Available' && hasActiveTicket && !canAccept) {
            const winCandidate = getPrimaryWindow(item);
            const winActive = activeTicket ? getPrimaryWindow(activeTicket) : null;
            if (winActive && winCandidate && !hasSufficientGap(winActive, winCandidate)) disabledReason = 'Conflicts with active ticket';
            else disabledReason = 'Conflicts with accepted ticket';
          }
          return (
            <TicketCard
              ticket={item}
              // Show Accept button in Available tab always; use disabled flag when it conflicts
              onAction={tab === 'Available' ? () => handleAcceptTicket(item) : undefined}
              disabled={tab === 'Available' && !canAccept}
              disabledLabel={tab === 'Available' ? 'Accept' : disabledReason}
              showDisabledLabel={tab === 'Available' ? false : true}
              actionLabel={tab === 'Available' ? 'Accept' : undefined}
              onRelease={tab === 'Accepted' ? handleReleaseTicket : undefined}
              // Only show "Move to Current" button in Accepted tab when no active ticket exists
              onMoveToCurrent={tab === 'Accepted' && !hasActiveTicket ? handleMoveToCurrent : undefined}
            />
          );
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={() => !loading && (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <MaterialCommunityIcons name="ticket-percent" size={42} color="#9CA3AF" />
            <Text style={{ paddingTop: 10, color: '#9CA3AF' }}>No tickets available right now</Text>
          </View>
        )}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      />
    );
  };

  const toggleExpertiseFilter = (expertise) => {
    setSelectedExpertise(prev => prev.includes(expertise) ? prev.filter(e => e !== expertise) : [...prev, expertise]);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedExpertise([]);
    setSortBy('recent');
    setShowFilters(false);
  };

  const getPrimaryWindow = (ticket) => {
    if (!ticket) return null;
    const now = new Date();

    const parseWindows = () => {
      if (!Array.isArray(ticket.activityWindows) || ticket.activityWindows.length === 0) return null;
      console.log('[getPrimaryWindow] Parsing activityWindows for', ticket.ticketId, '- Raw windows:', JSON.stringify(ticket.activityWindows));
      const normalized = ticket.activityWindows.map((w, idx) => {
        const d = w.date ? new Date(w.date) : null;
        if (!d || isNaN(d.getTime())) {
          console.log('[getPrimaryWindow] Window', idx, 'has invalid date:', w.date);
          return null;
        }
        let start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        let end = new Date(start);
        if (w.timeFrom) {
          const [h, m] = String(w.timeFrom).split(':').map(Number);
          start.setHours(isNaN(h) ? 0 : h, isNaN(m) ? 0 : m, 0, 0);
        }
        if (w.timeTo) {
          const [h2, m2] = String(w.timeTo).split(':').map(Number);
          end.setHours(isNaN(h2) ? 23 : h2, isNaN(m2) ? 59 : m2, 0, 0);
        } else {
          end = new Date(start);
          end.setHours(start.getHours() + 1);
        }
        console.log('[getPrimaryWindow] Window', idx, 'parsed:', { raw: w, parsed: { start: start.toISOString(), end: end.toISOString() } });
        return { start, end };
      }).filter(Boolean);
      if (normalized.length === 0) return null;

      const currentWindow = normalized.find(w => now >= w.start && now <= w.end);
      if (currentWindow) {
        console.log('[getPrimaryWindow] Found current-time window:', { ticketId: ticket.ticketId, start: currentWindow.start?.toISOString?.(), end: currentWindow.end?.toISOString?.(), now: now.toISOString() });
        return currentWindow;
      }

      const upcoming = normalized.filter(w => w.start >= new Date(new Date().setHours(0,0,0,0))).sort((a,b) => a.start - b.start);
      if (upcoming.length > 0) {
        console.log('[getPrimaryWindow] No current-time window; returning next upcoming:', { ticketId: ticket.ticketId, start: upcoming[0].start?.toISOString?.(), end: upcoming[0].end?.toISOString?.() });
        return upcoming[0];
      }

      normalized.sort((a,b) => b.start - a.start);
      console.log('[getPrimaryWindow] No upcoming window; returning most recent:', { ticketId: ticket.ticketId, start: normalized[0].start?.toISOString?.(), end: normalized[0].end?.toISOString?.() });
      return normalized[0];
    };

    const explicitWin = parseWindows();
    if (explicitWin) return explicitWin;

    if (ticket.activityStart && ticket.activityEnd) {
      try {
        const s = new Date(ticket.activityStart);
        const e = new Date(ticket.activityEnd);
        console.log('[getPrimaryWindow] Using activityStart/activityEnd as fallback:', { ticketId: ticket.ticketId, start: s.toISOString(), end: e.toISOString() });
        return { start: s, end: e };
      } catch (e) { console.warn('[getPrimaryWindow] Failed to parse activityStart/End:', e); }
    }

    if (ticket.activityDate) {
      try {
        const d = new Date(ticket.activityDate);
        const start = ticket.activityTimeFrom ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), ...String(ticket.activityTimeFrom).split(':').map(Number)) : d;
        const end = ticket.activityTimeTo ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), ...String(ticket.activityTimeTo).split(':').map(Number)) : new Date(start.getTime() + 3600000);
        return { start, end };
      } catch (e) { console.warn('[getPrimaryWindow] Failed to parse activityDate/time:', e); }
    }
    return null;
  };

  const hasSufficientGap = (w1, w2) => {
    if (!w1 || !w2) return false;
    // If different day => allowed
    if (w1.start.getFullYear() !== w2.start.getFullYear() || w1.start.getMonth() !== w2.start.getMonth() || w1.start.getDate() !== w2.start.getDate()) return true;
    // ensure at least 1 hour gap between end of one and start of other
    const hour = 60 * 60 * 1000;
    // w1 before w2
    if (w1.end <= w2.start) {
      return (w2.start.getTime() - w1.end.getTime()) >= hour;
    }
    // w2 before w1
    if (w2.end <= w1.start) {
      return (w1.start.getTime() - w2.end.getTime()) >= hour;
    }
    // overlapping
    return false;
  };

  const canAcceptTicket = (candidate) => {
    if (!activeTicket) return true; // no active ticket
    // If we have accepted tickets list, ensure candidate doesn't conflict with any of them
    const winCandidate = getPrimaryWindow(candidate);
    if (!winCandidate) return false;
    // Check against currently accepted tickets
    for (let t of acceptedTicketsList || []) {
      if (!t) continue;
      // Don't check against itself
      if (t._id === candidate._id) continue;
      const winT = getPrimaryWindow(t);
      if (!winT) return false;
      if (!hasSufficientGap(winT, winCandidate)) return false;
    }
    const winActive = getPrimaryWindow(activeTicket);
    // candidate already computed above
    if (!winActive || !winCandidate) return false; // safe fallback: require single ticket
    return hasSufficientGap(winActive, winCandidate);
  };

  const handleAcceptTicket = async (ticket) => {
    if (hasActiveTicket) {
      if (!canAcceptTicket(ticket)) return alert('You already have an active ticket and the schedules conflict. Finish it before accepting another.');
    }
    try {
      let resp;
      if (user && user.role === 'Service Provider') {
        resp = await api.post(`/tickets/${ticket._id}/accept-by-service-provider?workType=self`);
      } else {
        resp = await api.put(`/tickets/${ticket._id}/accept`);
      }
      // Optimistic update
      try {
        const added = resp?.data?.ticket || null;
        if (added && isMountedRef.current) setAcceptedTicketsList(prev => { const ids = new Set(prev.map(p=>p._id)); if (ids.has(added._id)) return prev; return [...prev, added]; });
      } catch (e) { /* ignore */ }
      if (isMountedRef.current) setHasActiveTicket(true);
      
      // Single fetch call — guard against concurrent fetches
      if (!fetchInProgressRef.current && isMountedRef.current) {
        void fetchData();
      }
      
      // Kick off background tracking in background WITHOUT awaiting
      try {
        const win = getPrimaryWindow(ticket);
        if (win) {
          const now = new Date();
          const gap = win.start.getTime() - now.getTime();
          const twoHours = 2 * 60 * 60 * 1000;
          if (gap <= twoHours) {
            try {
              await api.post(`/tickets/${ticket._id}/ensure-conversation`);
            } catch (e) { console.warn('Failed to ensure conversation:', e?.message || e); }
            // Fire and forget
            startLocationTracking(ticket._id).catch(e => console.warn('startLocationTracking error:', e?.message || e));
            if (isMountedRef.current) showMessage({ message: 'Location tracking started (near activity)', type: 'info' });
          } else {
            if (isMountedRef.current) showMessage({ message: 'Ticket accepted — location tracking will start closer to activity (within 2 hours)', type: 'info' });
          }
        }
      } catch (e) { console.warn('Tracking setup error:', e?.message || e); }
    } catch (err) {
      alert(err.response?.data?.message || 'Could not accept ticket.');
    }
  };

  const handleReleaseTicket = async ({ ticket, reason }) => {
    try {
      if (!ticket || !isMountedRef.current) return;
      if (user && user.role === 'Service Provider') {
        await api.post(`/tickets/${ticket._id}/release-by-service-provider`, { reason: reason || '' });
      } else {
        await api.put(`/tickets/${ticket._id}/release`);
      }
      if (isMountedRef.current) showMessage({ message: 'Ticket released', type: 'success' });
      // Guard fetch with concurrent check
      if (!fetchInProgressRef.current && isMountedRef.current) {
        void fetchData();
      }
    } catch (err) {
      if (isMountedRef.current) alert(err.response?.data?.message || 'Could not release ticket');
    }
  };

  const handleMoveToCurrent = async (ticket) => {
    try {
      if (!isMountedRef.current) return;
      
      // Guard: prevent moving to current if engineer already has an active ticket
      if (hasActiveTicket && activeTicket && activeTicket._id !== ticket._id) {
        return Alert.alert(
          'Active Ticket Exists',
          `You already have an active ticket (${activeTicket.ticketId || 'ID: ' + activeTicket._id}). Please complete or pause it before starting another ticket.`,
          [{ text: 'OK' }]
        );
      }
      
      // Guard: ensure the ticket has enough assigned/accepted engineers before moving to current
      try {
        if (!hasEnoughAssigned(ticket)) {
          const assigned = getAssignedEngineerCount(ticket);
          return Alert.alert(
            'Not enough engineers',
            `This ticket requires ${ticket.requiredEngineers || 1} engineers but only ${assigned} are assigned/accepted. Please wait until required engineers are assigned.`
          );
        }
      } catch (err) { console.warn('hasEnoughAssigned check failed', err); }
      await api.post(`/tickets/${ticket._id}/move-to-current`);
      if (isMountedRef.current) showMessage({ message: 'Ticket moved to current', type: 'info' });
      // Start tracking in background without blocking UI
      startLocationTracking(ticket._id).catch(e => console.warn('startLocationTracking error', e?.message || e));
      // Guard fetch
      if (!fetchInProgressRef.current && isMountedRef.current) {
        void fetchData();
      }
    } catch (err) {
      if (isMountedRef.current) alert(err.response?.data?.message || 'Could not move to current');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Dev-only logging removed from UI: these debug actions remain available from Dev menu or console if needed */}

      <View style={styles.headerTabs}>
        {['Available', 'Accepted', 'Completed', 'Current'].map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'Available' && (
        <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e5e7eb', paddingVertical: 8, paddingHorizontal: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 12, padding: 8, borderWidth: 1, borderColor: '#e5e7eb' }}>
            <MaterialCommunityIcons name="magnify" size={20} color="#6B7280" />
            <TextInput
              placeholder="Search ID, company, location..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{ flex: 1, marginLeft: 10, fontSize: 16 }}
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
      )}
      <View style={{ flex: 1, paddingHorizontal: 12 }}>
        {loading ? <ActivityIndicator style={{ marginTop: 20 }} /> : renderContent()}
      </View>
      {/* Floating filter button for Available tab */}
      {tab === 'Available' && availableExpertise.length > 0 && (
        <View style={{ position: 'absolute', bottom: 18, right: 16, zIndex: 40 }}>
          <TouchableOpacity 
            onPress={() => setShowFilters(!showFilters)}
            style={{ backgroundColor: '#4F46E5', borderRadius: 999, width: 56, height: 56, alignItems: 'center', justifyContent: 'center', elevation: 8 }}
          >
            <MaterialCommunityIcons name={showFilters ? 'close' : 'filter-variant'} size={24} color="white" />
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom filter sheet */}
      {showFilters && (
        <>
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, elevation: 24, zIndex: 50 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#e5e7eb' }}>
              <Text style={{ fontSize: 18, fontWeight: '700' }}>Filters & Sort</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 8 }}>Sort By</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {[{ key: 'recent', label: 'Recent', icon: 'clock-outline' }, { key: 'amount-high', label: 'High Pay', icon: 'trending-up' }, { key: 'amount-low', label: 'Low Pay', icon: 'trending-down' }].map(option => (
                  <TouchableOpacity key={option.key} onPress={() => setSortBy(option.key)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: sortBy === option.key ? '#4F46E5' : '#F3F4F6', marginRight: 8, marginBottom: 8, borderWidth: sortBy === option.key ? 0 : 1, borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name={option.icon} size={16} color={sortBy === option.key ? 'white' : '#6B7280'} />
                    <Text style={{ marginLeft: 8, color: sortBy === option.key ? 'white' : '#111827', fontWeight: '600' }}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {availableExpertise.length > 0 && (
                <>
                  <Text style={{ fontSize: 14, fontWeight: '700', marginTop: 16, marginBottom: 8 }}>Expertise</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {availableExpertise.map(expertise => (
                      <TouchableOpacity key={expertise} onPress={() => toggleExpertiseFilter(expertise)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: selectedExpertise.includes(expertise) ? '#4F46E5' : '#fff', borderWidth: 1, borderColor: selectedExpertise.includes(expertise) ? '#4F46E5' : '#E5E7EB', marginRight: 8, marginBottom: 8 }}>
                        <Text style={{ color: selectedExpertise.includes(expertise) ? '#fff' : '#111827', fontWeight: '600' }}>{expertise}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {(searchQuery || selectedExpertise.length > 0 || sortBy !== 'recent') && (
                <TouchableOpacity onPress={clearFilters} style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 8, padding: 12, marginTop: 12 }}>
                  <Text style={{ textAlign: 'center', fontWeight: '700', color: '#991B1B' }}>Clear All Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity activeOpacity={1} onPress={() => setShowFilters(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 45 }} />
        </>
      )}
    </SafeAreaView>
  );
};

// legacy small styles removed; using modern tab styles below

export default TicketScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6'
  },
  headerTabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'space-around'
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'transparent'
  },
  tabActive: {
    backgroundColor: '#4F46E5'
  },
  tabText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600'
  },
  tabTextActive: {
    color: 'white'
  }
});
// Small user header styles
styles.topHeader = {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: 16,
  paddingVertical: 12,
  backgroundColor: '#fff',
  borderBottomWidth: 1,
  borderColor: '#e5e7eb'
};
styles.welcome = { color: '#6B7280', fontSize: 14 };
styles.username = { color: '#111827', fontSize: 18, fontWeight: '700' };
styles.headerIcons = { flexDirection: 'row', alignItems: 'center' };
