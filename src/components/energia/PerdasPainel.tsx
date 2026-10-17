import type { ReactNode } from "react";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { NavegacaoLocal, type ItemLocal } from "@/components/energia/NavegacaoLocal";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { carimbo, dataBR, mesAno } from "@/lib/energia/formato";
import { anosSerieNacional, coberturaSeparacao, linhaNacional, nPublicaramTecnica } from "@/lib/energia/perdas";
import type { PerdasGold } from "@/lib/energia/tipos-perdas";
import { idiomaEnergia, porIdioma, tx } from "@/lib/energia/idioma";
import type { Idioma } from "@/lib/idioma";
import { Nome } from "@/components/i18n/Nome";

/**
 * Peças comuns às páginas do módulo Perdas (componentes de servidor): a navegação local entre as quatro páginas (faixa nas filhas,
 * capítulos na abertura), a resposta curta, o recorte (período, universo e unidade), as duas medidas da separação técnica e não
 * técnica e o rodapé com a próxima pergunta, os downloads e o link do painel (SeguirPainel).
 *
 * Por que quatro páginas e não uma: cada painel leva mapa ou gráfico, tabela equivalente e dados para a interação; numa página só, o
 * HTML passaria de 900 KB (medido no teste src/tests/energia-perdas.test.ts), acima da meta de 600 KB do contrato (seção 5.1). A
 * distribuidora escolhida segue de uma página para outra pelo parâmetro ?d= (PerdasLevaEscolha).
 */

export type IdPaginaPerdas = "mapa" | "composicao" | "regulatorio" | "custo";

/**
 * Pergunta de cada página: título da página, descrição do capítulo na abertura e "Próxima pergunta" da página anterior. A do painel
 * Realizado e regulatório diz o que o gráfico mostra de fato (a mudança do percentual, não o desvio do realizado).
 */
export function perguntaPerdas(id: IdPaginaPerdas, idioma: Idioma = idiomaEnergia()): string {
  return porIdioma(idioma, {
    pt: {
      mapa: "Onde a energia se perde?",
      composicao: "Como se separam as perdas técnicas e não técnicas?",
      regulatorio: "Como mudou o percentual regulatório de perdas técnicas?",
      custo: "Qual é a dimensão econômica e territorial das perdas?",
    },
    en: {
      mapa: "Where is energy lost?",
      composicao: "How are technical and non-technical losses separated?",
      regulatorio: "How has the regulatory percentage of technical losses changed?",
      custo: "What is the economic and territorial dimension of losses?",
    },
  })[id];
}
export const PERGUNTA_ABERTURA = perguntaPerdas("mapa", "pt");
export const PERGUNTA_COMPOSICAO = perguntaPerdas("composicao", "pt");
export const PERGUNTA_REGULATORIO = perguntaPerdas("regulatorio", "pt");
export const PERGUNTA_CUSTO = perguntaPerdas("custo", "pt");

export function paginasPerdas(idioma: Idioma = idiomaEnergia()) {
  return [
    { id: "mapa", href: "/setor-eletrico/perdas", rotulo: tx("Mapa e comparação", "Map and comparison", idioma), pergunta: perguntaPerdas("mapa", idioma), painel: "P055" },
    { id: "composicao", href: "/setor-eletrico/perdas/composicao", rotulo: tx("Técnicas e não técnicas", "Technical and non-technical", idioma), pergunta: perguntaPerdas("composicao", idioma), painel: "P056" },
    { id: "regulatorio", href: "/setor-eletrico/perdas/regulatorio", rotulo: tx("Realizado e regulatório", "Actual and regulatory", idioma), pergunta: perguntaPerdas("regulatorio", idioma), painel: "P057" },
    { id: "custo", href: "/setor-eletrico/perdas/custo-e-contexto", rotulo: tx("Custo e contexto", "Cost and context", idioma), pergunta: perguntaPerdas("custo", idioma), painel: "P058" },
  ] as const satisfies readonly { id: IdPaginaPerdas; href: string; rotulo: string; pergunta: string; painel: string }[];
}
export const PAGINAS_PERDAS = paginasPerdas("pt");

