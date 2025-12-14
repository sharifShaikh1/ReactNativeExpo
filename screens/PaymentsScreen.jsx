import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, SafeAreaView, Alert } from 'react-native';
import api from '../utils/api';
import TicketCard from '../components/TicketCard';

const PaymentsScreen = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [tickets, setTickets] = useState([]);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data } = await api.get('/tickets/engineer/history');
            setTickets(data);
        } catch (error) {
            Alert.alert("Error", "Could not fetch payment data.");
        }
        setIsLoading(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            const loadData = async () => {
                setIsLoading(true);
                try {
                    const { data } = await api.get('/tickets/engineer/history');
                    setTickets(data);
                } catch (error) {
                    Alert.alert("Error", "Could not fetch payment data.");
                }
                setIsLoading(false);
            };

            loadData();
        }, [])
    );

    // Safely coerce amount values to numbers. Some tickets may have amount as string or undefined.
    const getNumericAmount = (t) => {
        if (t == null) return 0;
        const raw = t.amount;
        if (typeof raw === 'number' && isFinite(raw)) return raw;
        const parsed = parseFloat(raw);
        return isFinite(parsed) ? parsed : 0;
    };

    const paidTickets = tickets.filter(t => t.paymentStatus === 'Paid');
    const pendingTickets = tickets.filter(t => t.paymentStatus !== 'Paid');
    const totalPaid = paidTickets.reduce((sum, t) => sum + getNumericAmount(t), 0);
    const totalPending = pendingTickets.reduce((sum, t) => sum + getNumericAmount(t), 0);

    if (isLoading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text>Loading Payment Information...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Payments</Text>
            </View>

            <View>
                <View style={styles.summaryContainer}>
                    <View style={styles.summaryBox}>
                        <Text style={styles.summaryAmount}>₹{totalPaid.toFixed(2)}</Text>
                        <Text style={styles.summaryLabel}>Total Paid</Text>
                    </View>
                    <View style={styles.summaryBox}>
                        <Text style={styles.summaryAmount}>₹{totalPending.toFixed(2)}</Text>
                        <Text style={styles.summaryLabel}>Pending</Text>
                    </View>
                </View>
                <Text style={styles.sectionTitle}>Payment History</Text>
            </View>

            <FlatList
                data={tickets}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => <View style={{ paddingHorizontal: 20 }}><TicketCard ticket={item} /></View>}
                ListEmptyComponent={
                    <View style={styles.centered}>
                        <Text>No payment history found.</Text>
                    </View>
                }
                style={{ flex: 1 }}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        backgroundColor: '#4F46E5',
        paddingVertical: 12,
        paddingHorizontal: 16,
        paddingTop: 18,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
    },
    summaryContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 12,
        backgroundColor: '#fff',
    },
    summaryBox: {
        alignItems: 'center',
    },
    summaryAmount: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#4F46E5',
    },
    summaryLabel: {
        fontSize: 12,
        color: '#6c757d',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#343a40',
        paddingHorizontal: 20,
        marginTop: 12,
        marginBottom: 10,
    },
});

export default PaymentsScreen;