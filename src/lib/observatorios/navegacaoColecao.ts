/**
 * Navegação de cada uma das 28 coleções (Iniciativa 2 do parecer de UX de 21/10/2026): uma só forma para toda coleção,
 * lida dos catálogos que já existem, sem lista paralela escrita à mão. NavegacaoColecao desenha o que esta função devolve.
 *
 * Regras (conferidas por src/tests/navegacao-colecao.test.ts):
 *  1. O primeiro item é a entrada da coleção ("Início").
 *  2. O segundo é a consulta pessoal da coleção, quando existe e está publicada (Conta de luz, Meu município, Gás de
 *     cozinha, Consulta por estado, Quanto meu banco cobra?, Previdência e INSS). Consulta da LEVA_2 ainda sem aprovação
 *     do dono não aparece (src/lib/rotasPublicas.ts).
 *  3. Até oito destinos à vista; o resto vai para "Mais" (MAX_A_VISTA, navegacaoPura.ts).
 *  4. Destino sem página leva `publicado: false` e vira texto "em preparação", nunca link.
 *  5. Grupos (eixos do Saneamento, grupos do Setor Elétrico e do Gás, capítulos do Agronegócio) são itens que levam à primeira
 *     página do grupo e expõem as páginas dele na segunda linha. Não há menu suspenso por grupo.
 *  6. Dados, Método e Glossário ficam fora da lista, como atalhos à direita da linha 1.
 *
 * Só servidor: lê os catálogos de todos os domínios (como registro.ts). O navegador recebe o resultado (navegacaoPura.ts).
 */
import { observatorio as observatorioPorId, OBSERVATORIOS } from "./registro";
import { colecoesDe } from "./colecoes";
import { dominio } from "@/lib/dominios";
import { leva2Aprovada } from "@/lib/rotasPublicas";
import { tx } from "@/lib/energia/idioma";
import { DESTINOS_NAVEGACAO, GRUPOS_NAVEGACAO, type IdGrupo } from "@/lib/energia/navegacao";
import { EIXOS, FERRAMENTAS as FERRAMENTAS_SANEAMENTO, ROTA as ROTA_SANEAMENTO, rotaCapitulo } from "@/lib/saneamento/capitulos";
import { GRUPOS_GAS, PAGINAS_GAS } from "@/lib/gas/navegacao";
import { PAGINAS_COMBUSTIVEIS, ROTA_COMBUSTIVEIS, ROTA_CONSULTA_TANQUE } from "@/lib/combustiveis/paginas";
import { ROTA_CONSULTA_CIDADE, ROTA_INFLACAO, paginaInflacao } from "@/lib/inflacao/paginas";
import { ROTA_CAPITAIS, ROTA_EDUCACAO, TITULO_CAPITAIS } from "@/lib/educacao/paginas";
import { CAPITULOS as CAPITULOS_CONTAS, PAINEL_AREAS, PAINEL_PREVIDENCIA } from "@/lib/contas-publicas/catalogo";
import { CADEIAS, CAPITULOS_AGRO, PERGUNTAS_AGRO, ROTA_AGRO } from "@/lib/agro/modelo";
import { PAGINAS_CREDITO, PAINEL_JUROS } from "@/lib/credito/navegacao";
import { TEMAS_EFICIENCIA, hrefDoTema, type TemaEficiencia } from "@/lib/eficiencia/temas";
import type { ItemNav, NavegacaoDaColecao, PaginaNav } from "./navegacaoPura";

export type { ItemNav, NavegacaoDaColecao, PaginaNav } from "./navegacaoPura";

const pagina = (rotulo: string, href: string, publicado = true): PaginaNav => ({ rotulo, href, publicado });

/** Item de grupo: leva à primeira página publicada do grupo e expõe todas na segunda linha. */
function grupo(rotulo: string, subpaginas: PaginaNav[]): ItemNav {
  const primeira = subpaginas.find((s) => s.publicado);
  return { rotulo, href: primeira?.href ?? subpaginas[0]?.href ?? "", publicado: Boolean(primeira), subpaginas };
}

