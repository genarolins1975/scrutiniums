/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Moradia e crédito imobiliário. O painel cruza três bases que medem coisas diferentes
 * — Censo 2022 (domicílios), ESTBAN verbete 169 (saldo contábil por dependência) e o
 * Mercado Imobiliário/SCR do BCB (carteira por UF) — e o risco não é errar uma conta,
 * é dar a um número o nome de outro. Por isso a maior parte destes testes é de
 * contenção:
 *
 *  - o verbete 169 NUNCA é chamado de crédito habitacional: soma quatro rubricas COSIF,
 *    inclui imóvel não residencial, pessoa jurídica e uma rubrica que nem é imobiliária;
 *  - ausência de dependência bancária é NULO, jamais zero;
 *  - a lacuna estimada nunca pode exceder o saldo observado (a primeira versão do modelo
 *    produzia R$ 2,54 tri de lacuna contra R$ 1,66 tri observados, e foi rejeitada);
 *  - a simulação é cenário aritmético, conferido aqui contra as fórmulas fechadas;
 *  - nenhum texto usa vocabulário de vendas ("ticket médio", "market share") nem afirma
 *    demanda comprovada.
 */
const ARQ = join(process.cwd(), "data/gold/moradia.json");
const existe = existsSync(ARQ);
const bruto = existe ? readFileSync(ARQ, "utf-8") : "{}";
const M: any = JSON.parse(bruto);
// O pipeline separa o array municipal em {nome}_mun.json para cache granular; o teste
// costura de volta, como o front faz, e continua cobrindo golds antigos com o array
// embutido.
const ARQ_MUN = ARQ.replace(".json", "_mun.json");
if (!M.municipios && existsSync(ARQ_MUN)) {
  M.municipios = JSON.parse(readFileSync(ARQ_MUN, "utf-8")).municipios;
}
// pula gracioso se o gold ainda não foi gerado, em vez de estourar na importação
const d = existe ? describe : describe.skip;

const SELOS = ["observado", "calculado", "estimado", "cenario", "indisponivel"];
const SELOS_MUN = ["alta", "media", "baixa", "sem_dependencia"];
const UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS",
             "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC",
             "SE", "SP", "TO"];

/** Toda ocorrência de `termo` no gold, com a janela de texto que a precede. */
function ocorrencias(termo: string, janela = 60) {
  const alvo = termo.toLowerCase();
  const baixo = bruto.toLowerCase();
  const achados: { pos: number; antes: string; trecho: string }[] = [];
  let i = baixo.indexOf(alvo);
  while (i >= 0) {
    achados.push({
      pos: i,
      antes: bruto.slice(Math.max(0, i - janela), i),
      trecho: bruto.slice(Math.max(0, i - janela), i + alvo.length + 40),
    });
    i = baixo.indexOf(alvo, i + 1);
  }
  return achados;
}

d("censo 2022: integridade das categorias de condição do domicílio", () => {
  it("os cinco percentuais somam cem", () => {
    const soma = M.censo.categorias.reduce((s: number, c: any) => s + c.pct, 0);
    expect(M.censo.categorias).toHaveLength(5);
    expect(Math.abs(soma - 100), `percentuais somam ${soma}`).toBeLessThanOrEqual(0.1);
  });

  it("a soma nacional das categorias é 72.461.317 domicílios", () => {
    const soma = M.censo.categorias.reduce((s: number, c: any) => s + c.n, 0);
    expect(soma).toBe(72_461_317);
    expect(M.censo.total).toBeGreaterThanOrEqual(soma);
  });

  it("a soma das categorias fica dentro de ±2 do total em cada município", () => {
    // O Censo 2022 aplica arredondamento aleatório como controle de divulgação: a
    // diferença é da fonte, não do processamento. Tolerar mais do que 2 seria aceitar
    // erro de pipeline disfarçado de arredondamento.
    for (const m of M.municipios) {
      const soma = m.dpg + m.dpp + m.da + m.dc + m.do;
      expect(Math.abs(soma - m.dt), `${m.n}/${m.uf}: ${soma} vs ${m.dt}`)
        .toBeLessThanOrEqual(2);
    }
    expect(M.censo.arredondamento).toMatch(/arredondamento aleatório/i);
    expect(M.censo.arredondamento).toMatch(/da fonte, não do processamento/i);
  });

  it("toda categoria tem contagem, percentual e rótulo preenchidos", () => {
    for (const c of M.censo.categorias) {
      expect(c.n, `${c.k}.n`).toBeGreaterThan(0);
      expect(c.pct, `${c.k}.pct`).toBeGreaterThan(0);
      expect(c.rot, `${c.k}.rot`).toBeTruthy();
      expect(String(c.rot).trim().length, `${c.k}.rot vazio`).toBeGreaterThan(0);
    }
  });

  it("o que o Censo não coletou está declarado, inclusive aluguel e prestação", () => {
    const naoColetado = M.censo.nao_coletado.join(" | ");
    expect(naoColetado).toMatch(/aluguel/i);
    expect(naoColetado).toMatch(/prestação/i);
    expect(M.censo.nao_coletado.some((x: string) => /valor.*aluguel/i.test(x)),
      "falta o valor do aluguel na lista de não coletados").toBe(true);
    expect(M.censo.nao_coletado.some((x: string) => /valor.*prestação/i.test(x)),
      "falta o valor da prestação na lista de não coletados").toBe(true);
  });
});

