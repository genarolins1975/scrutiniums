import { describe, expect, it } from "vitest";
import {
  buscaDeParametros,
  campo,
  chavesAlteradas,
  dataValida,
  escreverEstado,
  estabilizar,
  gravarNaUrl,
  lerEstado,
  modoHistorico,
  tiposUrl as t,
  type JanelaUrl,
} from "@/lib/energia/estadoUrl";

/**
 * Estado de consulta na URL (src/lib/energia/estadoUrl.ts), a base de
 * useEstadoUrl, TabelaInterativa e Comparador. O que este teste protege:
 *
 *  1. link com valor inválido (número com vírgula, data inexistente, código
 *     desconhecido) abre no padrão, nunca num recorte que ninguém pediu;
 *  2. o padrão não vai para a URL, e a lista vazia explícita (?ent=) é
 *     distinta do padrão;
 *  3. parâmetros de outros componentes (?modo= do ModoProfundidade, utm_*) e
 *     o #hash sobrevivem a cada gravação, com a mesma codificação e ordem;
 *  4. seleção cria entrada no histórico, digitação substitui, repetição não
 *     duplica, e voltar/avançar reconstituem o estado a partir da URL.
 */

const SM = ["SE", "S", "NE", "N"] as const;
const esquema = {
  ent: campo(t.lista(t.opcao(SM), { max: 3 }), ["SE"]),
  q: campo(t.texto(), "", { historico: "replace" }),
  ano: campo(t.inteiro({ min: 2000, max: 2030 }), 2025),
  limiar: campo(t.numero({ min: 0 }), 10),
  de: campo(t.data({ min: "2020-01-01" }), "2024-01-01", { param: "inicio" }),
  mes: campo(t.mes(), "2024-01"),
  ativo: campo(t.booleano(), false),
  ord: campo(t.ordem(["nome", "perda"]), { coluna: "perda", direcao: "desc" }),
  pag: campo(t.inteiro({ min: 1 }), 1, { historico: "replace" }),
};
const PADRAO = lerEstado(esquema, "");

describe("leitura", () => {
  it("sem parâmetro, cada campo vale o padrão", () => {
    expect(PADRAO).toEqual({
      ent: ["SE"],
      q: "",
      ano: 2025,
      limiar: 10,
      de: "2024-01-01",
      mes: "2024-01",
      ativo: false,
      ord: { coluna: "perda", direcao: "desc" },
      pag: 1,
    });
  });

  it("valores válidos são lidos com o tipo certo (parâmetro com nome próprio incluído)", () => {
    const v = lerEstado(esquema, "?ent=N,SE&q=S%C3%A3o+Paulo&ano=2026&limiar=12.5&inicio=2024-02-29&mes=2025-12&ativo=1&ord=nome&pag=3");
    expect(v).toEqual({
      ent: ["N", "SE"],
      q: "São Paulo",
      ano: 2026,
      limiar: 12.5,
      de: "2024-02-29",
      mes: "2025-12",
      ativo: true,
      ord: { coluna: "nome", direcao: "asc" },
      pag: 3,
    });
    expect(lerEstado(esquema, "ord=-nome").ord).toEqual({ coluna: "nome", direcao: "desc" });
  });

  const invalidos: [keyof typeof esquema, string, string][] = [
    ["ano", "ano", "2026.5"],
    ["ano", "ano", "abc"],
    ["ano", "ano", "1999"],
    ["ano", "ano", ""],
    ["ano", "ano", "0x7EA"],
    ["limiar", "limiar", "12,5"],
    ["limiar", "limiar", "-1"],
    ["limiar", "limiar", "Infinity"],
    ["limiar", "limiar", " "],
    ["de", "inicio", "2023-02-29"],
    ["de", "inicio", "2024-13-01"],
    ["de", "inicio", "2024-1-01"],
    ["de", "inicio", "2019-12-31"],
    ["mes", "mes", "2024-13"],
    ["mes", "mes", "2024-1"],
    ["ativo", "ativo", "talvez"],
    ["ord", "ord", "-inexistente"],
    ["q", "q", "   "],
    ["pag", "pag", "0"],
  ];
  it.each(invalidos)("%s inválido (%s=%j) volta ao padrão", (chave, param, bruto) => {
    const v = lerEstado(esquema, `?${param}=${encodeURIComponent(bruto)}`);
    expect(v[chave]).toEqual(PADRAO[chave]);
  });

  it("número aceita notação científica e não produz zero negativo", () => {
    expect(lerEstado(esquema, "?limiar=1e3").limiar).toBe(1000);
    expect(Object.is(lerEstado({ x: campo(t.numero(), 5) }, "?x=-0").x, 0)).toBe(true);
  });

  it("lista: descarta itens inválidos e repetidos, respeita o máximo e a ordem de escolha", () => {
    expect(lerEstado(esquema, "?ent=N,XX,N,S,NE,SE").ent).toEqual(["N", "S", "NE"]);
    // nenhum item válido: vale o padrão, não a lista vazia
    expect(lerEstado(esquema, "?ent=XX,YY").ent).toEqual(["SE"]);
    // parâmetro presente e vazio: lista vazia explícita
    expect(lerEstado(esquema, "?ent=").ent).toEqual([]);
  });

  it("calendário: bissextos, inclusive antes do ano 100", () => {
    expect(dataValida("2000-02-29")).toBe(true);
    expect(dataValida("1900-02-29")).toBe(false);
    expect(dataValida("0004-02-29")).toBe(true);
    expect(dataValida("2024-04-31")).toBe(false);
    expect(dataValida("2024-00-10")).toBe(false);
  });

  it("% malformado na URL não derruba a leitura", () => {
    expect(() => lerEstado(esquema, "?q=%E0%A4%A&ent=%ZZ")).not.toThrow();
    expect(lerEstado(esquema, "?ent=%ZZ").ent).toEqual(["SE"]);
  });
});

