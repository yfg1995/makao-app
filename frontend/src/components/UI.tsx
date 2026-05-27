// Card Rush Arena – shared UI primitives.
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle, TextStyle } from "react-native";
import { colors, radii, spacing } from "@/src/theme";

export function Panel({ children, style, testID }: { children: React.ReactNode; style?: ViewStyle; testID?: string }) {
  return (
    <View testID={testID} style={[styles.panel, style]}>
      {children}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  testID,
  style,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: ViewStyle;
  variant?: "primary" | "secondary" | "danger" | "gold";
}) {
  const palettes: Record<string, [string, string]> = {
    primary: ["#34E9FF", "#00B0CC"],
    secondary: ["#3D3258", "#2A2342"],
    danger: ["#FF5C7A", "#C8123A"],
    gold: ["#FFE979", "#E8B600"],
  };
  const textColor = variant === "secondary" ? "#fff" : "#0B0914";
  return (
    <Pressable
      testID={testID}
      onPress={() => !disabled && !loading && onPress()}
      style={({ pressed }) => [
        styles.btnBase,
        style,
        { transform: [{ scale: pressed ? 0.97 : 1 }], opacity: disabled ? 0.5 : 1 },
      ]}
    >
      <LinearGradient
        colors={palettes[variant]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.btnText, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function StatPill({
  icon,
  label,
  value,
  color,
  testID,
}: {
  icon?: React.ReactNode;
  label?: string;
  value: string | number;
  color?: string;
  testID?: string;
}) {
  return (
    <View testID={testID} style={[styles.statPill, color ? { borderColor: color } : null]}>
      {icon}
      {label ? <Text style={styles.statLabel}>{label}</Text> : null}
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function ScreenTitle({ title, subtitle, style }: { title: string; subtitle?: string; style?: TextStyle }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={[styles.title, style]}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnBase: {
    height: 52,
    borderRadius: radii.pill,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  btnText: { fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: { color: colors.subtext, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  statValue: { color: colors.text, fontWeight: "900", fontSize: 14 },
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  subtitle: { color: colors.subtext, fontSize: 14, marginTop: 4 },
});
