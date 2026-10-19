import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { signSessionCookie } from "@/lib/sessionCookie";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { OBSERVATORIOS } from "@/lib/observatorios/lista";
import { ACESSO, N_OBSERVATORIOS, listaObservatorios, observatoriosPorExtenso } from "@/lib/acesso";

/**
 * Uma só promessa sobre cadastro e escopo. Até 13/10/2026 a home e o rodapé diziam
 * "leitura aberta, conta opcional" e /resumo, /dados, /dados/[slug] e o formulário
 * de perfil diziam "o cadastro é a única exigência"; o layout dizia "Três
 * observatórios" com cinco no registro. O middleware só protege /app.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");

function arquivos(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const nome of readdirSync(join(raiz, dir))) {
    const p = join(raiz, dir, nome);
    if (statSync(p).isDirectory()) out.push(...arquivos(relative(raiz, p), ext));
    else if (ext.test(nome)) out.push(relative(raiz, p));
  }
  return out;
}

// texto que chega ao leitor: código da interface e da SPA, sem os testes e sem linhas de comentário
const FONTES = [
  ...arquivos("src", /\.(tsx?|mjs)$/).filter((p) => !p.startsWith("src/tests/")),
  "public/obs/index.html",
  "public/obs/app.js",
];
const linhasVisiveis = (p: string) =>
  ler(p)
    .split("\n")
    .map((l, i) => ({ l, n: i + 1 }))
    .filter(({ l }) => !/^\s*(\/\/|\/?\*)/.test(l));

// Desde 13/10/2026 os painéis exigem conta: nenhum texto visível volta a prometer leitura sem cadastro.
const FRASES_ANTIGAS = [
  /leitura (é )?aberta/i,
  /abert[oa]s? para leitura/i,
  /aberto,? sem cadastro/i,
  /abertos,? sem cadastro/i,
  /sem cadastro e sem (cobrança|chave)/i,
  /acesso gratuito sem cadastro/i,
  /a conta é opcional/i,
  /guarda preferências e a área de painéis/i,
];

const EXTENSO: Record<string, number> = { um: 1, dois: 2, duas: 2, "três": 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9 };

describe("acesso: uma promessa", () => {
  it("o middleware só libera a lista pública; painéis exigem sessão", () => {
    const m = ler("src/middleware.ts");
    expect(m).toContain("if (ehRotaPublica(pathname)) return NextResponse.next();");
    expect(m).toContain('matcher: ["/((?!_next/static|_next/image).*)"]');
  });

  it("nenhuma página volta a prometer leitura sem cadastro", () => {
    const achados: string[] = [];
    for (const p of FONTES)
      for (const { l, n } of linhasVisiveis(p))
        for (const re of FRASES_ANTIGAS) if (re.test(l)) achados.push(`${p}:${n}: ${l.trim().slice(0, 120)}`);
    expect(achados).toEqual([]);
  });

  it("as páginas que falam de acesso leem a fonte única", () => {
    for (const p of [
      "src/app/layout.tsx",
      "src/app/page.tsx",
      "src/components/layout/Footer.tsx",
      "src/components/home/SecaoAcesso.tsx",
      "src/components/onboarding/PerfilForm.tsx",
      "src/components/dados/ChamadaObservatorio.tsx",
      "src/app/observatorio-do-credito/page.tsx",
    ])
      expect(ler(p), p).toMatch(/from "@\/lib\/acesso"/);
    for (const p of ["src/app/resumo/page.tsx", "src/app/dados/page.tsx", "src/app/dados/[slug]/page.tsx"])
      expect(ler(p), p).toContain("<ChamadaObservatorio");
  });

  it("a conta só promete o que existe no código", () => {
    // boletim mensal: consentimento gerenciável na conta e envio pela rota do boletim
    expect(ACESSO.conta).toMatch(/boletim mensal/);
    expect(ler("src/app/app/(foco)/conta/page.tsx")).toMatch(/title="Boletim mensal"/);
    expect(ler("src/lib/boletim.ts")).toContain("marketingOptIn");
    expect(ACESSO.conta).toMatch(/painéis/);
    expect(ACESSO.leitura).toMatch(/quem tem conta/);
    expect(ACESSO.leitura).toMatch(/gratuito/);
  });
});

/**
 * Leva 1 da estratégia "aberto e com conta" (decisão do dono de 19/10/2026): o middleware serve sem sessão as
 * cinco consultas pessoais e os arquivos que elas buscam no navegador; as vizinhas, os downloads e as exportações
 * continuam indo ao login com o destino guardado. Com sessão, tudo abre.
 */
