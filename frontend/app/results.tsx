import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { theme } from '../src/theme';
import { Button, NoMoneyFooter } from '../src/components/UI';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/services/api';
import { useAuth } from '../src/services/auth';
import { OutOfCoinsModal } from '../src/components/OutOfCoinsModal';

export default function Results() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [starting, setStarting] = useState(false);
  const [showOOC, setShowOOC] = useState(false);
  const params = useLocalSearchParams<{ won?: string; coins?: string; rp?: string; xp?: string; duration?: string; cardsLeft?: string; winnerName?: string }>();
  const won = params.won === '1';
  const coins = parseInt(params.coins || '0', 10);
  const rp = parseInt(params.rp || '0', 10);
  const xp = parseInt(params.xp || '0', 10);
  const duration = parseInt(params.duration || '0', 10);
  const winnerName = params.winnerName || 'Opponent';

  const scale = useRef(new Animated.Value(0.6)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 600, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [fade, scale]);

  const playAgain = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const { data } = await api.post('/match/start', {});
      await refresh();
      router.replace({ pathname: '/game', params: { matchId: data.match_id, paidWith: data.paid_with } });
    } catch (e: any) {
      const status = e?.response?.status;
      const code = e?.response?.data?.detail?.code;
      if (status === 402 || code === 'INSUFFICIENT_BALANCE') {
        setShowOOC(true);
      } else {
        const msg = e?.response?.data?.detail?.message || e?.response?.data?.detail || 'Could not start match';
        alert(String(msg));
      }
    } finally {
      setStarting(false);
    }
  };

  return (
    <LinearGradient colors={won ? ['#1B0B3A', '#3B1B6A', theme.colors.primary] : ['#0E0B1F', '#1B0B3A']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <Animated.View style={[styles.center, { opacity: fade, transform: [{ scale }] }]}>
          <View style={styles.medal}>
            <Ionicons name={won ? 'trophy' : 'sad'} color={won ? theme.colors.gold : theme.colors.textMuted} size={72} />
          </View>
          <Text style={styles.title}>{won ? 'Victory!' : 'Defeat'}</Text>
          <Text style={styles.subtitle}>{won ? 'You shed all your cards first.' : `${winnerName} shed first.`}</Text>

          <View style={styles.statsCard}>
            <Stat label="Coins" value={`+${coins}`} icon="🪙" />
            <Stat label="Rank Points" value={`${rp >= 0 ? '+' : ''}${rp}`} icon="🏆" negative={rp < 0} />
            <Stat label="XP" value={`+${xp}`} icon="✨" />
            <Stat label="Duration" value={`${Math.floor(duration / 60)}m ${duration % 60}s`} icon="⏱" />
          </View>

          <Button title="Play Again" onPress={playAgain} loading={starting} fullWidth />
          <View style={{ height: 10 }} />
          <Button title="Back to Lobby" variant="ghost" onPress={() => router.replace('/(tabs)/lobby')} fullWidth />
        </Animated.View>
        <NoMoneyFooter />
        <OutOfCoinsModal
          visible={showOOC}
          onClose={() => setShowOOC(false)}
          onGoToEarn={() => { setShowOOC(false); router.replace('/(tabs)/earn'); }}
          onRewarded={refresh}
          currentCoins={user?.coins ?? 0}
          currentTickets={user?.tickets ?? 0}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

function Stat({ label, value, icon, negative }: { label: string; value: string; icon: string; negative?: boolean }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, negative && { color: theme.colors.danger }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  medal: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 3, borderColor: theme.colors.gold, marginBottom: 18 },
  title: { color: '#fff', fontSize: 38, fontWeight: '900', letterSpacing: 1 },
  subtitle: { color: theme.colors.textMuted, fontSize: 14, marginTop: 4, marginBottom: 22, textAlign: 'center' },
  statsCard: { width: '100%', backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 16, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 24, gap: 8 },
  statRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  statIcon: { fontSize: 18, width: 28 },
  statLabel: { color: theme.colors.textMuted, fontSize: 14, flex: 1 },
  statValue: { color: theme.colors.text, fontSize: 16, fontWeight: '900' },
});
