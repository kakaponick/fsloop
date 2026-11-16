import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "fixtures/root"] },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    ...reactHooks.configs.flat["recommended-latest"],
  },
  // The shadcn library as its CLI writes it (rules/ui → Components 1): its source is never edited, so a rule its
  // own code trips is switched off here, for the library's files only.
  {
    files: ["src/components/ui/**/*.{ts,tsx}", "src/hooks/use-mobile.ts", "src/hooks/use-highlighted-code.ts", "src/lib/highlighter.tsx"],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
);
