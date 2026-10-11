import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { Text } from "./Text";
import { Button } from "./Button";
import { spacing } from "../../theme/tokens";

export interface EmptyStateProps {
  readonly title: string;
  readonly description: string;
  readonly iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  title,
  description,
  iconName = "basket-outline",
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.brand[50] }]}>
        <MaterialCommunityIcons name={iconName} size={42} color={colors.brand[600]} />
      </View>

      <Text variant="h2" align="center" style={styles.title}>
        {title}
      </Text>

      <Text variant="body" tone="secondary" align="center" style={styles.description}>
        {description}
      </Text>

      {actionLabel && onAction ? (
        <View style={styles.actionSlot}>
          <Button label={actionLabel} onPress={onAction} variant="primary" size="md" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing[6],
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[4],
  },
  title: {
    marginBottom: spacing[2],
  },
  description: {
    maxWidth: 320,
    marginBottom: spacing[5],
  },
  actionSlot: {
    minWidth: 180,
  },
});
