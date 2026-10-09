/**
 * Módulo PLD (detalhe): contrato da gold pld_detalhe.json e dos arquivos lidos sob demanda.
 *
 * O teste principal compila, com o compilador TypeScript do projeto, um arquivo virtual que
 * atribui o JSON publicado (como literal de objeto) aos tipos de src/lib/energia/tipos-pld.ts.
 * Num literal, o TypeScript recusa campo que o tipo não declara (TS2353) e campo obrigatório
 * ausente (TS2741): assim, qualquer desvio entre o que o pipeline publica e o que a interface
 * espera (como os campos `urls` da fonte composta ou `url` do arquivo do ato da ANEEL, que os
 * tipos compartilhados não têm) faz o teste falhar. Importar o JSON com `import` não pegaria
 * isso, porque o tipo inferido do JSON não passa pela checagem de campos a mais.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readdirSync } from "node:fs";
import PaginaP008 from "@/app/setor-eletrico/pld/page";
import PaginaP009 from "@/app/setor-eletrico/pld/cmo-e-formacao/page";
import PaginaP010 from "@/app/setor-eletrico/pld/limites/page";
import PaginaP011 from "@/app/setor-eletrico/pld/historico/page";
import PaginaP012 from "@/app/setor-eletrico/pld/diferencas-regionais/page";
import { PldIndisponivel } from "@/components/energia/PldPagina";
import { NOS_FORMACAO } from "@/lib/energia/conteudo/pld";
import { problemasEvidencia } from "@/lib/energia/evidencia";
import { dataBR, fracPct, num, reais } from "@/lib/energia/formato";
import {
  COLUNAS_AMPLITUDE,
  COLUNAS_MENSAIS,
  COLUNAS_PERMANENCIA,
  COLUNAS_RELACAO,
  COLUNAS_SEMANAS,
  COLUNAS_SEPARACAO,
  FAIXAS_DE_HORAS,
  LIMIAR_SEPARACAO,
  PAINEIS_PLD,
  PARES,
  SUBMERCADOS,
  agruparEmFaixasDeHoras,
  atualidadePld,
  calendarioLimite,
  diaAnterior,
  diasNoLimite,
  diferencaTexto,
  documentosCitados,
  emPct,
  estadoHora,
  estadoRenovaveisBalanco,
  estadoTermicasBalanco,
  extremosMediaDiaria,
  horaDiaRecorte,
  horaPadrao,
  horasPorSentidoNoDia,
  inflacaoAcumulada,
  intervaloSemanaOperativa,
  ligacoesFormacao,
  limitesPorSemana,
  limitesVigentesEm,
  linhasAmplitude,
  linhasCalendario,
  linhasMatriz,
  linhasMatrizDoPeriodo,
  linhasMediaDiaria,
  linhasMensais,
  linhasPermanencia,
  linhasSemanais,
  linhasSeparacao,
  marcosNumerados,
  matrizDoPeriodo,
  matrizRegional,
  matrizRegionalDoPeriodo,
  mediaNasHorasSeparadas,
  nomePar,
  nomesDosSubmercados,
  notaSemNomeDeArquivo,
  notaTetoComConfirmacaoEmpirica,
  partesDistanciaSemanal,
  perfilHoraMes,
  perguntaPainel,
  pontesSeparacao,
  provenienciaSemRessalvaObsoleta,
  proximoPainel,
  quatroNoPisoPorAno,
  regimeVigenteEm,
  resumoLigacoes,
  respostaHora,
  respostaP008,
  respostaP009,
  respostaP010,
  respostaP011,
  respostaP012,
  rotaPainel,
  rotuloPeriodo,
  semRessalvaDeLimitesNaoAuditados,
  serieSeparacaoHoraria,
  textoCmoFrenteAosLimites,
  textoComparabilidade,
  textoDiasNoLimite,
  textoDistanciaSemanal,
  textoEmpatesMediaDiaria,
  textoHidraulicaBalanco,
  textoInflacao,
  textoLimitesVigentes,
  textoMediaDaAmplitude,
  textoMenorValorEPiso,
  textoMudancaMediaDiaria,
  textoPicoFrenteAoLimite,
  textoPonteLimiar,
  textoQuatroNoPiso,
  textoReferenciaDistancia,
  textoRegimesDistribuicao,
  textoSentidoNoDia,
  valoresAlcancamTeto,
  variacaoComumDoGrupo,
  vereditoMediaDiaria,
  vereditoP012,
  type MediaDiariaSm,
  type PainelPld,
} from "@/lib/energia/pld";
import { CONTRASTES } from "@/lib/energia/conteudo/complementos";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { gold as goldDoObservatorio } from "@/lib/energia/gold";
import { fichasPld, horarioRecentePld } from "@/lib/energia/pld-arquivos";
import { matrizExportacao } from "@/lib/energia/tabela";
import type { PldGold, RedeGold } from "@/lib/energia/tipos";
import type { BlocoLimitesDisponivel, PldDetalheGold, PldHoraDiaArquivo } from "@/lib/energia/tipos-pld";

const RAIZ = path.resolve(__dirname, "../..");
const GOLD = path.join(RAIZ, "public/energia/gold/pld_detalhe.json");
const SERIES = path.join(RAIZ, "public/energia/series");

const ARQUIVOS: [string, string][] = [
  ["PldDetalheGold", GOLD],
  ["PldEvidenciasArquivo", path.join(SERIES, "pld_evidencias.json")],
  ["PldHoraDiaArquivo", path.join(SERIES, "pld_hora_dia.json")],
  ["PldHorarioRecenteArquivo", path.join(SERIES, "pld_horario_recente.json")],
];

function diagnosticosDaAtribuicao(): string[] {
  const virtual = path.join(RAIZ, "src/lib/energia/__confere_tipos_pld__.ts");
  const fonte =
    `import type { ${ARQUIVOS.map(([t]) => t).join(", ")} } from "./tipos-pld";\n` +
    ARQUIVOS.map(([t, arq], i) => `export const v${i}: ${t} = ${readFileSync(arq, "utf-8")};\n`).join("");
  const opcoes: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    resolveJsonModule: true,
    baseUrl: RAIZ,
    paths: { "@/*": ["./src/*"] },
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
    types: [],
  };
  const host = ts.createCompilerHost(opcoes);
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (nome, versao, ...resto) =>
    path.resolve(nome) === virtual ? ts.createSourceFile(nome, fonte, versao) : original(nome, versao, ...resto);
  const lerOriginal = host.readFile.bind(host);
  host.readFile = (nome) => (path.resolve(nome) === virtual ? fonte : lerOriginal(nome));
  const existeOriginal = host.fileExists.bind(host);
  host.fileExists = (nome) => path.resolve(nome) === virtual || existeOriginal(nome);
  const programa = ts.createProgram([virtual], opcoes, host);
  const arquivo = programa.getSourceFile(virtual);
  if (!arquivo) throw new Error("arquivo virtual não compilado");
  return [...programa.getSyntacticDiagnostics(arquivo), ...programa.getSemanticDiagnostics(arquivo)].map((d) => {
    const pos = d.start !== undefined ? arquivo.getLineAndCharacterOfPosition(d.start) : null;
    const trecho = d.start !== undefined ? fonte.slice(Math.max(0, d.start - 80), d.start + 40).replace(/\s+/g, " ") : "";
    return `TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText, " ")} (linha ${pos ? pos.line + 1 : "?"}: …${trecho}…)`;
  });
}

const gold = JSON.parse(readFileSync(GOLD, "utf-8")) as PldDetalheGold;

describe("pld_detalhe.json: tipos espelham a gold publicada", () => {
  it("gold, fichas, mapa hora × dia e janela horária atribuíveis aos tipos sem campo a mais nem a menos", () => {
    expect(diagnosticosDaAtribuicao()).toEqual([]);
  }, 180_000);
});

describe("pld_detalhe.json: ponderada pela carga e perímetro do peso", () => {
  const mh = gold.historico.mensal;
  const pond = gold.historico.ponderacao;

  it("perímetro da carga por mês, com a mudança de 2023 marcada", () => {
    expect(mh.perimetro_carga).toHaveLength(mh.meses.length);
    expect(mh.perimetro_carga[mh.meses.indexOf("2021-02")]).toBe("P1");
    expect(mh.perimetro_carga[mh.meses.indexOf("2021-03")]).toBe("P2");
    expect(mh.perimetro_carga[mh.meses.indexOf("2023-04")]).toBe("P2_P3");
    expect(mh.perimetro_carga[mh.meses.indexOf("2023-05")]).toBe("P3");
    expect(pond.perimetros.map((p) => [p.id, p.natureza_do_peso, p.inclui_mmgd])).toEqual([
      ["P1", "OBSERVADO", false],
      ["P2", "ESTIMADO", false],
      ["P3", "ESTIMADO", true],
    ]);
  });

  it("natureza do peso do balanço é ESTIMADO e a do peso sem MMGD é OBSERVADO", () => {
    expect(gold.proveniencia.peso_carga_balanco.natureza).toBe("ESTIMADO");
    expect(gold.metricas_proveniencia.pld_media_mensal_ponderada_carga.fonte).toBe("peso_carga_balanco");
    if (pond.peso_sem_mmgd.disponivel) {
      expect(gold.proveniencia.peso_carga_sem_mmgd?.natureza).toBe("OBSERVADO");
      expect(gold.metricas_proveniencia.pld_media_mensal_ponderada_carga_sem_mmgd.fonte).toBe("peso_carga_sem_mmgd");
    }
  });

  it("revisões da proveniência mensal somam PLD e carga", () => {
    const rv = gold.proveniencia.historico_mensal.revisoes_conhecidas;
    expect(rv).not.toBeNull();
    const comp = rv?.componentes ?? [];
    expect(comp.map((c) => c.fonte)).toContain("carga do balanço (ONS)");
    expect(rv?.total).toBe(comp.reduce((s, c) => s + (c.total ?? 0), 0));
  });

  it("CSV mensal reproduz as colunas da gold (gráfico, tabela e exportação com os mesmos números)", () => {
    const [cab, ...linhas] = readFileSync(path.join(SERIES, "pld_mensal.csv"), "utf-8").trim().split("\n");
    const col = cab.split(";");
    const idx = (c: string) => col.indexOf(c);
    expect(linhas).toHaveLength(mh.meses.length * 4);
    for (const l of linhas) {
      const v = l.split(";");
      const i = mh.meses.indexOf(v[idx("mes")]);
      const sm = v[idx("sm")] as "SE" | "S" | "NE" | "N";
      expect(v[idx("perimetro_carga")]).toBe(mh.perimetro_carga[i]);
      for (const [csv, campo] of [
        ["media_ponderada_carga", "ponderada_carga"],
        ["media_ponderada_carga_sem_mmgd", "ponderada_carga_sem_mmgd"],
        ["media_temporal", "temporal"],
      ] as const) {
        const g = mh[sm][campo][i];
        expect(v[idx(csv)] === "").toBe(g === null);
        if (g !== null) expect(Math.abs(Number(v[idx(csv)]) - g)).toBeLessThanOrEqual(0.005);
      }
    }
  });
});

describe("pld_detalhe.json: blocos anuais e limiares", () => {
  it("empates no piso marcam o ano parcial como os outros blocos anuais", () => {
    const lim = gold.limites;
    if (!lim.disponivel) return;
    const ano = Number(gold.referencia.dia.slice(0, 4));
    const parcial = !gold.referencia.dia.endsWith("-12-31");
    expect(lim.empates_piso.find((e) => e.ano === ano)?.parcial).toBe(parcial);
    expect(lim.permanencia_anual.find((e) => e.ano === ano)?.parcial).toBe(parcial);
  });

  it("amplitude publica a contagem com R$ 1,00/MWh, menor ou igual à de R$ 0,01/MWh", () => {
    for (const a of gold.regional.amplitude) {
      expect(a.horas_acima_1).toBeLessThanOrEqual(a.horas_com_separacao);
      expect(a.horas_acima_10).toBeLessThanOrEqual(a.horas_acima_1);
    }
    const ctrl = gold.controles.find((c) => c.nome.startsWith("Amplitude com R$ 1,00/MWh"));
    expect(ctrl?.resultado).not.toBe("reprovado");
  });
});

describe("pld_detalhe.json: textos derivados dos dados", () => {
  it("A02 cita meias horas publicadas, esperadas e dias sem publicação do próprio bloco", () => {
    const a02 = gold.achados.A02;
    const se = a02.dessem_mesmo_periodo?.find((x) => x.sm === "SE");
    if (!se || !a02.texto) return;
    const n = (v: number) => v.toLocaleString("pt-BR");
    expect(a02.texto).toContain("meias horas publicadas");
    expect(a02.texto).toContain(`${n(se.meias_horas_zero)} de ${n(se.meias_horas)}`);
    expect(a02.texto).toContain(`${n(se.meias_horas_esperadas)} meias horas e ${se.dias_sem_publicacao} dias sem nenhuma publicada`);
    expect(se.meias_horas_esperadas).toBeGreaterThanOrEqual(se.meias_horas);
  });

  it("sensibilidade ao peso: texto com a faixa das diferenças publicadas", () => {
    const sp = gold.historico.ponderacao.sensibilidade_peso;
    if (!sp) return;
    for (const x of sp.por_sm) {
      expect(Math.abs(x.ponderada_menos_sem_mmgd - (x.ponderada_carga - x.ponderada_carga_sem_mmgd))).toBeLessThanOrEqual(0.011);
    }
    expect(sp.texto).toContain("ponderada pela carga sem MMGD");
  });
});



/* ====================================================================== */
/* Interface (fase 2): painéis P008 a P012                                */
/* ====================================================================== */

