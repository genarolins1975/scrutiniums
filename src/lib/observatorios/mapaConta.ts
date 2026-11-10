/**
 * Dados do mapa da conta (/app/observatorios, Iniciativa M1 do parecer de UX de 23/10/2026), montados no servidor a cada
 * requisição a partir do que já existe: o inventário das páginas (inventario.ts), o registro (lista.ts) e o frescor de cada fonte (src/lib/frescor). Nada é escrito à mão aqui além da tabela de fontes por
 * coleção, que diz de onde vem a data "dados até" de cada linha do diretório.
 *
 * A linha da coleção não traz pergunta: o registro não tem a pergunta de cada coleção, e o índice da busca só tem perguntas de
 * páginas ou consultas dentro dela (que respondem a uma parte, não à coleção). A pergunta por coleção fica para o dono decidir o
 * texto (campo novo em lista.ts); até lá, nada é emprestado.
 */
import { inventario, totais, type ColecaoInventario, type PaginaInventario, type TotaisInventario } from "./inventario";
import { OBSERVATORIOS, type Observatorio, type ObservatorioId } from "./lista";
import { navegacaoDaColecao } from "./navegacaoColecao";
import { donoDaRota } from "./registro";
import { FRESCOR_DAS_COLECOES } from "@/lib/frescor/entradas";
import { dadosFrescor } from "@/lib/frescor/dominios";
import { rotuloReferencia, situacaoDominio, textoSituacao, type DominioFrescorId } from "@/lib/frescor/regras";
import type { Prontidao } from "@/components/observatorios/SeloProntidao";

/**
 * Fontes de frescor de cada coleção, na ordem: a primeira dá a data "dados até" da linha; todas aparecem no método.
 *
 * - As coleções cuja porta tem faixa de frescor própria repetem FRESCOR_DAS_COLECOES (o teste mapa-conta confere).
 * - As demais usam o domínio de origem (`dominio` da coleção ou a origem do painel no registro) só quando a referência desse
 *   domínio é a da própria coleção: o Crédito (meta.json cobre todas as vistas da aplicação), o Agronegócio (snapshot único), o
 *   Território e Clima no Fogo (a referência do domínio é a gold de queimadas).
 * - Lista vazia: a referência do domínio de origem é de outra base (os temas da Eficiência Estatal levam a data da Saúde das
 *   capitais). A linha sai sem "dados até": nunca uma data emprestada.
 * - Coleção fundida em 10/11/2026 (COLECOES_FUNDIDAS, lista.ts) com duas bases: a data continua sendo a da fonte da porta e
 *   ALCANCE_DA_DATA diz a que parte da coleção ela se refere e que parte fica com a referência na própria página. Gás e
 *   combustíveis não precisa: a referência do domínio "gas" já cobre os combustíveis (public/gas/gold/meta.json).
 */
export const FRESCOR_NO_MAPA: Record<string, readonly DominioFrescorId[]> = {
  renda: [],
  divida: FRESCOR_DAS_COLECOES["/divida-das-familias"],
  protecao: [],
  moradia: [],
  "custo-de-vida": FRESCOR_DAS_COLECOES["/custo-de-vida"],
  educacao: FRESCOR_DAS_COLECOES["/educacao-municipal"],
  // a referência do domínio Eficiência Estatal é a gold da Saúde das capitais (limiares.json)
  saude: ["eficiencia"],
  seguranca: [],
  justica: [],
  sintese: FRESCOR_DAS_COLECOES["/eficiencia-estatal"],
  federais: FRESCOR_DAS_COLECOES["/contas-publicas"],
  estaduais: FRESCOR_DAS_COLECOES["/contas-publicas-estaduais"],
  "divida-governos": ["credito"],
  "setor-eletrico": FRESCOR_DAS_COLECOES["/setor-eletrico"],
  gas: FRESCOR_DAS_COLECOES["/gas-natural"],
  saneamento: FRESCOR_DAS_COLECOES["/saneamento"],
  conectividade: FRESCOR_DAS_COLECOES["/conectividade"],
  credito: ["credito"],
  pagamentos: ["credito"],
  empresas: ["credito"],
  agro: FRESCOR_DAS_COLECOES["/agronegocio"],
  desmatamento: ["agro"],
  "cidades-clima": [],
  // a referência do domínio Território e Clima é a gold de queimadas (limiares.json: "focos de calor"); a publicação cobre as
  // duas golds, queimadas e desastres
  fogo: ["territorio"],
};

