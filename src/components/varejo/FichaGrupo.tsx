import Link from "next/link";
import { TabelaDados } from "@/components/painel";
import { diaBr, mesDaData, num, pct, reais, reaisDeMilhoes, textoCurado } from "@/lib/varejo/formato";
import {
  eventosOrdenados,
  naturezaCurada,
  periodoDe,
  rankingContraCvm,
  reapresentacoes,
  serieComparavel,
  seriesDaFicha,
  TIPO_EVENTO,
  urlSegura,
  type NaturezaCurada,
} from "@/lib/varejo/grupos";
import type { Demonstracao, EmpresaGold, EventoFicha, FonteCuradoria, Operacional } from "@/lib/varejo/tipos";
import { LINK } from "./comum";
import { ColunasPequenas, LegendaDasColunas } from "./figuras/ColunasPequenas";
import { COR_RECEITA, COR_VOLUME, HACHURA, HACHURA_AUSENCIA } from "./figuras/escala";
import { LogoEmpresa } from "./LogoEmpresa";
import { FonteDocumento, MarcaNatureza, NaoDivulgado } from "./grupos-comum";

/* ------------------------------------------------------------------ demonstrações */

/**
 * Pequenos múltiplos das demonstrações: um gráfico por indicador, todos com os mesmos exercícios na horizontal, colunas a partir do
 * zero, valor escrito em cada coluna, prejuízo e caixa consumido abaixo do zero no tom de aviso com hachura, exercício sem
 * demonstração como lacuna desenhada e a reapresentação marcada no próprio gráfico (ponto vazado no valor publicado, cheio no
 * republicado). A dívida líquida e o passivo de arrendamento dividem o último gráfico, porque têm a mesma unidade e se leem juntos.
 */
export function GraficosDaCompanhia({ emp, anos }: Readonly<{ emp: EmpresaGold; anos: readonly number[] }>) {
  const series = seriesDaFicha(emp, anos);
  const todos = series.flatMap((x) => [...x.pontos, ...(x.par?.pontos ?? [])]);
  return (
    <div data-grafico="pequenos-multiplos" data-graficos-companhia="">
      <LegendaDasColunas reapresentacao={todos.some((p) => p.reapresentado !== null)} negativos={todos.some((p) => (p.valor ?? 0) < 0)} lacunas={series[0].pontos.some((p) => p.valor === null)} />
      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-9 lg:grid-cols-4 lg:gap-x-10">
        {series.map((x) => (
          <div key={x.id} className={`min-w-0 ${x.par ? "col-span-2" : ""}`} data-indicador={x.id}>
            <ColunasPequenas
              titulo={x.rotulo}
              unidade={x.unidade}
              casas={x.casas}
              rotulos={x.par ? "todos" : "pontas"}
              rotuloPar={x.par?.rotulo}
              colunas={x.pontos.map((p, i) => ({ rotulo: String(p.exercicio), valor: p.valor, reapresentado: p.reapresentado, ...(x.par ? { par: x.par.pontos[i].valor } : {}) }))}
            />
          </div>
        ))}
      </div>
      <p className="t-meta mt-4 text-carvao-muted sm:hidden">No celular, o valor vai escrito no primeiro e no último exercício; os demais estão na tabela logo abaixo.</p>
    </div>
  );
}

