import { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { colors, darkColors, tokens, type ThemeColors } from "./tokens";

export type ColorMode = "light" | "dark" | "system";

interface ThemeContextValue {
  readonly isDark: boolean;
  readonly colorMode: ColorMode;
  readonly setColorMode: (mode: ColorMode) => void;
  readonly colors: ThemeColors;
  readonly tokens: typeof tokens;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  readonly children: ReactNode;
  readonly initialMode?: ColorMode;
}

export function ThemeProvider({
  children,
  initialMode = "light", // Primary per DESIGN_SYSTEM.md §2.1
}: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [colorMode, setColorMode] = useState<ColorMode>(initialMode);

  const isDark = useMemo(() => {
    if (colorMode === "system") {
      return systemScheme === "dark";
    }
    return colorMode === "dark";
  }, [colorMode, systemScheme]);

  const activeColors = useMemo(() => {
    return isDark ? darkColors : colors;
  }, [isDark]);

  const value = useMemo<ThemeContextValue>(() => {
    return {
      isDark,
      colorMode,
      setColorMode,
      colors: activeColors,
      tokens,
    };
  }, [isDark, colorMode, activeColors]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