/**
 * Coleções em que a data "dados até" vale só para parte das páginas: `de` é a parte datada pela primeira fonte de
 * FRESCOR_NO_MAPA; `semData` é a parte de outra base, cuja referência o leitor encontra na própria página. O mapa escreve as
 * duas partes na linha da coleção e no método, para a data de uma fonte nunca passar pelo conteúdo da outra.
 */
export const ALCANCE_DA_DATA: Record<string, { de: string; semData: string }> = {
  educacao: { de: "Educação", semData: "Cultura" },
  conectividade: { de: "Conectividade", semData: "Mobilidade" },
  fogo: { de: "Queimadas", semData: "Desastres" },
};

export type LinhaColecao = {
  id: string;
  nome: string;
  href: string;
  /** Pergunta/resumo da página de entrada existente no catálogo; nunca inferido de outra página. */
  resumoEntrada?: string;
  /** A entrada mais as páginas que existem (publicadas ou parciais); as previstas não contam. */
  contagem: number;
  /** Páginas além da entrada, como o inventário as lista (previstas incluídas, sem link). */
  paginas: PaginaInventario[];
  /** "set/2026", "30/09/2026" ou "2024"; null sem fonte própria ou sem data publicada. */
  dadosAte: string | null;
  /** "Atualização atrasada há N dias" ou "Publicação retida em parte há N dias"; null quando em dia ou sem avaliação. */
  atraso: string | null;
  /** Selo quando a coleção não é "publicado". */
  prontidao: Exclude<Prontidao, "publicado"> | null;
  fontes: readonly DominioFrescorId[];
  /** Quando a data vale só para parte da coleção (ALCANCE_DA_DATA): a parte datada e a que tem a referência na página. */
  alcance: { de: string; semData: string } | null;
};

export type SecaoObservatorio = Pick<Observatorio, "id" | "nomeCurto" | "nome" | "pergunta" | "acento"> & { entrada: string | undefined; colecoes: LinhaColecao[] };

/**
 * Tamanho e selo de uma coleção, lidos do inventário. Regra única: o mapa da conta (diretorioDoMapa) e o retrato das páginas
 * abertas (retratoDoPortfolio) chamam esta função, para que a contagem vista antes de entrar seja a mesma vista depois.
 */
function estadoDaColecao(c: ColecaoInventario): { existentes: PaginaInventario[]; contagem: number; prontidao: LinhaColecao["prontidao"] } {
  const existentes = c.paginas.filter((p) => p.rota !== null);
  const estado = navegacaoDaColecao(c.id).estado;
  return {
    existentes,
    contagem: 1 + existentes.length,
    prontidao: estado === "piloto" ? "piloto" : existentes.length > 0 && existentes.every((p) => p.situacao === "parcial") ? "parcial" : null,
  };
}

/** O diretório do mapa: os seis observatórios na ordem do registro, cada coleção com o estado lido das bases. */
export function diretorioDoMapa(agora: Date = new Date()): { secoes: SecaoObservatorio[]; totais: TotaisInventario } {
  const inv = inventario();
  const secoes = OBSERVATORIOS.map((o): SecaoObservatorio => {
    const io = inv.find((x) => x.id === o.id)!;
    return {
      id: o.id,
      nome: o.nome,
      nomeCurto: o.nomeCurto,
      pergunta: o.pergunta,
      acento: o.acento,
      entrada: o.entrada,
      colecoes: io.colecoes.map((c): LinhaColecao => {
        const fontes = FRESCOR_NO_MAPA[c.id] ?? [];
        const [principal] = fontes.length ? dadosFrescor(fontes.slice(0, 1)) : [];
        const sit = principal ? situacaoDominio(principal, agora) : null;
        const { contagem, prontidao } = estadoDaColecao(c);
        return {
          id: c.id,
          nome: c.nome,
          href: c.href,
          resumoEntrada: c.resumoEntrada,
          contagem,
          paginas: c.paginas,
          dadosAte: principal ? rotuloReferencia(principal.referencia) : null,
          atraso: sit && (sit.estado === "atrasado" || sit.estado === "retida")
            ? textoSituacao(sit).replace("Publicação retida em parte", "Parte dos dados está com atualização atrasada")
            : null,
          prontidao,
          fontes,
          alcance: fontes.length ? (ALCANCE_DA_DATA[c.id] ?? null) : null,
        };
      }),
    };
  });
  return { secoes, totais: totais(inv) };
}

