/* Trabalho de conteúdo da r8, área PLD (/pld, /pld/cmo-e-formacao, /pld/diferencas-regionais, /pld/historico, /pld/limites,
 * /pld/modelos, as cinco fichas e /pld/previsoes): respostas em duas camadas (veredito em palavras simples à vista e a
 * resposta completa em Analisar), identificadores técnicos fora do texto de Entender e números que pareciam divergir
 * conciliados no ponto de uso. Os vereditos são derivados dos mesmos campos das respostas completas; as conciliações relêem os
 * CSV e os JSON publicados, sem repetir a fórmula do código. */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PaginaP008 from "@/app/setor-eletrico/pld/page";
import PaginaP009 from "@/app/setor-eletrico/pld/cmo-e-formacao/page";
import PaginaP010 from "@/app/setor-eletrico/pld/limites/page";
import PaginaP011 from "@/app/setor-eletrico/pld/historico/page";
import PaginaP012 from "@/app/setor-eletrico/pld/diferencas-regionais/page";
import PaginaModelos from "@/app/setor-eletrico/pld/modelos/page";
import PaginaFicha, { generateStaticParams as paramsFicha } from "@/app/setor-eletrico/pld/modelos/[modelo]/page";
import PaginaPrevisoes from "@/app/setor-eletrico/pld/previsoes/page";
import { NOS_FORMACAO } from "@/lib/energia/conteudo/pld";
import { dataBR } from "@/lib/energia/formato";
import {
  SUBMERCADOS,
  anosPermanencia,
  ligacoesFormacao,
  marcosSemanais,
  respostaP008,
  respostaP009,
  respostaP010,
  respostaP011,
  respostaP012,
  semCodigoHttp,
  textoSensibilidadePeso,
  vereditoP008,
  vereditoP009,
  vereditoP010,
  vereditoP011,
  vereditoP012,
} from "@/lib/energia/pld";
import {
  COLUNAS_ARQUIVO_TABELA,
  COLUNAS_GRADE,
  linhasArquivo,
  partirInterno,
  respostaFicha,
  respostaP013,
  respostaP014,
  respostaP015,
  respostaP016,
  semCodigosInternos,
  termosPrevisoes,
  vereditoFicha,
  vereditoP013,
  vereditoP014,
  vereditoP015,
  vereditoP016,
} from "@/lib/energia/previsoes";
import { lerCsvPrevisoes } from "@/lib/energia/previsoes-arquivos";
import type { ModelosGold } from "@/lib/energia/tipos";
import type { PldDetalheGold } from "@/lib/energia/tipos-pld";
import type { PrevisoesDesempenhoGold } from "@/lib/energia/tipos-previsoes";

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const json = <T>(p: string) => JSON.parse(ler(p)) as T;
const palavras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const numeros = (t: string) => (t.match(/\d[\d.,]*\d|\d/g) ?? []).length;
const br = (v: number, casas = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const reaisBr = (v: number, casas = 2) => `R$ ${br(v, casas)}`;
/** O texto de Entender sai com espaço comum no lugar do espaço não separável; as expectativas comparadas com ele passam pelo mesmo caminho. */
const plano = (t: string) => t.replaceAll("\u00a0", " ");
const esc = (t: string) => t.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** CSV publicado (separador ";") como lista de objetos. */
function csv(p: string): Record<string, string>[] {
  const linhas = ler(p).split(/\r?\n/).filter(Boolean);
  const cab = linhas[0].replace(/^﻿/, "").split(";");
  return linhas.slice(1).map((l) => Object.fromEntries(l.split(";").map((v, i) => [cab[i], v])));
}

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/** Texto que o leitor vê em Entender: sem blocos de Analisar e de Auditar, sem diálogo fechado e sem a dica que só abre com hover. */
function textoEntender(html: string): string {
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(\/?)>/g;
  const pilha: { tag: string; esconde: boolean }[] = [];
  let escondidos = 0;
  let saida = "";
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [inteiro, fecha, tag, attrs, autoFecha] = m;
    if (escondidos === 0) saida += html.slice(ultimo, m.index);
    ultimo = m.index + inteiro.length;
    const t = tag.toLowerCase();
    if (t === "script" || t === "style") {
      const fim = html.indexOf(`</${t}>`, ultimo);
      if (fim > 0) {
        re.lastIndex = fim + t.length + 3;
        ultimo = re.lastIndex;
      }
      continue;
    }
    if (fecha) {
      for (let i = pilha.length - 1; i >= 0; i--) {
        if (pilha[i].tag === t) {
          for (const p of pilha.splice(i)) if (p.esconde) escondidos--;
          break;
        }
      }
      if (escondidos === 0) saida += " ";
    } else if (!VOID.has(t) && !autoFecha) {
      const esconde = t === "dialog" || /data-nivel="(analisar|auditar)"/.test(attrs) || /role="tooltip"/.test(attrs);
      pilha.push({ tag: t, esconde });
      if (esconde) escondidos++;
    }
  }
  if (escondidos === 0) saida += html.slice(ultimo);
  return saida
    .replace(/<[^>]+>/g, "")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?)])/g, "$1");
}

