import { describe, expect, it } from "vitest";
import { analisarCodigo, analisarHtml, analisarJson } from "../../scripts/i18n/analise.mjs";

describe("inventário sintático de código para i18n", () => {
  it("distingue texto, atributos DOM e props sem excluir id de componente", () => {
    const r = analisarCodigo('<><h1 id="titulo" title="Título">Olá</h1><Ficha id="Identidade" title="Detalhe" /></>');
    expect(r.candidatos).toMatchObject({ jsx_text: 1, atributos: 1, props: 2 });
    expect(r.exclusoes.atributos_tecnicos).toBe(1);
    expect(r.errosSintaxe).toBe(0);
  });

  it("separa importações, tipos e chaves de objetos sem executar expressões", () => {
    const r = analisarCodigo(`import x from "modulo";
      export { x } from "outro";
      type Estado = "ok" | "falha";
      const dados = { titulo: "Texto", "codigo": "ABC", curto };
      const modulo = import("dinamico");
      throw new Error("Não executar");`);
    expect(r.exclusoes).toMatchObject({ importacoes: 3, tipos: 2 });
    expect(r.candidatos).toMatchObject({ chaves_objetos: 3, outros_literais: 3 });
  });

  it("conta cada template uma vez e ainda percorre as interpolações", () => {
    const r = analisarCodigo('const frase = `Saldo ${formatar("BRL")} para ${`Grupo ${nome}`}`;');
    expect(r.candidatos).toMatchObject({ templates: 2, outros_literais: 1, expressoes_nao_resolvidas: 3 });
    expect(r.totalCandidatos).toBe(6);
  });

  it("não esconde prosa em callbacks nem data-* usados pela interface", () => {
    const r = analisarCodigo('<button className="botao" data-tooltip="Ajuda" onClick={() => alert("Aviso")} />');
    expect(r.exclusoes.atributos_tecnicos).toBe(1);
    expect(r.candidatos.atributos).toBe(2);
    expect(r.candidatos.expressoes_nao_resolvidas).toBe(1);
  });

  it("mantém condições, atributos propagados e interpolação técnica como pendências", () => {
    const r = analisarCodigo('<div className={`bloco ${classe}`} title={aberto ? "Fechar" : "Abrir"} {...props}>{valor}{"Literal"}</div>');
    expect(r.exclusoes.atributos_tecnicos).toBe(1);
    expect(r.candidatos).toMatchObject({ atributos: 2, outros_literais: 1, expressoes_nao_resolvidas: 4 });
  });

  it("distingue template de tipo de template executável e sinaliza código inválido", () => {
    const r = analisarCodigo('type Chave = `prefixo-${"a" | "b"}`; const frase = `Olá`;');
    expect(r.exclusoes.tipos).toBe(1);
    expect(r.candidatos.templates).toBe(1);
    expect(analisarCodigo('const x = <h1>').errosSintaxe).toBeGreaterThan(0);
  });

  it("analisa TypeScript sem JSX e não duplica chaves literais computadas", () => {
    const r = analisarCodigo('const identidade = <T>(x: T) => x; const dado = <string>valor; const textos = { ["nome"]: "Texto", [obter("chave")]: "Outro" };', "codigo.ts");
    expect(r.errosSintaxe).toBe(0);
    expect(r.candidatos).toMatchObject({ chaves_objetos: 2, outros_literais: 3, expressoes_nao_resolvidas: 1 });
  });
});

describe("inventário estrutural de HTML para i18n", () => {
  it("lê texto e acessibilidade, preservando template e noscript", () => {
    const r = analisarHtml('<h1 id="titulo" aria-label="Nome">Olá &amp; bem-vindo</h1><template><p>Depois</p></template><noscript>Sem JavaScript</noscript><!-- nota -->');
    expect(r.candidatos).toMatchObject({ textos: 3, atributos: 1 });
    expect(r.exclusoes).toMatchObject({ atributos_tecnicos: 1, comentarios: 1 });
  });

  it("expõe scripts e eventos como pendências sem confundi-los com texto traduzido", () => {
    const r = analisarHtml('<style>.x{color:red}</style><script src="/app.js"></script><script>alert("Olá")</script><script type="application/ld+json">{"name":"Nome"}</script><button onclick="alert(1)">Abrir</button>');
    expect(r.scripts).toEqual({ inlinePendentes: 2, externos: 1, dadosPendentes: 1 });
    expect(r.candidatos).toEqual({ textos: 1, atributos: 0, expressoes_nao_resolvidas: 3 });
    expect(r.exclusoes.estilos).toBe(1);
    expect(r.totalCandidatos).toBe(4);
  });

  it("inspeciona o HTML alternativo de noscript, incluindo rótulos acessíveis", () => {
    const r = analisarHtml('<noscript><a href="/ajuda" aria-label="Consultar ajuda">Ajuda</a></noscript>');
    expect(r.candidatos).toMatchObject({ textos: 1, atributos: 1 });
    expect(r.exclusoes.atributos_tecnicos).toBe(1);
  });
});

describe("inventário de campos JSON para i18n", () => {
  it("agrupa somente índices de arrays e escapa barra e til em JSON Pointer", () => {
    const r = analisarJson({ "a/b": [{ "~nome": "Um" }, { "~nome": "Dois" }], municipios: { "2611606": { nome: "Recife" }, "3550308": { nome: "São Paulo" } } });
    expect(r.ocorrenciasStrings).toBe(4);
    expect(r.camposCandidatos).toEqual(["/a~1b/*/~0nome", "/municipios/2611606/nome", "/municipios/3550308/nome"]);
  });

  it("não presume que vazio, código, número em string ou inglês sejam exclusões", () => {
    const r = analisarJson({ vazio: "", codigo: "BR", numero: "123", ingles: "English", quantidade: 123, ativo: true, ausente: null });
    expect(r).toEqual({ ocorrenciasStrings: 4, camposCandidatos: ["/codigo", "/ingles", "/numero", "/vazio"], stringsVazias: 1, numeros: 1, booleanos: 1, nulos: 1 });
  });

  it("suporta a raiz textual, arrays aninhados e resultado independente da ordem das chaves", () => {
    expect(analisarJson("Texto").camposCandidatos).toEqual([""]);
    expect(analisarJson([["a"], ["b"]])).toMatchObject({ ocorrenciasStrings: 2, camposCandidatos: ["/*/*"] });
    expect(analisarJson({ b: "B", a: "A" })).toEqual(analisarJson({ a: "A", b: "B" }));
  });
});