type Montagem = Omit<NavegacaoDaColecao, "id" | "nome" | "tipo" | "acento">;

// ------------------------------------------------------------ Setor Elétrico

function setorEletrico(): Montagem {
  const doGrupo = (id: IdGrupo, fora: string[] = []) =>
    DESTINOS_NAVEGACAO.filter((d) => d.grupo === id && !fora.includes(d.slug)).map((d) => pagina(d.rotulo, d.href, d.publicado));
  const rotuloGrupo = (id: IdGrupo) => GRUPOS_NAVEGACAO.find((g) => g.id === id)?.rotulo ?? id;
  const conta = DESTINOS_NAVEGACAO.find((d) => d.slug === "conta-de-luz");
  return {
    consulta: conta?.href,
    itens: [
      pagina(tx("Início", "Home"), "/setor-eletrico"),
      ...(conta ? [pagina(conta.rotulo, conta.href, conta.publicado)] : []),
      // "Comece aqui" sem a própria entrada: a visão geral e a minha região
      grupo(tx("Visão geral", "Overview"), doGrupo("comece-aqui", ["mapa"])),
      // rótulos curtos dos grupos longos, para os oito itens e os atalhos caberem numa linha a 1440 px; o nome inteiro do grupo
      // continua no índice da entrada
      grupo(tx("Operação", "Operation"), doGrupo("operacao")),
      grupo(rotuloGrupo("precos-e-mercado"), doGrupo("precos-e-mercado")),
      // a conta de luz já é o segundo item: o grupo começa nas perdas
      grupo(tx("Consumidor", "Consumers"), doGrupo("consumidor-e-territorio", ["conta-de-luz"])),
      grupo(rotuloGrupo("empresas-e-futuro"), doGrupo("empresas-e-futuro")),
      // dados e metodologia viram atalhos; ficam a regulação e o Aprenda
      grupo(tx("Regras e conceitos", "Rules and concepts"), doGrupo("conhecimento-e-evidencia", ["dados", "metodologia"])),
    ],
    // os conceitos ficam no Aprenda, dentro do grupo: o Setor Elétrico não tem glossário à parte
    atalhos: { dados: "/setor-eletrico/dados", metodo: "/setor-eletrico/metodologia" },
  };
}

// ------------------------------------------------------------- Gás Natural

function gas(): Montagem {
  const cozinha = PAGINAS_GAS.find((p) => p.slug === "gas-de-cozinha");
  const doGrupo = (id: string) => PAGINAS_GAS.filter((p) => p.grupo === id && p.slug !== "gas-de-cozinha").map((p) => pagina(p.rotulo, p.href));
  return {
    consulta: cozinha?.href,
    itens: [
      pagina("Início", "/gas-natural"),
      ...(cozinha ? [pagina(cozinha.rotulo, cozinha.href)] : []),
      ...GRUPOS_GAS.filter((g) => g.id !== "dados").map((g) => grupo(g.rotulo, doGrupo(g.id))),
    ],
    atalhos: { dados: "/gas-natural/dados", metodo: "/gas-natural/metodologia" },
  };
}

// ------------------------------------------------------------ Combustíveis

function combustiveis(): Montagem {
  const consulta = leva2Aprovada("quanto-custa-encher-o-tanque") ? PAGINAS_COMBUSTIVEIS.find((p) => p.href === ROTA_CONSULTA_TANQUE) : undefined;
  return {
    consulta: consulta?.href,
    itens: [pagina("Início", ROTA_COMBUSTIVEIS), ...(consulta ? [pagina(consulta.rotulo, consulta.href)] : [])],
    atalhos: {},
  };
}

// --------------------------------------------------------------- Saneamento