/** Identificadores técnicos que não podem aparecer no texto de Entender das páginas desta área. */
const IDENTIFICADORES: [string, RegExp][] = [
  ["sha256", /sha256/i],
  ["código HTTP", /\bHTTP\s*[45]\d{2}\b/],
  ["decisao_publicacao", /decisao_publicacao|validacao_observatorio/],
  ["troque publicar", /troca publicar|troque publicar|publicar para true/i],
  ["implementador", /implementador/i],
  ["repositório", /repositório/i],
  ["LAT1D", /LAT1D/],
  ["G23-R1", /G23-R1/],
  ["achado Axx", /achado A\d{2}/i],
  ["atraso em minutos", /\d+\s+minutos depois do prazo/],
  ["código de painel", /(?<![\w/])P01[3-6](?![\w/])/],
  ["nome de campo da fórmula", /\bx_j\b|escala_rms_j|beta_escalado_j/],
  ["decidido_por/decidido_em", /decidido_(por|em)/],
  ["código de motivo", /SEM_PLD_CAPTURADO_ATE_O_CORTE/],
  ["campo do CSV mensal", /media_temporal|pld_mensal/],
  ["conjuntos da CCEE", /PLD_HORARIO_SUBMERCADO|SUMARIO_BE_HORARIO_SUBMERCADO|SUMARIO_MENSAL_COMPRA_VENDA_SUBMERCADO/],
  ["identificador de registro", /\bprosp_\d{4}-\d{2}-\d{2}_|forecast_id/],
  ["nome de arquivo", /\b[\w-]+\.(?:json|csv|parquet)\b/],
  ["perfil de agente", /perfil de agente/i],
  ["pseudo tempo real", /pseudo tempo real|snapshot|look-ahead/i],
];

const ROTAS = {
  pld: PaginaP008,
  cmo: PaginaP009,
  limites: PaginaP010,
  historico: PaginaP011,
  regionais: PaginaP012,
  modelos: PaginaModelos,
  previsoes: PaginaPrevisoes,
} as const;

const html: Record<string, string> = {};
for (const [k, P] of Object.entries(ROTAS)) html[k] = renderToStaticMarkup(createElement(P as () => JSX.Element));
const modelosFicha = paramsFicha().map((p: { modelo: string }) => p.modelo);
for (const modelo of modelosFicha) html[`ficha-${modelo}`] = renderToStaticMarkup(createElement(PaginaFicha as never, { params: { modelo } }));

const D = json<PldDetalheGold>("public/energia/gold/pld_detalhe.json");
const P = json<PrevisoesDesempenhoGold>("public/energia/gold/previsoes_desempenho.json");
const M = json<ModelosGold>("public/energia/gold/modelos.json");
const ligacoes = ligacoesFormacao(NOS_FORMACAO, D.conceito.fontes_textuais);
const lim = D.limites.disponivel ? D.limites : null;

