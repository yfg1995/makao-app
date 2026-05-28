import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../src/theme';
import { NoMoneyFooter } from '../src/components/UI';

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
            <Text style={styles.heading}>Legal & Disclaimers</Text>
            <View style={{ width: 26 }} />
          </View>

          <View style={styles.notice}>
            <Ionicons name="shield-checkmark" size={22} color={theme.colors.success} />
            <Text style={styles.noticeText}>
              Card Rush Arena is free-to-play and family-friendly.{"\n"}
              No gambling, no betting, no real-money winnings, no IAP or coin
              purchases. Coins have no cash value; rewards are virtual only.
            </Text>
          </View>

          <Section title="Virtual Currency">
            Coins, tickets, and rank points are purely in-game virtual items. They have no cash value and cannot be withdrawn, sold, transferred, exchanged, or redeemed for money or anything of real-world value.
          </Section>
          <Section title="No IAP / No Coin Purchases">
            This game has no in-app purchases, payment flow, or coin purchases. Coins are obtained by playing matches, watching mock ads, or claiming the daily reward.
          </Section>
          <Section title="No Gambling / No Betting">
            Match outcomes affect only virtual in-game progress. They do not involve betting, wagering, real-money winnings, prizes, or anything of real-world value.
          </Section>
          <Section title="Advertising">
            This MVP build uses a mocked ad service for development and testing. No real third-party ads are served in this build.
          </Section>
          <Section title="Privacy">
            Guest accounts store progress on this device. Email/password accounts use Firebase Authentication and the game API stores your username, email, and gameplay profile. We do not sell personal data.
          </Section>
          <Section title="Age & Region">
            Intended for ages 13+. Some jurisdictions restrict simulated card-game apps; please follow your local laws.
          </Section>
          <Section title="Terms of Service (Placeholder)">
            By playing, you agree to fair play, not exploiting bugs, and not abusing the rewarded ads system. We may reset progress in response to abuse.
          </Section>
          <Section title="Privacy Policy (Placeholder)">
            We collect: username, email for registered accounts, and gameplay stats. We do not collect or process payment data in this MVP.
          </Section>

          <Text style={styles.contact}>Contact: support@cardrush.example (placeholder)</Text>
          <NoMoneyFooter />
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
  notice: { flexDirection: 'row', gap: 10, backgroundColor: '#0F3B2D', padding: 14, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.success, marginBottom: 18 },
  noticeText: { color: theme.colors.text, fontSize: 13, lineHeight: 19, flex: 1 },
  section: { backgroundColor: theme.colors.surface, padding: 14, borderRadius: theme.radius.md, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border },
  sectionTitle: { color: theme.colors.accent, fontWeight: '900', fontSize: 14, marginBottom: 6, letterSpacing: 0.5 },
  sectionText: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 },
  contact: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 12, fontSize: 12 },
});