function saneamento(): Montagem {
  const ferramenta = (slug: string) => FERRAMENTAS_SANEAMENTO.find((f) => f.slug === slug);
  const municipio = ferramenta("municipio");
  const eixos = EIXOS.map((e) =>
    grupo(
      e.curto,
      e.capitulos.flatMap((c) => [
        pagina(c.rotulo, rotaCapitulo(c), c.situacao !== "em_preparacao"),
        ...(c.subpaineis ?? []).filter((s) => s.naNavegacao).map((s) => pagina(s.rotulo, `${rotaCapitulo(c)}/${s.slug}`, s.situacao !== "em_preparacao")),
      ]),
    ),
  );
  const comparar = ferramenta("comparar");
  const mundo = ferramenta("internacional");
  return {
    consulta: municipio ? `${ROTA_SANEAMENTO}/municipio` : undefined,
    itens: [
      pagina("Início", ROTA_SANEAMENTO),
      ...(municipio ? [pagina(municipio.rotulo, `${ROTA_SANEAMENTO}/municipio`)] : []),
      ...eixos,
      ...(comparar ? [pagina(comparar.rotulo, `${ROTA_SANEAMENTO}/comparar`)] : []),
      ...(mundo ? [pagina(mundo.rotulo, `${ROTA_SANEAMENTO}/internacional`)] : []),
      // o saneamento nas 26 capitais (Eficiência Estatal), com as abas dele na segunda linha
      temaComoGrupo(TEMAS_EFICIENCIA.saneamento, "Nas capitais"),
    ],
    atalhos: { metodo: `${ROTA_SANEAMENTO}/metodologia` },
  };
}

// ------------------------------------------------------------ Agronegócio

function agro(): Montagem {
  const r = (slug: string) => (slug ? `${ROTA_AGRO}/${slug}` : ROTA_AGRO);
  return {
    itens: [
      pagina("Início", ROTA_AGRO),
      grupo("O setor", PERGUNTAS_AGRO.map((p) => pagina(p.curto, r(p.id)))),
      pagina("Panorama", r("panorama")),
      pagina("Atlas", r("atlas")),
      pagina("Comparar", r("comparar")),
      grupo("Capítulos", CAPITULOS_AGRO.map((c) => pagina(c.nome, r(c.id)))),
      grupo("Cadeias", CADEIAS.map((c) => pagina(c.nome, r(`cadeias/${c.id}`)))),
      pagina("Aprenda", r("aprenda")),
    ],
    atalhos: { metodo: r("metodologia"), glossario: r("glossario") },
  };
}

// ------------------------------------------------------------------ Crédito

function credito(): Montagem {
  const consulta = PAGINAS_CREDITO.find((p) => p.slug === "quanto-meu-banco-cobra");
  const simulador = PAGINAS_CREDITO.find((p) => p.slug === "simulador-da-parcela");
  const metodo = PAGINAS_CREDITO.find((p) => p.slug === "metodologia");
  return {
    consulta: consulta?.href,
    itens: [
      pagina("Início", "/observatorio-do-credito"),
      ...(consulta ? [pagina(consulta.rotulo, consulta.href)] : []),
      ...(simulador ? [pagina(simulador.rotulo, simulador.href)] : []),
      pagina("Juros por instituição", PAINEL_JUROS),
      pagina("Painel completo", "/observatorio"),
    ],
    atalhos: { metodo: metodo?.href, glossario: "/glossario" },
  };
}

// ----------------------------------------------------------- Contas Federais

function contasFederais(): Montagem {
  return {
    // a consulta pessoal das Contas Federais: quanto o INSS paga na minha cidade (painel Previdência e INSS)
    consulta: PAINEL_PREVIDENCIA.href,
    itens: [
      pagina("Início", "/contas-publicas"),
      pagina(PAINEL_PREVIDENCIA.titulo, PAINEL_PREVIDENCIA.href),
      pagina(PAINEL_AREAS.titulo, PAINEL_AREAS.href),
      // capítulo em preparação não tem página (Onda 3): aparece como texto, nunca como link
      grupo("Capítulos", CAPITULOS_CONTAS.map((c) => pagina(c.titulo, `/contas-publicas/${c.id}`, c.situacao === "com-dados"))),
    ],
    atalhos: { dados: "/contas-publicas/dados", metodo: "/contas-publicas/metodologia", glossario: "/contas-publicas/glossario" },
  };
}

