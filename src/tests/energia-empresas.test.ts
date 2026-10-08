/**
 * Módulo Empresas, fase de interface (P036 a P039 e a ficha de cada distribuidora).
 *
 * O que estes testes pegam de volta: tabela, gráfico e exportação que deixam de usar as mesmas
 * linhas; números da página que divergem dos CSV publicados pelo pipeline (caminho
 * independente: os arquivos de download, lidos aqui com um parser próprio); textos que não
 * mudam quando o número muda; árvore societária que não bate com a cadeia que a gold calculou;
 * pontos do mapa fora da UF que o SIGA declara; páginas que deixam de renderizar, perdem um item
 * da anatomia da seção 7.2, passam de 600 KB ou escrevem número à mão.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Sintese from "@/app/setor-eletrico/empresas/page";
import PaginaAtivos from "@/app/setor-eletrico/empresas/ativos/page";
import PaginaDistribuidoras from "@/app/setor-eletrico/empresas/distribuidoras/page";
import PaginaFinancas from "@/app/setor-eletrico/empresas/financas/page";
import PaginaControle from "@/app/setor-eletrico/empresas/controle/page";
import Ficha, { generateStaticParams } from "@/app/setor-eletrico/empresas/[entidade]/page";
import {
  COLUNAS_ATIVOS,
  COLUNAS_COMPANHIAS,
  COLUNAS_DISTRIBUIDORAS,
  COLUNAS_GRUPOS,
  COLUNAS_PROPRIETARIOS,
  COLUNAS_TRANSMISSAO,
  FASES_MAPA,
  LIMIARES_HHI_CADE,
  PAINEIS_EMPRESAS,
  ROTULO_FAIXA,
  R_AUTALICO,
  TIPOS_USINA,
  arvoreDe,
  avisoAnosComparacao,
  cnpjFormatado,
  comReferenciaNacional,
  dadosComparacao,
  dadosFinancas,
  evolucaoPerdas,
  evolucaoQualidade,
  evolucaoTarifa,
  filtrarAtivos,
  linhasAtivos,
  linhasCompanhias,
  linhasDistribuidoras,
  linhasGrupos,
  linhasNiveis,
  linhasProprietarios,
  linhasTipos,
  linhasTransmissao,
  padraoComparacao,
  padraoFinancas,
  paresPerdas,
  paresQualidade,
  projetar,
  reaisEscala,
  referenciaPerdasNacional,
  resolverEntidade,
  respostaCadastro,
  respostaControle,
  respostaDistribuidoras,
  respostaFicha,
  respostaFinancas,
  resumoAtivos,
  rotaEntidade,
  sentidoLimite,
  slugsEstaticos,
  textoArvore,
  textoCompanhia,
  textoPares,
  textoResumoAtivos,
  textoTipos,
  type ProjecaoMalha,
} from "@/lib/energia/empresas";
import { citacaoBase, comValorExibido, problemasEvidencia } from "@/lib/energia/evidencia";
import { lerCaminho, pontoNaRegiao, type CamadaGeo } from "@/lib/energia/geo";
import { DESTINOS_NAVEGACAO, MODULOS_ENERGIA } from "@/lib/energia/navegacao";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { gerarCsv, matrizExportacao } from "@/lib/energia/tabela";
import { num, pct } from "@/lib/energia/formato";
import type { AtivosMapa, CadeiaSocietaria, EmpresasGold, SeriesFinanceiras } from "@/lib/energia/tipos-empresas";

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const json = <T,>(p: string) => JSON.parse(ler(p)) as T;
const G = json<EmpresasGold>("public/energia/gold/empresas.json");
/** Cópia profunda para mudar um número e ver o texto mudar. */
const gold = () => json<EmpresasGold>("public/energia/gold/empresas.json");

/** Parser próprio dos CSV do módulo (";" sem aspas, ponto decimal, vazio = ausência): caminho independente do código das páginas. */
function csv(p: string): Record<string, string>[] {
  const [cab, ...linhas] = ler(p).trim().split(/\r?\n/);
  const cols = cab.split(";");
  return linhas.map((l) => {
    const v = l.split(";");
    return Object.fromEntries(cols.map((c, i) => [c, v[i] ?? ""]));
  });
}
const n = (s: string) => (s === "" ? null : Number(s));
/** A gold arredonda MW e km a 1 casa e o CSV a 3 ou 4: a diferença máxima é meia casa da gold (com folga de ponto flutuante). */
const MEIA_CASA = 0.05 + 1e-9;

/* ================================================================ contrato */

describe("contrato da gold empresas.json com a interface", () => {
  it("gold íntegra, com os blocos que as páginas leem", () => {
    expect(G.disponivel).toBe(true);
    expect(G.gold).toBe("empresas.json");
    for (const k of ["datas", "definicoes", "cadastro", "distribuidoras", "financas", "controle", "validacao", "bloqueios", "decisoes_metodo", "proveniencia", "downloads", "series"] as const) {
      expect(G[k], k).toBeTruthy();
    }
    expect(G.validacao.criticas).toEqual([]);
    expect(G.distribuidoras.indice.length).toBe(G.distribuidoras.resumo.distribuidoras);
    expect(G.financas.companhias.length).toBe(G.financas.universo.companhias);
  });

  it("cada distribuidora do índice tem os campos que a ficha usa, com identidade de 14 dígitos e slug único", () => {
    const slugs = new Set<string>();
    for (const d of G.distribuidoras.indice) {
      expect(d.cnpj, d.slug).toMatch(/^\d{14}$/);
      for (const k of ["sigla", "siglas", "nome", "classificacao", "grupo", "ufs", "ativa", "perdas", "qualidade", "tarifa", "controle", "cvm", "geracao", "slug", "slugs_alternativos", "evolucao"] as const) {
        expect(k in d, `${d.slug}: ${k}`).toBe(true);
      }
      expect(d.controle.cadeia[0], d.slug).toBe(d.cnpj);
      expect(slugs.has(d.slug), d.slug).toBe(false);
      slugs.add(d.slug);
    }
  });

  it("evidências dos números principais passam na checagem de ficha completa", () => {
    const evs = [G.cadastro.ativos.evidencia, G.cadastro.transmissao!.evidencia, G.controle.concentracao.evidencia];
    for (const e of evs) expect(problemasEvidencia(e), e.indicador).toEqual([]);
    const fichas = json<{ evidencias: Record<string, import("@/lib/energia/evidencia").Evidencia> }>("public/energia/series/empresas_evidencias.json");
    for (const c of padraoFinancas(G.financas.companhias)) expect(problemasEvidencia(fichas.evidencias[c]), c).toEqual([]);
  });

  it("arquivos sob demanda e downloads citados existem em public/", () => {
    for (const u of Object.values(G.series)) expect(existsSync(join(raiz, "public", u)), u).toBe(true);
    for (const d of G.downloads) expect(existsSync(join(raiz, "public", d.url)), d.url).toBe(true);
    expect(existsSync(join(raiz, "public/energia/series/empresas_financas_ajustes.csv"))).toBe(true);
    for (const s of Object.values(G.distribuidoras.series_evolucao)) if (s) expect(existsSync(join(raiz, "public", s.url)), s.url).toBe(true);
  });
});

