/* Trabalho de conteúdo da r8, área M2 (página inicial, Visão geral e Aprenda): respostas em duas camadas na Visão geral,
 * identificadores técnicos fora de Entender, pontes entre números que parecem divergir e frases de leitura dos exemplos
 * dos verbetes. Cada ponte é conferida contra outro artefato publicado (CSV ou JSON), lido aqui por conta própria, sem
 * repetir a fórmula do código. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "@/app/setor-eletrico/page";
import VisaoGeral from "@/app/setor-eletrico/visao-geral/page";
import ConceitoPage from "@/app/setor-eletrico/aprenda/[conceito]/page";
import AprendaPage from "@/app/setor-eletrico/aprenda/page";
import TrilhasPage from "@/app/setor-eletrico/aprenda/trilhas/page";
import TrilhaPage from "@/app/setor-eletrico/aprenda/trilhas/[trilha]/page";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { contrastesDe } from "@/lib/energia/conteudo/complementos";
import { exemploComEvidencia } from "@/lib/energia/conteudo/evidencias-verbetes";
import { TRILHAS_APRENDA } from "@/lib/energia/conteudo/trilhas";
import { vigenciaMaisRecente } from "@/lib/energia/home";
import type { SinteseVisaoGold } from "@/lib/energia/tipos-visao";
import {
  avisoSemBastidor,
  conjuntosLegiveis,
  notaCarga,
  notaCmoNorte,
  notaRede,
  notaTarifaSocial,
  respostaDeterminantes,
  respostaObservar,
  respostaSistema,
  respostaSociedade,
  textoAtualidadeFrase,
  textoComplemento,
  textoLinhaEstado,
  vereditoDeterminantes,
  vereditoObservar,
  vereditoSistema,
  vereditoSociedade,
} from "@/lib/energia/visao";
import { contextoVisao } from "@/lib/energia/visao-servidor";

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const json = <T,>(p: string) => JSON.parse(ler(p)) as T;
/** O contexto que a página lê dos módulos de origem (DEC apurado, denominador das perdas, cobertura da tarifa): o veredito e a resposta da sociedade o incluem. */
const CTX = contextoVisao(json<SinteseVisaoGold>("public/energia/gold/sintese.json"));
const palavras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const numeros = (t: string) => (t.match(/\d[\d.,]*\d|\d/g) ?? []).length;
const G = json<SinteseVisaoGold>("public/energia/gold/sintese.json");
const clone = <T,>(x: T): T => structuredClone(x);

/** Linhas de um CSV publicado (separador ;) como objetos. */
function csv(p: string): Record<string, string>[] {
  const [cab, ...linhas] = ler(p).trim().split("\n");
  const cols = cab.split(";");
  return linhas.map((l) => Object.fromEntries(l.split(";").map((v, i) => [cols[i], v])));
}

/* ---------- o que o leitor lê em Entender ---------- */

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr", "path", "circle", "line", "rect", "polyline", "polygon", "stop"]);

/** Remove do HTML as subárvores que o leitor de Entender não vê: blocos de Analisar e Auditar, <details> fechados e a linha Fonte da ficha. */
function entender(h: string): string {
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(\/?)>/g;
  let out = "";
  let pulando = 0;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(h))) {
    const [tag, fecha, nome, attrs, auto] = m;
    if (!pulando) out += h.slice(ultimo, m.index);
    ultimo = m.index + tag.length;
    const t = nome.toLowerCase();
    const vazio = VOID.has(t) || auto === "/";
    if (fecha) {
      if (pulando) pulando--;
      else out += tag;
      continue;
    }
    if (pulando) {
      if (!vazio) pulando++;
      continue;
    }
    if (!vazio && (/data-nivel="(analisar|auditar)"/.test(attrs) || t === "details" || /data-fonte="true"/.test(attrs))) {
      pulando = 1;
      continue;
    }
    out += tag;
  }
  if (!pulando) out += h.slice(ultimo);
  return out;
}
const texto = (h: string) =>
  h
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
/** Sem o título do documento da fonte (link externo) e sem o trecho literal, que são da fonte e não do texto do observatório. */
const semFonte = (h: string) => h.replace(/<blockquote[\s\S]*?<\/blockquote>/g, "").replace(/<a [^>]*target="_blank"[^>]*>[\s\S]*?<\/a>/g, "");
const pagina = {
  home: () => renderToStaticMarkup(createElement(Home as never)),
  visao: () => renderToStaticMarkup(createElement(VisaoGeral as never)),
  aprenda: () => renderToStaticMarkup(createElement(AprendaPage as never)),
  trilhas: () => renderToStaticMarkup(createElement(TrilhasPage as never)),
  trilha: (id: string) => renderToStaticMarkup(createElement(TrilhaPage as never, { params: { trilha: id } })),
  verbete: (slug: string) => renderToStaticMarkup(createElement(ConceitoPage as never, { params: { conceito: slug } })),
};
const VERBETES = ["acl", "cde", "dessem", "ear", "gsf", "percentual-regulatorio-de-perdas", "pld", "tarifa-te-tusd"];

/** Nome de campo, código de conjunto, nome de arquivo, código de pergunta, HTTP e bastidor de coleta. */
const IDENTIFICADOR = /\bP0\d\d\b|\b[a-z]+(?:_[a-z0-9]+)+\b|\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b|\b[\w-]+\.(?:json|csv|parquet)\b|\bsha256\b|\bHTTP\b|\b403\b|\bNumCon\b|\bsilver\b|\bpipeline\b|\bvintage\b|\bgold\b|\bbronze\b/;

/* ---------- Visão geral: respostas em duas camadas ---------- */

