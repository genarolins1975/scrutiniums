/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Drivers de banco fora do bundle do servidor: o PGlite carrega assets
    // (WASM) em tempo de execução e o pg usa require dinâmico.
    serverComponentsExternalPackages: ["@electric-sql/pglite", "pg"],
    // Arquivos usados pelos route handlers em runtime devem integrar o bundle.
    outputFileTracingIncludes: {
      "/eficiencia-estatal/laboratorio-cesta": [
        "./docs/obee/resultados/revisao-interativa-v3.html",
      ],
      "/observatorio/[[...rota]]": [
        "./public/obs/index.html",
        "./public/obs/data/gold/inst_index.json",
        "./public/obs/data/gold/meta.json",
      ],
      "/api/boletim/enviar": [
        "./public/obs/data/gold/alertas_central.json",
        "./public/obs/data/gold/meta.json",
      ],
      "/api/resumo/enviar": [
        "./public/obs/data/gold/overview.json",
        "./public/obs/data/gold/pulse.json",
        "./public/obs/data/gold/meta.json",
      ],
      "/eficiencia-estatal/mobilidade-transporte/[[...painel]]": [
        "./data/eficiencia_mobilidade/aop/resumo.json",
        "./data/eficiencia_mobilidade/aop/resumo.sha256",
        "./data/eficiencia_mobilidade/gold.json",
        "./data/eficiencia_mobilidade/gold.sha256",
      ],
      "/api/eficiencia-mobilidade/oportunidades": [
        "./data/eficiencia_mobilidade/aop/resumo.json",
        "./data/eficiencia_mobilidade/aop/resumo.sha256",
        "./data/eficiencia_mobilidade/aop/seed.json.gz.b64",
      ],
      "/api/eficiencia-mobilidade/exportar": [
        "./data/eficiencia_mobilidade/gold.json",
        "./data/eficiencia_mobilidade/gold.sha256",
      ],
    },
  },
  // Cache dos estáticos do Observatório. Dados atrás de sessão usam cache privado
  // (nunca compartilhado por CDN); bundle e CSS levam versão na URL.
  async headers() {
    return [
      {source: "/energia/gold/:path*", headers: [{key: "Cache-Control", value: "private, max-age=3600"}]},
      {source: "/energia/series/:path*", headers: [{key: "Cache-Control", value: "private, max-age=3600"}]},
      {source: "/eficiencia/:dir(gold|series)/:path*", headers: [{key: "Cache-Control", value: "private, max-age=3600"}]},
      {source: "/gas/:dir(gold|series)/:path*", headers: [{key: "Cache-Control", value: "private, max-age=3600"}]},
      // API de leitura (/dados/api): exige sessão (src/lib/rotasPublicas.ts); cache privado do navegador
      {source: "/obs/data/gold/:path*", headers: [{key: "Cache-Control", value: "private, max-age=3600"}]},
      {source: "/obs/:arquivo(app.min.js|app-municipal.min.js|app-emergentes.min.js|styles.css)", headers: [{key: "Cache-Control", value: "public, max-age=31536000, immutable"}]},
    ];
  },
  // Rotas legadas e atalhos; destinos e condições preservados.
  async redirects() {
    return [
      {source: "/app", missing: [{type: "cookie", key: "scrutiniums_session"}], destination: "/entrar", permanent: false},
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
