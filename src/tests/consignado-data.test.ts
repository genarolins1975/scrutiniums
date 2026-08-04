/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Consignado, previdência e envelhecimento. O módulo cruza três bases em três geografias
 * diferentes — Censo 2022 (município), Estatísticas Municipais da Previdência (município
 * do órgão pagador), SGS (nacional) e SCR.data (unidade da federação) — e o risco central
 * não é errar uma conta: é publicar como associação observada um resultado que a própria
 * fórmula de alocação produziu. Daí o peso dos testes de contenção:
 *
 *  - não existe carteira municipal pública de consignado. O `cons` municipal é o saldo
 *    estadual repartido por uma chave previdenciária, e a correlação entre ele e a
 *    dependência de benefícios é MECÂNICA. As duas correlações — a observada, estadual, e
 *    a mecânica, municipal — são publicadas lado a lado e têm de continuar diferentes;
 *  - a correlação observada é NEGATIVA (≈ −0,72). O teste existe para que ninguém
 *    "conserte" o sinal por achá-lo contraintuitivo;
 *  - ausência é nulo, jamais zero;
 *  - município reprovado no teste de coerência contra o teto do Censo não recebe
 *    classificação de saturação nem entra em ranking estimado;
 *  - a soma municipal reconcilia com o Boletim Estatístico de dezembro de 2025, e o único
 *    resíduo tolerado é o município que existe na Previdência e não no universo do Censo.
 */
const ARQ = join(process.cwd(), "data/gold/consignado.json");
const existe = existsSync(ARQ);
const bruto = existe ? readFileSync(ARQ, "utf-8") : "{}";
const C: any = JSON.parse(bruto);
// pula gracioso se o gold ainda não foi gerado, em vez de estourar na importação
const d = existe ? describe : describe.skip;

const SELOS = ["observado", "calculado", "estimado", "cenario", "hipotese", "indisponivel"];
const SELOS_MUN = ["alta", "media", "baixa", "sem_dado"];
const TIPOS_EVENTO = ["margem", "teto", "prazo", "fraude", "sancao"];
const UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS",
             "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC",
             "SE", "SP", "TO"];

/**
 * Boletim Estatístico da Previdência Social, dezembro de 2025 — a fonte oficial contra a
 * qual a base municipal é reconciliada. Ver docs/AUDITORIA_CONSIGNADO.md, seção 5.2.
 */
const BOLETIM = {
  aposentadorias: 24_144_902,
  pensoes: 8_514_458,
  auxilios: 2_079_494,
  outros: 434_217,
  total_previdenciario: 35_173_071,
  assistenciais: 6_468_870,
  total: 41_641_941,
};

/**
 * Resíduo estrutural da reconciliação. A planilha da Previdência de 2025 traz um município
 * do Mato Grosso que não existe no universo de 5.570 municípios do Censo 2022, base
 * geográfica de todo o módulo. Os 346 benefícios dele ficam de fora da soma municipal e não
 * podem ser inventados em outro lugar. O número é fixado aqui exatamente para que qualquer
 * outra perda — silenciosa, de coletor — apareça como falha em vez de virar "arredondamento".
 */
const FORA_DO_CENSO = {
  aposentadorias: 224,
  pensoes: 59,
  auxilios: 17,
  assistenciais: 39,
  total_previdenciario: 307,
  total: 346,
};

const M: any[] = C.municipios ?? [];
const soma = (k: string) => M.reduce((s: number, m: any) => s + (m[k] || 0), 0);

/** Toda ocorrência de `termo` no gold, com a janela de texto que a precede. */
function ocorrencias(termo: string, janela = 80) {
  const alvo = termo.toLowerCase();
  const baixo = bruto.toLowerCase();
  const achados: { pos: number; antes: string; trecho: string }[] = [];
  let i = baixo.indexOf(alvo);
  while (i >= 0) {
    achados.push({
      pos: i,
      antes: bruto.slice(Math.max(0, i - janela), i),
      trecho: bruto.slice(Math.max(0, i - janela), i + alvo.length + 60),
    });
    i = baixo.indexOf(alvo, i + 1);
  }
  return achados;
}

/** Toda prosa publicada no gold: strings longas o bastante para afirmar alguma coisa. */
function prosa(o: any = C, saida: string[] = []): string[] {
  if (typeof o === "string") {
    if (o.length >= 40) saida.push(o);
  } else if (Array.isArray(o)) {
    for (const v of o) prosa(v, saida);
  } else if (o && typeof o === "object") {
    for (const v of Object.values(o)) prosa(v, saida);
  }
  return saida;
}

