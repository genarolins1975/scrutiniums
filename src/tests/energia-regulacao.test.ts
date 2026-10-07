import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PaginaLimites from "@/app/setor-eletrico/regulacao/page";
import PaginaLinhaTempo from "@/app/setor-eletrico/regulacao/linha-do-tempo/page";
import PaginaConsultas from "@/app/setor-eletrico/regulacao/consultas-e-agenda/page";
import { RegulacaoIndisponivel } from "@/components/energia/RegulacaoPagina";
import { problemasEvidencia } from "@/lib/energia/evidencia";
import { DESTINOS_NAVEGACAO, MODULOS_ENERGIA } from "@/lib/energia/navegacao";
import {
  CAMPOS_LIMITE,
  COLUNAS_CONSULTAS,
  COLUNAS_LIMITES,
  COLUNAS_LINHA_TEMPO,
  FILTRO_LINHA_TEMPO_PADRAO,
  PAINEIS_REGULACAO,
  abreviarAto,
  anoInicioHistorico,
  avisoToleranciaIpca,
  consultasNaData,
  contagemAgendaPorPainel,
  contagemPaineisAfetados,
  contagemProcedimentos,
  contarSituacoes,
  defasagemAtas,
  defasagemDias,
  dominioFaixas,
  downloadsDoPainel,
  faixasConsultas,
  faixasLinhaTempo,
  filtrarLinhaTempo,
  linhasAgenda,
  linhasBandeiras,
  linhasHistoricoSituacao,
  linhasConsultas,
  linhasLimites,
  linhasLinhaTempo,
  linhasProcedimentos,
  nomeAgenda,
  oQueMudouLimites,
  ordenarConsultas,
  perguntaPainel,
  proximoPainel,
  respostaAgenda,
  respostaConsultas,
  respostaLimites,
  respostaLinhaTempo,
  respostaP044,
  respostaProcedimentos,
  rotaPainel,
  rotuloCurtoEvento,
  situacaoSeConfirmada,
  temaCurto,
  textoConferenciaAcionamento,
  textoCoberturaFaixa,
  textoDefasagemEvento,
  textoJanela,
  textoReuniao,
} from "@/lib/energia/regulacao";
import { matrizExportacao } from "@/lib/energia/tabela";
import { faseAtual, hojeBrasilia, situacaoConsulta, type FaseConsulta, type GoldRegulacao } from "@/lib/energia/tipos-regulacao";

/**
 * Contrato da gold do módulo Regulação (P044 a P046) do lado da interface:
 * a regra de situação das consultas reaplicada na página (situacaoConsulta) dá o mesmo
 * resultado que o pipeline na data de referência da gold, e os limites do PLD mantêm os
 * campos separados que o painel de permanência do PLD consome. Os casos concretos (atos,
 * datas, patamares e módulos) vêm das fontes primárias citadas em
 * docs/observatorios/energia/modulos/regulacao.md, seção 4.
 */
const gold = JSON.parse(readFileSync(join(process.cwd(), "public/energia/gold/regulacao.json"), "utf-8")) as GoldRegulacao;
const disponivel = gold.disponivel === true;

const fase = (f: Partial<FaseConsulta>): FaseConsulta => ({
  fase: "abertura",
  data_deliberacao: "2026-01-01",
  reuniao: "x",
  inicio: null,
  fim: null,
  janela_origem: null,
  fim_calculado: false,
  duracao_dias: null,
  sessao: null,
  trecho_periodo: null,
  ...f,
});

describe("regra de situação das consultas (sem depender da gold)", () => {
  it("fase sem janela nunca vira aberta e o rótulo diz por quê", () => {
    expect(situacaoConsulta({ fases: [fase({ duracao_dias: 45 })], resultado: null }, "2026-01-10")).toBe("prazo_nao_datado");
    expect(situacaoConsulta({ fases: [fase({ sessao: "2026-01-20" })], resultado: null }, "2026-01-10")).toBe("sessao_sem_periodo");
    expect(situacaoConsulta({ fases: [fase({})], resultado: null }, "2026-01-10")).toBe("sem_periodo_na_ata");
  });

  it("resultado levado à pauta depois da fase sem data: contribuições encerradas (CP 45/2019, pauta de 28/07/2026)", () => {
    const c = {
      fases: [fase({ fase: "3ª fase", data_deliberacao: "2024-12-10", duracao_dias: 60 })],
      resultado: {
        data: "2026-07-28", reuniao: "y", ato: null, ato_na_ata: null, ato_suspeito: false, motivo_ato_suspeito: null,
        resultado_julgamento: "Pedido de Vista", decidido: false, decisao: "", vinculo: "numero_citado" as const, forma: "resultado" as const,
      },
    };
    expect(situacaoConsulta(c, "2026-09-30")).toBe("resultado_em_pauta");
  });

  it("fim calculado de início e duração conta como janela (CP 16/2026: 93 dias a partir de 8 de junho de 2026)", () => {
    const c = { fases: [fase({ data_deliberacao: "2026-06-02", inicio: "2026-06-08", fim: "2026-09-08", janela_origem: "inicio_e_duracao", fim_calculado: true, duracao_dias: 93 })], resultado: null };
    expect(situacaoConsulta(c, "2026-09-08")).toBe("aberta");
    expect(situacaoConsulta(c, "2026-09-30")).toBe("encerrada_aguardando");
  });
});

