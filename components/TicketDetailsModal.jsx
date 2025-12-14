import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Share,
  Linking,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { API_BASE_URL } from '../config/apiConfig';
import { showMessage } from 'react-native-flash-message';
import ImageViewer from './ImageViewer';
import api from '../utils/api';
import { formatCurrency } from '../utils/formatCurrency';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const { height } = Dimensions.get('window');

const TicketDetailsModal = ({ ticket, isVisible, onClose }) => {
  if (!ticket) return null;

  const handleCopyTicketId = () => {
    try {
      if (require('react-native').Clipboard) {
        require('react-native').Clipboard.setString(ticket.ticketId);
        showMessage({
          message: 'Copied!',
          description: `Ticket ID: ${ticket.ticketId}`,
          type: 'success',
          duration: 2,
        });
      }
    } catch (error) {
      console.log('Copy to clipboard not available');
      // Fallback to share
      Share.share({
        message: ticket.ticketId,
        title: 'Ticket ID',
      }).catch(err => console.log(err));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Open':
        return { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800', icon: 'clock-outline' };
      case 'In Progress':
        return { bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-800', icon: 'progress-clock' };
      case 'Closed':
        return { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-800', icon: 'check-circle' };
      case 'On-Hold':
        return { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-800', icon: 'pause-circle' };
      default:
        return { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-800', icon: 'help-circle' };
    }
  };

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerUri, setViewerUri] = useState(null);

  // Helper: pick next activity window (same logic as admin/mobile cards)
  const pickNextActivityWindow = (windows) => {
    if (!Array.isArray(windows) || windows.length === 0) return null;
    const now = new Date();
    const normalized = windows.map(w => {
      let d = w && w.date ? (w.date instanceof Date ? w.date : new Date(w.date)) : null;
      if (d && isNaN(d.getTime())) {
        try {
          const parts = String(w.date).split('-').map(Number);
          if (parts.length === 3) d = new Date(parts[0], parts[1]-1, parts[2]);
        } catch (e) { d = null; }
      }
      return { date: d, timeFrom: w.timeFrom, timeTo: w.timeTo };
    }).filter(x => x.date);

    if (normalized.length === 0) return null;

    const upcoming = normalized.filter(w => {
      const wd = new Date(w.date.getFullYear(), w.date.getMonth(), w.date.getDate());
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return wd >= today;
    }).sort((a,b) => a.date - b.date);

    if (upcoming.length > 0) return upcoming[0];
    normalized.sort((a,b) => b.date - a.date);
    return normalized[0];
  };

  // Compute activity date/time to display in details
  let activityDateDisplay = null;
  let activityTimeDisplay = null;
  const nextWindow = ticket.activityWindows ? pickNextActivityWindow(ticket.activityWindows) : null;
  if (nextWindow && nextWindow.date) {
    const s = new Date(nextWindow.date);
    activityDateDisplay = s.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    if (nextWindow.timeFrom && nextWindow.timeTo) activityTimeDisplay = `${nextWindow.timeFrom} — ${nextWindow.timeTo}`;
    else if (nextWindow.timeFrom) activityTimeDisplay = nextWindow.timeFrom;
  } else if (ticket.activityStart && ticket.activityEnd) {
    const s = new Date(ticket.activityStart);
    const e = new Date(ticket.activityEnd);
    activityDateDisplay = s.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const sTime = s.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const eTime = e.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    activityTimeDisplay = `${sTime} — ${eTime}`;
  } else if (ticket.activityStart) {
    const s = new Date(ticket.activityStart);
    activityDateDisplay = s.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    activityTimeDisplay = s.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } else {
    activityDateDisplay = ticket.activityDate ? new Date(ticket.activityDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
    if (ticket.activityTimeFrom && ticket.activityTimeTo) activityTimeDisplay = `${ticket.activityTimeFrom} — ${ticket.activityTimeTo}`;
    else if (ticket.activityTimeFrom) activityTimeDisplay = ticket.activityTimeFrom;
  }

  const statusColor = getStatusColor(ticket.status);
  const isPaid = ticket.paymentStatus === 'Paid';
  const isClosed = ticket.status === 'Closed';

  const supervisors = ticket.supervisors || [];
  // The backend now uses `onSiteLocalContacts` on tickets.
  // Keep a legacy fallback to `ticket.serviceProviders` for older tickets.
  const onSiteLocalContacts = ticket.onSiteLocalContacts || ticket.serviceProviders || [];
  const clients = ticket.clients || [];

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-black/50">
        <View className="flex-1 bg-white rounded-t-3xl mt-8 shadow-2xl">
          {/* Modal Header */}
          <View className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-4 rounded-t-3xl flex-row justify-between items-center">
            <Text className="text-xl font-bold text-white flex-1">Ticket Details</Text>
            <TouchableOpacity onPress={onClose} className="p-2">
              <MaterialCommunityIcons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Scrollable Content */}
          <ScrollView 
            className="flex-1 px-4 py-4"
            showsVerticalScrollIndicator={true}
            scrollIndicatorInsets={{ right: 1 }}
          >
            {/* Ticket ID & Amount Section */}
            <View className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-4 mb-4 border border-indigo-200">
              <View className="flex-row justify-between items-start mb-3">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-xs text-indigo-600 font-bold tracking-widest">TICKET ID</Text>
                    <TouchableOpacity 
                      onPress={handleCopyTicketId}
                      className="p-1"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialCommunityIcons name="content-copy" size={14} color="#4F46E5" />
                    </TouchableOpacity>
                  </View>
                  <Text className="text-2xl font-bold text-gray-900">{ticket.ticketId}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs text-green-600 font-bold mb-1">AMOUNT</Text>
                  <Text className="text-2xl font-bold text-green-600">{formatCurrency(ticket.amount)}</Text>
                </View>
              </View>
              <View className="h-0.5 bg-indigo-200 mb-3" />
              <Text className="text-xs text-gray-500">Est. Payment for completion</Text>
            </View>

            {/* Company & Status */}
            <View className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
              <View className="mb-3">
                <Text className="text-xs font-bold text-gray-600 mb-1 tracking-wider">COMPANY</Text>
                <Text className="text-lg font-bold text-gray-900">{ticket.companyName}</Text>
              </View>
              <View className="flex-row gap-2 items-center">
                <MaterialCommunityIcons name={statusColor.icon} size={20} color="#4F46E5" />
                <View>
                  <Text className="text-xs font-bold text-gray-600 tracking-wider">STATUS</Text>
                  <Text className={`text-base font-bold ${statusColor.text}`}>{ticket.status}</Text>
                </View>
              </View>
            </View>

            {/* Location Section */}
            <View className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
              <View className="flex-row gap-2 mb-2">
                <MaterialCommunityIcons name="map-marker" size={20} color="#6B7280" />
                <Text className="text-xs font-bold text-gray-600 tracking-wider">SITE ADDRESS</Text>
              </View>
              <Text className="text-base text-gray-900 font-medium ml-7">{ticket.siteAddress}</Text>
            </View>

            {/* Activity Schedule */}
            <View className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
              <View className="flex-row gap-2 mb-2">
                <MaterialCommunityIcons name="calendar-blank" size={20} color="#6B7280" />
                <Text className="text-xs font-bold text-gray-600 tracking-wider">ACTIVITY SCHEDULE</Text>
              </View>
              <View className="ml-7">
                <Text className="text-sm text-gray-800 font-medium">{activityDateDisplay || 'Not scheduled'}</Text>
                {activityTimeDisplay && (
                  <View className="flex-row items-center mt-1">
                    <MaterialCommunityIcons name="clock-outline" size={16} color="#6B7280" />
                    <Text className="text-sm text-gray-600 ml-2">{activityTimeDisplay}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Work Description + Attachments (single section) */}
            {ticket.workDescription && (
              <View className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
                <View className="flex-row gap-2 mb-2">
                  <MaterialCommunityIcons name="note-text" size={20} color="#6B7280" />
                  <Text className="text-xs font-bold text-gray-600 tracking-wider">WORK DESCRIPTION</Text>
                </View>
                <Text className="text-base text-gray-800 ml-7 leading-5">{ticket.workDescription}</Text>

                {/* Inline attachments for the work description */}
                {ticket.workDescriptionFiles && ticket.workDescriptionFiles.length > 0 && (
                  <View className="mt-3 ml-7">
                    {ticket.workDescriptionFiles.map((fileUrl, idx) => {
                      const fileName = (fileUrl || '').split('/').pop();
                      const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
                      const isImage = ['jpg','jpeg','png','webp','gif'].includes(ext);

                      const handleOpen = async () => {
                        try {
                          if (isImage) {
                            setViewerUri(fileUrl);
                            setViewerVisible(true);
                            return;
                          }
                          const supported = await Linking.canOpenURL(fileUrl);
                          if (supported) {
                            await Linking.openURL(fileUrl);
                          } else {
                            Alert.alert('Cannot open file', 'This file cannot be opened on your device.');
                          }
                        } catch (err) {
                          console.error('Error opening attachment', err);
                          Alert.alert('Error', 'Could not open attachment.');
                        }
                      };

                      return (
                        <TouchableOpacity key={idx} onPress={handleOpen} className="flex-row items-center py-2">
                          <MaterialCommunityIcons name={isImage ? 'image-outline' : 'file-outline'} size={18} color="#6B7280" style={{ marginRight: 8 }} />
                          <Text className="text-sm text-indigo-700 underline">{fileName || `Attachment ${idx+1}`}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Expertise Required */}
            <View className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
              <View className="flex-row gap-2 mb-3">
                {/* Tools icon is a better metaphor for expertise than a briefcase */}
                <MaterialCommunityIcons name="tools" size={20} color="#6B7280" />
                <Text className="text-xs font-bold text-gray-600 tracking-wider">EXPERTISE REQUIRED</Text>
              </View>
              <View className="flex-row flex-wrap gap-2 ml-7">
                {ticket.expertiseRequired && ticket.expertiseRequired.length > 0 ? (
                  <>
                    {ticket.expertiseRequired.map(exp => (
                      <View key={exp} className="bg-indigo-100 border border-indigo-300 rounded-full px-4 py-2">
                        <Text className="text-sm font-bold text-indigo-800">{exp}</Text>
                      </View>
                    ))}

                    {/* Invoice (if attached) */}
                    {ticket.invoice && ticket.invoice.originalKey && (
                      <View className="mt-3 ml-7">
                        <Text className="text-xs text-gray-500">Invoice</Text>
                        <View className="flex-row items-center py-2">
                          <MaterialCommunityIcons name="file-document-outline" size={18} color="#6B7280" style={{ marginRight: 8 }} />
                          <TouchableOpacity onPress={async () => {
                            try {
                              // Download authenticated stream via expo-file-system (adds Authorization header)
                              const url = `${API_BASE_URL}/api/tickets/${ticket._id}/invoice/view`;
                              const authHeader = api.defaults?.headers?.common?.['Authorization'] || '';
                              const headers = {};
                              if (authHeader) headers['Authorization'] = authHeader;

                              const fileName = ticket.invoice.filename || `invoice-${ticket._id}`;
                              // Ensure safe filename
                              const safeName = fileName.replace(/[^a-z0-9_.-]/gi, '_');
                              const destUri = `${FileSystem.cacheDirectory}${safeName}`;

                              // Download to local cache
                              const downloadRes = await FileSystem.downloadAsync(url, destUri, { headers });

                              if (downloadRes && downloadRes.status === 200) {
                                // Open with native share/viewer
                                if (await Sharing.isAvailableAsync()) {
                                  await Sharing.shareAsync(downloadRes.uri);
                                } else {
                                  Alert.alert('Downloaded', `File saved to ${downloadRes.uri}`);
                                }
                              } else {
                                console.error('Download failed', downloadRes);
                                Alert.alert('Error', 'Failed to download invoice.');
                              }
                            } catch (err) {
                              console.error('Error downloading/opening invoice', err);
                              Alert.alert('Error', 'Could not download or open invoice.');
                            }
                          }}>
                            <Text className="text-sm text-indigo-700 underline">{ticket.invoice.filename || 'Download Invoice'}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </>
                ) : (
                  <Text className="text-sm text-gray-500">No specific expertise required</Text>
                )}
              </View>
            </View>

            {/* Payment Status */}
            {isClosed && (
              <View className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
                <View className="flex-row gap-2 items-center">
                  <MaterialCommunityIcons 
                    name={isPaid ? 'check-circle' : 'clock-outline'} 
                    size={20} 
                    color={isPaid ? '#16A34A' : '#EAB308'} 
                  />
                  <View>
                    <Text className="text-xs font-bold text-gray-600 tracking-wider">PAYMENT STATUS</Text>
                    <Text className={`text-base font-bold ${isPaid ? 'text-green-700' : 'text-yellow-700'}`}>
                      {ticket.paymentStatus}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Supervisors - Contact Information */}
            {supervisors && supervisors.length > 0 && (
              <View className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
                <View className="flex-row gap-2 mb-3">
                  <MaterialCommunityIcons name="account-tie" size={20} color="#6B7280" />
                  <Text className="text-xs font-bold text-gray-600 tracking-wider">SUPERVISORS</Text>
                </View>
                {supervisors.map((supervisor, index) => (
                  <View key={index} className="ml-7 mb-3 pb-3 border-b border-gray-100 last:border-0">
                    <View className="flex-row items-center gap-2 mb-1">
                      <MaterialCommunityIcons name="account-circle" size={16} color="#4F46E5" />
                      <Text className="text-base font-bold text-gray-900">
                        {supervisor.fullName || supervisor.name}
                      </Text>
                    </View>
                    {supervisor.phoneNumber && (
                      <View className="flex-row items-center gap-2 ml-6 mb-1">
                        <MaterialCommunityIcons name="phone" size={14} color="#10B981" />
                        <Text className="text-sm text-gray-700 font-medium">{supervisor.phoneNumber}</Text>
                      </View>
                    )}
                    {supervisor.email && (
                      <View className="flex-row items-center gap-2 ml-6">
                        <MaterialCommunityIcons name="email" size={14} color="#10B981" />
                        <Text className="text-sm text-gray-700 font-medium">{supervisor.email}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* On-site Local Contact(s) - Contact Information (matches admin naming) */}
            {onSiteLocalContacts && onSiteLocalContacts.length > 0 && (
              <View className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
                <View className="flex-row gap-2 mb-3">
                  <MaterialCommunityIcons name="account-hard-hat" size={20} color="#3B82F6" />
                  <Text className="text-xs font-bold text-gray-600 tracking-wider">ON-SITE LOCAL CONTACTS</Text>
                </View>
                {onSiteLocalContacts.map((sp, index) => (
                  <View key={index} className="ml-7 mb-3 pb-3 border-b border-gray-100 last:border-0">
                    <View className="flex-row items-center gap-2 mb-1">
                      <MaterialCommunityIcons name="account-circle" size={16} color="#3B82F6" />
                      <Text className="text-base font-bold text-gray-900">
                        {sp.fullName || sp.name}
                      </Text>
                    </View>
                    {sp.phoneNumber && (
                      <View className="flex-row items-center gap-2 ml-6 mb-1">
                        <MaterialCommunityIcons name="phone" size={14} color="#3B82F6" />
                        <Text className="text-sm text-gray-700 font-medium">{sp.phoneNumber}</Text>
                      </View>
                    )}
                    {sp.email && (
                      <View className="flex-row items-center gap-2 ml-6">
                        <MaterialCommunityIcons name="email" size={14} color="#3B82F6" />
                        <Text className="text-sm text-gray-700 font-medium">{sp.email}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Project SPOC(s) - Contact Information (matches admin naming) */}
            {clients && clients.length > 0 && (
              <View className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
                <View className="flex-row gap-2 mb-3">
                  <MaterialCommunityIcons name="account-tie" size={20} color="#10B981" />
                  <Text className="text-xs font-bold text-gray-600 tracking-wider">PROJECT (SPOC)</Text>
                </View>
                {clients.map((client, index) => (
                  <View key={index} className="ml-7 mb-3 pb-3 border-b border-gray-100 last:border-0">
                    <View className="flex-row items-center gap-2 mb-1">
                      <MaterialCommunityIcons name="account-circle" size={16} color="#10B981" />
                      <Text className="text-base font-bold text-gray-900">
                        {client.fullName || client.name}
                      </Text>
                    </View>
                    {client.phoneNumber && (
                      <View className="flex-row items-center gap-2 ml-6 mb-1">
                        <MaterialCommunityIcons name="phone" size={14} color="#10B981" />
                        <Text className="text-sm text-gray-700 font-medium">{client.phoneNumber}</Text>
                      </View>
                    )}
                    {client.email && (
                      <View className="flex-row items-center gap-2 ml-6">
                        <MaterialCommunityIcons name="email" size={14} color="#10B981" />
                        <Text className="text-sm text-gray-700 font-medium">{client.email}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Additional Info */}
            <View className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
              <Text className="text-xs font-bold text-gray-600 mb-2 tracking-wider">ADDITIONAL INFORMATION</Text>
              <View className="space-y-2">
                <View className="flex-row justify-between">
                  <Text className="text-sm text-gray-600">Required Engineers:</Text>
                  <Text className="text-sm font-bold text-gray-900">{ticket.requiredEngineers || 'N/A'}</Text>
                </View>
                {ticket.acceptedEngineersCount !== undefined && (
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-gray-600">Accepted Engineers:</Text>
                    <Text className="text-sm font-bold text-gray-900">{ticket.acceptedEngineersCount}</Text>
                  </View>
                )}

              </View>
            </View>

            {/* Close Button */}
            <TouchableOpacity 
              onPress={onClose}
              className="bg-indigo-600 rounded-lg p-4 mb-6 items-center"
            >
              <Text className="text-white font-bold text-base">Close Details</Text>
            </TouchableOpacity>
            
            {/* Image Viewer Modal for attachments */}
            <ImageViewer
              visible={viewerVisible}
              onClose={() => { setViewerVisible(false); setViewerUri(null); }}
              imageUri={viewerUri}
              senderName={ticket.companyName}
              timestamp={ticket.createdAt}
            />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default TicketDetailsModal;