d("reconciliação com o Boletim Estatístico de dezembro de 2025", () => {
  it("o gold foi gerado com sucesso e traz os 5.570 municípios do Censo 2022", () => {
    expect(C.ok, "o build do módulo não concluiu").toBe(true);
    expect(M).toHaveLength(5570);
    expect(C.totais.municipios).toBe(5570);
    expect(C.ano).toBe(2025);
  });

  it("a soma municipal reproduz o agregado nacional publicado, sem tolerância", () => {
    // Se estes quatro divergirem em uma unidade, o agregado do painel deixou de ser a
    // soma do que a página mostra no mapa — que é o defeito mais difícil de perceber.
    for (const [campo, agregado] of [
      ["ben", "beneficios"], ["apo", "aposentadorias"],
      ["pen", "pensoes"], ["ass", "assistenciais"],
    ] as const) {
      expect(soma(campo), `municípios somam ${soma(campo)} em ${campo}`)
        .toBe(C.brasil[agregado]);
    }
    expect(soma("vdez")).toBe(C.brasil.valor_dez);
  });

  it("previdenciários mais assistenciais fecham o total, município a município", () => {
    for (const m of M) {
      const parcelas = (m.ben_prev || 0) + (m.ass || 0);
      expect(parcelas, `${m.n}/${m.uf}: ${parcelas} vs ben ${m.ben}`).toBe(m.ben || 0);
    }
    expect(soma("ben_prev") + soma("ass")).toBe(soma("ben"));
  });

  it("a distância para o Boletim é exatamente a do município fora do universo do Censo", () => {
    // Tolerância zero em quantidade: a diferença admitida é nominada, não estatística.
    for (const [campo, oficial, fora] of [
      ["apo", BOLETIM.aposentadorias, FORA_DO_CENSO.aposentadorias],
      ["pen", BOLETIM.pensoes, FORA_DO_CENSO.pensoes],
      ["ass", BOLETIM.assistenciais, FORA_DO_CENSO.assistenciais],
      ["ben", BOLETIM.total, FORA_DO_CENSO.total],
      ["ben_prev", BOLETIM.total_previdenciario, FORA_DO_CENSO.total_previdenciario],
      ["aux", BOLETIM.auxilios, FORA_DO_CENSO.auxilios],
    ] as const) {
      const s = soma(campo);
      expect(oficial - s,
        `${campo}: gold ${s}, Boletim ${oficial}, lacuna ${oficial - s} (esperada ${fora})`)
        .toBe(fora);
    }
    expect(FORA_DO_CENSO.aposentadorias + FORA_DO_CENSO.pensoes + FORA_DO_CENSO.auxilios
      + FORA_DO_CENSO.assistenciais, "a lacuna deve caber inteira no total")
      .toBeLessThanOrEqual(FORA_DO_CENSO.total);
    expect(BOLETIM.total_previdenciario + BOLETIM.assistenciais).toBe(BOLETIM.total);
  });

  it("nenhum município é contado duas vezes e todo código tem sete dígitos", () => {
    const cods = M.map((m: any) => m.c);
    expect(new Set(cods).size, "código de município repetido").toBe(cods.length);
    for (const m of M) {
      expect(/^\d{7}$/.test(m.c), `${m.n}/${m.uf}: código "${m.c}"`).toBe(true);
      expect(m.n, `${m.c} sem nome`).toBeTruthy();
    }
  });
});

d("ausência é nulo, nunca zero", () => {
  it("benefícios, valor, consignado e reclamações são positivos ou nulos", () => {
    for (const campo of ["ben", "vdez", "cons", "rec"]) {
      const zerados = M.filter((m: any) => m[campo] === 0);
      expect(zerados.length,
        `${campo} = 0 em ${zerados.slice(0, 3).map((m: any) => `${m.n}/${m.uf}`).join(", ")}`)
        .toBe(0);
      for (const m of M) {
        const v = m[campo];
        expect(v == null || v > 0, `${m.n}/${m.uf}.${campo} = ${v}`).toBe(true);
      }
    }
  });

  it("as demais contagens da Previdência seguem a mesma regra", () => {
    for (const campo of ["apo", "pen", "aux", "ass", "ben_prev", "vano", "vmed", "dom"]) {
      for (const m of M) {
        const v = m[campo];
        expect(v == null || v > 0, `${m.n}/${m.uf}.${campo} = ${v}`).toBe(true);
      }
    }
  });

  it("município sem reclamação registrada fica sem o campo, não com contagem zero", () => {
    const com = M.filter((m: any) => m.rec != null);
    expect(com.length, "nenhum município com reclamação").toBeGreaterThan(0);
    expect(com.length, "a contagem de municípios do bloco de reclamações diverge")
      .toBe(C.reclamacoes.municipios);
    for (const m of M) {
      if (m.rec == null) {
        expect(m.rec_100k60, `${m.n}/${m.uf} tem taxa sem contagem`).toBeUndefined();
      }
    }
  });
});