describe("vereditos: curtos, com poucos números, sem travessão e sem data ISO", () => {
  const vereditos: Record<string, string> = {};
  vereditos.p008 = vereditoP008(D.conceito);
  for (const sm of SUBMERCADOS) {
    vereditos[`p009 ${sm}`] = vereditoP009(D.cmo_pld, sm);
    vereditos[`p011 ${sm}`] = vereditoP011(D.historico, sm);
  }
  if (lim) for (const ano of anosPermanencia(lim)) for (const sm of SUBMERCADOS) vereditos[`p010 ${ano} ${sm}`] = vereditoP010(lim, ano, sm, D.referencia.dia);
  for (const per of D.regional.periodos.map((p) => p.id)) vereditos[`p012 ${per}`] = vereditoP012(D.regional, per);
  vereditos.p013 = vereditoP013(P);
  vereditos.p014 = vereditoP014(P);
  vereditos.p016 = vereditoP016(P);
  const emissoes = lerCsvPrevisoes("/energia/series/previsoes_emissoes.csv");
  const linhas = emissoes ? linhasArquivo(emissoes.linhas, Object.fromEntries(P.modelos.map((m) => [m.codigo, m.estado]))) : [];
  vereditos.p015 = vereditoP015(linhas, "", linhas.length);
  vereditos["p015 recorte"] = vereditoP015(linhas.filter((l) => l.registrado_no_portal_em <= "2026-09-28"), "2026-09-28", linhas.length);
  for (const f of P.fichas) vereditos[`ficha ${f.codigo}`] = vereditoFicha(f, M.modelos.find((x) => x.codigo === f.codigo)?.resumo, P);

  it("cada veredito tem no máximo 50 palavras e no máximo 8 números", () => {
    expect(Object.keys(vereditos).length).toBeGreaterThan(30);
    for (const [k, v] of Object.entries(vereditos)) {
      expect(v.length, k).toBeGreaterThan(0);
      expect(palavras(v), k).toBeLessThanOrEqual(50);
      expect(numeros(v), k).toBeLessThanOrEqual(8);
    }
  });

  it("sem travessão, sem a palavra hoje, sem data ISO, sem undefined e sem NaN", () => {
    for (const [k, v] of Object.entries(vereditos)) {
      expect(v, k).not.toMatch(/–|—/);
      expect(v, k).not.toMatch(/\bhoje\b/i);
      expect(v, k).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(v, k).not.toMatch(/undefined|NaN/);
    }
  });

  it("nenhum veredito leva identificador técnico", () => {
    for (const [k, v] of Object.entries(vereditos)) for (const [nome, re] of IDENTIFICADORES) expect(v, `${k}: ${nome}`).not.toMatch(re);
  });

  it("o veredito é mais curto que a resposta completa que ele resume", () => {
    const completas: Record<string, string> = {
      p008: respostaP008(D.conceito, ligacoes),
      "p009 SE": respostaP009(D.cmo_pld, "SE"),
      "p011 SE": respostaP011(D.historico, "SE"),
      "p012 12m": respostaP012(D.regional, "12m"),
      p013: respostaP013(P),
      p014: respostaP014(P),
      p016: respostaP016(P),
      p015: respostaP015(linhas, "", linhas.length),
    };
    if (lim) completas["p010 2026 SE"] = respostaP010(lim, 2026, "SE", D.referencia.dia);
    for (const [k, c] of Object.entries(completas)) expect(palavras(vereditos[k]), k).toBeLessThan(palavras(c));
  });

  it("o veredito do P009 diz o sentido da diferença pelas diferenças prontas da gold, inclusive quando o PLD fica abaixo", () => {
    const ref = D.cmo_pld.semana_referencia!;
    for (const x of ref.por_sm) {
      const v = vereditoP009(D.cmo_pld, x.sm);
      expect(v).toContain(dataBR(ref.fim));
      expect(v).toContain(`${x.pld_menos_decomp > 0 ? "acima" : "abaixo"} do CMO semanal do DECOMP`);
      expect(v).toContain(`${x.pld_menos_dessem > 0 ? "acima" : "abaixo"} do CMO médio do DESSEM`);
    }
  });

  it("o veredito do P011 só diz 'em X% desses dias a média foi menor' sem empate, e junta a mediana e a metade central", () => {
    for (const p of D.historico.posicao_referencia) {
      const v = vereditoP011(D.historico, p.sm);
      expect(v).toContain(p.media_dia! < p.mesmo_mes.p50! ? "abaixo da mediana" : "acima da mediana");
      expect(v).toContain(p.mesmo_mes.percentil! < 25 ? "entre os 25% mais baixos" : p.mesmo_mes.percentil! > 75 ? "entre os 25% mais altos" : "na metade central");
      if (p.mesmo_mes.empates === 0) expect(v).toContain(`Em ${br(p.mesmo_mes.percentil!, 1)}% desses dias a média foi menor.`);
    }
    // com empate, o veredito não afirma a fração: diz o percentil
    const comEmpate = { ...D.historico, posicao_referencia: D.historico.posicao_referencia.map((p) => ({ ...p, mesmo_mes: { ...p.mesmo_mes, empates: 3 } })) };
    expect(vereditoP011(comEmpate, "SE")).toContain("o percentil");
    expect(vereditoP011(comEmpate, "SE")).not.toContain("a média foi menor");
  });
});

describe("resposta em duas camadas nas páginas: veredito à vista, resposta completa intacta em Analisar", () => {
  const camadas = (h: string, id: string) => {
    const i = h.indexOf(`data-resposta="${id}"`);
    expect(i, id).toBeGreaterThan(0);
    const fim = h.indexOf('data-nivel="analisar"', i);
    expect(fim, id).toBeGreaterThan(i);
    return { veredito: h.slice(i, fim), detalhe: h.slice(fim, fim + 12_000) };
  };

  it("P008 a P012 (SE como padrão)", () => {
    const casos: [string, string, string, string][] = [
      ["pld", "p008", vereditoP008(D.conceito), respostaP008(D.conceito, ligacoes)],
      ["cmo", "p009", vereditoP009(D.cmo_pld, "SE"), respostaP009(D.cmo_pld, "SE")],
      ["historico", "p011", vereditoP011(D.historico, "SE"), respostaP011(D.historico, "SE")],
      ["regionais", "p012", vereditoP012(D.regional, "12m"), respostaP012(D.regional, "12m")],
    ];
    if (lim) casos.push(["limites", "p010", vereditoP010(lim, 2026, "SE", D.referencia.dia), respostaP010(lim, 2026, "SE", D.referencia.dia)]);
    for (const [pagina, id, veredito, completa] of casos) {
      const c = camadas(html[pagina], id);
      expect(c.veredito, id).toContain(esc(veredito));
      expect(c.veredito, id).not.toContain(esc(completa.slice(-50)));
      expect(c.detalhe, id).toContain(esc(completa.slice(-50)));
      expect(html[pagina], id).toContain(esc(completa));
    }
  });

  it("P013 a P016 e fichas", () => {
    const emissoes = lerCsvPrevisoes("/energia/series/previsoes_emissoes.csv")!;
    const linhas = linhasArquivo(emissoes.linhas, Object.fromEntries(P.modelos.map((m) => [m.codigo, m.estado])));
    const casos: [string, string, string, string][] = [
      ["previsoes", "p013", vereditoP013(P), respostaP013(P)],
      ["previsoes", "p015", vereditoP015(linhas, "", linhas.length), respostaP015(linhas, "", linhas.length)],
      ["modelos", "p014", vereditoP014(P), respostaP014(P)],
      ["modelos", "p016", vereditoP016(P), respostaP016(P)],
    ];
    for (const [pagina, id, veredito, completa] of casos) {
      const c = camadas(html[pagina], id);
      expect(c.veredito, id).toContain(esc(veredito));
      expect(c.veredito, id).not.toContain(esc(completa.slice(-50)));
      expect(html[pagina], id).toContain(esc(completa));
    }
    for (const f of P.fichas) {
      const h = html[`ficha-${f.codigo.toLowerCase()}`];
      const resumo = M.modelos.find((x) => x.codigo === f.codigo)?.resumo;
      const c = camadas(h, "p014");
      expect(c.veredito, f.codigo).toContain(esc(vereditoFicha(f, resumo, P)));
      expect(h, f.codigo).toContain(esc(respostaFicha(f, P)));
    }
  });

  it("o texto de Entender não repete a resposta completa", () => {
    expect(textoEntender(html.cmo)).not.toContain("estes dados não explicam a diferença");
    expect(textoEntender(html.cmo)).toContain(vereditoP009(D.cmo_pld, "SE").slice(0, 60));
    expect(textoEntender(html.historico)).not.toContain("semana ISO (40)");
  });
});

