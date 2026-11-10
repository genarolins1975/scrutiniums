import type { ReactNode } from "react";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import type { EvidenciaEtapa } from "@/lib/energia/dados";
import { refLegivel } from "@/lib/energia/dados";
import type { FormaDoConjunto as Forma, IdEvento, MarcaDoEixo } from "@/lib/energia/forma-conjunto";
import { dataBR, fracPct, mesAno, num, plural } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
import type { DadoConjunto } from "@/lib/energia/tipos-dados";

/**
 * Figura da ficha de um conjunto de dados (/setor-eletrico/dados/<conjunto>): a forma real do dado daquele conjunto, em três partes.
 *
 *  1. A régua do período: da primeira à última referência publicada, com as mudanças metodológicas do catálogo e a data de referência
 *     da publicação. Conjunto sem período (cadastro, pesquisa de referência única) não ganha régua: a figura diz isso em texto.
 *  2. O fim da régua, ampliado: as datas que dizem se o dado está em dia (fim do último período, publicação pela fonte, captura,
 *     publicação do observatório e prazo), uma por linha, na ordem do tempo.
 *  3. A escada do catálogo: as cinco etapas, com o que o catálogo registra em cada uma.
 *
 * Tudo vem de publicacao.json e catalogo.json; a biblioteca `forma-conjunto` só converte datas em posições. Componente de servidor,
 * sem biblioteca de gráfico: o SVG usa porcentagens na horizontal e pixels na vertical, e por isso o texto não encolhe no celular.
 * O desenho é `aria-hidden`: toda data e todo número desenhado está escrito ao lado, em texto.
 */

/** Posição de 0 a 1 no eixo → porcentagem dentro do SVG, com folga nas pontas para as marcas não cortarem. */
const pc = (x: number) => `${(3 + 94 * Math.min(1, Math.max(0, x))).toFixed(2)}%`;
const larg = (x0: number, x1: number) => `${(94 * Math.max(0, x1 - x0)).toFixed(2)}%`;

/** Granularidade escrita pelo pipeline (texto livre, em português) no idioma da página; sem entrada na tabela, fica a do pipeline. */
function granularidadeNoIdioma(g: string): string {
  const en: Record<string, string> = {
    "cadência irregular": "irregular cadence",
    diária: "daily",
    mensal: "monthly",
    anual: "annual",
    horária: "hourly",
    semanal: "weekly",
    trimestral: "quarterly",
    "semi-horária": "half-hourly",
    "a cada 365 dias": "every 365 days",
    vigências: "validity periods",
    "sem referência temporal": "no time reference",
    "cadastro (sem período de referência)": "register (no reference period)",
  };
  return tx(g, en[g] ?? g);
}

function rotuloDaMarca(m: MarcaDoEixo): string {
  return m.mes === null ? String(m.ano) : mesAno(`${m.ano}-${String(m.mes).padStart(2, "0")}`);
}

const ROTULO_EVENTO = (): Record<IdEvento, string> => ({
  fim_periodo: tx("Fim do último período disponível", "End of the latest period available"),
  publicacao_fonte: tx("Última publicação informada pela fonte", "Latest publication reported by the source"),
  captura: tx("Última captura pelo observatório", "Latest capture by the observatory"),
  publicacao: tx("Data de referência desta publicação", "Reference date of this publication"),
  prazo: tx("Prazo da próxima atualização", "Deadline for the next update"),
});

/** A marca de cada data: a forma muda de uma para a outra, e a cor nunca é o único sinal. Desenhada em torno de (0, 0). */
function Marca({ id }: { id: IdEvento }) {
  if (id === "fim_periodo") return <rect x="-5" y="-5" width="10" height="10" fill="var(--cor-energia)" />;
  if (id === "publicacao_fonte") return <path d="M0 -6.5 L6.5 0 L0 6.5 L-6.5 0 Z" fill="var(--cor-papel)" stroke="var(--cor-carvao)" strokeWidth="1.5" />;
  if (id === "captura") return <circle r="5.5" fill="var(--cor-carvao)" />;
  if (id === "prazo") return <path d="M0 -6 L6.5 5 L-6.5 5 Z" fill="var(--cor-papel)" stroke="var(--cor-carvao)" strokeWidth="1.5" strokeLinejoin="round" />;
  return <rect x="-1.5" y="-8" width="3" height="16" fill="var(--cor-carvao)" />;
}

function Glifo({ id }: { id: IdEvento }) {
  return (
    <svg width="16" height="16" viewBox="-8 -8 16 16" aria-hidden="true" focusable="false" className="shrink-0">
      <Marca id={id} />
    </svg>
  );
}

function Parte({ rotulo, children, id }: { rotulo: string; children: ReactNode; id: string }) {
  return (
    <div className="min-w-0" data-parte={id}>
      <h4 className="rotulo text-mineral">{rotulo}</h4>
      {children}
    </div>
  );
}

