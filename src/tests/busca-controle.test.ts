import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { indiceDeBusca } from "@/lib/busca/indice";
import { buscar, distancia, emOrdemDeTela, type RespostaBusca } from "@/lib/busca/buscar";
import { formasDe, nucleoDaBusca, palavrasUteis } from "@/lib/busca/normalizar";
import { rotuloDoParcial } from "@/lib/busca/textos";
import type { EntradaBusca, IndiceBusca } from "@/lib/busca/tipos";
import { ListaResultados } from "@/components/busca/ListaResultados";
import { NaoCobre } from "@/components/busca/NaoCobre";
import { ehRotaPublica } from "@/lib/rotasPublicas";

vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => "/buscar",
}));

/**
 * Conjunto de controle da busca (prompt da busca, ciclo 2, de 23/10/2026, seção 5; diagnóstico em
 * docs/ux-2026-10-23/DIAGNOSTICO_BUSCA_2026-10-23.md). Cada linha diz o termo, o que se espera e o bloco a partir do qual vale;
 * as dos blocos seguintes ficam como `todo` até o PR do bloco. Os dez termos de controle da Iniciativa 3 continuam em
 * busca.test.ts, intactos. A lista completa dos 234 termos (os dois lotes de BUSCA_TERMOS_CONTROLE_2026-10-23.md, com o número
 * de resultados medido em 23/10/2026 sobre o main em 00c055474) fecha o arquivo e serve de catraca.
 */
vi.setConfig({ testTimeout: 60_000 });

const b = (termo: string) => buscar(indiceDeBusca(), termo);
const hrefs = (r: RespostaBusca, n = 3) => r.resultados.slice(0, n).map((x) => x.href);