d("anticircularidade: a correlação mecânica nunca vira evidência", () => {
  it("as quatro especificações existem, e a de referência é única", () => {
    const es = C.circularidade.especificacoes;
    expect(es, "faltam as especificações").toHaveLength(4);
    for (const e of es) {
      expect(e.r, `especificação ${e.id} sem correlação`).toBeTypeOf("number");
      expect(e.n, `especificação ${e.id} com poucas UFs`).toBe(27);
      expect(e.obs, `especificação ${e.id} sem justificativa`).toBeTruthy();
    }
    const ref = es.filter((e: any) => e.referencia);
    expect(ref, "tem de haver exatamente uma especificação de referência").toHaveLength(1);
    expect(ref[0].id, "a referência é a que não compartilha termo entre os lados")
      .toBe("independente");
    expect(C.circularidade.referencia, "o campo de referência tem de espelhar a especificação")
      .toBe(ref[0].r);
  });

  it("a especificação com termo compartilhado é MAIS forte que a independente", () => {
    // Este é o teste que registra o erro corrigido. A montagem que compartilha a
    // quantidade de benefícios entre numerador de um lado e denominador do outro produz
    // correlação inflada por aritmética. Se um dia as duas convergirem, alguma coisa
    // mudou na construção e precisa ser reexaminada.
    const por = Object.fromEntries(
      C.circularidade.especificacoes.map((e: any) => [e.id, e.r]));
    expect(Math.abs(por.compartilhada),
      "a compartilhada deveria ser mais forte — era o sintoma do termo comum")
      .toBeGreaterThan(Math.abs(por.independente));
    expect(Math.abs(por.compartilhada) - Math.abs(por.independente),
      "a diferença entre as duas montagens sumiu").toBeGreaterThan(0.1);
  });

  it("a direção é negativa em todas as especificações e sob todos os controles", () => {
    // O sinal é robusto; a magnitude não. O teste trava a direção e deixa a magnitude
    // livre dentro de uma faixa plausível, para que ninguém inverta o sinal por conforto
    // narrativo nem volte a publicar o -0,72 como se fosse a medida limpa.
    for (const e of C.circularidade.especificacoes) {
      expect(e.r, `especificação ${e.id} deveria ser negativa`).toBeLessThan(0);
      expect(e.r, `especificação ${e.id} com magnitude implausível`).toBeGreaterThan(-1);
    }
    for (const c of C.circularidade.controles) {
      expect(c.parcial_referencia, `controle ${c.variavel} deveria manter o sinal`)
        .toBeLessThan(0);
    }
    expect(C.circularidade.referencia,
      "a referência não pode voltar ao patamar da especificação compartilhada")
      .toBeGreaterThan(-0.6);
  });

  it("a correlação mecânica existe e difere da de referência", () => {
    const mec = C.circularidade.correlacao_mecanica;
    expect(mec, "falta a correlação mecânica").toBeTypeOf("number");
    expect(Math.abs(mec - C.circularidade.referencia),
      "mecânica e referência praticamente coincidem").toBeGreaterThan(0.01);
  });

  it("o mecanismo é declarado como não estabelecido, com os candidatos rejeitados", () => {
    const m = C.circularidade.mecanismo;
    expect(m.estabelecido, "a página não pode afirmar mecanismo").toBe(false);
    expect(m.testados.length, "os candidatos testados têm de ficar publicados")
      .toBeGreaterThanOrEqual(4);
    for (const t of m.testados) {
      expect(t.com_consignado_por_60, `${t.variavel} sem correlação`).toBeTypeOf("number");
      expect(t.leitura, `${t.variavel} sem leitura`).toBeTruthy();
    }
    // O candidato dos assistenciais falha com sinal OPOSTO ao previsto. Registrar isso
    // impede que alguém o reintroduza como explicação.
    const assist = m.testados.find((t: any) => /assistenciais/i.test(t.variavel));
    expect(assist.com_consignado_por_60,
      "a participação de assistenciais tem sinal contrário à hipótese").toBeGreaterThan(0);
  });

  it("as 27 unidades da federação entram no teste observado", () => {
    expect(C.circularidade.n_uf, "o teste observado tem de usar todas as UFs").toBe(27);
    expect(C.estados).toHaveLength(C.circularidade.n_uf);
  });

  it("a explicação nomeia a correlação municipal de mecânica", () => {
    expect(C.circularidade.explicacao).toMatch(/mecânica/i);
    expect(C.circularidade.explicacao).toMatch(/aloca[çc]ão/i);
    expect(C.circularidade.explicacao,
      "a explicação precisa dizer que a mecânica mede a fórmula, não o mundo")
      .toMatch(/f[óo]rmula de aloca[çc][ãa]o e n[ãa]o o mundo/i);
    expect(C.circularidade.leitura,
      "a leitura precisa separar direção robusta de magnitude frágil")
      .toMatch(/dire[çc][ãa]o/i);
    expect(C.circularidade.leitura).toMatch(/magnitude/i);
  });

  it("a regra declara que nenhuma afirmação se apoia no indicador municipal", () => {
    const regra: string = C.circularidade.conclusao_regra;
    expect(regra).toMatch(/nenhuma afirmação/i);
    expect(regra).toMatch(/se apoia/i);
    expect(regra).toMatch(/municipal/i);
  });

  it("a estimativa municipal nunca é apresentada como observação", () => {
    // O bloco de circularidade é observado porque compara duas medidas; o que ele conclui
    // é justamente que o número municipal não sustenta afirmação.
    expect(SELOS).toContain(C.circularidade.selo);
    expect(Object.keys(C.rankings), "os rankings têm de separar observado de estimado")
      .toEqual(expect.arrayContaining(["observado", "estimado"]));
  });
});

d("modelo de alocação: exaustivo, com faixa, e sem base inventada", () => {
  it("a soma municipal do consignado devolve o saldo nacional observado no SCR", () => {
    const nacional = C.scr.aposentados_nacional;
    const s = soma("cons");
    expect(nacional).toBeGreaterThan(0);
    expect(Math.abs(s / nacional - 1),
      `alocado ${s} contra ${nacional} observado`).toBeLessThan(0.005);
  });

  it("a soma por unidade da federação também é exaustiva", () => {
    const porUf: Record<string, number> = {};
    for (const m of M) if (m.cons) porUf[m.uf] = (porUf[m.uf] || 0) + m.cons;
    for (const [uf, v] of Object.entries(C.scr.por_uf) as [string, any][]) {
      if (!v.aposentados) continue;
      expect(Math.abs((porUf[uf] || 0) / v.aposentados - 1),
        `${uf}: alocado ${porUf[uf]} contra ${v.aposentados}`).toBeLessThan(0.005);
    }
  });

  it("todo município com consignado tem a faixa cons_lo ≤ cons ≤ cons_hi", () => {
    const com = M.filter((m: any) => m.cons != null);
    expect(com.length).toBeGreaterThan(5000);
    for (const m of com) {
      expect(m.cons_lo, `${m.n}/${m.uf}.cons_lo`).toBeTypeOf("number");
      expect(m.cons_hi, `${m.n}/${m.uf}.cons_hi`).toBeTypeOf("number");
      expect(m.cons_lo <= m.cons && m.cons <= m.cons_hi,
        `${m.n}/${m.uf}: ${m.cons_lo} ≤ ${m.cons} ≤ ${m.cons_hi}`).toBe(true);
    }
  });

  it("nenhum município recebe alocação sem ter benefícios", () => {
    for (const m of M) {
      if (m.cons == null) continue;
      expect(m.ben, `${m.n}/${m.uf} recebeu ${m.cons} sem benefícios`).toBeTruthy();
      expect((m.apo || 0) + (m.pen || 0),
        `${m.n}/${m.uf} recebeu alocação sem aposentadoria nem pensão`).toBeGreaterThan(0);
    }
  });

  it("município sem chave elegível fica sem alocação, e sem derivados dela", () => {
    for (const m of M) {
      if (m.cons != null) continue;
      for (const campo of ["cons_lo", "cons_hi", "cons_ben", "servico", "sat"]) {
        expect(m[campo] ?? null, `${m.n}/${m.uf}.${campo}`).toBeNull();
      }
    }
  });

  it("o consignado por benefício e o serviço da dívida são positivos onde existem", () => {
    for (const m of M) {
      if (m.cons_ben != null) expect(m.cons_ben, `${m.n}/${m.uf}`).toBeGreaterThan(0);
      if (m.servico != null) expect(m.servico, `${m.n}/${m.uf}`).toBeGreaterThan(0);
    }
  });
});

