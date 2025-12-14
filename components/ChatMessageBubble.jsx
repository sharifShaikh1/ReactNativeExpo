import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import ImageViewer from './ImageViewer';
import Constant from 'expo-constants';

const ChatMessageBubble = ({ msg, isMyMessage, token, API_BASE_URL, conversationId, onReplySwipe, onReplyPress }) => {
console.log(
  "Message text:", msg?.text,
  "| SenderId:", msg?.senderId?._id || msg?.senderId,
  "| SenderName:", msg?.senderId?.fullName,
  "| isMyMessage:", isMyMessage
);

  const hasFile = !!msg.fileKey;
  const hasText = !!msg.text;
  const isOptimistic = !!msg.tempId && !msg._id;
  const isImageFile = hasFile && msg.fileType?.startsWith('image/');
  const isImageOnly = isImageFile && !hasText;
  const isPdfOrOtherFileOnly = hasFile && !hasText && !isImageFile;

  const [fileUri, setFileUri] = useState(null);
  const [isLoadingFile, setIsLoadingFile] = useState(hasFile && !isOptimistic);
  const [fileError, setFileError] = useState(false);
  const [isViewerVisible, setViewerVisible] = useState(false);
  const [fullImageUri, setFullImageUri] = useState(null);
  const [isLoadingFullImage, setIsLoadingFullImage] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (isOptimistic && msg.fileKey && msg.fileKey.startsWith('file://')) {
      if (isMounted) {
        setFileUri(msg.fileKey);
        setIsLoadingFile(false);
      }
      return;
    }

    const fetchFile = async () => {
      if (!hasFile || !token || !conversationId || !msg.fileKey || msg.fileKey.startsWith('file://')) {
        setIsLoadingFile(false);
        return;
      }
      setIsLoadingFile(true);
      setFileError(false);
      const keyToFetch = isImageFile ? msg.thumbnailKey || msg.fileKey : msg.fileKey;
      
      try {
        const fileExtension = msg.originalFileName?.split('.').pop() || msg.fileType?.split('/')[1] || 'tmp';
        const localUri = `${FileSystem.cacheDirectory}${keyToFetch.replace(/[^a-zA-Z0-9.]/g, '_')}.${fileExtension}`;
        
        // Use server-side proxy endpoint (server will sign the forwarded request)
        const path = `/api/files/view/${keyToFetch}?conversationId=${conversationId}`;
        const fileProxyUrl = `${API_BASE_URL}/api/proxy${path}`;

        // Include auth and app key; proxy will add server-side HMAC
        const headers = {
          'Authorization': `Bearer ${token}`,
          'x-app-key': Constant.expoConfig?.extra?.APP_KEY_MOBILE || Constant.expoConfig?.extra?.API_KEY_MOBILE,
        };
        
        console.log('[MOBILE FILE] Downloading:', fileProxyUrl);
        console.log('[MOBILE FILE] Headers:', headers);
        
        const downloadResult = await FileSystem.downloadAsync(fileProxyUrl, localUri, { headers });
        
        if (isMounted) {
          if (downloadResult.status === 200) {
            setFileUri(downloadResult.uri);
            console.log('[MOBILE FILE] Download successful:', localUri);
          } else {
            console.error('File download failed:', downloadResult.status, downloadResult);
            setFileError(true);
          }
        }
      } catch (error) {
        console.error('Error downloading file:', error);
        if (isMounted) setFileError(true);
      } finally {
        if (isMounted) setIsLoadingFile(false);
      }
    };
    fetchFile();
    return () => { isMounted = false; };
  }, [msg.fileKey, token, conversationId, isOptimistic]);

  const handleFilePress = async () => {
    if (isImageFile) {
      setViewerVisible(true);
    } else if (fileUri) {
      try {
        await Sharing.shareAsync(fileUri);
      } catch (error) {
        Alert.alert("Error", "Couldn't open or share the file.");
      }
    } else if (fileError) {
      Alert.alert("File Error", "Could not load this file.");
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (isViewerVisible && isImageFile && !fullImageUri) {
      const fetchFullImage = async () => {
        setIsLoadingFullImage(true);
        try {
          const path = `/api/files/view/${msg.fileKey}?conversationId=${conversationId}`;
          const fullImageProxyUrl = `${API_BASE_URL}/api/proxy${path}`;
          const localFullUri = `${FileSystem.cacheDirectory}full_${msg.fileKey.replace(/[^a-zA-Z0-9.]/g, '_')}`;

          const headers = {
            'Authorization': `Bearer ${token}`,
            'x-app-key': Constant.expoConfig?.extra?.APP_KEY_MOBILE || Constant.expoConfig?.extra?.API_KEY_MOBILE,
          };
          
          const downloadResult = await FileSystem.downloadAsync(fullImageProxyUrl, localFullUri, { headers });
          
          if (isMounted && downloadResult.status === 200) {
            setFullImageUri(downloadResult.uri);
          }
        } catch (error) {
          // ignore
        } finally {
          if (isMounted) setIsLoadingFullImage(false);
        }
      };
      fetchFullImage();
    }
    return () => { isMounted = false; };
  }, [isViewerVisible, msg.fileKey, token, conversationId]);

  const renderFileContent = () => {
    if (isLoadingFile) {
      return (
        <View style={styles.fileLoading}>
          <ActivityIndicator size="small" color="#333" />
          <Text style={styles.fileText}>Loading {msg.originalFileName || 'file'}...</Text>
        </View>
      );
    }
    if (fileError) {
      return (
        <View style={styles.fileError}>
          <Ionicons name="warning-outline" size={20} color="red" />
          <Text style={styles.fileErrorText}>Failed to load file</Text>
        </View>
      );
    }
    if (isImageFile) {
      return <Image source={{ uri: fileUri }} style={isImageOnly ? styles.imagePreview : styles.imagePreviewInBubble} resizeMode={isImageOnly ? "cover" : "contain"} />;
    }
    return (
      <View style={styles.fileIconContainer}>
        <Ionicons name="document-text-outline" size={24} color={'#333'} />
        <Text style={styles.fileText}>{msg.originalFileName || 'Document'}</Text>
      </View>
    );
  };

  const styles = getStyles(isMyMessage);

  return (
    <>
      <PanGestureHandler
        onGestureEvent={(e) => {
          if (e.nativeEvent.state === State.ACTIVE && Math.abs(e.nativeEvent.translationX) > 20) {
            onReplySwipe(msg);
          }
        }}
        activeOffsetX={[-20, 20]}
      >
        <View
          style={[
            styles.bubbleContainer,
            isImageOnly ? styles.imageOnlyContainer : (isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble),
          ]}
        >
          {isImageOnly ? (
            <TouchableOpacity onPress={handleFilePress} disabled={isLoadingFile || fileError}>
              {renderFileContent()}
              <View style={[styles.timestampOverlay, isMyMessage ? { right: 8 } : { left: 8 }]}>
                <Text style={styles.overlayTimestamp}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {isOptimistic && <Ionicons name="time-outline" size={12} color={'#fff'} style={{ marginLeft: 4 }} />}
              </View>
            </TouchableOpacity>
          ) : (
            <>
              {!isMyMessage && <Text style={styles.senderName}>{msg.senderId?.fullName}</Text>}
              {hasFile && (
                <TouchableOpacity onPress={handleFilePress} disabled={isLoadingFile || fileError}>
                  {renderFileContent()}
                </TouchableOpacity>
              )}
              {hasText && <Text style={styles.messageText}>{msg.text}</Text>}
              <View style={styles.bottomRow}>
                {isOptimistic && <Ionicons name="time-outline" size={12} color={'rgba(0,0,0,0.5)'} style={styles.optimisticIcon} />}
                <Text style={styles.timestamp}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </>
          )}
        </View>
      </PanGestureHandler>

      {isViewerVisible && (
        <ImageViewer
          visible={isViewerVisible}
          onClose={() => setViewerVisible(false)}
          imageUri={fullImageUri || fileUri}
          isLoading={isLoadingFullImage}
          senderName={msg.senderId?.fullName}
          timestamp={msg.timestamp}
        />
      )}
    </>
  );
};

