import Link from "next/link";
import type { ReactNode } from "react";
import { LegendaDeSiglas } from "@/components/energia/LegendaSiglas";
import { NavegacaoLocal, type ItemLocal } from "@/components/energia/NavegacaoLocal";
import { TRILHAS_APRENDA, type TrilhaConceitual } from "@/lib/energia/conteudo/trilhas";
import { AVISO_SINTETICO, ROTULO_SINTETICO } from "@/lib/energia/sintetico";

/**
 * Peças de servidor das páginas do Aprenda. O Aprenda tem três tipos de página, e cada um se reconhece de relance:
 *
 *  - índice (/setor-eletrico/aprenda): a abertura do módulo, com busca, as trilhas como capítulos e os verbetes por tema;
 *  - trilha (/aprenda/trilhas e /aprenda/trilhas/<trilha>): um percurso em ordem, com um número publicado em cada passo;
 *  - verbete (/aprenda/<conceito>): um conceito, com a pergunta, a definição da fonte oficial, o exemplo e o painel onde aparece.
 *
 * Nenhum dos três tem seletor de profundidade (Entender, Analisar, Auditar): a página é uma só, e o que é conferência (fonte,
 * data, trecho literal) fica no corpo, recolhido só onde é longo. Por isso a legenda de siglas fica à vista, e não no bloco recolhível
 * da abertura de módulo, que só abre sozinho em Auditar.
 */

export const ROTA_APRENDA = "/setor-eletrico/aprenda";
export const ROTA_TRILHAS = `${ROTA_APRENDA}/trilhas`;

/** Seções do módulo como itens da faixa de navegação local das páginas filhas. */
const ITENS_APRENDA: ItemLocal[] = [
  { id: "verbetes", href: ROTA_APRENDA, rotulo: "Verbetes", descricao: "Um conceito por página: a pergunta, a definição da fonte oficial, o exemplo e o painel onde aparece." },
  { id: "trilhas", href: ROTA_TRILHAS, rotulo: "Trilhas", descricao: "Percursos em ordem que ligam conceitos a números publicados." },
];

/**
 * Faixa das páginas filhas do índice (trilhas e verbetes): as duas seções do módulo, com a que contém a página marcada. A abertura
 * (o índice) não leva a faixa, porque mostra as trilhas como capítulos (AprendaTrilhas).
 */
export function AprendaNavegacao({ atual }: { atual: "verbetes" | "trilhas" }) {
  return <NavegacaoLocal rotulo="Seções do Aprenda" itens={ITENS_APRENDA} atual={atual} />;
}

/** Descrição de uma trilha como capítulo: a pergunta que ela responde e quantos passos tem. */
export function descricaoDaTrilha(t: TrilhaConceitual): string {
  return `${t.pergunta} ${t.passos.length} passos.`;
}

/**
 * Capítulos da abertura: as trilhas do módulo, cada uma com a pergunta que responde, e o que é uma trilha e um exemplo sintético em
 * texto à vista. Quem busca um termo não vê este bloco (a busca troca o que vem abaixo dela); sem JavaScript ele aparece sempre. Em tela
 * larga o bloco fica numa coluna ao lado da lista (os capítulos empilham); em tela estreita, entre a busca e a lista.
 */
export function AprendaTrilhas() {
  const itens: ItemLocal[] = TRILHAS_APRENDA.map((t) => ({ id: t.id, href: `${ROTA_TRILHAS}/${t.id}`, rotulo: t.titulo, descricao: descricaoDaTrilha(t) }));
  return (
    <section aria-labelledby="aprenda-trilhas" data-trilhas-do-indice="" className="border-t border-linha pt-6">
      <h2 id="aprenda-trilhas" className="ed-h2 font-serif text-carvao">
        Trilhas: dos conceitos aos números
      </h2>
      <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        Uma trilha é um percurso em ordem pelos verbetes: cada passo traz um número publicado pelo observatório e diz como ele se liga ao passo seguinte.
      </p>
      <div className="mt-4 lg:[&>nav>ol]:!grid-cols-1 [&>nav]:border-t-0 [&>nav]:pt-0">
        <NavegacaoLocal rotulo="Trilhas do Aprenda" itens={itens} atual="" variante="capitulos" />
      </div>
      <p className="mt-4 max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-nota-sintetico="">
        No fim de cada trilha, há um {ROTULO_SINTETICO.toLowerCase()}. {AVISO_SINTETICO}{" "}
        <Link href={ROTA_TRILHAS} className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4 hover:text-carvao">
          Como funciona uma trilha
        </Link>
      </p>
    </section>
  );
}

/**
 * Abertura das páginas de trilha e de verbete: rótulo do tipo de página, título, uma ou duas frases, a linha de contexto (estado de
 * conferência, fonte) e a legenda de siglas à vista. Mesma composição de `CabecalhoModulo` (classes `cab-modulo`, `ed-h1`, `ed-lead`,
 * `ed-meta`), sem o bloco recolhível: no Aprenda não há seletor de profundidade que o abra, e a sigla precisa estar definida onde é usada.
 */
export function AprendaCabecalho({
  tipo,
  rotulo,
  titulo,
  lead,
  contexto,
  siglas,
}: {
  tipo: "trilha" | "verbete";
  rotulo: string;
  titulo: ReactNode;
  lead?: ReactNode;
  /** Linha de contexto em 12 px (estado de conferência, fonte, passos). */
  contexto?: ReactNode;
  siglas?: readonly string[];
}) {
  return (
    <header className="cab-modulo" data-abertura="editorial" data-tipo-pagina={tipo}>
      <p className="rotulo text-mineral">{rotulo}</p>
      <h1 className="ed-h1 mt-2 max-w-4xl font-serif text-carvao">{titulo}</h1>
      {lead && <p className="ed-lead mt-3 max-w-3xl text-carvao-muted">{lead}</p>}
      {contexto && (
        <div className="ed-meta mt-2 items-center text-xs text-carvao-muted" data-recorte="">
          {contexto}
        </div>
      )}
      <LegendaDeSiglas siglas={siglas} />
    </header>
  );
}
