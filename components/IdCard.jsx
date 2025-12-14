
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

const IdCard = ({ user }) => {
  if (!user) {
    return null;
  }

  const qrValue = `This person is a Verified Person by NetCovet.\n\nDetails:\n- Employee ID: ${user.employeeId}\n- Full Name: ${user.fullName}\n- Email: ${user.email}`;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Image
          source={{ uri: user.documents?.profilePicture }}
          style={styles.profilePicture}
        />
        <View style={styles.headerText}>
          <Text style={styles.fullName}>{user.fullName}</Text>
          <Text style={styles.role}>{user.role}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.qrCodeContainer}>
          <QRCode
            value={qrValue}
            size={100}
            backgroundColor="white"
            color="black"
          />
        </View>
        <View style={styles.details}>
          <Text style={styles.detailItem}>
            <Text style={styles.label}>Employee ID:</Text> {user.employeeId}
          </Text>
          <Text style={styles.detailItem}>
            <Text style={styles.label}>Email:</Text> {user.email}
          </Text>
          <Text style={styles.detailItem}>
            <Text style={styles.label}>Phone:</Text> {user.phoneNumber}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profilePicture: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#4F46E5',
  },
  headerText: {
    marginLeft: 15,
  },
  fullName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  role: {
    fontSize: 16,
    color: '#6B7280',
  },
  body: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  qrCodeContainer: {
    marginBottom: 20,
  },
  details: {
    alignItems: 'center',
  },
  detailItem: {
    fontSize: 14,
    marginBottom: 10,
    color: '#374151',
  },
  label: {
    fontWeight: 'bold',
  },
});

export default IdCard;