describe("identificadores técnicos fora do texto de Entender", () => {
  for (const pagina of Object.keys(html)) {
    it(`${pagina}: nenhum identificador técnico novo à vista`, () => {
      const t = textoEntender(html[pagina]);
      expect(t.length, pagina).toBeGreaterThan(2000);
      for (const [nome, re] of IDENTIFICADORES) {
        // a linha "Fonte:" das fichas compartilhadas (conjunto PLD_HORARIO) é tratada fora desta área e não entra nesta regra
        const m = re.exec(t);
        expect(m, `${pagina}: ${nome}${m ? ` (${t.slice(Math.max(0, m.index - 60), m.index + 80)})` : ""}`).toBeNull();
      }
    });
  }

  it("os identificadores continuam disponíveis em Analisar e Auditar (nada foi apagado)", () => {
    expect(html.pld).toContain("PLD_HORARIO_SUBMERCADO");
    expect(html.pld).toContain("perfil de agente");
    expect(html.pld).toContain("sha256");
    expect(html.modelos).toContain("validacao_observatorio.decisao_publicacao");
    expect(html.modelos).toContain("implementador");
    expect(html.historico).toContain("media_temporal de pld_mensal.csv");
    expect(html.previsoes).toContain("751");
    expect(html["ficha-b0"]).toContain("SEM_PLD_CAPTURADO_ATE_O_CORTE");
    expect(html["ficha-b0"]).toContain("LAT1D");
    expect(html["ficha-c2-p"]).toContain("escala_rms_j");
    expect(html["ficha-s0"]).toContain("achado A09");
    expect(html["ficha-c1"]).toContain("Sem implementação no repositório");
  });

  it("as abas de previsões e modelos não levam P013 a P016 no texto; o código fica em atributo", () => {
    for (const pagina of ["previsoes", "modelos"]) {
      expect(textoEntender(html[pagina])).not.toMatch(/\bP01[3-6]\b/);
      expect(html[pagina]).toMatch(/data-painel="P01[3-6]"/);
    }
  });

  it("as fórmulas dos candidatos C2 aparecem em palavras em Entender e com os símbolos em Analisar", () => {
    for (const modelo of ["c2-p", "c2-h"]) {
      const t = textoEntender(html[`ficha-${modelo}`]);
      expect(t).toContain("B0 mais uma correção para cada variável de entrada");
      expect(t).not.toMatch(/Σ|λ\s*=|⇒/);
      expect(html[`ficha-${modelo}`]).toContain("Fórmula no registro");
    }
  });

  it("a tabela do arquivo de emissões mostra o nome do registro e não o identificador nem o sha256", () => {
    const ids = COLUNAS_ARQUIVO_TABELA.map((c) => c.id);
    expect(ids[0]).toBe("linha");
    for (const c of ["forecast_id", "sha256", "versao_codigo"]) expect(ids).not.toContain(c);
    expect(COLUNAS_GRADE.map((c) => c.id)).not.toContain("forecast_id");
    expect(textoEntender(html.previsoes)).toMatch(/B0 W1 SE\/CO, rodada de 27\/09\/2026/);
  });

  it("o texto do registro limpo para o leitor mantém o fato e perde só o código", () => {
    expect(semCodigosInternos("LAT1D: dado elegível se o período terminou até 1 dia antes do corte (hipótese).")).toBe("Dado elegível se o período terminou até 1 dia antes do corte (hipótese).");
    expect(semCodigosInternos("07h00 de Brasília do dia de origem; dado como estava no corte; períodos elegíveis sob LAT1D")).toBe("07h00 de Brasília do dia de origem; dado como estava no corte");
    expect(semCodigosInternos("28 células sem número, porque nenhum PLD havia sido capturado (SEM_PLD_CAPTURADO_ATE_O_CORTE); emissão depois do prazo.")).toBe(
      "28 células sem número, porque nenhum PLD havia sido capturado; emissão depois do prazo.",
    );
    expect(semCodigosInternos("O teste é reconstrução sob a hipótese LAT1D (achado A09).")).toBe("O teste é reconstrução sob a hipótese de defasagem de 1 dia.");
    expect(semCodigoHttp("as regras não estão acessíveis (HTTP 403).")).toBe("as regras não estão acessíveis.");
    const p = partirInterno(
      "Números retidos até a liberação formal. A interpretação é do implementador (30/09/2026) e aguarda ratificação. O responsável registra em validacao_observatorio.decisao_publicacao: estado LIBERADA.",
    );
    expect(p.leitor).toBe("Números retidos até a liberação formal.");
    expect(p.interno).toContain("implementador");
    expect(p.interno).toContain("validacao_observatorio");
  });

  it("os termos do registro (corte, origem, rodada, P10 e P90) são explicados com o texto publicado", () => {
    const itens = termosPrevisoes(P.definicoes);
    expect(itens.map((i) => i.termo)).toEqual(["Corte e origem", "Rodada", "P10 e P90"]);
    for (const pagina of ["previsoes", "modelos", "ficha-b0"]) {
      const t = textoEntender(html[pagina]);
      expect(t, pagina).toContain("Corte às 07h00 de Brasília do dia de origem; prazo de emissão às 08h00.");
      expect(t, pagina).toContain("O dia de origem é o dia da rodada.");
      expect(t, pagina).toContain("A faixa entre P10 e P90 pretende conter o preço em 80% dos casos");
    }
    expect(P.definicoes.corte_operacional).toContain("Corte às 07h00 de Brasília");
    expect(P.definicoes.quantis).toContain("A faixa entre P10 e P90 pretende conter o preço em 80% dos casos");
  });
});

