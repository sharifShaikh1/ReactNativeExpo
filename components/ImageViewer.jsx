import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';

const ImageViewer = ({ visible, onClose, imageUri, senderName, timestamp, isLoading }) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleShare = async () => {
    setMenuVisible(false);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing is not available on your device.');
        return;
      }
      await Sharing.shareAsync(imageUri);
    } catch (error) {
      Alert.alert('Error', 'Could not share the image.');
    }
  };

  const handleSave = async () => {
    setMenuVisible(false);
    setIsSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to save images to your gallery.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(imageUri);
      Alert.alert('Saved!', 'The image has been saved to your gallery.');
    } catch (error) {
      Alert.alert('Error', 'Could not save the image.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    setMenuVisible(false);
    Alert.alert('Delete', 'This will be implemented in a future update.');
    // Here you would typically call a function passed via props to update the message state
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View>
            <Text style={styles.senderName}>{senderName}</Text>
            <Text style={styles.timestamp}>{new Date(timestamp).toLocaleString()}</Text>
          </View>
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.headerButton}>
            <Ionicons name="ellipsis-vertical" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
          {(isLoading || isSaving) && (
            <View style={StyleSheet.absoluteFill}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
        </View>

        {menuVisible && (
          <Modal visible={menuVisible} transparent={true} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
            <TouchableOpacity style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
              <View style={styles.menu}>
                <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
                  <Text style={styles.menuText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handleSave}>
                  <Text style={styles.menuText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                  <Text style={styles.menuText}>Delete for me</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 2, // Drastically reduced from 5
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  headerButton: {
    padding: 8,
  },
  senderName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  timestamp: {
    color: '#ccc',
    fontSize: 12,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  menuOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 50,
    paddingRight: 10,
  },
  menu: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  menuText: {
    fontSize: 16,
  },
});

export default ImageViewer;