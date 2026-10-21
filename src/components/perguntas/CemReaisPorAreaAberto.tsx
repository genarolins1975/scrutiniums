import Link from "next/link";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { FONTE_AREAS, ROTA_AREAS, composicao, datasDoExercicio, emCem, ultimoEncerrado, type Parcela } from "@/lib/contas-publicas/areas";
import { moeda, numero } from "@/lib/contas-publicas/formato";
import { prefetchDoLink } from "@/lib/rotasPublicas";

type Linha = { id: string; nome: string; cem: number; valor: number; tom: "divida" | "fora" | "area" };

/**
 * Agrupa para a consulta: a dívida numa linha só (juros, amortização e refinanciamento), as demais parcelas de
 * Encargos Especiais à parte e as áreas com pelo menos R$ 1 em cada R$ 100; as menores somadas em "Demais áreas".
 * Os R$ 100 de cada linha vêm da mesma divisão por maiores restos do painel, então a soma continua R$ 100,0.
 */
export function linhasDaConsulta(itens: (Parcela & { cem: number })[]): Linha[] {
  const soma = (l: (Parcela & { cem: number })[]) => ({ cem: Number(l.reduce((s, p) => s + p.cem, 0).toFixed(1)), valor: l.reduce((s, p) => s + p.valor, 0) });
  const divida = itens.filter((p) => p.tipo === "divida");
  const fora = itens.filter((p) => p.tipo === "encargos" || p.tipo === "reserva");
  const areas = itens.filter((p) => p.tipo === "area");
  const grandes = areas.filter((p) => p.cem >= 1);
  const pequenas = areas.filter((p) => p.cem < 1);
  return [
    ...(divida.length ? [{ id: "divida", nome: "Dívida pública: juros, amortização e refinanciamento", tom: "divida" as const, ...soma(divida) }] : []),
    ...fora.map((p) => ({ id: p.id, nome: p.nome, cem: p.cem, valor: p.valor, tom: "fora" as const })),
    ...grandes.map((p) => ({ id: p.id, nome: p.nome, cem: p.cem, valor: p.valor, tom: "area" as const })),
    ...(pequenas.length ? [{ id: "demais", nome: `Demais áreas (${pequenas.length} funções)`, tom: "area" as const, ...soma(pequenas) }] : []),
  ];
}

const COR: Record<Linha["tom"], string> = { divida: "bg-bronze-dark", fora: "bg-carvao-muted", area: "bg-obee-dark" };

/**
 * "Quanto de cada R$ 100 do governo federal vai para cada área?" na página aberta das Contas Públicas (leva 2, item
 * cem-reais-por-area de src/lib/rotasPublicas.ts, desligado até a aprovação do dono). Versão de consulta do painel
 * Despesa por área (/contas-publicas/por-area, com conta): só o último exercício encerrado, no estágio pago, com a
 * mesma conta do painel (src/lib/contas-publicas/areas.ts). Sem série, sem outros estágios, sem subfunções e sem
 * download: tudo isso fica no painel, com selo. Montada no servidor; nenhum arquivo é buscado no navegador.
 */
