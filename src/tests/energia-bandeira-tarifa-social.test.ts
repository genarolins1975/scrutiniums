import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BandeiraDoMes } from "@/components/energia/BandeiraDoMes";
import { TarifaSocialRegraVigente } from "@/components/energia/InclusaoTextos";
import ContaDeLuzPage from "@/app/setor-eletrico/conta-de-luz/page";
import TarifaSocialPage from "@/app/setor-eletrico/inclusao-energetica/tarifa-social/page";
import {
  bandeiraUsada,
  fonteBandeira,
  fraseBandeira,
  mesCorrenteBrasilia,
  rotuloBandeira,
  situacaoBandeira,
} from "@/lib/energia/bandeira-do-mes";
import { textosRegraTarifaSocial } from "@/lib/energia/inclusao";
import type { BandeiraVigente, ContaGold } from "@/lib/energia/tipos-conta";
import type { InclusaoGold, TarifaSocial } from "@/lib/energia/tipos-inclusao";

/**
 * Banca de 19/10/2026 (Onda 2, Q2): "Energia: bandeira do mês corrente e Tarifa Social com referência posterior à regra vigente. Gold com
 * o mês corrente; se a fonte não publicou, ausência declarada."
 */

const RAIZ = join(__dirname, "..", "..");
const lerJson = <T,>(rel: string): T | null => {
  const p = join(RAIZ, rel);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf-8")) as T) : null;
};
const conta = lerJson<ContaGold>("public/energia/gold/conta.json");
const inclusao = lerJson<InclusaoGold>("public/energia/gold/inclusao.json");

/**
 * Os campos novos (situação da bandeira e regra da Tarifa Social) nascem com a versão do pipeline de 19/10/2026. A gold publicada antes
 * disso não os tem, e a publicação noturna do Setor Elétrico estava retida desde 30/09/2026: refazer só a Conta de luz e a Inclusão
 * deixaria a inicial e a Visão geral com outra data para os mesmos números. Gold gerada a partir desta versão tem de trazer os campos;
 * gold anterior a ela é conferida pelo ramo "gold antiga" dos testes de componente acima.
 */
const VERSAO_DOS_CAMPOS = "2026-10-19";
const geradaComOsCampos = (g: { gerado_em?: string } | null) => !!g?.gerado_em && g.gerado_em.slice(0, 10) >= VERSAO_DOS_CAMPOS;

it("gold anterior à versão dos campos novos não os inventa, e gold posterior não pode faltar com eles", () => {
  if (conta?.disponivel) {
    const v = conta.simulador.bandeira_vigente;
    expect(v?.mes_referencia !== undefined, `conta.json gerado em ${conta.gerado_em}`).toBe(geradaComOsCampos(conta));
  }
  if (inclusao?.disponivel) {
    expect(inclusao.tarifa_social.regra_vigente !== undefined, `inclusao.json gerado em ${inclusao.gerado_em}`).toBe(geradaComOsCampos(inclusao));
  }
});

const OUTUBRO: BandeiraVigente = {
  mes: "2026-10",
  bandeira: "Verde",
  rs_mwh: 0,
  aviso: null,
  mes_referencia: "2026-10",
  situacao: "mes_corrente",
  anunciadas: [],
  recentes: [
    { mes: "2026-08", bandeira: "Amarela", rs_mwh: 18.85 },
    { mes: "2026-09", bandeira: "Amarela", rs_mwh: 18.85 },
    { mes: "2026-10", bandeira: "Verde", rs_mwh: 0 },
  ],
  fonte_publicada_em: "2026-10-10T04:00:43Z",
  fonte_capturada_em: "2026-10-16T02:03:28Z",
  fonte_url: "https://dadosabertos.aneel.gov.br/dataset/bandeiras-tarifarias",
};

afterEach(() => {
  vi.useRealTimers();
});