describe("Visão geral: veredito à vista e resposta completa por trás", () => {
  const vereditos: Record<string, string> = {
    sistema: vereditoSistema(G),
    determinantes: vereditoDeterminantes(G.multiplos!),
    sociedade: vereditoSociedade(G.sociedade, CTX.sociedade),
    observar: vereditoObservar(G.observar),
  };
  const completas: Record<string, string> = {
    sistema: respostaSistema(G),
    determinantes: respostaDeterminantes(G.multiplos!).join(" "),
    sociedade: respostaSociedade(G.sociedade, CTX.sociedade),
    observar: respostaObservar(G.observar),
  };

  it("cada veredito tem no máximo 40 palavras (o roteiro) e 8 números, e é mais curto que a resposta completa", () => {
    for (const [id, v] of Object.entries(vereditos)) {
      expect(v.length, id).toBeGreaterThan(0);
      expect(palavras(v), id).toBeLessThanOrEqual(40);
      expect(numeros(v), id).toBeLessThanOrEqual(8);
      expect(palavras(v), id).toBeLessThan(palavras(completas[id]));
    }
  });

  it("os vereditos não usam hífen de separador, 'hoje', identificador técnico nem sigla fora da lista", () => {
    for (const [id, v] of Object.entries(vereditos)) {
      expect(v, id).not.toMatch(/[\u2013\u2014]|undefined|NaN/);
      expect(v, id).not.toMatch(/\bhoje\b/i);
      expect(v, id).not.toMatch(IDENTIFICADOR);
      expect(v, id).not.toMatch(/\bP0\d\d\b/);
    }
    // siglas que o veredito usa: só as que a legenda sabe expandir
    const siglas = readFileSync(join(raiz, "src/lib/energia/siglas.ts"), "utf-8");
    for (const v of Object.values(vereditos)) for (const s of v.match(/\b[A-ZÀ-Þ]{2,}\b/g) ?? []) expect(siglas, s).toMatch(new RegExp(`\\b${s}:`));
  });

  it("o veredito lê os mesmos campos da resposta completa: mudar o estado das regras muda o texto", () => {
    const g = clone(G);
    expect(vereditoSistema(g)).toContain("Nenhuma regra sobre o sistema está em alerta");
    const sistema = g.observar.find((o) => o.assunto === "sistema" && o.tipo === "regra")!;
    sistema.ativo = true;
    sistema.estado = "ativo";
    expect(vereditoSistema(g)).toContain(`Uma regra sobre o sistema está em alerta: ${sistema.titulo.charAt(0).toLowerCase()}${sistema.titulo.slice(1)}`);
    expect(vereditoObservar(g.observar)).toContain("Uma regra sobre o sistema está em alerta");
    g.observar.forEach((o) => {
      o.ativo = false;
      o.estado = o.tipo === "evento" ? "evento" : "normal";
    });
    expect(vereditoObservar(g.observar)).toBe("Nenhuma regra sobre o sistema está em alerta.");
    expect(vereditoSistema(g)).not.toContain("Sobre os próprios dados");
  });

  it("o veredito dos determinantes cita a comparação da carga com o ano anterior e diz que a rede não é comparada com limites", () => {
    const v = vereditos.determinantes;
    const carga = G.multiplos!.paineis.find((p) => p.id === "carga")!;
    const hoje = carga.valor_atual.valor!;
    const ano = G.multiplos!.dados.find((l) => l.d === carga.data_referencia)!.carga_ano_anterior as number;
    const pct = (100 * (hoje / ano - 1)).toFixed(1).replace(".", ",");
    expect(v).toContain(`${pct}% ${hoje > ano ? "acima" : "abaixo"} do mesmo dia da semana do ano anterior`);
    expect(v).toContain("sem comparação com limites de intercâmbio");
  });

  it("o veredito da sociedade traz a tarifa e o tempo sem energia como a gold os exibe, e diz que nenhum descreve o dia", () => {
    const v = vereditos.sociedade;
    const tarifa = G.sociedade.itens.find((i) => i.id === "tarifa")!;
    const dec = G.sociedade.itens.find((i) => i.id === "continuidade")!;
    expect(v).toContain(tarifa.valor_exibido);
    expect(v).toContain(dec.valor_exibido);
    expect(v).toContain("Nenhum número descreve o dia.");
    expect(v).not.toContain("(9 h 20 min)");
  });

  const html = pagina.visao();
  it("o HTML traz o veredito fora de Analisar e a resposta completa dentro, nos quatro painéis", () => {
    for (const id of Object.keys(vereditos)) {
      const i = html.indexOf(`data-resposta="${id}"`);
      expect(i, id).toBeGreaterThan(0);
      const fim = html.indexOf("Os números por trás da resposta", i);
      expect(fim, id).toBeGreaterThan(i);
      expect(texto(html.slice(i, fim))).toContain(vereditos[id].slice(0, 40));
      // a resposta completa continua no HTML do servidor, dentro do bloco de Analisar
      const analisar = html.indexOf('data-nivel="analisar"', i);
      expect(analisar, id).toBeGreaterThan(i);
      expect(analisar, id).toBeLessThan(fim);
      expect(texto(html.slice(analisar, analisar + 40_000)), id).toContain(completas[id]);
    }
    expect(texto(html)).toContain(respostaSistema(G));
    expect(texto(html)).toContain(respostaObservar(G.observar));
    expect(texto(html)).toContain(respostaSociedade(G.sociedade, CTX.sociedade));
    for (const t of respostaDeterminantes(G.multiplos!)) expect(texto(html)).toContain(t);
  });

  it("Entender não mostra P004 a P007, código de regra, NumCon, identificador de conjunto nem a versão do código", () => {
    const e = texto(entender(html));
    expect(e).not.toMatch(/\bP00[4-7]\b/);
    expect(e).not.toMatch(/\b(ear_faixa|ena_faixa|carga_extrema|pld_piso|pld_teto|restricao_eolica|restricao_solar|revisao_material)\b/i);
    expect(e).not.toMatch(/\bEAR_FAIXA|ENA_FAIXA|CARGA_EXTREMA|PLD_PISO|PLD_TETO|RESTRICAO_EOLICA|RESTRICAO_SOLAR|REVISAO_MATERIAL/);
    expect(e).not.toMatch(IDENTIFICADOR);
    expect(e).not.toMatch(/silver principal|sintese\.json|energia-0\.1\.0|685bb4bc29fd|aneel_scs|\bhoje\b/);
    // em Analisar o código volta
    expect(texto(html)).toContain("código ear_faixa");
    expect(html).toMatch(/data-nivel="analisar"[^>]*>\s*P004/);
    expect(html).toContain("685bb4bc29fd");
  });

  it("o botão de prova anuncia o nome do número, e não o identificador da gold", () => {
    const botoes = Array.from(html.matchAll(/<button[^>]*data-comprove[^>]*>[\s\S]*?<\/button>/g)).map((m) => texto(m[0]));
    expect(botoes.length).toBeGreaterThan(20);
    for (const b of botoes) {
      expect(b).not.toMatch(/Visão geral, (frase|determinante)|Regra '|_/);
    }
    expect(botoes.some((b) => /Reservatórios, 61,6% da energia armazenável máxima/.test(b))).toBe(true);
  });

  it("o rodapé fica dentro do seletor de profundidade, para a base e a versão do código só aparecerem em Analisar", () => {
    const i = html.indexOf("Síntese publicada em");
    expect(i).toBeGreaterThan(html.indexOf('class="modo-profundidade"'));
    expect(html.indexOf("</footer>")).toBeLessThan(html.lastIndexOf("</main>"));
    const dentro = html.slice(html.indexOf('class="modo-profundidade"'), html.indexOf("</main>"));
    expect(dentro).toContain("<footer");
  });

  it("corrige o texto de abertura e a cadência: 'de ... a ...', 'diária' e '1 dia normal'", () => {
    const e = texto(html);
    expect(e).not.toMatch(/até \d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4}/);
    expect(e).not.toContain("cadência diaria");
    expect(e).toContain("cadência diária");
    expect(e).not.toMatch(/\b1 dia normais\b/);
    const f = G.frases[0];
    expect(textoAtualidadeFrase(f)).toMatch(/cadência diária/);
    const o = G.observar.find((x) => x.linha_estado?.estados && /\./.test(x.linha_estado.estados))!;
    const um = clone(o);
    um.linha_estado!.estados = ".";
    expect(textoLinhaEstado(um)).toContain("1 dia normal.");
  });
});

