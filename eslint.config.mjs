// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Disallow unused variables, except those prefixed with _
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Require explicit return types on exported functions
      "@typescript-eslint/explicit-module-boundary-types": "warn",
      // Disallow explicit `any`
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Only lint source files
    files: ["src/**/*.ts"],
    ignores: ["dist/**", "node_modules/**"],
  }
);
