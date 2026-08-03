/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Dívida Ativa da União (PGFN). O teste que mais importa aqui é negativo.
 *
 * A fonte publica nome completo do devedor — inclusive de pessoa física —, CPF
 * mascarado e CNPJ inteiro. É publicação legítima da PGFN sob a LAI, e nada disso
 * pode atravessar para o Observatório. O primeiro bloco varre o gold procurando
 * documento, nome próprio e número de inscrição, e reprova se achar.
 *
 * Depois vêm as armadilhas da fonte, todas verificadas em docs/AUDITORIA_PGFN.md:
 * corresponsáveis repetem o valor integral, a caixa de TIPO_DEVEDOR muda entre
 * conjuntos, UF traz um valor fora do domínio, e a série por safra é sobrevivência
 * e não fluxo.
 */
const G = "public/obs/data/gold/";
const P = JSON.parse(readFileSync(join(process.cwd(), G + "pgfn.json"), "utf-8"));
const bruto = readFileSync(join(process.cwd(), G + "pgfn.json"), "utf-8");
const coletor = readFileSync(join(process.cwd(), "pipeline/sources/pgfn.py"), "utf-8");

describe("privacidade: nenhum dado pessoal atravessa para o gold", () => {
  it("não há CPF nem CNPJ, mascarado ou completo", () => {
    expect(bruto).not.toMatch(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);   // CNPJ
    expect(bruto).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);          // CPF
    expect(bruto).not.toMatch(/X{3}\d{3}\.\d{3}X{2}/);               // CPF mascarado da fonte
  });

  it("não há número de inscrição em dívida ativa", () => {
    // inscrições têm 11+ dígitos corridos; valores monetários no gold são number, não string
    expect(bruto).not.toMatch(/"\d{11,}"/);
    expect(bruto).not.toMatch(/FG[A-Z]{2}\d{9}/);                    // padrão do FGTS
  });

  it("o gold declara a política de privacidade em texto", () => {
    expect(P.privacidade).toMatch(/nome/i);
    expect(P.privacidade).toMatch(/descartad|não é lido|não retid/i);
    expect(P.privacidade).toMatch(/contagens e somas/i);
  });

  it("o coletor não acumula as colunas pessoais em lugar nenhum", () => {
    // as colunas só podem aparecer na lista que as declara descartáveis
    for (const col of ["NOME_DEVEDOR", "CPF_CNPJ"]) {
      const usos = coletor.split("\n").filter((l) => l.includes(col) && !l.trim().startsWith("#"));
      expect(usos.length, `${col} aparece em código executável: ${usos.join(" | ")}`).toBe(1);
      expect(usos[0]).toContain("COLUNAS_PESSOAIS");
    }
  });

  it("devedores distintos é declarado indisponível, não estimado", () => {
    const txt = JSON.stringify(P.limitacoes);
    expect(txt).toMatch(/devedores distintos/i);
    expect(txt).toMatch(/reter identificadores/i);
    expect(txt).toMatch(/Indisponível, não estimad/i);
  });
});