/* ---------- conciliações da Visão geral ---------- */

describe("Visão geral: carga em duas janelas (10,5% e 14,6%), classificação 2", () => {
  const serie = csv("public/energia/series/carga_diaria.csv");
  const sin = new Map(serie.map((l) => [l.data, Number(l.SIN_calculado)]));
  const dia = (iso: string, d: number) => new Date(Date.parse(iso) + d * 86_400_000).toISOString().slice(0, 10);
  const media = (ini: string, n: number) => Array.from({ length: n }, (_, i) => sin.get(dia(ini, i))!).reduce((a, b) => a + b, 0) / n;

  it("relendo a série diária publicada: 7 dias contra as mesmas datas dá 10,5%; o dia contra o mesmo dia da semana dá 14,6%", () => {
    const fim = G.multiplos!.datas_referencia.carga!;
    const sete = (100 * (media(dia(fim, -6), 7) / media(dia(fim, -6 - 365), 7) - 1)).toFixed(1).replace(".", ",");
    const um = (100 * (sin.get(fim)! / sin.get(dia(fim, -364))! - 1)).toFixed(1).replace(".", ",");
    expect(sete).toBe("10,5");
    expect(um).toBe("14,6");
    const nota = notaCarga(G)!;
    expect(nota).toContain(`${sete}%`);
    expect(nota).toContain(`${um}%`);
    expect(nota).toContain("não precisam coincidir");
    // as datas da nota são as das janelas reais
    expect(nota).toContain(`${dia(fim, -6).split("-").reverse().join("/")} a ${fim.split("-").reverse().join("/")}`);
    expect(nota).toContain(`(${dia(fim, -364).split("-").reverse().join("/")})`);
  });

  it("a nota aparece ao lado da frase de carga e no cartão de carga dos determinantes", () => {
    const h = pagina.visao();
    expect(h).toContain('data-nota-frase="carga"');
    expect(h).toContain('data-nota-determinante="carga"');
    expect(texto(entender(h))).toContain("A carga aparece contra o ano anterior de duas formas");
  });
});

describe("Visão geral: rede, média de 30 dias e fluxo do dia (4.842 e 5.184 MWmed), classificação 2", () => {
  it("relendo rede.json: a fronteira NE_SE tem média de 30 dias de 4.842 e fluxo do dia de 5.184", () => {
    const r = json<{ dia_referencia: string; fronteiras: { par: string; fluxo_dia: number; fluxo_media_30d: number }[] }>("public/energia/gold/rede.json");
    const f = r.fronteiras.find((x) => x.par === "NE_SE")!;
    const nota = notaRede(G)!;
    expect(nota).toContain(f.fluxo_media_30d.toLocaleString("pt-BR"));
    expect(nota).toContain(f.fluxo_dia.toLocaleString("pt-BR"));
    expect(nota).toContain(r.dia_referencia.split("-").reverse().join("/"));
    expect(nota).toContain("Média de 30 dias e valor de um dia não precisam coincidir");
    expect(pagina.visao()).toContain('data-nota-frase="rede"');
  });

  it("sem a mesma fronteira nas duas leituras, a nota não é escrita", () => {
    const g = clone(G);
    g.multiplos!.paineis.find((p) => p.id === "rede")!.valor_atual.caminho = "rede.json#fronteiras[N_NE].fluxo_dia";
    expect(notaRede(g)).toBeNull();
  });
});

