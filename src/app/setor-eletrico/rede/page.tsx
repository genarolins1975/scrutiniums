import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { Termo } from "@/components/evidencia/Termo";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { MapaSubmercados } from "@/components/energia/MapaSubmercados";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold, integra } from "@/lib/energia/gold";
import { dataBR, num, reais } from "@/lib/energia/formato";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Rede: intercâmbios entre regiões e diferenças de preço",
  description:
    "Fluxos verificados entre os subsistemas (ONS), intercâmbio líquido de cada região e diferença de PLD entre as pontas de cada fronteira (CCEE). Limites de intercâmbio ainda não integrados.",
  alternates: { canonical: "/setor-eletrico/rede" },
};

export default function RedePage() {
  const r = gold.rede();
  const pld = gold.pld();
  if (!integra(r)) {
    return (
      <>
        <CabecalhoEnergia atual="rede" />
        <main className="mx-auto max-w-page px-6 py-14">
          <Indisponivel titulo="Dados de rede indisponíveis" motivo={r?.motivo ?? "A gold de rede não foi gerada nesta publicação."} />
        </main>
      </>
    );
  }
  const seriesFluxo = r.fronteiras.map((f, i) => ({
    id: f.par,
    rotulo: `${f.de}→${f.para}`,
    cor: ["var(--serie-sm-n)", "var(--serie-sm-se)", "var(--serie-sm-ne)", "var(--serie-sm-s)"][i],
  }));
  return (
    <>
      <CabecalhoEnergia atual="rede" />
      <MarcaVisita secao="energia:rede" />
      <main className="mx-auto max-w-page px-6">
        <CabecalhoModulo rotulo="Rede" titulo="A rede está limitando o sistema?" referencia={<>Intercâmbios (ONS) até {dataBR(r.dia_referencia)} · PLD (CCEE) até {dataBR(r.ultimo_dia_pld)}</>}>
          Esta página mostra para onde a energia está fluindo entre as regiões e se os preços se separaram. Ela não afirma que a rede atingiu
          limite: os limites de intercâmbio ainda não estão integrados, e essa é a primeira informação que falta para responder à pergunta do título.
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco>
            <PainelEvidencia
              id="fluxos-dia"
              pergunta={`Fluxos entre subsistemas em ${dataBR(r.dia_referencia)}`}
              subtitulo="Intercâmbio médio verificado por fronteira · MWmed · e PLD médio diário por submercado"
              porQueImporta={<>O <Termo slug="intercambio">intercâmbio</Termo> mostra quais regiões exportam e quais importam energia. Com preços, indica se os <Termo slug="submercado">submercados</Termo> operaram acoplados.</>}
              oQueMudou={<>{r.fronteiras.map((f) => `${f.nome}: ${f.dias_sentido_canonico_30d} de 30 dias no sentido ${f.de}→${f.para}`).join("; ")}.</>}
              comoInterpretar={<>A seta aponta o sentido do fluxo médio do dia; a espessura é proporcional ao volume. As caixas trazem o PLD médio do último dia disponível.</>}
              naoConcluir={<>Sem os limites de transferência, fluxo alto não prova congestionamento, e a página não identifica qual linha ou equipamento restringiu a transferência.</>}
              proveniencia={r.proveniencia.fluxo}
            >
              {integra(pld) ? (
                <MapaSubmercados
                  fluxos={r.fronteiras.map((f) => ({ de: f.de, para: f.para, fluxo: f.fluxo_dia }))}
                  precos={Object.fromEntries(pld.cartoes.map((c) => [c.sm, c.media_dia]))}
                  diaFluxo={dataBR(r.dia_referencia)}
                  diaPreco={dataBR(pld.dia_referencia)}
                />
              ) : (
                <Indisponivel titulo="PLD indisponível" motivo="Sem PLD, o mapa mostra só os fluxos na tabela abaixo." />
              )}
              <TabelaDados
                titulo="Intercâmbio por fronteira"
                colunas={["Fronteira", "Fluxo do dia", "Programado do dia", "Média 30 dias", "Dias com diferença de PLD acima de R$ 1 (30 dias)"]}
                linhas={r.fronteiras.map((f) => [f.nome, f.fluxo_dia, f.programado_dia, f.fluxo_media_30d, `${f.dias_com_diferenca_30d} de ${f.n_dias_pld_30d}`])}
              />
            </PainelEvidencia>
          </Bloco>
          <Bloco>
            <PainelEvidencia
              id="liquido"
              pergunta="Quais regiões exportam e quais importam energia?"
              subtitulo={`Intercâmbio líquido por subsistema · MWmed · balanço de energia do ONS em ${dataBR(r.dia_referencia_liquido)}`}
              natureza="CALCULADO"
              porQueImporta={<>O saldo de cada região é a diferença entre o que ela gera e o que consome; positivo significa exportação.</>}
              oQueMudou={<>{r.liquido_subsistemas.map((l) => `${l.nome}: ${num(l.dia, 0)} MWmed no dia, média de 30 dias ${num(l.media_30d, 0)}`).join("; ")}.</>}
              comoInterpretar={<>Saldos positivos e negativos se compensam no SIN. Um exportador estrutural depende das linhas para escoar sua geração.</>}
              naoConcluir={<>Exportar muito não significa preço menor na região exportadora; o preço depende da formação conjunta do sistema e dos limites.</>}
              proveniencia={r.proveniencia.fluxo}
            >
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {r.liquido_subsistemas.map((l) => (
                  <li key={l.sm} className="border border-linha p-4">
                    <p className="rotulo text-mineral">{l.nome}</p>
                    <p className="mt-2 font-serif text-2xl tabular-nums text-carvao">{num(l.dia, 0)}</p>
                    <p className="text-xs text-mineral">MWmed · {l.dia === null ? "sem dado" : l.dia >= 0 ? "exportador no dia" : "importador no dia"}</p>
                  </li>
                ))}
              </ul>
            </PainelEvidencia>
          </Bloco>
          <Bloco nivel="analisar">
            <PainelEvidencia
              id="fluxos-12m"
              pergunta="Como os fluxos mudaram ao longo do último ano?"
              subtitulo="Intercâmbio médio diário por fronteira · MWmed · positivo no sentido indicado"
              porQueImporta={<>A sazonalidade das chuvas, do vento e do sol muda o sentido e o volume dos fluxos ao longo do ano.</>}
              oQueMudou={<>Série de {dataBR(r.serie_fluxos[0]?.d as string)} a {dataBR(r.dia_referencia)}.</>}
              comoInterpretar={<>Valores negativos significam fluxo no sentido oposto ao indicado na legenda.</>}
              naoConcluir={<>Fluxo não é capacidade: sem os limites, não se sabe quanto faltou para o teto em cada dia.</>}
              proveniencia={r.proveniencia.fluxo}
            >
              <GraficoLinhas titulo="Intercâmbio médio diário por fronteira" dados={r.serie_fluxos} chaveX="d" series={seriesFluxo} unidade="MWmed" casas={0} />
            </PainelEvidencia>
          </Bloco>
          <Bloco nivel="analisar">
            <PainelEvidencia
              id="amplitude-rede"
              pergunta="Em que dias os preços dos submercados se separaram?"
              subtitulo="Diferença entre o maior e o menor PLD médio diário · R$/MWh · último ano"
              porQueImporta={<>Picos marcam dias em que o cálculo do preço tratou as regiões de forma separada.</>}
              oQueMudou={<>Maior diferença da série: {reais(Math.max(...r.serie_amplitude_pld.map((a) => a.amplitude)))}/MWh.</>}
              comoInterpretar={<>Zero significa médias diárias iguais nos quatro submercados; diferenças de poucas horas podem sumir na média diária.</>}
              naoConcluir={<>A série não diz qual fronteira causou a separação.</>}
              proveniencia={r.proveniencia.diferenca}
            >
              <GraficoLinhas
                titulo="Diferença diária entre o maior e o menor PLD"
                dados={r.serie_amplitude_pld}
                chaveX="d"
                series={[{ id: "amplitude", rotulo: "Diferença máx.−mín.", cor: "var(--cor-energia)" }]}
                unidade="R$/MWh"
                casas={2}
                zeroNoEixo
              />
            </PainelEvidencia>
          </Bloco>
          <Bloco nivel="auditar">
            <div className="border border-linha bg-superficie p-6">
              <h2 className="font-serif text-xl text-carvao">Regras e downloads</h2>
              <dl className="mt-4 grid gap-4 md:grid-cols-2">
                {Object.entries(r.regras).map(([k, v]) => (
                  <div key={k}>
                    <dt className="rotulo text-mineral">{k.replaceAll("_", " ")}</dt>
                    <dd className="mt-1 text-sm text-carvao">{v}</dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-4 space-y-1 text-sm">
                {r.downloads.map((d) => (
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
