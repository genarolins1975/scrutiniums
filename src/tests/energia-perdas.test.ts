import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PerdasPage from "@/app/setor-eletrico/perdas/page";
import PerdasComposicaoPage from "@/app/setor-eletrico/perdas/composicao/page";
import PerdasRegulatorioPage from "@/app/setor-eletrico/perdas/regulatorio/page";
import PerdasCustoContextoPage from "@/app/setor-eletrico/perdas/custo-e-contexto/page";
import { PerdasAuditoria } from "@/components/energia/PerdasAuditoria";
import { PERGUNTA_ABERTURA, PERGUNTA_COMPOSICAO, PERGUNTA_CUSTO, PERGUNTA_REGULATORIO, ReferenciaPerdas } from "@/components/energia/PerdasPainel";
import { CONCEITOS as CONCEITOS_PERDAS } from "@/lib/energia/conteudo/conceitos-perdas";
import { problemasEvidencia, type Evidencia } from "@/lib/energia/evidencia";
import { gerarCsv } from "@/lib/energia/tabela";
import { DESTINOS_NAVEGACAO } from "@/lib/energia/navegacao";
import type { CamadaGeo } from "@/lib/energia/geo";
import type { EvidenciasDistribuidoras, EvidenciasPorDistribuidora, MunicipiosPerdas, PerdasGold, SerieAnualPerdas } from "@/lib/energia/tipos-perdas";
import {
  ANO_LEIAUTE_SAMP,
  CAMPOS_ANUAIS,
  anosSerieNacional,
  fraseCoberturaSeparacao,
  linhasNacionais,
  linhasSeparacaoNacional,
  marcaLeiauteSeparacao,
  MEDIDAS,
  ORDEM_MEDIDAS,
  ajustaConsulta,
  avisoTerritorio,
  classeDoValor,
  classificacaoMedida,
  colunasDoPeriodo,
  degrausRegulatorio,
  fraseMudanca,
  historicoDistribuidora,
  intensidadeRho,
  leve,
  linhasComposicao,
  linhasCusto,
  linhasDistribuidoras,
  linhasRegulatorio,
  medidasDoPeriodo,
  mesesEntre,
  montarAreas,
  motivosComposicao,
  periodosDisponiveis,
  recorteDaReferencia,
  recorteDaTupla,
  recortesDoPeriodo,
  respostaAssociacao,
  respostaComposicao,
  respostaCusto,
  respostaDistribuidora,
  respostaEvolucao,
  respostaGeral,
  respostaMapa,
  respostaRegulatorio,
  rotuloDistribuidora,
  rotuloResolucao,
  serieComparacao,
  textoNumero,
  validoPntBt,
  validoTecnica,
  validoTotal,
  valoresDoPeriodo,
  type PeriodoPerdas,
} from "@/lib/energia/perdas";

/**
 * Módulo Perdas, fase de interface (P055 a P058). Os testes leem os arquivos publicados
 * (gold, série anual, relação de municípios e malha do IBGE) e conferem:
 *  - o contrato da gold e dos arquivos sob demanda;
 *  - que as regras de comparabilidade da interface reproduzem, ano a ano, as contagens
 *    que o pipeline publicou na série nacional (caminho independente: as regras são
 *    reaplicadas à série anual, não lidas da gold);
 *  - que mapa, tabela e exportação têm as mesmas linhas e os mesmos números;
 *  - que os textos automáticos dizem os números certos, com valores esperados escritos
 *    aqui a partir da conferência contra a fonte (docs/observatorios/energia/modulos/perdas.md);
 *  - que as quatro páginas renderizam no servidor com os painéis e as tabelas equivalentes.
 */

const raiz = process.cwd();
const json = <T>(p: string): T => JSON.parse(readFileSync(join(raiz, p), "utf-8")) as T;
const g = json<PerdasGold>("public/energia/gold/perdas.json");
const anual = json<SerieAnualPerdas>("public/energia/series/perdas_anual.json");
const mun = json<MunicipiosPerdas>("public/energia/series/perdas_municipios.json");
const evDist = json<EvidenciasDistribuidoras>("public/energia/series/perdas_evidencias.json");
const evTarifa = json<EvidenciasPorDistribuidora>("public/energia/series/perdas_evidencias_tarifa.json");
const evTecnica = json<EvidenciasPorDistribuidora>("public/energia/series/perdas_evidencias_tecnica.json");
const malha = json<CamadaGeo>("public/energia/geo/municipios.json");
const ref = g.referencia.ano;
const porSigla = (s: string) => {
  const d = g.distribuidoras.find((x) => x.sigla === s);
  if (!d) throw new Error(`distribuidora ${s} ausente da gold`);
  return d;
};
const CEMIG = "06981180000116";
const periodos = periodosDisponiveis(g);
const pRef = periodos.find((p) => p.referencia)!;
const rotulos = Object.fromEntries(g.distribuidoras.map((d) => [d.cnpj, rotuloDistribuidora(d)]));
const leves = g.distribuidoras.map(leve);

