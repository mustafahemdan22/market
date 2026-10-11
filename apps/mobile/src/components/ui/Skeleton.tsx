import { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  AccessibilityInfo,
} from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { radii } from "../../theme/tokens";

export interface SkeletonProps {
  readonly width?: number | string;
  readonly height?: number;
  readonly borderRadius?: number;
  readonly circle?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

export function Skeleton({
  width = "100%",
  height = 20,
  borderRadius = radii.sm,
  circle = false,
  style,
}: SkeletonProps) {
  const { colors } = useTheme();
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    let isMounted = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!isMounted || reduced) return;

      Animated.loop(
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 0.8,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });

    return () => {
      isMounted = false;
      opacityAnim.stopAnimation();
    };
  }, [opacityAnim]);

  const finalRadius = circle ? radii.full : borderRadius;
  const finalHeight = circle && typeof width === "number" ? width : height;

  return (
    <Animated.View
      accessibilityRole="none"
      accessibilityLabel="Loading content"
      style={[
        styles.skeleton,
        {
          width: width as number,
          height: finalHeight,
          borderRadius: finalRadius,
          backgroundColor: colors.surface.subtle,
          opacity: opacityAnim,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: "hidden",
  },
});