describe("acesso: consultas abertas da leva 1", () => {
  const ORIGEM = "https://scrutiniums.com";
  const requisicao = (caminho: string, cookie?: string) =>
    new NextRequest(ORIGEM + caminho, { headers: new Headers({ accept: "text/html", ...(cookie ? { cookie: `scrutiniums_session=${cookie}` } : {}) }) });
  beforeEach(() => vi.stubEnv("COOKIE_SECRET", "segredo-sintetico-do-teste-acesso-leva-1"));
  afterEach(() => vi.unstubAllEnvs());

  const ABERTAS = [
    "/setor-eletrico/conta-de-luz", "/en/setor-eletrico/conta-de-luz", "/saneamento/municipio", "/saneamento/municipio/2611606",
    "/saneamento/preco-regulado/simulador", "/eficiencia-estatal", "/gas-natural/gas-de-cozinha",
    "/setor-eletrico/conta-de-luz/municipios.json", "/saneamento/gold/indice.json", "/energia/geo/uf.json",
  ];
  const FECHADAS = [
    "/setor-eletrico/conta-de-luz/reajustes-e-subsidios", "/en/setor-eletrico/conta-de-luz/reajustes-e-subsidios",
    "/energia/series/conta_historico_b1.json", "/energia/series/conta_tarifas_b1_vigentes.csv",
    "/saneamento/gold/municipios.csv", "/saneamento/acesso", "/saneamento/comparar", "/saneamento/preco-regulado/formacao",
    "/eficiencia-estatal/saude-capitais", "/eficiencia-estatal/indice-de-resultados", "/eficiencia-estatal/retrato-26-capitais.csv",
    "/gas-natural", "/gas-natural/dados", "/gas/series/preco-glp-por-uf.csv", "/energia/geo/municipios.json",
  ];

  it("sem sessão, serve as consultas e manda as vizinhas ao login com o destino", async () => {
    for (const caminho of ABERTAS) {
      const r = await middleware(requisicao(caminho));
      expect(r.headers.get("x-middleware-next"), caminho).toBe("1");
      expect(r.headers.get("location"), caminho).toBeNull();
    }
    for (const caminho of FECHADAS) {
      const r = await middleware(requisicao(caminho));
      expect(r.status, caminho).toBe(307);
      const destino = new URL(r.headers.get("location") ?? "", ORIGEM);
      expect(destino.pathname, caminho).toMatch(/^(\/en)?\/entrar$/);
      expect(destino.searchParams.get("de"), caminho).toBe(caminho);
    }
  });

  it("com sessão, as vizinhas abrem como antes", async () => {
    const cookie = await signSessionCookie("cd".repeat(32), new Date(Date.now() + 60 * 60 * 1000));
    for (const caminho of FECHADAS.filter((c) => !c.startsWith("/en/"))) {
      const r = await middleware(requisicao(caminho, cookie));
      expect(r.headers.get("location"), caminho).toBeNull();
    }
  });

  it("a lista aberta declara as consultas pelo caminho exato, nunca por prefixo", () => {
    const fonte = ler("src/lib/rotasPublicas.ts");
    const prefixos = fonte.slice(fonte.indexOf("const PREFIXOS"), fonte.indexOf("];", fonte.indexOf("const PREFIXOS")));
    const entradas = [...prefixos.matchAll(/"(\/[^"]*)"/g)].map((m) => m[1]);
    expect(entradas.length).toBeGreaterThan(5);
    // nenhuma consulta, nenhum arquivo e nenhuma vizinha é aberta por prefixo
    for (const c of [...ABERTAS, ...FECHADAS]) {
      for (const p of entradas) expect(c === p || c.startsWith(p + "/"), `${c} sob o prefixo ${p}`).toBe(false);
    }
    expect(fonte).toMatch(/const CONSULTAS_ABERTAS = new Set\(\[/);
  });
});

describe("escopo: a contagem vem do registro", () => {
  it("a fonte única conta o registro", () => {
    // seis observatórios (src/lib/observatorios/lista.ts); os oito domínios são coleções dentro deles
    expect(N_OBSERVATORIOS).toBe(OBSERVATORIOS.length);
    for (const o of OBSERVATORIOS) expect(listaObservatorios()).toContain(o.nomeCurto);
    expect(EXTENSO[observatoriosPorExtenso().split(" ")[0]]).toBe(OBSERVATORIOS.length);
  });

  it("nenhum texto visível traz contagem de observatórios divergente do registro", () => {
    const re = /\b(um|dois|duas|três|tres|quatro|cinco|seis|sete|oito|nove)\s+observatórios\b/gi;
    const achados: string[] = [];
    for (const p of FONTES)
      for (const { l, n } of linhasVisiveis(p))
        for (const m of l.matchAll(re))
          if (EXTENSO[m[1].toLowerCase()] !== OBSERVATORIOS.length) achados.push(`${p}:${n}: ${m[0]}`);
    expect(achados).toEqual([]);
  });

  it("metadados do layout e da home usam a lista do registro", () => {
    expect(ler("src/app/layout.tsx")).toMatch(/observatoriosPorExtenso\(true\)/);
    expect(ler("src/app/layout.tsx")).not.toMatch(/Três observatórios/);
    expect(ler("src/app/page.tsx")).toContain("listaObservatorios()");
  });
});