describe("bloco 1: casar como o leitor escreve", () => {
  it("plural: 'hospitais' traz Saúde entre os três primeiros", () => {
    const r = b("hospitais");
    expect(r.parcial).toBeUndefined();
    expect(r.resultados.slice(0, 3).some((x) => x.tipo === "colecao" && x.titulo === "Saúde")).toBe(true);
  });

  it("plural: 'enchentes' traz Desastres entre os três primeiros", () => {
    expect(hrefs(b("enchentes"))).toContain("/territorio/desastres");
  });

  it("plural: 'escolas' mantém a consulta das capitais entre os três primeiros", () => {
    expect(hrefs(b("escolas"))).toContain("/eficiencia-estatal/educacao-municipal-capitais");
  });

  it("pergunta: 'como funciona o PLD' é igual a 'PLD', com a página do PLD primeiro", () => {
    const r = b("como funciona o PLD");
    expect(r.resultados[0].href).toBe("/setor-eletrico/pld");
    expect(hrefs(r, 30)).toEqual(hrefs(b("PLD"), 30));
  });

  it("pergunta: 'qual a tarifa social' é igual a 'tarifa social'", () => {
    const r = b("qual a tarifa social");
    expect(r.resultados.length).toBeGreaterThan(0);
    expect(hrefs(r, 30)).toEqual(hrefs(b("tarifa social"), 30));
  });

  // bloco 3: a despesa por área ganhou os termos do catálogo ("gasto federal", "educação"). A coleção Educação tem só uma das
  // três palavras úteis ("governo", "gasta", "educação") e fica fora do parcial, que exige ao menos a metade
  it("'quanto o governo gasta com educação' dá parcial com 'Para onde vai o dinheiro federal, por área?' primeiro", () => {
    const r = b("quanto o governo gasta com educação");
    expect(r.parcial).toBe(true);
    expect(r.resultados[0].href).toBe("/contas-publicas/por-area");
  });

  it("parcial: 'por que a conta de luz subiu' traz Conta de luz e Bandeira tarifária, rotulado", () => {
    const r = b("por que a conta de luz subiu");
    expect(r.parcial).toBe(true);
    const h = r.resultados.map((x) => x.href);
    expect(h).toContain("/setor-eletrico/conta-de-luz");
    expect(h).toContain("/setor-eletrico/aprenda/bandeira-tarifaria");
    expect(rotuloDoParcial(r)).toBe("Nenhuma página tem todas as palavras. O mais próximo, por “conta” e “luz”:");
  });

  // bloco 2: o grupo "cartão de crédito" ganhou gancho no Crédito, e a frase deixou de ser parcial (era, no bloco 1, Pagamentos e
  // Juros por instituição pelo mais próximo de cada palavra)
  it("'juros do cartão' é completo desde o bloco 2: Crédito e sistema financeiro primeiro", () => {
    const r = b("juros do cartão");
    expect(r.parcial).toBeUndefined();
    expect(r.resultados[0].href).toBe("/observatorio");
  });

  it("parcial: o mais próximo por cada palavra, a rara antes da comum", () => {
    const r = b("orçamento da ANEEL");
    expect(rotuloDoParcial(r)).toBe("Nenhuma página tem todas as palavras. O mais próximo, por “orçamento” e “ANEEL”:");
  });

  it("sigla: 'ANEEL' abre o verbete da agência antes da Agenda Regulatória da ANEEL", () => {
    const r = b("ANEEL");
    expect([r.resultados[0].href, r.resultados[0].nivel]).toEqual(["/setor-eletrico/aprenda/aneel", 0]);
    expect(r.resultados[0].via).toBeUndefined();
  });

  it("sigla: 'CDE' mantém o verbete da Conta de Desenvolvimento Energético, inteiro antes de prefixo", () => {
    const r = b("CDE");
    expect([r.resultados[0].href, r.resultados[0].nivel]).toEqual(["/setor-eletrico/aprenda/cde", 0]);
  });

  it("erro de digitação: 'saneamneto' corrige para 'saneamento', com a coleção Saneamento primeiro", () => {
    const r = b("saneamneto");
    expect(r.correcao).toEqual({ de: "saneamneto", para: "saneamento" });
    expect([r.resultados[0].tipo, r.resultados[0].href]).toEqual(["colecao", "/saneamento"]);
    // "mesmo assim": o termo como foi escrito, sem correção
    expect(buscar(indiceDeBusca(), "saneamneto", { semCorrecao: true })).toMatchObject({ resultados: [] });
  });

  it("erro de digitação: 'enegia' corrige para 'energia'", () => {
    expect(b("enegia").correcao).toEqual({ de: "enegia", para: "energia" });
  });

  it("'divida dos estado' mantém Como está a dívida do meu estado? primeiro", () => {
    const r = b("divida dos estado");
    expect(r.resultados[0].href).toBe("/contas-publicas-estaduais");
    expect(r.resultados.length).toBeGreaterThanOrEqual(6);
  });

  it("'Belo Horizonte' mantém Minha capital, sem parcial de lugar", () => {
    const r = b("Belo Horizonte");
    expect(r.parcial).toBeUndefined();
    expect(r.resultados[0].href).toBe("/eficiencia-estatal");
  });

  it("'orçamento da ANEEL' dá parcial com o verbete da ANEEL e as Contas Federais", () => {
    const r = b("orçamento da ANEEL");
    expect(r.parcial).toBe(true);
    // o mais próximo por cada palavra vem nos dois primeiros: o verbete da agência e a execução do orçamento federal
    const dois = r.resultados.slice(0, 2);
    expect(dois.map((x) => x.href)).toContain("/setor-eletrico/aprenda/aneel");
    expect(dois.some((x) => x.colecao === "federais")).toBe(true);
  });

  it("via: o termo que trouxe o destino aparece quando a palavra não está no título nem no resumo", () => {
    const saude = b("hospitais").resultados.find((x) => x.tipo === "colecao" && x.titulo === "Saúde");
    expect(saude?.via).toBe("hospital");
    // a palavra no título não precisa de explicação
    expect(b("botijão").resultados[0].via).toBeUndefined();
  });
});

