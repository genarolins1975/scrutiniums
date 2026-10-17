import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Reajustes from "@/app/saneamento/preco-regulado/reajustes/page";
import atos from "@/lib/saneamento/dados/atos.json";
import { prestador } from "@/lib/saneamento/gold";
import { TARIFAS, prestadorComTarifa, tarifa } from "@/lib/saneamento/tarifas";
import { calcularConta, expoente, leituras, linhasExportacao } from "@/lib/saneamento/conta";

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
    expect(Object.keys(t.categorias)).toEqual(["residencial"]);
  });

  it("os municípios são os 298 do Apêndice 1, todos no RS e no vínculo da Corsan no SINISA 2024", () => {
    const p = prestador("corsan-companhia-riograndense-de-saneamento")!;
    expect(t.municipios).toHaveLength(298);
    expect(new Set(t.municipios).size).toBe(298);
    for (const m of t.municipios) expect(p.municipios_agua).toContain(m);
    expect(p.municipios_agua).toHaveLength(317); // 298 mais 19 com tabela própria
    expect(prestadorComTarifa("4309209")).toBe(ID); // Gravataí
    expect(prestadorComTarifa("4302105")).toBe(ID); // Bento Gonçalves
    for (const fora of ["4304606", "4307005", "4307708", "4316808", "4314902"]) expect(prestadorComTarifa(fora), fora).toBeNull(); // Canoas, Erechim, Esteio, Santa Cruz do Sul, Porto Alegre
  });

  it("só a Corsan tem exponencial e consumo inteiro, e nenhuma categoria dela tem teto de consumo", () => {
    for (const x of TARIFAS) {
      for (const c of Object.values(x.categorias)) {
        expect(c.agua.exponencial != null, x.id).toBe(x.id === ID);
        expect(c.consumoInteiro != null, x.id).toBe(x.id === ID);
      }
    }
    expect(res().consumoMaximo).toBeUndefined();
  });

  it("a exportação traz a Residencial B nos cinco consumos, todos calculados", () => {
    const linhas = linhasExportacao([t]);
    expect(linhas.map((l) => l[7])).toEqual([5, 10, 15, 20, 30]);
    expect(linhas.every((l) => l[11] === "calculada")).toBe(true);
    expect(linhas.map((l) => l[10])).toEqual([121.14, 198.89, 276.64, 354.39, 608.2]);
  });
});

describe("Corsan: atos e página de reajustes", () => {
  const lista = (atos as { atos: { prestador: string; verificado: boolean; ato: string }[] }).atos;

  it("o catálogo registra os dois atos como não lidos no texto oficial", () => {
    const c = lista.filter((a) => a.prestador === "CORSAN");
    expect(c).toHaveLength(2);
    expect(c.every((a) => !a.verificado)).toBe(true);
    expect(c.map((a) => a.ato).join(" ")).toContain("RED 892, 09/06/2026");
  });

  it("a página de reajustes mostra os atos da Corsan e a data de levantamento", () => {
    const h = texto(renderToStaticMarkup(createElement(Reajustes)));
    expect(h).toContain("CORSAN em 17/10/2026");
    expect(h).toContain("Resolução Decisória AGERGS RED 892, 09/06/2026");
    expect(h).toContain(`${lista.length} atos de 2023 a 2026 de ${new Set(lista.map((a) => a.prestador)).size} prestadores; ${lista.filter((a) => a.verificado).length} lidos no texto oficial`);
  });
});