describe("bandeira do mês corrente", () => {
  it("mês corrente presente: é a vigente, com mês, cor e acréscimo", () => {
    const s = situacaoBandeira(OUTUBRO, "2026-10");
    expect(s.estado).toBe("corrente");
    expect(bandeiraUsada(s)).toEqual({ mes: "2026-10", bandeira: "Verde", rs_mwh: 0 });
    expect(fraseBandeira(s, "pt")).toBe("A bandeira de out/2026, o mês corrente, é verde: sem acréscimo.");
    expect(fraseBandeira(s, "en")).toBe("The tariff flag for Oct 2026, the current month, is green: no surcharge.");
    expect(rotuloBandeira(s, "pt")).toBe("out/2026, mês corrente (verde)");
  });

  it("mês corrente ausente: declarado, com a última registrada e o mês dela, sem repetir o anterior como vigente", () => {
    const s = situacaoBandeira(OUTUBRO, "2026-11");
    expect(s.estado).toBe("mes_ausente");
    expect(bandeiraUsada(s)?.mes).toBe("2026-10");
    expect(fraseBandeira(s, "pt")).toBe("A bandeira de nov/2026 não está no arquivo da ANEEL lido pelo observatório; a última registrada é a de out/2026 (verde).");
    expect(fraseBandeira(s, "en")).toBe("The tariff flag for Nov 2026 is not in the ANEEL file read by the observatory; the latest recorded is the one for Oct 2026 (green).");
    expect(rotuloBandeira(s, "pt")).not.toContain("corrente (");
    expect(fraseBandeira(s, "pt")).not.toMatch(/vigente/);
  });

  it("gold que lida depois do mês dela: a escolha usa o mês de quem lê sobre os meses recentes", () => {
    // gold gerada em setembro, com outubro já publicado entre os recentes (anunciado no fim de setembro)
    const setembro: BandeiraVigente = { ...OUTUBRO, mes: "2026-09", bandeira: "Amarela", rs_mwh: 18.85, mes_referencia: "2026-09", anunciadas: [OUTUBRO.recentes![2]] };
    expect(situacaoBandeira(setembro, "2026-09").estado).toBe("corrente");
    expect(situacaoBandeira(setembro, "2026-09").anunciada?.mes).toBe("2026-10");
    expect(fraseBandeira(situacaoBandeira(setembro, "2026-09"), "pt")).toContain("A ANEEL já publicou a de out/2026: verde.");
    const lidaEmOutubro = situacaoBandeira(setembro, "2026-10");
    expect(lidaEmOutubro.estado).toBe("corrente");
    expect(bandeiraUsada(lidaEmOutubro)?.bandeira).toBe("Verde");
  });

  it("gold antiga sem os campos novos e gold sem acionamento", () => {
    const antiga: BandeiraVigente = { mes: "2026-09", bandeira: "Amarela", rs_mwh: 18.85, aviso: null };
    expect(situacaoBandeira(antiga, "2026-10").estado).toBe("mes_ausente");
    expect(situacaoBandeira(null, "2026-10").estado).toBe("sem_dado");
    expect(bandeiraUsada(situacaoBandeira(null, "2026-10"))).toBeNull();
    expect(fonteBandeira(antiga, "pt")).toBe("Fonte: ANEEL, Bandeiras Tarifárias, recurso Acionamento.");
    expect(fonteBandeira(OUTUBRO, "pt")).toBe(
      "Fonte: ANEEL, Bandeiras Tarifárias, recurso Acionamento (arquivo atualizado pela fonte em 10/10/2026; lido pelo observatório em 16/10/2026).",
    );
  });

  it("mês corrente em Brasília, não em UTC", () => {
    expect(mesCorrenteBrasilia(new Date("2026-11-01T02:30:00Z"))).toBe("2026-10");
    expect(mesCorrenteBrasilia(new Date("2026-11-01T03:30:00Z"))).toBe("2026-11");
  });

  it("componente: HTML estático com o mês da geração, estado e mês marcados", () => {
    const ausente = renderToStaticMarkup(createElement(BandeiraDoMes, { vigente: OUTUBRO, mesInicial: "2026-11", forma: "frase" }));
    expect(ausente).toContain('data-bandeira-estado="mes_ausente"');
    expect(ausente).toContain("A bandeira de nov/2026 não está no arquivo da ANEEL lido pelo observatório; a última registrada é a de out/2026 (verde).");
    expect(ausente).toContain("Fonte: ANEEL, Bandeiras Tarifárias");
    const corrente = renderToStaticMarkup(createElement(BandeiraDoMes, { vigente: OUTUBRO, mesInicial: "2026-10", forma: "rotulo" }));
    expect(corrente).toContain('data-bandeira-estado="corrente"');
    expect(corrente).toContain("out/2026, mês corrente (verde)");
  });
});

