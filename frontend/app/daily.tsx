import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../src/theme';
import { Button } from '../src/components/UI';
import { api } from '../src/services/api';
import { useAuth } from '../src/services/auth';

export default function Daily() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get('/daily/status');
      setStatus(data);
    } catch {}
  };
  useEffect(() => { load(); }, []);

  const claim = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/daily/claim', {});
      await refresh();
      Alert.alert('Reward claimed!', `+${data.reward} coins · Streak: ${data.streak}`);
      await load();
    } catch (e: any) {
      Alert.alert('Cannot claim', e?.response?.data?.detail || 'Try again later');
    } finally { setBusy(false); }
  };

  const fmtTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <LinearGradient colors={[theme.colors.bg, theme.colors.bgAlt]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.headerRow}>
            <Text style={styles.heading}>Daily Rewards</Text>
            <Button title="Close" variant="ghost" small onPress={() => router.back()} />
          </View>
          <Text style={styles.sub}>Come back every day to grow your streak and earn bigger rewards.</Text>

          {status && (
            <View style={styles.daysGrid}>
              {status.schedule.map((rew: number, idx: number) => {
                const isToday = idx === Math.min(status.streak, status.schedule.length - 1);
                const isPast = idx < status.streak;
                return (
                  <View key={idx} style={[styles.dayCard, isToday && styles.dayCardToday, isPast && styles.dayCardPast]}>
                    <Text style={styles.dayLabel}>Day {idx + 1}</Text>
                    <Ionicons name="gift" size={22} color={isToday ? theme.colors.gold : isPast ? theme.colors.success : theme.colors.textMuted} />
                    <Text style={styles.dayReward}>+{rew}</Text>
                    <Text style={styles.dayCoin}>🪙</Text>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.claimCard}>
            {status?.can_claim ? (
              <>
                <Text style={styles.claimTitle}>Today reward: +{status.today_reward} coins</Text>
                <Button title="Claim Now" onPress={claim} loading={busy} fullWidth />
              </>
            ) : status ? (
              <>
                <Text style={styles.claimTitle}>Next reward in {fmtTime(status.next_in_seconds || 0)}</Text>
                <Button title="Already claimed today" variant="secondary" disabled fullWidth />
              </>
            ) : (
              <Text style={styles.claimTitle}>Loading…</Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { color: theme.colors.text, fontSize: 26, fontWeight: '900' },
  sub: { color: theme.colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: 16 },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginBottom: 16 },
  dayCard: { width: '13.5%', minWidth: 50, backgroundColor: theme.colors.surface, alignItems: 'center', paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, gap: 2 },
  dayCardToday: { borderColor: theme.colors.gold, backgroundColor: '#2D2358' },
  dayCardPast: { opacity: 0.55 },
  dayLabel: { color: theme.colors.textMuted, fontSize: 9, fontWeight: '700' },
  dayReward: { color: theme.colors.text, fontSize: 13, fontWeight: '900' },
  dayCoin: { fontSize: 10 },
  claimCard: { backgroundColor: theme.colors.surface, padding: 18, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', gap: 12 },
  claimTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
});
