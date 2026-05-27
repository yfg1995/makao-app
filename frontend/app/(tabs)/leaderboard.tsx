import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../src/theme';
import { api } from '../../src/services/api';
import { NoMoneyFooter } from '../../src/components/UI';

export default function Leaderboard() {
  const [entries, setEntries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try { const { data } = await api.get('/leaderboard'); setEntries(data.entries || []); } catch {}
  };
  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const leagueColor = (lg: string) => {
    switch (lg) {
      case 'Diamond': return theme.colors.diamond;
      case 'Platinum': return theme.colors.platinum;
      case 'Gold': return theme.colors.gold;
      case 'Silver': return theme.colors.silver;
      default: return theme.colors.bronze;
    }
  };

  return (
    <LinearGradient colors={[theme.colors.bg, theme.colors.bgAlt]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ padding: 16, paddingBottom: 0 }}>
          <Text style={styles.heading}>Leaderboard</Text>
          <Text style={styles.sub}>Global ranking by Rank Points</Text>
        </View>
        <FlatList
          data={entries}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 40 }}>No entries yet</Text>}
          renderItem={({ item }) => {
            const medal = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : null;
            return (
              <View style={[styles.row, item.is_me && styles.rowMe]}>
                <View style={styles.rankBox}>
                  {medal ? <Text style={styles.medal}>{medal}</Text> : <Text style={styles.rankNum}>#{item.rank}</Text>}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.name}>{item.username}{item.is_me ? '  (you)' : ''}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <View style={[styles.leaguePill, { borderColor: leagueColor(item.league) }]}>
                      <Text style={[styles.leagueText, { color: leagueColor(item.league) }]}>{item.league}</Text>
                    </View>
                    <Text style={styles.sublbl}>Lv {item.level}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.rp}>{item.rank_points}</Text>
                  <Text style={styles.sublbl}>RP</Text>
                </View>
              </View>
            );
          }}
          ListFooterComponent={<NoMoneyFooter />}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  heading: { color: theme.colors.text, fontSize: 26, fontWeight: '900' },
  sub: { color: theme.colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, padding: 12, borderRadius: theme.radius.md, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  rowMe: { borderColor: theme.colors.accent, backgroundColor: '#1E2C5E' },
  rankBox: { width: 44, alignItems: 'center' },
  medal: { fontSize: 22 },
  rankNum: { color: theme.colors.textMuted, fontWeight: '900' },
  name: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  leaguePill: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  leagueText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  sublbl: { color: theme.colors.textMuted, fontSize: 11 },
  rp: { color: theme.colors.gold, fontWeight: '900', fontSize: 18 },
});