describe("contrato da gold de perdas", () => {
  it("cabeçalho íntegro, referência temporal coerente e arquivos declarados existentes", () => {
    expect(g.dominio).toBe("energia");
    expect(g.gold).toBe("perdas.json");
    expect(g.disponivel).toBe(true);
    expect(ref).toBe(2025);
    expect(g.referencia.ano_parcial).toBe(2026);
    expect(g.referencia.tarifa_consultada_em).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(g.referencia.ultima_competencia <= "2026-09").toBe(true);
    for (const u of [...Object.values(g.series), ...g.downloads.map((d) => d.url)]) expect(existsSync(join(raiz, "public", u)), u).toBe(true);
  });

  it("CNPJ de 14 dígitos e único; grupo e ano de referência válidos", () => {
    const cnpjs = g.distribuidoras.map((d) => d.cnpj);
    expect(new Set(cnpjs).size).toBe(cnpjs.length);
    for (const d of g.distribuidoras) {
      expect(d.cnpj, d.nome).toMatch(/^\d{14}$/);
      expect(["concessionaria", "permissionaria"]).toContain(d.grupo);
      if (d.referencia) expect(d.referencia.ano, d.nome).toBe(ref);
    }
    expect(g.distribuidoras.length).toBe(123);
  });

  it("série nacional da gold só com concessionárias, um ano por linha e o ano aberto sem soma", () => {
    const anos = g.nacional.map((l) => l.ano);
    expect(new Set(anos).size).toBe(anos.length);
    for (const l of g.nacional) {
      expect(l.universo).toBe("concessionarias");
      if (l.ano > ref) {
        expect(l.parcial).toBe(true);
        expect(l.taxa_total_pct).toBeNull();
      }
    }
  });

  it("a ordem dos campos da série anual é a que a interface lê", () => {
    expect(anual.campos).toEqual([...CAMPOS_ANUAIS]);
    expect(Object.keys(anual.distribuidoras).sort()).toEqual(g.distribuidoras.map((d) => d.cnpj).sort());
  });

  it("evidências da gold e por distribuidora passam na validação de 'Comprove este número'", () => {
    for (const [k, ev] of Object.entries(g.evidencias)) if (ev) expect(problemasEvidencia(ev as Evidencia), k).toEqual([]);
    for (const [k, ev] of Object.entries(evDist.evidencias)) expect(problemasEvidencia(ev as Evidencia), k).toEqual([]);
    for (const [k, ev] of Object.entries(evTarifa.evidencias)) expect(problemasEvidencia(ev as Evidencia), `tarifa ${k}`).toEqual([]);
    for (const [k, ev] of Object.entries(evTecnica.evidencias)) expect(problemasEvidencia(ev as Evidencia), `técnica ${k}`).toEqual([]);
    expect(g.evidencias.associacao).not.toBeNull();
    expect(g.evidencias.associacao!.valor_exibido).toBe("−0,606");
    // valor exibido sai do valor sem arredondamento, com um só arredondamento
    expect(g.evidencias.taxa_nacional.valor_exibido).toBe("14,7%");
    expect(g.evidencias.taxa_nacional.valor_calculo).toBeCloseTo(14.748264, 6);
    expect(evDist.evidencias[CEMIG].valor_exibido).toBe("12,1%");
  });

  it("toda resolução homologatória da gold tem nome curto reconhecido", () => {
    const textos = g.distribuidoras.flatMap((d) => [d.tarifa?.resolucao, ...(d.tecnica_regulatoria?.segmentos.map((s) => s.reh?.resolucao) ?? [])]).filter((x): x is string => !!x);
    expect(textos.length).toBeGreaterThan(100);
    for (const t of textos) expect(rotuloResolucao(t), t).toMatch(/^REH nº [\d.]+\/\d{4}$/);
    expect(rotuloResolucao("RESOLUÇÃO HOMOLOGATÓRIA Nº 2.396, DE 22 DE MAIO DE 2018")).toBe("REH nº 2.396/2018");
    expect(rotuloResolucao(null)).toBeNull();
  });
});

describe("regras de comparabilidade da interface = regras do pipeline", () => {
  it("reaplicadas à série anual, reproduzem as concessionárias somadas em cada ano da série nacional", () => {
    const conc = new Set(g.distribuidoras.filter((d) => d.grupo === "concessionaria").map((d) => d.cnpj));
    for (const l of g.nacional.filter((x) => !x.parcial)) {
      let tot = 0;
      let tec = 0;
      let bt = 0;
      for (const [cnpj, linhas] of Object.entries(anual.distribuidoras)) {
        if (!conc.has(cnpj)) continue;
        const t = linhas.find((x) => x[0] === l.ano);
        if (!t) continue;
        const r = recorteDaTupla(t);
        if (validoTotal(r)) tot++;
        if (validoTecnica(r)) tec++;
        if (validoPntBt(r)) bt++;
      }
      expect([l.ano, tot, tec, bt]).toEqual([l.ano, l.n_distribuidoras, l.n_com_tecnica, l.n_com_pnt_bt]);
    }
  });

  it("o recorte do ano de referência lido da gold é igual ao lido da série anual", () => {
    for (const d of g.distribuidoras) {
      const a = recorteDaReferencia(d);
      const t = anual.distribuidoras[d.cnpj].find((x) => x[0] === ref);
      if (!a) {
        expect(t, d.nome).toBeUndefined();
        continue;
      }
      const b = recorteDaTupla(t!);
      for (const k of ["meses", "completo", "injetada_mwh", "perdas_totais_mwh", "taxa_total_pct", "perdas_tecnicas_mwh", "taxa_tecnica_pct", "pnt_mwh", "pnt_bt_pct", "mercado_bt_mwh", "alertas", "decomposicao", "origem"] as const) {
        expect(a[k], `${d.sigla} ${k}`).toEqual(b[k]);
      }
    }
  });

  it("casos de robustez: grande, pequena, alerta, ausência e mudança de universo", () => {
    // grande: CEMIG-D 2025 comparável, sem técnica publicada (ausência, não zero)
    const cemig = recorteDaReferencia(porSigla("CEMIG-D"))!;
    expect(validoTotal(cemig)).toBe(true);
    expect(cemig.taxa_total_pct).toBe(12.12);
    expect(cemig.perdas_tecnicas_mwh).toBeNull();
    expect(validoTecnica(cemig)).toBe(false);
    // balanço impossível: Manaus Energia 2004 publicada com alerta e fora da comparação
    const manaus = anual.distribuidoras[g.distribuidoras.find((d) => d.nome.toUpperCase().includes("MANAUS"))!.cnpj].find((x) => x[0] === 2004)!;
    const rm = recorteDaTupla(manaus);
    expect(rm.alertas).toContain("fornecida_maior_que_injetada");
    expect(validoTotal(rm)).toBe(false);
    // decomposição que não fecha: ERO 2014 tem total válido e separação fora
    const ero = g.distribuidoras.find((d) => d.sigla === "ERO");
    if (ero) {
      const r = recorteDaTupla(anual.distribuidoras[ero.cnpj].find((x) => x[0] === 2014)!);
      expect(r.decomposicao).toBe("nao_fecha");
      expect(validoPntBt(r)).toBe(false);
    }
    // absorção: RGE SUL 2019 marca mudança de universo no histórico
    const h = historicoDistribuidora(anual.distribuidoras[porSigla("RGE SUL").cnpj]);
    expect(h.mudancas).toContain(2019);
  });
});