export const LINK_PERDAS = "rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao";

/** As páginas do módulo como itens da navegação local; a descrição de cada capítulo é a pergunta da página. */
function itensPerdas(idioma: Idioma = idiomaEnergia()): ItemLocal[] {
  return paginasPerdas(idioma).map((p) => ({ id: p.id, href: p.href, rotulo: p.rotulo, descricao: p.pergunta }));
}

/**
 * Faixa de páginas irmãs nas páginas filhas. A abertura não leva a faixa: mostra os mesmos destinos como capítulos depois da figura
 * principal (PerdasCapitulos), e o mesmo rótulo não aparece duas vezes na página.
 */
export function PerdasNavegacao({ atual }: { atual: IdPaginaPerdas }) {
  if (atual === "mapa") return null;
  return <NavegacaoLocal rotulo={tx("Painéis do módulo de perdas", "Panels of the losses module")} itens={itensPerdas()} atual={atual} />;
}

/** Capítulos da abertura: as outras três páginas do módulo, cada uma com a pergunta que responde. */
export function PerdasCapitulos({ atual = "mapa" }: { atual?: IdPaginaPerdas }) {
  return (
    <NavegacaoLocal
      rotulo={tx("Capítulos de perdas de energia", "Energy loss chapters")}
      itens={itensPerdas()}
      atual={atual}
      variante="capitulos"
      titulo={tx("Outras perguntas sobre perdas", "Other questions about losses")}
      nivelTitulo={3}
    />
  );
}

/**
 * Linha de referência do cabeçalho, a mesma nas quatro páginas: anos completos da série do
 * SAMP, o ano aberto (só quando a fonte já publicou algum mês dele), a data em que a
 * vigência tarifária foi conferida e o ano do Censo, todos lidos da gold. Sem ano aberto,
 * a frase não fica com um "e  até" solto.
 */
export function ReferenciaPerdas({ g }: { g: PerdasGold }) {
  const r = g.referencia;
  const anos = anosSerieNacional(g.nacional);
  const serie = anos
    ? anos.inicio === anos.fim
      ? tx(`ano completo de ${anos.fim}`, `complete year ${anos.fim}`)
      : tx(`anos completos de ${anos.inicio} a ${anos.fim}`, `complete years from ${anos.inicio} to ${anos.fim}`)
    : tx(`anos completos até ${r.ano}`, `complete years up to ${r.ano}`);
  const aberto =
    r.ano_parcial !== null && r.ultima_competencia_parcial
      ? tx(` e ${r.ano_parcial} até ${mesAno(r.ultima_competencia_parcial)}`, ` and ${r.ano_parcial} up to ${mesAno(r.ultima_competencia_parcial)}`)
      : "";
  const censo = g.proveniencia.contexto.periodo_referencia.inicio.slice(0, 4);
  return tx(
    <>
      ANEEL, SAMP Balanço: {serie}
      {aberto}; componentes tarifárias com vigência conferida em {dataBR(r.tarifa_consultada_em)}; Censo {censo} do IBGE. Processado em {carimbo(g.gerado_em)}.
    </>,
    <>
      ANEEL, <Nome>SAMP Balanço</Nome>: {serie}
      {aberto}; tariff components with validity checked on {dataBR(r.tarifa_consultada_em)}; IBGE {censo} Census. Processed on {carimbo(g.gerado_em)}.
    </>,
  );
}

/**
 * Resposta do painel. Com `veredito` (e o `id` do painel), vira a resposta em duas camadas: o veredito em palavras comuns
 * fica à vista e o texto completo (`children`) passa a Analisar e Auditar, sem sair do HTML do servidor.
 */