describe("escrita", () => {
  it("padrão sai da URL; parâmetros alheios ficam com a mesma codificação e na mesma ordem", () => {
    const atual = "?modo=auditar&utm_source=a%20b+c&ent=N&x=1";
    const nova = escreverEstado(esquema, { ...PADRAO, ent: ["N", "S"], q: "são paulo" }, atual);
    expect(nova).toBe("?modo=auditar&utm_source=a%20b+c&ent=N,S&x=1&q=s%C3%A3o%20paulo");
    expect(escreverEstado(esquema, PADRAO, "?modo=analisar&ent=N&ano=2026")).toBe("?modo=analisar");
    expect(escreverEstado(esquema, PADRAO, "")).toBe("");
  });

  it("parâmetro gerenciado repetido vira um só, no lugar do primeiro", () => {
    expect(escreverEstado(esquema, { ...PADRAO, ent: ["S"] }, "?ent=N&z=%E0%A4%A&ent=NE")).toBe("?ent=S&z=%E0%A4%A");
  });

  it("lista vazia explícita é gravada como parâmetro vazio e relida como vazia", () => {
    const nova = escreverEstado(esquema, { ...PADRAO, ent: [] }, "");
    expect(nova).toBe("?ent=");
    expect(lerEstado(esquema, nova).ent).toEqual([]);
  });

  it("ordem nula (sem ordenação) é distinta da ordem inicial e volta igual", () => {
    const nova = escreverEstado(esquema, { ...PADRAO, ord: null }, "");
    expect(nova).toBe("?ord=");
    expect(lerEstado(esquema, nova).ord).toBeNull();
  });

  it("ida e volta preserva acento, espaço, &, %, + e vírgula", () => {
    const q = "São Paulo & Cia, 100% + ações/2025: sim";
    const nova = escreverEstado(esquema, { ...PADRAO, q }, "");
    expect(lerEstado(esquema, nova).q).toBe(q);
    // o mesmo valor visto pela API do navegador
    expect(new URLSearchParams(nova).get("q")).toBe(q);
  });

  it("item de lista com vírgula ou % não se parte em dois", () => {
    const e = { tags: campo(t.lista(t.texto()), [] as string[]) };
    const tags = ["a,b", "c%2Cd", "100%", "e"];
    const nova = escreverEstado(e, { tags }, "?modo=entender");
    expect(nova.startsWith("?modo=entender&tags=")).toBe(true);
    expect(lerEstado(e, nova).tags).toEqual(tags);
  });

  it("buscaDeParametros (searchParams do servidor) é lida como a URL do navegador", () => {
    const b = buscaDeParametros({ ent: "N,S", q: "são", modo: ["auditar", "analisar"], nada: undefined });
    expect(lerEstado(esquema, b)).toMatchObject({ ent: ["N", "S"], q: "são" });
    expect(new URLSearchParams(b).getAll("modo")).toEqual(["auditar", "analisar"]);
    expect(buscaDeParametros(undefined)).toBe("");
  });
});

