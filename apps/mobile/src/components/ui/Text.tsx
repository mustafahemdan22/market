import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { useI18n } from "../../i18n/I18nProvider";
import { typography, type TypographyVariant } from "../../theme/tokens";

export type TextTone =
  | "primary"
  | "secondary"
  | "muted"
  | "inverse"
  | "brand"
  | "danger"
  | "accent";

export interface TextProps extends RNTextProps {
  readonly variant?: TypographyVariant;
  readonly tone?: TextTone;
  readonly align?: "auto" | "left" | "right" | "center" | "justify";
  readonly children: React.ReactNode;
}

export function Text({
  variant = "body",
  tone = "primary",
  align,
  style,
  children,
  ...rest
}: TextProps) {
  const { colors } = useTheme();
  const { isRTL } = useI18n();

  const variantStyle = typography[variant];

  const toneColor =
    tone === "primary"
      ? colors.text.primary
      : tone === "secondary"
      ? colors.text.secondary
      : tone === "muted"
      ? colors.text.muted
      : tone === "inverse"
      ? colors.text.inverse
      : tone === "brand"
      ? colors.text.brand
      : tone === "danger"
      ? colors.text.danger
      : colors.text.accent;

  // Extra line height adjustment for Arabic script
  const adjustedLineHeight = isRTL
    ? variantStyle.lineHeight + (variantStyle.fontSize >= 19 ? 2 : 1)
    : variantStyle.lineHeight;

  const computedStyle: TextStyle = {
    fontSize: variantStyle.fontSize,
    lineHeight: adjustedLineHeight,
    fontWeight: variantStyle.fontWeight,
    color: toneColor,
    textAlign: align ?? (isRTL ? "right" : "left"),
  };

  return (
    <RNText style={[computedStyle, style]} {...rest}>
      {children}
    </RNText>
  );
}
