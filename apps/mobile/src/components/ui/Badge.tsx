import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { Text } from "./Text";
import { radii, spacing } from "../../theme/tokens";

export type BadgeTone = "brand" | "accent" | "success" | "warning" | "danger" | "neutral";

export interface BadgeProps {
  readonly label: string;
  readonly tone?: BadgeTone;
  readonly size?: "sm" | "md";
  readonly style?: StyleProp<ViewStyle>;
}

export function Badge({ label, tone = "brand", size = "md", style }: BadgeProps) {
  const { colors } = useTheme();

  let bg = colors.brand[50];
  let textTone: "brand" | "accent" | "danger" | "primary" = "brand";

  if (tone === "accent") {
    bg = colors.accent[50];
    textTone = "accent";
  } else if (tone === "success") {
    bg = colors.success[50];
    textTone = "brand";
  } else if (tone === "warning") {
    bg = colors.warning[50];
    textTone = "accent";
  } else if (tone === "danger") {
    bg = colors.danger[50];
    textTone = "danger";
  } else if (tone === "neutral") {
    bg = colors.surface.subtle;
    textTone = "primary";
  }

  const verticalPadding = size === "sm" ? 2 : spacing[1];
  const horizontalPadding = size === "sm" ? spacing[2] : spacing[3];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          paddingVertical: verticalPadding,
          paddingHorizontal: horizontalPadding,
        },
        style,
      ]}
      accessibilityRole="text"
    >
      <Text variant="label" tone={textTone} style={size === "sm" ? styles.smallText : undefined}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radii.full,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
  },
  smallText: {
    fontSize: 11,
    lineHeight: 14,
  },
});
