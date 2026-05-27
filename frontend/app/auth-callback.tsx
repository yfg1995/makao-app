import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/services/auth';
import { theme } from '../src/theme';

export default function AuthCallback() {
  const router = useRouter();
  const { signInWithEmergent } = useAuth();

  useEffect(() => {
    if (Platform.OS !== 'web') { router.replace('/login'); return; }
    const hash = window.location.hash || '';
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) { router.replace('/login'); return; }
    (async () => {
      try {
        await signInWithEmergent(decodeURIComponent(m[1]));
        router.replace('/(tabs)/lobby');
      } catch {
        router.replace('/login');
      }
    })();
  }, []);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={theme.colors.accent} size="large" />
      <Text style={styles.t}>Signing you in...</Text>
    </View>
  );
}
const styles = StyleSheet.create({ root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg }, t: { color: theme.colors.textMuted, marginTop: 12 } });
