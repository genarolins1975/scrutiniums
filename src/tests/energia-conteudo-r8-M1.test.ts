/* Trabalho de conteúdo depois da r7, área M1 (Mercado, Geração, Expansão e Transição): respostas em duas camadas (veredito
 * em palavras simples sempre à vista e os números por trás só em Analisar e Auditar), identificadores técnicos fora de
 * Entender e números conciliados no ponto de uso. Os vereditos são derivados dos mesmos campos das respostas completas.
 * As conciliações de número releem o dado em outro artefato publicado (CSV ou JSON), sem repetir a fórmula do código. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MercadoPage from "@/app/setor-eletrico/mercado/page";
import MercadoAgentesPage from "@/app/setor-eletrico/mercado/agentes/page";
import MercadoMreGsfPage from "@/app/setor-eletrico/mercado/mre-e-gsf/page";
import MercadoEncargosPage from "@/app/setor-eletrico/mercado/encargos/page";
import GeracaoPage from "@/app/setor-eletrico/geracao/page";
import GeracaoCapacidadePage from "@/app/setor-eletrico/geracao/capacidade/page";
import GeracaoRestricoesPage from "@/app/setor-eletrico/geracao/restricoes/page";
import GeracaoTermicaPage from "@/app/setor-eletrico/geracao/termica/page";
import ExpansaoPage from "@/app/setor-eletrico/expansao/page";
import CarteiraPage from "@/app/setor-eletrico/expansao/carteira/page";
import CenariosPage from "@/app/setor-eletrico/expansao/cenarios/page";
import CronogramaPage from "@/app/setor-eletrico/expansao/cronograma/page";
import TransmissaoPage from "@/app/setor-eletrico/expansao/geracao-e-transmissao/page";
import TransicaoPage from "@/app/setor-eletrico/transicao/page";
import EmissoesPage from "@/app/setor-eletrico/transicao/emissoes/page";
import EstimadaPage from "@/app/setor-eletrico/transicao/energia-estimada/page";
import MmgdPage from "@/app/setor-eletrico/transicao/mmgd/page";
import * as M from "@/lib/energia/mercado";
import * as GE from "@/lib/energia/geracao";
import * as EX from "@/lib/energia/expansao";
import * as TR from "@/lib/energia/transicao";
import { SIGLAS } from "@/lib/energia/siglas";
import type { MercadoGold } from "@/lib/energia/tipos-mercado";
import type { GoldGeracaoDetalhe } from "@/lib/energia/tipos-geracao";
import type { ExpansaoGold } from "@/lib/energia/tipos-expansao";
import type { GoldTransicao } from "@/lib/energia/tipos-transicao";

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const json = <T,>(p: string) => JSON.parse(ler(p)) as T;
const palavras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const numeros = (t: string) => (t.match(/\d[\d.,]*\d|\d/g) ?? []).length;
const escapa = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const MG = json<MercadoGold>("public/energia/gold/mercado.json");
const GG = json<GoldGeracaoDetalhe>("public/energia/gold/geracao_detalhe.json");
const XG = json<ExpansaoGold>("public/energia/gold/expansao.json");
const TG = json<GoldTransicao>("public/energia/gold/transicao.json");

/** CSV com ponto e vírgula: linhas como objetos. */
function csv(p: string): Record<string, string>[] {
  const [cab, ...linhas] = ler(p).trim().split(/\r?\n/);
  const cols = cab.split(";");
  return linhas.map((l) => Object.fromEntries(l.split(";").map((v, i) => [cols[i], v])));
}

/* ---------------------------------------------------------------- as 17 páginas */

const PAGINAS = {
  mercado: MercadoPage,
  agentes: MercadoAgentesPage,
  "mre-e-gsf": MercadoMreGsfPage,
  encargos: MercadoEncargosPage,
  geracao: GeracaoPage,
  capacidade: GeracaoCapacidadePage,
  restricoes: GeracaoRestricoesPage,
  termica: GeracaoTermicaPage,
  expansao: ExpansaoPage,
  carteira: CarteiraPage,
  cenarios: CenariosPage,
  cronograma: CronogramaPage,
  "geracao-e-transmissao": TransmissaoPage,
  transicao: TransicaoPage,
  emissoes: EmissoesPage,
  "energia-estimada": EstimadaPage,
  mmgd: MmgdPage,
} as const;
type Pagina = keyof typeof PAGINAS;

const HTML = Object.fromEntries(Object.entries(PAGINAS).map(([k, P]) => [k, renderToStaticMarkup(createElement(P))])) as Record<Pagina, string>;

/**
 * Remove o que o leitor de Entender não vê: blocos de Analisar e Auditar (subárvores com data-nivel), SVG, diálogos,
 * scripts e o corpo de um <details> fechado (o resumo fica).
 */