d("teste de coerência contra o teto do Censo e selo de confiabilidade", () => {
  it("todo município incoerente é rebaixado a confiabilidade baixa", () => {
    const incoerentes = M.filter((m: any) => m.incoerente === true);
    expect(incoerentes.length, "o teste de coerência não reprovou ninguém").toBeGreaterThan(0);
    for (const m of incoerentes) {
      expect(m.sel, `${m.n}/${m.uf} é incoerente e tem selo ${m.sel}`).toBe("baixa");
    }
  });

  it("o total publicado de incoerentes é a contagem real", () => {
    const n = M.filter((m: any) => m.incoerente === true).length;
    expect(C.totais.incoerentes, `contados ${n}, publicados ${C.totais.incoerentes}`).toBe(n);
    expect(n / M.length, "reprovar mais de um terço da base indicaria erro de teste")
      .toBeLessThan(0.34);
  });

  it("todo município com coerência tem as duas pontas da razão", () => {
    for (const m of M) {
      if (m.coer == null) continue;
      expect(m.peso, `${m.n}/${m.uf} tem coer sem peso`).toBeTruthy();
      expect(m.outras, `${m.n}/${m.uf} tem coer sem outras fontes`).toBeTruthy();
    }
  });

  it("a coerência é exatamente peso sobre participação de outras fontes", () => {
    for (const m of M) {
      if (m.coer == null) continue;
      const esperado = m.peso / m.outras;
      expect(Math.abs(m.coer - esperado),
        `${m.n}/${m.uf}: coer ${m.coer} vs ${esperado.toFixed(4)}`).toBeLessThanOrEqual(0.01);
      // a reprovação é exatamente coer > 1, e não um limiar paralelo
      expect(m.incoerente === true, `${m.n}/${m.uf}: coer ${m.coer}, incoerente ${m.incoerente}`)
        .toBe(m.peso > m.outras);
    }
  });

  it("o deflator do IPCA está na faixa plausível entre 2022 e 2025", () => {
    // Comparar valor de dezembro de 2025 com renda de julho de 2022 sem deflacionar
    // superestimaria o peso em toda a base — o fator é parte do teste, não enfeite.
    expect(C.fator_ipca, `fator ${C.fator_ipca}`).toBeGreaterThan(1.15);
    expect(C.fator_ipca, `fator ${C.fator_ipca}`).toBeLessThan(1.25);
    for (const m of M) {
      if (!m.vdez || !m.vreal) continue;
      expect(Math.abs(m.vdez / C.fator_ipca / m.vreal - 1), `${m.n}/${m.uf}`)
        .toBeLessThan(0.001);
    }
  });

  it("todo município tem selo do vocabulário, e os totais batem", () => {
    for (const m of M) {
      expect(SELOS_MUN, `${m.n}/${m.uf}: ${m.sel}`).toContain(m.sel);
    }
    for (const s of SELOS_MUN) {
      expect(M.filter((m: any) => m.sel === s).length, s).toBe(C.totais.selos[s]);
    }
    expect(Object.values(C.totais.selos).reduce((a: number, b: any) => a + b, 0))
      .toBe(M.length);
  });
});

