import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, ScrollView, Linking, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/services/auth';
import { Button, NoMoneyFooter } from '../src/components/UI';
import { theme } from '../src/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Login() {
  const router = useRouter();
  const { signInGuest, signInWithEmergent, user } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace('/(tabs)/lobby');
  }, [user]);

  // On web, detect ?session_id in URL fragment (#session_id=...)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const hash = window.location.hash || '';
      const m = hash.match(/session_id=([^&]+)/);
      if (m && m[1]) {
        (async () => {
          setBusy(true);
          try {
            await signInWithEmergent(decodeURIComponent(m[1]));
            window.history.replaceState(null, '', window.location.pathname);
            router.replace('/(tabs)/lobby');
          } catch (e: any) {
            Alert.alert('Login failed', e?.response?.data?.detail || 'Try again');
          } finally { setBusy(false); }
        })();
      }
    } catch {}
  }, []);

  const guest = async () => {
    setBusy(true);
    try {
      await signInGuest(name.trim() || undefined);
      router.replace('/(tabs)/lobby');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Could not start guest session');
    } finally { setBusy(false); }
  };

  const google = async () => {
    if (Platform.OS !== 'web') {
      // In native we use Linking. The redirect URL must be the app URL.
      const redirectUrl = `${process.env.EXPO_PUBLIC_BACKEND_URL || ''}/login`;
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      await Linking.openURL(authUrl);
      return;
    }
    const redirectUrl = window.location.origin + '/login';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <LinearGradient colors={[theme.colors.bg, theme.colors.bgAlt, '#1A0B3A']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandWrap}>
            <LinearGradient colors={[theme.colors.primary, theme.colors.accent]} style={styles.logo}>
              <Text style={styles.logoText}>CR</Text>
            </LinearGradient>
            <Text style={styles.title}>Card Rush Arena</Text>
            <Text style={styles.subtitle}>Shed cards. Outwit bots. Climb the leagues.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Display name (optional)</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. AceFlame"
              placeholderTextColor={theme.colors.textMuted}
              maxLength={20}
            />
            <Button title="Play as Guest" onPress={guest} loading={busy} fullWidth />
            <View style={{ height: 12 }} />
            <Button title="Continue with Google" variant="secondary" onPress={google} fullWidth />
            <Text style={styles.fine}>Guest progress lives on this device. Sign in with Google to sync.</Text>
          </View>

          <NoMoneyFooter />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  brandWrap: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 92, height: 92, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 38, fontWeight: '900' },
  title: { color: theme.colors.text, fontSize: 28, fontWeight: '900', marginTop: 14 },
  subtitle: { color: theme.colors.textMuted, fontSize: 14, marginTop: 6, textAlign: 'center' },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 20, borderWidth: 1, borderColor: theme.colors.border },
  label: { color: theme.colors.textMuted, fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: theme.colors.bgAlt, color: theme.colors.text, borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border },
  fine: { color: theme.colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 12 },
});