describe("histórico", () => {
  it("modo: seleção cria entrada, digitação e página substituem, o explícito vence", () => {
    expect(modoHistorico(esquema, ["q"])).toBe("replace");
    expect(modoHistorico(esquema, ["q", "pag"])).toBe("replace");
    expect(modoHistorico(esquema, ["q", "ent"])).toBe("push");
    expect(modoHistorico(esquema, ["ord", "pag"])).toBe("push");
    expect(modoHistorico(esquema, ["q"], "push")).toBe("push");
  });

  it("só conta como alteração o que muda de valor (lista nova com o mesmo conteúdo não conta)", () => {
    expect(chavesAlteradas(esquema, PADRAO, { ent: ["SE"], q: "x", pag: 1 })).toEqual(["q"]);
    expect(chavesAlteradas(esquema, PADRAO, { ord: { coluna: "perda", direcao: "desc" } })).toEqual([]);
  });

  it("estabilizar mantém a referência quando nada mudou e a da lista igual quando outra chave muda", () => {
    const relido = lerEstado(esquema, "");
    expect(estabilizar(esquema, PADRAO, relido)).toBe(PADRAO);
    const outro = estabilizar(esquema, PADRAO, { ...relido, q: "x" });
    expect(outro).not.toBe(PADRAO);
    expect(outro.ent).toBe(PADRAO.ent);
  });

  /** Histórico falso com pilha de entradas, como o do navegador. */
  function janelaFalsa(inicial: string) {
    const pilha = [inicial];
    let i = 0;
    const janela: JanelaUrl & { voltar(): void; avancar(): void; pilha: string[]; atual(): string } = {
      get location() {
        const u = new URL(pilha[i], "https://scrutiniums.test");
        return { pathname: u.pathname, search: u.search, hash: u.hash };
      },
      history: {
        pushState: (_d, _t, url) => {
          pilha.splice(i + 1);
          pilha.push(String(url));
          i++;
        },
        replaceState: (_d, _t, url) => {
          pilha[i] = String(url);
        },
      },
      voltar: () => {
        i = Math.max(0, i - 1);
      },
      avancar: () => {
        i = Math.min(pilha.length - 1, i + 1);
      },
      pilha,
      atual: () => pilha[i],
    };
    return janela;
  }

  it("push cria entrada, replace substitui, repetição não duplica; voltar e avançar restauram", () => {
    const j = janelaFalsa("/setor-eletrico/perdas?modo=auditar#mapa");
    const ler = () => lerEstado(esquema, j.location.search);

    expect(gravarNaUrl(j, esquema, { ...PADRAO, ent: ["N"] }, "push")).toBe("/setor-eletrico/perdas?modo=auditar&ent=N#mapa");
    expect(j.pilha).toHaveLength(2);

    // digitação substitui a entrada atual
    gravarNaUrl(j, esquema, { ...PADRAO, ent: ["N"], q: "ce" }, "replace");
    expect(j.pilha).toHaveLength(2);
    expect(ler()).toMatchObject({ ent: ["N"], q: "ce" });

    // gravar o mesmo estado de novo não cria entrada repetida
    expect(gravarNaUrl(j, esquema, { ...PADRAO, ent: ["N"], q: "ce" }, "push")).toBeNull();
    expect(j.pilha).toHaveLength(2);

    gravarNaUrl(j, esquema, { ...PADRAO, ent: ["N", "S"], q: "ce" }, "push");
    expect(j.pilha).toHaveLength(3);

    j.voltar();
    expect(ler()).toMatchObject({ ent: ["N"], q: "ce" });
    j.voltar();
    expect(ler()).toEqual(PADRAO);
    j.avancar();
    j.avancar();
    expect(ler()).toMatchObject({ ent: ["N", "S"], q: "ce" });

    // o ?modo= de outro componente e a âncora sobrevivem em todas as entradas
    for (const e of j.pilha) {
      expect(e).toContain("modo=auditar");
      expect(e.endsWith("#mapa")).toBe(true);
    }
  });

  it("voltar ao padrão remove os parâmetros gerenciados e mantém os alheios", () => {
    const j = janelaFalsa("/setor-eletrico?ent=N&modo=analisar");
    gravarNaUrl(j, esquema, PADRAO, "push");
    expect(j.atual()).toBe("/setor-eletrico?modo=analisar");
  });

  it("navegador que recusa a gravação (limite de frequência) não derruba a página", () => {
    const j: JanelaUrl = {
      location: { pathname: "/p", search: "", hash: "" },
      history: {
        pushState: () => {
          throw new Error("SecurityError");
        },
        replaceState: () => {
          throw new Error("SecurityError");
        },
      },
    };
    expect(gravarNaUrl(j, esquema, { ...PADRAO, q: "x" }, "replace")).toBeNull();
  });
});
