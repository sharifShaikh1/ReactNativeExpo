import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';
import TicketDetailsModal from './TicketDetailsModal';
import { formatCurrency } from '../utils/formatCurrency';
import { useAuth } from '../context/AuthContext';
import { stopLocationTracking } from '../services/locationTask';

// --- Shared Components ---
const ActionButton = ({ onPress, icon, label, variant = 'neutral', disabled = false }) => {
  // MINIMAL THEME: Soft backgrounds, subtle borders, dark colored text
  const stylesMap = {
    primary: {
      container: 'bg-indigo-50 border-indigo-200', // Soft Indigo
      content: '#4338ca', // Indigo-700
    },
    success: {
      container: 'bg-emerald-50 border-emerald-200', // Soft Emerald
      content: '#047857', // Emerald-700
    },
    warning: {
      container: 'bg-amber-50 border-amber-200', // Soft Amber
      content: '#b45309', // Amber-700
    },
    danger: {
      container: 'bg-rose-50 border-rose-200', // Soft Rose
      content: '#be123c', // Rose-700
    },
    neutral: {
      container: 'bg-white border-gray-200', // Clean White
      content: '#374151', // Gray-700
    },
    dark: {
      container: 'bg-gray-100 border-gray-300', // Light Gray
      content: '#111827', // Gray-900
    }
  };
  
  const currentStyle = stylesMap[variant] || stylesMap['neutral'];

  return (
    <TouchableOpacity 
      onPress={onPress}
      disabled={disabled}
      className={`flex-1 flex-row items-center justify-center py-3.5 px-3 rounded-xl border shadow-sm ${currentStyle.container} ${disabled ? 'opacity-50' : ''}`}
    >
      <Ionicons name={icon} size={20} color={currentStyle.content} />
      {label && (
        <Text 
          numberOfLines={1}
          style={{ color: currentStyle.content }}
          className="ml-2 text-sm font-bold">
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const ActiveTicketCard = ({ ticket, onUpdate }) => {
  const navigation = useNavigation();
  const { user } = useAuth();
  
  // State Management
  const [modals, setModals] = useState({ hold: false, close: false, release: false, completion: false, location: false, details: false });
  const [inputs, setInputs] = useState({ holdReason: '', closeRemarks: '', completionNotes: '', releaseReason: '' });
  const [locationState, setLocationState] = useState({ isNear: false, distance: null, current: null });
  const [invoice, setInvoice] = useState({ file: null, uploading: false, loaded: false });
  const [justCompleted, setJustCompleted] = useState(false); // Flag to prevent popup after completion

  // --- Logic Hooks ---
  
  // 1. Location Logic
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; 
    const φ1 = lat1 * Math.PI/180, φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180, Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  useEffect(() => {
    // Only watch location for Assigned tickets that haven't had today's window completed
    if (ticket?.status !== 'Assigned' || !ticket?.coordinates) return;
    
    // Skip if we just completed work (prevents popup from re-appearing)
    if (justCompleted) {
      console.log('[LOCATION] Skipping location watch - just completed work');
      return;
    }
    
    // Check if today's window was already completed - if so, don't show arrival popup
    const now = new Date();
    const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (Array.isArray(ticket?.completedWindows) && ticket.completedWindows.includes(todayDateStr)) {
      console.log('[LOCATION] Skipping location watch - today\'s window already completed, todayLocal:', todayDateStr);
      return;
    }
    
    let sub;
    const watch = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 5000 },
          (loc) => {
            const dist = calculateDistance(loc.coords.latitude, loc.coords.longitude, ticket.coordinates.latitude, ticket.coordinates.longitude);
            const isNear = dist <= 400; // 200m threshold
            setLocationState({ isNear, distance: Math.round(dist), current: loc.coords });
            if (isNear && !modals.location && !justCompleted) toggleModal('location', true);
          }
        );
      } catch (e) { console.error(e); }
    };
    watch();
    return () => sub?.remove();
  }, [ticket?.status, ticket?.completedWindows, justCompleted]);

  // 2. Invoice Persistence
  useEffect(() => {
    const loadInvoice = async () => {
      try {
        const stored = await AsyncStorage.getItem(`invoice_${ticket._id}`);
        if (stored) setInvoice(prev => ({ ...prev, file: JSON.parse(stored), loaded: true }));
      } catch (e) { console.warn(e); }
    };
    loadInvoice();
  }, [ticket._id]);

  // 3. Activity Window Helper
  const getActivityDisplay = () => {
    let dateStr = 'No Date';
    let timeStr = '';

    const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    if (Array.isArray(ticket.activityWindows) && ticket.activityWindows.length > 0) {
        const now = new Date();
        const sorted = ticket.activityWindows
            .map(w => ({ ...w, d: new Date(w.date) }))
            .sort((a,b) => a.d - b.d);
        
        const upcoming = sorted.find(w => w.d >= new Date(now.setHours(0,0,0,0)));
        const target = upcoming || sorted[sorted.length - 1]; 

        if (target) {
            dateStr = fmtDate(target.d);
            if (target.timeFrom) timeStr = `${target.timeFrom}${target.timeTo ? ' - ' + target.timeTo : ''}`;
        }
    } 
    else if (ticket.activityStart) {
        dateStr = fmtDate(ticket.activityStart);
        const sTime = new Date(ticket.activityStart).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        if (ticket.activityEnd) {
             const eTime = new Date(ticket.activityEnd).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
             timeStr = `${sTime} - ${eTime}`;
        } else {
             timeStr = sTime;
        }
    }
    else {
        dateStr = 'No Schedule';
        timeStr = '';
    }

    return { dateStr, timeStr };
  };

  const { dateStr, timeStr } = getActivityDisplay();


  // --- Actions ---

  const toggleModal = (type, visible) => setModals(prev => ({ ...prev, [type]: visible }));
  const updateInput = (type, val) => setInputs(prev => ({ ...prev, [type]: val }));

  const executeAction = async (endpoint, method = 'put', body = {}) => {
    try {
      await api[method](`/tickets/${ticket._id}/${endpoint}`, body);
      onUpdate();
      return true;
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Action failed');
      return false;
    }
  };

  const actions = {
    startWork: async (force = false) => {
      if (!force && !locationState.isNear) {
         Alert.alert('Too Far', `You are ${locationState.distance}m away. Must be within 200m.`);
         return;
      }
      if (await executeAction('start-work', 'post', locationState.current)) {
        toggleModal('location', false);
        Alert.alert('Work Started', 'Good luck!');
      }
    },
    hold: async () => {
      if (!inputs.holdReason) return Alert.alert('Required', 'Enter a reason.');
      if (await executeAction('hold', 'put', { reason: inputs.holdReason })) toggleModal('hold', false);
    },
    release: async () => {
      if (!inputs.releaseReason.trim()) return Alert.alert('Required', 'Please enter a reason for releasing this ticket.');
      const endpoint = user?.role === 'Service Provider' ? 'release-by-service-provider' : 'release';
      const method = user?.role === 'Service Provider' ? 'post' : 'put';
      if (await executeAction(endpoint, method, { reason: inputs.releaseReason })) toggleModal('release', false);
    },
    pickInvoice: async () => {
      try {
        const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
        if (res.canceled) return;
        const file = res.assets ? res.assets[0] : res;
        const fileObj = { uri: file.uri, name: file.name, mimeType: file.mimeType || 'application/pdf' };
        setInvoice(prev => ({ ...prev, file: fileObj }));
        await AsyncStorage.setItem(`invoice_${ticket._id}`, JSON.stringify(fileObj));
      } catch (e) { Alert.alert('Error', 'Could not pick file'); }
    },
    clearInvoice: async () => {
      try {
        await AsyncStorage.removeItem(`invoice_${ticket._id}`);
        setInvoice({ file: null, uploading: false, loaded: true });
      } catch (e) { console.warn('Failed to clear invoice:', e); }
    },
    complete: async () => {
      setInvoice(prev => ({ ...prev, uploading: true }));
      try {
        // Invoice is now optional - only upload if file is attached and has valid uri
        if (invoice.file && invoice.file.uri) {
          try {
            const formData = new FormData();
            formData.append('invoice', { uri: invoice.file.uri, name: invoice.file.name, type: invoice.file.mimeType });
            await api.post(`/tickets/${ticket._id}/invoice`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
            await AsyncStorage.removeItem(`invoice_${ticket._id}`);
          } catch (invoiceErr) {
            // Invoice upload failed but continue with completion
            console.warn('Invoice upload failed, continuing without invoice:', invoiceErr);
          }
        }
        const response = await api.post(`/tickets/${ticket._id}/request-completion`, { completionNotes: inputs.completionNotes });
        
        // Set flag to prevent location popup from appearing after completion
        setJustCompleted(true);
        
        await stopLocationTracking();
        toggleModal('completion', false);
        toggleModal('location', false); // Close location modal if open
        onUpdate();
        
        // Check if there are more activity windows
        if (response.data?.hasFutureWindows) {
          Alert.alert(
            'Day\'s Work Completed', 
            `This ticket has more activity windows. Next window: ${response.data.nextWindowDate ? new Date(response.data.nextWindowDate).toLocaleDateString() : 'upcoming'}. The ticket will appear in your Accepted section until the next window.`
          );
        } else {
          Alert.alert('Success', 'Submitted for approval');
        }
      } catch (e) {
        Alert.alert('Error', e.response?.data?.message || 'Submission failed');
      } finally {
        setInvoice(prev => ({ ...prev, uploading: false }));
      }
    }
  };

  return (
    <View className="bg-white rounded-2xl border border-indigo-100 shadow-md mb-5 overflow-hidden">
      
      {/* 1. Header */}
      <View className="p-5 bg-white border-b border-gray-100">
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1 mr-3">
             {/* ID (Clean, No Hash) */}
             <Text className="text-sm font-semibold text-gray-400 mb-1 tracking-wide">{ticket.ticketId}</Text>
             <Text className="text-xl font-bold text-gray-900 leading-tight">{ticket.companyName}</Text>
          </View>
          <Text className="text-xl font-extrabold text-emerald-600">{formatCurrency(ticket.amount)}</Text>
        </View>

        {/* Metadata Section - Spaced out properly */}
        <View className="mt-2 space-y-3">
           {/* Location Row */}
           <View className="flex-row items-start">
              <View className="mt-0.5 w-6">
                <Ionicons name="location-sharp" size={18} color="#6366f1" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-700 leading-5">{ticket.siteAddress}</Text>
                {/* Distance is now separate under location */}
                {locationState.distance && (
                  <View className="bg-indigo-50 self-start px-2 py-0.5 rounded-md mt-1.5 border border-indigo-100">
                    <Text className="text-xs font-bold text-indigo-700">
                       {locationState.distance}m away
                    </Text>
                  </View>
                )}
              </View>
           </View>
           
           {/* Date/Time Row */}
           <View className="flex-row items-center pt-2">
              <View className="w-6">
                <Ionicons name="calendar" size={18} color="#9ca3af" />
              </View>
              <Text className="text-sm font-medium text-gray-600">
                  {dateStr} {timeStr ? `• ${timeStr}` : ''}
              </Text>
           </View>
        </View>
      </View>

      {/* 2. Body */}
      <View className="p-5 bg-gray-50/50">
         <Text className="text-base text-gray-700 leading-relaxed mb-6">
            {ticket.workDescription || "No additional description provided."}
         </Text>
         
         {/* 3. Action Grid */}
         <View className="flex-row gap-3 mb-3">
            {ticket.status === 'Assigned' && (
              <>
                <ActionButton 
                  variant={locationState.isNear ? "success" : "warning"} 
                  icon={locationState.isNear ? "play" : "navigate"} 
                  label={locationState.isNear ? "Start Work" : "Go to Site"} 
                  onPress={() => actions.startWork()} 
                />
                <ActionButton variant="warning" icon="pause" label="Hold" onPress={() => toggleModal('hold', true)} />
                <ActionButton variant="danger" icon="close" label="Release" onPress={() => toggleModal('release', true)} />
              </>
            )}

            {ticket.status === 'In Progress' && (
              <>
                <ActionButton variant="success" icon="checkmark-done" label="Complete" onPress={() => toggleModal('completion', true)} />
                <ActionButton variant="warning" icon="pause" label="Hold" onPress={() => toggleModal('hold', true)} />
              </>
            )}

            {ticket.status === 'On-Hold' && (
              <>
                <ActionButton variant="success" icon="play" label="Resume" onPress={() => executeAction('unhold', 'put')} />
                <ActionButton variant="danger" icon="close" label="Release" onPress={() => toggleModal('release', true)} />
              </>
            )}
         </View>

         {/* Secondary Actions */}
         <View className="flex-row gap-3">
            <ActionButton variant="neutral" icon="chatbubbles-outline" label="Chat" onPress={() => navigation.navigate('Dashboard', { screen: 'TicketChat', params: { ticketId: ticket._id } })} />
            <ActionButton variant="neutral" icon="information-circle-outline" label="Details" onPress={() => toggleModal('details', true)} />
         </View>
      </View>

      {/* --- MODALS --- */}
      {Object.keys(modals).map(key => {
        if (!modals[key]) return null;
        if (key === 'details') return <TicketDetailsModal key="details" ticket={ticket} isVisible={modals.details} onClose={() => toggleModal('details', false)} />;
        
        let title, content, confirmAction, confirmColor = 'bg-indigo-600';
        
        if (key === 'hold') {
          title = "Hold Ticket";
          content = <TextInput placeholder="Reason..." className="bg-gray-100 p-4 rounded-xl text-base min-h-[100px]" multiline textAlignVertical="top" onChangeText={(t) => updateInput('holdReason', t)} />;
          confirmAction = actions.hold;
          confirmColor = 'bg-amber-500';
        } else if (key === 'release') {
          title = "Release Ticket";
          content = (
            <View>
              <Text className="text-base text-gray-600 leading-relaxed mb-4">Are you sure you want to release this ticket back to the pool? This action cannot be undone.</Text>
              <TextInput 
                placeholder="Reason for releasing (required)..." 
                className="bg-gray-100 p-4 rounded-xl text-base min-h-[100px]" 
                multiline 
                textAlignVertical="top" 
                onChangeText={(text) => updateInput('releaseReason', text)} 
              />
            </View>
          );
          confirmAction = actions.release;
          confirmColor = 'bg-rose-600';
        } else if (key === 'completion') {
          title = "Complete Work";
          content = (
            <View>
              <TextInput placeholder="Describe work completed..." className="bg-gray-100 p-4 rounded-xl text-base min-h-[100px] mb-4" multiline textAlignVertical="top" onChangeText={(t) => updateInput('completionNotes', t)} />
              <TouchableOpacity onPress={actions.pickInvoice} className="border-2 border-dashed border-indigo-200 bg-indigo-50 p-6 rounded-xl items-center justify-center">
                 <Ionicons name={invoice.file ? "document-text" : "cloud-upload"} size={32} color="#4F46E5" />
                 <Text className="text-indigo-700 font-semibold mt-2 text-base">{invoice.file ? invoice.file.name : "Attach Invoice (Optional)"}</Text>
                 {!invoice.file && <Text className="text-indigo-400 text-sm mt-1">Optional - can submit without invoice</Text>}
              </TouchableOpacity>
              {invoice.file && (
                <TouchableOpacity onPress={actions.clearInvoice} className="mt-2 p-2 items-center">
                  <Text className="text-rose-500 text-sm font-medium">Remove Invoice</Text>
                </TouchableOpacity>
              )}
            </View>
          );
          confirmAction = actions.complete;
          confirmColor = 'bg-emerald-600';
        } else if (key === 'location') {
           title = "You have arrived!";
           content = <Text className="text-center text-lg text-gray-700 font-medium">You are within {locationState.distance}m of the site.</Text>;
           confirmAction = () => actions.startWork(true);
           confirmColor = 'bg-green-600';
        }

        return (
          <Modal key={key} transparent visible={true} animationType="fade" onRequestClose={() => toggleModal(key, false)}>
             <View className="flex-1 bg-black/60 justify-center items-center p-4">
                <View className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
                   <View className="p-5 border-b border-gray-100 bg-gray-50/30"><Text className="text-xl font-bold text-gray-900">{title}</Text></View>
                   <View className="p-5">{content}</View>
                   <View className="p-5 bg-gray-50 flex-row gap-4">
                      <TouchableOpacity onPress={() => toggleModal(key, false)} className="flex-1 py-3.5 items-center rounded-xl border border-gray-300 bg-white shadow-sm"><Text className="font-bold text-gray-700 text-base">Cancel</Text></TouchableOpacity>
                      <TouchableOpacity onPress={confirmAction} disabled={invoice.uploading} className={`flex-1 py-3.5 items-center rounded-xl shadow-md ${confirmColor}`}>
                        {invoice.uploading ? <ActivityIndicator color="white" /> : <Text className="font-bold text-white text-base">Confirm</Text>}
                      </TouchableOpacity>
                   </View>
                </View>
             </View>
          </Modal>
        );
      })}
    </View>
  );
};

export default ActiveTicketCard;