export function Resposta({ children, prova, veredito, id, vivo = false }: { children: ReactNode; prova?: ReactNode; veredito?: string; id?: string; vivo?: boolean }) {
  return (
    <div>
      {veredito && id ? (
        <RespostaCurta id={id} veredito={veredito} vivo={vivo}>
          {children}
        </RespostaCurta>
      ) : (
        <p className="max-w-prose2 text-base leading-relaxed text-carvao">{children}</p>
      )}
      {prova && <div className="mt-1 flex flex-wrap items-center gap-x-5">{prova}</div>}
    </div>
  );
}

/** Período, universo e unidade do que a figura mostra, logo abaixo dela (o universo muda de figura para figura). */
export function Recorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
      <div>
        <dt className="rotulo text-mineral">{tx("Período", "Period")}</dt>
        <dd className="mt-0.5">{periodo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">{tx("Universo", "Universe")}</dt>
        <dd className="mt-0.5">{universo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">{tx("Unidade", "Unit")}</dt>
        <dd className="mt-0.5">{unidade}</dd>
      </div>
    </dl>
  );
}

/** Rodapé do painel numa linha: baixar os dados, copiar o link com o recorte e seguir para a próxima pergunta (SeguirPainel). */
export function PerdasSeguir({
  ancora,
  proxima,
  downloads = [],
}: {
  ancora: string;
  proxima: { pergunta: string; href: string };
  downloads?: { rotulo: string; url: string }[];
}) {
  return <SeguirPainel ancora={ancora} proximo={{ href: proxima.href, pergunta: proxima.pergunta }} downloads={downloads} />;
}

/**
 * As duas partes estimadas da perda das concessionárias lado a lado, cada uma na sua base e com a sua cobertura: a técnica sobre a
 * energia injetada e a não técnica sobre o mercado de baixa tensão, publicadas só por parte das concessionárias válidas. Uma faixa de
 * métricas só, para a abertura e para a página de composição lerem o mesmo número pelo mesmo caminho (linha nacional do ano de referência).
 */
export function SeparacaoMetricas({ g, endereco }: { g: PerdasGold; endereco: string }) {
  const ref = g.referencia.ano;
  const nac = linhaNacional(g, ref);
  const cob = nac ? coberturaSeparacao(nac, nPublicaramTecnica(g.distribuidoras)) : null;
  return (
    <FaixaMetricas
      colunas={2}
      rotulo={tx("Perdas técnicas e não técnicas das concessionárias", "Technical and non-technical losses of the concession holders")}
      nota={tx(
        <>
          As duas porcentagens têm bases diferentes e não se somam. A perda não técnica é a diferença entre a total e a técnica: inclui furto, fraude e erros de medição, de leitura e de faturamento, que a fonte não separa.
        </>,
        <>
          The two percentages have different bases and do not add up. The non-technical loss is the difference between the total and the technical loss: it includes theft, fraud and metering, reading and billing
          errors, which the source does not separate.
        </>,
      )}
    >
      <Numero
        variante="faixa"
        rotulo={tx(`Perdas técnicas, ${ref}`, `Technical losses, ${ref}`)}
        natureza="ESTIMADO"
        valor={nac?.taxa_tecnica_pct ?? null}
        formato="pct"
        casas={2}
        unidade={tx("% da energia injetada de referência", "% of reference injected energy")}
        periodo={nac ? tx(`${ref} · ${nac.n_com_tecnica} de ${nac.n_distribuidoras} concessionárias`, `${ref} · ${nac.n_com_tecnica} of ${nac.n_distribuidoras} concession holders`) : String(ref)}
        motivoAusencia={tx("Nenhuma concessionária válida publicou a técnica nos 12 meses.", "No valid concession holder published the technical loss for the 12 months.")}
        nota={
          cob
            ? tx(
                <>{cob.tecnica}. Estimativa informada pela distribuidora no balanço de energia (SAMP), não medição.</>,
                <>{cob.tecnica}. Estimate reported by the distribution utility in the energy balance (SAMP), not a measurement.</>,
              )
            : undefined
        }
        cor="var(--escala-seq-4)"
      />
      <Numero
        variante="faixa"
        rotulo={tx(`Perdas não técnicas, ${ref}`, `Non-technical losses, ${ref}`)}
        natureza="ESTIMADO"
        evidencia={g.evidencias.pnt_bt_nacional}
        formato="pct"
        casas={2}
        unidade={tx("% do mercado de baixa tensão", "% of the low-voltage market")}
        periodo={nac ? tx(`${ref} · ${nac.n_com_pnt_bt} de ${nac.n_distribuidoras} concessionárias`, `${ref} · ${nac.n_com_pnt_bt} of ${nac.n_distribuidoras} concession holders`) : String(ref)}
        motivoAusencia={tx("Nenhuma concessionária válida teve a separação fechando.", "No valid concession holder had the separation closing.")}
        nota={cob ? <>{cob.pntBt}.</> : undefined}
        cor="var(--serie-termica)"
        endereco={endereco}
      />
    </FaixaMetricas>
  );
}