describe("termos explicados no ponto de uso com texto já publicado", () => {
  it("CMO, DECOMP e DESSEM na abertura da página de CMO, com as palavras dos verbetes", () => {
    const t = textoEntender(html.cmo);
    expect(t).toContain("(CMO) é o custo, por unidade de energia produzida, para atender ao incremento de uma unidade de carga no sistema interligado");
    expect(t).toContain("o do modelo DECOMP, por semana operativa, e o do modelo DESSEM, por meia hora e para cada barra do sistema");
  });

  it("teto estrutural na abertura da página de limites, com o texto do verbete de limites", () => {
    const t = textoEntender(html.limites);
    expect(t).toContain("o teto estrutural (o limite para a média diária dos preços horários)");
    expect(t).toContain("hora no limite = preço igual ao limite, ao centavo");
    expect(t).not.toContain("0,005");
  });

  it("MWmed com o nome por extenso na seção de submercados da página principal", () => {
    expect(textoEntender(html.pld)).toContain("em MWmed (megawatt médio)");
  });

  it("a página de diferenças regionais não promete em Entender o fluxo que só aparece em Analisar", () => {
    const t = textoEntender(html.regionais);
    expect(t).toContain("Em Analisar, mostra também o intercâmbio");
    expect(t).not.toContain("fluxo em MWmed");
    expect(t).toContain("Decreto nº 5.163/2004 manda o cálculo do PLD observar as restrições de transmissão entre submercados");
  });

  it("os marcos do gráfico semanal dizem o que são, sem 'zeros do DECOMP'", () => {
    const m = marcosSemanais(D.achados.A02, D.cmo_pld.semanal.fim);
    expect(m.length).toBeGreaterThan(0);
    for (const x of m) expect(x.rotulo).not.toMatch(/zeros do DECOMP/);
    expect(m.map((x) => x.rotulo).join(" ")).toContain("CMO semanal zero");
  });

  it("os marcos de perímetro do histórico usam a descrição publicada, sem P1 para P2", () => {
    const t = html.historico;
    expect(textoEntender(t)).not.toMatch(/P1 para P2|P2 para P3/);
    expect(t).toContain(esc(D.historico.ponderacao.quebras[0].descricao.replace(/\.$/, "")));
  });

  it("coeficiente dos candidatos C2: a barra diz o que mostra e a linha em 1 só aparece na média dos 7 dias", () => {
    for (const modelo of ["c2-p", "c2-h"]) {
      const t = textoEntender(html[`ficha-${modelo}`]);
      expect(t).toContain("Cada barra mostra o coeficiente estimado de “Média dos 7 últimos dias − B0 (R$/MWh)” em um segmento (horizonte e submercado), no último ajuste.");
      expect(t).toContain("um coeficiente c soma ao B0 c vezes a diferença entre a média dos 7 últimos dias e o B0; acima de 1, a correção passa da própria diferença e amplia o desvio recente");
      expect(t).toContain("1: acima disso, a correção amplia o desvio recente");
      expect(t).toContain("Coeficiente na unidade original: R$/MWh de correção por R$/MWh (ou por ponto percentual) da variável.");
    }
  });
});

