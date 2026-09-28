import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { EstadoModelo } from "@/components/energia/EstadoModelo";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold } from "@/lib/energia/gold";
import { rotuloRegra } from "@/lib/energia/formato";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Registro de modelos de previsão do PLD",
  description: "Modelos de previsão do PLD com estado explícito (pesquisa, validação, produção), fórmula, dados, limitações, falhas conhecidas e evidências.",
  alternates: { canonical: "/setor-eletrico/pld/modelos" },
};

export default function ModelosPage() {
  const m = gold.modelos();
  return (
    <>
      <CabecalhoEnergia atual="pld" />
      <MarcaVisita secao="energia:pld-modelos" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 pb-16">
        <nav aria-label="Trilha" className="pt-8 text-sm text-mineral">
          <Link href="/setor-eletrico/pld" className="inline-flex min-h-[44px] items-center underline underline-offset-4">PLD</Link> · Modelos
        </nav>
        <CabecalhoModulo rotulo="Registro de modelos" titulo="Modelos de previsão do PLD e seu estado">
          Todo modelo tem estado explícito: pesquisa, validação, produção ou aposentado. Só um modelo em produção pode alimentar a previsão
          oficial; hoje {m && m.em_producao.length ? `está em produção: ${m.em_producao.join(", ")}` : "nenhum está"}.
          {m && !m.em_producao.length && (
            <>
              {" "}Os quatro estão em pesquisa porque a validação ainda não terminou: os testes retrospectivos estão em revisão e a única rodada
              interna registrada não tinha o PLD necessário capturado até o horário de corte.
            </>
          )}
        </CabecalhoModulo>
        {!m ? (
          <Indisponivel titulo="Registro indisponível" motivo="O registro de modelos não foi gerado nesta publicação." />
        ) : (
          <>
            {!m.publicacao_resultados.liberada && (
              <div role="status" className="border border-dashed border-mineral bg-papel p-6">
                <p className="rotulo text-carvao">Resultados de desempenho retidos</p>
                <p className="mt-2 max-w-prose2 text-carvao">{m.publicacao_resultados.motivo}</p>
                <p className="rotulo mt-4 text-mineral">Condições para publicar</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                  {m.publicacao_resultados.condicoes.map((c) => <li key={c}>{c}</li>)}
                </ul>
              </div>
            )}
            <ul className="mt-8 grid gap-4 md:grid-cols-2">
              {m.modelos.map((x) => (
                <li key={x.id}>
                  <Link href={`/setor-eletrico/pld/modelos/${x.id}`} className="flex h-full flex-col border border-linha bg-superficie p-6 hover:border-energia">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-serif text-xl text-carvao">{x.codigo} · {x.nome}</span>
                      <EstadoModelo estado={x.estado} />
                    </span>
                    <span className="mt-3 text-sm leading-relaxed text-carvao">{x.resumo ?? x.objetivo}</span>
                    <span className="mt-2 text-xs text-mineral">{x.papel} · versão {x.versao}</span>
                    <span className="mt-3 text-xs text-mineral">
                      <span className="text-energia-dark underline underline-offset-4">Ver cartão do modelo</span> ·{" "}
                      {x.limitacoes.length} {x.limitacoes.length === 1 ? "limitação" : "limitações"} e {x.falhas_conhecidas.length} {x.falhas_conhecidas.length === 1 ? "falha conhecida registrada" : "falhas conhecidas registradas"} · {x.usa_hidrologia ? "usa hidrologia" : "só preço passado"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <section className="mt-10 border border-linha bg-superficie p-6">
              <h2 className="font-serif text-xl text-carvao">Definições comuns</h2>
              <dl className="mt-3 grid gap-4 md:grid-cols-2">
                {Object.entries(m.definicoes).map(([k, v]) => (
                  <div key={k}>
                    <dt className="rotulo text-mineral">{rotuloRegra(k)}</dt>
                    <dd className="mt-1 text-sm text-carvao">{v}</dd>
                  </div>
                ))}
              </dl>
              <details className="mt-4 text-xs text-mineral">
                <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center underline underline-offset-4">Origem técnica do registro</summary>
                <p className="mt-2">
                  Documento de pesquisa {m.fonte.artefato} (sha256 <span className="break-all font-mono text-xs">{m.fonte.artefato_sha256}</span>),
                  experimento {m.fonte.experimento}, snapshot de dados {m.fonte.snapshot}. Estado da revisão: {m.fonte.estado_da_revisao}.
                </p>
              </details>
            </section>
          </>
        )}
      </main>
    </>
  );
}
