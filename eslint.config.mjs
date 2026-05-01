import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  {
    ignores: [
      "main.js",
      "node_modules/**",
      ".test-dist/**",
      ".git/**",
      ".DS_Store"
    ]
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.eslint.json",
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {
      "obsidianmd/ui/sentence-case": "off"
    }
  },
  {
    files: ["*.mjs", "tests/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly"
      }
    },
    rules: {
      "obsidianmd/no-nodejs-modules": "off",
      "obsidianmd/prefer-active-window-timers": "off"
    }
  }
]);
