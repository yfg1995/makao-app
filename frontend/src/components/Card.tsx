import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { Card as GameCard, suitColor, suitGlyph } from '../game/engine';
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
          colors={['#0B3B2D', '#116145', '#0E1726']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.cardBackInner, { width: w - 6, height: h - 6 }]}
        >
          <View style={styles.backMark}>
            <Text style={[styles.backSuit, { fontSize: Math.max(18, w * 0.34) }]}>{suitGlyph('Spades')}</Text>
            <Text style={[styles.cardBackLogo, { fontSize: Math.max(11, w * 0.18) }]}>M</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  const color = suitColor(card.suit);
  const label = card.value;
  const face = (
    <View
      style={[
        styles.card,
        {
          width: w,
          height: h,
          borderColor: highlight ? theme.colors.accent : '#E2D8C3',
          borderWidth: highlight ? 2 : 1,
          shadowColor: highlight ? theme.colors.accent : '#000',
          opacity: disabled ? 0.52 : 1,
        },
      ]}
    >
      <LinearGradient
        colors={['#FFFFFF', '#F7F3E8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.cardInner, { width: w - 4, height: h - 4 }]}
      >
        <View style={styles.cornerTL}>
          <Text style={[styles.cornerValue, { color, fontSize: small ? 10 : 14 }]}>{label}</Text>
          <Text style={[styles.cornerSuit, { color, fontSize: small ? 11 : 14 }]}>{suitGlyph(card.suit)}</Text>
        </View>

        <View style={styles.center}>
          <Text style={[styles.centerGlyph, { color, fontSize: small ? 24 : Math.max(34, w * 0.5) }]}>
            {suitGlyph(card.suit)}
          </Text>
          <Text style={[styles.centerVal, { color, fontSize: small ? 17 : Math.max(23, w * 0.34) }]}>
            {label}
          </Text>
        </View>

        <View style={styles.cornerBR}>
          <Text style={[styles.cornerValue, styles.rotated, { color, fontSize: small ? 10 : 14 }]}>{label}</Text>
          <Text style={[styles.cornerSuit, styles.rotated, { color, fontSize: small ? 11 : 14 }]}>{suitGlyph(card.suit)}</Text>
        </View>
      </LinearGradient>
    </View>
  );

  if (!onPress || disabled) {
    return <View>{face}</View>;
  }
  return <PressScale onPress={onPress}>{face}</PressScale>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    shadowOpacity: 0.28,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  cardInner: { borderRadius: 6, alignItems: 'center', justifyContent: 'center', padding: 5, overflow: 'hidden' },
  cardBack: { borderRadius: 8, backgroundColor: '#0B2F25', padding: 3, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  cardBackInner: { borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  backMark: { width: '70%', aspectRatio: 1, borderRadius: 999, borderWidth: 2, borderColor: 'rgba(255,255,255,0.68)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
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
});
