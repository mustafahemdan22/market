import { View, TextInput, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { useI18n } from "../../i18n/I18nProvider";
import { IconButton } from "./IconButton";
import { radii, spacing, touchTargets } from "../../theme/tokens";

export interface SearchFieldProps {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly onClear?: () => void;
  readonly placeholder?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly autoFocus?: boolean;
  readonly onSubmitEditing?: () => void;
}

export function SearchField({
  value,
  onChangeText,
  onClear,
  placeholder,
  style,
  autoFocus = false,
  onSubmitEditing,
}: SearchFieldProps) {
  const { colors } = useTheme();
  const { isRTL, t } = useI18n();

  const handleClear = () => {
    onChangeText("");
    onClear?.();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface.card,
          borderColor: colors.border.subtle,
          flexDirection: isRTL ? "row-reverse" : "row",
        },
        style,
      ]}
    >
      <View style={styles.searchIcon}>
        <MaterialCommunityIcons name="magnify" size={22} color={colors.text.muted} />
      </View>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? t("header.searchPlaceholder")}
        placeholderTextColor={colors.text.muted}
        autoFocus={autoFocus}
        onSubmitEditing={onSubmitEditing}
        returnKeyType="search"
        style={[
          styles.input,
          {
            color: colors.text.primary,
            textAlign: isRTL ? "right" : "left",
          },
        ]}
      />

      {value.length > 0 ? (
        <IconButton
          icon={<MaterialCommunityIcons name="close-circle" size={18} color={colors.text.muted} />}
          onPress={handleClear}
          accessibilityLabel={t("search.clear")}
          size={36}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: touchTargets.min,
    borderWidth: 1,
    borderRadius: radii.md,
    alignItems: "center",
    paddingHorizontal: spacing[2],
  },
  searchIcon: {
    marginHorizontal: spacing[1],
  },
  input: {
    flex: 1,
    height: touchTargets.min,
    fontSize: 15,
    paddingHorizontal: spacing[1],
  },
});
