import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { COOKIE_OBSERVATORIO, DOMINIOS, type DominioId } from "@/lib/dominios";
import { gold, integra } from "@/lib/energia/gold";
import { carimbo, dataBR, mesAno } from "@/lib/energia/formato";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";

export const metadata: Metadata = {
  title: "Escolha seu observatório",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

/** Última atualização de cada observatório, lida das golds publicadas. */
function atualizacao(id: DominioId): { rotulo: string; linhas: string[] } {
  if (id === "credito") {
    try {
      const meta = JSON.parse(readFileSync(join(process.cwd(), "public", "obs", "data", "gold", "meta.json"), "utf-8"));
      const linhas = [];
      if (meta?.vintages?.sgs) linhas.push(`Crédito do SFN (BCB/SGS): data-base ${mesAno(meta.vintages.sgs)}`);
      if (meta?.vintages?.ifdata) linhas.push(`Instituições (IF.data): data-base ${mesAno(meta.vintages.ifdata)}`);
      if (meta?.gerado_em) linhas.push(`Processado em ${carimbo(meta.gerado_em)}`);
      return { rotulo: "Último dado disponível", linhas: linhas.length ? linhas : ["Data-base indisponível no momento."] };
    } catch {
      return { rotulo: "Último dado disponível", linhas: ["Data-base indisponível no momento."] };
    }
  }
  const hid = gold.hidrologia();
  const pld = gold.pld();
  const meta = gold.meta();
  const linhas = [];
  if (integra(hid)) linhas.push(`Operação do SIN (ONS): dados até ${dataBR(hid.dia_referencia_ear)}`);
  if (integra(pld)) linhas.push(`PLD (CCEE): até ${dataBR(pld.dia_referencia)}`);
  if (meta?.gerado_em) linhas.push(`Processado em ${carimbo(meta.gerado_em)}`);
  return { rotulo: "Última atualização operacional", linhas: linhas.length ? linhas : ["Atualização indisponível no momento."] };
}

/**
 * Tela extremamente limpa pós login: dois cards de entrada, sem dashboard
 * intermediário. O último observatório escolhido aparece marcado.
 */
export default async function EscolhaObservatorioPage() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  const ultimo = cookies().get(COOKIE_OBSERVATORIO)?.value;

  return (
    <div className="mx-auto w-full max-w-page px-6 py-14 md:py-20">
      <MarcaVisita secao="app:observatorios" />
      <p className="rotulo text-mineral">Scrutiniums</p>
      <h1 className="mt-4 font-serif text-[clamp(2rem,4.4vw,3rem)] leading-tight text-carvao">
        Escolha seu observatório
      </h1>
      <p className="mt-4 max-w-prose2 leading-relaxed text-carvao-muted md:text-lg">
        A mesma infraestrutura de dados, método e rastreabilidade aplicada a dois setores essenciais da
        economia brasileira.
      </p>

      <ul className="mt-12 grid gap-6 md:grid-cols-2">
        {DOMINIOS.map((d) => {
          const at = atualizacao(d.id);
          const energia = d.acento === "energia";
          return (
            <li key={d.id}>
              <article
                aria-labelledby={`escolha-${d.id}`}
                className="relative flex h-full flex-col border border-linha bg-superficie p-8"
              >
                <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] ${energia ? "bg-energia" : "bg-bronze"}`} />
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <h2 id={`escolha-${d.id}`} className="min-w-0 font-serif text-2xl leading-snug text-carvao">
                    {d.nome}
                  </h2>
                  {ultimo === d.id && (
                    <span className="rotulo border border-linha px-2 py-1 text-mineral">sua última escolha aqui</span>
                  )}
                </div>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-carvao-muted">{d.descricaoCurta}</p>
                <div className="mt-6 border-t border-linha pt-4">
                  <p className="rotulo text-mineral">{at.rotulo}</p>
                  <ul className="mt-2 space-y-1 text-sm text-carvao">
                    {at.linhas.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </div>
                {/* POST: a escolha grava cookie e evento; um link GET seria disparado pelo prefetch do Next */}
                <form method="post" action="/app/observatorios/entrar" className="mt-8">
                  <input type="hidden" name="d" value={d.id} />
                  <button
                    type="submit"
                    className="rotulo inline-flex min-h-[44px] items-center justify-center bg-carvao px-6 text-marfim hover:bg-carvao-soft"
                  >
                    Entrar <span aria-hidden="true" className="ml-2">→</span>
                    <span className="sr-only"> no {d.nome}</span>
                  </button>
                </form>
              </article>
            </li>
          );
        })}
      </ul>
      <p className="mt-10 text-sm text-mineral">
        Conta, preferências e sessão valem para os dois observatórios. Troque a qualquer momento pelo seletor no
        cabeçalho, sem novo login. <Link href="/app/conta" className="text-carvao underline underline-offset-4">Minha conta</Link>
      </p>
    </div>
  );
}
