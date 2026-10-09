import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import GeracaoPage from "@/app/setor-eletrico/geracao/page";
import GeracaoRestricoesPage from "@/app/setor-eletrico/geracao/restricoes/page";
import GeracaoCapacidadePage from "@/app/setor-eletrico/geracao/capacidade/page";
import GeracaoTermicaPage from "@/app/setor-eletrico/geracao/termica/page";
import { BarraNatureza, BarrasPorFonte, type ItemBarraFonte } from "@/components/energia/GeracaoBarrasFontes";
import { GeracaoCapacidadeDistribuicao } from "@/components/energia/GeracaoCapacidade";
import { GeracaoMapaUsinas } from "@/components/energia/GeracaoMapaUsinas";
import { dataBR, mesAno, num } from "@/lib/energia/formato";
import { lerCaminho, pontoNaRegiao, type CamadaGeo } from "@/lib/energia/geo";
import {
  CATEGORIAS,
  FRASE_CATEGORIA,
  MINIMO_PARA_DISTRIBUICAO,
  PAINEIS_GERACAO,
  TOLERANCIA_SOMA_PP,
  coberturaDaPotencia,
  coberturaMensal,
  colunasAnuais,
  comparacaoEntreJanelas,
  composicaoDaJanela,
  datasDoModulo,
  deContraido,
  diasDoBalancoForaDoPadrao,
  diferencasAneelOns,
  downloadsDoPainel,
  emPortugues,
  fechamentoDaComposicao,
  fontePrincipalDaJanela,
  histogramaFc,
  inflexibilidadeSemNuclear,
  lacunaDasComparaveis,
  linhasAnuais,
  linhasCapacidade,
  linhasDozeMeses,
  linhasMmgdCapacidade,
  linhasRazoes12m,
  maioresFontes,
  mesDeslocado,
  mesesComPresencaParcial,
  minusculaPalavras,
  mmgdNosDiasComEstimativa,
  naturezaDaCategoria,
  notaAnual,
  notaCvuZero,
  observacoesFc,
  partesDaNatureza,
  presencaMmgdNoAno,
  textoMudancaMensal,
  textoNatureza,
  usinasPadraoComparacao,
  zerosDoCvu,
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
const ocorrencias = (h: string, t: string) => h.split(t).length - 1;
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
    expect(datasDoModulo({ ...G, termica: null }).map((x) => x.rotulo)).not.toContain("Despacho térmico");
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
    const achado = (texto: string, re: RegExp) => {
      const x = re.exec(texto);
      return x ? `...${texto.slice(Math.max(0, x.index - 70), x.index + 70)}...` : null;
    };
    for (const [id, h] of Object.entries({ abertura, termica, restricoes, capacidade })) {
      // só o conteúdo da página (o menu do observatório é de outro módulo)
      const texto = h.slice(h.indexOf("<main"), h.indexOf("</main>")).replace(/<[^>]+>/g, " ");
      expect(texto.length, id).toBeGreaterThan(5000);
      expect(achado(texto, /\b(hoje|agora)\b/i), `${id}: data relativa`).toBeNull();
      expect(achado(texto, /\b(melhor|pior|ineficiente|excelente|péssim[oa])\b/i), `${id}: julgamento`).toBeNull();
      expect(achado(texto, /\bporque\b/i), `${id}: causalidade`).toBeNull();
      // jargão de bastidor só fora de Entender: o texto de Analisar e Auditar cita a base e as regras publicadas
      const ini = h.indexOf("<main");
      const corte = h.slice(ini).search(/<section[^>]*data-nivel="(analisar|auditar)"/);
      const entender = h.slice(ini, corte > 0 ? ini + corte : h.indexOf("</main>")).replace(/<[^>]+>/g, " ");
      expect(entender.length, `${id}: Entender`).toBeGreaterThan(3000);
      expect(achado(entender, /[—–]/), `${id}: travessão em Entender`).toBeNull();
      expect(achado(entender, /\bgold\b|\bsilver\b|\bpipeline\b/i), `${id}: jargão de bastidor em Entender`).toBeNull();
      expect(achado(entender, /\bP0\d\d\b/), `${id}: código de painel em Entender`).toBeNull();
    }
  });
});

