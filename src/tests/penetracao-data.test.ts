/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Penetração e gap de crédito municipal. Os testes que mais importam são de contenção:
 *
 *  - nenhum saldo municipal pode vir do SCR, nem ser rebatizado de SCR;
 *  - município sem dependência bancária tem saldo NULO, jamais zero;
 *  - o gap usa a MEDIANA condicional, não a média — senão a maioria fica "abaixo do
 *    esperado" por construção e o gap mede a assimetria da distribuição;
 *  - a especificação do modelo não pode voltar a ter colinearidade renda×população;
 *  - nenhum texto do painel afirma quantas pessoas estão sem crédito.
 */
const G = "public/obs/data/gold/";
const P = JSON.parse(readFileSync(join(process.cwd(), G + "penetracao.json"), "utf-8"));
// O array municipal vive em penetracao_mun.json desde a separação por cache granular;
// o teste costura como o front costura. O `bruto` das checagens de nomenclatura passa a
// concatenar os dois arquivos, para que a varredura textual continue cobrindo tudo.
const brutoMun = readFileSync(join(process.cwd(), G + "penetracao_mun.json"), "utf-8");
if (!P.municipios) P.municipios = JSON.parse(brutoMun).municipios;
const bruto = readFileSync(join(process.cwd(), G + "penetracao.json"), "utf-8") + brutoMun;
const malha = JSON.parse(readFileSync(join(process.cwd(), G + "penetracao_malha.json"), "utf-8"));
const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");
const coletor = readFileSync(join(process.cwd(), "pipeline/sources/estban.py"), "utf-8");
const gold = readFileSync(join(process.cwd(), "pipeline/penetracao.py"), "utf-8");

const pagina = (() => {
  const i = app.indexOf("function renderPenetracao(");
  return app.slice(i, app.indexOf("\nfunction penSelo(", i));
})();

describe("o SCR não é desagregado nem rebatizado", () => {
  it("a fonte do crédito é declarada como ESTBAN", () => {
    expect(P.fontes.credito).toMatch(/ESTBAN/);
    expect(P.fontes.credito).toMatch(/verbete 160/i);
    expect(P.fontes.credito).not.toMatch(/\bSCR\b/);
  });

  it("nenhum município carrega campo de saldo do SCR", () => {
    for (const m of P.municipios.slice(0, 200)) {
      for (const k of Object.keys(m)) expect(k.toLowerCase(), `${m.nome}.${k}`).not.toContain("scr");
    }
  });

  it("o SCR aparece apenas como reconciliação estadual", () => {
    expect(P.reconciliacao_scr).toBeTruthy();
    expect(gold.replace(/\s+/g, " ")).toMatch(/nenhum número do ESTBAN é rebatizado de SCR/i);
  });

  it("a página declara a diferença de geografia entre as fontes", () => {
    expect(pagina).toMatch(/Não permite observação municipal na base pública/);
    expect(pagina).toMatch(/nenhum número do ESTBAN é rebatizado de SCR/i);
  });
});

describe("ausência de dependência bancária não é crédito zero", () => {
  it("município fora do ESTBAN tem crédito nulo, nunca zero", () => {
    const fora = P.municipios.filter((m: any) => !m.no_estban);
    expect(fora.length).toBe(P.cobertura.sem_saldo_estban);
    expect(fora.length).toBeGreaterThan(0);
    for (const m of fora) {
      expect(m.credito, m.nome).toBeNull();
      expect(m.penetracao, m.nome).toBeNull();
      expect(m.cred_adulto, m.nome).toBeNull();
    }
  });

  it("a contagem e a advertência estão publicadas", () => {
    expect(P.cobertura.sem_saldo_estban).toBeGreaterThan(1000);
    expect(P.cobertura.adultos_sem_estban).toBeGreaterThan(0);
    const txt = JSON.stringify(P.achados);
    expect(txt).toMatch(/não é crédito zero/i);
  });

  it("municípios sem saldo ficam fora dos rankings de gap", () => {
    for (const nome of Object.keys(P.rankings)) {
      for (const m of P.rankings[nome]) expect(m.no_estban, `${nome}/${m.nome}`).toBe(true);
    }
  });
});