describe("bloco 1: regras do motor", () => {
  it("formas da palavra: o singular provável, só do lado de quem digita", () => {
    expect(formasDe("hospitais")).toContain("hospital");
    expect(formasDe("enchentes")).toContain("enchente");
    expect(formasDe("compensacoes")).toContain("compensacao");
    expect(formasDe("paes")).toContain("pao");
    expect(formasDe("papeis")).toContain("papel");
    expect(formasDe("lencois")).toContain("lencol");
    expect(formasDe("bens")).toContain("bem");
    expect(formasDe("gas")).toEqual(["gas"]);
    expect(formasDe("luz")).toEqual(["luz"]);
  });

  it("palavras de pergunta saem quando sobra outra; o núcleo tira as vazias das pontas", () => {
    expect(palavrasUteis("como funciona o PLD")).toEqual(["pld"]);
    expect(palavrasUteis("quanto o governo gasta com educação")).toEqual(["governo", "gasta", "educacao"]);
    expect(palavrasUteis("quanto")).toEqual(["quanto"]);
    expect(nucleoDaBusca("qual a tarifa social")).toBe("tarifa social");
    expect(nucleoDaBusca("o que é conta de luz")).toBe("conta de luz");
  });

  it("distância de Damerau e Levenshtein: a troca de vizinhas conta um", () => {
    expect(distancia("saneamneto", "saneamento", 2)).toBe(1);
    expect(distancia("enegia", "energia", 1)).toBe(1);
    expect(distancia("casa", "caso", 1)).toBe(1);
    expect(distancia("abc", "xyz", 1)).toBe(2);
  });

  const entrada = (id: string, titulo: string, extra: Partial<EntradaBusca> = {}): EntradaBusca => ({
    id,
    tipo: "pagina",
    titulo,
    resumo: "",
    href: `/${id}`,
    observatorio: "familias",
    colecao: "renda",
    situacao: "publicado",
    aberta: false,
    termos: [],
    ...extra,
  });
  const sintetico = (entradas: EntradaBusca[], lugares: Partial<IndiceBusca["lugares"]> = {}): IndiceBusca => ({
    versao: 1,
    observatorios: [{ id: "familias", nome: "Famílias" }],
    colecoes: [{ id: "renda", observatorio: "familias", nome: "Renda", href: "/r" }],
    exemplos: [],
    lugares: { capital: [], uf: [], distribuidora: [], banco: [], ...lugares },
    entradas,
  });

  it("palavra curta casa inteira; só sem nada assim vale o começo", () => {
    const i = sintetico([entrada("dec", "Duração das interrupções", { tipo: "verbete", termos: ["DEC"] }), entrada("decl", "Declarados")]);
    expect(buscar(i, "dec").resultados.map((x) => x.id)).toEqual(["dec"]);
    expect(buscar(i, "decl").resultados.map((x) => x.id)).toEqual(["decl"]);
    const j = sintetico([entrada("cemig", "CEMIG")]);
    expect(buscar(j, "ce").resultados.map((x) => x.id)).toEqual(["cemig"]);
  });

  it("sigla inteira (nível 0) antes do título que só a menciona", () => {
    const i = sintetico([
      entrada("agenda", "Agenda da ANEEL", { tipo: "verbete" }),
      entrada("aneel", "Agência Nacional de Energia Elétrica", { tipo: "verbete", termos: ["ANEEL"] }),
    ]);
    expect(buscar(i, "ANEEL").resultados.map((x) => [x.id, x.nivel])).toEqual([
      ["aneel", 0],
      ["agenda", 1],
    ]);
  });

  it("parcial nunca aparece quando há resultado completo, e as listas de lugares ficam fora dele", () => {
    const i = sintetico(
      [
        entrada("cap", "Como está a minha capital?", { tipo: "consulta", lugares: ["capital"] }),
        entrada("belo", "Belo Jardim"),
        entrada("tudo", "Belo e bom"),
      ],
      { capital: ["Novo Horizonte"] },
    );
    const parcial = buscar(i, "Belo Horizonte");
    expect(parcial.parcial).toBe(true);
    expect(parcial.resultados.map((x) => x.id)).not.toContain("cap");
    const completo = buscar(i, "belo bom");
    expect(completo.parcial).toBeUndefined();
    expect(completo.resultados.map((x) => x.id)).toEqual(["tudo"]);
  });

  it("duas palavras: parcial só quando as duas existem no índice", () => {
    const i = sintetico([entrada("juros", "Juros"), entrada("cartao", "Cartão")]);
    expect(buscar(i, "juros cartão").parcial).toBe(true);
    expect(buscar(i, "juros xyzw").resultados).toEqual([]);
  });

  it("correção nunca aparece quando a palavra original casa; mais de uma correção vira sugestão", () => {
    const i = sintetico([entrada("porta", "Porta"), entrada("porto", "Porto"), entrada("saude", "Saúde")]);
    expect(buscar(i, "porta").correcao).toBeUndefined();
    const r = buscar(i, "portx");
    expect(r.resultados).toEqual([]);
    expect(r.sugestoes?.sort()).toEqual(["porta", "porto"]);
    // a correção sai com a grafia do índice
    expect(buscar(i, "saudr").correcao).toEqual({ de: "saudr", para: "saúde" });
  });

  it("a correção não troca sigla, nome próprio nem palavra das listas de lugares", () => {
    // TFSEE é a taxa de fiscalização, não a TSEE; "dólar" não é "solar"; "Eletrobras" não é "Petrobras"; "branca" não é "Rio Branco"
    for (const termo of ["TFSEE", "dólar", "Eletrobras", "tarifa branca"]) {
      const r = b(termo);
      expect(r.correcao, termo).toBeUndefined();
      expect(r.sugestoes, termo).toBeUndefined();
    }
  });

  it("na busca local, a correção certa da coleção não fica de fora por ser rara no índice inteiro (revisão do PR 366)", () => {
    const outra = (id: string, titulo: string) => entrada(id, titulo, { colecao: "outra" });
    const i: IndiceBusca = {
      ...sintetico([
        ...["a", "b", "c"].flatMap((k) => [outra(`l${k}`, `Casal ${k}`), outra(`z${k}`, `Casaz ${k}`), outra(`r${k}`, `Casar ${k}`)]),
        entrada("alvo", "Casam"),
      ]),
      colecoes: [
        { id: "renda", observatorio: "familias", nome: "Renda", href: "/r" },
        { id: "outra", observatorio: "familias", nome: "Outra", href: "/o" },
      ],
    };
    const r = buscar(i, "casax", { colecao: "renda" });
    expect(r.correcao).toEqual({ de: "casax", para: "casam" });
    expect(r.resultados.map((x) => x.id)).toEqual(["alvo"]);
  });

  it("filtro de coleção vale também para o parcial e para a correção", () => {
    const r = buscar(indiceDeBusca(), "saneamneto", { colecao: "setor-eletrico" });
    expect(r.resultados.every((x) => x.colecao === "setor-eletrico")).toBe(true);
  });
});

