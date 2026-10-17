import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Reajustes from "@/app/saneamento/preco-regulado/reajustes/page";
import atos from "@/lib/saneamento/dados/atos.json";
import SimuladorPagina from "@/app/saneamento/preco-regulado/simulador/page";
import TarifaSocialPagina from "@/app/saneamento/tarifa-social/page";
import { prestador } from "@/lib/saneamento/gold";
import { TARIFAS, prestadorComTarifa, tarifa } from "@/lib/saneamento/tarifas";
import { acimaDoLimite, calcularConta, expoente, leituras, linhasExportacao } from "@/lib/saneamento/conta";

/**
 * Corsan (RS), Tabela I em vigor desde 01/07/2026, categoria Residencial B, ligação com hidrômetro: serviço básico mais
 * preço-base vezes o consumo elevado ao expoente da faixa, sem consumo mínimo (RSAE, arts. 69 e 92), esgoto a 70% do
 * preço-base por m³ de água.
 * Os valores esperados foram calculados fora do gerador (aritmética decimal e, separadamente, em ponto flutuante) e conferidos
 * contra a tarifa mínima oficial de R$ 134,89 para 10 m³.
 */
const ID = "corsan-2026";
const res = () => tarifa(ID)!.categorias.residencial;
const conta = (c: number) => calcularConta(res(), c);
const texto = (h: string) => h.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("Corsan: conta da Residencial B", () => {
  it("ligação medida não tem mínimo: com consumo zero a conta é só o serviço básico", () => {
    expect(conta(0).agua).toBe(43.39);
    expect(conta(0).esgoto).toBe(0);
    expect(conta(0).total).toBe(43.39);
    expect(conta(5).agua).toBe(89.14); // 43,39 + 5 × 9,15
    expect(conta(5).esgoto).toBe(32); // 5 × 6,40
    expect(conta(5).total).toBe(121.14);
  });

  it("a 10 m³ a água medida coincide com a tarifa mínima publicada (ligação sem hidrômetro)", () => {
    expect(conta(10).agua).toBe(134.89); // 43,39 + 10 × 9,15
    expect(conta(10).esgoto).toBe(64);
    expect(conta(10).total).toBe(198.89);
  });

  it("até 20 m³ o expoente é 1 e a conta é linear", () => {
    expect(conta(11).total).toBe(214.44); // + 9,15 + 6,40
    expect(conta(20).agua).toBe(226.39); // 43,39 + 20 × 9,15
    expect(conta(20).esgoto).toBe(128);
    expect(conta(20).total).toBe(354.39);
  });

  it("a partir de 21 m³ a água usa o preço-base vezes o consumo elevado ao expoente da faixa", () => {
    expect(conta(21).agua).toBe(241.48); // 43,39 + 9,15 × 21^1,01
    expect(conta(30).agua).toBe(416.2); // 30^1,09
    expect(conta(36).agua).toBe(514.75); // 36^1,10
    expect(conta(101).agua).toBe(1727.24); // 101^1,13
    expect(conta(151).total).toBe(3645.1); // 151^1,1287 e esgoto de 151 × 6,40
  });

  it("o expoente é o da última linha da tabela que não passa do consumo", () => {
    const e = res().agua.exponencial!;
    const esperados: Record<number, number> = { 10: 1, 20: 1, 21: 1.01, 30: 1.09, 31: 1.09, 35: 1.09, 36: 1.1, 50: 1.11, 51: 1.11, 100: 1.11, 101: 1.13, 150: 1.13, 151: 1.1287, 200: 1.1287, 201: 1.1275, 9001: 1.0858 };
    for (const [c, n] of Object.entries(esperados)) expect(expoente(e, Number(c)), `${c} m³`).toBe(n);
    expect(expoente(e, 0)).toBe(1);
  });

  it("o esgoto não usa o expoente: R$ 6,40 por m³ de água", () => {
    expect(conta(30).esgoto).toBe(192);
    expect(conta(100).esgoto).toBe(640);
  });

  it("a fração de metro cúbico é desprezada e as leituras partem do volume faturado", () => {
    expect(conta(35.99).total).toBe(conta(35).total);
    expect(conta(10.9).total).toBe(conta(10).total);
    expect(conta(10.9).consumo).toBe(10);
    expect(res().consumoInteiro).toBe(true);
    const l = leituras(tarifa(ID)!, "residencial", 10.9);
    expect(l.precoMedio).toBeCloseTo(198.89 / 10, 9); // não 198,89 ÷ 10,9
    expect(l.m3Adicional).toBe(15.55); // de 10 para 11 m³: 214,44 − 198,89
  });

  it("a tabela oficial faz a água cair ao passar de 200 para 201 m³; a simulação mostra a tabela como está", () => {
    expect(conta(201).agua).toBeLessThan(conta(200).agua);
    expect(conta(200).agua).toBe(3662.43);
    expect(conta(201).agua).toBe(3659.77);
    expect(leituras(tarifa(ID)!, "residencial", 200).m3Adicional).toBeCloseTo(3.74, 2); // água −2,66 e esgoto +6,40
  });

  it("o esgoto tem uma única linha, de todo o volume, sem mínimo", () => {
    const linhas = conta(30).linhas.filter((l) => l.servico === "esgoto");
    expect(linhas).toHaveLength(1);
    expect(linhas[0].rotulo).toBe("Todo o volume");
    expect(linhas[0].volume).toBe(30);
    expect(linhas[0].valor).toBe(192);
  });

  it("a linha de água do detalhe mostra o expoente e nunca um mínimo", () => {
    for (const c of [0, 5, 10, 30]) expect(conta(c).linhas.some((l) => l.rotulo.startsWith("Mínimo")), `${c} m³`).toBe(false);
    const l = conta(30).linhas.find((x) => x.servico === "agua" && x.rotulo.startsWith("Consumo"))!;
    expect(l.rotulo).toContain("1,09");
    expect(l.volume).toBe(30);
    expect(l.preco).toBe(9.15);
  });
});

