import { describe, expect, it } from "vitest";
import { lerArgumentos, linhaTabela, nomeArquivo, tabelaMarkdown } from "../../scripts/evidencias.mjs";

/** `npm run evidencias` gera a tabela que vai para o PR: o que ela diz precisa ser o que foi medido. */

const base = { rota: "/saneamento/municipio", modo: "sem", largura: 390, status: 200, final: "/saneamento/municipio", cromo: 180, topoH1: 300,
  barra: true, rolagemHorizontal: false, axe: [], console: [], login: [], captura: "saneamento_municipio-390-sem-sessao.jpg",
  primeiraTela: "saneamento_municipio-390-sem-sessao-primeira-tela.jpg" };

describe("argumentos", () => {
  it("lê rotas, saída, larguras e modos", () => {
    expect(lerArgumentos(["--rotas", "/a", "/b", "--saida", "x", "--larguras", "390,1440", "--modos", "com"]))
      .toEqual({ rotas: ["/a", "/b"], saida: "x", larguras: [390, 1440], modos: ["com"] });
    expect(lerArgumentos(["--saida", "x", "--rotas", "/"])).toEqual({ rotas: ["/"], saida: "x", larguras: [390, 768, 1440], modos: ["sem", "com"] });
  });
  it("recusa uso incompleto ou valores fora do contrato", () => {
    expect(() => lerArgumentos(["--rotas", "/a"])).toThrow("Uso:");
    expect(() => lerArgumentos(["--saida", "x"])).toThrow("Uso:");
    expect(() => lerArgumentos(["--rotas", "a", "--saida", "x"])).toThrow("começa com /");
    expect(() => lerArgumentos(["--rotas", "/a", "--saida", "x", "--larguras", "500"])).toThrow("Larguras aceitas");
    expect(() => lerArgumentos(["--rotas", "/a", "--saida", "x", "--modos", "talvez"])).toThrow("Modos aceitos");
    expect(() => lerArgumentos(["--rotas", "/a", "--saida", "x", "--rapido"])).toThrow("desconhecida");
  });
  it("nomeia a captura como as evidências de docs/ux-2026-10-21", () => {
    expect(nomeArquivo("/setor-eletrico/conta-de-luz", 1440, "com")).toBe("setor_eletrico_conta_de_luz-1440-com-sessao.jpg");
    expect(nomeArquivo("/", 390, "sem")).toBe("inicio-390-sem-sessao.jpg");
    expect(nomeArquivo("/", 390, "sem", "-primeira-tela")).toBe("inicio-390-sem-sessao-primeira-tela.jpg");
  });
});

describe("tabela", () => {
  it("marca cromo dentro e fora do orçamento, H1 fora da primeira tela e achados", () => {
    expect(linhaTabela(base)).toContain("| 180 (até 200) | sim | não | 0 | 0 | 0 | [página](saneamento_municipio-390-sem-sessao.jpg) · [1ª tela](saneamento_municipio-390-sem-sessao-primeira-tela.jpg) |");
    // página sem a barra comum (o login, por exemplo) não tem cromo a medir
    expect(linhaTabela({ ...base, barra: false, cromo: 0 })).toContain("| sem barra comum |");
    const ruim = { ...base, largura: 1440, cromo: 260, topoH1: 900, rolagemHorizontal: true, axe: [{ id: "color-contrast", nos: 3 }], console: ["x"], login: ["/api/a"] };
    expect(linhaTabela(ruim)).toContain("| 260 **acima de 230** | **não** | **sim** | **color-contrast (3)** | **1** | **1** |");
    expect(linhaTabela({ ...base, largura: 768, cromo: 210 })).toContain("| 210 | sim |");
  });
  it("mostra o endereço final quando a rota redireciona e o erro quando não carrega", () => {
    expect(linhaTabela({ ...base, final: "/entrar?proximo=%2Fx" })).toContain("| `/entrar?proximo=%2Fx` |");
    expect(linhaTabela({ rota: "/x", modo: "com", largura: 390, erro: "Timeout | 120000 ms" })).toContain("| erro |");
    expect(linhaTabela({ rota: "/x", modo: "com", largura: 390, erro: "a | b" })).not.toContain("a | b");
  });
  it("traz cabeçalho com build, máquina, comando e o detalhe de console e login", () => {
    const md = tabelaMarkdown([{ ...base, console: ["TypeError: x"], login: ["/energia/gold/a.json"] }], { data: "2026-10-22", build: "abc", maquina: "4 vCPU, 16 GB", comando: "npm run evidencias -- --rotas /x", tempo: "1 min 00 s" });
    expect(md).toContain("### Evidências de página (2026-10-22)");
    expect(md).toContain("Build abc");
    expect(md).toContain("- console: TypeError: x");
    expect(md).toContain("- caiu no login: `/energia/gold/a.json`");
  });
});
