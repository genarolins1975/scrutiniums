import type { ReactNode } from "react";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { NavegacaoLocal, type ItemLocal } from "@/components/energia/NavegacaoLocal";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { carimbo, dataBR, mesAno } from "@/lib/energia/formato";
import { anosSerieNacional, coberturaSeparacao, linhaNacional } from "@/lib/energia/perdas";
import type { PerdasGold } from "@/lib/energia/tipos-perdas";

/**
 * Peças comuns às páginas do módulo Perdas (componentes de servidor): a navegação local entre as quatro páginas (faixa nas filhas,
 * capítulos na abertura), a resposta curta, o recorte (período, universo e unidade), as duas medidas da separação técnica e não
 * técnica e o rodapé com a próxima pergunta, os downloads e o link do painel (SeguirPainel).
 *
 * Por que quatro páginas e não uma: cada painel leva mapa ou gráfico, tabela equivalente e dados para a interação; numa página só, o
 * HTML passaria de 900 KB (medido no teste src/tests/energia-perdas.test.ts), acima da meta de 600 KB do contrato (seção 5.1). A
 * distribuidora escolhida segue de uma página para outra pelo parâmetro ?d= (PerdasLevaEscolha).
 */

/** Pergunta de cada página: título da página, descrição do capítulo na abertura e "Próxima pergunta" da página anterior. */
export const PERGUNTA_ABERTURA = "Onde a energia se perde?";
export const PERGUNTA_COMPOSICAO = "Como se separam as perdas técnicas e não técnicas?";
/** Pergunta do painel Realizado e regulatório: o que o gráfico mostra de fato (a mudança do percentual, não o desvio do realizado). */
export const PERGUNTA_REGULATORIO = "Como mudou o percentual regulatório de perdas técnicas?";
export const PERGUNTA_CUSTO = "Qual é a dimensão econômica e territorial das perdas?";

export const PAGINAS_PERDAS = [
  { id: "mapa", href: "/setor-eletrico/perdas", rotulo: "Mapa e comparação", pergunta: PERGUNTA_ABERTURA, painel: "P055" },
  { id: "composicao", href: "/setor-eletrico/perdas/composicao", rotulo: "Técnicas e não técnicas", pergunta: PERGUNTA_COMPOSICAO, painel: "P056" },
  { id: "regulatorio", href: "/setor-eletrico/perdas/regulatorio", rotulo: "Realizado e regulatório", pergunta: PERGUNTA_REGULATORIO, painel: "P057" },
  { id: "custo", href: "/setor-eletrico/perdas/custo-e-contexto", rotulo: "Custo e contexto", pergunta: PERGUNTA_CUSTO, painel: "P058" },
] as const;

export type IdPaginaPerdas = (typeof PAGINAS_PERDAS)[number]["id"];

export const LINK_PERDAS = "rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao";

/** As páginas do módulo como itens da navegação local; a descrição de cada capítulo é a pergunta da página. */
const ITENS_PERDAS: ItemLocal[] = PAGINAS_PERDAS.map((p) => ({ id: p.id, href: p.href, rotulo: p.rotulo, descricao: p.pergunta }));

/**
 * Faixa de páginas irmãs nas páginas filhas. A abertura não leva a faixa: mostra os mesmos destinos como capítulos depois da figura
 * principal (PerdasCapitulos), e o mesmo rótulo não aparece duas vezes na página.
 */
export function PerdasNavegacao({ atual }: { atual: IdPaginaPerdas }) {
  if (atual === "mapa") return null;
  return <NavegacaoLocal rotulo="Painéis do módulo de perdas" itens={ITENS_PERDAS} atual={atual} />;
}

/** Capítulos da abertura: as outras três páginas do módulo, cada uma com a pergunta que responde. */
export function PerdasCapitulos({ atual = "mapa" }: { atual?: IdPaginaPerdas }) {
  return <NavegacaoLocal rotulo="Capítulos de perdas de energia" itens={ITENS_PERDAS} atual={atual} variante="capitulos" titulo="Outras perguntas sobre perdas" />;
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
  const serie = anos ? (anos.inicio === anos.fim ? `ano completo de ${anos.fim}` : `anos completos de ${anos.inicio} a ${anos.fim}`) : `anos completos até ${r.ano}`;
  const aberto = r.ano_parcial !== null && r.ultima_competencia_parcial ? ` e ${r.ano_parcial} até ${mesAno(r.ultima_competencia_parcial)}` : "";
  const censo = g.proveniencia.contexto.periodo_referencia.inicio.slice(0, 4);
  return (
    <>
      ANEEL, SAMP Balanço: {serie}
      {aberto}; componentes tarifárias com vigência conferida em {dataBR(r.tarifa_consultada_em)}; Censo {censo} do IBGE. Processado em {carimbo(g.gerado_em)}.
    </>
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
        <dt className="rotulo text-mineral">Período</dt>
        <dd className="mt-0.5">{periodo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Universo</dt>
        <dd className="mt-0.5">{universo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Unidade</dt>
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
  const cob = nac ? coberturaSeparacao(nac) : null;
  return (
    <FaixaMetricas
      colunas={2}
      rotulo="Perdas técnicas e não técnicas das concessionárias"
      nota={
        <>
          As duas porcentagens têm bases diferentes e não se somam. A perda não técnica é a diferença entre a total e a técnica: inclui furto, fraude e erros de medição, de leitura e de faturamento, que a fonte não separa.
        </>
      }
    >
      <Numero
        variante="faixa"
        rotulo={`Perdas técnicas, ${ref}`}
        natureza="ESTIMADO"
        valor={nac?.taxa_tecnica_pct ?? null}
        formato="pct"
        casas={2}
        unidade="% da energia injetada de referência"
        periodo={nac ? `${ref} · ${nac.n_com_tecnica} de ${nac.n_distribuidoras} concessionárias` : String(ref)}
        motivoAusencia="Nenhuma concessionária válida publicou a técnica nos 12 meses."
        nota={cob ? <>{cob.tecnica}. Estimativa da fonte: o percentual regulatório aplicado à energia injetada.</> : undefined}
        cor="var(--escala-seq-4)"
      />
      <Numero
        variante="faixa"
        rotulo={`Perdas não técnicas, ${ref}`}
        natureza="ESTIMADO"
        evidencia={g.evidencias.pnt_bt_nacional}
        formato="pct"
        casas={2}
        unidade="% do mercado de baixa tensão"
        periodo={nac ? `${ref} · ${nac.n_com_pnt_bt} de ${nac.n_distribuidoras} concessionárias` : String(ref)}
        motivoAusencia="Nenhuma concessionária válida teve a separação fechando."
        nota={cob ? <>{cob.pntBt}.</> : undefined}
        cor="var(--serie-termica)"
        endereco={endereco}
      />
    </FaixaMetricas>
  );
}