d("saturação: a trava do briefing", () => {
  it("nenhum município de baixa confiabilidade recebe classificação de saturação", () => {
    // Rotular de saturado um município que só recebeu uma fatia proporcional de um total
    // estadual seria transformar a fórmula de alocação em diagnóstico.
    const baixa = M.filter((m: any) => m.sel === "baixa");
    expect(baixa.length, "nenhum município de baixa confiabilidade na base").toBeGreaterThan(0);
    for (const m of baixa) {
      expect(m.sat, `${m.n}/${m.uf} tem selo baixa e saturação ${m.sat}`).toBeNull();
      expect(m.sat_motivo, `${m.n}/${m.uf} sem motivo declarado`).toBeTruthy();
    }
  });

  it("quem fica sem classificação tem o motivo declarado, nunca silêncio", () => {
    for (const m of M) {
      if (m.sat != null) continue;
      expect(m.sat_motivo, `${m.n}/${m.uf}`).toMatch(/sem base observada suficiente/i);
    }
  });

  it("as três faixas cobrem exatamente os municípios classificados", () => {
    const faixas = ["baixa_penetracao", "penetracao_elevada", "possivel_saturacao"];
    for (const m of M) {
      if (m.sat != null) expect(faixas, `${m.n}/${m.uf}: ${m.sat}`).toContain(m.sat);
    }
    for (const f of faixas) {
      expect(M.filter((m: any) => m.sat === f).length, f).toBe(C.totais.saturacao[f]);
    }
    const classificados = M.filter((m: any) => m.sat != null).length;
    expect(Object.values(C.totais.saturacao).reduce((a: number, b: any) => a + b, 0))
      .toBe(classificados);
  });

  it("os limiares são explícitos e o alto é mais exigente que o médio", () => {
    const s = C.saturacao_criterios;
    expect(s.cons_ben_alto, `${s.cons_ben_alto} vs ${s.cons_ben_medio}`)
      .toBeGreaterThan(s.cons_ben_medio);
    expect(s.servico_alto, `${s.servico_alto} vs ${s.servico_medio}`)
      .toBeGreaterThan(s.servico_medio);
    for (const v of Object.values(s) as number[]) expect(v).toBeGreaterThan(0);
  });

  it("a classificação segue os limiares publicados, sem regra paralela", () => {
    const s = C.saturacao_criterios;
    for (const m of M) {
      if (m.sat == null) continue;
      const cb = m.cons_ben, sv = m.servico || 0;
      const esperado = (cb >= s.cons_ben_alto || sv >= s.servico_alto)
        ? "possivel_saturacao"
        : (cb >= s.cons_ben_medio || sv >= s.servico_medio)
          ? "penetracao_elevada"
          : "baixa_penetracao";
      expect(m.sat, `${m.n}/${m.uf}: cons_ben ${cb}, servico ${sv}`).toBe(esperado);
    }
  });
});

d("nomenclatura: cada número é chamado pelo que é", () => {
  it("o gold nunca chama a participação de outras fontes de renda previdenciária", () => {
    // O Censo tem exatamente três categorias de rendimento e nenhuma delas é aposentadoria
    // ou pensão. "Outras fontes" é teto, não renda previdenciária.
    for (const o of ocorrencias("renda previdenciária")) {
      expect(/\bnão\b|\bjamais\b|\bnunca\b/i.test(o.antes),
        `uso afirmativo de "renda previdenciária": ${o.trecho}`).toBe(true);
    }
  });

  it('o gold nunca fala em "saldo municipal de consignado"', () => {
    // Não existe carteira municipal pública. O que existe é alocação de um total estadual.
    for (const o of ocorrencias("saldo municipal de consignado")) {
      expect(/\bnão\b|\bjamais\b|\bnunca\b|\binexiste\b/i.test(o.antes),
        `uso afirmativo: ${o.trecho}`).toBe(true);
    }
  });

  it('o gold nunca promete "beneficiários por município"', () => {
    // O menor nível geográfico de beneficiários (pessoas) é a unidade da federação. O que
    // a base municipal traz são benefícios — e um beneficiário pode ter mais de um.
    for (const o of ocorrencias("beneficiários por município")) {
      expect(/\bnão\b|\bjamais\b|\bnunca\b|\binexiste\b/i.test(o.antes),
        `uso afirmativo: ${o.trecho}`).toBe(true);
    }
  });

  it("nenhuma prosa afirma valor de benefícios sem dizer que é líquido", () => {
    // Guarda de nomenclatura: o valor da Previdência é líquido de descontos, e o consignado
    // já saiu dele. Qualquer texto novo que fale do valor tem de trazer o qualificador.
    for (const t of prosa()) {
      if (!/(valor|massa)\s+(d[eo]s?\s+)?benefícios?/i.test(t)) continue;
      expect(/líquid/i.test(t), `prosa sobre valor de benefícios sem "líquido": ${t}`).toBe(true);
    }
  });

  it("nenhuma prosa atribui benefícios a um município sem dizer órgão pagador", () => {
    // O município da base é o do órgão pagador, não o de residência — o efeito é grande e
    // é a causa conhecida das reprovações no teste de coerência.
    for (const t of prosa()) {
      if (!/benefícios?\s+(emitidos?\s+)?(por|no|do)\s+municípios?/i.test(t)) continue;
      expect(/órgão pagador/i.test(t), `prosa municipal sem "órgão pagador": ${t}`).toBe(true);
    }
  });

  it("o grupo do SCR nunca é chamado de consignado do INSS", () => {
    const aviso: string = C.scr.aviso_grupo;
    expect(aviso, "falta o aviso sobre o grupo de ocupação do SCR").toBeTruthy();
    expect(aviso).toMatch(/mais amplo que o público do INSS/i);
    expect(aviso).toMatch(/regimes próprios/i);
    expect(aviso).toMatch(/não é.{0,40}consignado do INSS/i);
  });

  it("SGS e SCR são declarados como medidas distintas, que não se somam", () => {
    const aviso: string = C.sgs.aviso_proxy;
    expect(aviso).toMatch(/não são somados|não se somam|nem intercambiados/i);
    expect(C.sgs.unidade_saldo, "o saldo do SGS precisa declarar a unidade")
      .toMatch(/R\$ milhões/i);
  });

  it("taxa de contratação não é carteira nem participação de mercado", () => {
    const aviso: string = C.instituicoes.aviso;
    expect(aviso).toMatch(/não é a carteira/i);
    expect(aviso).toMatch(/participação de mercado/i);
    expect(C.instituicoes.geografia, "a geografia das instituições é nacional e assim fica")
      .toBe("nacional");
  });
});

