import type { Metadata } from "next";
import Link from "next/link";
import { AberturaCredito, AvisoCet, CascaCredito } from "@/components/credito/Blocos";
import { FaixaDistribuicao } from "@/components/credito/FaixaDistribuicao";
import { SeletorJuros } from "@/components/credito/SeletorJuros";
import { Controles, FiguraAnalitica, PaginaPainel, type NumeroProps } from "@/components/painel";
import { goldJuros, hrefConsulta, opcoesSeletor, resolverConsulta, rotuloModalidade, ROTULO_SEGMENTO, type ParametrosConsulta } from "@/lib/credito/juros";
import { contagem, dataBr, diaBrasilia, diasDesde, janela, num, taxa } from "@/lib/credito/formato";
import { PAINEL_JUROS, paginaCredito } from "@/lib/credito/navegacao";
import { provenienciaJuros } from "@/lib/credito/proveniencia";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import { tituloNaColecao } from "@/lib/observatorios/contexto";

/**
 * "Quanto meu banco cobra?" (Onda 2 da banca de 19/10/2026, consulta pessoal do Crédito). Lê no servidor a gold
 * juros.json (BCB txjuros) e mostra, para o segmento, a modalidade e a instituição escolhidos na URL, a taxa publicada,
 * a mediana e a distribuição entre as instituições, a posição e a distância da mediana, com janela, fonte e o aviso de
 * que taxa não é CET. Sem julgamento: nenhuma taxa é chamada de cara ou barata.
 *
 * No molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026), como consulta: o seletor é a ação da abertura, as
 * medidas do recorte são a faixa de números, a distribuição é a figura (a faixa de pontos de domínio fica marcada como figura
 * legada até a família de gráficos do kit ter a forma de distribuição) e "Como ler estes números" vira as notas de leitura.
 *
 * Rota com conta (não consta de src/lib/rotasPublicas.ts). Dinâmica: o recorte vem de ?seg=&mod=&banco=.
 */
export const dynamic = "force-dynamic";

const pagina = paginaCredito("quanto-meu-banco-cobra");

export const metadata: Metadata = {
  title: tituloNaColecao(`${pagina.titulo} Taxas de juros por banco e modalidade`, pagina.href),
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
  robots: { index: false },
};

/** "19ª" para posições: ordinal masculino abreviado não serve a "posição" (feminino). */
const ordinal = (n: number) => `${n.toLocaleString("pt-BR")}ª`;