describe("o gap usa a mediana condicional, não a média", () => {
  it("o modelo publica a referência e explica a escolha", () => {
    expect(P.modelo.referencia).toMatch(/MEDIANA condicional/);
    expect(P.modelo.referencia).toMatch(/metade dos/i);
    expect(P.modelo.nota).toMatch(/por construção/i);
    expect(gold).toMatch(/mediana condicional/i);
  });

  it("a média condicional é publicada ao lado, e é maior que a mediana", () => {
    const com = P.municipios.filter((m: any) => m.modelo_esperado && m.modelo_media);
    expect(com.length).toBeGreaterThan(1000);
    for (const m of com.slice(0, 300)) {
      expect(m.modelo_media, m.nome).toBeGreaterThan(m.modelo_esperado);
    }
  });

  it("a proporção abaixo do esperado fica perto de metade — não é positiva por construção", () => {
    const elegiveis = P.municipios.filter((m: any) =>
      m.credito != null && m.confianca !== "baixa" &&
      m.adultos >= P.cobertura.min_adultos && m.renda_anual >= P.cobertura.min_renda_anual);
    const abaixo = elegiveis.filter((m: any) => (m.gap_abs_modelo || 0) > 0);
    const prop = abaixo.length / elegiveis.length;
    expect(prop).toBeGreaterThan(0.3);
    expect(prop).toBeLessThan(0.7);
  });

  it("gap absoluto nunca é negativo e o relativo é coerente com ele", () => {
    for (const m of P.municipios) {
      if (m.gap_abs_modelo != null) expect(m.gap_abs_modelo, m.nome).toBeGreaterThanOrEqual(0);
      if (m.gap_abs_modelo > 0 && m.gap_rel_modelo != null) {
        expect(m.gap_rel_modelo, m.nome).toBeGreaterThan(0);
      }
    }
  });
});

describe("modelo: especificação sem colinearidade e diagnóstico publicado", () => {
  it("renda total e população adulta não entram juntas", () => {
    const coef = Object.keys(P.modelo.coeficientes);
    expect(coef).toContain("ln_adultos");
    expect(coef).toContain("ln_renda_pc");
    expect(coef).not.toContain("ln_renda");
    expect(P.modelo.por_que_assim).toMatch(/0,957|0\.957/);
    expect(P.modelo.por_que_assim).toMatch(/negativa/i);
  });

  it("todos os coeficientes de escala e prosperidade são positivos", () => {
    expect(P.modelo.coeficientes.ln_adultos).toBeGreaterThan(0);
    expect(P.modelo.coeficientes.ln_renda_pc).toBeGreaterThan(0);
    expect(P.modelo.coeficientes.urb).toBeGreaterThan(0);
  });

  it("o diagnóstico do ajuste está publicado, inclusive o desvio residual", () => {
    expect(P.modelo.n).toBeGreaterThan(1000);
    expect(P.modelo.r2).toBeGreaterThan(0.5);
    expect(P.modelo.r2).toBeLessThan(1);
    expect(P.modelo.sigma_residual).toBeGreaterThan(0);
    expect(P.modelo.especificacao).toMatch(/ln\(crédito\)/);
  });

  it("a página avisa que a precisão individual é baixa", () => {
    expect(pagina).toMatch(/precisão individual é baixa/i);
    expect(pagina).toMatch(/faixa de referência/i);
  });

  it("todo município com esperado tem faixa de referência", () => {
    const com = P.municipios.filter((m: any) => m.modelo_esperado);
    for (const m of com.slice(0, 200)) {
      expect(m.modelo_faixa, m.nome).toHaveLength(2);
      expect(m.modelo_faixa[0]).toBeLessThan(m.modelo_esperado);
      expect(m.modelo_faixa[1]).toBeGreaterThan(m.modelo_esperado);
    }
  });
});

