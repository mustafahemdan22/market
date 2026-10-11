import { Stack } from "expo-router";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function AuthLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface.canvas },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="sign-up" options={{ headerShown: false }} />
      <Stack.Screen name="verify" options={{ headerShown: false }} />
    </Stack>
  );
}