describe("mapa, tabela e exportação com as mesmas linhas e números", () => {
  const casos: { periodo: PeriodoPerdas; serie: SerieAnualPerdas | null }[] = [
    { periodo: pRef, serie: null },
    { periodo: periodos.find((p) => p.id === "2010")!, serie: anual },
    { periodo: periodos.find((p) => p.tipo === "acumulado")!, serie: null },
  ];
  for (const { periodo, serie } of casos) {
    for (const m of medidasDoPeriodo(periodo)) {
      it(`${periodo.rotulo}, ${MEDIDAS[m].rotulo}`, () => {
        const medida = MEDIDAS[m];
        const recortes = recortesDoPeriodo(leves, periodo, serie)!;
        expect(recortes).not.toBeNull();
        const valores = valoresDoPeriodo(leves, recortes, m, periodo);
        const classes = classificacaoMedida(medida, valores);
        const linhas = linhasDistribuidoras(leves, recortes, periodo, { valores, classes });
        const colunas = colunasDoPeriodo(periodo, medida);
        // mesmas entidades, na mesma ordem, no mapa e na tabela
        expect(linhas.map((l) => l.id)).toEqual(Object.keys(valores));
        expect(linhas.length).toBe(g.distribuidoras.length);
        for (const l of linhas) {
          const v = valores[l.id as string];
          expect(l.classe_mapa, String(l.id)).toBe(classeDoValor(v, classes));
          expect(l.valor_mapa, String(l.id)).toBe(v.estado === "sem-dado" ? null : v.v);
        }
        // a legenda conta exatamente as linhas que a tabela põe em cada classe
        for (const c of classes.classes) expect(c.contagem, c.rotulo).toBe(linhas.filter((l) => l.classe_mapa === c.rotulo).length);
        // a exportação tem uma linha por distribuidora e o mesmo valor do mapa, sem arredondar
        const csv = gerarCsv(colunas, linhas, { bom: false }).trim().split("\r\n");
        expect(csv.length).toBe(linhas.length + 1);
        const cab = csv[0].split(";");
        const iv = cab.findIndex((c) => c.startsWith(`${medida.rotulo} (mapa)`));
        expect(iv).toBeGreaterThanOrEqual(0);
        csv.slice(1).forEach((linha, i) => {
          const cel = linha.split(";")[iv];
          const esperado = linhas[i].valor_mapa;
          if (esperado === null || esperado === undefined) expect(cel).toBe("");
          else expect(Number(cel)).toBeCloseTo(Number(esperado), 9);
        });
      });
    }
  }

  it("ano diferente do de referência espera a série anual em vez de mostrar outro ano", () => {
    expect(recortesDoPeriodo(leves, periodos.find((p) => p.id === "2010")!, null)).toBeNull();
  });

  it("consulta inválida na URL cai no padrão: variação fora do ano de referência vira taxa", () => {
    expect(ajustaConsulta(periodos, "2010", "variacao").medida.id).toBe("taxa");
    expect(ajustaConsulta(periodos, "acumulado", "tecnica").medida.id).toBe("taxa");
    expect(ajustaConsulta(periodos, "1990", "volume").periodo.id).toBe(String(ref));
    expect(ORDEM_MEDIDAS).toEqual(["taxa", "volume", "tecnica", "pnt_bt", "variacao"]);
  });

  it("áreas do mapa reproduzem a relação publicada: compartilhados, sem vínculo, código inválido e contagem por distribuidora", () => {
    const a = montarAreas(mun, malha.features.map((f) => f.id));
    expect(a.compartilhados.length).toBe(g.mapa.municipios_compartilhados);
    expect(a.semVinculo).toEqual(g.mapa.municipios_sem_vinculo);
    expect(a.foraDaMalha).toEqual(g.mapa.codigos_invalidos);
    // o pipeline conta confirmados só pela relação (estado 1) e os vínculos só por MMGD à parte
    for (const d of g.distribuidoras) {
      if (!d.territorio) continue;
      const desenhados = (a.exclusivos.get(d.cnpj)?.length ?? 0) + (a.compartilhadosDe.get(d.cnpj)?.length ?? 0);
      expect(desenhados, d.sigla ?? d.nome).toBe(d.territorio.confirmados + d.territorio.so_mmgd);
    }
    expect(a.exclusivos.get(CEMIG)?.length).toBe(769);
    // nenhum município pintado por duas distribuidoras
    const vistos = new Set<string>();
    a.exclusivos.forEach((cods) => cods.forEach((c) => {
      expect(vistos.has(c), c).toBe(false);
      vistos.add(c);
    }));
    for (const c of a.compartilhados) expect(vistos.has(c.id)).toBe(false);
  });

  it("composição empilhada só onde técnica + não técnica reproduzem o total", () => {
    const { linhas, fora, semSeparacao } = linhasComposicao(g.distribuidoras);
    expect(linhas.length).toBeGreaterThan(10);
    for (const l of linhas) {
      expect(["fecha", "diferenca_pequena"]).toContain(l.decomposicao);
      // as três taxas chegam com duas casas: a soma das partes difere do total no máximo pelo arredondamento
      expect(Math.abs(l.tecnica + l.nao_tecnica - l.total), l.rotulo).toBeLessThanOrEqual(0.02);
    }
    const motivos = motivosComposicao(g.distribuidoras, ref);
    for (const l of linhas) expect(motivos[l.id]).toBeUndefined();
    expect(fora + semSeparacao + linhas.length).toBe(g.distribuidoras.filter((d) => d.referencia && validoTotal(recorteDaReferencia(d)!)).length);
  });

  it("as provas por distribuidora comprovam o mesmo número que a tabela mostra", () => {
    const custo = linhasCusto(g.distribuidoras);
    expect(Object.keys(evTarifa.evidencias).sort()).toEqual(custo.map((l) => l.id).sort());
    for (const l of custo) {
      const ev = evTarifa.evidencias[l.id];
      expect(ev.valor_calculo!, l.rotulo).toBeCloseTo(l.perdas, 2);
      expect(ev.periodo.inicio, l.rotulo).toBe(l.inicio);
      // o arquivo de onde o valor foi lido é um dos anuais de componentes, com sha256
      expect(ev.fonte.recurso ?? "", l.rotulo).toMatch(/^componentes-tarifarias-\d{4}\.parquet$/);
    }
    expect(evTarifa.evidencias[CEMIG].valor_exibido).toBe("65,44 R$/MWh");
    const reg = linhasRegulatorio(g.distribuidoras);
    expect(Object.keys(evTecnica.evidencias).sort()).toEqual(reg.map((l) => l.id).sort());
    for (const l of reg) {
      const ev = evTecnica.evidencias[l.id];
      expect(ev.valor_calculo, l.rotulo).toBe(l.atual);
      expect([ev.periodo.inicio, ev.periodo.fim], l.rotulo).toEqual([l.inicio, l.fim]);
    }
    expect(evTecnica.evidencias[CEMIG].valor_exibido).toBe("8,014%");
    // a associação comprova o ρ publicado no painel, com o mesmo n
    expect(g.evidencias.associacao!.valor_calculo!).toBeCloseTo(g.associacao.spearman_taxa_total!, 3);
    expect(g.evidencias.associacao!.universo).toContain(`${g.associacao.n_taxa_total} concessionárias`);
  });

  it("custo: as três componentes somam a componente de perdas publicada; o gráfico só tem processos vigentes", () => {
    const custo = linhasCusto(g.distribuidoras);
    for (const l of custo) expect(Math.abs(l.pt + l.pnt + l.rede_basica - l.perdas), l.rotulo).toBeLessThanOrEqual(0.011);
    const cemig = custo.find((l) => l.id === CEMIG)!;
    expect([cemig.pt, cemig.pnt, cemig.rede_basica, cemig.perdas, cemig.participacao_perdas_pct, cemig.situacao]).toEqual([43.51, 16.77, 5.16, 65.44, 7.74, "vigente"]);
    const cedri = custo.find((l) => l.rotulo === "CEDRI");
    if (cedri) expect(cedri.situacao).toBe("vigencia_encerrada");
  });

  it("degraus do percentual técnico: valor só nos meses dos trechos, lacuna no mês de troca", () => {
    const segs = porSigla("CEMIG-D").tecnica_regulatoria!.segmentos;
    const d = degrausRegulatorio(segs);
    expect(d[0].m).toBe("2016-01");
    expect(d.at(-1)!.m).toBe("2023-12");
    expect(d.find((x) => x.m === "2018-05")!.pct).toBeNull();
    expect(d.find((x) => x.m === "2018-06")!.pct).toBe(8.766);
    expect(d.filter((x) => x.pct !== null).length).toBe(segs.reduce((s, x) => s + x.meses, 0));
    expect(mesesEntre("2023-11", "2024-02")).toEqual(["2023-11", "2023-12", "2024-01", "2024-02"]);
    const reg = linhasRegulatorio(g.distribuidoras);
    const cemig = reg.find((l) => l.id === CEMIG)!;
    expect([cemig.atual, cemig.anterior, cemig.inicio, cemig.fim]).toEqual([8.014, 8.766, "2023-06", "2023-12"]);
  });

  it("comparador: uma linha por ano, colunas das escolhidas e o agregado só em anos completos", () => {
    const ids = [CEMIG, porSigla("RGE SUL").cnpj];
    const linhas = serieComparacao(ids, anual, g.nacional);
    const l2025 = linhas.find((l) => l.ano === "2025")!;
    expect(l2025[CEMIG]).toBe(12.12);
    expect(l2025.brasil).toBe(14.75);
    expect(linhas.find((l) => l.ano === "2026")).toBeUndefined(); // 2026 é ano aberto: nenhum ano completo
  });
});