describe("benchmark de pares: mediana do grupo, com mínimo de observações", () => {
  it("o critério e o mínimo estão declarados", () => {
    expect(P.benchmark_pares.estatistica).toMatch(/mediana/i);
    expect(P.benchmark_pares.minimo_grupo).toBeGreaterThanOrEqual(5);
    expect(P.benchmark_pares.criterio).toMatch(/região/);
    expect(P.benchmark_pares.criterio).toMatch(/urbanização/);
  });

  it("grupo pequeno demais não gera benchmark", () => {
    for (const m of P.municipios) {
      if (m.pares_penetracao != null) {
        expect(m.pares_n, m.nome).toBeGreaterThanOrEqual(P.benchmark_pares.minimo_grupo);
      }
    }
  });

  it("os dois métodos convivem e a página deixa alternar", () => {
    expect(pagina).toContain("gap_abs_pares");
    expect(pagina).toMatch(/benchmark de pares/i);
    expect(pagina).toMatch(/penFiltra\('metodo'/);
  });
});

describe("conciliação de códigos IBGE", () => {
  it("o casamento é por UF e nome, com lista explícita de exceções", () => {
    expect(coletor).toContain("ALIAS");
    expect(coletor).toMatch(/CODMUN não é o código do IBGE/i);
    expect(coletor).toMatch(/nunca é aproximado por semelhança/i);
  });

  it("as regiões administrativas do DF são somadas em Brasília", () => {
    expect(coletor).toMatch(/uf == "DF" and nome\.startswith\("BRASILIA"\)/);
    const df = P.municipios.filter((m: any) => m.uf === "DF");
    expect(df.length, "o DF tem um único município no IBGE").toBe(1);
    expect(df[0].nome).toBe("Brasília");
    expect(df[0].credito).toBeGreaterThan(0);
  });

  it("todo município tem código IBGE de sete dígitos", () => {
    for (const m of P.municipios.slice(0, 500)) expect(m.cod).toMatch(/^\d{7}$/);
    expect(P.municipios.length).toBeGreaterThan(5500);
  });

  it("a malha usa os mesmos códigos e cobre o país", () => {
    expect(malha.municipios).toBeGreaterThan(5500);
    const codsMalha = new Set(Object.keys(malha.paths));
    const semGeometria = P.municipios.filter((m: any) => !codsMalha.has(m.cod));
    expect(semGeometria.length / P.municipios.length).toBeLessThan(0.01);
    expect(malha.viewBox).toBeTruthy();
  });
});

describe("coerência dos indicadores", () => {
  it("penetração, crédito por adulto e meses de renda batem com as definições", () => {
    for (const m of P.municipios.filter((x: any) => x.credito).slice(0, 300)) {
      expect(m.penetracao).toBeCloseTo(100 * m.credito / m.renda_anual, 2);
      expect(m.cred_adulto).toBeCloseTo(m.credito / m.adultos, 0);
      expect(m.meses_renda).toBeCloseTo(12 * m.credito / m.renda_anual, 1);
    }
  });

  it("a razão é sempre apresentada sobre renda ANUAL ou em meses — nunca crua", () => {
    expect(gold).toMatch(/% da renda anual/);
    expect(gold).toMatch(/meses equivalentes/);
    expect(pagina).toMatch(/sobre renda anual/i);
    expect(pagina).toMatch(/meses de renda/i);
  });

  it("o total de crédito reconcilia com a soma dos municípios", () => {
    const soma = P.municipios.reduce((s: number, m: any) => s + (m.credito || 0), 0);
    expect(Math.abs(soma / P.totais.credito - 1)).toBeLessThan(0.001);
  });

  it("selo de confiabilidade em todo município, com motivo", () => {
    for (const m of P.municipios.slice(0, 400)) {
      expect(["alta", "media", "baixa"], m.nome).toContain(m.confianca);
    }
    const baixa = P.municipios.filter((m: any) => m.confianca === "baixa");
    expect(baixa.length).toBeGreaterThan(0);
  });
});

describe("rankings: separados, com cortes e sem", () => {
  it("existem os sete rankings pedidos, mais as versões sem corte", () => {
    for (const k of ["gap_absoluto", "gap_relativo", "menor_credito_adulto", "menor_penetracao",
                     "oportunidade_escala", "maior_penetracao", "mais_atipicos"]) {
      expect(Object.keys(P.rankings), k).toContain(k);
      expect(P.rankings[k].length).toBeGreaterThan(0);
    }
    expect(P.rankings.gap_absoluto_sem_corte.length).toBeGreaterThan(0);
  });

  it("os cortes mínimos são respeitados e declarados", () => {
    for (const m of P.rankings.oportunidade_escala) {
      expect(m.adultos).toBeGreaterThanOrEqual(P.cobertura.min_adultos);
      expect(m.renda_anual).toBeGreaterThanOrEqual(P.cobertura.min_renda_anual);
      expect(m.confianca).not.toBe("baixa");
    }
    expect(pagina).toMatch(/sem os cortes mínimos/i);
  });

  it("gap absoluto está de fato em ordem decrescente", () => {
    const v = P.rankings.gap_absoluto.map((m: any) => m.gap_abs_modelo);
    for (let i = 1; i < v.length; i++) expect(v[i]).toBeLessThanOrEqual(v[i - 1]);
  });
});

describe("vocabulário: nada de causalidade nem de gente sem crédito", () => {
  it("o gold não afirma número de pessoas sem acesso a crédito", () => {
    expect(bruto).not.toMatch(/pessoas sem crédito/i);
    expect(bruto).not.toMatch(/sem acesso a crédito.{0,40}\d/i);
    expect(pagina).toMatch(/não publica esse número/i);
  });

  it("nenhum achado usa linguagem causal ou de dinheiro que falta", () => {
    for (const a of P.achados) {
      expect(a.texto).not.toMatch(/abandona|faltam R\$|falta de crédito|bancos deixaram/i);
      expect(a.filtro, a.texto).toBeTruthy();
      expect(a.periodo, a.texto).toBeTruthy();
      expect(a.universo, a.texto).toBeTruthy();
      expect(a.ressalva, a.texto).toBeTruthy();
      expect(["observado", "calculado", "estimado", "contextual"], a.texto).toContain(a.selo);
    }
  });

  it("o gap é declarado contrafactual em todo lugar que importa", () => {
    expect(gold).toMatch(/contrafactual/i);
    expect(gold).toMatch(/não é demanda comprovada/i);
    expect(pagina).toMatch(/não é demanda comprovada|contrafactual/i);
  });

  it("a página lista o que os dados não autorizam concluir", () => {
    expect(pagina).toMatch(/Baixa penetração não prova restrição de oferta/);
    expect(pagina).toMatch(/contabilizado/);
    expect(pagina).toMatch(/centros regionais/i);
  });
});

describe("escala do mapa: percentis, sem distorcer o dado exportado", () => {
  it("a escala é por percentis e a winsorização é declarada como visual", () => {
    expect(app).toMatch(/function penEscala/);
    expect(app).toMatch(/Winsorização é só visual/i);
    expect(pagina).toMatch(/percentil 5 e o 95/);
    expect(pagina).toMatch(/o dado exportado é o bruto/i);
  });
});

describe("série histórica: data-base subcoletada fora, reclassificação sinalizada", () => {
  it("2025-03 não entra na série publicada, e o motivo está declarado", () => {
    expect(P.data_base_excluida.data).toBe("2025-03");
    expect(P.eixo_serie).not.toContain("2025-03");
    expect(P.data_base_excluida.motivo).toMatch(/subcoletada/i);
    expect(P.data_base_excluida.motivo).toMatch(/não é comparável/i);
  });

  it("a série tem o mesmo comprimento do eixo, e mês ausente é nulo, nunca zero", () => {
    const com = P.municipios.filter((m: any) => m.serie);
    expect(com.length).toBeGreaterThan(2000);
    for (const m of com.slice(0, 400)) {
      expect(m.serie.length, m.nome).toBe(P.eixo_serie.length);
      for (const v of m.serie) expect(v === null || v > 0, `${m.nome} tem zero na série`).toBe(true);
    }
  });

  it("salto mensal acima de 50% rebaixa a confiabilidade", () => {
    const inst = P.municipios.filter((m: any) => m.serie_instavel);
    expect(inst.length).toBeGreaterThan(0);
    for (const m of inst) {
      expect(m.maior_salto_mensal, m.nome).toBeGreaterThan(50);
      expect(m.confianca, m.nome).toBe("baixa");
    }
  });

  it("Brasília é pega pelo critério — o caso conhecido de reclassificação", () => {
    const bsb = P.municipios.find((m: any) => m.cod === "5300108");
    expect(bsb.serie_instavel).toBe(true);
    expect(bsb.confianca).toBe("baixa");
    expect(bsb.confianca_motivo).toMatch(/reclassificação/i);
  });

  it("a página avisa sobre série instável e sobre a data-base excluída", () => {
    expect(pagina).toMatch(/Série instável/);
    expect(pagina).toMatch(/reclassificação de carteira entre dependências/i);
    expect(pagina).toContain("P.data_base_excluida");
  });

  it("a composição por instituição soma o crédito do município", () => {
    const com = P.municipios.filter((m: any) => m.instituicoes_top && m.credito);
    expect(com.length).toBeGreaterThan(500);
    for (const m of com.slice(0, 150)) {
      const soma = m.instituicoes_top.reduce((s: number, i: any) => s + i.part, 0);
      expect(soma, m.nome).toBeGreaterThan(0);
      expect(soma, m.nome).toBeLessThanOrEqual(100.5);
    }
  });
});

describe("reconciliação estadual com o SCR", () => {
  it("está disponível e alinhada por data-base", () => {
    const R = P.reconciliacao_scr;
    expect(R.disponivel).toBe(true);
    expect(R.data_base_estban).toBe(P.data_base_credito);
    expect(R.data_base_scr).toMatch(/^\d{4}-\d{2}$/);
    if (!R.mesmo_mes) expect(R.aviso_data).toBeTruthy();
  });

  it("cobre as 27 UFs e a razão é coerente com os totais", () => {
    const R = P.reconciliacao_scr;
    expect(R.linhas.length).toBe(27);
    expect(R.razao_br).toBeCloseTo(R.total_estban / R.total_scr, 2);
    for (const l of R.linhas) {
      expect(l.razao, l.uf).toBeCloseTo(l.estban / l.scr, 2);
      expect(l.estban, l.uf).toBeGreaterThan(0);
      expect(l.scr, l.uf).toBeGreaterThan(0);
    }
  });

  it("é apresentada como diferença de conceito, não como controle de qualidade", () => {
    expect(P.reconciliacao_scr.nota).toMatch(/não é erro de medição/i);
    expect(P.reconciliacao_scr.nota).toMatch(/conceitos diferentes/i);
    expect(P.reconciliacao_scr.nota).toMatch(/contabilizado/);
  });

  it("o DF aparece com razão alta — a centralização medida em nível estadual", () => {
    const df = P.reconciliacao_scr.linhas.find((l: any) => l.uf === "DF");
    expect(df.razao).toBeGreaterThan(2);
  });
});
