import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { Card as GameCard, suitColor, suitGlyph, actionLabel } from '../game/engine';
import { PressScale } from './UI';

interface CardViewProps {
  card: GameCard;
  onPress?: () => void;
  small?: boolean;
  disabled?: boolean;
  highlight?: boolean;
  hidden?: boolean;
  width?: number;
}

export function CardView({ card, onPress, small, disabled, highlight, hidden, width }: CardViewProps) {
  const w = width || (small ? 50 : 78);
  const h = w * 1.45;

  if (hidden) {
    return (
      <View style={[styles.cardBack, { width: w, height: h, opacity: disabled ? 0.5 : 1 }]}>
        <LinearGradient
          colors={['#1D4ED8', '#7C3AED', '#0F172A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.cardBackInner, { width: w - 6, height: h - 6 }]}
        >
          <View style={styles.backMark}>
            <Text style={[styles.backSuit, { fontSize: Math.max(18, w * 0.34) }]}>★</Text>
            <Text style={[styles.cardBackLogo, { fontSize: Math.max(11, w * 0.18) }]}>CR</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  const isWild = card.suit === 'Wild';
  const color = suitColor(card.suit);
  const label = card.value !== null ? String(card.value) : actionLabel(card.action);
  const face = (
    <View
      style={[
        styles.card,
        {
          width: w,
          height: h,
          borderColor: highlight ? theme.colors.accent : '#E5E7EB',
          borderWidth: highlight ? 2 : 1,
          shadowColor: highlight ? theme.colors.accent : '#000',
          opacity: disabled ? 0.52 : 1,
        },
      ]}
    >
      <LinearGradient
        colors={isWild ? ['#F97316', '#E11D48', '#2563EB', '#16A34A'] : ['#FFFFFF', '#F8FAFC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.cardInner, { width: w - 4, height: h - 4 }]}
      >
        <View style={styles.cornerTL}>
          <Text style={[styles.cornerValue, { color: isWild ? '#fff' : color, fontSize: small ? 10 : 14 }]}>{label}</Text>
          <Text style={[styles.cornerSuit, { color: isWild ? '#fff' : color, fontSize: small ? 11 : 14 }]}>{suitGlyph(card.suit)}</Text>
        </View>

        <View style={styles.center}>
          <Text style={[styles.centerGlyph, { color: isWild ? '#fff' : color, fontSize: small ? 24 : Math.max(34, w * 0.5) }]}>
            {suitGlyph(card.suit)}
          </Text>
          <Text style={[styles.centerVal, { color: isWild ? '#fff' : color, fontSize: small ? 17 : Math.max(23, w * 0.34) }]}>
            {label}
          </Text>
        </View>

        <View style={styles.cornerBR}>
          <Text style={[styles.cornerValue, styles.rotated, { color: isWild ? '#fff' : color, fontSize: small ? 10 : 14 }]}>{label}</Text>
          <Text style={[styles.cornerSuit, styles.rotated, { color: isWild ? '#fff' : color, fontSize: small ? 11 : 14 }]}>{suitGlyph(card.suit)}</Text>
        </View>

        {card.action ? (
          <View style={[styles.badge, { backgroundColor: isWild ? 'rgba(255,255,255,0.22)' : withAlpha(color, 0.12) }]}>
            <Text style={[styles.badgeText, { color: isWild ? '#fff' : color }]}>{actionLabel(card.action)}</Text>
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );

  if (!onPress || disabled) {
    return <View>{face}</View>;
  }
  return <PressScale onPress={onPress}>{face}</PressScale>;
}

function withAlpha(hex: string, alpha: number): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    shadowOpacity: 0.28,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  cardInner: { borderRadius: 10, alignItems: 'center', justifyContent: 'center', padding: 5, overflow: 'hidden' },
  cardBack: { borderRadius: 12, backgroundColor: '#0F172A', padding: 3, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  cardBackInner: { borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  backMark: { width: '72%', aspectRatio: 1, borderRadius: 999, borderWidth: 2, borderColor: 'rgba(255,255,255,0.65)', alignItems: 'center', justifyContent: 'center' },
  backSuit: { color: '#fff', fontWeight: '900', marginBottom: -2 },
  cardBackLogo: { color: '#fff', fontWeight: '900', letterSpacing: 1 },
  cornerTL: { position: 'absolute', top: 5, left: 6, alignItems: 'center' },
  cornerBR: { position: 'absolute', bottom: 5, right: 6, alignItems: 'center' },
  cornerValue: { fontWeight: '900', lineHeight: 15 },
  cornerSuit: { fontWeight: '900', lineHeight: 15 },
  rotated: { transform: [{ rotate: '180deg' }] },
  center: { alignItems: 'center', justifyContent: 'center' },
  centerGlyph: { fontWeight: '900', lineHeight: 44 },
  centerVal: { fontWeight: '900', marginTop: 1 },
  badge: { position: 'absolute', bottom: 10, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 9, fontWeight: '900' },
});