describe("bloco 1: tela", () => {
  it("a lista mostra 'via <termo>' na linha de meta e marca a opção destacada", () => {
    const r = b("hospitais");
    const h = renderToStaticMarkup(createElement(ListaResultados, { grupos: r.grupos, comSessao: true, opcao: { id: (n: number) => `t-op-${n}`, ativa: -1, destacada: 0 } }));
    expect(h).toContain(" · via hospital");
    const itens = h.split("<li").slice(1);
    expect(itens[0]).toContain("data-ativa");
    expect(itens[0]).toContain('aria-selected="false"');
    expect(itens.slice(1).some((x) => x.includes("data-ativa"))).toBe(false);
    expect(emOrdemDeTela(r.grupos)).toHaveLength(r.resultados.length);
  });
});

describe("bloco 2: sinônimos com alcance certo", () => {
  const primeiros = (termo: string, n = 3) => b(termo).resultados.slice(0, n);
  const BANCOS = "/observatorio-do-credito/quanto-meu-banco-cobra";

  it("'Amazônia': Desmatamento e emissões ou Fogo e queimadas primeiro; banco fora dos três primeiros", () => {
    const r = primeiros("Amazônia");
    expect(["desmatamento", "fogo"]).toContain(r[0].colecao);
    expect(r.map((x) => x.href)).not.toContain(BANCOS);
  });

  it("'pecuária', 'safra', 'exportação': Agronegócio primeiro", () => {
    for (const t of ["pecuária", "safra", "exportação"]) expect(b(t).resultados[0].colecao, t).toBe("agro");
  });

  it("'Anatel', '5G', 'fibra': Conectividade antes de qualquer outro destino; o banco só depois", () => {
    for (const t of ["Anatel", "5G", "fibra"]) {
      const r = b(t).resultados;
      const fora = r.findIndex((x) => x.colecao !== "conectividade");
      expect(r.slice(0, 2).every((x) => x.colecao === "conectividade"), t).toBe(true);
      // "fibra" também é o Banco Fibra: aparece, mas depois da Conectividade
      if (fora >= 0) expect(r.slice(fora).every((x) => x.colecao !== "conectividade"), t).toBe(true);
    }
    expect(primeiros("Anatel").map((x) => x.href)).not.toContain(BANCOS);
    expect(primeiros("5G").map((x) => x.href)).not.toContain(BANCOS);
  });

  it("'Banco da Amazônia', 'Safra', 'Itaú', 'Nubank', 'BB': mantém a consulta de bancos", () => {
    // "Banco do Brasil" também: a forma extensa "Banco Central do Brasil" no grupo do BCB levava ao Crédito (revisão do PR 367)
    for (const t of ["Banco da Amazônia", "Banco do Brasil", "Itaú", "Nubank", "BB"]) expect(b(t).resultados[0].href, t).toBe(BANCOS);
    // "Safra" é também a safra do Agronegócio, que vem primeiro; o Banco Safra continua na lista
    expect(b("Safra").resultados.map((x) => x.href)).toContain(BANCOS);
  });

  it("'Celpe', 'Coelba': Conta de luz, pelo nome antigo das distribuidoras", () => {
    for (const t of ["Celpe", "Coelba", "Coelce", "Cemar", "Escelsa"]) expect(b(t).resultados[0].href, t).toBe("/setor-eletrico/conta-de-luz");
    expect(b("Celpe").resultados[0].via).toBe("Celpe");
  });

  it("'LOA', 'SIOP', 'gasto do governo': Contas Federais", () => {
    for (const t of ["LOA", "SIOP", "gasto do governo"]) expect(b(t).resultados[0].href, t).toBe("/contas-publicas");
  });

  it("'rotativo' e 'cartão de crédito rotativo': Crédito e sistema financeiro, onde estão as taxas por modalidade", () => {
    // a coleção Pagamentos trata do Pix e dos meios de pagamento, não da taxa do rotativo: o gancho fica no Crédito (PR do bloco 2)
    for (const t of ["rotativo", "cartão de crédito rotativo"]) {
      const r = b(t);
      expect(r.parcial, t).toBeUndefined();
      expect(r.resultados[0].href, t).toBe("/observatorio");
    }
  });

  it("'dívida pública': Dívida e crédito dos governos ou Contas Federais primeiro", () => {
    expect(["/observatorio/subnational-credit", "/contas-publicas"]).toContain(b("dívida pública").resultados[0].href);
  });

  it("'agências reguladoras': Regulação (Setor Elétrico e Gás), Marcos regulatórios e verbete ANEEL entre os cinco primeiros", () => {
    const h = primeiros("agências reguladoras", 5).map((x) => x.href);
    for (const d of ["/setor-eletrico/regulacao", "/gas-natural/regulacao", "/observatorio/regulacao", "/setor-eletrico/aprenda/aneel"]) expect(h, d).toContain(d);
  });

  it("'PGFN': Quem deve à União?", () => {
    expect(b("PGFN").resultados[0].href).toBe("/observatorio/federal-tax-debt");
  });

  it("'LRF': Contas Estaduais", () => {
    expect(b("LRF").resultados[0].href).toBe("/contas-publicas-estaduais");
  });

  it("'feminicídio': Segurança pública", () => {
    expect(b("feminicídio").resultados[0].colecao).toBe("seguranca");
  });

  it("'Pantanal': Fogo e queimadas (focos por bioma)", () => {
    expect(b("Pantanal").resultados[0].href).toBe("/territorio/queimadas");
  });

  it("'banco central': Crédito e sistema financeiro, que usa as séries do BCB", () => {
    const r = b("banco central");
    expect(r.parcial).toBeUndefined();
    expect(r.resultados[0].href).toBe("/observatorio");
  });

  // nenhuma página trata do salário mínimo: o termo cai no estado "ainda não cobre" (bloco 4), sem gancho inventado
});

