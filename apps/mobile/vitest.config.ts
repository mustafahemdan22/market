import { defineConfig } from "vitest/config";

/**
 * Mobile unit tests.
 *
 * Scope is deliberately narrow: pure domain logic (the Convex -> Product
 * adapter, money handling, availability derivation). React Native component
 * rendering is NOT covered here — `@testing-library/react-native` peers on
 * Jest and is still beta (see ARCHITECTURE.md §8.2), so a second runner would
 * have to be introduced before any component test could be trusted.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
});
