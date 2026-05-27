import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button({ title, onPress, variant='primary', disabled, loading, small, icon, fullWidth }: ButtonProps) {
  const baseStyle = [styles.btn, small && styles.btnSmall, fullWidth && { alignSelf: 'stretch' }, disabled && { opacity: 0.55 }];
  if (variant === 'primary') {
    return (
      <TouchableOpacity activeOpacity={0.85} disabled={disabled || loading} onPress={onPress} style={baseStyle}>
        <LinearGradient colors={[theme.colors.primary, theme.colors.accent]} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.gradient, small && styles.gradientSmall]}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              {icon}
              <Text style={[styles.btnText, small && {fontSize: 14}]}>{title}</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }
  if (variant === 'secondary') {
    return (
      <TouchableOpacity activeOpacity={0.85} disabled={disabled||loading} onPress={onPress} style={[baseStyle, styles.secondary]}>
        {loading ? <ActivityIndicator color={theme.colors.text} /> : <Text style={[styles.btnText, small && {fontSize: 14}]}>{title}</Text>}
      </TouchableOpacity>
    );
  }
  if (variant === 'danger') {
    return (
      <TouchableOpacity activeOpacity={0.85} disabled={disabled||loading} onPress={onPress} style={[baseStyle, { backgroundColor: '#7F1D1D' }]}>
        <Text style={[styles.btnText, small && {fontSize: 14}]}>{title}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity activeOpacity={0.85} disabled={disabled||loading} onPress={onPress} style={[baseStyle, styles.ghost]}>
      <Text style={[styles.btnText, { color: theme.colors.accent }, small && {fontSize: 14}]}>{title}</Text>
    </TouchableOpacity>
  );
}

export function Pill({ label, value, icon, color }: { label?: string; value: string | number; icon?: React.ReactNode; color?: string }) {
  return (
    <View style={[styles.pill, color && { borderColor: color }]}>
      {icon}
      <Text style={styles.pillValue}>{value}</Text>
      {label ? <Text style={styles.pillLabel}>{label}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <View style={[styles.card, style]}>{children}</View>
  );
}

export function ScreenContainer({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient colors={[theme.colors.bg, theme.colors.bgAlt]} style={{ flex: 1 }}>
      {children}
    </LinearGradient>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function NoMoneyFooter() {
  return (
    <Text style={styles.disclaimer}>Virtual currency has no monetary value. Free-to-play, no real-money betting.</Text>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: theme.radius.pill, overflow: 'hidden', minHeight: 48, justifyContent: 'center' },
  btnSmall: { minHeight: 36 },
  gradient: { paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  gradientSmall: { paddingVertical: 8, paddingHorizontal: 16 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  secondary: { backgroundColor: theme.colors.surface, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 24, borderWidth: 1, borderColor: theme.colors.border },
  ghost: { backgroundColor: 'transparent', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 24 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border },
  pillValue: { color: theme.colors.text, fontWeight: '800', fontSize: 14 },
  pillLabel: { color: theme.colors.textMuted, fontSize: 12, marginLeft: 2 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 16 },
  sectionTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  disclaimer: { color: theme.colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 12, paddingHorizontal: 16 },
});
