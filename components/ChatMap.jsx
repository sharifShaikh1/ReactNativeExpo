import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import api from '../utils/api';

const ChatMap = ({ ticketId, socket, user }) => {
  const [siteLocation, setSiteLocation] = useState(null);
  const [engineerLocations, setEngineerLocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [mapVisible, setMapVisible] = useState(false);

  useEffect(() => {
    if (!socket || !ticketId) return;

    const fetchTicketDetails = async () => {
      try {
        const response = await api.get(`/tickets/ticket/${ticketId}`);
        if (response.data && response.data.coordinates) {
          setSiteLocation(response.data.coordinates);
          console.log('Mobile App - Site Location:', response.data.coordinates);
        }
      } catch (error) {
        console.error('Error fetching ticket details for map:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTicketDetails();

    socket.emit('get_initial_locations', ticketId, (initialLocations) => {
      setEngineerLocations(initialLocations);
      console.log('Mobile App - Initial Engineer Locations:', initialLocations);
    });

    const handleLocationUpdated = (data) => {
      setEngineerLocations(prevLocations => ({
        ...prevLocations,
        [data.userId]: data.location,
      }));
      console.log('Mobile App - Location Updated:', data);
    };

    socket.on('location_updated', handleLocationUpdated);

    return () => {
      socket.off('location_updated', handleLocationUpdated);
    };
  }, [socket, ticketId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading map data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.toggleButton} onPress={() => setMapVisible(!mapVisible)}>
        <Ionicons name={mapVisible ? "map" : "map-outline"} size={24} color="black" />
        <Text style={styles.toggleButtonText}>{mapVisible ? "Hide Map" : "Show Map"}</Text>
      </TouchableOpacity>

      {mapVisible && (
        <View style={styles.mapContainer}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={{
              latitude: siteLocation?.latitude || 0,
              longitude: siteLocation?.longitude || 0,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
          >
            {siteLocation && (
              <Marker
                coordinate={siteLocation}
                title="Site Location"
                pinColor="blue"
              />
            )}
            {Object.entries(engineerLocations).map(([engineerId, location]) => (
              <Marker
                key={engineerId}
                coordinate={location}
                title={`Engineer ${engineerId}`}
                pinColor="red"
              />
            ))}
          </MapView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 10,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
    marginBottom: 10,
  },
  toggleButtonText: {
    marginLeft: 5,
    fontWeight: 'bold',
  },
  mapContainer: {
    height: 250, // Fixed height for the map
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ChatMap;
