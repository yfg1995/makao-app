import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, useWindowDimensions, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/services/auth';
import { Pill, PressScale } from '../../src/components/UI';
import { theme } from '../../src/theme';
import { api } from '../../src/services/api';
import { OutOfCoinsModal } from '../../src/components/OutOfCoinsModal';

export default function Lobby() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);
  const [dailyAvail, setDailyAvail] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showOOC, setShowOOC] = useState(false);

  const compact = width < 380;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
      const { data } = await api.get('/daily/status');
      setDailyAvail(!!data.can_claim);
    } catch {
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  useEffect(() => { onRefresh(); }, [onRefresh]);

  const startMatch = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const { data } = await api.post('/match/start', {});
      await refresh();
      router.push({ pathname: '/game', params: { matchId: data.match_id, paidWith: data.paid_with } });
    } catch (e: any) {
      const status = e?.response?.status;
      const code = e?.response?.data?.detail?.code;
      if (status === 402 || code === 'INSUFFICIENT_BALANCE') {
        setShowOOC(true);
      } else if (status === 429 && code === 'DAILY_MATCH_LIMIT_REACHED') {
        const detail = e?.response?.data?.detail;
        Alert.alert('Daily match limit', detail?.message || 'You can play 3 matches per day. Come back tomorrow.');
      } else {
        const msg = e?.response?.data?.detail?.message || e?.response?.data?.detail || 'Could not start match';
        Alert.alert('Could not start match', String(msg));
      }
    } finally {
      setStarting(false);
    }
  };

  if (!user) return null;

  return (
    <LinearGradient colors={[theme.colors.bg, theme.colors.bgAlt]} style={{flex:1}}>
      <SafeAreaView style={{flex:1}} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}> 
          <View style={styles.header}>
            <View>
              <Text style={styles.greet}>Welcome back,</Text>
              <Text style={styles.name}>{user.username}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/settings')}>
              <Ionicons name="settings-outline" color={theme.colors.text} size={26} />
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <Pill icon={<Text>C</Text>} value={user.coins} label="Coins" />
            <Pill icon={<Text>T</Text>} value={user.tickets} label="Tickets" />
            <Pill icon={<Text>RP</Text>} value={user.rank_points} label={user.league} />
          </View>

          <LinearGradient colors={[theme.colors.primary, theme.colors.accent]} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.hero, compact && styles.heroCompact]}>
            <View style={{flex:1}}>
              <Text style={styles.heroLabel}>Quick Match</Text>
              <Text style={styles.heroTitle}>Mau Mau Match</Text>
              <Text style={styles.heroSub}>Entry: 1 ticket or 100 coins - 3 matches/day</Text>
            </View>
            <PressScale onPress={startMatch} disabled={starting} style={[styles.heroBtn, compact && styles.heroBtnCompact, starting && { opacity: 0.7 }]}>
              {starting ? (
                <ActivityIndicator color="#0E0B1F" />
              ) : (
                <>
                  <Text style={styles.heroBtnText}>PLAY</Text>
                  <Ionicons name="play" color="#0E0B1F" size={20} />
                </>
              )}
            </PressScale>
          </LinearGradient>

          <View style={[styles.gridRow, compact && styles.gridColumn]}>
            <PressScale style={[styles.tile, { backgroundColor: '#3B2A78' }]} onPress={() => router.push('/(tabs)/earn')}>
              <Ionicons name="gift" color={theme.colors.gold} size={28} />
              <Text style={styles.tileTitle}>Daily Reward</Text>
              <Text style={styles.tileSub}>{dailyAvail ? 'Available now!' : 'Come back tomorrow'}</Text>
              {dailyAvail && <View style={styles.badgeDot} />}
            </PressScale>
            <PressScale style={[styles.tile, { backgroundColor: '#0C4A6E' }]} onPress={() => router.push('/(tabs)/missions')}>
              <Ionicons name="trophy" color={theme.colors.warning} size={28} />
              <Text style={styles.tileTitle}>Missions</Text>
              <Text style={styles.tileSub}>Daily goals</Text>
            </PressScale>
          </View>
          <View style={[styles.gridRow, compact && styles.gridColumn]}>
            <PressScale style={[styles.tile, { backgroundColor: '#5B21B6' }]} onPress={() => router.push('/(tabs)/leaderboard')}>
              <Ionicons name="podium" color="#fff" size={28} />
              <Text style={styles.tileTitle}>Leaderboard</Text>
              <Text style={styles.tileSub}>Climb leagues</Text>
            </PressScale>
            <PressScale style={[styles.tile, { backgroundColor: '#155E75' }]} onPress={() => router.push('/(tabs)/earn')}>
              <Ionicons name="gift" color={theme.colors.accent} size={28} />
              <Text style={styles.tileTitle}>Earn</Text>
              <Text style={styles.tileSub}>30s ads</Text>
            </PressScale>
          </View>

          <View style={styles.rulesCard}>
            <Text style={styles.rulesTitle}>How to Win</Text>
            <Text style={styles.rulesText}>Match suit or rank and empty your hand first. 2 makes the previous player draw 4, 7 makes the next player draw 3, 8 skips, J changes suit, Q reverses direction, and A lets you play again.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      <OutOfCoinsModal
        visible={showOOC}
        onClose={() => setShowOOC(false)}
        onGoToEarn={() => { setShowOOC(false); router.push('/(tabs)/earn'); }}
        onRewarded={refresh}
        currentCoins={user.coins}
        currentTickets={user.tickets}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  greet: { color: theme.colors.textMuted, fontSize: 13 },
  name: { color: theme.colors.text, fontSize: 24, fontWeight: '900' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  hero: { flexDirection: 'row', alignItems: 'center', borderRadius: theme.radius.lg, padding: 20, marginBottom: 16, shadowColor: theme.colors.primary, shadowOpacity: 0.5, shadowRadius: 16, elevation: 6 },
  heroCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 14 },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, letterSpacing: 1.5, fontWeight: '700' },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4 },
  heroBtn: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.radius.pill, gap: 4 },
  heroBtnCompact: { justifyContent: 'center' },
  heroBtnText: { color: '#0E0B1F', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  gridRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  gridColumn: { flexDirection: 'column' },
  tile: { flex: 1, borderRadius: theme.radius.lg, padding: 16, minHeight: 110, borderWidth: 1, borderColor: theme.colors.border, position: 'relative' },
  tileTitle: { color: '#fff', fontWeight: '800', marginTop: 10, fontSize: 16 },
  tileSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  badgeDot: { position: 'absolute', top: 12, right: 12, width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.danger },
  rulesCard: { backgroundColor: theme.colors.surface, padding: 16, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, marginTop: 8 },
  rulesTitle: { color: theme.colors.text, fontWeight: '900', fontSize: 16, marginBottom: 6 },
  rulesText: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 },
});
