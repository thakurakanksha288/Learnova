import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";

// 1. Recreate standard directory paths for the Flat Config engine
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Initialize the Legacy Configuration Compatibility Layer
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // 3. Safely translate and load the Next.js Core Web Vitals preset
  ...compat.extends("eslint-config-next/core-web-vitals"),

  // 4. Inject all your custom project rules smoothly
  {
    rules: {
      "no-console": "warn",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/preserve-manual-memoization": "off",
      "react/no-unescaped-entities": "off",
    },
  },
];

export default eslintConfig;