// ---------------------------------------------------------- Contas Estaduais

function contasEstaduais(): Montagem {
  const r = "/contas-publicas-estaduais";
  return {
    // a ficha do meu estado é a consulta pessoal; a página é uma só, com seções
    consulta: `${r}#ficha`,
    itens: [
      pagina("Início", r),
      pagina("Ficha do meu estado", `${r}#ficha`),
      pagina("Panorama dos estados", `${r}#comparacao`),
      pagina("Seis fichas de prova", `${r}#provas`),
      pagina("Cobertura", `${r}#cobertura`),
      pagina("Os 48 indicadores", `${r}#catalogo`),
    ],
    atalhos: { metodo: `${r}#metodo` },
    // etapa piloto (catálogo, cobertura e seis fichas de prova): dito na navegação, como antes no cabeçalho próprio
    estado: "piloto",
  };
}

// ------------------------------------------------------------ Custo de vida

function custoDeVida(): Montagem {
  const consulta = leva2Aprovada("quanto-subiu-o-custo-de-vida") ? paginaInflacao("na-minha-cidade") : undefined;
  return {
    consulta: consulta ? ROTA_CONSULTA_CIDADE : undefined,
    itens: [
      pagina("Início", ROTA_INFLACAO),
      ...(consulta ? [pagina(consulta.rotulo, ROTA_CONSULTA_CIDADE)] : []),
      ...paineisDaColecao("familias", "custo-de-vida", [ROTA_INFLACAO, ROTA_CONSULTA_CIDADE]),
    ],
    atalhos: {},
  };
}

// ----------------------------------------------------------------- Educação

function educacao(): Montagem {
  const capitais = TEMAS_EFICIENCIA.educacao;
  return {
    itens: [
      pagina("Início", ROTA_EDUCACAO),
      // o painel das capitais (Eficiência Estatal), com as abas dele na segunda linha
      temaComoGrupo(capitais, TITULO_CAPITAIS, [`${ROTA_CAPITAIS}/metodos`]),
      ...paineisDaColecao("servicos-publicos", "educacao", [ROTA_EDUCACAO, ROTA_CAPITAIS]),
    ],
    atalhos: { metodo: `${ROTA_CAPITAIS}/metodos` },
    levar: capitais.levar ? [...capitais.levar] : undefined,
  };
}

// --------------------------------------------- Dívida e crédito das famílias

function dividaDasFamilias(): Montagem {
  const base = doRegistro("familias", "divida");
  const consulta = PAGINAS_CREDITO.find((p) => p.slug === "quanto-meu-banco-cobra");
  if (!consulta) return base;
  // a consulta do Crédito ("Quanto meu banco cobra?") é a pergunta pessoal da coleção: vem logo depois da entrada
  const [inicio, ...resto] = base.itens;
  const daConsulta = resto.find((i) => i.href === consulta.href) ?? pagina(consulta.rotulo, consulta.href);
  return { ...base, consulta: consulta.href, itens: [inicio, daConsulta, ...resto.filter((i) => i !== daConsulta)] };
}

// -------------------------------------------------------- Território e Clima

/** Os painéis que o próprio Observatório do Território e Clima mantém (public/territorio), com a entrada e o método dele. */
function territorio(): Montagem {
  return {
    itens: [
      pagina("Início", "/territorio"),
      pagina("Queimadas", "/territorio/queimadas"),
      pagina("Desastres", "/territorio/desastres"),
      pagina("Emissões", "/territorio/emissoes"),
    ],
    atalhos: { metodo: "/territorio/metodologia" },
  };
}

