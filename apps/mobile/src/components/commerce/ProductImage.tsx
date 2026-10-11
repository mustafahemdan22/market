import { useState } from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { radii } from "../../theme/tokens";

export interface ProductImageProps {
  readonly uri?: string | undefined;
  readonly alt: string;
  readonly aspectRatio?: number;
  readonly borderRadius?: number;
  readonly style?: StyleProp<ViewStyle>;
}

export function ProductImage({
  uri,
  alt,
  aspectRatio = 1,
  borderRadius = radii.md,
  style,
}: ProductImageProps) {
  const { colors } = useTheme();
  const [hasError, setHasError] = useState(false);

  const isMissing = !uri || uri.trim().length === 0 || hasError;

  return (
    <View
      style={[
        styles.container,
        {
          aspectRatio,
          borderRadius,
          backgroundColor: colors.surface.subtle,
        },
        style,
      ]}
    >
      {!isMissing ? (
        <Image
          source={{ uri }}
          alt={alt}
          contentFit="cover"
          transition={200}
          onError={() => setHasError(true)}
          style={[styles.image, { borderRadius }]}
        />
      ) : (
        <View style={styles.fallbackContainer}>
          <MaterialCommunityIcons name="food-apple-outline" size={36} color={colors.text.muted} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  fallbackContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
});
