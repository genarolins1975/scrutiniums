import Link from "next/link";
import { GraficoBarras, TabelaDados } from "@/components/painel";
import { diaBr, mesDaData, num, pct, reais, reaisDeMilhoes, textoCurado } from "@/lib/varejo/formato";
import {
  dividaLiquida,
  eventosOrdenados,
  INDICADORES_FICHA,
  naturezaCurada,
  passivoArrendamento,
  periodoDe,
  reapresentacoes,
  TIPO_EVENTO,
  urlSegura,
  type NaturezaCurada,
} from "@/lib/varejo/grupos";
import type { Demonstracao, EmpresaGold, EventoFicha, FonteCuradoria, Operacional } from "@/lib/varejo/tipos";
import { LINK } from "./comum";
import { FonteDocumento, MarcaNatureza, NaoDivulgado } from "./grupos-comum";

/* ------------------------------------------------------------------ demonstrações */

/**
 * Um gráfico pequeno por indicador, todos com os mesmos exercícios no eixo: barras a partir do zero, sem eixo duplo, e o
 * exercício sem demonstração como lacuna marcada ("sem dado"), nunca como zero. A dívida líquida e o passivo de arrendamento
 * dividem um gráfico porque têm a mesma unidade e se leem juntos.
 */
export function GraficosDaCompanhia({ emp, anos }: Readonly<{ emp: EmpresaGold; anos: readonly number[] }>) {
  return (
    <div className="grid gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-3" data-graficos-companhia="">
      {INDICADORES_FICHA.map((ind) => (
        <div key={ind.id} className="min-w-0" data-indicador={ind.id}>
          <GraficoBarras
            semTabela
            titulo={ind.rotulo}
            dados={anos.map((a) => {
              const p = periodoDe(emp, a);
              return { ano: String(a), valor: p ? ind.valor(p) : null };
            })}
            chaveCategoria="ano"
            series={[{ id: "valor", rotulo: ind.rotulo, cor: "var(--cor-gas)" }]}
            unidade={ind.unidade}
            casas={ind.casas}
            altura={210}
            rotulosValor
          />
        </div>
      ))}
      <div className="min-w-0 md:col-span-2 xl:col-span-3" data-indicador="divida">
        <GraficoBarras
          semTabela
          titulo="Dívida líquida sem arrendamento e passivo de arrendamento"
          dados={anos.map((a) => {
            const p = periodoDe(emp, a);
            return { ano: String(a), divida: dividaLiquida(p), arrendamento: passivoArrendamento(p) };
          })}
          chaveCategoria="ano"
          series={[
            { id: "divida", rotulo: "Dívida líquida sem arrendamento", cor: "var(--cor-gas)" },
            { id: "arrendamento", rotulo: "Passivo de arrendamento (aluguéis de longo prazo)", cor: "var(--serie-referencia)" },
          ]}
          unidade="R$ bilhões"
          casas={1}
          altura={240}
          rotulosValor
        />
      </div>
    </div>
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
      <p className="t-meta border-t border-linha pt-4 text-carvao-muted" data-sem-trimestre="">
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
    <div className="border-t border-linha pt-5" data-ultimo-trimestre={t.data_base}>
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
      {valores.length > 0 ? (
        <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
          {valores.map((v, i) => (
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

export function LinhaDoTempo({ eventos }: Readonly<{ eventos: readonly EventoFicha[] }>) {
  if (eventos.length === 0) {
    return (
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-sem-eventos="">
        A curadoria não registrou, com documento de origem, aquisição, desinvestimento, recuperação judicial, reapresentação ou mudança de controle deste grupo no período coberto. Ausência de registro não é prova de que nada
        ocorreu.
      </p>
    );
  }
  return (
    <ol className="max-w-3xl" data-linha-do-tempo={eventos.length}>
      {eventosOrdenados([...eventos]).map((ev, i) => (
        <li key={i} className="grid grid-cols-[5.5rem_1fr] gap-x-4 border-t border-linha py-4 sm:grid-cols-[7rem_1fr]" data-evento={ev.tipo ?? "outro"}>
          <p className="numero-p text-carvao">
            <time dateTime={/^\d{4}-\d{2}/.test(ev.data ?? "") ? ev.data : undefined}>{ev.data ? mesDaData(ev.data) : "sem data"}</time>
          </p>
          <div className="min-w-0">
            <p className="rotulo text-mineral">{TIPO_EVENTO[ev.tipo ?? "outro"] ?? TIPO_EVENTO.outro}</p>
            <p className="mt-1 text-sm leading-relaxed text-carvao">{textoCurado(ev.descricao)}</p>
            <p className="t-meta mt-1.5 text-carvao-muted">
              <FonteDocumento f={ev.fonte} prefixo="Fonte: " />
            </p>
          </div>
        </li>
      ))}
    </ol>
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
  const doAno = emp ? periodoDe(emp, Number(anoRanking)) : null;
  const p = doAno ?? (emp?.anuais.length ? emp.anuais[emp.anuais.length - 1] : null);
  const mesmoAno = Boolean(doAno);
  const razao = mesmoAno && vendaMilhoes && p?.receita_liquida ? (100 * p.receita_liquida) / (vendaMilhoes * 1e6) : null;
  return (
    <div className="border-t border-linha pt-5" data-ranking-contra-cvm="">
      <h3 className="t-h3 text-carvao">Venda no ranking e receita líquida na CVM</h3>
      <dl className="mt-4 grid gap-x-10 gap-y-5 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="rotulo text-mineral">Venda no ranking, {anoRanking}</dt>
          <dd className="numero-m mt-1 text-carvao">{vendaMilhoes === null ? <NaoDivulgado>fora do ranking</NaoDivulgado> : reaisDeMilhoes(vendaMilhoes)}</dd>
          <dd className="t-meta mt-1 text-carvao-muted">
            {vendaMilhoes === null ? "O método da fonte não atribui venda a este grupo." : <>Venda bruta ao consumidor, com impostos. <MarcaNatureza natureza={natureza} />. Fonte: {fonteRanking}.</>}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="rotulo text-mineral">Receita líquida na CVM{p ? `, ${p.exercicio}` : ""}</dt>
          <dd className="numero-m mt-1 text-carvao">{p?.receita_liquida != null ? reais(p.receita_liquida) : <NaoDivulgado />}</dd>
          <dd className="t-meta mt-1 text-carvao-muted">
            {p ? (
              <>
                Depois de impostos sobre a venda, devoluções e descontos; inclui receitas que não são venda de mercadoria. Demonstrações {p.base === "individual" ? "individuais" : "consolidadas"}. Fonte: CVM, Demonstrações
                Financeiras Padronizadas.
              </>
            ) : (
              motivoSemCvm
            )}
          </dd>
        </div>
      </dl>
      {p && vendaMilhoes !== null && (
        <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao" data-explica-diferenca="">
          {razao !== null ? (
            <>
              No mesmo exercício, a receita líquida equivale a {pct(razao)} da venda do ranking. Os dois números medem coisas diferentes: o ranking conta o que o consumidor pagou, com impostos, só no varejo e só da venda própria;
              a demonstração conta o que ficou para a companhia depois dos impostos, em tudo o que ela fatura, inclusive atacado, serviços, comissões e crédito quando existem.
            </>
          ) : (
            <>
              Os dois números são de exercícios diferentes ({anoRanking} no ranking, {p.exercicio} na última demonstração anual da base) e por isso não são divididos um pelo outro. Além do ano, medem coisas diferentes: o ranking
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
    <ul className="flex flex-wrap gap-x-5 gap-y-1">
      {itens.map((x) => {
        const href = hrefDe(x.slug);
        return (
          <li key={x.nome}>
            {href ? (
              <Link href={href} prefetch={false} className={LINK}>
                {x.nome}
              </Link>
            ) : (
              x.nome
            )}
          </li>
        );
      })}
    </ul>
  );
}