describe("bloco 3: toda página com pergunta e termos", () => {
  const pagina = (href: string) => indiceDeBusca().entradas.find((e) => e.href === href && (e.tipo === "pagina" || e.tipo === "pergunta"));

  it("'Regulação': as duas páginas primeiro, cada uma com resumo no índice", () => {
    const r = b("Regulação").resultados.slice(0, 2);
    expect(r.map((x) => x.href).sort()).toEqual(["/gas-natural/regulacao", "/setor-eletrico/regulacao"]);
    for (const x of r) expect(x.resumo, x.href ?? x.titulo).not.toBe("");
  });

  it("'Importação', 'Produção', 'Atlas', 'Panorama': a página de título igual vem primeiro, com resumo", () => {
    for (const t of ["Importação", "Produção", "Atlas", "Panorama"]) {
      const r = b(t).resultados[0];
      expect([r.nivel, r.tipo], t).toEqual([0, "pagina"]);
      expect(r.resumo, t).not.toBe("");
    }
    expect(pagina("/gas-natural/importacao")?.resumo).toBe("Quanto gás o Brasil importa e de onde ele vem?");
  });

  it("fontes: a coleção ou a página que usa a fonte vem entre os três primeiros", () => {
    const esperado: Record<string, string[]> = {
      SNIS: ["saneamento"],
      SINISA: ["saneamento"],
      Siconfi: ["estaduais"],
      CAGED: ["renda"],
      PNAD: ["renda", "protecao"],
      INEP: ["educacao"],
      DataSUS: ["saude"],
    };
    for (const [t, colecoes] of Object.entries(esperado)) {
      const r = b(t).resultados.slice(0, 3);
      expect(r.some((x) => colecoes.includes(x.colecao ?? "")), t).toBe(true);
    }
  });

  it("termos dos catálogos: 'Selic', 'ICMS', 'superávit' e 'Ideb anos finais' acham o painel que mostra o assunto", () => {
    expect(b("Selic").resultados[0].href).toBe("/observatorio/credit");
    expect(b("ICMS").resultados[0].href).toBe("/contas-publicas-estaduais");
    expect(b("superávit").resultados[0].href).toBe("/contas-publicas/panorama");
    expect(b("Ideb anos finais").resultados[0].colecao).toBe("educacao");
  });

  // 35 dos 234 termos (15%) seguem sem resultado depois do bloco 3: são temas que a plataforma não cobre (eleição, covid,
  // ANVISA, hidrogênio verde, salário dos juízes...), e ligar um sinônimo a eles anunciaria cobertura que não existe. O
  // destino deles é o estado "ainda não cobre" do bloco 4, não a meta de 10% do prompt (decisão registrada no PR do bloco 3)
  it.todo("conjunto completo: zero resultados em no máximo 10% dos 234 termos (não alcançado sem inventar cobertura; ver PR do bloco 3)");
});

