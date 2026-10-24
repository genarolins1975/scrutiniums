/**
 * Inventário das coleções para o mapa da área logada (/app/observatorios):
 * para cada coleção, as páginas que existem, as que estão no ar com cobertura
 * parcial e as que o catálogo do tema declara e ainda não têm página.
 *
 * Três situações, lidas dos próprios catálogos, nunca escritas à mão aqui:
 *  - "publicado": rota existe e o catálogo não a marca como parcial (registro.ts);
 *  - "parcial": rota existe e o catálogo do Saneamento a declara `parcial` ou
 *    `em_preparacao` (src/lib/saneamento/capitulos.ts);
 *  - "previsto": consta do catálogo sem página: capítulos `em-preparacao` das
 *    Contas Federais (src/lib/contas-publicas/catalogo.ts) e temas da Eficiência
 *    Estatal sem `href` (src/lib/eficiencia/dimensoes.ts).
 *
 * A página raiz da coleção não entra na lista de páginas: o nome da coleção já a abre.
 */
import { OBSERVATORIOS, type ObservatorioId } from "./lista";
import { ATALHOS, DESTINO_TEMAS_EFICIENCIA, donoDaRota, paineis } from "./registro";
import { CAPITULOS as CAPITULOS_SANEAMENTO } from "@/lib/saneamento/capitulos";
import { CAPITULOS as CAPITULOS_CONTAS } from "@/lib/contas-publicas/catalogo";
import { DIMENSOES } from "@/lib/eficiencia/dimensoes";

export type SituacaoPagina = "publicado" | "parcial" | "previsto";

export type PaginaInventario = {
  titulo: string;
  /** null quando ainda não existe página. */
  rota: string | null;
  situacao: SituacaoPagina;
  /** O que falta, quando o catálogo declara (só para "previsto"). */
  pendencia?: string;
  /** A pergunta ou o resumo da página e os termos que levam a ela na busca, lidos do catálogo do domínio (Painel). */
  resumo?: string;
  termos?: readonly string[];
};

export type ColecaoInventario = {
  id: string;
  nome: string;
  href: string;
  /** Palavras que o filtro também considera (sinônimos, siglas, fontes). */
  termos: string;
  paginas: PaginaInventario[];
};

export type ObservatorioInventario = {
  id: ObservatorioId;
  nome: string;
  nomeCurto: string;
  pergunta: string;
  entrada: string | undefined;
  colecoes: ColecaoInventario[];
};

/** Termos de busca por coleção: o que um leigo digita e o nome da coleção não diz. */
const TERMOS: Record<string, string> = {
  "familias/renda": "emprego salário ocupação caged",
  "familias/divida": "juros inadimplência atraso banco consignado golpe fraude desenrola",
  "familias/protecao": "bolsa família bpc cadúnico assistência tarifa social fome",
  "familias/moradia": "aluguel déficit habitacional casa financiamento imobiliário",
  "familias/custo-de-vida": "inflação ipca preço cesta comida botijão conta de luz água",
  "servicos-publicos/educacao": "escola ideb anos iniciais anos finais matrícula creche capitais",
  "servicos-publicos/saude": "hospital sus atenção primária internação capitais",
  "servicos-publicos/seguranca": "homicídio violência polícia estados",
  "servicos-publicos/justica": "tribunal processo cnj judiciário fila defensoria",
  "servicos-publicos/cultura": "biblioteca museu acervo",
  "servicos-publicos/sintese": "retrato capitais minha capital índice ranking",
  "contas-publicas/federais": "orçamento federal união impostos r$ 100 previdência inss despesa por área restos a pagar dívida pública",
  "contas-publicas/estaduais": "estados uf dívida receita icms siconfi tesouro",
  "contas-publicas/divida-governos": "municípios crédito subnacional união dívida pública",
  "energia-e-infraestrutura/setor-eletrico": "luz tarifa pld reservatório ons aneel eólica solar hidrelétrica apagão",
  "energia-e-infraestrutura/gas": "botijão glp gnv encanado anp petrobras",
  "energia-e-infraestrutura/combustiveis": "gasolina etanol diesel posto tanque anp",
  "energia-e-infraestrutura/saneamento": "conta de água esgoto município tarifa prestador meta 2033 sinisa universalização",
  "energia-e-infraestrutura/mobilidade": "transporte ônibus deslocamento trânsito",
  "energia-e-infraestrutura/conectividade": "internet banda larga energia elétrica domicílio",
  "economia/credito": "bancos juros spread carteira sistema financeiro bcb pib cartão de crédito",
  "economia/pagamentos": "pix cartão boleto open finance",
  "economia/empresas": "setores falência recuperação judicial risco",
  "economia/agro": "safra exportação soja carne café campo cadeia",
  "territorio-e-clima/desmatamento": "amazônia prodes floresta emissões carbono",
  "territorio-e-clima/cidades-clima": "calor chuva racionamento manancial seca",
  "territorio-e-clima/fogo": "queimada foco incêndio inpe",
  "territorio-e-clima/desastres": "inundação enchente deslizamento área de risco defesa civil",
};