/** As mesmas molduras dos pequenos múltiplos, vazias e hachuradas: o grupo não publica demonstração, e a ausência é o estado desenhado. */
export function DemonstracoesNaoDivulgadas({ rotulos }: Readonly<{ rotulos: readonly string[] }>) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4 lg:gap-x-10" data-financeiro-nao-divulgado="">
      {rotulos.map((rotulo) => (
        <div key={rotulo} className="min-w-0">
          <dt className="text-sm font-medium leading-snug text-carvao">{rotulo}</dt>
          <dd className="mt-2">
            <span aria-hidden="true" className="block h-16" style={{ backgroundImage: HACHURA_AUSENCIA, boxShadow: "inset 0 0 0 1px var(--cor-linha)" }} />
            <span className="mt-1.5 block text-sm">
              <NaoDivulgado />
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Os exercícios em que a demonstração seguinte trouxe outro valor: os dois números lado a lado, com a marca "reapresentado". */
export function Reapresentacoes({ emp }: Readonly<{ emp: EmpresaGold }>) {
  const linhas = reapresentacoes(emp);
  if (linhas.length === 0) return null;
  return (
    <div className="border-t border-linha pt-5" data-reapresentacoes={linhas.length}>
      <h3 className="t-h3 text-carvao">Valores reapresentados</h3>
      <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">
        A demonstração do exercício seguinte republicou estes valores com outro número, em geral porque a companhia vendeu ou encerrou um negócio e o separou do resultado, ou porque corrigiu o que havia publicado. Os gráficos
        usam o valor publicado no próprio exercício.
      </p>
      {linhas.length <= 2 ? (
        <ul className="mt-4 grid gap-x-10 gap-y-3 md:grid-cols-2">
          {linhas.map((r) => (
            <li key={`${r.exercicio}-${r.campo}`} className="border-t border-linha pt-3 text-sm text-carvao" data-reapresentado={r.exercicio}>
              <span className="rotulo mr-2 inline-flex border border-carvao-muted px-1.5 py-0.5 text-carvao">reapresentado</span>
              <span className="font-medium">
                {r.campo} de {r.exercicio}
              </span>
              <span className="mt-1 block tabular-nums">
                Publicado: {reais(r.publicado, 2)}. Reapresentado no exercício seguinte: {reais(r.reapresentado, 2)}.
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <details data-reapresentacoes-recolhidas={linhas.length}>
          <summary className={RESUMO_MAIS}>
            Ver os {linhas.length} valores reapresentados, de {linhas[0].exercicio} a {linhas[linhas.length - 1].exercicio}, com o publicado e o reapresentado
          </summary>
          <ul className="mt-4 grid gap-x-10 gap-y-3 md:grid-cols-2">
            {linhas.map((r) => (
              <li key={`${r.exercicio}-${r.campo}`} className="border-t border-linha pt-3 text-sm text-carvao" data-reapresentado={r.exercicio}>
                <span className="rotulo mr-2 inline-flex border border-carvao-muted px-1.5 py-0.5 text-carvao">reapresentado</span>
                <span className="font-medium">
                  {r.campo} de {r.exercicio}
                </span>
                <span className="mt-1 block tabular-nums">
                  Publicado: {reais(r.publicado, 2)}. Reapresentado no exercício seguinte: {reais(r.reapresentado, 2)}.
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** O link "abrir a demonstração original na CVM" de cada exercício e do último trimestre. */
export function DocumentosNaCvm({ emp, anos }: Readonly<{ emp: EmpresaGold; anos: readonly number[] }>) {
  const itens = anos.map((a) => ({ rotulo: String(a), p: periodoDe(emp, a) }));
  const tri = emp.ultimo_trimestre;
  return (
    <div className="border-t border-linha pt-5" data-documentos-cvm="">
      <h3 className="t-h3 text-carvao">Abrir a demonstração original na CVM</h3>
      <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-0 text-sm">
        {itens.map(({ rotulo, p }) => {
          const url = urlSegura(p?.documento?.link);
          return (
            <li key={rotulo}>
              {url ? (
                <a href={url} rel="noopener noreferrer" target="_blank" className={`inline-flex min-h-[44px] items-center ${LINK}`} data-documento-cvm={rotulo}>
                  Exercício de {rotulo}
                  {p?.documento?.recebido_em ? <span className="ml-1 text-carvao-muted">(entregue em {diaBr(p.documento.recebido_em)})</span> : null}
                </a>
              ) : (
                <span className="inline-flex min-h-[44px] items-center text-carvao-muted">
                  Exercício de {rotulo}: <NaoDivulgado>{p ? "documento sem endereço na base" : "sem demonstração na base"}</NaoDivulgado>
                </span>
              )}
            </li>
          );
        })}
        {urlSegura(tri?.documento?.link) && (
          <li>
            <a href={urlSegura(tri?.documento?.link)!} rel="noopener noreferrer" target="_blank" className={`inline-flex min-h-[44px] items-center ${LINK}`} data-documento-cvm="trimestre">
              Informações trimestrais de {mesDaData(tri?.data_base)}
            </a>
          </li>
        )}
      </ul>
    </div>
  );
}

const biOuNulo = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v / 1e9 : null);
const nOuNulo = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** "acumulado de janeiro a 09/2026" → "janeiro a set/2026". */
const periodoDoTrimestre = (dataBase: string | undefined, anoAnterior = false): string => {
  if (!dataBase) return "período não informado";
  const [a, m] = dataBase.split("-");
  return `janeiro a ${mesDaData(`${Number(a) - (anoAnterior ? 1 : 0)}-${m}`)}`;
};

/** O acumulado do ano até o último trimestre entregue, ao lado do mesmo período do ano anterior. */
export function UltimoTrimestre({ emp }: Readonly<{ emp: EmpresaGold }>) {
  const t = emp.ultimo_trimestre;
  if (!t?.atual) {
    return (
      <p className="t-meta pb-3 text-carvao-muted" data-sem-trimestre="">
        Último trimestre: <NaoDivulgado>sem informações trimestrais desta companhia na base</NaoDivulgado>.
      </p>
    );
  }
  // nas informações trimestrais, o balanço comparativo é o de 31/12 do exercício anterior, não o do mesmo trimestre: fica fora da 2ª linha
  const linha = (rotulo: string, d: Demonstracao | null | undefined, comSaldos = true) => [
    rotulo,
    biOuNulo(d?.receita_liquida),
    nOuNulo(d?.margem_bruta_pct),
    nOuNulo(d?.margem_operacional_pct),
    biOuNulo(d?.lucro_liquido),
    biOuNulo(d?.caixa_operacional),
    typeof d?.capex === "number" ? Math.abs(d.capex) / 1e9 : null,
    comSaldos ? biOuNulo(d?.divida_liquida_sem_arrendamento) : null,
    comSaldos ? biOuNulo(d?.passivo_arrendamento) : null,
  ];
  return (
    <div className="pb-2 pt-1" data-ultimo-trimestre={t.data_base}>
      <TabelaDados
        recolhida={false}
        idioma="pt"
        tituloVisivel={`Depois do último exercício: ${periodoDoTrimestre(t.data_base)}`}
        lead={`O acumulado do ano até ${mesDaData(t.data_base)}, último trimestre entregue à CVM, contra o mesmo período do ano anterior. Não é um exercício completo e não entra nos gráficos acima.`}
        titulo={`${emp.nome}: acumulado de ${periodoDoTrimestre(t.data_base)} e de ${periodoDoTrimestre(t.data_base, true)}`}
        colunas={["Período", "Receita líquida, R$ bilhões", "Margem bruta, %", "Margem operacional, %", "Lucro líquido, R$ bilhões", "Caixa operacional, R$ bilhões", "Investimentos, R$ bilhões", "Dívida líquida sem arrendamento, R$ bilhões", "Passivo de arrendamento, R$ bilhões"]}
        linhas={[linha(periodoDoTrimestre(t.data_base), t.atual), linha(periodoDoTrimestre(t.data_base, true), t.mesmo_periodo_ano_anterior, false)]}
        casas={[null, 1, 1, 1, 2, 1, 2, 1, 1]}
        limite={2}
        fixarPrimeiraColuna
        ausencia={Object.fromEntries(["Dívida líquida sem arrendamento, R$ bilhões", "Passivo de arrendamento, R$ bilhões"].map((k) => [k, "ver o fim do exercício anterior"]))}
        nota={`Base: demonstrações ${t.atual.base === "individual" ? "individuais" : "consolidadas"}. Dívida e arrendamento são saldos em ${mesDaData(t.data_base)}; nas informações trimestrais o balanço de comparação é o de 31 de dezembro do exercício anterior, que já está nos gráficos.`}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ indicadores operacionais */

/** Valor de um indicador operacional na unidade que a curadoria registrou, no padrão brasileiro. */
export function valorNaUnidade(valor: number, unidade: string | undefined): string {
  const u = (unidade ?? "").trim();
  const casas = Number.isInteger(valor) ? 0 : Math.abs(valor) < 100 ? (Number.isInteger(valor * 10) ? 1 : 2) : 1;
  const numero = num(valor, casas);
  if (u === "%") return `${numero}%`;
  const moeda = /^(R\$|US\$)\s*(.*)$/.exec(u);
  if (moeda) return `${moeda[1]} ${numero}${moeda[2] ? ` ${moeda[2]}` : ""}`;
  const SINGULAR: Record<string, string> = { lojas: "loja", pessoas: "pessoa", restaurantes: "restaurante", unidades: "unidade", pontos: "ponto", vezes: "vez" };
  return u ? `${numero} ${Math.abs(valor) === 1 ? SINGULAR[u] ?? u : u}` : numero;
}

/**
 * Uma série operacional da curadoria (vendas nas mesmas lojas, número de lojas, aberturas): os valores por período, a natureza
 * de cada um, a nota e o documento de origem com a página. Os períodos são os que a empresa divulgou e nem sempre têm a mesma
 * duração (um trimestre ao lado de um ano), por isso a série vem em lista, não em gráfico de eixo contínuo.
 */
export function SerieOperacional({ o }: Readonly<{ o: Operacional }>) {
  const valores = (o.valores ?? []).filter((v) => typeof v.periodo === "string" && v.periodo.trim());
  const naturezas = Array.from(new Set(valores.map((v) => naturezaCurada(v.natureza))));
  const unica: NaturezaCurada | null = naturezas.length === 1 ? naturezas[0] : null;
  const notas = valores.filter((v) => typeof v.nota === "string" && v.nota.trim());
  const nota = textoCurado(o.nota);
  // três ou mais valores da mesma periodicidade viram minigráfico; os demais períodos (um semestre, um "até agosto") seguem em pares
  const serie = unica ? serieComparavel(o) : null;
  const noGrafico = new Set(serie?.pontos.map((p) => p.periodo) ?? []);
  const consecutivos = !serie || serie.pontos.every((p, i) => i === 0 || p.ordem - serie.pontos[i - 1].ordem === 1);
  const emPares = serie ? valores.filter((v) => !noGrafico.has((v.periodo ?? "").trim())) : valores;
  const casasDaSerie = serie ? (serie.pontos.every((p) => Number.isInteger(p.valor)) ? 0 : serie.pontos.every((p) => Math.abs(p.valor) < 100) ? 1 : 0) : 0;
  return (
    <article className="border-t border-linha pt-4" data-serie-operacional="">
      <h3 className="text-base font-medium leading-snug text-carvao">
        {textoCurado(o.indicador)}
        {unica && (
          <span className="t-meta ml-3 font-normal text-carvao-muted">
            <MarcaNatureza natureza={unica} />
          </span>
        )}
      </h3>
      {serie && (
        <div className="mt-3 max-w-md" data-serie-em-grafico={serie.periodicidade}>
          <ColunasPequenas titulo={serie.periodicidade === "anual" ? (consecutivos ? "Por exercício" : "Por exercício, anos não consecutivos") : consecutivos ? "Por trimestre" : "Trimestres divulgados, não consecutivos"} unidade={textoCurado(o.unidade) || "unidade não informada"} casas={casasDaSerie} altura={84} colunas={serie.pontos.map((p) => ({ rotulo: p.periodo, valor: p.valor }))} descricao={`${textoCurado(o.indicador)}: ${serie.pontos.map((p) => `${p.periodo}, ${valorNaUnidade(p.valor, o.unidade)}`).join("; ")}.`} />
        </div>
      )}
      {serie && emPares.length > 0 && <p className="t-meta mt-3 text-carvao-muted">Outros períodos divulgados, que não entram no mesmo eixo:</p>}
      {valores.length > 0 ? (
        <dl className={`flex flex-wrap gap-x-8 gap-y-3 ${serie ? (emPares.length ? "mt-1" : "hidden") : "mt-3"}`}>
          {emPares.map((v, i) => (
            <div key={`${v.periodo}-${i}`} className="min-w-[5.5rem]">
              <dt className="t-meta text-carvao-muted">{textoCurado(v.periodo)}</dt>
              <dd className="numero-p mt-0.5 text-carvao">{typeof v.valor === "number" ? valorNaUnidade(v.valor, o.unidade) : <NaoDivulgado />}</dd>
              {!unica && (
                <dd className="t-meta text-carvao-muted">
                  <MarcaNatureza natureza={naturezaCurada(v.natureza)} curta />
                </dd>
              )}
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-sm">
          <NaoDivulgado>nenhum valor divulgado para esta série</NaoDivulgado>
        </p>
      )}
      {notas.length > 0 && (
        <ul className="t-meta mt-3 max-w-prose2 space-y-1 text-carvao-muted">
          {notas.map((v, i) => (
            <li key={i}>
              <span className="text-carvao">{textoCurado(v.periodo)}:</span> {textoCurado(v.nota)}
            </li>
          ))}
        </ul>
      )}
      {nota && nota.length <= 260 && <p className="t-meta mt-3 max-w-prose2 text-carvao-muted">{nota}</p>}
      {nota && nota.length > 260 && (
        <details className="mt-2 max-w-prose2">
          <summary className="t-meta inline-flex min-h-[44px] cursor-pointer items-center text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">Como a série foi montada e o que ela não cobre</summary>
          <p className="t-meta pb-2 text-carvao-muted">{nota}</p>
        </details>
      )}
      <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">
        <FonteDocumento f={o.fonte} prefixo="Fonte: " />
      </p>
    </article>
  );
}

/* ------------------------------------------------------------------ linha do tempo */

/** Quantos eventos e quantas séries operacionais ficam à vista; o resto segue no HTML, recolhido, para a ficha caber no celular. */
export const EVENTOS_A_VISTA = 2;
export const SERIES_A_VISTA = 1;
export const RESUMO_MAIS = "inline-flex min-h-[44px] cursor-pointer items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao";

/** As séries operacionais: as primeiras à vista e as demais recolhidas, todas no HTML. */
export function SeriesOperacionais({ series }: Readonly<{ series: readonly Operacional[] }>) {
  const resto = series.slice(SERIES_A_VISTA);
  return (
    <div data-operacionais={series.length}>
      <div className="space-y-6">
        {series.slice(0, SERIES_A_VISTA).map((o, i) => (
          <SerieOperacional key={`${o.indicador}-${i}`} o={o} />
        ))}
      </div>
      {resto.length > 0 && (
        <details className="mt-6 border-t border-linha" data-series-recolhidas={resto.length}>
          <summary className={RESUMO_MAIS}>
            Ver as outras {resto.length} séries: {resto.slice(0, 3).map((o) => textoCurado(o.indicador).toLowerCase()).join("; ")}
            {resto.length > 3 ? ` e mais ${resto.length - 3}` : ""}
          </summary>
          <div className="space-y-6 pt-2">
            {resto.map((o, i) => (
              <SerieOperacional key={`${o.indicador}-${i}`} o={o} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/** Forma de cada tipo de evento, igual na faixa do tempo, na legenda e no trilho da lista: a leitura não depende de cor. */
function GlifoDoEvento({ tipo, className = "" }: Readonly<{ tipo: string | undefined; className?: string }>) {
  const t = tipo && TIPO_EVENTO[tipo] ? tipo : "outro";
  const comum = { stroke: "var(--cor-carvao)", strokeWidth: 1.75 } as const;
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" className={`shrink-0 ${className}`} focusable="false">
      {t === "aquisicao" && <circle cx="7" cy="7" r="5" fill="var(--cor-carvao)" {...comum} />}
      {t === "desinvestimento" && <circle cx="7" cy="7" r="5" fill="var(--cor-papel)" {...comum} />}
      {t === "reapresentacao" && <path d="M7 1.2 12.8 7 7 12.8 1.2 7Z" fill="var(--cor-papel)" {...comum} />}
      {t === "recuperacao_judicial" && <rect x="2" y="2" width="10" height="10" fill="var(--cor-carvao)" {...comum} />}
      {t === "fechamento_de_capital" && <rect x="2" y="2" width="10" height="10" fill="var(--cor-papel)" {...comum} />}
      {t === "mudanca_de_controle" && <path d="M7 1.5 13 12.5H1Z" fill="var(--cor-carvao)" {...comum} strokeLinejoin="round" />}
      {t === "outro" && <circle cx="7" cy="7" r="2.75" fill="var(--cor-mineral)" stroke="var(--cor-mineral)" strokeWidth="1" />}
    </svg>
  );
}

/** Posição de uma data "AAAA-MM" (ou "AAAA-MM-DD") em anos decimais; null quando a data não tem ano e mês. */
const anoDecimal = (data: string | undefined): number | null => {
  const m = /^(\d{4})-(\d{2})/.exec(data ?? "");
  return m ? Number(m[1]) + (Number(m[2]) - 1) / 12 : null;
};

/**
 * A linha do tempo desenhada: uma faixa com os anos na horizontal e uma marca por evento, na forma do tipo dele (aquisição,
 * desinvestimento, recuperação judicial, mudança de controle, reapresentação, fechamento de capital e outros), com a legenda das
 * formas. Eventos do mesmo mês empilham. Abaixo, a lista do mais recente para o mais antigo, com a mesma marca num trilho vertical,
 * o texto e a fonte de cada evento; os mais antigos ficam recolhidos, no HTML. No celular a faixa some e fica o trilho.
 */
export function LinhaDoTempo({ eventos }: Readonly<{ eventos: readonly EventoFicha[] }>) {
  if (eventos.length === 0) {
    return (
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-sem-eventos="">
        A curadoria não registrou, com documento de origem, aquisição, desinvestimento, recuperação judicial, reapresentação ou mudança de controle deste grupo no período coberto. Ausência de registro não é prova de que nada
        ocorreu.
      </p>
    );
  }
  const ordenados = eventosOrdenados([...eventos]);
  const item = (ev: EventoFicha, i: number) => (
    <li key={i} className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2 pb-5 last:pb-1 sm:grid-cols-[1.75rem_6rem_minmax(0,1fr)]" data-evento={ev.tipo ?? "outro"}>
      <span aria-hidden="true" className="absolute bottom-0 left-[6px] top-0 w-px bg-linha" />
      <span className="relative mt-1 bg-papel py-0.5">
        <GlifoDoEvento tipo={ev.tipo} />
      </span>
      <p className="numero-p col-start-2 text-carvao">
        <time dateTime={/^\d{4}-\d{2}/.test(ev.data ?? "") ? ev.data : undefined}>{ev.data ? mesDaData(ev.data) : "sem data"}</time>
      </p>
      <div className="col-start-2 min-w-0 sm:col-start-3">
        <p className="rotulo text-mineral">{TIPO_EVENTO[ev.tipo ?? "outro"] ?? TIPO_EVENTO.outro}</p>
        <p className="mt-1 text-sm leading-relaxed text-carvao">{textoCurado(ev.descricao)}</p>
        <p className="t-meta mt-1.5 text-carvao-muted">
          <FonteDocumento f={ev.fonte} prefixo="Fonte: " />
        </p>
      </div>
    </li>
  );
  const recentes = ordenados.slice(0, EVENTOS_A_VISTA);
  const anteriores = ordenados.slice(EVENTOS_A_VISTA);
  // a faixa: do janeiro do ano do primeiro evento ao dezembro do ano do último
  const datados = ordenados.map((ev) => ({ ev, t: anoDecimal(ev.data) })).filter((x): x is { ev: EventoFicha; t: number } => x.t !== null);
  const ini = datados.length ? Math.floor(Math.min(...datados.map((x) => x.t))) : 0;
  const fim = datados.length ? Math.floor(Math.max(...datados.map((x) => x.t))) + 1 : 1;
  const pos = (t: number) => (100 * (t - ini)) / (fim - ini);
  const pilha = new Map<number, number>();
  const marcas = [...datados].reverse().map((x) => {
    const andar = pilha.get(x.t) ?? 0;
    pilha.set(x.t, andar + 1);
    return { ...x, andar };
  });
  const andares = Math.max(1, ...pilha.values());
  const tipos = Array.from(new Set(ordenados.map((ev) => (ev.tipo && TIPO_EVENTO[ev.tipo] ? ev.tipo : "outro"))));
  const anosDaFaixa = Array.from({ length: fim - ini + 1 }, (_, i) => ini + i);
  const passo = Math.max(1, Math.ceil(anosDaFaixa.length / 12));
  return (
    <div data-linha-do-tempo={eventos.length}>
      <ul className="t-meta flex flex-wrap gap-x-5 gap-y-1 text-carvao-muted" aria-label="Tipos de evento">
        {tipos.map((t) => (
          <li key={t} className="flex items-center gap-2">
            <GlifoDoEvento tipo={t} />
            {TIPO_EVENTO[t]}
          </li>
        ))}
      </ul>
      {datados.length > 1 && (
        <div className="mt-5 hidden px-2 md:block" aria-hidden="true" data-faixa-do-tempo={datados.length}>
          <div className="relative" style={{ height: 18 * andares + 8 }}>
            {marcas.map((m, i) => (
              <span key={i} className="absolute -translate-x-1/2" style={{ left: `${pos(m.t + 1 / 24)}%`, bottom: 4 + 18 * m.andar }} title={`${mesDaData(m.ev.data)}: ${TIPO_EVENTO[m.ev.tipo ?? "outro"] ?? TIPO_EVENTO.outro}`}>
                <GlifoDoEvento tipo={m.ev.tipo} className="block" />
              </span>
            ))}
          </div>
          <div className="relative h-px bg-carvao">
            {anosDaFaixa.map((a) => (
              <span key={a} className="absolute -top-1 h-[9px] w-px bg-carvao" style={{ left: `${pos(a)}%` }} />
            ))}
          </div>
          <div className="relative mt-1.5 h-4">
            {anosDaFaixa.slice(0, -1).filter((_, i) => i % passo === 0).map((a) => (
              <span key={a} className="absolute -translate-x-1/2 text-xs tabular-nums text-mineral" style={{ left: `${pos(a + 0.5)}%` }}>
                {a}
              </span>
            ))}
          </div>
        </div>
      )}
      <ol className="mt-6 max-w-3xl">{recentes.map(item)}</ol>
      {anteriores.length > 0 && (
        <details className="max-w-3xl border-t border-linha" data-eventos-anteriores={anteriores.length}>
          <summary className={RESUMO_MAIS}>
            Ver os {anteriores.length} eventos anteriores, até {mesDaData(anteriores[anteriores.length - 1].data)}
          </summary>
          <ol className="pt-2">{anteriores.map((ev, i) => item(ev, i + EVENTOS_A_VISTA))}</ol>
        </details>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ ranking × CVM */

/**
 * A venda do ranking ao lado da receita líquida da demonstração: dois números de definições diferentes, que não se subtraem
 * sem dizer. Com os dois no mesmo exercício, a página mostra quanto a receita líquida representa da venda do ranking.
 */
export function RankingContraCvm({ vendaMilhoes, natureza, anoRanking, fonteRanking, emp, motivoSemCvm }: Readonly<{
  vendaMilhoes: number | null;
  natureza: NaturezaCurada;
  anoRanking: string;
  fonteRanking: string;
  emp: EmpresaGold | null;
  motivoSemCvm: string;
}>) {
  const r = rankingContraCvm(vendaMilhoes, emp, anoRanking);
  const max = Math.max(r.venda_milhoes ?? 0, r.receita_milhoes ?? 0);
  const largura = (v: number | null) => (v === null || !(max > 0) ? 0 : (100 * v) / max);
  const estimado = natureza === "estimado_pela_fonte";
  const linha = (rotulo: string, valor: number | null, cor: string, hachura: boolean, ausencia: string, detalhe: React.ReactNode) => (
    <div className="grid gap-x-6 gap-y-1 border-t border-linha py-3 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      <dt className="text-sm font-medium leading-snug text-carvao">{rotulo}</dt>
      <dd className="min-w-0">
        <span className="flex items-center gap-3">
          {valor === null ? (
            <span aria-hidden="true" className="block h-6 flex-1" style={{ backgroundImage: HACHURA_AUSENCIA, boxShadow: "inset 0 0 0 1px var(--cor-linha)" }} />
          ) : (
            <span aria-hidden="true" className="block h-6 min-w-[2px]" style={{ width: `calc(${largura(valor)}% - ${(largura(valor) / 100) * 9}rem)`, background: cor, ...(hachura ? { backgroundImage: HACHURA } : {}) }} />
          )}
          <span className="numero-p shrink-0 whitespace-nowrap text-carvao">{valor === null ? <NaoDivulgado>{ausencia}</NaoDivulgado> : reaisDeMilhoes(valor)}</span>
        </span>
        <span className="t-meta mt-1.5 block text-carvao-muted">{detalhe}</span>
      </dd>
    </div>
  );
  return (
    <div data-ranking-contra-cvm="">
      <h3 className="t-h3 text-carvao">Venda no ranking e receita líquida na CVM, na mesma régua</h3>
      <dl className="mt-3 border-b border-linha">
        {linha(
          `Venda no ranking, ${anoRanking}`, r.venda_milhoes, COR_VOLUME, estimado, "fora do ranking",
          r.venda_milhoes === null ? "O método da fonte não atribui venda a este grupo." : <>Venda bruta ao consumidor, com impostos. <MarcaNatureza natureza={natureza} />. Fonte: {fonteRanking}.</>,
        )}
        {linha(
          `Receita líquida na CVM${r.exercicio ? `, ${r.exercicio}` : ""}`, r.receita_milhoes, COR_RECEITA, false, "não divulgado",
          r.exercicio ? <>Depois de impostos sobre a venda, devoluções e descontos; inclui receitas que não são venda de mercadoria. Demonstrações {r.base === "individual" ? "individuais" : "consolidadas"}. Fonte: CVM, Demonstrações Financeiras Padronizadas.</> : motivoSemCvm,
        )}
      </dl>
      {r.receita_milhoes !== null && r.venda_milhoes !== null && (
        <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao" data-explica-diferenca="">
          {r.razao_pct !== null && r.diferenca_milhoes !== null ? (
            <>
              No mesmo exercício, a receita líquida equivale a {pct(r.razao_pct)} da venda do ranking: {r.diferenca_milhoes >= 0 ? `${reaisDeMilhoes(r.diferenca_milhoes)} a menos` : `${reaisDeMilhoes(-r.diferenca_milhoes)} a mais`}. Os dois números medem coisas diferentes: o ranking
              conta o que o consumidor pagou, com impostos, só no varejo e só da venda própria; a demonstração conta o que ficou para a companhia depois dos impostos, em tudo o que ela fatura, inclusive atacado, serviços, comissões e
              crédito quando existem.
            </>
          ) : (
            <>
              Os dois números são de exercícios diferentes ({anoRanking} no ranking, {r.exercicio} na última demonstração anual da base) e por isso não são divididos um pelo outro. Além do ano, medem coisas diferentes: o ranking
              conta o que o consumidor pagou, com impostos; a demonstração, o que ficou para a companhia depois deles.
            </>
          )}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ fontes */

export function FontesDaFicha({ fontes }: Readonly<{ fontes: readonly FonteCuradoria[] }>) {
  return (
    <ol className="t-meta max-w-3xl list-decimal space-y-2 pl-5 text-carvao-muted" data-fontes-da-ficha={fontes.length}>
      {fontes.map((f, i) => (
        <li key={i}>
          <FonteDocumento f={f} />
        </li>
      ))}
    </ol>
  );
}

/** Concorrente com link quando há ficha (ou, sem ficha, quando é companhia aberta que entra no comparador). */
export function Concorrentes({ itens, hrefDe }: Readonly<{ itens: readonly { nome: string; slug?: string | null }[]; hrefDe: (slug: string | null | undefined) => string | null }>) {
  if (itens.length === 0) return <NaoDivulgado>a curadoria não listou concorrentes</NaoDivulgado>;
  return (
    <ul className="space-y-2">
      {itens.map((x) => {
        const href = hrefDe(x.slug);
        return (
          <li key={x.nome} className="flex items-center gap-3">
            {x.slug && <LogoEmpresa slug={x.slug} nome={x.nome} tamanho="p" decorativo semLogo="placa" />}
            <span className="min-w-0">
              {href ? (
                <Link href={href} prefetch={false} className={LINK}>
                  {x.nome}
                </Link>
              ) : (
                x.nome
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
