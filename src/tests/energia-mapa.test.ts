import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buscar, normalizarBusca } from "@/lib/energia/busca";
import { CONCEITOS } from "@/lib/energia/conteudo/conceitos";
import { DATASETS_INTEGRADOS } from "@/lib/energia/datasets";
import { indiceBusca, linhasAtualidade, periodoLegivel, type PublicacaoAtualidade } from "@/lib/energia/home";
import {
  ANCORAS_VISAO_GERAL,
  CARTOES,
  FONTES_PRINCIPAIS,
  LIGACOES,
  NOS_MAPA,
  PERGUNTAS_COTIDIANAS,
  SECOES_HOME,
  TIPOS_LIGACAO,
  TRANSVERSAIS,
  TRILHAS,
} from "@/lib/energia/mapa";
import { DESTINOS_NAVEGACAO, MODULOS_ENERGIA } from "@/lib/energia/navegacao";

/**
 * Página inicial como mapa didático (seção 6 e painéis P001 e P003): as sete seções,
 * todo cartão, pergunta e trilha leva a uma rota e a uma âncora que existem, nenhum
 * destino em integração promete painel, o mapa conceitual não desenha cadeia causal
 * falsa e a atualidade mostra o período do dado, nunca a data de captura.
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
  const extras = Array.from(t.matchAll(/from "@\/components\/(energia|evidencia)\/([A-Za-z]+)"/g))
    .map((m) => `src/components/${m[1]}/${m[2]}.tsx`)
    .filter((f) => existsSync(join(raiz, f)));
  return [t, ...extras.map(ler)].join("\n");
}

function confereDestino(href: string) {
  const arquivo = paginaDaRota(href);
  expect(arquivo, `${href}: rota sem página`).not.toBeNull();
  const ancora = href.includes("#") ? href.split("#")[1] : null;
  if (ancora) expect(codigoDaPagina(arquivo!), `${href}: âncora ausente`).toMatch(new RegExp(`id="${ancora}"|id=\\{"${ancora}"\\}|id: "${ancora}"`));
}

describe("página inicial: mapa didático (P001)", () => {
  it("tem as sete seções A a G e mantém a Visão geral numa página própria", () => {
    const t = ler(HOME);
    expect(SECOES_HOME.map((s) => s.letra).join("")).toBe("ABCDEFG");
    for (const s of SECOES_HOME) expect(t, s.id).toContain(`id="${s.id}"`);
    expect(t).toContain("Entenda a energia que move o Brasil");
    expect(t).toContain("Explorar por pergunta");
    expect(t).toContain("Ver a situação do sistema");
    expect(t).toContain("<BuscaObservatorio");
    expect(t).toContain('canonical: "/setor-eletrico"');
    expect(ler("src/app/setor-eletrico/visao-geral/page.tsx")).toContain('canonical: "/setor-eletrico/visao-geral"');
    expect(MODULOS_ENERGIA[0]).toMatchObject({ slug: "mapa", href: "/setor-eletrico" });
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
    // alternativa textual equivalente e versão de celular
    const t = ler(HOME);
    expect(t).toContain("O mesmo mapa em texto");
    expect(t).toMatch(/className="md:hidden"[\s\S]*<MapaEmTexto \/>/);
  });

  it("links antigos com âncora da visão geral seguem para a nova página, e a home não reusa essas âncoras", () => {
    const visao = ler("src/app/setor-eletrico/visao-geral/page.tsx");
    for (const a of ANCORAS_VISAO_GERAL) expect(visao, a).toMatch(new RegExp(`id="${a}"|id: "${a}"|id=\\{\`${a}`));
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