describe("Visão geral: Tarifa Social em mai/2025 e jun/2025, classificação 2", () => {
  const inc = json<{ tarifa_social: { serie_mensal: { m: string; completo: boolean; distribuidoras_faltantes: number }[] } }>("public/energia/gold/inclusao.json");
  const pub = json<{ conjuntos: { id: string; atualidade: { ultimo_periodo: string; situacao: string } }[] }>("public/energia/gold/publicacao.json");

  it("relendo o módulo de Inclusão e a saúde dos dados: o último mês do arquivo é jun/2025 e está incompleto; o último completo é mai/2025", () => {
    const scs = pub.conjuntos.find((c) => c.id.endsWith("/aneel_scs"))!;
    expect(scs.atualidade.ultimo_periodo).toBe("2025-06");
    const serie = inc.tarifa_social.serie_mensal;
    const ultimo = serie[serie.length - 1];
    expect(ultimo.m).toBe("2025-06");
    expect(ultimo.completo).toBe(false);
    const completos = serie.filter((x) => x.completo);
    expect(completos[completos.length - 1].m).toBe("2025-05");
    const item = G.sociedade.itens.find((i) => i.id === "beneficios")!;
    const nota = notaTarifaSocial(item, inc.tarifa_social.serie_mensal)!;
    expect(nota).toContain("mai/2025");
    expect(nota).toContain("jun/2025");
    expect(nota).toContain(`${ultimo.distribuidoras_faltantes} distribuidoras esperadas não informaram`);
  });

  it("a ponte aparece no cartão e na regra de fonte atrasada", () => {
    const h = pagina.visao();
    expect(h).toContain('data-nota-sociedade="beneficios"');
    expect(h).toContain('data-nota-regra="atualidade_fontes"');
  });

  it("sem divergência entre os meses, nenhuma nota", () => {
    const item = clone(G.sociedade.itens.find((i) => i.id === "beneficios")!);
    item.atualidade!.ultimo_periodo = item.periodo.fim;
    expect(notaTarifaSocial(item, [])).toBeNull();
  });
});

describe("Visão geral: CMO do Norte (R$ 461,46 contra R$ 42,43), classificação 2", () => {
  it("relendo o CSV semanal do ONS: o Norte difere de cada um dos outros três nesta semana, em 23 semanas seguidas, e a nota diz que o motivo não está no dado", () => {
    const l = csv("public/energia/series/cmo_semanal.csv").map((x) => ({ s: x.semana_operativa, SE: +x.SE_semanal, S: +x.S_semanal, NE: +x.NE_semanal, N: +x.N_semanal }));
    const ult = l[l.length - 1];
    expect(ult).toMatchObject({ SE: 42.43, S: 42.43, NE: 42.43, N: 461.46 });
    let n = 0;
    for (let i = l.length - 1; i >= 0 && [l[i].SE, l[i].S, l[i].NE].every((v) => Math.abs(l[i].N - v) > 0.005); i--) n++;
    expect(n).toBeGreaterThan(10);
    const nota = notaCmoNorte(l, ult.s)!;
    expect(nota).toContain("R$ 461,46/MWh");
    expect(nota).toContain("R$ 42,43/MWh");
    expect(nota).toContain(`${n} semanas seguidas`);
    expect(nota).toContain("não informa o motivo");
    expect(nota).not.toMatch(/porque|devido|causa(do)? por/i);
    expect(pagina.visao()).toContain('data-nota-regra="cmo_semana"');
  });

  it("semana sem diferença do Norte, nenhuma nota", () => {
    expect(notaCmoNorte([{ s: "2026-01-02", SE: 10, S: 10, NE: 10, N: 10 }], "2026-01-02")).toBeNull();
  });
});

describe("Visão geral: bastidor e unidades dos cartões", () => {
  it("a exclusão de mar/2026 sai de NumCon para palavras comuns e o detalhe fica em Analisar", () => {
    const aviso = G.sociedade.itens.flatMap((i) => i.complementos).find((c) => c.aviso && /NumCon/.test(c.aviso))!.aviso!;
    const { leitor, detalhe } = avisoSemBastidor(aviso);
    expect(leitor).not.toContain("NumCon");
    expect(leitor).toContain("o número de unidades consumidoras informado por CELESC não é plausível");
    expect(detalhe).toContain("NumCon implausível de CELESC");
    expect(avisoSemBastidor("sem parênteses")).toEqual({ leitor: "sem parênteses", detalhe: "" });
    const h = pagina.visao();
    expect(texto(entender(h))).not.toContain("NumCon");
    expect(texto(h)).toContain("Detalhe da exclusão: UCs com DEC em 96,4%");
  });

  it("o cartão da tarifa usa R$/kWh também na faixa entre distribuidoras, e o percentual fica colado ao número", () => {
    const tarifa = G.sociedade.itens.find((i) => i.id === "tarifa")!;
    const [p25, p75] = tarifa.complementos[0].valor as number[];
    const t = textoComplemento(tarifa.complementos[0]);
    expect(t).toBe(`R$ ${(p25 / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 4 })}/kWh a R$ ${(p75 / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 4 })}/kWh`);
    expect(textoComplemento(tarifa.complementos[1])).toMatch(/^R\$ 164,24 por mês$/);
    const perdas = G.sociedade.itens.find((i) => i.id === "perdas")!;
    expect(textoComplemento(perdas.complementos[0])).toMatch(/\d%/);
    expect(textoComplemento(perdas.complementos[0])).not.toMatch(/\d %/);
    expect(texto(pagina.visao())).not.toMatch(/759,75|903,29/);
  });

  it("o identificador do conjunto atrasado sai do texto do leitor pelo título do painel de saúde dos dados", () => {
    const pub = json<{ conjuntos: { id: string; titulo: string }[] }>("public/energia/gold/publicacao.json");
    const titulos = Object.fromEntries(pub.conjuntos.map((c) => [c.id.split("/").pop()!, c.titulo]));
    const r = conjuntosLegiveis("aneel_scs: último período jun/2025.", titulos);
    expect(r.ids).toEqual(["aneel_scs"]);
    expect(r.texto).toContain("SCS: Sistema de Controle de Subvenções e Programas Sociais");
    expect(conjuntosLegiveis("sem_titulo_conhecido segue", titulos).texto).toBe("sem_titulo_conhecido segue");
  });
});

/* ---------- página inicial ---------- */

