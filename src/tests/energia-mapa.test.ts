import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buscar, normalizarBusca } from "@/lib/energia/busca";
import { CONCEITOS } from "@/lib/energia/conteudo/conceitos";
import { DATASETS_INTEGRADOS } from "@/lib/energia/datasets";
import { escolhasDeDistribuidora, estadoDoDestino, indiceBusca, linhasAtualidade, periodoLegivel, resumoAtualidade, type PublicacaoAtualidade } from "@/lib/energia/home";
import {
  ANCORAS_VISAO_GERAL,
  CAMINHOS_INTENCAO,
  CARTOES,
  FAIXAS_MAPA,
  FONTES_PRINCIPAIS,
  ID_SINAIS,
  LIGACOES,
  NOS_MAPA,
  ORDEM_FAIXAS,
  PERGUNTAS_COTIDIANAS,
  PERGUNTAS_PRIORITARIAS,
  ROTULOS_FAIXA,
  SECOES_HOME,
  TIPOS_LIGACAO,
  TRANSVERSAIS,
  TRILHAS,
} from "@/lib/energia/mapa";
import { DESTINOS_NAVEGACAO, MODULOS_ENERGIA } from "@/lib/energia/navegacao";

/**
 * Página inicial como porta de entrada (seção 6 e painéis P001 e P003): as sete âncoras,
 * os quatro caminhos e as seis perguntas, todo cartão, pergunta e trilha leva a uma rota
 * e a uma âncora que existem, nenhum destino em integração promete painel, o mapa
 * conceitual não desenha cadeia causal falsa e a atualidade mostra o período do dado,
 * nunca a data de captura. Os números das seis perguntas e a página renderizada estão em
 * energia-inicial.test.ts.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const HOME = "src/app/setor-eletrico/page.tsx";

const slugsEmpresas = (): Set<string> => {
  const g = JSON.parse(ler("public/energia/gold/empresas.json")) as { distribuidoras?: { indice?: { slug: string; slugs_alternativos: string[] }[] } };
  return new Set((g.distribuidoras?.indice ?? []).flatMap((d) => [d.slug, ...d.slugs_alternativos]));
};

/** Arquivo de página da rota, resolvendo as rotas dinâmicas pelo que elas geram. */
function paginaDaRota(href: string): string | null {
  const caminho = href.split(/[?#]/)[0].replace(/^\/setor-eletrico\/?/, "");
  const direto = join("src", "app", "setor-eletrico", caminho, "page.tsx");
  if (existsSync(join(raiz, direto))) return direto;
  const m = caminho.match(/^(aprenda|dados|empresas)\/([^/]+)$/);
  if (!m) return null;
  const [, base, slug] = m;
  if (base === "aprenda" && CONCEITOS.some((c) => c.slug === slug)) return "src/app/setor-eletrico/aprenda/[conceito]/page.tsx";
  if (base === "dados" && DATASETS_INTEGRADOS.some((d) => d.slug === slug)) return "src/app/setor-eletrico/dados/[dataset]/page.tsx";
  if (base === "empresas" && slugsEmpresas().has(slug)) return "src/app/setor-eletrico/empresas/[entidade]/page.tsx";
  return null;
}

/** Código da página e dos componentes que ela importa diretamente: onde uma âncora pode ser declarada. */
function codigoDaPagina(arquivo: string): string {
  const t = ler(arquivo);
  const extras = [
    ...Array.from(t.matchAll(/from "@\/components\/(energia|evidencia)\/([A-Za-z]+)"/g)).map((m) => `src/components/${m[1]}/${m[2]}.tsx`),
    ...Array.from(t.matchAll(/from "@\/lib\/energia\/([a-z-]+)"/g)).map((m) => `src/lib/energia/${m[1]}.ts`),
  ].filter((f) => existsSync(join(raiz, f)));
  return [t, ...extras.map(ler)].join("\n");
}

function confereDestino(href: string) {
  const arquivo = paginaDaRota(href);
  expect(arquivo, `${href}: rota sem página`).not.toBeNull();
  const ancora = href.includes("#") ? href.split("#")[1] : null;
  if (ancora) expect(codigoDaPagina(arquivo!), `${href}: âncora ausente`).toMatch(new RegExp(`id="${ancora}"|id=\\{"${ancora}"\\}|id: "${ancora}"`));
}

describe("página inicial: mapa didático (P001)", () => {
  it("tem as sete âncoras (as que outras páginas usam), a proposta, a busca e os quatro caminhos, e mantém a Visão geral numa página própria", () => {
    const t = ler(HOME);
    // a ordem em que as seções aparecem; cada id é a âncora que outras páginas e links antigos usam
    expect(SECOES_HOME.map((s) => s.id)).toEqual(["proposito", "perguntas", "destinos", "mapa-conceitual", "trilhas", "como-confiar", "aprofundar"]);
    for (const s of SECOES_HOME) expect(t, s.id).toContain(`id="${s.id}"`);
    const posicoes = SECOES_HOME.map((s) => t.indexOf(`id="${s.id}"`));
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes);
    expect(t).toContain("Energia, do sistema à sua conta");
    expect("Energia, do sistema à sua conta".split(" ")).toHaveLength(6);
    expect(t).toContain("<BuscaObservatorio");
    expect(t).toContain('canonical: "/setor-eletrico"');
    expect(t).toContain('<MarcaVisita secao="energia:mapa" />');
    expect(ler("src/app/setor-eletrico/visao-geral/page.tsx")).toContain('canonical: "/setor-eletrico/visao-geral"');
    expect(MODULOS_ENERGIA[0]).toMatchObject({ slug: "mapa", href: "/setor-eletrico" });
    // o Aprenda leva ao mapa pela âncora
    expect(ler("src/app/setor-eletrico/aprenda/trilhas/page.tsx")).toContain("/setor-eletrico#mapa-conceitual");
  });

  it("os quatro caminhos de intenção levam a Visão geral, Território, Aprenda, Dados e Metodologia, cada um com link publicado", () => {
    expect(CAMINHOS_INTENCAO.map((c) => c.id)).toEqual(["acompanhar", "regiao", "aprender", "conferir"]);
    expect(CAMINHOS_INTENCAO.map((c) => c.slugs)).toEqual([["visao-geral"], ["territorio"], ["aprenda"], ["dados", "metodologia"]]);
    for (const c of CAMINHOS_INTENCAO) {
      expect(c.titulo.length, c.id).toBeGreaterThan(10);
      expect(c.descricao.length, c.id).toBeGreaterThan(30);
      for (const s of c.slugs) {
        const d = DESTINOS_NAVEGACAO.find((x) => x.slug === s);
        expect(d?.publicado, `${c.id}: ${s}`).toBe(true);
        confereDestino(d!.href);
      }
    }
  });

  it("as seis perguntas prioritárias: conta, qualidade, perdas, reservatórios, PLD e expansão, cada uma com destino e âncora que existem", () => {
    expect(PERGUNTAS_PRIORITARIAS.map((p) => p.id)).toEqual(["conta", "qualidade", "perdas", "agua", "pld", "expansao"]);
    expect(PERGUNTAS_PRIORITARIAS.map((p) => p.id)).toEqual([...ID_SINAIS]);
    expect(PERGUNTAS_PRIORITARIAS.map((p) => p.slug)).toEqual(["conta-de-luz", "qualidade", "perdas", "agua-e-clima", "pld", "expansao"]);
    for (const p of PERGUNTAS_PRIORITARIAS) {
      expect(p.pergunta.endsWith("?"), p.id).toBe(true);
      expect(DESTINOS_NAVEGACAO.find((d) => d.slug === p.slug)?.publicado, p.id).toBe(true);
      expect(p.link.href.startsWith(DESTINOS_NAVEGACAO.find((d) => d.slug === p.slug)!.href), p.id).toBe(true);
      confereDestino(p.link.href);
    }
    // só perdas e qualidade oferecem "sua distribuidora", pelo parâmetro que a página de destino lê
    expect(PERGUNTAS_PRIORITARIAS.filter((p) => p.porDistribuidora).map((p) => [p.id, p.porDistribuidora])).toEqual([
      ["qualidade", "qualidade"],
      ["perdas", "perdas"],
    ]);
    const t = ler(HOME);
    expect(t).toContain('destino="/setor-eletrico/perdas" parametro="d"');
    expect(t).toContain('destino="/setor-eletrico/qualidade" parametro="dist"');
  });

  it("a inicial não depende de constante de número: os sinais saem de home-sinais.ts e a página só escreve o que recebe", () => {
    const t = ler(HOME);
    expect(t).toContain("sinaisDaInicial()");
    // nenhum valor de gold escrito à mão na página nem no conteúdo editorial da inicial
    for (const f of [HOME, "src/lib/energia/mapa.ts"]) expect(ler(f), f).not.toMatch(/\b\d{1,3}(?:\.\d{3})+,\d+|\b\d+,\d{2,4}\s*(?:%|h\b|MW|R\$)|R\$\s*\d/);
  });

  it("todo destino publicado tem cartão com pergunta, utilidade, recorte e recursos concretos", () => {
    const publicados = DESTINOS_NAVEGACAO.filter((d) => d.publicado && d.slug !== "mapa");
    for (const d of publicados) {
      const c = CARTOES[d.slug];
      expect(c, `${d.slug}: sem cartão`).toBeTruthy();
      expect(d.pergunta.endsWith("?"), d.slug).toBe(true);
      expect(c.utilidade.length, d.slug).toBeGreaterThan(40);
      expect(c.recorte.length, d.slug).toBeGreaterThan(5);
      expect(c.encontra.length, d.slug).toBeGreaterThanOrEqual(2);
    }
    // nenhum cartão de destino que não existe na navegação
    for (const slug of Object.keys(CARTOES)) expect(DESTINOS_NAVEGACAO.some((d) => d.slug === slug), slug).toBe(true);
    // descrições não se repetem entre cartões
    const utilidades = Object.values(CARTOES).map((c) => c.utilidade);
    expect(new Set(utilidades).size).toBe(utilidades.length);
  });

  it("toda promessa de cartão leva a uma rota e a uma âncora que existem; destino em integração não promete painel", () => {
    for (const d of DESTINOS_NAVEGACAO.filter((x) => x.publicado && CARTOES[x.slug])) {
      confereDestino(d.href);
      if (!d.integrado) continue;
      for (const e of CARTOES[d.slug].encontra) confereDestino(e.href);
    }
    expect(ler(HOME)).toContain("Em integração");
  });

  it("perguntas do dia a dia: as nove da especificação, cada uma com destino existente", () => {
    const esperadas = [
      "Minha distribuidora perde muita energia?",
      "O serviço da minha distribuidora melhorou?",
      "Por que a conta de luz subiu?",
      "O preço de curto prazo está alto para esta época?",
      "A água nos reservatórios está acima do normal?",
      "Por que há corte de geração renovável?",
      "Onde estão as novas usinas?",
      "Quem recebe os benefícios e onde pode haver falta de cobertura?",
      "Quero baixar a série e reproduzir o gráfico.",
    ];
    expect(PERGUNTAS_COTIDIANAS.map((p) => p.pergunta)).toEqual(esperadas);
    for (const p of PERGUNTAS_COTIDIANAS) for (const d of p.destinos) confereDestino(d.href);
    // a conta subiu: a resposta não atribui causa
    expect(PERGUNTAS_COTIDIANAS[2].resposta).toMatch(/não atribui causa/);
    // escolha de distribuidora usa o parâmetro que a página de destino lê
    expect(ler("src/components/energia/PerdasSelecao.ts")).toContain('param: "d"');
    expect(ler("src/components/energia/QualidadeComparador.tsx")).toContain('param: "dist"');
  });

  it("trilhas: quatro perfis, cada parada com destino existente e o que se aprende; tempo marcado como estimativa", () => {
    expect(TRILHAS.map((t) => t.perfil)).toEqual(["Estou começando", "Sou consumidor", "Analiso o setor", "Ensino ou pesquiso"]);
    for (const t of TRILHAS) {
      expect(t.paradas.length, t.id).toBeGreaterThanOrEqual(4);
      expect(t.minutos, t.id).toBeGreaterThan(0);
      for (const s of t.paradas) {
        confereDestino(s.href);
        expect(s.aprende.length, `${t.id}: ${s.rotulo}`).toBeGreaterThan(15);
      }
    }
    expect(ler(HOME)).toContain("estimativa editorial");
  });

  it("mapa conceitual: elos com destino e verbete conferido, ligações tipificadas, sem cadeia causal falsa", () => {
    expect(NOS_MAPA).toHaveLength(7);
    const ids = new Set(NOS_MAPA.map((n) => n.id));
    for (const n of NOS_MAPA) {
      expect(n.destinos.length, n.id).toBeGreaterThan(0);
      for (const s of n.destinos) expect(DESTINOS_NAVEGACAO.find((d) => d.slug === s)?.publicado, `${n.id}: ${s}`).toBe(true);
      for (const c of n.conceitos) expect(CONCEITOS.find((x) => x.slug === c.slug)?.estado, `${n.id}: ${c.slug}`).toBe("CONFERIDO");
    }
    for (const l of LIGACOES) {
      expect(ids.has(l.de) && ids.has(l.para), `${l.de} → ${l.para}`).toBe(true);
      expect(TIPOS_LIGACAO[l.tipo], l.tipo).toBeTruthy();
    }
    // todos os tipos da seção 6.2 B são usados, cada um com traço próprio
    expect(new Set(LIGACOES.map((l) => l.tipo)).size).toBe(Object.keys(TIPOS_LIGACAO).length);
    expect(new Set(Object.values(TIPOS_LIGACAO).map((t) => t.traco)).size).toBe(Object.keys(TIPOS_LIGACAO).length);
    // chuva não leva direto à conta nem ao contrato; PLD não é tarifa; diferença de preço não prova congestionamento
    expect(LIGACOES.some((l) => l.de === "recursos" && (l.para === "pessoas" || l.para === "contratos"))).toBe(false);
    expect(LIGACOES.find((l) => l.de === "operacao" && l.para === "contratos")?.texto).toMatch(/não é a tarifa/);
    expect(LIGACOES.find((l) => l.de === "rede" && l.para === "operacao")?.texto).toMatch(/não prova/);
    expect(LIGACOES.find((l) => l.tipo === "associacao")?.texto).toMatch(/sem afirmar causa/);
    // temas transversais da especificação
    expect(TRANSVERSAIS.map((t) => t.titulo)).toEqual(["Empresas", "Expansão", "Regulação", "Dados e método"]);
    // as quatro faixas do mapa: caminho físico, coordenação da operação, relações econômicas e experiência das pessoas
    expect(ORDEM_FAIXAS.map((f) => FAIXAS_MAPA[f].rotulo)).toEqual(["Caminho físico", "Coordenação da operação", "Relações econômicas", "Experiência das pessoas"]);
    for (const f of ORDEM_FAIXAS) {
      expect(NOS_MAPA.some((n) => n.faixa === f), f).toBe(true);
      expect(ROTULOS_FAIXA[f].x, f).toBeGreaterThan(0);
    }
    expect(NOS_MAPA.filter((n) => n.faixa === "fisico").map((n) => n.id)).toEqual(["recursos", "geracao", "rede", "consumo"]);
    // alternativa textual equivalente e versão de celular
    const t = ler(HOME);
    expect(t).toContain("O mapa em texto");
    // uma só cópia da versão em texto, visível no celular. No desktop ela sai do fluxo (display: none): cópia só para o leitor de tela
    // deixava dezenas de paradas de Tab em links e resumos invisíveis (WCAG 2.4.7), e lá o leitor de tela e o teclado usam os sete botões
    // e o painel do elo, que trazem o mesmo conteúdo (o desenho em si é aria-hidden)
    expect(t).toMatch(/className="md:hidden"[\s\S]*<MapaEmTexto \/>/);
    expect(t).not.toContain('className="md:sr-only"');
    expect(ler("src/components/energia/MapaConceitual.tsx")).toContain("aria-pressed={sel}");
    expect(ler("src/components/energia/MapaConceitual.tsx")).toContain('aria-live="polite"');
    expect(t.match(/<MapaEmTexto \/>/g)).toHaveLength(1);
    expect(ler("src/components/energia/MapaConceitual.tsx")).toContain('aria-hidden="true"');
  });

  it("links antigos com âncora da visão geral seguem para a nova página, e a home não reusa essas âncoras", () => {
    const visao = ler("src/app/setor-eletrico/visao-geral/page.tsx");
    const lib = ler("src/lib/energia/visao.ts");
    // sistema e observar são blocos da página; as demais âncoras caem nos cartões dos determinantes,
    // cujos ids vêm de ANCORAS_DETERMINANTES (a página passa o mapa inteiro ao componente)
    expect(visao).toContain("ancoras={ANCORAS_DETERMINANTES}");
    for (const a of ANCORAS_VISAO_GERAL) {
      const naPagina = new RegExp(`id="${a}"|id: "${a}"|id=\\{\`${a}`).test(visao);
      const nosCartoes = new RegExp(`(id|painel): "${a}"`).test(lib);
      expect(naPagina || nosCartoes, a).toBe(true);
    }
    const home = ler(HOME);
    expect(home).toContain("<RedirecionaAncoraAntiga ancoras={ANCORAS_VISAO_GERAL}");
    for (const a of ANCORAS_VISAO_GERAL) expect(home, a).not.toContain(`id="${a}"`);
    for (const s of SECOES_HOME) expect(ANCORAS_VISAO_GERAL, s.id).not.toContain(s.id);
  });
});

describe("busca da página inicial", () => {
  const verbetes = CONCEITOS.map((c) => ({ slug: c.slug, nome: c.nome, sigla: c.sigla, emUmaFrase: c.emUmaFrase, estado: c.estado }));
  const dist = [{ slug: "cemig-d", sigla: "CEMIG-D", nome: "CEMIG DISTRIBUIÇÃO S.A.", cnpj: "06981180000116", ufs: ["MG"] }];
  const indice = indiceBusca(DESTINOS_NAVEGACAO, verbetes, dist);

  it("só indexa o que existe: todo resultado leva a uma rota existente", () => {
    for (const i of indice.filter((x) => x.tipo !== "Distribuidora")) confereDestino(i.href);
    expect(indice.filter((i) => i.tipo === "Conceito").every((i) => CONCEITOS.find((c) => i.href.endsWith(`/${c.slug}`))?.estado === "CONFERIDO")).toBe(true);
    // módulo em integração aparece como página, sem painel prometido
    for (const d of DESTINOS_NAVEGACAO.filter((x) => !x.integrado && CARTOES[x.slug])) {
      expect(indice.some((i) => i.tipo === "Página" && i.href === d.href), d.slug).toBe(true);
      expect(indice.some((i) => i.tipo === "Painel" && i.detalhe === d.rotulo), d.slug).toBe(false);
    }
  });

  it("as seis perguntas prioritárias e as nove do dia a dia entram no índice como perguntas", () => {
    const perguntas = indice.filter((i) => i.tipo === "Pergunta").map((i) => i.titulo);
    for (const p of PERGUNTAS_PRIORITARIAS) expect(perguntas, p.id).toContain(p.pergunta);
    for (const p of PERGUNTAS_COTIDIANAS) expect(perguntas, p.pergunta).toContain(p.pergunta);
    expect(buscar(indice, "reservatórios armazenada").itens.some((i) => i.tipo === "Pergunta")).toBe(true);
    // busca por assunto (painel), conceito e entidade
    expect(buscar(indice, "bandeira").itens.length).toBeGreaterThan(0);
    expect(buscar(indice, "DEC").itens.some((i) => i.tipo === "Conceito" || i.tipo === "Painel")).toBe(true);
  });

  it("acha sem acento e sem maiúscula, exige todas as palavras e põe o título na frente", () => {
    expect(normalizarBusca("Reservatórios  ÁGUA")).toBe("reservatorios agua");
    const r = buscar(indice, "perdas");
    expect(r.total).toBeGreaterThan(0);
    expect(r.itens[0].titulo.toLowerCase()).toContain("perdas");
    expect(buscar(indice, "reservatorios").total).toBeGreaterThan(0);
    expect(buscar(indice, "cemig").itens[0]).toMatchObject({ tipo: "Distribuidora", href: "/setor-eletrico/empresas/cemig-d" });
    expect(buscar(indice, "perdas zzzz").total).toBe(0);
    expect(buscar(indice, "   ").total).toBe(0);
  });
});

describe("atualidade das fontes (P003)", () => {
  it("lê o período de referência no grão da fonte e nunca a data de captura", () => {
    expect(periodoLegivel("2026-09-28T23:00")).toBe("28/09/2026 23h");
    expect(periodoLegivel("2026-09-28")).toBe("28/09/2026");
    expect(periodoLegivel("2026-08")).toBe("ago/2026");
    expect(periodoLegivel("2025")).toBe("2025");
    expect(periodoLegivel(null)).toBeNull();
    const pub: PublicacaoAtualidade = {
      referencia: { hoje: "2026-10-01" },
      conjuntos: [
        { id: "aneel_distribuicao/aneel_samp_balanco", slug: "x", orgao: "ANEEL", titulo: "SAMP", atualidade: { situacao: "EM DIA", cadencia: "mensal", ultimo_periodo: "2026-08", fim_ultimo_periodo: "2026-08-31" } },
        { id: "aneel_qualidade/aneel_continuidade", orgao: "ANEEL", titulo: "DEC", atualidade: { situacao: "EM DIA", cadencia: "mensal", ultimo_periodo: "2026", fim_ultimo_periodo: "2026-12-31" } },
        { id: "aneel_social/aneel_scs", orgao: "ANEEL", titulo: "SCS", atualidade: { situacao: "ATRASADO", cadencia: "mensal", ultimo_periodo: "2025-06", fim_ultimo_periodo: "2025-06-30" } },
      ],
    };
    const linhas = linhasAtualidade(pub, new Set());
    expect(linhas).toHaveLength(FONTES_PRINCIPAIS.reduce((n, f) => n + f.conjuntos.length, 0));
    const samp = linhas.find((l) => l.tema === "Perdas")!;
    expect(samp).toMatchObject({ ultimo: "ago/2026", emCurso: false, cadencia: "mensal", situacao: "em dia", ficha: null });
    expect(linhas.find((l) => l.tema === "Qualidade")).toMatchObject({ ultimo: "2026", emCurso: true });
    expect(linhas.find((l) => l.rotulo.startsWith("Tarifa Social"))).toMatchObject({ ultimo: "jun/2025", atrasado: true, situacao: "atrasada" });
    // conjunto ausente da publicação: sem período, nunca uma data inventada
    expect(linhas.find((l) => l.tema === "Carga")).toMatchObject({ ultimo: null, situacao: null });
    // o código da home não usa captura como referência
    expect(ler("src/lib/energia/home.ts")).not.toMatch(/capturas|capturado_em/);
  });

  it("o resumo conta quantas fontes estão em dia, atrasadas, sem calendário e sem avaliação, e nomeia as atrasadas", () => {
    const pub: PublicacaoAtualidade = {
      referencia: { hoje: "2026-10-01" },
      conjuntos: [
        { id: "aneel_distribuicao/aneel_samp_balanco", orgao: "ANEEL", titulo: "SAMP", atualidade: { situacao: "EM DIA", cadencia: "mensal", ultimo_periodo: "2026-08", fim_ultimo_periodo: "2026-08-31" } },
        { id: "aneel_social/aneel_scs", orgao: "ANEEL", titulo: "SCS", atualidade: { situacao: "ATRASADO", cadencia: "mensal", ultimo_periodo: "2025-06", fim_ultimo_periodo: "2025-06-30" } },
        { id: "energia/carga_energia_di", orgao: "ONS", titulo: "Carga", atualidade: { situacao: "SEM SLA", cadencia: null, ultimo_periodo: "2026-09-28", fim_ultimo_periodo: "2026-09-28" } },
      ],
    };
    const linhas = linhasAtualidade(pub, new Set());
    const r = resumoAtualidade(linhas);
    expect(r.total).toBe(linhas.length);
    expect(r.emDia).toBe(1);
    expect(r.atrasadas.map((l) => l.rotulo)).toEqual([linhas.find((l) => l.atrasado)!.rotulo]);
    expect(r.semCalendario).toBe(1);
    // sem a publicação, nenhuma fonte é "em dia": todas ficam sem avaliação, nunca contadas como em dia
    const semPub = resumoAtualidade(linhasAtualidade(null, new Set()));
    expect(semPub).toMatchObject({ emDia: 0, semCalendario: 0, semAvaliacao: semPub.total });
    expect(semPub.atrasadas).toEqual([]);
  });

  it("toda fonte principal existe na publicação atual", () => {
    const g = JSON.parse(ler("public/energia/gold/publicacao.json")) as { disponivel: boolean; conjuntos: { id: string }[] };
    if (!g.disponivel) return;
    const ids = new Set(g.conjuntos.map((c) => c.id));
    for (const f of FONTES_PRINCIPAIS) for (const c of f.conjuntos) expect(ids.has(c.id), c.id).toBe(true);
  });
});

describe("auditoria do mapa: regressões", () => {
  it("hash com % malformado não derruba a página", () => {
    for (const f of ["src/components/energia/RedirecionaAncoraAntiga.tsx", "src/components/evidencia/ModoProfundidade.tsx"]) {
      const t = ler(f);
      expect(t, f).toMatch(/try \{\s*h = decodeURIComponent\(h\);\s*\} catch/);
    }
  });

  it("gráfico reserva a altura final já no HTML do servidor, e âncoras abaixo dele não se deslocam", () => {
    expect(ler("src/components/energia/GraficoLinhas.tsx")).toMatch(/width="100%"\s*height=\{h\}/);
  });

  it("a home explica nomes e réguas, ausência e o canal de correções", () => {
    const t = ler(HOME);
    for (const titulo of ["Nomes e réguas que se confundem", "Ausência nunca vira zero", "Correções e sugestões", "Cada data diz uma coisa", "Dados revisados"]) {
      expect(t, titulo).toContain(`titulo="${titulo}"`);
    }
    expect(t).toContain("O que o mapa não diz");
    expect(t).toContain('href="/observatorio/suggestions"');
  });
});

describe("índice completo: estado de cada destino e seletor de distribuidora", () => {
  it("o estado vem de navegacao.ts: sem página é preparação, sem números é integração, o resto é integrado", () => {
    expect(estadoDoDestino({ publicado: false, integrado: false })).toBe("preparacao");
    expect(estadoDoDestino({ publicado: true, integrado: false })).toBe("integracao");
    expect(estadoDoDestino({ publicado: true, integrado: true })).toBe("integrado");
    // a página escreve "Em integração" e "Em preparação" a partir do estado, nunca um texto fixo que o contradiga
    const t = ler(HOME);
    expect(t).toContain("estadoDoDestino(d)");
    expect(t).not.toMatch(/todas as páginas publicam/i);
  });

  it("cada seletor lista só quem tem dado no ano do módulo e diz o ano; as extintas ficam de fora", () => {
    const dist = [
      { cnpj: "1", sigla: "B-D", nome: "B", ufs: ["MG"], perdas: { ano: 2025 }, qualidade: { ano: 2025 } },
      { cnpj: "2", sigla: "A-D", nome: "A", ufs: ["SP"], perdas: { ano: 2025 }, qualidade: { ano: 2024 } },
      { cnpj: "3", sigla: "EXT", nome: "Extinta", ufs: ["RS"], perdas: { ano: 2005 }, qualidade: null },
    ];
    const e = escolhasDeDistribuidora(dist, 2025);
    expect(e.anoPerdas).toBe(2025);
    expect(e.anoQualidade).toBe(2025);
    expect(e.opcoesPerdas.map((o) => o.sigla)).toEqual(["A-D", "B-D"]);
    expect(e.opcoesQualidade.map((o) => o.sigla)).toEqual(["B-D"]);
    // sem ano de perdas (gold indisponível) nenhuma distribuidora entra: a lista nunca é preenchida por outro ano
    expect(escolhasDeDistribuidora(dist, null).opcoesPerdas).toEqual([]);
  });
});

describe("\"Usado nas páginas\" de cada conjunto", () => {
  it("lista toda página que lê a gold alimentada pelo conjunto", async () => {
    const { DATASETS_INTEGRADOS } = await import("@/lib/energia/datasets");
    const porGold: Record<string, string[]> = {
      pld: ["ccee-pld-horario"],
      hidrologia: ["ons-ear-subsistema", "ons-ena-subsistema"],
      carga: ["ons-carga-diaria"],
      geracao: ["ons-balanco-energia"],
      rede: ["ons-intercambio"],
      cmo: ["ons-cmo-semanal"],
    };
    const paginas: Record<string, string> = {
      "/setor-eletrico/visao-geral": "src/app/setor-eletrico/visao-geral/page.tsx",
      "/setor-eletrico/pld": "src/app/setor-eletrico/pld/page.tsx",
      "/setor-eletrico/agua-e-clima": "src/app/setor-eletrico/agua-e-clima/page.tsx",
      "/setor-eletrico/geracao": "src/app/setor-eletrico/geracao/page.tsx",
      "/setor-eletrico/carga": "src/app/setor-eletrico/carga/page.tsx",
      "/setor-eletrico/rede": "src/app/setor-eletrico/rede/page.tsx",
    };
    for (const [rota, arquivo] of Object.entries(paginas)) {
      const t = ler(arquivo);
      for (const m of Array.from(t.matchAll(/const (\w+) = gold\.(\w+)\(\)/g))) {
        const [, variavel, g] = m;
        const usada = (t.match(new RegExp(`\\b${variavel}\\b`, "g")) ?? []).length > 1;
        if (!usada || !porGold[g]) continue;
        for (const slug of porGold[g]) {
          const d = DATASETS_INTEGRADOS.find((x) => x.slug === slug)!;
          expect(d.paginas.map((p) => p.href.split("#")[0]), `${slug} em ${rota}`).toContain(rota);
        }
      }
    }
  });
});