describe("textos derivados dos números", () => {
  it("resposta geral: volume, taxa, comparação nas mesmas e acumulado", () => {
    const t = respostaGeral(g);
    expect(t).toContain("Em 2025, as 51 concessionárias com o ano completo e sem alerta perderam 90,4 TWh, 14,75% da energia injetada de referência.");
    expect(t).toContain("Nas mesmas 51 concessionárias, a taxa subiu de 14,74% para 14,75% de 2024 para 2025.");
    expect(t).toContain("De janeiro a julho de 2026, nas 49 concessionárias comparáveis, a taxa foi 14,77%, contra 14,74% no mesmo período de 2025.");
    expect(t).not.toMatch(/—/);
  });

  it("resposta do mapa: extremos conferidos por outro caminho e o agregado nacional", () => {
    // extremos calculados aqui direto da gold, sem as funções da interface
    const validos = g.distribuidoras
      .filter((d) => d.referencia && d.referencia.completo && d.referencia.alertas.length === 0 && d.referencia.taxa_total_pct !== null)
      .map((d) => ({ s: d.sigla ?? d.nome, v: d.referencia!.taxa_total_pct! }))
      .sort((a, b) => a.v - b.v);
    const valores = valoresDoPeriodo(leves, recortesDoPeriodo(leves, pRef, null)!, "taxa", pRef);
    const t = respostaMapa({ periodo: pRef, medida: MEDIDAS.taxa, valores, rotulos, nacional: g.nacional.find((l) => l.ano === ref)!, acumulado: g.acumulado });
    expect(t).toContain(
      `Em 2025, ${validos.length} distribuidoras entram na comparação: a taxa de perdas totais vai de ${textoNumero(validos[0].v, MEDIDAS.taxa)} (${validos[0].s}) a ${textoNumero(validos.at(-1)!.v, MEDIDAS.taxa)} (${validos.at(-1)!.s}) da energia injetada de referência.`,
    );
    expect(t).toContain("Em 2025, 83 distribuidoras entram na comparação: a taxa de perdas totais vai de 3,25% (EFLUL) a 43,19% (ÂMBAR AMAZONAS)");
    expect(t).toContain("20 distribuidoras publicaram valores que ficam fora da comparação");
    expect(t).toContain("Somadas, as 51 concessionárias válidas perderam 14,75% da energia injetada.");
    // variação: contagem de altas e quedas conferida pelo campo publicado
    const vv = valoresDoPeriodo(leves, recortesDoPeriodo(leves, pRef, null)!, "variacao", pRef);
    const tv = respostaMapa({ periodo: pRef, medida: MEDIDAS.variacao, valores: vv, rotulos, nacional: g.nacional.find((l) => l.ano === ref)!, acumulado: g.acumulado });
    const comp = g.distribuidoras.filter((d) => d.variacao?.comparavel && d.variacao.taxa_total_pp !== null && d.referencia && d.referencia.completo && !d.referencia.alertas.length);
    const sobe = comp.filter((d) => Math.round(d.variacao!.taxa_total_pp! * 100) > 0).length;
    expect(tv).toContain(`subiu em ${sobe},`);
    expect(tv).toContain("Nas mesmas 51 concessionárias válidas nos dois anos, a taxa agregada subiu de 14,74% para 14,75%.");
  });

  it("distribuidora escolhida: grande, encerrada, com alerta e sem comparação", () => {
    expect(respostaDistribuidora(leve(porSigla("CEMIG-D")), ref)).toBe(
      "CEMIG-D (concessionária, MG): em 2025, perdas totais de 7.394.845 MWh, 12,12% da energia injetada de referência (60.989.117 MWh). A taxa subiu 0,89 p.p. em relação a 2024.",
    );
    const encerrada = g.distribuidoras.find((d) => !d.referencia && !d.ativa)!;
    expect(respostaDistribuidora(leve(encerrada), ref)).toContain("sem balanço publicado em 2025");
    const comAlerta = g.distribuidoras.find((d) => d.referencia && d.referencia.alertas.length);
    if (comAlerta) expect(respostaDistribuidora(leve(comAlerta), ref)).toContain("fica fora das comparações");
    const semComparar = g.distribuidoras.find((d) => d.variacao && !d.variacao.comparavel && d.referencia?.completo && !d.referencia.alertas.length);
    if (semComparar) expect(respostaDistribuidora(leve(semComparar), ref)).toContain("A comparação com 2024 não é feita");
  });

  it("composição, regulatório, custo, associação e evolução", () => {
    const c = respostaComposicao(g);
    expect(c).toContain("Em 2025, 18 das 51 concessionárias válidas publicaram a perda técnica nos 12 meses (32,6% da energia injetada); nelas, a técnica foi 7,16% da energia injetada.");
    expect(c).toContain("Nas mesmas 16 concessionárias de 2023 a 2025, a não técnica passou de 14,35% para 15,01% do mercado de baixa tensão.");
    const reg = linhasRegulatorio(g.distribuidoras);
    const r = respostaRegulatorio(reg);
    // o aviso de bloqueio saiu da resposta: a caixa da página o diz uma vez só (r8)
    expect(r).not.toContain("não pode ser medida");
    expect(r).toContain(`em ${reg.length} distribuidoras`);
    expect(respostaRegulatorio([])).toBe("Nenhum percentual técnico regulatório foi identificado na série do SAMP.");
    const custo = linhasCusto(g.distribuidoras);
    const enc = custo.filter((l) => l.situacao === "vigencia_encerrada").length;
    const encAtivas = g.distribuidoras.filter((d) => d.ativa && d.tarifa?.situacao === "vigencia_encerrada").length;
    expect(encAtivas).toBe(23); // conferido no documento do módulo (21 permissionárias, ELFSM e CERNHE)
    const tc = respostaCusto(custo, "2026-09-30");
    expect(tc).toContain(`em ${custo.length - enc} distribuidoras`);
    expect(tc).toContain("23 distribuidoras ativas só têm processo com vigência encerrada no arquivo da fonte");
    expect(tc).toContain(`Outras ${enc - 23} têm o último processo encerrado`);
    const ta = respostaAssociacao(g.associacao);
    expect(ta).toContain("a associação é forte (ρ de Spearman = −0,606, 52 concessionárias): renda média maior aparece com valores menores.");
    expect(ta).toContain("a associação é moderada (ρ de Spearman = −0,377, 46 concessionárias)");
    expect(ta).toContain("não causa");
    const ev = respostaEvolucao(g.nacional, ref);
    const serie = g.nacional.filter((l) => !l.parcial && l.taxa_total_pct !== null);
    const max = Math.max(...serie.map((l) => l.taxa_total_pct!));
    expect(ev).toContain(`${textoNumero(max, MEDIDAS.taxa)} (${serie.find((l) => l.taxa_total_pct === max)!.ano})`);
  });

  it("aviso de território: só a relação mais recente desenha as áreas; absorções posteriores ao período são nomeadas", () => {
    const anoRel = g.mapa.ano_relacao;
    expect(avisoTerritorio(leves, pRef, anoRel)).toBe("Território: municípios da relação de 2026.");
    const p2010 = periodos.find((p) => p.id === "2010")!;
    const aviso = avisoTerritorio(leves, p2010, anoRel)!;
    // RGE SUL absorveu a RGE em jun/2019; CPFL JAGUARI e ESS absorveram outras em 2018 (eventos do SAMP)
    expect(aviso).toContain("RGE SUL absorveu outra distribuidora (jun/2019)");
    expect(aviso).toContain("CPFL JAGUARI absorveu outra distribuidora (mar/2018)");
    expect(aviso).toContain("ESS absorveu outra distribuidora (jul/2018)");
    expect(avisoTerritorio(leves, periodos.find((p) => p.id === "2020")!, anoRel)).toBe("Território: municípios da relação de 2026.");
    expect(avisoTerritorio(leves, pRef, null)).toBeNull();
  });

  it("regras de redação: mudança decidida nas casas publicadas, intensidade do ρ e sinal tipográfico", () => {
    expect(fraseMudanca(14.74, 14.75)).toBe("subiu de 14,74% para 14,75%");
    expect(fraseMudanca(14.75, 14.75)).toBe("ficou igual (14,75%)");
    expect(fraseMudanca(15.1, 14.2)).toBe("caiu de 15,10% para 14,20%");
    expect([0.05, 0.2, 0.4, 0.6, -0.606].map(intensidadeRho)).toEqual(["praticamente nula", "fraca", "moderada", "forte", "forte"]);
    expect(textoNumero(-0.004, MEDIDAS.variacao)).toBe("0,00 p.p.");
    expect(textoNumero(-1.5, MEDIDAS.variacao)).toBe("−1,50 p.p.");
    expect(textoNumero(0.89, MEDIDAS.variacao)).toBe("+0,89 p.p.");
    expect(textoNumero(null, MEDIDAS.taxa)).toBe("sem dado");
  });
});