/* ================================================================ P036 */

describe("P036: tabelas e gráfico usam as mesmas linhas dos CSV publicados", () => {
  it("proprietários: as linhas da tabela batem com empresas_proprietarios.csv (capacidade proporcional e sob controle)", () => {
    const porCnpj = new Map(csv("public/energia/series/empresas_proprietarios.csv").map((l) => [l.cnpj, l]));
    const linhas = linhasProprietarios(G.cadastro.proprietarios);
    expect(linhas.length).toBe(G.cadastro.proprietarios.length);
    for (const l of linhas) {
      const c = porCnpj.get(String(l.id))!;
      expect(c, String(l.id)).toBeTruthy();
      // a gold arredonda a 1 casa (MW) e o CSV a 3: tolerância de meia casa da gold
      expect(Math.abs((l.mw_proporcional as number) - (n(c.mw_proporcional) as number)), String(l.id)).toBeLessThanOrEqual(MEIA_CASA);
      expect(Math.abs((l.mw_controle_direto as number) - (n(c.mw_controle_direto) as number)), String(l.id)).toBeLessThanOrEqual(MEIA_CASA);
      expect(l.usinas_controle_direto).toBe(n(c.usinas_controle_direto));
    }
    // a exportação é a mesma matriz da tela
    const m = matrizExportacao(COLUNAS_PROPRIETARIOS, linhas);
    expect(m.linhas.length).toBe(linhas.length);
    expect(m.linhas[0][COLUNAS_PROPRIETARIOS.findIndex((c) => c.id === "mw_proporcional")]).toBe(linhas[0].mw_proporcional);
  });

  it("Belo Monte: o maior proprietário direto é a Norte Energia, com a potência inteira da usina (valor do documento do módulo)", () => {
    const l = linhasProprietarios(G.cadastro.proprietarios).find((x) => x.id === "12300288000107")!;
    expect(l.nome).toBe("NORTE ENERGIA S/A");
    expect(l.mw_proporcional).toBe(11233.1);
    expect(l.cnpj).toBe("12.300.288/0001-07");
  });

  it("transmissão: barras e tabela usam as mesmas linhas, e o km bate com empresas_transmissao.csv", () => {
    const t = G.cadastro.transmissao!;
    const porCnpj = new Map(csv("public/energia/series/empresas_transmissao.csv").map((l) => [l.cnpj, l]));
    const linhas = linhasTransmissao(t);
    expect(linhas.map((l) => l.id)).toEqual(t.maiores.map((m) => m.cnpj));
    for (const l of linhas) {
      const c = porCnpj.get(String(l.id))!;
      expect(Math.abs((l.km as number) - (n(c.km_circuito_operacao) as number)), String(l.id)).toBeLessThanOrEqual(MEIA_CASA);
      expect(l.subestacoes).toBe(n(c.subestacoes));
    }
    // AXIA Nordeste, conferida no documento do módulo: 12.700,4 km de circuito em operação
    expect(linhas.find((l) => l.id === "33541368000116")?.km).toBe(12700.4);
    expect(matrizExportacao(COLUNAS_TRANSMISSAO, linhas).linhas.length).toBe(t.maiores.length);
  });

  it("estados do vínculo somam as usinas em operação e as sem vínculo completo publicadas", () => {
    const a = G.cadastro.ativos;
    expect(a.estados.reduce((s, e) => s + e.usinas_operacao, 0)).toBe(a.operacao.usinas);
    const semVinculo = a.estados.filter((e) => e.estado !== "vinculado").reduce((s, e) => s + e.usinas_operacao, 0);
    expect(semVinculo).toBe(a.sem_vinculo_total);
  });
});