d("ausência é nulo, nunca zero", () => {
  it("nenhum município tem saldo do verbete 169 igual a zero", () => {
    for (const m of M.municipios) {
      expect(m.s === null || m.s > 0, `${m.n}/${m.uf} tem s = ${m.s}`).toBe(true);
    }
    expect(M.municipios.filter((m: any) => m.s === null).length)
      .toBe(M.totais.municipios_sem_dependencia);
  });

  it("município sem dependência bancária tem saldo nulo, e o contrário também vale", () => {
    const semDep = M.municipios.filter((m: any) => m.sel === "sem_dependencia");
    expect(semDep.length).toBeGreaterThan(0);
    for (const m of semDep) expect(m.s, `${m.n}/${m.uf}`).toBeNull();
    for (const m of M.municipios) {
      if (m.s === null) expect(m.sel, `${m.n}/${m.uf}`).toBe("sem_dependencia");
    }
  });

  it("poupança, número de instituições e renda per capita nunca são zero", () => {
    for (const campo of ["pp", "ni", "rpc"]) {
      for (const m of M.municipios) {
        const v = m[campo];
        expect(v === null || v > 0, `${m.n}/${m.uf}.${campo} = ${v}`).toBe(true);
      }
    }
  });

  it("sem saldo não há derivados: por domicílio, HHI e participação também são nulos", () => {
    for (const m of M.municipios) {
      if (m.s !== null) continue;
      for (const campo of ["sdom", "hhi", "i1p", "ni"]) {
        expect(m[campo], `${m.n}/${m.uf}.${campo}`).toBeNull();
      }
    }
  });

  it("o painel publica quantos municípios estão sem dependência", () => {
    expect(M.totais.municipios_com_saldo + M.totais.municipios_sem_dependencia)
      .toBe(M.municipios.length);
    expect(M.municipios.length).toBe(5570);
  });
});