export function FormaDoConjunto({
  forma,
  dado,
  semPeriodo,
  etapas,
  paginas,
}: {
  forma: Forma;
  /** Bloco `dado` da integração (granularidade, séries, completude); ausente quando o conjunto não tem integração publicada. */
  dado?: DadoConjunto | null;
  /** O que dizer no lugar da régua quando o conjunto não tem período (a frase de referência da ficha). */
  semPeriodo: string;
  /** As cinco etapas da escada, com a evidência de cada uma (`evidenciaEtapas`). */
  etapas: readonly EvidenciaEtapa[];
  /** Quantas páginas do observatório usam o conjunto: a última etapa diz isso no lugar dos nomes de arquivo das bases. */
  paginas: number;
}) {
  const { periodo, eixo, quebras, eventos, atraso } = forma;
  const rotulos = ROTULO_EVENTO();
  const dePara = periodo
    ? periodo.unico
      ? refLegivel(periodo.refMin)
      : tx(`de ${refLegivel(periodo.refMin)} a ${refLegivel(periodo.refMax)}`, `from ${refLegivel(periodo.refMin)} to ${refLegivel(periodo.refMax)}`)
    : null;
  const medida = [
    dado?.granularidade ? tx(`referência ${granularidadeNoIdioma(dado.granularidade)}`, `${granularidadeNoIdioma(dado.granularidade)} reference`) : null,
    dado?.series ? tx(plural(dado.series, "série", "séries"), `${plural(dado.series, "series", "series")}`) : null,
  ].filter(Boolean);
  const lacunas =
    periodo && dado?.completude_interna !== undefined && dado.series
      ? tx(
          `Entre a primeira e a última referência de cada série, ${fracPct(dado.completude_interna)} das referências esperadas estão presentes${
            dado.series_com_lacuna !== undefined ? `; ${dado.series_com_lacuna === 0 ? "nenhuma série tem lacuna" : `${plural(dado.series_com_lacuna, "série tem", "séries têm")} lacuna`}` : ""
          }.`,
          `Between the first and the last reference of each series, ${fracPct(dado.completude_interna)} of the expected references are present${
            dado.series_com_lacuna !== undefined ? `; ${dado.series_com_lacuna === 0 ? "no series has a gap" : `${plural(dado.series_com_lacuna, "series has", "series have")} a gap`}` : ""
          }.`,
        )
      : null;
  const hojeADireita = (eixo?.xHoje ?? 1) > 0.5;
  const alcancadas = etapas.filter((e) => e.situacao === "sim").length;
  const resumo = [
    periodo && dePara ? tx(`Régua do tempo: referências ${dePara}.`, `Time ruler: references ${dePara}.`) : semPeriodo,
    tx(`Etapas alcançadas no catálogo: ${alcancadas} de ${etapas.length}.`, `Stages reached in the catalog: ${alcancadas} of ${etapas.length}.`),
  ].join(" ");

  return (
    <SecaoDoPainel
      id="forma-do-conjunto"
      titulo={tx("Que período os dados cobrem e até onde o conjunto chegou?", "What period do the data cover and how far has the dataset come?")}
    >
      <figure data-elemento-visual="forma-do-conjunto" aria-label={resumo} className="space-y-8">
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
          <Parte id="periodo" rotulo={tx("Período coberto", "Period covered")}>
            {periodo && eixo && dePara ? (
              <>
                <p className="mt-1 font-serif text-xl leading-snug text-carvao [font-variant-numeric:lining-nums_tabular-nums]" data-periodo="">
                  {dePara}
                </p>
                {medida.length > 0 && <p className="t-meta mt-1 text-carvao-muted">{medida.join(" · ")}</p>}
                <svg width="100%" height="62" aria-hidden="true" focusable="false" className="mt-3 block overflow-visible text-xs" data-regua="periodo">
                  <defs>
                    <pattern id="forma-hachura" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <line x1="0" y1="0" x2="0" y2="6" stroke="var(--cor-energia)" strokeWidth="2" />
                    </pattern>
                  </defs>
                  <line x1={pc(0)} x2={pc(1)} y1="25" y2="25" stroke="var(--cor-linha)" strokeWidth="1" />
                  {/* a barra: da primeira referência à última já alcançada pela data da publicação; contorno de 2 px para um único dia continuar visível */}
                  <rect x={pc(periodo.x0)} y="18" width={larg(periodo.x0, periodo.x1)} height="14" fill="var(--cor-energia)" stroke="var(--cor-energia)" strokeWidth="2" />
                  {periodo.xFuturo !== null && (
                    <rect x={pc(periodo.x1)} y="18" width={larg(periodo.x1, periodo.xFuturo)} height="14" fill="url(#forma-hachura)" stroke="var(--cor-energia)" strokeWidth="1" data-futuro="" />
                  )}
                  {quebras.map((q) => (
                    <svg key={q.data} x={pc(q.x)} y="25" overflow="visible" data-quebra="">
                      <path d="M0 -8 L8 0 L0 8 L-8 0 Z" fill="var(--cor-papel)" stroke="var(--cor-carvao)" strokeWidth="1.5" />
                    </svg>
                  ))}
                  <line x1={pc(eixo.xHoje)} x2={pc(eixo.xHoje)} y1="12" y2="40" stroke="var(--cor-carvao)" strokeWidth="1.5" strokeDasharray="3 3" />
                  <text x={pc(eixo.xHoje)} y="9" textAnchor={hojeADireita ? "end" : "start"} fill="var(--cor-carvao-muted)">
                    {tx("esta publicação", "this publication")}
                  </text>
                  {eixo.marcas.map((m) => (
                    <g key={`${m.ano}-${m.mes}`}>
                      <line x1={pc(m.x)} x2={pc(m.x)} y1="34" y2="40" stroke="var(--cor-mineral)" strokeWidth="1" />
                      <text x={pc(m.x)} y="56" textAnchor={m.x < 0.06 ? "start" : m.x > 0.94 ? "end" : "middle"} fill="var(--cor-mineral)" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {rotuloDaMarca(m)}
                      </text>
                    </g>
                  ))}
                </svg>
                <ul className="t-meta mt-2 flex flex-wrap gap-x-5 gap-y-1 text-carvao-muted" data-legenda="">
                  <li className="inline-flex items-center gap-2">
                    <svg width="16" height="12" aria-hidden="true" focusable="false" className="shrink-0">
                      <rect width="16" height="12" fill="var(--cor-energia)" />
                    </svg>
                    {tx("referências publicadas", "published references")}
                  </li>
                  {periodo.xFuturo !== null && (
                    <li className="inline-flex items-center gap-2">
                      <svg width="16" height="12" aria-hidden="true" focusable="false" className="shrink-0">
                        <rect x="0.5" y="0.5" width="15" height="11" fill="url(#forma-hachura)" stroke="var(--cor-energia)" strokeWidth="1" />
                      </svg>
                      {tx("referências posteriores à data desta publicação", "references later than the date of this publication")}
                    </li>
                  )}
                  {quebras.length > 0 && (
                    <li className="inline-flex items-center gap-2">
                      <svg width="16" height="16" viewBox="-9 -9 18 18" aria-hidden="true" focusable="false" className="shrink-0">
                        <path d="M0 -8 L8 0 L0 8 L-8 0 Z" fill="var(--cor-papel)" stroke="var(--cor-carvao)" strokeWidth="1.5" />
                      </svg>
                      <span>
                        {tx(quebras.length === 1 ? "mudança metodológica em" : "mudanças metodológicas em", quebras.length === 1 ? "methodological change on" : "methodological changes on")}{" "}
                        {quebras.map((q) => dataBR(q.data)).join("; ")}
                      </span>
                    </li>
                  )}
                </ul>
                {lacunas && (
                  <p className="t-meta mt-2 max-w-prose2 text-carvao-muted" data-lacunas="">
                    {lacunas}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="mt-1 max-w-prose2 font-serif text-xl leading-snug text-carvao" data-sem-periodo="">
                  {semPeriodo.charAt(0).toUpperCase() + semPeriodo.slice(1)}.
                </p>
                <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">
                  {tx(
                    "Sem primeira e última referência registradas, não há régua de período a desenhar; as datas ao lado e as etapas abaixo continuam valendo.",
                    "With no first and last reference recorded, there is no period ruler to draw; the dates alongside and the stages below still apply.",
                  )}
                </p>
              </>
            )}
          </Parte>

          {eventos.length > 0 && (
            <Parte id="atualidade" rotulo={periodo ? tx("O fim da régua, ampliado", "The end of the ruler, enlarged") : tx("As últimas datas", "The latest dates")}>
              <ol className="mt-2 border-b border-linha">
                {eventos.map((e) => (
                  <li key={e.id} className="grid grid-cols-1 items-center gap-x-4 border-t border-linha py-1.5 sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]" data-evento={e.id}>
                    <span className="flex items-baseline gap-2 text-sm leading-snug text-carvao">
                      <span className="translate-y-[3px]">
                        <Glifo id={e.id} />
                      </span>
                      <span className="min-w-0">
                        {rotulos[e.id]}
                        <span className="block text-carvao-muted [font-variant-numeric:lining-nums_tabular-nums]">
                          {dataBR(e.dia)}
                          {e.id === "prazo" && atraso ? tx(` · ${plural(atraso.dias, "dia", "dias")} além do prazo`, ` · ${plural(atraso.dias, "day", "days")} past the deadline`) : ""}
                        </span>
                      </span>
                    </span>
                    <svg width="100%" height="26" aria-hidden="true" focusable="false" className="block overflow-visible">
                      <line x1={pc(0)} x2={pc(1)} y1="13" y2="13" stroke="var(--cor-linha)" strokeWidth="1" />
                      {e.id === "prazo" && atraso && (
                        <rect x={pc(atraso.x0)} y="8" width={larg(atraso.x0, atraso.x1)} height="10" fill="url(#forma-hachura-aviso)" stroke="var(--cor-aviso)" strokeWidth="1" data-atraso="" />
                      )}
                      <svg x={pc(e.x)} y="13" overflow="visible">
                        <Marca id={e.id} />
                      </svg>
                    </svg>
                  </li>
                ))}
              </ol>
              {atraso && (
                <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute">
                  <defs>
                    <pattern id="forma-hachura-aviso" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <line x1="0" y1="0" x2="0" y2="6" stroke="var(--cor-aviso)" strokeWidth="2" />
                    </pattern>
                  </defs>
                </svg>
              )}
              <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">
                {tx(
                  "Cada linha é uma data, na ordem do tempo; a distância entre as marcas é proporcional aos dias entre elas.",
                  "Each row is a date, in chronological order; the distance between the marks is proportional to the days between them.",
                )}
              </p>
            </Parte>
          )}
        </div>

        <Parte id="escada" rotulo={tx("Do portal da fonte à página: as etapas deste conjunto", "From the source portal to the page: the stages of this dataset")}>
          <ol className="mt-3 grid gap-y-0 sm:grid-cols-5 sm:gap-x-4">
            {etapas.map((e, i) => {
              const ok = e.situacao === "sim";
              const proximaOk = etapas[i + 1]?.situacao === "sim";
              const ultima = i === etapas.length - 1;
              // na última etapa, o leitor comum quer saber onde o dado aparece; os nomes de arquivo das bases ficam em Analisar, mais abaixo
              const detalhe =
                e.id === "publicado" && ok && paginas > 0
                  ? tx(`alimenta ${plural(paginas, "página do observatório, listada", "páginas do observatório, listadas")} mais abaixo.`, `feeds ${plural(paginas, "observatory page, listed", "observatory pages, listed")} further down.`)
                  : e.detalhe;
              return (
                <li key={e.id} className="relative min-w-0 pb-5 pl-9 sm:pb-0 sm:pl-0 sm:pt-9" data-etapa={e.id} data-situacao={e.situacao}>
                  {/* o fio que liga uma etapa à seguinte: vertical no celular, horizontal a partir de 640 px; tracejado quando a seguinte não foi alcançada */}
                  {!ultima && (
                    <span
                      aria-hidden="true"
                      className={`absolute left-[10px] top-6 bottom-0 border-l-2 sm:bottom-auto sm:left-6 sm:right-[-1rem] sm:top-[10px] sm:border-l-0 sm:border-t-2 ${proximaOk ? "border-energia" : "border-dashed border-mineral"}`}
                    />
                  )}
                  <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" focusable="false" className="absolute left-0 top-0">
                    {ok ? (
                      <>
                        <circle cx="11" cy="11" r="10" fill="var(--cor-energia)" />
                        <path d="M6.2 11.4 L9.7 14.7 L15.8 7.6" fill="none" stroke="var(--cor-papel)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </>
                    ) : (
                      <circle cx="11" cy="11" r="9.25" fill="var(--cor-papel)" stroke="var(--cor-mineral)" strokeWidth="1.5" strokeDasharray="3 3" />
                    )}
                  </svg>
                  <p className="text-sm font-medium leading-snug text-carvao">
                    {e.rotulo}
                    <span className="sr-only">{ok ? tx(": etapa alcançada.", ": stage reached.") : e.situacao === "falhou" ? tx(": a verificação falhou.", ": the verification failed.") : tx(": etapa não alcançada.", ": stage not reached.")}</span>
                  </p>
                  <p className="t-meta mt-1 text-carvao-muted [overflow-wrap:anywhere]">{detalhe.charAt(0).toUpperCase() + detalhe.slice(1)}</p>
                </li>
              );
            })}
          </ol>
        </Parte>

        <figcaption className="t-meta max-w-prose2 text-mineral">
          {tx(
            `Datas, contagens e etapas lidas da publicação de dados do observatório de ${dataBR(forma.hoje)} e do catálogo; o desenho não recalcula prazo nem atraso.`,
            `Dates, counts and stages read from the observatory's data publication of ${dataBR(forma.hoje)} and from the catalog; the drawing does not recompute deadlines or delays.`,
          )}
        </figcaption>
      </figure>
    </SecaoDoPainel>
  );
}