describe("Página inicial: contagens de distribuidoras (123, 102, 51 e 49), classificação 2", () => {
  const emp = json<{ distribuidoras: { indice: { cnpj: string; sigla: string; ativa: boolean; perdas: { ano: number | null } | null; qualidade: { ano: number | null } | null }[]; resumo: Record<string, number> } }>("public/energia/gold/empresas.json");
  const perdas = json<{
    referencia: { ano: number };
    nacional: { ano: number; universo: string; n_distribuidoras: number }[];
    distribuidoras: { grupo: string; referencia: { ano: number } | null; tecnica_regulatoria: { segmentos: { pct: number; inicio: string }[] } | null }[];
  }>("public/energia/gold/perdas.json");

  it("123 é o índice inteiro (inclui as extintas); com dado de 2025 são 103; a qualidade tem 102; o total nacional usa 51 concessionárias; 49 têm o percentual regulatório inferido", () => {
    const idx = emp.distribuidoras.indice;
    expect(idx.length).toBe(123);
    expect(idx.filter((d) => d.perdas?.ano === perdas.referencia.ano).length).toBe(103);
    expect(idx.filter((d) => d.qualidade?.ano != null).length).toBe(102);
    expect(idx.filter((d) => !d.ativa).length).toBe(20);
    const nac = perdas.nacional.find((x) => x.ano === perdas.referencia.ano && x.universo === "concessionarias")!;
    expect(nac.n_distribuidoras).toBe(51);
    expect(perdas.distribuidoras.filter((d) => d.referencia?.ano === perdas.referencia.ano && d.grupo === "permissionaria").length).toBe(52);
    expect(perdas.distribuidoras.filter((d) => d.tecnica_regulatoria?.segmentos.length).length).toBe(49);
  });

  const h = pagina.home();
  it("os seletores listam só quem tem dado no ano e dizem quantas são; as extintas e as siglas repetidas saem", () => {
    const t = texto(h);
    // a contagem e o ano seguem à vista, agora no rótulo do seletor (a opção padrão ficou curta para caber em 390 px)
    expect(t).toContain("Sua distribuidora (103 com dado de 2025)");
    expect(t).toContain("Sua distribuidora (102 com dado de 2025)");
    expect(t).not.toContain("com dados)");
    // CELESC, RGE e CPFL Santa Cruz aparecem uma vez em cada seletor
    for (const s of ["CELESC (", "RGE (", "CPFL Santa Cruz ("]) {
      const blocos = h.split('<option value="">').slice(1).map((b) => b.slice(0, b.indexOf("</select>")));
      for (const b of blocos) expect((b.match(new RegExp(s.replace("(", "\\("), "g")) ?? []).length, s).toBeLessThanOrEqual(1);
    }
    expect(texto(h)).not.toMatch(/DISTRIBUICAO/);
  });

  it("o exemplo real explica o 51: 103 têm dado de 2025, o total soma as 51 concessionárias e as 52 permissionárias ficam fora", () => {
    const t = texto(h);
    expect(t).toContain("Ao todo, 103 distribuidoras têm dado de 2025; este total soma só as 51 concessionárias, e as 52 permissionárias ficam fora dele.");
  });

  it("a frase do exemplo real não tem parênteses dentro de parênteses nem 'brasil' em minúscula", () => {
    const t = texto(h);
    expect(t).toContain("é a taxa de perdas totais das concessionárias de distribuição do Brasil, de jan/2025 a dez/2025:");
    expect(t).not.toMatch(/\(concessionárias de distribuição \(brasil\)\)/i);
    expect(t).not.toMatch(/\([^()]*\([^()]*\)[^()]*\)/);
    expect(t).toContain("código de verificação (sha256, que prova que é o mesmo arquivo)");
  });

  it("o nome por extenso acompanha a sigla nos chips do mapa conceitual", () => {
    const t = texto(h);
    expect(t).toContain("(Energia Armazenada)");
    expect(t).toContain("(Energia Natural Afluente)");
    expect(t).toContain("(Custo Marginal de Operação)");
    expect(t).toContain("(Preço de Liquidação das Diferenças)");
    expect(t).toContain("a Energia Armazenada (EAR) e a Energia Natural Afluente (ENA)");
  });

  it("a tabela de atualidade explica 'sem calendário declarado' e as tarifas por vigência", () => {
    const t = texto(h);
    expect(t).toContain("Sem calendário declarado: a fonte não informa de quanto em quanto tempo atualiza");
    const pub = json<{ conjuntos: { id: string; dado: { formato: string; ref_max: string } }[] }>("public/energia/gold/publicacao.json");
    const tarifas = pub.conjuntos.find((c) => c.id.endsWith("/aneel_tarifas_aplicacao"))!;
    const inicio = tarifas.dado.ref_max.split("|")[0].split("-").reverse().join("/");
    expect(t).toContain(`vigência iniciada em ${inicio}`);
    expect(t).not.toContain("sem período nesta publicação · atualização semanal");
    expect(vigenciaMaisRecente({ formato: "vigencia", ref_max: "2026-09-22|2027-09-21|REH 1" })).toBe("vigência iniciada em 22/09/2026");
    expect(vigenciaMaisRecente({ formato: "mensal", ref_max: "2026-08" })).toBeNull();
  });
});

/* ---------- verbetes ---------- */

