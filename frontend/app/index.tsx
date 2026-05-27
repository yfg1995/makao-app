import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/services/auth';
import { theme } from '../src/theme';

export default function Splash() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const scale = useRef(new Animated.Value(0.8)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 700, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      if (user) router.replace('/(tabs)/lobby');
      else router.replace('/login');
    }, 900);
    return () => clearTimeout(t);
  }, [loading, user]);

  return (
    <LinearGradient colors={[theme.colors.bg, theme.colors.bgAlt, '#1A0B3A']} style={styles.root}>
      <Animated.View style={{ transform: [{ scale }], opacity: fade, alignItems: 'center' }}>
        <View style={styles.logoWrap}>
          <LinearGradient colors={[theme.colors.primary, theme.colors.accent]} style={styles.logo}>
            <Text style={styles.logoText}>CR</Text>
          </LinearGradient>
        </View>
        <Text style={styles.title}>Card Rush Arena</Text>
        <Text style={styles.tagline}>Fast • Tactical • Free-to-Play</Text>
      </Animated.View>
      <View style={styles.bottom}>
        <ActivityIndicator color={theme.colors.accent} />
        <Text style={styles.disclaimer}>No real-money gambling. Virtual currency only.</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoWrap: { borderRadius: 32, overflow: 'hidden', shadowColor: theme.colors.primary, shadowOpacity: 0.8, shadowRadius: 24 },
  logo: { width: 120, height: 120, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 52, fontWeight: '900', letterSpacing: -2 },
  title: { color: theme.colors.text, fontSize: 34, fontWeight: '900', marginTop: 20, letterSpacing: 0.5 },
  tagline: { color: theme.colors.textMuted, fontSize: 14, marginTop: 6, letterSpacing: 1.5 },
  bottom: { position: 'absolute', bottom: 60, alignItems: 'center', gap: 12 },
  disclaimer: { color: theme.colors.textMuted, fontSize: 11 },
});
