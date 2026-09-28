import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { EstadoModelo } from "@/components/energia/EstadoModelo";
import { gold } from "@/lib/energia/gold";
import { dataBR } from "@/lib/energia/formato";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return (gold.modelos()?.modelos ?? []).map((m) => ({ modelo: m.id }));
}

export function generateMetadata({ params }: { params: { modelo: string } }): Metadata {
  const m = gold.modelos()?.modelos.find((x) => x.id === params.modelo);
  if (!m) return {};
  return {
    title: `Model card ${m.codigo}: ${m.nome}`,
    description: `Objetivo, estado (${m.estado.toLowerCase()}), fórmula, dados, janela, limitações e falhas conhecidas do modelo ${m.codigo} de previsão do PLD.`,
    alternates: { canonical: `/setor-eletrico/pld/modelos/${m.id}` },
  };
}

function L({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-linha py-4 md:grid md:grid-cols-[13rem_1fr] md:gap-6">
      <dt className="rotulo text-mineral">{k}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-carvao md:mt-0">{children}</dd>
    </div>
  );
}

export default function ModelCard({ params }: { params: { modelo: string } }) {
  const reg = gold.modelos();
  const m = reg?.modelos.find((x) => x.id === params.modelo);
  if (!reg || !m) notFound();
  const retido = !reg.publicacao_resultados.liberada;
  return (
    <>
      <CabecalhoEnergia atual="pld" />
      <MarcaVisita secao="energia:pld-modelos" />
      <main className="mx-auto max-w-page px-6 pb-16">
        <nav aria-label="Trilha" className="pt-8 text-sm text-mineral">
          <Link href="/setor-eletrico/pld" className="underline underline-offset-4">PLD</Link> ·{" "}
          <Link href="/setor-eletrico/pld/modelos" className="underline underline-offset-4">Modelos</Link> · {m.codigo}
        </nav>
        <header className="pb-6 pt-4">
          <p className="rotulo text-mineral">Model card · {m.versao}</p>
          <h1 className="mt-2 font-serif text-[clamp(2rem,4.4vw,3rem)] leading-tight text-carvao">{m.codigo} · {m.nome}</h1>
          <p className="mt-3"><EstadoModelo estado={m.estado} comTexto /></p>
        </header>
        <dl>
          <L k="Objetivo">{m.objetivo}</L>
          <L k="Papel">{m.papel}</L>
          <L k="Alvo e unidade">{reg.definicoes.alvo}</L>
          <L k="Frequência e horizonte">{reg.definicoes.entregas}</L>
          <L k="Submercados">Sudeste/Centro-Oeste, Sul, Nordeste e Norte</L>
          <L k="Metodologia">{m.metodologia}</L>
          <L k="Fórmula">{m.formula ? <code className="block whitespace-pre-wrap break-words bg-papel px-2 py-1.5 font-mono text-xs">{m.formula}</code> : "Composição exata no arquivo de configuração listado nas evidências."}</L>
          <L k="Variáveis de entrada">
            <ul className="list-disc space-y-1 pl-5">{m.features.map((f) => <li key={f}>{f}</li>)}</ul>
          </L>
          <L k="Dados de treinamento">{m.dados_treinamento}</L>
          <L k="Janela histórica">{m.janela}</L>
          <L k="Horário de corte e elegibilidade">{reg.definicoes.cenario_de_elegibilidade}. Corte operacional: {reg.definicoes.corte_operacional}.</L>
          <L k="Quantis">{reg.definicoes.quantis}</L>
          <L k="Referências de comparação">{m.benchmarks.length ? m.benchmarks.join(", ") : "É a referência simples contra a qual os demais são comparados."}</L>
          <L k="Teste retrospectivo, métricas e calibração">
            {retido ? (
              <span className="text-carvao-muted">Retidos até a liberação: {reg.publicacao_resultados.motivo} Os arquivos de resultado estão identificados nas evidências abaixo, com sha256.</span>
            ) : (
              "Ver arquivos de evidência."
            )}
          </L>
          <L k="Limitações">
            <ul className="list-disc space-y-1 pl-5">{m.limitacoes.map((x) => <li key={x}>{x}</li>)}</ul>
          </L>
          <L k="Falhas conhecidas">
            {m.falhas_conhecidas.length ? <ul className="list-disc space-y-1 pl-5">{m.falhas_conhecidas.map((x) => <li key={x}>{x}</li>)}</ul> : "Nenhuma registrada."}
          </L>
          <L k="Data de promoção">{m.promovido_em ? dataBR(m.promovido_em) : "Não promovido."}</L>
          <L k="Versão do código">{m.versao_codigo ? <span className="font-mono text-xs">{m.versao_codigo}</span> : "não informada"}</L>
          <L k="Snapshot">{m.snapshot ?? "não informado"}</L>
          <L k="Evidências">
            <ul className="space-y-2">
              {m.evidencias.map((e) => (
                <li key={e.arquivo + e.descricao}>
                  {e.descricao}
                  <span className="block break-all font-mono text-[0.7rem] text-mineral">{e.arquivo} · sha256 {e.sha256}</span>
                </li>
              ))}
            </ul>
          </L>
          <L k="Auditoria">{m.auditoria}</L>
        </dl>
      </main>
    </>
  );
}
