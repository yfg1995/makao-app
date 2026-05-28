import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../src/theme';
import { Button, NoMoneyFooter } from '../src/components/UI';
import { storage } from '../src/utils/storage';
import { useAuth } from '../src/services/auth';

export default function Settings() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [sound, setSound] = useState(true);
  const [haptics, setHaptics] = useState(true);

  useEffect(() => {
    (async () => {
      const s = await storage.getSettings();
      setSound(!!s.sound); setHaptics(!!s.haptics);
    })();
  }, []);

  const save = async (next: { sound: boolean; haptics: boolean }) => {
    await storage.setSettings(next);
  };

  return (
    <LinearGradient colors={[theme.colors.bg, theme.colors.bgAlt]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.heading}>Settings</Text>
            <View style={{ width: 26 }} />
          </View>

          <View style={styles.card}>
            <Row label="Sound effects" value={sound} onChange={(v) => { setSound(v); save({ sound: v, haptics }); }} />
            <Row label="Haptic feedback" value={haptics} onChange={(v) => { setHaptics(v); save({ sound, haptics: v }); }} />
          </View>

          <Text style={styles.section}>Account</Text>
          <View style={styles.card}>
            <Info label="Username" value={user?.username || '-'} />
            <Info label="Email" value={user?.email || (user?.guest_mode ? 'Guest' : '-')} />
            <Info label="League" value={user?.league || '-'} />
          </View>

          <Text style={styles.section}>About</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/legal')}>
              <Text style={styles.linkText}>Legal & Disclaimers</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
            <Info label="Version" value="1.0.0 (MVP)" />
            <Info label="Ads" value="Mocked (no real ads)" />
          </View>

          <View style={{ height: 16 }} />
          <Button title="Sign Out" variant="danger" onPress={async () => { await signOut(); router.replace('/login'); }} fullWidth />

          <NoMoneyFooter />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: '#3B2A78', true: theme.colors.accent }} thumbColor="#fff" />
    </View>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  heading: { color: theme.colors.text, fontSize: 22, fontWeight: '900' },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 6, borderWidth: 1, borderColor: theme.colors.border },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.bgAlt },
  rowLabel: { color: theme.colors.text, fontSize: 15 },
  rowVal: { color: theme.colors.textMuted, fontSize: 14 },
  section: { color: theme.colors.textMuted, fontSize: 12, letterSpacing: 1.5, fontWeight: '800', marginTop: 18, marginBottom: 8, marginLeft: 6 },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.bgAlt },
  linkText: { color: theme.colors.accent, fontSize: 15, fontWeight: '700' },
});
