import Link from "next/link";
import { abertura, cascataDoCaixa, partesDaPonte, reconciliacao, type EmpresaComparavel, type IdParte } from "@/lib/varejo/comparador";
import { diaBr, num, por100, reais, textoCurado } from "@/lib/varejo/formato";
import { naturezaCurada, nomeDoSegmento, urlSegura, valorOperacional } from "@/lib/varejo/grupos";
import type { EmpresaGold, FichaCuradoria, LinhaConta, PeriodoEmpresa } from "@/lib/varejo/tipos";
import { LINK } from "./comum";
import { valorNaUnidade } from "./FichaGrupo";
import { CascataCaixa, dominioDasCascatas } from "./figuras/CascataCaixa";
import { LogoEmpresa } from "./LogoEmpresa";
import { FonteDocumento, MarcaNatureza, NaoDivulgado } from "./grupos-comum";

export type Selecionada = { slug: string; emp: EmpresaGold; p: PeriodoEmpresa | null };

/** Cor de cada parte da ponte: neutros para o que consome, o acento da coleção só no lucro (as mesmas do modelo da entrada). */
export const COR_PARTE: Record<IdParte, `var(--serie-${string})` | "var(--cor-gas)"> = {
  custo: "var(--serie-4)",
  despesas: "var(--serie-2)",
  financeiro: "var(--serie-3)",
  impostos: "var(--serie-5)",
  outros: "var(--serie-6)",
  lucro: "var(--cor-gas)",
};

const colunas = (n: number) => (n >= 4 ? "md:grid-cols-2 xl:grid-cols-4" : n === 3 ? "md:grid-cols-3" : "md:grid-cols-2");

/** O estado de ausência de um exercício: diz o que falta, o que existe e oferece os exercícios que a companhia tem. */
function SemExercicio({ x, ano, hrefAno }: Readonly<{ x: Selecionada; ano: number; hrefAno: (ano: number) => string }>) {
  const tem = x.emp.anuais.map((a) => a.exercicio);
  return (
    <div className="bg-marfim px-4 py-4 text-sm leading-relaxed text-carvao" data-sem-exercicio={x.slug}>
      <p className="font-medium">Sem demonstração de {ano} na base.</p>
      <p className="mt-1 text-carvao-muted">
        {x.emp.nome} não tem o exercício de {ano} nos dados abertos da CVM usados aqui. A comparação não usa outro ano no lugar.{" "}
        {tem.length > 0 ? "Exercícios disponíveis para comparar as empresas no mesmo ano: " : "Nenhum exercício disponível."}
        {tem.map((a, i) => (
          <span key={a}>
            {i > 0 && ", "}
            <Link href={hrefAno(a)} prefetch={false} scroll={false} className={LINK}>
              {a}
            </Link>
          </span>
        ))}
        {tem.length > 0 && "."}
      </p>
    </div>
  );
}

function Cabeca({ x, ano }: Readonly<{ x: Selecionada; ano: number }>) {
  return (
    <header className="flex items-center gap-3">
      <LogoEmpresa slug={x.slug} nome={x.emp.nome} tamanho="p" decorativo semLogo="placa" />
      <div className="min-w-0">
        <h3 className="t-h3 text-carvao">{x.emp.nome}</h3>
        <p className="t-meta text-carvao-muted">
          Exercício de {ano}
          {x.p ? `, demonstração ${x.p.base === "individual" ? "individual" : "consolidada"}` : ""}
        </p>
      </div>
    </header>
  );
}

function LinkDaDemonstracao({ p, emp }: Readonly<{ p: PeriodoEmpresa; emp: EmpresaGold }>) {
  const url = urlSegura(p.documento?.link);
  return url ? (
    <a href={url} rel="noopener noreferrer" target="_blank" className={`inline-flex min-h-[44px] items-center text-sm ${LINK}`} data-demonstracao-original={p.exercicio}>
      Abrir a demonstração original de {emp.nome} na CVM
      {p.documento?.recebido_em ? <span className="ml-1 text-carvao-muted">(entregue em {diaBr(p.documento.recebido_em)})</span> : null}
    </a>
  ) : (
    <span className="t-meta text-carvao-muted">Documento original sem endereço na base.</span>
  );
}

