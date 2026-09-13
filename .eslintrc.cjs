/* SPDX-License-Identifier: GPL-3.0-only */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: { jsx: true }
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  env: { browser: true, es2022: true, webextensions: true, node: true },
  ignorePatterns: ["dist", "node_modules", "*.config.*"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-eval": "error",
    "no-new-func": "error"
  }
};