describe("armadilha do corresponsável: cada inscrição conta uma vez", () => {
  it("o total de inscrições é menor que o total de linhas do arquivo", () => {
    expect(P.totais.inscricoes).toBeLessThan(P.totais.linhas_no_arquivo);
    expect(P.totais.linhas_de_corresponsavel).toBe(P.totais.linhas_no_arquivo - P.totais.inscricoes);
  });

  it("o painel publica o tamanho da armadilha, não só evita cair nela", () => {
    expect(P.totais.valor_repetido_por_corresponsavel).toBeGreaterThan(0);
    expect(P.totais.valor_se_somasse_todas_as_linhas)
      .toBeCloseTo(P.totais.valor + P.totais.valor_repetido_por_corresponsavel, 0);
    expect(P.totais.fator_de_inflacao).toBeGreaterThan(1.5);
  });

  it("o coletor normaliza a caixa antes de comparar TIPO_DEVEDOR", () => {
    // sem .upper() o previdenciário e o FGTS ('Principal') zerariam em silêncio
    expect(coletor).toMatch(/TIPO_DEVEDOR"\]\]\.strip\(\)\.upper\(\) != "PRINCIPAL"/);
  });

  it("previdenciário e FGTS de fato não trazem corresponsáveis", () => {
    for (const id of ["previdenciario", "fgts"]) {
      const c = P.conjuntos.find((x: any) => x.id === id);
      if (!c?.disponivel) continue;
      expect(c.linhas_de_corresponsavel, id).toBe(0);
      expect(c.valor_repetido_por_corresponsavel, id).toBe(0);
    }
  });
});

describe("coerência dos agregados", () => {
  it("a soma dos conjuntos reconcilia com o total", () => {
    const disp = P.conjuntos.filter((c: any) => c.disponivel);
    expect(disp.reduce((s: number, c: any) => s + c.inscricoes, 0)).toBe(P.totais.inscricoes);
    expect(disp.reduce((s: number, c: any) => s + c.valor, 0)).toBeCloseTo(P.totais.valor, 0);
  });

  it("PF mais PJ fecha o total de cada conjunto", () => {
    for (const c of P.conjuntos.filter((x: any) => x.disponivel)) {
      expect(c.pf.inscricoes + c.pj.inscricoes, c.nome).toBe(c.inscricoes);
      expect(c.pf.valor + c.pj.valor, c.nome).toBeCloseTo(c.valor, 0);
    }
  });

  it("o mapa soma o mesmo total e as participações fecham 100%", () => {
    expect(P.mapa.reduce((s: number, m: any) => s + m.inscricoes, 0)).toBe(P.totais.inscricoes);
    const soma = P.mapa.reduce((s: number, m: any) => s + (m.part_br || 0), 0);
    expect(Math.abs(soma - 100)).toBeLessThan(0.5);
  });

  it("cada corte transversal cobre o valor inteiro — não são amostras", () => {
    for (const [nome, corte] of [["situação", P.situacao], ["ajuizado", P.ajuizado], ["faixas", P.faixas]] as any) {
      const soma = corte.reduce((s: number, c: any) => s + c.valor, 0);
      expect(Math.abs(soma / P.totais.valor - 1), nome).toBeLessThan(0.001);
    }
  });

  it("nenhuma contagem ou valor negativo", () => {
    for (const m of P.mapa) {
      expect(m.inscricoes, m.uf).toBeGreaterThanOrEqual(0);
      expect(m.valor, m.uf).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("UF fora do domínio não vira estado nem some", () => {
  it("existe a categoria explícita 'indefinida' quando a fonte traz lixo", () => {
    const indef = P.mapa.find((m: any) => m.uf === "indefinida");
    const total = P.conjuntos.filter((c: any) => c.disponivel)
      .reduce((s: number, c: any) => s + c.uf_fora_do_dominio, 0);
    if (total > 0) {
      expect(indef, "há UF fora do domínio mas nenhuma linha 'indefinida' no mapa").toBeTruthy();
      expect(indef.inscricoes).toBe(total);
      expect(indef.cod, "sem código do IBGE, então não é desenhada no mapa").toBeFalsy();
    }
  });

  it("as 27 UFs reais trazem nome, região e código do IBGE", () => {
    const reais = P.mapa.filter((m: any) => m.uf !== "indefinida");
    expect(reais.length).toBe(27);
    for (const m of reais) {
      expect(m.nome, m.uf).toBeTruthy();
      expect(m.regiao, m.uf).toBeTruthy();
      expect(m.cod, m.uf).toBeTruthy();
    }
  });

  it("per capita só existe para pessoa física e onde há população", () => {
    for (const m of P.mapa) {
      if (m.insc_pf_por_mil_hab != null) {
        expect(m.populacao, m.uf).toBeGreaterThan(0);
        expect(m.insc_pf_por_mil_hab).toBeCloseTo(1000 * m.pf.n / m.populacao, 1);
      }
    }
  });
});

describe("safra é sobrevivência, não fluxo", () => {
  it("o aviso acompanha o dado, no gold e no catálogo", () => {
    expect(P.aviso_safra).toMatch(/não fluxo|estoque remanescente/i);
    expect(P.aviso_safra).toMatch(/desaparecem|quitadas/i);
    const c = P.catalogo.find((x: any) => x.id === "safra");
    expect(c.limitacoes).toBe(P.aviso_safra);
  });

  it("a série é monotônica no sentido do viés — safras recentes maiores", () => {
    const anos = P.safras.filter((a: any) => a.ano >= "2010" && a.ano <= "2024");
    const primeiro = anos[0].inscricoes, ultimo = anos[anos.length - 1].inscricoes;
    expect(ultimo, "o viés de sobrevivência deveria inflar as safras recentes").toBeGreaterThan(primeiro);
  });

  it("PF mais PJ fecha cada safra", () => {
    for (const a of P.safras) expect(a.pf + a.pj, a.ano).toBe(a.inscricoes);
  });
});

describe("universo separado do crédito do SFN", () => {
  it("o gold avisa para não somar com SCR.data nem SGS", () => {
    expect(P.aviso_universo).toMatch(/não some/i);
    expect(P.aviso_universo).toMatch(/SCR\.data/);
    expect(P.aviso_universo).toMatch(/SGS/);
  });

  it("a página exibe o aviso antes do primeiro número", () => {
    const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");
    const i = app.indexOf("function renderPgfn(");
    const corpo = app.slice(i, app.indexOf("\nfunction round2", i));
    expect(corpo).toContain("D.aviso_universo");
    expect(corpo.indexOf("armadilha")).toBeLessThan(corpo.indexOf("+ kpis"));
  });

  it("o catálogo metodológico está completo", () => {
    for (const c of P.catalogo) {
      for (const campo of ["id", "nome", "definicao", "formula", "unidade", "fonte", "nivel", "cobertura", "limitacoes", "versao"]) {
        expect(c[campo], `${c.id}.${campo}`).toBeTruthy();
      }
    }
  });
});

describe("coleta: trimestral, sem materializar 9 GB", () => {
  it("é idempotente por trimestre e conjunto", () => {
    expect(coletor).toMatch(/SELECT 1 FROM pgfn_execucao WHERE trimestre=\? AND conjunto=\?/);
    expect(coletor).toContain("já absorvido");
  });

  it("descomprime em fluxo — nada de gravar o ZIP ou o CSV em disco", () => {
    expect(coletor).toContain("zlib.decompressobj(-15)");
    expect(coletor).not.toMatch(/open\([^)]*, ["']wb["']\)/);
    expect(coletor).toMatch(/def _linhas_do_membro/);
  });

  it("lê o índice de trimestres do próprio servidor, sem lista fixa no código", () => {
    expect(coletor).toContain("def trimestres_disponiveis");
    expect(P.trimestres_absorvidos.length).toBeGreaterThan(0);
    expect(P.trimestre).toMatch(/^\d{4}_trimestre_\d{2}$/);
    expect(P.data_base).toMatch(/^\d{4}-\d{2}$/);
  });
});
