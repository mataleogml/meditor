import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";
import { globalIgnores } from "eslint/config";

// Framework-agnostic flat config: ESLint + typescript-eslint recommended,
// plus the two plugins the source's inline `eslint-disable` directives target
// (react-hooks, and Next's `no-img-element` — the editor renders
// content-authored `<img>` on purpose). Only the referenced rules are wired;
// no full Next app ruleset.
export default tseslint.config(
  globalIgnores(["dist/**", "coverage/**", "node_modules/**"]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Build scripts run under bare node.
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: { process: "readonly", console: "readonly" } },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks, "@next/next": nextPlugin },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "error",
    },
  }
);
