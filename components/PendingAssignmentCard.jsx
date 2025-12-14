import React from 'react';
import { formatCurrency } from '../utils/formatCurrency';
import { View, Text, TouchableOpacity } from 'react-native';

const PendingAssignmentCard = ({ ticket, onAccept, onReject }) => {
  return (
    <View className="bg-white p-4 rounded-2xl shadow-md border-l-4 border-red-500 mb-4">
      <Text className="text-xs text-red-600 font-bold uppercase">Action Required</Text>
      <Text className="text-lg font-bold text-gray-800 mt-1">{ticket.companyName}</Text>
      {ticket.amount !== undefined && ticket.amount !== null && (
        <Text style={{ marginTop: 6, fontSize: 16, fontWeight: '700', color: '#10B981' }}>{formatCurrency(ticket.amount)}</Text>
      )}
      <Text className="text-sm text-gray-600 mt-1">{ticket.siteAddress}</Text>
      <View className="border-t border-gray-100 my-3" />
      <View className="flex-row justify-between space-x-2">
        <TouchableOpacity onPress={onReject} className="flex-1 bg-red-100 p-3 rounded-lg items-center">
          <Text className="text-red-800 font-bold text-sm">Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onAccept} className="flex-1 bg-green-100 p-3 rounded-lg items-center">
          <Text className="text-green-800 font-bold text-sm">Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default PendingAssignmentCard;
