import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../src/theme';
import { Button, Pill, NoMoneyFooter } from '../../src/components/UI';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/services/auth';
import { adsService } from '../../src/services/ads';

export default function Shop() {
  const { user, refresh } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try { const { data } = await api.get('/shop/items'); setItems(data.items || []); } catch {}
  };
  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); await refresh(); setRefreshing(false); };

  const buy = async (id: string) => {
    setBusy(id);
    try { await api.post('/shop/purchase', { item_id: id }); await refresh(); Alert.alert('Purchase complete', 'Inventory updated!'); }
    catch (e: any) { Alert.alert('Cannot purchase', e?.response?.data?.detail || 'Try again'); }
    finally { setBusy(null); }
  };

  const watchAd = async () => {
    setBusy('ad');
    const r = await adsService.showRewardedAd();
    if (r.ok) { await refresh(); Alert.alert('Reward!', `+${r.reward_coins || 50} coins (mock ad).`); }
    else { Alert.alert('No ad available', 'Try again later'); }
    setBusy(null);
  };

  if (!user) return null;

  return (
    <LinearGradient colors={[theme.colors.bg, theme.colors.bgAlt]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}>
          <Text style={styles.heading}>Shop</Text>
          <Text style={styles.sub}>Spend virtual coins/tickets. No real money involved.</Text>

          <View style={styles.balRow}>
            <Pill icon={<Text>🪙</Text>} value={user.coins} label="Coins" />
            <Pill icon={<Text>🎫</Text>} value={user.tickets} label="Tickets" />
          </View>

          <View style={styles.adCard}>
            <Ionicons name="play-circle" size={32} color={theme.colors.accent} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.adTitle}>Free Coins (Watch Ad)</Text>
              <Text style={styles.adSub}>Mocked AdMob — instant +50 coins for testing.</Text>
            </View>
            <Button title="Watch" small onPress={watchAd} loading={busy === 'ad'} />
          </View>

          <Text style={styles.sectionTitle}>Bundles</Text>
          {items.map((it) => (
            <View key={it.id} style={styles.itemRow}>
              <View style={[styles.itemIcon, { backgroundColor: it.coins ? '#3B2A05' : '#0F3B4D' }]}>
                <Text style={{ fontSize: 24 }}>{it.coins ? '🪙' : '🎫'}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.itemTitle}>{it.title}</Text>
                <Text style={styles.itemSub}>
                  {it.coins ? `+${it.coins} coins` : `+${it.tickets} tickets`}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.itemCost}>
                  {it.cost_tickets ? `${it.cost_tickets} 🎫` : `${it.cost_coins} 🪙`}
                </Text>
                <Button title="Buy" small onPress={() => buy(it.id)} loading={busy === it.id} />
              </View>
            </View>
          ))}

          <NoMoneyFooter />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  heading: { color: theme.colors.text, fontSize: 26, fontWeight: '900' },
  sub: { color: theme.colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: 12 },
  balRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  adCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, padding: 14, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.accent },
  adTitle: { color: theme.colors.text, fontWeight: '800', fontSize: 15 },
  adSub: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  sectionTitle: { color: theme.colors.text, fontWeight: '900', fontSize: 18, marginTop: 20, marginBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, padding: 12, borderRadius: theme.radius.md, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border },
  itemIcon: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  itemSub: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  itemCost: { color: theme.colors.gold, fontWeight: '900', marginBottom: 6 },
});
