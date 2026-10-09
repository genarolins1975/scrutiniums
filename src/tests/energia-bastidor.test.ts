import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fonteLegivel, fraseDeRecusa, partirBastidor, recusaEmLinguagemSimples, semCaminhosDeArquivo, semCodigosDePergunta } from "@/lib/energia/bastidor";
import { TextoDoLeitor } from "@/components/energia/TextoDoLeitor";

/**
 * Bastidor da coleta fora de Entender (rodada r5). A frase que cita HTTP, Cloudflare, curl, sha256, silver ou
 * pipeline sai do texto do leitor e fica marcada para Analisar e Auditar; o resto do texto não muda.
 */
describe("partirBastidor", () => {
  const texto =
    "Em 30/09/2026, git.aneel.gov.br respondeu HTTP 403 com cf-mitigated: challenge (desafio do Cloudflare). O relatório traz os valores só em figuras, sem tabela. Os demais hosts encerram a conexão (curl 35).";

  it("separa as frases de bastidor das que o leitor lê, na ordem", () => {
    const r = partirBastidor(texto);
    expect(r.leitor).toBe("O relatório traz os valores só em figuras, sem tabela.");
    expect(r.tecnico).toContain("HTTP 403");
    expect(r.tecnico).toContain("curl 35");
  });

  it("texto sem bastidor passa intacto", () => {
    expect(partirBastidor("A fonte não declara a frequência.")).toEqual({ leitor: "A fonte não declara a frequência.", tecnico: "" });
  });

  it("datas com ponto e siglas não quebram a frase", () => {
    const r = partirBastidor("Atualizado em 01/10/2026. A taxa foi de 12,12% em 2025.");
    expect(r.tecnico).toBe("");
    expect(r.leitor).toBe("Atualizado em 01/10/2026. A taxa foi de 12,12% em 2025.");
  });

  it("tira o código interno de pergunta entre parênteses", () => {
    expect(semCodigosDePergunta("Perda não técnica regulatória (P057, P058)")).toBe("Perda não técnica regulatória");
    expect(semCodigosDePergunta("Item (P057 e P058) fecha")).toBe("Item fecha");
    expect(semCodigosDePergunta("Taxa de perdas (SAMP)")).toBe("Taxa de perdas (SAMP)");
  });
});

describe("TextoDoLeitor", () => {
  it("a frase de bastidor vai para um trecho marcado para Analisar", () => {
    const h = renderToStaticMarkup(createElement(TextoDoLeitor, { texto: "O portal respondeu HTTP 403. Não há recurso equivalente." }));
    expect(h).toContain("Não há recurso equivalente.");
    expect(h).toMatch(/<span data-nivel="analisar">[^<]*HTTP 403\.<\/span>/);
  });

  it("sem nada para o leitor, usa a frase padrão e mantém o bastidor marcado", () => {
    const h = renderToStaticMarkup(createElement(TextoDoLeitor, { texto: "HTTP 403 com cf-mitigated.", padrao: "A fonte recusou a consulta." }));
    expect(h.startsWith("A fonte recusou a consulta.")).toBe(true);
    expect(h).toContain('data-nivel="analisar"');
  });
});

describe("recusa de fonte em linguagem de leitor", () => {
  it("fraseDeRecusa diz quem recusou e quando, sem código de resposta", () => {
    const f = fraseDeRecusa("Em 30/09/2026, git.aneel.gov.br respondeu HTTP 403 com cf-mitigated: challenge.", "da ANEEL");
    expect(f).toBe("Em 30/09/2026, os servidores da ANEEL recusaram as consultas automáticas do observatório.");
    expect(f).not.toMatch(/HTTP|cf-mitigated/);
    expect(fraseDeRecusa("O relatório traz os valores só em figuras.", "da ANEEL")).toBe("");
  });

  it("recusaEmLinguagemSimples troca o 403 do navegador pela frase de leitor e deixa o resto", () => {
    const t = "publicados em git.aneel.gov.br, que responderam 403 com desafio de navegador (Cloudflare) em 30/09/2026; não há recurso equivalente.";
    const r = recusaEmLinguagemSimples(t);
    expect(r).toBe("publicados em git.aneel.gov.br, que recusaram as consultas automáticas do observatório em 30/09/2026; não há recurso equivalente.");
  });
});

describe("caminho de arquivo entre parênteses", () => {
  it("sai do texto do leitor; sigla e parêntese comum ficam", () => {
    expect(semCaminhosDeArquivo("A composição está no arquivo de configuração da pesquisa (projeto_pld/config/etapa2b_E2B-C123-v1.json), que não foi publicado.")).toBe(
      "A composição está no arquivo de configuração da pesquisa, que não foi publicado.",
    );
    expect(semCaminhosDeArquivo("Preço de Liquidação das Diferenças (PLD)")).toBe("Preço de Liquidação das Diferenças (PLD)");
  });
});

describe("fonteLegivel", () => {
  it("tira pipeline, silver, gold e caminho do nome da fonte", () => {
    expect(fonteLegivel("Scrutiniums (pipeline do observatório), Silvers e golds do domínio Energia")).toBe("Scrutiniums (observatório), Bases do domínio Energia");
    expect(fonteLegivel("Scrutiniums (pipeline do observatório), Validador genérico (pipeline/energia/validacoes.py)")).toBe("Scrutiniums (observatório), Validador genérico");
    expect(fonteLegivel("ONS, Carga de Energia Diária")).toBe("ONS, Carga de Energia Diária");
  });
});

describe("frases com nome de arquivo e de rotina vão para Analisar", () => {
  it("pld.json, .py e workflow contam como bastidor", () => {
    const r = partirBastidor("A tentativa está registrada em pld.json. A previsão principal segue sem número. A rodada roda no workflow diário.");
    expect(r.leitor).toBe("A previsão principal segue sem número.");
    expect(r.tecnico).toContain("pld.json");
    expect(r.tecnico).toContain("workflow");
  });
});