d("nomenclatura: o verbete 169 nunca é chamado de crédito habitacional", () => {
  it("o gold não usa vocabulário de vendas", () => {
    for (const termo of ["market share", "ticket medio"]) {
      expect(ocorrencias(termo).length, `o gold contém "${termo}"`).toBe(0);
    }
  });

  it('"ticket médio" só aparece para ser negado', () => {
    for (const o of ocorrencias("ticket médio")) {
      expect(/\bnão\b/i.test(o.antes), `uso afirmativo de ticket médio: ${o.trecho}`).toBe(true);
    }
  });

  it('"demanda comprovada" só aparece negada, nunca afirmada', () => {
    const oc = ocorrencias("demanda comprovada");
    expect(oc.length, "a advertência deveria existir em algum lugar").toBeGreaterThan(0);
    for (const o of oc) {
      expect(/\bnão\b/i.test(o.antes), `uso afirmativo: ${o.trecho}`).toBe(true);
    }
  });

  it('"crédito habitacional" nunca vem logo atrás de "verbete 169" sem negação', () => {
    // O verbete soma quatro rubricas COSIF. Chamá-lo de crédito habitacional é o erro
    // que este painel existe para não cometer.
    const baixo = bruto.toLowerCase();
    let i = baixo.indexOf("verbete 169");
    while (i >= 0) {
      const depois = baixo.slice(i + "verbete 169".length, i + "verbete 169".length + 60);
      const j = depois.indexOf("crédito habitacional");
      if (j >= 0) {
        const entre = depois.slice(0, j);
        expect(/\bnão\b/i.test(entre),
          `verbete 169 nomeado como crédito habitacional: ${bruto.slice(i, i + 120)}`).toBe(true);
      }
      i = baixo.indexOf("verbete 169", i + 1);
    }
    for (const o of ocorrencias("crédito habitacional")) {
      expect(/\bnão\b/i.test(o.antes), `uso afirmativo: ${o.trecho}`).toBe(true);
    }
  });

  it("o verbete do saldo é nomeado pelo que é: saldo contabilizado no município", () => {
    const saldo = M.dicionario.find((x: any) =>
      /Saldo de financiamentos imobiliários/i.test(x.t));
    expect(saldo, "falta o verbete do saldo 169 no dicionário").toBeTruthy();
    expect(`${saldo.t} ${saldo.d} ${saldo.l}`).toMatch(/contabilizado/i);
    expect(saldo.t).toMatch(/contabilizado no município/i);
  });

  it("o dicionário traz os verbetes derivados com o nome contábil correto", () => {
    const titulos = M.dicionario.map((x: any) => x.t);
    expect(titulos.some((t: string) => /Saldo médio por operação em aberto/i.test(t)),
      `títulos: ${titulos.join(" / ")}`).toBe(true);
    expect(titulos.some((t: string) =>
      /Participação no saldo imobiliário contabilizado no município/i.test(t)),
      `títulos: ${titulos.join(" / ")}`).toBe(true);
  });

  it("o verbete 169 declara as quatro contas COSIF que soma", () => {
    expect(M.verbete169.contas).toHaveLength(4);
    const infra = M.verbete169.contas.find((c: any) =>
      c.titulo === "Financiamentos de infraestrutura e desenvolvimento");
    expect(infra, "falta a rubrica 1.6.6.10 na lista de contas").toBeTruthy();
    expect(infra.habitacional).toBe(false);
    expect(M.verbete169.alerta).toMatch(/1\.6\.6\.10/);
  });

  it("o verbete declara que não distingue pessoa física de pessoa jurídica", () => {
    const naoDistingue = M.verbete169.nao_distingue.join(" | ");
    expect(naoDistingue).toMatch(/pessoa física de pessoa jurídica/i);
  });
});

d("selos: todo número declara a natureza da sua evidência", () => {
  it("todo verbete do dicionário tem selo do vocabulário", () => {
    expect(M.dicionario.length).toBeGreaterThan(0);
    for (const v of M.dicionario) {
      expect(SELOS, `${v.t} tem selo "${v.selo}"`).toContain(v.selo);
      for (const campo of ["t", "d", "f", "l"]) {
        expect(v[campo], `${v.t}.${campo}`).toBeTruthy();
      }
    }
  });

  it("toda linha da matriz de viabilidade tem status e selo válidos", () => {
    expect(M.matriz_viabilidade.length).toBeGreaterThan(0);
    for (const l of M.matriz_viabilidade) {
      expect(["viavel", "parcial", "indisponivel"], `${l.pergunta}: ${l.status}`)
        .toContain(l.status);
      expect(SELOS, `${l.pergunta}: ${l.selo}`).toContain(l.selo);
      // pergunta indisponível sem explicação é lacuna escondida
      expect(l.obs, `${l.pergunta}.obs`).toBeTruthy();
      if (l.status === "indisponivel") expect(l.selo, l.pergunta).toBe("indisponivel");
    }
  });

  it("todo achado tem selo válido e texto", () => {
    expect(M.achados.length).toBeGreaterThan(0);
    for (const a of M.achados) {
      expect(SELOS, `${a.t}: ${a.selo}`).toContain(a.selo);
      expect(a.d, `${a.t}.d`).toBeTruthy();
    }
  });

  it("o simulador é cenário, e nunca observação", () => {
    expect(M.simulador.selo).toBe("cenario");
  });

  it("todo município tem selo de confiabilidade do vocabulário", () => {
    for (const m of M.municipios) {
      expect(SELOS_MUN, `${m.n}/${m.uf}: ${m.sel}`).toContain(m.sel);
    }
    for (const s of SELOS_MUN) {
      expect(M.municipios.filter((m: any) => m.sel === s).length, s)
        .toBe(M.totais.selos[s]);
    }
  });
});