export function CemReaisPorAreaAberto() {
  const ano = ultimoEncerrado();
  const c = ano === null ? null : composicao(ano, "pago", "total");
  const itens = c ? emCem(c) : null;
  const linhas = itens ? linhasDaConsulta(itens) : null;
  const datas = ano === null ? null : datasDoExercicio(ano);
  const divida = linhas?.find((l) => l.id === "divida");
  const refin = itens?.find((p) => p.id === "divida-refinanciamento");
  const refinMaior = !!divida && !!refin && refin.cem > divida.cem / 2;
  const areas = linhas?.filter((l) => l.tom === "area") ?? [];
  const somaAreas = Number(areas.reduce((s, l) => s + l.cem, 0).toFixed(1));

  return (
    <section aria-labelledby="cem-area-titulo" data-leva2="cem-reais-por-area" className="border-b border-linha">
      <div className="mx-auto grid max-w-page gap-6 px-6 py-10 md:py-12 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-4">
          <p className="rotulo text-mineral">Quanto de cada R$ 100 do governo federal vai para cada área?</p>
          <h2 id="cem-area-titulo" className="mt-3 font-serif text-[clamp(1.5rem,2.6vw,1.9rem)] leading-tight text-carvao">
            {ano !== null ? `Cada R$ 100 pagos em ${ano}, por área de governo` : "Cada R$ 100 pagos, por área de governo"}
          </h2>
          <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            A área é a função do orçamento: previdência, saúde, educação e as demais. A dívida pública e os repasses a estados e
            municípios não são áreas e aparecem à parte. O número diz para onde o dinheiro foi, não o que ele entregou.
          </p>
        </div>

        <div className="min-w-0 lg:col-span-8">
          {ano === null || !c || !linhas ? (
            <p className="border border-linha bg-papel p-5 text-sm text-carvao">
              Indisponível nesta publicação: a base do SIOP por função não traz um exercício encerrado com o valor pago completo.
            </p>
          ) : (
            <figure className="m-0">
              <div aria-hidden="true" className="flex h-11 w-full overflow-hidden bg-marfim">
                {linhas.map((l) => (
                  <span
                    key={l.id}
                    style={{ width: `${l.cem}%` }}
                    className={`flex items-center justify-center overflow-hidden border-r-2 border-papel text-xs tabular-nums text-superficie md:text-sm ${COR[l.tom]}`}
                  >
                    {l.cem >= 6 ? numero(l.cem) : ""}
                  </span>
                ))}
              </div>
              <figcaption className="sr-only">Repartição de cada R$ 100 pagos pelo orçamento federal em {ano}, por área de governo, com a dívida à parte.</figcaption>
              <ol aria-label={`Cada R$ 100 pagos em ${ano}, por área`} className="mt-4 grid gap-x-8 sm:grid-cols-2">
                {linhas.map((l) => (
                  <li key={l.id} className="flex items-baseline justify-between gap-4 border-b border-linha py-3 text-sm leading-snug">
                    <span className={`flex items-baseline gap-2 ${l.tom === "divida" ? "text-bronze-dark" : "text-carvao"}`}>
                      <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 ${COR[l.tom]}`} />
                      {l.nome}
                    </span>
                    <strong className="whitespace-nowrap font-medium tabular-nums text-carvao">R$ {numero(l.cem)}</strong>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-sm leading-relaxed text-carvao">
                Total pago em {ano}: <strong className="font-medium tabular-nums">{moeda(c.total, "reais")}</strong>, em valores nominais.
                {divida
                  ? ` R$ ${numero(divida.cem)} de cada R$ 100 foram para a dívida, em bronze${refin ? `; R$ ${numero(refin.cem)} deles${refinMaior ? ", a maior parte," : ""} são refinanciamento, a troca de títulos que vencem por títulos novos` : ""}.`
                  : ""}{" "}
                As áreas de governo ficaram com R$ {numero(somaAreas)}.
              </p>
              <p className="mt-3 text-xs leading-relaxed text-mineral">
                Fonte:{" "}
                <a href={FONTE_AREAS.documentacao} className="underline decoration-linha underline-offset-4 hover:text-carvao">
                  SIOP, dados abertos
                </a>
                , Orçamentos Fiscal e da Seguridade Social da União por função, valor pago no exercício de {ano} (encerrado), base atualizada
                em {datas?.atualizacao} e capturada em {datas?.captura}. Cálculo sobre os valores pagos, não estimativa: cada parcela é
                arredondada por maiores restos para fechar R$ 100,0. Pagamentos de restos a pagar de anos anteriores não entram.
              </p>
              <p className="mt-2">
                <Link href={ROTA_AREAS} prefetch={prefetchDoLink(ROTA_AREAS)} className="inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">
                  A série desde {FONTE_AREAS.primeiroAno}, os outros estágios e o detalhe de cada área no painel
                  <SeloComConta href={ROTA_AREAS} />
                </Link>
              </p>
            </figure>
          )}
        </div>
      </div>
    </section>
  );
}
