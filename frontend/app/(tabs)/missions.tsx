import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../src/theme';
import { Button, NoMoneyFooter } from '../../src/components/UI';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/services/auth';

export default function Missions() {
  const { refresh } = useAuth();
  const [data, setData] = useState<{ missions: any[]; metrics: any } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const { data } = await api.get('/missions'); setData(data); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const claim = async (id: string) => {
    setClaiming(id);
    try {
      const { data } = await api.post('/missions/claim', { mission_id: id });
      await refresh();
      await load();
      Alert.alert('Reward!', `+${data.reward} coins`);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Could not claim');
    } finally { setClaiming(null); }
  };

  return (
    <LinearGradient colors={[theme.colors.bg, theme.colors.bgAlt]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}>
          <Text style={styles.heading}>Daily Missions</Text>
          <Text style={styles.sub}>Resets every 24 hours. Earn coins by playing matches.</Text>

          {!data && <Text style={styles.muted}>Loading…</Text>}

          {data?.missions.map((m) => {
            const pct = Math.min(100, Math.round((m.progress / m.goal) * 100));
            return (
              <View key={m.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <Ionicons name="trophy-outline" size={22} color={theme.colors.gold} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.cardTitle}>{m.title}</Text>
                    <Text style={styles.cardSub}>+{m.reward_coins} 🪙 · {m.progress}/{m.goal}</Text>
                  </View>
                </View>
                <View style={styles.progress}><View style={[styles.progressFill, { width: `${pct}%` }]} /></View>
                {m.claimed ? (
                  <View style={styles.doneRow}><Ionicons name="checkmark-circle" size={20} color={theme.colors.success} /><Text style={styles.doneText}>Claimed</Text></View>
                ) : m.completed ? (
                  <Button title="Claim Reward" small onPress={() => claim(m.id)} loading={claiming === m.id} />
                ) : (
                  <Button title={`${m.goal - m.progress} more to go`} variant="secondary" small disabled />
                )}
              </View>
            );
          })}

          <NoMoneyFooter />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  heading: { color: theme.colors.text, fontSize: 26, fontWeight: '900' },
  sub: { color: theme.colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: 16 },
  muted: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 20 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  cardSub: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  progress: { height: 8, backgroundColor: theme.colors.bgAlt, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: theme.colors.accent },
  doneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  doneText: { color: theme.colors.success, fontWeight: '800' },
});
