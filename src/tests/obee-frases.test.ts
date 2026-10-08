import { describe, expect, it } from "vitest";
import { fraseAmplitude, fraseCapital, fraseCobertura, fraseEvolucao, listaNomes } from "@/lib/eficiencia/frases";

const it3 = [
  { nome: "Belém", uf: "PA", valor: 702 },
  { nome: "Recife", uf: "PE", valor: 1172 },
  { nome: "Vitória", uf: "ES", valor: 2362 },
];
const PROIBIDAS = /\b(eficiente|ineficiente|desperd|melhor|pior|gasta demais|gestão|ranking|meta|ideal|bom|ruim|melhorou|piorou|aumentou|diminuiu|caiu|cresceu)\b/i;

describe("frases factuais geradas dos dados", () => {
  it("amplitude com extremos nomeados", () => {
    const f = fraseAmplitude(it3, { medida: "despesa_hab", ano: 2025 });
    expect(f).toBe("A despesa em Educação por habitante vai de R$ 702 em Belém (PA) a R$ 2.362 em Vitória (ES) entre as 3 capitais com dado comparável em 2025.");
  });

  it("empate nos extremos lista todas as capitais empatadas, com limite", () => {
    const f = fraseAmplitude(
      [
        { nome: "A", uf: "AA", valor: 10 },
        { nome: "B", uf: "BB", valor: 10 },
        { nome: "C", uf: "CC", valor: 10 },
        { nome: "D", uf: "DD", valor: 30 },
      ],
      { medida: "atu", ano: 2025, etapa: "anos_iniciais" },
    );
    expect(f).toContain("A (AA), B (BB) e mais 1");
    expect(f).toContain("nos anos iniciais");
    expect(listaNomes([{ nome: "A", uf: "AA" }, { nome: "B", uf: "BB" }])).toBe("A (AA) e B (BB)");
  });

  it("valores iguais, um só valor e nenhum valor têm frase própria e nunca viram zero", () => {
    expect(fraseAmplitude([{ nome: "A", uf: "AA", valor: 10 }, { nome: "B", uf: "BB", valor: 10 }], { medida: "ideb", ano: 2023 })).toMatch(/é 10,0 nas 2 capitais.*na edição 2023/);
    expect(fraseAmplitude([it3[0]], { medida: "despesa", ano: 2024 })).toMatch(/^Só Belém \(PA\) tem dado comparável em 2024/);
    const vazio = fraseAmplitude([], { medida: "despesa_hab", ano: 2023 });
    expect(vazio).toMatch(/Nenhuma capital tem dado comparável/);
    expect(vazio).not.toMatch(/R\$ 0|\b0\b/);
  });

  it("cobertura", () => {
    expect(fraseCobertura(24, 26)).toBe("Há dados comparáveis para 24 das 26 capitais.");
    expect(fraseCobertura(26, 26)).toBe("Há dados comparáveis para as 26 capitais.");
    expect(fraseCobertura(0, 26)).toMatch(/nenhuma das 26/);
  });

  it("capital frente à mediana, em valores", () => {
    const f = fraseCapital("Recife", "PE", 1172, 1160, 26, "despesa_hab");
    expect(f).toBe("Recife (PE) registra R$ 1.172; a mediana das 26 capitais é R$ 1.160 (R$ 12 acima).");
    expect(fraseCapital("Natal", "RN", null, 1160, 26, "despesa_mat")).toMatch(/não tem valor observado/);
    expect(fraseCapital("Natal", "RN", 900, null, 0, "despesa_mat", true)).toMatch(/fora da comparação/);
    expect(fraseCapital("A", "AA", 1160, 1160, 26, "despesa_hab")).toMatch(/igual à mediana/);
  });

  it("evolução: só valores elegíveis; quebra de série entre os extremos bloqueia; um período só é dito", () => {
    const ok = [
      { ano: 2022, valor: 800, elegivel: true, quebraSerie: false },
      { ano: 2023, valor: 995, elegivel: true, quebraSerie: true },
      { ano: 2024, valor: 1106, elegivel: true, quebraSerie: false },
      { ano: 2025, valor: 1172, elegivel: true, quebraSerie: false },
    ];
    expect(fraseEvolucao(ok, "despesa_hab")).toBe("A despesa em Educação por habitante passou de R$ 800 em 2022 para R$ 1.172 em 2025.");
    expect(fraseEvolucao(ok, "despesa_hab", undefined, "Em Recife (PE)")).toBe("Em Recife (PE), a despesa em Educação por habitante passou de R$ 800 em 2022 para R$ 1.172 em 2025.");
    const quebra = [{ ano: 2021, valor: 536, elegivel: true, quebraSerie: true }, ...ok.slice(0, 1), { ano: 2025, valor: 1172, elegivel: true, quebraSerie: false }];
    expect(fraseEvolucao(quebra, "despesa_hab", "a população passou de estimativa para Censo")).toMatch(/não são diretamente comparáveis/);
    expect(fraseEvolucao([{ ano: 2025, valor: 5, elegivel: true, quebraSerie: false }, { ano: 2024, valor: null, elegivel: false, quebraSerie: false }], "ideb")).toMatch(/um só período/);
    expect(fraseEvolucao([{ ano: 2025, valor: 5, elegivel: false, quebraSerie: false }], "ideb")).toMatch(/Não há dado comparável/);
  });

  it("nenhuma frase emite juízo, meta ou causalidade", () => {
    const todas = [
      fraseAmplitude(it3, { medida: "despesa_hab", ano: 2025 }),
      fraseAmplitude([], { medida: "ideb", ano: 2023 }),
      fraseCapital("Recife", "PE", 1172, 1160, 26, "despesa_hab"),
      fraseCapital("Recife", "PE", 1100, 1160, 26, "despesa_hab"),
      fraseCobertura(20, 26),
      fraseEvolucao([{ ano: 2021, valor: 1, elegivel: true, quebraSerie: false }, { ano: 2025, valor: 9, elegivel: true, quebraSerie: false }], "ideb"),
    ];
    for (const t of todas) expect(t).not.toMatch(PROIBIDAS);
  });
});
