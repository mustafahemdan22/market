import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { spacing } from "../../theme/tokens";

export interface DividerProps {
  readonly vertical?: boolean;
  readonly space?: keyof typeof spacing;
  readonly style?: StyleProp<ViewStyle>;
}

export function Divider({ vertical = false, space = 4, style }: DividerProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        vertical ? styles.vertical : styles.horizontal,
        {
          backgroundColor: colors.border.subtle,
          marginVertical: vertical ? 0 : spacing[space],
          marginHorizontal: vertical ? spacing[space] : 0,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  horizontal: {
    height: 1,
    width: "100%",
  },
  vertical: {
    width: 1,
    height: "100%",
  },
});
