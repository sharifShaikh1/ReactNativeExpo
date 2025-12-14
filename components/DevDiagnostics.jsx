import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';
import { DevSettings } from 'react-native';

const DevDiagnostics = () => {
  const [lastTick, setLastTick] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [appState, setAppState] = useState(AppState.currentState);
  const prevTickRef = useRef(Date.now());
  const blockedSinceRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const onAppStateChange = (nextAppState) => {
      setAppState(nextAppState);
      // when moving to background, reset tick reference to avoid large diffs on resume
      if (nextAppState !== 'active') {
        prevTickRef.current = Date.now();
        blockedSinceRef.current = null;
      }
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);

    const id = setInterval(() => {
      if (!mounted) return;
      const nowTs = Date.now();
      setNow(nowTs);
      // compute delta since last real tick
      const delta = nowTs - prevTickRef.current;
      // Save lastTick to show in UI the last tick time
      setLastTick(prevTickRef.current);
      prevTickRef.current = nowTs;
      // Track when blocked threshold first observed
      if (delta > 4000) {
        if (!blockedSinceRef.current) {
          blockedSinceRef.current = nowTs - delta; // approx when blocking started
          console.warn('[DevDiagnostics] Detected long JS thread block:', delta, 'ms');
        }
      } else {
        blockedSinceRef.current = null;
      }
    }, 1000);
    return () => { mounted = false; clearInterval(id); subscription?.remove?.(); };
  }, []);

  const msSinceLastTick = now - lastTick;
  const isBlocked = msSinceLastTick > 4000 && appState === 'active';
  const blockedSince = blockedSinceRef.current ? Math.round((Date.now() - blockedSinceRef.current) / 1000) : 0;

  const reloadApp = async () => {
    try {
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        if (typeof DevSettings?.reload === 'function') {
          DevSettings.reload();
          return;
        }
        if (Updates.reloadAsync) {
          await Updates.reloadAsync();
          return;
        }
      }
      window.location.reload();
    } catch (e) {
      console.warn('[DevDiagnostics] Reload failed:', e?.message || e);
    }
  };

  if (process.env.NODE_ENV === 'production') return null;

  return (
    <View style={[styles.container, isBlocked ? styles.blocked : null]} pointerEvents="box-none">
      <View style={styles.box}>
        <Text style={styles.text}>Dev Heartbeat: {new Date(now).toLocaleTimeString()} ({appState})</Text>
        <Text style={styles.sub}>Last heartbeat difference: {Math.round(msSinceLastTick)}ms</Text>
        {isBlocked && (
          <View style={styles.warnRow}>
            <Text style={styles.warn}>JS thread may be blocked{blockedSince ? ` (${blockedSince}s)` : ''}</Text>
            <TouchableOpacity style={styles.reloadBtn} onPress={reloadApp}>
              <Text style={styles.reloadText}>Reload</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 9999,
    elevation: 9999,
    pointerEvents: 'box-none'
  },
  box: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 6,
  },
  text: { color: '#fff', fontSize: 12 },
  sub: { color: '#ddd', fontSize: 10 },
  warnRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center' },
  warn: { color: '#ffcc00', marginRight: 8, fontSize: 12 },
  reloadBtn: { backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  reloadText: { color: '#000', fontWeight: '700', fontSize: 12 }
});

export default DevDiagnostics;
