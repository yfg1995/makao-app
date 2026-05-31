import React, { useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, StyleProp, ViewStyle, Animated, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const inactive = !!disabled || !!loading;
  const baseStyle: StyleProp<ViewStyle> = [
    styles.btn,
    small ? styles.btnSmall : null,
    fullWidth ? styles.fullWidth : null,
    inactive ? styles.disabled : null,
  ];
  if (variant === 'primary') {
    return (
      <PressScale disabled={inactive} onPress={onPress} style={baseStyle}>
        <LinearGradient colors={[theme.colors.primary, theme.colors.accent]} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.gradient, small && styles.gradientSmall]}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              {icon}
              <Text style={[styles.btnText, small && {fontSize: 14}]}>{title}</Text>
            </>
          )}
        </LinearGradient>
      </PressScale>
    );
  }
  if (variant === 'secondary') {
    return (
      <PressScale disabled={inactive} onPress={onPress} style={[baseStyle, styles.secondary]}>
        {loading ? <ActivityIndicator color={theme.colors.text} /> : <Text style={[styles.btnText, small && {fontSize: 14}]}>{title}</Text>}
      </PressScale>
    );
  }
  if (variant === 'danger') {
    return (
      <PressScale disabled={inactive} onPress={onPress} style={[baseStyle, styles.danger]}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnText, small && {fontSize: 14}]}>{title}</Text>}
      </PressScale>
    );
  }
  return (
    <PressScale disabled={inactive} onPress={onPress} style={[baseStyle, styles.ghost]}>
      <Text style={[styles.btnText, { color: theme.colors.accent }, small && {fontSize: 14}]}>{title}</Text>
    </PressScale>
  );
}

export function PressScale({
  children,
  disabled,
  onPress,
  style,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      friction: 6,
      tension: 160,
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedPressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => !disabled && animateTo(0.97)}
      onPressOut={() => animateTo(1)}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
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
    <Text style={styles.disclaimer}>
      No gambling, no betting, no real-money winnings, no IAP or coin purchases. Coins have no cash value; rewards are virtual only.
    </Text>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: theme.radius.pill, overflow: 'hidden', minHeight: 48, justifyContent: 'center' },
  btnSmall: { minHeight: 36 },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.55 },
  gradient: { paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  gradientSmall: { paddingVertical: 8, paddingHorizontal: 16 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  secondary: { backgroundColor: theme.colors.surface, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 24, borderWidth: 1, borderColor: theme.colors.border },
  danger: { backgroundColor: '#7F1D1D', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 24 },
  ghost: { backgroundColor: 'transparent', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 24 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border },
  pillValue: { color: theme.colors.text, fontWeight: '800', fontSize: 14 },
  pillLabel: { color: theme.colors.textMuted, fontSize: 12, marginLeft: 2 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 16 },
  sectionTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  disclaimer: { color: theme.colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 12, paddingHorizontal: 16 },
});
