import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { theme } from '../../src/theme';
import { Button, Pill } from '../../src/components/UI';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/services/auth';
import { AdSimulatorModal } from '../../src/components/AdSimulatorModal';

interface AdProgress {
  watched_today: number;
  daily_cap: number | null;
  pair_size: number;
  reward_per_pair: number;
  next_reward_in: number;
  daily_cap_reached: boolean;
  coins_earned_today: number;
  max_coins_today: number | null;
}

interface DailyStatus {
  can_claim: boolean;
  today_reward: number;
  next_in_seconds: number;
  streak: number;
}

/**
 * Earn screen - the main place to gain free coins.
 *
 * Rules:
 *   - No IAP, coin purchases, real-money winnings, betting, or gambling.
 *   - Virtual coins have no monetary value.
 *   - Coins can be earned by:
 *       1) Watching a pair of mock ads (2 ads = 100 coins)
 *       2) Claiming the daily reward
 */
export default function Earn() {
  const { user, refresh } = useAuth();
  const [progress, setProgress] = useState<AdProgress | null>(null);
  const [daily, setDaily] = useState<DailyStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [recording, setRecording] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, d] = await Promise.all([
        api.get('/ads/progress'),
        api.get('/daily/status'),
      ]);
      setProgress(a.data);
      setDaily(d.data);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), refresh()]);
    setRefreshing(false);
  };

  const onAdComplete = async () => {
    setShowAd(false);
    if (recording) return;
    setRecording(true);
    try {
      const { data } = await api.post('/ads/watch', {});
      await Promise.all([load(), refresh()]);
      if (data.granted_coins > 0) {
        setTimeout(() => Alert.alert('Reward!', `+${data.granted_coins} coins added.`), 250);
      } else {
        const remaining = data.next_reward_in || ((data.pair_size || 2) - (data.watched_today % (data.pair_size || 2)));
        setTimeout(() => Alert.alert('Almost there', `Watch ${remaining} more 30s ad to unlock 100 coins.`), 250);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail?.message || e?.response?.data?.detail || 'Ad failed';
      Alert.alert('Could not record ad', String(msg));
    } finally {
      setRecording(false);
    }
  };

  const claimDaily = async () => {
    setClaiming(true);
    try {
      const { data } = await api.post('/daily/claim', {});
      await Promise.all([load(), refresh()]);
      Alert.alert('Daily Reward', `+${data.reward} coins! Streak: ${data.streak} 🔥`);
    } catch (e: any) {
      Alert.alert('Not available', e?.response?.data?.detail || 'Try again later');
    } finally {
      setClaiming(false);
    }
  };

  if (!user) return null;

  const pairSize = progress?.pair_size ?? 2;
  const watchedInPair = progress ? progress.watched_today % pairSize : 0;
  const adNumber = (watchedInPair % pairSize) + 1;
  const pairProgressPct = (watchedInPair / pairSize) * 100;
  const canClaimDaily = !!daily?.can_claim;
  const dailyNextHours = daily ? Math.ceil((daily.next_in_seconds || 0) / 3600) : 0;

  return (
    <LinearGradient colors={[theme.colors.bg, theme.colors.bgAlt]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}
        >
          <Text style={styles.heading}>Earn Coins</Text>
          <Text style={styles.sub}>Free coins only. No IAP or coin purchases.</Text>

          <View style={styles.balRow}>
            <Pill icon={<Text>🪙</Text>} value={user.coins} label="Coins" />
            <Pill icon={<Text>🎫</Text>} value={user.tickets} label="Tickets" />
          </View>

          {/* === Watch Ad === */}
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroIcon}>
              <Ionicons name="play-circle" size={42} color="#fff" />
            </View>
            <Text style={styles.heroTitle}>Watch 2 Ads = 100 Coins</Text>
            <Text style={styles.heroSub}>
              {`Ad ${watchedInPair + 1}/${pairSize} - each 30s ad is half the coins for one match.`}
            </Text>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pairProgressPct}%` }]} />
            </View>

            <Button
              title={recording ? 'Recording...' : 'Watch 30s Ad'}
              onPress={() => setShowAd(true)}
              disabled={recording}
              loading={recording}
              fullWidth
              icon={<Ionicons name="play" size={18} color="#fff" />}
            />

            {progress && (
              <Text style={styles.heroMeta}>
                Ads watched today: {progress.watched_today} - earned today: {progress.coins_earned_today} coins
              </Text>
            )}
          </LinearGradient>

          {/* === Daily Reward === */}
          <View style={styles.dailyCard}>
            <View style={styles.dailyIcon}>
              <Ionicons name="gift" size={28} color={theme.colors.gold} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.dailyTitle}>
                Daily Reward {daily ? `+${daily.today_reward} 🪙` : ''}
              </Text>
              <Text style={styles.dailySub}>
                {canClaimDaily
                  ? 'Available now — claim before midnight'
                  : daily
                    ? `Back in ${dailyNextHours}h · streak ${daily.streak} 🔥`
                    : 'Loading…'}
              </Text>
            </View>
            <Button
              title={canClaimDaily ? 'Claim' : 'Locked'}
              onPress={claimDaily}
              loading={claiming}
              disabled={!canClaimDaily}
              small
            />
          </View>

          {/* === Value notice === */}
          <View style={styles.legalCard}>
            <Ionicons name="shield-checkmark" size={20} color={theme.colors.success} />
            <Text style={styles.legalText}>
              No gambling, no betting, no real-money winnings, no IAP or coin
              purchases. Coins have no cash value; rewards are virtual only.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      <AdSimulatorModal
        visible={showAd}
        onClose={() => setShowAd(false)}
        onComplete={onAdComplete}
        adNumber={adNumber}
        totalAds={pairSize}
        duration={30}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  heading: { color: theme.colors.text, fontSize: 26, fontWeight: '900' },
  sub: { color: theme.colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: 12 },
  balRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },

  heroCard: {
    borderRadius: theme.radius.lg,
    padding: 18,
    marginBottom: 16,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 5,
  },
  heroIcon: { alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 12 },
  progressTrack: { height: 8, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 4, overflow: 'hidden', marginBottom: 14 },
  progressFill: { height: '100%', backgroundColor: '#fff' },
  heroMeta: { color: 'rgba(255,255,255,0.85)', fontSize: 11, textAlign: 'center', marginTop: 10 },

  dailyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    padding: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  dailyIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3B2A05', borderRadius: 12 },
  dailyTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '900' },
  dailySub: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },

  legalCard: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: '#0F3B2D',
    borderWidth: 1,
    borderColor: theme.colors.success,
  },
  legalText: { color: theme.colors.text, fontSize: 12, lineHeight: 17, flex: 1, minWidth: 220 },
});
