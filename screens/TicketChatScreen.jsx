import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, Alert, FlatList, Keyboard, ScrollView, Image, Platform, KeyboardAvoidingView, Dimensions
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ChatMessageBubble from '../components/ChatMessageBubble';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { API_BASE_URL } from '../config/apiConfig';
import { generateSignature } from '../utils/hmac';

const TicketChatScreen = ({ route, navigation }) => {
  const { ticketId, chatTitle } = route.params;
  const insets = useSafeAreaInsets();
  const socket = useSocket();
  const { user, token } = useAuth();
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [conversationId, setConversationId] = useState(null);
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  
  const flatListRef = useRef(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const shouldAutoScroll = useRef(true);

  // --- Keyboard Listeners ---
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const onReplySwipe = useCallback((message) => {
    setReplyingToMessage(message);
  }, []);

  // --- Socket Connection & Message Handling ---
  const joinRoom = useCallback((cb) => {
    if (!socket || !ticketId) {
      if (cb) cb(new Error('Socket/ticketId missing'));
      return;
    }
    socket.emit('joinTicketRoom', ticketId, (response) => {
      if (response.success) {
        socket.emit('fetchMessages', { ticketId }, (res) => {
          if (res.messages) {
            // CHANGE: Sort DESCENDING (Newest first) for Inverted List
            const sorted = res.messages.slice().sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
            setMessages(sorted);
            setConversationId(res.conversationId);
            setLoading(false);
            setIsArchived(false);
            if (cb) cb(null, res);
          }
        });
      } else {
        console.error('Failed to join ticket room:', response.message);
        if (response.message && response.message.toLowerCase().includes('archiv')) {
          setIsArchived(true);
        }
        setLoading(false);
        if (cb) cb(new Error(response.message));
      }
    });
  }, [socket, ticketId]);

  useEffect(() => {
    if (!socket || !user || !ticketId) return;

    joinRoom();

    const handleReceiveMessage = (message) => {
      setMessages((prevMessages) => {
        const existsById = prevMessages.findIndex(msg => msg._id && message._id && String(msg._id) === String(message._id));
        if (existsById > -1) {
          const updated = [...prevMessages];
          updated[existsById] = { ...message, tempId: undefined };
          return updated.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        }

        const existsByTemp = prevMessages.findIndex(msg => msg.tempId && message.tempId && msg.tempId === message.tempId);
        if (existsByTemp > -1) {
          const updated = [...prevMessages];
          updated[existsByTemp] = { ...message, tempId: undefined };
          return updated.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        }

        // Check duplicates
        const possibleDuplicate = prevMessages.find(m => {
          try {
            const sameSender = String((m.senderId && m.senderId._id) || m.senderId) === String((message.senderId && message.senderId._id) || message.senderId);
            const sameText = (m.text || '') === (message.text || '');
            const sameFile = (m.originalFileName || '') === (message.originalFileName || '');
            const timeDiff = Math.abs(new Date(m.timestamp || 0) - new Date(message.timestamp || 0));
            return sameSender && (sameText || sameFile) && timeDiff < 3000; 
          } catch (e) { return false; }
        });

        if (possibleDuplicate) {
          // Update duplicate logic
           const updated = prevMessages.map(m => {
            const sameSender = String((m.senderId && m.senderId._id) || m.senderId) === String((message.senderId && message.senderId._id) || message.senderId);
            const sameText = (m.text || '') === (message.text || '');
            const sameFile = (m.originalFileName || '') === (message.originalFileName || '');
            const timeDiff = Math.abs(new Date(m.timestamp || 0) - new Date(message.timestamp || 0));
            if (sameSender && (sameText || sameFile) && timeDiff < 3000) return { ...message, tempId: undefined };
            return m;
          });
          return updated.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        }

        // CHANGE: Prepend new message to the start (Bottom of inverted list)
        return [message, ...prevMessages].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
      });
    };

    socket.on('receiveMessage', handleReceiveMessage);

    const handleUnarchived = (payload) => {
      try {
        if (payload && payload.ticketId && String(payload.ticketId) === String(ticketId)) {
          joinRoom((err, res) => {
            if (!err && res && res.messages) {
              setIsArchived(false);
            }
          });
        }
      } catch (e) { console.warn('conversation_unarchived handler error', e); }
    };
    socket.on('conversation_unarchived', handleUnarchived);

    // --- Location Logic (Unchanged) ---
    let locationInterval = null;
    let locationRunning = false;
    const startSendingLocation = async () => {
      const { granted } = await Location.getForegroundPermissionsAsync();
      if (!granted) return;

      // use recursive timeout to avoid overlapping async work
      const tick = async () => {
        if (locationRunning) return; // skip if previous tick still running
        locationRunning = true;
        try {
          const location = await Location.getCurrentPositionAsync({});
          if (location && location.coords) {
            const payload = {
              ticketId,
              location: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              },
            };
            try {
              const { signature, timestamp } = await generateSignature('POST', '/api/socket/send_location', payload);
              if (signature) {
                socket.emit('send_location', { ...payload, _signature: signature, _timestamp: timestamp });
              } else {
                // if server refused to sign, still try sending (socket auth may suffice)
                socket.emit('send_location', payload);
              }
            } catch (e) {
              socket.emit('send_location', payload);
            }
          }
        } catch (error) {
          console.error('Error sending location:', error);
        } finally {
          locationRunning = false;
          // schedule next tick
          locationInterval = setTimeout(tick, 5000);
        }
      };
      // start first tick
      locationInterval = setTimeout(tick, 5000);
      
    };

    if (user.role === 'Engineer') {
      startSendingLocation();
    }

    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
      socket.off('conversation_unarchived', handleUnarchived);
      if (locationInterval) {
        clearInterval(locationInterval);
        clearTimeout(locationInterval);
      }
    };
  }, [socket, user, ticketId]);

  // --- Handlers ---
  const handleViewLocation = () => {
    if (route.params.latitude && route.params.longitude) {
        navigation.navigate('MapScreen', {
            latitude: route.params.latitude,
            longitude: route.params.longitude,
        });
    } else {
        Alert.alert("Location not available", "The location for this ticket is not available.");
    }
  };

  const fileToBase64 = async (uri) => {
    try {
      return await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch (err) {
      throw new Error(`Failed to convert file to base64: ${err.message}`);
    }
  };

  const handleFileSelect = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const validAssets = result.assets.filter(asset => {
          if (asset.size > 5 * 1024 * 1024) {
            Alert.alert("File Too Large", `${asset.name} exceeds the 5MB limit.`);
            return false;
          }
          return true;
        });
        if (validAssets.length > 0) setSelectedFile(validAssets);
        else setSelectedFile(null);
      }
    } catch (err) {
      Alert.alert("Error", "Could not select file.");
    }
  };

  const handleRemoveSelectedFile = (fileToRemove) => {
    setSelectedFile(prevFiles => {
      if (!prevFiles) return null;
      const newFiles = prevFiles.filter(file => file.uri !== fileToRemove.uri);
      return newFiles.length > 0 ? newFiles : null;
    });
  };

  // --- Send Message ---
  const sendMessage = useCallback(async () => {
    if (!socket || (!newMessage.trim() && (!selectedFile || selectedFile.length === 0))) return;

    const baseTs = Date.now();
    const groupId = selectedFile?.length > 1 ? String(baseTs) : undefined;
    const messagesToSend = [];

    if (selectedFile?.length > 0) {
      for (let i = 0; i < selectedFile.length; i++) {
        const file = selectedFile[i];
        const tempId = `${baseTs}_${i}_${file.name}`;
        const msgTimestamp = new Date(baseTs + i + 1).toISOString(); 
        messagesToSend.push({
          _id: tempId,
          text: '',
          senderId: { _id: user.id, fullName: user.fullName, role: user.role },
          timestamp: msgTimestamp,
          tempId,
          fileKey: file.uri,
          fileType: file.mimeType,
          originalFileName: file.name,
          groupId,
        });
      }
    }

    if (newMessage.trim()) {
      const tempId = `${baseTs}_text`;
      const msgTimestamp = new Date(baseTs).toISOString();
      messagesToSend.push({
        _id: tempId,
        text: newMessage.trim(),
        senderId: { _id: user.id, fullName: user.fullName, role: user.role },
        timestamp: msgTimestamp,
        tempId,
        groupId,
      });
    }

    // CHANGE: Prepend to list (Index 0 is bottom)
    setMessages((prev) => [...messagesToSend, ...prev].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)));
    setNewMessage('');
    setSelectedFile(null);
    setReplyingToMessage(null);
    
    // CHANGE: Scroll to Offset 0 (Bottom)
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });

    // Send to server loop (Unchanged)
    for (const msg of messagesToSend) {
      try {
        let fileData = null;
        if (msg.fileKey && !msg.fileKey.startsWith('http')) {
          fileData = await fileToBase64(msg.fileKey);
        }

        const payload = {
          text: msg.text,
          ticketId,
          fileData,
          fileType: msg.fileType,
          originalFileName: msg.originalFileName,
          tempId: msg.tempId,
          groupId: msg.groupId,
          replyTo: replyingToMessage?.id,
        };

        try {
          const { signature, timestamp } = await generateSignature('POST', '/api/socket/sendMessage', payload);
          if (signature) {
            payload._signature = signature;
            payload._timestamp = timestamp;
          }
        } catch (e) { /* ignore signature errors */ }

        socket.emit('sendMessage', payload, (response) => {
          if (response.success) {
            setMessages((prev) => {
              const mapped = prev.map((m) =>
                (m.tempId && msg.tempId && m.tempId === msg.tempId) || (m._id && response.message._id && String(m._id) === String(response.message._id))
                  ? { ...response.message, tempId: undefined }
                  : m
              );
              return mapped.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
            });
          } else {
            setMessages((prev) => prev.filter((m) => m.tempId !== msg.tempId));
            Alert.alert("Send Error", "Could not send the message.");
          }
        });
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.tempId !== msg.tempId));
        Alert.alert("Error", "File sending failed.");
      }
    }
  }, [socket, newMessage, selectedFile, replyingToMessage, ticketId, user]);

  const handleReplyPress = (repliedMessage) => {
    if (!repliedMessage || !repliedMessage.id) {
      Alert.alert("Error", "Cannot find the replied message.");
      return;
    }
    const messageIndex = messages.findIndex(m => String(m._id) === String(repliedMessage._id));
    if (messageIndex !== -1) {
      flatListRef.current?.scrollToIndex({ index: messageIndex, animated: true, viewPosition: 0.5 });
    } else {
      Alert.alert("Message not found", "Message not currently visible.");
    }
  };

  const scrollToBottom = () => {
    // CHANGE: Offset 0 is the bottom in Inverted list
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setShowScrollToBottom(false);
  };

  const handleScroll = (event) => {
    const { contentOffset } = event.nativeEvent;
    // CHANGE: offset.y increases as you scroll "up" into history in inverted list
    setShowScrollToBottom(contentOffset.y > 150);
  };

  // --- Render Helpers ---
  const currentUserId = user?.id; 
  
  const isSameDay = (ts1, ts2) => {
    try {
      const d1 = new Date(ts1);
      const d2 = new Date(ts2);
      return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    } catch (e) { return false; }
  };

  const formatDateLabel = (timestamp) => {
    const d = new Date(timestamp);
    const today = new Date();
    const dayStart = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    const diffDays = Math.round((dayStart(today) - dayStart(d)) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    try {
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) { return d.toDateString(); }
  };

  const renderMessage = ({ item, index }) => {
    const senderId = typeof item.senderId === "object" ? item.senderId._id : item.senderId;
    const isMyMessage = senderId === currentUserId;

    let showDateSeparator = false;
    try {
      const currentTs = item.timestamp || item.createdAt || item.time || Date.now();
      // CHANGE: Date logic for Inverted list
      // We check the NEXT item in the array (which is older in descending sort)
      if (index === messages.length - 1) {
        showDateSeparator = true;
      } else {
        const nextMsg = messages[index + 1];
        const nextTs = nextMsg?.timestamp || nextMsg?.createdAt || nextMsg?.time;
        if (!isSameDay(currentTs, nextTs)) showDateSeparator = true;
      }
    } catch (e) { showDateSeparator = false; }

    return (
      <View>
        {showDateSeparator && (
          <View style={styles.dateSeparatorContainer} pointerEvents="none">
            <View style={styles.dateSeparatorPill}>
              <Text style={styles.dateSeparatorText}>{formatDateLabel(item.timestamp || item.createdAt || item.time)}</Text>
            </View>
          </View>
        )}
        <ChatMessageBubble
          msg={item}
          isMyMessage={isMyMessage}
          token={token}
          API_BASE_URL={API_BASE_URL}
          conversationId={conversationId}
          onReplySwipe={onReplySwipe}
          onReplyPress={handleReplyPress}
        />
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading chat...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('ParticipantList', { ticketId })}
          style={styles.headerTitleContainer}
        >
          <Text style={styles.headerTitle}>{chatTitle || 'Ticket Chat'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleViewLocation} style={{ padding: 5 }}>
            <Ionicons name="map-outline" size={24} color="black" />
        </TouchableOpacity>
      </View>
      
      {isArchived && (
        <View style={styles.archivedBanner}>
          <Text style={styles.archivedText}>This conversation is archived.</Text>
          <TouchableOpacity onPress={() => joinRoom()} style={styles.archivedRetry}>
            <Text style={{ color: '#fff' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* CHANGE: Inverted FlatList - Fixes the scroll glitch */}
      <FlatList
        ref={flatListRef}
        data={messages}
        inverted={true} // Key Fix
        keyExtractor={(item) => (item._id || item.tempId).toString()}
        renderItem={renderMessage}
        // Removed onContentSizeChange scroll hacks
        contentContainerStyle={[
          styles.messagesContainer,
          { paddingBottom: 20 } 
        ]}
        style={{ flex: 1 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />

      {/* Original Structure Restored: KAV is after FlatList */}
      <KeyboardAvoidingView
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 100}
        behavior="padding"
        style={{ width: "100%" }}
        enabled
      >
        <View style={{ paddingBottom: insets.bottom }}>
          
          {/* Arrow kept inside KAV so it lifts with keyboard */}
          {showScrollToBottom && (
            <TouchableOpacity
              style={[
                styles.scrollToBottomButton,
                { 
                  bottom: 90, 
                  right: 14,
                  zIndex: 999
                },
              ]}
              onPress={scrollToBottom}
            >
              <Ionicons name="arrow-down-circle" size={40} color="#007AFF" />
            </TouchableOpacity>
          )}

          {replyingToMessage && (
            <View style={styles.replyPreviewContainer}>
              <View style={styles.replyPreviewContent}>
                <Text style={styles.replyPreviewHeader}>
                  Replying to {replyingToMessage.senderId?.fullName || 'User'}
                </Text>
                <Text style={styles.replyPreviewText} numberOfLines={1}>
                  {replyingToMessage.text || (replyingToMessage.fileKey ? 'File' : '')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReplyingToMessage(null)} style={styles.clearReplyButton}>
                <Ionicons name="close-circle" size={24} color="#555" />
              </TouchableOpacity>
            </View>
          )}

          {selectedFile && (
            <View style={styles.filePreviewContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {selectedFile.map((file, index) => (
                  <View key={index} style={styles.filePreviewItem}>
                    {file.mimeType?.startsWith('image/') ? (
                      <Image source={{ uri: file.uri }} style={styles.previewImage} />
                    ) : (
                      <View style={styles.previewDocument}>
                        <Ionicons name="document-text-outline" size={30} color="#555" />
                        <Text style={styles.previewFileName} numberOfLines={2}>{file.name}</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => handleRemoveSelectedFile(file)}
                      style={styles.removeFileButton}
                    >
                      <Ionicons name="close-circle" size={22} color="#D32F2F" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.inputContainer}>
            <TouchableOpacity onPress={handleFileSelect} style={styles.attachButton}>
              <Ionicons name="attach" size={24} color="#555" />
            </TouchableOpacity>
            <TextInput
              style={styles.textInput}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              placeholderTextColor="#888"
              multiline
            />
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
              <Ionicons name="send" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  backButton: { marginRight: 10 },
  headerTitleContainer: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  messagesContainer: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexGrow: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    backgroundColor: '#fff',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    minHeight: 40,
    maxHeight: 120,
    marginRight: 10,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachButton: { padding: 8, marginRight: 5 },
  replyPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
    padding: 8,
    borderRadius: 10,
    marginBottom: 8,
    marginHorizontal: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  replyPreviewContent: { flex: 1, marginRight: 10 },
  replyPreviewHeader: { fontWeight: 'bold', color: '#007AFF', marginBottom: 2 },
  replyPreviewText: { color: '#555' },
  clearReplyButton: { padding: 5 },
  scrollToBottomButton: {
    position: 'absolute',
    // bottom: 90, // moved inline to View
    // right: 20, // moved inline
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 30,
    padding: 5,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dateSeparatorContainer: { alignItems: 'center', marginVertical: 8 },
  dateSeparatorPill: {
    backgroundColor: '#e6e6e6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dateSeparatorText: { color: '#555', fontSize: 12 },
  archivedBanner: {
    backgroundColor: '#F97316',
    padding: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  archivedText: { color: '#fff', textAlign: 'center', flex: 1 },
  archivedRetry: {
    backgroundColor: '#B45309',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  filePreviewContainer: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    backgroundColor: '#fff',
  },
  filePreviewItem: {
    position: 'relative',
    marginRight: 10,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  previewDocument: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#f0f2f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 5,
  },
  previewFileName: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
    color: '#333',
  },
  removeFileButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'white',
    borderRadius: 11,
  },
});

export default TicketChatScreen;