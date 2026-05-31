import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../src/theme';
import { Button } from '../../src/components/UI';
import { useAuth } from '../../src/services/auth';
import { api } from '../../src/services/api';

export default function Profile() {
  const router = useRouter();
  const { user, signOut, setUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.username || '');
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.patch('/profile', { username: name });
      setUser(data);
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Could not save');
    } finally { setBusy(false); }
  };

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
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.headerRow}>
            <Text style={styles.heading}>Profile</Text>
            <TouchableOpacity onPress={() => router.push('/settings')}>
              <Ionicons name="settings-outline" size={26} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.profileCard}>
            <LinearGradient colors={[theme.colors.primary, theme.colors.accent]} style={styles.avatar}>
              <Text style={styles.avatarText}>{(user.username || '?').slice(0, 1).toUpperCase()}</Text>
            </LinearGradient>
            {editing ? (
              <View style={{ width: '100%', marginTop: 10 }}>
                <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={20} />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Button title="Save" small onPress={save} loading={busy} />
                  <Button title="Cancel" variant="ghost" small onPress={() => { setEditing(false); setName(user.username); }} />
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.name}>{user.username}</Text>
                <Text style={styles.sub}>{user.guest_mode ? 'Guest account' : (user.email || 'Signed in')}</Text>
                <View style={[styles.leaguePill, { borderColor: leagueColor(user.league) }]}>
                  <Text style={[styles.leagueText, { color: leagueColor(user.league) }]}>{user.league} - Lv {user.level}</Text>
                </View>
                <Button title="Edit Name" variant="secondary" small onPress={() => setEditing(true)} />
              </>
            )}
          </View>

          <View style={styles.statsGrid}>
            <StatTile label="Coins" value={user.coins} icon="C" />
            <StatTile label="Tickets" value={user.tickets} icon="T" />
            <StatTile label="Rank Points" value={user.rank_points} icon="RP" />
            <StatTile label="XP" value={user.xp} icon="XP" />
            <StatTile label="Daily Streak" value={user.daily_streak} icon="S" />
            <StatTile label="Level" value={user.level} icon="Lv" />
          </View>

          {user.guest_mode && (
            <View style={styles.warnCard}>
              <Ionicons name="alert-circle" size={20} color={theme.colors.warning} />
              <Text style={styles.warnText}>Guest progress can be lost. Register or log in with email to keep an account.</Text>
            </View>
          )}

          <View style={{ marginTop: 16, gap: 10 }}>
            <Button title="Settings" variant="secondary" onPress={() => router.push('/settings')} fullWidth />
            <Button title="App Info" variant="ghost" onPress={() => router.push('/legal')} fullWidth />
            <Button title="Sign Out" variant="danger" onPress={async () => { await signOut(); router.replace('/login'); }} fullWidth />
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function StatTile({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  heading: { color: theme.colors.text, fontSize: 26, fontWeight: '900' },
  profileCard: { alignItems: 'center', backgroundColor: theme.colors.surface, padding: 20, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, gap: 8 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 38, fontWeight: '900' },
  name: { color: theme.colors.text, fontSize: 22, fontWeight: '900' },
  sub: { color: theme.colors.textMuted, fontSize: 13 },
  leaguePill: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, marginVertical: 6 },
  leagueText: { fontSize: 12, fontWeight: '900' },
  input: { backgroundColor: theme.colors.bgAlt, color: theme.colors.text, borderRadius: theme.radius.md, padding: 10, borderWidth: 1, borderColor: theme.colors.border },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 16, gap: 10 },
  statTile: { width: '31%', backgroundColor: theme.colors.surface, padding: 12, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  statIcon: { fontSize: 20 },
  statValue: { color: theme.colors.text, fontSize: 18, fontWeight: '900', marginTop: 4 },
  statLabel: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  warnCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#3B2A05', padding: 12, borderRadius: theme.radius.md, marginTop: 16, borderWidth: 1, borderColor: theme.colors.warning },
  warnText: { color: theme.colors.text, flex: 1, fontSize: 12 },
});