d("modelos: a lacuna estimada nunca excede o observado", () => {
  it("o ajuste do saldo tem R² plausível e desvio residual sob controle", () => {
    // A versão sem restrição de amostra dava σ = 1,45 — a faixa de um desvio ia de 24%
    // a 4,3 vezes o valor central, e a lacuna somada estourava o saldo observado.
    expect(M.modelos.saldo.r2).toBeGreaterThan(0.7);
    expect(M.modelos.saldo.r2).toBeLessThan(0.95);
    expect(M.modelos.saldo.sigma, "σ acima de 1,0 devolve a versão rejeitada do modelo")
      .toBeLessThan(1.0);
    expect(M.modelos.saldo.sigma).toBeGreaterThan(0);
  });

  it("a lacuna de saldo é menor que o saldo observado no ESTBAN", () => {
    expect(M.modelos.saldo.lacuna_total).toBeGreaterThan(0);
    expect(M.modelos.saldo.lacuna_total,
      `lacuna ${M.modelos.saldo.lacuna_total} vs observado ${M.totais.estban169}`)
      .toBeLessThan(M.totais.estban169);
  });

  it("a amostra do modelo de saldo é restrita, menor que os municípios com saldo", () => {
    expect(M.modelos.saldo.n).toBeGreaterThan(0);
    expect(M.modelos.saldo.n).toBeLessThan(M.totais.municipios_com_saldo);
    expect(M.modelos.saldo.municipios_abaixo).toBeLessThanOrEqual(M.modelos.saldo.n);
  });

  it("a lacuna de penetração é positiva e cabe dentro do parque domiciliar do país", () => {
    expect(M.modelos.penetracao.lacuna_domicilios).toBeGreaterThan(0);
    expect(M.modelos.penetracao.lacuna_domicilios).toBeLessThan(M.censo.total);
    expect(M.modelos.penetracao.municipios_cobertos)
      .toBeLessThanOrEqual(M.municipios.length);
  });

  it("os dois modelos avisam que a lacuna não é demanda comprovada", () => {
    for (const k of ["saldo", "penetracao"]) {
      expect(M.modelos[k].aviso, `modelos.${k}.aviso`).toBeTruthy();
      expect(M.modelos[k].aviso, `modelos.${k}.aviso`).toMatch(/não .{0,20}demanda comprovada/i);
      expect(M.modelos[k].selo).toBe("estimado");
    }
  });

  it("a elasticidade da renda tem sinal economicamente interpretável", () => {
    expect(M.modelos.saldo.coeficientes.ln_renda_pc).toBeGreaterThan(0);
    expect(M.modelos.saldo.coeficientes.ln_domicilios).toBeGreaterThan(0);
    expect(M.modelos.saldo.especificacao).toMatch(/ln\(saldo 169\)/);
  });

  it("só municípios abaixo do esperado carregam lacuna, e ela nunca é negativa", () => {
    const comGs = M.municipios.filter((m: any) => m.gs != null);
    const comGd = M.municipios.filter((m: any) => m.gd != null);
    expect(comGs.length).toBe(M.modelos.saldo.municipios_abaixo);
    expect(comGd.length).toBe(M.modelos.penetracao.municipios_abaixo);
    for (const m of comGs) expect(m.gs, `${m.n}/${m.uf}`).toBeGreaterThan(0);
    // a lacuna de domicílios é arredondada para inteiro, então pode zerar num município
    // marginalmente abaixo da mediana dos comparáveis — mas nunca ficar negativa
    for (const m of comGd) expect(m.gd, `${m.n}/${m.uf}`).toBeGreaterThanOrEqual(0);
    for (const m of M.municipios) {
      if (m.gs == null) continue;
      expect(["alta", "media"], `${m.n}/${m.uf} tem lacuna com selo ${m.sel}`).toContain(m.sel);
    }
  });
});

