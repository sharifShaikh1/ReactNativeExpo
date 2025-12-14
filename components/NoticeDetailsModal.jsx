import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import api from '../utils/api';
import { API_BASE_URL } from '../config/apiConfig';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

const NoticeDetailsModal = ({ visible, notice, onClose }) => {
  if (!notice) return null;
  const typeColor = notice.type === 'urgent' ? '#DC2626' : (notice.type === 'important' ? '#F59E0B' : '#4F46E5');
  const displayDate = notice.publishAt ? new Date(notice.publishAt).toLocaleString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : 'Unknown';

  const [acknowledged, setAcknowledged] = React.useState(false);

  // Build a sensible static company/name for demo
  const author = notice.authorName || notice.author || 'NetCovet Ops';
  const company = notice.companyName || notice.companyId || 'Global';

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: `${typeColor}15` }]}>
              <MaterialCommunityIcons name={notice.type === 'urgent' ? 'alert-circle' : 'information'} size={24} color={typeColor} />
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{notice.title}</Text>
            <Text style={styles.meta}>{displayDate}</Text>

            <View style={styles.divider} />

            <Text style={styles.body}>{notice.body}</Text>

            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Type</Text>
                <View style={[styles.badge, { backgroundColor: `${typeColor}15` }]}>
                  <Text style={[styles.badgeText, { color: typeColor }]}>{notice.type?.toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>From</Text>
                <Text style={styles.infoValue}>{company}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Author</Text>
                <Text style={styles.infoValue}>{author}</Text>
              </View>
            </View>

            {notice.attachments && notice.attachments.length > 0 && (
              <View style={styles.attachmentsSection}>
                <Text style={styles.sectionTitle}>Attachments</Text>
                {notice.attachments.map((att, idx) => (
                  <TouchableOpacity key={idx} onPress={async () => {
                    try {
                      const url = `${API_BASE_URL}/api/notices/${notice._id}/attachments/${att.originalKey}`;
                      const headers = {};
                      const authHeader = api.defaults?.headers?.common?.['Authorization'];
                      if (authHeader) headers['Authorization'] = authHeader;
                      const dest = `${FileSystem.cacheDirectory}${att.filename || 'attachment'}`;
                      const download = await FileSystem.downloadAsync(url, dest, { headers });
                      if (await Sharing.isAvailableAsync()) {
                        await Sharing.shareAsync(download.uri);
                      } else {
                        Alert.alert('Downloaded', `Saved to ${download.uri}`);
                      }
                    } catch (err) {
                      console.error('Attachment open error', err);
                      Alert.alert('Error', 'Could not open attachment.');
                    }
                  }} style={styles.attachmentItem}>
                    <View style={styles.attachmentIcon}>
                      <Ionicons name="document-text-outline" size={20} color="#4F46E5" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.attachmentName}>{att.filename || 'Attachment'}</Text>
                      <Text style={styles.attachmentType}>{att.mimeType || 'File'}</Text>
                    </View>
                    <Ionicons name="download-outline" size={20} color="#6B7280" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.actionSection}>
              <TouchableOpacity 
                style={[styles.button, acknowledged ? styles.buttonSuccess : styles.buttonPrimary]} 
                onPress={() => setAcknowledged(true)}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name={acknowledged ? "checkmark-circle" : "checkmark-circle-outline"} 
                  size={20} 
                  color="white" 
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.buttonText}>
                  {acknowledged ? 'Acknowledged' : 'Acknowledge Notice'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  content: {
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  meta: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 20,
  },
  body: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 24,
  },
  infoSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  attachmentsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  attachmentIcon: {
    width: 36,
    height: 36,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  attachmentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  attachmentType: {
    fontSize: 12,
    color: '#6B7280',
  },
  actionSection: {
    marginTop: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonPrimary: {
    backgroundColor: '#4F46E5',
  },
  buttonSuccess: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default NoticeDetailsModal;
