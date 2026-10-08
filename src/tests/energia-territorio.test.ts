/* eslint-disable @typescript-eslint/no-explicit-any -- varredura genérica da gold publicada */
import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Página Minha região (P002, mapa geográfico transversal): contrato da gold e dos
 * arquivos sob demanda, equivalência entre mapa, tabela e exportação (as mesmas linhas,
 * conferidas contra os CSV publicados pelo pipeline, lidos aqui por outro código),
 * regra de compatibilidade entre camadas, textos derivados dos números (mudar o número
 * muda o texto), estados de ausência e de fonte defasada e renderização no servidor.
 *
 * O critério de aceite do P002 ("nenhum indicador atribuído a uma granularidade
 * inferior à de origem") é conferido na interface: a ficha do município mostra cada
 * valor debaixo do seu grão, com o rótulo publicado, e nenhum valor de distribuidora,
 * conjunto ou submercado aparece na seção "do município" nem na tabela municipal.
 */

const troca = vi.hoisted(() => ({ gold: null as any }));
vi.mock("@/lib/energia/gold", async (original) => {
  const m = await original<typeof import("@/lib/energia/gold")>();
  return { ...m, lerGold: (nome: string) => (nome === "territorio.json" && troca.gold ? troca.gold : m.lerGold(nome)) };
});

import PaginaTerritorio from "@/app/setor-eletrico/territorio/page";
import { FichaDistribuidora, FichaMunicipio, FichaUsina } from "@/components/energia/TerritorioFicha";
import { problemasEvidencia, type Evidencia } from "@/lib/energia/evidencia";
import { num } from "@/lib/energia/formato";
import { matrizExportacao } from "@/lib/energia/tabela";
import { CAMPOS_MUNICIPIO_TERRITORIO, type GoldTerritorio, type MunicipiosTerritorio, type UsinasTerritorio } from "@/lib/energia/tipos-territorio";
import {
  CAMADAS,
  COLUNAS_DISTRIBUIDORAS,
  COLUNAS_UFS_SUBMERCADO,
  COLUNAS_USINAS,
  ESQUEMA_TERRITORIO,
  MEDIDAS_MUNICIPIO,
  classificacaoMedida,
  colunasMunicipios,
  conjuntosDoMunicipio,
  correspondencia,
  dadosExplorador,
  ehRegistroPequeno,
  entidadesBusca,
  estadoNaDistribuidora,
  filtrarUsinas,
  indiceDistribuidoras,
  leitorSelecao,
  linhaMunicipio,
  linhaUsina,
  mesesDeDefasagem,
  municipiosDoJson,
  proximaPergunta,
  respostaDistribuidora,
  respostaMunicipio,
  respostaSubmercado,
  respostaTerritorio,
  respostaUf,
  respostaUsina,
  situacaoVinculo,
  textoAtualidade,
  textoDefasagem,
  textoPeriodoPainel,
  textoUniverso,
  usinasDoJson,
  valoresMedida,
  type MunicipioT,
} from "@/lib/energia/territorio";

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const G: GoldTerritorio = JSON.parse(ler("public/energia/gold/territorio.json"));
const IDX_ARQ: MunicipiosTerritorio = JSON.parse(ler("public/energia/series/territorio_municipios.json"));
const USI_ARQ: UsinasTerritorio = JSON.parse(ler("public/energia/series/territorio_usinas.json"));
const D = dadosExplorador(G);
const IDX = indiceDistribuidoras(D.distribuidoras);
const MUN = municipiosDoJson(IDX_ARQ);
const porIbge = new Map(MUN.map((m) => [m.ibge, m]));
const mun = (ibge: string) => porIbge.get(ibge)!;
const LIMITE_KW = G.resumo.usinas.limite_registro_kw;
const USI = usinasDoJson(USI_ARQ, LIMITE_KW);
const nomeMun = (ibge: string) => (porIbge.has(ibge) ? `${mun(ibge).nome} (${mun(ibge).uf})` : ibge);
const distCnpj = (cnpj: string) => D.distribuidoras.find((d) => d.id === cnpj)!;
const ctxSel = (extra: Parameters<typeof correspondencia>[2] extends infer C ? Partial<C> : never) => ({ compat: G.compatibilidade, ...extra });

/** Leitor de CSV independente do da página: separador ";", vazio = ausência. */
function csv(nome: string): Record<string, string>[] {
  const linhas = ler(`public/energia/series/${nome}`).replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const cab = linhas[0].split(";");
  return linhas.slice(1).map((l) => {
    const c = l.split(";");
    return Object.fromEntries(cab.map((h, i) => [h, c[i] ?? ""]));
  });
}
const n = (s: string | undefined) => (s === undefined || s === "" ? null : Number(s));

// casos reais usados em todo o arquivo (códigos IBGE e CNPJ, nunca nome solto)
const TEFE = "1304203";
const CAREIRO_DA_VARZEA = "1301159";
const ITAITUBA = "1503606";
const SAO_PAULO = "3550308";
const BELO_HORIZONTE = "3106200";
const PORTO_RICO_MA = "2109056";
const PORTEL = "1505809";
const CEMIG = "06981180000116";
const ESS = "07282377000120";
const AMBAR_AM = "02341467000120";

/* ================================================================ contrato */

describe("contrato da gold e dos arquivos sob demanda", () => {
  it("cabeçalho, pergunta, grãos, camadas e compatibilidade publicados", () => {
    expect(G.dominio).toBe("energia");
    expect(G.disponivel).toBe(true);
    expect(G.pergunta).toBe("O que acontece na minha região?");
    expect(G.graos.map((x) => x.id).sort()).toEqual(["conjunto", "distribuidora", "municipio", "submercado", "uf", "usina"]);
    expect(G.camadas.map((c) => c.id)).toEqual(["submercado", "distribuidora", "municipio", "usinas"]);
    expect([...CAMADAS]).toEqual(G.camadas.map((c) => c.id));
    for (const c of G.compatibilidade) {
      expect(G.graos.some((x) => x.id === c.de), c.de).toBe(true);
      expect(c.regra.length, `${c.de}→${c.para}`).toBeGreaterThan(20);
    }
    // os três pares que não passam, com regra escrita
    const nao = G.compatibilidade.filter((c) => !c.valida).map((c) => `${c.de}>${c.para}`).sort();
    expect(nao).toEqual(["submercado>municipio", "usina>distribuidora", "usina>submercado"]);
  });

  it("o índice municipal tem as colunas do tipo, uma linha por município e só colunas de grão município ou referência", () => {
    expect(IDX_ARQ.campos).toEqual([...CAMPOS_MUNICIPIO_TERRITORIO]);
    expect(MUN).toHaveLength(G.resumo.municipios);
    expect(new Set(MUN.map((m) => m.ibge)).size).toBe(MUN.length);
    for (const c of IDX_ARQ.campos) expect(["ref", "municipio"], c).toContain(IDX_ARQ.graos[c]);
    // nenhum nome de indicador de outro grão nas colunas do município
    for (const c of IDX_ARQ.campos) expect(c, c).not.toMatch(/perda|dec|fec|tarifa|pld|ear|particip/i);
    // referências válidas: índice de distribuidora existente e estado do vínculo 0, 1 ou 2
    const indices = new Set(G.distribuidoras.map((d) => d.i));
    for (const m of MUN) for (const [i, e] of m.dist) {
      expect(indices.has(i), m.ibge).toBe(true);
      expect([0, 1, 2]).toContain(e);
    }
  });

  it("todo indicador do catálogo está num grão publicado e aponta para uma página existente", () => {
    const graos = new Set(G.graos.map((x) => x.id));
    for (const i of G.indicadores) {
      expect(graos.has(i.grao), i.id).toBe(true);
      const rota = i.pagina.href.replace(/^\/setor-eletrico\/?/, "");
      expect(existsSync(join(raiz, "src/app/setor-eletrico", rota, "page.tsx")), i.pagina.href).toBe(true);
      if (i.grao !== "municipio") expect(i.rotulo_no_municipio, i.id).not.toBe("do município");
    }
  });

  it("evidências dos números de destaque completas, downloads e arquivos sob demanda existentes", () => {
    const evs = Object.entries(G.evidencias) as [string, Evidencia][];
    expect(evs.length).toBe(3);
    for (const [k, ev] of evs) expect(problemasEvidencia(ev), k).toEqual([]);
    expect(G.evidencias.municipios_compartilhados!.valor_calculo).toBe(G.resumo.municipios_compartilhados);
    for (const d of G.downloads) expect(existsSync(join(raiz, "public", d.url)), d.url).toBe(true);
    for (const u of [G.series.municipios, G.series.usinas, G.geometria.uf, G.geometria.municipios]) expect(existsSync(join(raiz, "public", u)), u).toBe(true);
  });

  it("o explorador recebe só as distribuidoras com área e todas as UFs e submercados", () => {
    expect(D.distribuidoras).toHaveLength(G.distribuidoras.filter((d) => d.area.municipios > 0).length);
    expect(D.ufs).toHaveLength(27);
    expect(D.submercados.map((s) => s.id)).toEqual(["SE", "S", "NE", "N"]);
    // toda distribuidora referenciada por um município está no explorador (a ficha nunca fica sem a distribuidora)
    for (const m of MUN) for (const [i] of m.dist) expect(IDX.has(i), `${m.ibge} → ${i}`).toBe(true);
  });
});

/* ================================================================ mapa, tabela e exportação */

describe("mapa, tabela e exportação usam as mesmas linhas", () => {
  const linhas = MUN.map((m) => linhaMunicipio(m, IDX));

  it("cada medida do mapa municipal é a coluna da tabela, e a exportação tem as mesmas linhas", () => {
    for (const med of MEDIDAS_MUNICIPIO) {
      const valores = valoresMedida(linhas, med);
      expect(Object.keys(valores)).toHaveLength(linhas.length);
      const cols = colunasMunicipios(med);
      // a coluna da medida vem logo depois de município, UF e código
      expect(cols[3].id, med).toBe(med);
      const mat = matrizExportacao(cols, linhas);
      expect(mat.linhas, med).toHaveLength(linhas.length);
      for (let k = 0; k < linhas.length; k++) {
        const v = valores[linhas[k].id];
        expect(mat.linhas[k][3] ?? null, `${med} ${linhas[k].id}`).toBe(v ?? null);
      }
      // a legenda conta o que o mapa pinta: classes + sem dado = municípios
      const cl = classificacaoMedida(med, Object.values(valores));
      expect(cl.classes.reduce((s, c) => s + c.contagem, 0) + cl.semDado + cl.naoSeAplica, med).toBe(linhas.length);
    }
  });

  it("valores municipais iguais ao CSV publicado pelo pipeline (outro arquivo, outro leitor)", () => {
    const C = new Map(csv("territorio_municipios.csv").map((r) => [r.codigo_ibge, r]));
    expect(C.size).toBe(MUN.length);
    const pares: [keyof MunicipioT, string][] = [
      ["pop", "populacao"],
      ["mmgd_un", "mmgd_unidades"],
      ["mmgd_kw", "mmgd_kw"],
      ["mmgd_w_hab", "mmgd_w_por_habitante"],
      ["tsee_faturas", "tsee_faturas"],
      ["tsee_proxy_pct", "tsee_razao_proxy_pct"],
      ["lpt_dom", "lpt_domicilios"],
      ["usi_op_n", "usinas_operacao_so_no_municipio"],
      ["usi_op_mw", "usinas_operacao_mw_fiscalizado"],
      ["usi_reg_n", "registros_ate_10kw_so_no_municipio"],
      ["usi_reg_kw", "registros_ate_10kw_kw_fiscalizado"],
      ["isol_n", "localidades_isoladas"],
    ];
    for (const m of MUN) {
      const r = C.get(m.ibge)!;
      expect(r, m.ibge).toBeTruthy();
      for (const [a, b] of pares) expect(m[a] ?? null, `${m.ibge} ${a}`).toBe(n(r[b]));
      expect(m.sm ?? "", m.ibge).toBe(r.submercado);
      expect(m.sm_estado ?? "", m.ibge).toBe(r.estado_submercado);
      // distribuidoras: o CSV traz CNPJ e estado; o índice, a referência
      const doCsv = r.distribuidoras ? r.distribuidoras.split("|").map((x) => x.split(":").slice(1).join(":")) : [];
      const doIdx = m.dist.map(([i, e]) => `${G.distribuidoras.find((d) => d.i === i)!.cnpj}:${e}`);
      expect(doIdx, m.ibge).toEqual(doCsv);
    }
  });

  it("linhas das distribuidoras iguais ao CSV publicado (valores da área inteira)", () => {
    const C = new Map(csv("territorio_distribuidoras.csv").map((r) => [r.cnpj, r]));
    for (const d of D.distribuidoras) {
      const r = C.get(d.id)!;
      expect(r, d.sigla).toBeTruthy();
      expect(d.municipios, d.sigla).toBe(n(r.municipios));
      expect(d.perdas_pct, d.sigla).toBe(n(r.perdas_taxa_total_pct));
      expect(d.dec_h, d.sigla).toBe(n(r.dec_h));
      expect(d.fec, d.sigla).toBe(n(r.fec));
      expect(d.tarifa, d.sigla).toBe(n(r.tarifa_b1_total_rs_mwh));
      expect(d.tsee_pct, d.sigla).toBe(n(r.tsee_participacao_pct));
    }
    expect(matrizExportacao(COLUNAS_DISTRIBUIDORAS, D.distribuidoras).linhas).toHaveLength(D.distribuidoras.length);
    // CEMIG-D: tarifa B1 da REH 3.589/2026 (TUSD 593,08 + TE 310,21), conferida no módulo contra o CSV da ANEEL
    const cemig = distCnpj(CEMIG);
    expect(cemig.tarifa).toBe(903.29);
    expect(cemig.tarifa_ato).toBe("REH 3.589/2026");
  });

  it("a área acesa no mapa de uma distribuidora conta o mesmo que a gold publica para ela", () => {
    for (const d of D.distribuidoras) {
      const conta = { 0: 0, 1: 0, 2: 0 } as Record<number, number>;
      for (const m of MUN) {
        const e = estadoNaDistribuidora(m, d.i);
        if (e !== null) conta[e]++;
      }
      expect(conta[1], d.sigla).toBe(d.confirmados);
      expect(conta[2], d.sigla).toBe(d.so_mmgd);
      expect(conta[0], d.sigla).toBe(d.nao_confirmados);
    }
  });

  it("a situação do vínculo (cor do mapa de distribuidoras) fecha com o resumo da gold", () => {
    const s = MUN.map(situacaoVinculo);
    expect(s.filter((x) => x === "compartilhado")).toHaveLength(G.resumo.municipios_compartilhados);
    expect(s.filter((x) => x === "sem_vinculo")).toHaveLength(G.resumo.municipios_sem_vinculo.length);
    expect(MUN.filter((m) => situacaoVinculo(m) === "so_sem_confirmacao").map((m) => m.ibge).sort()).toEqual([...G.resumo.municipios_so_vinculo_nao_confirmado].sort());
    expect(s.filter((x) => x !== "sem_vinculo" && x !== "so_sem_confirmacao")).toHaveLength(G.resumo.municipios_com_distribuidora);
    // estados do submercado no índice = os do resumo (legenda antes de o índice chegar)
    for (const [estado, total] of Object.entries(G.resumo.municipios_por_estado_submercado)) expect(MUN.filter((m) => m.sm_estado === estado), estado).toHaveLength(total as number);
  });

  it("tabela das UFs do mapa de submercados: uma linha por UF pintada, com o subsistema da camada da EPE", () => {
    expect(matrizExportacao(COLUNAS_UFS_SUBMERCADO, D.ufs).linhas).toHaveLength(27);
    for (const u of D.ufs) expect(u.subsistema, u.uf).toBe(G.areas_carga.mapeamento_epe[u.uf]);
  });

  it("usinas: registros de até 10 kW pela regra publicada, filtro igual no mapa e na tabela, e valores iguais ao CSV", () => {
    expect(USI).toHaveLength(G.resumo.usinas.total);
    expect(USI.filter((u) => u.registro_ate_10kw)).toHaveLength(G.resumo.usinas.registros_ate_10kw);
    expect(ehRegistroPequeno({ outorga: "Registro", estagio: "operacao", mw_fiscalizado: 0.01 }, 10)).toBe(true);
    expect(ehRegistroPequeno({ outorga: "Registro", estagio: "operacao", mw_fiscalizado: 0.0105 }, 10)).toBe(false);
    expect(ehRegistroPequeno({ outorga: "Autorização", estagio: "operacao", mw_fiscalizado: 0.003 }, 10)).toBe(false);
    const C = csv("territorio_usinas.csv");
    expect(C.filter((r) => r.registro_ate_10kw === "1")).toHaveLength(G.resumo.usinas.registros_ate_10kw);
    const porCeg = new Map(C.map((r) => [r.ceg, r]));
    for (const u of USI) {
      const r = porCeg.get(u.ceg)!;
      expect(u.mw_fiscalizado, u.ceg).toBe(n(r.mw_fiscalizado));
      expect(u.registro_ate_10kw ? "1" : "0", u.ceg).toBe(r.registro_ate_10kw);
    }
    const vis = filtrarUsinas(USI, { fon: ["solar", "eolica", "hidraulica", "termica", "nuclear"], est: ["operacao", "construcao", "construcao_nao_iniciada"], reg: false });
    expect(vis).toHaveLength(USI.length - G.resumo.usinas.registros_ate_10kw);
    const tabela = vis.map((u) => linhaUsina(u, nomeMun));
    expect(matrizExportacao(COLUNAS_USINAS, tabela).linhas).toHaveLength(vis.length);
    // Portel: os 5.708 registros do índice são as usinas do arquivo com Portel e registro
    expect(USI.filter((u) => u.registro_ate_10kw && u.n_declarados === 1 && u.municipios[0] === PORTEL)).toHaveLength(mun(PORTEL).usi_reg_n);
  });

  it("conjuntos da ficha vêm da tabela de conjuntos do índice, com o valor do conjunto inteiro", () => {
    const cj = conjuntosDoMunicipio(mun(SAO_PAULO), IDX_ARQ.conjuntos.linhas, IDX);
    expect(cj).toHaveLength(mun(SAO_PAULO).conj.length);
    const C = new Map(csv("territorio_conjuntos.csv").map((r) => [r.conjunto, r]));
    for (const c of cj) {
      expect(c.dec_h, c.id).toBe(n(C.get(c.id)!.dec_h));
      expect(c.fec, c.id).toBe(n(C.get(c.id)!.fec));
    }
  });
});

/* ================================================================ compatibilidade entre camadas */

describe("a escolha passa de uma camada para outra só quando a gold declara a correspondência", () => {
  it("município fora do SIN não acende submercado; com localidade isolada acende com ressalva", () => {
    const tefe = correspondencia({ tipo: "mun", id: TEFE }, "submercado", ctxSel({ municipio: mun(TEFE) }));
    expect(tefe.valida).toBe(false);
    expect(tefe.sms).toEqual([]);
    expect(tefe.texto).toMatch(/sede é localidade isolada/);
    const careiro = correspondencia({ tipo: "mun", id: CAREIRO_DA_VARZEA }, "submercado", ctxSel({ municipio: mun(CAREIRO_DA_VARZEA) }));
    expect(careiro.valida).toBe(false);
    expect(careiro.texto).toMatch(/metade da população/);
    const ita = correspondencia({ tipo: "mun", id: ITAITUBA }, "submercado", ctxSel({ municipio: mun(ITAITUBA) }));
    expect(ita).toMatchObject({ valida: true, aviso: true, sms: ["N"] });
    const bh = correspondencia({ tipo: "mun", id: BELO_HORIZONTE }, "submercado", ctxSel({ municipio: mun(BELO_HORIZONTE) }));
    expect(bh).toMatchObject({ valida: true, aviso: false, sms: ["SE"] });
  });

  it("município com uma distribuidora acende a área dela; com duas, lista e não escolhe; sem vínculo, não passa", () => {
    const bh = correspondencia({ tipo: "mun", id: BELO_HORIZONTE }, "distribuidora", ctxSel({ municipio: mun(BELO_HORIZONTE) }));
    expect(bh.dist).toBe(distCnpj(CEMIG).i);
    const sp = correspondencia({ tipo: "mun", id: SAO_PAULO }, "distribuidora", ctxSel({ municipio: mun(SAO_PAULO) }));
    expect(sp.dist).toBeNull();
    expect(sp.candidatas).toHaveLength(2);
    expect(sp.aviso).toBe(true);
    expect(sp.texto).toMatch(/não escolhe/);
    const pr = correspondencia({ tipo: "mun", id: PORTO_RICO_MA }, "distribuidora", ctxSel({ municipio: mun(PORTO_RICO_MA) }));
    expect(pr.valida).toBe(false);
  });

  it("distribuidora: submercado único acende; área em dois submercados lista os dois; parte fora do SIN avisa", () => {
    const cemig = correspondencia({ tipo: "dist", id: CEMIG }, "submercado", ctxSel({ distribuidora: distCnpj(CEMIG) }));
    expect(cemig).toMatchObject({ valida: true, sms: ["SE"], aviso: false });
    const ess = correspondencia({ tipo: "dist", id: ESS }, "submercado", ctxSel({ distribuidora: distCnpj(ESS) }));
    expect(ess.sms.sort()).toEqual(["S", "SE"]);
    expect(ess.aviso).toBe(true);
    const ambar = correspondencia({ tipo: "dist", id: AMBAR_AM }, "submercado", ctxSel({ distribuidora: distCnpj(AMBAR_AM) }));
    expect(ambar.sms).toEqual(["N"]);
    expect(ambar.texto).toMatch(/fora do SIN/);
    // distribuidora → municípios: destaca a área, não escolhe um município
    const area = correspondencia({ tipo: "dist", id: CEMIG }, "municipio", ctxSel({ distribuidora: distCnpj(CEMIG) }));
    expect(area).toMatchObject({ municipios: "area", municipio: null });
  });

  it("submercado não seleciona município, e usina não passa para submercado nem distribuidora (regra da gold)", () => {
    const regra = (de: string, para: string) => G.compatibilidade.find((c) => c.de === de && c.para === para)!.regra;
    const sm = correspondencia({ tipo: "sm", id: "NE" }, "municipio", ctxSel({}));
    expect(sm).toMatchObject({ valida: false, texto: regra("submercado", "municipio") });
    expect(correspondencia({ tipo: "sm", id: "NE" }, "distribuidora", ctxSel({})).valida).toBe(false);
    const usina = USI.find((u) => u.n_declarados === 2)!;
    expect(correspondencia({ tipo: "usi", id: usina.ceg }, "submercado", ctxSel({ usina })).texto).toBe(regra("usina", "submercado"));
    expect(correspondencia({ tipo: "usi", id: usina.ceg }, "distribuidora", ctxSel({ usina })).texto).toBe(regra("usina", "distribuidora"));
    expect(correspondencia({ tipo: "usi", id: usina.ceg }, "municipio", ctxSel({ usina }))).toMatchObject({ valida: true, municipios: "declarados" });
  });

  it("a escolha na URL: tipo e código validados, ida e volta sem perda", () => {
    for (const s of [{ tipo: "mun", id: TEFE }, { tipo: "dist", id: CEMIG }, { tipo: "sm", id: "SE" }, { tipo: "uf", id: "BA" }, { tipo: "usi", id: USI[0].ceg }] as const) {
      expect(leitorSelecao.ler(leitorSelecao.escrever(s))).toEqual(s);
    }
    for (const ruim of ["mun:123", "dist:0698118000011", "sm:CO", "uf:ba", "xx:1", "mun", ""]) expect(leitorSelecao.ler(ruim), ruim).toBeUndefined();
    expect(ESQUEMA_TERRITORIO.cmp.padrao).toEqual([]);
    expect(ESQUEMA_TERRITORIO.cam.padrao).toBe("submercado");
  });

  it("a busca encontra município, distribuidora (sigla, nome e CNPJ), UF e submercado", () => {
    const ent = entidadesBusca(D, MUN);
    expect(ent.filter((e) => e.tipo === "mun")).toHaveLength(MUN.length);
    expect(ent.find((e) => e.id === `dist:${CEMIG}`)!.sinonimos).toContain(CEMIG);
    expect(entidadesBusca(D, null).some((e) => e.tipo === "mun")).toBe(false);
  });
});

/* ================================================================ textos derivados */

describe("textos derivados dos números", () => {
  const ctx = { distribuidoras: IDX, populacaoAno: G.referencias.populacao_ano };

  it("a resposta do painel cita os números do resumo e muda quando eles mudam", () => {
    const t = respostaTerritorio(G);
    const e = G.resumo.municipios_por_estado_submercado;
    expect(t).toContain(`${num(G.resumo.municipios, 0)} municípios`);
    expect(t).toContain(`${num(G.resumo.municipios_compartilhados, 0)} delas com mais de uma`);
    expect(t).toContain(`${num((e.provado ?? 0) + (e.provado_com_area_sem_carga ?? 0), 0)} municípios estão num submercado`);
    expect(t).toContain(`${num(e.fora_do_sin ?? 0, 0)} estão fora do SIN`);
    expect(t).toContain(`${num(G.resumo.usinas.todos_municipios_reconhecidos, 0)} têm todos os municípios`);
    // o número da resposta bate com a evidência do KPI
    expect(G.evidencias.municipios_com_submercado!.valor_calculo).toBe((e.provado ?? 0) + (e.provado_com_area_sem_carga ?? 0));
    const g2 = structuredClone(G);
    g2.resumo.municipios_compartilhados = 441;
    g2.resumo.municipios_sem_vinculo = [];
    const t2 = respostaTerritorio(g2);
    expect(t2).toContain("441 delas");
    expect(t2).not.toContain("sem vínculo");
  });

  it("a resposta do município diz quem atende, o submercado (ou que não se aplica) e só valores do município", () => {
    const tefe = respostaMunicipio(mun(TEFE), ctx);
    expect(tefe).toContain("Tefé (AM)");
    expect(tefe).toContain("fora do SIN");
    expect(tefe).toContain("o submercado não se aplica");
    expect(tefe).not.toMatch(/R\$|PLD|%/);
    const sp = respostaMunicipio(mun(SAO_PAULO), ctx);
    expect(sp).toMatch(/atendido por 2 distribuidoras/);
    expect(sp).toContain(`${num(mun(SAO_PAULO).usi_op_n, 0)} usinas em operação`);
    expect(sp).toContain("registros de até 10 kW");
    const portel = respostaMunicipio(mun(PORTEL), ctx);
    expect(portel).toContain("nenhuma usina em operação");
    expect(portel).toContain(`${num(5708, 0)} registros`);
    expect(respostaMunicipio(mun(PORTO_RICO_MA), ctx)).toContain("não tem distribuidora com vínculo");
    // ausência vira "sem dado", nunca zero
    const semPop = { ...mun(BELO_HORIZONTE), pop: null };
    expect(respostaMunicipio(semPop, ctx)).toContain("população sem dado");
    expect(respostaMunicipio({ ...mun(BELO_HORIZONTE), usi_op_n: 1, usi_op_mw: 2 }, ctx)).toContain("1 usina em operação declarada só nele");
  });

  it("distribuidora, submercado, UF e usina: valores do próprio grão, com ausência e ano parcial escritos", () => {
    const cemig = distCnpj(CEMIG);
    const t = respostaDistribuidora(cemig);
    expect(t).toContain(`perdas de ${num(cemig.perdas_pct, 2)}%`);
    expect(t).toContain("área inteira da distribuidora, não de um município");
    expect(respostaDistribuidora({ ...cemig, perdas_pct: null })).toContain("perdas sem dado");
    expect(respostaDistribuidora({ ...cemig, perdas_situacao: "ano parcial" })).toContain("(ano parcial)");
    const parcial = D.distribuidoras.find((d) => d.perdas_situacao === "ano parcial");
    expect(parcial, "há distribuidora com ano parcial na gold").toBeTruthy();
    const se = D.submercados[0];
    expect(respostaSubmercado(se)).toContain(`R$ ${num(se.pld_dia, 2)}/MWh`);
    expect(respostaSubmercado(se)).toContain("não de uma UF nem de um município");
    const ba = D.ufs.find((u) => u.uf === "BA")!;
    expect(respostaUf(ba)).toContain("Nordeste");
    const multi = USI.find((u) => u.n_declarados === 2 && u.municipios.length === 2)!;
    expect(respostaUsina(multi, nomeMun)).toContain("sem a potência repartida");
  });

  it("período, universo, atualidade e defasagem saem dos dados", () => {
    expect(textoUniverso(G)).toContain(`${num(G.resumo.usinas.total, 0)} usinas do SIGA`);
    expect(textoPeriodoPainel(G)).toContain(`relação de distribuidoras de ${G.referencias.relacao_distribuidoras_ano}`);
    expect(textoAtualidade(G)).toContain("conferida em 16/09/2026 e 13/09/2026");
    expect(mesesDeDefasagem("2025-05", "2026-10-01")).toBe(17);
    expect(mesesDeDefasagem("2025", "2026-10-01")).toBeNull();
    expect(textoDefasagem("2026-09", "2026-10-01")).toBeNull();
    expect(textoDefasagem("2025-05", "2026-10-01")).toContain("mai/2025, 17 meses antes");
    // a Tarifa Social da distribuidora (SCS) é a fonte defasada desta publicação: o texto aparece
    expect(D.distribuidoras.some((d) => textoDefasagem(d.tsee_ref, D.dataReferencia) !== null)).toBe(true);
  });

  it("próxima pergunta de cada camada vem da navegação", () => {
    expect(proximaPergunta("distribuidora").href).toBe("/setor-eletrico/perdas");
    expect(proximaPergunta("submercado").href).toBe("/setor-eletrico/pld");
    for (const c of CAMADAS) expect(proximaPergunta(c).pergunta).toMatch(/\?$/);
  });

  it("nenhum texto gerado usa travessão ou hífen como pontuação", () => {
    const textos = [
      respostaTerritorio(G),
      textoAtualidade(G),
      textoUniverso(G),
      textoPeriodoPainel(G),
      ...[TEFE, SAO_PAULO, PORTEL, ITAITUBA, PORTO_RICO_MA].map((c) => respostaMunicipio(mun(c), ctx)),
      ...D.distribuidoras.map(respostaDistribuidora),
      ...D.submercados.map(respostaSubmercado),
      ...D.ufs.map(respostaUf),
    ];
    for (const x of textos) expect(x).not.toMatch(/ [—–-] |—/);
  });
});

/* ================================================================ critério de aceite na interface */

describe("critério do P002 na ficha: cada número debaixo do seu grão", () => {
  const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
  const secao = (h: string, grao: string) => {
    const i = h.indexOf(`data-grao="${grao}"`);
    if (i < 0) return "";
    const fim = h.indexOf("</section>", i);
    return h.slice(i, fim);
  };
  const ficha = (ibge: string) =>
    html(
      createElement(FichaMunicipio, {
        m: mun(ibge),
        dados: D,
        idx: IDX,
        conjuntos: conjuntosDoMunicipio(mun(ibge), IDX_ARQ.conjuntos.linhas, IDX),
        submercado: mun(ibge).sm && mun(ibge).sm_estado !== "fora_do_sin" ? D.submercados.find((s) => s.id === mun(ibge).sm)! : null,
        uf: D.ufs.find((u) => u.uf === mun(ibge).uf)!,
        onSelecionar: () => {},
      }),
    );

  it("Belo Horizonte: perdas, DEC e tarifa só na seção da distribuidora, com o rótulo da área inteira; PLD só na do submercado", () => {
    const h = ficha(BELO_HORIZONTE);
    const cemig = distCnpj(CEMIG);
    const se = D.submercados.find((s) => s.id === "SE")!;
    const doMun = secao(h, "municipio");
    const daDist = secao(h, "distribuidora");
    const doSm = secao(h, "submercado");
    expect(doMun).toContain(num(mun(BELO_HORIZONTE).pop, 0));
    for (const v of [`${num(cemig.perdas_pct, 2)}%`, `${num(cemig.tarifa, 2)} R$/MWh`, num(cemig.dec_h, 2)]) {
      expect(daDist, v).toContain(v);
      expect(doMun, v).not.toContain(v);
    }
    expect(daDist).toContain("valor da área inteira da distribuidora, não do município");
    expect(doSm).toContain(`${num(se.pld_dia, 2)} R$/MWh`);
    expect(doMun).not.toContain(num(se.pld_dia, 2));
    expect(doSm).toContain("não é um valor do município");
    expect(secao(h, "conjunto")).toContain("o conjunto pode cobrir outros municípios");
  });

  it("Tefé, fora do SIN: o submercado não se aplica e nenhum valor de submercado aparece", () => {
    const h = ficha(TEFE);
    const doSm = secao(h, "submercado");
    expect(doSm).toContain('data-nao-se-aplica="submercado"');
    for (const s of D.submercados) if (s.pld_dia !== null) expect(h).not.toContain(`${num(s.pld_dia, 2)} R$/MWh`);
  });

  it("São Paulo: as duas distribuidoras na ficha, cada uma com os seus valores, sem escolher uma", () => {
    const h = ficha(SAO_PAULO);
    const daDist = secao(h, "distribuidora");
    for (const [i] of mun(SAO_PAULO).dist) expect(daDist).toContain(IDX.get(i)!.sigla);
    expect(h).toContain("Das distribuidoras que atendem o município");
  });

  it("ficha da distribuidora e da usina: grão explícito e links que levam a mesma entidade à página de origem", () => {
    const h = html(createElement(FichaDistribuidora, { d: distCnpj(CEMIG), dados: D, onSelecionar: () => {} }));
    expect(h).toContain(`/setor-eletrico/perdas?d=${CEMIG}`);
    expect(h).toContain(`/setor-eletrico/qualidade?dist=${CEMIG}`);
    expect(h).toContain("Valores da área inteira");
    const usina = USI.find((u) => u.n_declarados === 2 && u.municipios.length === 2)!;
    const hu = html(createElement(FichaUsina, { u: usina, dados: D, nomeMunicipio: nomeMun, onSelecionar: () => {} }));
    expect(hu).toContain("O submercado de uma usina depende do ponto de conexão");
    for (const ibge of usina.municipios) expect(hu).toContain(mun(ibge).nome);
  });

  it("a tabela municipal e a comparação não têm coluna de outro grão", () => {
    for (const c of colunasMunicipios("mmgd_w_hab")) expect(c.id, c.id).not.toMatch(/perda|dec|fec|tarifa|pld|ear/);
  });
});

/* ================================================================ página no servidor */

describe("página renderizada no servidor", () => {
  troca.gold = null;
  const h = renderToStaticMarkup(createElement(PaginaTerritorio));
  const principal = h.slice(h.indexOf("<main"));

  it("renderiza o painel com a pergunta como título, a resposta derivada e a anatomia da seção 7.2", () => {
    expect(h).toContain('id="p002"');
    expect(h).toContain('id="p002-titulo"');
    expect(h).toContain(G.pergunta);
    expect(h).toContain('data-resposta="p002"');
    expect(h).toContain(respostaTerritorio(G).slice(0, 40));
    for (const parte of ["Período", "Universo", "Unidade", "Como interpretar", "O que não é possível concluir", "Próxima pergunta", "Copiar link deste painel", "Baixar os dados deste painel", "Regra de atribuição"]) {
      expect(h, parte).toContain(parte);
    }
    expect((h.match(/Comprove este número/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(h).toContain('role="radiogroup" aria-label="Nível de profundidade"');
    for (const d of G.downloads) expect(h, d.url).toContain(`href="${d.url}"`);
  });

  it("explorador no HTML: busca, camadas, ficha e tabelas equivalentes já no servidor", () => {
    expect(h).toContain("Encontre a sua região");
    expect(h).toContain("Camada do mapa");
    for (const c of ["Submercados", "Distribuidoras", "Municípios", "Usinas"]) expect(h).toContain(c);
    expect(h).toContain("Tabela equivalente do mapa");
    expect(h).toContain("Submercado de cada UF (as UFs que o mapa pinta)");
    expect(h).toContain("Distribuidoras: área e indicadores da área inteira");
    expect(h).toContain("Submercados: preço, armazenamento e MMGD estimada");
    expect(h).toContain("Correspondências entre tipos de área declaradas na base");
    expect(h).toContain("Fechamento por submercado nos dias conferidos");
    expect((h.match(/<table/g) ?? []).length).toBeGreaterThanOrEqual(8);
    // o mapa ainda não tem malha no servidor: estado de carga com altura fixa, nunca "em breve"
    expect(h).toContain("Carregando o mapa das UFs (IBGE)");
  });

  it("sem estado de construção, sem hexadecimal solto e abaixo de 600 KB somando HTML e dados do cliente", () => {
    expect(principal).not.toMatch(/em breve|em integração|em construção/i);
    expect(h).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    // no App Router o HTML leva também as props dos componentes cliente (fluxo RSC)
    const props = JSON.stringify(D).length + Object.values(G.evidencias).reduce((s, e) => s + JSON.stringify(e).length, 0) + JSON.stringify(G.proveniencia).length;
    expect(h.length + props).toBeLessThan(600_000);
  });

  it("gold ausente: estado de indisponibilidade com o motivo, sem número", () => {
    troca.gold = { dominio: "energia", disponivel: false, motivo: "falha de teste na leitura", gerado_em: "2026-10-01T00:00:00Z" };
    const x = renderToStaticMarkup(createElement(PaginaTerritorio));
    troca.gold = null;
    expect(x).toContain("Minha região indisponível nesta publicação");
    expect(x).toContain("falha de teste na leitura");
    expect(x).not.toContain('data-resposta="p002"');
  });
});
