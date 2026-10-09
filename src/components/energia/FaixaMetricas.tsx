import type { ReactNode } from "react";

/**
 * Faixa de métricas da abertura: de duas a seis medidas lado a lado, separadas por linhas finas (sem cartões). Cada medida é um
 * `Numero` com `variante="faixa"`, que traz rótulo, valor, unidade, período, selo de natureza e, quando há evidência, o gatilho
 * "Comprove este número". Os valores vêm dos mesmos seletores que alimentam o gráfico, a tabela e a exportação da página: a faixa
 * nunca calcula nada por conta própria.
 *
 * Responsabilidade do chamador: escolher medidas que respondam à pergunta da página, cada uma com a sua data e o seu universo, e
 * nunca somar nem comparar dois valores de datas ou universos diferentes dentro da faixa (a divergência de datas entre a Visão
 * geral e os módulos aparece na linha de contexto de cada medida, não num rótulo genérico de atualização).
 */
export function FaixaMetricas({
  children,
  colunas = 3,
  rotulo = "Indicadores principais da página",
  nota,
}: {
  children: ReactNode;
  colunas?: 2 | 3 | 4 | 5 | 6;
  /** Nome acessível do grupo. */
  rotulo?: string;
  /** Ressalva que vale para a faixa inteira (universo, regra de comparação). Fica junto às medidas. */
  nota?: ReactNode;
}) {
  return (
    <section aria-label={rotulo} className="ed-faixa" data-faixa-metricas="">
      <div className="ed-faixa-grade" data-colunas={colunas}>
        {children}
      </div>
      {nota && <div className="mt-4 max-w-prose2 text-xs leading-relaxed text-carvao-muted">{nota}</div>}
    </section>
  );
}
