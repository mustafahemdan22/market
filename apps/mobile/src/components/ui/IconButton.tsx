import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { Pressable } from "./Pressable";
import { radii, touchTargets } from "../../theme/tokens";

export type IconButtonVariant = "ghost" | "filled" | "outline";

export interface IconButtonProps {
  readonly icon: React.ReactNode;
  readonly onPress: () => void;
  readonly accessibilityLabel: string; // Required for a11y compliance per DESIGN_SYSTEM.md §5.3
  readonly variant?: IconButtonVariant;
  readonly disabled?: boolean;
  readonly size?: number;
  readonly style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = "ghost",
  disabled = false,
  size = touchTargets.min,
  style,
}: IconButtonProps) {
  const { colors } = useTheme();

  let backgroundColor = "transparent";
  let borderColor = "transparent";

  if (variant === "filled") {
    backgroundColor = colors.surface.subtle;
  } else if (variant === "outline") {
    borderColor = colors.border.subtle;
  }

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: radii.full,
          backgroundColor,
          borderColor,
          borderWidth: borderColor !== "transparent" ? 1 : 0,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: touchTargets.min,
    minHeight: touchTargets.min,
    justifyContent: "center",
    alignItems: "center",
  },
});
