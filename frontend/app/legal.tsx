import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../src/theme';

export default function Legal() {
  const router = useRouter();
  return (
    <LinearGradient colors={[theme.colors.bg, theme.colors.bgAlt]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.heading}>App Info</Text>
            <View style={{ width: 26 }} />
          </View>

          <View style={styles.notice}>
            <Ionicons name="information-circle" size={22} color={theme.colors.accent} />
            <Text style={styles.noticeText}>
              Card Rush Arena stores your game profile and match progress so you can keep playing across sessions.
            </Text>
          </View>

          <Section title="Account">
            Email accounts use Firebase Authentication. Guest sessions are saved locally on this device.
          </Section>
          <Section title="Game Progress">
            The game API stores your display name, rank, coins, tickets, missions, rewards, and match results.
          </Section>
          <Section title="Privacy">
            We use your account data to run the game experience, save progress, and show leaderboard entries.
          </Section>
          <Section title="Support">
            If something breaks, send your account email, username, device type, and a short description of the issue.
          </Section>

          <Text style={styles.contact}>Contact: support@cardrush.example</Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  heading: { color: theme.colors.text, fontSize: 20, fontWeight: '900' },
  notice: { flexDirection: 'row', gap: 10, backgroundColor: '#10264A', padding: 14, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.accent, marginBottom: 18 },
  noticeText: { color: theme.colors.text, fontSize: 13, lineHeight: 19, flex: 1 },
  section: { backgroundColor: theme.colors.surface, padding: 14, borderRadius: theme.radius.md, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border },
  sectionTitle: { color: theme.colors.accent, fontWeight: '900', fontSize: 14, marginBottom: 6, letterSpacing: 0.5 },
  sectionText: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 },
  contact: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 12, fontSize: 12 },
});
