import Link from "next/link";
import { pontos, SEM_DADO, variacao } from "@/lib/varejo/formato";
import { eixo, linear } from "./geometria";
import { COR_RECEITA, COR_VOLUME } from "./escala";

export type LinhaHaltere = {
  id: string;
  nome: string;
  /** Crescimento real (volume) e nominal (receita), em %. */
  volume: number | null;
  receita: number | null;
  /** Volume menos a referência, em pontos percentuais. */
  contra: number | null;
  href?: string;
  selecionado?: boolean;
};

export type GrupoHaltere = {
  /** Título do grupo ("Atividades do varejo restrito"); some quando há um grupo só. */
  titulo?: string;
  /** Nome da referência ("Varejo restrito no Brasil") e a variação do volume dela: a linha vertical do grupo. */
  referencia: { nome: string; volume: number | null };
  linhas: readonly LinhaHaltere[];
};

/**
 * Halteres real × nominal: uma linha por atividade, com o crescimento do volume (círculo cheio, no azul da coleção) e o da receita
 * nominal (losango vazado, neutro) ligados por um traço. O comprimento do traço é a diferença entre os dois, que aproxima o efeito
 * dos preços. A linha vertical contínua é a variação do volume do varejo no Brasil, a referência do grupo; a coluna da direita traz a
 * distância de cada atividade até ela, em pontos percentuais. Todos os grupos usam o mesmo eixo.
 *
 * HTML no servidor: os nomes são links (abrem o segmento), os valores são texto ao lado de cada marca e, no celular, o nome ocupa a
 * linha de cima e a régua a de baixo, na largura toda. A leitura não depende da cor: as duas marcas têm formas diferentes.
 */