const getStyles = (isMyMessage) => StyleSheet.create({
  bubbleContainer: {
    maxWidth: '80%',
    marginVertical: 4,
    alignSelf: isMyMessage ? 'flex-end' : 'flex-start', // ✅ alignment here only
  },
  myMessageBubble: {
    backgroundColor: '#DCF8C6',
    borderTopRightRadius: 2,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 8,
  },
  otherMessageBubble: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 8,
  },
  imageOnlyContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  senderName: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#333',
    marginTop: 2,
    paddingHorizontal: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 2,
  },
  timestamp: {
    fontSize: 9,
    color: 'rgba(0,0,0,0.5)',
    marginLeft: 4,
  },
  timestampOverlay: {
    position: 'absolute',
    bottom: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  overlayTimestamp: {
    color: '#fff',
    fontSize: 10,
  },
  imagePreview: {
    width: 220,
    height: 220,
    borderRadius: 12,
  },
  imagePreviewInBubble: {
    width: 220,
    height: 220,
    borderRadius: 8,
    marginBottom: 4,
  },
  fileIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
  },
  fileText: {
    marginLeft: 8,
    fontSize: 14,
    flexShrink: 1,
    color: '#333',
  },
  fileLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    height: 60,
  },
  fileError: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#ffe0e0',
    borderRadius: 8,
  },
  fileErrorText: {
    marginLeft: 5,
    color: 'red',
    fontSize: 14,
  },
});

export default ChatMessageBubble;
