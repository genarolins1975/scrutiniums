/* Trabalho de conteúdo r8, área T1 (Território, Perdas, Conta de luz, Qualidade e Inclusão energética): vereditos em duas
 * camadas, identificadores técnicos fora de Entender, regras de arredondamento e conciliações de contagens. Cada conciliação
 * relê o dado de outro artefato publicado (CSV ou JSON em public/energia), sem repetir a fórmula do código. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PaginaTerritorio from "@/app/setor-eletrico/territorio/page";
import PaginaPerdas from "@/app/setor-eletrico/perdas/page";
import PaginaPerdasComposicao from "@/app/setor-eletrico/perdas/composicao/page";
import PaginaPerdasCusto from "@/app/setor-eletrico/perdas/custo-e-contexto/page";
import PaginaPerdasRegulatorio from "@/app/setor-eletrico/perdas/regulatorio/page";
import PaginaConta from "@/app/setor-eletrico/conta-de-luz/page";
import PaginaContaReajustes from "@/app/setor-eletrico/conta-de-luz/reajustes-e-subsidios/page";
import PaginaQualidade from "@/app/setor-eletrico/qualidade/page";
import PaginaInclusao from "@/app/setor-eletrico/inclusao-energetica/page";
import PaginaInclusaoAcesso from "@/app/setor-eletrico/inclusao-energetica/acesso/page";
import PaginaInclusaoCobertura from "@/app/setor-eletrico/inclusao-energetica/cobertura/page";
import PaginaInclusaoOrcamento from "@/app/setor-eletrico/inclusao-energetica/orcamento/page";
import PaginaInclusaoTarifaSocial from "@/app/setor-eletrico/inclusao-energetica/tarifa-social/page";
import { PERGUNTA_REGULATORIO } from "@/components/energia/PerdasPainel";
import * as C from "@/lib/energia/conta";
import * as I from "@/lib/energia/inclusao";
import * as P from "@/lib/energia/perdas";
import * as Q from "@/lib/energia/qualidade";
import * as T from "@/lib/energia/territorio";
import type { ContaGold } from "@/lib/energia/tipos-conta";
import type { InclusaoGold } from "@/lib/energia/tipos-inclusao";
import type { PerdasGold } from "@/lib/energia/tipos-perdas";
import type { QualidadeGold } from "@/lib/energia/tipos-qualidade";
import type { GoldTerritorio } from "@/lib/energia/tipos-territorio";

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const json = <X>(p: string) => JSON.parse(ler(p)) as X;
const GT = json<GoldTerritorio>("public/energia/gold/territorio.json");
const GP = json<PerdasGold>("public/energia/gold/perdas.json");
const GC = json<ContaGold>("public/energia/gold/conta.json");
const GQ = json<QualidadeGold>("public/energia/gold/qualidade.json");
const GI = json<InclusaoGold>("public/energia/gold/inclusao.json");

/** CSV do pipeline (separador ";"), lido aqui por outro código que o dos módulos. */
function csv(p: string): Record<string, string>[] {
  const [cab, ...linhas] = ler(p).trim().split(/\r?\n/);
  const cols = cab.split(";");
  return linhas.map((l) => Object.fromEntries(l.split(";").map((v, i) => [cols[i], v])));
}

const palavras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const numeros = (t: string) => (t.match(/\d[\d.,]*\d|\d/g) ?? []).length;
const ESPACOS = /[\s ]+/g;
const decodifica = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const norm = (s: string) => s.replace(ESPACOS, " ").trim();

