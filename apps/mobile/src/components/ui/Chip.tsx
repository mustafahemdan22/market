import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { Pressable } from "./Pressable";
import { Text } from "./Text";
import { radii, spacing } from "../../theme/tokens";

export interface ChipProps {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly icon?: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly accessibilityLabel?: string;
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  style,
  accessibilityLabel,
}: ChipProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.brand[50] : colors.surface.card,
          borderColor: selected ? colors.brand[600] : colors.border.subtle,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
        <Text
          variant="label"
          tone={selected ? "brand" : "secondary"}
          align="center"
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing[3],
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginEnd: spacing[2],
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconSlot: {
    marginEnd: spacing[1],
  },
});
