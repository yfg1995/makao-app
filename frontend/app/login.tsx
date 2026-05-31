import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/services/auth';
import { Button, NoMoneyFooter } from '../src/components/UI';
import { theme } from '../src/theme';

type AuthMode = 'register' | 'login';
type Gender = 'male' | 'female';
type FieldName = 'name' | 'email' | 'password' | 'confirmPassword' | 'gender';
type FieldErrors = Partial<Record<FieldName, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const router = useRouter();
  const { signInGuest, registerWithEmail, loginWithEmail, resetPassword, user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [mode, setMode] = useState<AuthMode>('register');
  const [authBusy, setAuthBusy] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<FieldName | null>(null);

  const intro = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(intro, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [intro, pulse]);

  useEffect(() => {
    if (user) router.replace('/(tabs)/lobby');
  }, [router, user]);

  const errors = useMemo<FieldErrors>(() => {
    const next: FieldErrors = {};
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (mode === 'register' && trimmedName.length === 1) {
      next.name = 'Use at least 2 characters or leave it empty.';
    }

    if (mode === 'register' && !gender) {
      next.gender = 'Choose male or female for your profile avatar.';
    }

    if (!trimmedEmail) {
      next.email = 'Email is required.';
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      next.email = 'Enter a valid email address.';
    }

    if (!password) {
      next.password = 'Password is required.';
    } else if (password.length < 6) {
      next.password = 'Password must be at least 6 characters.';
    }

    if (mode === 'register') {
      if (!confirmPassword) {
        next.confirmPassword = 'Confirm your password.';
      } else if (confirmPassword !== password) {
        next.confirmPassword = 'Passwords do not match.';
      }
    }

    return next;
  }, [confirmPassword, email, gender, mode, name, password]);

  const introTranslateY = intro.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  const introStyle = {
    opacity: intro,
    transform: [{ translateY: introTranslateY }],
  };

  const logoScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const cardTranslateX = shake.interpolate({
    inputRange: [-1, 1],
    outputRange: [-10, 10],
  });

  const cardIntroStyle = {
    opacity: intro,
    transform: [{ translateY: introTranslateY }, { translateX: cardTranslateX }],
  };

  const showError = (field: FieldName) => !!errors[field] && (submitAttempted || touched[field]);

  const setFieldTouched = (field: FieldName) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const clearMessageOnEdit = () => {
    if (formMessage) setFormMessage(null);
  };

  const invalidAnimation = () => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0.7, duration: 45, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -0.7, duration: 45, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 45, useNativeDriver: true }),
    ]).start();
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setSubmitAttempted(false);
    setTouched({});
    setFormMessage(null);
    setConfirmPassword('');
  };

  const authMessage = (e: any) => {
    const code = e?.code || '';
    if (e?.message?.includes('Firebase API key is missing')) return e.message;
    if (code.includes('api-key-not-valid')) return 'Firebase API key is invalid. Check EXPO_PUBLIC_FIREBASE_API_KEY in Vercel, then redeploy.';
    if (code.includes('operation-not-allowed')) return 'Email/Password sign-in is disabled. Enable it in Firebase Authentication > Sign-in method.';
    if (code.includes('unauthorized-domain')) return 'This Vercel domain is not authorized in Firebase Authentication settings.';
    if (code.includes('email-already-in-use')) return 'That email is already registered. Switch to Log In.';
    if (code.includes('invalid-email')) return 'Enter a valid email address.';
    if (code.includes('user-not-found')) return 'No account exists for this email. Create an account first.';
    if (code.includes('invalid-credential') || code.includes('wrong-password')) return 'Email or password is incorrect, or this account does not exist yet.';
    if (code.includes('weak-password')) return 'Password must be at least 6 characters.';
    if (code.includes('network-request-failed')) return 'Network error. Try again.';
    return e?.response?.data?.detail || e?.message || 'Could not complete authentication.';
  };

  const apiMessage = (e: any) => {
    const detail = e?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (detail?.message) return detail.message;
    if (e?.message?.includes('Network Error')) {
      return 'Cannot reach the game server. Check EXPO_PUBLIC_BACKEND_URL in Vercel or try again.';
    }
    return e?.message || 'Request failed. Try again.';
  };

  const submitEmail = async () => {
    Keyboard.dismiss();
    setSubmitAttempted(true);
    setTouched({ name: true, email: true, password: true, confirmPassword: true });
    setFormMessage(null);

    if (Object.keys(errors).length > 0) {
      setFormMessage('Check the highlighted fields and try again.');
      invalidAnimation();
      return;
    }

    setAuthBusy(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      if (mode === 'register') {
        await registerWithEmail(trimmedEmail, password, name.trim() || undefined, gender || undefined);
      } else {
        await loginWithEmail(trimmedEmail, password);
      }
      router.replace('/(tabs)/lobby');
    } catch (e: any) {
      setFormMessage(authMessage(e));
      invalidAnimation();
    } finally {
      setAuthBusy(false);
    }
  };

  const guest = async () => {
    Keyboard.dismiss();
    const trimmedName = name.trim();
    if (trimmedName.length === 1) {
      setTouched((current) => ({ ...current, name: true }));
      setFormMessage('Guest display name needs at least 2 characters, or leave it empty.');
      invalidAnimation();
      return;
    }

    setGuestBusy(true);
    setFormMessage(null);
    try {
      await signInGuest(trimmedName || undefined, gender || undefined);
      router.replace('/(tabs)/lobby');
    } catch (e: any) {
      setFormMessage(apiMessage(e) || 'Could not start guest session.');
      invalidAnimation();
    } finally {
      setGuestBusy(false);
    }
  };

  const forgotPassword = async () => {
    Keyboard.dismiss();
    const trimmedEmail = email.trim().toLowerCase();
    setTouched((current) => ({ ...current, email: true }));
    setFormMessage(null);

    if (!trimmedEmail || !EMAIL_PATTERN.test(trimmedEmail)) {
      setFormMessage('Enter the email for your account first.');
      invalidAnimation();
      return;
    }

    setResetBusy(true);
    try {
      await resetPassword(trimmedEmail);
      setFormMessage('Password reset email sent. Check your inbox and spam folder.');
    } catch (e: any) {
      setFormMessage(authMessage(e));
      invalidAnimation();
    } finally {
      setResetBusy(false);
    }
  };

  const fieldStyle = (field: FieldName) => [
    styles.input,
    focusedField === field ? styles.inputFocused : null,
    showError(field) ? styles.inputError : null,
  ];

  const renderError = (field: FieldName) => {
    if (!showError(field)) return null;
    return <Text style={styles.fieldError}>{errors[field]}</Text>;
  };

  return (
    <LinearGradient colors={[theme.colors.bg, theme.colors.bgAlt, '#1A0B3A']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View style={[styles.brandWrap, introStyle]}>
            <Animated.View style={{ transform: [{ scale: logoScale }] }}>
              <LinearGradient colors={[theme.colors.primary, theme.colors.accent]} style={styles.logo}>
                <Text style={styles.logoText}>CR</Text>
              </LinearGradient>
            </Animated.View>
            <Text style={styles.title}>Card Rush Arena</Text>
            <Text style={styles.subtitle}>Fast Mau Mau matches, clean virtual rewards, no purchases.</Text>
          </Animated.View>

          <Animated.View style={[styles.card, cardIntroStyle]}>
            <View style={styles.segment}>
              <ModeButton active={mode === 'register'} label="Create" onPress={() => switchMode('register')} />
              <ModeButton active={mode === 'login'} label="Log In" onPress={() => switchMode('login')} />
            </View>

            {formMessage ? (
              <View style={styles.notice}>
                <Ionicons name="alert-circle" size={18} color={theme.colors.warning} />
                <Text style={styles.noticeText}>{formMessage}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Display name {mode === 'register' ? '(optional)' : '(guest only)'}</Text>
            <TextInput
              style={fieldStyle('name')}
              value={name}
              onChangeText={(value) => { setName(value); clearMessageOnEdit(); }}
              onBlur={() => { setFocusedField(null); setFieldTouched('name'); }}
              onFocus={() => setFocusedField('name')}
              placeholder="e.g. AceFlame"
              placeholderTextColor={theme.colors.textMuted}
              maxLength={20}
            />
            {renderError('name')}

            {mode === 'register' ? (
              <>
                <Text style={styles.label}>Profile</Text>
                <View style={styles.genderRow}>
                  <GenderButton active={gender === 'male'} label="Male" icon="man" onPress={() => { setGender('male'); clearMessageOnEdit(); }} />
                  <GenderButton active={gender === 'female'} label="Female" icon="woman" onPress={() => { setGender('female'); clearMessageOnEdit(); }} />
                </View>
                {renderError('gender')}
              </>
            ) : null}

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={fieldStyle('email')}
              value={email}
              onChangeText={(value) => { setEmail(value); clearMessageOnEdit(); }}
              onBlur={() => { setFocusedField(null); setFieldTouched('email'); }}
              onFocus={() => setFocusedField('email')}
              placeholder="you@example.com"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            {renderError('email')}

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={fieldStyle('password')}
              value={password}
              onChangeText={(value) => { setPassword(value); clearMessageOnEdit(); }}
              onBlur={() => { setFocusedField(null); setFieldTouched('password'); }}
              onFocus={() => setFocusedField('password')}
              placeholder="At least 6 characters"
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry
              textContentType={mode === 'register' ? 'newPassword' : 'password'}
            />
            {renderError('password')}

            {mode === 'register' ? (
              <>
                <Text style={styles.label}>Confirm password</Text>
                <TextInput
                  style={fieldStyle('confirmPassword')}
                  value={confirmPassword}
                  onChangeText={(value) => { setConfirmPassword(value); clearMessageOnEdit(); }}
                  onBlur={() => { setFocusedField(null); setFieldTouched('confirmPassword'); }}
                  onFocus={() => setFocusedField('confirmPassword')}
                  placeholder="Repeat password"
                  placeholderTextColor={theme.colors.textMuted}
                  secureTextEntry
                  textContentType="newPassword"
                />
                {renderError('confirmPassword')}
              </>
            ) : null}

            <Button
              title={mode === 'register' ? 'Create Account' : 'Log In'}
              onPress={submitEmail}
              loading={authBusy}
              disabled={guestBusy || resetBusy}
              fullWidth
            />
            {mode === 'login' ? (
              <>
                <View style={{ height: 8 }} />
                <Button
                  title="Forgot password?"
                  variant="ghost"
                  onPress={forgotPassword}
                  loading={resetBusy}
                  disabled={authBusy || guestBusy}
                  fullWidth
                />
              </>
            ) : null}
            <View style={{ height: 10 }} />
            <Button
              title={mode === 'register' ? 'I already have an account' : 'Create a new account'}
              variant="ghost"
              onPress={() => switchMode(mode === 'register' ? 'login' : 'register')}
              disabled={authBusy || guestBusy || resetBusy}
              fullWidth
            />
            <View style={{ height: 12 }} />
            <Button
              title="Continue as Guest"
              variant="secondary"
              onPress={guest}
              loading={guestBusy}
              disabled={authBusy || resetBusy}
              fullWidth
            />
            <Text style={styles.fine}>Guest progress lives on this device. Email login keeps your account available after reinstall or device change.</Text>
          </Animated.View>

          <NoMoneyFooter />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function ModeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segmentBtn, active && styles.segmentBtnActive]}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function GenderButton({
  active,
  label,
  icon,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.genderBtn, active && styles.genderBtnActive]}>
      <Ionicons name={icon} size={18} color={active ? '#fff' : theme.colors.textMuted} />
      <Text style={[styles.genderText, active && styles.genderTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, flexGrow: 1, justifyContent: 'center' },
  brandWrap: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 92, height: 92, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 38, fontWeight: '900' },
  title: { color: theme.colors.text, fontSize: 28, fontWeight: '900', marginTop: 14, textAlign: 'center' },
  subtitle: { color: theme.colors.textMuted, fontSize: 14, marginTop: 6, textAlign: 'center' },
  card: { width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 18, borderWidth: 1, borderColor: theme.colors.border },
  segment: { flexDirection: 'row', backgroundColor: theme.colors.bgAlt, borderRadius: theme.radius.pill, padding: 4, marginBottom: 14, borderWidth: 1, borderColor: theme.colors.border },
  segmentBtn: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.pill },
  segmentBtnActive: { backgroundColor: theme.colors.primary },
  segmentText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '900' },
  segmentTextActive: { color: '#fff' },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#3B2A05', borderColor: theme.colors.warning, borderWidth: 1, borderRadius: theme.radius.md, padding: 10, marginBottom: 14 },
  noticeText: { color: theme.colors.text, flex: 1, fontSize: 12, lineHeight: 17 },
  label: { color: theme.colors.textMuted, fontSize: 13, marginBottom: 6, marginLeft: 2 },
  genderRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  genderBtn: { flex: 1, minHeight: 42, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.bgAlt, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  genderBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.accent },
  genderText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '900' },
  genderTextActive: { color: '#fff' },
  input: { backgroundColor: theme.colors.bgAlt, color: theme.colors.text, borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  inputFocused: { borderColor: theme.colors.accent },
  inputError: { borderColor: theme.colors.warning },
  fieldError: { color: theme.colors.warning, fontSize: 11, lineHeight: 15, marginTop: -4, marginBottom: 8, marginLeft: 2 },
  fine: { color: theme.colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 12, lineHeight: 16 },
});
