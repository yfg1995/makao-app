import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

// Standard deck of cards API image URL
const getCardImageUrl = (value: string, suit: string): string => {
  // Map suit to code
  const suitCode: Record<string, string> = {
    'Hearts': 'H',
    'Diamonds': 'D',
    'Clubs': 'C',
    'Spades': 'S',
  };
  
  // Map value to code (10 stays as 0, face cards are first letter)
  let valueCode = value;
  if (value === '10') valueCode = '0';
  
  return `https://deckofcardsapi.com/static/img/${valueCode}${suitCode[suit]}.png`;
};

// Card back image
const CARD_BACK_URL = 'https://deckofcardsapi.com/static/img/back.png';

export function CardView({ card, onPress, small, disabled, highlight, hidden, width }: CardViewProps) {
  const w = width || (small ? 50 : 78);
  const h = w * 1.4;

  if (hidden) {
    return (
      <View style={[styles.cardContainer, { width: w, height: h, opacity: disabled ? 0.5 : 1 }]}>
        <Image 
          source={{ uri: CARD_BACK_URL }}
          style={[styles.cardImage, { width: w, height: h }]}
          resizeMode="contain"
        />
      </View>
    );
  }

  const imageUrl = getCardImageUrl(card.value, card.suit);
  
  const cardElement = (
    <View
      style={[
        styles.cardContainer,
        {
          width: w,
          height: h,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    >
      <Image 
        source={{ uri: imageUrl }}
        style={[styles.cardImage, { width: w, height: h }]}
        resizeMode="contain"
      />
    </View>
  );

  if (!onPress || disabled) {
    return <View>{cardElement}</View>;
  }
  return <PressScale onPress={onPress}>{cardElement}</PressScale>;
}

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  cardImage: {
    borderRadius: 6,
  },
});
