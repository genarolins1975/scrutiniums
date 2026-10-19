import type { Metadata } from "next";
import Link from "next/link";
import { AberturaCredito, AvisoCet, CascaCredito, SecaoCredito } from "@/components/credito/Blocos";
import { SeletorJuros } from "@/components/credito/SeletorJuros";
import { SimuladorParcela, type TaxaReferencia } from "@/components/credito/SimuladorParcela";
import { ehPosFixada, goldJuros, hrefConsulta, naoEhParcelada, opcoesSeletor, resolverConsulta, rotuloModalidade, type ParametrosConsulta } from "@/lib/credito/juros";
import { diaBrasilia, janela, num } from "@/lib/credito/formato";
import { paginaCredito } from "@/lib/credito/navegacao";
import { prefetchDoLink } from "@/lib/rotasPublicas";

/**
 * Simulador do custo da dívida (Onda 2 da banca de 19/10/2026): parcela pela tabela Price, total pago e juros totais
 * com a taxa publicada pelo Banco Central (juros.json, txjuros) para o banco e a modalidade escolhidos, ou a mediana da
 * modalidade; o leitor pode digitar a própria taxa e o CET do contrato. Rotulado como cálculo, não previsão nem oferta.
 *
 * Rota com conta (não consta de src/lib/rotasPublicas.ts). Dinâmica: recorte e campos vêm da URL.
 */
export const dynamic = "force-dynamic";

const pagina = paginaCredito("simulador-da-parcela");

export const metadata: Metadata = {
  title: `${pagina.titulo} Simulador do custo da dívida`,
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
  robots: { index: false },
};

