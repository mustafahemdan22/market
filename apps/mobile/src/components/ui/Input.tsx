import { useState } from "react";
import {
  TextInput,
  View,
  StyleSheet,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { useI18n } from "../../i18n/I18nProvider";
import { Text } from "./Text";
import { radii, spacing, touchTargets } from "../../theme/tokens";

export interface InputProps extends Omit<TextInputProps, "style"> {
  readonly label?: string | undefined;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
  readonly leftIcon?: React.ReactNode | undefined;
  readonly rightIcon?: React.ReactNode | undefined;
  readonly containerStyle?: StyleProp<ViewStyle> | undefined;
  readonly disabled?: boolean | undefined;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  containerStyle,
  disabled = false,
  onFocus,
  onBlur,
  placeholderTextColor,
  ...rest
}: InputProps) {
  const { colors } = useTheme();
  const { isRTL } = useI18n();
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = error
    ? colors.danger[600]
    : isFocused
    ? colors.border.focus
    : colors.border.subtle;

  const borderWidth = isFocused || error ? 2 : 1;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text variant="label" tone={error ? "danger" : "primary"}>
            {label}
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          {
            borderColor,
            borderWidth,
            backgroundColor: disabled ? colors.surface.subtle : colors.surface.card,
            flexDirection: isRTL ? "row-reverse" : "row",
          },
        ]}
      >
        {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}

        <TextInput
          editable={!disabled}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          placeholderTextColor={placeholderTextColor ?? colors.text.muted}
          style={[
            styles.textInput,
            {
              color: colors.text.primary,
              textAlign: isRTL ? "right" : "left",
            },
          ]}
          {...rest}
        />

        {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
      </View>

      {error ? (
        <View style={styles.messageRow}>
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        </View>
      ) : hint ? (
        <View style={styles.messageRow}>
          <Text variant="caption" tone="muted">
            {hint}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    marginBottom: spacing[3],
  },
  labelRow: {
    marginBottom: spacing[1.5 as keyof typeof spacing] ?? 6,
  },
  inputContainer: {
    minHeight: touchTargets.min,
    borderRadius: radii.md,
    alignItems: "center",
    paddingHorizontal: spacing[3],
  },
  textInput: {
    flex: 1,
    height: touchTargets.min,
    fontSize: 15,
  },
  icon: {
    marginHorizontal: spacing[1],
    justifyContent: "center",
    alignItems: "center",
  },
  messageRow: {
    marginTop: spacing[1],
  },
});
