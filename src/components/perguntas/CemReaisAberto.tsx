import Link from "next/link";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { capturaSiop, FONTE_SIOP, parcelasPagas, ultimoExercicioEncerrado } from "@/lib/contas-publicas/cemReais";
import { dataFonte } from "@/lib/contas-publicas/dados";
import { dividirEmCem, moeda, numero } from "@/lib/contas-publicas/formato";
import { prefetchDoLink } from "@/lib/rotasPublicas";

/** Painel com o ano em curso, os valores exatos e o caminho do orçamento (com conta). */
const PAINEL = "/contas-publicas";

/**
 * "Para onde vão R$ 100 dos meus impostos?" na página aberta das Contas Públicas
 * (leva 2, item cem-reais-dos-impostos de src/lib/rotasPublicas.ts): o artefato
 * CemReaisPagos do painel, na versão de consulta. Só o último exercício
 * encerrado, com a mesma conta do painel (src/lib/contas-publicas/cemReais.ts);
 * o ano em curso, a tabela exata e o arquivo ficam com conta. É cálculo sobre os
 * valores pagos, não modelo nem estimativa. Sem dado, diz que está indisponível.
 */
export function CemReaisAberto() {
  const ex = ultimoExercicioEncerrado();
  const parcelas = ex ? parcelasPagas(ex.ano) : null;
  const total = parcelas?.reduce((s, p) => s + p.valor, 0) ?? 0;
  const partes = parcelas && total > 0 ? dividirEmCem(parcelas.map((p) => p.valor)) : null;

  return (
    <section aria-labelledby="cem-reais-titulo" data-leva2="cem-reais-dos-impostos" className="border-b border-linha">
      <div className="mx-auto grid max-w-page gap-6 px-6 py-10 md:py-12 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-4">
          <p className="rotulo text-mineral">Para onde vão R$ 100 dos meus impostos?</p>
          <h2 id="cem-reais-titulo" className="mt-3 font-serif text-[clamp(1.5rem,2.6vw,1.9rem)] leading-tight text-carvao">
            {ex ? `Cada R$ 100 que o governo federal pagou em ${ex.ano}` : "Cada R$ 100 que o governo federal pagou"}
          </h2>
          <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            O orçamento federal não é pago só com impostos: a União também se financia emitindo títulos, e parte do que ela paga é
            a própria dívida vencendo e sendo trocada por dívida nova. A régua reparte os pagamentos por grupo de despesa, não por
            área como saúde ou educação.
          </p>
        </div>

        <div className="min-w-0 lg:col-span-8">
          {!ex || !parcelas || !partes ? (
            <p className="border border-linha bg-papel p-5 text-sm text-carvao">
              Indisponível nesta publicação: o snapshot do SIOP não traz um exercício encerrado com total pago positivo.
            </p>
          ) : (
            <figure className="m-0">
              <div aria-hidden="true" className="flex h-11 w-full overflow-hidden bg-marfim">
                {parcelas.map((p, i) => (
                  <span
                    key={p.id}
                    style={{ width: `${partes[i]}%` }}
                    className={`flex items-center justify-center overflow-hidden border-r-2 border-papel text-xs tabular-nums text-superficie md:text-sm ${p.financeiro ? "bg-bronze-dark" : "bg-obee-dark"}`}
                  >
                    {partes[i] >= 5 ? numero(partes[i]) : ""}
                  </span>
                ))}
              </div>
              <figcaption className="sr-only">Repartição de cada R$ 100 pagos pelo orçamento federal em {ex.ano}, por grupo de despesa.</figcaption>
              <ol aria-label={`Cada R$ 100 pagos em ${ex.ano}, por grupo de despesa`} className="mt-4 grid gap-x-8 sm:grid-cols-2">
                {parcelas.map((p, i) => (
                  <li key={p.id} className="flex items-baseline justify-between gap-4 border-b border-linha py-3 text-sm leading-snug">
                    <span className={`flex items-center gap-2 ${p.financeiro ? "text-bronze-dark" : "text-carvao"}`}>
                      <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 ${p.financeiro ? "bg-bronze-dark" : "bg-obee-dark"}`} />
                      {p.nome}
                    </span>
                    <strong className="whitespace-nowrap font-medium tabular-nums text-carvao">R$ {numero(partes[i])}</strong>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-sm leading-relaxed text-carvao">
                Total pago em {ex.ano}: <strong className="font-medium tabular-nums">{moeda(ex.totalPago, "reais")}</strong>, em valores nominais. Em
                bronze, a dívida: juros e amortização, que inclui o refinanciamento.
              </p>
              <p className="mt-3 text-xs leading-relaxed text-mineral">
                Fonte:{" "}
                <a href={FONTE_SIOP} className="underline decoration-linha underline-offset-4 hover:text-carvao">
                  SIOP, dados abertos
                </a>
                , Orçamento Fiscal e da Seguridade Social da União, valores pagos no exercício de {ex.ano} (encerrado), base atualizada em{" "}
                {dataFonte(ex.atualizacao)} e capturada em {capturaSiop()}. Cálculo sobre os valores pagos, não estimativa: cada parcela é
                arredondada por maiores restos para fechar R$ 100,0. Pagamentos de restos a pagar de anos anteriores não entram.
              </p>
              <p className="mt-2">
                <Link href={PAINEL} prefetch={prefetchDoLink(PAINEL)} className="inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">
                  O ano em curso e os valores exatos no painel
                  <SeloComConta href={PAINEL} />
                </Link>
              </p>
            </figure>
          )}
        </div>
      </div>
    </section>
  );
}