describe.skipIf(!conta?.disponivel || !geradaComOsCampos(conta))("bandeira na gold e na página da Conta de luz", () => {
  it("a gold traz a situação do mês de referência, os meses recentes e a fonte com data", () => {
    const v = conta!.simulador.bandeira_vigente!;
    expect(v.mes_referencia).toBe(conta!.data_referencia.slice(0, 7));
    expect(v.situacao).toBe(v.mes === v.mes_referencia ? "mes_corrente" : "mes_ausente");
    expect(v.aviso === null).toBe(v.situacao === "mes_corrente");
    expect(v.recentes?.at(-1)?.mes).toBe(conta!.bandeiras.acionamento.at(-1)?.m);
    expect(v.fonte_publicada_em).toMatch(/^\d{4}-\d{2}-\d{2}/);
    // o mês vigente nunca é posterior ao de referência
    expect(v.mes <= v.mes_referencia!).toBe(true);
  });

  it("página lida no mês da gold: a bandeira do mês corrente aparece como vigente no cabeçalho e no simulador", () => {
    const v = conta!.simulador.bandeira_vigente!;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${v.mes}-15T15:00:00Z`));
    const html = renderToStaticMarkup(createElement(ContaDeLuzPage));
    expect(html).toContain('data-bandeira-estado="corrente"');
    expect(html).not.toContain('data-bandeira-estado="mes_ausente"');
  });

  it("página lida no mês seguinte sem bandeira publicada: a ausência é declarada, sem chamar a anterior de vigente", () => {
    const v = conta!.simulador.bandeira_vigente!;
    const [a, m] = v.mes.split("-").map(Number);
    const seguinte = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
    if (v.recentes?.some((x) => x.mes === seguinte) || v.anunciadas?.some((x) => x.mes === seguinte)) return; // mês seguinte já anunciado
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${seguinte}-15T15:00:00Z`));
    const html = renderToStaticMarkup(createElement(ContaDeLuzPage));
    expect(html).toContain('data-bandeira-estado="mes_ausente"');
    expect(html).not.toContain('data-bandeira-estado="corrente"');
    expect(html).toContain("não está no arquivo da ANEEL lido pelo observatório; a última registrada é a de");
  });
});

