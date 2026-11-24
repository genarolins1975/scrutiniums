import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { FiguraAnalitica, LeituraGuiada, PaginaPainel } from "@/components/painel";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { CabecalhoVarejo, LINK } from "@/components/varejo/comum";
import { Concorrentes, DocumentosNaCvm, FontesDaFicha, GraficosDaCompanhia, LinhaDoTempo, RankingContraCvm, Reapresentacoes, RESUMO_MAIS, SeriesOperacionais, UltimoTrimestre } from "@/components/varejo/FichaGrupo";
import { Campo, FonteDocumento, NaoDivulgado } from "@/components/varejo/grupos-comum";
import { FRESCOR_DAS_COLECOES } from "@/lib/frescor/entradas";
import { tituloNaColecao } from "@/lib/observatorios/contexto";
import { hrefComRecorte, parametro, type ParametrosPagina } from "@/lib/painel/recorte";
import type { NumeroProps } from "@/lib/painel/tipos";
import { empresasComparaveis, substitutos } from "@/lib/varejo/comparador";
import { curadoria, goldEmpresas } from "@/lib/varejo/dados";
import { dataBr, diaBr, num, ordinal, pct, plural, reais, reaisDeMilhoes, textoCurado } from "@/lib/varejo/formato";
import {
  CAPITAL,
  dividaLiquida,
  empresaDaFicha,
  exercicioDoRanking,
  exerciciosDaGold,
  fichaDoGrupo,
  fonteDoRanking,
  hrefDoSegmento,
  hrefFicha,
  INDICADORES_FICHA,
  naturezaCurada,
  naturezaDoKit,
  nomeDoSegmento,
  passivoArrendamento,
  periodoDe,
  reapresentacoes,
  ROTA_COMPARADOR,
  ROTA_GRUPOS,
  ROTULO_NATUREZA,
  ultimoExercicio,
  voltaAoRanking,
} from "@/lib/varejo/grupos";
import { paginaVarejo, ROTA_METODO, UFS } from "@/lib/varejo/paginas";
import { provCvm } from "@/lib/varejo/proveniencia";

/**
 * Ficha de um grupo do varejo (coleção Varejo, com conta): identidade e perímetro antes dos números (marcas, formatos, onde
 * atua, canais, clientes, fontes de receita, concorrentes e controle), o que a venda do ranking mede neste grupo ao lado da
 * receita líquida da CVM, a leitura da curadoria, as demonstrações em gráficos pequenos por indicador, os indicadores
 * operacionais, a linha do tempo, o que não foi divulgado e as fontes. Grupo de capital fechado não tem demonstração: os
 * campos financeiros aparecem como "não divulgado" e a evidência operacional carrega a ficha.
 *
 * O `?de=` traz o recorte do ranking de onde o leitor veio e o devolve no link de volta.
 */
export const dynamic = "force-dynamic";

const pagina = paginaVarejo("grupo");

type Props = { params: { slug: string }; searchParams: ParametrosPagina };

export function generateMetadata({ params }: Props): Metadata {
  const f = fichaDoGrupo(curadoria(), params.slug);
  if (!f) return { title: tituloNaColecao("Ficha não encontrada", ROTA_GRUPOS) };
  return {
    title: tituloNaColecao(f.grupo, ROTA_GRUPOS),
    description: textoCurado(f.resumo) || `Ficha de ${f.grupo}: marcas, canais, indicadores operacionais, eventos e fontes.`,
    alternates: { canonical: hrefFicha(f.slug) },
  };
}

/** Marcas à vista no capítulo de identidade; as demais ficam recolhidas, no HTML. */
const MARCAS_A_VISTA = 4;
const RECEITAS_A_VISTA = 3;

const MOTIVO_SEM_CVM: Record<string, string> = {
  fechado: "Capital fechado: o grupo não entrega demonstrações financeiras à CVM.",
  "aberto no exterior": "Listado no exterior: não entrega demonstrações à CVM. A ficha cita os documentos entregues ao regulador estrangeiro.",
};

