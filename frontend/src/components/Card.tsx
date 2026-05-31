import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
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

// Face card images - Using DiceBear for stylized face cards
const getFaceCardImage = (value: string, suit: string) => {
  const isRed = suit === 'Hearts' || suit === 'Diamonds';
  const color = isRed ? 'dc2626' : '1e1e1e';
  const bgColor = isRed ? 'fef2f2' : 'f8fafc';
  
  // Create unique seeds for each face card
  const seed = `${value}-${suit}-card`;
  
  // Using DiceBear personas style for face cards
  return `https://api.dicebear.com/7.x/personas/png?seed=${encodeURIComponent(seed)}&size=64&backgroundColor=${bgColor}`;
};

// Serbian card names
const getCardLabel = (value: string): string => {
  switch (value) {
    case 'J': return 'J';
    case 'Q': return 'Q';
    case 'K': return 'K';
    case 'A': return 'A';
    default: return value;
  }
};

export function CardView({ card, onPress, small, disabled, highlight, hidden, width }: CardViewProps) {
  const w = width || (small ? 50 : 78);
  const h = w * 1.45;
  const isFaceCard = card.value === 'J' || card.value === 'Q' || card.value === 'K';

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
  const label = getCardLabel(card.value);
  
  const face = (
    <View
      style={[
        styles.card,
        {
          width: w,
          height: h,
          borderColor: '#E2D8C3',
          borderWidth: 1,
          shadowColor: '#000',
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
        {/* Top Left Corner */}
        <View style={styles.cornerTL}>
          <Text style={[styles.cornerValue, { color, fontSize: small ? 10 : 13 }]}>{label}</Text>
          <Text style={[styles.cornerSuit, { color, fontSize: small ? 10 : 12 }]}>{suitGlyph(card.suit)}</Text>
        </View>

        {/* Center Content */}
        <View style={styles.center}>
          {isFaceCard ? (
            // Face card with image
            <View style={styles.faceCardCenter}>
              <Image 
                source={{ uri: getFaceCardImage(card.value, card.suit) }}
                style={[styles.faceImage, { width: w * 0.65, height: w * 0.65 }]}
                resizeMode="cover"
              />
              <Text style={[styles.faceLabelSmall, { color }]}>{label}</Text>
            </View>
          ) : (
            // Regular card - suit symbol and value
            <>
              <Text style={[styles.centerGlyph, { color, fontSize: small ? 24 : Math.max(32, w * 0.48) }]}>
                {suitGlyph(card.suit)}
              </Text>
              <Text style={[styles.centerVal, { color, fontSize: small ? 16 : Math.max(20, w * 0.3) }]}>
                {label}
              </Text>
            </>
          )}
        </View>

        {/* Bottom Right Corner */}
        <View style={styles.cornerBR}>
          <Text style={[styles.cornerValue, styles.rotated, { color, fontSize: small ? 10 : 13 }]}>{label}</Text>
          <Text style={[styles.cornerSuit, styles.rotated, { color, fontSize: small ? 10 : 12 }]}>{suitGlyph(card.suit)}</Text>
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
  cardInner: { 
    borderRadius: 6, 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 5, 
    overflow: 'hidden' 
  },
  cardBack: { 
    borderRadius: 8, 
    backgroundColor: '#0B2F25', 
    padding: 3, 
    shadowColor: '#000', 
    shadowOpacity: 0.25, 
    shadowRadius: 8, 
    shadowOffset: { width: 0, height: 5 }, 
    elevation: 4 
  },
  cardBackInner: { 
    borderRadius: 6, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  backMark: { 
    width: '70%', 
    aspectRatio: 1, 
    borderRadius: 999, 
    borderWidth: 2, 
    borderColor: 'rgba(255,255,255,0.68)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: 'rgba(255,255,255,0.08)' 
  },
  backSuit: { color: '#fff', fontWeight: '900', marginBottom: -2 },
  cardBackLogo: { color: '#fff', fontWeight: '900', letterSpacing: 1 },
  cornerTL: { position: 'absolute', top: 4, left: 5, alignItems: 'center' },
  cornerBR: { position: 'absolute', bottom: 4, right: 5, alignItems: 'center' },
  cornerValue: { fontWeight: '900', lineHeight: 14 },
  cornerSuit: { fontWeight: '900', lineHeight: 14 },
  rotated: { transform: [{ rotate: '180deg' }] },
  center: { alignItems: 'center', justifyContent: 'center' },
  centerGlyph: { fontWeight: '900', lineHeight: 40 },
  centerVal: { fontWeight: '900', marginTop: 2 },
  
  // Face card specific styles
  faceCardCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceImage: {
    borderRadius: 8,
    backgroundColor: '#F0EDE8',
  },
  faceLabel: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  faceLabelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  faceLabelSmall: {
    fontSize: 11,
    fontWeight: '900',
    marginTop: 2,
  },
});