export function Halteres({ grupos, medida, rotuloLink = "Abrir", rotuloReferencia = "Volume do varejo no Brasil", rotuloContra = "Volume contra o Brasil" }: Readonly<{
  grupos: readonly GrupoHaltere[];
  /** "em 12 meses", "interanual", "no mês". */
  medida: string;
  rotuloLink?: string;
  /** O que é a linha vertical, na legenda, e o título da coluna de distância até ela. */
  rotuloReferencia?: string;
  rotuloContra?: string;
}>) {
  const todos = grupos.flatMap((g) => [g.referencia.volume, ...g.linhas.flatMap((l) => [l.volume, l.receita])]);
  const { min, max, marcas } = eixo(todos, { n: 5, incluir: 0 });
  const casasEixo = marcas.every((m) => Number.isInteger(m)) ? 0 : 1;
  // folga de cada lado para os valores escritos ao lado das marcas não saírem da régua
  const x = linear([min, max], [17, 83]);
  const Regua = ({ children }: { children: React.ReactNode }) => <div className="relative isolate h-full min-h-[2.75rem]">{children}</div>;
  return (
    <div data-grafico="halteres" data-figura-varejo="halteres" className="min-w-0">
      <ul className="t-meta flex flex-wrap gap-x-6 gap-y-1 text-carvao-muted" aria-label="Como ler">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ background: COR_VOLUME }} />
          Volume: crescimento real
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rotate-45 bg-papel" style={{ boxShadow: `inset 0 0 0 2px ${COR_RECEITA}` }} />
          Receita nominal: inclui os preços
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-4 w-px shrink-0 bg-carvao" />
          {rotuloReferencia}
        </li>
      </ul>

      {grupos.map((g, gi) => (
        <section key={g.referencia.nome} className={gi === 0 ? "mt-5" : "mt-8"} data-grupo-haltere={g.referencia.nome}>
          <div className="grid items-end gap-x-4 border-b border-carvao pb-1 md:grid-cols-[15rem_minmax(0,1fr)_7.5rem]">
            <h3 className="rotulo text-mineral">{g.titulo ?? "Atividade"}</h3>
            {/* eixo: as marcas e o nome da referência sobre a linha dela */}
            <div className="relative hidden h-9 md:block" aria-hidden="true">
              {marcas.map((m) => (
                <span key={m} className={`absolute bottom-0 -translate-x-1/2 text-xs tabular-nums ${m === 0 ? "text-carvao" : "text-mineral"}`} style={{ left: `${x(m)}%` }}>
                  {m === 0 ? "0" : variacao(m, casasEixo)}
                </span>
              ))}
              {g.referencia.volume !== null && (
                <span className={`absolute top-0 whitespace-nowrap text-xs text-carvao ${x(g.referencia.volume) > 60 ? "-translate-x-full pr-1.5" : "pl-1.5"}`} style={{ left: `${x(g.referencia.volume)}%` }}>
                  {g.referencia.nome}: {variacao(g.referencia.volume)}
                </span>
              )}
            </div>
            <p className="rotulo hidden text-right text-mineral md:block">{rotuloContra}</p>
          </div>
          {g.referencia.volume !== null && (
            <p className="t-meta mt-2 text-carvao md:hidden">
              Linha vertical: {g.referencia.nome}, {variacao(g.referencia.volume)} no volume. À direita de cada nome, a distância até ela.
            </p>
          )}
          <ol>
            {g.linhas.map((l) => {
              const semValores = l.volume === null && l.receita === null;
              const a = l.volume === null ? null : x(l.volume);
              const b = l.receita === null ? null : x(l.receita);
              const volumeADireita = a !== null && b !== null && a > b;
              // os valores escritos levam o fundo da linha por baixo, para a linha de referência não atravessar o número
              const fundo = l.selecionado ? "bg-marfim" : "bg-papel";
              const nome = (
                <>
                  {l.nome}
                  {l.href && <span className="sr-only">: {rotuloLink.toLowerCase()} o segmento</span>}
                </>
              );
              return (
                <li key={l.id} data-haltere={l.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-linha py-2 md:grid-cols-[15rem_minmax(0,1fr)_7.5rem] md:py-0 ${l.selecionado ? "bg-marfim" : ""}`}>
                  <p className="text-sm leading-snug text-carvao md:py-2">
                    {l.href ? (
                      <Link href={l.href} prefetch={false} className="inline-flex min-h-[44px] items-center underline decoration-linha underline-offset-4 [@media(hover:hover)]:hover:decoration-carvao md:min-h-0">
                        {nome}
                      </Link>
                    ) : (
                      nome
                    )}
                  </p>
                  <p className="text-right text-sm tabular-nums text-carvao md:order-3 md:pr-1">
                    {l.contra === null ? <span className="text-mineral">{SEM_DADO}</span> : pontos(l.contra)}
                  </p>
                  <div className="col-span-2 md:order-2 md:col-span-1 md:self-stretch">
                    <Regua>
                      <span aria-hidden="true" className="absolute inset-y-0 w-px bg-linha" style={{ left: `${x(0)}%` }} />
                      {g.referencia.volume !== null && <span aria-hidden="true" className="absolute inset-y-0 w-px bg-carvao" style={{ left: `${x(g.referencia.volume)}%` }} />}
                      {semValores ? (
                        <span className="absolute inset-y-0 left-0 flex items-center text-xs italic text-mineral">sem valor publicado para o período</span>
                      ) : (
                        <>
                          {a !== null && b !== null && <span aria-hidden="true" className="absolute top-1/2 h-[3px] -translate-y-1/2 bg-mineral-soft" style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(a - b)}%` }} />}
                          {b !== null && (
                            <>
                              <span aria-hidden="true" className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-papel" style={{ left: `${b}%`, boxShadow: `inset 0 0 0 2px ${COR_RECEITA}` }} />
                              <span className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-xs tabular-nums text-carvao-muted ${volumeADireita ? "-translate-x-full pr-2.5" : "pl-2.5"}`} style={{ left: `${b}%` }}>
                                <span aria-hidden="true" className={`absolute inset-y-0 -z-10 ${volumeADireita ? "left-[-2px] right-2" : "left-2 right-[-2px]"} ${fundo}`} />
                                <span className="sr-only">Receita nominal: </span>
                                {variacao(l.receita)}
                              </span>
                            </>
                          )}
                          {a !== null && (
                            <>
                              <span aria-hidden="true" className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${a}%`, background: COR_VOLUME }} />
                              <span className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-medium tabular-nums text-carvao ${volumeADireita ? "pl-2.5" : "-translate-x-full pr-2.5"}`} style={{ left: `${a}%` }}>
                                <span aria-hidden="true" className={`absolute inset-y-0 -z-10 ${volumeADireita ? "left-2 right-[-2px]" : "left-[-2px] right-2"} ${fundo}`} />
                                <span className="sr-only">Volume: </span>
                                {variacao(l.volume)}
                              </span>
                            </>
                          )}
                        </>
                      )}
                    </Regua>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      <p className="t-meta mt-3 text-carvao-muted">Variação {medida}, em %. O traço entre as duas marcas é a diferença entre receita e volume, em pontos percentuais, que aproxima o efeito dos preços.</p>
    </div>
  );
}