describe("Corsan: registro da tabela", () => {
  const t = tarifa(ID)!;

  it("fontes com sha256: Anexo 5, Tabela de Exponenciais, as tabelas anteriores, o comunicado e o Regulamento da AGERGS", () => {
    for (const f of t.fontes) {
      expect(f.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(f.url).toMatch(/^https:\/\//);
    }
    for (const trecho of ["ANEXO-5-TABELA-TARIFARIA", "tabela-exponenciais", "298-municipios_2026", "5-2025-tabela-tarifaria-298", "comunicado-de-criacao", "agergs.rs.gov.br/upload/arquivo1974"]) {
      expect(t.fontes.some((f) => f.url.includes(trecho)), trecho).toBe(true);
    }
    expect(t.acessado).toBe("2026-10-17");
  });

  it("declara as leituras não verificadas, o que não foi lido e o que não foi simulado", () => {
    expect(t.metodoNaoVerificado).toContain("R$ 15,96");
    expect(t.metodoNaoVerificado).toContain("tarifas mínimas oficiais");
    const obs = t.observacoes.join(" ");
    for (const trecho of ["547,66", "534,52", "247 municípios", "RED 892/2026", "não lidas", "Arredondamento não verificado", "67,44", "não foram simuladas", "ESGOTO TRATADO", "art. 69", "R$ 121,14"]) expect(obs, trecho).toContain(trecho);
    expect(obs).toContain("não aplica mínimo de 10 m³");
    expect(t.ato).toContain("RED nº 892/2026");
    expect(Object.keys(t.categorias)).toEqual(["residencial", "social"]);
  });

  it("os municípios são os 298 do Apêndice 1 e os 15 da AGESAN, todos no RS e no vínculo da Corsan no SINISA 2024", () => {
    const p = prestador("corsan-companhia-riograndense-de-saneamento")!;
    expect(t.municipios).toHaveLength(313);
    expect(new Set(t.municipios).size).toBe(313);
    for (const agesan of ["4303905", "4319901", "4321600", "4304408"]) expect(prestadorComTarifa(agesan), agesan).toBe(ID); // Campo Bom, Sapiranga, Tramandaí, Canela
    for (const m of t.municipios) expect(p.municipios_agua).toContain(m);
    expect(p.municipios_agua).toHaveLength(317); // 298 mais 19 com tabela própria
    expect(prestadorComTarifa("4309209")).toBe(ID); // Gravataí
    expect(prestadorComTarifa("4302105")).toBe(ID); // Bento Gonçalves
    expect(prestadorComTarifa("4304606")).toBe("corsan-canoas-esteio-2026"); // Canoas
    expect(prestadorComTarifa("4307708")).toBe("corsan-canoas-esteio-2026"); // Esteio
    expect(prestadorComTarifa("4316808")).toBe("corsan-santa-cruz-2026"); // Santa Cruz do Sul
    expect(prestadorComTarifa("4307005")).toBe("corsan-erechim-2026"); // Erechim
    expect(prestadorComTarifa("4314902")).toBeNull(); // Porto Alegre (DMAE)
  });

  it("só as tabelas da Corsan têm exponencial e consumo inteiro; só a social tem teto de consumo (15 m³)", () => {
    for (const x of TARIFAS) {
      for (const [k, c] of Object.entries(x.categorias)) {
        expect(c.agua.exponencial != null, x.id).toBe(x.id.startsWith("corsan-"));
        expect(c.consumoInteiro != null, x.id).toBe(x.id.startsWith("corsan-"));
        if (x.id.startsWith("corsan-")) expect(c.consumoMaximo, `${x.id} ${k}`).toBe(k === "social" ? 15 : undefined);
      }
    }
    expect(res().consumoMaximo).toBeUndefined();
  });

  it("a exportação traz a Residencial B nos cinco consumos e a social até 15 m³, com as linhas acima do teto ditas", () => {
    const linhas = linhasExportacao([t]);
    const b = linhas.filter((l) => l[6] === "Residencial (categoria básica)");
    expect(b.map((l) => l[7])).toEqual([5, 10, 15, 20, 30]);
    expect(b.every((l) => l[11] === "calculada")).toBe(true);
    expect(b.map((l) => l[10])).toEqual([121.14, 198.89, 276.64, 354.39, 608.2]);
    const soc = linhas.filter((l) => String(l[6]).startsWith("Residencial social"));
    expect(soc.map((l) => l[11])).toEqual(["calculada", "calculada", "calculada", "sem preço no ato acima de 15 m³", "sem preço no ato acima de 15 m³"]);
    expect(soc.slice(0, 3).map((l) => l[10])).toEqual([60.6, 99.5, 138.4]);
  });
});

describe("Corsan: atos e página de reajustes", () => {
  const lista = (atos as { atos: { prestador: string; verificado: boolean; ato: string; area: string }[] }).atos;

  it("o catálogo registra os seis atos como não lidos no texto oficial", () => {
    const c = lista.filter((a) => a.prestador === "CORSAN");
    expect(c).toHaveLength(6);
    expect(c.every((a) => !a.verificado)).toBe(true);
    expect(c.map((a) => a.ato).join(" ")).toContain("RED 892, 09/06/2026");
    for (const trecho of ["Canoas e Esteio", "Santa Cruz do Sul a partir de 18/09/2026", "Erechim", "Resoluções CSR AGESAN 05/2026 e 11/2026"]) {
      expect(c.some((a) => `${a.ato} ${a.area}`.includes(trecho)), trecho).toBe(true);
    }
  });

  it("a página de reajustes mostra os atos da Corsan e a data de levantamento", () => {
    const h = texto(renderToStaticMarkup(createElement(Reajustes)));
    expect(h).toContain("CORSAN em 17/10/2026");
    expect(h).toContain("Resolução Decisória AGERGS RED 892, 09/06/2026");
    expect(h).toContain(`${lista.length} atos de 2023 a 2026 de ${new Set(lista.map((a) => a.prestador)).size} prestadores; ${lista.filter((a) => a.verificado).length} lidos no texto oficial`);
  });
});

describe("Corsan: Residencial Social da Lei 14.898/2024, até 15 m³", () => {
  const soc = (id: string) => tarifa(id)!.categorias.social;
  const total = (id: string, c: number) => calcularConta(soc(id), c).total;

  it("conta social nas três tabelas com a linha da lei, com valores calculados fora do gerador", () => {
    const esperados: Record<string, Record<number, number>> = {
      "corsan-2026": { 0: 21.7, 5: 60.6, 10: 99.5, 15: 138.4 },
      "corsan-canoas-esteio-2026": { 0: 20.6, 5: 57.45, 10: 94.3, 15: 131.15 },
      "corsan-santa-cruz-2026": { 0: 19.13, 5: 53.38, 10: 87.63, 15: 121.88 },
    };
    for (const [id, ex] of Object.entries(esperados)) for (const [c, v] of Object.entries(ex)) expect(total(id, Number(c)), `${id} ${c} m³`).toBe(v);
  });

  it("água a 10 m³ ao preço impresso: fecha a mínima em Canoas e Esteio e difere em centavos nas outras (a mínima é metade da Residencial B)", () => {
    expect(calcularConta(soc("corsan-canoas-esteio-2026"), 10).agua).toBe(64); // mínima publicada R$ 64,00
    expect(calcularConta(soc("corsan-2026"), 10).agua).toBe(67.5); // mínima publicada R$ 67,44
    expect(calcularConta(soc("corsan-santa-cruz-2026"), 10).agua).toBe(59.43); // mínima publicada R$ 59,48
    expect(tarifa("corsan-2026")!.metodoNaoVerificado).toContain("R$ 0,06 acima da mínima publicada");
    expect(tarifa("corsan-santa-cruz-2026")!.metodoNaoVerificado).toContain("R$ 0,05 abaixo da mínima publicada");
  });

  it("acima de 15 m³ não há preço: o simulador não calcula e o custo de mais 1 m³ em 15 m³ é indefinido", () => {
    const cat = soc("corsan-2026");
    expect(acimaDoLimite(cat, 15)).toBe(false);
    expect(acimaDoLimite(cat, 16)).toBe(true);
    expect(() => calcularConta(cat, 16)).toThrow(RangeError);
    expect(leituras(tarifa("corsan-2026")!, "social", 15).m3Adicional).toBeNull();
    expect(leituras(tarifa("corsan-2026")!, "social", 10).m3Adicional).toBe(7.78); // 4,58 + 3,20
  });

  it("Erechim não tem a linha da lei na tabela de janeiro de 2026", () => {
    expect(Object.keys(tarifa("corsan-erechim-2026")!.categorias)).toEqual(["residencial"]);
    expect(tarifa("corsan-erechim-2026")!.observacoes.join(" ")).toContain("não traz a linha da Residencial Social da Lei 14.898/2024");
  });

  it("a página de tarifa social mostra a social da Corsan nos 298 municípios, em Canoas e Esteio e em Santa Cruz do Sul", () => {
    const h = texto(renderToStaticMarkup(createElement(TarifaSocialPagina)));
    expect(h).toContain("Residencial social (tarifa social federal, Lei 14.898/2024)");
    for (const area of ["298 municípios do Apêndice 1 do Anexo 5 e 15 municípios da AGESAN", "Canoas e Esteio (tabela própria", "Santa Cruz do Sul (tabela própria"]) expect(h, area).toContain(area);
    expect(h).not.toContain("Erechim (tabela própria"); // sem categoria social
  });
});

describe("Corsan: tabelas próprias de Canoas e Esteio, Santa Cruz do Sul e Erechim", () => {
  const proprias = ["corsan-canoas-esteio-2026", "corsan-santa-cruz-2026", "corsan-erechim-2026"];

  it("há doze tabelas, três delas variantes da Corsan, e nenhum município está em duas tabelas da Corsan", () => {
    expect(TARIFAS).toHaveLength(12);
    expect(TARIFAS.filter((x) => x.variante).map((x) => x.id)).toEqual(proprias);
    const ms = TARIFAS.filter((x) => x.id.startsWith("corsan-")).flatMap((x) => x.municipios);
    expect(ms).toHaveLength(313 + 4);
    expect(new Set(ms).size).toBe(ms.length);
  });

  it("Residencial B: valores calculados fora do gerador e mínima publicada igual à água de 10 m³", () => {
    const esperados: Record<string, [number, number, number, number]> = {
      // 0, 10, 30 e 50 m³ (água e esgoto)
      "corsan-canoas-esteio-2026": [41.2, 188.7, 576.96, 1012.08],
      "corsan-santa-cruz-2026": [38.25, 175.35, 536.25, 940.73],
      "corsan-erechim-2026": [32.95, 151.05, 461.92, 810.32],
    };
    const minimas: Record<string, number> = { "corsan-canoas-esteio-2026": 128, "corsan-santa-cruz-2026": 118.95, "corsan-erechim-2026": 102.45 };
    for (const [id, [a, b, c, d]] of Object.entries(esperados)) {
      const cat = tarifa(id)!.categorias.residencial;
      expect([0, 10, 30, 50].map((m) => calcularConta(cat, m).total), id).toEqual([a, b, c, d]);
      expect(calcularConta(cat, 10).agua, id).toBe(minimas[id]);
    }
  });

  it("regulador e vigência não afirmam o que não foi lido", () => {
    expect(tarifa("corsan-canoas-esteio-2026")!.regulador).toContain("ato não lido");
    expect(tarifa("corsan-santa-cruz-2026")!.regulador).toContain("ato não lido");
    expect(tarifa("corsan-erechim-2026")!.regulador).toContain("não identificado");
    expect(tarifa("corsan-erechim-2026")!.vigencia).toContain("não foi localizada tabela posterior");
    expect(tarifa("corsan-santa-cruz-2026")!.vigencia).toContain("18/09/2026");
  });

  it("fontes com sha256 e URL do PDF de cada tabela", () => {
    const urls: Record<string, string[]> = {
      "corsan-canoas-esteio-2026": ["ANEXO-3-CANOAS-E-ESTEIO_AGOSTO-2026", "ANEXO-1_COMUNICADO-REVISAO-TARIFARIA_CANOAS-E-ESTEIO", "Tabela-Tarifaria-Canoas-e-Esteio_2026-x"],
      "corsan-santa-cruz-2026": ["AGERST_Tabela_Tarifaria_Santa_Cruz_do_Sul_2026", "Tabela-Tarifaria-Santa-Cruz-do-Sul_2026-x"],
      "corsan-erechim-2026": ["Tabela-Tarifaria-Erechim_2026-x"],
    };
    for (const [id, trechos] of Object.entries(urls)) {
      const t = tarifa(id)!;
      for (const f of t.fontes) expect(f.sha256, `${id} ${f.rotulo}`).toMatch(/^[a-f0-9]{64}$/);
      for (const trecho of trechos) expect(t.fontes.some((f) => f.url.includes(trecho)), `${id} ${trecho}`).toBe(true);
    }
    expect(tarifa(ID)!.fontes.some((f) => f.url.includes("ANEXO-4-AGESAN_AGOSTO-2026"))).toBe(true);
  });

  it("o simulador explica que as variantes ficam fora do gráfico de curvas e o seletor as rotula pelo recorte", () => {
    const h = texto(renderToStaticMarkup(createElement(SimuladorPagina)));
    expect(h).toContain("Ficam fora do gráfico de curvas, para não sobrepor a linha do mesmo prestador, as tabelas próprias de Canoas e Esteio, Santa Cruz do Sul, Erechim.");
    for (const r of ["CORSAN (RS, Canoas e Esteio)", "CORSAN (RS, Santa Cruz do Sul)", "CORSAN (RS, Erechim)"]) expect(h, r).toContain(r);
    expect(h).toContain("a da Corsan acima de 15 m³");
  });
});
