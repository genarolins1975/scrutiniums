import { readFileSync } from "node:fs";

/** Golds lidas por src/lib/perguntas/portas.ts em tempo de requisição. */
const GOLDS_DAS_PORTAS = [
  "./public/obs/data/gold/pulse.json",
  "./public/gas/gold/gas-de-cozinha.json",
  "./public/agro/gold/snapshot.json",
  "./public/saneamento/gold/agregados.json",
  "./public/eficiencia/judiciario/snapshot.json",
  "./public/eficiencia/gold/educacao_capitais.json",
  "./public/eficiencia/gold/saude_capitais.json",
  "./public/eficiencia/saneamento/snapshot.json",
  "./public/energia/gold/agua_detalhe.json",
  "./public/energia/gold/conta.json",
  "./public/inflacao/gold/ipca.json",
  "./public/previdencia/gold/previdencia.json",
];

/**
 * Arquivos que o "Citar" e o disparo dos alertas leem em tempo de requisição (src/lib/conta/metadados.ts): as datas de
 * cada fonte em src/lib/frescor/limiares.json e os manifestos com id de publicação. O teste conta-ferramentas confere
 * esta lista contra arquivosLidos().
 */
const LIMIARES_FRESCOR = JSON.parse(readFileSync(new URL("./src/lib/frescor/limiares.json", import.meta.url), "utf-8"));
const ARQUIVOS_DAS_FONTES = [
  ...new Set([
    ...Object.values(LIMIARES_FRESCOR.dominios).flatMap((d) =>
      [...d.publicacao, ...(d.partes ?? []), ...d.referencia].map((o) => `./${o.arquivo}`),
    ),
    "./public/energia/gold/manifesto.json",
  ]),
].sort();

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
      // a home é dinâmica (sessão) e lê as golds das portas a cada instância (src/lib/perguntas/portas.ts);
      // as páginas abertas são estáticas e as leem no build. src/tests/perguntas-portas.test.ts confere esta lista
      "/": GOLDS_DAS_PORTAS,
      "/saneamento/municipio/[id]": ["./public/saneamento/gold/**/*.json"],
      // versão aperitivo do Saneamento (servida em /saneamento/municipio a quem não tem sessão): dinâmica, lê a cada
      // instância só o que a consulta usa (tabela municipal, ficha da UF, catálogo de prestadores e proveniência)
      "/aperitivo/saneamento": [
        "./public/saneamento/gold/municipios.json",
        "./public/saneamento/gold/meta.json",
        "./public/saneamento/gold/prestadores.json",
        "./public/saneamento/gold/uf/*.json",
        // contagens e datas do capítulo 7.1 (dívida dos prestadores) para o convite do painel completo
        "./public/saneamento/divida/resumo.json",
      ],
      // painel Previdência e INSS e a sua versão aperitivo (servida em /contas-publicas/previdencia a quem não tem sessão):
      // dinâmicos (município na URL), leem a cada instância a gold e o arquivo da UF do município pedido
      "/contas-publicas/previdencia": ["./public/previdencia/gold/**/*.json"],
      "/aperitivo/previdencia": ["./public/previdencia/gold/**/*.json"],
      // painel Conectividade e a sua versão aperitivo (servida em /conectividade a quem não tem sessão): dinâmicos
      // (município na URL), leem a cada instância a gold e o arquivo da UF do município pedido
      "/conectividade": ["./public/conectividade/gold/**/*.json"],
      "/aperitivo/conectividade": ["./public/conectividade/gold/**/*.json"],
      // ficha de focos por município (consulta da leva 2, src/lib/rotasPublicas.ts): gerada na primeira visita
      "/territorio/queimadas/municipio/[ibge]": ["./public/territorio/gold/queimadas_municipios.json", "./public/saneamento/gold/indice.json"],
      "/saneamento/prestadores/[id]": ["./public/saneamento/gold/*.json"],
      // consultas de juros do Crédito: dinâmicas (recorte na URL), leem a gold de juros a cada instância
      "/observatorio-do-credito/quanto-meu-banco-cobra": ["./public/obs/data/gold/juros.json"],
      "/observatorio-do-credito/simulador-da-parcela": ["./public/obs/data/gold/juros.json"],
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
      "/api/conta/citacao": ARQUIVOS_DAS_FONTES,
      "/api/conta/alertas": ARQUIVOS_DAS_FONTES,
      "/api/alertas/enviar": ARQUIVOS_DAS_FONTES,
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
      // logos oficiais: SVG aberto direto no navegador não roda script nem carrega nada de fora
      {source: "/energia/logos/:path*", headers: [{key: "Content-Security-Policy", value: "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox"}, {key: "X-Content-Type-Options", value: "nosniff"}]},
      {source: "/saneamento/logos/:path*", headers: [{key: "Content-Security-Policy", value: "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox"}, {key: "X-Content-Type-Options", value: "nosniff"}]},
      // marcas de parceiros (pasta aberta): mesma política dos logos
      {source: "/home/parceiros/:path*", headers: [{key: "Content-Security-Policy", value: "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox"}, {key: "X-Content-Type-Options", value: "nosniff"}]},
      {source: "/energia/gold/:path*", headers: [{key: "Cache-Control", value: "private, max-age=3600"}]},
      {source: "/energia/series/:path*", headers: [{key: "Cache-Control", value: "private, max-age=3600"}]},
      {source: "/eficiencia/:dir(gold|series)/:path*", headers: [{key: "Cache-Control", value: "private, max-age=3600"}]},
      {source: "/eficiencia/judiciario/:path*", headers: [{key: "Cache-Control", value: "private, max-age=3600"}]},
      {source: "/agro/gold/:path*", headers: [{key: "Cache-Control", value: "private, max-age=3600"}]},
      {source: "/saneamento/gold/:path*", headers: [{key: "Cache-Control", value: "private, max-age=3600"}]},
      {source: "/previdencia/gold/:path*", headers: [{key: "Cache-Control", value: "private, max-age=3600"}]},
      {source: "/conectividade/gold/:path*", headers: [{key: "Cache-Control", value: "private, max-age=3600"}]},
      {source: "/saneamento/divida/:path*", headers: [{key: "Cache-Control", value: "private, max-age=3600"}]},
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
      // a entrada do Território e Clima fica junto dos painéis que ele mantém (src/app/territorio)
      {source: "/observatorios/territorio-e-clima", destination: "/territorio", permanent: false},
    ];
  },
};
export default nextConfig;
