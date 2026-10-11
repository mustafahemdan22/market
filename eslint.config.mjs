import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Flat config (required — `next lint` was removed in Next.js 16 and ESLint 10
 * drops legacy .eslintrc support).
 *
 * Phase B scope: packages/shared + apps/mobile.
 * Apps/admin and packages/convex configs are added when those packages land.
 *
 * NOTE: `_generated/` is deliberately NOT ignored. Excluding it also removes it
 * from the type-aware program, so every consumer of `_generated/server`
 * degrades to "error typed" and type-aware rules report false positives. The
 * stub files carry their own `/* eslint-disable *\/` header instead.
 */
export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/next-env.d.ts",
      "**/.expo/**",
      "**/coverage/**",
      "docs/**",
      "*.mjs",
      "**/*.mjs",
      "**/*.config.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: { "no-console": "off" },
  },
);
