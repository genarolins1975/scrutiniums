/* eslint-disable @typescript-eslint/no-explicit-any -- varredura genérica da gold publicada */
import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Fragment, createElement, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Página Transição e ambiente (P063 e P064): contrato da gold, equivalência entre
 * gráfico, tabela e exportação (as mesmas linhas, conferidas contra os CSV
 * publicados pelo pipeline por caminho independente: somas dos arquivos lidos aqui,
 * sem as funções da página), textos derivados dos números (mudar o número muda o
 * texto), estados de ausência e de fonte defasada, e renderização no servidor.
 */

// a gold lida pelas páginas pode ser trocada por uma versão alterada (estados de ausência)
const troca = vi.hoisted(() => ({ gold: null as any }));
vi.mock("@/lib/energia/gold", async (original) => {
  const m = await original<typeof import("@/lib/energia/gold")>();
  return { ...m, lerGold: (nome: string) => (nome === "transicao.json" && troca.gold ? troca.gold : m.lerGold(nome)) };
});

import Sintese from "@/app/setor-eletrico/transicao/page";
import PaginaMmgd from "@/app/setor-eletrico/transicao/mmgd/page";
import PaginaEnergia from "@/app/setor-eletrico/transicao/energia-estimada/page";
import PaginaEmissoes from "@/app/setor-eletrico/transicao/emissoes/page";
import { problemasEvidencia, type Evidencia } from "@/lib/energia/evidencia";
import { num, pct } from "@/lib/energia/formato";
import { DESTINOS_NAVEGACAO } from "@/lib/energia/navegacao";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { matrizExportacao } from "@/lib/energia/tabela";
import {
  CODIGO_UF,
  COLUNAS_ANUAL,
  COLUNAS_FATOR_ANUAL,
  COLUNAS_ONS_MENSAL,
  ESQUEMA_EMISSOES,
  ESQUEMA_MMGD,
  MEDIDAS_UF,
  MEDIDA_UF,
  PERGUNTA_A11,
  PERGUNTA_ONS,
  colunasDistribuidoras,
  colunasMunicipios,
  colunasUfs,
  dadosBarrasUf,
  dadosConferencia,
  dadosFatorAnual,
  dadosFatorMensal,
  dadosHistoricoUfs,
  dadosMensal,
  dadosOnsMensal,
  dadosPerfilAnos,
  estadoAcessoMcti,
  historicoMunicipiosCsv,
  lerCsv,
  linhasAnual,
  linhasDistribuidoras,
  linhasFatorAnual,
  linhasOnsMensal,
  linhasPerfil,
  linhasUfs,
  mudancaEmissoes,
  mudancaMmgd,
  mudancaOns,
  municipiosDoJson,
  participacaoTexto,
  perguntaPainel,
  primeiroAnoCoberto,
  referenciaAnual,
  referenciaUf,
  respostaEmissoes,
  respostaMmgd,
  respostaOns,
  textoModalidadesRemotas,
  valoresMapaUf,
} from "@/lib/energia/transicao";
import type { GoldTransicao, MunicipiosMmgdArquivo } from "@/lib/energia/tipos-transicao";
import { lerEstado } from "@/lib/energia/estadoUrl";

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const gold = (): GoldTransicao => JSON.parse(ler("public/energia/gold/transicao.json"));
const G = gold();
const csv = (n: string) => lerCsv(ler(`public/energia/series/${n}`));
const n = (s: string | undefined) => (s === undefined || s === "" ? null : Number(s));
const PRIMEIRO = primeiroAnoCoberto(G.mmgd.controles.cobertura_das_series.inicio_declarado);

/** Soma por chave de um CSV publicado (caminho independente das funções da página). */
function somaPor(linhas: Record<string, string>[], chave: (r: Record<string, string>) => string | null, campo: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of linhas) {
    const k = chave(r);
    if (k === null) continue;
    out.set(k, (out.get(k) ?? 0) + Number(r[campo] || "0"));
  }
  return out;
}

/**
 * Estimativa do fluxo RSC que o Next.js embute no HTML de uma página estática: a
 * árvore dos componentes de servidor expandida (elementos como JSON) e, nos
 * componentes "use client", só as props. Somada ao HTML renderizado, aproxima o peso
 * real da página (contrato, seção 5.1: meta de cerca de 600 KB), sem rodar o build.
 */
const CLIENTES = new Set<string>();
for (const d of ["src/components/energia", "src/components/evidencia", "src/components/telemetria"]) {
  for (const f of readdirSync(join(raiz, d))) {
    const t = ler(join(d, f));
    if (t.startsWith('"use client"')) for (const m of Array.from(t.matchAll(/export function (\w+)/g))) CLIENTES.add(m[1]);
  }
}
const repl = (_k: string, v: unknown) => (typeof v === "function" ? "$F" : typeof v === "symbol" ? "$S" : v);
function arvoreRsc(nodo: unknown): unknown {
  if (nodo === null || nodo === undefined || typeof nodo === "boolean") return null;
  if (typeof nodo === "string" || typeof nodo === "number") return nodo;
  if (Array.isArray(nodo)) return nodo.map(arvoreRsc);
  if (!isValidElement(nodo)) return null;
  const e = nodo as ReactElement<any>;
  const { children, ...resto } = e.props ?? {};
  if (typeof e.type === "string") return ["$", e.type, e.key, { ...resto, children: arvoreRsc(children) }];
  if (e.type === Fragment) return arvoreRsc(children);
  const nome = (e.type as any)?.name ?? "";
  if (typeof e.type !== "function" || CLIENTES.has(nome)) return ["$", `L${nome}`, e.key, { ...resto, children: arvoreRsc(children) }];
  try {
    return arvoreRsc((e.type as any)(e.props));
  } catch {
    // componente de biblioteca com hook (ex.: Link): é cliente, entram só as props
    return ["$", `L${nome}`, e.key, { ...resto, children: arvoreRsc(children) }];
  }
}
const pesoRsc = (pagina: () => unknown) => JSON.stringify(arvoreRsc(pagina()), repl).length;

