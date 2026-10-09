import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ConceitoPage from "@/app/setor-eletrico/aprenda/[conceito]/page";
import AprendaPage from "@/app/setor-eletrico/aprenda/page";
import { AprendaVerbete } from "@/components/energia/AprendaVerbete";
import TrilhasPage from "@/app/setor-eletrico/aprenda/trilhas/page";
import TrilhaPage from "@/app/setor-eletrico/aprenda/trilhas/[trilha]/page";
import { AprendaProva } from "@/components/energia/AprendaProva";
import { buscarVerbetes, normalizaBusca, notaDoVerbete } from "@/lib/energia/aprenda-busca";
import { estadosDoAcervo, gruposDoIndice, idDoGrupo, itemDoIndice, recorteDoAcervo, resumoDoAcervo, type ResumoDoAcervo } from "@/lib/energia/conteudo/aprenda-indice";
import { CONCEITOS, GRUPOS, conceito, type Conceito } from "@/lib/energia/conteudo/conceitos";
import { PERGUNTA_PRATICA, perguntaPratica } from "@/lib/energia/conteudo/perguntas-praticas";
import { TRILHAS_APRENDA } from "@/lib/energia/conteudo/trilhas";
import { siglasNoTexto } from "@/lib/energia/siglas";

/**
 * Redesenho do Aprenda (tela "Entenda um conceito"): busca, trilhas curtas e verbetes compactos, com a pergunta prática antes da sigla e
 * o link direto ao painel; índice, trilha e verbete como três tipos de página; estado de conferência sempre à vista; verbete em
 * preparação sem pergunta nem definição e sem tratar a ausência como conceito inexistente.
 */
const texto = (h: string) =>
  h
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
const conferidos = CONCEITOS.filter((c) => c.estado === "CONFERIDO");
const SEPARADOR = /[–—]| - /;

/** Verbete conferido que não está no acervo real, para provar o comportamento sem pergunta. */
const conferidoSemPergunta: Conceito = {
  slug: "termo-sem-pergunta-de-teste",
  sigla: "TSP",
  nome: "Termo sem pergunta de teste",
  grupo: "Mercado",
  estado: "CONFERIDO",
  conferidoEm: "2026-10-01",
  emUmaFrase: "Texto de definição que só a busca lê.",
  relacoes: [],
  fontes: [],
  vejaNoPortal: [{ rotulo: "Mercado: livre e regulado", href: "/setor-eletrico/mercado#livre-regulado" }],
};
/** Verbete em preparação (não há nenhum no acervo hoje; o índice precisa tratá-lo se voltar a haver). */
const emPreparacao: Conceito = {
  slug: "termo-pendente-de-teste",
  sigla: "TPT",
  nome: "Termo pendente de teste",
  grupo: "Mercado",
  estado: "PENDENTE",
  relacoes: [],
  fontes: [],
  vejaNoPortal: [{ rotulo: "Mercado: livre e regulado", href: "/setor-eletrico/mercado#livre-regulado" }],
  fontePlanejada: "Documento primário ainda a conferir.",
};

