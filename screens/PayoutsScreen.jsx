import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import * as Linking from 'expo-linking';

const PayoutsScreen = () => {
    const { user, fetchUser, token } = useAuth();
    const [isLoading, setIsLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            const loadData = async () => {
                setIsLoading(true);
                await fetchUser();
                setIsLoading(false);
            };
            loadData();
        }, [fetchUser])
    );

    const handleOnboard = async () => {
        if (!user || user.role !== 'Engineer') {
            Alert.alert("Access Denied", "This feature is only available for Engineers.");
            return;
        }

        try {
            let endpoint = '/stripe/onboard-user';
            let payload = { userId: user._id, source: 'mobile' };

            // If user already has a Stripe ID, create a login link instead
            if (user.stripeAccountId) {
                endpoint = '/stripe/create-login-link';
                payload = { userId: user._id };
            }

            const { data } = await api.post(endpoint, payload);

            if (data.url) {
                Linking.openURL(data.url);
            } else {
                Alert.alert("Error", "Could not get the Stripe link. Please try again.");
            }
        } catch (err) {
            Alert.alert("Action Failed", err.response?.data?.message || "An unexpected error occurred.");
        }
    };

    if (isLoading || !user) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text>Loading Payout Information...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Payout Settings</Text>
            </View>

            <View style={styles.content}>
                <Text style={styles.infoText}>
                    Manage your payout information to receive payments for completed tickets. We use Stripe to ensure your payments are secure and timely.
                </Text>

                <View style={styles.instructionsContainer}>
                    <Ionicons name="information-circle-outline" size={24} color="#4F46E5" />
                    <Text style={styles.instructionsText}>
                        When asked for a business website, please use the main URL of this application.
                    </Text>
                </View>

                <TouchableOpacity style={styles.button} onPress={handleOnboard}>
                    <Ionicons name="card-outline" size={24} color="white" />
                    <Text style={styles.buttonText}>
                        {user.stripeAccountId ? 'Manage Payout Account' : 'Set Up Payout Account'}
                    </Text>
                </TouchableOpacity>

                <View style={styles.statusContainer}>
                    <Text style={styles.statusLabel}>Onboarding Status:</Text>
                    <Text style={[styles.statusValue, { color: user.stripeAccountId ? '#28a745' : '#dc3545' }]}>
                        {user.stripeAccountId ? 'Completed' : 'Incomplete'}
                    </Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        backgroundColor: '#4F46E5',
        padding: 20,
        paddingTop: 50,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
    },
    content: {
        padding: 20,
    },
    infoText: {
        fontSize: 16,
        color: '#6c757d',
        textAlign: 'center',
        marginBottom: 20, // Adjusted margin
    },
    instructionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#eef2ff',
        padding: 15,
        borderRadius: 8,
        marginBottom: 30,
    },
    instructionsText: {
        flex: 1,
        marginLeft: 10,
        fontSize: 15,
        color: '#4338ca',
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4F46E5',
        paddingVertical: 15,
        borderRadius: 10,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    statusContainer: {
        marginTop: 40,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#fff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#dee2e6',
    },
    statusLabel: {
        fontSize: 16,
        color: '#495057',
    },
    statusValue: {
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 10,
    },
});

export default PayoutsScreen;