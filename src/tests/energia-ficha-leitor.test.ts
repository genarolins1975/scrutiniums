import { describe, expect, it } from "vitest";
import {
  descricaoLegivel,
  instantesLegiveis,
  listaEmPortugues,
  orgaosDasFontes,
  partirLicenca,
  situacaoDoConjunto,
} from "@/lib/energia/dados";

/**
 * Ficha do conjunto de dados em linguagem de leitor (rodada r4 da avaliação P071). O que protege:
 * descrição sem frase cortada, licença separada da observação de coleta, instante UTC no horário
 * de Brasília, situação dos dados com a causa do atraso e rodapé com os órgãos que de fato aparecem.
 */

describe("descricaoLegivel", () => {
  it("texto inteiro passa como veio; ausência vira nulo sem corte", () => {
    expect(descricaoLegivel("Dados de geração por submercado.")).toEqual({ texto: "Dados de geração por submercado.", cortada: false });
    expect(descricaoLegivel(null)).toEqual({ texto: null, cortada: false });
    expect(descricaoLegivel("  ")).toEqual({ texto: null, cortada: false });
  });

  it("frase interrompida em reticências sai; fica até o último ponto final e diz que houve corte", () => {
    const r = descricaoLegivel("Séries mensais de consumo por classe. Inclui o ambiente livre e o cativo, com valores em MWh para cada…");
    expect(r).toEqual({ texto: "Séries mensais de consumo por classe.", cortada: true });
  });

  it("corte logo no começo não deixa fragmento: nada é mostrado, o corte é declarado", () => {
    expect(descricaoLegivel("Dados de geração utilizados na contabilização do MCP - Mercado de Curto Prazo…")).toEqual({ texto: null, cortada: true });
  });
});

describe("partirLicenca", () => {
  it("separa a licença da observação de coleta que o catálogo anexa", () => {
    const r = partirLicenca("Creative Commons Atribuição 4.0. A página do conjunto não declara a licença de forma legível por máquina.");
    expect(r.curta).toBe("Creative Commons Atribuição 4.0.");
    expect(r.nota).toBe("A página do conjunto não declara a licença de forma legível por máquina.");
  });

  it("licença curta e sem observação fica inteira", () => {
    expect(partirLicenca("Open Data Commons Open Database License")).toEqual({ curta: "Open Data Commons Open Database License", nota: null });
  });
});

describe("instantesLegiveis", () => {
  it("instante UTC dentro de frase vai para o horário de Brasília; o resto do texto não muda", () => {
    const r = instantesLegiveis("A fonte não publicou período mais recente até a última coleta bem-sucedida (2026-09-30T22:30:56Z).");
    expect(r).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(r).toContain("30/09/2026");
    expect(r).toContain("19:30");
    expect(r.startsWith("A fonte não publicou período mais recente")).toBe(true);
  });

  it("texto sem instante passa intacto", () => {
    expect(instantesLegiveis("Sem dado para medir.")).toBe("Sem dado para medir.");
  });
});

describe("situacaoDoConjunto", () => {
  const atual = (a: Record<string, unknown>) => situacaoDoConjunto({ atualidade: a } as Parameters<typeof situacaoDoConjunto>[0]);

  it("atrasado é alerta, com dias além do prazo, período e causa legível", () => {
    const r = atual({ situacao: "ATRASADO", dias_atraso: 12, ultimo_periodo: "2026-08", causa: "Sem publicação nova (2026-09-30T22:30:56Z)." });
    expect(r.alerta).toBe(true);
    expect(r.titulo).toBe("Dado atrasado: 12 dias além do prazo");
    expect(r.texto).toContain("08/2026");
    expect(r.texto).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("atrasado sem causa informada não inventa uma", () => {
    expect(atual({ situacao: "ATRASADO", dias_atraso: 1, ultimo_periodo: null, causa: null }).texto).toBe("A fonte não publicou período mais recente.");
  });

  it("em dia, sem prazo declarado e não medido não são alerta", () => {
    expect(atual({ situacao: "EM DIA", ultimo_periodo: "2026-09" })).toMatchObject({ alerta: false, titulo: "Dado em dia" });
    expect(atual({ situacao: "SEM SLA" })).toMatchObject({ alerta: false, titulo: "Sem prazo de atualização declarado" });
    const nm = atual({ situacao: "SEM DADO PARA MEDIR", motivo_sem_sla: "Sem série regular." });
    expect(nm).toMatchObject({ alerta: false, titulo: "Atraso não medido", texto: "Sem série regular." });
  });
});

describe("orgaosDasFontes e listaEmPortugues", () => {
  it("conta um órgão por conjunto, do mais citado ao menos, empate pelo nome", () => {
    const pub = { conjuntos: [{ orgao: "ONS" }, { orgao: "ANEEL" }, { orgao: "CCEE" }, { orgao: "CCEE" }, { orgao: "ANEEL" }, { orgao: "ANEEL" }] };
    expect(orgaosDasFontes(pub as Parameters<typeof orgaosDasFontes>[0])).toEqual([
      { orgao: "ANEEL", conjuntos: 3 },
      { orgao: "CCEE", conjuntos: 2 },
      { orgao: "ONS", conjuntos: 1 },
    ]);
    expect(orgaosDasFontes(null)).toEqual([]);
  });

  it("lista em português", () => {
    expect(listaEmPortugues([])).toBe("");
    expect(listaEmPortugues(["ANEEL"])).toBe("ANEEL");
    expect(listaEmPortugues(["ANEEL", "CCEE"])).toBe("ANEEL e CCEE");
    expect(listaEmPortugues(["ANEEL", "CCEE", "ONS"])).toBe("ANEEL, CCEE e ONS");
  });
});
