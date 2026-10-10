/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Drivers de banco fora do bundle do servidor: o PGlite carrega assets
    // (WASM) em tempo de execução e o pg usa require dinâmico.
    serverComponentsExternalPackages: ["@electric-sql/pglite", "pg"],
    // Arquivos usados pelos route handlers em runtime devem integrar o bundle.
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
      "/eficiencia-estatal/mobilidade-transporte/[[...painel]]": [
        "./data/eficiencia_mobilidade/gold.json",
        "./data/eficiencia_mobilidade/gold.sha256",
      ],
      "/api/eficiencia-mobilidade/exportar": [
        "./data/eficiencia_mobilidade/gold.json",
        "./data/eficiencia_mobilidade/gold.sha256",
      ],
    },
  },
  // Cache dos estáticos do Observatório. Bundle e CSS levam versão na URL.
  async headers() {
    return [
      {source: "/energia/gold/:path*", headers: [{key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400"}]},
      {source: "/energia/series/:path*", headers: [{key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400"}]},
      {source: "/eficiencia/:dir(gold|series)/:path*", headers: [{key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400"}]},
      {source: "/obs/data/gold/:path*", headers: [{key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400"}]},
      {source: "/obs/:arquivo(app.min.js|app-municipal.min.js|app-emergentes.min.js|styles.css)", headers: [{key: "Cache-Control", value: "public, max-age=31536000, immutable"}]},
    ];
  },
  // Rotas legadas e atalhos; destinos e condições preservados.
  async redirects() {
    return [
      {source: "/app", missing: [{type: "cookie", key: "scrutiniums_session"}], destination: "/observatorio", permanent: false},
      {source: "/app", destination: "/app/observatorios", permanent: false},
      {source: "/credito", destination: "/observatorio", permanent: false},
      {source: "/app/atividade", destination: "/observatorio/credit", permanent: true},
      {source: "/app/risco", destination: "/observatorio/sectors", permanent: true},
      {source: "/app/regulatorio", destination: "/observatorio/alerts", permanent: true},
      {source: "/metodologia", destination: "/observatorio/methodology", permanent: true},
      {source: "/fontes", destination: "/observatorio/methodology", permanent: true},
    ];
  },
};
export default nextConfig;
