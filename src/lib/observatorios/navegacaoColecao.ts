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
      grupo(rotuloGrupo("operacao"), doGrupo("operacao")),
      grupo(rotuloGrupo("precos-e-mercado"), doGrupo("precos-e-mercado")),
      // a conta de luz já é o segundo item: o grupo começa nas perdas
      grupo(rotuloGrupo("consumidor-e-territorio"), doGrupo("consumidor-e-territorio", ["conta-de-luz"])),
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
    estado: "Piloto",
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
  return {
    itens: [
      pagina("Início", ROTA_EDUCACAO),
      // o tema da Eficiência Estatal se chama só "Educação" no registro; ao lado dos municípios, o nome diz o recorte
      ...paineisDaColecao("servicos-publicos", "educacao", [ROTA_EDUCACAO]).map((p) => (p.href === ROTA_CAPITAIS ? { ...p, rotulo: TITULO_CAPITAIS } : p)),
    ],
    atalhos: { metodo: `${ROTA_CAPITAIS}/metodos` },
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
};

/** Navegação de uma coleção do registro (id de lista.ts). */
export function navegacaoDaColecao(id: string): NavegacaoDaColecao {
  const o = OBSERVATORIOS.find((x) => x.colecoes.some((c) => c.id === id));
  const c = o?.colecoes.find((x) => x.id === id);
  if (!o || !c) throw new Error(`coleção desconhecida: ${id}`);
  const m = MONTAGENS[id]?.() ?? doRegistro(o.id, id);
  return { id, nome: c.nome, tipo: "colecao", acento: c.dominio ? dominio(c.dominio).acento : o.acento, ...m };
}

/** Navegação de um observatório que mantém painéis próprios fora de uma coleção (hoje só o Território e Clima). */
export function navegacaoDoObservatorio(id: "territorio-e-clima"): NavegacaoDaColecao {
  const o = observatorioPorId(id);
  return { id, nome: o.nomeCurto, tipo: "observatorio", acento: o.acento, ...territorio() };
}

/** Os ids das 28 coleções, na ordem do registro. */
export function idsDasColecoes(): string[] {
  return OBSERVATORIOS.flatMap((o) => o.colecoes.map((c) => c.id));
}
