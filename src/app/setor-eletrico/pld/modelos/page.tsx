import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { EstadoModelo } from "@/components/energia/EstadoModelo";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold } from "@/lib/energia/gold";

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
      <main className="mx-auto max-w-page px-6 pb-16">
        <nav aria-label="Trilha" className="pt-8 text-sm text-mineral">
          <Link href="/setor-eletrico/pld" className="underline underline-offset-4">PLD</Link> · Modelos
        </nav>
        <CabecalhoModulo rotulo="Registro de modelos" titulo="Modelos de previsão do PLD e seu estado">
          Todo modelo tem estado explícito. Só um modelo em produção pode alimentar a previsão oficial; hoje{" "}
          {m && m.em_producao.length ? `está em produção: ${m.em_producao.join(", ")}` : "nenhum está"}.
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
                    <span className="mt-1 text-xs text-mineral">{x.versao} · {x.papel}</span>
                    <span className="mt-3 text-sm leading-relaxed text-carvao-muted">{x.objetivo}</span>
                    <span className="mt-3 text-xs text-mineral">
                      {x.limitacoes.length} limitações e {x.falhas_conhecidas.length} falhas conhecidas registradas · {x.usa_hidrologia ? "usa hidrologia" : "só preço passado"}
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
                    <dt className="rotulo text-mineral">{k.replaceAll("_", " ")}</dt>
                    <dd className="mt-1 text-sm text-carvao">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-mineral">
                Origem do registro: {m.fonte.artefato} (sha256 {m.fonte.artefato_sha256}), experimento {m.fonte.experimento}, snapshot {m.fonte.snapshot}. {m.fonte.estado_da_revisao}.
              </p>
            </section>
          </>
        )}
      </main>
    </>
  );
}
