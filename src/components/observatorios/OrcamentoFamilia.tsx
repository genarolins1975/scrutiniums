import Link from "next/link";
import { ModeloDidatico } from "@/components/observatorios/ModeloDidatico";
import { NumeroEscala } from "@/components/observatorios/NumeroEscala";
import type { EtapaOrcamento } from "@/lib/observatorios/entradas/familias";

/** Modelo didático do orçamento doméstico: quatro etapas ligadas aos painéis do Observatório das Famílias. */
export function OrcamentoFamilia({ orcamento }: Readonly<{ orcamento: EtapaOrcamento[] }>) {
  return (
    <ModeloDidatico id="orcamento" titulo={<>Como o dinheiro circula no orçamento de uma família</>} descricao={<>Quatro etapas que ligam os painéis do observatório: o que entra, o essencial, o crédito quando falta e os riscos.</>} deixaDeFora={["Poupança", "Impostos", "Gastos não essenciais, que a plataforma ainda não mede", "A conta de uma família real: o modelo mostra relações entre as partes"]}>
        <ol className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 xl:gap-0">
          {orcamento.map((etapa, i) => (
            <li key={etapa.id} className="relative xl:pr-10">
              {i < orcamento.length - 1 && (
                <span aria-hidden="true" className="absolute right-3 top-0 hidden text-lg leading-none text-mineral xl:block">→</span>
              )}
              <p className="rotulo flex items-baseline gap-2 text-mineral">
                <span className="tabular-nums text-carvao">{String(i + 1).padStart(2, "0")}</span>
                {etapa.titulo}
              </p>
              <h3 className="mt-2 font-serif text-lg leading-snug text-carvao">{etapa.pergunta}</h3>
              <ul className="mt-4 space-y-3">
                {etapa.elos.map((elo) => (
                  <li key={elo.titulo} className="border border-linha bg-papel p-4">
                    <Link href={elo.href} prefetch={false} className="font-medium text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">
                      {elo.titulo}
                    </Link>
                    <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{elo.explicacao}</p>
                    {elo.numero && (
                      <div className="mt-3 border-t border-linha pt-3">
                        <span className="block text-xs leading-snug text-carvao-muted">{elo.numero.rotulo}</span>
                        <span className="mt-1 block"><NumeroEscala n={elo.numero} /></span>
                        {elo.numero.nota && <span className="mt-1 block text-xs leading-relaxed text-mineral">{elo.numero.nota}</span>}
                      </div>
                    )}
                    <span className="mt-2 block text-xs text-mineral">Painel: {elo.painel}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </ModeloDidatico>
  );
}

/** Método e fontes da entrada das Famílias. */
export function MetodoFamilias() {
  return (
    <>
      <p>
        O observatório reúne painéis de outras coleções, que mantêm as bases, as conferências e as páginas de método,
        e mantém um painel próprio, Inflação por cidade, com coleta mensal do IPCA no SIDRA do IBGE e conferências que
        retêm a publicação. Os números desta entrada são lidos das mesmas bases na publicação do site; quando uma base
        não pode ser lida, o número aparece como indisponível, nunca como zero.
      </p>
      <p>
        Crédito das famílias: séries do Banco Central (SGS), só dívidas no sistema financeiro. Déficit
        habitacional: estimativa da Fundação João Pinheiro. Inflação por cidade e comida: IPCA do IBGE. Gás:
        levantamento de preços da ANP.
      </p>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        <li><Link href="/glossario" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Glossário do crédito</Link></li>
        <li><Link href="/agronegocio/metodologia" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Agronegócio: método</Link></li>
        <li><Link href="/gas-natural/metodologia" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Gás Natural: método</Link></li>
        <li><Link href="/perguntas/familias" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Resumo aberto do observatório</Link></li>
      </ul>
    </>
  );
}
