import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const StatCard = ({ label, value, icon, color, onPress }) => {
  return (
    <TouchableOpacity onPress={onPress} style={{ backgroundColor: `${color}1A`}} className="flex-1 items-center justify-center p-3 rounded-2xl shadow-sm m-1">
      <View className="p-2 rounded-full" style={{ backgroundColor: `${color}33` }}>
         <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text className="text-xl font-bold text-gray-900 mt-2">{value}</Text>
      <Text className="text-xs text-center text-gray-600">{label}</Text>
    </TouchableOpacity>
  );
};

export default StatCard;