describe("bloco 4: estado vazio", () => {
  const vazio = (termo: string) => renderToStaticMarkup(createElement(NaoCobre, { termo, indice: indiceDeBusca(), comSessao: false }));

  it("'autonomia financeira', 'xyzabc', 'tarifa branca', 'salário mínimo': estado 'ainda não cobre', com os seis observatórios e sem resultado demonstrativo", () => {
    for (const t of ["autonomia financeira", "xyzabc", "tarifa branca", "salário mínimo"]) {
      const r = b(t);
      expect(r.resultados, t).toEqual([]);
      expect(r.sugestoes, t).toBeUndefined();
      const h = vazio(t);
      // frase decidida pelo dono em 23/10/2026 (seção 7 do prompt da busca, item 4)
      expect(h, t).toContain("A Scrutiniums ainda não cobre <q>");
      expect(h, t).toContain("Veja o que cada observatório responde:");
      expect(h.split("<li").length - 1, t).toBe(6);
    }
  });

  // desde o bloco 3, "ações" acha "Bancos na bolsa" e "transparência" acha "Políticas e inclusão" (termos dos catálogos); os
  // termos que só alcançam a página prevista trazem junto a coleção e o observatório dela
  it("'ações', 'transparência': já têm página publicada; 'equidade' e 'avaliação': a prevista vem com a coleção e o observatório", () => {
    expect(b("ações").resultados.some((x) => x.href === "/observatorio/market")).toBe(true);
    expect(b("transparência").resultados.some((x) => x.situacao === "publicado" && x.href)).toBe(true);
    for (const t of ["equidade", "avaliação"]) {
      const r = b(t).resultados;
      expect(r[0].situacao, t).toBe("previsto");
      expect(r.some((x) => x.tipo === "colecao" && x.href === "/contas-publicas"), t).toBe(true);
      expect(r.some((x) => x.tipo === "observatorio" && x.href), t).toBe(true);
    }
  });

  // decisão do dono de 23/10/2026 (seção 7 do prompt da busca, item 3; achado A7): sem sessão, o primeiro resultado fechado ganha
  // a linha "Versão aberta do tema" quando a coleção tem página aberta, sem mudar a ordem
  it("versão aberta: cada página aberta dos aperitivos fica presa à sua coleção, e o endereço é público", () => {
    const abertas = indiceDeBusca().colecoes.filter((c) => c.aberta);
    expect(abertas.find((c) => c.id === "setor-eletrico")?.aberta).toEqual({ titulo: "Quanto custa a minha conta de luz?", href: "/setor-eletrico/conta-de-luz" });
    expect(abertas.find((c) => c.id === "saneamento")?.aberta?.href).toBe("/saneamento/municipio");
    for (const c of abertas) expect(ehRotaPublica(c.aberta!.href), c.id).toBe(true);
  });

  it("versão aberta: sem sessão, a linha aparece sob o primeiro resultado fechado, só nele; com sessão ou primeiro aberto, não", () => {
    const html = (termo: string, comSessao: boolean) => renderToStaticMarkup(createElement(ListaResultados, { grupos: b(termo).grupos, comSessao }));
    const r = b("PLD").resultados[0];
    expect([r.colecao, r.aberta]).toEqual(["setor-eletrico", false]);
    const sem = html("PLD", false);
    expect(sem.split("data-versao-aberta").length - 1).toBe(1);
    expect(sem).toContain('href="/setor-eletrico/conta-de-luz"');
    expect(sem).toContain("Versão aberta do tema:");
    // a ordem não muda: o primeiro item da lista continua sendo o primeiro resultado
    expect(emOrdemDeTela(b("PLD").grupos)[0].id).toBe(r.id);
    expect(html("PLD", true)).not.toContain("data-versao-aberta");
    expect(b("conta de luz").resultados[0].aberta).toBe(true);
    expect(html("conta de luz", false)).not.toContain("data-versao-aberta");
  });

  it("conjunto completo: todo termo sem resultado cai num dos estados vazios (sugestão de correção ou 'ainda não cobre')", () => {
    const i = indiceDeBusca();
    const semEstado = TERMOS.map(([t]) => [t, buscar(i, t)] as const)
      .filter(([, r]) => r.resultados.length === 0)
      .filter(([t, r]) => !r.sugestoes?.length && !vazio(t).includes("ainda não cobre"))
      .map(([t]) => t);
    expect(semEstado).toEqual([]);
  });
});