describe("Tarifa Social: regra vigente e períodos", () => {
  const base = (): TarifaSocial =>
    ({
      mes_referencia: "2025-05",
      cde_meses: [
        { mes: "2025-06", completo: true, original_no_bronze: true, faturas_tsee: 17622377 },
        { mes: "2025-07", completo: true, original_no_bronze: true, faturas_tsee: 16621035 },
      ],
      regra_vigente: {
        rotulo: "Gratuidade até 80 kWh por mês",
        descricao: "",
        ato: "Medida Provisória nº 1.300, de 21 de maio de 2025",
        ato_curto: "MPV nº 1.300/2025",
        ato_data: "2025-05-21",
        vigencia: "2025-07-05",
        vigencia_texto: "faturas emitidas a partir de 5 de julho de 2025",
        lei: "Lei nº 15.235, de 8 de outubro de 2025",
        lei_data: "2025-10-08",
        lei_url: "https://www2.camara.leg.br/",
        fonte: "https://www.gov.br/aneel/pt-br/assuntos/tarifas/tarifa-social",
        regra_anterior: "",
        conferencia: [
          { norma: "lei_15235_2025", titulo: null, estado: "CONFERIDA", conferido_em: "2026-10-02T04:43:59Z", url: null },
          { norma: "aneel_tarifa_social", titulo: null, estado: "CONFERIDA", conferido_em: "2026-10-16T02:04:53Z", url: null },
        ],
        mes_transicao: "2025-07",
        primeiro_mes_inteiro: "2025-08",
      },
      periodos_da_regra: {
        antes: { fonte: "SCS", unidade: "UC", mes: "2025-05", uc_tsee: 17246524, dmr_reais: 542423514.83 },
        antes_cde: null,
        transicao: { mes: "2025-07", no_arquivo: true, nota: "" },
        depois: null,
        mes_referencia_pos_regra: null,
        motivo_sem_depois: "",
      },
    }) as unknown as TarifaSocial;

  it("rótulo da regra com ato normativo, data do ato e início da vigência", () => {
    const x = textosRegraTarifaSocial(base(), "pt")!;
    expect(x.regra).toContain("Regra vigente: gratuidade até 80 kWh por mês");
    expect(x.regra).toContain("faturas emitidas a partir de 05/07/2025");
    expect(x.regra).toContain("Medida Provisória nº 1.300, de 21/05/2025");
    expect(x.regra).toContain("Lei nº 15.235, de 08/10/2025");
    expect(x.anterior).toContain("Antes de 05/07/2025, os descontos eram progressivos");
    expect(x.conferencia).toContain("02/10/2026 e 16/10/2026");
    expect(x.transicao).toBe("jul/2025 mistura faturas emitidas antes e depois de 05/07/2025 e fica fora dos dois lados.");
    const en = textosRegraTarifaSocial(base(), "en")!;
    expect(en.regra).toContain("Provisional Measure No. 1,300 of May 21, 2025");
    expect(en.regra).not.toContain("Medida Provisória");
  });

  it("sem mês posterior à regra: ausência declarada com o mês do dado mais recente, sem estimativa", () => {
    const x = textosRegraTarifaSocial(base(), "pt")!;
    expect(x.depoisAusente).toBe(true);
    expect(x.antes).toContain("17.246.524 unidades consumidoras com Tarifa Social em mai/2025");
    expect(x.depois).toBe(
      "Nenhuma fonte oficial lida publicou mês completo posterior à regra de 05/07/2025: o dado mais recente é de jul/2025, anterior ao primeiro mês inteiro sob ela (ago/2025). Nada é estimado para os meses seguintes.",
    );
    const html = renderToStaticMarkup(createElement(TarifaSocialRegraVigente, { t: base() }));
    expect(html).toContain('data-pos-regra="ausente"');
    expect(html).toContain('data-ausente="sim"');
  });

  it("com mês posterior: o lado depois traz fonte, unidade e mês", () => {
    const t = base();
    t.periodos_da_regra!.depois = {
      fonte: "Beneficiários da CDE",
      unidade: "faturas",
      mes: "2026-03",
      recurso: null,
      distribuidoras: 103,
      faturas_tsee: 17155135,
      desconto_faturas_reais: 787959101.55,
      desconto_medio_por_fatura_reais: 45.93,
      meses_completos_depois: ["2026-03"],
    };
    t.periodos_da_regra!.mes_referencia_pos_regra = "2026-03";
    const x = textosRegraTarifaSocial(t, "pt")!;
    expect(x.depoisAusente).toBe(false);
    expect(x.depois).toContain("17.155.135 faturas com desconto em mar/2026");
    expect(x.depois).toMatch(/R\$\s45,93 por fatura/);
    const html = renderToStaticMarkup(createElement(TarifaSocialRegraVigente, { t }));
    expect(html).toContain('data-pos-regra="2026-03"');
    expect(html).toContain("Depois da regra (desde 05/07/2025)");
  });

  it("gold sem os campos da regra: nada é afirmado", () => {
    const t = base();
    delete t.regra_vigente;
    expect(textosRegraTarifaSocial(t, "pt")).toBeNull();
    expect(renderToStaticMarkup(createElement(TarifaSocialRegraVigente, { t }))).toBe("");
  });
});

describe.skipIf(!inclusao?.disponivel || !geradaComOsCampos(inclusao))("Tarifa Social na gold e na página", () => {
  it("a gold tem a regra vigente e a referência posterior a ela (ou a ausência declarada)", () => {
    const ts = inclusao!.tarifa_social;
    const r = ts.regra_vigente!;
    const p = ts.periodos_da_regra!;
    expect(r.vigencia).toBe("2025-07-05");
    expect(r.ato_data).toBe("2025-05-21");
    if (p.depois) {
      expect(p.depois.mes >= r.primeiro_mes_inteiro).toBe(true);
      expect(p.mes_referencia_pos_regra).toBe(p.depois.mes);
      expect(p.motivo_sem_depois).toBeNull();
    } else {
      expect(p.motivo_sem_depois).toContain("Nenhuma fonte oficial lida tem mês completo posterior à regra");
    }
    if (p.antes) expect(p.antes.mes < r.vigencia.slice(0, 7)).toBe(true);
  });

  it("a página mostra a regra com ato e data e separa antes e depois", () => {
    const html = renderToStaticMarkup(createElement(TarifaSocialPage));
    expect(html).toContain("data-regra-tarifa-social");
    expect(html).toContain("Regra vigente: gratuidade até 80 kWh por mês");
    expect(html).toContain("Medida Provisória nº 1.300, de 21/05/2025");
    expect(html).toContain("Antes da regra (até 05/07/2025)");
    expect(html).toContain("Depois da regra (desde 05/07/2025)");
    expect(html).toContain(`antes da regra de 05/07/2025: o SCS não tem mês completo depois dela`);
  });
});