export default function QuantoMeuBancoCobraPage({ searchParams = {} }: { searchParams?: ParametrosConsulta }) {
  const gold = goldJuros();
  if (!gold) {
    return (
      <CascaCredito atual="quanto-meu-banco-cobra">
        <AberturaCredito titulo={pagina.titulo}>
          <p>
            A publicação das taxas de juros por instituição não está disponível nesta versão do site. Nenhum número é mostrado no lugar dela.
          </p>
        </AberturaCredito>
      </CascaCredito>
    );
  }
  const opcoes = opcoesSeletor(gold);
  const c = resolverConsulta(gold, searchParams);
  const m = c.modalidade;
  const s = m.stats;
  const nomeMod = rotuloModalidade(m.modalidade);
  const atraso = diasDesde(m.janela.fim, gold.gerado_em);
  const processado = diaBrasilia(gold.gerado_em);
  const fonte = (
    <>
      Fonte: Banco Central do Brasil, taxas de juros por instituição financeira e modalidade (txjuros, portal de dados abertos Olinda). Janela de
      referência desta modalidade: {janela(m.janela)}. Publicação processada em {processado}.
    </>
  );
  const hrefSimulador = hrefConsulta("/observatorio-do-credito/simulador-da-parcela", c.segmento, c.slug, c.banco?.cnpj8);
  const semana = `semana de ${janela(m.janela)}`;
  const FONTE_CURTA = "Banco Central do Brasil, txjuros";

  // as medidas do recorte, com natureza, fonte e janela de cada uma; a natureza é a que a página já declarava
  const numeros: NumeroProps[] =
    c.banco && c.linha && c.posicao && c.distanciaPp !== null
      ? [
          {
            rotulo: `Taxa de ${c.banco.nome}`,
            valor: c.linha.taxa_aa,
            valorTexto: taxa(c.linha.taxa_aa, "aa"),
            unidade: "",
            periodo: semana,
            fonte: FONTE_CURTA,
            natureza: "OBSERVADO",
            nota: <>equivale a {taxa(c.linha.taxa_am, "am")}, como publicado</>,
          },
          {
            rotulo: `Mediana das ${s.n} instituições`,
            valor: s.mediana,
            valorTexto: taxa(s.mediana, "aa"),
            unidade: "",
            periodo: semana,
            fonte: FONTE_CURTA,
            natureza: "OBSERVADO",
            nota: "metade das instituições informou taxa menor e metade, maior",
          },
          Math.abs(c.distanciaPp) < 0.005
            ? { rotulo: "Distância da mediana", formato: "texto", valorTexto: "igual à mediana", unidade: "", periodo: semana, fonte: FONTE_CURTA, natureza: "CALCULADO", nota: "pontos percentuais ao ano" }
            : {
                rotulo: "Distância da mediana",
                valor: c.distanciaPp,
                valorTexto: `${num(Math.abs(c.distanciaPp))} p.p. ${c.distanciaPp < 0 ? "abaixo" : "acima"}`,
                unidade: "",
                periodo: semana,
                fonte: FONTE_CURTA,
                natureza: "CALCULADO",
                nota:
                  c.distanciaPct !== null ? (
                    <>
                      pontos percentuais ao ano; a taxa é {num(Math.abs(c.distanciaPct), 1)}% {c.distanciaPct < 0 ? "menor" : "maior"} que a mediana
                    </>
                  ) : (
                    "pontos percentuais ao ano"
                  ),
              },
          {
            rotulo: "Posição entre as instituições",
            valor: c.posicao.posicao,
            valorTexto: `${ordinal(c.posicao.posicao)} de ${c.posicao.n}`,
            unidade: "",
            periodo: semana,
            fonte: FONTE_CURTA,
            natureza: "CALCULADO",
            nota: (
              <>
                da menor para a maior taxa: {contagem(c.posicao.menores, "instituição informou", "instituições informaram")} taxa menor e{" "}
                {c.posicao.maiores.toLocaleString("pt-BR")}, maior
                {c.posicao.iguais > 0 ? <>; {contagem(c.posicao.iguais, "outra tem", "outras têm")} a mesma taxa</> : null}
              </>
            ),
          },
        ]
      : [
          {
            rotulo: `Mediana das ${s.n} instituições`,
            valor: s.mediana,
            valorTexto: taxa(s.mediana, "aa"),
            unidade: "",
            periodo: semana,
            fonte: FONTE_CURTA,
            natureza: "OBSERVADO",
            nota: "metade das instituições informou taxa menor e metade, maior",
          },
          { rotulo: "Metade central das instituições", formato: "texto", valorTexto: `${num(s.p25)}% a ${num(s.p75)}%`, unidade: "", periodo: semana, fonte: FONTE_CURTA, natureza: "OBSERVADO", nota: "ao ano, do primeiro ao terceiro quartil" },
          { rotulo: "Menor e maior taxa informadas", formato: "texto", valorTexto: `${num(s.min)}% e ${num(s.max)}%`, unidade: "", periodo: semana, fonte: FONTE_CURTA, natureza: "OBSERVADO", nota: "ao ano, nos extremos da distribuição" },
        ];

  return (
    <CascaCredito atual="quanto-meu-banco-cobra" molde>
      <PaginaPainel
        rota="/observatorio-do-credito/quanto-meu-banco-cobra"
        abertura={{
          grupo: "Observatório de Crédito",
          acento: "bronze",
          titulo: pagina.titulo,
          lead: "A página mostra a taxa média de juros que a instituição informou ao Banco Central nessa modalidade, ao lado das taxas das demais instituições que informaram a mesma modalidade na mesma semana.",
          acao: (
            <Controles rotulo="Escolha da consulta" idioma="pt">
              <div className="w-full space-y-3">
                <p className="text-sm text-carvao">Escolha o tipo de crédito e a instituição.</p>
                <SeletorJuros base={pagina.href} opcoes={opcoes} seg={c.segmento} mod={c.slug} banco={c.banco?.cnpj8 ?? ""} />
              </div>
            </Controles>
          ),
          recorte: {
            periodo: semana,
            universo: `${ROTULO_SEGMENTO[c.segmento]}, ${nomeMod.toLowerCase()}, ${contagem(s.n, "instituição", "instituições")}`,
            unidade: "% ao ano",
            fonte: "Banco Central do Brasil, taxas de juros por instituição (txjuros)",
          },
          limite:
            "o custo total do empréstimo nem se a taxa é adequada ao seu caso: a taxa publicada é só a de juros, média das operações da semana, e a posição muda de uma semana para outra.",
          fontesDatasSiglas: (
            <>
              <p>Dados até a semana de {janela(gold.modalidades.reduce((a, b) => (b.janela.fim > a.janela.fim ? b : a)).janela)}, a janela mais recente da publicação; cada modalidade traz a sua.</p>
              <p>{fonte}</p>
              <p>CET: Custo Efetivo Total. IOF: Imposto sobre Operações Financeiras. p.p.: pontos percentuais.</p>
            </>
          ),
        }}
        aviso={
          <>
            {c.ignorados.length > 0 && (
              <p role="status" className="mt-4 border-l-2 border-aviso bg-marfim px-4 py-2 text-sm text-carvao">
                O endereço pedia {c.ignorados.join(", ")} que não consta da publicação atual. A página mostra o recorte padrão no lugar.
              </p>
            )}
            {/* o título do resultado da consulta, logo antes das medidas do recorte */}
            <div className="pt-8">
              <p className="rotulo text-mineral">{ROTULO_SEGMENTO[c.segmento]}</p>
              <h2 id="resultado-titulo" className="mt-2 font-serif text-[clamp(1.5rem,3.2vw,2.1rem)] leading-tight text-carvao">
                {c.banco ? <>{c.banco.nome} em {nomeMod.toLowerCase()}</> : <>{nomeMod}: as {contagem(s.n, "instituição", "instituições")}</>}
              </h2>
              <p className="mt-2 text-sm text-carvao-muted">
                Taxas médias de juros em % ao ano, semana de {janela(m.janela)}. {contagem(s.n, "instituição informou", "instituições informaram")} esta modalidade nessa janela.
              </p>
              {atraso !== null && atraso > 45 && (
                <p className="mt-4 max-w-prose2 border-l-2 border-aviso bg-marfim px-4 py-2 text-sm leading-relaxed text-carvao" data-janela-antiga="">
                  A janela mais recente desta modalidade com instituições suficientes terminou em {dataBr(m.janela.fim)}, {atraso} dias antes desta publicação. As semanas seguintes chegaram ao
                  Banco Central com poucas instituições e ficam de fora até completar; por isso o número é mais antigo que o das demais modalidades.
                </p>
              )}
              {c.banco && !c.linha && (
                <div className="mt-6 max-w-prose2 border-l-2 border-linha pl-4" data-ausencia="">
                  <p className="font-medium text-carvao">
                    {c.banco.nome} não aparece na publicação do Banco Central para {nomeMod.toLowerCase()} na semana de {janela(m.janela)}.
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                    Ausência não é taxa zero, e a página não estima um valor no lugar. A instituição não informou taxa nessa modalidade e nessa janela, o que pode acontecer quando ela não
                    oferece o produto ou não contratou operações na semana. Abaixo, a distribuição das {s.n} instituições que informaram.
                  </p>
                  {c.outrasDoBanco.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm text-carvao">{c.banco.nome} informou taxa nestas modalidades:</p>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {c.outrasDoBanco.map((o) => {
                          const href = hrefConsulta(pagina.href, o.segmento, o.slug, c.banco?.cnpj8);
                          return (
                            <li key={`${o.segmento}:${o.slug}`}>
                              <Link href={href} prefetch={prefetchDoLink(href)} className="inline-flex min-h-[44px] items-center border border-linha px-3 text-sm text-carvao underline-offset-4 hover:border-bronze hover:underline">
                                {o.rotulo} {o.segmento === "pj" ? "· empresas" : "· pessoa física"}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        }
        rotuloNumeros="Medidas da consulta"
        numeros={numeros}
        figuras={
          <FiguraAnalitica
            id="distribuicao"
            pergunta={`Como as ${s.n} instituições se distribuem`}
            subtitulo={`Taxa média de juros de cada instituição, % ao ano, semana de ${janela(m.janela)}. Eixo a partir de zero.`}
            natureza="OBSERVADO"
            complemento={<AvisoCet className="max-w-prose2" />}
            naoConcluir="se a taxa de uma instituição é adequada ao seu caso: cada instituição pesa igual na mediana, grande ou pequena, a taxa de cada cliente varia com prazo, garantias e perfil, e a ordem muda de uma semana para outra."
            proveniencia={provenienciaJuros(gold, m, { indicador: `Taxa média de juros por instituição: ${nomeMod} (${ROTULO_SEGMENTO[c.segmento]})`, natureza: "OBSERVADO" })}
            tabela={{
              titulo: `Taxa média de juros de cada instituição em ${nomeMod.toLowerCase()}, semana de ${janela(m.janela)}, da menor para a maior`,
              colunas: ["Posição", "Instituição", "% ao ano", "% ao mês"],
              linhas: m.ranking.map((r) => [ordinal(r.posicao), r.nome, r.taxa_aa, r.taxa_am]),
              casas: [null, null, 2, 2],
              limite: m.ranking.length,
            }}
            depois={
              <p className="flex flex-wrap gap-x-6 gap-y-2">
                <Link href={hrefSimulador} prefetch={prefetchDoLink(hrefSimulador)} className="inline-flex min-h-[44px] items-center border border-carvao px-4 text-sm text-carvao hover:bg-marfim">
                  Calcular a parcela com {c.linha ? "esta taxa" : "a mediana"}
                </Link>
                <Link href={PAINEL_JUROS} prefetch={prefetchDoLink(PAINEL_JUROS)} className="inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">
                  Histórico e as 20 modalidades no painel de juros
                </Link>
              </p>
            }
          >
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
              <div data-figura-legado="distribuicao-taxas">
                <FaixaDistribuicao stats={s} taxas={m.ranking.map((r) => r.taxa_aa)} destaque={c.linha?.taxa_aa ?? null} nomeDestaque={c.banco?.nome} />
              </div>
              <dl className="grid gap-x-8 gap-y-3 self-start border-t border-linha pt-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
                {[
                  ["Menor taxa", s.min],
                  ["1º quartil", s.p25],
                  ["Mediana", s.mediana],
                  ["3º quartil", s.p75],
                  ["Maior taxa", s.max],
                ].map(([r, v]) => (
                  <div key={r as string} className="flex items-baseline justify-between gap-3">
                    <dt className="text-carvao-muted">{r}</dt>
                    <dd className="tabular-nums text-carvao">{num(v as number)}% ao ano</dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-carvao-muted">Instituições</dt>
                  <dd className="tabular-nums text-carvao">{s.n}</dd>
                </div>
              </dl>
            </div>
          </FiguraAnalitica>
        }
        notas={{
          id: "como-ler",
          titulo: "Como ler estes números",
          itens: [
            {
              termo: "Taxa média da instituição",
              definicao:
                "É a média das taxas de juros das operações que a instituição contratou na semana, ponderada pelo valor de cada operação, em % ao ano e % ao mês, como o Banco Central divulga. Não é a taxa de um contrato específico: a de cada cliente varia com o prazo, as garantias e o perfil de quem toma o crédito.",
            },
            {
              termo: "Mediana entre instituições",
              definicao:
                "Ordenadas as taxas das instituições que informaram a modalidade, a mediana é a do meio. Cada instituição pesa igual, grande ou pequena. Por isso ela difere da taxa média da modalidade nas séries do Banco Central, em que cada operação pesa pelo valor e os grandes bancos dominam.",
            },
            {
              termo: "Janela",
              definicao:
                "O Banco Central publica as taxas por semanas de cinco dias úteis. A página usa a semana mais recente em que a modalidade reuniu instituições suficientes; semanas recentes chegam incompletas e entram quando completam. Cada modalidade tem a sua janela, informada junto do número.",
            },
            {
              termo: "Posição e distância",
              definicao:
                "A posição ordena as instituições da menor para a maior taxa na janela. A distância da mediana é a diferença em pontos percentuais ao ano. Nenhuma das duas diz se a taxa é adequada ao seu caso, e a ordem muda de uma semana para outra.",
            },
            { termo: "Ausência", definicao: "Instituição sem taxa na modalidade aparece como ausente, nunca como zero." },
          ],
        }}
        metodo={
          <>
            <p>{fonte}</p>
            <p>
              O método completo, com os conceitos do arquivo de juros, está em{" "}
              <Link href="/observatorio-do-credito/metodologia" prefetch={prefetchDoLink("/observatorio-do-credito/metodologia")} className="text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">
                Metodologia e fontes do Crédito
              </Link>
              .
            </p>
          </>
        }
      />
    </CascaCredito>
  );
}