describe("Verbetes: bastidor fora de Entender e frase de leitura em todo exemplo real", () => {
  it("GSF: a limitação diz em palavras comuns que a norma não foi lida e por quê; o 403 fica no detalhe recolhido", () => {
    const h = pagina.verbete("gsf");
    const e = texto(entender(h));
    expect(e).toContain("o repositório de normas da ANEEL recusa as consultas automáticas do observatório");
    expect(e).not.toMatch(/\b403\b|não foi contornado/);
    expect(texto(h)).toContain("responde 403 a requisições automatizadas");
    expect(h.indexOf("Detalhe da conferência")).toBeGreaterThan(h.indexOf("O que não se pode concluir"));
  });

  it("PLD: 'que este verbete não lê' sai; o código do conjunto fica no detalhe técnico recolhido", () => {
    const h = pagina.verbete("pld");
    const e = texto(semFonte(entender(h)));
    expect(e).not.toContain("que este verbete não lê");
    expect(e).toContain("que o observatório não consultou");
    expect(e).not.toContain("PLD_HORARIO");
    expect(texto(h)).toContain("no conjunto PLD_HORARIO");
  });

  it("nenhum dos oito verbetes mostra em Entender código de conjunto (fora da linha Fonte da ficha), HTTP, 403 ou arquivo", () => {
    for (const s of VERBETES) {
      const e = texto(semFonte(entender(pagina.verbete(s))));
      expect(e, s).not.toMatch(/\bHTTP\b|\b403\b|\bsha256\b|\b[\w-]+\.(json|csv|parquet)\b|\bNumCon\b/);
      expect(e, s).not.toMatch(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/);
      expect(e, s).not.toMatch(/[\u2013\u2014]|\bhoje\b|undefined|NaN/);
    }
  });

  it("todo exemplo real dos oito verbetes tem frase de leitura derivada do mesmo dado", () => {
    for (const s of VERBETES) {
      const ex = exemploComEvidencia(s);
      if (s === "percentual-regulatorio-de-perdas") continue; // exemplo em texto, com mediana e universo na própria frase
      expect(ex, s).not.toBeNull();
      expect(ex!.complemento, s).toBeTruthy();
      expect(ex!.complemento!.length, s).toBeGreaterThan(60);
    }
  });

  it("sigla e nome do título têm separador visível (antes: espaço duplo) e 'DECOMP (DECOMP)' sai do rótulo", () => {
    for (const s of VERBETES) {
      const h = pagina.verbete(s);
      const h1 = /<h1[^>]*>(.*?)<\/h1>/.exec(h)![1].replace(/<[^>]+>/g, "");
      expect(h1, s).not.toMatch(/\s{2,}/);
      const c = conceito(s)!;
      if (c.sigla && c.sigla.toLowerCase() !== c.nome.toLowerCase()) expect(h1, s).toMatch(/^[^:]+: /);
    }
    expect(contrastesDe("dessem").map((c) => c.rotulo)).toContain("DECOMP");
    expect(contrastesDe("dessem").map((c) => c.rotulo)).not.toContain("DECOMP (DECOMP)");
    expect(texto(pagina.verbete("dessem"))).not.toContain("DECOMP (DECOMP)");
  });

  it("as relações e os caminhos de trilha trazem o nome onde o verbete o tem", () => {
    const acl = texto(pagina.verbete("acl"));
    expect(acl).toContain("ACR Ambiente de Contratação Regulada");
    expect(acl).toContain("PLD Preço de Liquidação das Diferenças");
    const ear = texto(pagina.verbete("ear"));
    expect(ear).toContain("ENA Energia Natural Afluente");
    const idx = texto(pagina.trilhas());
    expect(idx).toContain("1. ENA, Energia Natural Afluente");
    expect(idx).toContain("4. TSEE, Tarifa Social de Energia Elétrica");
    expect(idx).toContain("6. MCP, Mercado de Curto Prazo");
  });

  it("a mesma fonte citada em mais de um trecho aparece uma vez, com os trechos embaixo", () => {
    const cde = pagina.verbete("cde");
    const titulos = cde.match(/Gestão de Recursos Tarifários/g) ?? [];
    expect(titulos.length).toBe(1);
    expect((cde.match(/Trecho literal do documento/g) ?? []).length).toBe(2);
    const perdas = pagina.verbete("percentual-regulatorio-de-perdas");
    expect((perdas.match(/Página &quot;Perdas de Energia&quot;/g) ?? []).length).toBe(1);
    expect((perdas.match(/Trecho literal do documento/g) ?? []).length).toBe(3);
  });

  it("as frases 'Em uma frase' de PLD, GSF e CDE passam a ter duas frases e conservam todas as palavras", () => {
    const antes = {
      pld: "Preço do Mercado de Curto Prazo, ao qual a CCEE valora as exposições dos agentes, isto é, as diferenças entre a energia contratada e a efetivamente verificada; é calculado pela CCEE diariamente para cada hora do dia seguinte e para cada submercado, com base no Custo Marginal de Operação e dentro dos limites mínimo e máximos vigentes.",
      gsf: "Razão, em percentual, entre a geração verificada das usinas do Mecanismo de Realocação de Energia (MRE) no mês e a garantia física dessas usinas (no boletim do MME, a garantia física sazonalizada); abaixo de 100%, as hidrelétricas do mecanismo geraram, juntas, menos que a garantia física.",
      cde: "Fundo setorial que custeia políticas públicas do setor elétrico, como a universalização do serviço e os descontos tarifários a usuários (baixa renda, rural, irrigação e aquicultura, saneamento, fontes incentivadas), arrecadado principalmente por quotas incluídas nas tarifas de uso da rede.",
    };
    const norm = (t: string) => t.toLowerCase().replace(/[.,;()]/g, "").split(/\s+/).filter(Boolean).filter((p) => p !== "é");
    for (const [s, a] of Object.entries(antes)) {
      const d = conceito(s)!.emUmaFrase!;
      expect((d.match(/\. [A-ZÀ-Þ]/g) ?? []).length, s).toBe(1);
      expect(norm(d).join(" "), s).toBe(norm(a).join(" "));
    }
  });
});