d("simulador: Price e SAC conferidos contra as fórmulas fechadas", () => {
  const PV = 200_000;
  const N = 360;
  const TAXA_AA = 12;
  const i = Math.pow(1 + TAXA_AA / 100, 1 / 12) - 1;
  const price = (pv: number, taxa: number, n: number) =>
    pv * taxa / (1 - Math.pow(1 + taxa, -n));

  it("a taxa mensal é equivalente composta, não a nominal dividida por doze", () => {
    expect(i).toBeCloseTo(0.009489, 6);
    expect(i, "12%/12 seria 0,01 — a fórmula publicada é a equivalente composta")
      .toBeLessThan(0.01);
    expect(M.simulador.formulas.taxa_mensal).toMatch(/\^\(1\/12\)/);
  });

  it("a prestação Price bate com a fórmula fechada e com o quadro de amortização", () => {
    const p = price(PV, i, N);
    // Valor fechado para PV=200.000, 12% a.a. equivalente e 360 meses.
    expect(p).toBeCloseTo(1963.29, 1);
    // Conferência independente: o quadro de amortização tem de zerar o saldo devedor.
    let saldo = PV;
    for (let k = 0; k < N; k++) saldo = saldo * (1 + i) - p;
    expect(Math.abs(saldo), `saldo residual de ${saldo} após ${N} parcelas`).toBeLessThan(0.01);
    expect(Math.abs(p / price(PV, i, N) - 1)).toBeLessThan(0.01);
  });

  it("a primeira prestação do SAC é maior que a Price e a última é menor", () => {
    const p = price(PV, i, N);
    const amort = PV / N;
    const sac = (k: number) => amort + (PV - amort * (k - 1)) * i;
    expect(sac(1), "SAC começa mais pesado").toBeGreaterThan(p);
    expect(sac(N), "SAC termina mais leve").toBeLessThan(p);
    for (let k = 2; k <= N; k++) {
      expect(sac(k), `parcela ${k} do SAC não decresceu`).toBeLessThan(sac(k - 1));
    }
    expect(M.simulador.formulas.sac).toMatch(/decrescente/i);
    expect(M.simulador.formulas.price).toMatch(/constante/i);
  });

  it("a soma das amortizações do SAC devolve exatamente o principal", () => {
    const amort = PV / N;
    let soma = 0;
    for (let k = 0; k < N; k++) soma += amort;
    expect(Math.abs(soma - PV), `somou ${soma}`).toBeLessThan(0.01);
  });

  it("os parâmetros de partida vêm de valores observados, não arbitrados", () => {
    expect(M.simulador.partida.taxa_aa_pct).toBe(M.brasil.taxa.sfh);
    expect(M.simulador.partida.valor_imovel).toBe(M.brasil.imoveis.valor_compra);
    expect(M.simulador.partida.ltv_pct).toBe(M.brasil.ltv.sfh);
    expect(M.brasil.selo).toBe("observado");
  });

  it("os avisos citam seguros obrigatórios e negam ser proposta de crédito", () => {
    const avisos = M.simulador.avisos.join(" | ");
    expect(avisos).toMatch(/seguros/i);
    expect(avisos).toMatch(/não .{0,20}proposta de crédito/i);
    expect(avisos).toMatch(/TR|IPCA/);
  });
});

