import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { Card as GameCard, suitColor, suitGlyph, actionLabel } from '../game/engine';

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
        <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} style={[styles.cardBackInner, { width: w-6, height: h-6 }]}>
          <Text style={styles.cardBackLogo}>★</Text>
        </LinearGradient>
      </View>
    );
  }

  const isWild = card.suit === 'Wild';
  const color = suitColor(card.suit);
  const isAction = !!card.action && card.action !== 'Wild';

  const inner = (
    <View style={[styles.card, { width: w, height: h, borderColor: highlight ? theme.colors.accent : theme.colors.border, borderWidth: highlight ? 2 : 1, shadowColor: highlight ? theme.colors.accent : '#000' }]}>
      <LinearGradient
        colors={isWild ? ['#F97316','#22D3EE','#34D399','#8B5CF6'] : [withAlpha(color, 0.18), withAlpha(color, 0.04)]}
        style={[styles.cardInner, { width: w - 4, height: h - 4 }]}
      >
        <View style={styles.cornerTL}>
          <Text style={[styles.cornerValue, { color: isWild ? '#fff' : color, fontSize: small ? 10 : 14 }]}>
            {card.value !== null ? card.value : actionLabel(card.action)}
          </Text>
          <Text style={[styles.cornerSuit, { fontSize: small ? 10 : 13 }]}>{suitGlyph(card.suit)}</Text>
        </View>
        <View style={styles.center}>
          <Text style={[styles.centerGlyph, { fontSize: small ? 24 : 38 }]}>{suitGlyph(card.suit)}</Text>
          {card.value !== null ? (
            <Text style={[styles.centerVal, { color: isWild ? '#fff' : color, fontSize: small ? 18 : 28 }]}>{card.value}</Text>
          ) : (
            <Text style={[styles.centerAction, { color: isWild ? '#fff' : color, fontSize: small ? 11 : 14 }]}>{actionLabel(card.action)}</Text>
          )}
        </View>
        <View style={styles.cornerBR}>
          <Text style={[styles.cornerValue, { color: isWild ? '#fff' : color, fontSize: small ? 10 : 14, transform: [{ rotate: '180deg' }] }]}>
            {card.value !== null ? card.value : actionLabel(card.action)}
          </Text>
        </View>
        {isAction && (
          <View style={[styles.badge, { backgroundColor: withAlpha(color, 0.9) }]}>
            <Text style={styles.badgeText}>{actionLabel(card.action)}</Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );

  if (!onPress || disabled) {
    return <View style={{ opacity: disabled ? 0.45 : 1 }}>{inner}</View>;
  }
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>{inner}</TouchableOpacity>
  );
}

function withAlpha(hex: string, a: number): string {
  // simple #RRGGBB to rgba
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0,2), 16);
  const g = parseInt(c.slice(2,4), 16);
  const b = parseInt(c.slice(4,6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const styles = StyleSheet.create({
  card: { borderRadius: 10, backgroundColor: '#1A1437', alignItems: 'center', justifyContent: 'center', padding: 2, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  cardInner: { borderRadius: 8, alignItems: 'center', justifyContent: 'center', padding: 4, overflow: 'hidden' },
  cardBack: { borderRadius: 10, backgroundColor: theme.colors.primaryDark, padding: 3 },
  cardBackInner: { borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardBackLogo: { color: '#fff', fontSize: 30, fontWeight: '900' },
  cornerTL: { position: 'absolute', top: 4, left: 6, alignItems: 'center' },
  cornerBR: { position: 'absolute', bottom: 4, right: 6, alignItems: 'center' },
  cornerValue: { fontWeight: '900' },
  cornerSuit: {},
  center: { alignItems: 'center', justifyContent: 'center' },
  centerGlyph: {},
  centerVal: { fontWeight: '900', marginTop: 2 },
  centerAction: { fontWeight: '800', marginTop: 4, textAlign: 'center' },
  badge: { position: 'absolute', bottom: -2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