describe("Verbetes: números que parecem divergir, relidos de outro artefato", () => {
  it("GSF: 78,9% e 75,9% são o mesmo mês e a mesma geração com duas garantias físicas (classificação 2)", () => {
    const m = json<{ mre_gsf: { mensal: { mes: string; geracao_mre_mwmed: number; gf_modulada_fdisp_mwmed: number; gf_sazonalizada_mwmed: number }[] } }>("public/energia/gold/mercado.json").mre_gsf.mensal;
    const u = m[m.length - 1];
    const a = ((100 * u.geracao_mre_mwmed) / u.gf_modulada_fdisp_mwmed).toFixed(1).replace(".", ",");
    const b = ((100 * u.geracao_mre_mwmed) / u.gf_sazonalizada_mwmed).toFixed(1).replace(".", ",");
    expect([a, b]).toEqual(["78,9", "75,9"]);
    const c = exemploComEvidencia("gsf")!.complemento!;
    expect(c).toContain(`${b}%`);
    expect(c).toContain("São dois resultados do mesmo mês e da mesma geração: só a garantia física do denominador muda.");
  });

  it("EAR: 61,5% em 29/09 contra 61,6% em 28/09 na Visão geral (classificação 2: captura mais recente, que revisou o dia 28/09 para 61,7%)", () => {
    const dias = csv("public/energia/series/agua_subsistemas_diario.csv").filter((l) => l.recorte === "SIN");
    const d28 = dias.find((l) => l.data === "2026-09-28")!;
    const d29 = dias.find((l) => l.data === "2026-09-29")!;
    expect(Number(d29.ear_pct).toFixed(1)).toBe("61.5");
    expect(Number(d28.ear_pct).toFixed(1)).toBe("61.7");
    const hid = json<{ subsistemas: { sm: string; ear: { valor: number; dia: string } }[] }>("public/energia/gold/hidrologia.json").subsistemas.find((s) => s.sm === "SIN")!.ear;
    expect(hid.dia).toBe("2026-09-28");
    expect(hid.valor).toBe(61.6);
    const c = exemploComEvidencia("ear")!.complemento!;
    expect(c).toContain("A Visão geral traz 61,6% em 28/09/2026");
    expect(c).toContain("dá 61,7% para o próprio 28/09");
  });

  it("EAR: a mediana para a data nos anos completos desde 2001 volta ao exemplo, no mesmo escopo (SIN)", () => {
    const sin = json<{ armazenamento: { subsistemas: { sm: string; p50: number; p10: number; p90: number; periodo_base: string; anos_na_base: number }[] } }>("public/energia/gold/agua_detalhe.json").armazenamento.subsistemas.find((s) => s.sm === "SIN")!;
    const c = exemploComEvidencia("ear")!.complemento!;
    const f = (v: number) => v.toFixed(1).replace(".", ",");
    expect(c).toContain(`mediana dos anos completos desde 2001 (2001 a 2025, ${sin.anos_na_base} anos) é ${f(sin.p50)}% da EAR máxima`);
    expect(c).toContain(`${f(sin.p10)}% a ${f(sin.p90)}%`);
    // a mediana do Sudeste/Centro-Oeste (49,35) não entra no lugar da do SIN
    const se = json<{ armazenamento: { subsistemas: { sm: string; p50: number }[] } }>("public/energia/gold/agua_detalhe.json").armazenamento.subsistemas.find((s) => s.sm === "SE")!;
    expect(f(se.p50)).not.toBe(f(sin.p50));
    expect(c).not.toContain(`${f(se.p50)}%`);
  });

  it("CDE: a leitura dá o ano e os reais das quotas e das receitas (conta.json)", () => {
    const ev = json<{ financiamento_cde: { evidencia: { numerador: { valor: number }; denominador: { valor: number }; periodo: { fim: string } } } }>("public/energia/gold/conta.json").financiamento_cde.evidencia;
    const bi = (v: number) => `R$ ${(v / 1e9).toFixed(1).replace(".", ",")} bilhões`;
    const ex = exemploComEvidencia("cde")!;
    expect(ex.leitura).toContain(`de ${ev.periodo.fim} que vem`);
    expect(ex.leitura).not.toContain("no ano que vem");
    expect(ex.complemento).toContain(`as quotas pagas nas tarifas somam ${bi(ev.numerador.valor)}, de ${bi(ev.denominador.valor)} em receitas publicadas`);
  });

  it("TE e TUSD: a leitura traz a faixa do meio e o custo de 200 kWh, relidos de conta_tarifas_b1_vigentes.csv", () => {
    const total = csv("public/energia/series/conta_tarifas_b1_vigentes.csv")
      .map((l) => Number(l.total_rs_mwh))
      .sort((a, b) => a - b);
    const q = (p: number) => {
      const h = (total.length - 1) * p;
      const i = Math.floor(h);
      return total[i] + (h - i) * ((total[Math.min(i + 1, total.length - 1)] ?? total[i]) - total[i]);
    };
    const kwh = (mwh: number) => `R$ ${(mwh / 1000).toFixed(4).replace(".", ",")}`;
    const c = exemploComEvidencia("tarifa-te-tusd")!.complemento!;
    expect(c).toContain(`entre as ${total.length} distribuidoras`);
    expect(c).toContain(`cobra de ${kwh(q(0.25))} a ${kwh(q(0.75))} por kWh`);
    expect(c).toContain(`custa R$ ${((q(0.5) / 1000) * 200).toFixed(2).replace(".", ",")} na tarifa mediana`);
  });

  it("ACL: a leitura repete o percentual como 'de cada 100 MWh' e os 12 meses da ficha", () => {
    const k = json<{ livre_regulado: { kpis: { participacao_acl_ccee_12m: { valor_pct: number; periodo: { inicio: string; fim: string } } } } }>("public/energia/gold/mercado.json").livre_regulado.kpis.participacao_acl_ccee_12m;
    const c = exemploComEvidencia("acl")!.complemento!;
    expect(c).toContain(`${k.valor_pct.toFixed(1).replace(".", ",")} foram consumidos no ACL`);
    expect(c).toContain("set/2025 a ago/2026");
  });

  it("DESSEM e PLD: o CMO médio e o PLD médio da mesma semana aparecem lado a lado, e o piso e o teto vêm da Regulação", () => {
    const ev = json<{ evidencias: Record<string, { valor_exibido: string; valor_calculo: number; periodo: { inicio: string; fim: string } }> }>("public/energia/series/pld_evidencias.json").evidencias;
    const reg = json<{ evidencias: { limites: Record<string, { valor_exibido: string }> } }>("public/energia/gold/regulacao.json").evidencias.limites;
    const pld = ev.pld_semana_SE;
    const dessem = ev.dessem_semana_SE;
    expect(pld.periodo.inicio.slice(0, 10)).toBe(dessem.periodo.inicio.slice(0, 10));
    const cd = exemploComEvidencia("dessem")!.complemento!;
    expect(cd).toContain(`o PLD médio foi ${pld.valor_exibido}, ${pld.valor_calculo > dessem.valor_calculo ? "acima" : "abaixo"} do CMO médio do DESSEM`);
    const cp = exemploComEvidencia("pld")!.complemento!;
    expect(cp).toContain(`o piso do PLD é ${reg.pld_min.valor_exibido} e o teto horário, ${reg.pld_max_horario.valor_exibido}`);
    expect(cp).toContain(`o CMO médio que o DESSEM estima foi ${dessem.valor_exibido}`);
  });

  it("Percentual regulatório: sem '1,000%', com mediana e com o universo (49 de 103), relidos de perdas.json", () => {
    const p = json<{ referencia: { ano: number }; distribuidoras: { grupo: string; referencia: { ano: number } | null; tecnica_regulatoria: { segmentos: { pct: number; inicio: string }[] } | null }[] }>("public/energia/gold/perdas.json");
    const ult = p.distribuidoras
      .filter((d) => d.tecnica_regulatoria?.segmentos.length)
      .map((d) => [...d.tecnica_regulatoria!.segmentos].sort((a, b) => a.inicio.localeCompare(b.inicio)).at(-1)!.pct)
      .sort((a, b) => a - b);
    expect(ult.length).toBe(49);
    const mediana = ult[(ult.length - 1) / 2];
    const h = texto(pagina.verbete("percentual-regulatorio-de-perdas"));
    expect(h).toContain(`com mediana de ${mediana.toFixed(1).replace(".", ",")}%`);
    expect(h).toContain("As 49 são as distribuidoras (de 103 com dado de 2025)");
    expect(h).not.toMatch(/\d,\d{3}%/);
    expect(h).toContain("Procedimentos de Distribuição de Energia Elétrica no Sistema Elétrico Nacional");
    expect(h).toContain("Procedimentos de Regulação Tarifária");
    expect(conceito("percentual-regulatorio-de-perdas")!.limitacoes!.length).toBeGreaterThanOrEqual(3);
  });

  it("DESSEM tem o bloco 'O que não se pode concluir' e o Como é medido deixa de ser tautológico", () => {
    const d = conceito("dessem")!;
    expect(d.limitacoes!.length).toBeGreaterThanOrEqual(2);
    const h = texto(pagina.verbete("dessem"));
    expect(h).toContain("O que não se pode concluir");
    expect(h).not.toContain("Modelo computacional; sua saída publicada pelo ONS é o CMO semi-horário por barra e por subsistema.");
    expect(h).toContain("o CMO do subsistema é a média dos CMOs das barras ponderada pelas cargas");
  });
});