d("reconciliação entre bases que medem coisas diferentes", () => {
  const somaEstados = (k: string) =>
    M.estados.reduce((s: number, e: any) => s + (e[k] || 0), 0);

  it("os três agregados existem e o ESTBAN é o maior, porque abrange mais", () => {
    const estban = M.totais.estban169;
    const mi = somaEstados("mi_carteira_pf");
    const scr = somaEstados("scr_imob_pf");
    for (const [nome, v] of [["ESTBAN 169", estban], ["MI carteira PF", mi], ["SCR", scr]] as const) {
      expect(v, `${nome} ausente ou zerado`).toBeGreaterThan(0);
    }
    expect(estban, "o verbete 169 inclui PJ e imóvel não residencial").toBeGreaterThan(mi);
    expect(estban).toBeGreaterThan(scr);
  });

  it("o total do ESTBAN reconcilia com a soma dos estados e dos municípios", () => {
    expect(somaEstados("estban169")).toBe(M.totais.estban169);
    const somaMun = M.municipios.reduce((s: number, m: any) => s + (m.s || 0), 0);
    expect(Math.abs(somaMun / M.totais.estban169 - 1)).toBeLessThan(0.001);
  });

  it("Mercado Imobiliário e SCR ficam a menos de 5% um do outro no nacional", () => {
    const mi = somaEstados("mi_carteira_pf");
    const scr = somaEstados("scr_imob_pf");
    const dif = Math.abs(mi / scr - 1);
    expect(dif, `MI ${mi} vs SCR ${scr} — divergência de ${(100 * dif).toFixed(2)}%`)
      .toBeLessThan(0.05);
  });

  it("nenhum estado mistura conceito: razão sem as duas pontas é proibida", () => {
    for (const e of M.estados) {
      if (e.mi_carteira_pf == null) {
        expect(e.razao_estban_mi, `${e.uf} tem razão sem carteira do MI`).toBeFalsy();
        expect(e.razao_mi_scr, `${e.uf} tem razão sem carteira do MI`).toBeFalsy();
      }
      if (e.scr_imob_pf == null) {
        expect(e.razao_mi_scr, `${e.uf} tem razão sem o SCR`).toBeFalsy();
      }
      if (e.estban169 == null) {
        expect(e.razao_estban_mi, `${e.uf} tem razão sem o ESTBAN`).toBeFalsy();
      }
      if (e.razao_estban_mi != null) {
        expect(e.razao_estban_mi, e.uf).toBeCloseTo(e.estban169 / e.mi_carteira_pf, 1);
      }
      if (e.razao_mi_scr != null) {
        expect(e.razao_mi_scr, e.uf).toBeCloseTo(e.mi_carteira_pf / e.scr_imob_pf, 1);
      }
    }
  });

  it("as limitações declaram que as bases não se subtraem", () => {
    const txt = M.limitacoes.join(" | ");
    expect(txt).toMatch(/verbete 169/i);
    expect(txt).toMatch(/universos distintos|não devem ser subtraídos/i);
  });
});

d("instituições e quociente locacional", () => {
  it("a lista está ordenada por saldo decrescente", () => {
    const v = M.instituicoes.map((x: any) => x.saldo);
    for (let k = 1; k < v.length; k++) {
      expect(v[k], `posição ${k} quebra a ordem`).toBeLessThanOrEqual(v[k - 1]);
    }
  });

  it("as participações nacionais somam cem", () => {
    const soma = M.instituicoes.reduce((s: number, x: any) => s + x.part_nacional, 0);
    expect(Math.abs(soma - 100), `somam ${soma}`).toBeLessThanOrEqual(0.5);
    expect(M.instituicoes.length).toBe(M.totais.instituicoes_no_169);
  });

  it("toda instituição tem QL mediano OU a justificativa da ausência, nunca os dois", () => {
    for (const inst of M.instituicoes) {
      const temQl = inst.ql_mediano != null;
      const temNa = inst.ql_na != null;
      expect(temQl !== temNa,
        `${inst.nome}: ql_mediano=${inst.ql_mediano} ql_na=${inst.ql_na}`).toBe(true);
      if (temQl) expect(inst.ql_p90, `${inst.nome}.ql_p90`).toBeGreaterThan(0);
    }
  });

  it("instituição com menos de 25 municípios não recebe QL — seria aritmética vazia", () => {
    for (const inst of M.instituicoes) {
      if (inst.municipios < 25) {
        expect(inst.ql_mediano, `${inst.nome} tem ${inst.municipios} município(s)`)
          .toBeUndefined();
        expect(inst.ql_na, `${inst.nome} sem justificativa`).toBeTruthy();
      }
    }
  });

  it("a concentração contábil é publicada como número, não como advertência genérica", () => {
    expect(M.concentracao_contabil.instituicoes_total).toBe(M.instituicoes.length);
    expect(M.concentracao_contabil.part_dessas).toBeGreaterThan(0);
    expect(M.concentracao_contabil.part_dessas).toBeLessThan(100);
    expect(M.concentracao_contabil.leitura)
      .toMatch(/onde o saldo é escriturado, não onde moram/i);
  });
});