function semNiveis(html: string): string {
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(\/?)>/g;
  const VAZIOS = new Set(["br", "img", "input", "meta", "link", "hr", "col", "wbr", "source", "area", "base", "embed", "track"]);
  let out = "";
  let ultimo = 0;
  let ocultoAte = -1;
  let prof = 0;
  const pilha: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [tudo, fecha, tag, attrs, autoFecha] = m;
    const t = tag.toLowerCase();
    if (ocultoAte < 0) out += html.slice(ultimo, m.index);
    ultimo = m.index + tudo.length;
    const vazio = VAZIOS.has(t) || autoFecha === "/";
    if (!fecha) {
      const pai = pilha[pilha.length - 1];
      const ocultar = /data-nivel="(analisar|auditar)"/.test(attrs) || ["svg", "dialog", "script", "style", "noscript", "template"].includes(t) || (pai === "details" && t !== "summary");
      if (!vazio) {
        pilha.push(t);
        prof++;
        if (ocultar && ocultoAte < 0) ocultoAte = prof;
      }
      if (ocultoAte < 0 && !vazio) out += " ";
    } else {
      if (pilha.length) {
        pilha.pop();
        if (ocultoAte === prof) ocultoAte = -1;
        prof--;
      }
      if (ocultoAte < 0) out += " ";
    }
  }
  if (ocultoAte < 0) out += html.slice(ultimo);
  return out;
}
const nbsp = (s: string) => s.replace(/ /g, " ");
const desescapa = (s: string) => nbsp(s).replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
/** Texto de Entender da página (da <main> em diante). */
/** A abertura do módulo fica atrás de "Sobre esta página" (um toque): para estes testes ela conta como texto de Entender, porque é onde os termos são definidos. */
const comAberturaAberta = (h: string) => h.replace(/<details[^>]*data-sobre-pagina="true"[^>]*>([\s\S]*?)<\/details>/g, "<div>$1</div>");
const entender = (h: string) => desescapa(semNiveis(comAberturaAberta(h).slice(comAberturaAberta(h).indexOf("<main"))).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
/** Texto de todos os níveis. */
const tudo = (h: string) => desescapa(h.slice(h.indexOf("<main")).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** Blocos (RespostaCurta) de um painel: veredito, início do bloco de Analisar e fim do bloco. */
function bloco(html: string, id: string, atributo = "data-resposta") {
  const i = html.indexOf(`${atributo}="${id}"`);
  if (i < 0) return null;
  const p0 = html.indexOf("<p", i);
  const p1 = html.indexOf("</p>", p0);
  const veredito = desescapa(html.slice(html.indexOf(">", p0) + 1, p1).replace(/<[^>]+>/g, ""));
  const nivel = html.indexOf('data-nivel="analisar"', p1);
  return { i, veredito, nivel, depois: html.slice(nivel, nivel + 12000) };
}

/* ---------------------------------------------------------------- (a) a (c): vereditos */

type Caso = { pagina: Pagina; id: string; veredito: string; completa: string[] };

const painelM = (id: "P032" | "P033" | "P034" | "P035") => MG.paineis.find((p) => p.id === id)!.resposta!;
const CASOS: Caso[] = [
  { pagina: "mercado", id: "P032", veredito: M.vereditoLivreRegulado(MG), completa: [painelM("P032")] },
  { pagina: "agentes", id: "P033", veredito: M.vereditoAgentes(MG), completa: [painelM("P033")] },
  { pagina: "mre-e-gsf", id: "P034", veredito: M.vereditoGsf(MG), completa: [painelM("P034")] },
  { pagina: "encargos", id: "P035", veredito: M.vereditoEncargos(MG), completa: [painelM("P035")] },
  { pagina: "geracao", id: "p021", veredito: GE.vereditoMatriz(GG.matriz, "SIN", "30d", "com"), completa: [GE.respostaMatriz(GG.matriz, "SIN", "30d", "com")] },
  { pagina: "termica", id: "p022", veredito: GE.vereditoTermica(GG.termica!), completa: [GE.respostaTermica(GG.termica!)] },
  {
    pagina: "restricoes",
    id: "p023",
    veredito: GE.vereditoRestricao({ eolica: GG.restricoes.eolica ?? undefined, solar: GG.restricoes.solar ?? undefined }),
    completa: [GE.respostaRestricao(GG.restricoes.eolica!)],
  },
  { pagina: "capacidade", id: "p024", veredito: GE.vereditoCapacidade(GG.capacidade!), completa: [GE.respostaCapacidade(GG.capacidade!)] },
  { pagina: "expansao", id: "sintese", veredito: EX.vereditoSintese(XG), completa: [EX.respostaSintese(XG)] },
  { pagina: "expansao", id: "p040", veredito: EX.vereditoCarteira(XG), completa: [EX.respostaCarteira(XG)] },
  { pagina: "expansao", id: "p041", veredito: EX.vereditoCronograma(XG), completa: [EX.respostaCronograma(XG)] },
  { pagina: "expansao", id: "p042", veredito: EX.vereditoTransmissao(XG), completa: [EX.respostaTransmissao(XG)] },
  { pagina: "expansao", id: "p043", veredito: EX.vereditoCenarios(XG), completa: [EX.respostaCenarios(XG)] },
  { pagina: "carteira", id: "p040", veredito: EX.vereditoCarteira(XG), completa: [EX.respostaCarteira(XG)] },
  { pagina: "cronograma", id: "p041", veredito: EX.vereditoCronograma(XG), completa: [EX.respostaCronograma(XG)] },
  { pagina: "geracao-e-transmissao", id: "p042", veredito: EX.vereditoTransmissao(XG), completa: [EX.respostaTransmissao(XG)] },
  { pagina: "cenarios", id: "p043", veredito: EX.vereditoCenarios(XG), completa: [EX.respostaCenarios(XG)] },
  { pagina: "transicao", id: "p063", veredito: TR.vereditoMmgd(TG.mmgd), completa: [TR.respostaMmgd(TG.mmgd)] },
  { pagina: "transicao", id: "ons", veredito: TR.vereditoOns(TG.ons_mmgd!), completa: [TR.respostaOns(TG.ons_mmgd!)] },
  { pagina: "transicao", id: "p064", veredito: TR.vereditoEmissoes(TG.emissoes!), completa: [TR.respostaEmissoes(TG.emissoes!)] },
  { pagina: "mmgd", id: "p063", veredito: TR.vereditoMmgd(TG.mmgd), completa: [TR.respostaMmgd(TG.mmgd)] },
  { pagina: "energia-estimada", id: "ons", veredito: TR.vereditoOns(TG.ons_mmgd!), completa: [TR.respostaOns(TG.ons_mmgd!)] },
  { pagina: "emissoes", id: "p064", veredito: TR.vereditoEmissoes(TG.emissoes!), completa: [TR.respostaEmissoes(TG.emissoes!)] },
];

/** Números com separador ou vírgula decimal ("96.618", "45,3", "0,0461"): os valores, sem anos nem dias. */
const valoresDe = (t: string) => (t.match(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+,\d+/g) ?? []).filter((x, i, a) => a.indexOf(x) === i);

describe("vereditos: curtos, derivados do dado e com a resposta completa por trás", () => {
  it.each(CASOS)("$pagina $id: no máximo 50 palavras e 8 números, e mais curto que a resposta completa", (c) => {
    expect(c.veredito.length).toBeGreaterThan(0);
    expect(palavras(c.veredito)).toBeLessThanOrEqual(50);
    expect(numeros(c.veredito)).toBeLessThanOrEqual(8);
    // a resposta completa do P034 já tem 37 palavras: só as demais precisam ficar mais curtas que a completa
    if (Math.max(...c.completa.map(palavras)) > 45) expect(palavras(c.veredito)).toBeLessThan(Math.max(...c.completa.map(palavras)));
    // no máximo dois valores além do período: dois números com separador ou vírgula
    expect(valoresDe(c.veredito).length).toBeLessThanOrEqual(2);
    expect(c.veredito).not.toMatch(/[–—]|\bhoje\b|undefined|NaN|\d{4}-\d{2}/);
  });

  it.each(CASOS)("$pagina $id: todo valor do veredito está na resposta completa (nenhum número digitado)", (c) => {
    const base = c.completa.join(" ");
    for (const v of valoresDe(c.veredito)) {
      // a resposta do P023 é por fonte: o valor da outra fonte vem da resposta dela
      const alvo = c.id === "p023" ? `${base} ${GE.respostaRestricao(GG.restricoes.solar!)}` : base;
      expect(alvo, `${c.pagina} ${c.id}: ${v}`).toContain(v);
    }
  });

  it.each(CASOS)("$pagina $id: a página mostra o veredito antes do bloco de Analisar e a resposta completa dentro dele, inteira", (c) => {
    const h = HTML[c.pagina];
    const b = bloco(h, c.id);
    expect(b, `${c.pagina} ${c.id}`).not.toBeNull();
    expect(b!.veredito).toBe(nbsp(c.veredito));
    expect(b!.nivel).toBeGreaterThan(b!.i);
    for (const completa of c.completa) expect(b!.depois).toContain(escapa(completa).slice(0, 80));
    // a resposta completa não está no que o leitor de Entender vê
    expect(entender(h)).toContain(nbsp(c.veredito));
    expect(entender(h)).not.toContain(c.completa[0].slice(0, 90));
  });

  it("os vereditos de P033 e P035 trocam a parede de números pelo que muda ou soma; P034 e P032 dizem o limite", () => {
    expect(CASOS.find((c) => c.id === "P033")!.veredito).toContain("não empresas");
    expect(CASOS.find((c) => c.id === "P035")!.veredito).toContain("não do pagamento");
    expect(CASOS.find((c) => c.id === "P032")!.veredito).toContain("não se comparam");
    expect(CASOS.find((c) => c.id === "P034")!.veredito).toContain("não reproduz");
  });

  it("julgamento ('acima', 'abaixo', 'alto', 'baixo', 'dentro') só com critério da própria página", () => {
    for (const c of CASOS) {
      // o que está entre parênteses é o rótulo da base ("geração declarada pelo agente ou acima do despachado"), não julgamento nosso
      const m = c.veredito.replace(/\([^)]*\)/g, "").match(/\b(acima|abaixo|alto|alta|baixo|baixa|dentro)\b/gi);
      if (!m) continue;
      // só as emissões comparam com o ano anterior do mesmo painel; o sentido vem dos dois valores publicados
      expect(c.id, c.veredito).toBe("p064");
      const e = TG.emissoes!;
      const ant = e.medio_anual.find((x) => x.ano === e.ultimo_ano!.ano - 1)!;
      expect(e.ultimo_ano!.valor).toBeLessThan(ant.valor);
    }
  });

  it("toda sigla de um veredito está em siglas.ts (a legenda da página a expande); o resto são unidades", () => {
    const UNIDADES = new Set(["MW", "GW", "MWh", "GWh", "MVA", "CO2"]);
    const candidatas = new Set<string>();
    for (const c of CASOS) for (const s of c.veredito.match(/\b[A-Z]{2,}[a-z]*\d?\b/g) ?? []) candidatas.add(s);
    expect(candidatas.size).toBeGreaterThan(8);
    Array.from(candidatas).forEach((s) => { if (!UNIDADES.has(s)) expect(SIGLAS[s], s).toBeDefined(); });
  });

  it("filtros: o veredito da matriz muda com região, janela e perímetro, sempre curto e sem número digitado", () => {
    for (const rg of ["SIN", "SE", "S", "NE", "N"] as const)
      for (const j of ["dia", "7d", "30d", "12m"] as const)
        for (const per of ["com", "sem"] as const) {
          const v = GE.vereditoMatriz(GG.matriz, rg, j, per);
          expect(v.length, `${rg} ${j} ${per}`).toBeGreaterThan(0);
          expect(palavras(v), `${rg} ${j} ${per}`).toBeLessThanOrEqual(50);
          expect(numeros(v), `${rg} ${j} ${per}`).toBeLessThanOrEqual(8);
          expect(v, `${rg} ${j} ${per}`).not.toMatch(/,,|\s,/);
          const completa = GE.respostaMatriz(GG.matriz, rg, j, per);
          for (const x of valoresDe(v)) expect(completa, `${rg} ${j} ${per}: ${x}`).toContain(x);
          if (per === "sem") expect(v).toContain("sem a MMGD estimada");
        }
  });

  it("restrições: com uma só fonte publicada o veredito fala só dela; sem 12 meses, é vazio", () => {
    const so = GE.vereditoRestricao({ eolica: GG.restricoes.eolica ?? undefined });
    expect(so).toContain("eólicas");
    expect(so).not.toContain("fotovoltaicas");
    expect(GE.vereditoRestricao({})).toBe("");
    expect(GE.vereditoRestricao({ eolica: { ...GG.restricoes.eolica!, ultimos_12m: null } })).toBe("");
  });

  it("dado ausente: veredito vazio e a página mostra a resposta completa", () => {
    const m2 = structuredClone(MG);
    delete m2.livre_regulado.kpis.participacao_livre_12m;
    delete m2.livre_regulado.kpis.participacao_acl_ccee_12m;
    expect(M.vereditoLivreRegulado(m2)).toBe("");
    const x2 = structuredClone(XG);
    x2.cronograma.confiabilidade = [];
    x2.cronograma.previsoes_atuais.por_ano = [];
    expect(EX.vereditoCronograma(x2)).toBe("");
    expect(TR.vereditoOns({ ultimo_mes_completo: null })).toBe("");
  });
});

/* ---------------------------------------------------------------- (c): identificadores técnicos */

const IDENTIFICADORES: [string, RegExp][] = [
  ["snake_case", /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/],
  ["código com sublinhado", /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/],
  ["nome de arquivo", /\b[\w-]+\.(?:csv|json|xlsx|parquet|pdf|py|gz)\b/],
  ["bastidor", /sha256|HTTP \d{3}|\bP0\d\d\b|\bp0\d\d\b|achado A\d\d|\bpipeline\b|\bsilver\b|\bbronze\b|\bgold\b|\bvintage\b|\bParquet\b|\bmanifesto\b/],
  ["campo em camelCase", /\b[a-z]+[A-Z][A-Za-z]+\b|\b[A-Z][a-z]+(?:[A-Z][a-z]+){2,}\b/],
  ["código com prefixo", /\b(?:ceg|cju):\S+/],
  ["caminho de campo", /\bestagios\.[a-z_.]+/],
];
/** Nomes de usina que o próprio RALIE publica com sublinhado (dado, não identificador nosso). */
const NOMES_DE_USINA = /\bGSJP_ENZO\b/g;

describe("nenhum identificador técnico no texto de Entender das 17 páginas", () => {
  it.each(Object.keys(PAGINAS) as Pagina[])("%s", (k) => {
    const t = entender(HTML[k]).replace(NOMES_DE_USINA, "");
    for (const [nome, re] of IDENTIFICADORES) expect(t.match(re)?.[0] ?? null, `${k}: ${nome}`).toBeNull();
  });

  it("regras de texto de produto em todos os níveis: sem travessão, sem 'hoje', sem data crua, sem undefined e abaixo do orçamento de HTML", () => {
    for (const [k, h] of Object.entries(HTML)) {
      const t = tudo(h);
      // o detalhamento publicado pelo ONS (Analisar) cita a descrição da fonte, que traz travessão: o texto de produto é o de Entender
      expect(entender(h), k).not.toMatch(/[–—]/);
      expect(t, k).not.toMatch(/\bhoje\b/i);
      expect(t, k).not.toMatch(/undefined|NaN|\[object Object\]/);
      expect(t, k).not.toMatch(/(^|[\s(])20\d\d[-/]\d\d([-/]\d\d)?(T[\d:]+Z?)?(?=[\s).,;]|$)/);
      expect(Buffer.byteLength(h, "utf-8"), k).toBeLessThan(600 * 1024);
    }
  });

  it("os códigos de conjunto da CCEE saem do rodapé de fontes e a data de referência por série fica explicada", () => {
    const h = HTML.agentes;
    const e = entender(h);
    for (const cod of ["agente_qtd_contabilizacao", "consumo_classe_agente", "mre_mensal", "encargo_ess_ancilar"]) for (const k of ["agentes", "mre-e-gsf", "encargos", "mercado"] as const) expect(entender(HTML[k]), `${k}: ${cod}`).not.toContain(cod);
    expect(e).toContain(M.NOME_CONJUNTO_CCEE.agente_qtd_contabilizacao);
    // o código continua em Analisar e Auditar ("Sobre este dado" e recurso)
    expect(tudo(h)).toContain("agente_qtd_contabilizacao");
  });

  it("a coluna de códigos do ONS (ceg:, CJU_) deixou as tabelas de usinas de Entender, e o nome da usina fica", () => {
    expect(GE.COLUNAS_USINAS_RESTRICAO.map((c) => c.id)).not.toContain("id");
    expect(GE.COLUNAS_EXTREMOS_FC.map((c) => c.id)).not.toContain("chave");
    const x = GE.linhasExtremosFc(GG.capacidade!.ultimos_12m!.por_categoria.find((c) => c.categoria === "eolica")!);
    expect(x.every((l) => !/^(ceg|cju):/.test(l.nome))).toBe(true);
    expect(x.some((l) => /CONJUNTO EOLICO/.test(l.nome) || /^EOL /.test(l.nome))).toBe(true);
  });

  it("ressalvas da Síntese da Expansão: texto de leitor em Analisar e o campo da base só em Auditar", () => {
    const r = EX.ressalvaLegivel("4 atos de encerramento com a potência em kW (fora da soma): ver estagios.encerramentos.potencia_conferida.");
    expect(r.texto).toBe("4 atos de encerramento com a potência em kW (fora da soma).");
    expect(r.campo).toBe("estagios.encerramentos.potencia_conferida");
    const p = EX.ressalvaLegivel("17 pares do Parquet histórico do RALIE conferidos. Ver estagios.unidades_atipicas.");
    expect(p.texto).toBe("17 pares do arquivo histórico do RALIE conferidos.");
    expect(p.campo).toBe("estagios.unidades_atipicas");
    expect(EX.ressalvaLegivel("Sem campo.").campo).toBeNull();
    const h = HTML.expansao;
    expect(entender(h)).not.toContain("Ressalvas da validação");
    expect(tudo(h)).toContain("Ressalvas da validação desta publicação");
    expect(h).toContain('data-nivel="auditar"> Campo da base publicada: estagios.encerramentos.potencia_conferida');
    expect(h).not.toContain("Parquet");
  });

  it("regra de peso das coortes sem o nome do campo da fonte", () => {
    expect(EX.semNomeDeCampo(XG.estagios.coortes_peso.regra)).not.toContain("MdaPotenciaUnitaria");
    expect(XG.estagios.coortes_peso.regra).toContain("MdaPotenciaUnitaria");
  });

  it("a nota de MVA do leilão (campo MdaSubEstacoesMVA) e o bloqueio anti-robô saem de Entender, e continuam na página", () => {
    const h = HTML["geracao-e-transmissao"];
    expect(entender(h)).not.toMatch(/MdaSubEstacoesMVA|anti-robô|desafio/);
    expect(tudo(h)).toContain("MdaSubEstacoesMVA");
    expect(tudo(h)).toContain("anti-robô");
  });

  it("Cronograma: as regras de leitura não trazem o campo da fonte nem a notação matemática em Entender; a regra original fica em Analisar", () => {
    const h = HTML.cronograma;
    expect(entender(h)).not.toMatch(/DatPrevisaoOpComercialSFG|S \+ 365/);
    expect(tudo(h)).toContain("DatPrevisaoOpComercialSFG");
    expect(entender(h)).toContain("Previsão de operação comercial é a previsão da fiscalização da ANEEL");
  });

  it("Emissões: a planilha e os detalhes da listagem do MCTI ficam em Auditar", () => {
    const h = HTML.emissoes;
    expect(entender(h)).not.toMatch(/\.xlsx|âncoras ocultas|planilhas publicadas/);
    expect(tudo(h)).toMatch(/âncoras ocultas ignoradas/);
    expect(tudo(h)).toContain("1 nota técnica");
    expect(tudo(h)).not.toContain("1 notas técnicas");
  });

  it("Emissões e MMGD: o rótulo da linha de referência não repete o valor", () => {
    const e = TG.emissoes!;
    expect(TR.referenciaAnual(e)).toEqual([{ valor: e.ultimo_ano!.valor, rotulo: String(e.ultimo_ano!.ano) }]);
    expect(TR.referenciaUf(TG.mmgd.resumo.w_por_habitante_brasil, "whab")[0].rotulo).toBe("Brasil");
    const dup = /(\d[\d.,]*) (tCO2\/MWh|W\/hab): \1 \2/;
    expect(nbsp(HTML.emissoes)).not.toMatch(dup);
    expect(nbsp(HTML.mmgd)).not.toMatch(dup);
    expect(nbsp(HTML.emissoes)).toContain(`>${String(e.ultimo_ano!.ano)}: ${TR.fator(e.ultimo_ano!.valor)} tCO2/MWh<`);
  });
});

/* ---------------------------------------------------------------- (d): conciliações com o dado de outro artefato */

describe("conciliação: Tipo III, 6,9% no texto contra 2,6% no gráfico (/geracao)", () => {
  it("o grupo Tipo III reúne várias fontes e o gráfico mostra só a parte térmica: relido do CSV de rótulos e da matriz diária", () => {
    // outro artefato: energia por categoria e natureza (CSV anual) e matriz diária por categoria (CSV)
    const rot = csv("public/energia/series/geracao_rotulos_fonte.csv").filter((r) => r.natureza === "grupo_tipo3" && r.ano === "2025");
    const porCat = new Map<string, number>();
    for (const r of rot) porCat.set(r.categoria, (porCat.get(r.categoria) ?? 0) + Number(r.mwh));
    expect(Array.from(porCat.keys()).sort()).toEqual(["eolica", "hidraulica", "solar_centralizada", "termica_sem_combustivel"]);
    const total = Array.from(porCat.values()).reduce((s, v) => s + v, 0);
    expect(porCat.get("termica_sem_combustivel")! / total).toBeGreaterThan(0.2);
    expect(porCat.get("termica_sem_combustivel")! / total).toBeLessThan(0.5);

    const mix = GG.matriz.janelas.SIN["30d"]!;
    const dias = csv("public/energia/series/geracao_matriz_diaria.csv").filter((r) => r.regiao === "SIN" && r.data >= mix.inicio && r.data <= mix.fim);
    expect(dias).toHaveLength(mix.dias);
    const pctTermica = (100 * dias.reduce((s, r) => s + Number(r.termica_sem_combustivel || 0), 0)) / dias.reduce((s, r) => s + Number(r.total_mwh), 0);
    expect(pctTermica).toBeCloseTo(mix.participacao.termica_sem_combustivel!, 1);
    expect(mix.natureza_pct.grupo_tipo3!).toBeGreaterThan(pctTermica);

    const h = entender(HTML.geracao);
    const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    expect(h).toContain(`Pequenas usinas Tipo III: ${fmt(mix.natureza_pct.grupo_tipo3!)}% da geração com a MMGD estimada, somando usinas hidráulicas, eólicas, solares e térmicas`);
    expect(h).toContain(`"Térmicas Tipo III": ${fmt(mix.participacao.termica_sem_combustivel!)}%`);
  });

  it("sem a MMGD no perímetro a nota diz o denominador; sem o dado, não escreve", () => {
    const mix = GG.matriz.janelas.SIN["30d"]!;
    expect(GE.notaTipoIII(mix, "sem", ["hidráulicas"])).toContain("sem a MMGD no total");
    expect(GE.notaTipoIII(null, "com", [])).toBe("");
    expect(GE.notaTipoIII({ ...mix, natureza_pct: { ...mix.natureza_pct, grupo_tipo3: null } }, "com", [])).toBe("");
    expect(GE.fontesDoGrupoTipo3(GG.matriz.rotulos, GG.categorias)).toEqual(["hidráulicas", "eólicas", "solares", "térmicas"]);
  });
});

describe("conciliação: mercado livre, 45,3% (EPE) e 42,4% (CCEE) lado a lado (/mercado)", () => {
  it("os dois percentuais saem de universos e fórmulas diferentes: relidos dos CSV da EPE e da CCEE, e a página diz isso ao lado dos cartões", () => {
    const k = MG.livre_regulado.kpis;
    const ini = k.participacao_livre_12m!.periodo.inicio;
    const fim = k.participacao_livre_12m!.periodo.fim;
    const epe = csv("public/energia/series/mercado_nacional_mensal.csv").filter((r) => r.mes >= ini && r.mes <= fim);
    expect(epe).toHaveLength(12);
    const pctEpe = (100 * epe.reduce((s, r) => s + Number(r.livre_mwh), 0)) / epe.reduce((s, r) => s + Number(r.total_mwh), 0);

    const c = csv("public/energia/series/mercado_ccee_mensal.csv").filter((r) => r.conjunto === "consumo_classe_agente" && r.serie.endsWith("|CONSUMO") && r.mes >= ini && r.mes <= fim && r.valor !== "");
    const horas = (mes: string) => new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate() * 24;
    let acl = 0;
    let acr = 0;
    for (const r of c) {
      const classe = r.serie.split("|")[0];
      const mwh = Number(r.valor) * horas(r.mes);
      if (classe === "Distribuidor") acr += mwh;
      else if (classe !== "Exportador") acl += mwh;
    }
    const pctCcee = (100 * acl) / (acl + acr);

    const f1 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    expect(f1(pctEpe)).toBe("45,3");
    expect(f1(pctCcee)).toBe("42,4");
    expect(f1(pctEpe)).not.toBe(f1(pctCcee));
    const h = entender(HTML.mercado);
    expect(h).toContain(`Os dois percentuais do mercado livre (${f1(pctEpe)}% e ${f1(pctCcee)}%) vêm de universos diferentes`);
    expect(h).toContain("A diferença entre as duas não foi decomposta");
    // a nota fica logo abaixo dos quatro números, antes do primeiro painel
    expect(h.indexOf("vêm de universos diferentes")).toBeLessThan(h.indexOf(MG.paineis[0].pergunta, h.indexOf("O mercado em quatro números") + 30));
  });

  it("'variou 4,3%' ganhou o sentido da variação", () => {
    expect(M.textoVariacaoVerbo(4.32, 1)).toBe("subiu 4,3%");
    expect(M.textoVariacaoVerbo(-1.24, 1)).toBe("caiu 1,2%");
    expect(M.textoVariacaoVerbo(0.01, 1)).toBe("não variou");
    expect(tudo(HTML.mercado)).toContain("subiu 4,3% contra o mesmo mês do ano anterior");
    expect(tudo(HTML.mercado)).not.toContain("variou 4,3%");
  });
});

describe("conciliação: GSF de 12 meses com 81,8%, 80,43% e 92,55% (/mercado/mre-e-gsf)", () => {
  it("os dois valores do observatório vêm de janelas vizinhas (relidas do CSV da CCEE) e o terceiro é do boletim; a página diz as três janelas e os três valores", () => {
    const rows = csv("public/energia/series/mercado_ccee_mensal.csv");
    const serie = (conj: string, s: string) => new Map(rows.filter((r) => r.conjunto === conj && r.serie === s && r.valor !== "").map((r) => [r.mes, Number(r.valor)]));
    const gen = new Map<string, number>();
    for (const sm of ["SE", "S", "NE", "N"]) Array.from(serie("geracao_submercado", `${sm}|GERACAO_MRE`)).forEach(([m, v]) => gen.set(m, (gen.get(m) ?? 0) + v));
    const gf = serie("mre_mensal", "GARANTIA_FISICA_MODULADA_FDISP");
    const horas = (mes: string) => new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate() * 24;
    const gsf = (ini: string, fim: string) => {
      const ms = Array.from(gen.keys()).filter((m) => m >= ini && m <= fim);
      expect(ms).toHaveLength(12);
      return (100 * ms.reduce((s, m) => s + gen.get(m)! * horas(m), 0)) / ms.reduce((s, m) => s + gf.get(m)! * horas(m), 0);
    };
    const k = MG.mre_gsf.kpis.gsf_12m!;
    const doCartao = gsf(k.periodo.inicio, k.periodo.fim);
    const div = MG.mre_gsf.reconciliacao_infomercado.find((x) => x.medida === "gsf_12m_pct" && x.resultado !== "aprovado")!;
    const janelaBoletim = gsf(M.mesesAntes(div.mes, 11), div.mes);
    expect(doCartao).toBeCloseTo(k.valor_pct, 1);
    expect(janelaBoletim).toBeCloseTo(div.calculado!, 1);
    expect(div.publicado).toBe(92.55);
    expect(Math.abs(doCartao - janelaBoletim)).toBeGreaterThan(1);

    const f2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const h = entender(HTML["mre-e-gsf"]);
    expect(h).toContain("Três valores, três recortes");
    expect(h).toContain(`publica ${f2(div.publicado!)}% para o ajuste médio de 12 meses até ${M.textoPeriodoMes({ inicio: div.mes, fim: div.mes })}`);
    expect(h).toContain(`na mesma janela (${M.textoPeriodoMes({ inicio: M.mesesAntes(div.mes, 11), fim: div.mes }).replace(" a ", " a ")}) a razão de energias do observatório dá ${f2(janelaBoletim)}%`);
    expect(h).toContain(`o cartão mostra ${(Math.round(doCartao * 10) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%, de ${M.textoPeriodoMes(k.periodo)}`);
    expect(h).toContain("diferença que a fonte não explica");
    expect(h).toContain("O valor do cartão é o da janela mais recente");
    expect(h).not.toContain("diferença que não foi explicada");
  });

  it("o exemplo de leitura do GSF do mês sai da razão publicada", () => {
    const v = MG.mre_gsf.kpis.gsf_ultimo_mes!.valor_pct;
    expect(entender(HTML["mre-e-gsf"])).toContain(`para cada 100 MWh de garantia física ajustada, as hidrelétricas do MRE geraram ${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MWh`);
  });
});

describe("conciliação: ESS do boletim do MME, R$ 958,1 milhões, contra R$ 1,60 bilhão em 12 meses (/mercado/encargos)", () => {
  it("o boletim soma seis meses com a resposta da demanda; o conjunto da CCEE nos mesmos meses fecha com ele sem ela: relido dos CSV", () => {
    const mme = csv("public/energia/series/mercado_encargos_mme.csv").filter((r) => r.vigente === "1" && r.mes >= "2026-01" && r.mes <= "2026-06");
    const totalMme = mme.filter((r) => r.nivel === "total").reduce((s, r) => s + Number(r.valor_mil_rs), 0);
    const rdMme = mme.filter((r) => r.tipo === "resposta_demanda").reduce((s, r) => s + Number(r.valor_mil_rs), 0);
    expect(totalMme).toBe(958066);

    const tipos = ["ENCARGO_CONST_ON", "ENCARGO_CONST_OFF", "ENCARGO_REST_OP_UNIT_COMT", "ENCARGO_CS", "OUTROS_SERVICOS_ANCILARES", "ENCARGO_SEG_ENER", "RECEBIMENTO_ENCARGO_DH", "ENCARGO_IMPORTACAO", "RECEBIMENTO_ENCARGO_RESERVA_OP"];
    const ccee = csv("public/energia/series/mercado_ccee_mensal.csv").filter((r) => r.conjunto === "encargo_ess_ancilar" && tipos.includes(r.serie) && r.valor !== "");
    const soma = (ini: string, fim: string) => ccee.filter((r) => r.mes >= ini && r.mes <= fim).reduce((s, r) => s + Number(r.valor), 0);
    const cceeSeis = soma("2026-01", "2026-06");
    const cceeDoze = soma("2025-09", "2026-08");
    // o conjunto aberto da CCEE nos seis meses fecha com o boletim menos a resposta da demanda (tolerância de 6 mil R$ do controle)
    expect(Math.abs(cceeSeis / 1e3 - (totalMme - rdMme))).toBeLessThanOrEqual(6);
    expect(cceeDoze / 1e9).toBeCloseTo(1.6029, 3);
    expect(cceeDoze).toBeGreaterThan(cceeSeis * 1.5);

    const h = entender(HTML.encargos);
    const sc = M.conciliacaoEssMme(MG)!;
    expect(sc.meses).toBe(6);
    expect(sc.mmeMilRs).toBe(totalMme);
    expect(sc.respostaDemandaMilRs).toBe(rdMme);
    expect(sc.cceeRs).toBeCloseTo(cceeSeis, -1);
    expect(h).toContain("O cartão do boletim do MME (R$ 958,1 milhões) soma 6 meses, jan/2026 a jun/2026, e inclui R$ 6,0 milhões de resposta da demanda; nesses meses, o ESS da CCEE é R$ 952,1 milhões.");
    expect(h).toContain("Por isso ele não se compara com os R$ 1,60 bilhão de 12 meses (set/2025 a ago/2026), que não incluem a resposta da demanda.");
  });

  it("sem os meses do conjunto da CCEE a nota não é escrita", () => {
    const m2 = structuredClone(MG);
    m2.encargos.ess_mensal = m2.encargos.ess_mensal.filter((x) => x.mes !== "2026-03");
    expect(M.notaEssMme(m2)).toBe("");
  });
});

describe("conciliação: eólicas, 51,3 GW em operação e implantação contra 49,6 GW no cenário, e a palavra 'maior' (/expansao/cenarios)", () => {
  it("34,9 GW (SIGA) mais 16,4 GW (RALIE) passam de 49,6 GW (PDE): somas relidas dos CSV publicados; a nota diz a razão", () => {
    const siga = csv("public/energia/series/expansao_usinas_siga.csv").filter((r) => r.tipo === "EOL" && r.estagio === "operacao");
    const operacao = siga.reduce((s, r) => s + Number(r.kw_fiscalizado || 0), 0) / 1e6;
    const ralie = csv("public/energia/series/expansao_carteira_ralie.csv").filter((r) => r.tipo === "EOL");
    const implantacao = ralie.reduce((s, r) => s + Number(r.kw_ugs_em_implantacao || 0), 0) / 1e6;
    const pde = Number(csv("public/energia/series/expansao_pde2035.csv").find((r) => r.figura === "Figura 3-25" && r.referencia === "2035-12" && r.serie === "Eólica (GW)")!.valor);
    expect(operacao + implantacao).toBeGreaterThan(pde);
    const f1 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    expect(f1(operacao)).toBe("34,9");
    expect(f1(implantacao)).toBe("16,4");
    expect(f1(operacao + implantacao)).toBe("51,3");
    expect(f1(pde)).toBe("49,6");

    const h = entender(HTML.cenarios);
    expect(h).toContain(`eólicas (${f1(operacao)} GW em operação mais ${f1(implantacao)} GW em implantação, ${f1(operacao + implantacao)} GW, contra ${f1(pde)} GW no cenário)`);
    expect(h).toContain("As camadas ficam lado a lado e não se somam: a carteira em implantação não é entrada certa, e o cenário é hipótese de planejamento, não previsão.");
    expect(EX.notaCarteiraAcimaDoCenario({ cenarios: { ...XG.cenarios, camadas: XG.cenarios.camadas.map((c) => ({ ...c, carteira_ralie_gw: 0, realizado_siga_gw: 0 })) } })).toBe("");
  });

  it("'a maior' vira 'a de maior capacidade' entre as de correspondência direta, e a hidrelétrica (parcial, 113 GW) é dita fora da comparação", () => {
    const r = EX.respostaCenarios(XG);
    expect(r).toContain("a de maior capacidade em dez/2035 é a de eólicas, com 49,6 GW no cenário");
    expect(r).not.toContain("a maior em dez/2035");
    const hidro = XG.cenarios.camadas.find((c) => c.categoria === "UHE")!;
    expect(hidro.correspondencia).toBe("parcial");
    expect(hidro.pde_dez2035_gw!).toBeGreaterThan(XG.cenarios.camadas.find((c) => c.categoria === "Eólica")!.pde_dez2035_gw!);
    expect(r).toContain("Hidrelétricas (UHE), com 113,0 GW no cenário, ficam fora desta comparação porque a correspondência com o cadastro é parcial");
    // a de maior capacidade continua sendo a maior das diretas
    const g2 = structuredClone(XG);
    g2.cenarios.camadas.find((c) => c.categoria === "Biomassa")!.pde_dez2035_gw = 80;
    expect(EX.respostaCenarios(g2)).toContain("biomassa, com 80,0 GW");
  });

  it("o 'O que mudou' do cenário diz que há uma única edição e não repete a ressalva da lista de hipóteses em Entender", () => {
    const m = EX.mudancaCenarios(XG);
    expect(m).toContain("Esta publicação traz uma única edição do plano (PDE 2035), sem comparação de números com outra edição.");
    expect(m).toContain("Lei nº 15.269/2025");
    const h = HTML.cenarios;
    expect(entender(h).split("Lei nº 15.269/2025").length - 1).toBe(1);
    expect(entender(h)).not.toMatch(/\(relatório, p\. \d+\)/);
    expect(tudo(h)).toMatch(/\(relatório, p\. \d+\)/);
  });
});

describe("conciliação: RALIE com 2.246 usinas e 95.888,3 MW contra SIGA com 145 + 2.099 usinas e 96.298,0 MW (/expansao/carteira)", () => {
  it("os totais são próximos e de listas diferentes: relidos dos CSV do RALIE e do SIGA, e a página diz a medida, a data e as fases", () => {
    const ralie = csv("public/energia/series/expansao_carteira_ralie.csv");
    const siga = csv("public/energia/series/expansao_usinas_siga.csv").filter((r) => r.estagio === "construcao" || r.estagio === "construcao_nao_iniciada");
    const mwRalie = ralie.reduce((s, r) => s + Number(r.kw_ugs_em_implantacao || 0), 0) / 1e3;
    const mwSiga = siga.reduce((s, r) => s + Number(r.kw_outorgado || 0), 0) / 1e3;
    expect(ralie).toHaveLength(2246);
    expect(siga).toHaveLength(2244);
    expect(mwRalie).toBeCloseTo(95888.3, 0);
    expect(mwSiga).toBeCloseTo(96298.0, 0);
    // não é a mesma lista: parte das usinas do RALIE está em outra fase do SIGA (ou fora dele)
    const fasesRalie = new Map<string, number>();
    for (const r of ralie) fasesRalie.set(r.fase_siga, (fasesRalie.get(r.fase_siga) ?? 0) + 1);
    expect(fasesRalie.get("Operação")).toBe(23);
    expect(fasesRalie.get("Construção não iniciada")).toBe(2078);
    const h = entender(HTML.carteira);
    expect(h).toContain("Os totais do RALIE e do SIGA são próximos, mas não são a mesma lista nem a mesma medida");
    expect(h).toContain("o RALIE (18/09/2026) acompanha 2.246 usinas, com 95.888,3 MW em unidades geradoras em implantação (2.078 na fase Construção não iniciada do SIGA, 139 na fase Construção do SIGA, 23 na fase Operação do SIGA e 6 fora do arquivo aberto do SIGA)");
    expect(h).toContain("o SIGA (30/09/2026) soma 2.244 usinas, com 96.298,0 MW de potência outorgada");
  });

  it("em operação: o cartão (fiscalizada) e o gráfico (outorgada) têm medidas diferentes, e a página diz isso antes do gráfico", () => {
    const siga = csv("public/energia/series/expansao_usinas_siga.csv").filter((r) => r.estagio === "operacao");
    const fisc = siga.reduce((s, r) => s + Number(r.kw_fiscalizado || 0), 0) / 1e3;
    const outor = siga.reduce((s, r) => s + Number(r.kw_outorgado || 0), 0) / 1e3;
    const f1 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    expect(f1(fisc)).toBe("220.658,9");
    expect(f1(outor)).toBe("221.382,6");
    const h = entender(HTML.carteira);
    expect(h).toContain(`o cartão mostra a potência fiscalizada (${f1(fisc)} MW) e o gráfico, a outorgada (${f1(outor)} MW)`);
    expect(h.indexOf("Em operação aparecem dois valores")).toBeLessThan(h.indexOf("Usinas do SIGA por estágio"));
  });

  it("as coortes ganham uma definição pelos rótulos da própria tabela, e o desfecho aparece com valores nas barras", () => {
    const h = entender(HTML.carteira);
    expect(h).toContain("Coorte é o grupo de usinas que entrou no acompanhamento do RALIE no mesmo ano; a primeira é o estoque da primeira fotografia.");
    expect(XG.estagios.coortes.map((c) => c.rotulo)).toEqual(expect.arrayContaining(["Estoque na primeira fotografia (17/06/2021)", "Entraram no RALIE em 2021"]));
    expect(h).toContain("teve a outorga revogada ou extinta");
  });
});

describe("conciliação: 177, 63 e 50 fotografias e as datas 22/09/2025 e 22/08/2025 (/expansao/cronograma)", () => {
  it("50 é o número de janelas de confiabilidade (CSV); 177 e 63 são as fotografias publicadas e mensais; a página diz o uso de cada contagem", () => {
    const conf = csv("public/energia/series/expansao_confiabilidade_previsoes.csv").filter((r) => r.tipo === "TOTAL");
    expect(conf).toHaveLength(50);
    expect(conf.at(-1)!.ralie).toBe("2025-08-22");
    expect(conf.at(-1)!.fim_janela).toBe("2026-08-22");
    const c = XG.cronograma;
    expect(c.confiabilidade.length).toBe(conf.length);
    expect(c.historico_fonte.fotografias).toBeGreaterThan(c.historico_fonte.fotografias_mensais);
    expect(c.historico_fonte.fotografias_mensais).toBeGreaterThan(c.confiabilidade.length);
    expect(c.deslizamento.length).toBe(c.confiabilidade.length + 1);

    const h = entender(HTML.cronograma);
    expect(h).toContain(
      `O RALIE publicou ${c.historico_fonte.fotografias} fotografias desde 17/06/2021; ${c.historico_fonte.fotografias_mensais} são mensais (a última de cada mês). A confiabilidade das previsões usa ${conf.length} delas, as que têm a janela de 12 meses já encerrada, e a revisão das previsões usa ${c.deslizamento.length} pares de fotografias com 12 meses de distância.`,
    );
  });

  it("as duas datas do 'O que mudou' são de leituras diferentes: a última janela encerrada (22/08/2025) e o último par de 12 meses (22/09/2025 a 18/09/2026)", () => {
    const d = XG.cronograma.deslizamento.at(-1)!;
    expect(d.ralie).toBe("2025-09-22");
    expect(d.ralie_seguinte).toBe("2026-09-18");
    const h = entender(HTML.cronograma);
    expect(h).toContain("As duas leituras terminam em fotografias diferentes: a confiabilidade usa a última janela de 12 meses já encerrada (previsões de 22/08/2025, janela até 22/08/2026), e a revisão compara a fotografia de 22/09/2025 com a de 18/09/2026");
    expect(h).toContain("adiamento mediano, ponderado pela potência: 367 dias");
    expect(h).not.toContain("mediana ponderada de 367 dias");
  });

  it("o cartão não chama a potência prevista de 'prometida' no texto de Entender", () => {
    expect(entender(HTML.cronograma)).not.toMatch(/MW prometido/);
    expect(entender(HTML.expansao)).not.toMatch(/MW prometido/);
  });
});

describe("conciliação: referência 'até 10/2026' contra 'até ago/2026' (/mercado/agentes)", () => {
  it("a referência da fonte é a da série que vai mais longe (lista de associados); as contagens por classe e as parcelas vão até ago/2026", () => {
    const pr = MG.proveniencia.agentes_ccee;
    const am = MG.agentes_migracao;
    expect(pr.periodo_referencia.fim).toBe("2026-10");
    expect(am.agentes_por_classe_mensal.at(-1)!.mes).toBe("2026-08");
    expect(am.parcelas_mensal.at(-1)!.mes).toBe("2026-08");
    expect(am.associados_fluxos.at(-1)!.mes).toBe("2026-10");
    const h = entender(HTML.agentes);
    expect(h).toContain("(referência até 10/2026)");
    expect(h).toContain("Cada série tem o seu período; a referência acima é a da que vai mais longe.");
    expect(h).toContain("agentes por classe: dez/2023 a ago/2026; lista de associados: out/2025 a out/2026; parcelas de carga: abr/2024 a ago/2026");
    expect(h).toContain("CCEE até ago/2026");
  });
});

describe("conciliação: a energia não gerada em MWh e em GWh (/geracao/restricoes) e as razões do gráfico", () => {
  it("o cartão e o texto usam GWh; o valor vem do mesmo campo em MWh dividido por mil", () => {
    const mwh = GG.restricoes.eolica!.ultimos_12m!.energia_nao_gerada_mwh!;
    const h = entender(HTML.restricoes);
    expect(h).toContain(`${Math.round(mwh / 1000).toLocaleString("pt-BR")} GWh`);
    expect(h).not.toContain(Math.round(mwh).toLocaleString("pt-BR"));
    // a ficha de prova mantém o valor original em MWh
    expect(tudo(HTML.restricoes)).toContain("MWh");
  });

  it("o lede promete quatro razões oficiais e a nota sob o gráfico diz que o parecer de acesso não teve energia (relido do CSV por usina e mês)", () => {
    const linhas = csv("public/energia/series/geracao_restricao_usina_mensal.csv");
    for (const f of ["eolica", "solar"] as const) {
      const u = GG.restricoes[f]!.ultimos_12m!;
      const doze = linhas.filter((x) => x.fonte === f && x.mes >= u.inicio && x.mes <= u.fim);
      const soma = (k: string) => doze.reduce((s, x) => s + Number(x[k] || 0), 0);
      expect(soma("eng_PAR_mwh"), f).toBe(0);
      expect(soma("eng_SEM_mwh"), f).toBe(0);
      for (const k of ["eng_REL_mwh", "eng_CNF_mwh", "eng_ENE_mwh"]) expect(soma(k), `${f} ${k}`).toBeGreaterThan(0);
    }
    const h = entender(HTML.restricoes);
    expect(h).toContain("Razões no gráfico:");
    expect(h).toContain("Restrição indicada no parecer de acesso não teve energia não gerada nos 12 meses e por isso não aparece no gráfico.");
    expect(h).toContain("razão elétrica (indisponibilidade externa)");
  });
});

/* ---------------------------------------------------------------- "O que mudou" e termos */

describe("'O que mudou' sem mudança: diz o que o bloco mede, em vez de repetir data de processamento", () => {
  it.each([
    ["capacidade", "o fator de capacidade mensal"],
    ["restricoes", "as restrições de eólicas e fotovoltaicas"],
    ["termica", "a térmica por motivo de despacho"],
  ] as const)("%s", (pagina, nome) => {
    const t = GE.textoSemComparacaoMensal("2026-08", "2026-10-01T07:00:00Z", nome);
    expect(t).toBe(`Sem comparação com a publicação anterior. ${nome.charAt(0).toUpperCase()}${nome.slice(1)}: último mês completo ago/2026, processado em 01/10/2026.`);
    const h = HTML[pagina];
    const i = h.indexOf(">O que mudou<");
    expect(i).toBeGreaterThan(0);
    expect(desescapa(h.slice(i, i + 700).replace(/<[^>]+>/g, " "))).toContain("Sem comparação com a publicação anterior.");
  });

  it("sem mês completo, a frase diz isso", () => {
    expect(GE.textoSemComparacaoMensal(null, "2026-10-01T07:00:00Z", "a térmica por motivo de despacho")).toBe("A térmica por motivo de despacho: nenhum mês completo publicado.");
  });

  it("MMGD: o 'O que mudou' diz a mudança real (conexões do último ano) e a revisão dos meses provisórios passa a Analisar", () => {
    const h = HTML.mmgd;
    const m = TR.mudancaMmgdAno(TG.mmgd);
    expect(m).toContain("Em 2025, último ano completo, foram conectados 9.633,5 MW, menos que os 10.671,6 MW de 2024.");
    expect(entender(h)).toContain(m);
    expect(entender(h)).not.toMatch(/caem de 862,4 MW/);
    expect(tudo(h)).toMatch(/caem de 862,4 MW/);
  });

  it("Energia estimada: o 'O que mudou' compara o último mês com o mesmo mês do ano anterior; a razão com a capacidade passa a Analisar", () => {
    const o = TG.ons_mmgd!;
    const m = TR.mudancaOnsMes(o);
    expect(m).toMatch(/^Em ago\/2026, a MMGD estimada foi de 8\.967,9 MWmed no SIN, acima do mesmo mês do ano anterior \(7\.387,5 MWmed em ago\/2025\)\.$/);
    // os dois meses relidos do CSV mensal publicado (linha do SIN)
    const csvOns = csv("public/energia/series/transicao_ons_mmgd_mensal.csv").filter((r) => r.submercado === "SIN");
    expect(Number(csvOns.find((r) => r.mes === "2025-08")!.mmgd_mwmed)).toBeCloseTo(7387.5, 1);
    expect(Number(csvOns.find((r) => r.mes === "2026-08")!.mmgd_mwmed)).toBeCloseTo(8967.9, 1);
    const h = HTML["energia-estimada"];
    expect(entender(h)).toContain(m);
    expect(entender(h)).not.toContain("17,7%");
    expect(tudo(h)).toContain("17,7%");
  });
});

describe("termos explicados no ponto de uso, só com texto já publicado", () => {
  it("energia estimada: a frase de leitor vem antes da fórmula, a fórmula fica em Analisar e 'carga global' leva ao verbete", () => {
    const h = HTML["energia-estimada"];
    const o = TG.ons_mmgd!;
    expect(entender(h)).toContain(TR.comoLerOns(o));
    expect(entender(h)).toContain("quer dizer que, de cada 100 MWh da carga global, cerca de 10,8 MWh vieram da MMGD, segundo a estimativa do ONS");
    expect(entender(h)).not.toMatch(/× 0,5 h|nunca média de médias/);
    expect(tudo(h)).toMatch(/× 0,5 h/);
    expect(h).toContain('href="/setor-eletrico/aprenda/carga-global"');
    // o subtítulo deixou de ser uma frase só de cerca de 45 palavras
    const lede = entender(h).split("Fontes e datas de referência")[0];
    const frases = lede.split(/(?<=[.;])\s+/).filter((f) => palavras(f) > 8);
    expect(Math.max(...frases.map(palavras))).toBeLessThanOrEqual(30);
  });

  it("restrições, encargos e térmica: constrained-off e ESS levam ao verbete; os motivos de despacho vêm do rótulo da base", () => {
    expect(HTML.restricoes).toContain('href="/setor-eletrico/aprenda/constrained-off"');
    expect(HTML.restricoes).toContain('href="/setor-eletrico/aprenda/ess"');
    expect(HTML.encargos).toContain('href="/setor-eletrico/aprenda/constrained-off"');
    expect(GE.explicacaoDoMotivo(GG.termica!.motivos, "razao_eletrica")).toBe("necessidade do SIN");
    expect(GE.explicacaoDoMotivo(GG.termica!.motivos, "unit_commitment")).toBe("rampa e tempos mínimos");
    expect(GE.explicacaoDoMotivo(GG.termica!.motivos, "merito")).toBe("acima da inflexibilidade");
    expect(GE.explicacaoDoMotivo(GG.termica!.motivos, "exportacao")).toBeNull();
    const t = entender(HTML.termica);
    expect(t).toContain("razão elétrica (necessidade do SIN)");
    expect(t).toContain("unit commitment (rampa e tempos mínimos)");
    expect(t).toContain("O percentil compara a semana");
    expect(t).toContain("vai de 0 (entre as menores participações) a 100 (entre as maiores)");
  });

  it("agentes, GSF, MMGD e Transição: ACL, ACR, garantia física e MMGD levam ao verbete; CNPJ vem com a empresa", () => {
    expect(HTML.agentes).toContain('href="/setor-eletrico/aprenda/acl"');
    expect(HTML.agentes).toContain('href="/setor-eletrico/aprenda/acr"');
    expect(entender(HTML.agentes)).toContain("um agente (a empresa, identificada pelo CNPJ)");
    expect(HTML["mre-e-gsf"]).toContain('href="/setor-eletrico/aprenda/garantia-fisica"');
    expect(HTML.mmgd).toContain('href="/setor-eletrico/aprenda/geracao-distribuida"');
    expect(entender(HTML.mmgd)).toContain("MMGD, a geração instalada junto às unidades consumidoras");
    expect(entender(HTML.mmgd)).toContain("Sistema de Compensação de Energia Elétrica (SCEE)");
  });

  it("'razão de somas' e 'p.p.' viraram descrição do que se calcula", () => {
    for (const k of ["mercado", "mre-e-gsf", "mmgd"] as const) expect(entender(HTML[k]), k).not.toMatch(/razão de somas/);
    expect(entender(HTML.mercado)).not.toContain("p.p.");
    expect(entender(HTML.mercado)).toContain("pontos percentuais contra os 12 meses anteriores");
    expect(entender(HTML["mre-e-gsf"])).not.toContain("p.p.");
  });

  it("emissões: o fator em tCO2/MWh ganha o equivalente em kg por MWh (conversão de unidade) e o veredito diz a mistura de bases", () => {
    const e = TG.emissoes!;
    expect(TR.kgPorMwh(e.ultimo_ano!.valor)).toBe(`${(e.ultimo_ano!.valor * 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg de CO2 por MWh`);
    expect(entender(HTML.emissoes)).toContain(`Em kg: ${TR.kgPorMwh(e.ultimo_ano!.valor)}`);
    expect(TR.vereditoEmissoes(e)).toContain("a comparação mistura bases");
    const semQuebra = { ...e, quebras: [] };
    expect(TR.vereditoEmissoes(semQuebra)).not.toContain("mistura bases");
    expect(TR.kgPorMwh(null)).toBe("sem dado");
  });
});

describe("Síntese da Expansão e da Transição: o veredito vale também nas páginas sem seletor próprio, agora com o seletor de profundidade", () => {
  it.each(["expansao", "transicao"] as const)("%s tem o seletor de profundidade e esconde a resposta completa em Entender", (k) => {
    expect(HTML[k]).toContain('role="radiogroup" aria-label="Nível de profundidade"');
    expect(HTML[k]).toContain('data-nivel="analisar"');
  });

  it("a Síntese da Expansão compara a carteira com o que já opera, sem somar as duas camadas", () => {
    const op = XG.estagios.resumo.find((r) => r.estagio === "operacao")!;
    expect(entender(HTML.expansao)).toContain(`o que já opera soma ${op.mw_fiscalizado.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} MW fiscalizados no SIGA`);
  });

  it("no Cartão da Síntese, o limite não usa 'hoje' nem 'coortes'", () => {
    const t = entender(HTML.expansao);
    expect(t).not.toMatch(/\bhoje\b/);
    expect(t).not.toMatch(/coortes passadas/);
    expect(t).toContain("o desfecho dos grupos de usinas de anos anteriores não é probabilidade para a carteira atual");
  });
});

describe("Mercado: 'As outras perguntas' mostram o veredito de cada painel, com a resposta da gold por trás", () => {
  it.each(["mercado", "agentes", "mre-e-gsf", "encargos"] as const)("%s", (k) => {
    const h = HTML[k];
    const outras = h.slice(h.indexOf("As outras perguntas sobre o mercado"));
    expect((outras.match(/data-resposta-resumo="/g) ?? []).length).toBe(3);
    const ids = ["P032", "P033", "P034", "P035"] as const;
    const proprio = { mercado: "P032", agentes: "P033", "mre-e-gsf": "P034", encargos: "P035" }[k];
    for (const id of ids.filter((x) => x !== proprio)) {
      const b = bloco(outras, id, "data-resposta-resumo")!;
      expect(b.veredito).toBe(nbsp(M.vereditoPainelMercado(MG, id)));
      expect(b.depois).toContain(escapa(painelM(id)).slice(0, 80));
    }
    // a resposta completa de outro painel não aparece em Entender
    for (const id of ids.filter((x) => x !== proprio)) expect(entender(h)).not.toContain(painelM(id).slice(0, 90));
  });
});