function texto(v: string | string[] | undefined, max = 24): string {
  const s = (Array.isArray(v) ? v[0] : v) ?? "";
  return s.slice(0, max).replace(/[^\d.,]/g, "");
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
    referencia = c.linha
      ? {
          aa: c.linha.taxa_aa,
          am: c.linha.taxa_am,
          origem: "banco",
          descricao: `Taxa média publicada pelo Banco Central para ${c.banco?.nome} em ${nomeMod}, semana de ${janela(c.modalidade.janela)}. Você pode digitar a sua.`,
        }
      : {
          aa: c.modalidade.stats.mediana,
          am: null,
          origem: "mediana",
          descricao: `Mediana das taxas das ${c.modalidade.stats.n} instituições que informaram ${nomeMod} ao Banco Central, semana de ${janela(c.modalidade.janela)}. Você pode digitar a sua.`,
        };
  }

  return (
    <CascaCredito atual="simulador-da-parcela">
      <AberturaCredito
        titulo={pagina.titulo}
        fonte={gold ? <>Taxas: Banco Central do Brasil (txjuros, portal Olinda), publicação processada em {diaBrasilia(gold.gerado_em)}.</> : undefined}
      >
        <p>
          Informe o valor e o prazo. A página calcula a parcela, o total pago e os juros pela tabela Price, com a taxa média que o Banco Central publicou
          para o banco e a modalidade que você escolher, ou com a taxa do seu contrato.
        </p>
        <p className="text-sm">
          É um cálculo, não uma previsão nem uma oferta de crédito. Usa só a taxa publicada pelo Banco Central ou a que você digitar, e a taxa média não é o
          CET: tarifas, seguros e tributos ficam fora, a não ser que você informe o CET do contrato.
        </p>
      </AberturaCredito>

      {gold && c && referencia ? (
        <>
          <section aria-label="Taxa de referência" className="border border-linha bg-superficie p-4 md:p-5">
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
          </section>

          {c.ignorados.length > 0 && (
            <p role="status" className="mt-4 border-l-2 border-aviso bg-marfim px-4 py-2 text-sm text-carvao">
              O endereço pedia {c.ignorados.join(", ")} que não consta da publicação atual. A página usa o recorte padrão no lugar.
            </p>
          )}

          {c.banco && !c.linha && (
            <p className="mt-4 max-w-prose2 border-l-2 border-linha bg-marfim px-4 py-2 text-sm leading-relaxed text-carvao" data-ausencia="">
              {c.banco.nome} não informou taxa ao Banco Central em {rotuloModalidade(c.modalidade.modalidade).toLowerCase()} na semana de{" "}
              {janela(c.modalidade.janela)}. O cálculo usa a mediana da modalidade, {num(c.modalidade.stats.mediana)}% ao ano; não é a taxa desse banco.
            </p>
          )}

          {(ehPosFixada(c.modalidade.modalidade) || naoEhParcelada(c.modalidade.modalidade)) && (
            <div className="mt-4 max-w-prose2 space-y-2 border-l-2 border-aviso bg-marfim px-4 py-2 text-sm leading-relaxed text-carvao" data-aviso-modalidade="">
              {ehPosFixada(c.modalidade.modalidade) && (
                <p>
                  Modalidade pós-fixada: o custo final acompanha a variação do indexador ao longo do contrato. O cálculo trata a taxa publicada como fixa e não
                  reproduz essa variação.
                </p>
              )}
              {naoEhParcelada(c.modalidade.modalidade) && (
                <p>
                  Esta modalidade costuma não ser paga em parcelas iguais (no cheque especial e no rotativo, por exemplo, os juros incidem sobre o saldo de cada
                  período). O cálculo mostra quanto custaria uma dívida desse valor paga em parcelas iguais à mesma taxa; não reproduz a cobrança da modalidade.
                </p>
              )}
            </div>
          )}

          <section aria-labelledby="calculo-titulo" className="pt-10">
            <h2 id="calculo-titulo" className="sr-only">
              Cálculo da parcela
            </h2>
            <SimuladorParcela
              key={`${c.segmento}|${c.slug}|${c.banco?.cnpj8 ?? ""}`}
              referencia={referencia}
              mediana={referencia.origem === "banco" ? c.modalidade.stats.mediana : null}
              iniciais={iniciais}
            />
          </section>

          <AvisoCet className="mt-10 max-w-prose2" />

          <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            {(() => {
              const href = hrefConsulta("/observatorio-do-credito/quanto-meu-banco-cobra", c.segmento, c.slug, c.banco?.cnpj8);
              return (
                <Link href={href} prefetch={prefetchDoLink(href)} className="inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">
                  Ver a posição desta taxa entre as instituições
                </Link>
              );
            })()}
          </p>
        </>
      ) : (
        <div className="max-w-prose2 border border-linha bg-superficie p-5" data-ausencia="">
          <p className="text-sm leading-relaxed text-carvao">
            A publicação das taxas por instituição não está disponível nesta versão do site; o simulador não pré-preenche taxa. Nenhum número é mostrado no
            lugar dela.
          </p>
        </div>
      )}

      <SecaoCredito id="como-calculamos" titulo="Como calculamos">
        <details className="max-w-prose2 border-t border-linha pt-3 text-sm leading-relaxed text-carvao-muted" data-como-calculamos="">
          <summary className="flex min-h-[44px] cursor-pointer items-center text-carvao">Fórmulas, hipóteses e o que fica de fora</summary>
          <div className="mt-3 space-y-4">
            <div>
              <p className="font-medium text-carvao">1. Da taxa ao ano para a taxa ao mês (juros compostos)</p>
              <p className="mt-1 font-label tabular-nums text-carvao">taxa ao mês = (1 + taxa ao ano)^(1/12) − 1</p>
              <p className="mt-1">É a mesma conversão que o Banco Central usa ao publicar as duas taxas. Ex.: 12,68% ao ano equivalem a 1,00% ao mês.</p>
            </div>
            <div>
              <p className="font-medium text-carvao">2. Parcela pela tabela Price</p>
              <p className="mt-1 font-label tabular-nums text-carvao">parcela = valor × i ÷ [1 − (1 + i)^(−n)]</p>
              <p className="mt-1">
                i é a taxa ao mês em forma decimal e n, o número de parcelas. Com taxa zero, a parcela é o valor dividido por n. As parcelas são iguais e
                mensais, a primeira um mês depois da contratação, sem carência.
              </p>
            </div>
            <div>
              <p className="font-medium text-carvao">3. Total pago e juros</p>
              <p className="mt-1 font-label tabular-nums text-carvao">total pago = parcela × n; juros totais = total pago − valor</p>
            </div>
            <div>
              <p className="font-medium text-carvao">4. Comparação com o CET</p>
              <p className="mt-1">
                O CET é a taxa que iguala o valor liberado às parcelas pagas, com juros, tarifas, seguros e tributos. Com parcelas iguais, a parcela compatível
                com o CET é a parcela Price do mesmo valor calculada ao CET (convertido para ao mês pela fórmula 1). A diferença entre os dois totais mostra
                quanto os encargos além dos juros mudam o custo.
              </p>
            </div>
            <div>
              <p className="font-medium text-carvao">O que o cálculo não considera</p>
              <p className="mt-1">
                IOF, tarifas e seguros só entram pelo CET que você informar. Não há correção por indexador, atraso, amortização antecipada nem carência. A taxa
                publicada é uma média das operações da semana, não a taxa que o banco ofereceria a você. Os valores são arredondados para centavos só na
                exibição.
              </p>
            </div>
          </div>
        </details>
      </SecaoCredito>
    </CascaCredito>
  );
}