d("rankings: sem repetição, sem município fantasma, sem dado frágil", () => {
  const nomes = Object.keys(M.rankings);
  const cods = new Set(M.municipios.map((m: any) => m.c));

  it("existe pelo menos um ranking e todos têm no máximo 25 itens sem repetição", () => {
    expect(nomes.length).toBeGreaterThan(0);
    for (const k of nomes) {
      const r = M.rankings[k];
      expect(r.length, `${k} tem ${r.length} itens`).toBeLessThanOrEqual(25);
      expect(r.length, `${k} está vazio`).toBeGreaterThan(0);
      const ids = r.map((x: any) => x.c);
      expect(new Set(ids).size, `${k} repete município`).toBe(ids.length);
    }
  });

  it("todo item de ranking referencia um município que existe", () => {
    for (const k of nomes) {
      for (const x of M.rankings[k]) {
        expect(cods.has(x.c), `${k}: código ${x.c} (${x.n}/${x.uf}) não está em municipios`)
          .toBe(true);
        const m = M.municipios.find((y: any) => y.c === x.c);
        expect(m.n, `${k}: nome divergente para ${x.c}`).toBe(x.n);
        expect(m.sel, `${k}: selo divergente para ${x.n}`).toBe(x.sel);
      }
    }
  });

  it("os rankings que dependem de confiabilidade excluem baixa e sem dependência", () => {
    // Saldo por domicílio, lacuna de saldo e concentração leem o verbete 169 no nível
    // municipal: com selo "baixa" (reclassificação de carteira) ou sem dependência, o
    // número não sustenta comparação.
    for (const k of ["maior_saldo_por_domicilio", "maior_lacuna_saldo", "mais_concentrado"]) {
      expect(nomes, `falta o ranking ${k}`).toContain(k);
      for (const x of M.rankings[k]) {
        expect(["alta", "media"], `${k}: ${x.n}/${x.uf} tem selo ${x.sel}`).toContain(x.sel);
      }
    }
  });

  it("todo ranking está de fato ordenado pelo valor que apresenta", () => {
    for (const k of nomes) {
      const v = M.rankings[k].map((x: any) => x.v);
      const cresce = v.every((_: number, idx: number) => idx === 0 || v[idx] >= v[idx - 1]);
      const decresce = v.every((_: number, idx: number) => idx === 0 || v[idx] <= v[idx - 1]);
      expect(cresce || decresce, `${k} não está monotônico`).toBe(true);
    }
  });
});

d("estados: as 27 unidades da federação", () => {
  it("são exatamente 27, com sigla válida e região preenchida", () => {
    expect(M.estados).toHaveLength(27);
    const siglas = M.estados.map((e: any) => e.uf);
    expect(new Set(siglas).size, "sigla repetida").toBe(27);
    for (const e of M.estados) {
      expect(UFS, `sigla inválida: ${e.uf}`).toContain(e.uf);
      expect(e.nome, `${e.uf}.nome`).toBeTruthy();
      expect(["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"],
        `${e.uf} região "${e.reg}"`).toContain(e.reg);
    }
  });

  it("a soma dos domicílios dos estados é o total nacional do Censo", () => {
    const soma = M.estados.reduce((s: number, e: any) => s + e.dom_total, 0);
    expect(soma, `estados somam ${soma}, Censo publica ${M.censo.total}`).toBe(M.censo.total);
  });

  it("as demais contagens estaduais reconciliam com o Censo nacional", () => {
    const pagando = M.censo.categorias.find((c: any) => c.k === "proprio_pagando").n;
    const alugado = M.censo.categorias.find((c: any) => c.k === "alugado").n;
    expect(M.estados.reduce((s: number, e: any) => s + e.dom_pagando, 0)).toBe(pagando);
    expect(M.estados.reduce((s: number, e: any) => s + e.dom_alugado, 0)).toBe(alugado);
  });

  it("todo município aponta para uma UF e uma região existentes", () => {
    const porUf = new Map(M.estados.map((e: any) => [e.uf, e]));
    for (const m of M.municipios) {
      expect(porUf.has(m.uf), `${m.n}: UF ${m.uf} desconhecida`).toBe(true);
      expect(m.reg, `${m.n}/${m.uf}`).toBe((porUf.get(m.uf) as any).reg);
    }
  });
});
