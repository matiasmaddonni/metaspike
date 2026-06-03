import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "node_modules/**",
    "data/**",
    "supabase/.temp/**",
    "supabase/.branches/**",
    "design_handoff_metaspike/**",
    "design_handoff_metaspike_new_tab/**",
  ]),
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