describe("pergunta prática de cada verbete", () => {
  it("todo verbete conferido tem a sua; nenhuma sobra para slug que não existe; verbete em preparação não tem", () => {
    for (const c of conferidos) expect(perguntaPratica(c.slug), c.slug).toBeTruthy();
    for (const slug of Object.keys(PERGUNTA_PRATICA)) expect(conceito(slug)?.estado, slug).toBe("CONFERIDO");
    for (const c of CONCEITOS.filter((x) => x.estado !== "CONFERIDO")) expect(perguntaPratica(c.slug), c.slug).toBeNull();
    expect(perguntaPratica("nao-existe")).toBeNull();
  });

  it("é pergunta de verdade, curta, sem a sigla nem o nome do verbete, sem sigla que a página não expande e sem separador, 'hoje', 'agora' ou 'atual'", () => {
    const vistas = new Set<string>();
    for (const [slug, q] of Object.entries(PERGUNTA_PRATICA)) {
      const c = conceito(slug)!;
      expect(q, slug).toMatch(/^(Quanto|Quanta|Quantas|Quantos|Qual|Quais|Que|Como|Com que|Quando|Onde|Quem|Em que|De onde|Por quanto|A que)\b.*\?$/);
      expect(q.length, slug).toBeLessThan(90);
      expect(q, slug).not.toMatch(SEPARADOR);
      expect(q, slug).not.toMatch(/\b(hoje|agora|atual|atuais|porque|melhor|pior)\b/i);
      // a resposta é o verbete: a pergunta não traz o nome do termo (sigla ou nome por extenso)
      for (const palavra of (c.sigla ?? "").split(/[^A-Za-z0-9]+/).filter((w) => w.length >= 3 && w === w.toUpperCase())) {
        expect(new RegExp(`(^|[^A-Za-zÀ-ÿ0-9])${palavra}([^A-Za-zÀ-ÿ0-9]|$)`).test(q), `${slug}: sigla ${palavra} na pergunta`).toBe(false);
      }
      expect(normalizaBusca(q).indexOf(normalizaBusca(c.nome)), `${slug}: nome na pergunta`).toBe(-1);
      // nenhuma sigla do dicionário aparece solta (o índice só expande a sigla do próprio verbete)
      expect(siglasNoTexto(q, 20), `${slug}: ${q}`).toEqual([]);
      expect(vistas.has(q), `repetida: ${q}`).toBe(false);
      vistas.add(q);
    }
  });
});

