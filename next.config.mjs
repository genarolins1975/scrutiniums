/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Drivers de banco fora do bundle do servidor: o PGlite carrega assets
    // (WASM) em tempo de execução e o pg usa require dinâmico.
    serverComponentsExternalPackages: ["@electric-sql/pglite", "pg"],
    // O route handler do Observatório lê estes arquivos em runtime para
    // injetar metadados por rota; o tracing precisa incluí-los no bundle
    // da função (em serverless o public/ não está no filesystem por padrão).
    outputFileTracingIncludes: {
      "/observatorio/[[...rota]]": [
        "./public/obs/index.html",
        "./public/obs/data/gold/inst_index.json",
        "./public/obs/data/gold/meta.json",
      ],
    },
  },
  // As rotas sob /observatorio são servidas pelo route handler
  // src/app/observatorio/[[...rota]]/route.ts, que entrega a SPA de
  // public/obs com <head> específico por aba (title/OG/canonical/JSON-LD).
};

export default nextConfig;
