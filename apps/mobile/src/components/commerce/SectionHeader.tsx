import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { useI18n } from "../../i18n/I18nProvider";
import { Text } from "../ui/Text";
import { Pressable } from "../ui/Pressable";
import { spacing } from "../../theme/tokens";

export interface SectionHeaderProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly onSeeAll?: () => void;
  readonly seeAllLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
}

export function SectionHeader({
  title,
  subtitle,
  onSeeAll,
  seeAllLabel,
  style,
}: SectionHeaderProps) {
  const { colors } = useTheme();
  const { isRTL, t, mirrorStyle } = useI18n();

  return (
    <View
      style={[
        styles.container,
        { flexDirection: isRTL ? "row-reverse" : "row" },
        style,
      ]}
    >
      <View style={styles.titleColumn}>
        <Text variant="h2">{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary" style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {onSeeAll ? (
        <Pressable
          onPress={onSeeAll}
          accessibilityRole="button"
          accessibilityLabel={seeAllLabel ?? t("home.seeAll")}
          enforceMinTarget={false}
          style={styles.seeAllButton}
        >
          <View
            style={[
              styles.seeAllRow,
              { flexDirection: isRTL ? "row-reverse" : "row" },
            ]}
          >
            <Text variant="label" tone="brand">
              {seeAllLabel ?? t("home.seeAll")}
            </Text>
            <View style={[styles.chevron, mirrorStyle()]}>
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={colors.brand[600]}
              />
            </View>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing[3],
    marginTop: spacing[4],
  },
  titleColumn: {
    flex: 1,
  },
  subtitle: {
    marginTop: 2,
  },
  seeAllButton: {
    paddingVertical: spacing[1],
    paddingStart: spacing[2],
  },
  seeAllRow: {
    alignItems: "center",
  },
  chevron: {
    marginHorizontal: 2,
  },
});