export default function FichaDoGrupo({ params, searchParams }: Props) {
  const c = curadoria();
  const e = goldEmpresas();
  const f = fichaDoGrupo(c, params.slug);
  if (!f) notFound();

  const de = parametro(searchParams, "de");
  const volta = voltaAoRanking(de);
  const vindoDeRecorte = volta.includes("?");
  const rota = `${ROTA_GRUPOS}/${f.slug}`;
  const noRanking = (c.ranking?.grupos ?? []).find((g) => g.slug === f.slug) ?? null;
  const nGrupos = c.ranking?.grupos.length ?? 0;
  const anoRanking = exercicioDoRanking(c);
  const fonteRanking = fonteDoRanking(c);
  const natureza = naturezaCurada(noRanking?.natureza);
  const emp = empresaDaFicha(e, f);
  const anos = exerciciosDaGold(e);
  const ult = ultimoExercicio(emp);
  const motivoSemCvm = MOTIVO_SEM_CVM[f.capital ?? ""] ?? "A base de demonstrações da CVM usada nesta coleção não tem esta companhia.";
  const segmento = noRanking?.segmento ?? null;
  const hrefSegmento = hrefDoSegmento(c, segmento);
  const todasComparaveis = empresasComparaveis(e, c);
  const par = emp && f.empresa_gold ? substitutos(todasComparaveis, f.empresa_gold)[0] ?? null : null;
  const hrefConcorrente = (slug: string | null | undefined): string | null => {
    if (!slug) return null;
    if (c.fichas[slug]) return hrefFicha(slug, de);
    if (e.empresas[slug] && f.empresa_gold) return hrefComRecorte(ROTA_COMPARADOR, { e: `${f.empresa_gold},${slug}` });
    return null;
  };
  const reap = emp ? reapresentacoes(emp) : [];
  const estados = (f.regioes?.estados ?? []).filter((uf) => UFS[uf]);

  const provaRanking = { fonte: fonteRanking, periodo: anoRanking };
  // grupo fora do ranking: o que a fonte publica dele à parte (valor negociado na plataforma), com a natureza que ela declara
  const negociado = noRanking ? null : (c.ranking?.marketplaces?.lista ?? []).find((m) => m.nome === f.grupo) ?? null;
  const numeros: NumeroProps[] = [
    noRanking
      ? { rotulo: "Posição no ranking de vendas", formato: "texto", valorTexto: `${ordinal(noRanking.posicao)} de ${num(nGrupos)}`, unidade: "entre os maiores grupos listados", ...provaRanking, natureza: "OBSERVADO", tamanho: "g", nota: typeof noRanking.posicao_anterior === "number" ? `No ano anterior: ${ordinal(noRanking.posicao_anterior)}.` : undefined }
      : { rotulo: "Posição no ranking de vendas", unidade: "entre os maiores grupos listados", ...provaRanking, natureza: "OBSERVADO", valor: null, motivoAusencia: "Fora do ranking: o método da fonte só conta a venda própria, e a maior parte do que passa por esta plataforma é venda de terceiros." },
    noRanking && typeof noRanking.vendas_milhoes === "number"
      ? { rotulo: "Venda no ranking", formato: "texto", valorTexto: reaisDeMilhoes(noRanking.vendas_milhoes), unidade: "venda bruta ao consumidor", ...provaRanking, natureza: naturezaDoKit(natureza), tamanho: "g", nota: `Valor ${ROTULO_NATUREZA[natureza]}.` }
      : negociado && typeof negociado.gmv_digital_2025_milhoes === "number"
        ? { rotulo: "Valor negociado na plataforma", formato: "texto", valorTexto: reaisDeMilhoes(negociado.gmv_digital_2025_milhoes), unidade: "venda própria e de terceiros somadas; não é venda da empresa", ...provaRanking, natureza: naturezaDoKit(naturezaCurada(negociado.natureza)), tamanho: "g", nota: `Valor ${ROTULO_NATUREZA[naturezaCurada(negociado.natureza)]}, publicado à parte do ranking (p. ${negociado.pagina ?? "não informada"}).` }
        : { rotulo: "Venda no ranking", unidade: "venda bruta ao consumidor", ...provaRanking, natureza: "OBSERVADO", valor: null, motivoAusencia: "A fonte não atribui venda de varejo a este grupo; o que ela publica à parte está no capítulo sobre o alcance do dado." },
    ult && ult.receita_liquida !== null
      ? { rotulo: "Receita líquida", formato: "texto", valorTexto: reais(ult.receita_liquida), unidade: ult.base === "individual" ? "demonstração individual" : "demonstração consolidada", periodo: String(ult.exercicio), fonte: "CVM, Demonstrações Financeiras Padronizadas", natureza: "OBSERVADO", tamanho: "g" }
      : { rotulo: "Receita líquida", unidade: "demonstração financeira", periodo: anoRanking, fonte: "CVM, Demonstrações Financeiras Padronizadas", natureza: "OBSERVADO", valor: null, motivoAusencia: motivoSemCvm },
    noRanking && typeof noRanking.lojas === "number"
      ? { rotulo: "Lojas", valor: noRanking.lojas, formato: "inteiro", unidade: "lojas no fim do exercício", ...provaRanking, natureza: "OBSERVADO", tamanho: "g", nota: typeof noRanking.lojas_ano_anterior === "number" ? `No ano anterior: ${num(noRanking.lojas_ano_anterior)}.` : undefined }
      : { rotulo: "Lojas", unidade: "lojas no fim do exercício", ...provaRanking, natureza: "OBSERVADO", valor: null, motivoAusencia: "A fonte do ranking não publica o número de lojas deste grupo; os indicadores operacionais abaixo trazem o que a companhia divulga." },
  ];

  const bandeira = (b: { nome: string; formato?: string; nota?: string }) => (
    <li key={b.nome} className="border-t border-linha py-2.5">
      <p className="text-base font-medium leading-snug text-carvao">{b.nome}</p>
      {b.formato && <p className="mt-0.5 text-sm leading-relaxed text-carvao">{textoCurado(b.formato)}</p>}
      {b.nota && <p className="t-meta mt-0.5 text-carvao-muted">{textoCurado(b.nota)}</p>}
    </li>
  );

  const receita = (x: { nome: string; descricao?: string }) => (
    <div key={x.nome} className="border-t border-linha py-2.5">
      <dt className="text-sm font-medium text-carvao">{textoCurado(x.nome)}</dt>
      <dd className="mt-0.5 text-sm leading-relaxed text-carvao-muted">{textoCurado(x.descricao) || <NaoDivulgado>valor não divulgado</NaoDivulgado>}</dd>
    </div>
  );

  const capitulos = [
    { id: "quem", rotulo: "Quem é" },
    { id: "alcance", rotulo: "O que a venda mede" },
    { id: "leitura", rotulo: "Leitura" },
    { id: "demonstracoes", rotulo: "Demonstrações" },
    { id: "operacionais", rotulo: "Operação" },
    { id: "eventos", rotulo: "Linha do tempo" },
    { id: "sem-divulgacao", rotulo: "Não divulgado" },
    { id: "fontes", rotulo: "Fontes" },
  ];

  return (
    <>
      <MarcaVisita secao={pagina.secao} />
      <CabecalhoVarejo rota={rota} />
      <PaginaPainel
        rota={rota}
        abertura={{
          grupo: "Grupos · Ficha",
          acento: "gas",
          titulo: f.grupo,
          lead: textoCurado(f.resumo) || "Ficha do grupo: marcas, canais, indicadores operacionais, eventos e fontes.",
          recorte: {
            periodo: `ranking de ${anoRanking}${emp ? `; demonstrações de ${emp.anuais[0]?.exercicio ?? anos[0]} a ${ult?.exercicio ?? anos[anos.length - 1]}` : ""}`,
            universo: `${noRanking ? nomeDoSegmento(segmento) : "fora do ranking"}, ${(CAPITAL[f.capital ?? ""] ?? "estrutura de capital não informada").toLowerCase()}`,
            fonte: `${fonteRanking}${emp ? "; CVM" : ""}; documentos da companhia`,
          },
          limite: "se o grupo é bem ou mal gerido, nem o valor de suas ações: a ficha reúne o que os documentos públicos dizem, com a fonte de cada número, e marca o que não foi divulgado.",
          acao: (
            <p className="text-sm">
              <Link href={volta} prefetch={false} className={`inline-flex min-h-[44px] items-center text-carvao ${LINK}`} data-volta-ranking="">
                Voltar ao ranking dos grupos{vindoDeRecorte ? ", com a busca e o filtro de antes" : ""}
              </Link>
            </p>
          ),
        }}
        rotuloNumeros={`${f.grupo} em números`}
        numeros={numeros}
        notaNumeros="Venda do ranking e receita líquida não são a mesma medida: a primeira é bruta, com impostos, só do varejo; a segunda é o que a demonstração registra depois deles."
        navegacaoLocal={
          <nav aria-label="Capítulos desta ficha" className="mt-6 border-y border-linha" data-capitulos-ficha="">
            <ul className="flex gap-x-6 overflow-x-auto whitespace-nowrap text-sm">
              {capitulos.map((x) => (
                <li key={x.id}>
                  <a href={`#${x.id}`} className="inline-flex min-h-[44px] items-center text-carvao underline decoration-transparent underline-offset-4 hover:decoration-carvao">
                    {x.rotulo}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        }
        figuras={
          <>
            <Recolhido id="quem" aberto nivelTitulo={2} titulo="Quem é e como vende" resumo="Marcas e formatos, onde atua, por onde vende, quem compra, de onde vem a receita, com quem concorre e quem controla.">
              <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <h3 className="rotulo text-mineral">Marcas e formatos</h3>
                  {f.bandeiras.length > 0 ? (
                    <div className="mt-2" data-bandeiras={f.bandeiras.length}>
                      <ul>{f.bandeiras.slice(0, MARCAS_A_VISTA).map(bandeira)}</ul>
                      {f.bandeiras.length > MARCAS_A_VISTA && (
                        <details className="border-t border-linha">
                          <summary className={RESUMO_MAIS}>
                            Ver as outras {f.bandeiras.length - MARCAS_A_VISTA} marcas: {f.bandeiras.slice(MARCAS_A_VISTA).map((b) => b.nome).join(", ")}
                          </summary>
                          <ul>{f.bandeiras.slice(MARCAS_A_VISTA).map(bandeira)}</ul>
                        </details>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm">
                      <NaoDivulgado>a curadoria não registrou as marcas deste grupo</NaoDivulgado>
                    </p>
                  )}
                </div>
                <div className="min-w-0 space-y-6">
                  <dl className="space-y-6">
                  <Campo rotulo="Onde atua">
                    {textoCurado(f.regioes?.texto) || <NaoDivulgado />}
                    {estados.length > 0 && (
                      <span className="t-meta mt-1.5 block text-carvao-muted" data-estados={estados.length}>
                        {num(estados.length)} {plural(estados.length, "unidade da federação", "unidades da federação")}: {estados.join(", ")}.
                      </span>
                    )}
                  </Campo>
                  <Campo rotulo="Canais de venda">{f.canais.length > 0 ? f.canais.map(textoCurado).join("; ") : <NaoDivulgado />}</Campo>
                  </dl>
                  <details data-formatos-e-clientes="">
                    <summary className={RESUMO_MAIS}>Formatos de loja e quem compra</summary>
                    <dl className="space-y-5 pb-2 pt-1">
                        <Campo rotulo="Formatos de loja">{f.formatos.length > 0 ? f.formatos.map(textoCurado).join("; ") : <NaoDivulgado />}</Campo>
                        <Campo rotulo="Quem compra">{textoCurado(f.clientes) || <NaoDivulgado />}</Campo>
                    </dl>
                  </details>
                </div>
              </div>
              <div className="mt-8 grid gap-x-12 gap-y-8 border-t border-linha pt-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <h3 className="rotulo text-mineral">De onde vem a receita</h3>
                  {f.fontes_de_receita.length > 0 ? (
                    <div className="mt-2" data-fontes-de-receita={f.fontes_de_receita.length}>
                      <dl>{f.fontes_de_receita.slice(0, RECEITAS_A_VISTA).map(receita)}</dl>
                      {f.fontes_de_receita.length > RECEITAS_A_VISTA && (
                        <details className="border-t border-linha">
                          <summary className={RESUMO_MAIS}>
                            Ver as outras {f.fontes_de_receita.length - RECEITAS_A_VISTA}: {f.fontes_de_receita.slice(RECEITAS_A_VISTA).map((x) => textoCurado(x.nome).toLowerCase()).join("; ")}
                          </summary>
                          <dl>{f.fontes_de_receita.slice(RECEITAS_A_VISTA).map(receita)}</dl>
                        </details>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm">
                      <NaoDivulgado>composição da receita não divulgada</NaoDivulgado>
                    </p>
                  )}
                </div>
                <dl className="min-w-0 space-y-6">
                  <Campo rotulo="Controlador">
                    {f.controlador?.nome ? textoCurado(f.controlador.nome) : <NaoDivulgado>não verificado</NaoDivulgado>}
                    <details className="mt-1" data-controle-detalhe="">
                      <summary className={RESUMO_MAIS}>Como o controle foi verificado, e a fonte</summary>
                      {f.controlador?.nota && <span className="t-meta block text-carvao-muted">{textoCurado(f.controlador.nota)}</span>}
                      <span className="t-meta mt-1.5 block pb-2 text-carvao-muted">
                        <FonteDocumento f={f.controlador?.fonte} prefixo="Fonte: " />
                      </span>
                    </details>
                  </Campo>
                  <Campo rotulo="Capital">{CAPITAL[f.capital ?? ""] ?? <NaoDivulgado>não informado</NaoDivulgado>}</Campo>
                  <Campo rotulo="Concorrentes diretos">
                    <Concorrentes itens={f.concorrentes} hrefDe={hrefConcorrente} />
                  </Campo>
                  {noRanking && (
                    <Campo rotulo="Segmento">
                      {hrefSegmento ? (
                        <Link href={hrefSegmento} prefetch={false} className={LINK} data-link-segmento="">
                          {nomeDoSegmento(segmento)}: como funciona este negócio e como andam as vendas do segmento
                        </Link>
                      ) : (
                        nomeDoSegmento(segmento)
                      )}
                      {noRanking.segmento_irtt && <span className="t-meta mt-1 block text-carvao-muted">Na fonte do ranking: {noRanking.segmento_irtt}.</span>}
                    </Campo>
                  )}
                </dl>
              </div>
            </Recolhido>

            <Recolhido id="alcance" aberto nivelTitulo={2} titulo="O que a venda do ranking mede neste grupo" resumo="O que entra e o que fica de fora do número do ranking, e por que ele não é a receita das demonstrações.">
              {textoCurado(f.alcance_do_dado) ? (
                <p className="max-w-3xl bg-marfim px-5 py-4 text-base leading-relaxed text-carvao" data-alcance-do-dado="">
                  {textoCurado(f.alcance_do_dado)}
                </p>
              ) : (
                <p className="max-w-prose2 text-sm text-carvao-muted">A curadoria não registrou ressalva de alcance específica para este grupo; vale a definição geral de venda da fonte, descrita no ranking.</p>
              )}
              <div className="mt-6">
                <RankingContraCvm vendaMilhoes={typeof noRanking?.vendas_milhoes === "number" ? noRanking.vendas_milhoes : null} natureza={natureza} anoRanking={anoRanking} fonteRanking={fonteRanking} emp={emp} motivoSemCvm={motivoSemCvm} />
              </div>
            </Recolhido>

            <Recolhido id="leitura" aberto nivelTitulo={2} titulo="Leitura: crescimento, rentabilidade e caixa" resumo="Dois parágrafos da curadoria, com os números e o período de cada afirmação, e o indicador que vale acompanhar.">
              <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2" data-analise="">
                <div className="min-w-0">
                  <h3 className="t-h3 text-carvao">De onde veio o crescimento</h3>
                  <p className="mt-3 text-base leading-relaxed text-carvao">{textoCurado(f.analise?.crescimento) || <NaoDivulgado>análise ainda não escrita</NaoDivulgado>}</p>
                </div>
                <div className="min-w-0">
                  <h3 className="t-h3 text-carvao">Rentabilidade e caixa</h3>
                  <p className="mt-3 text-base leading-relaxed text-carvao">{textoCurado(f.analise?.rentabilidade_caixa) || <NaoDivulgado>análise ainda não escrita</NaoDivulgado>}</p>
                </div>
              </div>
              {f.analise?.acompanhar?.indicador && (
                <div className="mt-8 border-t border-linha pt-5" data-indicador-a-acompanhar="">
                  <h3 className="t-h3 text-carvao">Indicador a acompanhar: {textoCurado(f.analise.acompanhar.indicador)}</h3>
                  <dl className="mt-4 grid gap-x-12 gap-y-5 md:grid-cols-2">
                    <Campo rotulo="O que reforçaria esta leitura">{textoCurado(f.analise.acompanhar.reforca) || <NaoDivulgado>não registrado</NaoDivulgado>}</Campo>
                    <Campo rotulo="O que a enfraqueceria">{textoCurado(f.analise.acompanhar.enfraquece) || <NaoDivulgado>não registrado</NaoDivulgado>}</Campo>
                  </dl>
                </div>
              )}
              <p className="t-meta mt-6 max-w-prose2 text-carvao-muted">
                Texto da curadoria da Scrutiniums sobre os documentos listados nas fontes. Explicações de causa dadas pela empresa estão atribuídas a ela e não foram verificadas de forma independente.
              </p>
            </Recolhido>

            {emp && ult ? (
              <FiguraAnalitica
                id="demonstracoes"
                pergunta="Como evoluíram receita, margens, caixa e dívida?"
                subtitulo={`${emp.nome} · demonstrações ${ult.base === "individual" ? "individuais" : "consolidadas"} · reais correntes · exercícios de ${anos[0]} a ${anos[anos.length - 1]}`}
                natureza="OBSERVADO"
                proveniencia={provCvm(e, {
                  indicador: `Demonstrações financeiras de ${emp.nome}`, natureza: "OBSERVADO", unidade: "reais correntes", inicio: String(anos[0]), fim: String(anos[anos.length - 1]),
                  limitacoes: ["Valores em reais correntes de cada exercício, sem correção pela inflação.", e.formulas.divida_liquida_sem_arrendamento ? `Dívida líquida sem arrendamento: ${e.formulas.divida_liquida_sem_arrendamento}.` : ""].filter(Boolean),
                })}
                complementares={[
                  { rotulo: "Sobre as margens e os investimentos", p: provCvm(e, { indicador: "Margens e investimentos calculados", natureza: "CALCULADO", unidade: "% da receita líquida; reais correntes", inicio: String(anos[0]), fim: String(anos[anos.length - 1]), formula: [e.formulas.margem_bruta_pct, e.formulas.margem_operacional_pct, e.formulas.capex].filter(Boolean).join("; ") }) },
                ]}
                leitura={
                  <LeituraGuiada>
                    Em {ult.exercicio}, {emp.nome} teve receita líquida de {reais(ult.receita_liquida)}, margem bruta de {pct(ult.margem_bruta_pct)} e {ult.lucro_liquido !== null && ult.lucro_liquido < 0 ? "prejuízo" : "lucro líquido"} de{" "}
                    {reais(ult.lucro_liquido === null ? null : Math.abs(ult.lucro_liquido), 2)}. O caixa operacional foi de {reais(ult.caixa_operacional ?? null)}; a dívida líquida sem arrendamento, de {reais(ult.divida_liquida_sem_arrendamento ?? null)}, e o passivo de
                    arrendamento, de {reais(ult.passivo_arrendamento ?? null)}.
                  </LeituraGuiada>
                }
                ressalva={
                  <>
                    {ult.base === "individual" && <>Estas são demonstrações individuais: a companhia não tem controladas a consolidar. </>}
                    {emp.anuais.length < anos.length && <>A base tem {num(emp.anuais.length)} de {num(anos.length)} exercícios desta companhia; os demais aparecem como lacuna. </>}
                    {reap.length > 0 && <>{num(reap.length)} {plural(reap.length, "valor foi reapresentado", "valores foram reapresentados")} no exercício seguinte; os dois números estão logo abaixo dos gráficos. </>}
                    A dívida líquida não inclui os aluguéis de longo prazo das lojas, que a norma contábil registra como passivo de arrendamento: os dois aparecem separados, e somá-los ou não muda a leitura do endividamento.
                  </>
                }
                comoInterpretar="Cada gráfico tem a própria escala, na unidade do indicador, e todos começam no zero. Margem é a parte da receita líquida que sobra depois do custo da mercadoria (bruta) e depois também das despesas da operação (operacional). Investimentos são a compra de imobilizado e intangível, mostrada como valor positivo."
                naoConcluir="que a trajetória continua, nem que o lucro contábil é o resultado recorrente do negócio: o resultado inclui eventos que não se repetem, os releases das companhias trazem medidas ajustadas que diferem destas, e os valores são nominais."
                tabela={{
                  titulo: `${emp.nome}: demonstrações anuais`,
                  colunas: ["Exercício", ...INDICADORES_FICHA.map((i) => `${i.rotulo}, ${i.unidade}`), "Dívida líquida sem arrendamento, R$ bilhões", "Passivo de arrendamento, R$ bilhões", "Base", "Reapresentado no exercício seguinte"],
                  linhas: anos.map((a) => {
                    const p = periodoDe(emp, a);
                    const r = reap.filter((x) => x.exercicio === a).map((x) => x.campo.toLowerCase());
                    return [String(a), ...INDICADORES_FICHA.map((i) => (p ? i.valor(p) : null)), dividaLiquida(p), passivoArrendamento(p), p ? p.base ?? "não informada" : "sem demonstração na base", p ? (r.length ? `sim: ${r.join(" e ")}` : "não") : "sem demonstração na base"];
                  }),
                  casas: [null, ...INDICADORES_FICHA.map((i) => i.casas), 1, 1, null, null],
                  limite: anos.length,
                }}
                complemento={
                  <div className="space-y-8">
                    <Reapresentacoes emp={emp} />
                    <UltimoTrimestre emp={emp} />
                    <DocumentosNaCvm emp={emp} anos={anos} />
                    {par && f.empresa_gold && (
                      <p className="text-sm">
                        <Link href={hrefComRecorte(ROTA_COMPARADOR, { e: `${f.empresa_gold},${par.slug}`, ano: ult.exercicio === anos[anos.length - 1] ? null : String(ult.exercicio) })} prefetch={false} className={`inline-flex min-h-[44px] items-center ${LINK}`} data-link-comparador="">
                          Comparar {emp.nome} com {par.nome}: de R$ 100 de receita ao lucro e ao caixa
                        </Link>
                      </p>
                    )}
                  </div>
                }
              >
                <GraficosDaCompanhia emp={emp} anos={anos} />
              </FiguraAnalitica>
            ) : (
              <Recolhido id="demonstracoes" aberto nivelTitulo={2} titulo="Demonstrações financeiras: não divulgadas" resumo={motivoSemCvm}>
                <dl className="grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-4" data-financeiro-nao-divulgado="">
                  {[...INDICADORES_FICHA.map((i) => i.rotulo), "Dívida líquida sem arrendamento", "Passivo de arrendamento"].map((rotulo) => (
                    <div key={rotulo} className="border-t border-linha pt-3">
                      <dt className="text-sm text-carvao">{rotulo}</dt>
                      <dd className="mt-1 text-sm">
                        <NaoDivulgado />
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-5 max-w-prose2 text-sm leading-relaxed text-carvao">
                  Sem demonstração pública, não há como medir margem, caixa ou dívida deste grupo, e a página não os estima. O que permite avaliar a operação está nos indicadores abaixo: vendas, lojas, área, funcionários e o que mais a
                  empresa ou as associações do setor publicam, cada série com a sua fonte.
                </p>
              </Recolhido>
            )}

            <Recolhido
              id="operacionais"
              aberto
              nivelTitulo={2}
              titulo="Indicadores da operação"
              resumo={f.operacionais.length > 0 ? `${num(f.operacionais.length)} ${plural(f.operacionais.length, "série", "séries")} da operação, cada uma com período, natureza do dado e documento de origem com a página.` : "Nenhuma série operacional registrada."}
            >
              {f.operacionais.length > 0 ? (
                <SeriesOperacionais series={f.operacionais} />
              ) : (
                <p className="text-sm">
                  <NaoDivulgado>a curadoria não encontrou indicadores operacionais divulgados por este grupo</NaoDivulgado>
                </p>
              )}
            </Recolhido>

            <Recolhido id="eventos" aberto nivelTitulo={2} titulo="Linha do tempo" resumo="Aquisições, vendas de negócios, recuperações, reapresentações e mudanças de controle, do mais recente ao mais antigo, cada evento com o documento.">
              <LinhaDoTempo eventos={f.eventos} />
            </Recolhido>

            <Recolhido
              id="sem-divulgacao"
              nivelTitulo={2}
              titulo="O que não foi divulgado"
              resumo={f.campos_sem_divulgacao.length > 0 ? `${num(f.campos_sem_divulgacao.length)} ${plural(f.campos_sem_divulgacao.length, "informação que a ficha procurou e não encontrou", "informações que a ficha procurou e não encontrou")} em documento público. Nenhuma foi estimada.` : "A curadoria não registrou lacunas para este grupo."}
            >
              {f.campos_sem_divulgacao.length > 0 ? (
                <ul className="max-w-3xl" data-campos-sem-divulgacao={f.campos_sem_divulgacao.length}>
                  {f.campos_sem_divulgacao.map((x, i) => (
                    <li key={i} className="grid grid-cols-[auto_1fr] gap-x-3 border-t border-linha py-3 text-sm leading-relaxed text-carvao">
                      <span className="rotulo mt-0.5 whitespace-nowrap border border-carvao-muted px-1.5 py-0.5 text-carvao">não divulgado</span>
                      <span>{textoCurado(x)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-carvao-muted">Nada a listar.</p>
              )}
            </Recolhido>

            <Recolhido id="fontes" nivelTitulo={2} titulo="Fontes desta ficha" resumo={`${num(f.fontes.length)} ${plural(f.fontes.length, "documento", "documentos")}, com o link que abre o original, a página, o período e a data da consulta.`}>
              {f.fontes.length > 0 ? <FontesDaFicha fontes={f.fontes} /> : <p className="text-sm text-carvao-muted">A curadoria não listou documentos para esta ficha.</p>}
            </Recolhido>
          </>
        }
        metodo={
          <>
            <p>
              A ficha é curadoria da Scrutiniums sobre documentos públicos (demonstrações e releases entregues à CVM ou ao regulador do país de listagem, o ranking do IRTT e associações do setor), lidos em{" "}
              {diaBr(c.ranking?.fonte?.consultado_em)}. Cada número traz a natureza: divulgado pela empresa ou em demonstração, estimado pela fonte, ou calculado por nós com a conta indicada. O que não foi encontrado em documento
              público está listado como não divulgado; nada foi estimado.
            </p>
            {emp && (
              <p>
                As demonstrações vêm dos dados abertos da CVM ({e.fontes.dfp.nome} e {e.fontes.itr.nome}), capturados em {dataBr(e.capturado_em)}. Margens, investimentos e dívida líquida são contas desta coleção sobre as
                rubricas da companhia; as fórmulas estão na página de método.
              </p>
            )}
            <p>
              <Link href={ROTA_METODO} prefetch={false} className={LINK}>
                Fontes, fórmulas, correspondência com o IBGE e lacunas
              </Link>
            </p>
          </>
        }
        frescorMetodo={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/varejo"]} variante="metodo" />}
      />
    </>
  );
}