describe("seletores do índice", () => {
  const todos = gruposDoIndice().flatMap((g) => g.itens);

  it("lista todos os verbetes do acervo, agrupados na ordem dos temas, cada um uma só vez", () => {
    expect(todos.map((i) => i.slug).sort()).toEqual(CONCEITOS.map((c) => c.slug).sort());
    expect(gruposDoIndice().map((g) => g.nome)).toEqual(GRUPOS);
    expect(gruposDoIndice().map((g) => g.id)).toContain("g-qualidade-e-perdas");
    expect(idDoGrupo("Fontes de dados")).toBe("g-fontes-de-dados");
  });

  it("estado, sigla e nome saem do acervo; ressalva e preparação não se confundem com conferido", () => {
    expect(todos.filter((i) => i.estado === "ressalva").map((i) => i.slug).sort()).toEqual(CONCEITOS.filter((c) => c.estado === "CONFERIDO" && c.ressalva).map((c) => c.slug).sort());
    expect(todos.filter((i) => i.estado === "preparacao").length).toBe(CONCEITOS.filter((c) => c.estado === "PENDENTE").length);
    const pld = todos.find((i) => i.slug === "pld")!;
    expect(pld).toMatchObject({ titulo: "PLD", subtitulo: "Preço de Liquidação das Diferenças", pergunta: perguntaPratica("pld") });
    // sigla igual ao nome (DECOMP) não se repete; verbete sem sigla abre pelo nome
    expect(todos.find((i) => i.slug === "decomp")).toMatchObject({ titulo: "DECOMP", subtitulo: undefined });
    expect(todos.find((i) => i.slug === "carga")).toMatchObject({ titulo: "Carga de energia", subtitulo: undefined });
  });

  it("o link ao painel de verbete conferido leva ?volta=verbete:<slug>, termina na âncora do painel e tem rótulo de painel", () => {
    for (const i of todos.filter((x) => x.estado !== "preparacao")) {
      expect(i.painel, i.slug).not.toBeNull();
      expect(i.painel!.href, i.slug).toContain(`volta=${encodeURIComponent(`verbete:${i.slug}`)}`);
      expect(i.painel!.href.startsWith("/setor-eletrico/"), i.slug).toBe(true);
      expect(i.painel!.rotulo.length, i.slug).toBeGreaterThan(2);
    }
    // o painel do índice é o mesmo do exemplo do verbete
    expect(todos.find((i) => i.slug === "ear")!.painel!.href).toBe("/setor-eletrico/agua-e-clima?volta=verbete%3Aear#p017");
  });

  it("verbete em preparação: sem pergunta, sem retorno (o botão de volta só existe para verbete conferido), com o painel e a fonte planejada na busca, sem definição", () => {
    const item = itemDoIndice(emPreparacao);
    expect(item.estado).toBe("preparacao");
    expect(item.pergunta).toBeNull();
    expect(item.painel).toEqual({ rotulo: "Mercado: livre e regulado", href: "/setor-eletrico/mercado#livre-regulado" });
    expect(item.busca).toContain("em preparacao");
    expect(item.busca).toContain("documento primario ainda a conferir");
    // ausência na busca não vira "não existe": o termo certo o encontra
    expect(buscarVerbetes([item], "tpt")!.map((i) => i.slug)).toEqual(["termo-pendente-de-teste"]);
  });

  it("verbete conferido sem pergunta escrita ainda aparece (pelo nome) e a busca lê a definição", () => {
    const item = itemDoIndice(conferidoSemPergunta);
    expect(item.pergunta).toBeNull();
    expect(item.estado).toBe("conferido");
    expect(item.busca).toContain("texto de definicao que so a busca le");
  });

  it("contagens e frases de estado vêm do acervo; com verbete em preparação a frase diz o que a marca quer dizer", () => {
    const r = resumoDoAcervo();
    expect(r.total).toBe(CONCEITOS.length);
    expect(r.conferidos + r.pendentes).toBe(r.total);
    expect(r.temas).toBe(GRUPOS.length);
    expect(r.de! <= r.ate!).toBe(true);
    expect(recorteDoAcervo(r)).toContain(`${r.total} verbetes`);
    expect(recorteDoAcervo(r)).not.toMatch(SEPARADOR);
    expect(estadosDoAcervo(r)).not.toMatch(/\bporque\b/);
    const comPendencia: ResumoDoAcervo = { total: 50, conferidos: 47, pendentes: 3, comRessalva: 2, temas: 11, de: "2026-09-28", ate: "2026-10-07" };
    const frase = estadosDoAcervo(comPendencia);
    expect(frase).toContain("47 de 50 verbetes estão conferidos na fonte primária.");
    expect(frase).toContain("Os 2 verbetes marcados com ◐ trazem uma ressalva declarada");
    expect(frase).toContain("Os 3 verbetes marcados com ○ estão em preparação, sem definição publicada");
    expect(recorteDoAcervo(comPendencia)).toBe("50 verbetes: 47 conferidos na fonte primária entre 28/09/2026 e 07/10/2026 e 3 em preparação");
    expect(recorteDoAcervo({ ...comPendencia, pendentes: 0, conferidos: 50, de: "2026-10-07", ate: "2026-10-07" })).toBe("50 verbetes, todos conferidos na fonte primária em 07/10/2026");
  });
});