/* ---------- Aprenda ---------- */

describe("Aprenda: índice e trilhas", () => {
  it("o índice explica trilha e exemplo sintético, diz o estado de conferência dos verbetes antes da lista e mostra uma prévia de cada tema", () => {
    const h = pagina.aprenda();
    const t = texto(h);
    expect(t).toContain("Uma trilha é um percurso em ordem pelos verbetes");
    expect(t).toContain("Valores hipotéticos, escolhidos para ensinar.");
    // a ordem da tela "Entenda um conceito": busca, trilhas, depois os verbetes por tema, com a frase de estado logo abaixo do título da lista
    expect(h.indexOf('id="aprenda-trilhas"')).toBeLessThan(h.indexOf('id="aprenda-todos"'));
    expect(h.indexOf('data-estados-do-acervo')).toBeGreaterThan(h.indexOf('id="aprenda-todos"'));
    expect(t).toMatch(/Os \d+ verbetes estão conferidos na fonte primária/);
    expect(h).toContain('data-previa="true"');
    expect(t).toContain("PLD, CMO, Submercado, CVU, Limites do PLD");
  });

  it("a abertura das trilhas dá a resposta curta antes do mecanismo, e as duas trilhas têm resposta curta", () => {
    const t = texto(pagina.trilhas());
    expect(t).toContain("Resposta curta: uma trilha é um percurso em ordem");
    for (const tr of TRILHAS_APRENDA) expect(tr.resumo, tr.id).toMatch(/^Resposta curta: /);
    // a resposta curta da trilha de água deixa de ser uma frase única com cinco siglas
    const agua = TRILHAS_APRENDA[0].resumo;
    expect(agua.split(". ").every((f) => palavras(f) <= 45)).toBe(true);
  });

  it("passo 1 da trilha de custo diz que o número é a perda realizada; passo 4 diz que o mês do número é anterior à regra", () => {
    const h = texto(pagina.trilha("custo-tarifa-orcamento"));
    expect(h).toContain("O número abaixo é a perda realizada nas concessionárias, e não o percentual que a tarifa reconhece.");
    const inc = json<{ tarifa_social: { kpis: { uc_tsee: { mes: string } } } }>("public/energia/gold/inclusao.json");
    expect(inc.tarifa_social.kpis.uc_tsee.mes).toBe("2025-05");
    expect(h).toContain("O mês do número é mai/2025, anterior às faturas emitidas a partir de 5 de julho de 2025");
  });

  it("passo 6 da trilha de água traz o GSF do mês, que o exemplo do MRE não mostrava", () => {
    const h = texto(pagina.trilha("agua-operacao-preco"));
    const gsf = json<{ mre_gsf: { kpis: { gsf_ultimo_mes: { valor_pct: number; mes: string } } } }>("public/energia/gold/mercado.json").mre_gsf.kpis.gsf_ultimo_mes;
    expect(h).toContain(`é o GSF de ago/2026: ${gsf.valor_pct.toFixed(1).replace(".", ",")}%`);
  });

  it("o exemplo sintético diz que o piso e o teto não são os vigentes", () => {
    const h = texto(pagina.trilha("agua-operacao-preco"));
    expect(h).toContain("são hipotéticos e não são os vigentes, que estão no verbete Limites do PLD");
  });

  it("as páginas tocadas não têm travessão, 'hoje', undefined nem NaN no texto", () => {
    const todas = [pagina.home(), pagina.visao(), pagina.aprenda(), pagina.trilhas(), pagina.trilha("agua-operacao-preco"), pagina.trilha("custo-tarifa-orcamento"), ...VERBETES.map(pagina.verbete)];
    for (const h of todas) {
      const t = texto(semFonte(h));
      expect(t).not.toMatch(/[\u2013\u2014]/);
      expect(t).not.toMatch(/\bhoje\b/i);
      expect(t).not.toMatch(/undefined|NaN|\[object Object\]/);
    }
  });
});

describe("RespostaCurta nos painéis da Visão geral: o componente compartilhado segue como estava", () => {
  it("o veredito fica antes do bloco de Analisar e a resposta completa dentro dele", () => {
    const h = renderToStaticMarkup(createElement(RespostaCurta, { id: "sistema", veredito: "V." }, "Completa."));
    expect(h.indexOf("V.")).toBeLessThan(h.indexOf('data-nivel="analisar"'));
    expect(h.indexOf("Completa.")).toBeGreaterThan(h.indexOf('data-nivel="analisar"'));
  });
});