describe("verbetes do módulo", () => {
  const captura = readFileSync(join(raiz, "pipeline/tests/dados/energia_perdas/aneel_s5_perdas_texto.txt"), "utf-8");
  it("todo trecho citado aparece literalmente na captura da página da ANEEL", () => {
    expect(CONCEITOS_PERDAS.length).toBe(4);
    for (const c of CONCEITOS_PERDAS) {
      expect(c.estado).toBe("CONFERIDO");
      expect(c.conferidoEm).toBe("2026-09-30");
      for (const f of c.fontes) {
        for (const parte of (f.trecho ?? "").split("[...]").map((x) => x.trim().replace(/\.$/, ""))) expect(captura, `${c.slug}: ${parte.slice(0, 40)}`).toContain(parte);
      }
    }
  });
});

describe("páginas renderizadas no servidor", () => {
  const paginas = {
    mapa: renderToStaticMarkup(createElement(PerdasPage)),
    composicao: renderToStaticMarkup(createElement(PerdasComposicaoPage)),
    regulatorio: renderToStaticMarkup(createElement(PerdasRegulatorioPage)),
    custo: renderToStaticMarkup(createElement(PerdasCustoContextoPage)),
  };
  // só o conteúdo da página (o cabeçalho do observatório lista outros módulos, alguns em integração)
  const conteudo = (h: string) => h.slice(h.indexOf('id="conteudo"')).replace(/<[^>]+>/g, " ");

  it("renderizam sem erro, cada uma com a pergunta da página no título, o título próprio da primeira figura e a resposta derivada", () => {
    // redesenho: o título da página (h1) é a pergunta da página, com no máximo nove palavras; o título do painel é o da primeira figura e não o repete
    const esperado: Record<keyof typeof paginas, { h1: string; ids: string[]; perguntas: string[] }> = {
      mapa: {
        h1: PERGUNTA_ABERTURA,
        ids: ["painel-mapa", "painel-evolucao"],
        perguntas: ["Como variam as perdas entre as distribuidoras?", "Como a taxa de perdas das concessionárias evoluiu desde 2003?"],
      },
      composicao: { h1: PERGUNTA_COMPOSICAO, ids: ["painel-composicao"], perguntas: ["A perda de cada distribuidora dividida em técnica e não técnica"] },
      regulatorio: { h1: PERGUNTA_REGULATORIO, ids: ["painel-regulatorio"], perguntas: ["O percentual técnico de cada distribuidora, trecho a trecho"] },
      custo: {
        h1: PERGUNTA_CUSTO,
        ids: ["painel-custo", "painel-contexto"],
        perguntas: ["Quanto da tarifa residencial remunera as perdas?", "Que características das áreas aparecem associadas às perdas?"],
      },
    };
    for (const [k, h] of Object.entries(paginas) as [keyof typeof paginas, string][]) {
      for (const id of esperado[k].ids) expect(h, `${k} ${id}`).toContain(`id="${id}"`);
      for (const p of esperado[k].perguntas) expect(h, `${k} ${p}`).toContain(p);
      const h1 = (h.match(/<h1[^>]*>([^<]*)<\/h1>/) ?? [])[1];
      expect(h1, k).toBe(esperado[k].h1);
      expect(h1.trim().split(/\s+/).length, `${k}: título de 5 a 9 palavras`).toBeGreaterThanOrEqual(5);
      expect(h1.trim().split(/\s+/).length, `${k}: título de 5 a 9 palavras`).toBeLessThanOrEqual(9);
      for (const p of esperado[k].perguntas) expect(p, `${k}: o painel não repete o título da página`).not.toBe(esperado[k].h1);
      // uma navegação local por página: capítulos na abertura, faixa de páginas irmãs (com a atual marcada) nas filhas, nunca as duas
      if (k === "mapa") {
        expect(h).toContain('data-navegacao-local="capitulos"');
        expect(h).not.toContain('data-navegacao-local="faixa"');
      } else {
        expect(h).toContain('aria-label="Painéis do módulo de perdas"');
        expect(h).toContain('data-navegacao-local="faixa"');
        expect(h).not.toContain('data-navegacao-local="capitulos"');
        expect((h.match(/aria-current="page"/g) ?? []).length, k).toBeGreaterThanOrEqual(2);
      }
      expect(h, k).toContain('id="auditoria"');
    }
    expect(paginas.mapa).toContain('data-resposta="geral"');
    expect(paginas.mapa).toContain('data-resposta="mapa"');
    expect(conteudo(paginas.mapa)).toContain(respostaGeral(g).slice(0, 80));
    expect(conteudo(paginas.composicao)).toContain(respostaComposicao(g).slice(0, 80));
    expect(conteudo(paginas.regulatorio)).toContain("recusaram o acesso do observatório");
    expect(conteudo(paginas.custo)).toContain(respostaAssociacao(g.associacao).slice(0, 60));
  });

  it("têm as tabelas equivalentes, os downloads, o 'Comprove este número', o bloqueio e a próxima pergunta", () => {
    const tabelas = (h: string) => (h.match(/<table/g) ?? []).length;
    expect(tabelas(paginas.mapa)).toBeGreaterThanOrEqual(2);
    expect(tabelas(paginas.composicao)).toBeGreaterThanOrEqual(3);
    expect(tabelas(paginas.regulatorio)).toBeGreaterThanOrEqual(2);
    expect(tabelas(paginas.custo)).toBeGreaterThanOrEqual(3);
    expect(paginas.mapa).toContain("Classe no mapa");
    expect(paginas.mapa).toContain("/energia/series/perdas_distribuidoras.csv");
    expect(paginas.custo).toContain("/energia/series/perdas_tarifa_b1.csv");
    expect(paginas.regulatorio).toContain("/energia/series/perdas_tecnicas_regulatorias.csv");
    expect((conteudo(paginas.mapa).match(/Comprove/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect(conteudo(paginas.composicao)).toContain("Comprove");
    expect(paginas.regulatorio).toContain('data-bloqueio="regulatorio"');
    expect(paginas.custo).toContain('data-bloqueio="custo-total"');
    expect(conteudo(paginas.custo)).toContain("Comprove a associação da taxa de perdas totais com a renda");
    for (const [k, h] of Object.entries(paginas)) {
      expect(conteudo(h), k).toContain("Próxima pergunta");
      expect(conteudo(h), k).toContain("Copiar link deste painel");
    }
  });

  it("não usam 'em breve', 'em integração' nem 'em construção', nem travessão no texto", () => {
    for (const [k, h] of Object.entries(paginas)) {
      expect(conteudo(h), k).not.toMatch(/em breve|em integração|em construção/i);
      expect(conteudo(h), k).not.toContain("—");
    }
  });

  it("o destino está publicado na navegação e o cabeçalho marca a página atual", () => {
    const d = DESTINOS_NAVEGACAO.find((x) => x.slug === "perdas")!;
    expect(d.publicado).toBe(true);
    expect(d.integrado).toBe(true);
    for (const r of ["perdas", "perdas/composicao", "perdas/regulatorio", "perdas/custo-e-contexto"]) expect(existsSync(join(raiz, "src/app/setor-eletrico", r, "page.tsx")), r).toBe(true);
    expect(paginas.mapa).toMatch(/href="\/setor-eletrico\/perdas"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/setor-eletrico\/perdas"/);
  });

  it("peso de cada página: HTML do servidor mais as props dos componentes cliente abaixo de 450 KB", () => {
    // o fluxo RSC repete a árvore dos componentes de servidor e leva as props dos clientes;
    // com 450 KB de HTML e props, a página fica abaixo dos ~600 KB da meta (seção 5.1)
    const ids = g.distribuidoras.map((d) => d.cnpj);
    const props = {
      mapa: JSON.stringify(leves).length + JSON.stringify(g.nacional).length,
      composicao: JSON.stringify(linhasComposicao(g.distribuidoras)).length + JSON.stringify(motivosComposicao(g.distribuidoras, ref)).length + JSON.stringify(ids).length + JSON.stringify(rotulos).length,
      regulatorio: JSON.stringify(linhasRegulatorio(g.distribuidoras)).length + JSON.stringify(g.distribuidoras.map((d) => d.tecnica_regulatoria)).length + JSON.stringify(rotulos).length,
      custo: JSON.stringify(linhasCusto(g.distribuidoras)).length + JSON.stringify(g.associacao.pontos).length * 2 + JSON.stringify(rotulos).length * 2,
    };
    for (const k of Object.keys(paginas) as (keyof typeof paginas)[]) expect(paginas[k].length + props[k], k).toBeLessThan(450_000);
  });
});

describe("revisão de interface: anos, ligações e ausência", () => {
  const paginas = {
    "/setor-eletrico/perdas": renderToStaticMarkup(createElement(PerdasPage)),
    "/setor-eletrico/perdas/composicao": renderToStaticMarkup(createElement(PerdasComposicaoPage)),
    "/setor-eletrico/perdas/regulatorio": renderToStaticMarkup(createElement(PerdasRegulatorioPage)),
    "/setor-eletrico/perdas/custo-e-contexto": renderToStaticMarkup(createElement(PerdasCustoContextoPage)),
  };
  const idsDe = (h: string) => new Set(Array.from(h.matchAll(/\bid="([^"]+)"/g), (m) => m[1]));
  const ids = Object.fromEntries(Object.entries(paginas).map(([r, h]) => [r, idsDe(h)])) as Record<string, Set<string>>;
  /** page.tsx da rota, aceitando um segmento dinâmico no fim (verbetes em /aprenda/[conceito]). */
  const paginaExiste = (rota: string) => {
    if (existsSync(join(raiz, "src/app", rota, "page.tsx"))) return true;
    const pai = join(raiz, "src/app", rota, "..");
    return existsSync(pai) && readdirSync(pai).some((d) => d.startsWith("[") && existsSync(join(pai, d, "page.tsx")));
  };
  /** Destino interno quebrado: página inexistente, arquivo ausente ou âncora que a página de perdas não tem. */
  const quebrado = (href: string, origem: string): string | null => {
    const [caminhoQuery, ancora] = href.replace(/&amp;/g, "&").split("#");
    const caminho = caminhoQuery.split("?")[0];
    if (caminho.startsWith("/energia/")) return existsSync(join(raiz, "public", caminho)) ? null : "arquivo ausente";
    const alvo = caminho || origem;
    if (caminho && !paginaExiste(caminho)) return "página inexistente";
    if (ancora && ids[alvo] && !ids[alvo].has(ancora)) return `âncora #${ancora} ausente em ${alvo}`;
    return null;
  };

  it("todo link interno das quatro páginas e dos verbetes aponta para página, arquivo e âncora existentes", () => {
    for (const [rota, h] of Object.entries(paginas)) {
      const corpo = h.slice(h.indexOf('id="conteudo"'));
      for (const m of Array.from(corpo.matchAll(/href="([^"]+)"/g))) {
        if (m[1].startsWith("http")) continue;
        expect(quebrado(m[1], rota), `${rota} → ${m[1]}`).toBeNull();
      }
    }
    // verbetes: o "veja no portal" do percentual regulatório apontava para #regulatorio na página do mapa
    for (const c of CONCEITOS_PERDAS) for (const v of c.vejaNoPortal) expect(quebrado(v.href, "/setor-eletrico/perdas"), `${c.slug} → ${v.href}`).toBeNull();
    // âncoras dos links montados no cliente (painel da distribuidora escolhida e "Comprove" com endereço)
    expect(ids["/setor-eletrico/perdas/composicao"].has("composicao")).toBe(true);
    expect(ids["/setor-eletrico/perdas/regulatorio"].has("regulatorio")).toBe(true);
    expect(ids["/setor-eletrico/perdas/custo-e-contexto"].has("custo")).toBe(true);
    expect(ids["/setor-eletrico/perdas"].has("resumo")).toBe(true);
  });

  it("anos de período, título e marca saem da gold: série, Censo, relação e leiaute", () => {
    expect(anosSerieNacional(g.nacional)).toEqual({ inicio: 2003, fim: 2025 });
    // a marca de leiaute é a mesma que a limitação publicada pelo pipeline cita
    expect(g.proveniencia.taxas.limitacoes.join(" ")).toContain(`A partir de ${ANO_LEIAUTE_SAMP} (leiaute da REN 1.003/2022)`);
    expect(marcaLeiauteSeparacao(g.nacional, "tecnica")).toEqual([{ x: "2024", rotulo: "2024: leiaute novo; 32 de 51 publicam a técnica" }]);
    expect(marcaLeiauteSeparacao(g.nacional, "pnt_bt")).toEqual([{ x: "2024", rotulo: "2024: leiaute novo; 31 de 51 com a separação fechando" }]);
    // contagens publicadas no lugar de "cerca de metade"
    expect(fraseCoberturaSeparacao(g.nacional, ref)).toBe(
      "em 2023, 48 de 50 concessionárias válidas publicaram a técnica nos 12 meses e 46 tiveram a separação fechando; em 2024, 32 de 51 e 31; em 2025, 18 de 51 e 18.",
    );
    // o texto da página diz as contagens; "cerca de metade" só resta na limitação escrita pelo pipeline na gold
    const comp = paginas["/setor-eletrico/perdas/composicao"].replace(/<[^>]+>/g, "");
    expect(comp).toContain(fraseCoberturaSeparacao(g.nacional, ref)!);
    expect(comp).not.toContain("metade deixa de publicar");
    // a tabela de contexto diz a relação da gold (a do mapa), e a dispersão, a da associação
    const custo = paginas["/setor-eletrico/perdas/custo-e-contexto"];
    expect(custo).toContain(`relação de ${g.mapa.ano_relacao} (a mesma do mapa; a dispersão usa a de ${g.associacao.ano_relacao})`);
  });

  it("ano nas tabelas da série nacional é texto (sem separador de milhar)", () => {
    expect(linhasNacionais(g.nacional)[0][0]).toBe("2003");
    expect(linhasSeparacaoNacional(g.nacional)[0][0]).toBe("2003");
  });

  it("ausência não vira zero nem frase quebrada: auditoria, referência sem ano aberto e acumulado sem ano anterior", () => {
    const semContagem = { ...g, qualidade: { ...g.qualidade, alertas: { ...g.qualidade.alertas, perda_total_negativa: null } } } as unknown as PerdasGold;
    const aud = renderToStaticMarkup(createElement(PerdasAuditoria, { g: semContagem })).replace(/<[^>]+>/g, "");
    expect(aud).toContain("perda total negativa (sem dado)");
    expect(aud).not.toContain("perda total negativa (0)");

    const semAberto = { ...g, referencia: { ...g.referencia, ano_parcial: null, ultima_competencia_parcial: null } } as PerdasGold;
    const linha = renderToStaticMarkup(createElement(ReferenciaPerdas, { g: semAberto })).replace(/<[^>]+>/g, "");
    expect(linha).toContain("ANEEL, SAMP Balanço: anos completos de 2003 a 2025; componentes tarifárias");
    expect(linha).not.toMatch(/ e +até/);

    const pAcum = periodos.find((p) => p.tipo === "acumulado")!;
    const acum = g.acumulado!;
    const semAnterior = {
      ...acum,
      agregados: acum.agregados.map((a) => ({ ...a, anterior: { ...a.anterior, taxa_total_pct: null, perdas_totais_mwh: null } })),
    };
    const recs = recortesDoPeriodo(leves, pAcum, null)!;
    for (const m of ["taxa", "volume"] as const) {
      const t = respostaMapa({ periodo: pAcum, medida: MEDIDAS[m], valores: valoresDoPeriodo(leves, recs, m, pAcum), rotulos, nacional: null, acumulado: semAnterior });
      expect(t, m).toContain("Somadas, as");
      expect(t, m).not.toContain("sem dado");
      expect(t, m).not.toContain("contra");
    }
  });

  it("o bloqueio regulatório descreve acesso recusado, não ausência de publicação, e aparece uma vez só no texto do leitor", () => {
    const texto = renderToStaticMarkup(createElement(PerdasRegulatorioPage)).replace(/<[^>]+>/g, " ");
    expect((texto.match(/recusaram/g) ?? []).length).toBe(1);
    expect(texto).not.toContain("a ANEEL não publica");
  });
});