describe.skipIf(!disponivel)("gold regulacao.json", () => {
  it("situação das consultas: TypeScript reproduz o Python na data de referência", () => {
    const ref = gold.consultas.data_referencia;
    for (const c of gold.consultas.itens) expect(situacaoConsulta(c, ref), c.id).toBe(c.situacao);
  });

  it("consulta vencida nunca aparece como aberta, em qualquer data posterior", () => {
    for (const c of gold.consultas.itens) {
      const f = faseAtual(c);
      if (!f?.fim) continue;
      const depois = new Date(Date.parse(`${f.fim}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
      expect(["aberta", "a_abrir"]).not.toContain(situacaoConsulta(c, depois));
    }
  });

  it("CP 23/2026 ('entre os dias 30 de julho e 14 de setembro de 2026') tem janela e está encerrada em 30/09/2026", () => {
    const c = gold.consultas.itens.find((x) => x.id === "CP-23-2026");
    expect(c).toBeDefined();
    if (!c) return;
    expect([c.inicio, c.fim, c.janela_origem, c.fim_calculado]).toEqual(["2026-07-30", "2026-09-14", "datas_explicitas", false]);
    expect(situacaoConsulta(c, "2026-09-30")).toBe("encerrada_aguardando");
  });

  it("limites: piso, teto horário e teto estrutural em campos separados", () => {
    for (const a of gold.limites_pld.atos) {
      expect(a.unidade).toBe("R$/MWh");
      expect(a.vigencia_inicio <= a.vigencia_fim).toBe(true);
      if (a.pld_max_horario !== null && a.pld_max_estrutural !== null) expect(a.pld_max_horario).toBeGreaterThan(a.pld_max_estrutural);
    }
    for (const v of gold.limites_pld.vigencias) {
      expect(v.pld_min).not.toBeNull();
      expect(v.pld_max_horario).not.toBeNull();
      expect(v.pld_max_estrutural).not.toBeNull();
    }
  });

  it("publicação no DOU distinta da vigência, como o extrato informa", () => {
    const por = new Map(gold.limites_pld.atos.map((a) => [a.ato, a]));
    // REH nº 3.167/2022: "publicado no D.O. de 04.01.2023", vigência desde 01/01/2023; retificação no D.O. de 06.01.2023
    expect(por.get("Resolução Homologatória ANEEL nº 3.167/2022")?.data_publicacao).toBe("2023-01-04");
    expect(por.get("Resolução Homologatória ANEEL nº 3.167/2022")?.vigencia_inicio).toBe("2023-01-01");
    expect(por.get("Retificação da Resolução Homologatória ANEEL nº 3.167/2022")?.data_publicacao).toBe("2023-01-06");
    // Despacho nº 3.850/2025: publicado em 23/12/2025 para valer em 2026
    expect(por.get("Despacho ANEEL nº 3.850/2025")?.data_publicacao).toBe("2025-12-23");
    expect(por.get("Despacho ANEEL nº 3.850/2025")?.vigencia_inicio).toBe("2026-01-01");
    // 2021: extrato não acessado; publicação vazia, nunca a data de captura
    expect(por.get("Resolução Homologatória ANEEL nº 2.828/2020")?.data_publicacao).toBeNull();
    const distintas = gold.limites_pld.atos.filter((a) => a.data_publicacao && a.data_publicacao !== a.vigencia_inicio);
    expect(distintas.length).toBe(gold.limites_pld.atos.filter((a) => a.data_publicacao).length);
  });

  it("aplicação literal do art. 23, § 1º, é informativa e não reproduz os atos", () => {
    const lit = gold.limites_pld.conferencias_detalhe.filter((x) => x.conferencia === "art23_literal");
    expect(lit.length).toBeGreaterThan(0);
    for (const x of lit) {
      expect(x.resultado).toBe("ressalva");
      expect(Math.abs(x.diferenca ?? 0)).toBeGreaterThan(0.2);
    }
    expect(gold.limites_pld.conferencias.regra_ipca?.reprovado).toBe(0);
  });

  it("escassez hídrica termina em abril de 2022 com grão mensal, sem dia imputado; patamares vigentes ficam abertos", () => {
    // recurso Acionamento: 2022-04 a R$ 71,00 (metade de R$ 142,00): acionamento em parte do mês, dia não informado
    const esc = gold.bandeiras.vigencias.filter((x) => x.patamar === "Escassez Hídrica");
    expect(esc.map((x) => [x.rs_mwh, x.vigencia_fim, x.vigencia_fim_mes, x.vigencia_fim_grao, x.vigencia_fim_origem])).toEqual([
      [142, null, "2022-04", "mes", "ultimo_acionamento"],
    ]);
    expect(esc[0].ultimo_acionamento).toEqual({ competencia: "2022-04", rs_mwh: 71 });
    const p2 = gold.bandeiras.vigencias.filter((x) => x.patamar === "Vermelha P2").at(-1);
    expect([p2?.ato, p2?.rs_mwh, p2?.vigencia_fim]).toEqual(["REH nº 3.306/2024", 78.77, null]);
  });

  it("PRODIST: Módulo 11 não é afirmado como REN nº 956/2021 vigente (REN nº 1.137/2025 aprovou nova versão)", () => {
    const m11 = gold.procedimentos.itens.find((i) => i.conjunto === "PRODIST" && i.modulo === "Módulo 11");
    expect(m11?.ato_na_pagina).toBe("Resolução Normativa nº 956/2021");
    expect(m11?.conferencia).toBe("pagina_possivelmente_desatualizada");
    expect(m11?.ato_vigente).toBeNull();
    expect(m11?.atos_posteriores.map((e) => e.ato)).toContain("Resolução Normativa nº 1.137/2025");
    const m8 = gold.procedimentos.itens.find((i) => i.conjunto === "PRODIST" && i.modulo === "Módulo 8");
    expect([m8?.conferencia, m8?.ato_vigente]).toEqual(["confirmada_por_ato_integrado", "Resolução Normativa nº 1.137/2025"]);
  });

  it("adicionais contrariados pelo recurso Acionamento: Vermelha P1 de R$ 55 até 2015-08 e Vermelha P2 de R$ 35 até 2017-10", () => {
    // Acionamento: Vermelha P1 a R$ 45,00 de 2015-09 a 2016-01; Vermelha P2 a R$ 50,00 em 2017-11 (sem resolução no Adicional)
    const p1 = gold.bandeiras.vigencias.find((x) => x.patamar === "Vermelha P1" && x.vigencia_inicio === "2015-03-02");
    expect([p1?.rs_mwh, p1?.vigencia_fim, p1?.vigencia_fim_mes, p1?.vigencia_fim_origem]).toEqual([55, null, "2015-08", "acionamento_diverge"]);
    const p2 = gold.bandeiras.vigencias.find((x) => x.patamar === "Vermelha P2" && x.vigencia_inicio === "2017-02-01");
    expect([p2?.vigencia_fim, p2?.vigencia_fim_mes, p2?.conferencia_acionamento?.meses_divergentes]).toEqual([null, "2017-10", [{ competencia: "2017-11", rs_mwh: 50 }]]);
    const ids = gold.linha_do_tempo.eventos.filter((e) => e.vigencia_grao === "mes").map((e) => e.id);
    expect(ids).toContain("bandeiras-acionamento-2015-09-vermelha-p1");
    expect(ids).toContain("bandeiras-acionamento-2017-11-vermelha-p2");
  });

  it("consultas decididas por decisão que consolida o edital ou aprova o objeto (CP 6/2026, CP 3/2026)", () => {
    const cont = gold.consultas.contagem_por_situacao;
    // antes da correção: 108 encerradas aguardando e 411 decididas
    expect(cont.encerrada_aguardando ?? 999).toBeLessThanOrEqual(92);
    expect(cont.decidida ?? 0).toBeGreaterThanOrEqual(427);
    const cp6 = gold.consultas.itens.find((x) => x.id === "CP-6-2026");
    if (cp6) expect([cp6.situacao, cp6.resultado?.ato, cp6.resultado?.forma]).toEqual(["decidida", "Despacho nº 2.266/2026", "consolidacao"]);
    const cp3 = gold.consultas.itens.find((x) => x.id === "CP-3-2026");
    if (cp3) {
      // a ata registra "Portaria nº 1.160/2026"; a página do PRORET diz REN nº 1.160/2026: ato suspeito, não exibido
      expect([cp3.situacao, cp3.resultado?.vinculo, cp3.resultado?.ato, cp3.resultado?.ato_na_ata]).toEqual([
        "decidida", "processo_e_objeto", null, "Portaria nº 1.160/2026",
      ]);
    }
    // CP 1/2026: 2ª fase instaurada em 30/06/2026 pelo prazo de 45 dias, sem datas: entra na janela pela fase atual
    expect(gold.consultas.itens.find((x) => x.id === "CP-1-2026")?.situacao).toBe("prazo_nao_datado");
  });

  it("PRORET: versão da página conferida com a REN nº 1.114/2025 lida (Submódulo 4.3: página 1.3, ato 1.1)", () => {
    const sub = (m: string) => gold.procedimentos.itens.find((i) => i.conjunto === "PRORET" && i.modulo === m);
    expect([sub("Submódulo 4.3")?.versao_na_pagina, sub("Submódulo 4.3")?.versao_no_ato, sub("Submódulo 4.3")?.conferencia_versao]).toEqual(["1.3", "1.1", "diverge"]);
    expect([sub("Submódulo 2.1")?.conferencia, sub("Submódulo 2.1")?.conferencia_versao]).toEqual(["confirmada_por_ato_integrado", "confere"]);
    expect([sub("Submódulo 3.1 A")?.versao_na_pagina, sub("Submódulo 3.1 A")?.ato_na_pagina]).toEqual(["1.2", "Resolução Normativa nº 1.114/2025"]);
    expect(sub("Submódulo 12.1")?.ato_na_pagina).toBe("Despacho nº 3.606/2025");
  });

  it("REN nº 1.000/2021: publicação original no DOU de 20/12/2021, conferida no texto do ato", () => {
    const e = gold.linha_do_tempo.eventos.find((x) => x.id === "ren-1000-2021");
    expect([e?.data_publicacao, e?.conferencia_publicacao?.resultado]).toEqual(["2021-12-20", "aprovado"]);
    for (const x of gold.linha_do_tempo.eventos) expect(x.conferencia_publicacao?.resultado).not.toBe("reprovado");
  });

  it("agenda: só atividades sobre limites entram em limites_em_revisao", () => {
    expect(gold.limites_em_revisao.map((x) => x.codigo).sort()).toEqual(["AR24-05", "AR24-18"]);
  });

  it("linha do tempo nunca traz impacto estimado", () => {
    for (const e of gold.linha_do_tempo.eventos) expect(e.impacto_estimado).toBeNull();
  });
});

/* ======================================================================== interface (fase 2) */

const raiz = process.cwd();
const SEM_TRAVESSAO = /—|–| - /;
const CAUSAL = /por causa d|causou|provocou|explicad[oa] pel|graças a/i;

describe("lógica pura da interface (sem depender da gold)", () => {
  it("assunto da consulta sem a fórmula de abertura repetida em quase todas as atas", () => {
    expect(
      temaCurto("Proposta de abertura de Consulta Pública com vistas a colher subsídios e informações adicionais para o aprimoramento das Regras de Comercialização de Energia Elétrica, versão 2027."),
    ).toBe("O aprimoramento das Regras de Comercialização de Energia Elétrica, versão 2027.");
    expect(temaCurto("Resultado da Consulta Pública nº 36/2023, instituída com vistas a")).toBe("Resultado da Consulta Pública nº 36/2023, instituída com vistas a");
    expect(temaCurto("Proposta de abertura de Consulta Pública, com vistas a colher subsídios para a revisão")).toBe("A revisão");
    expect(temaCurto("Proposta de abertura de Audiência Pública com vistas a colher subsídios e informações adicionais para a Revisão da Companhia Estadual de Distribuição de Energia Eletrica – CEEE-D.")).toBe(
      "A Revisão da Companhia Estadual de Distribuição de Energia Eletrica, CEEE-D.",
    );
  });

  it("ato abreviado para a coluna estreita do gráfico, com o ano do número ou da data por extenso", () => {
    expect(abreviarAto("Resolução Normativa ANEEL nº 1.147, de 9 de dezembro de 2025")).toBe("REN nº 1.147/2025");
    expect(abreviarAto("Despacho ANEEL nº 3.587, de 26 de setembro de 2023")).toBe("Despacho nº 3.587/2023");
    expect(abreviarAto("Medida Provisória nº 1.300, de 21 de maio de 2025")).toBe("MP nº 1.300/2025");
    expect(abreviarAto("Lei nº 14.203, de 10 de setembro de 2021")).toBe("Lei nº 14.203/2021");
    expect(abreviarAto("Portaria MME nº 301, de 31 de julho de 2019")).toBe("Portaria MME nº 301/2019");
    expect(abreviarAto("Resolução Normativa ANEEL nº 1.114, de 11 de fevereiro de 2025")).toBe("REN nº 1.114/2025");
    expect(abreviarAto("Retificação da Resolução Homologatória ANEEL nº 3.167/2022")).toBe("Retif. REH nº 3.167/2022");
    expect(abreviarAto("RES CREG nº 3/2021")).toBe("RES CREG nº 3/2021");
    expect(abreviarAto("REH nº 3.306/2024")).toBe("REH nº 3.306/2024");
    // vigência de mês: "Acionamento 09/2015", nunca o título repetido dos três registros iguais
    expect(rotuloCurtoEvento({ ato: null, titulo: "Valor observado no Acionamento", tipo_ato: "Registro mensal de acionamento", vigencia_inicio: "2015-09-01" })).toBe("Acionamento 09/2015");
  });

  it("decisão de abertura sem resultado formal: situação se confirmada, com as pontas inclusivas", () => {
    // pauta de 29/09/2026: "de 30/09/2026 a 14/11/2026"
    const d = { inicio: "2026-09-30", fim: "2026-11-14" };
    expect(situacaoSeConfirmada(d, "2026-09-29")).toBe("a_abrir");
    expect(situacaoSeConfirmada(d, "2026-09-30")).toBe("aberta");
    expect(situacaoSeConfirmada(d, "2026-11-14")).toBe("aberta");
    expect(situacaoSeConfirmada(d, "2026-11-15")).toBe("encerrada_aguardando");
    expect(situacaoSeConfirmada({ inicio: null, fim: null }, "2026-10-01")).toBeNull();
  });

  it("fonte defasada: arquivo das atas com mais de 14 dias (a fonte se declara semanal)", () => {
    expect(defasagemAtas({ atas_geradas_em: "2026-09-25", atas_deliberadas_ate: "2026-09-22" }, "2026-10-01")).toEqual({ dias: 6, defasada: false });
    expect(defasagemAtas({ atas_geradas_em: "2026-09-25", atas_deliberadas_ate: "2026-09-22" }, "2026-10-09")).toEqual({ dias: 14, defasada: false });
    expect(defasagemAtas({ atas_geradas_em: "2026-09-25", atas_deliberadas_ate: "2026-09-22" }, "2026-10-10")).toEqual({ dias: 15, defasada: true });
    expect(defasagemAtas({ atas_geradas_em: null, atas_deliberadas_ate: null }, "2026-10-10")).toEqual({ dias: null, defasada: false });
  });

  it("defasagem publicação até vigência: dias só com as duas datas e grão diário; retroativa dita como tal", () => {
    expect(defasagemDias({ data_publicacao: "2021-09-13", vigencia_inicio: "2022-01-11", vigencia_grao: "dia" })).toBe(120);
    expect(defasagemDias({ data_publicacao: null, vigencia_inicio: "2024-04-01", vigencia_grao: "dia" })).toBeNull();
    expect(defasagemDias({ data_publicacao: "2015-08-01", vigencia_inicio: "2015-09-01", vigencia_grao: "mes" })).toBeNull();
    expect(textoDefasagemEvento({ data_publicacao: "2021-09-13", vigencia_inicio: "2022-01-11", vigencia_grao: "dia", vigencia_calculada: true })).toBe(
      "vigência 120 dias após a publicação (vigência calculada pela LC nº 95/1998)",
    );
    expect(textoDefasagemEvento({ data_publicacao: "2023-01-04", vigencia_inicio: "2023-01-01", vigencia_grao: "dia", vigencia_calculada: false })).toBe(
      "vigência retroativa: 3 dias antes da publicação",
    );
    expect(textoDefasagemEvento({ data_publicacao: null, vigencia_inicio: "2024-04-01", vigencia_grao: "dia", vigencia_calculada: false })).toBe("publicação no DOU não informada pela fonte");
  });

  it("domínio das faixas cobre o mês inteiro de uma marca de grão mensal", () => {
    const d = dominioFaixas([{ id: "a", rotulo: "a", inicio: null, fim: { data: "2015-09-01", forma: "cheio", rotulo: "", mes: true }, traco: "nenhum", cor: "x", leitura: "" }]);
    // 2015-09-01 = 16679 e 2015-09-30 = 16708, com folga mínima de 7 dias
    expect(d).toEqual({ min: 16679 - 7, max: 16708 + 7 });
    expect(dominioFaixas([])).toBeNull();
  });

  it("ausência dita, nunca número de reserva: janela, histórico por situação e reunião sem identificação", () => {
    expect(textoJanela(200)).toBe("com atividade nos últimos 200 dias");
    expect(textoJanela(1)).toBe("com atividade nos últimos 1 dia");
    expect(textoJanela(undefined)).not.toMatch(/\d/);
    const semJanela = respostaConsultas({ itens: [], janela_dias: undefined, decisoes_sem_resultado_formal: [], atas_deliberadas_ate: "2026-09-22" }, "2026-10-01");
    expect(semJanela).toContain("a publicação não informa a janela");
    expect(semJanela).not.toMatch(/últimos \d+ dias/);
    // situação sem contagem na gold: sem valor no gráfico e na tabela, não zero; zero publicado continua zero
    const h = linhasHistoricoSituacao({ contagem_por_situacao: { aberta: 3, a_abrir: 0 } });
    expect(h.find((l) => l.id === "aberta")?.n).toBe(3);
    expect(h.find((l) => l.id === "a_abrir")?.n).toBe(0);
    expect(h.find((l) => l.id === "decidida")?.n).toBeNull();
    expect(textoReuniao("41/2025 - RPO")).toBe("41/2025 (RPO)");
    expect(textoReuniao("17/2026 - RPC")).toBe("17/2026 (RPC)");
    expect(textoReuniao(null)).toBe("sem identificação na ata");
  });

  it("concordância nos textos derivados: artigo do ato e plural das contagens", () => {
    const vig = { ano: 2024, inicio: "2024-01-01", fim: "2024-12-31", pld_min: 61.07, pld_max_estrutural: 716.8, pld_max_horario: 1470.57 };
    const ato = (nome: string, pub: string) =>
      ({ ano: 2024, ato: nome, data_publicacao: pub, vigencia_inicio: "2024-01-01", vigencia_fim: "2024-12-31" }) as unknown as GoldRegulacao["limites_pld"]["atos"][number];
    const g = (nome: string) =>
      ({
        limites_pld: {
          atos: [ato(nome, "2023-12-22")],
          vigencias: [{ ...vig, ato_pld_min: nome, ato_pld_max_estrutural: nome, ato_pld_max_horario: nome }],
        },
      }) as unknown as Pick<GoldRegulacao, "limites_pld">;
    expect(oQueMudouLimites(g("Resolução Homologatória ANEEL nº 3.304/2023"))).toMatch(/^O ato mais recente é a Resolução Homologatória/);
    expect(oQueMudouLimites(g("Despacho ANEEL nº 3.850/2025"))).toMatch(/^O ato mais recente é o Despacho/);
    expect(textoConferenciaAcionamento({ meses_conferidos: 1, meses_coerentes: 1, meses_divergentes: 0, meses_parciais: 1, meses_sem_vigencia: 0, regra: "" })).toBe(
      "1 mês acionado conferido: 1 coerente, 0 com outro valor, 1 parcial e 0 sem resolução no recurso de adicionais.",
    );
    const umaPendente = respostaConsultas(
      {
        itens: [],
        janela_dias: 200,
        atas_deliberadas_ate: "2026-09-22",
        decisoes_sem_resultado_formal: [{ inicio: "2026-09-30", fim: "2026-11-14" }] as unknown as GoldRegulacao["consultas"]["decisoes_sem_resultado_formal"],
      },
      "2026-10-01",
    );
    expect(umaPendente).toContain("Outra decisão de abertura da última pauta ainda não tem resultado formal na ata e fica fora da contagem: se confirmada, 1 estaria aberta.");
    expect(textoConferenciaAcionamento({ meses_conferidos: 72, meses_coerentes: 65, meses_divergentes: 6, meses_parciais: 2, meses_sem_vigencia: 2, regra: "" })).toContain(
      "65 coerentes, 6 com outro valor, 2 parciais",
    );
  });

  it("painéis e rotas: um por página, próxima pergunta em ciclo", () => {
    expect(PAINEIS_REGULACAO.map((p) => p.rota)).toEqual(["/setor-eletrico/regulacao", "/setor-eletrico/regulacao/linha-do-tempo", "/setor-eletrico/regulacao/consultas-e-agenda"]);
    expect(proximoPainel("p044").id).toBe("p045");
    expect(proximoPainel("p046").id).toBe("p044");
    for (const p of PAINEIS_REGULACAO) {
      expect(p.pergunta).toMatch(/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ].{10,}\?$/);
      expect(existsSync(join(raiz, "src/app", p.rota, "page.tsx")), p.rota).toBe(true);
    }
  });
});

describe.skipIf(!disponivel)("interface: linhas do gráfico, da tabela e da exportação", () => {
  it("P044: uma linha por vigência, com os valores da gold, e a mesma matriz no CSV exportado", () => {
    const linhas = linhasLimites(gold);
    expect(linhas.length).toBe(gold.limites_pld.vigencias.length);
    expect(new Set(linhas.map((l) => l.id)).size).toBe(linhas.length);
    for (const v of gold.limites_pld.vigencias) {
      const l = linhas.find((x) => x.ano === v.ano && x.inicio === v.inicio)!;
      for (const c of CAMPOS_LIMITE) expect(l[c], `${v.ano} ${c}`).toBe(v[c]);
    }
    const m = matrizExportacao(COLUNAS_LIMITES, linhas);
    expect(m.linhas.length).toBe(linhas.length);
    const iTeto = COLUNAS_LIMITES.findIndex((c) => c.id === "pld_max_horario");
    expect(m.linhas.map((r) => r[iTeto])).toEqual(linhas.map((l) => l.pld_max_horario));
    // 2026: Despacho nº 3.850/2025, piso R$ 57,31, teto estrutural R$ 785,27, teto horário R$ 1.611,04 (item (ii), p. 1)
    const l26 = linhas.find((l) => l.ano === 2026)!;
    expect([l26.pld_min, l26.pld_max_estrutural, l26.pld_max_horario, l26.ato_tetos, l26.publicacao_tetos]).toEqual([57.31, 785.27, 1611.04, "Despacho ANEEL nº 3.850/2025", "2025-12-23"]);
    // 2022: piso pela REH nº 2.994/2021 (DOU 20/12/2021) e tetos pelo Despacho nº 4.046/2021 (DOU 17/12/2021), campos separados
    const l22 = linhas.find((l) => l.ano === 2022)!;
    expect([l22.ato_pld_min, l22.publicacao_pld_min, l22.ato_tetos, l22.publicacao_tetos]).toEqual([
      "Resolução Homologatória ANEEL nº 2.994/2021",
      "2021-12-20",
      "Despacho ANEEL nº 4.046/2021",
      "2021-12-17",
    ]);
    // 2021: extrato inacessível, publicação vazia (nunca a data de captura)
    expect(linhas.find((l) => l.ano === 2021)?.publicacao_pld_min).toBeNull();
  });

  it("P044: bandeiras e procedimentos com as mesmas linhas no gráfico e na tabela, e contagens que fecham com a gold", () => {
    const b = linhasBandeiras(gold);
    expect(b.length).toBe(gold.bandeiras.vigencias.length);
    expect(b.find((x) => x.id === "Vermelha P1:2015-03-02")?.vigencia_fim).toBe("08/2015 (só o mês é conhecido)");
    expect(b.find((x) => x.id === "Vermelha P1:2015-03-02")?.fim_pelo_adicional).toBe("2016-01-31");
    expect(b.find((x) => x.id === "Vermelha P2:2024-04-01")?.vigencia_fim).toMatch(/^sem fim/);
    const cont = contagemProcedimentos(gold.procedimentos.itens);
    const soma = (k: string) => cont.reduce((s, x) => s + (x[k] as number), 0);
    for (const [k, n] of Object.entries(gold.procedimentos.contagem_conferencia)) expect(soma(k), k).toBe(n);
    expect(soma("total")).toBe(gold.procedimentos.itens.length);
    expect(linhasProcedimentos(gold.procedimentos.itens).length).toBe(gold.procedimentos.itens.length);
    // Módulo 11 do PRODIST: página possivelmente desatualizada, ato posterior REN nº 1.137/2025 citado, sem ato vigente
    const m11 = linhasProcedimentos(gold.procedimentos.itens).find((l) => l.id === "PRODIST:Módulo 11")!;
    expect([m11.conferencia, m11.ato_vigente]).toEqual(["Página possivelmente desatualizada", null]);
    expect(String(m11.atos_posteriores)).toContain("Resolução Normativa nº 1.137/2025 em 21/10/2025");
  });

  it("P045: o recorte padrão traz os 26 eventos; gráfico, lista e tabela na mesma ordem; impacto estimado sempre vazio", () => {
    const r = filtrarLinhaTempo(gold.linha_do_tempo.eventos, FILTRO_LINHA_TEMPO_PADRAO);
    expect(r.eventos.length).toBe(gold.linha_do_tempo.eventos.length);
    const ids = r.eventos.map((e) => e.id);
    expect(faixasLinhaTempo(r.eventos).map((f) => f.id)).toEqual(ids);
    expect(linhasLinhaTempo(r.eventos).map((l) => l.id)).toEqual(ids);
    // mais recente primeiro pela vigência
    const vig = r.eventos.map((e) => e.vigencia_inicio);
    expect(vig).toEqual([...vig].sort().reverse());
    const iImpacto = COLUNAS_LINHA_TEMPO.findIndex((c) => c.id === "impacto_estimado");
    for (const linha of matrizExportacao(COLUNAS_LINHA_TEMPO, linhasLinhaTempo(r.eventos)).linhas) expect(linha[iImpacto]).toBeNull();
  });

  it("P045: filtro por painel afetado e por período na data de publicação (sem data fica fora e é contado)", () => {
    const ev = gold.linha_do_tempo.eventos;
    const pld = filtrarLinhaTempo(ev, { ...FILTRO_LINHA_TEMPO_PADRAO, painel: "pld" });
    expect(pld.eventos.length).toBeGreaterThan(0);
    for (const e of pld.eventos) expect(e.paineis.map((p) => p.href)).toContain("/setor-eletrico/pld");
    expect(pld.eventos.map((e) => e.id)).toContain("ren-1032-2022");
    const porPub = filtrarLinhaTempo(ev, { ...FILTRO_LINHA_TEMPO_PADRAO, base: "publicacao", de: "2015-01-01", ate: "2026-12-31" });
    expect(porPub.semDataNaBase).toBe(ev.filter((e) => !e.data_publicacao).length);
    expect(porPub.eventos.length + porPub.semDataNaBase).toBe(ev.length);
    // MP nº 1.300/2025: publicada em 21/05/2025, vigência calculada (LC nº 95/1998) em 05/07/2025
    const mp = filtrarLinhaTempo(ev, { ...FILTRO_LINHA_TEMPO_PADRAO, base: "publicacao", de: "2025-05-21", ate: "2025-05-21" });
    expect(mp.eventos.map((e) => e.id)).toEqual(["mpv-1300-2025"]);
    expect(filtrarLinhaTempo(ev, { ...FILTRO_LINHA_TEMPO_PADRAO, base: "vigencia", de: "2025-05-21", ate: "2025-05-21" }).eventos).toEqual([]);
    const quem = contagemPaineisAfetados(ev);
    expect(quem.reduce((s, q) => s + q.n, 0)).toBe(ev.reduce((s, e) => s + e.paineis.length, 0));
  });

  it("P046: na data de referência, a contagem de abertas é a da ficha de prova e do resumo", () => {
    const naData = consultasNaData(gold.consultas.itens, gold.consultas.data_referencia);
    const n = contarSituacoes(naData);
    expect(Object.values(n).reduce((a, b) => a + b, 0)).toBe(gold.consultas.itens.length);
    expect(n.aberta).toBe(gold.evidencias.consultas_abertas?.valor_calculo);
    expect(n.aberta).toBe(gold.resumo.consultas_abertas);
    const ord = ordenarConsultas(naData);
    expect(faixasConsultas(ord).map((f) => f.id)).toEqual(ord.map((c) => c.id));
    expect(linhasConsultas(ord).map((l) => l.id)).toEqual(ord.map((c) => c.id));
    expect(matrizExportacao(COLUNAS_CONSULTAS, linhasConsultas(ord)).linhas.length).toBe(ord.length);
    // abertas primeiro, pelo prazo mais próximo
    const abertas = ord.filter((c) => c.situacao_na_data === "aberta");
    expect(ord.slice(0, abertas.length)).toEqual(abertas);
    expect(abertas.map((c) => c.fim)).toEqual(abertas.map((c) => c.fim).sort());
  });

  it("P046: em qualquer data posterior, nenhuma consulta vencida aparece como aberta no gráfico, na tabela ou na resposta", () => {
    for (const data of ["2026-10-02", "2026-10-03", "2026-10-15", "2026-11-10", "2027-01-01"]) {
      const naData = consultasNaData(gold.consultas.itens, data);
      for (const c of naData.filter((x) => x.situacao_na_data === "aberta")) {
        expect(c.inicio! <= data && data <= c.fim!, `${c.id} em ${data}`).toBe(true);
      }
      for (const f of faixasConsultas(naData)) {
        const c = naData.find((x) => x.id === f.id)!;
        if (c.fim && c.fim < data) expect(f.leitura, `${c.id} em ${data}`).not.toMatch(/recebendo contribuições/);
      }
    }
    // CP 30/2026, "no período de 3 de setembro a 2 de outubro de 2026" (ata de 01/09/2026): aberta em 02/10, encerrada em 03/10
    expect(respostaConsultas(gold.consultas, "2026-10-02")).toContain("a primeira a fechar é a Consulta Pública nº 30/2026, até 02/10/2026");
    expect(respostaConsultas(gold.consultas, "2026-10-03")).not.toContain("Consulta Pública nº 30/2026, até");
    expect(consultasNaData(gold.consultas.itens, "2026-10-03").find((c) => c.id === "CP-30-2026")?.situacao_na_data).toBe("encerrada_aguardando");
  });

  it("P046: agenda com as mesmas linhas na tabela e contagens que fecham com a portaria", () => {
    const l = linhasAgenda(gold.agenda.itens, gold.limites_em_revisao);
    expect(l.length).toBe(gold.agenda.itens.length);
    expect(l.filter((x) => x.limites_pld === "sim").map((x) => x.id).sort()).toEqual(["AR24-05", "AR24-18"]);
    const c = contagemAgendaPorPainel(gold.agenda.itens);
    for (const ano of c.anos) {
      const comPainel = gold.agenda.itens.filter((i) => String(i.ano_previsto) === ano);
      const vinculos = comPainel.reduce((s, i) => s + i.paineis.length, 0);
      expect(c.linhas.reduce((s, x) => s + (x[ano] as number), 0), ano).toBe(vinculos);
    }
    expect(c.semPainel).toBe(gold.agenda.itens.filter((i) => !i.paineis.length).length);
  });

  it("downloads: cada CSV publicado pertence a um painel e existe em public/", () => {
    const todos = new Set(PAINEIS_REGULACAO.flatMap((p) => downloadsDoPainel(gold, p.id).map((d) => d.url)));
    expect(todos.size).toBe(gold.downloads.length);
    for (const d of gold.downloads) expect(existsSync(join(raiz, "public", d.url)), d.url).toBe(true);
  });

  it("evidências dos KPIs completas (dez seções da ficha)", () => {
    for (const c of CAMPOS_LIMITE) {
      const ev = gold.evidencias.limites[c];
      expect(ev, c).toBeTruthy();
      expect(problemasEvidencia(ev!), c).toEqual([]);
    }
    expect(problemasEvidencia(gold.evidencias.consultas_abertas!)).toEqual([]);
  });
});

describe.skipIf(!disponivel)("textos derivados dos números", () => {
  it("P044: aviso da conferência pelo IPCA com a tolerância e o ato lidos da gold, não do código", () => {
    const t = avisoToleranciaIpca(gold)!;
    const tol = gold.limites_pld.conferencias_detalhe.find((c) => c.conferencia === "regra_ipca")!.tolerancia;
    expect(tol).toBe("R$ 0,011/MWh (dois arredondamentos a centavos)");
    expect(t).toContain(`aceita diferença de até ${tol}`);
    expect(t).toContain("art. 23, § 1º, da REN nº 1.032/2022, aparece só como conferência informativa");
    expect(avisoToleranciaIpca({ ...gold, limites_pld: { ...gold.limites_pld, conferencias_detalhe: [] } })).toBeNull();
  });

  it("P044: limites de 2026 com ato, publicação e vigência em campos distintos", () => {
    const t = respostaLimites(gold, 2026);
    expect(t).toContain("R$ 57,31/MWh");
    expect(t).toContain("R$ 1.611,04/MWh");
    expect(t).toContain("R$ 785,27/MWh");
    expect(t).toContain("Os três limites foram fixados pelo Despacho ANEEL nº 3.850/2025, com publicação no DOU em 23/12/2025");
    expect(t).toContain("vigência de 01/01/2026 a 31/12/2026");
    // 2022: cada campo com o seu ato
    const t22 = respostaLimites(gold, 2022);
    expect(t22).toContain("O piso foi fixado pela Resolução Homologatória ANEEL nº 2.994/2021, com publicação no DOU em 20/12/2021");
    expect(t22).toContain("o teto estrutural e o teto horário foram fixados pelo Despacho ANEEL nº 4.046/2021, com publicação no DOU em 17/12/2021");
    expect(respostaLimites(gold, 2021)).toContain("sem data de publicação no DOU conferida");
    expect(respostaLimites(gold, 2019)).toBe("Não há ato de limites do PLD integrado para 2019: os limites desse ano ficam sem valor.");
    const r = respostaP044(gold);
    expect(r.startsWith(`Em ${gold.data_referencia.split("-").reverse().join("/")}, o PLD não pode`)).toBe(true);
    expect(r).toContain("AR24-05, prevista para 2026");
  });

  it("textos sem travessão, sem hífen como pontuação e sem atribuir causa", () => {
    const d = gold.consultas.data_referencia;
    const textos = [
      respostaP044(gold),
      oQueMudouLimites(gold),
      ...linhasLimites(gold).map((l) => respostaLimites(gold, l.ano)),
      respostaProcedimentos(gold.procedimentos),
      respostaLinhaTempo(gold.linha_do_tempo.eventos, gold.linha_do_tempo.eventos.length),
      respostaConsultas(gold.consultas, d),
      respostaConsultas(gold.consultas, "2026-11-20"),
      respostaAgenda(gold.agenda, gold.limites_em_revisao),
      textoCoberturaFaixa(gold.consultas),
      avisoToleranciaIpca(gold) ?? "",
      textoConferenciaAcionamento(gold.bandeiras.conferencia_acionamento),
      nomeAgenda(gold.agenda),
      ...faixasConsultas(consultasNaData(gold.consultas.itens, d)).map((f) => f.leitura),
      ...faixasLinhaTempo(gold.linha_do_tempo.eventos).map((f) => f.leitura),
    ];
    for (const t of textos) {
      expect(t, t.slice(0, 60)).not.toMatch(SEM_TRAVESSAO);
      expect(t, t.slice(0, 60)).not.toMatch(CAUSAL);
      expect(t, t.slice(0, 60)).not.toMatch(/undefined|NaN|null/);
    }
  });

  it("P046: resposta na data de referência com a contagem e o prazo escritos na ata", () => {
    const t = respostaConsultas(gold.consultas, gold.consultas.data_referencia);
    const n = gold.resumo.consultas_abertas;
    expect(t).toContain(`${n} consultas e audiências públicas da ANEEL recebem contribuições`);
    expect(t).toContain(`entre as ${gold.consultas.itens.length} consultas com atividade nos últimos ${gold.consultas.janela_dias} dias`);
    // decisões da pauta de 29/09/2026 sem resultado formal: fora da contagem, ditas à parte
    expect(t).toContain(`Outras ${gold.consultas.decisoes_sem_resultado_formal!.length} decisões de abertura`);
  });

  it("P045: resposta com contagem por origem e o evento mais recente com publicação e vigência", () => {
    const ev = gold.linha_do_tempo.eventos;
    const t = respostaLinhaTempo(ev, ev.length);
    const atos = ev.filter((e) => e.origem === "curadoria").length;
    expect(t).toContain(`Os ${ev.length} eventos`);
    expect(t).toContain(`${atos} atos e leis lidos no texto`);
    expect(t).toContain(`"${ev[0].titulo}"`);
    expect(respostaLinhaTempo([], 26)).toBe("Nenhum dos 26 eventos da linha do tempo está no recorte escolhido.");
  });
});

describe.skipIf(!disponivel)("páginas renderizadas no servidor", () => {
  const paginas = { p044: PaginaLimites, p045: PaginaLinhaTempo, p046: PaginaConsultas } as const;
  const html = Object.fromEntries(Object.entries(paginas).map(([k, P]) => [k, renderToStaticMarkup(createElement(P))])) as Record<keyof typeof paginas, string>;
  const conteudo = (h: string) => h.slice(h.indexOf("<main"));
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escTexto = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // campos que a gold copia literalmente da fonte (ato, ata, portaria): podem trazer o travessão da própria fonte
  const literais = [
    ...gold.linha_do_tempo.eventos.flatMap((e) => [e.efeito_declarado, e.vigencia_regra, e.trecho, e.dispositivo]),
    ...gold.agenda.itens.map((i) => i.atividade),
    ...gold.limites_em_revisao.map((i) => i.atividade),
    ...gold.consultas.itens.flatMap((c) => [c.tema, c.deliberacao_abertura.decisao, c.resultado?.decisao]),
    ...gold.limites_pld.atos.flatMap((a) => [a.trecho, a.dispositivo, a.dou, ...a.observacoes]),
  ]
    .filter((x): x is string => !!x)
    .sort((a, b) => b.length - a.length);
  const semLiterais = (h: string) => {
    let t = h.replace(/<q>[\s\S]*?<\/q>/g, "");
    for (const l of literais) t = t.split(escTexto(l)).join("").split(esc(l)).join("");
    return t;
  };

  it("cada painel renderiza sem erro na sua página, com a anatomia da seção 7.2", () => {
    for (const id of ["p044", "p045", "p046"] as const) {
      const h = html[id];
      expect(h, id).toContain(`id="${id}"`);
      expect(h, id).toContain(`id="${id}-titulo"`);
      expect(h, id).toContain(esc(perguntaPainel(id)));
      expect(h, id).toContain(`data-resposta="${id}"`);
      for (const parte of ["Período", "Universo", "Unidade", "Como ler", "O que não permite concluir", "Como interpretar", "O que não é possível concluir", "Próxima pergunta", "Copiar link deste painel", "Baixar os dados deste painel"]) {
        expect(h, `${id}: ${parte}`).toContain(parte);
      }
      expect(h, id).toContain('role="radiogroup" aria-label="Nível de profundidade"');
      expect(h, id).toContain('data-nivel="analisar"');
      expect(h, id).toContain('data-nivel="auditar"');
      for (const p of PAINEIS_REGULACAO) expect(h, `${id} -> ${p.id}`).toContain(`href="${rotaPainel(p.id)}"`);
      expect(h, id).toMatch(new RegExp(`aria-current="page"[^>]*>${PAINEIS_REGULACAO.find((p) => p.id === id)!.rotulo}<`));
      expect(h, id).toContain(`href="${proximoPainel(id).rota}"`);
      expect(conteudo(h), id).not.toMatch(/em breve|em constru|em integra/i);
      // citações literais da fonte (<q> e os campos copiados do ato, da ata ou da portaria) ficam como estão; o texto do observatório não usa travessão
      expect(semLiterais(conteudo(h)), id).not.toMatch(/—|–/);
    }
  });

  it("P044: três KPIs com ficha de prova, tabela de vigências e os valores de cada ano no HTML", () => {
    const h = html.p044;
    expect((h.match(/Comprove este número/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(h).toContain("Tabela de vigências dos limites do PLD");
    expect(h).toContain("Publicação no DOU (piso)");
    expect(h).toContain("Vigência: início");
    for (const l of linhasLimites(gold)) for (const c of CAMPOS_LIMITE) if (l[c] !== null) expect(h, `${l.id} ${c}`).toContain(l[c]!.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
    expect(h).toContain(esc(respostaP044(gold)));
    // detalhe do ano padrão (o da data de referência) e a comparação de anos no modo Analisar
    expect(h).toContain(`data-detalhe-ano="${linhasLimites(gold).find((l) => l.inicio <= gold.data_referencia && gold.data_referencia <= l.fim)?.id}"`);
    expect(h).toContain("Comparar até quatro anos na mesma escala");
    expect((h.match(/<table/g) ?? []).length).toBeGreaterThanOrEqual(8);
  });

  it("P045: todos os eventos no recorte padrão, efeito declarado separado do impacto estimado", () => {
    const h = html.p045;
    for (const e of gold.linha_do_tempo.eventos) expect(h, e.id).toContain(`data-evento="${e.id}"`);
    expect(h).toContain('data-grafico="faixas-tempo"');
    expect(h).toContain("Efeito declarado pelo ato");
    expect((h.match(/não estimado pelo observatório/g) ?? []).length).toBe(gold.linha_do_tempo.eventos.length);
    expect(h).toContain("Eventos da linha do tempo no recorte (tabela equivalente)");
    expect(h).toContain(esc(respostaLinhaTempo(gold.linha_do_tempo.eventos, gold.linha_do_tempo.eventos.length)));
    expect((h.match(/<table/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("P046: KPI com ficha, situação recalculada na data do build e nenhuma vencida como aberta", () => {
    const h = html.p046;
    const hoje = hojeBrasilia();
    const data = hoje > gold.consultas.data_referencia ? hoje : gold.consultas.data_referencia;
    expect((h.match(/Comprove este número/g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect(h).toContain(esc(respostaConsultas(gold.consultas, data)));
    expect(h).toContain(`data-resposta-hoje="${data}"`);
    let conferidas = 0;
    for (const c of consultasNaData(gold.consultas.itens, data)) {
      const tag = new RegExp(`<g[^>]*data-faixa="${c.id}"[^>]*>`).exec(h)?.[0];
      if (!tag) continue;
      conferidas++;
      if (c.fim && c.fim < data) expect(tag, c.id).not.toMatch(/recebendo contribuições/);
      else if (c.situacao_na_data === "aberta") expect(tag, c.id).toMatch(/recebendo contribuições/);
    }
    // o padrão mostra todas as não decididas: o gráfico tem uma faixa por consulta não decidida
    expect(conferidas).toBe(consultasNaData(gold.consultas.itens, data).filter((c) => c.situacao_na_data !== "decidida").length);
    expect(h).toContain('id="agenda"');
    // o biênio vem dos anos previstos na portaria (Portaria nº 7.030/2025, art. 1º: "biênio 2026-2027"), não do código
    expect(nomeAgenda(gold.agenda)).toBe("Agenda Regulatória de 2026 e 2027");
    expect(h).toContain(`Atividades da ${nomeAgenda(gold.agenda)}`);
    expect(h).toContain(`Consultas e audiências desde ${anoInicioHistorico(gold)}, por situação`);
    expect(h).toContain("decisões de abertura ainda não têm resultado formal na ata");
    expect(h).toContain("https://www.gov.br/aneel/pt-br/acesso-a-informacao/participacao-social/consultas-publicas");
    expect((h.match(/<table/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it("todo link interno aponta para página existente, e toda âncora para um id que existe", () => {
    const rotaDe: Record<string, keyof typeof html> = Object.fromEntries(PAINEIS_REGULACAO.map((p) => [p.rota, p.id]));
    const existePagina = (rota: string) => {
      const dir = join(raiz, "src/app", rota);
      if (existsSync(join(dir, "page.tsx"))) return true;
      // rota dinâmica (ex.: /setor-eletrico/aprenda/[conceito]): a pasta-mãe tem um segmento entre colchetes com page.tsx
      const mae = join(dir, "..");
      return existsSync(mae) && readdirSync(mae).some((d) => d.startsWith("[") && existsSync(join(mae, d, "page.tsx")));
    };
    for (const [id, h] of Object.entries(html)) {
      const ids = new Set(Array.from(conteudo(h).matchAll(/\sid="([^"]+)"/g)).map((m) => m[1]));
      for (const m of Array.from(conteudo(h).matchAll(/href="([^"]+)"/g))) {
        const href = m[1].replace(/&amp;/g, "&");
        if (/^https?:/.test(href)) continue;
        const [caminho, ancora] = href.split("#");
        const rota = caminho.split("?")[0];
        if (!rota) {
          if (ancora) expect(ids.has(ancora), `${id}: ${href}`).toBe(true);
          continue;
        }
        if (rota.startsWith("/energia/")) {
          expect(existsSync(join(raiz, "public", rota)), `${id}: ${href}`).toBe(true);
          continue;
        }
        expect(existePagina(rota), `${id}: ${href}`).toBe(true);
        if (ancora && rotaDe[rota]) expect(html[rotaDe[rota]], `${id}: ${href}`).toContain(`id="${ancora}"`);
      }
    }
  });

  it("HTML de cada página abaixo de 520 KB antes das props (meta de cerca de 600 KB com elas; contrato, seção 5.1)", () => {
    for (const [id, h] of Object.entries(html)) expect(h.length, id).toBeLessThan(520_000);
  });

  it("gold ausente: estado de indisponibilidade com o motivo, sem número de reserva", () => {
    const h = renderToStaticMarkup(createElement(RegulacaoIndisponivel, { motivo: "gold reprovada na validação" }));
    expect(h).toContain("Regulação indisponível nesta publicação");
    expect(h).toContain("gold reprovada na validação");
    expect(h.slice(h.indexOf("<main"))).not.toMatch(/\d+,\d{2}/);
  });

  it("o destino Regulação está publicado e marcado como integrado (publica números)", () => {
    expect(DESTINOS_NAVEGACAO.find((d) => d.slug === "regulacao")?.publicado).toBe(true);
    expect(MODULOS_ENERGIA.find((m) => m.slug === "regulacao")?.integrado).toBe(true);
  });
});

describe("componentes do módulo", () => {
  const dir = join(raiz, "src/components/energia");
  const arquivos = [
    ...readdirSync(dir).filter((x) => x.startsWith("Regulacao")).map((f) => join(dir, f)),
    ...["", "/linha-do-tempo", "/consultas-e-agenda"].map((r) => join(raiz, `src/app/setor-eletrico/regulacao${r}/page.tsx`)),
  ];

  it("toda tabela das páginas guarda busca, filtros e ordem na URL (chaveUrl única por página)", () => {
    for (const f of arquivos) {
      const t = readFileSync(f, "utf-8");
      const blocos = t.split("<TabelaInterativa").slice(1).map((b) => b.slice(0, b.indexOf("/>")));
      const chaves = blocos.map((b) => /chaveUrl="([^"]+)"/.exec(b)?.[1] ?? null);
      expect(chaves.filter((c) => c === null).length, f).toBe(0);
      expect(new Set(chaves).size, f).toBe(chaves.length);
    }
  });

  it("sem hexadecimal solto", () => {
    for (const f of arquivos) {
      const t = readFileSync(f, "utf-8");
      expect(t, f).not.toMatch(/#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/);
      expect(t, f).not.toMatch(/["'`(\s]#[0-9a-fA-F]{3}["'`;\s)]/);
    }
  });

  it("módulos cliente só exportam componentes e tipos", () => {
    for (const f of readdirSync(dir).filter((x) => x.startsWith("Regulacao"))) {
      const t = readFileSync(join(dir, f), "utf-8");
      if (!t.startsWith('"use client"')) continue;
      for (const m of Array.from(t.matchAll(/^export (const|let|var) (\w+)/gm))) expect.fail(`${f} exporta valor ${m[2]}`);
    }
  });
});