/** Os 234 termos dos dois lotes, com o número de resultados de 23/10/2026 (main em 00c055474; "30" é o limite, "30+" no anexo). */
const TERMOS: [string, number][] = [
  // lote 1
  ["ANEEL", 11], ["agência reguladora", 0], ["agências reguladoras", 0], ["autonomia financeira", 0], ["orçamento da ANEEL", 0],
  ["taxa de fiscalização", 0], ["TFSEE", 0], ["contingenciamento", 0], ["receita própria", 0], ["regulação", 2], ["regulador", 1],
  ["ANP", 6], ["ANATEL", 3], ["ANS", 0], ["ANVISA", 0], ["ANTT", 0], ["autarquia", 1], ["orçamento", 8], ["LOA", 0], ["SIOP", 0],
  ["despesa", 21], ["execução orçamentária", 1], ["gasto do governo", 0], ["dívida", 30], ["divida publica", 12], ["energia", 30],
  ["luz", 13], ["tarifa", 16], ["quanto custa a luz", 2], ["preço da luz", 3], ["inflação", 8], ["juros", 10], ["selic", 0],
  ["PIB", 3], ["desemprego", 8], ["educação", 9], ["saúde", 11], ["segurança", 11], ["escola", 7], ["hospital", 6],
  ["conta de luz", 8], ["Ideb", 6], ["dívida dos estados", 4], ["fiscalização", 0], ["agencia", 1], ["orcamento aneel", 0],
  ["aneel orcamento", 0], ["quanto a aneel arrecada", 0], ["encargos setoriais", 0], ["CDE", 1], ["bandeira", 6], ["subsídio", 1],
  ["subsidios", 1], ["CCEE", 7], ["ONS", 13], ["EPE", 2], ["MME", 1], ["ministério", 3], ["Petrobras", 1], ["gasolina", 4],
  ["diesel", 4], ["etanol", 4], ["imposto", 3], ["ICMS", 0], ["tributo", 4], ["Receita Federal", 4], ["INSS", 3],
  ["aposentadoria", 3], ["Bolsa Família", 1], ["pix", 4], ["banco central", 0], ["BCB", 1], ["cartão", 1], ["cartao de credito", 0],
  ["rotativo", 0], ["desenrola", 5], ["renegociação", 0], ["nome sujo", 5], ["água", 14], ["esgoto", 7], ["saneamento", 20],
  ["lixo", 1], ["transporte", 5], ["ônibus", 3], ["internet", 3], ["5G", 3], ["clima", 18], ["chuva", 6], ["enchente", 2],
  ["seca", 5], ["desmatamento", 7], ["soja", 1], ["safra", 8], ["exportação", 8], ["balança comercial", 0], ["câmbio", 0],
  ["dólar", 0], ["bolsa", 2], ["ações", 1], ["tesouro direto", 0], ["poupança", 0], ["quanto o brasil gasta com saúde", 0],
  ["quanto custa o judiciário", 0], ["salário dos juízes", 0], ["servidores", 0], ["folha de pagamento", 0],
  ["previdência dos servidores", 0], ["estatais", 0], ["Eletrobras", 0], ["privatização", 0], ["leilão", 1], ["concessão", 0],
  ["agências", 0], ["regulatório", 4], ["regulatória", 1], ["transparência", 1], ["compliance", 0], ["Pernambuco", 7],
  ["São Paulo", 18], ["Recife", 11], ["2024", 0], ["2025", 0], ["covid", 0], ["pandemia", 0], ["eleição", 0], ["governo Lula", 0],
  ["Bolsonaro", 0], ["Haddad", 0], ["arcabouço fiscal", 0], ["meta fiscal", 0], ["déficit", 4], ["superávit", 0],
  ["resultado primário", 3],
  // lote 2
  ["autonomia financeira das agências reguladoras", 0], ["receita da aneel", 0], ["orçamento das agências", 0],
  ["como funciona o PLD", 0], ["o que é PLD", 8], ["qual a tarifa social", 0], ["tarifas", 2], ["escolas", 6], ["hospitais", 0],
  ["perdas", 5], ["perda de energia", 5], ["cartão de crédito rotativo", 0], ["endividamento das famílias", 6],
  ["quanto custa a energia", 12], ["preço da gasolina", 2], ["quanto o governo gasta com educação", 0], ["saneamneto", 0],
  ["enegia", 0], ["divida dos estado", 6], ["Amazônia", 5], ["floresta", 8], ["pecuária", 8], ["5G", 3], ["fibra", 3],
  ["Banco da Amazônia", 1], ["conta", 30], ["agua", 14], ["IBGE", 2], ["ONS", 13], ["ANP", 6], ["Bets", 1], ["apostas", 1],
  ["fraude", 4], ["golpe do pix", 1], ["minha cidade", 10], ["meu município", 10], ["Fortaleza", 11], ["Celpe", 0], ["Cemig", 1],
  ["Light", 1], ["Equatorial", 1], ["Energisa", 1], ["Itaú", 1], ["Bradesco", 1], ["Nubank", 1], ["Santander", 1], ["C6", 1],
  ["Inter", 20], ["juros do cartão", 0], ["quanto meu banco cobra", 2], ["consignado", 2], ["aposentado", 5], ["Bolsa Família", 1],
  ["CadÚnico", 1], ["cesta básica", 4], ["salário mínimo", 0], ["PIB per capita", 0], ["RGF", 3], ["LRF", 0], ["Siconfi", 1],
  ["Tesouro", 3], ["dívida ativa", 1], ["PGFN", 0], ["falência", 2], ["recuperação judicial", 1], ["Ideb anos finais", 0],
  ["creche", 1], ["matrícula", 3], ["vagas em creche", 0], ["SUS", 8], ["UBS", 6], ["homicídios", 1], ["feminicídio", 0],
  ["CNJ", 7], ["Defensoria", 2], ["museu", 2], ["biblioteca", 2], ["ônibus", 3], ["trânsito", 3], ["banda larga", 3], ["4G", 3],
  ["queimadas", 3], ["Pantanal", 0], ["INPE", 3], ["enchentes", 0], ["Porto Alegre", 11], ["Rio Grande do Sul", 7],
  ["defesa civil", 2], ["seca", 5], ["El Niño", 0], ["hidrogênio verde", 0], ["eólica offshore", 0], ["transmissão", 3],
  ["leilão de transmissão", 1], ["distribuidora", 13], ["Neoenergia", 1], ["bandeira vermelha", 1], ["tarifa branca", 0],
  ["conta de luz cara", 1], ["por que a conta de luz subiu", 0], ["desconto na conta de luz", 2],];

/** Termos sem resultado (79 em 23/10/2026; 55 depois do bloco 1; 43 depois do bloco 2; 35 depois do bloco 3): só pode cair. */
const SEM_RESULTADO_MAXIMO = 35;

describe("conjunto completo (catraca)", () => {
  it("são os 234 termos dos dois lotes", () => {
    expect(TERMOS).toHaveLength(234);
  });

  it("todo termo que já tinha resultado continua com resultado completo, sem parcial e sem correção", () => {
    const i = indiceDeBusca();
    const perdidos = TERMOS.filter(([, hoje]) => hoje > 0)
      .map(([t]) => [t, buscar(i, t)] as const)
      .filter(([, r]) => r.resultados.length === 0 || r.parcial || r.correcao)
      .map(([t]) => t);
    expect(perdidos).toEqual([]);
  });

  it(`no máximo ${SEM_RESULTADO_MAXIMO} termos sem resultado`, () => {
    const i = indiceDeBusca();
    const zeros = TERMOS.filter(([t]) => buscar(i, t).resultados.length === 0).map(([t]) => t);
    expect(zeros.length, zeros.join(", ")).toBeLessThanOrEqual(SEM_RESULTADO_MAXIMO);
  });
});
