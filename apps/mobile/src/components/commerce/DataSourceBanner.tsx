import { View, StyleSheet } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { useI18n } from "../../i18n/I18nProvider";
import { getDataSource } from "../../data/catalogService";
import { Text } from "../ui/Text";

/**
 * Makes the active data source explicit.
 *
 * When the app is running on bundled fixtures, the products on screen are SAMPLE
 * DATA. Showing them with no marker would let someone mistake them for live
 * stock, which is exactly the kind of misleading-content problem the product
 * brief calls out. The banner is dev-facing and never claims to be real data.
 */
export function DataSourceBanner() {
  const { colors } = useTheme();
  const { t } = useI18n();

  if (getDataSource() === "convex") return null;

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: colors.accent[50], borderColor: colors.accent[500] },
      ]}
      accessibilityRole="alert"
    >
      <Text variant="caption" tone="primary">
        {t("data.sampleDataTitle")}
      </Text>
      <Text variant="caption" tone="secondary" style={styles.detail}>
        {t("data.sampleDataBody")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  detail: {
    marginTop: 2,
  },
});
