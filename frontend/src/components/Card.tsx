// Card Rush Arena – original card visual.
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Image, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, images, radii } from "@/src/theme";
import type { Card as CardModel } from "@/src/game/engine";

interface Props {
  card?: CardModel; // optional => back
  size?: "sm" | "md" | "lg";
  faceDown?: boolean;
  style?: ViewStyle;
  activeSuitOverride?: string;
}

const SUIT_COLORS: Record<string, [string, string]> = {
  flame: ["#FF6B8A", "#FF1F4A"],
  wave: ["#39C9FF", "#0078B4"],
  leaf: ["#3FE4B6", "#079B6D"],
  bolt: ["#FFE08A", "#E5A100"],
  wild: ["#B5179E", "#5B12FF"],
};

const SUIT_ICON: Record<string, any> = {
  flame: { lib: MaterialCommunityIcons, name: "fire" },
  wave: { lib: MaterialCommunityIcons, name: "waves" },
  leaf: { lib: MaterialCommunityIcons, name: "leaf" },
  bolt: { lib: MaterialCommunityIcons, name: "lightning-bolt" },
  wild: { lib: MaterialCommunityIcons, name: "star-four-points" },
};

const sizes = {
  sm: { w: 44, h: 64, fs: 14, ic: 16 },
  md: { w: 64, h: 92, fs: 22, ic: 22 },
  lg: { w: 80, h: 112, fs: 28, ic: 28 },
};

export function GameCard({ card, size = "md", faceDown = false, style, activeSuitOverride }: Props) {
  const s = sizes[size];
  if (faceDown || !card) {
    return (
      <View testID="card-back" style={[styles.card, { width: s.w, height: s.h, borderColor: colors.border }, style]}>
        <Image source={{ uri: images.cardBack }} style={styles.cardBackImg} />
      </View>
    );
  }
  const suit = card.suit;
  const palette = SUIT_COLORS[suit] || SUIT_COLORS.wild;
  const iconInfo = SUIT_ICON[suit] || SUIT_ICON.wild;
  const IconLib = iconInfo.lib;
  const label = renderLabel(card.value);
  const isWild = suit === "wild";

  return (
    <View testID={`card-${card.suit}-${card.value}`} style={[styles.card, { width: s.w, height: s.h }, style]}>
      <LinearGradient
        colors={palette}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.cardInner}>
        <View style={styles.cornerTL}>
          <Text style={[styles.cornerText, { fontSize: s.fs * 0.55 }]}>{label}</Text>
          <IconLib name={iconInfo.name} size={s.ic * 0.6} color="#fff" />
        </View>
        {isWild ? (
          <View style={styles.wildCenter}>
            <View style={[styles.wildQuad, { backgroundColor: colors.suits.flame, top: 0, left: 0 }]} />
            <View style={[styles.wildQuad, { backgroundColor: colors.suits.wave, top: 0, right: 0 }]} />
            <View style={[styles.wildQuad, { backgroundColor: colors.suits.leaf, bottom: 0, left: 0 }]} />
            <View style={[styles.wildQuad, { backgroundColor: colors.suits.bolt, bottom: 0, right: 0 }]} />
            <View style={styles.wildLabelWrap}>
              <Text style={[styles.wildLabel, { fontSize: s.fs * 0.7 }]}>{card.value === "wild4" ? "+4" : "W"}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.center}>
            <IconLib name={iconInfo.name} size={s.ic * 1.7} color="#fff" />
            <Text style={[styles.centerText, { fontSize: s.fs }]}>{label}</Text>
          </View>
        )}
        <View style={styles.cornerBR}>
          <IconLib name={iconInfo.name} size={s.ic * 0.6} color="#fff" />
          <Text style={[styles.cornerText, { fontSize: s.fs * 0.55 }]}>{label}</Text>
        </View>
      </View>
      {activeSuitOverride && card.value === "wild" ? (
        <View style={[styles.activeBadge, { backgroundColor: colors.suits[activeSuitOverride as keyof typeof colors.suits] }]} />
      ) : null}
    </View>
  );
}

function renderLabel(value: string): string {
  switch (value) {
    case "skip":
      return "⦸";
    case "reverse":
      return "⇄";
    case "draw2":
      return "+2";
    case "wild":
      return "★";
    case "wild4":
      return "+4";
    default:
      return value;
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  cardInner: {
    flex: 1,
    padding: 4,
    justifyContent: "space-between",
  },
  cardBackImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  cornerTL: { flexDirection: "row", alignItems: "center", gap: 2 },
  cornerBR: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-end", transform: [{ rotate: "180deg" }] },
  cornerText: { color: "#fff", fontWeight: "900" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  centerText: { color: "#fff", fontWeight: "900", textShadowColor: "rgba(0,0,0,0.4)", textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  wildCenter: { flex: 1, margin: 4, borderRadius: 8, overflow: "hidden", position: "relative" },
  wildQuad: { position: "absolute", width: "50%", height: "50%" },
  wildLabelWrap: {
    position: "absolute",
    top: 0, bottom: 0, left: 0, right: 0,
    alignItems: "center", justifyContent: "center",
  },
  wildLabel: {
    color: "#fff",
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  activeBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#fff",
  },
});

export { Ionicons };
