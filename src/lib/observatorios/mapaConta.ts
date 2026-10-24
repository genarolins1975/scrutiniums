/**
 * Dados do mapa da conta (/app/observatorios, Iniciativa M1 do parecer de UX de 23/10/2026), montados no servidor a cada
 * requisição a partir do que já existe: o inventário das páginas (inventario.ts), o registro (lista.ts) e o frescor de cada fonte (src/lib/frescor). Nada é escrito à mão aqui além da tabela de fontes por
 * coleção, que diz de onde vem a data "dados até" de cada linha do diretório.
 *
 * A linha da coleção não traz pergunta: o registro não tem a pergunta de cada coleção, e o índice da busca só tem perguntas de
 * páginas ou consultas dentro dela (que respondem a uma parte, não à coleção). A pergunta por coleção fica para o dono decidir o
 * texto (campo novo em lista.ts); até lá, nada é emprestado.
 */
import { inventario, totais, type PaginaInventario, type TotaisInventario } from "./inventario";
import { OBSERVATORIOS, type Observatorio, type ObservatorioId } from "./lista";
import { navegacaoDaColecao } from "./navegacaoColecao";
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
 *   capitais; os Desastres, a das queimadas). A linha sai sem "dados até": nunca uma data emprestada.
 */
export const FRESCOR_NO_MAPA: Record<string, readonly DominioFrescorId[]> = {
  renda: [],
  divida: ["credito"],
  protecao: [],
  moradia: [],
  "custo-de-vida": FRESCOR_DAS_COLECOES["/custo-de-vida"],
  educacao: FRESCOR_DAS_COLECOES["/educacao-municipal"],
  // a referência do domínio Eficiência Estatal é a gold da Saúde das capitais (limiares.json)
  saude: ["eficiencia"],
  seguranca: [],
  justica: [],
  cultura: [],
  sintese: FRESCOR_DAS_COLECOES["/eficiencia-estatal"],
  federais: FRESCOR_DAS_COLECOES["/contas-publicas"],
  estaduais: FRESCOR_DAS_COLECOES["/contas-publicas-estaduais"],
  "divida-governos": ["credito"],
  "setor-eletrico": FRESCOR_DAS_COLECOES["/setor-eletrico"],
  gas: FRESCOR_DAS_COLECOES["/gas-natural"],
  combustiveis: FRESCOR_DAS_COLECOES["/combustiveis"],
  saneamento: FRESCOR_DAS_COLECOES["/saneamento"],
  mobilidade: [],
  conectividade: FRESCOR_DAS_COLECOES["/conectividade"],
  credito: ["credito"],
  pagamentos: ["credito"],
  empresas: ["credito"],
  agro: FRESCOR_DAS_COLECOES["/agronegocio"],
  desmatamento: ["agro"],
  "cidades-clima": [],
  fogo: ["territorio"],
  desastres: [],
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
};

export type SecaoObservatorio = Pick<Observatorio, "id" | "nomeCurto" | "nome" | "pergunta" | "acento"> & { entrada: string | undefined; colecoes: LinhaColecao[] };

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
        const existentes = c.paginas.filter((p) => p.rota !== null);
        const estado = navegacaoDaColecao(c.id).estado;
        return {
          id: c.id,
          nome: c.nome,
          href: c.href,
          resumoEntrada: c.resumoEntrada,
          contagem: 1 + existentes.length,
          paginas: c.paginas,
          dadosAte: principal ? rotuloReferencia(principal.referencia) : null,
          atraso: sit && (sit.estado === "atrasado" || sit.estado === "retida")
            ? textoSituacao(sit).replace("Publicação retida em parte", "Parte dos dados está com atualização atrasada")
            : null,
          prontidao: estado === "piloto" ? "piloto" : existentes.length > 0 && existentes.every((p) => p.situacao === "parcial") ? "parcial" : null,
          fontes,
        };
      }),
    };
  });
  return { secoes, totais: totais(inv) };
}

export type { ObservatorioId };