describe("P036: mapa das usinas", () => {
  const J = json<AtivosMapa>("public/energia/series/empresas_ativos.json");
  const UF = json<CamadaGeo>("public/energia/geo/uf.json");

  it("as fases do filtro são as que a gold publica, e o arquivo do mapa só tem usinas do CSV de ativos", () => {
    const fases = new Set<string>(FASES_MAPA.map((f) => f.fase));
    for (const f of G.cadastro.ativos.por_fase) expect(fases.has(f.fase), f.fase).toBe(true);
    const nucleosCsv = new Set(csv("public/energia/series/empresas_ativos.csv").map((l) => l.nucleo_ceg));
    expect(nucleosCsv.size).toBe(G.cadastro.ativos.usinas);
    for (const k of J.nucleo) expect(nucleosCsv.has(k), k).toBe(true);
    for (const t of Array.from(new Set(J.tipo))) expect(TIPOS_USINA.some((x) => x.id === t), String(t)).toBe(true);
  });

  it("filtro por fase em operação: a mesma contagem do arquivo, e a tabela equivalente tem as mesmas usinas na mesma ordem", () => {
    const idx = filtrarAtivos(J, { fase: "operacao", tipos: [], vinculo: "todos", grupo: "" });
    expect(idx.length).toBe(J.fase.filter((f) => f === "Operação").length);
    const linhas = linhasAtivos(J, idx);
    expect(linhas.map((l) => l.id)).toEqual(idx.map((i) => J.nucleo[i]));
    const m = matrizExportacao(COLUNAS_ATIVOS, linhas as unknown as Record<string, string | number | null>[]);
    expect(m.linhas.length).toBe(idx.length);
    // a potência só se soma dentro de uma fase (fiscalizada em operação, outorgada nas demais)
    const r = resumoAtivos(linhas);
    expect(r.porFase.map((f) => f.fase)).toEqual(["Operação"]);
    expect(textoResumoAtivos(r)).toContain("fiscalizados");
    const todas = resumoAtivos(linhasAtivos(J, filtrarAtivos(J, { fase: "todas", tipos: [], vinculo: "todos", grupo: "" })));
    expect(todas.porFase.length).toBe(3);
    expect(textoResumoAtivos(todas)).toContain("outorgados");
  });

  it("filtro por grupo e por vínculo: só as usinas do grupo do proprietário majoritário; vínculo incompleto exclui as vinculadas", () => {
    const axia = "00001180000126";
    const idx = filtrarAtivos(J, { fase: "operacao", tipos: [], vinculo: "todos", grupo: axia });
    const ig = J.grupos.findIndex((g) => g[0] === axia);
    expect(idx.length).toBeGreaterThan(0);
    for (const i of idx) expect(J.grupo[i]).toBe(ig);
    // CNPJ fora dos 200 grupos do arquivo: nenhuma usina (a página diz que está no CSV), nunca todas
    expect(filtrarAtivos(J, { fase: "operacao", tipos: [], vinculo: "todos", grupo: "99999999999999" })).toEqual([]);
    const sem = filtrarAtivos(J, { fase: "operacao", tipos: [], vinculo: "sem_vinculo", grupo: "" });
    const iv = J.estados.indexOf("vinculado");
    for (const i of sem) expect(J.estado[i]).not.toBe(iv);
  });

  it("projeção: a malha declara o mesmo raio, e as usinas caem dentro da UF que o SIGA informa", () => {
    expect(UF.projecao.superficie).toContain(String(R_AUTALICO));
    const aneis = new Map(UF.features.map((f) => [f.uf, lerCaminho(f.d)]));
    let dentro = 0;
    let total = 0;
    for (let i = 0; i < J.nucleo.length; i += 97) {
      const uf = J.uf[i];
      if (!uf || !aneis.has(uf)) continue;
      total++;
      if (pontoNaRegiao(projetar(J.lon[i], J.lat[i], UF.projecao as ProjecaoMalha), aneis.get(uf)!)) dentro++;
    }
    expect(total).toBeGreaterThan(200);
    // a malha é simplificada e há usinas na divisa: 97% dentro da UF declarada é o piso conferido
    expect(dentro / total).toBeGreaterThanOrEqual(0.97);
  });
});

/* ================================================================ P037 */