/**
 * Ressalva de prontidão de uma coleção. `paginas: null` vale para a coleção inteira (o selo do mapa: piloto, ou todas as páginas
 * com cobertura parcial); com número, quantas páginas da coleção estão naquele estado. As "em preparação" constam do catálogo e
 * ainda não têm página: ficam fora da contagem da coleção.
 */
export type RessalvaColecao = { valor: Exclude<Prontidao, "publicado">; paginas: number | null };

export type RetratoColecao = {
  id: string;
  nome: string;
  href: string;
  /** A mesma contagem da linha do mapa da conta: a entrada mais as páginas que existem. */
  paginas: number;
  /** Vazia quando a coleção é "publicado" em todas as páginas e nada consta em preparação. */
  ressalvas: RessalvaColecao[];
};

export type RetratoObservatorio = {
  id: ObservatorioId;
  colecoes: RetratoColecao[];
  /** Páginas no ar cujo dono no registro é este observatório, sem as cópias integrais (o mesmo recorte do inventário). */
  proprias: number;
  /** Páginas no ar de outro observatório que as coleções deste também apresentam (ATALHOS do registro). */
  deOutros: number;
  /** Páginas no ar com cobertura parcial e páginas do catálogo ainda sem endereço, por rota única (totais do inventário). */
  parciais: number;
  previstas: number;
};

/**
 * Retrato do portfólio para as páginas abertas (home e /perguntas/[porta]; recomendação 6 do parecer estrutural, "portfólio
 * honesto"): quantas coleções e páginas cada observatório tem e em que estado cada coleção está. Sai do mesmo inventário e da
 * mesma regra por coleção do mapa da conta; não lê as bases de frescor, que as páginas abertas não mostram por coleção.
 * `proprias + deOutros` é a soma das contagens das coleções quando nenhuma página se repete entre elas.
 */
/**
 * Páginas de uma coleção para o retrato: os endereços distintos que a navegação da coleção oferece (linha 1, linha 2 e os
 * atalhos de dados, método e glossário), sem âncoras e sem destino em preparação. É a mesma unidade em toda coleção: o
 * inventário conta painéis registrados, e um tema da Eficiência Estatal é um painel com várias páginas, o que fazia Renda e
 * trabalho aparecer com 2 ao lado das 23 do Setor Elétrico (achado 7 da auditoria de qualidade de 10/11/2026).
 */
export function paginasNaNavegacao(colecao: string): string[] {
  const nav = navegacaoDaColecao(colecao);
  const semAncora = (h: string) => h.split(/[?#]/)[0];
  const rotas = new Set<string>();
  for (const i of nav.itens) {
    for (const p of i.subpaginas ?? [i]) if (p.publicado && p.href) rotas.add(semAncora(p.href));
    if (i.subpaginas && i.publicado && i.href) rotas.add(semAncora(i.href));
  }
  for (const h of Object.values(nav.atalhos ?? {})) if (typeof h === "string" && h) rotas.add(semAncora(h));
  return [...rotas];
}

export function retratoDoPortfolio(): RetratoObservatorio[] {
  return inventario().map((o): RetratoObservatorio => {
    const porColecao = new Map(o.colecoes.map((c) => [c.id, paginasNaNavegacao(c.id)]));
    const colecoes = o.colecoes.map((c): RetratoColecao => {
      const { prontidao } = estadoDaColecao(c);
      const contagem = porColecao.get(c.id)!.length;
      const parciais = c.paginas.filter((p) => p.situacao === "parcial").length;
      const previstas = c.paginas.filter((p) => p.situacao === "previsto").length;
      const ressalvas: RessalvaColecao[] = [];
      if (prontidao) ressalvas.push({ valor: prontidao, paginas: null });
      if (prontidao !== "parcial" && parciais > 0) ressalvas.push({ valor: "parcial", paginas: parciais });
      if (previstas > 0) ressalvas.push({ valor: "preparacao", paginas: previstas });
      return { id: c.id, nome: c.nome, href: c.href, paginas: contagem, ressalvas };
    });
    const rotas = new Set([...porColecao.values()].flat());
    const proprias = [...rotas].filter((r) => donoDaRota(r)?.observatorio === o.id).length;
    const t = totais([o]);
    return { id: o.id, colecoes, proprias, deOutros: rotas.size - proprias, parciais: t.parciais, previstas: t.previstas };
  });
}

export type { ObservatorioId };