const SITUACAO_SANEAMENTO = new Map(CAPITULOS_SANEAMENTO.map((c) => [`/saneamento/${c.slug}`, c.situacao]));

function situacaoDaRota(rota: string): SituacaoPagina {
  const s = SITUACAO_SANEAMENTO.get(rota);
  return s && s !== "publicado" ? "parcial" : "publicado";
}

/** Páginas previstas nos catálogos, ainda sem rota. */
function previstas(observatorio: ObservatorioId, colecao: string): PaginaInventario[] {
  const itens: PaginaInventario[] = [];
  if (observatorio === "contas-publicas" && colecao === "federais") {
    for (const c of CAPITULOS_CONTAS) {
      if (c.situacao !== "com-dados") itens.push({ titulo: c.titulo, rota: null, situacao: "previsto", pendencia: c.pendencia });
    }
  }
  for (const d of DIMENSOES) {
    if (d.href) continue;
    const destino = DESTINO_TEMAS_EFICIENCIA[d.id];
    if (destino && destino[0] === observatorio && destino[1] === colecao) itens.push({ titulo: d.titulo, rota: null, situacao: "previsto" });
  }
  return itens;
}

export function inventario(): ObservatorioInventario[] {
  const todos = paineis().filter((p) => !p.duplicataDe);
  const porRota = new Map(todos.map((p) => [p.rota, p]));
  return OBSERVATORIOS.map((o) => ({
    id: o.id,
    nome: o.nome,
    nomeCurto: o.nomeCurto,
    pergunta: o.pergunta,
    entrada: o.entrada,
    colecoes: o.colecoes.map((c) => {
      const proprias = todos
        .filter((p) => p.observatorio === o.id && p.colecao === c.id && p.rota !== c.href)
        .map((p): PaginaInventario => ({ titulo: p.titulo, rota: p.rota, situacao: situacaoDaRota(p.rota), resumo: p.resumo, termos: p.termos }));
      // atalhos: painéis de outro observatório que esta coleção também apresenta
      const atalhos = ATALHOS.filter((a) => a.observatorio === o.id && a.colecao === c.id)
        .map((a) => porRota.get(a.rota) ?? donoDaRota(a.rota))
        .filter((p): p is NonNullable<typeof p> => !!p && !proprias.some((x) => x.rota === p.rota))
        .map((p): PaginaInventario => ({ titulo: p.titulo, rota: p.rota, situacao: situacaoDaRota(p.rota), resumo: p.resumo, termos: p.termos }));
      return { id: c.id, nome: c.nome, href: c.href, termos: TERMOS[`${o.id}/${c.id}`] ?? "", paginas: [...proprias, ...atalhos, ...previstas(o.id, c.id)] };
    }),
  }));
}

export type TotaisInventario = { colecoes: number; publicadas: number; parciais: number; previstas: number };

/** Totais por rota única: um atalho repete a página noutra coleção e não conta duas vezes. */
export function totais(obs: ObservatorioInventario[]): TotaisInventario {
  const vistas = new Set<string>();
  const t: TotaisInventario = { colecoes: 0, publicadas: 0, parciais: 0, previstas: 0 };
  for (const o of obs) for (const c of o.colecoes) {
    t.colecoes += 1;
    for (const p of c.paginas) {
      const chave = p.rota ?? `previsto:${p.titulo}`;
      if (vistas.has(chave)) continue;
      vistas.add(chave);
      if (p.situacao === "publicado") t.publicadas += 1;
      else if (p.situacao === "parcial") t.parciais += 1;
      else t.previstas += 1;
    }
  }
  return t;
}