describe("P037: índice, comparador e ficha usam os mesmos números das golds de origem", () => {
  const porCnpj = new Map(csv("public/energia/series/empresas_distribuidoras.csv").map((l) => [l.cnpj, l]));

  it("o índice da página bate com empresas_distribuidoras.csv, com ausência como ausência", () => {
    const linhas = linhasDistribuidoras(G.distribuidoras.indice);
    expect(linhas.length).toBe(porCnpj.size);
    for (const d of G.distribuidoras.indice) {
      const l = linhas.find((x) => x.id === d.slug)!;
      const c = porCnpj.get(d.cnpj)!;
      expect(c.slug).toBe(d.slug);
      expect(l.perdas_pct, d.slug).toBe(n(c.taxa_perdas_totais_pct));
      expect(l.dec, d.slug).toBe(n(c.dec_h));
      expect(l.fec, d.slug).toBe(n(c.fec));
      expect(l.tarifa, d.slug).toBe(n(c.tarifa_b1_rs_mwh));
    }
    const csvGerado = gerarCsv(COLUNAS_DISTRIBUIDORAS, linhas, { bom: false });
    expect(csvGerado.trim().split(/\r\n/).length).toBe(linhas.length + 1);
  });

  it("CEMIG-D: perdas, DEC e tarifa iguais às golds de origem (valores conferidos no documento do módulo)", () => {
    const d = G.distribuidoras.indice.find((x) => x.slug === "cemig-d")!;
    const [l] = dadosComparacao(G.distribuidoras.indice, ["cemig-d"]);
    expect(l.perdas).toBe(12.12);
    expect(l.dec).toBe(8.98);
    expect(l.tarifa).toBe(903.29);
    const conta = json<{ distribuidoras: Record<string, { vigencias: unknown[][] }> }>("public/energia/series/conta_historico_b1.json");
    const ultima = evolucaoTarifa(conta.distribuidoras[d.cnpj].vigencias, G.distribuidoras.series_evolucao.tarifa!.campos).at(-1)!;
    expect(ultima.total).toBe(l.tarifa);
  });

  it("comparador: padrão são as quatro ativas com mais UC, na ordem; linhas na ordem de escolha; aviso quando os anos diferem", () => {
    const p = padraoComparacao(G.distribuidoras.indice);
    expect(p.length).toBe(4);
    const ucs = p.map((s) => G.distribuidoras.indice.find((x) => x.slug === s)!.qualidade!.ucs as number);
    expect(ucs).toEqual(ucs.slice().sort((a, b) => b - a));
    const linhas = dadosComparacao(G.distribuidoras.indice, [p[2], p[0]]);
    expect(linhas.map((l) => l.id)).toEqual([p[2], p[0]]);
    expect(avisoAnosComparacao(linhas)).toBeNull();
    const mistura = [{ ...linhas[0], ano_perdas: 2024 }, linhas[1]];
    expect(avisoAnosComparacao(mistura)).toContain("2024, 2025");
  });

  it("evolução própria: lida pelo CNPJ nas séries das golds de origem; ano incompleto em série própria", () => {
    const d = G.distribuidoras.indice.find((x) => x.slug === "cemig-d")!;
    const pa = json<{ campos: string[]; distribuidoras: Record<string, unknown[][]> }>("public/energia/series/perdas_anual.json");
    const ev = evolucaoPerdas(pa.distribuidoras[d.cnpj], pa.campos);
    const [ini, fim] = d.evolucao.perdas!.split("/");
    expect(ev[0].ano).toBe(ini);
    expect(ev.at(-1)!.ano).toBe(fim);
    const ref = ev.find((x) => x.ano === String(d.perdas!.ano))!;
    expect(ref.taxa_completo).toBe(d.perdas!.taxa_total_pct);
    for (const x of ev) expect(x.taxa_completo === null || x.taxa_parcial === null).toBe(true);
    const parcial = ev.filter((x) => x.completo === "não");
    for (const x of parcial) expect(x.taxa_completo).toBeNull();
    // referência nacional só em ano completo, e nunca repetida em ano parcial
    const perdasGold = json<{ nacional: { ano: number; parcial: boolean; taxa_total_pct: number | null }[] }>("public/energia/gold/perdas.json");
    const comRef = comReferenciaNacional(ev, perdasGold.nacional);
    expect(comRef.find((x) => x.ano === "2025")!.brasil).toBe(perdasGold.nacional.find((x) => x.ano === 2025 && !x.parcial)!.taxa_total_pct);
    for (const x of comRef.filter((y) => y.completo === "não")) expect(x.brasil).toBeNull();
    const q = json<{ distribuidoras: Record<string, Parameters<typeof evolucaoQualidade>[0]> }>("public/energia/series/qualidade_distribuidoras_serie.json");
    const eq = evolucaoQualidade(q.distribuidoras[d.cnpj]);
    expect(eq.find((x) => x.ano === "2025")!.dec).toBe(d.qualidade!.dec);
  });

  it("pares: mesmo grupo e mesmo ano; a posição é 1 + as menores, e muda quando o número muda", () => {
    const d = G.distribuidoras.indice.find((x) => x.slug === "cemig-d")!;
    const pp = paresPerdas(d, G.distribuidoras.indice)!;
    expect(pp.itens.every((i) => G.distribuidoras.indice.find((x) => x.slug === i.id)!.grupo === "concessionaria")).toBe(true);
    expect(pp.posicao).toBe(1 + pp.itens.filter((i) => i.valor < 12.12).length);
    const g2 = gold();
    const d2 = g2.distribuidoras.indice.find((x) => x.slug === "cemig-d")!;
    d2.perdas!.taxa_total_pct = 0.01;
    expect(paresPerdas(d2, g2.distribuidoras.indice)!.posicao).toBe(1);
    const pq = paresQualidade(d, G.distribuidoras.indice)!;
    expect(pq.regra).toContain("porte grande");
    expect(textoPares("CEMIG-D", "DEC", pq)).toContain(`posição ${pq.posicao} de ${pq.total}`);
    expect(textoPares("X", "DEC", null)).toContain("Sem pares");
  });

  it("ranking: valor negativo não é lido como a menor perda; extremos e o sentido da ordem ditos em palavras", () => {
    const pares = (valores: [string, number][], posicao: number) => ({
      regra: "concessionárias com taxa de perdas em 2025",
      ano: 2025,
      total: valores.length,
      posicao,
      itens: valores.map(([rotulo, valor]) => ({ id: rotulo.toLowerCase(), rotulo, valor, referencia: null })),
    });
    const neg = textoPares("CERTHIL", "taxa de perdas", pares([["CERTHIL", -17.31], ["A", 3], ["B", 8]], 1));
    expect(neg).toContain("O valor é negativo");
    expect(neg).toContain("não indica a menor perda");
    expect(neg).not.toContain("Menor é melhor");
    const pior = textoPares("AMBAR", "taxa de perdas", pares([["A", 3], ["B", 8], ["AMBAR", 43.19]], 3));
    expect(pior).toContain("é o maior valor do grupo");
    expect(pior).toContain("Menor é melhor nessa medida.");
    const meio = textoPares("B", "taxa de perdas", pares([["A", 3], ["B", 8], ["C", 9]], 2));
    expect(meio).not.toContain("do grupo");
  });

  it("referência nacional das barras só com o mesmo ano das perdas por distribuidora", () => {
    const ev = { valor_calculo: 14.7, universo: "51 concessionárias", periodo: { inicio: "2025-01" } };
    expect(referenciaPerdasNacional(ev, 2025)).toEqual({ valor: 14.7, rotulo: "Brasil, 51 concessionárias" });
    expect(referenciaPerdasNacional(ev, 2024)).toBeNull();
    expect(referenciaPerdasNacional({ ...ev, valor_calculo: null }, 2025)).toBeNull();
  });

  it("rota dinâmica: todo slug e slug alternativo resolve; o alternativo aponta para o principal; nenhum colide com as páginas de painel", () => {
    const params = generateStaticParams().map((p) => p.entidade);
    expect(params).toEqual(slugsEstaticos(G.distribuidoras.indice));
    for (const s of params) expect(resolverEntidade(G.distribuidoras.indice, s), s).toBeTruthy();
    const alt = G.distribuidoras.indice.find((d) => d.slugs_alternativos.length)!;
    const r = resolverEntidade(G.distribuidoras.indice, alt.slugs_alternativos[0])!;
    expect(r.principal).toBe(false);
    expect(r.dist.slug).toBe(alt.slug);
    for (const p of PAINEIS_EMPRESAS) expect(params.includes(p.segmento), p.segmento).toBe(false);
    expect(resolverEntidade(G.distribuidoras.indice, "nao-existe")).toBeNull();
  });
});

/* ================================================================ P038 */