/** As linhas que compõem uma parcela, em reais e por R$ 100 de receita líquida. */
function Abertura({ rotulo, linhas, receita }: Readonly<{ rotulo: string; linhas: LinhaConta[] | undefined; receita: number | null }>) {
  const itens = abertura(linhas, receita);
  if (itens.length === 0) return null;
  return (
    <details className="mt-1" data-abre-parcela="">
      <summary className="t-meta inline-flex min-h-[44px] cursor-pointer items-center text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">Abrir {rotulo}</summary>
      <ul className="pb-2">
        {itens.map((l) => (
          <li key={l.descricao} className="grid grid-cols-[1fr_auto] gap-x-3 border-t border-linha py-1.5 text-sm text-carvao">
            <span className="min-w-0">{l.descricao}</span>
            <span className="text-right tabular-nums">
              {por100(l.por100)}
              <span className="t-meta block text-carvao-muted">{reais(l.valor)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="t-meta pb-2 text-carvao-muted">Negativo tira da receita; positivo soma. Rubricas com o nome que a companhia usa na demonstração.</p>
    </details>
  );
}

/**
 * O corpo do cupom de uma companhia na comparação: a conta de R$ 100, parcela por parcela, com o sinal da demonstração (negativo
 * tira dos R$ 100; positivo soma), a abertura das despesas e do resultado financeiro, a reconciliação com o lucro divulgado e o
 * link do documento original. Sem demonstração do exercício, o estado de ausência com os exercícios que a companhia tem.
 */
export function CorpoDaPonte({ x, ano, hrefAno }: Readonly<{ x: Selecionada; ano: number; hrefAno: (ano: number) => string }>) {
  const b = x.p?.ponte_100 ?? null;
  const rec = x.p ? reconciliacao(x.p) : null;
  if (!x.p || !b || !rec) return <SemExercicio x={x} ano={ano} hrefAno={hrefAno} />;
  return (

              <>
                <ul aria-label={`Parcelas de R$ 100 de receita líquida de ${x.emp.nome}`}>
                  <li className="grid grid-cols-[1fr_auto] gap-x-3 py-2 text-sm text-carvao">
                    <span>
                      Receita líquida
                      <span className="t-meta block text-carvao-muted">{reais(x.p.receita_liquida)}</span>
                    </span>
                    <span className="numero-p text-right">R$ 100,00</span>
                  </li>
                  {partesDaPonte(b)
                    .filter((parte) => parte.id !== "lucro")
                    .map((parte) => {
                      const zero = Math.abs(parte.valor) < 0.005;
                      return (
                        <li key={parte.id} className="py-1.5" data-parcela={parte.id}>
                          <div className="grid grid-cols-[1fr_auto] gap-x-3 text-sm text-carvao">
                            <span className="flex items-baseline gap-2">
                              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0" style={{ background: COR_PARTE[parte.id] }} />
                              <span>
                                {parte.rotulo}
                                {parte.valor > 0 && !zero && <span className="t-meta block text-carvao-muted">neste exercício somou, em vez de tirar</span>}
                              </span>
                            </span>
                            <span className="text-right tabular-nums">{zero ? "R$ 0,00" : `${parte.valor < 0 ? "−" : "+"} ${por100(Math.abs(parte.valor))}`}</span>
                          </div>
                          {parte.id === "despesas" && <Abertura rotulo="as despesas operacionais" linhas={x.p!.abre_despesas} receita={x.p!.receita_liquida} />}
                          {parte.id === "financeiro" && <Abertura rotulo="o resultado financeiro" linhas={x.p!.abre_financeiro} receita={x.p!.receita_liquida} />}
                        </li>
                      );
                    })}
                  <li className="grid grid-cols-[1fr_auto] gap-x-3 border-t border-dashed border-mineral-soft py-2.5 text-carvao" data-parcela="lucro">
                    <span className="flex items-baseline gap-2 text-sm font-medium">
                      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0" style={{ background: COR_PARTE.lucro }} />
                      <span>
                        {b.lucro_liquido < 0 ? "Prejuízo líquido" : "Lucro líquido"}
                        <span className="t-meta block font-normal text-carvao-muted">{reais(x.p.lucro_liquido === null ? null : Math.abs(x.p.lucro_liquido), 2)}</span>
                      </span>
                    </span>
                    <span className="numero-m text-right" data-lucro-por-100={b.lucro_liquido.toFixed(2)}>
                      {por100(b.lucro_liquido)}
                    </span>
                  </li>
                </ul>
                <p className="t-meta mt-2 text-carvao-muted" data-reconcilia={rec.fecha ? "sim" : "nao"} data-soma={rec.soma.toFixed(2)}>
                  {rec.fecha ? (
                    <>
                      <span className="font-medium text-carvao">A conta fecha.</span> R$ 100 mais as parcelas dão {por100(rec.soma)}; o lucro divulgado dividido pela receita líquida dá {por100(rec.lucroDivulgadoPor100)}.
                      {Math.abs(rec.soma - rec.lucroPor100) >= 0.005 ? " A diferença de um centavo é arredondamento." : ""}
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-carvao">A conta não fecha:</span> as parcelas somam {por100(rec.soma)} e o lucro divulgado por R$ 100 é {por100(rec.lucroDivulgadoPor100)}, diferença de {por100(rec.diferenca)}. Trate a ponte desta
                      empresa com cautela.
                    </>
                  )}
                </p>
                <LinkDaDemonstracao p={x.p} emp={x.emp} />
              </>
  );
}

/**
 * "Para onde foi o caixa": uma cascata por companhia, por R$ 100 de receita líquida e na mesma escala, do que a operação gerou
 * antes do capital de giro ao que sobra depois dos investimentos, passando pelo caixa operacional declarado e, quando a companhia
 * apresenta pagamentos a fornecedores por convênio no financiamento, pelo caixa depois deles. Abaixo, todas as variações de ativos
 * e passivos da demonstração e o link do documento.
 */
export function CaixasLadoALado({ selecionadas, ano, hrefAno }: Readonly<{ selecionadas: readonly Selecionada[]; ano: number; hrefAno: (ano: number) => string }>) {
  const cascatas = selecionadas.map((x) => cascataDoCaixa(x.p));
  const dominio = dominioDasCascatas(cascatas);
  return (
    <div className={`grid gap-x-10 gap-y-10 ${colunas(selecionadas.length)}`} data-caixas="">
      {selecionadas.map((x, i) => {
        const passos = cascatas[i];
        return (
          <article key={x.slug} className="min-w-0" data-caixa-empresa={x.slug}>
            <Cabeca x={x} ano={ano} />
            {!x.p ? (
              <div className="mt-4">
                <SemExercicio x={x} ano={ano} hrefAno={hrefAno} />
              </div>
            ) : (
              <>
                <div className="mt-3">
                  {passos ? <CascataCaixa passos={passos} dominio={dominio} titulo={`Cascata do caixa de ${x.emp.nome} em ${ano}, em R$ por R$ 100 de receita líquida`} /> : <p className="text-sm"><NaoDivulgado>a demonstração não traz o caixa das atividades operacionais deste exercício</NaoDivulgado></p>}
                </div>
                {(x.p.abre_giro ?? []).length > 0 && (
                  <details className="mt-1 border-t border-linha" data-abre-giro="">
                    <summary className="t-meta inline-flex min-h-[44px] cursor-pointer items-center text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">Abrir todas as variações de ativos e passivos</summary>
                    <ul className="pb-2">
                      {abertura(x.p.abre_giro, null).map((l, k) => (
                        <li key={`${l.descricao}-${k}`} className="grid grid-cols-[1fr_auto] gap-x-3 border-t border-linha py-1.5 text-sm text-carvao">
                          <span className="min-w-0">{l.descricao}</span>
                          <span className="text-right tabular-nums">{reais(l.valor)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <LinkDaDemonstracao p={x.p} emp={x.emp} />
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ seleção */

/**
 * As empresas da comparação e a troca: cada companhia da base é um link que a põe ou a tira da seleção (de duas a quatro), na
 * URL e sem JavaScript. As do mesmo segmento de uma selecionada vêm primeiro, como substitutas; as demais, agrupadas por segmento.
 */
export function SelecaoDeEmpresas({ todas, selecao, href }: Readonly<{ todas: readonly EmpresaComparavel[]; selecao: readonly string[]; href: (slugs: string[]) => string }>) {
  const min = 2;
  const max = 4;
  const escolhidas = selecao.map((s) => todas.find((x) => x.slug === s)).filter((x): x is EmpresaComparavel => Boolean(x));
  const segmentosDaSelecao = new Set(escolhidas.flatMap((x) => x.segmentos));
  const fora = todas.filter((x) => !selecao.includes(x.slug));
  const doMesmoSegmento = fora.filter((x) => x.segmentos.some((s) => segmentosDaSelecao.has(s)));
  const outras = fora.filter((x) => !doMesmoSegmento.includes(x));
  const cheio = selecao.length >= max;
  const segmentoDe = (x: EmpresaComparavel) => (x.segmentos.length ? x.segmentos.map(nomeDoSegmento).join(" e ") : "Outros");
  const botao = "inline-flex min-h-[44px] items-center gap-2.5 border py-1.5 pl-1.5 pr-3 text-sm transition-[border-color,background-color,transform] duration-150 ease-out motion-safe:active:scale-[0.97]";
  const entrar = (x: EmpresaComparavel) => (
    <li key={x.slug}>
      <Link
        href={href(cheio ? [...selecao.slice(0, max - 1), x.slug] : [...selecao, x.slug])}
        prefetch={false}
        scroll={false}
        className={`${botao} border-linha bg-superficie text-carvao [@media(hover:hover)]:hover:border-carvao`}
        data-entrar={x.slug}
      >
        <span className="sr-only">{cheio ? `Trocar ${escolhidas[escolhidas.length - 1]?.nome ?? "a última"} por ` : "Incluir "}</span>
        <LogoEmpresa slug={x.slug} nome={x.nome} tamanho="p" decorativo semLogo="placa" />
        {x.nome}
      </Link>
    </li>
  );
  return (
    <div className="min-w-0 basis-full" data-selecao-empresas={selecao.join(",")}>
      <p id="sel-empresas" className="text-sm text-carvao-muted">
        Empresas comparadas ({num(selecao.length)} de até {num(max)})
      </p>
      <ul aria-labelledby="sel-empresas" className="mt-1 flex flex-wrap gap-2">
        {escolhidas.map((x) => (
          <li key={x.slug} className="inline-flex items-stretch border border-carvao bg-carvao text-sm text-papel">
            <span className="inline-flex min-h-[44px] items-center gap-2.5 py-1.5 pl-1.5 pr-3 font-medium">
              <LogoEmpresa slug={x.slug} nome={x.nome} tamanho="p" decorativo semLogo="placa" />
              {x.nome}
            </span>
            {selecao.length > min && (
              <Link href={href(selecao.filter((s) => s !== x.slug))} prefetch={false} scroll={false} className="inline-flex min-h-[44px] items-center border-l border-marfim/30 px-3 underline decoration-marfim/40 underline-offset-4 [@media(hover:hover)]:hover:decoration-marfim" data-tirar={x.slug}>
                tirar<span className="sr-only"> {x.nome} da comparação</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
      <details className="mt-2" data-trocar-empresas="">
        <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">
          {cheio ? "Trocar uma empresa" : "Incluir ou trocar empresas"} ({num(fora.length)} outras companhias abertas na base)
        </summary>
        <div className="space-y-4 pb-3 pt-1">
          {cheio && <p className="t-meta text-carvao-muted">A comparação já tem {num(max)} empresas: escolher outra troca a última da lista. Para trocar uma específica, tire-a primeiro.</p>}
          {doMesmoSegmento.length > 0 && (
            <div>
              <p className="rotulo text-mineral">Do mesmo segmento das selecionadas</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {doMesmoSegmento.map(entrar)}
              </ul>
            </div>
          )}
          {outras.length > 0 && (
            <div>
              <p className="rotulo text-mineral">De outros segmentos</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {outras.map(entrar)}
              </ul>
              <p className="t-meta mt-2 text-carvao-muted">
                {outras.map((x) => `${x.nome}: ${segmentoDe(x).toLowerCase()}`).join("; ")}. Empresas de ramos diferentes têm margens e prazos diferentes por natureza do negócio.
              </p>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------ apoio na curadoria (pares preparados) */

export type ApoioDoPar = { rotulo: string; padroes: readonly [RegExp, RegExp] };

/** Para um par preparado: o mesmo indicador operacional das duas fichas, no exercício da comparação, com natureza e fonte. */
export function ApoioNaCuradoria({ itens, fichas, nomes, ano }: Readonly<{ itens: readonly ApoioDoPar[]; fichas: readonly [FichaCuradoria | null, FichaCuradoria | null]; nomes: readonly [string, string]; ano: number }>) {
  const linhas = itens.map((it) => ({ it, achados: [0, 1].map((i) => valorOperacional(fichas[i], it.padroes[i], ano)) }));
  if (linhas.every((l) => l.achados.every((a) => !a))) return null;
  return (
    <div data-apoio-curadoria="">
      <ul className="mt-2">
        {linhas.map(({ it, achados }) => (
          <li key={it.rotulo} className="grid gap-x-8 gap-y-2 border-t border-linha py-3 md:grid-cols-[minmax(0,14rem)_1fr_1fr]">
            <p className="text-sm font-medium text-carvao">{it.rotulo}</p>
            {achados.map((a, i) => (
              <div key={i} className="min-w-0 text-sm text-carvao">
                <p className="t-meta text-carvao-muted">
                  {nomes[i]}, {ano}
                </p>
                {a && typeof a.v.valor === "number" ? (
                  <>
                    <p className="numero-p mt-0.5">{valorNaUnidade(a.v.valor, a.o.unidade)}</p>
                    <p className="t-meta mt-0.5 text-carvao-muted">
                      {textoCurado(a.o.indicador)}. <MarcaNatureza natureza={naturezaCurada(a.v.natureza)} />. <FonteDocumento f={a.o.fonte} prefixo="Fonte: " />
                    </p>
                  </>
                ) : (
                  <p className="mt-0.5">
                    <NaoDivulgado>sem valor de {ano} registrado na ficha do grupo</NaoDivulgado>
                  </p>
                )}
              </div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
