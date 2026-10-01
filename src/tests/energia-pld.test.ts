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
  COLUNAS_MENSAIS,
  COLUNAS_PERMANENCIA,
  COLUNAS_SEMANAS,
  COLUNAS_SEPARACAO,
  PAINEIS_PLD,
  PARES,
  SUBMERCADOS,
  atualidadePld,
  calendarioLimite,
  diferencaTexto,
  documentosCitados,
  emPct,
  estadoHora,
  horaDiaRecorte,
  horaPadrao,
  ligacoesFormacao,
  linhasCalendario,
  linhasMatriz,
  linhasMensais,
  linhasPermanencia,
  linhasSemanais,
  linhasSeparacao,
  matrizRegional,
  nomePar,
  perguntaPainel,
  proximoPainel,
  resumoLigacoes,
  respostaHora,
  respostaP008,
  respostaP009,
  respostaP010,
  respostaP011,
  respostaP012,
  rotaPainel,
  serieSeparacaoHoraria,
  textoComparabilidade,
  type PainelPld,
} from "@/lib/energia/pld";
import { fichasPld, horarioRecentePld } from "@/lib/energia/pld-arquivos";
import { matrizExportacao } from "@/lib/energia/tabela";
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
      for (const q of PAINEIS_PLD) expect(h, `${p.id} -> ${q.id}`).toContain(`href="${q.id === "p008" ? `${rotaPainel(q.id)}#p008` : rotaPainel(q.id)}"`);
      expect(h, p.id).toMatch(new RegExp(`aria-current="page"[^>]*>${p.rotulo}<`));
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
