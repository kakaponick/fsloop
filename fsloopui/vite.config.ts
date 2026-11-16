import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// The client is built into dist/, which server/main.ts serves; `npm run dev` proxies the API to a running server.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    proxy: { "/api": "http://127.0.0.1:4747" },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "server/**/*.test.ts", "shared/**/*.test.ts", "fixtures/**/*.test.ts"],
    // The whole fixture roots, written once per run, never in a file's hook (fixtures/global-setup.ts).
    globalSetup: ["fixtures/global-setup.ts"],
    // Half the logical CPUs: each file is a jsdom page over a live fixture server, and one worker per logical CPU
    // starved the heaviest walks past their 5 s limit under the parallel load.
    maxWorkers: "50%",
    // `tests 10`: one test — up to 5 s; longer only with an allow-list entry a human commits (the project keeps none).
    // That budget is checked on every test by the setup file, which fails a test over 5 000 ms with its time.
    setupFiles: ["src/ui/test-budget.ts"],
    // The limit is the hang bound only (`tests 4`), twice the budget: every wait inside a test — 4 s at most
    // (src/ui/test-setup.ts) — then fails as its own assertion, with its message (src/app/waits.test.ts).
    testTimeout: 10_000,
  },
});