describe("contrato da gold transicao.json", () => {
  it("cabeçalho, disponibilidade, painéis e os três blocos", () => {
    expect(G.dominio).toBe("energia");
    expect(G.disponivel).toBe(true);
    expect(G.paineis).toEqual(["P063", "P064"]);
    expect(Array.isArray(G.pendencias)).toBe(true);
    expect(G.mmgd.resumo.unidades).toBeGreaterThan(0);
    expect(G.ons_mmgd).not.toBeNull();
    expect(G.emissoes).not.toBeNull();
  });

  it("toda proveniência tem natureza, fonte com URL, período, snapshot e limitações; calculado tem fórmula; download existe", () => {
    const provs = [G.mmgd.proveniencia.cadastro, G.mmgd.proveniencia.por_habitante, G.ons_mmgd!.proveniencia.estimativa, G.ons_mmgd!.proveniencia.razao, G.emissoes!.proveniencia.medio, G.emissoes!.proveniencia.mdl];
    for (const p of provs) {
      expect(["OBSERVADO", "CALCULADO", "ESTIMADO"]).toContain(p.natureza);
      expect(p.fonte.url_primaria ?? p.fonte.url_dataset, p.indicador).toMatch(/^https:\/\//);
      expect(p.periodo_referencia.inicio <= p.periodo_referencia.fim, p.indicador).toBe(true);
      expect(p.snapshot, p.indicador).toBeTruthy();
      expect(p.limitacoes.length, p.indicador).toBeGreaterThan(0);
      if (p.natureza === "CALCULADO") expect(p.formula, p.indicador).toBeTruthy();
      if (p.download) expect(existsSync(join(raiz, "public", p.download)), p.download).toBe(true);
    }
    // fatores do MCTI e MMGD do ONS são estimados pela fonte; cadastro é observado
    expect(G.emissoes!.proveniencia.medio.natureza).toBe("ESTIMADO");
    expect(G.ons_mmgd!.proveniencia.estimativa.natureza).toBe("ESTIMADO");
    expect(G.mmgd.proveniencia.cadastro.natureza).toBe("OBSERVADO");
  });

  it("todas as fichas 'Comprove este número' passam na verificação da interface e servem ao tipo compartilhado", () => {
    const evs: Evidencia[] = [G.mmgd.evidencias.potencia, G.mmgd.evidencias.unidades, G.ons_mmgd!.evidencia!, G.emissoes!.evidencia!, G.emissoes!.evidencia_mensal!];
    for (const ev of evs) expect(problemasEvidencia(ev), ev.indicador).toEqual([]);
    // o valor exibido da ficha é o que a página mostra, na mesma precisão
    expect(G.mmgd.evidencias.potencia.valor_exibido).toBe(num(G.mmgd.resumo.potencia_mw, 1));
    expect(G.ons_mmgd!.evidencia!.valor_exibido).toBe(num(G.ons_mmgd!.ultimo_mes_completo!.SIN, 1));
    expect(G.emissoes!.evidencia!.valor_exibido).toBe(num(G.emissoes!.ultimo_ano!.valor, 4));
  });

  it("downloads declarados e o JSON municipal sob demanda existem e batem com os tipos", () => {
    for (const d of G.downloads) expect(existsSync(join(raiz, "public", d.url)), d.url).toBe(true);
    const arq: MunicipiosMmgdArquivo = JSON.parse(ler(`public${G.mapa_municipios}`));
    expect(arq.campos.slice(0, 5)).toEqual(["ibge", "nome", "uf", "unidades", "potencia_kw"]);
    expect(arq.linhas.every((l) => l.length === arq.campos.length)).toBe(true);
    expect(arq.data_cadastro).toBe(G.mmgd.data_cadastro);
  });

  it("nenhum dado pessoal de titular nos arquivos publicados", () => {
    for (const f of G.downloads.filter((d) => d.url.endsWith(".csv"))) {
      const cab = ler(`public${f.url}`).split("\n")[0].toLowerCase();
      expect(cab, f.url).not.toMatch(/cpf|cep|titular|nome_titular/);
    }
  });

  it("ausência nunca vira zero; CO2 sem CO2e; fator médio separado dos fatores do MDL", () => {
    const fora = G.mmgd.anual.filter((a) => a.cobertura_declarada === "fora" && a.unidades === null);
    expect(fora.length).toBeGreaterThan(0);
    expect(fora.every((a) => a.potencia_mw === null)).toBe(true);
    expect(G.emissoes!.unidade).toBe("tCO2/MWh");
    expect(G.emissoes!.gas).toContain("não CO2e");
    expect(G.emissoes!.medio_mensal.length).toBeGreaterThan(0);
    expect(G.emissoes!.margem_operacao_despacho_mensal.length).toBeGreaterThan(0);
    expect(G.emissoes!.estimativa_propria.publicada).toBe(false);
  });
});

describe("códigos de UF do mapa", () => {
  it("cada sigla tem o código da malha oficial publicada (uf.json), e toda UF da gold tem código", () => {
    const malha = JSON.parse(ler("public/energia/geo/uf.json")) as { features: { id: string; uf: string }[] };
    for (const f of malha.features) expect(CODIGO_UF[f.uf], f.uf).toBe(f.id);
    for (const u of G.mmgd.ufs) expect(CODIGO_UF[u.uf], u.uf).toBeDefined();
  });
});

describe("P063: gráfico, tabela e exportação usam as mesmas linhas", () => {
  const municipios = csv("transicao_mmgd_municipios.csv");
  const munAnoFonte = csv("transicao_mmgd_municipio_ano_fonte.csv");

  it("por UF: unidades e potência iguais à soma dos municípios do CSV (caminho independente)", () => {
    const un = somaPor(municipios, (r) => r.uf, "unidades");
    const kw = somaPor(municipios, (r) => r.uf, "potencia_kw");
    const linhas = linhasUfs(G.mmgd.ufs);
    expect(linhas).toHaveLength(27);
    for (const l of linhas) {
      expect(l.unidades, l.uf).toBe(un.get(l.uf));
      // gold em MW com 3 casas; CSV em kW com 2 casas por município
      expect(Math.abs(l.potencia_mw! - kw.get(l.uf)! / 1000), l.uf).toBeLessThan(0.0006);
    }
    // casos do documento do módulo (seção 4.1, conferidos contra o CSV oficial da ANEEL)
    const sp = linhas.find((l) => l.uf === "SP")!;
    expect(sp.unidades).toBe(787146);
    expect(sp.potencia_mw).toBe(7610.3);
    expect(linhas.find((l) => l.uf === "RR")!.unidades).toBe(8897);
  });

  it("mapa, barras e tabela mostram o mesmo valor por UF em cada medida; a exportação tem as mesmas linhas", () => {
    const linhas = linhasUfs(G.mmgd.ufs);
    for (const med of MEDIDAS_UF) {
      const mapa = valoresMapaUf(linhas, med);
      const barras = dadosBarrasUf(linhas, med);
      expect(barras).toHaveLength(linhas.length);
      for (const l of linhas) {
        const v = l[MEDIDA_UF[med].campo];
        expect(mapa[CODIGO_UF[l.uf]], `${med} ${l.uf}`).toBe(v);
        expect(barras.find((b) => b.id === l.uf)!.valor, `${med} ${l.uf}`).toBe(v);
      }
      const nums = barras.map((b) => b.valor).filter((x): x is number => x !== null);
      expect(nums).toEqual([...nums].sort((a, b) => b - a));
    }
    const cols = colunasUfs(G.mmgd.ano_referencia, G.mmgd.ano_populacao);
    const mx = matrizExportacao(cols, linhas);
    expect(mx.linhas).toHaveLength(27);
    const iUn = cols.findIndex((c) => c.id === "unidades");
    expect(mx.linhas.map((l) => l[iUn])).toEqual(linhas.map((l) => l.unidades));
  });

  it("referência das barras: W/hab do Brasil publicado; sem referência inventada nas outras medidas", () => {
    expect(referenciaUf(G.mmgd.resumo.w_por_habitante_brasil, "whab")).toEqual([{ valor: G.mmgd.resumo.w_por_habitante_brasil, rotulo: `Brasil: ${num(G.mmgd.resumo.w_por_habitante_brasil, 1)} W/hab` }]);
    for (const med of MEDIDAS_UF.filter((x) => x !== "whab")) expect(referenciaUf(G.mmgd.resumo.w_por_habitante_brasil, med)).toEqual([]);
    expect(referenciaUf(null, "whab")).toEqual([]);
  });

  it("histórico anual (Brasil) igual à soma do CSV município × ano × fonte; anos fora da cobertura sem linha e nulos", () => {
    const kw = somaPor(munAnoFonte, (r) => (/^\d{4}$/.test(r.ano_conexao) ? r.ano_conexao : null), "potencia_kw");
    const un = somaPor(munAnoFonte, (r) => (/^\d{4}$/.test(r.ano_conexao) ? r.ano_conexao : null), "unidades");
    const anual = linhasAnual(G.mmgd);
    for (const a of anual) {
      const k = String(a.ano);
      if (a.unidades === null) {
        expect(un.has(k), k).toBe(false);
        expect(a.situacao).toMatch(/cobertura/);
        continue;
      }
      expect(a.unidades, k).toBe(un.get(k) ?? 0);
      expect(Math.abs((a.potencia_mw ?? 0) - (kw.get(k) ?? 0) / 1000), k).toBeLessThan(0.002);
    }
    // conexões de 2025 e 2024 (documento, seção 4.1)
    expect(anual.find((a) => a.ano === 2025)!.potencia_mw).toBe(9633.532);
    expect(anual.find((a) => a.ano === 2024)!.unidades).toBe(916439);
    expect(anual.at(-1)!.rotulo).toContain("parcial");
    const mx = matrizExportacao(COLUNAS_ANUAL, anual);
    expect(mx.linhas).toHaveLength(anual.length);
  });

  it("série mensal: cada mês numa só série (consolidado ou provisório), igual à soma do CSV UF × mês × fonte", () => {
    const kw = somaPor(csv("transicao_mmgd_uf_mes_fonte.csv"), (r) => r.mes_conexao || null, "potencia_kw");
    const d = dadosMensal(G.mmgd.mensal);
    expect(d).toHaveLength(G.mmgd.mensal.length);
    d.forEach((x, i) => {
      const g = G.mmgd.mensal[i];
      expect(x.consolidado === null || x.provisorio === null, x.m).toBe(true);
      expect(g.provisorio ? x.provisorio : x.consolidado, x.m).toBe(g.potencia_mw);
      if (g.potencia_mw === null) return;
      expect(Math.abs(g.potencia_mw - (kw.get(x.m) ?? 0) / 1000), x.m).toBeLessThan(0.002);
    });
    expect(d.filter((x) => x.provisorio !== null).every((x) => x.m > G.mmgd.corte_provisorio)).toBe(true);
  });

  it("histórico das UF escolhidas igual à soma do CSV município × ano × fonte; zero só dentro da cobertura", () => {
    const ufs = ["SP", "AC", "RR"];
    const h = dadosHistoricoUfs(G.mmgd.uf_anual, ufs, PRIMEIRO);
    const kw = somaPor(munAnoFonte, (r) => (ufs.includes(r.uf) && /^\d{4}$/.test(r.ano_conexao) ? `${r.uf}|${r.ano_conexao}` : null), "potencia_kw");
    for (const l of h) {
      for (const uf of ufs) {
        const v = l[uf] as number | null;
        const k = `${uf}|${l.ano}`;
        if (v === null) {
          expect(Number(l.ano), k).toBeLessThan(PRIMEIRO);
          continue;
        }
        expect(Math.abs(v - (kw.get(k) ?? 0) / 1000), k).toBeLessThan(0.002);
      }
    }
    // AC começa depois de SP: os anos de SP antes da primeira conexão do AC, dentro da cobertura, valem zero no AC
    const primeiroAc = Math.min(...G.mmgd.uf_anual.filter((x) => x.uf === "AC").map((x) => x.ano));
    const antes = h.filter((l) => Number(l.ano) < primeiroAc && Number(l.ano) >= PRIMEIRO);
    expect(antes.length).toBeGreaterThan(0);
    expect(antes.every((l) => l.AC === 0)).toBe(true);
    expect(dadosHistoricoUfs(G.mmgd.uf_anual, [], PRIMEIRO)).toEqual([]);
  });

  it("JSON municipal: soma dos municípios fecha com o cadastro; histórico municipal fecha com o total do município", () => {
    const arq: MunicipiosMmgdArquivo = JSON.parse(ler(`public${G.mapa_municipios}`));
    const mun = municipiosDoJson(arq);
    expect(mun).toHaveLength(G.mmgd.resumo.municipios_no_cadastro_ibge);
    expect(mun.reduce((s, m) => s + m.unidades, 0)).toBe(G.mmgd.resumo.unidades);
    expect(Math.abs(mun.reduce((s, m) => s + (m.potencia_kw ?? 0), 0) - G.mmgd.resumo.potencia_kw!)).toBeLessThan(0.5);
    // Uberlândia e Cuiabá (documento, seção 4.2: conferidos no Parquet oficial)
    const ube = mun.find((m) => m.id === "3170206")!;
    expect(ube.unidades).toBe(22944);
    expect(ube.potencia_kw).toBe(211725.81);
    const texto = ler("public/energia/series/transicao_mmgd_municipio_ano_fonte.csv");
    const anoFinal = Number(G.mmgd.data_cadastro.slice(0, 4));
    for (const id of ["3170206", "5103403"]) {
      const h = historicoMunicipiosCsv(texto, [id], anoFinal, PRIMEIRO);
      const soma = h.linhas.reduce((s, l) => s + ((l[id] as number | null) ?? 0), 0);
      const m = mun.find((x) => x.id === id)!;
      // anos + unidades sem data = total publicado do município
      const semDataKw = lerCsv(texto)
        .filter((r) => r.codigo_ibge === id && !/^\d{4}$/.test(r.ano_conexao))
        .reduce((s, r) => s + Number(r.potencia_kw || "0"), 0);
      expect(Math.abs(soma + semDataKw - m.potencia_kw!), id).toBeLessThan(0.05);
      expect(h.linhas.at(-1)!.ano).toBe(String(anoFinal));
    }
    // a coluna do mapa e a da tabela são as mesmas linhas
    const cols = colunasMunicipios(G.mmgd.ano_referencia, G.mmgd.ano_populacao);
    expect(matrizExportacao(cols, mun).linhas).toHaveLength(mun.length);
  });

  it("histórico municipal: zero dentro da cobertura, lacuna antes; ano com potência ausente fica nulo; sem_data fora dos anos", () => {
    const t = [
      "codigo_ibge;municipio;uf;ano_conexao;fonte;unidades;potencia_kw;unidades_sem_potencia",
      "1;A;XX;2004;solar;1;24.42;0",
      "1;A;XX;2011;solar;2;10;0",
      "1;A;XX;2011;eolica;1;5.5;0",
      "1;A;XX;2013;solar;1;;1",
      "1;A;XX;sem_data;solar;3;7;0",
    ].join("\n");
    const h = historicoMunicipiosCsv(t, ["1"], 2014, 2009);
    const v = Object.fromEntries(h.linhas.map((l) => [l.ano, l["1"]]));
    expect(v["2004"]).toBe(24.42);
    expect(v["2005"]).toBeNull();
    expect(v["2008"]).toBeNull();
    expect(v["2009"]).toBe(0);
    expect(v["2011"]).toBe(15.5);
    expect(v["2013"]).toBeNull();
    expect(v["2014"]).toBe(0);
    expect(h.parciais).toBe(1);
    expect(h.semData).toBe(3);
  });

  it("distribuidoras e perfil iguais às somas dos CSV publicados", () => {
    const dist = csv("transicao_mmgd_distribuidoras.csv");
    const un = somaPor(dist, (r) => r.cnpj, "unidades");
    const linhas = linhasDistribuidoras(G.mmgd.distribuidoras);
    for (const l of linhas) expect(l.unidades, l.sigla).toBe(un.get(l.id));
    const coelba = linhas.find((l) => l.id === "15139629000194")!;
    expect(coelba.aviso_total).toContain("inflam o total");
    expect(coelba.classes_fora_da_area).toContain("provável município errado");
    expect(matrizExportacao(colunasDistribuidoras(G.mmgd.ano_referencia), linhas).linhas).toHaveLength(G.mmgd.distribuidoras.length);
    const perfil = csv("transicao_mmgd_perfil.csv");
    for (const dim of ["classe", "modalidade", "porte", "tipo_consumidor"] as const) {
      const u = somaPor(perfil, (r) => (r.dimensao === dim ? r.categoria : null), "unidades");
      for (const l of linhasPerfil(G.mmgd.perfis, dim)) expect(l.unidades, `${dim} ${l.id}`).toBe(u.get(l.id));
    }
  });
});

describe("P063: estimativa do ONS e achado A11", () => {
  const o = G.ons_mmgd!;
  it("série mensal do SIN igual ao CSV mensal publicado; cada mês numa só série do SIN", () => {
    const sin = new Map(csv("transicao_ons_mmgd_mensal.csv").filter((r) => r.submercado === "SIN").map((r) => [r.mes, r]));
    for (const l of dadosOnsMensal(o.mensal, "mwmed")) {
      expect(l.sin === null || l.sin_incompleto === null, String(l.m)).toBe(true);
      const v = (l.sin ?? l.sin_incompleto) as number | null;
      expect(v, String(l.m)).toBe(n(sin.get(String(l.m))?.mmgd_mwmed));
    }
    for (const l of dadosOnsMensal(o.mensal, "part")) {
      const v = (l.sin ?? l.sin_incompleto) as number | null;
      expect(v, String(l.m)).toBe(n(sin.get(String(l.m))?.participacao_mmgd_pct));
    }
    const linhas = linhasOnsMensal(o.mensal);
    expect(linhas.map((l) => l.m)).toEqual(o.mensal.map((x) => x.m));
    expect(matrizExportacao(COLUNAS_ONS_MENSAL, linhas).linhas).toHaveLength(o.mensal.length);
  });

  it("conferência de 2023: os dias do gráfico são os publicados, sem preenchimento", () => {
    const d = dadosConferencia(o.conferencia_quebra_2023);
    expect(d.map((x) => x.d)).toEqual(o.conferencia_quebra_2023.dias.map((x) => x.d));
    // recorte real do balanço do ONS (documento, seção 2.3): solar 1.991 em 28/04 e 4.377 em 29/04/2023
    expect(d.find((x) => x.d === "2023-04-29")!.solar).toBe(4377);
    expect(o.conferencia_quebra_2023.degrau_na_carga).toBe(false);
  });
});

describe("P064: fator médio, MDL e exportação", () => {
  const e = G.emissoes!;
  const fat = csv("transicao_mcti_fatores.csv");
  const serie = (s: string) => new Map(fat.filter((r) => r.serie === s).map((r) => [r.periodo, Number(r.valor)]));

  it("série mensal e barras anuais iguais ao CSV publicado; MDL em colunas próprias", () => {
    const mm = serie("fator_medio_mensal");
    const d = dadosFatorMensal(e);
    expect(d).toHaveLength(mm.size);
    for (const x of d) expect(x.medio, x.m).toBe(mm.get(x.m));
    const ma = serie("fator_medio_anual");
    for (const x of dadosFatorAnual(e)) expect(x.medio, x.id).toBe(ma.get(x.id));
    const bm = serie("margem_construcao_anual");
    const sa = serie("margem_operacao_simples_ajustado_anual");
    const linhas = linhasFatorAnual(e);
    for (const l of linhas) {
      expect(l.medio, String(l.ano)).toBe(ma.get(String(l.ano)) ?? null);
      expect(l.margem_construcao, String(l.ano)).toBe(bm.get(String(l.ano)) ?? null);
      expect(l.margem_operacao_simples_ajustado, String(l.ano)).toBe(sa.get(String(l.ano)) ?? null);
    }
    expect(matrizExportacao(COLUNAS_FATOR_ANUAL, linhas).linhas).toHaveLength(linhas.length);
    // leitura independente do XML da planilha (documento, seção 4.4): 2025 = 0,0461; ago/2026 = 0,0471
    expect(ma.get("2025")).toBe(0.0461);
    expect(mm.get("2026-08")).toBe(0.0471);
  });

  it("comparação de anos: mês não publicado fica ausente, nunca zero; referência anual é o último ano publicado", () => {
    const ult = e.ultimo_mes!.m;
    const ano = ult.slice(0, 4);
    const d = dadosPerfilAnos(e, [ano]);
    expect(d).toHaveLength(12);
    const ultimoMes = Number(ult.slice(5, 7));
    d.forEach((l, i) => {
      if (i + 1 <= ultimoMes) expect(typeof l[ano]).toBe("number");
      else expect(l[ano]).toBeNull();
    });
    expect(referenciaAnual(e)[0].valor).toBe(e.ultimo_ano!.valor);
  });
});

describe("estado na URL", () => {
  it("seleções inválidas voltam ao padrão; limite de quatro na comparação", () => {
    const v = lerEstado(ESQUEMA_MMGD, "?mmgd.uf=SP,XX,RJ,MG,BA,PR&mmgd.med=nada&mmgd.msel=3170206,123");
    expect(v.ufs).toEqual(["SP", "RJ", "MG", "BA"]);
    expect(v.med).toBe("whab");
    expect(v.muns).toEqual(["3170206"]);
    const e = lerEstado(ESQUEMA_EMISSOES, "?em.anos=2024,2025,abc&em.de=2020-01&em.ate=2020-13");
    expect(e.anos).toEqual(["2024", "2025"]);
    expect(e.de).toBe("2020-01");
    expect(e.ate).toBe("");
  });
});

describe("textos derivados dos números (mudar o número muda o texto)", () => {
  it("P063: resposta traz os números publicados, a UF que mais acrescentou e a de maior W/hab", () => {
    const r = respostaMmgd(G.mmgd);
    expect(r).toContain(num(G.mmgd.resumo.unidades, 0));
    expect(r).toContain(`${num(G.mmgd.resumo.potencia_mw, 1)} MW`);
    expect(r).toContain("capacidade cadastrada, não energia gerada");
    const maisMw = [...G.mmgd.ufs].sort((a, b) => (b.potencia_mw_ano_referencia ?? 0) - (a.potencia_mw_ano_referencia ?? 0))[0];
    const maisWhab = [...G.mmgd.ufs].sort((a, b) => (b.w_por_habitante ?? 0) - (a.w_por_habitante ?? 0))[0];
    expect(r).toContain(`${maisMw.nome} foi a UF que mais acrescentou potência`);
    expect(r).toContain(`${maisWhab.nome} lidera com ${num(maisWhab.w_por_habitante, 1)} W/hab`);
    // 2025 abaixo de 2024 no dado publicado: "menos"
    expect(r).toContain(`menos que os ${num(G.mmgd.anual.find((a) => a.ano === G.mmgd.ano_referencia - 1)!.potencia_mw, 1)} MW`);
    const g2 = gold();
    g2.mmgd.anual.find((a) => a.ano === g2.mmgd.ano_referencia)!.potencia_mw = 99999;
    expect(respostaMmgd(g2.mmgd)).toContain("mais que os");
    const outra = g2.mmgd.ufs.find((u) => u.uf === "AC")!;
    outra.w_por_habitante = 99999;
    expect(respostaMmgd(g2.mmgd)).toContain("Acre lidera com 99.999,0 W/hab");
  });

  it("P063: 'o que mudou' cita os meses provisórios publicados e o estado das revisões", () => {
    const t = mudancaMmgd(G.mmgd);
    const prov = G.mmgd.mensal.filter((x) => x.provisorio);
    expect(t).toContain(`Os ${prov.length} meses depois de`);
    expect(t).toContain(`${num(prov[0].potencia_mw, 1)} MW`);
    expect(t).toContain("caem");
    expect(t).toContain(G.mmgd.revisoes.nota!);
    const g2 = gold();
    g2.mmgd.revisoes = { capturas_comparadas: 2, primeira_captura: "2026-09-30", ultima_captura: "2026-10-30", meses: [{ m: "2026-08", unidades_primeira: 1, unidades_ultima: 2, potencia_mw_primeira: 1, potencia_mw_ultima: 2 }] };
    expect(mudancaMmgd(g2.mmgd)).toContain("1 meses de conexão mudaram");
  });

  it("P063: limitação territorial com as duas modalidades remotas, números do perfil publicado", () => {
    const t = textoModalidadesRemotas(G.mmgd.perfis);
    const comp = G.mmgd.perfis.modalidade.find((p) => p.categoria === "Compartilhada")!;
    expect(t).toContain("autoconsumo remoto");
    expect(t).toContain(`geração compartilhada (${num(comp.unidades, 0)} unidades`);
  });

  it("ONS: resposta com o último mês completo e o último ano completo; ausência declarada", () => {
    const o = G.ons_mmgd!;
    const r = respostaOns(o);
    expect(r).toContain(`${num(o.ultimo_mes_completo!.SIN, 1)} MWmed`);
    expect(r).toContain(pct(o.ultimo_mes_completo!.participacao_carga_global_sin_pct, 2));
    expect(r).toContain("não medição");
    expect(respostaOns({ ultimo_mes_completo: null, anual: [] })).toContain("Nenhum mês");
    expect(mudancaOns(o, G.mmgd.corte_provisorio)).toContain("Não é fator de capacidade");
  });

  it("P064: resposta com o último ano, o anterior, o último mês, extremos e a quebra da fonte", () => {
    const e = G.emissoes!;
    const r = respostaEmissoes(e);
    expect(r).toContain(`Em ${e.ultimo_ano!.ano}`);
    expect(r).toContain(num(e.ultimo_ano!.valor, 4));
    expect(r).toContain("abaixo de 2024");
    expect(r).toContain("ampliou a base de usinas");
    const g2 = gold();
    g2.emissoes!.ultimo_ano = { ano: 2025, valor: 0.09, arquivo: "x" };
    expect(respostaEmissoes(g2.emissoes!)).toContain("acima de 2024");
    g2.emissoes!.quebras = [];
    expect(respostaEmissoes(g2.emissoes!)).not.toContain("ampliou");
    // mês contra o mesmo mês do ano anterior, com a quebra lembrada quando atravessa
    const m = mudancaEmissoes(e);
    expect(m).toContain(`${num(e.ultimo_mes!.valor, 4)} tCO2/MWh`);
    const g3 = gold();
    g3.emissoes!.ultimo_mes = { m: "2025-03", valor: 0.05, arquivo: "x" };
    expect(mudancaEmissoes(g3.emissoes!)).toContain("bases de usinas diferentes");
  });

  it("fonte defasada: bloqueio registrado vira aviso com a última captura válida", () => {
    const a = { ...G.emissoes!.acesso, situacao: "bloqueada" as const, tentado_em: "2026-10-01T10:00:00Z", ultimo_acesso_ok: "2026-09-30T22:48:13Z" };
    const s = estadoAcessoMcti(a);
    expect(s.defasada).toBe(true);
    expect(s.texto).toContain("verificação humana");
    expect(s.texto).toContain("30/09/2026");
    expect(estadoAcessoMcti(G.emissoes!.acesso).defasada).toBe(G.emissoes!.acesso.situacao !== "acessivel");
  });

  it("participações pequenas não viram zero; nenhum texto usa travessão ou hífen como pontuação", () => {
    expect(participacaoTexto(0.005)).toBe("0,005%");
    expect(participacaoTexto(0.00097)).toBe("0,00097%");
    expect(participacaoTexto(80.03)).toBe("80,03%");
    expect(participacaoTexto(0)).toBe("0,00%");
    expect(participacaoTexto(null)).toBe("sem dado");
    const textos = [respostaMmgd(G.mmgd), mudancaMmgd(G.mmgd), respostaOns(G.ons_mmgd!), mudancaOns(G.ons_mmgd!, G.mmgd.corte_provisorio), respostaEmissoes(G.emissoes!), mudancaEmissoes(G.emissoes!)];
    for (const x of textos) expect(x).not.toMatch(/ [—–-] |—/);
  });
});

describe("páginas renderizadas no servidor", () => {
  const html = {
    sintese: renderToStaticMarkup(createElement(Sintese)),
    p063: renderToStaticMarkup(createElement(PaginaMmgd)),
    ons: renderToStaticMarkup(createElement(PaginaEnergia)),
    p064: renderToStaticMarkup(createElement(PaginaEmissoes)),
  };
  const principal = (h: string) => h.slice(h.indexOf("<main"));

  it("cada painel renderiza com a pergunta como título, a resposta derivada e a anatomia da seção 7.2", () => {
    const casos = [
      { h: html.p063, id: "p063", pergunta: perguntaPainel("p063"), resposta: respostaMmgd(G.mmgd) },
      { h: html.ons, id: "ons", pergunta: PERGUNTA_ONS, resposta: respostaOns(G.ons_mmgd!) },
      { h: html.ons, id: "a11", pergunta: PERGUNTA_A11, resposta: G.ons_mmgd!.conferencia_quebra_2023.leitura },
      { h: html.p064, id: "p064", pergunta: perguntaPainel("p064"), resposta: respostaEmissoes(G.emissoes!) },
    ];
    for (const c of casos) {
      expect(c.h, c.id).toContain(`id="${c.id}"`);
      expect(c.h, c.id).toContain(`id="${c.id}-titulo"`);
      expect(c.h, c.id).toContain(`data-resposta="${c.id}"`);
      expect(c.h, c.id).toContain(c.pergunta);
      // React escapa aspas e apóstrofos; o começo da resposta não tem nenhum
      expect(c.h, c.id).toContain(c.resposta.slice(0, 30));
    }
    for (const [k, h] of [["p063", html.p063], ["ons", html.ons], ["p064", html.p064]] as const) {
      for (const parte of ["Período", "Universo", "Unidade", "Como interpretar", "O que não é possível concluir", "Próxima pergunta", "Copiar link deste painel", "Baixar os dados deste painel"]) {
        expect(h, `${k}: ${parte}`).toContain(parte);
      }
      expect((h.match(/Comprove este número/g) ?? []).length, k).toBeGreaterThanOrEqual(k === "ons" ? 1 : 2);
      expect((h.match(/<table/g) ?? []).length, k).toBeGreaterThanOrEqual(4);
      expect(h, k).toContain('role="radiogroup" aria-label="Nível de profundidade"');
    }
  });

  it("tabelas equivalentes, mapa e rótulos de grandeza presentes", () => {
    expect(html.p063).toContain("MMGD por UF, cadastro de");
    expect(html.p063).toContain("Conexões e estoque por ano, Brasil");
    expect(html.p063).toContain("MMGD por distribuidora (CNPJ)");
    expect(html.p063).toContain("Capacidade, não energia");
    expect(html.p063).toContain("Carregar o mapa por município");
    expect(html.ons).toContain("MMGD estimada pelo ONS e capacidade cadastrada, por mês");
    expect(html.ons).toContain("Cada dia contra o mesmo dia da semana 14 dias antes");
    expect(html.p064).toContain("Fator médio anual e fatores do MDL por ano");
    expect(html.p064).toContain("Fator médio, não marginal");
    expect(html.p064).toContain("não é CO2 equivalente");
    expect(html.p064).toContain("Revisões declaradas pela fonte");
  });

  it("a síntese traz as três perguntas, respostas, números com prova e links para os painéis", () => {
    const h = html.sintese;
    for (const [id, p] of [["p063", perguntaPainel("p063")], ["ons", PERGUNTA_ONS], ["p064", perguntaPainel("p064")]] as const) {
      expect(h).toContain(p);
      expect(h).toContain(`data-resposta="${id}"`);
    }
    expect(h).toContain('href="/setor-eletrico/transicao/mmgd#p063"');
    expect(h).toContain('href="/setor-eletrico/transicao/energia-estimada#ons"');
    expect(h).toContain('href="/setor-eletrico/transicao/emissoes#p064"');
    expect((h.match(/Comprove este número/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("sem estado de construção, sem hexadecimal solto e abaixo de 600 KB de HTML por página, contando o fluxo RSC estimado", () => {
    const paginas = { sintese: Sintese, p063: PaginaMmgd, ons: PaginaEnergia, p064: PaginaEmissoes } as const;
    for (const [k, h] of Object.entries(html)) {
      expect(principal(h), k).not.toMatch(/em breve|em integração|em construção/i);
      expect(h, k).not.toMatch(/#[0-9a-fA-F]{6}\b/);
      // o fluxo vai dentro de strings JavaScript: aspas escapadas somam cerca de 10%
      const total = h.length + 1.1 * pesoRsc(paginas[k as keyof typeof paginas] as () => unknown);
      expect(total, `${k}: ${Math.round(h.length / 1000)} KB de HTML e ${Math.round(total / 1000)} KB com o fluxo`).toBeLessThan(600_000);
    }
    for (const f of ["TransicaoMmgd", "TransicaoOns", "TransicaoEmissoes", "TransicaoPagina", "TransicaoOpcoes", "TransicaoLinkPainel"]) {
      expect(ler(`src/components/energia/${f}.tsx`), f).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    }
  });

  it("todo número de destaque tem 'Comprove este número'", () => {
    const MARCA = 'class="relative flex h-full flex-col border border-linha bg-superficie p-5"';
    for (const [k, h] of Object.entries(html)) {
      const partes = h.split(MARCA).slice(1);
      expect(partes.length, k).toBeGreaterThan(0);
      for (const p of partes) expect(p.slice(0, 6000).includes("Comprove este número"), k).toBe(true);
    }
  });

  it("todo href interno das páginas aponta para página existente, arquivo publicado ou verbete", () => {
    for (const [k, h] of Object.entries(html)) {
      const hrefs = Array.from(principal(h).matchAll(/href="(\/[^"#?]*)/g)).map((x) => x[1]);
      for (const href of Array.from(new Set(hrefs))) {
        const arquivo = existsSync(join(raiz, "public", href));
        const pagina = existsSync(join(raiz, "src/app", href, "page.tsx"));
        const verbete = /^\/setor-eletrico\/aprenda\/[^/]+$/.test(href) && !!conceito(href.split("/").at(-1)!);
        expect(arquivo || pagina || verbete, `${k}: ${href}`).toBe(true);
      }
    }
  });

  it("o destino está publicado na navegação, com a página atual marcada", () => {
    const d = DESTINOS_NAVEGACAO.find((x) => x.slug === "transicao")!;
    expect(d.publicado).toBe(true);
    expect(d.href).toBe("/setor-eletrico/transicao");
    for (const h of Object.values(html)) expect(h).toContain('aria-current="page"');
  });

  it("verbetes do módulo conferidos com fonte primária e trecho", () => {
    for (const slug of ["geracao-distribuida", "fator-de-emissao"]) {
      const c = conceito(slug)!;
      expect(c.estado, slug).toBe("CONFERIDO");
      expect(c.conferidoEm, slug).toBe("2026-10-01");
      expect(c.fontes.every((f) => f.url.startsWith("https://")), slug).toBe(true);
    }
    // o verbete substituído não afirma método da estimativa do ONS sem fonte
    expect(conceito("geracao-distribuida")!.comoEMedido).not.toMatch(/meteorol/);
  });
});

describe("estados de ausência e de fonte defasada", () => {
  it("sem o bloco do ONS e sem emissões, as páginas dizem o que falta e não mostram número de reserva", () => {
    const g2 = gold();
    g2.ons_mmgd = null;
    g2.emissoes = null;
    g2.pendencias = ["Bloco do ONS ausente: teste.", "Bloco do MCTI ausente: teste."];
    troca.gold = g2;
    try {
      const mm = renderToStaticMarkup(createElement(PaginaMmgd));
      expect(mm).toContain('id="p063"');
      const en = renderToStaticMarkup(createElement(PaginaEnergia));
      expect(en).toContain("Estimativa de MMGD do ONS ausente nesta publicação");
      expect(en).not.toContain('id="a11"');
      const em = renderToStaticMarkup(createElement(PaginaEmissoes));
      expect(em).toContain("Fatores de emissão do MCTI ausentes nesta publicação");
      expect(em).toContain("Bloco do MCTI ausente: teste.");
      const si = renderToStaticMarkup(createElement(Sintese));
      expect(si).toContain("nenhum fator é estimado no lugar do oficial");
      for (const h of [mm, en, em, si]) expect(h).not.toMatch(/em breve|em construção/i);
    } finally {
      troca.gold = null;
    }
  });

  it("página do MCTI bloqueada: aviso de fonte possivelmente defasada no painel", () => {
    const g2 = gold();
    g2.emissoes!.acesso = { ...g2.emissoes!.acesso, situacao: "bloqueada", tentado_em: "2026-10-01T10:00:00Z" };
    troca.gold = g2;
    try {
      const em = renderToStaticMarkup(createElement(PaginaEmissoes));
      expect(em).toContain("Fonte possivelmente defasada");
      expect(em).toContain("verificação humana");
    } finally {
      troca.gold = null;
    }
  });

  it("gold indisponível: página de ausência, sem número", () => {
    troca.gold = { disponivel: false, motivo: "falha de teste" };
    try {
      const h = renderToStaticMarkup(createElement(PaginaMmgd));
      expect(h).toContain("Transição e ambiente indisponível nesta publicação");
      expect(h).toContain("falha de teste");
    } finally {
      troca.gold = null;
    }
  });
});
