import type { Metadata } from "next";
import Link from "next/link";
import { AberturaCredito, AvisoCet, CascaCredito, SecaoCredito } from "@/components/credito/Blocos";
import { SeletorJuros } from "@/components/credito/SeletorJuros";
import { ComparacaoCet, FormularioParcela, ProvedorParcela, ResultadoParcela, type TaxaReferencia } from "@/components/credito/SimuladorParcela";
import { Controles, PaginaPainel } from "@/components/painel";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { ehPosFixada, goldJuros, NOTA_TAXA_ZERO, hrefConsulta, naoEhParcelada, opcoesSeletor, resolverConsulta, rotuloModalidade, ROTULO_SEGMENTO, type ParametrosConsulta } from "@/lib/credito/juros";
import { diaBrasilia, janela, num } from "@/lib/credito/formato";
import { paginaCredito } from "@/lib/credito/navegacao";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import { tituloNaColecao } from "@/lib/observatorios/contexto";

/**
 * Simulador do custo da dívida (Onda 2 da banca de 19/10/2026): parcela pela tabela Price, total pago e juros totais
 * com a taxa publicada pelo Banco Central (juros.json, txjuros) para o banco e a modalidade escolhidos, ou a mediana da
 * modalidade; o leitor pode digitar a própria taxa e o CET do contrato. Rotulado como cálculo, não previsão nem oferta.
 *
 * No molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026), como consulta: a escolha da taxa de referência e o formulário
 * são a ação da abertura, o resultado é a faixa de números, a comparação com o CET é um capítulo e as fórmulas vão para o método. As
 * ilhas do simulador compartilham o estado pelo ProvedorParcela, que envolve a página.
 *
 * Rota com conta (não consta de src/lib/rotasPublicas.ts). Dinâmica: recorte e campos vêm da URL.
 */
export const dynamic = "force-dynamic";

const pagina = paginaCredito("simulador-da-parcela");

export const metadata: Metadata = {
  title: tituloNaColecao(`${pagina.titulo} Simulador do custo da dívida`, pagina.href),
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
  robots: { index: false },
};

function texto(v: string | string[] | undefined, max = 24): string {
  const s = (Array.isArray(v) ? v[0] : v) ?? "";
  return s.slice(0, max).replace(/[^\d.,]/g, "");
}

/** As fórmulas e hipóteses do cálculo: o método da página (antes, a seção "Como calculamos"). */
function ComoCalculamos() {
  return (
    <div className="space-y-4" data-como-calculamos="">
      <p className="font-medium text-carvao">Como calculamos: fórmulas, hipóteses e o que fica de fora</p>
      <div>
        <p className="font-medium text-carvao">1. Da taxa ao ano para a taxa ao mês (juros compostos)</p>
        <p className="mt-1 font-label tabular-nums text-carvao">taxa ao mês = (1 + taxa ao ano)^(1/12) − 1</p>
        <p className="mt-1">É a mesma conversão que o Banco Central usa ao publicar as duas taxas. Ex.: 12,68% ao ano equivalem a 1,00% ao mês.</p>
      </div>
      <div>
        <p className="font-medium text-carvao">2. Parcela pela tabela Price</p>
        <p className="mt-1 font-label tabular-nums text-carvao">parcela = valor × i ÷ [1 − (1 + i)^(−n)]</p>
        <p className="mt-1">
          i é a taxa ao mês em forma decimal e n, o número de parcelas. Com taxa zero, a parcela é o valor dividido por n. As parcelas são iguais e mensais, a primeira um mês depois da
          contratação, sem carência.
        </p>
      </div>
      <div>
        <p className="font-medium text-carvao">3. Total pago e juros</p>
        <p className="mt-1 font-label tabular-nums text-carvao">total pago = parcela × n; juros totais = total pago − valor</p>
      </div>
      <div>
        <p className="font-medium text-carvao">4. Comparação com o CET</p>
        <p className="mt-1">
          O CET é a taxa que iguala o valor liberado às parcelas pagas, com juros, tarifas, seguros e tributos. Com parcelas iguais, a parcela compatível com o CET é a parcela Price do mesmo
          valor calculada ao CET (convertido para ao mês pela fórmula 1). A diferença entre os dois totais mostra quanto os encargos além dos juros mudam o custo.
        </p>
      </div>
      <div>
        <p className="font-medium text-carvao">O que o cálculo não considera</p>
        <p className="mt-1">
          IOF, tarifas e seguros só entram pelo CET que você informar. Não há correção por indexador, atraso, amortização antecipada nem carência. A taxa publicada é uma média das operações
          da semana, não a taxa que o banco ofereceria a você. Os valores são arredondados para centavos só na exibição.
        </p>
      </div>
    </div>
  );
}