d("selos: todo bloco declara a natureza da sua evidência", () => {
  it("todo objeto com campo selo usa o vocabulário", () => {
    const achados: { caminho: string; selo: any }[] = [];
    const varrer = (o: any, caminho: string) => {
      if (Array.isArray(o)) {
        o.forEach((v, i) => varrer(v, `${caminho}[${i}]`));
      } else if (o && typeof o === "object") {
        if (typeof o.selo === "string") achados.push({ caminho, selo: o.selo });
        for (const [k, v] of Object.entries(o)) varrer(v, caminho ? `${caminho}.${k}` : k);
      }
    };
    varrer(C, "");
    expect(achados.length, "nenhum bloco declara selo").toBeGreaterThan(0);
    for (const a of achados) {
      expect(SELOS, `${a.caminho} tem selo "${a.selo}"`).toContain(a.selo);
    }
  });

  it("os blocos que vêm direto da fonte são observados", () => {
    for (const k of ["brasil", "sgs", "scr", "reclamacoes", "instituicoes"]) {
      expect(C[k].selo, `${k}.selo`).toBe("observado");
    }
  });
});

d("séries e demografia do Censo 2022", () => {
  it("a pirâmide tem os 21 grupos quinquenais e soma a população do país", () => {
    expect(C.brasil.piramide).toHaveLength(21);
    const s = C.brasil.piramide.reduce((a: number, g: any) => a + g.pop, 0);
    expect(s, `pirâmide soma ${s}`).toBe(203_080_756);
    expect(C.brasil.populacao).toBe(s);
    for (const g of C.brasil.piramide) {
      expect(g.g, "grupo sem rótulo").toBeTruthy();
      expect(g.pop, `${g.g} sem população`).toBeGreaterThan(0);
    }
  });

  it("a população municipal soma o total nacional", () => {
    expect(soma("pop")).toBe(C.brasil.populacao);
    expect(soma("a60")).toBe(C.brasil.a60);
  });

  it("os indicadores etários nacionais são os do Censo", () => {
    expect(C.brasil.p60, `p60 = ${C.brasil.p60}`).toBeCloseTo(15.8, 1);
    expect(C.brasil.idade_mediana, `idade mediana ${C.brasil.idade_mediana}`)
      .toBeGreaterThan(34);
    expect(C.brasil.idade_mediana).toBeLessThan(37);
    expect(C.brasil.p65).toBeLessThan(C.brasil.p60);
    expect(C.brasil.p80).toBeLessThan(C.brasil.p65);
    expect(Math.abs(100 * C.brasil.a60 / C.brasil.populacao - C.brasil.p60))
      .toBeLessThan(0.05);
  });

  it("o consignado por vínculo do tomador fecha com a série de total", () => {
    // Privado mais público mais INSS é o total. Se não fechar, alguma série trocou de
    // conceito no meio do caminho.
    const a = C.sgs.atual;
    const partes = a.privado.saldo + a.publico.saldo + a.inss.saldo;
    expect(Math.abs(partes - a.total.saldo),
      `partes somam ${partes}, total publica ${a.total.saldo} (R$ milhões)`)
      .toBeLessThanOrEqual(1);
  });

  it("a inadimplência do consignado do INSS é muito menor que a do privado", () => {
    // É o dado mais eloquente do bloco, e o teste protege contra troca de rótulos entre
    // as séries: 1,95% no INSS contra 8,63% no consignado privado.
    const a = C.sgs.atual;
    expect(a.inss.inad, `INSS ${a.inss.inad} vs privado ${a.privado.inad}`)
      .toBeLessThan(a.privado.inad);
    expect(a.inss.inad).toBeCloseTo(1.95, 2);
    expect(a.privado.inad).toBeCloseTo(8.63, 2);
    expect(a.inss.inad).toBeLessThan(a.publico.inad);
  });

  it("as séries do SGS estão ordenadas no tempo e não são vazias", () => {
    for (const [k, serie] of Object.entries(C.sgs.series) as [string, any[]][]) {
      expect(serie.length, `série ${k} vazia`).toBeGreaterThan(0);
      const datas = serie.map((x: any) => x.d);
      expect([...datas].sort(), `série ${k} fora de ordem`).toEqual(datas);
    }
  });

  it("o SCR cobre as 27 unidades da federação e a composição por ocupação fecha", () => {
    expect(Object.keys(C.scr.por_uf)).toHaveLength(27);
    for (const uf of Object.keys(C.scr.por_uf)) expect(UFS, `UF ${uf}`).toContain(uf);
    const apo = C.scr.composicao_ocupacao.find((x: any) => /Aposentado/i.test(x.grupo));
    expect(apo, "falta o grupo de aposentados na composição").toBeTruthy();
    expect(apo.saldo).toBe(C.scr.aposentados_nacional);
    const part = C.scr.composicao_ocupacao.reduce((s: number, x: any) => s + x.part, 0);
    expect(Math.abs(part - 100), `participações somam ${part}`).toBeLessThanOrEqual(0.5);
  });
});

