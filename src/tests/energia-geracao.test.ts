import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import GeracaoRestricoesPage from "@/app/setor-eletrico/geracao/restricoes/page";
import GeracaoCapacidadePage from "@/app/setor-eletrico/geracao/capacidade/page";
import { lerCaminho, pontoNaRegiao, type CamadaGeo } from "@/lib/energia/geo";
import {
  PAINEIS_GERACAO,
  deContraido,
  histogramaFc,
  linhasCapacidade,
  linhasMmgdCapacidade,
  linhasRazoes12m,
  linhasRestricaoMensal,
  linhasSigaHistorico,
  pontosUsinas,
  respostaCapacidade,
  respostaRestricao,
  rotaPainel,
  situacaoMensal,
} from "@/lib/energia/geracao";
import type { GoldGeracaoDetalhe } from "@/lib/energia/tipos-geracao";

/**
 * Geração, P023 (renováveis restringidas) e P024 (capacidade e utilização): textos derivados
 * dos números da gold (mudar o número muda o texto), energia e potência separadas, ausência
 * que não vira zero, coordenadas do ONS na UF que o próprio ONS informa, correspondência
 * temporal sem soma de universos, e as duas páginas renderizadas no servidor com a anatomia
 * da seção 7.2, sem data crua e abaixo da meta de peso.
 */
const raiz = process.cwd();
const G: GoldGeracaoDetalhe = JSON.parse(readFileSync(join(raiz, "public/energia/gold/geracao_detalhe.json"), "utf-8"));
const UF: CamadaGeo = JSON.parse(readFileSync(join(raiz, "public/energia/geo/uf.json"), "utf-8"));
const clone = <T,>(x: T): T => structuredClone(x);
const eol = G.restricoes.eolica!;
const cap = G.capacidade!;

describe("P023: restrições", () => {
  it("razão sem energia não gerada nos 12 meses diz isso na descrição e não parece medida sem dado (D033)", () => {
    for (const f of ["eolica", "solar"] as const) {
      const r = G.restricoes[f]!;
      for (const l of linhasRazoes12m(r)) {
        const x = r.ultimos_12m!.por_razao.find((z) => z.razao === l.id)!;
        if (x.mwh === 0) {
          expect(l.rotulo_oficial, `${f} ${l.id}`).toContain("Nenhuma energia não gerada com esta razão nos 12 meses");
          expect(l.gwh).toBe(0);
        } else expect(l.rotulo_oficial, `${f} ${l.id}`).toBe(x.rotulo);
      }
    }
    // a soma das origens é o total: sem energia, não há origem a classificar
    const parecer = linhasRazoes12m(eol).find((l) => l.id === "PAR")!;
    expect(parecer.gwh).toBe(0);
    expect(parecer.pct).toBe(0);
  });

  it("a resposta cita energia, taxa com o denominador, razões e o maior corte como potência; mudar o número muda o texto", () => {
    const u = eol.ultimos_12m!;
    const t = respostaRestricao(eol);
    expect(t).toContain("verificada mais não gerada");
    expect(t).toContain("(potência, não energia)");
    expect(t).toContain(`${u.usinas_com_restricao.toLocaleString("pt-BR")} de ${u.usinas_no_universo.toLocaleString("pt-BR")}`);
    const g = clone(eol);
    g.ultimos_12m!.taxa_pct = 12.34;
    expect(respostaRestricao(g)).toContain("12,3% do que essas usinas");
    expect(respostaRestricao(g)).not.toBe(t);
  });

  it("a série mensal soma as razões no total publicado e mantém a potência fora da energia", () => {
    const { linhas, razoes } = linhasRestricaoMensal(eol);
    expect(linhas).toHaveLength(eol.mensal_sin.meses.length);
    for (const l of linhas) {
      const soma = razoes.reduce((s, z) => s + (l[z] ?? 0), 0);
      if (l.total_gwh !== null) expect(soma, l.m).toBeCloseTo(l.total_gwh, 1);
    }
    // a taxa é a da gold, não recalculada: não gerada ÷ (verificada + não gerada)
    const i = linhas.length - 2;
    const ms = eol.mensal_sin;
    const esperada = (100 * ms.energia_nao_gerada_total_mwh[i]!) / (ms.geracao_verificada_mwh[i]! + ms.energia_nao_gerada_total_mwh[i]!);
    expect(linhas[i].taxa_pct!).toBeCloseTo(esperada, 1);
  });

  it("cada usina com coordenada cai numa UF da malha do IBGE; fora da UF informada, só conjunto e em UF vizinha", () => {
    const aneis = new Map(UF.features.map((x) => [x.uf, lerCaminho(x.d)]));
    // UFs vizinhas onde a subestação coletora de um conjunto do Nordeste pode ficar
    const vizinhas: Record<string, string[]> = { PB: ["RN", "PE", "CE"], RN: ["CE", "PB"], CE: ["RN", "PB", "PE", "PI"], PE: ["PB", "AL", "BA", "PI", "CE"], BA: ["PE", "PI", "MG", "SE", "AL", "TO", "GO"], PI: ["CE", "PE", "BA", "MA", "TO"] };
    for (const f of ["eolica", "solar"] as const) {
      const r = G.restricoes[f]!;
      const { pontos } = pontosUsinas(r.usinas_12m, UF.projecao);
      expect(pontos.length, f).toBe(r.usinas_12m.filter((u) => u.lat !== null && u.lon !== null).length);
      let fora = 0;
      for (const p of pontos) {
        const onde = UF.features.filter((x) => pontoNaRegiao([p.x, p.y], aneis.get(x.uf)!)).map((x) => x.uf);
        expect(onde.length, `${f} ${p.id}`).toBe(1);
        if (p.uf && onde[0] !== p.uf) {
          fora++;
          expect(p.id.startsWith("CJU_"), `${f} ${p.id}`).toBe(true);
          expect(vizinhas[p.uf] ?? [], `${f} ${p.id}: ${p.uf} → ${onde[0]}`).toContain(onde[0]);
        }
      }
      expect(fora, f).toBeLessThanOrEqual(Math.ceil(pontos.length * 0.05));
    }
  });
});