describe("barras por fonte: lista com um único tab stop, valor em texto e natureza distinta na forma", () => {
  const itens: ItemBarraFonte[] = [
    { id: "hidraulica", rotulo: "Hidráulica", valor: 50, texto: "50,0%", auxiliar: "1.000 MWmed", natureza: "medicao" },
    { id: "solar_mmgd", rotulo: "Solar MMGD", valor: 10, texto: "10,0%", natureza: "estimativa" },
    { id: "termica_sem_combustivel", rotulo: "Térmicas Tipo III", valor: 4, texto: "4,0%", natureza: "previsao" },
    { id: "biomassa", rotulo: "Biomassa", valor: 1, texto: "1,0%", natureza: "medicao", cobertura: true },
  ];

  it("com seleção, só uma barra entra na ordem do Tab e cada linha é botão com estado; sem seleção, é lista de leitura", () => {
    const h = renderToStaticMarkup(createElement(BarrasPorFonte, { titulo: "Cinco maiores", itens, onSelecionar: () => undefined, selecionado: "solar_mmgd" }));
    expect((h.match(/tabindex="0"/g) ?? []).length).toBe(1);
    expect((h.match(/tabindex="-1"/g) ?? []).length).toBe(itens.length - 1);
    expect((h.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
    expect(h).toContain('data-grafico="barras"');
    expect(h).toContain('data-orientacao="horizontal"');
    expect(h).toContain('aria-label="Cinco maiores"');
    const leitura = renderToStaticMarkup(createElement(BarrasPorFonte, { titulo: "Cinco maiores", itens }));
    expect(leitura).not.toContain("<button");
    expect(leitura).not.toContain("tabindex");
  });

  it("o valor e a energia estão em texto, a estimativa e a previsão do ONS têm selo, texto e barra vazada, e a cobertura alterada é dita", () => {
    const h = renderToStaticMarkup(createElement(BarrasPorFonte, { titulo: "Composição", itens }));
    expect(h).toContain("50,0%");
    expect(h).toContain("1.000 MWmed");
    expect(ocorrencias(h, "pelo ONS, não medição")).toBe(2);
    expect(h).toContain("Estimado");
    expect(h).toContain("Previsto");
    expect(ocorrencias(h, "border-dashed")).toBe(2);
    expect(ocorrencias(h, "cobertura da fonte alterada")).toBe(1);
    // medição é barra cheia: a única barra sem contorno tracejado por categoria é a de medição
    expect(ocorrencias(h, "bg-energia border border-energia")).toBe(2);
  });

  it("sem categoria com dado a lista diz isso e não desenha barra de valor zero; a barra de natureza nomeia cada parte para o leitor de tela", () => {
    const vazio = renderToStaticMarkup(createElement(BarrasPorFonte, { titulo: "Composição", itens: [] }));
    expect(vazio).toContain("Nenhuma categoria com dado nesta janela");
    expect(vazio).not.toContain("<li");
    const n = renderToStaticMarkup(
      createElement(BarraNatureza, {
        titulo: "Natureza da energia",
        partes: [
          { id: "verificada", rotulo: "Medição", pct: 80, texto: "80,0%" },
          { id: "grupo_mmgd", rotulo: "Estimativa do ONS (MMGD)", pct: 20, texto: "20,0%" },
        ],
      }),
    );
    expect(n).toContain('role="img"');
    expect(n).toContain("Natureza da energia: Medição 80,0%; Estimativa do ONS (MMGD) 20,0%");
    expect(n).toContain("width:80%");
    expect(n).toContain("width:20%");
  });
});

describe("participação anual: a MMGD de 2023 não vira média de ano inteiro sem aviso (ausência não é zero)", () => {
  const anos = G.matriz.anual_sin;
  const a23 = anos.find((a) => a.ano === 2023)!;

  it("2023 tem estimativa em 247 de 365 dias: a média dos dias com estimativa é a contribuição vezes 365 sobre 247, maior que a contribuição", () => {
    expect([a23.dias, a23.mmgd_dias]).toEqual([365, 247]);
    const v = mmgdNosDiasComEstimativa(a23)!;
    expect(v).toBeCloseTo((a23.mwmed.solar_mmgd! * 365) / 247, 6);
    // 3.875,7 pelo CSV diário (soma ÷ horas de 247 dias); a gold traz a contribuição com uma casa, daí 3.875,8 aqui: a diferença é de arredondamento
    expect(v).toBeCloseTo(3875.7, 0);
    expect(v).toBeGreaterThan(a23.mwmed.solar_mmgd!);
    // fica entre o menor e o maior mês com estimativa de 2023 (a contribuição de 2.622,8 ficava abaixo de todos)
    const m = G.matriz.mensal_sin;
    const meses = m.meses.map((x, i) => ({ x, v: m.solar_mmgd[i] })).filter((o) => o.x >= "2023-05" && o.x <= "2023-12").map((o) => o.v!);
    expect(a23.mwmed.solar_mmgd!).toBeLessThan(Math.min(...meses));
    expect(v).toBeGreaterThan(Math.min(...meses));
    expect(v).toBeLessThan(Math.max(...meses));
  });

  it("ano sem estimativa fica sem valor, e ano com estimativa em todos os dias coincide com a média do ano", () => {
    for (const a of anos.filter((x) => x.mmgd_dias === 0)) expect(mmgdNosDiasComEstimativa(a), String(a.ano)).toBeNull();
    for (const a of anos.filter((x) => x.mmgd_dias === x.dias)) expect(mmgdNosDiasComEstimativa(a)!, String(a.ano)).toBeCloseTo(a.mwmed.solar_mmgd!, 6);
  });

  it("a linha de 2023 sinaliza a presença parcial, e as colunas dizem o denominador de cada número", () => {
    const l = linhasAnuais(anos);
    const l23 = l.find((x) => x.ano === "2023")!;
    expect(l23.presenca_mmgd).toBe("parcial: estimativa em 247 de 365 dias");
    expect(l23.mmgd_dias).toBe(247);
    expect(l23.mmgd_nos_dias_mwmed).toBeCloseTo(3875.8, 1);
    expect(l.find((x) => x.ano === "2021")!.presenca_mmgd).toBe("sem estimativa no ano");
    expect(presencaMmgdNoAno({ dias: 366, mmgd_dias: 366 })).toBe("estimativa em todos os dias");
    const rotulos = colunasAnuais(anos).map((c) => c.rotulo);
    for (const r of ["MMGD estimada, contribuição à média anual", "MMGD estimada, média dos dias com estimativa", "Dias com estimativa de MMGD", "Parcela de medição no total com MMGD"]) expect(rotulos, r).toContain(r);
    expect(rotulos).not.toContain("MMGD estimada");
    expect(rotulos).not.toContain("Energia medida");
    // os ids antigos seguem, para o link com ordem por coluna que já circula
    const ids = colunasAnuais(anos).map((c) => c.id);
    expect(ids).toContain("mmgd_mwmed");
    expect(ids).toContain("verificada_pct");
  });

  it("a nota diz as duas médias da MMGD e que o total da parcela de medição passa a incluir a MMGD, sem nenhum número fixo no código", () => {
    const n = notaAnual(anos, G.a11.primeiro_dia_mmgd);
    expect(n).toContain(dataBR(G.a11.primeiro_dia_mmgd!));
    expect(n).toContain("em 2023, 247 dos 365 dias");
    expect(n).toContain("247/365 da média dos dias com estimativa");
    expect(n).toContain("antes, o total não a inclui");
    expect(n).not.toMatch(/\bporque\b/);
    // outra gold, outro texto: sem ano parcial, a nota não cita 2023
    const sem = notaAnual(anos.map((a) => ({ ...a, mmgd_dias: a.mmgd_dias > 0 ? a.dias : 0 })), G.a11.primeiro_dia_mmgd);
    expect(sem).not.toContain("247");
  });
});

describe("texto da gold em português de leitor e o que a página corrige sozinha", () => {
  it("troca nome de campo e identificador interno pela descrição, sem mexer no resto do texto", () => {
    expect(emPortugues("a fração sai em natureza_pct e em natureza_mensal_sin; cada janela leva em ressalvas_universo as categorias")).toBe(
      "a fração sai em parcela por natureza e em série mensal por natureza; cada janela leva em ressalvas de universo as categorias",
    );
    expect(emPortugues("Identificador = usina, conjunto ou grupo (id_ons) da natureza verificada")).toContain("(código do ONS)");
    expect(emPortugues("rótulos e os 10 identificadores estão em matriz.universo")).toContain("o universo da matriz");
    expect(emPortugues("Reconciliação diária com o Balanço (hidraulica)")).toBe("Reconciliação diária com o Balanço (hidráulica)");
    expect(emPortugues("(termica)")).toBe("(térmica)");
    expect(emPortugues("(eolica)")).toBe("(eólica)");
    // palavras que só contêm o termo não mudam
    expect(emPortugues("termicas e eolicas")).toBe("termicas e eolicas");
  });

  it("a frase 'igual ao do Balanço' vira 'próximo, com divergências listadas em Auditar' (a reconciliação diz 88% dos dias do SIN na hidráulica e 49,8% na térmica)", () => {
    const frase = G.a11.tratamento.find((t) => /igual ao do Balanço/.test(t))!;
    expect(frase).toBeDefined();
    const t = emPortugues(frase);
    expect(t).not.toContain("igual ao do Balanço");
    expect(t).toContain("próximo ao do Balanço, com divergências listadas em Auditar");
    const rec = G.matriz.reconciliacao_balanco.por_fonte;
    expect(rec.termica.pct_sin_dias_conciliados).toBeLessThan(60);
  });

  it("nenhum texto de gold exibido nas páginas traz nome de campo depois da tradução", () => {
    const textos = [...G.a11.tratamento, ...(G.proveniencia.matriz?.limitacoes ?? []), G.matriz.universo.regra, G.matriz.universo.regra_ressalvas, ...G.controles.map((x) => `${x.nome} ${x.detalhe}`)];
    for (const t of textos) expect(emPortugues(t), t.slice(0, 60)).not.toMatch(/\b(id_ons|ressalvas_universo|natureza_pct|natureza_mensal_sin|outros_por_ceg|matriz\.\w+|hidraulica|termica|eolica)\b/);
  });

  it("o rótulo do arquivo horário diz 365 dias, como as 8.760 linhas do CSV (o rótulo da gold ainda diz 366)", () => {
    const d = downloadsDoPainel(G.downloads, "p021").find((x) => /horaria/.test(x.url))!;
    expect(d.rotulo).toContain("últimos 365 dias");
    expect(d.rotulo).not.toContain("366");
    const csv = readFileSync(join(raiz, "public/energia/series/geracao_matriz_horaria_12m.csv"), "utf-8").trim().split("\n");
    expect(csv.length - 1).toBe(365 * 24);
  });
});

describe("o que mudou, notas de universo e referências ao lado do dado", () => {
  const t = G.termica!;

  it("o que mudou compara o último mês completo com o mês anterior e com o mesmo mês de um ano antes; mês sem valor é dito, não zerado", () => {
    expect(mesDeslocado("2026-01", -1)).toBe("2025-12");
    expect(mesDeslocado("2026-08", -12)).toBe("2025-08");
    const f = textoMudancaMensal({ nome: "a geração das térmicas despachadas", unidade: "MWmed", casas: 0, meses: t.mensal_sin.meses, valores: t.mensal_sin.total_mwmed, mes: t.ultimo_mes_completo });
    const i = t.mensal_sin.meses.indexOf(t.ultimo_mes_completo);
    expect(f).toContain(`${mesAno(t.ultimo_mes_completo)}: ${num(t.mensal_sin.total_mwmed[i]!, 0)} MWmed`);
    expect(f).toContain(`contra ${num(t.mensal_sin.total_mwmed[i - 1]!, 0)} MWmed em ${mesAno(t.mensal_sin.meses[i - 1])}`);
    expect(f).toContain(`${num(t.mensal_sin.total_mwmed[i - 12]!, 0)} MWmed em ${mesAno(t.mensal_sin.meses[i - 12])}`);
    expect(f).toMatch(/\([+−]\d/);
    // valor percentual vira diferença em pontos percentuais
    const p = textoMudancaMensal({ nome: "o fator", unidade: "%", percentual: true, meses: ["2025-07", "2026-06", "2026-07"], valores: [20, 30, 33], mes: "2026-07" });
    expect(p).toContain("+3,0 pontos percentuais");
    expect(p).toContain("+13,0 pontos percentuais");
    // sem o mês do ano anterior na série
    expect(textoMudancaMensal({ nome: "x", unidade: "u", meses: ["2026-06", "2026-07"], valores: [1, 2], mes: "2026-07" })).toContain("sem valor em jul/2025");
    expect(textoMudancaMensal({ nome: "x", unidade: "u", meses: ["2026-07"], valores: [null], mes: "2026-07" })).toBe("");
    expect(textoMudancaMensal({ nome: "x", unidade: "u", meses: [], valores: [], mes: null })).toBe("");
  });

  it("CVU zero é valor publicado: a nota conta as parcelas com zero por combustível, direto da gold", () => {
    const cvu = t.cvu!;
    const z = zerosDoCvu(cvu);
    const esperado = cvu.usinas.filter((u) => u.cvu === 0).length;
    expect(z.zeros).toBe(esperado);
    expect(z.total).toBe(cvu.usinas.length);
    expect(z.porCombustivel.reduce((s, x) => s + x.zeros, 0)).toBe(esperado);
    const oleo = z.porCombustivel.find((x) => x.categoria === "oleo")!;
    expect(oleo.zeros).toBe(cvu.usinas.filter((u) => u.categoria === "oleo" && u.cvu === 0).length);
    const nota = notaCvuZero(cvu);
    expect(nota).toContain(`${num(esperado, 0)} das ${num(cvu.usinas.length, 0)} parcelas`);
    expect(nota).toContain("nunca é tratado como ausência");
    expect(nota).toContain("sem peso pela geração");
    expect(notaCvuZero({ usinas: [{ ...cvu.usinas[0], cvu: 10 }] })).not.toContain("CVU 0,00");
  });

  it("a comparação de usinas abre com a maior de cada um de três combustíveis, e a lista das maiores vem ordenada pela geração", () => {
    const padrao = usinasPadraoComparacao(t.usinas_12m, 3);
    expect(padrao).toHaveLength(3);
    expect(new Set(padrao.map((x) => x.categoria)).size).toBe(3);
    const maior = [...t.usinas_12m].sort((a, b) => (b.mwmed ?? 0) - (a.mwmed ?? 0))[0];
    expect(padrao[0].id).toBe(maior.id);
    for (let i = 1; i < padrao.length; i++) expect(padrao[i - 1].mwmed ?? 0).toBeGreaterThanOrEqual(padrao[i].mwmed ?? 0);
  });

  it("os dias em que o Balanço registra a eólica muito abaixo da soma das usinas saem das maiores divergências da própria gold", () => {
    const dias = diasDoBalancoForaDoPadrao(G.matriz.reconciliacao_balanco);
    expect(dias.map((x) => x.d)).toEqual(expect.arrayContaining(["2026-01-16", "2026-05-09"]));
    for (const x of dias) expect(x.balanco_mwh).toBeLessThan(0.1 * x.usinas_mwh);
    expect(dias.map((x) => x.d)).toEqual([...dias.map((x) => x.d)].sort());
  });

  it("a lacuna de usinas sem dado aparece ao lado da variação das categorias que seguem comparáveis, e a categoria suprimida fica de fora", () => {
    const c = G.matriz.comparacao_12m!;
    const lac = lacunaDasComparaveis(c, G.matriz.universo);
    expect(lac.length).toBeGreaterThan(0);
    for (const x of lac) {
      expect(c.variacao_suprimida[x.id], x.id).toBeUndefined();
      expect(c.variacao_pct[x.id], x.id).not.toBeNull();
      expect(x.gwh).toBeGreaterThan(0);
    }
    for (let i = 1; i < lac.length; i++) expect(lac[i - 1].gwh).toBeGreaterThanOrEqual(lac[i].gwh);
    const linhas = linhasDozeMeses(c, G.matriz.janelas.SIN["12m"], G.matriz.universo);
    const hid = linhas.find((l) => l.id === "hidraulica")!;
    expect(hid.lacuna_gwh).toBeCloseTo(G.matriz.universo.lacuna_ultimo_mes!.detalhe_por_categoria.hidraulica!.mwh_dos_ausentes_mesmo_mes_ano_anterior / 1000, 1);
    expect(linhasDozeMeses(c, G.matriz.janelas.SIN["12m"]).every((l) => l.lacuna_gwh === null)).toBe(true);
  });

  it("a MMGD em abril de 2023 tem presença parcial dita (2 de 30 dias), e o mês incompleto leva a marca no rótulo do eixo", () => {
    const p = mesesComPresencaParcial(G.matriz.mensal_sin, "solar_mmgd");
    expect(p).toEqual([{ mes: "2023-04", dias: 2, diasDoMes: 30 }]);
    expect(mesesComPresencaParcial(G.matriz.mensal_sin, "hidraulica")).toEqual([]);
  });

  it("capacidade: a potência fiscalizada pela ANEEL e a do ONS divergem em mais de 25% em categorias nomeadas, e o fator que usa parte da potência diz qual parte", () => {
    const linhas = linhasCapacidade(cap);
    const d = diferencasAneelOns(linhas);
    expect(d.map((x) => x.id)).toEqual(expect.arrayContaining(["biomassa", "outros"]));
    for (const x of d) expect(Math.abs(x.aneel / x.ons - 1)).toBeGreaterThan(0.25);
    const parte = coberturaDaPotencia(linhas);
    const bio = parte.find((x) => x.id === "biomassa")!;
    expect(bio.pct).toBeCloseTo((100 * bio.denominador) / bio.potencia, 6);
    expect(bio.pct).toBeLessThan(50);
    expect(parte.find((x) => x.id === "hidraulica")).toBeUndefined();
  });

  it("com menos de 10 observações a distribuição mostra o valor de cada usina e não descreve quantis; com 10 ou mais, o histograma marca só a mediana", () => {
    expect(MINIMO_PARA_DISTRIBUICAO).toBe(10);
    const u12 = cap.ultimos_12m!;
    const nuclear = u12.por_categoria.find((x) => x.categoria === "nuclear")!;
    expect(nuclear.distribuicao_usinas!.n).toBeLessThan(MINIMO_PARA_DISTRIBUICAO);
    const obs = observacoesFc(nuclear);
    expect(obs).toHaveLength(nuclear.distribuicao_usinas!.n);
    for (let i = 1; i < obs.length; i++) expect(obs[i - 1].fc_pct).toBeGreaterThanOrEqual(obs[i].fc_pct);
    const pequena = renderToStaticMarkup(createElement(GeracaoCapacidadeDistribuicao, { ultimos12m: { ...u12, por_categoria: [nuclear] }, fonte: "f", versao: "v" }));
    expect(pequena).toContain("a figura mostra o valor de");
    expect(pequena).toContain("não há distribuição nem quantis a descrever");
    expect(pequena).not.toContain("Quantis");
    expect(pequena).not.toContain("metade teve fator entre");
    expect(pequena).toContain("Entram só as usinas e conjuntos pareados");
    const eolica = u12.por_categoria.find((x) => x.categoria === "eolica")!;
    const grande = renderToStaticMarkup(createElement(GeracaoCapacidadeDistribuicao, { ultimos12m: { ...u12, por_categoria: [eolica] }, fonte: "f", versao: "v", usinasNoRetrato: { eolica: 162 } }));
    expect(grande).toContain("metade teve fator entre");
    expect(grande).toContain("Quantis (Mediana)");
    expect(grande).not.toContain("Quantis (P10");
    expect(grande).toContain("de 162 usinas no retrato de capacidade");
  });
});

describe("páginas com as correções das avaliações independentes", () => {
  const abertura = renderToStaticMarkup(createElement(GeracaoPage as never));
  const termica = renderToStaticMarkup(createElement(GeracaoTermicaPage as never));
  const restricoes = renderToStaticMarkup(createElement(GeracaoRestricoesPage));
  const capacidade = renderToStaticMarkup(createElement(GeracaoCapacidadePage));
  const texto = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const t = G.termica!;

  it("abertura: por que importa junto da resposta, medidas que não seguem os filtros ditas, sazonalidade, térmicas somadas e presença parcial da MMGD", () => {
    const x = texto(abertura);
    expect(x).toContain("Mostra de onde veio a energia que atendeu a carga e quanto dela é medição, previsão ou estimativa.");
    expect(x).toContain("não mudam com Região, Janela e Perímetro, escolhidos mais abaixo");
    expect(abertura).toContain('data-sazonalidade="p021"');
    expect(x).toContain("a sazonalidade (vento, sol e chuva variam ao longo do ano)");
    expect(abertura).toContain("data-termicas-somadas");
    expect(x).toContain("Térmicas pequenas no gráfico");
    expect(x).toContain("Demais térmicas soma carvão mineral, óleo e diesel, biomassa, outras térmicas e térmicas Tipo III");
    expect(x).toContain("Presença parcial da MMGD: abr/2023 tem estimativa em 2 de 30 dias");
    expect(x).toContain("Participação por ano, sem a MMGD, e a MMGD estimada à parte");
    // a tabela diz 'sem ressalva' em vez de 'sem dado' nas colunas de ressalva e de presença
    expect(x).toContain("Ressalva de universo");
    // a lacuna das categorias comparáveis ao lado da comparação de 365 dias
    expect(x).toContain("a geração delas em ago/2025 dá a ordem de grandeza da lacuna");
  });

  it("abertura: a janela de um dia e a de 7 dias só existem para o SIN; para subsistema ficam desativadas com o motivo (aviso só fora do SIN)", () => {
    // no recorte padrão (SIN) todas as janelas estão ativas e não há aviso
    expect(abertura).not.toContain("data-janelas-indisponiveis");
    const ativas = (abertura.match(/<input type="radio"[^>]*value="(dia|7d|30d|12m)"[^>]*>/g) ?? []).filter((i) => !/disabled/.test(i));
    expect(ativas.length).toBeGreaterThanOrEqual(4);
  });

  it("térmica: o cartão diz que inclui a nuclear, o que cada motivo quer dizer está em palavras simples, as dez maiores usinas aparecem e a comparação abre com três combustíveis", () => {
    const x = texto(termica);
    expect(x).toContain("Geração das térmicas despachadas pelo ONS, inclusive a nuclear");
    expect(x).toContain("Térmica despachada é a que o ONS manda gerar na programação da operação");
    expect(x).toContain("Usina mantida ligada para respeitar a rampa (velocidade de subida e descida) e os tempos mínimos de operação.");
    expect(x).toContain("Geração decidida pelo CMSE (Comitê de Monitoramento do Setor Elétrico) para garantir o suprimento de energia.");
    expect(x).toContain("As 10 usinas térmicas com mais geração");
    expect(x).toContain("a maior usina de cada um de 3 combustíveis");
    expect(termica).toContain("data-cvu-comparadas");
    expect(x).toContain("CVU da semana vigente:");
  });

  it("térmica: notas de universo e de método junto da figura (não classificado, combustível, universo que cresce, ponte com a matriz) e o CVU zero explicado", () => {
    const x = texto(termica);
    expect(x).toContain("As barras somam só os motivos classificados");
    expect(x).toContain("Combustível: até 2025 vem do CEG da usina em outros conjuntos do ONS; desde 2026, do campo do próprio conjunto");
    expect(x).toContain("O universo muda dentro dos 12 meses: as usinas pareadas entre os dois conjuntos do ONS passam de 88");
    expect(x).toMatch(/Este total, [\d.]+ MWmed, não é o da matriz efetiva/);
    expect(x).toContain("sem as térmicas Tipo III, em 365 dias");
    expect(x).toContain("CVU 0,00 é valor publicado pela fonte");
    expect(x).toContain("nunca é tratado como ausência");
    expect(x).toContain("que reúnem todas as estações do ano, não só esta época");
    expect(x).toContain("No Balanço, a eólica do Nordeste fica muito abaixo da soma das usinas em 16/01/2026, 07/03/2026 e 09/05/2026");
    expect(x).toContain("podem ter a participação térmica distorcida");
    // o que mudou traz a variação mensal da térmica
    expect(x).toContain(`A geração das térmicas despachadas em ${mesAno(t.ultimo_mes_completo)}:`);
  });

  it("restrições: a norma de ressarcimento é citada como lida em cópia de 08/01/2025, com as alterações de fontes secundárias ditas como não verificadas", () => {
    const x = texto(restricoes);
    expect(x).toContain("norma lida (REN ANEEL nº 1.030/2022, em cópia de 08/01/2025)");
    expect(x).toContain("alterações posteriores indicadas em fontes secundárias (Lei 15.269/2025; Portaria Normativa MME 140/2026) não foram verificadas aqui");
    expect(x).not.toContain("regra lida (REN");
    expect(x).toContain("Compensação: pela norma lida em cópia de 08/01/2025, só a razão elétrica (indisponibilidade externa) dá direito ao ESS");
    expect(x).toContain("Universos e períodos diferentes: eólicas, 157 usinas e conjuntos, série desde");
    expect(x).toContain("As duas taxas não se comparam como se fossem do mesmo conjunto");
    expect(restricoes).toContain("data-referencia-corte");
    expect(x).toContain("Para ler o maior corte: a potência em operação comercial era de");
    expect(x).toContain("Corte e potência são medidas de datas e universos diferentes");
    expect(x).toContain(`A energia não gerada estimada das eólicas em ${mesAno(G.restricoes.eolica!.ultimo_mes_completo!)}:`);
  });

  it("restrições: o mapa tem lista das maiores usinas com um único tab stop e não tem título solto por estado", () => {
    const pontos = [3, 2, 1].map((k) => ({ id: `u${k}`, nome: `Usina ${k}`, uf: "RN", x: 10 * k, y: 10 * k, classe: 2, razao: "ENE" as const, nao_gerada_gwh: 100 * k, taxa_pct: 10 * k }));
    const h = renderToStaticMarkup(
      createElement(GeracaoMapaUsinas, { titulo: "Mapa", ufs: [{ id: "1", uf: "RO", d: "M0,0L100,0L100,100Z" }], viewBox: "0 0 100 100", pontos, rotulosClasse: ["a", "b", "c"], selecionado: "u2", onSelecionar: () => undefined, semCoordenada: 0 }),
    );
    expect(h).toContain("data-lista-usinas");
    expect(h.indexOf("Usina 3")).toBeLessThan(h.indexOf("Usina 1"));
    const lista = h.slice(h.indexOf("data-lista-usinas"));
    expect((lista.match(/tabindex="0"/g) ?? []).length).toBe(1);
    expect((lista.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
    expect(h).not.toContain("<title>RO</title>");
    expect(h).toContain("a lista ao lado e a tabela equivalente abaixo");
  });

  it("capacidade: o que mudou traz o fator e a potência contra o mês anterior e o ano anterior, e as notas de universo ficam visíveis fora da tabela recolhida", () => {
    const x = texto(capacidade);
    const ultimo = cap.mensal.meses[cap.mensal.meses.length - 1];
    expect(x).toContain(`O fator de capacidade das eólicas em ${mesAno(ultimo)}:`);
    expect(x).toContain("pontos percentuais");
    expect(x).toContain("A potência eólica em operação comercial, média do mês, em");
    expect(x).toContain("A capacidade fiscalizada da ANEEL (SIGA) é outro universo");
    expect(x).toContain("biomassa, 18.050,9 MW na ANEEL contra 4.211,9 MW no ONS");
    expect(x).toContain("Fator de capacidade com parte da potência: biomassa 16,8% usa 1.794,2 MW");
    expect(x).toContain("Fator de capacidade acima de 100% numa usina num mês aparece em 228 usina-meses");
    expect(x).toContain(`Potência em operação comercial, média de cada mês, a partir do retrato de ${dataBR(cap.retrato.data)}`);
    expect(x).toContain("Entram só as usinas e conjuntos pareados com a Capacidade Instalada do ONS nos 12 meses: 149 nesta categoria, de 1.059 usinas no retrato de capacidade");
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