describe("P038: finanças", () => {
  const S = json<SeriesFinanceiras>("public/energia/series/empresas_financas.json");
  const anual = csv("public/energia/series/empresas_financas_anual.csv");

  it("CEMIG, receita consolidada de 2024: o gráfico mostra R$ 39.819,62 milhões, o valor do CSV e o conferido na DFP original", () => {
    const d = dadosFinancas(S.series, ["17155730000164"], "con", "receita", "anual");
    const l = d.linhas.find((x) => x.x === "2024")!;
    expect(l["17155730000164"]).toBe(39819.62);
    const c = anual.find((x) => x.cnpj === "17155730000164" && x.escopo === "consolidado" && x.conta === "receita" && x.periodo_fim === "2024-12-31")!;
    expect(Number(c.valor_rs) / 1e6).toBeCloseTo(39819.62, 6);
    expect(d.recorte).toBeNull();
  });

  it("trimestral: a DFC é acumulada no ano e a DRE é do trimestre (recorte publicado, não deduzido)", () => {
    const dfc = dadosFinancas(S.series, ["17155730000164"], "con", "caixa_operacional", "trimestral");
    expect(dfc.recorte).toBe("acumulado_no_ano");
    const dre = dadosFinancas(S.series, ["17155730000164"], "con", "receita", "trimestral");
    expect(dre.recorte).toBe("trimestre");
  });

  it("comparação de várias companhias: uma coluna por CNPJ, ausência fica null (nunca zero) e nada é somado", () => {
    const cs = ["17155730000164", "06981180000116"];
    const d = dadosFinancas(S.series, cs, "con", "receita", "anual");
    for (const l of d.linhas) for (const c of cs) expect(c in l).toBe(true);
    for (const l of d.linhas) expect(Object.keys(l).sort()).toEqual(["x", ...cs].sort());
    // escopo sem nenhum valor numa companhia: ela fica fora de comDados, e a linha não vira zero
    const rio = dadosFinancas(S.series, ["02998301000181"], "con", "receita", "anual");
    for (const l of rio.linhas) expect(l["02998301000181"]).not.toBe(0);
  });

  it("tabela de companhias: valores do último exercício em R$ milhões, iguais à gold, e uma linha por companhia", () => {
    const linhas = linhasCompanhias(G.financas.companhias);
    expect(linhas.length).toBe(G.financas.companhias.length);
    const cemig = linhas.find((l) => l.id === "17155730000164")!;
    const g = G.financas.companhias.find((c) => c.cnpj === "17155730000164")!;
    expect(cemig.receita).toBe((g.valores!.receita as number) / 1e6);
    expect(matrizExportacao(COLUNAS_COMPANHIAS, linhas).linhas.length).toBe(linhas.length);
    const ids = new Set(csv("public/energia/series/empresas_companhias_cvm.csv").map((l) => l.cnpj));
    for (const l of linhas) expect(ids.has(String(l.id)), String(l.id)).toBe(true);
  });

  it("CELGPAR 2025: receita ausente com o aviso de fluxos não preenchidos (texto derivado da gold)", () => {
    const c = G.financas.companhias.find((x) => x.cnpj === "08560444000193")!;
    const t = textoCompanhia(c, G.financas.contas);
    expect(t).toContain("receita de sem dado");
    expect(t).toContain("DRE e DFC não preenchidas");
    const cemigD = G.financas.companhias.find((x) => x.cnpj === "06981180000116")!;
    expect(textoCompanhia(cemigD, G.financas.contas)).toContain("não se somam");
  });

  it("companhia padrão: a ativa de maior ativo total sem controladora aberta acima", () => {
    const [p] = padraoFinancas(G.financas.companhias);
    const c = G.financas.companhias.find((x) => x.cnpj === p)!;
    expect(c.situacao).toBe("ATIVO");
    expect(c.controladora_aberta).toBeNull();
    for (const x of G.financas.companhias) {
      if (x.situacao === "ATIVO" && !x.controladora_aberta && x.valores?.ativo_total) expect(x.valores.ativo_total).toBeLessThanOrEqual(c.valores!.ativo_total as number);
    }
  });
});

/* ================================================================ P039 */

describe("P039: controle e concentração", () => {
  const C = json<CadeiaSocietaria>("public/energia/series/empresas_cadeia.json");

  it("a cadeia montada do arquivo é a mesma que a gold calculou para cada distribuidora (caminho independente)", () => {
    for (const d of G.distribuidoras.indice) {
      const a = arvoreDe(C, d.cnpj);
      if (!a) {
        expect(d.controle.cadeia, d.slug).toEqual([d.cnpj]);
        continue;
      }
      expect(a.cadeia.map((x) => x.cnpj), d.slug).toEqual(d.controle.cadeia);
      expect(a.motivoTopo, d.slug).toBe(d.controle.motivo_parada);
    }
  });

  it("AXIA: topo sem controlador e sócia controladora da AXIA Nordeste; os sócios são os do arquivo, sem nome acrescentado", () => {
    const a = arvoreDe(C, "00001180000126")!;
    expect(a.cadeia.length).toBe(1);
    expect(a.motivoTopo).toBe("sem_controlador");
    expect(a.controladas.some((c) => c.cnpj === "33541368000116")).toBe(true);
    const doArquivo = C.arestas.pai.map((p, i) => [p, C.arestas.nome[i]] as const).filter(([p]) => p === "00001180000126").map(([, nome]) => nome);
    expect(a.socios.map((s) => s.nome).sort()).toEqual(doArquivo.slice().sort());
    expect(a.socios[0].controlador || a.socios.every((s) => !s.controlador)).toBe(true);
    expect(textoArvore(a)).toContain("é o próprio topo");
  });

  it("ciclo na cadeia para no nó repetido, sem laço infinito", () => {
    const c: CadeiaSocietaria = {
      gerado_em: "",
      nos: { "11111111000111": ["A", "22222222000122", null], "22222222000122": ["B", "11111111000111", null] },
      arestas: { pai: [], socio: [], nome: [], controlador: [], pct_direto: [] },
    };
    const a = arvoreDe(c, "11111111000111")!;
    expect(a.ciclo).toBe(true);
    expect(a.cadeia.map((x) => x.cnpj)).toEqual(["11111111000111", "22222222000122"]);
    expect(a.motivoTopo).toBe("ciclo");
    expect(arvoreDe(c, "33333333000133")).toBeNull();
  });

  it("limiares do Guia do CADE: os mesmos do catálogo de métricas, e classificam igual à gold em todos os níveis e tipos", () => {
    const m = json<{ metricas: { id: string; regras_comparabilidade: string[] }[] }>("public/energia/gold/metricas.json").metricas.find((x) => x.id === "empresas_hhi_capacidade")!;
    const regra = m.regras_comparabilidade.find((r) => r.includes("CADE"))!;
    expect(regra).toContain(`abaixo de ${num(LIMIARES_HHI_CADE.moderado, 0)}`);
    expect(regra).toContain(`acima de ${num(LIMIARES_HHI_CADE.alto, 0)}`);
    const faixa = (h: number) => (h < LIMIARES_HHI_CADE.moderado ? "nao_concentrado" : h <= LIMIARES_HHI_CADE.alto ? "moderado" : "alto");
    const cc = G.controle.concentracao;
    for (const k of ["proprietario_direto", "grupo_proporcional", "grupo_controle"] as const) expect(cc[k]!.faixa, k).toBe(faixa(cc[k]!.hhi!));
    for (const t of cc.por_tipo) expect(t.faixa, t.tipo).toBe(faixa(t.hhi_grupo!));
  });

  it("linhas dos níveis, dos tipos e dos grupos: as mesmas do gráfico e da tabela, e os grupos batem com empresas_grupos.csv", () => {
    const niveis = linhasNiveis(G.controle.concentracao);
    expect(niveis.map((l) => l.hhi)).toEqual([G.controle.concentracao.proprietario_direto!.hhi, G.controle.concentracao.grupo_proporcional!.hhi, G.controle.concentracao.grupo_controle!.hhi]);
    expect(linhasTipos(G.controle.concentracao.por_tipo).length).toBe(G.controle.concentracao.por_tipo.length);
    const porCnpj = new Map(csv("public/energia/series/empresas_grupos.csv").map((l) => [l.grupo_cnpj, l]));
    const linhas = linhasGrupos(G.controle.grupos);
    for (const l of linhas) {
      const c = porCnpj.get(String(l.id))!;
      expect(Math.abs((l.mw_proporcional as number) - (n(c.mw_proporcional) as number)), String(l.id)).toBeLessThanOrEqual(MEIA_CASA);
      expect(Math.abs((l.mw_controle as number) - (n(c.mw_controle) as number)), String(l.id)).toBeLessThanOrEqual(MEIA_CASA);
    }
    expect(matrizExportacao(COLUNAS_GRUPOS, linhas).linhas.length).toBe(G.controle.grupos.length);
  });
});