describe("P024: capacidade e utilização", () => {
  it("a resposta usa o retrato, o fator de capacidade dos 12 meses e deixa a MMGD fora da conta", () => {
    const t = respostaCapacidade(cap);
    expect(t).toContain(cap.retrato.total_mw!.toLocaleString("pt-BR", { maximumFractionDigits: 0 }));
    expect(t).toContain("não entra nessa soma nem no fator de capacidade");
    const g = clone(cap);
    g.ultimos_12m!.por_categoria.find((x) => x.categoria === "eolica")!.fator_capacidade_pct = 41.06;
    expect(respostaCapacidade(g)).toContain("eólica 41,1%");
  });

  it("a tabela por categoria copia o retrato e os 12 meses; a ANEEL fica em coluna própria, nunca somada", () => {
    const linhas = linhasCapacidade(cap);
    const soma = linhas.reduce((s, l) => s + (l.mw ?? 0), 0);
    expect(soma).toBeCloseTo(cap.retrato.total_mw! - (cap.retrato.nao_mapeadas_mw ?? 0), 0);
    for (const l of linhas) {
      const u = cap.ultimos_12m!.por_categoria.find((x) => x.categoria === l.id);
      expect(l.fc_pct, l.id).toBe(u?.fator_capacidade_pct ?? null);
      // o denominador médio nunca passa da potência média em operação
      if (l.capacidade_hora_media_mw !== null && l.potencia_media_12m_mw !== null) expect(l.capacidade_hora_media_mw, l.id).toBeLessThanOrEqual(l.potencia_media_12m_mw + 1e-6);
    }
  });

  it("histograma: as classes de 10 pontos da gold, com 100% ou mais fora das classes", () => {
    for (const u of cap.ultimos_12m!.por_categoria) {
      const h = histogramaFc(u);
      if (!u.distribuicao_usinas) continue;
      expect(h, u.categoria).not.toBeNull();
      const nas = h!.classes.reduce((s, c) => s + c.contagem, 0) + h!.foraDasClasses.acima;
      expect(nas, u.categoria).toBe(u.histograma_10pp.reduce((s, n) => s + n, 0));
    }
  });

  it("correspondência temporal: ANEEL e ONS na mesma data; MMGD cadastrada e estimada lado a lado, sem razão entre elas", () => {
    const sh = cap.contexto.siga_historico!;
    const l = linhasSigaHistorico(sh, "eolica");
    expect(l.map((x) => x.m)).toEqual(sh.datas);
    for (const x of l) if (x.aneel_mw && x.ons_mw) expect(x.ons_pct_da_aneel!).toBeCloseTo((100 * x.ons_mw) / x.aneel_mw, 0);
    const mm = linhasMmgdCapacidade(cap.contexto.mmgd!.mensal!);
    expect(Object.keys(mm[0])).not.toContain("fator_capacidade_pct");
    expect(mm.every((x) => x.potencia_mw === null || x.potencia_mw > x.geracao_mwmed!)).toBe(true);
  });
});

