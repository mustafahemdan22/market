import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { useI18n } from "../../i18n/I18nProvider";
import { Pressable } from "./Pressable";
import { Text } from "./Text";
import { radii, spacing, touchTargets } from "../../theme/tokens";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly leftIcon?: React.ReactNode;
  readonly rightIcon?: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly accessibilityLabel?: string;
  readonly fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  accessibilityLabel,
  fullWidth = false,
}: ButtonProps) {
  const { colors } = useTheme();
  const { isRTL } = useI18n();

  const isInteractive = !disabled && !loading;

  // Variant backgrounds and borders
  let backgroundColor = colors.brand[600];
  let borderColor = "transparent";
  let textColor: "inverse" | "brand" | "danger" | "primary" | "muted" = "inverse";
  let spinnerColor = colors.neutral[0];

  if (variant === "secondary") {
    backgroundColor = colors.brand[50];
    textColor = "brand";
    spinnerColor = colors.brand[600];
  } else if (variant === "ghost") {
    backgroundColor = "transparent";
    borderColor = colors.border.subtle;
    textColor = "primary";
    spinnerColor = colors.brand[600];
  } else if (variant === "danger") {
    backgroundColor = colors.danger[600];
    textColor = "inverse";
    spinnerColor = colors.neutral[0];
  }

  if (disabled) {
    backgroundColor = colors.neutral[200];
    borderColor = "transparent";
    textColor = "muted";
  }

  // Size specifications
  const height = size === "sm" ? 38 : size === "md" ? 48 : 54;
  const paddingHorizontal = size === "sm" ? spacing[3] : spacing[4];
  const textVariant = size === "sm" ? "caption" : "bodyStrong";

  return (
    <Pressable
      disabled={!isInteractive}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      style={[
        styles.base,
        {
          height,
          paddingHorizontal,
          backgroundColor,
          borderColor,
          borderWidth: borderColor !== "transparent" ? 1 : 0,
          borderRadius: radii.md,
          width: fullWidth ? "100%" : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <View style={[styles.contentRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {leftIcon ? <View style={styles.iconSlot}>{leftIcon}</View> : null}
          <Text variant={textVariant} tone={textColor} align="center">
            {label}
          </Text>
          {rightIcon ? <View style={styles.iconSlot}>{rightIcon}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTargets.min,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  contentRow: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconSlot: {
    marginHorizontal: spacing[1],
  },
});
