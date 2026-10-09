import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import GeracaoPage from "@/app/setor-eletrico/geracao/page";
import GeracaoRestricoesPage from "@/app/setor-eletrico/geracao/restricoes/page";
import GeracaoCapacidadePage from "@/app/setor-eletrico/geracao/capacidade/page";
import GeracaoTermicaPage from "@/app/setor-eletrico/geracao/termica/page";
import { dataBR, mesAno, num } from "@/lib/energia/formato";
import { lerCaminho, pontoNaRegiao, type CamadaGeo } from "@/lib/energia/geo";
import {
  CATEGORIAS,
  FRASE_CATEGORIA,
  PAINEIS_GERACAO,
  TOLERANCIA_SOMA_PP,
  coberturaMensal,
  comparacaoEntreJanelas,
  composicaoDaJanela,
  datasDoModulo,
  deContraido,
  fechamentoDaComposicao,
  fontePrincipalDaJanela,
  histogramaFc,
  inflexibilidadeSemNuclear,
  linhasCapacidade,
  linhasMmgdCapacidade,
  linhasRazoes12m,
  maioresFontes,
  minusculaPalavras,
  naturezaDaCategoria,
  partesDaNatureza,
  textoNatureza,
  linhasRestricaoMensal,
  linhasSigaHistorico,
  perguntaPainel,
  pontosUsinas,
  respostaCapacidade,
  respostaRestricao,
  rotaPainel,
  situacaoMensal,
  textoDozeMeses,
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

  it("minúscula no meio da frase poupa a sigla: ONS, MMGD, CMSE e Tipo III não viram ons, mmgd, cmse", () => {
    expect(minusculaPalavras("Previsão do ONS (grupos Tipo III)")).toBe("previsão do ONS (grupos tipo III)");
    expect(minusculaPalavras("Solar MMGD")).toBe("solar MMGD");
    expect(minusculaPalavras("Garantia de suprimento energético (decisão do CMSE)")).toBe("garantia de suprimento energético (decisão do CMSE)");
    const texto = textoNatureza({ verificada: 81.7, grupo_tipo3: 6.9, grupo_mmgd: 11.3 });
    expect(texto).toContain("previsão do ONS (grupos tipo III) 6,9%");
    expect(texto).toContain("estimativa do ONS (MMGD) 11,3%");
    expect(texto).not.toMatch(/\bons\b|\bmmgd\b/);
  });

  it("defasagem mensal em dias: ago/2026 processado em 01/10/2026 é o ritmo normal; jul/2026 é defasagem", () => {
    const ago = situacaoMensal("2026-08", "2026-10-01T10:00:00Z", "a térmica por motivo de despacho");
    expect(ago.defasada).toBe(false);
    expect(ago.texto).toContain("último mês completo ago/2026");
    const jul = situacaoMensal("2026-07", "2026-10-01T10:00:00Z", "a térmica por motivo de despacho");
    expect(jul.defasada).toBe(true);
    expect(jul.texto).toContain("encerrado 62 dias antes do processamento");
    expect(jul.texto).not.toMatch(/\d meses antes/);
  });

  it("variação de 12 meses: com categorias suprimidas, o total das demais acompanha o total completo (o sinal pode inverter)", () => {
    const c = G.matriz.comparacao_12m!;
    expect(Object.keys(c.variacao_suprimida).length).toBeGreaterThan(0);
    const texto = textoDozeMeses(c);
    expect(texto).toContain("−0,6%");
    expect(texto).toContain("Só com as demais categorias, o total varia +0,5%.");
    // sem categoria suprimida, o total completo já é o comparável e o texto não repete
    expect(textoDozeMeses({ ...c, variacao_suprimida: {} })).not.toContain("Só com as demais categorias");
    // a gold publica o total comparável e ele sai das mesmas médias (sem MMGD, sem as suprimidas)
    expect(c.variacao_total_comparavel_pct).toBe(0.5);
  });

  it("inflexibilidade térmica: a nuclear é quase toda inflexível e pesa na parcela; sem ela a parcela cai", () => {
    const r = inflexibilidadeSemNuclear(G.termica!.ultimos_12m)!;
    expect(r.nuclearInflexivelPct).toBeGreaterThan(99);
    expect(r.nuclearNaInflexibilidadePct).toBeCloseTo(35.1, 1);
    expect(r.semNuclearPct).toBeCloseTo(50.6, 1);
    const pct = G.termica!.ultimos_12m.por_motivo.find((m) => m.motivo === "inflexibilidade")!.pct!;
    expect(r.semNuclearPct).toBeLessThan(pct);
    expect(inflexibilidadeSemNuclear({ total_mwh: null, por_motivo: [], por_combustivel: [] })).toBeNull();
  });

  it("os quatro painéis publicados, cada um com a sua rota", () => {
    expect(PAINEIS_GERACAO.every((p) => p.publicado)).toBe(true);
    for (const p of PAINEIS_GERACAO) expect(existsSync(join(raiz, "src/app", rotaPainel(p.id), "page.tsx")), p.id).toBe(true);
  });
});