d("linha do tempo regulatória", () => {
  it("são 19 eventos, todos com data, título, norma e tipo", () => {
    expect(C.linha_do_tempo).toHaveLength(19);
    for (const e of C.linha_do_tempo) {
      for (const campo of ["d", "t", "norma", "tipo"]) {
        expect(e[campo], `${e.d || "?"}: campo ${campo} ausente`).toBeTruthy();
      }
      expect(TIPOS_EVENTO, `${e.t}: tipo "${e.tipo}"`).toContain(e.tipo);
    }
  });

  it("toda data é ISO válida e cai dentro do período do consignado em benefício", () => {
    for (const e of C.linha_do_tempo) {
      expect(/^\d{4}-\d{2}-\d{2}$/.test(e.d), `data "${e.d}" em ${e.t}`).toBe(true);
      const dt = new Date(`${e.d}T00:00:00Z`);
      expect(Number.isNaN(dt.getTime()), `data inválida: ${e.d}`).toBe(false);
      // o dia sobrevive ao round-trip: descarta 2025-02-30 e similares
      expect(dt.toISOString().slice(0, 10), `data inexistente no calendário: ${e.d}`).toBe(e.d);
      expect(e.d >= "2003-01-01", `${e.t} é anterior à Lei 10.820/2003`).toBe(true);
    }
  });

  it("ordenadas por data, as normas ficam em ordem cronológica estrita", () => {
    const datas = C.linha_do_tempo.map((e: any) => e.d);
    const ordenadas = [...datas].sort();
    for (let i = 1; i < ordenadas.length; i++) {
      expect(ordenadas[i] > ordenadas[i - 1],
        `duas normas na mesma data: ${ordenadas[i]}`).toBe(true);
    }
    expect(new Set(datas).size).toBe(datas.length);
  });

  it("a norma é citada nominalmente, não como referência genérica", () => {
    for (const e of C.linha_do_tempo) {
      expect(String(e.norma).length, `${e.t}: norma "${e.norma}"`).toBeGreaterThan(8);
      expect(/\d{1,3}\.?\d{0,3}\/\d{4}/.test(e.norma),
        `${e.t}: a norma "${e.norma}" não traz número e ano`).toBe(true);
    }
  });

  it("os cinco tipos previstos estão todos representados", () => {
    const tipos = new Set(C.linha_do_tempo.map((e: any) => e.tipo));
    for (const t of TIPOS_EVENTO) expect(tipos, `nenhum evento do tipo ${t}`).toContain(t);
  });
});

d("reclamações: a única fonte municipal, e o que ela mede", () => {
  it("o total é positivo e reconcilia com a série mensal", () => {
    expect(C.reclamacoes.total).toBeGreaterThan(0);
    const serie = C.reclamacoes.serie.reduce((s: number, x: any) => s + x.n, 0);
    expect(serie, `série soma ${serie}, total publica ${C.reclamacoes.total}`)
      .toBe(C.reclamacoes.total);
    expect(soma("rec"), "a soma municipal diverge do total de reclamações")
      .toBe(C.reclamacoes.total);
  });

  it("toda instituição tem taxa de resolução no intervalo válido ou nula", () => {
    expect(C.reclamacoes.instituicoes.length).toBeGreaterThan(0);
    for (const i of C.reclamacoes.instituicoes) {
      const t = i.taxa_resolucao;
      expect(t === null || (t >= 0 && t <= 100), `${i.nome}: taxa ${t}`).toBe(true);
      expect(i.nome, "instituição sem nome").toBeTruthy();
      expect(i.total, `${i.nome}.total`).toBeGreaterThan(0);
      expect(i.idosos, `${i.nome}: idosos ${i.idosos} maior que o total ${i.total}`)
        .toBeLessThanOrEqual(i.total);
      // taxa sem denominador seria aritmética vazia
      if (t !== null) expect(i.avaliadas, `${i.nome} tem taxa sem avaliadas`).toBeGreaterThan(0);
    }
  });

  it("o aviso declara que a base mede propensão a reclamar", () => {
    const aviso: string = C.reclamacoes.aviso;
    expect(aviso).toMatch(/propensão a reclamar/i);
    expect(aviso).toMatch(/não incidência de problema|não .{0,30}incidência/i);
    expect(aviso).toMatch(/contagem bruta não é ranking/i);
  });

  it("as competências estão em ordem e delimitam o período publicado", () => {
    const comps: string[] = C.reclamacoes.competencias;
    expect(comps.length).toBeGreaterThan(0);
    expect([...comps].sort()).toEqual(comps);
    expect(C.reclamacoes.de).toBe(comps[0]);
    expect(C.reclamacoes.ate).toBe(comps[comps.length - 1]);
  });
});

