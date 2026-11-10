import { mesAno, num } from "@/lib/perguntas/leitura";
import type { SerieMedida } from "@/lib/divida/dados";

/**
 * Corpo do modelo didático "Duas réguas para a mesma dívida" (painel Dívida das famílias). Renderizado no servidor, sem
 * script: duas barras de R$ 100, uma para a renda do mês (o que sai em parcelas) e outra para a renda de 12 meses (o que
 * se deve no total). Os dois percentuais são os da gold do Crédito, com o mês de cada um; nada é escrito à mão.
 */
function Regua({ titulo, base, serie, parte, resto }: Readonly<{ titulo: string; base: string; serie: SerieMedida; parte: string; resto?: string }>) {
  const v = serie.ultimo.v;
  const largura = Math.max(0, Math.min(100, v));
  const reais = `R$ ${num(v, 1)}`;
  const sobra = `R$ ${num(100 - v, 1)}`;
  return (
    <figure className="min-w-0">
      <figcaption>
        <h3 className="font-serif text-xl leading-snug text-carvao">{titulo}</h3>
        <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{base}</p>
      </figcaption>
      <div
        className="mt-4 flex h-12 w-full border border-carvao"
        role="img"
        aria-label={resto ? `De cada R$ 100, ${reais} ${parte} e ${sobra} ${resto}.` : `Para cada R$ 100, ${reais} ${parte}.`}
      >
        <div className="h-full bg-carvao" style={{ width: `${largura}%` }} />
        <div className="h-full flex-1 bg-papel" />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 text-sm leading-snug">
        <div>
          <dt className="text-carvao-muted">{parte}</dt>
          <dd className="mt-1 font-serif text-2xl text-carvao [font-variant-numeric:tabular-nums]">{reais}</dd>
        </div>
        {resto && (
          <div className="text-right">
            <dt className="text-carvao-muted">{resto}</dt>
            <dd className="mt-1 font-serif text-2xl text-carvao [font-variant-numeric:tabular-nums]">{sobra}</dd>
          </div>
        )}
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-mineral">
        {num(v, 1)}% em {mesAno(serie.ultimo.ref)}. Fonte: {serie.fonte}.
      </p>
    </figure>
  );
}

export function DuasReguas({ comprometimento, endividamento }: Readonly<{ comprometimento: SerieMedida; endividamento: SerieMedida }>) {
  return (
    <div className="space-y-6">
      <div className="grid gap-10 md:grid-cols-2 md:gap-12">
        <Regua
          titulo="A cada R$ 100 de renda do mês"
          base="Quanto sai em parcelas: juros e amortização das dívidas com bancos, sobre a renda disponível do mês."
          serie={comprometimento}
          parte="vão para as parcelas"
          resto="ficam para o resto do orçamento"
        />
        <Regua
          titulo="A cada R$ 100 de renda do ano"
          base="Quanto se deve no total: o saldo de todas as dívidas com bancos, sobre a renda disponível somada em 12 meses."
          serie={endividamento}
          parte="é o saldo devido aos bancos"
        />
      </div>
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        As duas réguas medem coisas diferentes e não se somam. A primeira é um fluxo: o que sai do orçamento todo mês. A segunda é um estoque: o que ainda falta pagar, parte
        dele em financiamentos de muitos anos, como o da casa.
      </p>
    </div>
  );
}