const ler = (rel: string) => readFileSync(path.join(RAIZ, rel), "utf-8");
const lim = gold.limites as BlocoLimitesDisponivel;
const rec = horarioRecentePld(gold.horario_recente.url)!;
/** Lê um CSV publicado (separador ";") como lista de objetos pelo cabeçalho. */
function csv(nome: string): Record<string, string>[] {
  const [cab, ...linhas] = readFileSync(path.join(SERIES, nome), "utf-8").replace(/^﻿/, "").trim().split("\n");
  const col = cab.split(";");
  return linhas.map((l) => Object.fromEntries(l.split(";").map((v, i) => [col[i], v])));
}
const SEM_TRAVESSAO = /—|–| - /;

describe("interface do PLD: rotas e anatomia das páginas", () => {
  it("cada painel tem rota com página force-static que lê a gold pelo lerGold e usa o cabeçalho do PLD", () => {
    for (const p of PAINEIS_PLD) {
      const arq = `src/app/setor-eletrico/pld${p.caminho}/page.tsx`;
      expect(existsSync(path.join(RAIZ, arq)), arq).toBe(true);
      const t = ler(arq);
      expect(t, arq).toContain('export const dynamic = "force-static"');
      expect(t, arq).toContain('lerGold<PldDetalheGold>("pld_detalhe.json")');
      expect(t, arq).toContain('<CabecalhoEnergia atual="pld" />');
      expect(t, arq).toContain(`<PldNavegacao atual="${p.id}" />`);
    }
    expect(proximoPainel("p008").href).toBe(`${rotaPainel("p009")}#p009`);
    expect(proximoPainel("p012").href).toBe("/setor-eletrico/pld#previsao");
  });

  it("componentes e páginas do módulo sem hexadecimal solto e módulos cliente só exportam componentes e tipos", () => {
    const dir = path.join(RAIZ, "src/components/energia");
    const comp = readdirSync(dir).filter((f) => f.startsWith("Pld")).map((f) => path.join(dir, f));
    const pags = PAINEIS_PLD.map((p) => path.join(RAIZ, `src/app/setor-eletrico/pld${p.caminho}/page.tsx`));
    for (const f of [...comp, ...pags]) {
      const t = readFileSync(f, "utf-8");
      expect(t, f).not.toMatch(/#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/);
      expect(t, f).not.toMatch(/["'`(\s]#[0-9a-fA-F]{3}["'`;\s)]/);
      if (t.startsWith('"use client"')) for (const m of Array.from(t.matchAll(/^export (const|let|var) (\w+)/gm))) expect.fail(`${f} exporta valor ${m[2]}`);
    }
  });
});

describe("P008: ligações do diagrama decididas pelas passagens conferidas", () => {
  const fontes = gold.conceito.fontes_textuais;
  const lig = ligacoesFormacao(NOS_FORMACAO, fontes);

  it("ligação conferida tem passagem literal publicada; pendente não tem base conferida nem aparece em dobro", () => {
    for (const [no, ls] of Object.entries(lig)) {
      const pares = ls.map((l) => `${l.de}>${l.para}`);
      expect(new Set(pares).size, no).toBe(pares.length);
      for (const l of ls) {
        if (l.estado === "CONFERIDO" && l.origem === "gold") {
          expect(l.bases.length, `${no}>${l.para}`).toBeGreaterThan(0);
          for (const b of l.bases) expect(fontes.find((f) => f.id === b.id)?.texto, b.id).toBe(b.texto);
        }
        if (l.estado === "PENDENTE") expect(l.bases, `${no}>${l.para}`).toEqual([]);
      }
    }
    // a geração solar não é citada pelo trecho do ONS: o texto da ligação diz isso
    expect(lig.renovaveis.find((l) => l.para === "otimizacao")?.texto).toContain("não menciona a geração solar");
  });

  it("tirar uma passagem da gold derruba as ligações que dependem dela e muda a resposta", () => {
    const base = resumoLigacoes(lig);
    const sem = fontes.filter((f) => f.id !== "pr24_cmo_semi_horario");
    const ligSem = ligacoesFormacao(NOS_FORMACAO, sem);
    const r = resumoLigacoes(ligSem);
    expect(r.conferidas).toBeLessThan(base.conferidas);
    expect(ligSem.carga.find((l) => l.para === "otimizacao")?.estado).toBe("PENDENTE");
    // a resposta conta as ligações conferidas e as passagens do próprio bloco
    const nPass = documentosCitados(gold.conceito).documentos.reduce((s, d) => s + d.passagens.length, 0);
    const txt = respostaP008(gold.conceito, lig);
    expect(txt).toContain(`${num(nPass, 0)} passagens`);
    expect(txt).toContain(`${base.conferidas} de ${base.total} ligações`);
    const semMcp = respostaP008({ ...gold.conceito, fontes_textuais: fontes.filter((f) => f.id !== "ren957_art5_p4") }, lig);
    expect(semMcp).not.toContain("Mercado de Curto Prazo, as diferenças");
    expect(txt).not.toMatch(SEM_TRAVESSAO);
  });
});

describe("textos derivados dos números", () => {
  it("diferença escrita com sentido e contração decididos no valor arredondado", () => {
    expect(diferencaTexto(26.2, "CMO semanal do DECOMP", "m")).toBe(`${reais(26.2)}/MWh acima do CMO semanal do DECOMP`);
    expect(diferencaTexto(-1742.65, "média do DESSEM", "f")).toBe(`${reais(1742.65)}/MWh abaixo da média do DESSEM`);
    expect(diferencaTexto(0.004, "média do DESSEM", "f")).toBe("igual à média do DESSEM");
    expect(diferencaTexto(null, "CMO", "m")).toContain("sem diferença");
  });

  it("P009: resposta com os três produtos da semana de referência e a mediana da relação horária, sem multiplicador", () => {
    const ref = gold.cmo_pld.semana_referencia!;
    for (const sm of SUBMERCADOS) {
      const x = ref.por_sm.find((p) => p.sm === sm)!;
      const t = respostaP009(gold.cmo_pld, sm);
      for (const v of [x.decomp, x.dessem, x.pld]) expect(t, sm).toContain(`${reais(v)}/MWh`);
      expect(t, sm).toContain(diferencaTexto(x.pld_menos_dessem, "média do DESSEM", "f"));
      expect(t, sm).toContain(diferencaTexto(x.pld_menos_decomp, "CMO semanal do DECOMP", "m"));
      const r = gold.cmo_pld.relacao_anual.filter((y) => y.sm === sm).sort((a, b) => b.ano - a.ano)[0];
      if (r.entre?.mediana_abs_dif != null) expect(t, sm).toContain(reais(r.entre.mediana_abs_dif));
      expect(t, sm).not.toMatch(/vezes|multiplic|\d+\s*x\b/i);
      expect(t, sm).not.toMatch(SEM_TRAVESSAO);
    }
  });

  it("P010: resposta com horas no piso, fração, limites e ato do próprio ano", () => {
    for (const p of lim.permanencia_anual) {
      const t = respostaP010(lim, p.ano, p.sm, gold.referencia.dia);
      expect(t).toContain(`${num(p.horas_piso, 0)} de ${num(p.horas_com_limite, 0)}`);
      expect(t).toContain(fracPct(p.frac_piso, 2));
      const reg = lim.regimes.filter((r) => r.inicio.slice(0, 4) <= String(p.ano) && r.fim.slice(0, 4) >= String(p.ano));
      if (reg.length === 1) {
        expect(t).toContain(reais(reg[0].pld_min));
        expect(t).toContain(reg[0].ato_pld_min!);
      }
      expect(t).toContain(p.dias_teto_estrutural === 0 ? "Nenhum dia teve" : "no teto estrutural");
      expect(t).toContain(p.parcial ? "parcial" : `Em ${p.ano},`);
      expect(t).not.toMatch(SEM_TRAVESSAO);
    }
  });

  it("P011: posição do dia pelo percentil e pelo n da gold, média do mês e aviso de que percentil não é previsão", () => {
    for (const p of gold.historico.posicao_referencia) {
      const t = respostaP011(gold.historico, p.sm);
      if (p.media_dia !== null) expect(t).toContain(reais(p.media_dia));
      if (p.mesmo_mes.percentil !== null) expect(t).toContain(`percentil ${num(p.mesmo_mes.percentil, 1)} entre as ${num(p.mesmo_mes.n_dias, 0)}`);
      const mc = gold.historico.mes_corrente.find((m) => m.sm === p.sm)!;
      if (mc.media_dias_completos !== null) expect(t).toContain(reais(mc.media_dias_completos));
      expect(t).toContain("Percentil não é previsão");
      expect(t).not.toMatch(SEM_TRAVESSAO);
    }
  });

  it("P012: contagens do período e o par mais e menos separado escolhidos pela gold", () => {
    for (const a of gold.regional.amplitude) {
      const t = respostaP012(gold.regional, a.periodo);
      expect(t).toContain(`em ${num(a.horas_com_separacao, 0)} de ${num(a.horas, 0)} horas`);
      expect(t).toContain(`em ${num(a.horas_acima_1, 0)} horas a diferença passou de R$ 1,00/MWh`);
      const pares = gold.regional.separacao.filter((s) => s.periodo === a.periodo && s.frac_separadas !== null);
      const max = pares.reduce((m, s) => ((s.frac_separadas ?? 0) > (m.frac_separadas ?? 0) ? s : m));
      expect(t).toContain(`O par que mais se separou foi ${nomePar(max.par)}`);
      expect(t).toContain("não diz por quê");
      expect(t).not.toMatch(SEM_TRAVESSAO);
    }
  });

  it("hora escolhida: preços e fluxos da MESMA hora do arquivo, com ausência escrita", () => {
    const t0 = horaPadrao(rec);
    const i = rec.t.indexOf(t0);
    const e = estadoHora(rec, t0)!;
    for (const sm of SUBMERCADOS) expect(e.precos[sm]).toBe(rec.pld[sm][i]);
    expect(e.amplitude).toBe(rec.amplitude[i]);
    // a hora padrão tem fluxo publicado nas quatro fronteiras e é a de maior amplitude entre elas
    expect(e.fluxos.every((f) => typeof f.fluxo === "number")).toBe(true);
    const comFluxo = rec.t.map((_, j) => j).filter((j) => (["N_NE", "N_SE", "NE_SE", "S_SE"] as const).every((f) => typeof rec.fluxo[f][j] === "number"));
    expect(Math.max(...comFluxo.map((j) => rec.amplitude[j] ?? -1))).toBe(rec.amplitude[i]);
    const ultima = estadoHora(rec, rec.t[rec.t.length - 1])!;
    if (ultima.fluxos.some((f) => f.fluxo === null)) expect(respostaHora(ultima)).toContain("fluxo sem dado");
  });

  it("comparabilidade da ponderada e atualidade escritas a partir da gold", () => {
    const t = textoComparabilidade(gold.historico);
    for (const p of gold.historico.ponderacao.perimetros) if (p.primeiro_mes) expect(t).toContain(p.id);
    expect(t).not.toMatch(/ponderada_carga|perimetro_carga/);
    expect(atualidadePld("2026-09-30", "2026-10-01T06:54:27Z").defasada).toBe(false);
    const velho = atualidadePld("2026-09-25", "2026-10-01T06:54:27Z");
    expect(velho.defasada).toBe(true);
    expect(velho.texto).toContain("Fonte defasada");
    expect(velho.texto).toContain("6 dias");
  });
});

describe("gráfico, tabela e exportação com as mesmas linhas", () => {
  it("P009: semanas do gráfico e da tabela iguais às colunas da gold e ao CSV semanal publicado", () => {
    const pub = csv("pld_cmo_semanal.csv");
    for (const sm of SUBMERCADOS) {
      const linhas = linhasSemanais(gold.cmo_pld, sm);
      expect(linhas).toHaveLength(gold.cmo_pld.semanal.fim.length);
      const m = matrizExportacao(COLUNAS_SEMANAS, linhas);
      expect(m.linhas).toHaveLength(linhas.length);
      for (let i = 0; i < linhas.length; i++) {
        const l = linhas[i];
        expect(m.linhas[i]).toEqual([l.inicio, l.fim, l.decomp, l.dessem, l.pld]);
        const c = pub.find((r) => r.semana_fim === l.fim && r.sm === sm);
        if (!c) continue;
        for (const [campo, col] of [["decomp", "decomp_media_semanal"], ["dessem", "dessem_media"], ["pld", "pld_media"]] as const) {
          const g = l[campo];
          expect(c[col] === "", `${sm} ${l.fim} ${campo}`).toBe(g === null);
          // a gold arredonda a centavos e o CSV guarda quatro casas: meio centavo, mais a folga da representação binária
          if (g !== null) expect(Math.abs(Number(c[col]) - g), `${sm} ${l.fim} ${campo}`).toBeLessThanOrEqual(0.005 + 1e-9);
        }
      }
    }
  });

  it("P010: calendário (mapa), tabela e CSV diário com as mesmas horas por dia; permanência igual à gold", () => {
    const pub = csv("pld_limites_diario.csv");
    for (const sm of SUBMERCADOS) {
      const tab = linhasCalendario(lim.calendario, sm);
      const cal = calendarioLimite(lim.calendario, sm, "piso");
      const celulas = cal.valores.flat().filter((v) => typeof v === "number" || v === null);
      expect(celulas).toEqual(tab.map((l) => l.horas_piso));
      for (const l of tab) {
        const c = pub.find((r) => r.data === l.dia && r.sm === sm);
        expect(c, `${sm} ${l.dia}`).toBeTruthy();
        expect(Number(c!.horas_no_piso), `${sm} ${l.dia}`).toBe(l.horas_piso);
        expect(Number(c!.horas_no_teto_horario), `${sm} ${l.dia}`).toBe(l.horas_teto_horario);
        expect(c!.media_no_teto_estrutural === "1", `${sm} ${l.dia}`).toBe(l.teto_estrutural === "média no teto estrutural");
      }
      // janela de 183 dias: os últimos dias, nas mesmas posições
      expect(linhasCalendario(lim.calendario, sm, 183)).toEqual(tab.slice(-183));
      const perm = linhasPermanencia(lim, sm);
      const m = matrizExportacao(COLUNAS_PERMANENCIA, perm);
      for (let i = 0; i < perm.length; i++) {
        const l = perm[i];
        const p = lim.permanencia_anual.find((x) => x.sm === sm && String(x.ano) === l.id)!;
        expect(l.piso_pct).toBe(emPct(p.frac_piso));
        expect(l.horas_piso).toBe(p.horas_piso);
        expect(m.linhas[i][COLUNAS_PERMANENCIA.findIndex((c) => c.id === "horas_piso")]).toBe(p.horas_piso);
      }
    }
  });

  it("P011: linhas mensais iguais às colunas da gold e ao CSV mensal", () => {
    const pub = csv("pld_mensal.csv");
    for (const sm of SUBMERCADOS) {
      const linhas = linhasMensais(gold.historico, sm);
      const m = matrizExportacao(COLUNAS_MENSAIS, linhas);
      expect(m.linhas).toHaveLength(gold.historico.mensal.meses.length);
      for (const l of linhas) {
        const c = pub.find((r) => r.mes === l.m && r.sm === sm)!;
        for (const [campo, col] of [["temporal", "media_temporal"], ["ponderada_carga", "media_ponderada_carga"], ["ponderada_carga_sem_mmgd", "media_ponderada_carga_sem_mmgd"]] as const) {
          const g = l[campo] as number | null;
          expect(c[col] === "", `${sm} ${l.m} ${campo}`).toBe(g === null);
          if (g !== null) expect(Math.abs(Number(c[col]) - g)).toBeLessThanOrEqual(0.005 + 1e-9);
        }
        expect(l.perimetro).toBe(c.perimetro_carga);
      }
    }
  });

  it("P011: o recorte do mapa hora × dia são as últimas linhas do arquivo, sem preencher ausência", () => {
    const arq = JSON.parse(readFileSync(path.join(SERIES, "pld_hora_dia.json"), "utf-8")) as PldHoraDiaArquivo;
    for (const n of [30, 60, 90]) {
      const r = horaDiaRecorte(arq, "SE", n);
      expect(r.linhas.map((l) => l.id)).toEqual(arq.dias.slice(-n));
      expect(r.valores).toEqual(arq.SE.slice(-n));
    }
  });

  it("P012: separação por par, matriz e perfil horário com os valores da gold (fração em %)", () => {
    for (const per of gold.regional.periodos.map((p) => p.id)) {
      const linhas = linhasSeparacao(gold.regional, per);
      const m = matrizExportacao(COLUNAS_SEPARACAO, linhas);
      for (let i = 0; i < PARES.length; i++) {
        const par = PARES[i];
        const s = gold.regional.separacao.find((x) => x.periodo === per && x.par === par)!;
        expect(linhas[i].frac).toBe(emPct(s.frac_separadas));
        expect(m.linhas[i][COLUNAS_SEPARACAO.findIndex((c) => c.id === "separadas")]).toBe(s.horas_separadas);
      }
    }
    const mat = matrizRegional(gold.regional, "dif_media");
    const tab = linhasMatriz(gold.regional);
    for (const l of tab) {
      const [a, b] = String(l.id).split("_");
      const i = gold.regional.matriz.ordem.indexOf(a as "SE");
      const j = gold.regional.matriz.ordem.indexOf(b as "SE");
      expect(mat.valores[i][j]).toBe(l.dif_media);
    }
    for (let k = 0; k < 4; k++) expect(mat.valores[k][k]).toBe("nao-se-aplica");
    const perfil = serieSeparacaoHoraria(gold.regional);
    expect(perfil).toHaveLength(24);
    for (const par of PARES) expect(perfil.map((h) => h[par])).toEqual(gold.regional.perfil_horario_separacao_12m[par].map(emPct));
  });

  it("fichas de prova dos painéis completas (sem aviso de evidência incompleta) e com o valor exibido", () => {
    const ids = [
      ...SUBMERCADOS.flatMap((sm) => [`pld_semana_${sm}`, `dessem_semana_${sm}`, `piso_${gold.referencia.dia.slice(0, 4)}_${sm}`]),
      ...PARES.map((p) => `separacao_12m_${p}`),
      ...SUBMERCADOS.flatMap((sm) => [`ponderada_${gold.historico.ponderacao.sensibilidade_peso?.mes}_${sm}`, `ponderada_sem_mmgd_${gold.historico.ponderacao.sensibilidade_peso?.mes}_${sm}`]),
      "a02_zeros",
    ];
    // todas as fichas publicadas são usadas por alguma página
    expect([...ids].sort()).toEqual(Object.keys(gold.evidencias.indice).sort());
    const f = fichasPld(gold.evidencias.arquivo, ids);
    expect(Object.keys(f).sort()).toEqual([...ids].sort());
    for (const [id, ev] of Object.entries(f)) {
      expect(problemasEvidencia(ev), id).toEqual([]);
      expect(ev.valor_exibido, id).toBe(gold.evidencias.indice[id].valor_exibido);
    }
    // só arquivos do próprio módulo, sem sair da pasta de séries
    expect(fichasPld("/energia/series/../gold/pld_detalhe.json", ids)).toEqual({});
  });
});

describe("páginas renderizadas no servidor", () => {
  const paginas: Record<PainelPld, () => JSX.Element> = { p008: PaginaP008, p009: PaginaP009, p010: PaginaP010, p011: PaginaP011, p012: PaginaP012 };
  const html = Object.fromEntries(Object.entries(paginas).map(([k, P]) => [k, renderToStaticMarkup(createElement(P))])) as Record<PainelPld, string>;
  const ref = gold.cmo_pld.semana_referencia!;
  const esc = (t: string) => t.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const respostas: Record<PainelPld, string> = {
    p008: respostaP008(gold.conceito, ligacoesFormacao(NOS_FORMACAO, gold.conceito.fontes_textuais)),
    p009: respostaP009(gold.cmo_pld, "SE"),
    p010: respostaP010(lim, Number(gold.referencia.dia.slice(0, 4)), "SE", gold.referencia.dia),
    p011: respostaP011(gold.historico, "SE"),
    p012: respostaP012(gold.regional, "12m"),
  };

  it("cada painel na sua página, com pergunta como título, resposta derivada e a anatomia da seção 7.2", () => {
    for (const p of PAINEIS_PLD) {
      const h = html[p.id];
      expect(h, p.id).toContain(`id="${p.id}"`);
      expect(h, p.id).toContain(`id="${p.id}-titulo"`);
      expect(h, p.id).toContain(esc(perguntaPainel(p.id)));
      expect(h, p.id).toContain(`data-resposta="${p.id}"`);
      expect(h, p.id).toContain(esc(respostas[p.id].slice(0, 60)));
      for (const parte of ["Período", "Universo", "Unidade", "Como interpretar", "O que não é possível concluir", "Próxima pergunta", "Copiar link deste painel", "Baixar"]) {
        expect(h, `${p.id}: ${parte}`).toContain(parte);
      }
      expect(h, p.id).toContain('role="radiogroup" aria-label="Nível de profundidade"');
      expect(h, p.id).toContain('data-nivel="analisar"');
      expect(h, p.id).toContain('data-nivel="auditar"');
      // navegação local única: a abertura (P008) mostra os outros painéis como capítulos depois da figura principal; nas filhas, a faixa de
      // páginas irmãs traz a atual com aria-current. O mesmo rótulo não aparece nas duas formas na mesma página.
      if (p.id === "p008") {
        expect(h, p.id).toContain('data-navegacao-local="capitulos"');
        expect(h, p.id).not.toContain('data-navegacao-local="faixa"');
        for (const q of PAINEIS_PLD.filter((x) => x.id !== "p008")) expect(h, `${p.id} -> ${q.id}`).toContain(`href="${rotaPainel(q.id)}"`);
      } else {
        expect(h, p.id).toContain('data-navegacao-local="faixa"');
        expect(h, p.id).not.toContain('data-navegacao-local="capitulos"');
        for (const q of PAINEIS_PLD) expect(h, `${p.id} -> ${q.id}`).toContain(`href="${rotaPainel(q.id)}"`);
        expect(h, p.id).toMatch(new RegExp(`aria-current="page"[^>]*>${p.rotulo}<`));
      }
      expect(h.slice(h.indexOf("<main")), p.id).not.toMatch(/em breve|em constru|em integra/i);
      expect(h.length, p.id).toBeLessThan(520_000);
    }
  });

  it("painéis numéricos com prova, tabelas equivalentes e exportação", () => {
    for (const id of ["p009", "p010", "p011", "p012"] as const) {
      const h = html[id];
      // o diálogo da ficha só existe no cliente (portal); no HTML do servidor cada ficha é o seu gatilho
      expect((h.match(/data-comprove=""/g) ?? []).length, id).toBeGreaterThanOrEqual(1);
      expect((h.match(/<table/g) ?? []).length, id).toBeGreaterThanOrEqual(5);
      expect(h, id).toContain("Baixar CSV");
      expect(h, id).toContain("Tabela equivalente");
    }
  });

  it("P008: diagrama navegável, exemplo sintético rotulado e âncoras antigas preservadas", () => {
    const h = html.p008;
    for (const a of ["o-que-e", "formacao", "hoje", "submercados", "previsao", "cmo", "periodos", "p008"]) expect(h, a).toContain(`id="${a}"`);
    expect(h).toContain('aria-label="Etapas da formação do PLD"');
    expect(h).toContain("Exemplo sintético, não é contabilização real");
    expect(h).toContain(esc(gold.conceito.exemplo_liquidacao.aviso));
    expect(h).toContain(reais(gold.conceito.exemplo_liquidacao.pld.valor));
    // cada etapa diz no botão se as ligações estão conferidas; a etapa aberta por padrão tem a ligação pendente escrita como tal
    expect(h).toContain("ligações conferidas");
    expect(h).toContain("conferência documental pendente");
    for (const sm of ref.por_sm) expect(h).toContain(reais(sm.decomp));
  });

  it("P009 a P012: o que cada critério de aceite pede está na página", () => {
    // P009: semanas operativas, não dias; três produtos separados
    expect(html.p009).toContain("Semana operativa de " + dataBR(ref.inicio));
    expect(html.p009).toContain("CMO semanal do DECOMP (ONS)");
    expect(html.p009).toContain('data-textos="a02"');
    // P010: atos com nível de conferência, tolerância documentada e o menor observado só como conferência
    expect(html.p010).toContain(esc(lim.conferencia_atos.leitura));
    expect(html.p010).toContain(esc(lim.tolerancia.justificativa));
    expect(html.p010).toContain("nunca substitui o piso");
    for (const a of lim.atos) expect(html.p010).toContain(esc(a.ato));
    // P011: temporal e ponderada nomeadas; mês parcial e perímetro sinalizados
    expect(html.p011).toContain("Média temporal (todas as horas pesam igual)");
    expect(html.p011).toContain("Ponderada pela carga do balanço do ONS");
    expect(html.p011).toContain('data-textos="comparabilidade"');
    // P012: mesma hora, sem diagnóstico causal
    expect(html.p012).toContain("na mesma hora");
    expect(html.p012).toContain("não diz por quê");
    expect(html.p012).not.toMatch(/congestionad[oa] (em|na|no)\b/);
  });

  it("gold ausente: indisponibilidade com o motivo, sem número de reserva", () => {
    const h = renderToStaticMarkup(createElement(PldIndisponivel, { motivo: "gold reprovada na validação" }));
    expect(h).toContain("Painel do PLD indisponível nesta publicação");
    expect(h).toContain("gold reprovada na validação");
    expect(h.slice(h.indexOf("<main"))).not.toMatch(/\d{2},\d{2}/);
  });
});

/* ====================================================================== */
/* Abertura do PLD: o preço antes da aula, e as páginas filhas no sistema  */
/* editorial                                                              */
/* ====================================================================== */

const pldGold = JSON.parse(readFileSync(path.join(RAIZ, "public/energia/gold/pld.json"), "utf-8")) as PldGold & { amplitude_dia: number };
const redeGold = JSON.parse(readFileSync(path.join(RAIZ, "public/energia/gold/rede.json"), "utf-8")) as RedeGold;
const escHtml = (t: string) => t.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
/** Atributos da etiqueta de abertura de uma seção pelo id (SecaoDoPainel e PainelEvidencia), ou null quando a seção não está na página. */
const atributosDaSecao = (h: string, id: string) => new RegExp(`<section id="${id}"([^>]*)>`).exec(h)?.[1] ?? null;
const centavos = (v: number) => Math.round(v * 100);
const mediasDe = (v: Record<string, number>): MediaDiariaSm[] => linhasMediaDiaria(SUBMERCADOS.map((sm) => ({ sm, media_dia: v[sm], variacao_dia_anterior: null })));

describe("média diária por submercado: uma lista só, extremos com empates e distância entre as regiões", () => {
  const linhas = linhasMediaDiaria(pldGold.cartoes);
  const e = extremosMediaDiaria(linhas)!;

  it("a lista sai dos cartões da gold, na ordem regional, e coincide com a série diária e com o resumo do dia", () => {
    expect(linhas.map((l) => l.id)).toEqual([...SUBMERCADOS]);
    const ultimo = pldGold.diario[pldGold.diario.length - 1];
    expect(ultimo.d).toBe(pldGold.dia_referencia);
    for (const l of linhas) {
      expect(l.media).toBe(pldGold.cartoes.find((c) => c.sm === l.id)!.media_dia);
      expect(l.media).toBe(ultimo[l.id]);
      expect(l.media).toBe(pldGold.periodos.hoje.por_submercado[l.id].media);
    }
  });

  it("menor e maior média com todos os submercados empatados nos centavos, e a distância igual à que a gold publica", () => {
    const cent = linhas.map((l) => centavos(l.media));
    expect(e.menor.submercados).toEqual(linhas.filter((l) => centavos(l.media) === Math.min(...cent)).map((l) => l.id));
    expect(e.maior.submercados).toEqual(linhas.filter((l) => centavos(l.media) === Math.max(...cent)).map((l) => l.id));
    expect(e.menor.valor).toBe(linhas.find((l) => l.id === e.menor.submercados[0])!.media);
    expect(e.maior.valor).toBe(linhas.find((l) => l.id === e.maior.submercados[0])!.media);
    // a distância do dia é a mesma conta que a gold de PLD (amplitude_dia) e a de rede (série de amplitude) publicam
    expect(Math.abs(e.distancia - pldGold.amplitude_dia)).toBeLessThanOrEqual(0.0051);
    const serie = redeGold.serie_amplitude_pld.find((a) => a.d === pldGold.dia_referencia);
    if (serie) expect(Math.abs(e.distancia - serie.amplitude)).toBeLessThanOrEqual(0.0051);
  });

  it("empate no maior valor aparece com os dois submercados; empate no menor também; diferença abaixo do centavo é empate", () => {
    const dia30 = extremosMediaDiaria(mediasDe({ SE: 135.25, S: 127.86, NE: 124.93, N: 135.25 }))!;
    expect(dia30.maior).toEqual({ valor: 135.25, submercados: ["SE", "N"] });
    expect(dia30.menor).toEqual({ valor: 124.93, submercados: ["NE"] });
    expect(dia30.distancia).toBe(10.32);
    expect(nomesDosSubmercados(dia30.maior.submercados)).toBe("SE/CO e Norte");
    expect(textoEmpatesMediaDiaria(dia30)).toBe(`Empate na maior média: SE/CO e Norte, ${reais(135.25)}/MWh.`);
    const doisMenores = extremosMediaDiaria(mediasDe({ SE: 100, S: 100, NE: 120, N: 130 }))!;
    expect(doisMenores.menor.submercados).toEqual(["SE", "S"]);
    expect(textoEmpatesMediaDiaria(doisMenores)).toContain("Empate na menor média: SE/CO e Sul");
    const subCentavo = extremosMediaDiaria(mediasDe({ SE: 135.251, S: 127.86, NE: 124.93, N: 135.249 }))!;
    expect(subCentavo.maior.submercados).toEqual(["SE", "N"]);
    expect(subCentavo.distancia).toBe(10.32);
  });

  it("os quatro iguais: distância zero, sem empate escrito; menos de dois submercados com média: sem extremos", () => {
    const iguais = extremosMediaDiaria(mediasDe({ SE: 90, S: 90, NE: 90, N: 90 }))!;
    expect(iguais.distancia).toBe(0);
    expect(nomesDosSubmercados(iguais.menor.submercados)).toBe("os quatro submercados");
    expect(vereditoMediaDiaria("2026-09-30", iguais)).toContain("igual nos quatro submercados");
    expect(textoEmpatesMediaDiaria(iguais)).toBeNull();
    expect(extremosMediaDiaria(linhasMediaDiaria([{ sm: "SE", media_dia: 100, variacao_dia_anterior: null }]))).toBeNull();
    expect(linhasMediaDiaria([{ sm: "SE", media_dia: Number.NaN, variacao_dia_anterior: null }])).toEqual([]);
  });

  it("veredito com os dois extremos, quem os tem e a distância; sem travessão, sem hoje e sem data ISO", () => {
    const dia30 = extremosMediaDiaria(mediasDe({ SE: 135.25, S: 127.86, NE: 124.93, N: 135.25 }))!;
    const v = vereditoMediaDiaria("2026-09-30", dia30);
    expect(v).toBe(`Em 30/09/2026, a média diária foi de ${reais(124.93)}/MWh (Nordeste) a ${reais(135.25)}/MWh (SE/CO e Norte, mesmo valor); a distância entre o maior e o menor foi de ${reais(10.32)}/MWh.`);
    for (const t of [v, vereditoMediaDiaria(pldGold.dia_referencia, e), textoMudancaMediaDiaria(pldGold.dia_referencia, linhas)]) {
      expect(t).not.toMatch(SEM_TRAVESSAO);
      expect(t).not.toMatch(/\bhoje\b|\bagora\b|\d{4}-\d{2}-\d{2}|undefined|NaN/i);
    }
  });

  it("variação contra o dia anterior: só o que o grupo tem em comum nos centavos; diferente entre os empatados, nada é afirmado", () => {
    const comVariacao = linhasMediaDiaria(SUBMERCADOS.map((sm) => ({ sm, media_dia: 100, variacao_dia_anterior: { abs: sm === "NE" ? 2.53 : 12.84, pct: sm === "NE" ? 2.1 : 10.5 } })));
    expect(variacaoComumDoGrupo(comVariacao, ["SE", "N"])).toBe(12.84);
    expect(variacaoComumDoGrupo(comVariacao, ["SE", "NE"])).toBeNull();
    expect(variacaoComumDoGrupo(comVariacao, [])).toBeNull();
    expect(variacaoComumDoGrupo(mediasDe({ SE: 1, S: 2, NE: 3, N: 4 }), ["SE"])).toBeNull();
    const t = textoMudancaMediaDiaria("2026-09-30", comVariacao);
    expect(t).toContain("Em relação ao dia anterior (29/09/2026)");
    expect(t).toContain(`Nordeste: ${reais(2.53)}/MWh acima (2,1%)`);
    expect(textoMudancaMediaDiaria("2026-09-30", mediasDe({ SE: 1, S: 2, NE: 3, N: 4 }))).toBe("Sem a média do dia anterior para comparar com 30/09/2026.");
    expect(diaAnterior("2026-03-01")).toBe("2026-02-28");
    expect(diaAnterior("2026-01-01")).toBe("2025-12-31");
  });

  it("referência da distância: média e maior valor dos 30 dias, só quando o resumo é do mesmo dia", () => {
    const r = redeGold.resumo_amplitude!;
    expect(r.media_30d).not.toBeNull();
    const t = textoReferenciaDistancia(r, r.dia)!;
    expect(t).toContain(reais(r.media_30d!));
    expect(t).toContain(reais(r.maior_30d.valor));
    expect(textoReferenciaDistancia(r, "2000-01-01")).toBeNull();
    expect(textoReferenciaDistancia(null, r.dia)).toBeNull();
  });
});

describe("limites vigentes no dia: o trecho certo e cada limite com o objeto a que se aplica", () => {
  const regimes = gold.limites.disponivel ? gold.limites.regimes : [];

  it("o trecho vigente é o que cobre o dia (e não o último da lista); fora de qualquer trecho, nenhum", () => {
    expect(regimes.length).toBeGreaterThan(2);
    const r = regimeVigenteEm(regimes, gold.referencia.dia)!;
    expect(r.inicio <= gold.referencia.dia && gold.referencia.dia <= r.fim).toBe(true);
    const anterior = regimes[regimes.length - 2];
    expect(regimeVigenteEm(regimes, anterior.fim)).toEqual(anterior);
    expect(regimeVigenteEm(regimes, anterior.inicio)).toEqual(anterior);
    expect(regimeVigenteEm(regimes, "2000-01-01")).toBeNull();
  });

  it("piso e teto horário valem para cada hora; o teto estrutural, para a média diária; ato único ou um por limite", () => {
    const r = regimeVigenteEm(regimes, gold.referencia.dia)!;
    const t = textoLimitesVigentes(r);
    for (const v of [r.pld_min, r.pld_max_horario, r.pld_max_estrutural]) expect(t).toContain(`${reais(v)}/MWh`);
    expect(t).toContain("que valem para cada hora");
    expect(t).toContain("que vale para a média diária");
    expect(t).toContain(`desde ${dataBR(r.inicio)}`);
    expect(t).toContain(r.ato_pld_min!);
    expect(t).not.toMatch(SEM_TRAVESSAO);
    const variosAtos = textoLimitesVigentes({ ...r, ato_pld_max_horario: "Ato B", ato_pld_max_estrutural: null });
    expect(variosAtos).toContain("piso: ");
    expect(variosAtos).toContain("teto horário: Ato B");
    expect(variosAtos).toContain("teto estrutural: ato não identificado");
    const semValor = textoLimitesVigentes({ ...r, pld_max_estrutural: null });
    expect(semValor).toContain("teto estrutural de sem valor integrado");
    expect(semValor).not.toContain("–");
  });
});

describe("abertura do PLD: o preço antes da aula (página renderizada)", () => {
  const h = renderToStaticMarkup(createElement(PaginaP008));
  const pos = (t: string) => {
    const i = h.indexOf(t);
    expect(i, t).toBeGreaterThan(-1);
    return i;
  };
  const faixa = /<section[^>]*data-faixa-metricas[^>]*>[\s\S]*?<\/section>/.exec(h)![0];
  const dia = pldGold.dia_referencia;
  const linhas = linhasMediaDiaria(pldGold.cartoes);
  const e = extremosMediaDiaria(linhas)!;

  it("título curto em forma de pergunta e uma faixa de três medidas com o menor, o maior (com os empates) e a distância", () => {
    expect((h.match(/<h1/g) ?? []).length).toBe(1);
    expect(h).toMatch(/<h1[^>]*>Quanto custa a energia no curto prazo\?<\/h1>/);
    expect((faixa.match(/data-metrica=""/g) ?? []).length).toBe(3);
    for (const r of ["Menor média diária", "Maior média diária", "Distância entre regiões"]) expect(faixa, r).toContain(`aria-label="${r}"`);
    expect(faixa).toContain(escHtml(`${reais(e.menor.valor)}`));
    expect(faixa).toContain(escHtml(`${reais(e.maior.valor)}`));
    expect(faixa).toContain(escHtml(`${reais(e.distancia)}`));
    expect(faixa).toContain(nomesDosSubmercados(e.maior.submercados));
    if (e.maior.submercados.length > 1) expect(faixa).toContain("mesmo valor");
    expect(faixa).toContain(dataBR(dia));
  });

  it("a regra da média diária fica junto das medidas, e nenhuma medida é um PLD único do Brasil", () => {
    expect(faixa).toContain(escHtml(pldGold.regras.media_diaria));
    expect(faixa).toContain("Não existe um PLD único do Brasil");
    expect(faixa).not.toMatch(/PLD Brasil|PLD do Brasil|PLD nacional|média dos quatro submercados:/i);
    for (const m of Array.from(faixa.matchAll(/aria-label="([^"]+)" data-metrica/g))) expect(m[1]).not.toMatch(/Brasil|SIN|nacional/i);
  });

  it("o preço vem antes da aula: faixa, seletor de profundidade, painel de preços, gráfico, e só depois a aula, a formação e a previsão", () => {
    const ordem = [
      pos("data-faixa-metricas"),
      pos('aria-label="Nível de profundidade"'),
      pos('id="hoje"'),
      pos('data-grafico="barras"'),
      pos('id="periodos"'),
      pos('id="o-que-e"'),
      pos('id="formacao"'),
      pos('id="previsao"'),
    ];
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
    // a aula continua na página, completa e à vista
    for (const t of ["Entenda em 90 segundos", "O que o PLD não é", "Não é a sua tarifa de energia", "não mostra valores de liquidação"]) expect(h, t).toContain(t);
  });

  it("uma navegação local só (capítulos), com as quatro páginas irmãs e as três âncoras da própria página, sem índice, abas nem cartões repetindo rótulos", () => {
    expect((h.match(/data-navegacao-local=/g) ?? []).length).toBe(1);
    const nav = /<nav[^>]*data-navegacao-local="capitulos"[\s\S]*?<\/nav>/.exec(h)![0];
    for (const p of PAINEIS_PLD.filter((x) => x.id !== "p008")) {
      expect(nav, p.id).toContain(`href="${rotaPainel(p.id)}"`);
      expect(nav, p.id).toContain(escHtml(p.pergunta));
    }
    for (const a of ["#o-que-e", "#formacao", "#previsao"]) expect(nav, a).toContain(`href="${a}"`);
    for (const antigo of ['aria-label="Nesta página"', 'aria-label="Painéis do PLD"', 'aria-label="Aprofundar o período recente"']) expect(h, antigo).not.toContain(antigo);
  });

  it("o gráfico principal compara os quatro submercados na mesma escala, com a tabela equivalente e o empate dito junto das barras", () => {
    expect(h).toContain(`Média diária do PLD por submercado, ${dataBR(dia)}`);
    expect(h).toContain("Escala iniciada em zero e igual para os quatro submercados.");
    const empates = textoEmpatesMediaDiaria(e);
    if (empates) expect(h).toContain(escHtml(empates));
    for (const l of linhas) expect(h).toContain(`data-id="${l.id}"`);
    expect(h).toContain("Dados do gráfico em tabela (4 linhas)");
  });

  it("as visões que estavam em Analisar e respondem a uma pergunta própria passam a ficar à vista; regras e auditoria continuam nos seus níveis", () => {
    for (const id of ["periodos", "dia-em-detalhe", "submercados", "amplitude", "cmo", "diagrama-formacao", "exemplo-liquidacao"]) {
      const a = atributosDaSecao(h, id);
      expect(a, id).not.toBeNull();
      expect(a, id).not.toContain("data-nivel");
    }
    for (const id of ["regras", "limites-por-vigencia", "menor-valor-por-ano", "tipos-de-relacao", "normas", "bloqueios", "governanca"]) {
      expect(atributosDaSecao(h, id), id).toContain('data-nivel="');
    }
    expect(atributosDaSecao(h, "limites-por-vigencia")).toContain('data-nivel="auditar"');
    expect(atributosDaSecao(h, "regras")).toContain('data-nivel="analisar"');
    // série horária por região (com as abas de período), cartões do dia, mapa dos submercados e série da distância seguem presentes
    for (const t of ['role="tablist" aria-label="Período"', 'aria-label="Etapas da formação do PLD"', "O dia em detalhe, por submercado", "Quando os submercados se separaram no último ano?"]) expect(h, t).toContain(t);
    expect(h).toContain("percentil ");
    expect(h).toContain("em MWmed (megawatt médio)");
  });

  it("a ressalva essencial está junto do dado: PLD não é tarifa nem fatura, os limites vigentes e o objeto de cada um", () => {
    expect(h).toContain("O PLD não é a tarifa nem a conta de luz: PLD, CMO, tarifa e fatura são medidas diferentes");
    expect(h).toContain('href="/setor-eletrico/conta-de-luz"');
    const r = regimeVigenteEm(gold.limites.disponivel ? gold.limites.regimes : [], dia)!;
    expect(h).toContain(escHtml(textoLimitesVigentes(r)));
    expect(h).toContain("Limites vigentes");
  });

  it("a resposta em palavras vem depois do gráfico (a faixa de medidas já traz os números primeiro) e o gráfico fica antes dela", () => {
    const tag = /<[^>]*data-resposta="hoje"[^>]*>/.exec(h)![0];
    expect(tag).toContain("data-resposta-depois");
    expect(pos('data-resposta="hoje"')).toBeGreaterThan(pos('data-grafico="barras"'));
    expect(pos('data-resposta="hoje"')).toBeGreaterThan(pos("data-faixa-metricas"));
    // as respostas de outros painéis não ganham a marca: ela é do primeiro quadro desta página
    expect((h.match(/data-resposta-depois/g) ?? []).length).toBe(1);
  });

  it("'Há diferença entre submercados?' diz o limiar do cartão (R$ 1,00) e o das Diferenças regionais (R$ 0,01), com o caminho até lá", () => {
    const c = /data-texto="criterio-da-diferenca"[^>]*>([\s\S]*?)<\/span>/.exec(h);
    expect(c).not.toBeNull();
    const texto = c![1].replace(/<[^>]+>/g, "");
    expect(texto).toMatch(/diferem em mais de R\$\s*1,00\/MWh/);
    expect(texto).toMatch(/acima de R\$\s*0,01\/MWh/);
    expect(c![1]).toContain('href="/setor-eletrico/pld/diferencas-regionais"');
    expect(texto).not.toMatch(SEM_TRAVESSAO);
  });

  it("'Não é a sua tarifa de energia' leva a frase do registro de contrastes e o caminho até a conta de luz", () => {
    const contraste = CONTRASTES.find((x) => x.a === "pld" && x.b === "tarifa-te-tusd");
    expect(contraste?.texto).toBeTruthy();
    const bloco = /data-texto="pld-e-conta"[^>]*>([\s\S]*?)<\/div>/.exec(h);
    expect(bloco).not.toBeNull();
    // a frase do registro repete o que o cartão já diz sem expandir TE e TUSD: fica em Analisar; o link fica à vista em Entender
    expect(bloco![1]).toMatch(new RegExp(`<p data-nivel="analisar"[^>]*>${escHtml(contraste!.texto).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</p>`));
    expect(bloco![1]).toContain('href="/setor-eletrico/conta-de-luz"');
    expect(bloco![1]).toContain("Ver como a conta de luz é formada");
    expect(h).toContain("Tarifa de Energia (TE) e a Tarifa de Uso do Sistema de Distribuição (TUSD)");
  });

  it("o mapa dos submercados usa preço e fluxo do mesmo dia, diz isso, e conta as horas de cada fronteira em cada sentido", () => {
    if (redeGold.dia_referencia !== pldGold.dia_referencia) {
      const t = /data-texto="mapa-mesmo-dia"[^>]*>([\s\S]*?)<\/p>/.exec(h);
      expect(t).not.toBeNull();
      expect(t![1]).toContain(`O último dia com PLD é ${dataBR(pldGold.dia_referencia)}; o fluxo do ONS está publicado até ${dataBR(redeGold.dia_referencia)}.`);
    }
    const lista = /data-texto="horas-por-sentido"[^>]*>([\s\S]*?)<\/ul>/.exec(h);
    expect(lista).not.toBeNull();
    const sentidos = horasPorSentidoNoDia(rec, redeGold.dia_referencia).filter((x) => x.horas > 0);
    expect(sentidos.length).toBeGreaterThan(0);
    for (const x of sentidos) expect(lista![1]).toContain(`<li>${escHtml(textoSentidoNoDia(x)!)}</li>`);
    expect(lista![1]).toContain(`Horas em cada sentido em ${dataBR(redeGold.dia_referencia)}`);
  });

  it("a ideia central diz a base do Balanço do ONS e a MMGD estimada; 'geração verificada' fica só no exemplo sintético de liquidação", () => {
    const texto = textoHidraulicaBalanco(goldDoObservatorio.geracao())!;
    expect(h).toContain(escHtml(texto));
    const semExemplo = h.replace(/<section id="exemplo-liquidacao"[\s\S]*?<\/section>/, "");
    expect(semExemplo).not.toMatch(/gera[çc][ãa]o verificada/i);
    expect(h).toContain("Balanço de Energia nos Subsistemas do ONS");
  });

  it("a distribuição desde 2021 vem com a ressalva de que os valores são nominais e de anos com limites diferentes", () => {
    const nota = /data-nota="nominal-e-regimes"[^>]*>([\s\S]*?)<\/p>/.exec(h);
    expect(nota).not.toBeNull();
    expect(nota![1]).toContain(escHtml(textoRegimesDistribuicao(lim)!));
  });

  it("as outras perguntas do PLD entram como capítulos num título de nível 3, dentro do painel, e não como um h2 solto", () => {
    expect(h).toMatch(/<h3[^>]*>Outras perguntas sobre o preço<\/h3>/);
    expect(h).not.toMatch(/<h2[^>]*>Outras perguntas sobre o preço<\/h2>/);
  });

  it("nenhum texto da página repete a ressalva antiga de que os limites não foram auditados", () => {
    expect(h).not.toMatch(/não (foram|foi) auditados? nesta fase/);
  });

  it("o que a abertura escreve de novo (cabeçalho, faixa e notas do painel) não usa hoje, agora, travessão nem data ISO solta", () => {
    const inicio = h.indexOf('<header class="cab-modulo"');
    expect(inicio).toBeGreaterThan(-1);
    const cabecalho = h.slice(inicio, h.indexOf("</header>", inicio));
    const notas = Array.from(h.matchAll(/<div data-notas-painel[\s\S]*?<\/aside><\/div>/g)).map((m) => m[0]);
    expect(notas.length).toBeGreaterThanOrEqual(3);
    const novo = [cabecalho, faixa, ...notas].join(" ").replace(/<[^>]+>/g, " ");
    expect(novo).not.toMatch(/\bhoje\b|\bagora\b/i);
    expect(novo).not.toMatch(/—|–/);
    expect(novo).not.toMatch(/(^|[\s(])20\d\d-\d\d-\d\d(?=[\s).,;]|$)/);
    expect(novo).not.toMatch(/undefined|NaN/);
  });
});

describe("páginas filhas do PLD no sistema editorial", () => {
  const paginas = { p009: PaginaP009, p010: PaginaP010, p011: PaginaP011, p012: PaginaP012 } as const;
  const html = Object.fromEntries(Object.entries(paginas).map(([k, P]) => [k, renderToStaticMarkup(createElement(P))])) as Record<keyof typeof paginas, string>;
  const visiveis: Record<keyof typeof paginas, string[]> = {
    p009: ["mesma-hora", "relacao-anual", "nao-equivalencia"],
    p010: ["calendario", "piso-por-submercado", "empates-piso"],
    p011: ["sazonalidade", "distribuicao", "perfil-hora-mes", "mapa-hora-dia"],
    p012: ["perfil-horario"],
  };
  const emAnalisar: Record<keyof typeof paginas, string[]> = {
    p009: ["produtos", "a02"],
    p010: ["atos"],
    p011: ["comparar"],
    p012: ["hora-a-hora", "fluxo-nas-horas-separadas"],
  };

  for (const id of Object.keys(paginas) as (keyof typeof paginas)[]) {
    it(`${id}: a pergunta do painel é o título da página, a primeira figura tem título próprio e a faixa de medidas fica no painel`, () => {
      const h = html[id];
      const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(h)![1];
      expect(h1).toBe(escHtml(perguntaPainel(id)));
      const h2 = new RegExp(`<h2 id="${id}-titulo"[^>]*>([\\s\\S]*?)</h2>`).exec(h)![1];
      expect(h2).not.toBe(h1);
      expect((h.match(/data-faixa-metricas/g) ?? []).length).toBe(1);
      expect((h.match(/data-metrica=""/g) ?? []).length).toBe(4);
      // migalha do módulo acima do título e a faixa de páginas irmãs com a atual marcada
      expect(h).toContain("Preço de Liquidação das Diferenças");
      expect(h).toContain('data-navegacao-local="faixa"');
      expect((h.match(/data-navegacao-local=/g) ?? []).length).toBe(1);
    });

    it(`${id}: as visões complementares com pergunta própria ficam à vista e as de ferramenta e auditoria seguem em Analisar e Auditar`, () => {
      const h = html[id];
      for (const s of visiveis[id]) {
        const a = atributosDaSecao(h, s);
        expect(a, s).not.toBeNull();
        expect(a, s).not.toContain("data-nivel");
      }
      for (const s of emAnalisar[id]) expect(atributosDaSecao(h, s), s).toContain('data-nivel="analisar"');
      expect((h.match(/data-nivel="auditar"/g) ?? []).length).toBeGreaterThan(0);
    });
  }

  it("diferenças regionais: o fluxo na mesma hora continua em Analisar, e a página diz isso à vista", () => {
    expect(html.p012).toContain("estão no nível Analisar");
    expect(atributosDaSecao(html.p012, "hora-a-hora")).toContain('data-nivel="analisar"');
  });

  it("histórico: a faixa sazonal e a distribuição por regime anual dizem nominal, sazonalidade e limites próprios de cada ano", () => {
    const h = html.p011;
    // a ressalva ficou mais forte que a frase antiga: nominal, sem correção pela inflação, anos com limites diferentes, com o piso e os tetos de cada regime
    expect(h).toContain("Os valores são nominais, sem correção pela inflação, e de anos com limites diferentes");
    expect(h).toMatch(/o piso foi de R\$\s*49,77 a R\$\s*69,04\/MWh e o teto horário teve 6 valores diferentes/);
    expect(h).toMatch(/em 3 anos \(2022, 2023 e 2024\), de 63,6% a 98,3% das horas do Sudeste\/Centro-Oeste ficaram no piso/);
    expect(h).toMatch(/O IPCA acumulou cerca de 37% de jan\/2021 a ago\/2026/);
    expect(h).toContain("A série semanal do PLD de 2001 a 2020, que a CCEE também publica, tem outra granularidade e ainda não está integrada");
    expect(h).toContain("Média diária frente ao mesmo mês e à mesma semana de anos anteriores");
    expect(h).toContain("As três médias mensais usam");
  });

  it("limites: piso e teto horário valem para cada hora e o teto estrutural, para a média do dia, no bloco dos limites do ano", () => {
    const h = html.p010;
    expect(h).toContain("Teto estrutural <span class=\"text-xs\">(média do dia)</span>");
    expect(h).toContain("Piso <span class=\"text-xs\">(cada hora)</span>");
    expect(h).toContain("Teto horário <span class=\"text-xs\">(cada hora)</span>");
  });

  it("a resposta e a figura principal abrem o painel e a faixa de medidas vem depois da figura, para o começo dela caber na primeira tela", () => {
    const primeiraFigura: Record<keyof typeof paginas, string> = {
      p009: "CMO semanal do DECOMP, média do DESSEM e média do PLD por semana operativa",
      p010: 'data-grafico="barras"',
      p011: 'id="sazonalidade"',
      p012: 'data-grafico="barras"',
    };
    for (const id of Object.keys(paginas) as (keyof typeof paginas)[]) {
      const h = html[id];
      const resposta = h.indexOf(`data-resposta="${id}"`);
      const figura = h.indexOf(primeiraFigura[id]);
      const faixa = h.indexOf("data-faixa-metricas");
      expect(resposta, id).toBeGreaterThan(-1);
      expect(figura, `${id}: figura`).toBeGreaterThan(resposta);
      expect(faixa, `${id}: faixa depois da figura`).toBeGreaterThan(figura);
    }
  });

  it("nenhuma página filha repete a ressalva antiga de que os limites não foram auditados nesta fase", () => {
    for (const [id, h] of Object.entries(html)) expect(h, id).not.toMatch(/não (foram|foi) auditados? nesta fase/);
  });

  it("cmo-e-formacao: os quatro submercados na mesma semana ficam à vista, com a distância de cada produto e a ressalva de que a página descreve e não explica", () => {
    const h = html.p009;
    const a = atributosDaSecao(h, "quatro-submercados");
    expect(a).not.toBeNull();
    expect(a).not.toContain("data-nivel");
    const p = partesDistanciaSemanal(gold.cmo_pld.semana_referencia)!;
    expect(h).toContain('data-texto="distancia-semanal"');
    expect(h).toContain(escHtml(p.introducao));
    for (const item of p.itens) expect(h).toContain(escHtml(item));
    expect(h).toContain(escHtml(p.ressalva));
    expect(h).toContain("Sequências de 4 semanas seguidas ou mais com CMO semanal zero, por subsistema (desde 2005)");
    // os títulos de seção e de figura não levam código de achado nem o nome interno da camada de dados (os controles automáticos, em Auditar, citam o nome do controle)
    const titulos = Array.from(h.matchAll(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/g)).map((m) => m[1].replace(/<[^>]+>/g, ""));
    expect(titulos.length).toBeGreaterThan(5);
    for (const t of titulos) expect(t).not.toMatch(/achado A0\d|\bA0\d\b|silver|gold|pipeline/i);
    expect(h).toContain("ONS (CMO) e CCEE (PLD)");
  });

  it("limites: o calendário diz a janela de dias que mostra, a norma aparece com as passagens da REN 1.032/2022 e a nota do teto cita a regra", () => {
    const h = html.p010;
    expect(h).toContain("Em quais dos últimos dias o preço ficou no limite?");
    expect(h).toContain(`${dataBR(lim.calendario.dias[0])} a ${dataBR(lim.calendario.dias[lim.calendario.dias.length - 1])}`);
    expect(h).toContain("qualquer que seja o Ano escolhido acima");
    // a lista por data aparece quando o calendário inicial (piso, Sudeste/Centro-Oeste) tem poucos dias no limite; com muitos, o calendário fala por si
    const inicial = textoDiasNoLimite(diasNoLimite(lim.calendario, "SE", "piso", lim.calendario.dias.length), "piso", lim.calendario.dias.length);
    if (inicial) expect(h).toContain(escHtml(inicial));
    else expect(h).not.toContain('data-texto="dias-no-limite"');
    expect(ler("src/components/energia/PldLimites.tsx")).toContain("textoDiasNoLimite(");
    const passagens = (conceito("limites-do-pld")?.fontes ?? []).filter((f) => f.trecho && /1\.032/.test(f.documento));
    expect(passagens.length).toBeGreaterThan(0);
    expect(atributosDaSecao(h, "norma-limites")).toContain('data-nivel="auditar"');
    for (const f of passagens) expect(h).toContain(escHtml(f.trecho!));
    expect(h).toContain(escHtml(notaTetoComConfirmacaoEmpirica(lim.nota_teto_estrutural)));
    expect(h).not.toContain("A regra de aplicação não está");
  });

  it("histórico: as marcas do gráfico mensal são numeradas, com a legenda em lista, e o mapa de calor tem a grade de 24 horas e as faixas de 4 horas", () => {
    const h = html.p011;
    const { marcos, legenda } = marcosNumerados(gold.historico);
    const ol = /<ol[^>]*data-legenda="marcas-do-grafico"[^>]*>([\s\S]*?)<\/ol>/.exec(h);
    expect(ol).not.toBeNull();
    expect((ol![1].match(/<li/g) ?? []).length).toBe(legenda.length);
    for (const l of legenda) expect(ol![1]).toContain(escHtml(l.texto));
    expect(marcos.map((m) => m.rotulo)).toEqual(legenda.map((l) => String(l.n)));
    // a troca entre grade larga e faixas é de CSS: as duas formas estão no HTML, e a grade de 24 horas da tela estreita só se monta ao abrir
    // (o mapa hora × dia só se monta no cliente, ao entrar na tela; no HTML do servidor está o mapa hora × mês)
    expect((h.match(/data-mapa-horas="largo"/g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect((h.match(/data-mapa-horas="estreito"/g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect(h).toContain("por faixa de quatro horas");
    expect(h).toContain("Ver as 24 horas");
    expect(h).toContain("a média simples dos quatro valores horários da faixa, sem pesos");
  });

  it("diferenças regionais: a matriz acompanha o período escolhido, o veredito dá os dois limiares e o gráfico de 168 horas ocupa a largura", () => {
    const h = html.p012;
    expect(h).toContain(escHtml(vereditoP012(gold.regional, "12m")));
    expect(h).toContain(`Matriz do período: ${rotuloPeriodo(gold.regional, "12m")}`);
    expect(h).toContain("qualquer que seja o Período");
    const a12 = gold.regional.amplitude.find((x) => x.periodo === "12m")!;
    expect(h).toContain(escHtml(textoMediaDaAmplitude(a12)!));
    // a tabela de períodos ganhou a coluna com as horas dos quatro submercados no piso
    expect(h).toContain("Horas com os quatro no piso");
  });
});

/* ====================================================================== */
/* Migração do PLD: pontes entre critérios, recortes e ressalvas          */
/* (seletores puros; as páginas que os usam estão testadas acima)         */
/* ====================================================================== */

/** Zero negativo e positivo são o mesmo valor para quem lê a tabela: a comparação passa por JSON, que os iguala. */
const semZeroNegativo = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

describe("critérios de diferença entre submercados: R$ 1,00 na abertura, R$ 0,01 nas diferenças regionais, e a ponte entre os dois", () => {
  const r = gold.regional;
  const a12 = r.amplitude.find((a) => a.periodo === "12m")!;
  const ponte12 = pontesSeparacao(r)["12m"];

  it("a ponte repete a contagem da gold regional para o mesmo período e diz os dois limiares na mesma frase", () => {
    expect(LIMIAR_SEPARACAO).toBe(0.01);
    expect(ponte12).toEqual({ horas: a12.horas, horas_separadas: a12.horas_com_separacao, frac: a12.frac_com_separacao });
    expect(Object.keys(pontesSeparacao(r)).sort()).toEqual(r.amplitude.map((a) => a.periodo).sort());
    const t = textoPonteLimiar(1, ponte12);
    expect(t).toContain(`o maior e o menor preço diferem em mais de ${reais(1)}/MWh`);
    expect(t).toContain(`toda hora com diferença acima de ${reais(0.01)}/MWh`);
    expect(t).toContain(`${num(a12.horas_com_separacao, 0)} horas de ${num(a12.horas, 0)} (${fracPct(a12.frac_com_separacao, 1)})`);
    expect(t).not.toMatch(SEM_TRAVESSAO);
  });

  it("sem o mesmo período na gold regional, a frase fica só com a regra, sem número de reserva", () => {
    for (const ponte of [null, undefined, { horas: 0, horas_separadas: 0, frac: null }]) {
      const t = textoPonteLimiar(1, ponte);
      expect(t).toMatch(/acima de R\$\s*0,01\/MWh\.$/);
      expect(t).not.toMatch(/\d{2}[.,]\d|NaN|undefined/);
    }
  });

  it("o veredito regional dá a fração com um centavo, a fração com R$ 1,00 e a média sobre todas as horas, em no máximo 50 palavras", () => {
    const v = vereditoP012(r, "12m");
    expect(v).toContain(`em mais de um centavo em ${fracPct(a12.frac_com_separacao, 1)} das horas`);
    expect(v).toContain(`em mais de ${reais(1)}/MWh em ${fracPct(a12.horas_acima_1 / a12.horas, 1)}`);
    expect(v).toContain(`em média ${reais(a12.media!)}/MWh entre o maior e o menor, contando todas as horas`);
    expect(v).toContain("A contagem não diz o motivo.");
    expect(v.split(/\s+/).length).toBeLessThanOrEqual(50);
    expect(v).not.toMatch(SEM_TRAVESSAO);
    expect(vereditoP012(r, "sem-periodo")).toBe("Sem horas com os quatro submercados publicados neste período.");
  });

  it("a média da diferença cobre todas as horas; a média só das horas separadas aparece quando o arredondamento deixa a conta fechar", () => {
    const m = mediaNasHorasSeparadas(a12);
    expect(m).not.toBeNull();
    // o valor tem de ser coerente com a gold: soma das diferenças dividida pelas horas separadas, dentro das margens de arredondamento
    const soma = a12.media! * a12.horas;
    expect(Math.abs((m as number) - soma / a12.horas_com_separacao)).toBeLessThanOrEqual(1);
    const t = textoMediaDaAmplitude(a12)!;
    expect(t).toContain(`Média sobre todas as ${num(a12.horas, 0)} horas do período, inclusive as ${num(a12.horas - a12.horas_com_separacao, 0)} sem separação`);
    expect(t).toContain(`nas ${num(a12.horas_com_separacao, 0)} horas separadas, cerca de ${reais(m as number, 0)}/MWh`);
    expect(t).toContain(`Mediana de todas as horas: ${reais(a12.p50!)}/MWh`);
    // dois limites de arredondamento que dão inteiros diferentes: a conta não fecha, e a página não escreve o valor
    expect(mediaNasHorasSeparadas({ horas: 10, horas_com_separacao: 1, media: 5.05 })).toBeNull();
    expect(textoMediaDaAmplitude({ ...a12, horas: 10, horas_com_separacao: 1, media: 5.05, p50: null })).not.toContain("horas separadas, cerca de");
    // sem horas separadas, sem média ou com mais separadas que horas: nada
    expect(mediaNasHorasSeparadas({ horas: 100, horas_com_separacao: 0, media: 0 })).toBeNull();
    expect(mediaNasHorasSeparadas({ horas: 100, horas_com_separacao: 5, media: null })).toBeNull();
    expect(mediaNasHorasSeparadas({ horas: 100, horas_com_separacao: 101, media: 1 })).toBeNull();
    expect(textoMediaDaAmplitude({ ...a12, media: null })).toBeNull();
  });

  it("a coluna de horas entre os limites com diferença de até R$ 1,00 mostra duas casas (a fração da gold tem três)", () => {
    expect(COLUNAS_RELACAO.find((c) => c.id === "entre_ate_1")).toMatchObject({ tipo: "percentual", casas: 2 });
  });
});

describe("matriz de diferenças por período e horas com os quatro submercados no piso", () => {
  const r = gold.regional;

  it("nos últimos 12 meses a matriz montada pelas linhas de separação é a matriz que a gold publica, célula a célula", () => {
    for (const medida of ["dif_media", "frac_separadas"] as const) {
      expect(semZeroNegativo(matrizRegionalDoPeriodo(r, medida, "12m"))).toEqual(semZeroNegativo(matrizRegional(r, medida)));
    }
    expect(semZeroNegativo(linhasMatrizDoPeriodo(r, "12m"))).toEqual(semZeroNegativo(linhasMatriz(r)));
  });

  it("em qualquer período: a célula (A, B) é a média da diferença do par, a simétrica leva o sinal trocado e a fração é a mesma nos dois lados", () => {
    for (const periodo of r.periodos.map((p) => p.id)) {
      const m = matrizDoPeriodo(r, periodo);
      expect(m.periodo).toBe(periodo);
      m.ordem.forEach((a, i) =>
        m.ordem.forEach((b, j) => {
          if (i >= j) return;
          const s = r.separacao.find((x) => x.periodo === periodo && x.par === `${a}_${b}`);
          expect(m.dif_media[i][j], `${periodo} ${a}_${b}`).toBe(s ? s.dif_media : null);
          expect(m.frac_separadas[i][j]).toBe(s ? s.frac_separadas : null);
          expect(m.frac_separadas[j][i]).toBe(m.frac_separadas[i][j]);
          const direta = m.dif_media[i][j];
          const inversa = m.dif_media[j][i];
          if (direta === null) expect(inversa).toBeNull();
          else expect((inversa as number) + direta).toBeCloseTo(0, 10);
        }),
      );
    }
    // período que a gold não tem: matriz inteira sem dado, e não a de outro período
    expect(matrizDoPeriodo(r, "sem-periodo").dif_media.flat().every((v) => v === null)).toBe(true);
  });

  it("quatro submercados juntos no piso: horas por ano na gold de limites, ditas como motivo de a contagem de horas separadas ser menor", () => {
    const q = quatroNoPisoPorAno(lim);
    for (const e of lim.empates_piso) expect(q[String(e.ano)]).toEqual({ horas: e.horas_quatro_no_piso, frac: e.frac_quatro_no_piso, parcial: e.parcial });
    const ano = lim.empates_piso.reduce((m, e) => (e.horas_quatro_no_piso > m.horas_quatro_no_piso ? e : m));
    const t = textoQuatroNoPiso(q[String(ano.ano)], String(ano.ano))!;
    expect(t).toContain(`Em ${ano.ano}, os quatro submercados ficaram juntos no piso em ${num(ano.horas_quatro_no_piso, 0)} horas`);
    expect(t).toContain(`(${fracPct(ano.frac_quatro_no_piso, 1)} das horas)`);
    expect(t).toContain("nessas horas os preços são iguais por regra");
    expect(t).not.toMatch(SEM_TRAVESSAO);
    expect(textoQuatroNoPiso(undefined, "2023")).toBeNull();
    expect(textoQuatroNoPiso({ horas: 0, frac: 0, parcial: false }, "2023")).toBeNull();
    expect(quatroNoPisoPorAno(null)).toEqual({});
    // a tabela de períodos ganha a coluna só nos anos; os períodos móveis ficam sem valor
    expect(COLUNAS_AMPLITUDE.some((c) => c.id === "quatro_piso")).toBe(true);
    const linhas = linhasAmplitude(r, q);
    expect(linhas.find((x) => x.id === String(ano.ano))!.quatro_piso).toBe(ano.horas_quatro_no_piso);
    expect(linhas.find((x) => x.id === "12m")!.quatro_piso).toBeNull();
    expect(linhasAmplitude(r).every((x) => x.quatro_piso === null)).toBe(true);
  });
});

describe("calendário de limites e mapas de calor: dias no limite ditos por data e faixas de quatro horas", () => {
  it("os dias no limite saem das mesmas horas do calendário e são ditos por data só quando são poucos", () => {
    for (const sm of SUBMERCADOS) {
      for (const [limite, serie] of [["piso", lim.calendario[sm].horas_piso], ["teto_horario", lim.calendario[sm].horas_teto_horario]] as const) {
        const dias = diasNoLimite(lim.calendario, sm, limite);
        expect(dias.reduce((s, d) => s + d.horas, 0), `${sm} ${limite}`).toBe(serie.reduce<number>((s, h) => s + (h ?? 0), 0));
        expect(dias.every((d) => d.horas > 0)).toBe(true);
      }
    }
    const cal = { dias: ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04"], SE: { horas_piso: [0, 3, null, 1], horas_teto_horario: [0, 0, 0, 0] } } as unknown as BlocoLimitesDisponivel["calendario"];
    expect(diasNoLimite(cal, "SE", "piso")).toEqual([{ dia: "2026-03-02", horas: 3 }, { dia: "2026-03-04", horas: 1 }]);
    expect(diasNoLimite(cal, "SE", "piso", 2)).toEqual([{ dia: "2026-03-04", horas: 1 }]);
    expect(textoDiasNoLimite(diasNoLimite(cal, "SE", "piso"), "piso", 4)).toBe("4 horas no piso em 2 dias dos 4 do calendário: 02/03/2026 (3 horas) e 04/03/2026 (1 hora).");
    expect(textoDiasNoLimite([], "teto_horario", 366)).toBe("Nenhuma hora no teto horário nos 366 dias do calendário.");
    const muitos = Array.from({ length: 11 }, (_, k) => ({ dia: `2026-03-${String(k + 1).padStart(2, "0")}`, horas: 1 }));
    expect(textoDiasNoLimite(muitos, "piso", 366)).toBeNull();
    expect(textoDiasNoLimite(muitos, "piso", 366, 11)).not.toBeNull();
  });

  it("faixa de quatro horas é a média simples dos quatro valores e fica sem dado se qualquer hora estiver sem dado", () => {
    expect(FAIXAS_DE_HORAS.map((f) => f.rotulo)).toEqual(["00h às 04h", "04h às 08h", "08h às 12h", "12h às 16h", "16h às 20h", "20h às 00h"]);
    expect(FAIXAS_DE_HORAS.map((f) => f.curto)).toEqual(["0h", "4h", "8h", "12h", "16h", "20h"]);
    const horas = Array.from({ length: 24 }, (_, h) => h);
    expect(agruparEmFaixasDeHoras([horas])[0]).toEqual([1.5, 5.5, 9.5, 13.5, 17.5, 21.5]);
    expect(agruparEmFaixasDeHoras([horas.map((v) => (v === 9 ? null : v))])[0]).toEqual([1.5, 5.5, null, 13.5, 17.5, 21.5]);
    expect(agruparEmFaixasDeHoras([[1, 2, 3]])[0]).toEqual([null]);
    const perfil = perfilHoraMes(gold.historico, "SE");
    const faixas = agruparEmFaixasDeHoras(perfil.valores);
    expect(faixas).toHaveLength(perfil.valores.length);
    faixas.forEach((linha, i) => {
      expect(linha).toHaveLength(6);
      const quatro = perfil.valores[i].slice(0, 4);
      if (quatro.every((v) => typeof v === "number")) expect(linha[0]).toBeCloseTo((quatro as number[]).reduce((a, b) => a + b, 0) / 4, 10);
    });
  });
});

describe("histórico: marcas numeradas, regimes de limites, inflação e a base nominal", () => {
  it("cada mudança de perímetro da carga vira uma marca numerada no gráfico, com a legenda escrita à parte", () => {
    const q = gold.historico.ponderacao.quebras;
    const { marcos, legenda } = marcosNumerados(gold.historico);
    expect(marcos).toEqual(q.map((x, i) => ({ x: x.mes, rotulo: String(i + 1) })));
    expect(legenda.map((l) => l.n)).toEqual(q.map((_, i) => i + 1));
    legenda.forEach((l, i) => {
      expect(l.data).toBe(dataBR(q[i].data));
      expect(l.texto).toBe(q[i].descricao.replace(/\.$/, ""));
      expect(l.texto).not.toMatch(/\.$/);
    });
  });

  it("a distribuição mistura anos com limites diferentes: o texto usa só o que a gold de limites publica", () => {
    const pisos = lim.regimes.map((x) => x.pld_min).filter((v): v is number => typeof v === "number");
    const t = textoRegimesDistribuicao(lim)!;
    expect(t.startsWith("Os valores são nominais, sem correção pela inflação, e de anos com limites diferentes:")).toBe(true);
    expect(t).toContain(`o piso foi de ${reais(Math.min(...pisos))} a ${reais(Math.max(...pisos))}/MWh`);
    expect(t).toContain(`o teto horário teve ${new Set(lim.regimes.map((x) => x.pld_max_horario).filter((v) => v !== null)).size} valores diferentes`);
    expect(t).not.toMatch(SEM_TRAVESSAO);
    // um ano só: uma fração, e não "de 98,3% a 98,3%"
    const um = textoRegimesDistribuicao({ regimes: lim.regimes, permanencia_anual: lim.permanencia_anual.filter((p) => p.ano === 2023) })!;
    expect(um).toMatch(/em um ano \(2023\), 98,3% das horas do Sudeste\/Centro-Oeste ficaram no piso/);
    expect(um).not.toMatch(/de 98,3% a 98,3%/);
    expect(textoRegimesDistribuicao({ regimes: [], permanencia_anual: [] })).toBeNull();
  });

  it("a inflação acumulada vem da razão entre a série em moeda constante e a nominal, entre o primeiro e o último mês com as duas", () => {
    const m = gold.historico.mensal;
    const i = inflacaoAcumulada(m)!;
    const k0 = m.meses.indexOf(i.de);
    const k1 = m.meses.indexOf(i.ate);
    expect(k0).toBeGreaterThanOrEqual(0);
    expect(k1).toBeGreaterThan(k0);
    const razao = (k: number) => (m.SE.real[k] as number) / (m.SE.temporal[k] as number);
    expect(i.frac).toBeCloseTo(razao(k0) / razao(k1) - 1, 12);
    // depois do último mês com as duas séries, nenhum mês tem as duas
    for (let k = k1 + 1; k < m.meses.length; k++) expect(typeof m.SE.real[k] === "number" && typeof m.SE.temporal[k] === "number").toBe(false);
    const t = textoInflacao(i)!;
    expect(t).toContain(`O IPCA acumulou cerca de ${num(Math.round(i.frac * 100), 0)}% de jan/2021 a ago/2026`);
    expect(t).toContain(`R$ 100/MWh nominais de jan/2021 equivalem a cerca de R$ ${num(Math.round(100 * (1 + i.frac)), 0)}/MWh em ago/2026.`);
    // conta de exemplo: preços 40% menores em moeda constante no primeiro mês e iguais no último
    const sintetica = { meses: ["2021-01", "2026-08"], SE: { real: [140, 100], temporal: [100, 100] } } as unknown as Parameters<typeof inflacaoAcumulada>[0];
    expect(inflacaoAcumulada(sintetica)!.frac).toBeCloseTo(0.4, 12);
    expect(textoInflacao(inflacaoAcumulada(sintetica))).toBe("O IPCA acumulou cerca de 40% de jan/2021 a ago/2026: R$ 100/MWh nominais de jan/2021 equivalem a cerca de R$ 140/MWh em ago/2026.");
    expect(inflacaoAcumulada({ meses: [], SE: { real: [], temporal: [] } } as unknown as Parameters<typeof inflacaoAcumulada>[0])).toBeNull();
    expect(textoInflacao(null)).toBeNull();
  });

  it("o menor valor horário do ano contra o piso do ato: a frase conta as combinações conferidas e não diz que está tudo certo quando não está", () => {
    const decididas = lim.conferencias.filter((c) => c.menor_igual_ao_piso !== null);
    const iguais = decididas.filter((c) => c.menor_igual_ao_piso === true).length;
    const t = textoMenorValorEPiso(lim.conferencias)!;
    expect(t).toContain(iguais === decididas.length ? `nas ${decididas.length} combinações` : `em ${iguais} das ${decididas.length} combinações`);
    const metade = lim.conferencias.map((c, k) => ({ ...c, menor_igual_ao_piso: k === 0 ? false : c.menor_igual_ao_piso }));
    const decididas2 = metade.filter((c) => c.menor_igual_ao_piso !== null);
    const iguais2 = decididas2.filter((c) => c.menor_igual_ao_piso === true).length;
    expect(textoMenorValorEPiso(metade)).toContain(`em ${iguais2} das ${decididas2.length} combinações`);
    expect(textoMenorValorEPiso([])).toBeNull();
    expect(textoMenorValorEPiso(null)).toBeNull();
  });
});

describe("limites vigentes diante dos valores: pico do gráfico, CMO acima dos tetos e limites desenhados só quando alguém os alcança", () => {
  const sem = gold.cmo_pld.semana_referencia!;
  const reg = regimeVigenteEm(lim.regimes, sem.fim)!;
  const lv = limitesVigentesEm(lim.regimes, sem.fim)!;

  it("os limites vigentes são os do ato que cobre a data, e fora de qualquer ato não há limite", () => {
    expect(lv).toEqual({ piso: reg.pld_min, teto_horario: reg.pld_max_horario, teto_estrutural: reg.pld_max_estrutural });
    expect(limitesVigentesEm(lim.regimes, "2000-01-01")).toBeNull();
    expect(limitesPorSemana([sem.fim, "2000-01-01"], lim.regimes)).toEqual([lv, { piso: null, teto_horario: null, teto_estrutural: null }]);
  });

  it("o pico mostrado só é dito igual ao teto horário quando coincide, nos centavos, com o teto do ato da data do pico", () => {
    const teto = reg.pld_max_horario as number;
    const quando = `${sem.fim}T18:00`;
    expect(textoPicoFrenteAoLimite(teto, quando, lim.regimes)).toBe(`igual ao teto horário vigente na data (${reais(teto)}/MWh)`);
    expect(textoPicoFrenteAoLimite(teto - 0.5, quando, lim.regimes)).toBeNull();
    // o teto de outro ano não vale para a data deste pico
    const outro = lim.regimes.find((x) => x.inicio !== reg.inicio && x.pld_max_horario !== reg.pld_max_horario)!;
    expect(textoPicoFrenteAoLimite(teto, `${outro.inicio}T10:00`, lim.regimes)).toBeNull();
    expect(textoPicoFrenteAoLimite(null, quando, lim.regimes)).toBeNull();
    expect(textoPicoFrenteAoLimite(teto, null, lim.regimes)).toBeNull();
    expect(textoPicoFrenteAoLimite(teto, "2000-01-01T00:00", lim.regimes)).toBeNull();
  });

  it("CMO semanal acima dos tetos: diz qual teto passa, de que objeto ele é limite e que o teto não vale para o CMO", () => {
    const acima = (lv.teto_horario as number) + 100;
    const t = textoCmoFrenteAosLimites("N", acima, lv);
    expect(t).toContain(`O CMO semanal do DECOMP do Norte, ${reais(acima)}/MWh, é maior que o teto horário do ato vigente (${reais(lv.teto_horario as number)}/MWh, limite de cada hora do PLD) e o teto estrutural (${reais(lv.teto_estrutural as number)}/MWh, limite da média diária do PLD).`);
    expect(t).toContain("Os tetos valem para o PLD, não para o CMO que o ONS publica.");
    expect(t).not.toMatch(SEM_TRAVESSAO);
    // o valor publicado da semana de referência, no Norte, passa dos dois tetos: a frase sai com ele
    const norte = sem.por_sm.find((x) => x.sm === "N")!;
    if (typeof norte.decomp === "number" && norte.decomp > (lv.teto_horario as number)) expect(textoCmoFrenteAosLimites("N", norte.decomp, lv)).toContain(reais(norte.decomp));
    const entreOsTetos = textoCmoFrenteAosLimites("SE", (lv.teto_estrutural as number) + 1, lv)!;
    expect(entreOsTetos).toContain("é maior que o teto estrutural");
    expect(entreOsTetos).not.toContain("teto horário");
    expect(textoCmoFrenteAosLimites("SE", lv.teto_estrutural, lv)).toBeNull();
    expect(textoCmoFrenteAosLimites("SE", 97.89, lv)).toBeNull();
    expect(textoCmoFrenteAosLimites("SE", null, lv)).toBeNull();
    expect(textoCmoFrenteAosLimites("SE", 5000, null)).toBeNull();
  });

  it("os limites só entram no gráfico semanal quando algum valor alcança o teto estrutural vigente na sua semana", () => {
    const base = { fim: sem.fim, decomp: 100, dessem: 90, pld: 120 };
    expect(valoresAlcancamTeto([base], lim.regimes)).toBe(false);
    expect(valoresAlcancamTeto([{ ...base, dessem: lv.teto_estrutural }], lim.regimes)).toBe(true);
    expect(valoresAlcancamTeto([{ ...base, pld: (lv.teto_estrutural as number) - 0.01 }], lim.regimes)).toBe(false);
    expect(valoresAlcancamTeto([{ ...base, fim: "2000-01-01", decomp: 1e6 }], lim.regimes)).toBe(false);
    expect(valoresAlcancamTeto([], lim.regimes)).toBe(false);
    // com as semanas publicadas: o resultado é o de contar, semana a semana, os valores que chegam ao teto estrutural do ato da semana
    for (const sm of SUBMERCADOS) {
      const semanas = linhasSemanais(gold.cmo_pld, sm);
      const esperado = semanas.some((l) => {
        const teto = regimeVigenteEm(lim.regimes, l.fim)?.pld_max_estrutural;
        return typeof teto === "number" && [l.decomp, l.dessem, l.pld].some((v) => v !== null && centavos(v) >= centavos(teto));
      });
      expect(valoresAlcancamTeto(semanas, lim.regimes), sm).toBe(esperado);
    }
    // a semana de referência do Norte tem DECOMP acima do teto estrutural: o gráfico do Norte desenha os limites
    const norteRef = sem.por_sm.find((x) => x.sm === "N")!;
    if (typeof norteRef.decomp === "number" && norteRef.decomp >= (lv.teto_estrutural as number)) expect(valoresAlcancamTeto(linhasSemanais(gold.cmo_pld, "N"), lim.regimes)).toBe(true);
  });

  it("a semana operativa que termina na data vai do sábado à sexta", () => {
    expect(intervaloSemanaOperativa("2026-10-02")).toEqual({ inicio: "2026-09-26", fim: "2026-10-02" });
    expect(intervaloSemanaOperativa(sem.fim)).toEqual({ inicio: sem.inicio, fim: sem.fim });
    expect(intervaloSemanaOperativa("2026-03-01T00:00")).toEqual({ inicio: "2026-02-23", fim: "2026-03-01" });
  });

  it("distância semanal entre submercados: de quanto a quanto vai cada produto, em R$/MWh e sem razão, e sem explicar o motivo", () => {
    const p = partesDistanciaSemanal(sem)!;
    expect(p.introducao).toBe(`Entre os submercados, na semana de ${dataBR(sem.inicio)} a ${dataBR(sem.fim)}:`);
    expect(p.itens).toHaveLength(3);
    for (const [k, rotulo] of [["decomp", "O CMO semanal do DECOMP"], ["dessem", "A média do CMO do DESSEM"], ["pld", "A média do PLD"]] as const) {
      const v = sem.por_sm.map((x) => x[k] as number);
      const item = p.itens.find((x) => x.startsWith(rotulo))!;
      expect(item, k).toContain(`de ${reais(Math.min(...v))}/MWh`);
      expect(item, k).toContain(`a ${reais(Math.max(...v))}/MWh`);
      expect(item, k).toContain(`distância de ${reais(Math.max(...v) - Math.min(...v))}/MWh`);
      expect(item).not.toMatch(/vezes|×|razão/);
    }
    // os que empatam no extremo aparecem juntos, com "mesmo valor"
    expect(p.itens[0]).toContain("(SE/CO, Sul e Nordeste, mesmo valor)");
    expect(p.ressalva).toContain("não dizem por que os valores diferem");
    expect(textoDistanciaSemanal(sem)).toBe(`${p.introducao} ${p.itens.join(" ")} ${p.ressalva}`);
    expect(`${p.introducao} ${p.itens.join(" ")} ${p.ressalva}`).not.toMatch(SEM_TRAVESSAO);
    const iguais = { ...sem, por_sm: sem.por_sm.map((x) => ({ ...x, decomp: 100 })) };
    expect(partesDistanciaSemanal(iguais)!.itens[0]).toBe(`O CMO semanal do DECOMP foi igual nos quatro submercados, ${reais(100)}/MWh.`);
    expect(partesDistanciaSemanal(null)).toBeNull();
    expect(partesDistanciaSemanal({ ...sem, por_sm: [] })).toBeNull();
    expect(textoDistanciaSemanal(undefined)).toBeNull();
  });
});

describe("ressalvas de limites que a gold ainda traz desatualizadas: a troca é local, só mexe na cláusula e deixa de valer sozinha", () => {
  it("a cláusula 'não foram auditados nesta fase' vira a indicação da página Limites; texto sem a cláusula volta igual", () => {
    expect(semRessalvaDeLimitesNaoAuditados("piso e teto vêm do ato e não foram auditados nesta fase; veja a fonte.")).toBe(
      "piso e teto vêm do ato; os valores vigentes em cada ano, conferidos nos atos da ANEEL, estão na página Limites; veja a fonte.",
    );
    expect(semRessalvaDeLimitesNaoAuditados("o limite oficial vigente não foi auditado nesta fase.")).toBe("o piso vigente é o do ato da ANEEL, conferido na página Limites.");
    expect(semRessalvaDeLimitesNaoAuditados("texto sem a cláusula")).toBe("texto sem a cláusula");
  });

  it("na proveniência, só a lista de limitações muda, sem alterar o objeto de origem", () => {
    const original = { limitacoes: ["a e não foram auditados nesta fase; b", "c"], outro: 1 };
    const novo = provenienciaSemRessalvaObsoleta(original);
    expect(original.limitacoes[0]).toContain("não foram auditados");
    expect(novo.limitacoes[0]).not.toContain("não foram auditados");
    expect(novo.limitacoes[1]).toBe("c");
    expect(novo.outro).toBe(1);
    const semLista = { x: 1 } as { limitacoes?: string[] };
    expect(provenienciaSemRessalvaObsoleta(semLista)).toBe(semLista);
  });

  it("a nota do teto estrutural mantém a conferência empírica e troca só a frase final que dizia que a regra não estava citada", () => {
    const nota = "A média diária passou do teto em 12 dias-submercado e ficou igual a ele. A regra de aplicação não está citada nos documentos integrados.";
    expect(notaTetoComConfirmacaoEmpirica(nota)).toBe("A média diária passou do teto em 12 dias-submercado e ficou igual a ele. A regra está na norma citada nesta seção; o padrão observado confirma a leitura.");
    expect(notaTetoComConfirmacaoEmpirica("sem a frase")).toBe("sem a frase");
    expect(notaTetoComConfirmacaoEmpirica(lim.nota_teto_estrutural)).not.toContain("A regra de aplicação não está");
  });

  it("nome de arquivo sai do texto de Entender: o histórico horário vira o arquivo do painel", () => {
    expect(notaSemNomeDeArquivo("o histórico horário inteiro está em pld_cmo_horario.csv")).toBe("o histórico horário inteiro está no arquivo horário de CMO e PLD (CSV, em Baixar os dados)");
    expect(notaSemNomeDeArquivo("veja media_temporal/pld_mensal.csv e depois outro.json")).toBe("veja media_temporal/arquivo do painel e depois arquivo do painel");
    expect(notaSemNomeDeArquivo("texto sem arquivo")).toBe("texto sem arquivo");
  });
});

describe("geração do Balanço do ONS no diagrama e na ideia central: a MMGD estimada nunca é dita verificada", () => {
  const ger = goldDoObservatorio.geracao()!;
  const sin = ger.regioes.find((x) => x.rg === "SIN")!;

  it("renováveis, térmicas e hidráulica dizem a base (Balanço de Energia nos Subsistemas do ONS), a MMGD estimada e o início do regime", () => {
    expect(ger.disponivel).toBe(true);
    expect(ger.inicio_regime_atual).toBeTruthy();
    const ressalva = `a solar inclui a micro e minigeração distribuída (MMGD) estimada pelo ONS desde ${dataBR(ger.inicio_regime_atual!)}`;
    const textos = [estadoRenovaveisBalanco(ger)!, estadoTermicasBalanco(ger)!, textoHidraulicaBalanco(ger)!];
    for (const t of textos) {
      expect(t).toContain("Balanço de Energia nos Subsistemas do ONS");
      expect(t).toContain(ressalva);
      expect(t).not.toMatch(/verificad|medi[çc][ãa]o direta/i);
      expect(t).not.toMatch(SEM_TRAVESSAO);
      expect(t).not.toMatch(/\bhoje\b|\bagora\b|undefined|NaN/i);
    }
    expect(textos[0]).toContain(`${num(sin["7d"]!.participacao.eolica, 1)}%`);
    expect(textos[0]).toContain(`${num(sin["7d"]!.participacao.solar, 1)}%`);
    expect(textos[1]).toContain(`${num(ger.termica_contexto.participacao_7d!, 1)}%`);
    expect(textos[2]).toContain(`${num(sin["12m"]!.participacao.hidraulica, 1)}%`);
    expect(textos[2]).toContain("Sistema Interligado Nacional (SIN)");
    expect(textos[2]).toContain("a MMGD estimada entra no total");
  });

  it("sem a gold de geração, sem o período ou sem a participação, não há texto nem número de reserva; sem a data de início, ela não é inventada", () => {
    for (const f of [estadoRenovaveisBalanco, estadoTermicasBalanco, textoHidraulicaBalanco]) {
      expect(f(null)).toBeNull();
      expect(f({ ...ger, disponivel: false })).toBeNull();
    }
    expect(estadoTermicasBalanco({ ...ger, termica_contexto: { ...ger.termica_contexto, participacao_7d: null } })).toBeNull();
    expect(estadoRenovaveisBalanco({ ...ger, regioes: [] })).toBeNull();
    const semInicio = { ...ger, inicio_regime_atual: undefined };
    for (const t of [estadoRenovaveisBalanco(semInicio)!, estadoTermicasBalanco(semInicio)!, textoHidraulicaBalanco(semInicio)!]) {
      expect(t).toContain("a solar inclui a micro e minigeração distribuída (MMGD) estimada pelo ONS");
      expect(t).not.toMatch(/estimada pelo ONS desde/);
    }
  });

  it("a página liga os dois estados do diagrama ao selo Estimado e a ideia central usa o mesmo texto", () => {
    const fonte = ler("src/app/setor-eletrico/pld/page.tsx");
    expect(fonte).toMatch(/renovaveis:[^\n]*estadoRenovaveisBalanco\(ger\)[^\n]*natureza: "ESTIMADO"/);
    expect(fonte).toMatch(/termicas:[^\n]*estadoTermicasBalanco\(ger\)[^\n]*natureza: "ESTIMADO"/);
    expect(fonte).toContain("textoHidraulicaBalanco(ger)");
    expect(fonte).not.toMatch(/natureza: "OBSERVADO"[^\n]*(renovaveis|termicas)/);
  });
});

describe("fluxo por hora no dia do mapa: o sentido de cada fronteira, só com as horas publicadas", () => {
  const dia = "2026-09-28";
  const conta = (fronteira: "N_NE" | "N_SE" | "NE_SE" | "S_SE") => {
    let no_sentido = 0;
    let contrario = 0;
    let nulo = 0;
    rec.t.forEach((t, i) => {
      const v = rec.fluxo[fronteira][i];
      if (!t.startsWith(dia) || typeof v !== "number") return;
      if (Math.abs(v) <= 1) nulo++;
      else if (v > 0) no_sentido++;
      else contrario++;
    });
    return { no_sentido, contrario, nulo };
  };

  it("cada fronteira conta as horas no sentido da primeira para a segunda ponta, no sentido contrário e com fluxo nulo; o total é o das horas publicadas", () => {
    const s = horasPorSentidoNoDia(rec, dia);
    expect(s.map((x) => x.fronteira)).toEqual(["N_NE", "N_SE", "NE_SE", "S_SE"]);
    for (const x of s) {
      expect({ no_sentido: x.no_sentido, contrario: x.contrario, nulo: x.nulo }, x.fronteira).toEqual(conta(x.fronteira));
      expect(x.horas).toBe(x.no_sentido + x.contrario + x.nulo);
      expect(x.horas).toBeLessThanOrEqual(24);
    }
    const sSe = s.find((x) => x.fronteira === "S_SE")!;
    expect(textoSentidoNoDia(sSe)).toBe(`Sul para SE/CO: ${sSe.no_sentido} de ${sSe.horas} horas; SE/CO para Sul: ${sSe.contrario}${sSe.nulo ? `; fluxo nulo: ${sSe.nulo}` : ""}`);
  });

  it("dia sem fluxo publicado não conta hora nenhuma (ausência não é zero) e não gera texto", () => {
    for (const x of horasPorSentidoNoDia(rec, "2000-01-01")) {
      expect(x.horas).toBe(0);
      expect(textoSentidoNoDia(x)).toBeNull();
    }
    const dias = Array.from({ length: 24 }, (_, h) => `2026-09-28T${String(h).padStart(2, "0")}:00`);
    const sintetico = {
      t: dias,
      fluxo: { N_NE: dias.map((_, h) => (h < 6 ? 0.5 : h < 12 ? -100 : h < 18 ? 100 : null)), N_SE: dias.map(() => null), NE_SE: dias.map(() => null), S_SE: dias.map(() => null) },
    } as unknown as Parameters<typeof horasPorSentidoNoDia>[0];
    const nne = horasPorSentidoNoDia(sintetico, "2026-09-28").find((x) => x.fronteira === "N_NE")!;
    expect(nne).toMatchObject({ horas: 18, nulo: 6, contrario: 6, no_sentido: 6 });
    expect(textoSentidoNoDia(nne)).toBe("Norte para Nordeste: 6 de 18 horas; Nordeste para Norte: 6; fluxo nulo: 6");
  });
});
