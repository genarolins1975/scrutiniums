import type { ReactNode } from "react";
import { DetalheDoNivel } from "@/components/energia/DetalheDoNivel";
import { LegendaDeSiglas } from "@/components/energia/LegendaSiglas";
import { SobreEstaPagina } from "@/components/energia/SobreEstaPagina";

/**
 * Abertura editorial das páginas do observatório: rótulo, título curto (cinco a nove palavras), uma ou duas frases, o recorte
 * (período e universo) e a fonte curta numa linha, e a faixa de métricas logo abaixo. O que o leitor só precisa quando quer
 * conferir (fontes e datas por extenso, datas de cada parte, siglas, o texto longo de apresentação) fica num único bloco
 * recolhível, no HTML do servidor, aberto em Auditar. Nada é retirado da página: muda o lugar e a ordem de leitura.
 *
 * Duas formas de uso:
 *  - com `lead` (página migrada): `titulo` é o título curto, `lead` são as duas frases, `recorte` e `fonte` ocupam a linha de
 *    contexto, `referencia`, `datas`, `siglas` e `children` vão para o bloco "Fontes, datas e siglas" e `metricas`
 *    recebe uma `FaixaMetricas`;
 *  - sem `lead` (página ainda no desenho anterior): `children` é a abertura recolhida em Entender, `referencia` fica à vista e a
 *    legenda de siglas vem logo abaixo, como antes.
 */
export function CabecalhoModulo({
  rotulo = "",
  titulo,
  children,
  referencia,
  siglas,
  recolher = true,
  lead,
  recorte,
  fonte,
  datas,
  metricas,
}: {
  /** Rótulo acima do título (módulo ou seção). Omitido na abertura de módulo, onde repetiria a navegação; útil em página filha, como migalha. */
  rotulo?: string;
  titulo: string;
  /** Texto longo de apresentação. Com `lead`, vai para o bloco recolhível; sem `lead`, é a abertura recolhida. */
  children?: ReactNode;
  /** Fontes e datas de referência por extenso. Com `lead`, vai para o bloco recolhível; sem `lead`, fica à vista. */
  referencia?: ReactNode;
  /** Siglas da página que o leitor encontra sem explicação no texto; o nome por extenso vem de `SIGLAS`. */
  siglas?: readonly string[];
  /** Só no desenho anterior: abertura recolhida em Entender (padrão). Falso em página sem seletor de profundidade. */
  recolher?: boolean;
  /** Uma ou duas frases que dizem o que a página mostra, sempre à vista. */
  lead?: ReactNode;
  /** Período e universo do que a página mostra, em poucas palavras (ex.: "29/09/2026 · SIN · % da capacidade"). */
  recorte?: ReactNode;
  /** Fonte curta (ex.: "ONS, EAR por subsistema"). */
  fonte?: ReactNode;
  /** Datas de referência de cada parte da página (ex.: <AguaDatas />), dentro do bloco recolhível. */
  datas?: ReactNode;
  /** Faixa de métricas (FaixaMetricas) logo abaixo da abertura. */
  metricas?: ReactNode;
}) {
  if (lead === undefined) {
    const abertura = children && <div className="cab-lead ed-lead max-w-prose2 text-carvao-muted">{children}</div>;
    return (
      <header className="cab-modulo">
        <p className="rotulo text-mineral">{rotulo}</p>
        <h1 className="ed-h1 mt-2 max-w-4xl font-serif text-carvao">{titulo}</h1>
        {referencia && (
          <p className="cab-ref mt-3 text-xs text-mineral">
            <span className="font-medium text-carvao-muted">Fontes e datas de referência: </span>
            {referencia}
          </p>
        )}
        {abertura && (recolher ? <SobreEstaPagina>{abertura}</SobreEstaPagina> : abertura)}
        <LegendaDeSiglas siglas={siglas} />
      </header>
    );
  }
  const haBloco = Boolean(referencia || datas || children || (siglas && siglas.length));
  return (
    <>
      <header className="cab-modulo" data-abertura="editorial">
        {rotulo && <p className="rotulo text-mineral">{rotulo}</p>}
        <h1 className={`ed-h1 max-w-4xl font-serif text-carvao ${rotulo ? "mt-2" : ""}`}>{titulo}</h1>
        <p className="ed-lead mt-3 max-w-3xl text-carvao-muted">{lead}</p>
        {(recorte || fonte || haBloco) && (
          <div className="ed-meta mt-1 items-center text-xs text-carvao-muted" data-recorte="">
            {recorte && <span>{recorte}</span>}
            {fonte && <span>Fonte: {fonte}</span>}
            {haBloco && (
              <DetalheDoNivel resumo="Fontes, datas e siglas" abreEm="auditar" className="[&[open]]:basis-full" dados={{ "data-sobre-pagina": "true" }}>
                <div className="max-w-prose2 space-y-3 pb-2 pt-1 text-sm leading-relaxed text-carvao-muted">
                  {referencia && (
                    <p className="text-xs text-mineral">
                      <span className="font-medium text-carvao-muted">Fontes e datas de referência: </span>
                      {referencia}
                    </p>
                  )}
                  {datas}
                  {children && <div>{children}</div>}
                  <LegendaDeSiglas siglas={siglas} />
                </div>
              </DetalheDoNivel>
            )}
          </div>
        )}
        {!haBloco && <LegendaDeSiglas siglas={siglas} />}
      </header>
      {metricas}
    </>
  );
}

export function Bloco({ id, children, nivel }: { id?: string; children: ReactNode; nivel?: "analisar" | "auditar" }) {
  return (
    <div id={id} data-nivel={nivel} className="scroll-mt-28 py-5">
      {children}
    </div>
  );
}

/** Legenda de siglas: lista da página no servidor, derivada do texto à vista depois da hidratação (LegendaSiglas). */
export { LegendaDeSiglas } from "@/components/energia/LegendaSiglas";