describe("textos e navegação da Geração", () => {
  it("aviso de defasagem com a preposição contraída", () => {
    expect(deContraido("as restrições de eólicas")).toBe("das restrições de eólicas");
    expect(deContraido("a térmica por motivo de despacho")).toBe("da térmica por motivo de despacho");
    expect(deContraido("o fator de capacidade mensal")).toBe("do fator de capacidade mensal");
    expect(deContraido("fontes mensais")).toBe("de fontes mensais");
    expect(situacaoMensal("2026-07", "2026-10-01T07:00:00Z", "as restrições").texto).toContain("o último mês completo das restrições é jul/2026");
  });

  it("os quatro painéis publicados, cada um com a sua rota", () => {
    expect(PAINEIS_GERACAO.every((p) => p.publicado)).toBe(true);
    for (const p of PAINEIS_GERACAO) expect(existsSync(join(raiz, "src/app", rotaPainel(p.id), "page.tsx")), p.id).toBe(true);
  });
});

describe("páginas P023 e P024", () => {
  const paginas = {
    p023: renderToStaticMarkup(createElement(GeracaoRestricoesPage)),
    p024: renderToStaticMarkup(createElement(GeracaoCapacidadePage)),
  };

  it("anatomia da seção 7.2: resposta, recorte, prova, tabela, download, link e próxima pergunta", () => {
    for (const [id, h] of Object.entries(paginas)) {
      expect(h, id).toContain(`data-resposta="${id}"`);
      for (const t of ["Período", "Universo", "Unidade", "Comprove este número", "Como interpretar", "O que não é possível concluir", "Copiar link deste painel", "Próxima pergunta", "Baixar os dados deste painel"]) {
        expect(h, `${id}: ${t}`).toContain(t);
      }
      expect(h, id).toContain('data-nivel="analisar"');
      expect(h, id).toContain('data-nivel="auditar"');
      expect(h, id).not.toContain("(em preparação)");
    }
  });

  it("sem valor de reserva, sem vazamento de objeto, sem data crua no texto e abaixo da meta de peso", () => {
    for (const [id, h] of Object.entries(paginas)) {
      expect(h, id).not.toMatch(/NaN|undefined|\[object Object\]/);
      const texto = h.replace(/<[^>]+>/g, " ");
      expect(texto, id).not.toMatch(/(^|[\s(])20\d\d[-/]\d\d([-/]\d\d)?(T[\d:]+Z?)?(?=[\s).,;]|$)/);
      // HTML do servidor abaixo de 330 KB; com as props dos clientes, abaixo dos ~600 KB da meta (seção 5.1)
      expect(Buffer.byteLength(h, "utf-8"), id).toBeLessThan(330 * 1024);
    }
  });

  it("P023 separa energia de potência e documenta o denominador; P024 não soma a ANEEL ao ONS", () => {
    expect(paginas.p023).toContain("Maior corte simultâneo numa meia hora do mês (potência, não energia)");
    expect(paginas.p023).toContain("Denominador: geração verificada mais a não gerada estimada");
    expect(paginas.p023).toContain("Restrição não é indisponibilidade da usina nem falta de vento ou de sol");
    expect(paginas.p024).toContain("não é somada nem comparada usina a usina");
    expect(paginas.p024).toContain("nunca são somadas nem divididas");
    expect(paginas.p024).not.toContain("contexto.siga_historico");
  });

  it("linguagem causal só negada", () => {
    for (const [id, h] of Object.entries(paginas)) {
      for (const m of Array.from(h.matchAll(/caus\w*/gi))) {
        const ctx = h.slice(Math.max(0, m.index! - 80), m.index! + 20).toLowerCase();
        expect(/nunca|não|nenhuma|sem |separa/.test(ctx), `${id}: ...${ctx}...`).toBe(true);
      }
    }
  });
});
