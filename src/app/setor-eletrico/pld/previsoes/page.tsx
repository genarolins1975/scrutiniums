import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { ArquivoPrevisoes } from "@/components/energia/ArquivoPrevisoes";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold } from "@/lib/energia/gold";
import { dataBR, rotuloRegra } from "@/lib/energia/formato";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Histórico de previsões do PLD",
  description:
    "Arquivo imutável de previsões do PLD: cada registro com modelo, estado, corte, emissão, status, motivo e sha256. Escolha uma data e veja o que a plataforma registrava naquele dia.",
  alternates: { canonical: "/setor-eletrico/pld/previsoes" },
};

export default function PrevisoesPage() {
  const p = gold.previsoes();
  return (
    <>
      <CabecalhoEnergia atual="pld" />
      <MarcaVisita secao="energia:pld-previsoes" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 pb-16">
        <nav aria-label="Trilha" className="pt-8 text-sm text-mineral">
          <Link href="/setor-eletrico/pld" className="inline-flex min-h-[44px] items-center underline underline-offset-4">PLD</Link> · Histórico de previsões
        </nav>
        <CabecalhoModulo rotulo="Arquivo imutável" titulo="O que a plataforma registrou, em cada dia">
          Cada previsão, publicada ou de rodada interna, vira um registro permanente com sha256 do conteúdo. Nenhum registro é sobrescrito: uma correção
          cria registro novo que aponta para o original, com o motivo. O realizado e o erro entram depois, em apurações separadas.
        </CabecalhoModulo>
        {!p ? (
          <Indisponivel titulo="Arquivo indisponível" motivo="O arquivo de previsões não foi gerado nesta publicação." />
        ) : (
          <>
            <dl className="grid gap-px border border-linha bg-linha sm:grid-cols-4">
              {[
                ["Previsões publicadas", p.publicacoes.toLocaleString("pt-BR")],
                ["Rodadas internas", p.rodadas.length.toLocaleString("pt-BR")],
                ["Registros no arquivo", p.arquivo.length.toLocaleString("pt-BR")],
                ["Apurações", p.apuracoes.length.toLocaleString("pt-BR")],
              ].map(([k, v]) => (
                <div key={k} className="bg-superficie p-4">
                  <dt className="rotulo text-mineral">{k}</dt>
                  <dd className="mt-1 font-serif text-2xl tabular-nums text-carvao">{v}</dd>
                </div>
              ))}
            </dl>
            <section className="mt-8 border border-linha bg-superficie p-6">
              <h2 className="font-serif text-xl text-carvao">Como ler um registro</h2>
              <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao">
                Cada rodada tenta prever o PLD médio de 7 períodos futuros em cada um dos 4 submercados: 28 registros por rodada. W1 é a
                próxima semana completa (de sábado a sábado), W2 a seguinte, até W4; M1 é o próximo mês civil que ainda não começou, até
                M3. O horário de corte é o limite de informação: nada capturado depois dele pode entrar na previsão.
              </p>
            </section>
            {p.rodadas.map((r) => (
              <section key={r.run_id} className="mt-4 border border-linha bg-superficie p-6">
                <h2 className="font-serif text-xl text-carvao">Rodada interna de {dataBR(r.origem)}</h2>
                <p className="mt-2 text-sm leading-relaxed text-carvao">
                  Modelo {r.modelo} ({r.estado_modelo === "PESQUISA" ? "em pesquisa" : r.estado_modelo.toLowerCase()}). {r.celulas} registros,{" "}
                  {r.com_numero === 0 ? "nenhum com número" : `${r.com_numero} com número`}
                  {r.motivos.length ? `, pelo mesmo motivo: ${r.motivos.map((x) => (x === "SEM_PLD_CAPTURADO_ATE_O_CORTE" ? "nenhum PLD do período exigido havia sido capturado até o horário de corte" : x)).join("; ")}` : ""}.
                  {r.alertas.includes("ATRASADO_APOS_08H") ? " A rodada foi emitida depois do prazo das 08h00." : ""} Não é publicação: modelo em pesquisa
                  não gera previsão oficial.
                </p>
                <p className="mt-2 break-all font-mono text-[0.7rem] text-mineral">identificador da rodada: {r.run_id}</p>
              </section>
            ))}
            <section className="mt-8 border border-linha bg-superficie p-6">
              <h2 className="font-serif text-xl text-carvao">Consultar por data</h2>
              <details className="mt-3">
                <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
                  Ver todos os registros ({p.arquivo.length.toLocaleString("pt-BR")}), com filtro por data
                </summary>
                <div className="mt-4">
                  <ArquivoPrevisoes registros={p.arquivo} />
                </div>
              </details>
            </section>
            <section className="mt-8 border border-linha bg-superficie p-6">
              <h2 className="font-serif text-xl text-carvao">Como conferir</h2>
              <p className="mt-2 text-sm leading-relaxed text-carvao">
                O sha256 de cada registro é calculado sobre o JSON canônico do registro (chaves ordenadas, sem espaços, sem o próprio campo sha256). O arquivo
                completo está em <a href="/energia/gold/previsoes.json" className="text-energia-dark underline underline-offset-4">previsoes.json</a>; a fonte
                versionada é <code className="font-mono text-xs">pipeline/energia/previsoes/arquivo.jsonl</code>, validada a cada publicação contra a versão
                anterior (nenhum registro pode sumir ou mudar).
              </p>
              <dl className="mt-4 grid gap-4 md:grid-cols-2">
                {Object.entries(p.regras).map(([k, v]) => (
                  <div key={k}>
                    <dt className="rotulo text-mineral">{rotuloRegra(k)}</dt>
                    <dd className="mt-1 text-sm text-carvao">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </>
        )}
      </main>
    </>
  );
}
