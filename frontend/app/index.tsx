// Splash / boot router. Routes user based on auth state.
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { useAuth } from "@/src/services/auth";
import { colors, images } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();
  const glow = useSharedValue(0);

  useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [glow]);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      if (user) router.replace("/(tabs)/home");
      else router.replace("/login");
    }, 600);
    return () => clearTimeout(t);
  }, [loading, user]);

  const aStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + glow.value * 0.65,
    transform: [{ scale: 0.95 + glow.value * 0.1 }],
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#1B0F33", "#0B0914", "#082533"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <Animated.View style={[styles.glow, aStyle]}>
        <LinearGradient
          colors={["rgba(0,229,255,0.45)", "rgba(181,23,158,0.35)", "transparent"]}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      <View style={styles.logoWrap}>
        <Image source={{ uri: images.cardBack }} style={styles.logo} resizeMode="contain" />
      </View>
      <Text style={styles.brand}>CARD RUSH</Text>
      <Text style={styles.brand2}>ARENA</Text>
      <Text style={styles.tag}>Shed your hand. Steal the crown.</Text>
      <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  glow: { position: "absolute", width: 500, height: 500, borderRadius: 250, overflow: "hidden" },
  logoWrap: {
    width: 120, height: 160, alignItems: "center", justifyContent: "center",
    borderRadius: 16, overflow: "hidden", borderWidth: 2, borderColor: "rgba(0,229,255,0.4)",
    shadowColor: colors.primary, shadowOpacity: 0.7, shadowRadius: 18, shadowOffset: { width: 0, height: 0 },
  },
  logo: { width: "100%", height: "100%" },
  brand: { color: colors.text, fontSize: 38, fontWeight: "900", letterSpacing: 4, marginTop: 18 },
  brand2: { color: colors.primary, fontSize: 28, fontWeight: "900", letterSpacing: 8 },
  tag: { color: colors.subtext, marginTop: 12, fontStyle: "italic", fontSize: 13 },
});