describe("busca do índice", () => {
  const itens = gruposDoIndice().flatMap((g) => g.itens);
  const slugs = (t: string) => (buscarVerbetes(itens, t) ?? []).map((i) => i.slug);

  it("sem termo ou com uma letra só, a lista por tema continua inteira (nada filtra)", () => {
    expect(buscarVerbetes(itens, "")).toBeNull();
    expect(buscarVerbetes(itens, "p")).toBeNull();
    expect(buscarVerbetes(itens, "  ")).toBeNull();
  });

  it("acha por sigla, por nome, por pergunta e por palavra da definição, sem depender de acento nem de caixa", () => {
    expect(slugs("PLD")[0]).toBe("pld");
    expect(slugs("garantia física")).toEqual(slugs("GARANTIA FISICA"));
    expect(slugs("garantia fisica")).toContain("garantia-fisica");
    expect(slugs("reservatórios")).toContain("ear");
    expect(slugs("quanta energia")).toContain("ear");
    expect(slugs("efeito joule")).toContain("perdas-tecnicas");
  });

  it("ordena: sigla igual, depois sigla ou nome que começa pelo termo, depois nome ou pergunta, depois só o texto", () => {
    const pld = buscarVerbetes(itens, "pld")!;
    const notas = pld.map((i) => notaDoVerbete(i, "pld")!);
    expect(notas).toEqual([...notas].sort((a, b) => a - b));
    expect(pld[0].slug).toBe("pld");
    expect(notas[0]).toBe(0);
    const tarifa = buscarVerbetes(itens, "tarifa")!;
    expect(tarifa.slice(0, 2).map((i) => i.slug).sort()).toEqual(["tarifa-social", "tarifa-te-tusd"]);
  });

  it("termo com mais de uma palavra exige todas; termo que ninguém tem devolve lista vazia, não nulo", () => {
    expect(slugs("fisica garantia").sort()).toEqual(slugs("garantia fisica").sort());
    expect(slugs("garantia fisica").length).toBeGreaterThan(1);
    expect(slugs("garantia banana")).toEqual([]);
    expect(buscarVerbetes(itens, "zzzz")).toEqual([]);
  });
});