/**
 * Estado de cada comparação que a página poderia fazer: o que é comparado, se a comparação está disponível, não se aplica ou está
 * indisponível nesta publicação, e a razão, dita junto do dado (estados de disponibilidade do sistema: o texto do estado e o tipo de
 * borda dizem o estado, nunca só a cor). Serve à referência regulatória, onde o perímetro compatível, a elegibilidade e o bloqueio da
 * comparação precisam estar à vista antes da figura. O detalhe da coleta (evidência, endereços tentados) fica em Analisar.
 */
export type ItemEstadoComparacao = {
  id: string;
  comparacao: ReactNode;
  estado: "disponivel" | "nao-se-aplica" | "indisponivel";
  motivo: ReactNode;
  /** Só para Analisar e Auditar: evidência da coleta, dependência e endereços tentados. */
  detalhe?: ReactNode;
  /** Atributos data-* de identificação para testes e coleta. */
  dados?: Record<string, string>;
};

function rotulosEstado(idioma: Idioma = idiomaEnergia()): Record<ItemEstadoComparacao["estado"], string> {
  return porIdioma(idioma, {
    pt: { disponivel: "Disponível", "nao-se-aplica": "Não se aplica", indisponivel: "Indisponível nesta publicação" },
    en: { disponivel: "Available", "nao-se-aplica": "Not applicable", indisponivel: "Unavailable in this release" },
  });
}
const BORDA_ESTADO: Record<ItemEstadoComparacao["estado"], string> = {
  disponivel: "border-solid border-energia text-energia-dark",
  "nao-se-aplica": "border-dotted border-mineral text-carvao-muted",
  indisponivel: "border-dashed border-mineral text-carvao",
};

export function EstadoDaComparacao({ titulo, itens }: { titulo: string; itens: ItemEstadoComparacao[] }) {
  const ROTULO_ESTADO = rotulosEstado();
  return (
    <section aria-label={titulo} data-estado-comparacao="" className="border-t border-linha">
      <h3 className="rotulo pt-3 text-mineral">{titulo}</h3>
      <ul className="divide-y divide-linha">
        {itens.map((i) => (
          <li key={i.id} data-comparacao={i.id} {...i.dados} className="grid gap-x-8 gap-y-2 py-3 md:grid-cols-[17rem_minmax(0,1fr)]">
            <div>
              <p className="text-sm font-medium leading-snug text-carvao">{i.comparacao}</p>
              <p className={`mt-1.5 inline-block border px-2 py-0.5 text-xs ${BORDA_ESTADO[i.estado]}`} data-estado-da-comparacao={i.estado}>
                {ROTULO_ESTADO[i.estado]}
              </p>
            </div>
            <div className="min-w-0 text-sm leading-relaxed text-carvao-muted">
              <p>{i.motivo}</p>
              {i.detalhe && (
                <div data-nivel="analisar" className="mt-2 space-y-1 text-xs leading-relaxed">
                  {i.detalhe}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
