import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Banco PGlite em memória exclusivo deste processo de teste (pool "forks").
process.env.DATABASE_URL = "pglite-memory:";

/**
 * Frente 3: o resumo como canal. O que se trava:
 * - assinatura sem conta com dupla confirmação, troca de periodicidade só pelo
 *   link, descadastro em um clique que apaga o registro, respostas genéricas;
 * - envio idempotente: diária só com edição nova, semanal às segundas;
 * - e-mail com fonte, frescor e cabeçalhos List-Unsubscribe (RFC 8058);
 * - RSS do resumo e link visível para o alerts.xml do pipeline;
 * - página estável do IBCC com nota por regras;
 * - três trilhas de cinco páginas no Mapa do Observatório.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");

let A: typeof import("@/lib/assinaturaResumo");
let db: Awaited<ReturnType<typeof import("@/lib/db").getDb>>;
let schema: typeof import("@/lib/db").schema;

beforeAll(async () => {
  A = await import("@/lib/assinaturaResumo");
  const m = await import("@/lib/db");
  db = await m.getDb();
  schema = m.schema;
}, 60_000);

const linha = async (email: string) =>
  (await db.select().from(schema.assinaturasResumo)).find((r) => r.email === email.toLowerCase());

describe("assinatura do resumo: ciclo", () => {
  it("pedido cria PENDENTE; só o link confirma; o token adulterado ou vencido não confirma", async () => {
    const agora = new Date("2026-10-13T12:00:00Z");
    const { id, token } = await A.pedirAssinatura("Leitora@Exemplo.com", "diaria", agora);
    expect((await linha("leitora@exemplo.com"))?.status).toBe("PENDENTE");
    expect(await A.confirmarAssinatura(token.slice(0, -2) + "00", agora)).toBe(false);
    expect(await A.confirmarAssinatura(token, new Date(agora.getTime() + 8 * 86_400_000))).toBe(false);
    expect(await A.confirmarAssinatura(token, agora)).toBe(true);
    const r = await linha("leitora@exemplo.com");
    expect(r).toMatchObject({ id, status: "ATIVA", periodicidade: "diaria" });
  });

  it("novo pedido sobre assinatura ativa não muda nada até o clique no link", async () => {
    const agora = new Date("2026-10-13T12:00:00Z");
    const { token } = await A.pedirAssinatura("leitora@exemplo.com", "semanal", agora);
    expect((await linha("leitora@exemplo.com"))?.periodicidade).toBe("diaria");
    expect(await A.confirmarAssinatura(token, agora)).toBe(true);
    expect((await linha("leitora@exemplo.com"))?.periodicidade).toBe("semanal");
  });

  it("descadastro apaga o registro, é idempotente e recusa token de outro propósito", async () => {
    const agora = new Date("2026-10-13T12:00:00Z");
    const { id, token } = await A.pedirAssinatura("sai@exemplo.com", "diaria", agora);
    expect(await A.cancelarAssinatura(token)).toBe(false); // token de confirmação não serve para sair
    expect(await A.cancelarAssinatura(A.tokenSaida(id))).toBe(true);
    expect(await linha("sai@exemplo.com")).toBeUndefined();
    expect(await A.cancelarAssinatura(A.tokenSaida(id))).toBe(true);
  });

  it("pendência sem confirmação some depois da validade do link", async () => {
    const t0 = new Date("2026-10-01T12:00:00Z");
    await A.pedirAssinatura("esquecida@exemplo.com", "semanal", t0);
    await A.purgarPendentes(new Date("2026-10-07T12:00:00Z"));
    expect(await linha("esquecida@exemplo.com")).toBeDefined();
    await A.purgarPendentes(new Date("2026-10-09T12:00:00Z"));
    expect(await linha("esquecida@exemplo.com")).toBeUndefined();
  });
});

describe("assinatura do resumo: quem recebe", () => {
  const base = { status: "ATIVA", ultimaEdicao: null, ultimoEnvioEm: null } as const;
  const SEG = new Date("2026-10-12T15:00:00Z"); // segunda-feira em Brasília
  const TER = new Date("2026-10-13T15:00:00Z");

  it("diária: só edição nova", () => {
    expect(A.deveReceber({ ...base, periodicidade: "diaria" }, "E1", TER)).toBe(true);
    expect(A.deveReceber({ ...base, periodicidade: "diaria", ultimaEdicao: "E1" }, "E1", TER)).toBe(false);
    expect(A.deveReceber({ ...base, periodicidade: "diaria", ultimaEdicao: "E0" }, "E1", TER)).toBe(true);
  });

  it("semanal: às segundas, uma vez por semana", () => {
    expect(A.deveReceber({ ...base, periodicidade: "semanal" }, "E1", TER)).toBe(false);
    expect(A.deveReceber({ ...base, periodicidade: "semanal" }, "E1", SEG)).toBe(true);
    expect(A.deveReceber({ ...base, periodicidade: "semanal", ultimoEnvioEm: new Date("2026-10-12T10:00:00Z") }, "E1", SEG)).toBe(false);
    expect(A.deveReceber({ ...base, periodicidade: "semanal", ultimoEnvioEm: new Date("2026-10-05T15:00:00Z") }, "E1", SEG)).toBe(true);
  });

  it("pendente nunca recebe", () => {
    expect(A.deveReceber({ ...base, status: "PENDENTE", periodicidade: "diaria" }, "E1", TER)).toBe(false);
  });
});

describe("assinatura do resumo: conteúdo", () => {
  it("o e-mail traz diagnóstico, fontes, link do resumo, frescor e saída em um clique", () => {
    const meta = JSON.parse(ler("public/obs/data/gold/meta.json"));
    const r = A.montarResumoEmail(new Date(new Date(meta.gerado_em).getTime() + 30 * 86_400_000))!;
    expect(r.edicao).toBe(meta.gerado_em);
    expect(r.corpo).toContain("DIAGNÓSTICO");
    expect(r.corpo).toContain("BCB/SGS");
    expect(r.corpo).toContain("https://scrutiniums.com/resumo");
    expect(r.corpo).toMatch(/ATENÇÃO: esta é a última publicação disponível/);
    const fresco = A.montarResumoEmail(new Date(new Date(meta.gerado_em).getTime() + 3_600_000))!;
    expect(fresco.corpo).not.toMatch(/ATENÇÃO/);
    const rod = A.rodapeResumo({ id: "abc", periodicidade: "semanal" });
    expect(rod).toContain("/resumo/assinatura/sair?token=");
    expect(rod).toContain("em um clique");
    const h = A.cabecalhosSaida("abc");
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(h["List-Unsubscribe"]).toMatch(/^<https:\/\/scrutiniums\.com\/api\/resumo\/assinatura\/sair\?token=/);
  });

  it("rotas: resposta genérica, consentimento obrigatório, mudança só por POST", () => {
    const assinar = ler("src/app/api/resumo/assinar/route.ts");
    expect(assinar).toContain("consentimento: z.literal(true)");
    expect(assinar).toContain("RESPOSTA_GENERICA");
    expect(assinar).toContain("POLICIES.assinaturaPorIp");
    for (const p of ["src/app/api/resumo/assinatura/confirmar/route.ts", "src/app/api/resumo/assinatura/sair/route.ts"]) {
      const s = ler(p);
      expect(s).toContain("export async function POST");
      expect(s).not.toContain("export async function GET");
    }
    expect(ler("src/app/api/resumo/enviar/route.ts")).toContain("bearerDisparoValido(req)");
    expect(ler("next.config.mjs")).toContain('"/api/resumo/enviar"');
    expect(ler("src/app/privacidade/page.tsx")).toContain('id="priv-resumo"');
    const wf = ler(".github/workflows/resumo-email.yml");
    expect(wf).toContain("BOLETIM_SECRET");
    expect(wf).toContain("/api/resumo/enviar");
  });
});

describe("RSS e links de acompanhamento", () => {
  it("o feed do resumo é RSS válido com um item por publicação", async () => {
    const { montarFeedResumo } = await import("@/lib/feedResumo");
    const { resumoDiario, geradoEmPublicado } = await import("@/lib/dadosPublicos");
    const xml = montarFeedResumo(resumoDiario(), geradoEmPublicado());
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0"/);
    expect((xml.match(/<item>/g) ?? []).length).toBe(1);
    expect(xml).toContain(`scrutiniums-resumo-${geradoEmPublicado()}`);
    expect(xml).not.toMatch(/undefined|NaN/);
    expect(montarFeedResumo(null, null)).not.toContain("<item>");
  });

  it("/resumo e /dados mostram o RSS do resumo e o alerts.xml do pipeline", () => {
    expect(ler("pipeline/gold.py")).toContain('write_gold_text("alerts.xml"');
    expect(ler("src/components/resumo/Acompanhe.tsx")).toContain("URL_FEED_ALERTAS");
    expect(ler("src/lib/feedResumo.ts")).toContain('URL_FEED_ALERTAS = "/obs/data/gold/alerts.xml"');
    expect(ler("src/app/resumo/page.tsx")).toContain("<Acompanhe />");
    expect(ler("src/app/dados/page.tsx")).toContain("URL_FEED_ALERTAS");
  });
});

describe("IBCC: página estável e nota por regras", () => {
  it("rótulos iguais ao config e percentil igual ao do overview", async () => {
    const { ROTULOS_COMPONENTES, ibccPublico, percentilNaSerie } = await import("@/lib/ibcc");
    const cfg = JSON.parse(ler("config/config.json")).ibcc.components;
    for (const [k, v] of Object.entries(cfg)) expect(ROTULOS_COMPONENTES[k]).toBe((v as { label: string }).label);
    const d = ibccPublico()!;
    const ov = JSON.parse(ler("public/obs/data/gold/overview.json")).ibcc_posicao;
    expect(d.atual.valor).toBe(ov.atual);
    expect(d.percentil).toBeCloseTo(ov.percentil_historico, 0);
    expect(percentilNaSerie(d.serie, d.atual.valor)).toBeCloseTo(ov.percentil_historico, 0);
  });

  it("a nota segue as regras: nível, variação com limiar, componentes e fase", async () => {
    const { notaMensalIbcc, LIMIAR_ESTAVEL } = await import("@/lib/ibcc");
    const serie = Array.from({ length: 14 }, (_, i) => ({
      ref: `2025-${String((i % 12) + 1).padStart(2, "0")}-01`,
      valor: 100,
      contribuicoes: { preco: 0, qualidade: 0 },
    }));
    const base = { percentil: 50, fase: "expansão", serie, metodo: "", limitacoes: "", tipo: "DADO CALCULADO" };
    const atual = { ref: "2026-02-01", valor: 98, contribuicoes: { preco: -1.5, qualidade: 0.2 } };
    const anterior = { ref: "2026-01-01", valor: 98 + LIMIAR_ESTAVEL / 2, contribuicoes: { preco: -0.5, qualidade: 0.1 } };
    const ha12 = { ref: "2025-02-01", valor: 101, contribuicoes: { preco: 0, qualidade: 0 } };
    const n = notaMensalIbcc({ ...base, atual, anterior, ha12 });
    expect(n.paragrafos[0]).toMatch(/abaixo da média histórica \(100\)/);
    expect(n.paragrafos[1]).toMatch(/praticamente estável no mês/);
    expect(n.paragrafos[1]).toMatch(/caiu 3,00 pontos em 12 meses/);
    expect(n.paragrafos[2]).toMatch(/mais subiu no mês foi a de Qualidade da carteira/);
    expect(n.paragrafos[2]).toMatch(/mais caiu foi a de Preço do crédito/);
    expect(n.paragrafos[3]).toBe("Fase do ciclo publicada pelo pipeline: expansão.");
  });

  it("a página existe, é estática e é ligada a partir de /dados", () => {
    const p = ler("src/app/dados/ibcc/page.tsx");
    expect(p).toContain('export const dynamic = "force-static"');
    expect(p).toContain("REGRAS_NOTA");
    expect(p).toContain("<SeloFrescor");
    expect(ler("src/app/dados/page.tsx")).toContain('href="/dados/ibcc"');
  });
});

describe("Mapa do Observatório: três trilhas de entrada", () => {
  it("conselho e risco, imprensa e pesquisa, cinco páginas cada, só navegação", () => {
    const app = ler("public/obs/app.js");
    const bloco = app.match(/const MAPA_TRILHAS = \[([\s\S]*?)\n\];/)![1];
    const perfis = Array.from(bloco.matchAll(/perfil: "([^"]+)"/g)).map((m) => m[1]);
    expect(perfis).toEqual(["Conselho e risco", "Imprensa", "Pesquisa"]);
    const passos = Array.from(bloco.matchAll(/passos: \[([^\]]+)\]/g)).map((m) => Array.from(m[1].matchAll(/"(\w+)"/g)).map((x) => x[1]));
    for (const p of passos) {
      expect(p.length).toBe(5);
      expect(new Set(p).size).toBe(5);
    }
    expect(app).toContain('sechead("Trilhas de entrada", "três perfis, cinco páginas cada")');
  });
});

describe("percentil: o número ao lado da frase é o mesmo da frase", () => {
  it("arredonda como o pipeline (metade para o par) e bate com a frase do diagnóstico", async () => {
    const { fmtPercentil, resumoDiario } = await import("@/lib/dadosPublicos");
    expect(fmtPercentil(18.5)).toBe("18");
    expect(fmtPercentil(19.5)).toBe("20");
    expect(fmtPercentil(18.4)).toBe("18");
    expect(fmtPercentil(18.6)).toBe("19");
    const r = resumoDiario()!;
    const naFrase = r.frase.match(/percentil histórico (\d+)/)?.[1];
    if (naFrase) expect(fmtPercentil(r.ibcc.percentil)).toBe(naFrase);
  });
});