describe("índice: página", () => {
  const h = renderToStaticMarkup(createElement(AprendaPage));
  const t = texto(h);
  // a casca do observatório (menu, rodapé) tem texto próprio e é de outro dono: o conteúdo da página é o <main>
  const principal = texto(h.slice(h.indexOf("<main"), h.indexOf("</main>")));

  it("é o índice (um tipo de página), com a pergunta do mapa no título e o escopo dos verbetes na frase de abertura", () => {
    expect(h).toContain('data-tipo-pagina="indice"');
    expect(h).not.toContain('data-tipo-pagina="trilha"');
    expect(t).toContain("não todo o vocabulário do setor");
    expect(t).toContain("Procure um termo ou comece por uma trilha");
    expect((h.match(/<h1/g) ?? []).length).toBe(1);
  });

  it("a busca tem rótulo visível, é uma busca (role search) e vem antes das trilhas e da lista; sem JavaScript a lista está inteira", () => {
    expect(h).toContain('role="search"');
    expect(h).toContain("O que você quer entender?");
    expect(h).toMatch(/<label for="aprenda-busca"/);
    expect(h).toContain("[@media(scripting:none)]:hidden");
    expect(h).toContain("<noscript>");
    for (const c of CONCEITOS) expect(h, c.slug).toContain(`href="/setor-eletrico/aprenda/${c.slug}"`);
  });

  it("cada linha traz a pergunta prática antes da sigla, o estado quando foge do padrão e o link ao painel com o caminho de volta", () => {
    for (const c of conferidos) {
      const m = new RegExp(`<li[^>]*data-verbete="${c.slug}"[\\s\\S]*?</li>`).exec(h);
      expect(m, c.slug).not.toBeNull();
      const linha = m![0];
      const q = perguntaPratica(c.slug)!;
      const iPergunta = linha.indexOf(q.replace(/'/g, "&#x27;"));
      expect(iPergunta, `${c.slug}: pergunta`).toBeGreaterThan(-1);
      expect(linha.indexOf("data-nome"), `${c.slug}: nome depois da pergunta`).toBeGreaterThan(iPergunta);
      expect(linha, c.slug).toContain(c.sigla ? `>${c.sigla}</span>` : c.nome);
      expect(linha, c.slug).toContain(encodeURIComponent(`verbete:${c.slug}`));
      expect(linha, c.slug).toContain("Ver no painel");
      if (c.ressalva) expect(linha, c.slug).toContain("◐ com ressalva");
      else expect(linha, c.slug).not.toContain("data-selo");
    }
  });

  it("o nome do painel fica à vista a partir de 768 px e só para leitor de tela abaixo disso, e cada alvo tem 44 px", () => {
    expect(h).toContain("max-md:sr-only");
    expect(h).toContain("min-h-[44px] min-w-[44px]");
  });

  it("estado de conferência de todo o acervo na frase da lista e nas marcas; nada em preparação é tratado como conferido", () => {
    const r = resumoDoAcervo();
    expect(t).toContain(estadosDoAcervo(r));
    expect(t).toContain(recorteDoAcervo(r));
    expect((h.match(/data-estado="ressalva"/g) ?? []).length).toBe(2 * r.comRessalva);
    expect((h.match(/data-estado="preparacao"/g) ?? []).length).toBe(2 * r.pendentes);
    expect((h.match(/data-estado="conferido"/g) ?? []).length).toBe(2 * (r.conferidos - r.comRessalva));
  });

  it("celular: tema por tema recolhido, com prévia e contagem; tela larga: lista aberta; as duas estão no HTML e nenhum tema nasce aberto", () => {
    expect((h.match(/<details id="g-/g) ?? []).length).toBe(GRUPOS.length);
    expect(h).not.toMatch(/<details id="g-[^>]* open/);
    expect(h).toContain('data-lista="recolhida"');
    expect(h).toContain('data-lista="aberta"');
    expect(h).toContain('<div class="md:hidden" data-lista="recolhida">');
    expect(h).toContain('class="hidden space-y-8 md:block" data-lista="aberta"');
    for (const g of gruposDoIndice()) {
      expect(h, g.id).toContain(`id="${g.id}-lista"`);
      expect(t, g.nome).toContain(g.itens.map((i) => i.titulo).join(", "));
    }
  });

  it("as trilhas aparecem como capítulos (nome, pergunta, link), com o que é uma trilha e o aviso do exemplo sintético à vista", () => {
    expect(h).toContain('data-navegacao-local="capitulos"');
    for (const tr of TRILHAS_APRENDA) {
      expect(h, tr.id).toContain(`/setor-eletrico/aprenda/trilhas/${tr.id}`);
      expect(t, tr.id).toContain(tr.pergunta);
    }
    expect(t).toContain("No fim de cada trilha, há um");
    expect(t).toContain("Valores hipotéticos, escolhidos para ensinar.");
    // o índice das trilhas fica a um link; a faixa de seções é das páginas filhas
    expect(h).toContain('href="/setor-eletrico/aprenda/trilhas"');
    expect(h).not.toContain('data-navegacao-local="faixa"');
  });

  it("texto da página sem travessão como separador, sem 'hoje', 'agora' ou 'atual' e sem valor de reserva", () => {
    expect(principal).not.toMatch(SEPARADOR);
    expect(principal).not.toMatch(/\b(hoje|agora|atual|atuais)\b/i);
    expect(principal).not.toMatch(/undefined|NaN|\[object Object\]|\bgold\b/);
  });
});

describe("três tipos de página, cada um com a sua cara", () => {
  const trilhas = renderToStaticMarkup(createElement(TrilhasPage));
  const trilha = renderToStaticMarkup(createElement(TrilhaPage, { params: { trilha: TRILHAS_APRENDA[0].id } }));
  const verbete = renderToStaticMarkup(createElement(ConceitoPage, { params: { conceito: "pld" } }));
  const indice = renderToStaticMarkup(createElement(AprendaPage));

  it("cada página se declara de um tipo só e tem um único h1", () => {
    for (const [tipo, h] of [["indice", indice], ["trilhas", trilhas], ["trilha", trilha], ["verbete", verbete]] as const) {
      expect((h.match(/data-tipo-pagina="/g) ?? []).length, tipo).toBe(1);
      expect(h, tipo).toContain(`data-tipo-pagina="${tipo}"`);
      expect((h.match(/<h1/g) ?? []).length, tipo).toBe(1);
    }
  });

  it("as páginas filhas levam a faixa das seções do Aprenda com a seção atual marcada; o índice, que é a abertura, não leva", () => {
    const atual = (h: string) => {
      const faixa = h.slice(h.indexOf('aria-label="Seções do Aprenda"'));
      const a = /<a [^>]*aria-current="(?:page|true)"[^>]*>/.exec(faixa)?.[0] ?? "";
      return { href: /href="([^"]+)"/.exec(a)?.[1], valor: /aria-current="([^"]+)"/.exec(a)?.[1] };
    };
    expect(indice).not.toContain('aria-label="Seções do Aprenda"');
    // a página da própria seção é "page"; um verbete ou uma trilha, que está dentro da seção, marca a seção com "true" (a seção que contém a página)
    expect(atual(trilhas)).toEqual({ href: "/setor-eletrico/aprenda/trilhas", valor: "page" });
    expect(atual(trilha)).toEqual({ href: "/setor-eletrico/aprenda/trilhas", valor: "true" });
    expect(atual(verbete)).toEqual({ href: "/setor-eletrico/aprenda", valor: "true" });
  });

  it("o rótulo diz o tipo: trilha, verbete e o tema do verbete", () => {
    expect(trilha).toMatch(/<p class="rotulo text-mineral">Trilha<\/p>/);
    expect(verbete).toMatch(/<p class="rotulo text-mineral">Verbete · Preço<\/p>/);
    expect(trilhas).toMatch(/<p class="rotulo text-mineral">Aprenda<\/p>/);
  });

  it("o índice das trilhas dá a resposta curta, o que cada passo traz e as trilhas com os verbetes de cada passo", () => {
    const t = texto(trilhas);
    expect(t).toContain("Resposta curta: uma trilha é um percurso em ordem por verbetes conferidos");
    expect(trilhas).toContain('data-como-funciona=""');
    expect(t).toContain("a ficha Comprove quando o painel a publica");
    expect(t).toContain("um botão traz o leitor de volta ao passo");
    for (const tr of TRILHAS_APRENDA) {
      expect(t, tr.id).toContain(tr.pergunta);
      expect(trilhas, tr.id).toContain(`/setor-eletrico/aprenda/trilhas/${tr.id}`);
    }
    expect(t).not.toMatch(SEPARADOR);
    expect(t).not.toMatch(/\b(hoje|agora)\b/i);
  });

  it("a trilha tem a resposta curta logo depois do título, o percurso e cada tipo de ligação definido uma vez, onde aparece primeiro", () => {
    expect(trilha.indexOf("data-resposta-curta")).toBeLessThan(trilha.indexOf('data-percurso=""'));
    expect(trilha.indexOf('data-percurso=""')).toBeLessThan(trilha.indexOf('data-passo="'));
    expect((trilha.match(/data-tipo-ligacao="/g) ?? []).length).toBe(3);
    expect(texto(trilha)).toContain(TRILHAS_APRENDA[0].resumo);
    expect(trilha).not.toContain('aria-label="Tipos de ligação nesta trilha"');
  });

  it("verbete: a pergunta prática abre a página, e o que não se pode concluir vem logo depois do que não confundir, antes das relações e da fonte", () => {
    const pos = (r: string) => verbete.indexOf(`>${r}<`);
    expect(verbete).toContain(perguntaPratica("pld")!);
    expect(verbete.indexOf(perguntaPratica("pld")!)).toBeLessThan(pos("Em uma frase"));
    expect(pos("Não confundir com")).toBeGreaterThan(pos("Como é medido"));
    expect(pos("O que não se pode concluir")).toBeGreaterThan(pos("Não confundir com"));
    expect(pos("Relações")).toBeGreaterThan(pos("O que não se pode concluir"));
    expect(pos("Fonte oficial")).toBeGreaterThan(pos("Relações"));
    expect(verbete).toContain('id="exemplo"');
  });

  it("verbete: título com sigla e nome, e o estado de conferência na linha de contexto, com marca de ressalva quando há", () => {
    expect(verbete).toMatch(/<h1[^>]*><span>PLD<\/span><span class="sr-only">: <\/span><span[^>]*>Preço de Liquidação das Diferenças<\/span><\/h1>/);
    expect(texto(verbete)).toContain("● conferido na fonte primária em");
    const gsf = texto(renderToStaticMarkup(createElement(ConceitoPage, { params: { conceito: "gsf" } })));
    expect(gsf).toContain("◐ com ressalva:");
  });
});

describe("exemplo indisponível", () => {
  it("diz com frase completa que o exemplo está indisponível nesta publicação, sem jargão de bastidor, e oferece o painel com o retorno", () => {
    const h = renderToStaticMarkup(createElement(AprendaProva, { prova: null, volta: "verbete:pld", alternativa: { rotulo: "PLD: CMO e formação do preço", href: "/setor-eletrico/pld/cmo-e-formacao#p009" } }));
    const t = texto(h);
    expect(t).toContain("Este exemplo está indisponível nesta publicação: o painel de origem não trouxe o número, e o observatório não o substitui por outro.");
    expect(t).not.toMatch(/\b(gold|silver|pipeline)\b/i);
    expect(h).toContain('href="/setor-eletrico/pld/cmo-e-formacao?volta=verbete%3Apld#p009"');
    expect(t).toContain("Abrir o painel: PLD: CMO e formação do preço");
    // sem alternativa, só a frase
    expect(texto(renderToStaticMarkup(createElement(AprendaProva, { prova: null, volta: "verbete:pld" })))).not.toContain("Abrir o painel");
  });
});

describe("ficha do verbete em preparação e sem pergunta escrita", () => {
  it("em preparação: diz que está em preparação, não publica definição, pergunta, exemplo, unidade nem contraste, e mantém o painel e a fonte planejada", () => {
    const h = renderToStaticMarkup(createElement(AprendaVerbete, { c: emPreparacao }));
    const t = texto(h);
    expect(t).toContain("○ verbete em preparação");
    expect(t).toContain("A definição deste conceito ainda não foi conferida na fonte primária e por isso não é publicada.");
    expect(t).toContain("Fonte primária planejada: Documento primário ainda a conferir.");
    expect(h).toContain('role="status"');
    for (const n of ["Em uma frase", "Exemplo real", "Exemplo sintético", "Não confundir com", "Por que importa", "Como é medido"]) expect(h, n).not.toContain(`>${n}<`);
    expect(h).not.toContain("data-prova");
    expect(h).not.toContain('data-unidade="true"');
    expect(h).not.toContain("conferido na fonte primária em");
    // sem pergunta (o lead não existe) e sem "Fonte:" de verbete conferido
    expect(h).not.toContain("ed-lead");
    expect(t).not.toContain("Fonte: ");
    // o painel onde o conceito aparece continua à mão, sem o retorno (que só existe para verbete conferido)
    expect(h).toContain('href="/setor-eletrico/mercado#livre-regulado"');
    expect(h).not.toContain("volta=");
    // o rótulo é do tipo de página, e a página continua sendo um verbete
    expect(h).toContain('data-tipo-pagina="verbete"');
  });

  it("conferido sem pergunta escrita: a ficha abre normalmente, sem lead e sem frase quebrada", () => {
    const h = renderToStaticMarkup(createElement(AprendaVerbete, { c: conferidoSemPergunta }));
    const t = texto(h);
    expect(t).toContain("Texto de definição que só a busca lê.");
    expect(t).toContain("● conferido na fonte primária em 01/10/2026");
    expect(h).not.toContain("ed-lead");
    expect(t).not.toMatch(/undefined|NaN|\[object Object\]/);
    expect(h).toContain('id="exemplo"');
  });
});
