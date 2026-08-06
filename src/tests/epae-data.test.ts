/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * EPAE — fluxos Pix da seção CNAE de artes, cultura, esporte e recreação.
 *
 * A invariante central desta série é editorial, não numérica: ela entra no
 * painel de bets sem ser uma série de bets. Os testes abaixo protegem essa
 * distinção — nenhuma chave, rótulo ou agregado pode transformar a seção
 * inteira da CNAE em "volume de apostas" — e as invariantes usuais da casa:
 * série sem interpolação, ano incompleto nunca anualizado, derivação
 * declarada, ausência que não vira zero.
 */
const g = JSON.parse(readFileSync(join(process.cwd(), "public/obs/data/gold/epae.json"), "utf-8"));
const obs: any[] = g.serie.obs;

describe("epae.json: fonte e escopo", () => {
  it("fonte oficial do BCB, nível A, com hash do arquivo coletado", () => {
    expect(g.fonte.url).toMatch(/^https:\/\/www\.bcb\.gov\.br\//);
    expect(g.fonte.pagina).toMatch(/^https:\/\/www\.bcb\.gov\.br\//);
    expect(g.fonte.nivel).toBe("A");
    expect(g.fonte.instrumento).toMatch(/Pix/);
    expect(g.fonte.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(g.fonte.coletado_em).toBeTruthy();
  });

  it("a seção é declarada como seção da CNAE, não como setor de apostas", () => {
    expect(g.secao.codigo).toBe("R");
    expect(g.secao.rotulo).toMatch(/artes, cultura, esporte e recrea/i);
    expect(g.secao.abrange).toMatch(/academias|clubes|cinemas/i);
    // o aviso precisa negar explicitamente a leitura "isto é bets"
    expect(g.aviso).toMatch(/não é uma série de apostas|SEÇÃO INTEIRA/i);
    expect(g.limitacoes.join(" ")).toMatch(/nenhuma linha desta série pode ser lida como/i);
    expect(g.limitacoes.join(" ")).toMatch(/não separa operadores autorizados/i);
  });

  it("limites do SPI e da revisão declarados (o dado não se diz mais do que é)", () => {
    const texto = g.limitacoes.join(" ") + " " + g.revisao;
    expect(texto).toMatch(/SPI/);
    expect(texto).toMatch(/devolu|saque/i);
    expect(texto).toMatch(/m-4|quatro últimos meses/i);
    expect(texto).toMatch(/fluxo.*não.*perda|não é perda/i);
  });
});

describe("epae.json: série mensal sem invenção", () => {
  it("meses estritamente crescentes, únicos e contíguos (sem interpolar buraco)", () => {
    const refs = obs.map((o) => o.ref);
    expect(refs).toEqual([...refs].sort());
    expect(new Set(refs).size).toBe(refs.length);
    for (const r of refs) expect(r).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
    const mes = (r: string) => Number(r.slice(0, 4)) * 12 + Number(r.slice(5, 7));
    for (let i = 1; i < refs.length; i++) expect(mes(refs[i]) - mes(refs[i - 1])).toBe(1);
    expect(refs[0]).toBe("2020-11"); // início declarado pelo BC
    expect(g.cobertura.meses).toBe(obs.length);
    expect(g.cobertura.inicio).toBe(refs[0]);
    expect(g.cobertura.fim).toBe(refs[refs.length - 1]);
  });

  it("cada mês tem os dois sentidos observados e o líquido é a subtração declarada", () => {
    for (const o of obs) {
      expect(o.pf_para_secao, o.ref).toBeGreaterThan(0);
      expect(o.secao_para_pf, o.ref).toBeGreaterThan(0);
      expect(o.tx_pf_para_secao, o.ref).toBeGreaterThan(0);
      expect(o.liquido).toBeCloseTo(o.pf_para_secao - o.secao_para_pf, 2);
      // a seção nunca pode exceder o total pago por PF a pessoas jurídicas
      expect(o.pf_para_pj_total).toBeGreaterThan(o.pf_para_secao);
    }
    const conceitos = g.conceitos.map((c: any) => c.termo);
    expect(conceitos).toContain("liquido");
    expect(g.conceitos.find((c: any) => c.termo === "liquido").def).toMatch(/deriva|menos/i);
  });

  it("nenhum conceito de aposta é imputado à série", () => {
    // "abrange" cita apostas de propósito (é a lista do que a seção R contém);
    // o que não pode acontecer é uma CHAVE ou rótulo de unidade virar métrica de bets
    const chaves = Object.keys(obs[0]).join(" ") + " " + JSON.stringify(g.unidades)
      + " " + g.secao.codigo + " " + g.secao.rotulo + " " + g.titulo;
    expect(chaves).not.toMatch(/bet|aposta|ggr|apostador/i);
    expect(g.secao.abrange).toMatch(/apostas/i); // a seção contém apostas — e muito mais
  });
});

describe("epae.json: agregados anuais", () => {
  it("ano incompleto é marcado e nunca anualizado", () => {
    for (const a of g.anuais) {
      expect(a.meses).toBeGreaterThan(0);
      expect(a.completo).toBe(a.meses === 12);
      expect(a.liquido).toBeCloseTo(a.pf_para_secao - a.secao_para_pf, 1);
    }
    // a soma anual tem de bater com a soma dos meses daquele ano
    for (const a of g.anuais) {
      const doAno = obs.filter((o) => o.ref.startsWith(String(a.ano)));
      expect(doAno.length).toBe(a.meses);
      const soma = doAno.reduce((s, o) => s + o.pf_para_secao, 0);
      expect(a.pf_para_secao).toBeCloseTo(soma, 1);
    }
  });

  it("observado e atribuído aparecem separados, com nível e derivação de cada um", () => {
    const c = g.comparacao;
    expect(c).toBeTruthy();
    expect(c.observado.nivel).toBe("A");
    expect(c.observado.status).toBe("calculado");
    expect(c.observado.derivacao).toMatch(/soma dos 12 meses/i);
    const a2025 = g.anuais.find((a: any) => a.ano === c.ano);
    expect(c.observado.valor).toBeCloseTo(a2025.liquido, 2);
    expect(c.atribuido_estudo.nivel).toBe("D"); // estimativa privada/institucional, nunca A
    expect(c.atribuido_estudo.status).toBe("estimativa");
    expect(c.atribuido_estudo.derivacao).toMatch(/contrafactual|ARIMA/i);
    expect(c.atribuido_estudo.url).toMatch(/^https:\/\//);
    expect(c.leitura).toMatch(/nenhum dos dois é medição de perda com apostas/i);
    // o observado não pode ser publicado como se fosse a estimativa do estudo
    expect(c.observado.valor).not.toBe(c.atribuido_estudo.valor);
  });
});

describe("epae: integração com a plataforma", () => {
  it("view de bets carrega o arquivo e a aba renderiza o card", () => {
    const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");
    expect(app).toContain('bets: ["bets", "epae"]');
    expect(app).toContain("state.data.epae");
    expect(app).toContain("window.epaeCSV");
    // o card precisa negar a leitura "série de bets" no próprio texto
    const card = app.slice(app.indexOf("8b · EPAE"), app.indexOf("9 · evidências científicas"));
    expect(card).toMatch(/Esta não é uma série de apostas/);
    expect(card).toMatch(/badge\("observado"\)/);
  });

  it("pipeline registra coletor e builder do epae.json", () => {
    const run = readFileSync(join(process.cwd(), "pipeline/run.py"), "utf-8");
    expect(run).toContain('("epae", epae)');
    const gold = readFileSync(join(process.cwd(), "pipeline/gold.py"), "utf-8");
    expect(gold).toContain("epae_mod.build(con)");
    const src = readFileSync(join(process.cwd(), "pipeline/sources/epae.py"), "utf-8");
    // rótulos exatos do BC: se mudarem, o coletor falha alto em vez de publicar vazio
    expect(src).toContain("Tabelas_especiais/EPAE.xlsx");
    expect(src).toMatch(/raise RuntimeError/);
  });

  it("FONTES_BETS registra a fonte como integrada", () => {
    const doc = readFileSync(join(process.cwd(), "FONTES_BETS.md"), "utf-8");
    expect(doc).toMatch(/EPAE \(Estatísticas de Pagamentos por Atividade Econômica\)/);
    expect(doc).toMatch(/\*\*INTEGRADA\*\*/);
  });
});
