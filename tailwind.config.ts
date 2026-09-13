// SPDX-License-Identifier: GPL-3.0-only
import type { Config } from "tailwindcss";

export default {
  darkMode: "media",
  content: ["src/popup/**/*.{ts,tsx,html}", "src/options/**/*.{ts,tsx,html}"],
  theme: {
    extend: {}
  },
  plugins: []
} satisfies Config;
