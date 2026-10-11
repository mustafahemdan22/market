import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { useI18n } from "../../i18n/I18nProvider";
import { Text } from "./Text";
import { radii, spacing } from "../../theme/tokens";

export type BannerTone = "info" | "warning" | "danger" | "success" | "dev";

export interface BannerProps {
  readonly message: string;
  readonly tone?: BannerTone;
  readonly iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
  readonly style?: StyleProp<ViewStyle>;
}

export function Banner({
  message,
  tone = "info",
  iconName,
  style,
}: BannerProps) {
  const { colors } = useTheme();
  const { isRTL } = useI18n();

  let bg = colors.brand[50];
  let border = colors.brand[600];
  let iconColor = colors.brand[600];
  let defaultIcon: keyof typeof MaterialCommunityIcons.glyphMap = "information-outline";

  if (tone === "dev") {
    bg = colors.accent[50];
    border = colors.accent[500];
    iconColor = colors.accent[500];
    defaultIcon = "flask-outline";
  } else if (tone === "warning") {
    bg = colors.warning[50];
    border = colors.warning[600];
    iconColor = colors.warning[600];
    defaultIcon = "alert-outline";
  } else if (tone === "danger") {
    bg = colors.danger[50];
    border = colors.danger[600];
    iconColor = colors.danger[600];
    defaultIcon = "alert-circle-outline";
  } else if (tone === "success") {
    bg = colors.success[50];
    border = colors.success[600];
    iconColor = colors.success[600];
    defaultIcon = "check-circle-outline";
  }

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: bg,
          borderColor: border,
          flexDirection: isRTL ? "row-reverse" : "row",
        },
        style,
      ]}
      accessibilityRole="text"
    >
      <View style={styles.iconSlot}>
        <MaterialCommunityIcons
          name={iconName ?? defaultIcon}
          size={18}
          color={iconColor}
        />
      </View>
      <View style={styles.textContainer}>
        <Text variant="caption" tone="primary">
          {message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: "center",
    width: "100%",
  },
  iconSlot: {
    marginHorizontal: spacing[1],
  },
  textContainer: {
    flex: 1,
    marginHorizontal: spacing[1],
  },
});