describe("conciliações: contagens que pareciam divergir, explicadas no ponto de uso e relidas dos CSV publicados", () => {
  const horario = csv("public/energia/series/pld_cmo_horario.csv");
  const limitesDia = csv("public/energia/series/pld_limites_diario.csv");

  it("(2) horas entre os limites em 2026 no Sudeste/Centro-Oeste: 'página de limites' contra 'CMO e formação', a diferença é o DESSEM publicado", () => {
    const pisoTeto = new Map<string, [number, number]>();
    for (const r of limitesDia) if (r.sm === "SE") pisoTeto.set(r.data, [Number(r.pld_min), Number(r.pld_max_horario)]);
    let todas = 0;
    let comCmo = 0;
    let horasAno = 0;
    let horasComCmo = 0;
    for (const r of horario) {
      if (!r.data_hora_local.startsWith("2026")) continue;
      const [piso, teto] = pisoTeto.get(r.data_hora_local.slice(0, 10))!;
      const p = Number(r.PLD_SE);
      const entre = Math.abs(p - piso) > 0.005 && Math.abs(p - teto) > 0.005;
      horasAno++;
      if (r.CMO_SE !== "") horasComCmo++;
      if (entre) todas++;
      if (entre && r.CMO_SE !== "") comCmo++;
    }
    expect(todas).not.toBe(comCmo);
    // a nota da página de CMO traz os dois números e a razão, e a página de limites mostra o primeiro
    const nota = `Na página de limites, 2026 (ano parcial) tem ${br(todas, 0)} horas entre os limites do Sudeste/Centro-Oeste; aqui são ${br(comCmo, 0)}, porque entram só as horas com o CMO do DESSEM publicado (${br(horasComCmo, 0)} das ${br(horasAno, 0)} horas do ano).`;
    expect(html.cmo).toContain(esc(nota));
    expect(html.limites).toContain(br(todas, 0));
    // a resposta completa continua com o número daqui
    expect(html.cmo).toContain(`nas ${br(comCmo, 0)} horas com o PLD entre os limites`);
  });

  it("(1) registros do arquivo de previsões: o link da página PLD usa o CSV completo, como a página de previsões", () => {
    const linhas = csv("public/energia/series/previsoes_emissoes.csv");
    const rodadas = new Set(linhas.map((l) => l.run_id)).size;
    expect(linhas.length).toBeGreaterThan(28); // o trecho legado da gold sozinho tem 28
    const texto = `${br(linhas.length, 0)} registros de ${rodadas} rodadas`;
    expect(textoEntender(html.pld)).toContain(`Histórico de previsões (${texto})`);
    expect(textoEntender(html.previsoes)).toContain(`arquivo com ${texto}`);
    expect(textoEntender(html.pld)).not.toMatch(/\d+ registros, \d+ publicações/);
    // e a última execução é a referência experimental, não uma rodada interna
    expect(textoEntender(html.pld)).toMatch(/Referência experimental de 30\/09\/2026, com o modelo B0/);
    expect(linhas.filter((l) => l.previsao !== "").length).toBe(P.prospectivo.apuracoes.length);
  });

  it("(2) PLD já publicado no corte (07h a 23h) e média das 24 horas do dia na página PLD: janelas diferentes do mesmo dia", () => {
    const dia = D.referencia.dia;
    const horas = horario.filter((r) => r.data_hora_local.startsWith(dia));
    expect(horas).toHaveLength(24);
    const media = (rs: Record<string, string>[]) => rs.reduce((s, r) => s + Number(r.PLD_SE), 0) / rs.length;
    const apos = horas.filter((r) => Number(r.data_hora_local.slice(11, 13)) >= 7);
    expect(apos).toHaveLength(17);
    const t = textoEntender(html.previsoes);
    expect(t).toContain(plano(reaisBr(media(apos))));
    expect(t).toContain(plano(`A página PLD mostra a média das 24 horas do dia, ${reaisBr(media(horas))}/MWh; aqui entram só as 17 horas depois do corte.`));
    expect(textoEntender(html.pld)).toContain(plano(reaisBr(media(horas))));
  });

  it("(2) percentil do cartão (todas as médias diárias desde 2021) e do Histórico (mesmo mês de anos anteriores): universos diferentes", () => {
    const diario = csv("public/energia/series/pld_diario.csv");
    const dia = D.referencia.dia;
    const v = Number(diario.find((r) => r.data === dia)!.SE);
    const rank = (xs: number[]) => (100 * (xs.filter((x) => x < v).length + 0.5 * xs.filter((x) => x === v).length)) / xs.length;
    const todos = diario.map((r) => Number(r.SE));
    const mesmoMes = diario.filter((r) => r.data.slice(5, 7) === dia.slice(5, 7) && Number(r.data.slice(0, 4)) < Number(dia.slice(0, 4))).map((r) => Number(r.SE));
    const p1 = Math.round(rank(todos) * 10) / 10;
    const p2 = Math.round(rank(mesmoMes) * 10) / 10;
    expect(p1).not.toBe(p2);
    const t = textoEntender(html.pld);
    expect(t).toContain(`compara a média do dia com as ${br(todos.length, 0)} médias diárias desde 2021, de todos os meses`);
    expect(t).toContain(`com os ${br(mesmoMes.length, 0)} dias de setembro de anos anteriores`);
    expect(t).toContain(`percentil ${br(p1, 1)} nos cartões e ${br(p2, 1)} no Histórico`);
    expect(t).toContain(`percentil ${br(p1, 1)} de ${br(todos.length, 0)} dias`);
    // o veredito do Histórico diz a fração que o CSV confirma
    expect(textoEntender(html.historico)).toContain(`Em ${br(p2, 1)}% desses dias a média foi menor.`);
  });

  it("(2) 55 horas dos últimos 30 dias acima de R$ 1,00/MWh: a página PLD e a linha Últimos 30 dias da página de diferenças dão o mesmo número", () => {
    const ultimas = horario.filter((r) => r.data_hora_local >= "2026-09-01");
    expect(ultimas).toHaveLength(720);
    const acima = (rs: Record<string, string>[], limiar: number) =>
      rs.filter((r) => {
        const v = [r.PLD_SE, r.PLD_S, r.PLD_NE, r.PLD_N].map(Number);
        return Math.max(...v) - Math.min(...v) > limiar;
      }).length;
    const n30 = acima(ultimas, 1);
    const n12 = acima(horario.filter((r) => r.data_hora_local >= "2025-10-01"), 1);
    expect(textoEntender(html.pld)).toContain(plano(`Nos últimos 30 dias, ${n30} horas tiveram diferença acima de ${reaisBr(1)}/MWh`));
    expect(textoEntender(html.regionais)).toContain(`Mesmo limiar da página PLD, que conta ${n30} horas nos últimos 30 dias`);
    expect(html.regionais).toContain(br(n12, 0));
  });

  it("veredito do P012: fração de horas separadas e diferença média dos últimos 12 meses relidas das 8.760 horas do CSV", () => {
    const doze = horario.filter((r) => r.data_hora_local >= "2025-10-01");
    expect(doze).toHaveLength(8760);
    const dif = doze.map((r) => {
      const v = [r.PLD_SE, r.PLD_S, r.PLD_NE, r.PLD_N].map(Number);
      return Math.max(...v) - Math.min(...v);
    });
    const separadas = dif.filter((d) => Math.round(d * 100) > 1).length;
    const media = dif.reduce((s, d) => s + d, 0) / dif.length;
    const v = vereditoP012(D.regional, "12m");
    expect(v).toContain(`em ${br((100 * separadas) / dif.length, 1)}% das horas`);
    expect(v).toContain(`${reaisBr(media)}/MWh entre o maior e o menor`);
  });

  it("veredito do P010: fração de horas no piso em 2026 relida do CSV diário de limites", () => {
    const dias = limitesDia.filter((r) => r.sm === "SE" && r.data.startsWith("2026"));
    const horas = dias.reduce((s, r) => s + Number(r.horas), 0);
    const piso = dias.reduce((s, r) => s + Number(r.horas_no_piso), 0);
    const teto = dias.reduce((s, r) => s + Number(r.horas_no_teto_horario), 0);
    const v = vereditoP010(lim!, 2026, "SE", D.referencia.dia);
    expect(v).toContain(`em ${br((100 * piso) / horas)}% das horas`);
    expect(v).toContain(teto === 0 ? "em nenhuma hora no teto horário" : `no teto horário em ${teto} ${teto === 1 ? "hora" : "horas"}`);
  });

  it("veredito do P009: diferenças da semana de referência relidas do CSV semanal", () => {
    const ref = D.cmo_pld.semana_referencia!;
    const linha = csv("public/energia/series/pld_cmo_semanal.csv").find((r) => r.sm === "SE" && r.semana_fim === ref.fim);
    expect(linha, "semana de referência no CSV semanal").toBeTruthy();
    const decomp = Number(linha!.decomp_media_semanal);
    const dessem = Number(linha!.dessem_media);
    const pld = Number(linha!.pld_media);
    const v = vereditoP009(D.cmo_pld, "SE");
    const dif = (a: number, b: number) => `${reaisBr(Math.abs(a - b))}/MWh ${a - b > 0 ? "acima" : "abaixo"}`;
    expect(v).toContain(`${dif(pld, decomp)} do CMO semanal do DECOMP`);
    expect(v).toContain(`${dif(pld, dessem)} do CMO médio do DESSEM`);
  });

  it("'O que mudou' do Histórico: faixas das médias ponderadas em ago/2026 relidas do CSV mensal", () => {
    const sp = D.historico.ponderacao.sensibilidade_peso!;
    const linhas = csv("public/energia/series/pld_mensal.csv").filter((r) => r.mes === sp.mes);
    expect(linhas).toHaveLength(4);
    // o leitor subtrai os valores exibidos (duas casas): a diferença sai dos valores já arredondados
    const r2 = (v: string) => Math.round(Number(v) * 100) / 100;
    const dif = (a: string, b: string) => linhas.map((r) => Math.round((r2(r[a]) - r2(r[b])) * 100) / 100);
    const faixa = (xs: number[]) => [Math.min(...xs.map(Math.abs)), Math.max(...xs.map(Math.abs))];
    const [a0, a1] = faixa(dif("media_ponderada_carga", "media_temporal"));
    const [b0, b1] = faixa(dif("media_ponderada_carga_sem_mmgd", "media_ponderada_carga"));
    expect(dif("media_ponderada_carga", "media_temporal").every((x) => x > 0)).toBe(true);
    expect(dif("media_ponderada_carga_sem_mmgd", "media_ponderada_carga").every((x) => x > 0)).toBe(true);
    const t = textoSensibilidadePeso(sp);
    expect(t).toContain(`de ${reaisBr(a0)} a ${reaisBr(a1)}/MWh acima da média temporal`);
    expect(t).toContain(`de ${reaisBr(b0)} a ${reaisBr(b1)}/MWh abaixo da ponderada pela carga sem MMGD`);
    expect(t).not.toContain("a distância entre ela e a média temporal");
    expect(html.historico).toContain(esc(t));
  });

  it("(2) cartões de ago/2026 e resposta de set/2026: a página diz por que o mês muda e quantas horas de carga faltam", () => {
    const set = csv("public/energia/series/pld_mensal.csv").find((r) => r.mes === "2026-09" && r.sm === "SE")!;
    const t = textoEntender(html.historico);
    expect(Number(set.horas_com_carga)).toBeLessThan(Number(set.horas));
    expect(t).toContain("Os três cartões de média mensal usam ago/2026");
    expect(t).toContain(`a carga do balanço tem ${br(Number(set.horas_com_carga), 0)} das ${br(Number(set.horas), 0)} horas do mês`);
  });
});

