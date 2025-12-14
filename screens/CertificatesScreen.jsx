import React, { useState } from 'react';
import { View, Text, SafeAreaView, FlatList, TouchableOpacity, Image, StyleSheet, Alert, ActivityIndicator, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import api from '../utils/api';

const CertificatesScreen = ({ route, navigation }) => {
  const [certificates, setCertificates] = useState(route.params.certificates);
  const [uploading, setUploading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [certificateName, setCertificateName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const fileToBase64 = async (uri) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      return `data:${uri.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'};base64,${base64}`;
    } catch (err) {
      throw new Error(`Failed to convert file to base64: ${err.message}`);
    }
  };

  const handleSelectCertificate = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/png', 'image/jpeg', 'application/pdf'],
      });

      if (result.canceled) return;

      setSelectedFile(result.assets[0]);
      setModalVisible(true);
    } catch (error) {
      Alert.alert('Error', 'Could not select file.');
    }
  };

  const handleAddCertificate = async () => {
    if (!certificateName.trim()) {
      return Alert.alert('Validation Error', 'Please enter a name for the certificate.');
    }
    if (uploading) return;

    try {
      setUploading(true);
      const certificateBase64 = await fileToBase64(selectedFile.uri);

      const certificateData = {
        name: certificateName,
        issuedAt: new Date().toISOString(),
        certificate: certificateBase64,
      };

      const response = await api.post('/auth/certificates', certificateData);
      setCertificates(response.data.certificates);
      Alert.alert('Success', 'Certificate added successfully.');

    } catch (error) {
      Alert.alert('Upload Error', error.response?.data?.message || 'Failed to add certificate.');
    } finally {
      setUploading(false);
      setModalVisible(false);
      setCertificateName('');
      setSelectedFile(null);
    }
  };

  const handleDeleteCertificate = (certificateId) => {
    Alert.alert(
      "Delete Certificate",
      "Are you sure you want to delete this certificate?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          onPress: async () => {
            try {
              const response = await api.delete(`/auth/certificates/${certificateId}`);
              setCertificates(response.data.certificates);
              Alert.alert('Success', 'Certificate deleted successfully.');
            } catch (error) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to delete certificate.');
            }
          },
          style: "destructive",
        },
      ]
    );
  };

  const renderCertificateCard = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('CertificateDetail', { uri: item.url, name: item.name })}
    >
      <Image source={{ uri: item.url }} style={styles.thumbnail} />
      <View style={styles.certInfo}>
        <Text style={styles.certName}>{item.name}</Text>
        {item.issuedAt && (
          <Text style={styles.certDate}>Issued: {new Date(item.issuedAt).toLocaleDateString()}</Text>
        )}
      </View>
      <TouchableOpacity onPress={() => handleDeleteCertificate(item._id)} style={styles.deleteButton}>
        <Ionicons name="trash-bin" size={24} color="#D32F2F" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Certificates</Text>
      </View>
      <FlatList
        data={certificates}
        renderItem={renderCertificateCard}
        keyExtractor={(item, index) => item._id + index}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No certificates found.</Text>
          </View>
        }
      />
      <TouchableOpacity style={styles.fab} onPress={handleSelectCertificate}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>Enter Certificate Name</Text>
            <TextInput
              style={styles.input}
              onChangeText={setCertificateName}
              value={certificateName}
              placeholder="e.g., Cisco CCNA"
            />
            <TouchableOpacity
              style={[styles.button, styles.buttonClose]}
              onPress={handleAddCertificate}
              disabled={uploading}
            >
              {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.textStyle}>Add Certificate</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f2f5',
      },
      header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
      },
      backButton: {
        marginRight: 10,
      },
      headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
      },
      listContainer: {
        padding: 16,
      },
      card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
      thumbnail: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 12,
      },
      certInfo: {
        flex: 1,
      },
      certName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
      },
      certDate: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
      },
      deleteButton: {
        padding: 8,
      },
      emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 50,
      },
      emptyText: {
        fontSize: 16,
        color: '#666',
      },
      fab: {
        position: 'absolute',
        width: 56,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        right: 20,
        bottom: 20,
        backgroundColor: '#4F46E5',
        borderRadius: 28,
        elevation: 8,
      },
      centeredView: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: 'rgba(0,0,0,0.5)'
      },
      modalView: {
        margin: 20,
        backgroundColor: "white",
        borderRadius: 20,
        padding: 35,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 2
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5
      },
      modalText: {
        marginBottom: 15,
        textAlign: "center",
        fontSize: 18,
        fontWeight: 'bold'
      },
      input: {
        height: 40,
        borderColor: 'gray',
        borderWidth: 1,
        marginBottom: 20,
        width: 200,
        paddingHorizontal: 10,
        borderRadius: 5
      },
      button: {
        borderRadius: 20,
        padding: 10,
        elevation: 2
      },
      buttonClose: {
        backgroundColor: "#2196F3",
      },
      textStyle: {
        color: "white",
        fontWeight: "bold",
        textAlign: "center"
      }
});

export default CertificatesScreen;