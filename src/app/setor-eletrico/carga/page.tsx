import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { Termo } from "@/components/evidencia/Termo";
import { Unidade } from "@/components/evidencia/Unidade";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold, integra } from "@/lib/energia/gold";
import { dataBR, mesAno, num, sinal } from "@/lib/energia/formato";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Carga e consumo do sistema elétrico",
  description:
    "Carga de energia diária do SIN e dos subsistemas (ONS), comparação anual respeitando as mudanças metodológicas declaradas pelo ONS e extremos do último ano.",
  alternates: { canonical: "/setor-eletrico/carga" },
};

const SERIES = [
  { id: "SE", rotulo: "Sudeste/Centro-Oeste", sigla: "SE/CO", cor: "var(--serie-sm-se)" },
  { id: "S", rotulo: "Sul", sigla: "S", cor: "var(--serie-sm-s)" },
  { id: "NE", rotulo: "Nordeste", sigla: "NE", cor: "var(--serie-sm-ne)" },
  { id: "N", rotulo: "Norte", sigla: "N", cor: "var(--serie-sm-n)" },
];

export default function CargaPage() {
  const c = gold.carga();
  if (!integra(c)) {
    return (
      <>
        <CabecalhoEnergia atual="carga" />
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
          <Indisponivel titulo="Carga indisponível" motivo={c?.motivo ?? "Os dados processados de carga não foram gerados nesta publicação."} />
        </main>
      </>
    );
  }
  const sin = c.subsistemas.find((s) => s.sm === "SIN")!;
  const marcos = [
    { x: "2021-03-01", rotulo: "mar/21: inclui usinas não despachadas" },
    { x: "2023-04-29", rotulo: "29/04/23: inclui estimativa de MMGD" },
  ];
  return (
    <>
      <CabecalhoEnergia atual="carga" />
      <MarcaVisita secao="energia:carga" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo rotulo="Carga e consumo" titulo="Quanto o sistema está consumindo?" referencia={<>Carga de Energia Diária (ONS) até {dataBR(c.dia_referencia)}</>}>
          A <Termo slug="carga">carga</Termo> é a energia atendida no sistema interligado, publicada pelo ONS por subsistema. O ONS mudou o que a série inclui em 2021 e em 2023;
          as comparações desta página respeitam essas quebras. Valores em <Unidade u="MWmed" />.
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="comparacao">
            <PainelEvidencia
              id="carga-sin"
              pergunta={
                sin.ult7?.variacao_pct !== null && sin.ult7
                  ? `Carga do SIN ${num(Math.abs(sin.ult7.variacao_pct ?? 0))}% ${(sin.ult7.variacao_pct ?? 0) >= 0 ? "acima" : "abaixo"} da mesma semana de ${sin.ult7.fim_anterior.slice(0, 4)}`
                  : "Carga do SIN no último ano"
              }
              subtitulo="Carga diária do SIN · MWmed · últimos 3 anos"
              natureza="CALCULADO"
              porQueImporta={<>É o lado da demanda no balanço de energia que o ONS publica por subsistema, ao lado da geração por fonte.</>}
              oQueMudou={<>Últimos 30 dias: {sin.ult30?.variacao_pct !== null && sin.ult30 ? `${sinal(sin.ult30.variacao_pct)}% sobre os mesmos dias do ano anterior` : "sem comparação homogênea"}. Maior carga diária em 12 meses: {num(sin.max_12m.valor, 0)} MWmed em {dataBR(sin.max_12m.dia)}.</>}
              comoInterpretar={
                <>
                  A comparação anual só é mostrada quando os dois períodos estão no mesmo regime metodológico do ONS.{" "}
                  {c.serie[0] && c.serie[0].d >= "2023-04-29"
                    ? "Todo o período deste gráfico está no regime atual, em vigor desde 29/04/2023 (inclui a estimativa de MMGD); as mudanças de mar/21 e de 29/04/2023 são anteriores a ele."
                    : "As linhas verticais marcam as mudanças de regime dentro do período."}
                </>
              }
              naoConcluir={<>A carga não é ajustada por temperatura, feriados ou dias úteis; variação de carga não mede, sozinha, atividade econômica. Desde 29/04/2023 a série inclui uma estimativa de MMGD feita pelo ONS com dados meteorológicos previstos.</>}
              proveniencia={c.proveniencia.sin}
            >
              <GraficoLinhas titulo="Carga diária do SIN nos últimos 3 anos" dados={c.serie} chaveX="d" series={[{ id: "SIN", rotulo: "SIN", cor: "var(--cor-energia)" }]} unidade="MWmed" casas={0} marcos={marcos} />
            </PainelEvidencia>
          </Bloco>
          <Bloco>
            <PainelEvidencia
              id="carga-sm"
              pergunta="Como a carga se distribui entre os subsistemas?"
              subtitulo="Carga diária por subsistema · MWmed · últimos 3 anos"
              porQueImporta={<>O Sudeste/Centro-Oeste concentra a maior parte da carga; comparar as trajetórias regionais mostra onde a carga variou mais.</>}
              oQueMudou={<>{c.subsistemas.filter((s) => s.sm !== "SIN").map((s) => `${s.nome}: ${s.ult7?.variacao_pct !== null && s.ult7 ? `${sinal(s.ult7.variacao_pct)}% em 7 dias` : "sem comparação"}`).join("; ")}.</>}
              comoInterpretar={<>Mesma régua para os quatro subsistemas: compare trajetórias, não só níveis.</>}
              naoConcluir={<>Crescimento regional de carga pode refletir mudança de metodologia ou de fronteira de medição; o ONS descreve as mudanças no conjunto de dados.</>}
              proveniencia={c.proveniencia.carga}
            >
              <GraficoLinhas titulo="Carga diária por subsistema" dados={c.serie} chaveX="d" series={SERIES} unidade="MWmed" casas={0} zeroNoEixo marcos={marcos} />
            </PainelEvidencia>
          </Bloco>
          <Bloco nivel="analisar">
            <PainelEvidencia
              id="carga-longa"
              pergunta="A carga desde 2000, com as quebras metodológicas marcadas"
              subtitulo="Carga média mensal do SIN · MWmed"
              natureza="CALCULADO"
              porQueImporta={<>O histórico longo mostra crescimento e quedas da carga em escala de décadas.</>}
              oQueMudou={
                <>
                  Último mês da série: {c.mensal.at(-1) ? mesAno(`${c.mensal.at(-1)!.m}-01`) : "sem dado"}
                  {c.mensal.at(-1) && c.mensal.at(-1)!.m === c.dia_referencia.slice(0, 7) ? `, parcial até ${dataBR(c.dia_referencia)} (${c.mensal.at(-1)!.dias} dias)` : ", completo"}.
                </>
              }
              comoInterpretar={<>As linhas verticais marcam as mudanças de conteúdo da série; não compare níveis através delas como se fossem a mesma medida.</>}
              naoConcluir={<>A série anterior a 2021 não inclui geração não despachada nem MMGD; o salto após as quebras não é, por si, aumento de consumo.</>}
              proveniencia={c.proveniencia.sin}
            >
              <GraficoLinhas titulo="Carga média mensal do SIN desde 2000" dados={c.mensal} chaveX="m" formatoX="mes" series={[{ id: "SIN", rotulo: "SIN", cor: "var(--cor-energia)" }]} unidade="MWmed" casas={0} marcos={[{ x: "2021-03", rotulo: "mar/21" }, { x: "2023-05", rotulo: "mai/23" }]} />
            </PainelEvidencia>
          </Bloco>
          <Bloco nivel="auditar">
            <div className="border border-linha bg-superficie p-6">
              <h2 className="font-serif text-xl text-carvao">Regimes metodológicos declarados pelo ONS</h2>
              <ul className="mt-3 space-y-2 text-sm text-carvao">
                {c.regimes.map((r) => (
                  <li key={r.inicio}>
                    <strong className="font-medium">{dataBR(r.inicio)} a {r.fim ? dataBR(r.fim) : "hoje"}:</strong> {r.descricao}
                  </li>
                ))}
              </ul>
              {c.fonte_notas && <blockquote className="mt-4 border-l-2 border-linha pl-4 text-sm text-carvao-muted">{c.fonte_notas.split("\n")[2] ?? c.fonte_notas}</blockquote>}
              <ul className="mt-4 space-y-1 text-sm">
                {c.downloads.map((d) => (
                  <li key={d.url}><a href={d.url} download className="text-energia-dark underline underline-offset-4">{d.rotulo}</a></li>
                ))}
              </ul>
            </div>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