// ------------------------------------------------------- Eficiência Estatal

/** Páginas de um tema da Eficiência Estatal (src/lib/eficiencia/temas.ts): a entrada e as abas; as ações à parte. */
const paginasDoTema = (t: TemaEficiencia, entrada = "Panorama") =>
  t.abas.map(([c, rotulo]) => pagina(c === "" ? entrada : rotulo, hrefDoTema(t, c)));
const acaoDoTema = (t: TemaEficiencia, slug: string) => {
  const a = t.acoes.find(([c]) => c.replace(/^\//, "") === slug);
  return a ? hrefDoTema(t, a[0]) : undefined;
};
/** "Comparar", quando o tema tem: é uma página do tema, não atalho. */
const compararDoTema = (t: TemaEficiencia) => t.acoes.filter(([c]) => c.replace(/^\//, "") === "comparar").map(([c, rotulo]) => pagina(rotulo, hrefDoTema(t, c)));

/** Coleção feita de um tema da Eficiência: Início é a entrada do tema; as abas e o comparar vêm em seguida. */
function doTema(t: TemaEficiencia, extras: PaginaNav[] = []): Montagem {
  const [, ...abas] = paginasDoTema(t);
  const vistos = new Set([t.rota, ...abas.map((a) => a.href)]);
  return {
    itens: [pagina("Início", t.rota), ...abas, ...compararDoTema(t), ...extras.filter((e) => !vistos.has(e.href))],
    atalhos: { dados: acaoDoTema(t, "dados"), metodo: acaoDoTema(t, "metodos") },
    levar: t.levar ? [...t.levar] : undefined,
  };
}

/**
 * Um tema como grupo de outra coleção: leva à entrada dele e expõe na segunda linha as abas e todas as ações (comparar, dados,
 * métodos), porque os atalhos da linha 1 são os da coleção dona, não os do tema. `fora`: ação que já é atalho da coleção dona.
 */
const temaComoGrupo = (t: TemaEficiencia, rotulo = t.nome, fora: (string | undefined)[] = []) =>
  grupo(rotulo, [...paginasDoTema(t), ...t.acoes.map(([c, r]) => pagina(r, hrefDoTema(t, c))).filter((p) => !fora.includes(p.href))]);

const levarDe = (...ts: TemaEficiencia[]) => {
  const l = Array.from(new Set(ts.flatMap((t) => t.levar ?? [])));
  return l.length ? l : undefined;
};

function eficiencia(id: string): Montagem | null {
  const T = TEMAS_EFICIENCIA;
  const extras = (obs: Parameters<typeof colecoesDe>[0], col: string, fora: string[]) => paineisDaColecao(obs, col, fora);
  switch (id) {
    case "renda":
      return doTema(T.trabalho, extras("familias", "renda", [T.trabalho.rota]));
    case "protecao": {
      const base = doTema(T.assistencia);
      const fora = [T.assistencia.rota, T.alimentacao.rota, ...base.itens.map((i) => i.href)];
      return { ...base, itens: [...base.itens, temaComoGrupo(T.alimentacao), ...extras("familias", "protecao", fora)], levar: levarDe(T.assistencia, T.alimentacao) };
    }
    case "moradia":
      return doTema(T.habitacao, extras("familias", "moradia", [T.habitacao.rota]));
    case "saude":
      return doTema(T.saude, extras("servicos-publicos", "saude", [T.saude.rota]));
    case "seguranca":
      return doTema(T.seguranca, extras("servicos-publicos", "seguranca", [T.seguranca.rota]));
    case "cultura":
      return doTema(T.cultura);
    case "mobilidade":
      return doTema(T.mobilidade);
    case "justica": {
      const base = doTema(T.judiciario);
      return { ...base, itens: [...base.itens, temaComoGrupo(T.justica)], levar: undefined };
    }
    case "cidades-clima":
      return doTema(T.ambiente, extras("territorio-e-clima", "cidades-clima", [T.ambiente.rota]));
    default:
      return null;
  }
}

// ---------------------------------------------------------- demais coleções

/** Painéis de uma coleção no registro (os próprios e os atalhos para os de outro observatório), sem os já listados. */
function paineisDaColecao(obs: Parameters<typeof colecoesDe>[0], id: string, fora: string[]): PaginaNav[] {
  const c = colecoesDe(obs).find((x) => x.id === id);
  const vistos = new Set(fora);
  return (c?.paineis ?? []).flatMap((p) => {
    if (vistos.has(p.href)) return [];
    vistos.add(p.href);
    return [pagina(p.titulo, p.href)];
  });
}

/** Coleção sem catálogo próprio: a entrada e os painéis do registro, com o método e o glossário declarados em lista.ts. */
function doRegistro(obs: Parameters<typeof colecoesDe>[0], id: string): Montagem {
  const c = observatorioPorId(obs).colecoes.find((x) => x.id === id);
  if (!c) throw new Error(`coleção desconhecida: ${obs}/${id}`);
  return { itens: [pagina("Início", c.href), ...paineisDaColecao(obs, id, [c.href, ...(c.metodo ? [c.metodo] : [])])], atalhos: { metodo: c.metodo, glossario: c.glossario } };
}

function conectividade(): Montagem {
  const base = doRegistro("energia-e-infraestrutura", "conectividade");
  const tema = TEMAS_EFICIENCIA.energia;
  return { ...base, itens: [...base.itens.filter((i) => i.href !== tema.rota), temaComoGrupo(tema, "Energia e conectividade nas capitais")] };
}

const MONTAGENS: Record<string, () => Montagem> = {
  "setor-eletrico": setorEletrico,
  gas,
  combustiveis,
  saneamento,
  agro,
  credito,
  federais: contasFederais,
  estaduais: contasEstaduais,
  "custo-de-vida": custoDeVida,
  educacao,
  divida: dividaDasFamilias,
  conectividade,
};

/** Navegação de uma coleção do registro (id de lista.ts). */
export function navegacaoDaColecao(id: string): NavegacaoDaColecao {
  const o = OBSERVATORIOS.find((x) => x.colecoes.some((c) => c.id === id));
  const c = o?.colecoes.find((x) => x.id === id);
  if (!o || !c) throw new Error(`coleção desconhecida: ${id}`);
  const m = MONTAGENS[id]?.() ?? eficiencia(id) ?? doRegistro(o.id, id);
  return { id, nome: c.nome, tipo: "colecao", acento: c.dominio ? dominio(c.dominio).acento : o.acento, ...m };
}

/** Navegação de um observatório que mantém painéis próprios fora de uma coleção (hoje só o Território e Clima). */
export function navegacaoDoObservatorio(id: "territorio-e-clima"): NavegacaoDaColecao {
  const o = observatorioPorId(id);
  return { id, nome: o.nomeCurto, tipo: "observatorio", acento: o.acento, ...territorio() };
}

/**
 * Navegação da conta (/app: a escolha do painel, a conta e a administração), no lugar do antigo cabeçalho de foco. Não é
 * coleção: não tem "Início" nem consulta pessoal; o "Sair" vem como ação, porque é um formulário, não um link.
 */
export function navegacaoDaConta(admin: boolean): NavegacaoDaColecao {
  return {
    id: "conta",
    nome: "Conta",
    tipo: "conta",
    acento: "bronze",
    itens: [pagina("Encontre o painel", "/app/observatorios"), pagina("Conta", "/app/conta"), ...(admin ? [pagina("Admin", "/app/admin")] : [])],
    atalhos: {},
  };
}

/** Os ids das 28 coleções, na ordem do registro. */
export function idsDasColecoes(): string[] {
  return OBSERVATORIOS.flatMap((o) => o.colecoes.map((c) => c.id));
}
