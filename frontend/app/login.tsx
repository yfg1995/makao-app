import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/services/auth';
import { Button, NoMoneyFooter } from '../src/components/UI';
import { theme } from '../src/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Login() {
  const router = useRouter();
  const { signInGuest, registerWithEmail, loginWithEmail, user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [authBusy, setAuthBusy] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace('/(tabs)/lobby');
  }, [router, user]);

  const authMessage = (e: any) => {
    const code = e?.code || '';
    if (code.includes('email-already-in-use')) return 'That email is already registered.';
    if (code.includes('invalid-email')) return 'Enter a valid email address.';
    if (code.includes('invalid-credential') || code.includes('wrong-password')) return 'Email or password is incorrect.';
    if (code.includes('weak-password')) return 'Password must be at least 6 characters.';
    if (code.includes('network-request-failed')) return 'Network error. Try again.';
    return e?.response?.data?.detail || e?.message || 'Could not complete authentication.';
  };

  const submitEmail = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || password.length < 6) {
      Alert.alert('Check details', 'Enter an email and a password with at least 6 characters.');
      return;
    }
    setAuthBusy(true);
    try {
      if (mode === 'register') {
        await registerWithEmail(trimmedEmail, password, name.trim() || undefined);
      } else {
        await loginWithEmail(trimmedEmail, password);
      }
      router.replace('/(tabs)/lobby');
    } catch (e: any) {
      Alert.alert(mode === 'register' ? 'Registration failed' : 'Login failed', authMessage(e));
    } finally { setAuthBusy(false); }
  };

  const guest = async () => {
    setGuestBusy(true);
    try {
      await signInGuest(name.trim() || undefined);
      router.replace('/(tabs)/lobby');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Could not start guest session');
    } finally { setGuestBusy(false); }
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

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry
              textContentType={mode === 'register' ? 'newPassword' : 'password'}
            />

            <Button title={mode === 'register' ? 'Create Account' : 'Log In'} onPress={submitEmail} loading={authBusy} fullWidth />
            <View style={{ height: 10 }} />
            <Button
              title={mode === 'register' ? 'I already have an account' : 'Create a new account'}
              variant="ghost"
              onPress={() => setMode(mode === 'register' ? 'login' : 'register')}
              fullWidth
            />
            <View style={{ height: 12 }} />
            <Button title="Continue as Guest" variant="secondary" onPress={guest} loading={guestBusy} fullWidth />
            <Text style={styles.fine}>Guest progress lives on this device. Email login keeps your account available after reinstall or device change.</Text>
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
