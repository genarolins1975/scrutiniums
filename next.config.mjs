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
      "/api/boletim/enviar": [
        "./public/obs/data/gold/alertas_central.json",
        "./public/obs/data/gold/meta.json",
      ],
    },
  },
  // As rotas sob /observatorio são servidas pelo route handler
  // src/app/observatorio/[[...rota]]/route.ts, que entrega a SPA de
  // public/obs com <head> específico por aba (title/OG/canonical/JSON-LD).
  async redirects() {
    // Painéis sintéticos aposentados: as séries eram geradas por função
    // (dados de exemplo) e foram substituídas pelos painéis reais do
    // Observatório. As rotas antigas apontam para o equivalente real.
    return [
      { source: "/app", destination: "/observatorio", permanent: false },
      { source: "/app/atividade", destination: "/observatorio/credit", permanent: true },
      { source: "/app/risco", destination: "/observatorio/sectors", permanent: true },
      { source: "/app/regulatorio", destination: "/observatorio/alerts", permanent: true },
      // Metodologia e fontes têm UMA versão, a viva do Observatório (gerada do
      // gold): as páginas institucionais genéricas descreviam outra plataforma
      // e competiam com a verdadeira na busca (2.3 da avaliação de 05/09).
      { source: "/metodologia", destination: "/observatorio/methodology", permanent: true },
      { source: "/fontes", destination: "/observatorio/methodology", permanent: true },
    ];
  },
};

export default nextConfig;
