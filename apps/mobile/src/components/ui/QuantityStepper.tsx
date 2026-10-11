import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { useI18n, useFormat } from "../../i18n/I18nProvider";
import { Pressable } from "./Pressable";
import { Text } from "./Text";
import { radii, spacing, touchTargets } from "../../theme/tokens";

export interface QuantityStepperProps {
  readonly value: number;
  readonly onChange: (nextValue: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly disabled?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly size?: "sm" | "md";
}

export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  disabled = false,
  style,
  size = "md",
}: QuantityStepperProps) {
  const { colors } = useTheme();
  const { isRTL } = useI18n();
  const { formatNumber } = useFormat();

  const canDecrease = !disabled && value > min;
  const canIncrease = !disabled && value < max;

  const handleDecrease = () => {
    if (canDecrease) {
      onChange(value - 1);
    }
  };

  const handleIncrease = () => {
    if (canIncrease) {
      onChange(value + 1);
    }
  };

  const buttonSize = size === "sm" ? 36 : touchTargets.min;

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: colors.border.subtle,
          backgroundColor: colors.surface.card,
          flexDirection: isRTL ? "row-reverse" : "row",
        },
        style,
      ]}
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: value }}
    >
      <Pressable
        disabled={!canDecrease}
        onPress={handleDecrease}
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        style={[
          styles.stepperButton,
          {
            width: buttonSize,
            height: buttonSize,
            opacity: canDecrease ? 1 : 0.3,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={value === 1 && min === 0 ? "trash-can-outline" : "minus"}
          size={18}
          color={value === 1 && min === 0 ? colors.danger[600] : colors.brand[600]}
        />
      </Pressable>

      <View style={styles.valueContainer}>
        <Text variant={size === "sm" ? "caption" : "bodyStrong"} align="center">
          {formatNumber(value)}
        </Text>
      </View>

      <Pressable
        disabled={!canIncrease}
        onPress={handleIncrease}
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        style={[
          styles.stepperButton,
          {
            width: buttonSize,
            height: buttonSize,
            opacity: canIncrease ? 1 : 0.3,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="plus"
          size={18}
          color={colors.brand[600]}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  stepperButton: {
    justifyContent: "center",
    alignItems: "center",
  },
  valueContainer: {
    minWidth: 28,
    paddingHorizontal: spacing[2],
    justifyContent: "center",
    alignItems: "center",
  },
});
