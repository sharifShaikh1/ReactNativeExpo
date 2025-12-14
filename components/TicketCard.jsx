import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Share } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatCurrency } from '../utils/formatCurrency';
import TicketDetailsModal from './TicketDetailsModal';

// --- Shared Sub-components ---

// InfoRow: Now accepts textClass, iconColor, and iconSize for highlighting (e.g. Address)
const InfoRow = ({ 
  icon, 
  text, 
  textClass = "text-xs text-gray-500", 
  iconColor = "#9CA3AF", 
  lines = 1, 
  iconSize = 15 
}) => (
  <View className="flex-row items-start mt-2">
    <MaterialCommunityIcons 
      name={icon} 
      size={iconSize} 
      color={iconColor} 
      style={{ marginTop: 2, marginRight: 6 }} 
    />
    <Text 
      className={`flex-1 leading-5 ${textClass}`} 
      numberOfLines={lines} 
      ellipsizeMode="tail"
    >
      {text}
    </Text>
  </View>
);

const Tag = ({ text }) => (
  <View className="bg-indigo-50 border border-indigo-100 rounded-md px-2 py-1 mr-1.5 mb-1">
    <Text className="text-[10px] font-medium text-indigo-700 uppercase tracking-wide">{text}</Text>
  </View>
);

const TicketCard = ({ 
  ticket, 
  onAction, 
  actionLabel = "Accept", 
  hasRequested, 
  disabled, 
  disabledLabel, 
  onRelease, 
  onMoveToCurrent,
  showDisabledLabel = true 
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [releaseModalVisible, setReleaseModalVisible] = useState(false);
  const [releaseReason, setReleaseReason] = useState('');
  const [releasing, setReleasing] = useState(false);

  // Logic for badges
  const isClosed = ticket.status === 'Closed';
  const isPaid = ticket.paymentStatus === 'Paid';

  const handleCopyTicketId = async () => {
    try {
      await Share.share({ message: ticket.ticketId });
    } catch (e) { console.log(e); }
  };

  const handleRelease = async () => {
    if (!onRelease) return;
    setReleasing(true);
    try {
      await onRelease({ ticket, reason: releaseReason });
      setReleaseModalVisible(false);
    } catch (error) {
      console.error(error);
    } finally {
      setReleasing(false);
    }
  };

  const getDisplayDate = () => {
    // Check for activity windows first
    if (Array.isArray(ticket.activityWindows) && ticket.activityWindows.length > 0) {
      const now = new Date();
      const sorted = ticket.activityWindows
        .map(w => ({ ...w, d: new Date(w.date) }))
        .sort((a, b) => a.d - b.d);
      
      const upcoming = sorted.find(w => w.d >= new Date(now.setHours(0, 0, 0, 0)));
      const target = upcoming || sorted[sorted.length - 1];
      
      if (target) {
        const dateStr = target.d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeStr = target.timeFrom ? `${target.timeFrom}${target.timeTo ? ' - ' + target.timeTo : ''}` : 'Flexible';
        return { dateStr, timeStr };
      }
    }
    
    // Fallback to activityStart/activityDate
    if (ticket.activityStart) {
      const d = new Date(ticket.activityStart);
      const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const sTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (ticket.activityEnd) {
        const eTime = new Date(ticket.activityEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return { dateStr, timeStr: `${sTime} - ${eTime}` };
      }
      return { dateStr, timeStr: sTime };
    }
    
    if (ticket.activityDate) {
      const dateStr = new Date(ticket.activityDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = ticket.activityTimeFrom ? `${ticket.activityTimeFrom}${ticket.activityTimeTo ? ' - ' + ticket.activityTimeTo : ''}` : 'Flexible';
      return { dateStr, timeStr };
    }
    
    // No activity schedule - don't show creation date
    return { dateStr: 'No Schedule', timeStr: '' };
  };

  const { dateStr, timeStr } = getDisplayDate();

  return (
    <>
      <View className="bg-white rounded-xl border border-gray-200 mb-4 shadow-sm overflow-hidden relative">
        
        {/* --- Header Section --- */}
        <View className="p-4 border-b border-gray-100 bg-white">
          <View className="flex-row justify-between items-start mb-2">
            
            {/* Left: ID & Company */}
            <View className="flex-1 mr-2">
              <View className="flex-row items-center mb-1.5">
                {/* ID HIGHLIGHTED: Badge style (gray-100 bg, slate-700 text) */}
                <TouchableOpacity 
                  onPress={handleCopyTicketId} 
                  hitSlop={10}
                  className="bg-slate-100 px-2 py-0.5 rounded flex-row items-center border border-slate-200"
                >
                  <Text className="text-xs font-bold text-slate-700 mr-1.5">{ticket.ticketId}</Text>
                  <MaterialCommunityIcons name="content-copy" size={10} color="#64748B" />
                </TouchableOpacity>
              </View>
              
              {/* Company Name */}
              <Text className="text-base font-bold text-gray-900 leading-5" numberOfLines={1}>
                {ticket.companyName}
              </Text>
            </View>

            {/* Right: Price */}
            <View className="items-end">
              <Text className="text-lg font-extrabold text-emerald-600">
                {ticket.amount ? formatCurrency(ticket.amount) : '—'}
              </Text>
              <Text className="text-[10px] text-gray-400 font-medium">ESTIMATED</Text>
            </View>
          </View>

          {/* Location & Date */}
          <View className="mt-1 space-y-1">
            {/* ADDRESS HIGHLIGHTED: Darker icon, larger/bolder text */}
            <InfoRow 
              icon="map-marker-outline" 
              iconColor="#374151" /* Gray-700 */
              iconSize={18}
              text={ticket.siteAddress} 
              textClass="text-sm font-semibold text-gray-900" /* Custom Highlight Classes */
              lines={2} 
            />
            
            {/* Date remains subtle */}
            <InfoRow 
              icon="calendar-clock-outline" 
              text={`${dateStr}${timeStr ? ` • ${timeStr}` : ''}`} 
            />
          </View>

          {/* Payment Status Badge */}
          {isClosed && (
            <View className="absolute top-3 right-3 flex-row items-center px-2 py-1 bg-white rounded-full border border-gray-200 shadow-sm z-10">
              <MaterialCommunityIcons 
                name={isPaid ? 'check-circle' : 'clock-outline'} 
                size={12} 
                color={isPaid ? '#16A34A' : '#EAB308'} 
              />
              <Text className={`text-[10px] font-bold ml-1 ${isPaid ? 'text-green-700' : 'text-yellow-700'}`}>
                {ticket.paymentStatus}
              </Text>
            </View>
          )}
        </View>

        {/* --- Body Section --- */}
        <View className="p-4 pt-3">
          {/* Description: Fixed height */}
          <View className="h-10 justify-center mb-3">
             {ticket.workDescription ? (
              <Text className="text-sm text-gray-600 leading-5" numberOfLines={2}>
                {ticket.workDescription}
              </Text>
             ) : (
               <Text className="text-sm text-gray-400 italic">No description provided</Text>
             )}
          </View>

          {/* Tags */}
          <View className="flex-row flex-wrap mb-4 min-h-[26px]">
            {ticket.expertiseRequired?.slice(0, 3).map((exp, i) => <Tag key={i} text={exp} />)}
            {ticket.expertiseRequired?.length > 3 && (
              <Text className="text-xs text-gray-400 self-center ml-1 pb-1">+{ticket.expertiseRequired.length - 3}</Text>
            )}
            {(!ticket.expertiseRequired || ticket.expertiseRequired.length === 0) && (
               <Text className="text-xs text-gray-400 self-center">General Task</Text>
            )}
          </View>

          {/* --- Footer Actions --- */}
          <View className="flex-row gap-2">
            
            {/* 1. Details */}
            <TouchableOpacity
              onPress={() => setShowDetails(true)}
              className="w-10 py-3 rounded-lg border border-gray-200 bg-gray-50 justify-center items-center"
            >
              <MaterialCommunityIcons name="information-variant" size={20} color="#4B5563" />
            </TouchableOpacity>

            {/* 2. Move To Current */}
            {onMoveToCurrent && (
              <TouchableOpacity
                onPress={() => onMoveToCurrent(ticket)}
                className="px-3 py-3 rounded-lg border border-emerald-200 bg-emerald-50 flex-row justify-center items-center"
              >
                <MaterialCommunityIcons name="arrow-up-bold-box-outline" size={18} color="#059669" />
                <Text className="ml-1 text-xs font-bold text-emerald-700">Current</Text>
              </TouchableOpacity>
            )}

            {/* 3. Release */}
            {onRelease && (
              <TouchableOpacity
                onPress={() => setReleaseModalVisible(true)}
                className="px-3 py-3 rounded-lg border border-red-200 bg-red-50 flex-row justify-center items-center"
              >
                <MaterialCommunityIcons name="close-circle-outline" size={16} color="#DC2626" style={{ marginRight: 4 }} />
                <Text className="text-xs font-bold text-red-700">Release</Text>
              </TouchableOpacity>
            )}

            {/* 4. Main Action */}
            {onAction && (
              <TouchableOpacity
                onPress={onAction}
                disabled={hasRequested || disabled}
                className={`flex-1 py-3 rounded-lg flex-row justify-center items-center shadow-sm ${
                  (hasRequested || disabled) ? 'bg-gray-100 border border-gray-200' : 'bg-indigo-600'
                }`}
              >
                 <Text className={`font-bold text-sm ${
                   (hasRequested || disabled) ? 'text-gray-400' : 'text-white'
                 }`}>
                  {hasRequested ? 'Requested' : (disabled ? (disabledLabel || 'Unavailable') : actionLabel)}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* --- Modals --- */}
      <TicketDetailsModal 
        ticket={ticket} 
        isVisible={showDetails} 
        onClose={() => setShowDetails(false)}
      />

      <Modal transparent visible={releaseModalVisible} animationType="fade" onRequestClose={() => setReleaseModalVisible(false)}>
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <Text className="text-lg font-bold text-gray-900 mb-2">Release Ticket</Text>
            <Text className="text-sm text-gray-500 mb-4">Are you sure? This will remove the ticket from your list.</Text>
            
            <TextInput 
              className="bg-gray-50 border border-gray-200 rounded-lg p-3 min-h-[80px] mb-4 text-sm text-gray-800"
              placeholder="Reason (Optional)"
              placeholderTextColor="#9CA3AF"
              multiline
              textAlignVertical="top"
              value={releaseReason}
              onChangeText={setReleaseReason}
            />
            
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setReleaseModalVisible(false)} className="flex-1 py-3 bg-gray-100 rounded-lg items-center border border-gray-200">
                <Text className="font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRelease} className="flex-1 py-3 bg-red-600 rounded-lg items-center shadow-sm">
                <Text className="font-semibold text-white">{releasing ? 'Processing...' : 'Confirm Release'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default TicketCard;