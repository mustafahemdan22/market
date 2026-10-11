import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { useTheme } from "../../theme/ThemeProvider";
import { useI18n } from "../../i18n/I18nProvider";
import type { Category } from "../../data/catalogRepository";
import { Text } from "../ui/Text";
import { Pressable } from "../ui/Pressable";
import { radii, spacing, elevations } from "../../theme/tokens";

export interface CategoryTileProps {
  readonly category: Category;
  readonly onPress: () => void;
  readonly active?: boolean;
  readonly size?: "compact" | "regular";
  readonly style?: StyleProp<ViewStyle>;
}

export function CategoryTile({
  category,
  onPress,
  active = false,
  size = "compact",
  style,
}: CategoryTileProps) {
  const { colors } = useTheme();
  const { isRTL } = useI18n();

  const name = isRTL ? category.nameAr : category.name;
  const imageSize = size === "compact" ? 64 : 84;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ selected: active }}
      enforceMinTarget={false}
      style={[
        styles.container,
        {
          width: imageSize + spacing[3],
        },
        style,
      ]}
    >
      <View
        style={[
          styles.imageWrapper,
          {
            width: imageSize,
            height: imageSize,
            borderRadius: radii.full,
            borderColor: active ? colors.brand[600] : colors.border.subtle,
            borderWidth: active ? 2 : 1,
            backgroundColor: colors.surface.card,
            ...elevations.card,
          },
        ]}
      >
        <Image
          source={{ uri: category.imageUrl }}
          alt={name}
          contentFit="cover"
          style={styles.image}
        />
      </View>

      <Text
        variant="caption"
        tone={active ? "brand" : "primary"}
        align="center"
        numberOfLines={2}
        style={styles.label}
      >
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginEnd: spacing[3],
  },
  imageWrapper: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: radii.full,
  },
  label: {
    marginTop: spacing[1.5 as keyof typeof spacing] ?? 6,
    textAlign: "center",
    fontWeight: "500",
  },
});
