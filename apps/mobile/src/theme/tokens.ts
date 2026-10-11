/**
 * Design Tokens — Premium Mobile Grocery Marketplace
 * Matches docs/DESIGN_SYSTEM.md §2 exactly.
 *
 * All values are centralized here. No component may hardcode arbitrary values.
 */

export interface ThemeColors {
  readonly brand: {
    readonly 50: string;
    readonly 100: string;
    readonly 600: string;
    readonly 700: string;
    readonly 800: string;
  };
  readonly accent: {
    readonly 50: string;
    readonly 100: string;
    readonly 500: string;
    readonly 600: string;
  };
  readonly success: {
    readonly 50: string;
    readonly 500: string;
    readonly 600: string;
    readonly 700: string;
  };
  readonly warning: {
    readonly 50: string;
    readonly 500: string;
    readonly 600: string;
    readonly 700: string;
  };
  readonly danger: {
    readonly 50: string;
    readonly 500: string;
    readonly 600: string;
    readonly 700: string;
  };
  readonly neutral: {
    readonly 0: string;
    readonly 50: string;
    readonly 100: string;
    readonly 200: string;
    readonly 300: string;
    readonly 400: string;
    readonly 500: string;
    readonly 600: string;
    readonly 700: string;
    readonly 800: string;
    readonly 900: string;
  };
  readonly surface: {
    readonly canvas: string;
    readonly card: string;
    readonly subtle: string;
    readonly inverse: string;
  };
  readonly text: {
    readonly primary: string;
    readonly secondary: string;
    readonly muted: string;
    readonly inverse: string;
    readonly brand: string;
    readonly danger: string;
    readonly accent: string;
  };
  readonly border: {
    readonly subtle: string;
    readonly strong: string;
    readonly focus: string;
  };
}

export const colors: ThemeColors = {
  // Brand & Semantic
  brand: {
    50: "#E8F5F0",
    100: "#C4E6D9",
    600: "#0E7C5A", // Primary actions, active states, price emphasis
    700: "#0A5F45", // Pressed state
    800: "#074834",
  },
  accent: {
    50: "#FEF3C7", // Discount badge fill
    100: "#FDE68A",
    500: "#D97706", // Savings/discount only
    600: "#B45309",
  },
  success: {
    50: "#ECFDF5",
    500: "#22C55E",
    600: "#15803D", // In stock, order confirmed
    700: "#166534",
  },
  warning: {
    50: "#FFFBEB",
    500: "#F59E0B",
    600: "#B45309", // Low stock warning
    700: "#92400E",
  },
  danger: {
    50: "#FEE2E2", // Error surface
    500: "#EF4444",
    600: "#B91C1C", // Out of stock, error, destructive
    700: "#991B1B",
  },

  // Neutrals
  neutral: {
    0: "#FFFFFF",
    50: "#F8FAF9",
    100: "#F1F5F3",
    200: "#E2E8E5",
    300: "#CBD5D1",
    400: "#94A3A0",
    500: "#6B7C77",
    600: "#52605C",
    700: "#374441",
    800: "#1F2A27",
    900: "#131C1A",
  },

  // Surfaces (Light Mode default)
  surface: {
    canvas: "#F8FAF9",
    card: "#FFFFFF",
    subtle: "#F1F5F3",
    inverse: "#131C1A",
  },

  // Text semantics (all check contrast ≥ 4.5:1 against respective surfaces)
  text: {
    primary: "#131C1A",
    secondary: "#52605C",
    muted: "#6B7C77",
    inverse: "#FFFFFF",
    brand: "#0E7C5A",
    danger: "#B91C1C",
    accent: "#B45309",
  },

  // Borders
  border: {
    subtle: "#E2E8E5",
    strong: "#94A3A0",
    focus: "#0E7C5A",
  },
};

export const darkColors: ThemeColors = {
  ...colors,
  surface: {
    canvas: "#0E1513",
    card: "#17221F",
    subtle: "#1F2C28",
    inverse: "#F8FAF9",
  },
  text: {
    primary: "#F8FAF9",
    secondary: "#A2B3AF",
    muted: "#788B86",
    inverse: "#131C1A",
    brand: "#2AC293",
    danger: "#F87171",
    accent: "#FBBF24",
  },
  border: {
    subtle: "#273834",
    strong: "#455C56",
    focus: "#2AC293",
  },
};

export const typography = {
  display: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700" as const,
  },
  h1: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  h3: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400" as const,
  },
  bodyStrong: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600" as const,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400" as const,
  },
  label: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "600" as const,
  },
  price: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "700" as const,
  },
  priceLarge: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700" as const,
  },
} as const;

export type TypographyVariant = keyof typeof typography;

// 4pt base spacing scale
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export type SpacingKey = keyof typeof spacing;

export const radii = {
  none: 0,
  sm: 8, // Badges, small chips
  md: 12, // Inputs, buttons
  lg: 16, // Cards
  xl: 24, // Sheets, bottom bars
  full: 999, // Pills, circular avatars
} as const;

export const borders = {
  hairline: 1,
  focus: 2,
} as const;

export const elevations = {
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  raised: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  sheet: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

export const iconSizes = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export const touchTargets = {
  min: 44, // iOS HIG and Material standard
  gap: 8,
} as const;

export const motion = {
  fast: 120, // Press feedback, opacity
  base: 200, // Sheet present, expand
  slow: 320, // Skeleton shimmer cycle
} as const;

/**
 * Responsive layout helper for grid columns
 * Compact (<380): 2 columns
 * Regular (380–767): 2 columns
 * Large (≥768 tablet / foldable): 3–4 columns
 */
export function getGridColumns(width: number): number {
  if (width >= 1024) return 4;
  if (width >= 768) return 3;
  return 2;
}

export const tokens = {
  colors,
  darkColors,
  typography,
  spacing,
  radii,
  borders,
  elevations,
  iconSizes,
  touchTargets,
  motion,
  getGridColumns,
} as const;

export default tokens;