describe("P021 na abertura: composição completa, recorte das cinco maiores e comparação entre janelas", () => {
  const m = G.matriz;
  const mix30 = m.janelas.SIN["30d"]!;
  const mix12 = m.janelas.SIN["12m"]!;
  const soma = (xs: readonly { participacao: number }[]) => xs.reduce((t, l) => t + l.participacao, 0);

  it("a composição completa traz toda categoria com valor, da maior para a menor, com a participação publicada e sem linha para o que está ausente", () => {
    const c = composicaoDaJanela(m, "SIN", "30d", "com");
    const comValor = CATEGORIAS.filter((k) => mix30.participacao[k] !== null);
    expect(c.map((l) => l.id).sort()).toEqual([...comValor].sort());
    expect(c.length).toBe(11);
    for (let i = 1; i < c.length; i++) expect(c[i - 1].participacao).toBeGreaterThanOrEqual(c[i].participacao);
    // nenhum número novo: cada participação é a da gold, sem novo arredondamento, e a energia média também
    for (const l of c) {
      expect(l.participacao, l.id).toBe(mix30.participacao[l.id]);
      expect(l.mwmed, l.id).toBe(mix30.mwmed[l.id]);
    }
    // ausência não vira linha nem zero: a categoria sem valor na janela não está na lista
    expect(c.map((l) => l.id)).not.toContain("nao_mapeada");
  });

  it("a composição fecha 100% dentro da tolerância do controle publicado, e o texto diz quando não fecha", () => {
    const f = fechamentoDaComposicao(composicaoDaJanela(m, "SIN", "30d", "com"));
    expect(f.categorias).toBe(11);
    expect(f.tolerancia).toBe(TOLERANCIA_SOMA_PP);
    expect(Math.abs(f.soma - 100)).toBeLessThanOrEqual(TOLERANCIA_SOMA_PP + 1e-9);
    expect(f.fecha).toBe(true);
    // a soma é a das participações exibidas, não um complemento: duas casas, como a gold
    expect(f.soma).toBeCloseTo(soma(composicaoDaJanela(m, "SIN", "30d", "com")), 2);
    expect(fechamentoDaComposicao([{ participacao: 60 }, { participacao: 30 }])).toMatchObject({ soma: 90, categorias: 2, fecha: false });
    expect(fechamentoDaComposicao([]).fecha).toBe(false);
    // em todas as janelas e regiões publicadas a composição fecha (é o controle "Participações somam 100%")
    for (const rg of ["SIN", "SE", "S", "NE", "N"] as const) {
      for (const j of ["dia", "7d", "30d", "12m"] as const) {
        if (!m.janelas[rg]?.[j]) continue;
        for (const per of ["com", "sem"] as const) expect(fechamentoDaComposicao(composicaoDaJanela(m, rg, j, per)).fecha, `${rg} ${j} ${per}`).toBe(true);
      }
    }
  });

  it("sem a MMGD a Solar MMGD sai da composição e o total é o do perímetro", () => {
    const sem = composicaoDaJanela(m, "SIN", "30d", "sem");
    expect(sem.map((l) => l.id)).not.toContain("solar_mmgd");
    expect(sem.length).toBe(10);
    for (const l of sem) expect(l.participacao, l.id).toBe(mix30.participacao_sem_mmgd[l.id]);
  });

  it("o recorte da abertura são as cinco maiores, as primeiras da composição, e nunca vira um 'outros' por subtração", () => {
    const c = composicaoDaJanela(m, "SIN", "30d", "com");
    const cinco = maioresFontes(c);
    expect(cinco.map((l) => l.id)).toEqual(c.slice(0, 5).map((l) => l.id));
    expect(soma(cinco)).toBeLessThan(soma(c));
    // só entram categorias reais, com a participação publicada: nada de linha calculada como 100 menos as cinco
    for (const l of cinco) expect(c).toContain(l);
    expect(maioresFontes(c, 3)).toHaveLength(3);
    expect(maioresFontes([{ participacao: 0 }, { participacao: 0 }])).toEqual([]);
  });

  it("natureza de cada fonte: MMGD é estimativa do ONS, térmica Tipo III é previsão do ONS e o resto é medição", () => {
    expect(naturezaDaCategoria("solar_mmgd")).toBe("estimativa");
    expect(naturezaDaCategoria("termica_sem_combustivel")).toBe("previsao");
    for (const k of CATEGORIAS.filter((x) => x !== "solar_mmgd" && x !== "termica_sem_combustivel")) expect(naturezaDaCategoria(k), k).toBe("medicao");
    const c = composicaoDaJanela(m, "SIN", "30d", "com");
    expect(c.find((l) => l.id === "solar_mmgd")!.natureza).toBe("estimativa");
    expect(c.find((l) => l.id === "hidraulica")!.natureza).toBe("medicao");
  });

  it("a comparação entre janelas tira as categorias com cobertura alterada e diz o motivo, sem formar valor por subtração", () => {
    const k = comparacaoEntreJanelas(m, "SIN", "30d", "com");
    expect([k.janela, k.ref]).toEqual(["30d", "12m"]);
    const comRessalva = CATEGORIAS.filter((c) => mix30.ressalvas_universo[c] || mix12.ressalvas_universo[c]);
    expect(comRessalva.length).toBeGreaterThan(0);
    expect(k.fora.map((f) => f.id).sort()).toEqual([...comRessalva].sort());
    for (const f of k.fora) expect(f.motivo, f.id).toMatch(/usinas com dado/);
    // as comparáveis são as demais, cada uma com a participação publicada nas duas janelas
    for (const l of k.comparaveis) {
      expect(comRessalva, l.id).not.toContain(l.id);
      expect(l.participacao, l.id).toBe(mix30.participacao[l.id]);
      expect(l.participacao_ref, l.id).toBe(mix12.participacao[l.id]);
    }
    expect(k.comparaveis.length + k.fora.length).toBe(CATEGORIAS.filter((c) => mix30.participacao[c] !== null || mix12.participacao[c] !== null).length);
    // 365 dias contra 30: a mesma regra, com a referência trocada
    const inv = comparacaoEntreJanelas(m, "SIN", "12m", "com");
    expect([inv.janela, inv.ref]).toEqual(["12m", "30d"]);
    expect(inv.fora.map((f) => f.id).sort()).toEqual([...comRessalva].sort());
    // subsistema sem a janela de um dia: cai nos 30 dias, como o resto da página
    expect(comparacaoEntreJanelas(m, "NE", "dia", "com").janela).toBe("30d");
    // sem a MMGD ela não entra, nem como comparável nem como fora
    const sem = comparacaoEntreJanelas(m, "SIN", "30d", "sem");
    expect([...sem.comparaveis.map((l) => l.id), ...sem.fora.map((f) => f.id)]).not.toContain("solar_mmgd");
  });

  it("a fonte principal da faixa é a de maior participação no perímetro, e a MMGD só conta com a MMGD", () => {
    const p = fontePrincipalDaJanela(mix30, "com")!;
    const c = composicaoDaJanela(m, "SIN", "30d", "com");
    expect(p.id).toBe(c[0].id);
    expect(p.participacao).toBe(c[0].participacao);
    expect(p.frase).toBe(FRASE_CATEGORIA[p.id]);
    expect(fontePrincipalDaJanela(null, "com")).toBeNull();
    // mudar o número muda a fonte principal; no perímetro sem MMGD a categoria MMGD nunca é a principal
    const g = structuredClone(mix30);
    g.participacao.solar_mmgd = 99;
    expect(fontePrincipalDaJanela(g, "com")!.id).toBe("solar_mmgd");
    expect(fontePrincipalDaJanela(g, "sem")!.id).not.toBe("solar_mmgd");
  });

  it("a natureza da energia fecha 100% em medição, previsão e estimativa do ONS; natureza ausente não vira zero", () => {
    const partes = partesDaNatureza(mix30);
    expect(partes.map((x) => x.id)).toEqual(["verificada", "grupo_tipo3", "grupo_mmgd"]);
    expect(Math.abs(partes.reduce((t, x) => t + x.pct, 0) - 100)).toBeLessThanOrEqual(TOLERANCIA_SOMA_PP + 1e-9);
    expect(partes.find((x) => x.id === "grupo_mmgd")!.pct).toBe(mix30.natureza_pct.grupo_mmgd);
    expect(partesDaNatureza(null)).toEqual([]);
    const sem = partesDaNatureza({ natureza_pct: { verificada: 90, grupo_tipo3: 10, grupo_mmgd: null } });
    expect(sem.map((x) => x.id)).toEqual(["verificada", "grupo_tipo3"]);
  });

  it("as datas do módulo trazem a data e a natureza de cada parte, e só das partes que a gold publica", () => {
    const d = datasDoModulo(G);
    expect(d[0]).toMatchObject({ rotulo: "Matriz efetiva", texto: `até ${dataBR(G.dia_referencia)}`, natureza: "CALCULADO" });
    const mmgd = d.find((x) => x.rotulo === "MMGD estimada pelo ONS")!;
    expect(mmgd.natureza).toBe("ESTIMADO");
    expect(mmgd.texto).toContain(dataBR(G.a11.primeiro_dia_mmgd!));
    expect(d.find((x) => x.rotulo === "Despacho térmico")!.texto).toContain(mesAno(G.termica!.ultimo_mes_completo));
    expect(d.find((x) => x.rotulo === "Potência instalada")!.natureza).toBe("OBSERVADO");
    expect(d.find((x) => x.rotulo === "Fator de capacidade")).toBeDefined();
    // sem o bloco térmico a parte some, em vez de aparecer vazia
    expect(datasDoModulo({ ...G, termica: undefined }).map((x) => x.rotulo)).not.toContain("Despacho térmico");
  });

  it("a cobertura mensal lista as categorias que a fonte passou a publicar com outro número de usinas, com os meses e o último", () => {
    const cob = coberturaMensal(m.mensal_sin);
    const esperadas = CATEGORIAS.filter((c) => (m.mensal_sin.ressalvas_universo[c] ?? []).length > 0);
    expect(cob.map((x) => x.id)).toEqual(esperadas);
    for (const x of cob) {
      const lista = m.mensal_sin.ressalvas_universo[x.id]!;
      expect(x.meses, x.id).toBe(lista.length);
      expect(x.ultimo, x.id).toBe([...lista].sort().at(-1));
    }
  });
});