export default function SimuladorDaParcelaPage({ searchParams = {} }: { searchParams?: ParametrosConsulta }) {
  const gold = goldJuros();
  const c = gold ? resolverConsulta(gold, searchParams) : null;
  const unidade = (Array.isArray(searchParams.un) ? searchParams.un[0] : searchParams.un) === "am" ? "am" : "aa";
  const iniciais = {
    valor: texto(searchParams.valor) || "10.000",
    prazo: texto(searchParams.prazo, 4).replace(/\D/g, "") || "24",
    taxa: texto(searchParams.taxa),
    unidade: unidade as "aa" | "am",
    cet: texto(searchParams.cet),
  };

  let referencia: TaxaReferencia | null = null;
  if (gold && c) {
    const nomeMod = rotuloModalidade(c.modalidade.modalidade).toLowerCase();
    const periodo = `semana de ${janela(c.modalidade.janela)}`;
    referencia = c.linha
      ? {
          aa: c.linha.taxa_aa,
          am: c.linha.taxa_am,
          origem: "banco",
          descricao: `Taxa média publicada pelo Banco Central para ${c.banco?.nome} em ${nomeMod}, semana de ${janela(c.modalidade.janela)}. Você pode digitar a sua.`,
          periodo,
        }
      : c.comparacao.stats ? {
          aa: c.comparacao.stats.mediana,
          am: null,
          origem: "mediana",
          descricao: `Mediana das taxas das ${c.comparacao.stats.n} instituições que informaram ${nomeMod} ao Banco Central, semana de ${janela(c.modalidade.janela)}. Você pode digitar a sua.`,
          periodo,
        } : null;
  }

  const lead =
    "A página calcula a parcela, o total pago e os juros pela tabela Price, com a taxa média que o Banco Central publicou para o banco e a modalidade que você escolher, ou com a taxa do seu contrato.";
  const naoPrevisao = (
    <p className="text-sm">
      É um cálculo, não uma previsão nem uma oferta de crédito. Usa só a taxa publicada pelo Banco Central ou a que você digitar, e a taxa média não é o CET: tarifas, seguros e tributos
      ficam fora, a não ser que você informe o CET do contrato.
    </p>
  );

  // sem a publicação das taxas, a página declara a ausência no formato de antes: não há recorte nem número para o molde
  if (!gold || !c || !referencia) {
    return (
      <CascaCredito atual="simulador-da-parcela">
        <AberturaCredito titulo={pagina.titulo}>
          <p>Informe o valor e o prazo. {lead}</p>
          {naoPrevisao}
        </AberturaCredito>
        <div className="max-w-prose2 border border-linha bg-superficie p-5" data-ausencia="">
          <p className="text-sm leading-relaxed text-carvao">
            {gold && c ? "Não há taxa elegível para pré-preencher esta modalidade e semana. Escolha outra modalidade ou uma instituição que tenha informado taxa." : "A publicação das taxas por instituição não está disponível nesta versão do site; o simulador não pré-preenche taxa. Nenhum número é mostrado no lugar dela."}
          </p>
        </div>
        <SecaoCredito id="como-calculamos" titulo="Como calculamos">
          <details className="max-w-prose2 border-t border-linha pt-3 text-sm leading-relaxed text-carvao-muted">
            <summary className="flex min-h-[44px] cursor-pointer items-center text-carvao">Fórmulas, hipóteses e o que fica de fora</summary>
            <div className="mt-3">
              <ComoCalculamos />
            </div>
          </details>
        </SecaoCredito>
      </CascaCredito>
    );
  }

  const hrefPosicao = hrefConsulta("/observatorio-do-credito/quanto-meu-banco-cobra", c.segmento, c.slug, c.banco?.cnpj8);
  const nomeMod = rotuloModalidade(c.modalidade.modalidade);
  return (
    <CascaCredito atual="simulador-da-parcela" molde>
      {/* o estado do cálculo vale para o formulário, o resultado e a comparação com o CET; a chave reinicia o cálculo quando o recorte muda */}
      <ProvedorParcela key={`${c.segmento}|${c.slug}|${c.banco?.cnpj8 ?? ""}`} referencia={referencia} mediana={referencia.origem === "banco" && c.linha?.taxa_aa !== 0 ? c.comparacao.stats?.mediana ?? null : null} iniciais={iniciais}>
        <PaginaPainel
          rota="/observatorio-do-credito/simulador-da-parcela"
          abertura={{
            grupo: "Observatório de Crédito",
            acento: "bronze",
            titulo: pagina.titulo,
            lead,
            acao: (
              <div className="space-y-4">
                <Controles rotulo="Taxa de referência" idioma="pt">
                  <div className="w-full">
                    <p className="mb-3 text-sm text-carvao">De onde vem a taxa pré-preenchida</p>
                    <SeletorJuros
                      base={pagina.href}
                      opcoes={opcoesSeletor(gold)}
                      seg={c.segmento}
                      mod={c.slug}
                      banco={c.banco?.cnpj8 ?? ""}
                      manter={{ valor: iniciais.valor, prazo: iniciais.prazo, cet: iniciais.cet }}
                      limpar={["taxa", "un"]}
                      rotuloBanco="Banco ou instituição"
                    />
                  </div>
                </Controles>
                <Controles rotulo="Cálculo da parcela" idioma="pt">
                  <div className="w-full">
                    <p className="mb-3 text-sm text-carvao">Informe o valor e o prazo.</p>
                    <FormularioParcela />
                  </div>
                </Controles>
              </div>
            ),
            recorte: {
              periodo: referencia.periodo,
              universo: `${ROTULO_SEGMENTO[c.segmento]}, ${nomeMod.toLowerCase()}${c.banco ? `, ${c.banco.nome}` : ""}`,
              unidade: "R$ e % ao ano",
              fonte: "Banco Central do Brasil, taxas de juros por instituição (txjuros); cálculo pela tabela Price",
            },
            limite:
              "a taxa que o banco ofereceria a você nem o custo final do contrato: a taxa publicada é uma média das operações da semana, e IOF, tarifas e seguros só entram pelo CET informado.",
            fontesDatasSiglas: (
              <>
                <p>Taxas: Banco Central do Brasil (txjuros, portal Olinda), publicação processada em {diaBrasilia(gold.gerado_em)}.</p>
                <p>CET: Custo Efetivo Total. IOF: Imposto sobre Operações Financeiras.</p>
              </>
            ),
          }}
          aviso={
            <div className="mt-4 space-y-4">
              <div className="max-w-prose2 text-carvao-muted">{naoPrevisao}</div>
              {c.ignorados.length > 0 && (
                <p role="status" className="border-l-2 border-aviso bg-marfim px-4 py-2 text-sm text-carvao">
                  O endereço pedia {c.ignorados.join(", ")} que não consta da publicação atual. A página usa o recorte padrão no lugar.
                </p>
              )}
              {c.linha?.taxa_aa === 0 && <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-taxa-zero={c.banco?.cnpj8}>{NOTA_TAXA_ZERO} O cálculo mantém a taxa publicada; você pode informar a taxa do seu contrato.</p>}
              {c.banco && !c.linha && (
                <p className="max-w-prose2 border-l-2 border-linha bg-marfim px-4 py-2 text-sm leading-relaxed text-carvao" data-ausencia="">
                  {c.banco.nome} não informou taxa ao Banco Central em {rotuloModalidade(c.modalidade.modalidade).toLowerCase()} na semana de {janela(c.modalidade.janela)}. O cálculo usa a
                  mediana da modalidade, {num(c.comparacao.stats!.mediana)}% ao ano; não é a taxa desse banco.
                </p>
              )}
              {(ehPosFixada(c.modalidade.modalidade) || naoEhParcelada(c.modalidade.modalidade)) && (
                <div className="max-w-prose2 space-y-2 border-l-2 border-aviso bg-marfim px-4 py-2 text-sm leading-relaxed text-carvao" data-aviso-modalidade="">
                  {ehPosFixada(c.modalidade.modalidade) && (
                    <p>
                      Modalidade pós-fixada: o custo final acompanha a variação do indexador ao longo do contrato. O cálculo trata a taxa publicada como fixa e não reproduz essa variação.
                    </p>
                  )}
                  {naoEhParcelada(c.modalidade.modalidade) && (
                    <p>
                      Esta modalidade costuma não ser paga em parcelas iguais (no cheque especial e no rotativo, por exemplo, os juros incidem sobre o saldo de cada período). O cálculo
                      mostra quanto custaria uma dívida desse valor paga em parcelas iguais à mesma taxa; não reproduz a cobrança da modalidade.
                    </p>
                  )}
                </div>
              )}
            </div>
          }
          faixaNumeros={<ResultadoParcela />}
          navegacaoLocal={
            <div className="mt-8 space-y-6">
              <AvisoCet className="max-w-prose2" />
              <p className="flex flex-wrap gap-x-6 gap-y-2">
                <Link href={hrefPosicao} prefetch={prefetchDoLink(hrefPosicao)} className="inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">
                  Ver a posição desta taxa entre as instituições
                </Link>
              </p>
            </div>
          }
          figuras={
            <Recolhido id="cet" aberto nivelTitulo={2} titulo="E com o CET do contrato?" resumo="Parcela, total pago e diferença calculados ao CET que você informar, ao lado do cálculo só com juros.">
              <div className="pb-6">
                <ComparacaoCet />
              </div>
            </Recolhido>
          }
          metodo={<ComoCalculamos />}
        />
      </ProvedorParcela>
    </CascaCredito>
  );
}
