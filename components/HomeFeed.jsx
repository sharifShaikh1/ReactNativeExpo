import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialIcons } from '@expo/vector-icons';

const NoticeItem = ({ notice, onPress }) => {
  const typeColor = notice.type === 'urgent' ? '#DC2626' : (notice.type === 'important' ? '#F59E0B' : '#4F46E5');
  const displayDate = notice.publishAt ? new Date(notice.publishAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
  
  return (
    <TouchableOpacity style={styles.noticeCard} onPress={() => onPress && onPress(notice)} activeOpacity={0.7}>
      <View style={styles.noticeHeader}>
        <View style={[styles.tagContainer, { backgroundColor: `${typeColor}15` }]}>
          <View style={[styles.dot, { backgroundColor: typeColor }]} />
          <Text style={[styles.tagText, { color: typeColor }]}>
            {notice.type?.toUpperCase() || 'INFO'}
          </Text>
        </View>
        <Text style={styles.dateText}>{displayDate}</Text>
      </View>
      
      <Text style={styles.title} numberOfLines={1}>{notice.title}</Text>
      <Text numberOfLines={2} style={styles.body}>{notice.body}</Text>
      
      <View style={styles.footer}>
        <Text style={styles.readMore}>Read more</Text>
        <Ionicons name="arrow-forward" size={16} color="#4F46E5" />
      </View>
    </TouchableOpacity>
  );
};

const HomeFeed = ({ items = [], previewNotices, setPreviewNotices, onItemPress, useFlatList = true, hideHeader = false, containerStyle }) => {
  if (!items || items.length === 0) return null;
  
  return (
    <View style={[styles.container, containerStyle]}>
         {!hideHeader && (
           <View style={styles.headerRow}>
             <Text style={styles.headerTitle}>Latest Notices</Text>
             <TouchableOpacity 
               style={styles.previewButton} 
               onPress={() => setPreviewNotices && setPreviewNotices(p => !p)}
             >
               <MaterialIcons name={previewNotices ? 'visibility-off' : 'visibility'} size={16} color="#6B7280" />
               <Text style={styles.previewText}>{previewNotices ? 'Hide' : 'Show All'}</Text>
             </TouchableOpacity>
           </View>
         )}
      {useFlatList ? (
      <FlatList
        data={items}
        keyExtractor={(i) => i._id}
        renderItem={({ item }) => <NoticeItem onPress={onItemPress} notice={item} />}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      />
      ) : (
        <View>
          {items.map(item => <NoticeItem key={item._id} notice={item} onPress={onItemPress} />)}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  previewText: {
    marginLeft: 6,
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '600',
  },
  noticeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dateText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
    lineHeight: 24,
  },
  body: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  readMore: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F46E5',
    marginRight: 4,
  },
});

export default HomeFeed;