describe("abertura de Geração e despacho térmico renderizados", () => {
  const abertura = renderToStaticMarkup(createElement(GeracaoPage as never));
  const termica = renderToStaticMarkup(createElement(GeracaoTermicaPage as never));
  const restricoes = renderToStaticMarkup(createElement(GeracaoRestricoesPage));
  const capacidade = renderToStaticMarkup(createElement(GeracaoCapacidadePage));
  const h1 = (h: string) => (h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "").replace(/<[^>]+>/g, "").trim();
  const faixa = (h: string) => {
    const i = h.indexOf("data-faixa-metricas");
    return h.slice(i, h.indexOf("</section>", i));
  };
  const ocorrencias = (h: string, t: string) => h.split(t).length - 1;
  /** Linhas (<li>) da lista de barras cujo título começa com o texto dado. */
  const linhasDaLista = (h: string, inicioDoTitulo: string) => {
    const i = h.indexOf(`aria-label="${inicioDoTitulo}`);
    expect(i, inicioDoTitulo).toBeGreaterThan(-1);
    return h.slice(h.lastIndexOf("<ol", i), h.indexOf("</ol>", i)).split("<li").slice(1);
  };
  const mix30 = G.matriz.janelas.SIN["30d"]!;

  it("título de 5 a 9 palavras em forma de pergunta, em todas as páginas da família", () => {
    expect(h1(abertura)).toBe("De onde vem a eletricidade?");
    expect(h1(termica)).toBe(perguntaPainel("p022"));
    expect(h1(restricoes)).toBe(perguntaPainel("p023"));
    expect(h1(capacidade)).toBe(perguntaPainel("p024"));
    for (const h of [abertura, termica, restricoes, capacidade]) {
      const palavras = h1(h).split(/\s+/).length;
      expect(palavras, h1(h)).toBeGreaterThanOrEqual(5);
      expect(palavras, h1(h)).toBeLessThanOrEqual(9);
      expect(h1(h).endsWith("?"), h1(h)).toBe(true);
    }
  });

  it("a faixa da abertura tem três medidas, cada uma com a janela e o período de 30 dias do SIN, e diz que a MMGD é estimativa", () => {
    const f = faixa(abertura);
    expect(ocorrencias(f, 'data-metrica=""')).toBe(3);
    expect(ocorrencias(f, `30 dias, de ${dataBR(mix30.inicio)} a ${dataBR(mix30.fim)}`)).toBe(3);
    expect(f).toContain("MWmed");
    expect(f).toContain("com a MMGD estimada");
    expect(f).toContain("Participação da MMGD solar, estimativa do ONS");
    expect(f).toContain("Estimado");
    expect(f).toContain("não medição");
    // a participação da fonte principal sai do mesmo seletor do gráfico
    expect(f).toContain(num(fontePrincipalDaJanela(mix30, "com")!.participacao, 1));
  });

  it("a abertura mostra as cinco maiores como recorte e a composição completa de 11 categorias como seção própria, fora de Analisar", () => {
    const cinco = linhasDaLista(abertura, "Cinco maiores participações na geração do SIN: 30 dias (com MMGD estimada)");
    expect(cinco).toHaveLength(5);
    expect(abertura).toContain("Recorte das cinco maiores fontes, não a composição completa.");
    const completa = linhasDaLista(abertura, "Composição completa da geração do SIN: 30 dias (com MMGD estimada), 11 categorias");
    expect(completa).toHaveLength(11);
    // a seção da composição é visível em Entender: sem data-nivel na própria abertura
    const i = abertura.indexOf('id="composicao"');
    expect(i).toBeGreaterThan(-1);
    expect(abertura.slice(abertura.lastIndexOf("<section", i), i + 20)).not.toContain("data-nivel");
    expect(abertura).toContain("Como se divide toda a geração?");
    // o fechamento é dito: total, soma das participações exibidas e a tolerância do controle publicado
    const f = fechamentoDaComposicao(composicaoDaJanela(G.matriz, "SIN", "30d", "com"));
    expect(abertura).toContain('data-composicao-fecha="sim"');
    expect(abertura).toContain(`Soma das ${f.categorias} participações exibidas: ${num(f.soma, 2)}%`);
    expect(abertura).toContain(`Total da janela: ${num(mix30.total_mwmed, 0)} MWmed`);
    expect(abertura).not.toMatch(/Outras? fontes|Demais fontes/);
  });

  it("medição, previsão e estimativa se distinguem por texto e selo, e a MMGD é sempre estimativa do ONS", () => {
    const completa = linhasDaLista(abertura, "Composição completa");
    const mmgd = completa.find((l) => l.includes("Solar MMGD"))!;
    expect(mmgd).toContain("Estimado");
    expect(mmgd).toContain("pelo ONS, não medição");
    const tipo3 = completa.find((l) => l.includes("Térmicas Tipo III"))!;
    expect(tipo3).toContain("Previsto");
    const hidraulica = completa.find((l) => l.includes("Hidráulica"))!;
    expect(hidraulica).not.toContain("não medição");
    // a natureza da energia numa barra que fecha 100%, com os três nomes na legenda
    for (const t of ["Medição (usinas com relacionamento com o ONS)", "Previsão do ONS (grupos Tipo III)", "Estimativa do ONS (MMGD)"]) expect(abertura, t).toContain(t);
  });

  it("a comparação entre janelas deixa de fora as categorias com cobertura alterada e a mudança de cobertura aparece", () => {
    const k = comparacaoEntreJanelas(G.matriz, "SIN", "30d", "com");
    const i = abertura.indexOf("Participação na geração do SIN: 30 dias contra 365 dias (com MMGD estimada)");
    expect(i).toBeGreaterThan(-1);
    const j = abertura.indexOf('data-fora-da-comparacao="p021"');
    expect(j).toBeGreaterThan(i);
    const grafico = abertura.slice(i, j);
    const fora = abertura.slice(j, abertura.indexOf("</ul>", j));
    for (const f of k.fora) {
      expect(fora, f.id).toContain(f.rotulo);
      expect(fora, f.id).toContain("usinas com dado");
      expect(grafico, f.id).not.toContain(f.rotulo);
    }
    for (const l of k.comparaveis) expect(grafico, l.id).toContain(l.rotulo);
    expect(abertura).toContain("Fora da comparação: cobertura da fonte alterada");
    expect(abertura).toContain("não mede mudança na geração");
    // a série mensal repete o aviso de cobertura
    expect(abertura).toContain("Mudança de cobertura na fonte:");
  });

  it("as séries diária e horária de Analisar são lidas sob demanda: o HTML traz o marcador e o botão, não as linhas", () => {
    for (const t of ["diaria", "horaria"]) expect(abertura).toContain(`data-grafico-sob-demanda="${t}"`);
    expect(abertura).toContain("Carregar a série");
    expect(abertura).not.toContain("Geração diária do SIN por categoria");
    expect(abertura).not.toContain("Geração horária do SIN por categoria");
  });

  it("a faixa do despacho térmico tem três medidas com o período dos 12 meses, e o motivo de cada barra está escrito ao lado dela", () => {
    const t = G.termica!;
    const f = faixa(termica);
    const periodo = `${mesAno(t.ultimos_12m.inicio)} a ${mesAno(t.ultimos_12m.fim)}`;
    expect(ocorrencias(f, 'data-metrica=""')).toBe(3);
    expect(ocorrencias(f, periodo)).toBe(3);
    expect(f).toContain("Inflexibilidade sem a nuclear");
    expect(f).toContain("MWmed");
    // a lista visível dos motivos traz o rótulo publicado de cada um, como na legenda do gráfico
    const i = termica.indexOf('data-motivos="rotulos"');
    expect(i).toBeGreaterThan(-1);
    const lista = termica.slice(i, termica.indexOf("</ul>", i)).split("<li").slice(1);
    expect(lista.length).toBeGreaterThanOrEqual(6);
    expect(termica).toContain("unit commitment (rampa e tempos mínimos)");
    expect(termica).toContain("razão elétrica (necessidade do SIN)");
    // a participação térmica de 7 dias é outra base e diz isso
    expect(termica).toContain("Base diferente da do motivo de despacho");
  });

  it("restrições e capacidade abrem com a faixa de medidas, cada medida com o seu período, e a figura principal vem antes das seções complementares", () => {
    expect(ocorrencias(faixa(restricoes), 'data-metrica=""')).toBe(4);
    expect(ocorrencias(faixa(capacidade), 'data-metrica=""')).toBe(3);
    for (const [h, primeiraSecao] of [[restricoes, 'id="taxa-e-corte"'], [capacidade, 'id="distribuicao"']] as const) {
      const fig = h.indexOf('data-grafico="barras"');
      expect(fig, primeiraSecao).toBeGreaterThan(-1);
      expect(fig, primeiraSecao).toBeLessThan(h.indexOf(primeiraSecao));
    }
    // capacidade: as duas figuras seguem a mesma ordem de fontes (a de potência, da maior para a menor)
    const potencia = G.capacidade!.retrato.por_categoria.filter((x) => x.mw !== null).sort((a, b) => (b.mw ?? 0) - (a.mw ?? 0)).map((x) => x.categoria);
    expect(linhasCapacidade(G.capacidade!).length).toBeGreaterThanOrEqual(potencia.length);
    expect(capacidade).toContain("As duas figuras seguem a mesma ordem de fontes");
  });

  it("textos novos sem julgamento, sem causalidade afirmada e sem data relativa nas quatro páginas", () => {
    for (const [id, h] of Object.entries({ abertura, termica, restricoes, capacidade })) {
      const texto = h.replace(/<[^>]+>/g, " ");
      expect(texto, id).not.toMatch(/\b(hoje|agora)\b/i);
      expect(texto, id).not.toMatch(/\b(melhor|pior|ineficiente|excelente|péssim[oa])\b/i);
      expect(texto, id).not.toMatch(/\bporque\b/i);
      expect(texto, id).not.toMatch(/[—–]/);
      expect(texto, id).not.toMatch(/\bgold\b|\bsilver\b|\bpipeline\b/i);
    }
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
      for (const t of ["Período", "Universo", "Unidade", "Comprove este número", "Como interpretar", "O que não é possível concluir", "Copiar link deste painel", "Próxima pergunta", "Baixar os dados"]) {
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