/** Todo o texto da página, com os blocos de Analisar e Auditar. */
function textoCompleto(html: string): string {
  return norm(decodifica(html.slice(html.indexOf("<main")).replace(/<(script|style)[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ")));
}

const VOID = new Set(["br", "img", "input", "hr", "meta", "link", "path", "circle", "rect", "line", "polygon", "polyline", "use", "source", "wbr", "col"]);

/** Texto de Entender: sem os blocos data-nivel analisar e auditar, sem a ficha "Sobre este dado" (dialog), sem svg, script e style. */
function textoEntender(html: string): string {
  const corpo = html.slice(html.indexOf("<main"));
  const saida: string[] = [];
  const ocultas: string[] = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(corpo))) {
    if (m[5] !== undefined) {
      if (!ocultas.length) saida.push(m[5]);
      continue;
    }
    const [, fecha, tag, attrs, auto] = m;
    const t = tag.toLowerCase();
    if (VOID.has(t) || auto) continue;
    if (fecha) {
      if (ocultas.length && ocultas[ocultas.length - 1] === t) ocultas.pop();
      else if (ocultas.length) {
        // fecha de outra tag dentro de bloco oculto: ignora
      }
      continue;
    }
    if (ocultas.length) {
      if (ocultas[ocultas.length - 1] === t) ocultas.push(t);
      continue;
    }
    if (/data-nivel="(?:analisar|auditar)"/.test(attrs) || ["dialog", "svg", "script", "style"].includes(t)) ocultas.push(t);
    else saida.push(" ");
  }
  return norm(decodifica(saida.join(" ")));
}

const render = (P: () => JSX.Element | Promise<JSX.Element>) => renderToStaticMarkup(createElement(P as never));
const H = {
  territorio: render(PaginaTerritorio as never),
  perdas: render(PaginaPerdas as never),
  composicao: render(PaginaPerdasComposicao as never),
  custo: render(PaginaPerdasCusto as never),
  regulatorio: render(PaginaPerdasRegulatorio as never),
  conta: render(PaginaConta as never),
  reajustes: render(PaginaContaReajustes as never),
  qualidade: render(PaginaQualidade as never),
  inclusao: render(PaginaInclusao as never),
  acesso: render(PaginaInclusaoAcesso as never),
  cobertura: render(PaginaInclusaoCobertura as never),
  orcamento: render(PaginaInclusaoOrcamento as never),
  tarifaSocial: render(PaginaInclusaoTarifaSocial as never),
};
type Pagina = keyof typeof H;
const COMPLETO = Object.fromEntries(Object.entries(H).map(([k, h]) => [k, textoCompleto(h)])) as Record<Pagina, string>;
const ENTENDER = Object.fromEntries(Object.entries(H).map(([k, h]) => [k, textoEntender(h)])) as Record<Pagina, string>;

/* ---------------------------------------------------------------- dados para os vereditos */

const perfil200 = "200" as const;
const t = GI.tarifa_social;
const per = { ref: GP.referencia.ano };
const j12 = GC.reajustes.comparacao_inflacao!.janelas.find((j) => j.meses === 12)!;
const linhasReg = P.linhasRegulatorio(GP.distribuidoras);
const linhasCusto = P.linhasCusto(GP.distribuidoras);

/** [pagina, id do painel, veredito, resposta completa]: um por painel que ganhou a segunda camada. */
const PAINEIS: [Pagina, string, string, string][] = [
  ["territorio", "p002", T.vereditoTerritorio(GT), T.respostaTerritorio(GT)],
  ["perdas", "geral", P.vereditoGeral(GP), P.respostaGeral(GP)],
  ["perdas", "evolucao", P.vereditoEvolucao(GP.nacional), P.respostaEvolucao(GP.nacional, per.ref)],
  ["composicao", "composicao", P.vereditoComposicao(GP), P.respostaComposicao(GP)],
  ["regulatorio", "regulatorio", P.vereditoRegulatorio(linhasReg), P.respostaRegulatorio(linhasReg)],
  ["custo", "custo", P.vereditoCusto(linhasCusto, GP.referencia.tarifa_consultada_em), P.respostaCusto(linhasCusto, GP.referencia.tarifa_consultada_em)],
  ["custo", "contexto", P.vereditoAssociacao(GP.associacao), P.respostaAssociacao(GP.associacao)],
  ["conta", "p047", C.vereditoTarifa(GC.data_referencia, GC.tarifas.resumo, GC.tarifas.vigentes, 200), C.respostaTarifa(GC.data_referencia, GC.tarifas.resumo, GC.tarifas.vigentes, 200)],
  ["conta", "p048", C.vereditoComposicao(GC.composicao), C.respostaComposicao(GC.composicao)],
  ["conta", "p050-reajustes", C.vereditoReajustes(j12), C.respostaReajustes(j12)],
  ["conta", "p050-bandeiras", C.vereditoBandeira(GC.bandeiras), C.respostaBandeira(GC.bandeiras)],
  ["conta", "p050-subsidios", C.vereditoSubsidios(GC.subsidios), C.respostaSubsidios(GC.subsidios)],
  ["reajustes", "p050-reajustes", C.vereditoReajustes(j12), C.respostaReajustes(j12)],
  ["reajustes", "p050-bandeiras", C.vereditoBandeira(GC.bandeiras), C.respostaBandeira(GC.bandeiras)],
  ["reajustes", "p050-subsidios", C.vereditoSubsidios(GC.subsidios), C.respostaSubsidios(GC.subsidios)],
  ["qualidade", "p051", Q.vereditoP051(GQ), Q.respostaP051(GQ)],
  ["qualidade", "p052", Q.vereditoP052(GQ), Q.respostaP052(GQ)],
  ["qualidade", "p053", Q.vereditoP053(GQ), Q.respostaP053(GQ)],
  ["qualidade", "p054", Q.vereditoP054(GQ), Q.respostaP054(GQ)],
  ["inclusao", "p059", I.vereditoTarifaSocial(t), I.respostaTarifaSocial(t)],
  ["inclusao", "p060", I.vereditoCobertura(GI.cobertura), I.respostaCobertura(GI.cobertura)],
  ["inclusao", "p062", I.vereditoAcesso(GI.acesso), I.respostaAcesso(GI.acesso)],
  ["tarifaSocial", "p059", I.vereditoTarifaSocial(t), I.respostaTarifaSocial(t)],
  ["cobertura", "p060", I.vereditoCobertura(GI.cobertura), I.respostaCobertura(GI.cobertura)],
  ["acesso", "p062", I.vereditoAcesso(GI.acesso), I.respostaAcesso(GI.acesso)],
];

describe("r8 T1: vereditos (no máximo 50 palavras e 8 números), com a resposta completa na segunda camada", () => {
  it("cada veredito é curto, sem número digitado fora do dado e sem travessão, 'hoje', undefined ou NaN", () => {
    for (const [pagina, id, veredito, completa] of PAINEIS) {
      const rotulo = `${pagina} ${id}`;
      expect(veredito.length, rotulo).toBeGreaterThan(0);
      expect(palavras(veredito), rotulo).toBeLessThanOrEqual(50);
      expect(numeros(veredito), rotulo).toBeLessThanOrEqual(8);
      expect(palavras(veredito), rotulo).toBeLessThan(palavras(completa));
      expect(veredito, rotulo).not.toMatch(/[—–]|\bhoje\b|undefined|NaN/);
    }
  });

  it("o veredito fica à vista (Entender) e a resposta completa continua no HTML, só fora de Entender", () => {
    for (const [pagina, id, veredito, completa] of PAINEIS) {
      const rotulo = `${pagina} ${id}`;
      expect(H[pagina], rotulo).toContain(`data-resposta="${id}"`);
      expect(ENTENDER[pagina], rotulo).toContain(norm(veredito));
      expect(COMPLETO[pagina], rotulo).toContain(norm(completa));
      expect(ENTENDER[pagina], rotulo).not.toContain(norm(completa));
    }
  });

  it("o veredito do mapa de Perdas e os de painéis com filtro (p047, p049, p050-reajustes, mapa) são regiões vivas", () => {
    expect(H.perdas).toMatch(/aria-live="polite"[^>]*data-resposta="mapa"|data-resposta="mapa"[^>]*aria-live="polite"/);
    expect(H.conta).toMatch(/data-resposta="p047"[^>]*aria-live="polite"|aria-live="polite"[^>]*data-resposta="p047"/);
    expect(H.conta).toMatch(/data-resposta="p049"[^>]*aria-live="polite"|aria-live="polite"[^>]*data-resposta="p049"/);
    expect(H.reajustes).toMatch(/data-resposta="p050-reajustes"[^>]*aria-live="polite"|aria-live="polite"[^>]*data-resposta="p050-reajustes"/);
  });

  it("p049 (simulação): veredito com a estimativa e a resposta completa na segunda camada", () => {
    expect(ENTENDER.conta).toMatch(/Para 150 kWh no mês na CERIPa, a estimativa é de R\$ 126,00, sem tributos e sem iluminação pública\./);
    expect(COMPLETO.conta).toContain("Para 150 kWh no mês na CERIPa, classe residencial");
    expect(ENTENDER.conta).not.toContain("Para 150 kWh no mês na CERIPa, classe residencial");
  });

  it("o veredito do mapa de Perdas cobre as cinco medidas e os dois tipos de período", () => {
    const leves = GP.distribuidoras.map(P.leve);
    const rotulos = Object.fromEntries(leves.map((d) => [d.cnpj, P.rotuloDistribuidora(d)]));
    const periodos = P.periodosDisponiveis(GP);
    expect(periodos.some((p) => p.tipo === "acumulado")).toBe(true);
    for (const periodo of periodos) {
      const recortes = P.recortesDoPeriodo(leves, periodo, null);
      if (!recortes) continue;
      for (const m of P.medidasDoPeriodo(periodo)) {
        const valores = P.valoresDoPeriodo(leves, recortes, m, periodo);
        const v = P.vereditoMapa({ periodo, medida: P.MEDIDAS[m], valores, rotulos, acumulado: GP.acumulado });
        expect(palavras(v), `${periodo.id} ${m}`).toBeLessThanOrEqual(50);
        expect(numeros(v), `${periodo.id} ${m}`).toBeLessThanOrEqual(8);
        expect(v, `${periodo.id} ${m}`).not.toMatch(/[—–]|undefined|NaN/);
      }
    }
  });

  it("a direção dita em cada veredito confere com o dado publicado em outro arquivo", () => {
    // Perdas: a taxa de 2025 e a variação sobre 2024 nas mesmas concessionárias vêm de perdas_nacional.csv
    const nac = csv("public/energia/series/perdas_nacional.csv").find((l) => l.ano === String(per.ref) && l.universo === "concessionarias")!;
    const taxa = Number(nac.taxa_total_pct);
    expect(P.vereditoGeral(GP)).toContain(`${taxa.toFixed(2).replace(".", ",")}%`);
    expect(P.vereditoGeral(GP)).toContain("0,01 ponto percentual a mais que em 2024");
    // Qualidade: o DEC do Brasil de 2025 cai contra 2024 em qualidade_brasil.csv
    const br = csv("public/energia/series/qualidade_brasil.csv");
    const dec = (ano: number) => Number(br.find((l) => l.periodo === String(ano) && l.tipo === "anual")!.dec_h);
    expect(dec(GQ.ano_referencia)).toBeLessThan(dec(GQ.ano_referencia - 1));
    expect(Q.vereditoP051(GQ)).toContain(`menos que em ${GQ.ano_referencia - 1}`);
    // Tarifa Social: 2,4% a mais sobre mai/2024 (UC de inclusao_tsee_mensal.csv)
    const m = csv("public/energia/series/inclusao_tsee_mensal.csv");
    const uc = (mes: string) => Number(m.find((l) => l.mes === mes)!.uc_tsee);
    const alta = (uc("2025-05") / uc("2024-05") - 1) * 100;
    expect(I.vereditoTarifaSocial(t)).toContain(`${alta.toFixed(1).replace(".", ",")}% a mais que em mai/2024`);
    expect(I.vereditoTarifaSocial(t)).toContain("Em mai/2025, 17.246.524 unidades consumidoras");
  });
});

describe("r8 T1: Território", () => {
  it("o veredito explica a página em palavras comuns, sem 'grão', 'recorte' nem 'granularidade' em Entender", () => {
    const v = T.vereditoTerritorio(GT);
    expect(v).toMatch(/^Escolha uma região e veja preço, tarifa, perdas, continuidade/);
    expect(v).not.toMatch(/gr[ãa]o|recorte|granularidade/i);
    // "Recorte atual" é rótulo da tabela interativa compartilhada (fora desta área): relatado, não alterado
    const proprio = ENTENDER.territorio.replace(/Recorte atual/g, "");
    for (const x of [/gr[ãa]o\b/i, /granularidade/i, /\brecorte\b/i]) expect(proprio).not.toMatch(x);
  });

  it("o parágrafo de cobertura sai de Entender e o campo para escolher a região chega mais perto do título", () => {
    expect(ENTENDER.territorio).not.toContain("Cobertura desta publicação");
    expect(COMPLETO.territorio).toContain("Cobertura desta publicação");
    const i = ENTENDER.territorio.indexOf("Encontre a sua região");
    const j = ENTENDER.territorio.indexOf("O que acontece na minha região?");
    expect(i).toBeGreaterThan(j);
    // antes da r8 eram 3.336 caracteres entre o título e o campo
    expect(i - j).toBeLessThan(2000);
  });

  it("mensagens de engenharia saíram de Entender: nome de campo, tamanho de arquivo e nome de coleta", () => {
    for (const x of ["sm_estado", "fora_do_sin", "1,3 MB", "1,1 MB", "3,1 MB", "67 KB", "intermediaria"]) expect(ENTENDER.territorio, x).not.toContain(x);
    expect(T.descricaoCamada("Cada UF. Os municípios fora do SIN (sm_estado 'fora_do_sin' no índice municipal) recebem marca própria.")).toBe("Cada UF. Os municípios fora do SIN recebem marca própria.");
    expect(T.textoQualidadeMalha("intermediaria")).toBe("intermediária");
  });

  it("'O que mudou' não repete as datas do Período e diz que não há comparação com a publicação anterior", () => {
    const x = T.textoAtualidade(GT);
    expect(x).toContain("Sem comparação com a publicação anterior.");
    expect(x).not.toContain("tarifa vigente em");
    expect(T.textoPeriodoPainel(GT)).toContain("tarifa vigente");
  });

  it("orçamento de bytes: as células das tabelas de servidor não repetem as seis classes utilitárias", () => {
    expect((H.territorio.match(/class="px-2 py-1\.5 text-carvao text-(?:left|right)"/g) ?? []).length).toBe(0);
    expect(H.territorio).toContain("[&amp;_td]:px-2");
    // medido antes da r8 com os mesmos dados: 391.698 bytes de HTML do servidor
    expect(Buffer.byteLength(H.territorio, "utf-8")).toBeLessThanOrEqual(391_698);
    expect(Buffer.byteLength(H.territorio, "utf-8")).toBeLessThan(600_000);
  });

  it("104 contra 123 distribuidoras: as 19 sem município na relação não têm balanço em 2025 (territorio_distribuidoras.csv e perdas_distribuidoras.csv)", () => {
    const d = csv("public/energia/series/territorio_distribuidoras.csv");
    const comArea = d.filter((l) => Number(l.municipios) > 0);
    const semArea = d.filter((l) => Number(l.municipios) === 0);
    expect(d.length).toBe(123);
    expect(comArea.length).toBe(104);
    expect(semArea.length).toBe(19);
    // nenhuma das 19 tem balanço de 2025 no SAMP: encerradas ou absorvidas
    const balancos2025 = new Set(csv("public/energia/series/perdas_distribuidoras.csv").filter((l) => l.ano === "2025").map((l) => l.cnpj));
    for (const l of semArea) expect(balancos2025.has(l.cnpj), l.sigla).toBe(false);
    expect(COMPLETO.territorio).toContain("104 distribuidoras com município na relação (de 123 no cadastro; as outras 19 foram encerradas ou absorvidas)");
  });
});

describe("r8 T1: Perdas", () => {
  it("regulatório: o título diz o que o gráfico mostra, a diferença é mudança de parâmetro e o bloqueio aparece uma vez", () => {
    expect(PERGUNTA_REGULATORIO).not.toMatch(/diverge/);
    expect(H.regulatorio).toContain(PERGUNTA_REGULATORIO);
    expect(H.regulatorio).not.toContain("Quanto o realizado diverge da referência regulatória?");
    expect(P.vereditoRegulatorio(linhasReg)).toMatch(/mudança de parâmetro entre processos tarifários, não desempenho da distribuidora/);
    expect((COMPLETO.regulatorio.match(/recusaram/g) ?? []).length).toBe(1);
    expect(ENTENDER.regulatorio).toContain("recusaram o acesso do observatório em 30/09/2026");
    for (const x of ["403", "cf-mitigated", "Cloudflare", "servidores da ANEEL recusaram"]) expect(ENTENDER.regulatorio, x).not.toContain(x);
    // o outro painel que cita a pergunta usa o mesmo texto
    expect(H.perdas).toContain(PERGUNTA_REGULATORIO);
    expect(H.composicao).toContain(PERGUNTA_REGULATORIO);
  });

  it("a contagem de distribuidoras do veredito do regulatório vem de perdas_tecnicas_regulatorias.csv", () => {
    const linhas = csv("public/energia/series/perdas_tecnicas_regulatorias.csv").filter((l) => l.classe === "referencia");
    const ids = new Set(linhas.map((l) => l.cnpj));
    expect(P.vereditoRegulatorio(linhasReg)).toContain(`em ${ids.size} distribuidoras`);
  });

  it("mensagens de coleta fora de Entender: GDAL, SIGEL e BDGD ficam em Analisar", () => {
    for (const x of ["GDAL", "SIGEL", "conexão encerrada"]) expect(ENTENDER.perdas, x).not.toContain(x);
    expect(COMPLETO.perdas).toContain("GDAL");
    expect(ENTENDER.perdas).toContain("Limitação: o polígono oficial da área de concessão ou permissão não está acessível ao observatório.");
  });

  it("'ou uma área do mapa' só onde há mapa", () => {
    for (const p of ["composicao", "custo", "regulatorio"] as const) expect(COMPLETO[p], p).not.toContain("área do mapa");
  });

  it("arredondamento: a taxa de perdas totais tem duas casas no destaque, no texto e na variação (14,75%, 14,77%)", () => {
    const nac = csv("public/energia/series/perdas_nacional.csv").find((l) => l.ano === String(per.ref) && l.universo === "concessionarias")!;
    const acum = csv("public/energia/series/perdas_acumulado_ano.csv").find((l) => l.nivel === "universo" && l.chave === "concessionarias")!;
    const f = (v: string) => Number(v).toFixed(2).replace(".", ",");
    expect(f(nac.taxa_total_pct)).toBe("14,75");
    expect(ENTENDER.perdas).toMatch(/Perdas totais das concessionárias, 2025 14,75%/);
    expect(ENTENDER.perdas).toMatch(/Perdas totais, 2026, janeiro a julho \(acumulado\) 14,77%/);
    expect(ENTENDER.perdas).not.toMatch(/Perdas totais das concessionárias, 2025 14,7%/);
    expect(Number(acum.meses_ou_n)).toBe(49);
  });

  it("51 e 49 concessionárias, 83, 103 e 123 distribuidoras: cada universo tem a razão dita no ponto de uso", () => {
    const anual = csv("public/energia/series/perdas_distribuidoras.csv");
    const todas = new Set(anual.map((l) => l.cnpj));
    const de2025 = anual.filter((l) => l.ano === "2025");
    expect(todas.size).toBe(123);
    expect(de2025.length).toBe(103);
    const nac = csv("public/energia/series/perdas_nacional.csv").find((l) => l.ano === "2025" && l.universo === "concessionarias")!;
    const acum = csv("public/energia/series/perdas_acumulado_ano.csv").find((l) => l.nivel === "universo" && l.chave === "concessionarias")!;
    expect(Number(nac.n_distribuidoras)).toBe(51);
    expect(Number(acum.meses_ou_n)).toBe(49);
    expect(COMPLETO.perdas).toContain("123 distribuidoras com balanço no SAMP em algum ano; 103 com valor publicado neste período, 83 delas comparáveis nesta medida; a soma nacional usa só as 51 concessionárias comparáveis");
    expect(COMPLETO.perdas).toContain("As 49 são as que têm os mesmos meses publicados nos dois anos; 51 têm o ano de 2025 completo.");
    // composição: a linha tracejada é das 51 concessionárias; as 19 barras misturam concessionárias e permissionárias
    const grupo = new Map(anual.filter((l) => l.ano === "2025").map((l) => [l.cnpj, l.classificacao]));
    const barras = P.linhasComposicao(GP.distribuidoras).linhas;
    const nConc = barras.filter((b) => grupo.get(b.id) === "Concessionária").length;
    // singular quando a contagem é 1 ("1 permissionária"): a página concorda o número com o substantivo
    const pl = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
    expect(COMPLETO.composicao).toContain(
      `as ${barras.length} barras são as distribuidoras com a decomposição fechando (${pl(nConc, "concessionária", "concessionárias")} e ${pl(barras.length - nConc, "permissionária", "permissionárias")}), outro conjunto`,
    );
    expect(COMPLETO.composicao).toContain("A linha tracejada é a taxa das 51 concessionárias válidas");
  });

  it("14,64 e 14,65 (CERPRO): a barra soma as componentes arredondadas e a tabela soma antes de arredondar", () => {
    const linhas = csv("public/energia/series/perdas_tarifa_b1.csv").filter((l) => l.sigla === "CERPRO" && l.base === "Base Econômica");
    const vigente = linhas[linhas.length - 1];
    const bruto = Number(vigente.tusd_pt) + Number(vigente.tusd_pnt) + Number(vigente.tusd_per_rb_d) + Number(vigente.te_per_rb);
    const arred = (v: number) => Math.round(v * 100) / 100;
    const barra = arred(Number(vigente.tusd_pt)) + arred(Number(vigente.tusd_pnt)) + arred(Number(vigente.tusd_per_rb_d) + Number(vigente.te_per_rb));
    expect(arred(bruto)).toBe(14.65);
    expect(Math.round(barra * 100) / 100).toBe(14.64);
    expect(Number(vigente.perdas)).toBeCloseTo(bruto, 3);
    expect(P.vereditoCusto(linhasCusto, GP.referencia.tarifa_consultada_em)).toContain("14,65 R$/MWh (CERPRO)");
    // um valor só para o mesmo item: a barra desenha o total da tabela (14,65) e nenhuma nota explica dois valores
    expect(ENTENDER.custo).not.toContain("14,64 na barra");
    const cerpro = linhasCusto.find((l) => l.rotulo === "CERPRO")!;
    const desenho = P.componentesParaBarra(cerpro);
    expect(arred(desenho.pt + desenho.pnt + desenho.rede_basica)).toBe(14.65);
    const d = P.divergenciaArredondamentoCusto(linhasCusto);
    expect(d.n).toBeGreaterThan(0);
    expect(d.de).toBe(80);
  });

  it("o link de prova da associação não usa ρ (a classe do rótulo o põe em maiúscula e vira P)", () => {
    expect(COMPLETO.custo).toContain("Comprove a associação da taxa de perdas totais com a renda");
    expect(COMPLETO.custo).not.toContain("Comprove o ρ");
    expect(P.vereditoAssociacao(GP.associacao)).not.toContain("ρ");
    // a escala do 'forte' está dita ao lado do coeficiente
    expect(P.respostaAssociacao(GP.associacao)).toContain("Escala do observatório para |ρ|");
  });
});

describe("r8 T1: Conta de luz", () => {
  it("87 de 102 acima do IPCA: a contagem do veredito confere com conta_reajuste_vs_ipca.csv", () => {
    const linhas = csv("public/energia/series/conta_reajuste_vs_ipca.csv").filter((l) => l.janela_meses === "12");
    const acima = linhas.filter((l) => Number(l.variacao_pct) > Number(l.ipca_pct)).length;
    expect(linhas.length).toBe(102);
    expect(acima).toBe(87);
    expect(C.vereditoReajustes(j12)).toContain(`em ${acima} de ${linhas.length} distribuidoras`);
    expect(ENTENDER.reajustes).toContain(`${linhas.length - acima} distribuidoras ficaram abaixo da inflação ou iguais a ela, e ${acima} ficaram acima`);
    // as primeiras barras (as menores variações) ficam todas à esquerda do IPCA: é isso que a nota explica
    const menores = [...linhas].sort((a, b) => Number(a.variacao_pct) - Number(b.variacao_pct)).slice(0, 12);
    for (const l of menores) expect(Number(l.variacao_pct)).toBeLessThan(Number(l.ipca_pct));
  });

  it("ranking das tarifas: a nota diz que a lista começa pela mais barata e que a escala vai até a mais cara", () => {
    const vig = csv("public/energia/series/conta_tarifas_b1_vigentes.csv");
    expect(ENTENDER.conta).toContain(`A lista começa pela distribuidora mais barata e segue até a mais cara (${vig.length} no total)`);
    const custos = vig.map((l) => Number(l.custo_200kwh_rs)).sort((a, b) => a - b);
    const v = norm(C.vereditoTarifa(GC.data_referencia, GC.tarifas.resumo, GC.tarifas.vigentes, 200));
    expect(v).toContain(`R$ ${custos[0].toFixed(2).replace(".", ",")}`);
    expect(v).toContain(`R$ ${custos[custos.length - 1].toFixed(2).replace(".", ",")}`);
    void perfil200;
  });

  it("126,00 e 126,01: as parcelas arredondadas somam um centavo a mais que o total, e a página diz por quê", () => {
    const tarifa = csv("public/energia/series/conta_tarifas_b1_vigentes.csv").find((l) => l.sigla === "CERIPa")!;
    const energia = (150 * Number(tarifa.total_rs_mwh)) / 1000;
    const bandeira = (150 * GC.bandeiras.vigente!.rs_mwh!) / 1000;
    const c2 = (v: number) => Math.round(v * 100) / 100;
    expect(c2(energia)).toBe(123.18);
    expect(c2(bandeira)).toBe(2.83);
    expect(c2(energia + bandeira)).toBe(126.0);
    expect(c2(c2(energia) + c2(bandeira))).toBe(126.01);
    expect(ENTENDER.conta).toContain("As parcelas somam R$ 126,01 e o total é R$ 126,00");
    expect(C.notaArredondamentoSimulacao([123.18, 2.83], 126.0)).toContain("R$ 0,01");
    expect(C.notaArredondamentoSimulacao([100, 20], 120)).toBeNull();
  });

  it("mensagens internas de coleta e engenharia saíram de Entender", () => {
    for (const x of ["DscDetalheMercado", "conferência de atípicos", "erro de ordem de grandeza", "TE_CFURH", "Sudam", "UBP", "responderam 403", "Cloudflare", "o dicionário", "não pôde ser lido", "não pôde ser lida"]) {
      expect(ENTENDER.conta, x).not.toContain(x);
      expect(ENTENDER.reajustes, x).not.toContain(x);
    }
    // o detalhe técnico continua em Analisar
    expect(COMPLETO.conta).toContain("DscDetalheMercado");
    expect(COMPLETO.conta).toContain("TE_CFURH");
    expect(ENTENDER.reajustes).toContain("recusaram o acesso do observatório em 30/09/2026");
    expect(ENTENDER.conta).toContain("Compensação financeira pelo uso de recursos hídricos");
    expect(C.separaBloqueioDeNorma("Leitura por parcela. O texto da REN não pôde ser lido (bloqueio); por isso a leitura é declarada.")).toEqual({
      leitor: "Leitura por parcela.",
      tecnico: "O texto da REN não pôde ser lido (bloqueio); por isso a leitura é declarada.",
    });
  });

  it("o IPCA 'desde a mudança anterior' traz os meses e coincide com o de 12 meses porque a mudança anterior foi 12 meses antes", () => {
    const ultimo = GC.reajustes.ultimos.reduce((m, u) => (u[2] > m[2] ? u : m));
    expect(ultimo[6]).toBe(j12.ipca_meses[0]);
    expect(ultimo[7]).toBe(j12.ipca_meses[1]);
    expect(ultimo[5]).toBe(j12.ipca_pct);
    expect(COMPLETO.reajustes).toContain("o IPCA desde a mudança anterior (ago/2025 a ago/2026) foi 4,22%");
  });
});

describe("r8 T1: Qualidade", () => {
  it("102 distribuidoras: as encerradas ou absorvidas e as sem conjuntos não têm indicadores de 2025", () => {
    const q = csv("public/energia/series/qualidade_distribuidoras_anual.csv").filter((l) => l.ano === String(GQ.ano_referencia));
    expect(new Set(q.map((l) => l.cnpj)).size).toBe(102);
    const comArea = csv("public/energia/series/territorio_distribuidoras.csv").filter((l) => Number(l.municipios) > 0);
    const emQualidade = new Set(q.map((l) => l.cnpj));
    const foraDeQualidade = comArea.filter((l) => !emQualidade.has(l.cnpj)).map((l) => l.sigla).sort();
    expect(foraDeQualidade).toEqual(["CODESAM", "ENF"]);
    expect(COMPLETO.qualidade).toContain("102 distribuidoras com indicadores de continuidade");
    expect(COMPLETO.qualidade).toContain("as encerradas ou absorvidas, listadas em Perdas e em Minha região, não têm");
  });

  it("os links de erro e o rodapé não citam nome de arquivo em Entender", () => {
    expect(ENTENDER.qualidade).not.toMatch(/qualidade_[a-z_]+\.csv/);
    expect(ENTENDER.qualidade).not.toMatch(/\b[a-z]+_[a-z_]+\.(?:csv|json)\b/);
  });
});

describe("r8 T1: Inclusão energética", () => {
  it("mai/2025 e jun/2025: jun/2025 está no arquivo do SCS mas é incompleto (4 distribuidoras ausentes); o último completo é mai/2025", () => {
    const m = csv("public/energia/series/inclusao_tsee_mensal.csv");
    const mai = m.find((l) => l.mes === "2025-05")!;
    const jun = m.find((l) => l.mes === "2025-06")!;
    expect(mai.completo).toBe("1");
    expect(jun.completo).toBe("0");
    expect(jun.distribuidoras_faltantes).toBe("4");
    expect(m[m.length - 1].mes).toBe("2025-06");
    expect(Number(mai.uc_tsee)).toBe(t.kpis.uc_tsee.valor);
    const quadro = ENTENDER.tarifaSocial;
    expect(quadro).toContain("Fonte defasada, declarada. Um mês só entra nas comparações quando todas as distribuidoras enviaram o informe.");
    expect(quadro).toContain("SCS (UC): arquivo gerado em 20/09/2026, publicado até jun/2025; o último mês com todas as distribuidoras é mai/2025, o dos números de UC.");
    expect(quadro).toContain("o último mês com todas as distribuidoras é mar/2026, o dos números de fatura e do mapa.");
    for (const x of ["arquivos sondados", "original guardado", "regra do mês do mapa"]) expect(quadro, x).not.toContain(x);
  });

  it("72 passam de 100 e 75 estão nas faixas de 100 em diante: três municípios têm razão exatamente 100 (inclusao_municipios.csv)", () => {
    const r = csv("public/energia/series/inclusao_municipios.csv").map((l) => Number(l.razao_proxy_atualizadas));
    expect(r.filter((x) => x > 100).length).toBe(72);
    expect(r.filter((x) => x >= 100).length).toBe(75);
    expect(r.filter((x) => x === 100).length).toBe(3);
    expect(I.mudancaCobertura(GI.cobertura)).toContain("72 passam de 100 (as faixas do histograma de 100 em diante somam 75 porque a faixa começa em 100, inclusive)");
    expect(COMPLETO.cobertura).toContain("72 passam de 100 (as faixas do histograma de 100 em diante somam 75");
  });

  it("nomes de arquivo, 'hoje' e a repetição do intervalo estatístico saíram de Entender", () => {
    for (const x of ["inclusao_municipios.csv", "inclusao_cobertura_mensal.csv", "Dados_20230713.zip", "Tradutores_20230713.zip"]) {
      expect(ENTENDER.cobertura, x).not.toContain(x);
      expect(ENTENDER.orcamento, x).not.toContain(x);
    }
    expect(COMPLETO.orcamento).toContain("Dados_20230713.zip");
    expect(COMPLETO.orcamento).not.toMatch(/\bhoje\b/);
    expect((ENTENDER.cobertura.match(/intervalo estatístico/g) ?? []).length).toBe(1);
  });
});

describe("r8 T1: texto de todas as páginas tocadas", () => {
  it("sem travessão, 'hoje', undefined ou NaN no texto do leitor (fora das fichas e dos trechos citados da fonte)", () => {
    for (const [p, texto] of Object.entries(ENTENDER)) {
      expect(texto, p).not.toMatch(/—|\bhoje\b|\bundefined\b|\bNaN\b/);
    }
  });

  it("nenhum identificador novo nos vereditos e nos avisos que mudaram", () => {
    const novos = [
      ...PAINEIS.map((p) => p[2]),
      T.textoAtualidade(GT),
      T.textoUniverso(GT),
      P.respostaRegulatorio(linhasReg),
      I.mudancaCobertura(GI.cobertura),
    ];
    for (const x of novos) {
      expect(x).not.toMatch(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b|\.(?:csv|json|parquet|zip)\b|sha256|HTTP \d{3}|\bP0\d\d\b|\bGDAL\b|\bpipeline\b|\bsilver\b|\bvintage\b/);
    }
  });
});
