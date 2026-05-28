import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { Button } from './UI';

interface AdSimulatorModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void; // triggered after the user fully watches the 5s ad
  duration?: number; // seconds (default 5)
  adNumber?: number; // 1 or 2 (X of 2 for context)
  totalAds?: number;
}

/**
 * Fake/simulated rewarded ad. NEVER serves real ads.
 * Shows a 5 second counter, a faux "Sponsor" banner, and a Skip button that
 * only becomes active once the timer hits zero. On complete it calls onComplete
 * exactly once and then onClose. Closing early discards the watch (no reward).
 */
export function AdSimulatorModal({
  visible,
  onClose,
  onComplete,
  duration = 5,
  adNumber,
  totalAds,
}: AdSimulatorModalProps) {
  const [remaining, setRemaining] = useState(duration);
  const [completed, setCompleted] = useState(false);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!visible) return;
    setRemaining(duration);
    setCompleted(false);
    completedRef.current = false;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: duration * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          if (!completedRef.current) {
            completedRef.current = true;
            setCompleted(true);
            // small delay before firing onComplete so UI updates
            setTimeout(() => onCompleteRef.current(), 250);
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [visible, duration, progress]);

  const widthInterp = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={() => { if (completed) onClose(); }}>
      <View style={styles.root}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.sponsorTag}>
              <Ionicons name="megaphone" size={12} color="#0E0B1F" />
              <Text style={styles.sponsorText}>SPONSORED · DEMO</Text>
            </View>
            {totalAds ? (
              <Text style={styles.counter}>{adNumber}/{totalAds}</Text>
            ) : null}
          </View>

          <LinearGradient colors={[theme.colors.primary, theme.colors.accent]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.adBanner}>
            <Ionicons name="play-circle" size={56} color="#fff" />
            <Text style={styles.adTitle}>Mock Ad Playing</Text>
            <Text style={styles.adSub}>No real ads are served in this build.</Text>
          </LinearGradient>

          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: widthInterp }]} />
          </View>

          <Text style={styles.timerText}>
            {completed ? 'Reward unlocked' : `Skip in ${remaining}s`}
          </Text>

          <View style={{ height: 12 }} />

          {completed ? (
            <Button title="Continue" onPress={onClose} fullWidth icon={<Ionicons name="checkmark" size={18} color="#fff" />} />
          ) : (
            <TouchableOpacity disabled style={styles.skipDisabled}>
              <Text style={styles.skipDisabledText}>Skip Ad</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 18, width: '100%', maxWidth: 380, borderWidth: 1, borderColor: theme.colors.border },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sponsorTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.warning, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sponsorText: { color: '#0E0B1F', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  counter: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '800' },
  adBanner: { alignItems: 'center', justifyContent: 'center', padding: 32, borderRadius: theme.radius.md, marginBottom: 14 },
  adTitle: { color: '#fff', fontWeight: '900', fontSize: 18, marginTop: 6 },
  adSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 4, textAlign: 'center' },
  progressTrack: { height: 6, backgroundColor: theme.colors.bgAlt, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.accent },
  timerText: { color: theme.colors.text, fontWeight: '800', textAlign: 'center', marginTop: 8, fontSize: 13 },
  skipDisabled: { paddingVertical: 12, alignItems: 'center', backgroundColor: theme.colors.bgAlt, borderRadius: theme.radius.pill, opacity: 0.6 },
  skipDisabledText: { color: theme.colors.textMuted, fontWeight: '800', fontSize: 14 },
});
