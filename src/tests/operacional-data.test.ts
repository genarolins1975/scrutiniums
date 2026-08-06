/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Indicadores operacionais (Fase 0): gente, rede e auditoria a partir de
 * fontes estruturadas oficiais. As invariantes protegidas aqui:
 * ausência nunca vira zero; escopos declarados; somas fecham; variações
 * extremas sempre carregam flag; nenhum nível abaixo de A (é tudo dado
 * administrativo oficial — se um dia entrar estimativa, o teste força a
 * decisão consciente).
 */
const g = JSON.parse(
  readFileSync(join(process.cwd(), "public/obs/data/gold/operacional.json"), "utf-8"),
);

describe("estrutura e cobertura", () => {
  it("a aba publica a fronteira da cobertura, com os bancos que ficaram de fora", () => {
    const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");
    expect(app).toContain("Fronteira da cobertura");
    expect(app).toContain("C.bancos_cvm_fora");
    expect(app).toContain("ausência não vira zero");
  });


  it("gold disponível, com cobertura consistente", () => {
    expect(g.disponivel).toBe(true);
    expect(g.instituicoes.length).toBe(g.cobertura.instituicoes);
    expect(g.instituicoes.filter((i: any) => i.empregados).length).toBe(g.cobertura.com_empregados);
    expect(g.instituicoes.filter((i: any) => i.auditor).length).toBe(g.cobertura.com_auditor);
    expect(g.instituicoes.filter((i: any) => i.rede).length).toBe(g.cobertura.com_rede);
  });

  it("a fronteira da cobertura é objetiva e a lacuna é publicada nominalmente", () => {
    const c = g.cobertura;
    // critério verificável na fonte, não escolha editorial fechada
    expect(c.criterio).toMatch(/Formulário Cadastral|FCA/i);
    expect(c.bancos_cvm).toBeGreaterThan(0);
    expect(c.bancos_cvm_cobertos).toBeLessThanOrEqual(c.bancos_cvm);
    expect(c.bancos_cvm_fora.length).toBe(c.bancos_cvm - c.bancos_cvm_cobertos);
    for (const f of c.bancos_cvm_fora) {
      expect(f.cnpj, f.nome).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
      expect(f.nome).toBeTruthy();
      // a idade do cadastro precisa acompanhar o nome: registro "ativo" antigo
      // costuma ser caso encerrado, e o leitor tem de poder distinguir
      expect(f.ultimo_fca, f.nome).toBeGreaterThanOrEqual(2021);
    }
    // quem está fora não pode estar dentro, e vice-versa
    const ids = new Set(g.instituicoes.map((i: any) => i.id));
    expect(ids.size).toBe(g.instituicoes.length);
    expect(g.cobertura.bancos_cvm_cobertos).toBeGreaterThanOrEqual(20);
  });

  it("instituições que entraram pela CVM trazem série de empregados de verdade", () => {
    // a expansão do cadastro só vale se produzir dado, não linha vazia
    for (const id of ["banpara", "daycoval", "parana", "pan", "inter"]) {
      const inst = g.instituicoes.find((i: any) => i.id === id);
      expect(inst, `instituição ${id} ausente`).toBeTruthy();
      expect(inst.empregados?.serie?.length, `${id} sem série de empregados`).toBeGreaterThanOrEqual(3);
      expect(inst.empregados.serie.at(-1).total, `${id} com total não positivo`).toBeGreaterThan(0);
      expect(inst.auditor, `${id} sem auditor`).toBeTruthy();
    }
  });

  it("fontes com URL https e nível A (dado administrativo oficial)", () => {
    expect(g.fontes.length).toBeGreaterThanOrEqual(3);
    for (const f of g.fontes) {
      expect(f.url).toMatch(/^https:\/\//);
      expect(f.nivel).toBe("A");
    }
  });

  it("aviso de escopo presente (FRE ≠ conglomerado; rede = banco operacional)", () => {
    expect(g.aviso).toContain("FRE");
    expect(g.aviso).toContain("conglomerado");
    expect(g.aviso).toContain("nunca com zero");
  });
});

describe("alcance: página da IF, comparador e imprensa", () => {
  const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");

  it("a rede de atendimento chega a qualquer IF com CNPJ-raiz, não só às do painel", () => {
    // o cadastro cobre mais de mil instituições; o painel tem dezenas. Se o
    // join da página de IF voltar a depender do piloto, este teste cai.
    expect(Object.keys(g.dependencias.por_cnpj8).length).toBeGreaterThan(500);
    expect(app).toContain("Rede de atendimento (cadastro do BC)");
    expect(app).toContain("(O.dependencias || {}).por_cnpj8");
    expect(app).toContain("if (!piloto && !rede && !pontos && !corresp) return null;");
  });

  it("comparador mostra postos e PAE sem somá-los às agências do ESTBAN", () => {
    expect(app).toContain("Postos + PAE");
    expect(app).toContain("não se soma");
  });

  it("síntese citável inclui a lacuna municipal, com conceito e fonte", () => {
    const ids = g.sintese.map((s: any) => s.id);
    for (const id of ["municipios_sem_dependencia", "municipios_so_posto", "postos_atendimento",
      "municipios_sem_nenhum_ponto", "municipios_so_correspondente"]) {
      expect(ids, `síntese sem ${id}`).toContain(id);
    }
    const semDep = g.sintese.find((s: any) => s.id === "municipios_sem_dependencia");
    expect(semDep.valor).toBe(g.dependencias.municipios.sem_dependencia);
    // o número sozinho enganaria: o conceito precisa dizer que não é ausência de atendimento
    expect(semDep.conceito).toMatch(/NÃO é ausência de atendimento/i);
    expect(semDep.conceito).toMatch(/correspondentes/i);
    for (const s of g.sintese) {
      expect(s.nivel, s.id).toBe("A");
      expect(s.url, s.id).toMatch(/^https:\/\/www\.bcb\.gov\.br\//);
      expect(s.conceito.length, s.id).toBeGreaterThan(40);
      expect(["oficial", "calculado"]).toContain(s.status);
    }
  });
});

describe("rede de atendimento (BCB/Unicad)", () => {
  const d = g.dependencias;

  it("os três cadastros vêm juntos, com posição declarada e fonte nível A", () => {
    expect(d).toBeTruthy();
    expect(d.posicao).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(d.fonte.url).toMatch(/^https:\/\/www\.bcb\.gov\.br\//);
    expect(d.fonte.nivel).toBe("A");
    for (const t of ["agencia", "posto", "pae"]) {
      expect(d.totais[t], t).toBeGreaterThan(0);
    }
  });

  it("cadastro e ESTBAN não são reconciliados nem somados", () => {
    // o escopo precisa dizer, em texto, que os dois conceitos de agência diferem
    expect(d.escopo).toMatch(/processadas/i);
    expect(d.escopo).toMatch(/nunca são somados|não são somados/i);
    // e os números realmente diferem: se um dia coincidirem, ainda assim não se somam
    const estban = g.sfn.rede.serie.at(-1).agencias;
    expect(typeof estban).toBe("number");
    expect(d.totais.agencia).not.toBe(0);
  });

  it("cobertura municipal fecha e respeita o total de municípios do país", () => {
    const m = d.municipios;
    // o denominador é a lista do IBGE do próprio pipeline, não um literal: foi
    // exatamente o literal 5570 que produziu o "377" errado na primeira versão
    expect(m.total_municipios).toBeGreaterThanOrEqual(5570);
    expect(m.denominador).toMatch(/IBGE/);
    expect(m.com_agencia).toBeLessThanOrEqual(m.com_qualquer_ponto);
    expect(m.com_posto_ou_pae).toBeLessThanOrEqual(m.com_qualquer_ponto);
    expect(m.com_qualquer_ponto).toBeLessThanOrEqual(m.total_municipios);
    expect(m.sem_dependencia).toBe(m.total_municipios - m.com_qualquer_ponto);
    expect(m.so_posto_sem_agencia).toBe(m.com_qualquer_ponto - m.com_agencia);
    // a lacuna de dependência não pode ser publicada como lacuna de atendimento
    expect(m.sem_dependencia_com_correspondente).toBeLessThanOrEqual(m.sem_dependencia);
    expect(m.sem_nenhum_ponto).toBe(m.sem_dependencia - m.sem_dependencia_com_correspondente);
  });

  it("contagem por instituição fecha com o total e não inventa presença", () => {
    for (const [c8, p] of Object.entries<any>(d.por_cnpj8)) {
      expect(c8).toMatch(/^\d{8}$/);
      expect(p.total).toBe(p.agencia + p.posto + p.pae);
      expect(p.municipios).toBeGreaterThan(0);
      expect(p.municipios).toBeLessThanOrEqual(5570);
    }
    for (const t of ["agencia", "posto", "pae"]) {
      const soma = Object.values<any>(d.por_cnpj8).reduce((a, p) => a + p[t], 0);
      expect(soma, t).toBe(d.totais[t]);
    }
    // instituição sem ponto cadastrado fica sem o bloco — ausência, não zero
    const nubank = g.instituicoes.find((i: any) => i.id === "nubank");
    expect(nubank.pontos).toBeFalsy();
  });

  it("a aba publica a seção com os dois conceitos e a lacuna municipal", () => {
    const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");
    expect(app).toContain("Rede de atendimento além das agências");
    expect(app).toContain("Municípios sem dependência");
    expect(app).toContain("Dois conceitos de agência, nunca somados");
  });
});

describe("correspondentes no país (BCB)", () => {
  const c = g.correspondentes;

  it("cadastro presente, por contratante, com posição e fonte nível A", () => {
    expect(c).toBeTruthy();
    expect(c.posicao).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(c.fonte.url).toMatch(/^https:\/\/www\.bcb\.gov\.br\//);
    expect(c.fonte.nivel).toBe("A");
    expect(c.totais.pontos).toBeGreaterThan(100000);
    expect(c.totais.contratantes).toBeGreaterThan(100);
  });

  it("contagem por contratante fecha com o total e nunca vira exclusividade", () => {
    const soma = Object.values<any>(c.por_cnpj8).reduce((a, p) => a + p.pontos, 0);
    expect(soma).toBe(c.totais.pontos);
    for (const [c8, p] of Object.entries<any>(c.por_cnpj8)) {
      expect(c8).toMatch(/^\d{8}$/);
      // correspondentes distintos nunca podem exceder os pontos daquela IF
      expect(p.correspondentes).toBeLessThanOrEqual(p.pontos);
      expect(p.municipios).toBeGreaterThan(0);
    }
    // o mesmo estabelecimento serve várias IFs: somar instituições superestima
    expect(c.limitacoes.join(" ")).toMatch(/superestima/i);
  });

  it("escopo declara que contratante não é grupo econômico", () => {
    expect(c.escopo).toMatch(/CONTRATANTE/);
    expect(c.escopo).toMatch(/financeira/i);
    expect(c.escopo).toMatch(/nada é consolidado por grupo/i);
    expect(c.limitacoes.join(" ")).toMatch(/3\.954|serviço prestado varia/i);
  });

  it("a aba e a página da IF publicam correspondentes sem somá-los à rede própria", () => {
    const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");
    expect(app).toContain("Correspondentes no País");
    expect(app).toContain("Contratante não é grupo");
    expect(app).toContain("Correspondentes contratados"); // cartão da página de IF
    expect(app).toContain("(O.correspondentes || {}).por_cnpj8");
  });
});

describe("empregados (CVM/FRE)", () => {
  const comEmpregados = g.instituicoes.filter((i: any) => i.empregados);

  it("soma fecha: total = liderança + não-liderança = soma das regiões", () => {
    for (const inst of comEmpregados) {
      for (const p of inst.empregados.serie) {
        expect(p.total, `${inst.id} ${p.ref}`).toBe(p.lideranca + p.nao_lideranca);
        const somaRegioes = Object.values(p.regioes).reduce(
          (a: number, b) => a + (b as number), 0);
        expect(somaRegioes, `${inst.id} ${p.ref} regiões`).toBe(p.total);
      }
    }
  });

  it("série ordenada por data de referência, sem duplicata", () => {
    for (const inst of comEmpregados) {
      const refs = inst.empregados.serie.map((p: any) => p.ref);
      expect([...refs].sort()).toEqual(refs);
      expect(new Set(refs).size).toBe(refs.length);
    }
  });

  it("escopo declarado em toda série", () => {
    for (const inst of comEmpregados) {
      expect(inst.empregados.escopo, inst.id).toContain("FRE");
      expect(inst.empregados.nivel).toBe("A");
    }
  });

  it("variação acima do limiar sempre carrega flag", () => {
    for (const inst of comEmpregados) {
      for (const p of inst.empregados.serie) {
        if (p.var_aa_pct !== null && Math.abs(p.var_aa_pct) > 30) {
          const temFlag = g.flags.some(
            (f: any) => f.instituicao === inst.nome && f.indicador === "empregados");
          expect(temFlag, `${inst.id}: var ${p.var_aa_pct}% sem flag`).toBe(true);
        }
      }
    }
  });

  it("sanidade: Itaú declara dezenas de milhares de empregados", () => {
    const itau = g.instituicoes.find((i: any) => i.id === "itau");
    const ultimo = itau.empregados.serie.at(-1);
    expect(ultimo.total).toBeGreaterThan(50000);
    expect(ultimo.total).toBeLessThan(200000);
  });
});

describe("rede de agências (BCB/ESTBAN)", () => {
  const comRede = g.instituicoes.filter((i: any) => i.rede);

  it("série mensal ordenada; agências e municípios não negativos", () => {
    for (const inst of comRede) {
      const meses = inst.rede.serie.map((p: any) => p.mes);
      expect([...meses].sort()).toEqual(meses);
      for (const p of inst.rede.serie) {
        expect(p.agencias, `${inst.id} ${p.mes}`).toBeGreaterThanOrEqual(0);
        expect(p.municipios, `${inst.id} ${p.mes}`).toBeGreaterThanOrEqual(0);
        expect(p.municipios).toBeLessThanOrEqual(5570);
      }
    }
  });

  it("atual é o último ponto e var_12m confere com a série", () => {
    for (const inst of comRede) {
      const serie = inst.rede.serie;
      expect(inst.rede.atual).toEqual(serie.at(-1));
      if (inst.rede.var_12m !== null) {
        const [ano, mes] = inst.rede.atual.mes.split("-");
        const ref = serie.find((p: any) => p.mes === `${Number(ano) - 1}-${mes}`);
        expect(ref, inst.id).toBeTruthy();
        expect(inst.rede.var_12m).toBe(inst.rede.atual.agencias - ref.agencias);
      }
    }
  });

  it("queda de rede acima do limiar sempre carrega flag", () => {
    for (const inst of comRede) {
      if (inst.rede.var_12m_pct !== null && inst.rede.var_12m_pct < -15) {
        const temFlag = g.flags.some(
          (f: any) => f.instituicao === inst.nome && f.indicador === "rede");
        expect(temFlag, `${inst.id}: queda ${inst.rede.var_12m_pct}% sem flag`).toBe(true);
      }
    }
  });

  it("Caixa entra só com rede — ausência nas fontes CVM não vira zero", () => {
    const caixa = g.instituicoes.find((i: any) => i.id === "caixa");
    expect(caixa.listada).toBe(false);
    expect(caixa.rede.serie.length).toBeGreaterThan(12);
    expect(caixa.empregados).toBeNull();
    expect(caixa.auditor).toBeNull();
  });

  it("mapa geral por CNPJ-raiz cobre o SFN e confere com o agregado", () => {
    const mapa = g.rede_por_cnpj8;
    const bancos = Object.keys(mapa);
    expect(bancos.length).toBeGreaterThan(80);
    const somaMapa = bancos.reduce((s, c) => s + mapa[c].agencias, 0);
    expect(somaMapa).toBe(g.sfn.rede.serie.at(-1).agencias);
    for (const c of bancos) {
      expect(c).toMatch(/^\d{8}$/);
      expect(mapa[c].agencias).toBeGreaterThan(0);
    }
  });

  it("código IF.data: presente só quando verificado; join do piloto consistente", () => {
    for (const inst of g.instituicoes) {
      if (inst.cod_ifdata) expect(inst.cod_ifdata).toMatch(/^(C\d{7}|\d{8})$/);
    }
    // BRB, Alfa e BMI não constam do universo de páginas do IF.data no corte
    for (const id of ["brb", "alfa", "bmi"]) {
      expect(g.instituicoes.find((i: any) => i.id === id).cod_ifdata, id).toBeNull();
    }
    expect(g.instituicoes.find((i: any) => i.id === "itau").cod_ifdata).toBe("C0010069");
  });

  it("agregado do SFN: série ordenada, com bancos e municípios plausíveis", () => {
    const serie = g.sfn.rede.serie;
    expect(serie.length).toBeGreaterThanOrEqual(12);
    const meses = serie.map((p: any) => p.mes);
    expect([...meses].sort()).toEqual(meses);
    for (const p of serie) {
      expect(p.agencias).toBeGreaterThan(5000);
      expect(p.bancos).toBeGreaterThan(50);
      expect(p.municipios).toBeGreaterThan(2000);
      expect(p.municipios).toBeLessThanOrEqual(5570);
    }
  });
});

describe("auditoria (CVM/FCA)", () => {
  it("histórico ordenado e vigente sem data de fim", () => {
    for (const inst of g.instituicoes.filter((i: any) => i.auditor)) {
      const inicios = inst.auditor.historico.map((h: any) => h.inicio);
      expect([...inicios].sort()).toEqual(inicios);
      if (inst.auditor.vigente) {
        expect(inst.auditor.vigente.nome.length).toBeGreaterThan(3);
      }
    }
  });
});

describe("flags", () => {
  it("toda flag é completa e aponta instituição existente", () => {
    const nomes = new Set(g.instituicoes.map((i: any) => i.nome));
    for (const f of g.flags) {
      expect(nomes.has(f.instituicao), f.instituicao).toBe(true);
      expect(["empregados", "rede", "auditoria"]).toContain(f.indicador);
      expect(f.detalhe.length).toBeGreaterThan(20);
    }
  });
});

describe("síntese citável (página de imprensa)", () => {
  it("todo item tem nível A, fonte, URL https e exibição pronta", () => {
    expect(g.sintese.length).toBeGreaterThanOrEqual(3);
    for (const s of g.sintese) {
      expect(s.nivel, s.id).toBe("A");
      expect(s.url, s.id).toMatch(/^https:\/\//);
      expect(["oficial", "calculado"]).toContain(s.status);
      expect(s.exibir.length, s.id).toBeGreaterThan(0);
      expect(s.conceito.length, s.id).toBeGreaterThan(30);
      expect(s.data_ref, s.id).toBeTruthy();
    }
  });

  it("o total de agências da síntese confere com a série do SFN", () => {
    const item = g.sintese.find((s: any) => s.id === "agencias_sfn");
    expect(item.valor).toBe(g.sfn.rede.serie.at(-1).agencias);
  });
});
