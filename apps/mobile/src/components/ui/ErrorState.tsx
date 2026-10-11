import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { useI18n } from "../../i18n/I18nProvider";
import { Text } from "./Text";
import { Button } from "./Button";
import { spacing } from "../../theme/tokens";

export interface ErrorStateProps {
  readonly message?: string;
  readonly onRetry?: () => void;
  readonly retryLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
}

export function ErrorState({
  message,
  onRetry,
  retryLabel,
  style,
}: ErrorStateProps) {
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: colors.danger[50] },
        ]}
      >
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={42}
          color={colors.danger[600]}
        />
      </View>

      <Text variant="h2" align="center" style={styles.title}>
        {t("state.error")}
      </Text>

      <Text variant="body" tone="secondary" align="center" style={styles.description}>
        {message ?? t("state.error")}
      </Text>

      {onRetry ? (
        <View style={styles.actionSlot}>
          <Button
            label={retryLabel ?? t("action.retry")}
            onPress={onRetry}
            variant="secondary"
            size="md"
          />
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
    minWidth: 160,
  },
});
