import {
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type StyleProp,
  type ViewStyle,
  StyleSheet,
} from "react-native";
import { touchTargets } from "../../theme/tokens";

export interface PressableProps extends RNPressableProps {
  readonly children?: React.ReactNode | undefined;
  readonly style?: StyleProp<ViewStyle> | undefined;
  readonly pressedOpacity?: number | undefined;
  readonly enforceMinTarget?: boolean | undefined;
}

export function Pressable({
  children,
  style,
  pressedOpacity = 0.7,
  enforceMinTarget = true,
  disabled,
  ...rest
}: PressableProps) {
  return (
    <RNPressable
      disabled={disabled}
      style={({ pressed }) => [
        enforceMinTarget && styles.minTarget,
        style,
        pressed && !disabled && { opacity: pressedOpacity },
      ]}
      hitSlop={enforceMinTarget ? 8 : 4}
      {...rest}
    >
      {children}
    </RNPressable>
  );
}

const styles = StyleSheet.create({
  minTarget: {
    minHeight: touchTargets.min,
    minWidth: touchTargets.min,
    justifyContent: "center",
    alignItems: "center",
  },
});