/* ================================================================ textos derivados */

describe("textos derivados dos números (mudar o número muda o texto)", () => {
  it("P036: cobertura e transmissão vêm da gold", () => {
    const r = respostaCadastro(G.cadastro);
    expect(r).toContain(pct(G.cadastro.ativos.pct_mw_operacao_vinculado!, 1));
    expect(r).toContain(num(G.cadastro.ativos.operacao.usinas, 0));
    const g2 = gold();
    g2.cadastro.ativos.pct_mw_operacao_vinculado = 87.5;
    g2.cadastro.transmissao = null;
    const r2 = respostaCadastro(g2.cadastro);
    expect(r2).toContain("87,5%");
    expect(r2).toContain("não estão nesta publicação");
  });

  it("P037: universo e presença em cada base vêm do resumo", () => {
    const r = respostaDistribuidoras(G.distribuidoras);
    expect(r).toContain(`${num(G.distribuidoras.resumo.distribuidoras, 0)} distribuidoras`);
    const g2 = gold();
    g2.distribuidoras.resumo.com_tarifa_vigente = 7;
    expect(respostaDistribuidoras(g2.distribuidoras)).toContain("tarifa residencial vigente (7)");
  });

  it("ficha: acima, abaixo e igual ao limite decididos na precisão exibida; ausência e tarifa sem vigência ditas", () => {
    const d = structuredClone(G.distribuidoras.indice.find((x) => x.slug === "cemig-d")!);
    expect(respostaFicha(d)).toContain("abaixo do limite de 9,50");
    d.qualidade!.dec = 9.504;
    expect(sentidoLimite(9.504, 9.5)).toBe("igual");
    expect(respostaFicha(d)).toContain("igual ao limite");
    d.qualidade!.dec = 12;
    expect(respostaFicha(d)).toContain("acima do limite");
    d.qualidade!.fec = null;
    expect(respostaFicha(d)).toContain("o FEC ficou sem dado");
    d.tarifa = { vigente: false, motivo: "vigência encerrada em 29/09/2026", ultima_vigencia: null };
    expect(respostaFicha(d)).toContain("Não há tarifa residencial vigente: vigência encerrada em 29/09/2026");
    const ceb = G.distribuidoras.indice.find((x) => x.slug === "ceb")!;
    expect(respostaFicha(ceb)).toContain("não tem perdas no ano de referência");
  });

  it("ficha: perda total negativa é dita como tal, sem causa afirmada", () => {
    const d = structuredClone(G.distribuidoras.indice.find((x) => x.slug === "cemig-d")!);
    d.perdas!.taxa_total_pct = -17.31;
    const r = respostaFicha(d);
    expect(r).toContain("registrou perda total negativa, de \u221217,31%");
    expect(r).toContain("a energia fornecida superou a injetada");
    expect(r).not.toContain("perdeu \u2212");
    d.perdas!.taxa_total_pct = 8.4;
    expect(respostaFicha(d)).toContain("perdeu 8,40%");
  });

  it("P038: universo, períodos e revisões vêm da gold", () => {
    const r = respostaFinancas(G.financas);
    expect(r).toContain(`${num(G.financas.universo.companhias, 0)} companhias`);
    expect(r).toContain(num(G.financas.revisoes.valores_reapresentados, 0));
    expect(r).toContain(G.financas.universo.nota_cobertura);
  });

  it("P039: HHI, faixa e maior grupo vêm da gold; trocar a faixa troca o texto", () => {
    const r = respostaControle(G.controle);
    const gp = G.controle.concentracao.grupo_proporcional!;
    expect(r).toContain(`${num(gp.hhi!, 0)} pontos`);
    expect(r).toContain(ROTULO_FAIXA[gp.faixa!]);
    expect(r).toContain(gp.maiores[0].nome!);
    const g2 = gold();
    g2.controle.concentracao.grupo_proporcional!.faixa = "alto";
    expect(respostaControle(g2.controle)).toContain("altamente concentrado");
    expect(textoTipos(G.controle.concentracao.por_tipo)).toContain("pontos");
  });

  it("reais em escala legível, com singular abaixo de 2 e sinal de menos tipográfico", () => {
    expect(reaisEscala(42751283000)).toBe("R$ 42,8 bilhões");
    expect(reaisEscala(1300000000)).toBe("R$ 1,3 bilhão");
    expect(reaisEscala(-5400000000)).toBe("−R$ 5,4 bilhões");
    expect(reaisEscala(null)).toBe("sem dado");
    expect(cnpjFormatado("12300288000107")).toBe("12.300.288/0001-07");
  });

  it("nenhum texto gerado usa travessão ou hífen como pontuação", () => {
    const d = G.distribuidoras.indice.find((x) => x.slug === "cemig-d")!;
    const textos = [
      respostaCadastro(G.cadastro),
      respostaDistribuidoras(G.distribuidoras),
      respostaFinancas(G.financas),
      respostaControle(G.controle),
      respostaFicha(d),
      textoTipos(G.controle.concentracao.por_tipo),
      textoCompanhia(G.financas.companhias[0], G.financas.contas),
    ];
    for (const x of textos) expect(x).not.toMatch(/ [—–-] /);
  });
});