d("rankings: observado e estimado nunca se misturam", () => {
  const cods = new Set(M.map((m: any) => m.c));
  const porCod = new Map(M.map((m: any) => [m.c, m]));
  const grupos = ["observado", "estimado"] as const;

  it("os dois conjuntos existem e não compartilham nenhum ranking", () => {
    for (const g of grupos) {
      expect(Object.keys(C.rankings[g]).length, `${g} está vazio`).toBeGreaterThan(0);
    }
    const obs = new Set(Object.keys(C.rankings.observado));
    const est = Object.keys(C.rankings.estimado);
    for (const k of est) {
      expect(obs.has(k), `o ranking "${k}" aparece nos dois conjuntos`).toBe(false);
    }
  });

  it("nenhum ranking repete município", () => {
    for (const g of grupos) {
      for (const [k, r] of Object.entries(C.rankings[g]) as [string, any[]][]) {
        expect(r.length, `${g}.${k} está vazio`).toBeGreaterThan(0);
        const ids = r.map((x: any) => x.c);
        expect(new Set(ids).size, `${g}.${k} repete município`).toBe(ids.length);
      }
    }
  });

  it("todo item referencia um município existente, com nome e selo coerentes", () => {
    for (const g of grupos) {
      for (const [k, r] of Object.entries(C.rankings[g]) as [string, any[]][]) {
        for (const x of r) {
          expect(cods.has(x.c), `${g}.${k}: código ${x.c} (${x.n}/${x.uf}) não existe`).toBe(true);
          const m: any = porCod.get(x.c);
          expect(m.n, `${g}.${k}: nome divergente para ${x.c}`).toBe(x.n);
          expect(m.uf, `${g}.${k}: UF divergente para ${x.n}`).toBe(x.uf);
          expect(m.sel, `${g}.${k}: selo divergente para ${x.n}`).toBe(x.sel);
        }
      }
    }
  });

  it("nenhum ranking estimado inclui município de baixa confiabilidade", () => {
    // O ranking estimado ordena por um número que veio de alocação. Somar a isso um
    // município reprovado no teste de coerência seria empilhar fragilidade sobre fórmula.
    for (const [k, r] of Object.entries(C.rankings.estimado) as [string, any[]][]) {
      for (const x of r) {
        expect(["alta", "media"], `estimado.${k}: ${x.n}/${x.uf} tem selo ${x.sel}`)
          .toContain(x.sel);
      }
    }
  });

  it("todo ranking está de fato ordenado pelo valor que apresenta", () => {
    for (const g of grupos) {
      for (const [k, r] of Object.entries(C.rankings[g]) as [string, any[]][]) {
        const v = r.map((x: any) => x.v);
        for (const x of r) expect(x.v, `${g}.${k}: item sem valor`).toBeTypeOf("number");
        const decresce = v.every((_: number, i: number) => i === 0 || v[i] <= v[i - 1]);
        const cresce = v.every((_: number, i: number) => i === 0 || v[i] >= v[i - 1]);
        expect(decresce || cresce, `${g}.${k} não está monotônico`).toBe(true);
      }
    }
  });

  it("o valor exibido no ranking é o do município, não uma cópia divergente", () => {
    const campo: Record<string, string> = {
      envelhecimento: "p60", indice_envelhecimento: "env", massa_previdenciaria: "vdez",
      dependencia: "peso", beneficios_por_idoso: "ben100_60", rural: "prural",
      assistenciais: "pass", exposicao: "cons", exposicao_por_beneficio: "cons_ben",
      servico_da_divida: "servico", indice_risco: "indice",
    };
    for (const g of grupos) {
      for (const [k, r] of Object.entries(C.rankings[g]) as [string, any[]][]) {
        const c = campo[k];
        expect(c, `ranking "${k}" sem campo de origem mapeado neste teste`).toBeTruthy();
        for (const x of r) {
          expect((porCod.get(x.c) as any)[c], `${g}.${k}: ${x.n} exibe ${x.v}`).toBe(x.v);
        }
      }
    }
  });
});

d("estados: as 27 unidades da federação", () => {
  it("são exatamente 27, com sigla válida, nome e região", () => {
    expect(C.estados).toHaveLength(27);
    const siglas = C.estados.map((e: any) => e.uf);
    expect(new Set(siglas).size, "sigla repetida").toBe(27);
    for (const e of C.estados) {
      expect(UFS, `sigla inválida: ${e.uf}`).toContain(e.uf);
      expect(e.nome, `${e.uf}.nome`).toBeTruthy();
      expect(["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"],
        `${e.uf} região "${e.reg}"`).toContain(e.reg);
    }
  });

  it("a soma estadual de benefícios é o total nacional", () => {
    const s = C.estados.reduce((a: number, e: any) => a + e.ben, 0);
    expect(s, `estados somam ${s}, Brasil publica ${C.brasil.beneficios}`)
      .toBe(C.brasil.beneficios);
    for (const k of ["apo", "pen", "ass"] as const) {
      expect(C.estados.reduce((a: number, e: any) => a + e[k], 0)).toBe(soma(k));
    }
    expect(C.estados.reduce((a: number, e: any) => a + e.pop, 0)).toBe(C.brasil.populacao);
  });

  it("cada estado é a soma dos seus municípios, sem sobra nem falta", () => {
    const porUf: Record<string, number> = {};
    for (const m of M) porUf[m.uf] = (porUf[m.uf] || 0) + (m.ben || 0);
    for (const e of C.estados) {
      expect(porUf[e.uf], `${e.uf}: municípios somam ${porUf[e.uf]}, estado publica ${e.ben}`)
        .toBe(e.ben);
    }
    expect(Object.keys(porUf).sort()).toEqual(C.estados.map((e: any) => e.uf).sort());
  });

  it("todo município aponta para uma UF e uma região existentes", () => {
    const porUf = new Map(C.estados.map((e: any) => [e.uf, e]));
    for (const m of M) {
      expect(porUf.has(m.uf), `${m.n}: UF ${m.uf} desconhecida`).toBe(true);
      expect(m.reg, `${m.n}/${m.uf}`).toBe((porUf.get(m.uf) as any).reg);
    }
  });

  it("elegíveis são aposentadorias mais pensões, e nunca excedem o total", () => {
    for (const e of C.estados) {
      expect(e.elegiveis, e.uf).toBe(e.apo + e.pen);
      expect(e.elegiveis, `${e.uf}: ${e.elegiveis} elegíveis para ${e.ben} benefícios`)
        .toBeLessThanOrEqual(e.ben);
    }
  });

  it("o consignado estadual observado vem do SCR, sem passar por alocação", () => {
    for (const e of C.estados) {
      const s = C.scr.por_uf[e.uf];
      expect(s, `${e.uf} não existe no SCR`).toBeTruthy();
      expect(e.cons_obs, `${e.uf}.cons_obs`).toBe(s.aposentados);
      expect(e.cons_total, `${e.uf}.cons_total`).toBe(s.total);
      if (e.cons_obs && e.elegiveis) {
        expect(e.cons_por_elegivel, e.uf)
          .toBeCloseTo(e.cons_obs / e.elegiveis, 0);
      }
    }
  });
});