describe("mapas de calor: sem número nas células, o maior e o menor valor vão escritos junto do mapa", () => {
  it("a matriz de separação diz o par de maior e o de menor fração, lidos do CSV diário de separação", () => {
    const linhas = csv("public/energia/series/pld_separacao_diaria.csv").filter((r) => r.data >= "2025-10-01");
    const porPar = new Map<string, { h: number; s: number }>();
    for (const r of linhas) {
      const x = porPar.get(r.par) ?? { h: 0, s: 0 };
      x.h += Number(r.horas);
      x.s += Number(r.horas_separadas);
      porPar.set(r.par, x);
    }
    const frac = [...porPar.entries()].map(([par, x]) => ({ par, f: (100 * x.s) / x.h }));
    const maior = frac.reduce((a, b) => (b.f > a.f ? b : a));
    const menor = frac.reduce((a, b) => (b.f < a.f ? b : a));
    const t = textoEntender(html.regionais);
    expect(t).toContain(`${br(maior.f, 1)}% das horas`);
    expect(t).toContain(`${br(menor.f, 1)}% das horas`);
    expect(t).toMatch(/Maior valor: .+, \d+,\d% das horas\. Menor valor: .+, \d+,\d% das horas\./);
  });
});

describe("arquivos e regras do trabalho", () => {
  const arquivos = [
    "src/lib/energia/pld.ts",
    "src/lib/energia/previsoes.ts",
    "src/app/setor-eletrico/pld/page.tsx",
    "src/app/setor-eletrico/pld/cmo-e-formacao/page.tsx",
    "src/app/setor-eletrico/pld/limites/page.tsx",
    "src/app/setor-eletrico/pld/historico/page.tsx",
    "src/app/setor-eletrico/pld/diferencas-regionais/page.tsx",
    "src/app/setor-eletrico/pld/modelos/page.tsx",
    "src/app/setor-eletrico/pld/modelos/[modelo]/page.tsx",
    "src/app/setor-eletrico/pld/previsoes/page.tsx",
    ...readdirSync(join(raiz, "src/components/energia"))
      .filter((f) => /^(Pld|Previsoes)/.test(f) || f === "CartoesPld.tsx")
      .map((f) => `src/components/energia/${f}`),
  ];

  it("sem travessão nem meia-risca no código desta área", () => {
    for (const f of arquivos) expect(ler(f), f).not.toMatch(/–|—/);
  });

  it("o texto de Entender das páginas desta área não tem hoje, data ISO solta, undefined nem NaN", () => {
    for (const [k, h] of Object.entries(html)) {
      const t = textoEntender(h);
      expect(t, k).not.toMatch(/\bhoje\b/i);
      expect(t, k).not.toMatch(/\bundefined\b|\bNaN\b/);
    }
  });

  it("o HTML de cada página continua abaixo do orçamento de 600 kB", () => {
    for (const [k, h] of Object.entries(html)) expect(h.length, k).toBeLessThan(560_000);
  });
});
