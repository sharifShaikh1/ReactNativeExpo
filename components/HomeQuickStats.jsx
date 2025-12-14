import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Dimensions } from 'react-native';

const MetricCard = ({ iconName, iconColor, label, value }) => {
  const bgMap = {
    '#4F46E5': '#EEF2FF', // indigo
    '#059669': '#ECFDF5', // green
    '#DC2626': '#FEF2F2', // red
    '#10B981': '#ECFDF5', // success
    '#F59E0B': '#FFFBEB', // amber
  };
  const bg = bgMap[iconColor] || '#F3F4F6';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconWrap, { backgroundColor: bg }]}> 
          <MaterialIcons name={iconName} size={22} color={iconColor} />
        </View>
        <Text style={[styles.value, { color: iconColor }]}>{typeof value === 'number' ? value : (value ?? 0)}</Text>
      </View>
      <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">{label}</Text>
    </View>
  );
};

const HomeQuickStats = ({ stats = {} }) => {
  const win = Dimensions.get('window');
  const isSmall = win.width < 380;
  return (
    <View style={[styles.row, isSmall && styles.rowSmall]}>
      <MetricCard iconName="confirmation-number" iconColor="#4F46E5" label="Available" value={stats.available ?? 0} />
      <MetricCard iconName="assignment" iconColor="#059669" label="Accepted" value={stats.accepted ?? 0} />
      <MetricCard iconName="access-time" iconColor="#F59E0B" label="Active" value={stats.active ? 1 : 0} />
      <MetricCard iconName="check-circle" iconColor="#10B981" label="Completed" value={stats.completed ?? 0} />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginVertical: 12,
    paddingHorizontal: 4,
  },
  rowSmall: {
    marginVertical: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexBasis: '48%',
    maxWidth: '48%',
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 0.2,
  }
});

export default HomeQuickStats;
