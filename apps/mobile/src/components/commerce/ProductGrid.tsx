import {
  View,
  StyleSheet,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { getGridColumns, spacing, radii } from "../../theme/tokens";
import type { Product } from "../../data/catalogRepository";
import { ProductCard } from "./ProductCard";
import { Skeleton } from "../ui/Skeleton";

export interface ProductGridProps {
  readonly products: readonly Product[];
  readonly onProductPress: (product: Product) => void;
  readonly loading?: boolean;
  readonly skeletonCount?: number;
  readonly style?: StyleProp<ViewStyle>;
}

export function ProductGrid({
  products,
  onProductPress,
  loading = false,
  skeletonCount = 4,
  style,
}: ProductGridProps) {
  const { width } = useWindowDimensions();
  const columns = getGridColumns(width);
  const gutter = spacing[3];

  // Calculate width per column
  // (container width - horizontal screen padding (32) - (columns - 1) * gutter) / columns
  const screenPadding = spacing[4] * 2;
  const totalGutterWidth = (columns - 1) * gutter;
  const columnWidth = (width - screenPadding - totalGutterWidth) / columns;

  if (loading) {
    return (
      <View style={[styles.grid, style]}>
        {Array.from({ length: skeletonCount }).map((_, idx) => (
          <View
            key={`skel-${idx}`}
            style={[
              styles.itemWrapper,
              { width: columnWidth, marginBottom: gutter },
            ]}
          >
            <Skeleton height={columnWidth} borderRadius={radii.md} />
            <Skeleton height={14} width="60%" style={styles.skeletonSpacing} />
            <Skeleton height={18} width="90%" style={styles.skeletonSpacing} />
            <Skeleton height={22} width="40%" style={styles.skeletonSpacing} />
            <Skeleton height={38} width="100%" borderRadius={radii.md} style={styles.skeletonSpacing} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.grid, style]}>
      {products.map((product) => (
        <View
          key={product.id}
          style={[styles.itemWrapper, { width: columnWidth }]}
        >
          <ProductCard
            product={product}
            onPress={() => onProductPress(product)}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    width: "100%",
  },
  itemWrapper: {
    marginBottom: spacing[1],
  },
  skeletonSpacing: {
    marginTop: spacing[2],
  },
});
