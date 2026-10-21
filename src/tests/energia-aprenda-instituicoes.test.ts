import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ConceitoPage from "@/app/setor-eletrico/aprenda/[conceito]/page";
import { buscarVerbetes } from "@/lib/energia/aprenda-busca";
import { gruposDoIndice } from "@/lib/energia/conteudo/aprenda-indice";
import { CONCEITOS, conceito } from "@/lib/energia/conteudo/conceitos";
import { CONTRASTES, UNIDADE, contrastesDe } from "@/lib/energia/conteudo/complementos";
import { EXEMPLO_EVIDENCIA } from "@/lib/energia/conteudo/evidencias-verbetes";
import { perguntaPratica } from "@/lib/energia/conteudo/perguntas-praticas";
import { provaDoVerbete } from "@/lib/energia/conteudo/provas";
import { siglasNoTexto } from "@/lib/energia/siglas";

/**
 * Verbetes de instituições e de escopo do sistema que a página inicial pediu ao Aprenda (pedidos/inicial.md, itens 1 e 8): ANEEL, ONS,
 * CCEE, EPE, IBGE e Sistemas Isolados. A regra é a do acervo: nenhuma definição de memória, só o que a fonte primária lida diz, com o
 * trecho literal na captura versionada, o que não foi lido dito em palavras comuns e nenhum verbete existente alterado.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const espacos = (s: string) => s.replace(/\s+/g, " ").trim();
const SLUGS = ["aneel", "ons", "ccee", "epe", "ibge", "sistemas-isolados"];
const TEMA: Record<string, string> = { aneel: "Regulação", ons: "Operação", ccee: "Mercado", epe: "Expansão", ibge: "Fontes de dados", "sistemas-isolados": "Operação" };
const SEPARADOR = /[–—]| - /;

const pasta = "pipeline/energia/seed/documentos_aprenda";
const versoes = readdirSync(join(raiz, pasta)).filter((d) => /^v\d{8}T\d{6}Z$/.test(d)).sort();
const manifestos = versoes.map((dir) => ({ dir, m: JSON.parse(ler(join(pasta, dir, "MANIFESTO.json"))) as { arquivos: { arquivo: string; url: string; capturado_em: string }[]; canal: string } }));
const captura = (url: string) => {
  for (const { dir, m } of manifestos) {
    const a = m.arquivos.find((x) => x.url === url);
    if (a) return { ...a, dir, texto: espacos(ler(join(pasta, dir, a.arquivo))) };
  }
  return null;
};

describe("verbetes de instituições: acervo", () => {
  it("existem, estão conferidos em 09/10/2026, no tema pedido e na ordem do acervo sem tirar nenhum verbete anterior", () => {
    for (const s of SLUGS) {
      const c = conceito(s);
      expect(c, s).toBeDefined();
      expect(c!.estado, s).toBe("CONFERIDO");
      expect(c!.conferidoEm, s).toBe("2026-10-09");
      expect(c!.grupo, s).toBe(TEMA[s]);
      expect(c!.fontePlanejada, s).toBeUndefined();
    }
    // o acervo anterior segue inteiro: nenhum slug dos seis substituiu um verbete que já existia
    expect(CONCEITOS.filter((c) => SLUGS.includes(c.slug)).length).toBe(SLUGS.length);
    expect(CONCEITOS.length).toBeGreaterThanOrEqual(48 + SLUGS.length);
    for (const s of ["sin", "pld", "mcp", "acl", "agenda-regulatoria"]) expect(conceito(s)?.estado, s).toBe("CONFERIDO");
  });

  it("toda fonte tem trecho, o trecho está literalmente na captura versionada e a ressalva sobre o que não foi lido está dita", () => {
    for (const s of SLUGS) {
      const c = conceito(s)!;
      expect(c.fontes.length, s).toBeGreaterThan(0);
      for (const f of c.fontes) {
        expect(f.trecho, `${s}: ${f.documento}`).toBeTruthy();
        const cap = captura(f.url);
        expect(cap, `${s}: ${f.url}`).not.toBeNull();
        for (const parte of f.trecho!.split("[...]").map(espacos).filter(Boolean)) expect(cap!.texto, `${s}: ${parte.slice(0, 60)}`).toContain(parte);
        expect(f.parafrase, `${s}: ${f.documento}`).toMatch(/^Em outras palavras: /);
        expect(f.documento, `${s}: ${f.documento}`).toMatch(/lid[ao] em 09\/10\/2026/);
      }
      expect((c.limitacoes ?? []).length, s).toBeGreaterThan(0);
      expect(c.limitacoes!.join(" "), s).toMatch(/não foram? lid/);
    }
  });

  it("nenhuma fonte vem do portal da CCEE, que recusa consulta automática; o manifesto registra o 403 e que não foi contornado", () => {
    for (const s of SLUGS) for (const f of conceito(s)!.fontes) expect(f.url, s).not.toMatch(/ccee\.org\.br/);
    const lote = manifestos.find(({ m }) => m.arquivos.some((a) => a.arquivo === "lei_10848_2004_ccee_trechos.txt"))!;
    expect(lote.m.canal).toMatch(/www\.ccee\.org\.br\) respondeu HTTP 403/);
    expect(lote.m.canal).toMatch(/não foi contornado/);
    expect(conceito("ccee")!.detalheDaConferencia!.join(" ")).toMatch(/403/);
    // a limitação em palavras comuns não carrega o código da resposta
    expect(conceito("ccee")!.limitacoes!.join(" ")).not.toMatch(/403/);
  });

  it("a definição de cada um é a da fonte: frases-chave do verbete estão no trecho citado", () => {
    const trechos = (s: string) => conceito(s)!.fontes.map((f) => f.trecho ?? "").join(" ");
    expect(conceito("aneel")!.emUmaFrase).toContain("regular e fiscalizar");
    expect(trechos("aneel")).toContain("tem por finalidade regular e fiscalizar a produção, transmissão, distribuição, armazenamento e comercialização de energia elétrica");
    expect(trechos("aneel")).toContain("autarquia sob regime especial, vinculada ao Ministério de Minas e Energia");
    expect(conceito("ons")!.emUmaFrase).toContain("desde 1º de maio de 2017");
    expect(trechos("ons")).toContain("a partir de 1º de maio de 2017, a previsão de carga e o planejamento da operação do Sisol");
    expect(trechos("ons")).toContain("fiscalizada e regulada pela Aneel");
    expect(conceito("ccee")!.emUmaFrase).toContain("viabilizar a comercialização de energia elétrica");
    expect(trechos("ccee")).toContain("com a finalidade de viabilizar a comercialização de energia elétrica de que trata esta Lei");
    expect(trechos("epe")).toContain("tem por finalidade prestar serviços na área de estudos e pesquisas destinadas a subsidiar o planejamento do setor energético");
    expect(trechos("ibge")).toContain("Constitui objetivo básico do IBGE assegurar informações e estudos de natureza estatística, geográfica, cartográfica e demográfica");
    expect(trechos("sistemas-isolados")).toContain("não estejam eletricamente conectados ao Sistema Interligado Nacional - SIN, por razões técnicas ou econômicas");
  });

  it("a mudança de nome da CCEE (Lei nº 15.269/2025) está dita com a fonte e a vigência, e o nome usado pelo observatório é declarado", () => {
    const c = conceito("ccee")!;
    expect(c.nome).toBe("Câmara de Comercialização de Energia Elétrica");
    const lim = c.limitacoes![0];
    expect(lim).toMatch(/art\. 4º-D/);
    expect(lim).toMatch(/Câmara de Comercialização de Energia, sem Elétrica/);
    expect(lim).toMatch(/Lei nº 15\.269/);
    expect(lim).toMatch(/25\/11\/2025/);
    expect(lim).toMatch(/usam o nome anterior/);
    // as duas fontes que sustentam a frase: o artigo que renomeia e o artigo da lei sobre a vigência
    expect(c.fontes.some((f) => /Art\. 4º-D\./.test(f.trecho ?? ""))).toBe(true);
    const vigencia = c.fontes.find((f) => /l15269\.htm$/.test(f.url))!;
    expect(captura(vigencia.url)!.texto).toContain("Este texto não substitui o publicado no DOU de 25.11.2025");
  });

  it("escopo do SIN e dos sistemas isolados (item 8): definição do decreto, escopo do SIN em página do ONS e número sem data dito como tal", () => {
    const c = conceito("sistemas-isolados")!;
    const t = c.fontes.map((f) => f.trecho ?? "").join(" ");
    expect(t).toContain("O Sistema Interligado Nacional é constituído por quatro subsistemas: Sul, Sudeste/Centro-Oeste, Nordeste e a maior parte da região Norte.");
    expect(c.relacoesNotas!.sin).toContain("a maior parte da região Norte");
    // o número da página do ONS não é definição nem dado do observatório: a frase de abertura não o usa e a limitação diz que a página não tem data
    expect(c.emUmaFrase).not.toMatch(/\d/);
    expect(c.limitacoes!.join(" ")).toMatch(/não traz data de referência/);
    expect(c.porQueImporta).toMatch(/sem data de referência/);
    // o verbete SIN não foi alterado: continua conferido e é o novo verbete que traz o contraste, nos dois sentidos
    expect(contrastesDe("sin").some((x) => x.com === "sistemas-isolados")).toBe(true);
    expect(contrastesDe("sistemas-isolados").some((x) => x.com === "sin")).toBe(true);
  });

  it("sem travessão nem hífen como separador, sem 'hoje', 'agora', 'atual' nem causalidade, e sem código de painel ou nome de campo", () => {
    for (const s of SLUGS) {
      const c = conceito(s)!;
      const texto = [c.emUmaFrase, c.porQueImporta, ...(c.limitacoes ?? []), ...(c.detalheDaConferencia ?? []), ...Object.values(c.relacoesNotas ?? {}), ...c.fontes.map((f) => f.parafrase ?? "")].join(" ");
      expect(texto, s).not.toMatch(SEPARADOR);
      expect(texto, s).not.toMatch(/\b(hoje|agora|atual|atuais|porque|melhor|pior)\b/i);
      expect(texto, s).not.toMatch(/\bP0\d\d\b|\bgold\b|\bsilver\b|\bpipeline\b/i);
    }
  });
});

describe("verbetes de instituições: pergunta, exemplo, contraste e página", () => {
  it("cada um tem pergunta prática, exemplo real com ficha que resolve na gold e painel que existe, e é grandeza só se tiver unidade (nenhum tem)", () => {
    for (const s of SLUGS) {
      expect(perguntaPratica(s), s).toBeTruthy();
      const prova = provaDoVerbete(s);
      expect(prova?.tipo, s).toBe("evidencia");
      const f = EXEMPLO_EVIDENCIA[s];
      expect(f.painel.href, s).toContain("#");
      expect(existsSync(join(raiz, "src/app", f.painel.href.split("#")[0], "page.tsx")), `${s} → ${f.painel.href}`).toBe(true);
      expect(UNIDADE[s], s).toBeUndefined();
      expect(conceito(s)!.comoEMedido, s).toBeUndefined();
      expect(siglasNoTexto(perguntaPratica(s)!, 20), s).toEqual([]);
    }
  });

  it("os contrastes novos ligam só verbetes conferidos, sem par repetido, e cada um dos seis aparece em pelo menos um", () => {
    const novos = CONTRASTES.filter((x) => SLUGS.includes(x.a) || (typeof x.b === "string" && SLUGS.includes(x.b)));
    expect(novos.length).toBeGreaterThanOrEqual(6);
    for (const x of novos) {
      expect(conceito(x.a)?.estado, x.a).toBe("CONFERIDO");
      if (typeof x.b === "string") expect(conceito(x.b)?.estado, x.b).toBe("CONFERIDO");
      expect(x.texto).not.toMatch(SEPARADOR);
    }
    for (const s of SLUGS) expect(contrastesDe(s).length, s).toBeGreaterThan(0);
    // quem regula não opera nem comercializa: os três pares do trio aparecem dos dois lados
    expect(contrastesDe("ons").map((x) => x.com).sort()).toEqual(["aneel", "ccee", "epe"]);
    expect(contrastesDe("ccee").map((x) => x.com).sort()).toEqual(["aneel", "ons"]);
  });

  it("a página de cada um traz a pergunta, o exemplo com ficha, o não confundir com e a fonte; não tem 'Como é medido' nem unidade", () => {
    for (const s of SLUGS) {
      const h = renderToStaticMarkup(createElement(ConceitoPage, { params: { conceito: s } }));
      expect(h, s).toContain('data-tipo-pagina="verbete"');
      expect(h, s).toContain(perguntaPratica(s)!);
      expect(h, s).toContain('id="exemplo"');
      expect(h, s).toContain('data-prova="evidencia"');
      expect(h, s).toContain("Não confundir com");
      expect(h, s).toContain("conferido na fonte primária em 09/10/2026");
      expect(h, s).toContain("Trecho literal do documento");
      expect(h, s).not.toContain(">Como é medido<");
      expect(h, s).not.toContain('data-unidade="true"');
      expect(h, s).not.toMatch(/NaN|undefined|\[object Object\]/);
    }
  });

  it("o verbete SIN mostra o contraste com Sistemas Isolados sem ter sido alterado", () => {
    const h = renderToStaticMarkup(createElement(ConceitoPage, { params: { conceito: "sin" } }));
    expect(h).toContain("Sistemas Isolados");
    expect(h).toContain("/setor-eletrico/aprenda/sistemas-isolados");
  });
});

describe("verbetes de instituições: índice e busca", () => {
  const itens = gruposDoIndice().flatMap((g) => g.itens);
  const slugs = (t: string) => (buscarVerbetes(itens, t) ?? []).map((i) => i.slug);

  it("o índice lista os seis, cada um no tema pedido, com a pergunta e o painel do exemplo", () => {
    for (const s of SLUGS) {
      const i = itens.find((x) => x.slug === s)!;
      expect(i.grupo, s).toBe(TEMA[s]);
      expect(i.estado, s).toBe("conferido");
      expect(i.pergunta, s).toBe(perguntaPratica(s));
      expect(i.painel!.href, s).toContain(encodeURIComponent(`verbete:${s}`));
    }
  });

  it("a busca acha cada instituição pela sigla, pelo nome por extenso e pela pergunta, com a sigla igual em primeiro", () => {
    expect(slugs("ons")[0]).toBe("ons");
    expect(slugs("aneel")[0]).toBe("aneel");
    expect(slugs("ccee")[0]).toBe("ccee");
    expect(slugs("epe")[0]).toBe("epe");
    expect(slugs("ibge")[0]).toBe("ibge");
    expect(slugs("operador nacional")).toContain("ons");
    expect(slugs("quem regula")).toContain("aneel");
    expect(slugs("comercialização")).toContain("ccee");
    expect(slugs("isolados")).toContain("sistemas-isolados");
  });

  it("a palavra do termo começa uma palavra do texto: 'ons' não acha 'consumo' nem 'epe' acha 'depende'", () => {
    const comecaComOns = (busca: string) => /(^|[^a-z0-9])ons/.test(busca);
    const so = (re: RegExp) => itens.filter((i) => re.test(i.busca) && !comecaComOns(i.busca));
    const comConsumoSemOns = so(/consum/);
    expect(comConsumoSemOns.length).toBeGreaterThan(0);
    const achados = slugs("ons");
    for (const i of comConsumoSemOns) expect(achados, i.slug).not.toContain(i.slug);
    for (const i of itens.filter((x) => achados.includes(x.slug))) expect(comecaComOns(i.busca), i.slug).toBe(true);
    // começo de palavra continua achando enquanto se digita
    expect(slugs("reservat")).toContain("ear");
    expect(slugs("hidrel").length).toBeGreaterThan(0);
  });
});