/* ================================================================ páginas */

const MARCA_NUMERO = 'class="relative flex h-full flex-col border border-linha bg-superficie p-5"';
function blocosNumero(h: string): string[] {
  const out: string[] = [];
  let i = h.indexOf(MARCA_NUMERO);
  while (i >= 0) {
    const ini = h.lastIndexOf("<div", i);
    let prof = 0;
    let j = ini;
    const re = /<div\b|<\/div>/g;
    re.lastIndex = ini;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(h))) {
      prof += mm[0] === "</div>" ? -1 : 1;
      if (prof === 0) {
        j = re.lastIndex;
        break;
      }
    }
    out.push(h.slice(ini, j));
    i = h.indexOf(MARCA_NUMERO, j);
  }
  return out;
}
const principal = (h: string) => h.slice(h.indexOf("<main"));

describe("páginas renderizadas no servidor", () => {
  const paineis = { p036: PaginaAtivos, p037: PaginaDistribuidoras, p038: PaginaFinancas, p039: PaginaControle } as const;
  const html = Object.fromEntries(Object.entries(paineis).map(([k, P]) => [k, renderToStaticMarkup(createElement(P))])) as Record<keyof typeof paineis, string>;
  const sintese = renderToStaticMarkup(createElement(Sintese));
  const fichas = Object.fromEntries(["cemig-d", "cergapa", "ceb", "eletropaulo"].map((s) => [s, renderToStaticMarkup(createElement(Ficha, { params: { entidade: s } }))]));
  const respostas = { p036: respostaCadastro(G.cadastro), p037: respostaDistribuidoras(G.distribuidoras), p038: respostaFinancas(G.financas), p039: respostaControle(G.controle) };

  it("CEMIG-D: o Comprove de perdas totais mostra o mesmo valor do cartão (12,12%), não o da ficha com uma casa", () => {
    const texto = fichas["cemig-d"].replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const perdas = /Taxa de perdas totais[^%]{0,60}%/.exec(texto)?.[0] ?? "";
    expect(texto).toContain("12,12%");
    expect(texto).not.toMatch(/\b12,1%/);
    // o rótulo do Comprove, quando o cartão tem ficha, repete o valor exibido
    if (perdas) expect(perdas).toContain("12,12%");
  });

  it("comValorExibido só reescreve o texto quando o novo é o arredondamento do valor da ficha, na mesma unidade", () => {
    const ev = { indicador: "Taxa de perdas totais", valor_exibido: "12,1%", valor_calculo: 12.12486, unidade: "% da energia injetada", entidade: "X", periodo: { inicio: "2025-01", fim: "2025-12" },
      fonte: { orgao: "ANEEL", conjunto: "SAMP", recurso: "r", capturado_em: "2026-09-30T22:26:40Z" }, versao: { pipeline: "p", codigo: "c", publicacao: "2026-10-01T00:00:00Z" },
      citacao: "SCRUTINIUMS. Taxa de perdas totais: 12,1%, X, 01/2025 a 12/2025. Fim." } as unknown as Parameters<typeof comValorExibido>[0];
    const novo = comValorExibido(ev, "12,12%");
    expect(novo.valor_exibido).toBe("12,12%");
    expect(novo.citacao).toContain("Taxa de perdas totais: 12,12%, X");
    expect(novo.valor_calculo).toBe(12.12486);
    expect(citacaoBase(novo)).toContain("Taxa de perdas totais: 12,12%, X");
    // não inventa dígito, não troca a unidade e não aceita lixo
    expect(comValorExibido(ev, "12,13%")).toBe(ev);
    expect(comValorExibido(ev, "12,12")).toBe(ev);
    expect(comValorExibido(ev, "sem dado")).toBe(ev);
    const semValor = { ...ev, valor_calculo: null };
    expect(comValorExibido(semValor, "12,12%")).toBe(semValor);
    expect(comValorExibido(ev, "12,1%").valor_exibido).toBe("12,1%");
    expect(comValorExibido({ ...ev, valor_exibido: "1.234,5%", valor_calculo: 1234.5 }, "1.234,50%").valor_exibido).toBe("1.234,50%");
  });

  it("a síntese de Empresas oferece os dez arquivos do módulo para baixar", () => {
    expect(sintese).toContain("Baixar os dados do módulo");
    for (const x of G.downloads) expect(sintese).toContain(`href="${x.url}"`);
    expect((sintese.match(/download=""/g) ?? []).length).toBeGreaterThanOrEqual(G.downloads.length);
  });

  it("cada painel renderiza na sua página com a pergunta como título, a resposta derivada e toda a anatomia da seção 7.2", () => {
    for (const p of PAINEIS_EMPRESAS) {
      const h = html[p.id];
      expect(h, p.id).toContain(`id="${p.id}"`);
      expect(h, p.id).toContain(`id="${p.id}-titulo"`);
      expect(h, p.id).toContain(p.pergunta);
      expect(h, p.id).toContain(`data-resposta="${p.id}"`);
      expect(h, p.id).toContain(respostas[p.id].slice(0, 40));
      for (const parte of ["Período", "Universo", "Unidade", "Como interpretar", "O que não é possível concluir", "Próxima pergunta", "Copiar link deste painel", "Baixar", "Comprove este número"]) {
        expect(h, `${p.id}: ${parte}`).toContain(parte);
      }
      expect((h.match(/<table/g) ?? []).length, p.id).toBeGreaterThanOrEqual(3);
      expect(h, p.id).toContain('role="radiogroup" aria-label="Nível de profundidade"');
      expect(h, p.id).toContain('data-nivel="analisar"');
      expect(h, p.id).toContain('data-nivel="auditar"');
    }
  });

  it("tabelas equivalentes, interações e estados explicados em cada painel", () => {
    expect(html.p036).toContain("Carregar o mapa e a lista das usinas");
    expect(html.p036).toContain("maiores proprietários diretos");
    expect(html.p036).toContain("sem vínculo completo");
    expect(html.p037).toContain("Índice das distribuidoras");
    expect(html.p037).toContain("Distribuidoras comparadas (até 4)");
    expect(html.p037).toContain("DEC apurado diante do limite");
    expect(html.p038).toContain("Companhias abertas do setor elétrico na CVM");
    expect(html.p038).toContain("Fonte indisponível");
    expect(html.p038).toContain("Decisão de método");
    expect(html.p038).toContain("Valores do gráfico (tabela equivalente)");
    expect(html.p039).toContain("árvore societária declarada à ANEEL");
    expect(html.p039).toContain("Fronteira explícita");
    expect(html.p039).toContain("Guia do CADE");
  });

  it("a síntese traz as quatro perguntas, respostas, números com prova e links para as páginas dos painéis", () => {
    expect(sintese).toContain("Quem é dono de quê no setor elétrico?");
    for (const p of PAINEIS_EMPRESAS) {
      expect(sintese).toContain(p.pergunta);
      expect(sintese).toContain(`data-resposta="${p.id}"`);
      expect(sintese).toContain(`href="/setor-eletrico/empresas/${p.segmento}"`);
    }
    expect((sintese.match(/Comprove este número/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("fichas: pergunta, resposta, evolução própria, pares, controle e finanças, com estados de ausência ditos", () => {
    for (const [s, h] of Object.entries(fichas)) {
      const d = G.distribuidoras.indice.find((x) => x.slug === s)!;
      expect(h, s).toContain(`Como a ${d.sigla} atende sua área?`);
      expect(h, s).toContain('data-resposta="ficha"');
      expect(h, s).toContain(`Quem controla a ${d.sigla}?`);
      for (const parte of ["Período", "Universo", "Unidade", "Como interpretar", "O que não é possível concluir", "Próxima pergunta", "Copiar link deste painel"]) expect(h, `${s}: ${parte}`).toContain(parte);
    }
    expect(fichas["cemig-d"]).toContain("Comprove este número");
    expect(fichas["cemig-d"]).toContain("Como as perdas da CEMIG-D evoluíram?");
    expect(fichas["cemig-d"]).toContain("Concessionárias do Brasil");
    expect(fichas["cemig-d"]).toContain("já consolida estes números");
    const cergapa = G.distribuidoras.indice.find((x) => x.slug === "cergapa")!;
    expect(fichas.cergapa).toContain("sem tarifa vigente");
    expect(fichas.cergapa).toContain("não é companhia aberta");
    expect(cergapa.tarifa && !cergapa.tarifa.vigente).toBe(true);
    expect(fichas.ceb).toContain("inativa");
  });

  it("todo número de destaque tem 'Comprove este número' (ou declara ausência)", () => {
    for (const [k, h] of Object.entries({ ...html, sintese, ...fichas })) {
      for (const b of blocosNumero(h)) expect(b.includes("Comprove este número") || b.includes("sem dado"), `${k}: ${b.slice(0, 160)}`).toBe(true);
    }
  });

  it("sem estado de construção, sem hexadecimal solto e abaixo de 600 KB de HTML por página", () => {
    for (const [k, h] of Object.entries({ ...html, sintese, ...fichas })) {
      expect(principal(h), k).not.toMatch(/em breve|em integração|em construção/i);
      expect(h, k).not.toMatch(/#[0-9a-fA-F]{6}\b/);
      expect(h.length, k).toBeLessThan(600_000);
    }
  });

  it("todo href interno aponta para página existente, ficha gerada, verbete ou arquivo publicado", () => {
    const slugs = new Set(slugsEstaticos(G.distribuidoras.indice));
    for (const [k, h] of Object.entries({ ...html, sintese, ...fichas })) {
      const hrefs = Array.from(principal(h).matchAll(/href="(\/[^"#?]*)/g)).map((x) => x[1]);
      for (const href of Array.from(new Set(hrefs))) {
        const arquivo = existsSync(join(raiz, "public", href));
        const pagina = existsSync(join(raiz, "src/app", href, "page.tsx"));
        const ficha = /^\/setor-eletrico\/empresas\/[^/]+$/.test(href) && slugs.has(href.split("/").at(-1)!);
        const verbete = /^\/setor-eletrico\/aprenda\/[^/]+$/.test(href) && !!conceito(href.split("/").at(-1)!);
        expect(arquivo || pagina || ficha || verbete, `${k}: ${href}`).toBe(true);
      }
    }
    expect(rotaEntidade("cemig-d")).toBe("/setor-eletrico/empresas/cemig-d");
  });

  it("o destino está publicado e integrado na navegação, com a página marcada como atual", () => {
    const d = DESTINOS_NAVEGACAO.find((x) => x.slug === "empresas")!;
    expect(d.publicado).toBe(true);
    expect(d.integrado).toBe(true);
    expect(MODULOS_ENERGIA.find((m) => m.slug === "empresas")!.integrado).toBe(true);
    for (const h of [sintese, ...Object.values(html)]) expect(h).toContain('aria-current="page"');
  });

  it("o código das páginas não escreve à mão números que a gold publica", () => {
    const fontes = [
      "src/app/setor-eletrico/empresas/page.tsx",
      "src/app/setor-eletrico/empresas/ativos/page.tsx",
      "src/app/setor-eletrico/empresas/distribuidoras/page.tsx",
      "src/app/setor-eletrico/empresas/financas/page.tsx",
      "src/app/setor-eletrico/empresas/controle/page.tsx",
      "src/app/setor-eletrico/empresas/[entidade]/page.tsx",
      "src/components/energia/EmpresasMapaAtivos.tsx",
      "src/components/energia/EmpresasDistribuidoras.tsx",
      "src/components/energia/EmpresasFinancas.tsx",
      "src/components/energia/EmpresasControle.tsx",
    ].map(ler);
    const numeros = [
      num(G.cadastro.ativos.operacao.mw_fiscalizado!, 1),
      num(G.cadastro.ativos.operacao.usinas, 0),
      num(G.controle.fronteira.mw!, 1),
      num(G.controle.concentracao.grupo_proporcional!.hhi!, 1),
      num(G.cadastro.transmissao!.resumo.modulos, 0),
      num(G.financas.revisoes.valores_reapresentados, 0),
      pct(G.cadastro.ativos.pct_mw_operacao_vinculado!, 2),
    ];
    for (const f of fontes) for (const x of numeros) expect(f, x).not.toContain(x);
  });
});
