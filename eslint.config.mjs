import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "data/**",
    "supabase/.temp/**",
    "supabase/.branches/**",
    "design_handoff_metaspike/**",
    "design_handoff_metaspike_new_tab/**",
  ]),
  ...next,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
  },
]);
