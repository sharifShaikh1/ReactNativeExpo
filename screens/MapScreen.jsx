
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Linking, Alert } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import polyline from '@mapbox/polyline';
import Constants from 'expo-constants';

const MapScreen = ({ route }) => {
  const { latitude, longitude } = route.params;
  const [mapType, setMapType] = useState('standard');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const mapRef = useRef(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location.coords);

      const locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (newLocation) => {
          setCurrentLocation(newLocation.coords);
        }
      );

      return () => {
        locationSubscription.remove();
      };
    })();
  }, []);

  useEffect(() => {
    if (currentLocation) {
      getDirections(
        `${currentLocation.latitude},${currentLocation.longitude}`,
        `${latitude},${longitude}`
      );
    }
  }, [currentLocation, latitude, longitude]);

  const getDirections = async (startLoc, destinationLoc) => {
    try {
      const GOOGLE_MAPS_API_KEY = Constants.expoConfig.extra.googleMapsApiKey;
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${startLoc}&destination=${destinationLoc}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const json = await response.json();
      const points = polyline.decode(json.routes[0].overview_polyline.points);
      const coords = points.map((point) => ({
        latitude: point[0],
        longitude: point[1],
      }));
      setRouteCoordinates(coords);
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleStartNavigation = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    Linking.openURL(url);
  };

  const centerOnUser = () => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        mapType={mapType}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        <Marker coordinate={{ latitude, longitude }} title="Ticket Location" />
        {currentLocation && (
          <Marker
            coordinate={currentLocation}
            title="My Location"
            pinColor="blue"
          />
        )}
        <Polyline
          coordinates={routeCoordinates}
          strokeColor="#000"
          strokeWidth={3}
        />
      </MapView>
      <View style={styles.controls}>
        <TouchableOpacity style={styles.button} onPress={() => setMapType('standard')}>
          <Text style={styles.buttonText}>Standard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => setMapType('satellite')}>
          <Text style={styles.buttonText}>Satellite</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => setMapType('hybrid')}>
          <Text style={styles.buttonText}>Hybrid</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.centerButton} onPress={centerOnUser}>
        <Ionicons name="locate" size={24} color="#007BFF" />
      </TouchableOpacity>
      <View style={styles.directionsContainer}>
        <TouchableOpacity style={[styles.button, styles.directionsButton]} onPress={handleStartNavigation}>
          <Text style={styles.buttonText}>Start Navigation</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  controls: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 10,
    padding: 10,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#007BFF',
    borderRadius: 5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  directionsContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  directionsButton: {
    backgroundColor: '#28a745',
    width: '80%',
    alignItems: 'center',
  },
  centerButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 30,
    padding: 10,
    elevation: 5,
  },
});

export default MapScreen;
