import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { Button } from './UI';
import { api } from '../services/api';
import { AdSimulatorModal } from './AdSimulatorModal';

interface AdProgress {
  watched_today: number;
  daily_cap: number;
  pair_size: number;
  reward_per_pair: number;
  next_reward_in: number;
  daily_cap_reached: boolean;
  coins_earned_today: number;
  max_coins_today: number;
}

interface OutOfCoinsModalProps {
  visible: boolean;
  onClose: () => void;
  onRewarded?: () => void; // called after each successful ad or daily claim so caller can refresh
  currentCoins: number;
  currentTickets: number;
}

/**
 * Shown when /match/start returns 402 INSUFFICIENT_BALANCE or when a player
 * proactively wants to top up via ads. Offers ONLY: watch mock ad pairs and
 * claim daily reward. No real-money purchase paths exist.
 */
export function OutOfCoinsModal({ visible, onClose, onRewarded, currentCoins, currentTickets }: OutOfCoinsModalProps) {
  const [progress, setProgress] = useState<AdProgress | null>(null);
  const [showAd, setShowAd] = useState(false);
  const [daily, setDaily] = useState<{ can_claim: boolean; today_reward: number; next_in_seconds: number } | null>(null);
  const [claiming, setClaiming] = useState(false);

  const refresh = async () => {
    try {
      const [a, d] = await Promise.all([
        api.get('/ads/progress'),
        api.get('/daily/status'),
      ]);
      setProgress(a.data);
      setDaily(d.data);
    } catch {}
  };

  useEffect(() => {
    if (visible) refresh();
  }, [visible]);

  const onAdComplete = async () => {
    try {
      const { data } = await api.post('/ads/watch', {});
      await refresh();
      onRewarded?.();
      if (data.granted_coins > 0) {
        // small confirmation; do not block — the modal already updates
        setTimeout(() => Alert.alert('Reward!', `+${data.granted_coins} coins added.`), 350);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail?.message || e?.response?.data?.detail || 'Ad failed';
      Alert.alert('Could not record ad', String(msg));
    }
  };

  const claimDaily = async () => {
    setClaiming(true);
    try {
      const { data } = await api.post('/daily/claim', {});
      await refresh();
      onRewarded?.();
      Alert.alert('Daily Reward', `+${data.reward} coins! Streak: ${data.streak}`);
    } catch (e: any) {
      Alert.alert('Not available', e?.response?.data?.detail || 'Try again later');
    } finally {
      setClaiming(false);
    }
  };

  const adNumber = progress ? (progress.watched_today % 2) + 1 : 1;
  const pairProgressLabel = progress ? `${progress.watched_today % 2}/2 ads watched` : '';
  const capReached = !!progress?.daily_cap_reached;
  const canClaimDaily = !!daily?.can_claim;

  return (
    <>
      <Modal visible={visible && !showAd} animationType="fade" transparent onRequestClose={onClose}>
        <View style={styles.root}>
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Ionicons name="alert-circle" size={28} color={theme.colors.warning} />
              <Text style={styles.title}>Out of Coins</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sub}>
              You don't have enough to start a match (need 1 ticket or 100 coins).
              You currently have {currentTickets} tickets · {currentCoins} coins.
            </Text>
            <Text style={styles.legal}>
              No purchases, no IAP, no real money. Earn coins ONLY by watching mock ads or claiming the daily reward.
            </Text>

            {/* Watch Ad Card */}
            <LinearGradient colors={[theme.colors.primary, theme.colors.accent]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.actionCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Watch 2 Ads = 100 Coins</Text>
                <Text style={styles.actionSub}>{capReached ? 'Daily ad limit reached. Come back tomorrow.' : pairProgressLabel}</Text>
                {progress && (
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${((progress.watched_today % 2) / 2) * 100}%` }]} />
                  </View>
                )}
              </View>
              <TouchableOpacity
                disabled={capReached}
                onPress={() => setShowAd(true)}
                style={[styles.cta, capReached && { opacity: 0.4 }]}
                activeOpacity={0.85}
              >
                <Ionicons name="play" size={18} color="#0E0B1F" />
                <Text style={styles.ctaText}>{capReached ? 'Maxed' : 'Watch'}</Text>
              </TouchableOpacity>
            </LinearGradient>

            {/* Daily Reward Card */}
            <View style={styles.dailyCard}>
              <Ionicons name="gift" size={26} color={theme.colors.gold} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.dailyTitle}>Daily Reward {daily ? `+${daily.today_reward}` : ''}</Text>
                <Text style={styles.dailySub}>{canClaimDaily ? 'Available now' : daily ? `Back in ${Math.ceil((daily.next_in_seconds || 0) / 3600)}h` : '…'}</Text>
              </View>
              <Button title={canClaimDaily ? 'Claim' : 'Locked'} small onPress={claimDaily} loading={claiming} disabled={!canClaimDaily} />
            </View>

            {progress && (
              <Text style={styles.capInfo}>
                Ads today: {progress.watched_today}/{progress.daily_cap} · Earned today: {progress.coins_earned_today}/{progress.max_coins_today}
              </Text>
            )}
          </View>
        </View>
      </Modal>

      <AdSimulatorModal
        visible={showAd}
        onClose={() => setShowAd(false)}
        onComplete={onAdComplete}
        adNumber={adNumber}
        totalAds={2}
        duration={5}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 18, width: '100%', maxWidth: 420, borderWidth: 1, borderColor: theme.colors.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  title: { color: theme.colors.text, fontSize: 20, fontWeight: '900', flex: 1 },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  sub: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  legal: { color: theme.colors.warning, fontSize: 11, lineHeight: 16, marginBottom: 14, fontStyle: 'italic' },
  actionCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: theme.radius.lg, marginBottom: 12 },
  actionTitle: { color: '#fff', fontWeight: '900', fontSize: 15 },
  actionSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 },
  progressTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: theme.radius.pill, marginLeft: 10 },
  ctaText: { color: '#0E0B1F', fontWeight: '900' },
  dailyCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: theme.radius.md, backgroundColor: theme.colors.bgAlt, borderWidth: 1, borderColor: theme.colors.border },
  dailyTitle: { color: theme.colors.text, fontWeight: '800', fontSize: 14 },
  dailySub: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  capInfo: { color: theme.colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 10 },
});
