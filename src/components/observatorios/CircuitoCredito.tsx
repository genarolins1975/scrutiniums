import Link from "next/link";
import { Numero } from "@/components/observatorios/EntradaObservatorio";
import type { CircuitoCredito as Circuito } from "@/lib/observatorios/entradas/economia";
import type { NumeroPorta } from "@/lib/perguntas/tipos";

function Medida({ n }: Readonly<{ n: NumeroPorta }>) {
  return (
    <div className="border-t border-linha pt-3">
      <span className="block text-xs leading-snug text-carvao-muted">{n.rotulo}</span>
      <span className="mt-1 block"><Numero n={n} /></span>
      {n.nota && <span className="mt-1 block text-xs leading-relaxed text-mineral">{n.nota}</span>}
    </div>
  );
}

/**
 * Modelo didático "do juro básico ao atraso": os quatro passos com que o
 * Banco Central descreve o crédito, com os pagamentos e a produção ao lado.
 * Segue definições (taxa = custo de captação + spread; saldo é estoque,
 * concessão é fluxo); não mede repasse da Selic nem causa do atraso.
 */
export function CircuitoCredito({ circuito }: Readonly<{ circuito: Circuito }>) {
  return (
    <section aria-labelledby="circuito-titulo" className="border-y border-linha bg-marfim">
      <div className="mx-auto max-w-page px-6 py-14 md:py-16">
        <p className="rotulo text-mineral">Modelo didático</p>
        <h2 id="circuito-titulo" className="mt-3 max-w-3xl font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight text-carvao">
          Do juro básico ao atraso
        </h2>
        <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          O crédito liga a política do Banco Central ao bolso de famílias e empresas em quatro passos: o juro básico, o juro
          cobrado, o volume emprestado e o atraso. A ordem segue as definições do Banco Central; o modelo não mede quanto
          da Selic chega às taxas, nem em que prazo, e não explica por que alguém atrasa.
        </p>
        <ol className="mt-10 grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-4">
          {circuito.passos.map((p, i) => (
            <li key={p.id} className="flex flex-col bg-papel p-5">
              <p className="rotulo flex items-baseline gap-2 text-mineral">
                <span className="tabular-nums text-carvao">{String(i + 1).padStart(2, "0")}</span>
                {p.titulo}
              </p>
              <h3 className="mt-2 font-serif text-xl leading-snug text-carvao">{p.pergunta}</h3>
              <p className="mt-2 text-sm leading-relaxed text-carvao-muted">{p.texto}</p>
              <div className="mt-auto space-y-3 pt-4">
                {p.numeros.map((n) => <Medida key={n.rotulo} n={n} />)}
              </div>
              <Link href={p.href} prefetch={false} className="mt-3 inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4">
                Ver no painel
              </Link>
            </li>
          ))}
        </ol>
        <div className="mt-8 grid gap-px border border-linha bg-linha lg:grid-cols-2">
          <div className="bg-papel p-5">
            <h3 className="font-serif text-lg leading-snug text-carvao">Por onde o dinheiro passa</h3>
            <p className="mt-1 text-sm leading-relaxed text-carvao-muted">
              Os pagamentos são os trilhos da economia: transferências, compras e contas, medidos mês a mês pelo Banco Central.
            </p>
            <div className="mt-4 space-y-3">{circuito.trilhos.map((n) => <Medida key={n.rotulo} n={n} />)}</div>
          </div>
          <div className="bg-papel p-5">
            <h3 className="font-serif text-lg leading-snug text-carvao">Onde a produção aparece</h3>
            <p className="mt-1 text-sm leading-relaxed text-carvao-muted">
              O agronegócio é o setor produtivo com painel próprio: peso na economia e nas vendas ao exterior.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">{circuito.producao.map((n) => <Medida key={n.rotulo} n={n} />)}</div>
          </div>
        </div>
        <p className="mt-6 text-xs leading-relaxed text-mineral">
          Modelo didático: os números têm fontes e períodos próprios e não se somam. Indústria e serviços ainda não têm painel
          na plataforma.
        </p>
      </div>
    </section>
  );
}

/** Método e fontes da entrada da Economia. */
export function MetodoEconomia() {
  return (
    <>
      <p>
        Crédito: séries do Sistema Gerenciador de Séries Temporais do Banco Central (saldo, concessões, taxas, spread,
        inadimplência e crédito sobre o PIB), estatísticas monetárias e de crédito, com o código de cada série junto ao
        número. Pix: estatísticas de meios de pagamento do Banco Central. Agronegócio: Contas Nacionais Trimestrais do IBGE
        e Comex Stat do MDIC.
      </p>
      <p>
        Os números são lidos das mesmas bases dos painéis na publicação do site; quando uma base não pode ser lida, o número
        aparece como indisponível, nunca como zero.
      </p>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        <li><Link href="/glossario" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Glossário do crédito</Link></li>
        <li><Link href="/agronegocio/metodologia" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Agronegócio: método</Link></li>
        <li><Link href="/observatorio-do-credito" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Apresentação do Crédito</Link></li>
        <li><Link href="/perguntas/economia" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Resumo aberto do observatório</Link></li>
      </ul>
    </>
  );
}
