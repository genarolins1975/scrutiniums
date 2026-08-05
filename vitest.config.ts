import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    // Forks: um processo por arquivo de teste, para que cada um tenha seu
    // próprio banco PGlite em memória (DATABASE_URL=pglite-memory: isolado).
    pool: "forks",
    // O primeiro boot do PGlite (WASM + migração) passa de 10s quando vários
    // forks competem por CPU; sem isto, beforeAll de testes de banco flakeia.
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
