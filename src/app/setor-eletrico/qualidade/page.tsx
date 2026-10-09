import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Histograma } from "@/components/energia/Histograma";
import { Numero } from "@/components/energia/Numero";
import { QualidadeAviso, QualidadeCapitulos, QualidadeDatas, QualidadeIndisponivel, QualidadePar, QualidadeRecorte } from "@/components/energia/QualidadePagina";
import { QualidadeComparador } from "@/components/energia/QualidadeComparador";
import { QualidadeConjuntos } from "@/components/energia/QualidadeConjuntos";
import { QualidadeLimites } from "@/components/energia/QualidadeLimites";
import { QualidadeMapa } from "@/components/energia/QualidadeMapa";
import { QualidadeTabela } from "@/components/energia/QualidadeTabela";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { montaHistograma } from "@/lib/energia/distribuicao";
import { carimbo, dataBR, mesAno, num, pct } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  COLUNAS_COMP_ANUAL,
  LIMITE_FEC_PARCIAL_CENTESIMOS,
  COR_PARCELA,
  FONTE_CONTINUIDADE,
  ORDEM_PARCELAS,
  PAINEIS_QUALIDADE,
  ROTULO_PARCELA_CURTO,
  DEFINICAO_CONJUNTO,
  DEFINICAO_CONJUNTO_CURTA,
  DEFINICAO_LIMITES_INDIVIDUAIS,
  anoBrasil,
  arquivoConjuntosDoAno,
  avisoDefasagem,
  avisosFec as montaAvisosFec,
  conjuntosDoCsv,
  downloadsDoPainel,
  fecComCoberturaParcial,
  histogramaDeFaixas,
  horasEMinutos,
  itensLimites,
  limpaProveniencia,
  linhasBrasilAnual,
  linhasBrasilMensal,
  linhasCompensacaoAnual,
  linhasCompensacaoMensal,
  linhasHistoricoConjuntos,
  linhasOuvidoriaNacional,
  linhasParcelas,
  linhasReclamacoesNacional,
  linhasResiliencia,
  linhasTelefonico,
  linhasTipoAnoReferencia,
  maioresDistribuidoras,
  marcosHistoriaApurado,
  mesesComFecParcial,
  metricasAbertura,
  metricasCompensacao,
  mudancaP051,
  mudancaP052,
  mudancaP053,
  mudancaP054,
  notaDivulgadoCartao,
  notaPerimetroAbertura,
  notaTiposSemUc,
  paraLeitor,
  painelQualidade,
  pctCobertura,
  recorteColunas,
  resumoSemRazaoFec,
  respostaP051,
  respostaP052,
  respostaP053,
  respostaP054,
  respostaParcial,
  rotuloDistribuidora,
  tabelaQualidade,
  taxaNaBaseDaOuvidoria,
  textoAtualidade,
  textoContagemFec,
  textoDivergenciasDgc,
  textoDivulgadoAno,
  textoFecBrasilConfere,
  textoParcelasAno,
  textoQuebraApurado,
  textoUniversoBrasil,
  textoUniversosConjuntos,
  vereditoP051,
  vereditoP052,
  vereditoP053,
  vereditoP054,
  type IdTabela,
} from "@/lib/energia/qualidade";
import type { QualidadeGold } from "@/lib/energia/tipos-qualidade";
import { datasLegiveis } from "@/lib/energia/visao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Qualidade do serviço de distribuição: interrupções, limites, compensações e atendimento",
  description:
    "DEC e FEC por conjunto, distribuidora e Brasil (ANEEL), realizado diante dos limites regulatórios, compensações pagas por violação de limites individuais, reclamações por unidade consumidora, IASC com amostra, atendimento emergencial e eventos de emergência.",
  alternates: { canonical: "/setor-eletrico/qualidade" },
};

const URL_SERIE = "/energia/series/qualidade_distribuidoras_serie.json";
const URL_MUNICIPIOS = "/energia/series/qualidade_municipios.csv";

/** Tamanho de um arquivo publicado, lido no build (nunca escrito à mão). */
function tamanho(url: string): string {
  try {
    const b = statSync(join(process.cwd(), "public", url)).size;
    return b >= 1e6 ? `${num(b / 1e6, 1)} MB` : `${num(b / 1e3, 0)} KB`;
  } catch {
    return "tamanho não disponível";
  }
}

/** Texto de um arquivo publicado, lido no servidor na geração da página; nulo se o arquivo não existir (a página diz o que falta e segue). */
function lerPublico(url: string): string | null {
  try {
    return readFileSync(join(process.cwd(), "public", url), "utf-8");
  } catch {
    return null;
  }
}

export default function QualidadePage() {
  const g = lerGold<QualidadeGold>("qualidade.json");
  if (!integra(g)) return <QualidadeIndisponivel motivo={g?.motivo} />;

  const ref = g.ano_referencia;
  const a = anoBrasil(g, ref);
  const c = g.conjuntos;
  const comp = g.compensacoes;
  const at = g.atendimento;
  const ev = g.evidencias;
  // ficha de origem com texto de leitor (sem marcação crua nem termo interno) e a descrição longa da fonte resumida
  const prov = Object.fromEntries(Object.entries(g.proveniencia).map(([k, x]) => [k, limpaProveniencia(x)])) as QualidadeGold["proveniencia"];
  // regras e universos da gold escritos para o leitor (sem nome de campo nem termo interno)
  const regras = Object.fromEntries(Object.entries(g.regras).map(([k, x]) => [k, paraLeitor(x)])) as QualidadeGold["regras"];
  const universo = { principal: paraLeitor(g.brasil.universo.principal), concessionarias: paraLeitor(g.brasil.universo.concessionarias) };
  const avisoAnoCorrente = g.parcial ? paraLeitor(g.parcial.aviso) : "";
  const m = metricasAbertura(g);
  const mc = metricasCompensacao(g);
  const anual = linhasBrasilAnual(g);
  const anualDec = recorteColunas(anual, ["ano", "dec", "dec_concessionarias", "dec_limite"]);
  const anualFec = recorteColunas(anual, ["ano", "fec", "fec_concessionarias", "fec_limite"]);
  const primeiroAno = anual[0]?.ano ?? String(ref);
  const mensal = linhasBrasilMensal(g);
  const mensalDec = recorteColunas(mensal, ["m", "dec"]);
  const mensalFec = recorteColunas(mensal, ["m", "fec"]);
  const histConjuntos = linhasHistoricoConjuntos(g.conjuntos);
  const histUcs = recorteColunas(histConjuntos, ["ano", "pct_ucs_acima", "pct_acima"]);
  const histRazoes = recorteColunas(histConjuntos, ["ano", "razao_p50", "razao_p90"]);
  const incompletos = g.brasil.mensal.filter((x) => !x.completo);
  const parcelas = linhasParcelas(g);
  const inicioParcelas = parcelas[0]?.ano ?? null;
  const marcos = marcosHistoriaApurado(g);
  const defasagem = avisoDefasagem(prov.conjuntos.publicado_pela_fonte_em, g.gerado_em);
  // FEC de cobertura parcial: a regra usa só a gold; os meses de cobertura baixa vêm do CSV mensal por distribuidora, lido aqui no servidor
  const candidatosFec = fecComCoberturaParcial(g).map((x) => x.cnpj);
  const mensalDistribuidoras = candidatosFec.length ? lerPublico("/energia/series/qualidade_distribuidoras_mensal.csv") : null;
  const avisos = montaAvisosFec(g, mensalDistribuidoras ? mesesComFecParcial(mensalDistribuidoras, candidatosFec, ref) : {});
  const listaAvisos = Object.values(avisos);
  // conjuntos sem razão de FEC (menos de 12 meses de FEC): a contagem de conjuntos acima do limite de FEC é um mínimo
  const csvConjuntosAno = lerPublico(arquivoConjuntosDoAno(c.ano));
  const semRazaoFec = csvConjuntosAno ? resumoSemRazaoFec(conjuntosDoCsv(csvConjuntosAno, c.ano), c.ano) : null;
  const contagemFec = textoContagemFec(g, semRazaoFec);
  const quebraApurado = textoQuebraApurado(g);
  const entidades = g.distribuidoras
    .map((d) => ({ id: d.cnpj, rotulo: rotuloDistribuidora(d), detalhe: [d.nome_comercial, d.classificacao].filter(Boolean).join(", ") || undefined, sinonimos: [d.cnpj] }))
    .sort((x, y) => x.rotulo.localeCompare(y.rotulo, "pt-BR"));
  const maiores = maioresDistribuidoras(g);
  const histRazao = histogramaDeFaixas(c.histograma_razao_dec, c.quantis_razao_dec);
  const anoComp = comp.anual.find((x) => x.ano === comp.ano_referencia) ?? null;
  const compAnual = linhasCompensacaoAnual(g);
  const compBarras = compAnual.filter((l) => l.valor_uc_mi !== null);
  const compMensal = linhasCompensacaoMensal(g);
  const compIncompletos = comp.mensal.filter((x) => !x.completo);
  const inicioUg = comp.anual.find((x) => x.valor_ug !== null)?.ano ?? null;
  const distComp = g.distribuidoras.filter((d) => d.compensacao).length;
  const valorPorUc = g.distribuidoras.map((d) => d.compensacao?.valor_por_uc ?? null);
  const histValorUc = montaHistograma(valorPorUc, { largura: 5 });
  const iascValores = [...g.distribuidoras.map((d) => (d.iasc && d.iasc.ano === at.iasc.ano ? d.iasc.valor : null)), ...at.iasc.sem_continuidade_no_ano.map((x) => x.iasc)];
  const histIasc = montaHistograma(iascValores, { largura: 5 });
  const rec = at.reclamacoes_distribuidora.find((x) => x.ano === ref) ?? null;
  const recParcial = at.reclamacoes_distribuidora.find((x) => x.por_ucs === null && x.motivo_ausencia) ?? null;
  const tel = at.telefonico.anual.find((x) => x.ano === ref) ?? null;
  const evt = at.eventos_emergencia;
  const nomesDist = g.distribuidoras.map((d) => ({ cnpj: d.cnpj, rotulo: rotuloDistribuidora(d) }));
  const periodoMensal = g.brasil.mensal.length ? `${mesAno(g.brasil.mensal[0].m)} a ${mesAno(g.brasil.mensal.at(-1)!.m)}` : "sem meses publicados";
  // os arquivos anuais por década são os que o pipeline publica (lista da gold, não escrita aqui)
  const conjuntosDownloads = g.downloads.map((d) => d.url).filter((u) => u.includes("/qualidade_conjuntos_anual_"));
  const tamanhos = Object.fromEntries(conjuntosDownloads.map((u) => [u, tamanho(u)]));
  const exemploDec = a?.dec ?? null;
  const n = (id: IdTabela) => tabelaQualidade(id, g).linhas.length;
  const inicioConcessionarias = g.brasil.anual.find((x) => x.dec_concessionarias !== null)?.ano ?? null;
  const ultimaFaixaRazao = c.histograma_razao_dec.at(-1) ?? null;
  const ouvParcial = at.ouvidoria_aneel.filter((o) => o.por_ucs === null);
  const notaSemUc = notaTiposSemUc(g);
  const distComDec = g.distribuidoras.filter((d) => d.dec !== null).length;
  const parcelasAno = textoParcelasAno(g);
  const divulgado = textoDivulgadoAno(g);
  const tipoDefinicoes = (["dicri", "dise"] as const).map((t) => comp.rotulos_tipo[t]);
  const p051 = painelQualidade("p051");
  const p052 = painelQualidade("p052");
  const p053 = painelQualidade("p053");
  const p054 = painelQualidade("p054");

  // "O que mudou" do P051: a série longa, o expurgo do ano e, à parte, o acumulado do ano corrente (nunca comparado a ano cheio)
  const oQueMudouP051 = (
    <>
      {mudancaP051(g)}
      {quebraApurado && ` ${quebraApurado}`}
      {respostaParcial(g.parcial)}
    </>
  );
  const comoInterpretarP051 = (
    <>
      {regras.agregacao} A linha tracejada é o limite agregado do mesmo ano (limites dos conjuntos ponderados pelas UCs), não um limite oficial nacional.
      {inicioConcessionarias !== null
        ? ` Desde ${inicioConcessionarias}, a linha das concessionárias reproduz o universo do número que a ANEEL divulga.`
        : " A linha só das concessionárias não tem anos com todas as distribuidoras classificadas nesta publicação."}
    </>
  );
  const naoConcluirP051 = (
    <>
      DEC e FEC são médias por unidade consumidora: não dizem quanto tempo cada pessoa ficou sem energia, e parte das unidades fica muito acima da média do conjunto. O apurado exclui
      interrupções expurgadas pela regra; comparar anos sem olhar as parcelas pode esconder eventos extremos.
      {inicioParcelas ? ` Antes de ${inicioParcelas} a fonte usa outra desagregação.` : ""}
    </>
  );
  const comoInterpretarP052 = (
    <>
      No gráfico de pontos, o círculo é o apurado e o losango o limite da distribuidora (limites dos conjuntos ponderados pelas UCs médias do ano); a diferença está escrita.{" "}
      {regras.limite_centesimos} O histograma mostra todos os conjuntos pela razão apurado ÷ limite: à direita de 1, acima do limite.
    </>
  );
  const naoConcluirP052 = (
    <>
      Ficar abaixo do limite agregado não quer dizer que todos os conjuntos da distribuidora ficaram abaixo, nem que nenhum consumidor teve o limite individual violado. Limites
      diferem entre conjuntos e anos: uma razão menor não permite comparar áreas com limites diferentes. A razão do Brasil não é um limite oficial nacional.
    </>
  );
  const comoInterpretarP053 = (
    <>
      {regras.compensacao} As barras somam o que as distribuidoras informaram por competência (o mês de apuração), só para unidades consumidoras, o universo que a ANEEL
      divulga; unidades geradoras ficam na tabela. Valor por UC é só normalização para comparar distribuidoras de tamanhos diferentes: soma as compensações de unidades consumidoras e
      geradoras e divide pelas UCs médias, por isso difere do total só de unidades consumidoras. {divulgado}
    </>
  );
  const naoConcluirP053 = (
    <>
      Não se calcula o crédito de um consumidor: ele depende do DIC, FIC e DMIC da própria unidade e do encargo de uso, que não são publicados. A quantidade é de compensações
      (ocorrências), não de consumidores. A fonte informa a competência, não a data do crédito na fatura. Valores sem correção pela inflação.
    </>
  );
  const naoConcluirP054 = (
    <>
      Número de reclamações sem a base de unidades consumidoras não compara distribuidoras. Reclamações dependem dos canais e da prática de registro, e a ligação sobre falta de
      energia conta como reclamação
      {rec && rec.por_ucs !== null && rec.interrupcao_por_mil_uc !== null ? ` (${num(rec.interrupcao_por_mil_uc, 1)} das ${num(rec.por_ucs, 1)} por mil UCs em ${ref})` : ""}: a taxa
      inclui as ligações sobre interrupção e não mede só insatisfação com o atendimento. O IASC tem margem de erro amostral e não é publicado com intervalo. A base de eventos de
      emergência começa em {evt.inicio_min ? mesAno(evt.inicio_min.slice(0, 7)) : "data não publicada"}: não há série anterior para comparar.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="qualidade" />
      <MarcaVisita secao="energia:qualidade" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["DEC", "FEC", "UC", "DIC", "FIC", "ANEEL", "IBGE", "ONS"]}
          titulo="Quanto tempo e quantas vezes falta luz?"
          lead="Duração (DEC) e frequência (FEC) das interrupções por unidade consumidora (UC), cada uma na sua escala e diante do limite do mesmo ano. Médias, não o que cada consumidor viveu."
          recorte={`${ref} · Brasil, ${distComDec} distribuidoras · horas e interrupções por UC`}
          fonte="ANEEL, indicadores coletivos de continuidade"
          referencia={
            <>
              {textoAtualidade(g)} Indicadores publicados pela ANEEL em {dataBR(prov.conjuntos.publicado_pela_fonte_em?.slice(0, 10) ?? null)}; processado em {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <QualidadeDatas
              itens={[
                { rotulo: "DEC e FEC", texto: `ano completo ${ref}; último mês nacional completo ${mesAno(g.ultimo_mes_completo)}`, natureza: "CALCULADO" },
                { rotulo: "Limites e ranking", texto: `ano de apuração ${c.ano}`, natureza: "CALCULADO" },
                { rotulo: "Compensações", texto: `ano completo ${comp.ano_referencia}; último mês completo ${comp.ultimo_mes_completo ? mesAno(comp.ultimo_mes_completo) : "não informado"}`, natureza: "CALCULADO" },
                { rotulo: "Reclamações", texto: `de ${at.reclamacoes_distribuidora[0]?.ano ?? ref} a ${ref}${recParcial ? ` (${recParcial.ano} parcial)` : ""}`, natureza: "CALCULADO" },
                { rotulo: "Satisfação (IASC)", texto: `pesquisa de ${at.iasc.ano ?? "ano não publicado"}`, natureza: "ESTIMADO" },
                { rotulo: "Eventos de emergência", texto: evt.inicio_min && evt.inicio_max ? `de ${dataBR(evt.inicio_min.slice(0, 10))} a ${dataBR(evt.inicio_max.slice(0, 10))}` : "datas não publicadas", natureza: "CALCULADO" },
              ]}
            />
          }
          metricas={
            <>
              {defasagem && <QualidadeAviso>{defasagem}</QualidadeAviso>}
              <FaixaMetricas colunas={4} rotulo="Indicadores de continuidade no Brasil">
                <Numero
                  variante="faixa"
                  rotulo="Duração média (DEC)"
                  natureza="CALCULADO"
                  valor={m.dec}
                  formato="num"
                  casas={2}
                  unidade="h por UC"
                  periodo={String(m.ano)}
                  evidencia={ev.dec_brasil ?? null}
                  motivoAusencia="Ano sem os 12 meses nacionais completos."
                  nota={
                    m.dec !== null ? (
                      <>
                        Cerca de {m.decHorasMinutos} por UC.
                        {m.decAnterior !== null && ` Em ${m.anoAnterior}: ${num(m.decAnterior, 2)} h.`}
                        {notaPerimetroAbertura(g, "dec") && ` ${notaPerimetroAbertura(g, "dec")}`}
                      </>
                    ) : undefined
                  }
                  cor="var(--cor-energia)"
                  endereco={`/setor-eletrico/qualidade#${p051.ancora}`}
                />
                <Numero
                  variante="faixa"
                  rotulo="Frequência média (FEC)"
                  natureza="CALCULADO"
                  valor={m.fec}
                  formato="num"
                  casas={2}
                  unidade="interrupções por UC"
                  periodo={String(m.ano)}
                  evidencia={ev.fec_brasil ?? null}
                  motivoAusencia="Ano sem os 12 meses nacionais completos."
                  nota={
                    m.fec !== null ? (
                      <>
                        Interrupções de 3 min ou mais.
                        {m.fecAnterior !== null && ` Em ${m.anoAnterior}: ${num(m.fecAnterior, 2)}.`}
                        {notaPerimetroAbertura(g, "fec") && ` ${notaPerimetroAbertura(g, "fec")}`}
                      </>
                    ) : undefined
                  }
                  cor="var(--cor-energia)"
                  endereco={`/setor-eletrico/qualidade#${p051.ancora}`}
                />
                <Numero
                  variante="faixa"
                  rotulo="Conjuntos acima do limite de DEC"
                  natureza="CALCULADO"
                  valor={m.conjuntos.pct}
                  formato="pct"
                  casas={1}
                  // a unidade da evidência começa com "%", que o formato já escreve colado ao número
                  unidade="dos conjuntos"
                  periodo={String(m.conjuntos.ano)}
                  evidencia={ev.conjuntos_acima_limite ?? null}
                  nota={
                    <>
                      {num(m.conjuntos.acima, 0)} de {num(m.conjuntos.comLimite, 0)} conjuntos. {DEFINICAO_CONJUNTO_CURTA}
                      {m.conjuntos.pctAnterior !== null && ` Em ${m.conjuntos.anoAnterior}: ${pct(m.conjuntos.pctAnterior, 1)}.`}
                    </>
                  }
                  cor="var(--serie-referencia)"
                  endereco={`/setor-eletrico/qualidade#${p052.ancora}`}
                />
                <Numero
                  variante="faixa"
                  rotulo="DEC de todas as origens"
                  natureza="CALCULADO"
                  valor={m.decTodasOrigens}
                  formato="num"
                  casas={2}
                  unidade="h por UC"
                  periodo={String(m.ano)}
                  motivoAusencia="Parcelas não publicadas para o ano."
                  nota={
                    m.decTodasOrigens !== null ? (
                      <>
                        Cerca de {m.decTodasOrigensHorasMinutos}. Inclui o que a regra deixa fora do limite: emergências, dias críticos, origem externa e cortes do ONS.
                      </>
                    ) : undefined
                  }
                />
              </FaixaMetricas>
            </>
          }
        >
          A ANEEL mede a continuidade do fornecimento por <Termo slug="conjunto-eletrico">conjunto elétrico</Termo>: o <Termo slug="dec">DEC</Termo> diz quantas horas, em média, cada
          unidade consumidora ficou sem energia, e o <Termo slug="fec">FEC</Termo> quantas vezes. Esta página mostra esses números para o Brasil, as distribuidoras e os conjuntos,
          compara cada um com o limite regulatório do mesmo ano, mostra as <Termo slug="compensacao-continuidade">compensações</Termo> pagas a quem teve limite individual violado e
          como o consumidor é atendido.
        </CabecalhoModulo>

        <ModoProfundidade>
          {/* ---------------- P051 ---------------- */}
          <Bloco id={p051.ancora}>
            <PainelEvidencia
              id={p051.id}
              pergunta={p051.titulo}
              subtitulo="DEC e FEC apurados, o que a regra conta para o limite, no Brasil, nas distribuidoras e nos conjuntos · horas e interrupções por UC"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  DEC e FEC são os indicadores com que a ANEEL acompanha a continuidade do fornecimento: limites, ranking e compensações partem deles. A média nacional é ponderada pelas
                  unidades consumidoras de cada conjunto em cada mês, então distribuidoras grandes pesam mais.
                </>
              }
              oQueMudou={oQueMudouP051}
              comoInterpretar={comoInterpretarP051}
              naoConcluir={naoConcluirP051}
              naoConcluirNoCorpo
              proveniencia={prov.distribuidoras}
              complementares={[
                { rotulo: "Conjuntos (valores da ANEEL)", p: prov.conjuntos },
                { rotulo: "Mapa por município", p: prov.mapa },
              ]}
            >
              <div className="space-y-6">
                <CursorSincronizado>
                  <QualidadePar>
                    <GraficoLinhas
                      titulo={`DEC apurado do Brasil e limite agregado, ${primeiroAno} a ${ref}`}
                      dados={anualDec}
                      chaveX="ano"
                      formatoX="texto"
                      series={[
                        { id: "dec", rotulo: "Todas as distribuidoras", sigla: "DEC", cor: "var(--cor-energia)" },
                        { id: "dec_concessionarias", rotulo: "Só concessionárias", sigla: "Concess.", cor: "var(--serie-sm-se)" },
                        { id: "dec_limite", rotulo: "Limite agregado do ano", sigla: "Limite", cor: "var(--serie-referencia)", tracejada: true },
                      ]}
                      unidade="h"
                      casas={2}
                      zeroNoEixo
                      marcos={marcos}
                    />
                    <GraficoLinhas
                      titulo={`FEC apurado do Brasil e limite agregado, ${primeiroAno} a ${ref}`}
                      dados={anualFec}
                      chaveX="ano"
                      formatoX="texto"
                      series={[
                        { id: "fec", rotulo: "Todas as distribuidoras", sigla: "FEC", cor: "var(--cor-energia)" },
                        { id: "fec_concessionarias", rotulo: "Só concessionárias", sigla: "Concess.", cor: "var(--serie-sm-se)" },
                        { id: "fec_limite", rotulo: "Limite agregado do ano", sigla: "Limite", cor: "var(--serie-referencia)", tracejada: true },
                      ]}
                      unidade="interrupções"
                      casas={2}
                      zeroNoEixo
                      marcos={marcos}
                    />
                  </QualidadePar>
                </CursorSincronizado>

                {/* a resposta vem logo depois das duas figuras: os mesmos números já estão na faixa de métricas, e a figura chega à primeira tela */}
                <div>
                  <RespostaCurta id={p051.id} veredito={vereditoP051(g)}>
                    {respostaP051(g)}
                  </RespostaCurta>
                </div>

                <QualidadeRecorte
                  periodo={
                    <>
                      Anual de {primeiroAno} a {ref} (só anos com 12 meses nacionais completos); mensal de {periodoMensal}
                    </>
                  }
                  universo={
                    <>
                      {textoUniversoBrasil(g)} Mapa: conjuntos com DEC em {g.mapa.ano}.
                    </>
                  }
                  unidade={
                    <>
                      DEC em horas e centésimos de hora, não em minutos: {regras.centesimos}
                      {exemploDec !== null && ` Assim, as ${num(exemploDec, 2)} h do Brasil em ${ref} são ${horasEMinutos(exemploDec)}.`} FEC em interrupções e centésimos por unidade
                      consumidora: média de vezes em que cada unidade ficou sem energia por 3 minutos ou mais.
                    </>
                  }
                />

                <NotasDoPainel oQueMudou={oQueMudouP051} comoInterpretar={comoInterpretarP051} naoConcluir={naoConcluirP051} />

                <QualidadeCapitulos atual={p051.ancora} />

                <SecaoDoPainel
                  id="expurgos"
                  titulo="Quanto do tempo sem energia fica fora do apurado?"
                  lead={
                    <>
                      O DEC apurado, o que se compara ao limite, exclui interrupções em situação de emergência, em dia crítico, de origem externa ao sistema de distribuição e cortes
                      pedidos pelo ONS. As barras empilham as parcelas que a ANEEL publica{inicioParcelas ? ` desde ${inicioParcelas}` : ""}; a soma é o tempo sem energia de todas as
                      origens publicadas.
                    </>
                  }
                >
                  {parcelasAno && (
                    <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-texto="parcelas-do-ano">
                      {parcelasAno}
                    </p>
                  )}
                  <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] [&>*]:min-w-0">
                    <GraficoBarras
                      titulo={`Parcelas do DEC do Brasil por origem, ${parcelas[0]?.ano ?? ""} a ${ref}`}
                      dados={parcelas}
                      chaveCategoria="ano"
                      series={ORDEM_PARCELAS.map((p) => ({ id: p, rotulo: ROTULO_PARCELA_CURTO[p], cor: COR_PARCELA[p] }))}
                      unidade="h"
                      casas={2}
                      empilhado
                      altura={320}
                    />
                    <dl className="space-y-3 text-sm">
                      {ORDEM_PARCELAS.map((p) => (
                        <div key={p}>
                          <dt className="font-medium text-carvao">{paraLeitor(g.parcelas.rotulos[p])}</dt>
                          <dd className="text-carvao-muted">{g.parcelas.grupos[p].map((s) => `${s}: ${paraLeitor(g.parcelas.definicao[s] ?? "sem definição no dicionário")}`).join("; ")}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{regras.apurado}</p>
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="mapa-municipios"
                  titulo="Que conjuntos atendem cada município?"
                  lead={
                    <>
                      {num(g.mapa.municipios_com_valor, 0)} municípios com valor em {g.mapa.ano}. {DEFINICAO_CONJUNTO} Cada cor é o valor de um conjunto, não do município: um conjunto pode atender
                      vários municípios e um município pode ter vários conjuntos, por isso não há média municipal. Escolha o maior ou o menor valor entre eles; clique num município, ou busque
                      pelo nome, para ver os conjuntos, com o limite de cada um, e as distribuidoras.
                    </>
                  }
                >
                  <QualidadeMapa
                    ano={g.mapa.ano}
                    urlMunicipios={URL_MUNICIPIOS}
                    urlSerie={URL_SERIE}
                    distribuidoras={nomesDist}
                    regra={g.mapa.regra}
                    totalMunicipios={g.mapa.correspondencia.cadastro_ibge}
                    fonte="ANEEL, IndQual Município e Indicadores Coletivos de Continuidade; IBGE, cadastro de municípios"
                    versao={String(g.mapa.ano)}
                    avisosFec={avisos}
                    tamanhoConjuntos={tamanhos[arquivoConjuntosDoAno(g.mapa.ano)]}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="mensal" nivel="analisar" titulo="Mês a mês, nos últimos meses publicados">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {regras.mes_completo}{" "}
                    {incompletos.length ? `Ficam fora, com o valor publicado na tabela: ${incompletos.map((x) => mesAno(x.m)).join(", ")}.` : "Todos os meses do período estão completos."}
                  </p>
                  <CursorSincronizado>
                    <QualidadePar>
                      <GraficoLinhas
                        titulo="DEC mensal do Brasil (meses completos)"
                        dados={mensalDec}
                        chaveX="m"
                        formatoX="mes"
                        series={[{ id: "dec", rotulo: "DEC mensal", cor: "var(--cor-energia)" }]}
                        unidade="h"
                        casas={2}
                        zeroNoEixo
                        altura={220}
                      />
                      <GraficoLinhas
                        titulo="FEC mensal do Brasil (meses completos)"
                        dados={mensalFec}
                        chaveX="m"
                        formatoX="mes"
                        series={[{ id: "fec", rotulo: "FEC mensal", cor: "var(--serie-sm-se)" }]}
                        unidade="interrupções"
                        casas={2}
                        zeroNoEixo
                        altura={220}
                      />
                    </QualidadePar>
                  </CursorSincronizado>
                  <QualidadeTabela tabela="mensal" titulo="Meses publicados, com a situação de cada um" linhas={n("mensal")} chaveUrl="tmes" />
                </SecaoDoPainel>

                <SecaoDoPainel id="tabela-distribuidoras" nivel="analisar" titulo={`Todas as distribuidoras em ${ref}: duração, frequência e expurgos`}>
                  <QualidadeTabela tabela="dist-p051" titulo={`DEC, FEC e parcelas por distribuidora, ${ref}`} linhas={n("dist-p051")} chaveUrl="tdist" avisosFec={avisos} />
                </SecaoDoPainel>

                <SecaoDoPainel id="conjuntos-do-ano" nivel="analisar" titulo="Todos os conjuntos de um ano">
                  <QualidadeConjuntos anoInicial={Number(primeiroAno)} anoFinal={ref} tamanhos={tamanhos} fonte={FONTE_CONTINUIDADE} />
                </SecaoDoPainel>

                <SecaoDoPainel id="universos-e-arquivos" nivel="auditar" titulo="Universos, pesos, controles e arquivos">
                  <ul className="space-y-2 text-sm text-carvao-muted">
                    <li>
                      <strong className="font-medium text-carvao">Universo principal:</strong> {universo.principal}
                    </li>
                    <li>
                      <strong className="font-medium text-carvao">Só concessionárias:</strong> {universo.concessionarias}
                    </li>
                    <li>
                      <strong className="font-medium text-carvao">Peso:</strong> {regras.agregacao}
                    </li>
                    <li>
                      <strong className="font-medium text-carvao">Controle do número de unidades:</strong> {regras.numcon}
                    </li>
                    <li>
                      <strong className="font-medium text-carvao">Ano corrente:</strong> {regras.parcial} {avisoAnoCorrente}
                    </li>
                    <li data-texto="cobertura-fec">
                      <strong className="font-medium text-carvao">Cobertura do FEC:</strong> o FEC anual de uma distribuidora que difere em mais de {num(LIMITE_FEC_PARCIAL_CENTESIMOS / 100, 2)} da soma das
                      parcelas internas (FECIP + FECIND) é marcado como de cobertura parcial, e o valor da base não muda.{" "}
                      {listaAvisos.length ? listaAvisos.map((x) => x.frase).join(" ") : "Nenhuma distribuidora tem a marca nesta publicação."} {textoFecBrasilConfere(g)}
                    </li>
                  </ul>
                  <QualidadeTabela tabela="identidade" titulo="Identidade do apurado: DEC e FEC iguais às parcelas internas (IP + IND), por ano" linhas={n("identidade")} chaveUrl="tide" />
                  <ul className="space-y-1 text-sm">
                    {["/energia/series/qualidade_brasil.csv", "/energia/series/qualidade_distribuidoras_anual.csv", "/energia/series/qualidade_distribuidoras_mensal.csv", "/energia/series/qualidade_conjuntos_mensal.csv", URL_MUNICIPIOS, ...conjuntosDownloads].map((u) => (
                      <li key={u}>
                        <a href={u} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                          {u.split("/").at(-1)} ({tamanho(u)})
                        </a>
                      </li>
                    ))}
                  </ul>
                </SecaoDoPainel>

                <SeguirPainel ancora={p051.ancora} downloads={downloadsDoPainel(g, "p051")} proximo={{ href: `#${p052.ancora}`, pergunta: p052.descricao }} />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- P052 ---------------- */}
          <Bloco id={p052.ancora}>
            <PainelEvidencia
              id={p052.id}
              pergunta={p052.titulo}
              subtitulo="DEC e FEC apurados diante do limite regulatório do mesmo ano · razão apurado ÷ limite"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  A ANEEL fixa limites de DEC e de FEC para cada <Termo slug="conjunto-eletrico">conjunto</Termo> com a periodicidade das revisões tarifárias. Segundo a ANEEL, o
                  descumprimento traz consequências à distribuidora, como plano de resultados e limitação de proventos aos acionistas, e o ranking da continuidade parte da distância ao
                  limite: ela mostra quem está perto, quem passou e por quanto.
                </>
              }
              oQueMudou={mudancaP052(c)}
              comoInterpretar={comoInterpretarP052}
              naoConcluir={naoConcluirP052}
              naoConcluirNoCorpo
              proveniencia={prov.limites}
              complementares={[{ rotulo: "Ranking da continuidade (DGC publicado)", p: prov.ranking }]}
            >
              <div className="space-y-6">
                <RespostaCurta id={p052.id} veredito={vereditoP052(g)}>
                  {respostaP052(g)} {contagemFec}
                </RespostaCurta>

                <QualidadeLimites
                  ano={ref}
                  itens={itensLimites(g)}
                  avisosFec={avisos}
                  totalLinhas={n("limites")}
                  urlSerie={URL_SERIE}
                />

                <QualidadeRecorte
                  periodo={<>Ano de apuração {c.ano}, com o limite do mesmo ano; histórico de {c.historico[0]?.ano ?? c.ano} a {c.ano}</>}
                  universo={
                    <>
                      {num(c.com_limite, 0)} conjuntos com 12 meses e limite; {g.distribuidoras.length} distribuidoras com indicadores de continuidade ({g.distribuidoras.filter((d) => d.dec === null).length} sem valor anual); as encerradas ou absorvidas, listadas em Perdas e em Minha região, não têm
                    </>
                  }
                  unidade={
                    <>
                      horas (DEC), interrupções (FEC) e razão apurado ÷ limite (adimensional). DGC, o desempenho global de continuidade: média simples de DEC ÷ limite e FEC ÷ limite, calculada
                      aqui e publicada no ranking da ANEEL, lado a lado na tabela.
                    </>
                  }
                />

                <NotasDoPainel oQueMudou={mudancaP052(c)} comoInterpretar={comoInterpretarP052} naoConcluir={naoConcluirP052} />

                <SecaoDoPainel
                  id="comparar-distribuidoras"
                  titulo="Como cada distribuidora se compara com o próprio limite, ano a ano?"
                  lead={`Sem escolha no link, entram as quatro maiores distribuidoras em unidades consumidoras em ${ref}. Por padrão, os painéis de cada indicador usam a mesma escala, e a linha tracejada é o limite de cada ano; com mais de uma distribuidora, dá para trocar para a escala própria de cada painel. Incorporações mudam a área da distribuidora e aparecem na nota do painel.`}
                >
                  <QualidadeComparador entidades={entidades} padrao={maiores} urlSerie={URL_SERIE} avisosFec={avisos} />
                </SecaoDoPainel>

                <SecaoDoPainel id="distribuicao-dos-conjuntos" titulo="Como os conjuntos se distribuem diante do limite? As médias não escondem as caudas">
                  <Histograma
                    titulo={`Conjuntos por razão DEC ÷ limite, ${c.ano}`}
                    dados={histRazao}
                    rotuloX="DEC apurado ÷ limite do conjunto"
                    unidade="vezes o limite"
                    casas={2}
                    contagem={{ singular: "conjunto", plural: "conjuntos" }}
                    periodo={String(c.ano)}
                    valorAtual={{ valor: 1, rotulo: "Limite" }}
                    cor="var(--cor-energia)"
                    nota={`Faixas e quantis calculados no processamento sobre todos os conjuntos.${
                      ultimaFaixaRazao && ultimaFaixaRazao.ate === null && c.quantis_razao_dec.max !== null
                        ? ` A última faixa é aberta na fonte (${num(ultimaFaixaRazao.de, 2)} vezes o limite ou mais) e é desenhada até o máximo (${num(c.quantis_razao_dec.max, 2)}).`
                        : ""
                    } ${num(c.iguais_limite_dec, 0)} conjuntos com DEC igual ao limite não contam como acima.`}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="ano-a-ano" titulo="Quantos conjuntos passaram do limite, ano a ano?" lead={textoUniversosConjuntos(g)}>
                  <QualidadePar>
                    <GraficoLinhas
                      titulo={`Unidades consumidoras e conjuntos acima do limite de DEC, ${c.historico[0]?.ano ?? ""} a ${c.ano}`}
                      dados={histUcs}
                      chaveX="ano"
                      formatoX="texto"
                      series={[
                        { id: "pct_ucs_acima", rotulo: "% das unidades consumidoras (leitura principal)", sigla: "UCs", cor: "var(--cor-energia)" },
                        { id: "pct_acima", rotulo: "% dos conjuntos", sigla: "Conjuntos", cor: "var(--serie-sm-se)" },
                      ]}
                      unidade="%"
                      casas={1}
                      zeroNoEixo
                    />
                    <GraficoLinhas
                      titulo="Razão DEC ÷ limite dos conjuntos: mediana e percentil 90"
                      dados={histRazoes}
                      chaveX="ano"
                      formatoX="texto"
                      series={[
                        { id: "razao_p50", rotulo: "Mediana dos conjuntos", sigla: "Mediana", cor: "var(--cor-energia)" },
                        { id: "razao_p90", rotulo: "Percentil 90 dos conjuntos", sigla: "P90", cor: "var(--serie-termica)" },
                      ]}
                      unidade="vezes o limite"
                      casas={3}
                      zeroNoEixo
                    />
                  </QualidadePar>
                </SecaoDoPainel>

                <SecaoDoPainel id="matriz-limite-razao" nivel="analisar" titulo="Limite apertado ou folgado: faixa do limite × distância a ele">
                  <QualidadeTabela tabela="matriz" titulo={`Conjuntos por faixa de limite de DEC e por razão DEC ÷ limite, ${c.ano}`} linhas={n("matriz")} chaveUrl="tmat" />
                </SecaoDoPainel>

                <SecaoDoPainel id="pontas" nivel="analisar" titulo="As pontas: os conjuntos mais distantes do limite e os de maior DEC">
                  <QualidadeTabela tabela="cauda-razao" titulo={`Conjuntos com maior razão DEC ÷ limite, ${c.ano}`} linhas={n("cauda-razao")} chaveUrl="tcr" />
                  <QualidadeTabela tabela="cauda-dec" titulo={`Conjuntos com maior DEC, ${c.ano}`} linhas={n("cauda-dec")} chaveUrl="tcd" />
                </SecaoDoPainel>

                <SecaoDoPainel id="dgc" nivel="auditar" titulo="DGC calculado × DGC publicado no ranking da ANEEL">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {regras.limite} Tolerância de 0,01, a precisão do DGC publicado. Posição no ranking e DGC publicado são da ANEEL; o DGC calculado é do observatório.
                  </p>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-texto="divergencias-dgc">
                    {textoDivergenciasDgc(g)}
                  </p>
                  <QualidadeTabela tabela="dgc" titulo="Reconciliação do DGC por ano" linhas={n("dgc")} chaveUrl="tdgc" />
                </SecaoDoPainel>

                <SeguirPainel ancora={p052.ancora} downloads={downloadsDoPainel(g, "p052")} proximo={{ href: `#${p053.ancora}`, pergunta: p053.descricao }} />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- P053 ---------------- */}
          <Bloco id={p053.ancora}>
            <PainelEvidencia
              id={p053.id}
              pergunta={p053.titulo}
              subtitulo="Compensações pagas quando o limite individual de continuidade de uma unidade consumidora é violado · R$ nominais e quantidade"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  Quando a unidade consumidora passa do seu limite individual de duração ou de frequência, a distribuidora deve creditar uma compensação na fatura. É o efeito da
                  continuidade que chega ao bolso do consumidor.
                </>
              }
              oQueMudou={mudancaP053(g)}
              comoInterpretar={comoInterpretarP053}
              naoConcluir={naoConcluirP053}
              naoConcluirNoCorpo
              proveniencia={prov.compensacoes}
            >
              <div className="space-y-6">
                <RespostaCurta id={p053.id} veredito={vereditoP053(g)}>
                  {respostaP053(g)}
                </RespostaCurta>

                <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-texto="limites-individuais">
                  {DEFINICAO_LIMITES_INDIVIDUAIS}
                </p>

                <FaixaMetricas colunas={3} rotulo="Compensações do ano de referência">
                  <Numero
                    variante="faixa"
                    rotulo="Pago a unidades consumidoras"
                    natureza="CALCULADO"
                    valor={mc.valorUcMilhoes}
                    formato="reais"
                    casas={1}
                    unidade="milhões"
                    periodo={String(comp.ano_referencia)}
                    evidencia={ev.compensacoes_ano ?? null}
                    motivoAusencia="Ano sem os 12 meses informados pelas distribuidoras."
                    nota={[
                      mc.valorUcAnteriorMilhoes !== null
                        ? `Valores nominais da competência. Em ${mc.anoAnterior}: R$ ${num(mc.valorUcAnteriorMilhoes, 1)} milhões.`
                        : "Valores nominais da competência.",
                      notaDivulgadoCartao(g),
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    cor="var(--cor-energia)"
                    endereco={`/setor-eletrico/qualidade#${p053.ancora}`}
                  />
                  <Numero
                    variante="faixa"
                    rotulo="Compensações pagas a unidades consumidoras"
                    natureza="CALCULADO"
                    valor={mc.quantidadeUcMilhoes}
                    formato="num"
                    casas={1}
                    unidade="milhões de compensações"
                    periodo={String(comp.ano_referencia)}
                    motivoAusencia="Ano sem os 12 meses informados pelas distribuidoras."
                    nota="Conta compensações, não consumidores."
                  />
                  <Numero
                    variante="faixa"
                    rotulo="Pago a unidades geradoras"
                    natureza="CALCULADO"
                    valor={mc.valorUgMilhoes}
                    formato="reais"
                    casas={1}
                    unidade="milhões"
                    periodo={String(comp.ano_referencia)}
                    motivoAusencia="Sem linha de unidade geradora na fonte para o ano."
                    nota="À parte: não entra no total das unidades consumidoras."
                  />
                </FaixaMetricas>

                <GraficoBarras
                  titulo={`Compensações pagas a unidades consumidoras por ano, ${compBarras[0]?.ano ?? ""} a ${comp.ano_referencia}`}
                  dados={recorteColunas(compBarras, ["ano", "valor_uc_mi"])}
                  chaveCategoria="ano"
                  series={[{ id: "valor_uc_mi", rotulo: "Valor a unidades consumidoras", cor: "var(--cor-energia)" }]}
                  unidade="R$ milhões"
                  casas={1}
                  altura={300}
                />
                <TabelaInterativa
                  titulo="Compensações por ano: unidades consumidoras e geradoras"
                  colunas={COLUNAS_COMP_ANUAL}
                  linhas={compAnual.map((l) => ({ ...l, id: String(l.ano) }))}
                  chaveLinha="id"
                  colunaRotulo="ano"
                  fonte="ANEEL, compensações por violação de limites de continuidade"
                  versao={comp.ultimo_mes_completo ?? String(comp.ano_referencia)}
                  nomeArquivo="qualidade-compensacoes-anual"
                  chaveUrl="tcomp"
                  ordemInicial={{ coluna: "ano", direcao: "desc" }}
                  nota={`Unidade geradora sem linha na fonte${inicioUg ? ` (antes de ${inicioUg})` : ""} é ausência, não zero. O ano corrente é parcial e fica fora do gráfico.`}
                />

                <QualidadeRecorte
                  periodo={
                    <>
                      Anos completos de {compBarras[0]?.ano ?? comp.ano_referencia} a {comp.ano_referencia}; último mês completo {comp.ultimo_mes_completo ? mesAno(comp.ultimo_mes_completo) : "não informado"}
                    </>
                  }
                  universo={`${distComp} distribuidoras informaram compensações em ${comp.ano_referencia}; unidades consumidoras (UC) e unidades geradoras (UG) separadas`}
                  unidade="R$ nominais da competência (milhões no gráfico) e quantidade de compensações"
                />

                <NotasDoPainel oQueMudou={mudancaP053(g)} comoInterpretar={comoInterpretarP053} naoConcluir={naoConcluirP053} />

                <QualidadePar>
                  <SecaoDoPainel id="tipos-de-violacao" titulo={`Qual limite foi violado? Valor pago por tipo em ${comp.ano_referencia}`}>
                    <GraficoBarras
                      titulo={`Valor pago a unidades consumidoras por tipo de limite violado, ${comp.ano_referencia}`}
                      dados={linhasTipoAnoReferencia(g)}
                      chaveCategoria="id"
                      chaveRotulo="tipo"
                      series={[{ id: "valor_mi", rotulo: "Valor a unidades consumidoras", cor: "var(--cor-energia)" }]}
                      unidade="R$ milhões"
                      casas={2}
                      orientacao="horizontal"
                      rotulosValor
                    />
                    <p className="max-w-prose2 text-sm text-carvao-muted">
                      {tipoDefinicoes.join("; ")}.{notaSemUc ? ` ${notaSemUc}` : ""}
                    </p>
                    <QualidadeTabela tabela="comp-tipo" titulo="Valor pago a unidades consumidoras por tipo de violação e ano" linhas={n("comp-tipo")} chaveUrl="tctp" />
                  </SecaoDoPainel>
                  <SecaoDoPainel id="compensacao-entre-distribuidoras" titulo={`Como o valor se distribui entre as distribuidoras em ${comp.ano_referencia}?`}>
                    <Histograma
                      titulo={`Distribuidoras por valor de compensação ÷ unidades consumidoras, ${comp.ano_referencia}`}
                      dados={histValorUc}
                      rotuloX="Valor no ano (UC e UG) ÷ UCs médias"
                      unidade="R$ por UC"
                      casas={2}
                      contagem={{ singular: "distribuidora", plural: "distribuidoras" }}
                      periodo={String(comp.ano_referencia)}
                      valorAtual={{ valor: anoComp?.valor_por_uc ?? null, rotulo: "Brasil" }}
                      cor="var(--cor-energia)"
                      nota="Normalização para comparar tamanhos; não é o crédito de cada consumidor."
                    />
                    <QualidadeTabela tabela="comp-dist" titulo={`Compensações por distribuidora, ${comp.ano_referencia}`} linhas={n("comp-dist")} chaveUrl="tcdi" />
                  </SecaoDoPainel>
                </QualidadePar>

                <SecaoDoPainel id="compensacoes-mes-a-mes" nivel="analisar" titulo="Mês a mês: valor e quantidade separados">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    Competência mensal. {regras.mes_completo_compensacao}{" "}
                    {compIncompletos.length ? `Ficam fora, com o valor publicado na tabela: ${compIncompletos.map((x) => mesAno(x.m)).join(", ")}.` : "Todos os meses do período estão completos."} Os dois gráficos
                    compartilham o cursor.
                  </p>
                  <CursorSincronizado>
                    <QualidadePar>
                      <GraficoLinhas
                        titulo="Valor das compensações por mês (meses completos)"
                        dados={recorteColunas(compMensal, ["m", "valor_mi"])}
                        chaveX="m"
                        formatoX="mes"
                        series={[{ id: "valor_mi", rotulo: "Valor (UC e UG)", cor: "var(--cor-energia)" }]}
                        unidade="R$ milhões"
                        casas={1}
                        zeroNoEixo
                        altura={220}
                      />
                      <GraficoLinhas
                        titulo="Quantidade de compensações por mês (meses completos)"
                        dados={recorteColunas(compMensal, ["m", "quantidade_mil"])}
                        chaveX="m"
                        formatoX="mes"
                        series={[{ id: "quantidade_mil", rotulo: "Compensações (UC e UG)", cor: "var(--serie-sm-se)" }]}
                        unidade="mil compensações"
                        casas={0}
                        zeroNoEixo
                        altura={220}
                      />
                    </QualidadePar>
                  </CursorSincronizado>
                </SecaoDoPainel>

                <SecaoDoPainel id="conferencia-divulgado" nivel="auditar" titulo="Conferência com o total divulgado pela ANEEL">
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    A ANEEL divulga o total anual pago a unidades consumidoras na notícia do ranking (bilhões com três casas, milhões de compensações com uma). Diferença fora da precisão
                    fica marcada e não foi explicada; a hipótese de revisão dos envios depois da divulgação não está verificada.
                  </p>
                  <QualidadeTabela tabela="divulgado" titulo="Total de compensações a UCs: soma dos dados abertos × total divulgado" linhas={n("divulgado")} chaveUrl="tdiv" />
                </SecaoDoPainel>

                <SeguirPainel ancora={p053.ancora} downloads={downloadsDoPainel(g, "p053")} proximo={{ href: `#${p054.ancora}`, pergunta: p054.descricao }} />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- P054 ---------------- */}
          <Bloco id={p054.ancora}>
            <PainelEvidencia
              id={p054.id}
              pergunta={p054.titulo}
              subtitulo="Reclamações por unidade consumidora, pesquisa de satisfação (IASC) com amostra, atendimento telefônico e emergencial, eventos de emergência · escopos separados"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  A continuidade mede quanto falta energia; o atendimento mede como a distribuidora responde: quantas reclamações recebe para cada mil unidades, quanto tempo leva para
                  chegar a uma ocorrência e como os consumidores avaliam o serviço.
                </>
              }
              oQueMudou={mudancaP054(g)}
              comoInterpretar={
                <>
                  Cada indicador tem o seu escopo e a sua base, e eles não se somam: reclamações na distribuidora por mil UCs, na Ouvidoria da ANEEL por 100 mil, o IASC é uma pesquisa por
                  amostra e o TMAE uma média de tempos ponderada pelas ocorrências. Taxa só existe em ano com os 12 meses enviados.
                </>
              }
              naoConcluir={naoConcluirP054}
              naoConcluirNoCorpo
              proveniencia={prov.reclamacoes}
              complementares={[
                { rotulo: "Ouvidoria Setorial da ANEEL", p: prov.ouvidoria_aneel },
                { rotulo: "IASC (pesquisa amostral)", p: prov.iasc },
                { rotulo: "Atendimento emergencial (TMAE)", p: prov.atendimento_emergencial },
                { rotulo: "Atendimento telefônico", p: prov.telefonico },
                { rotulo: "Eventos em situação de emergência", p: prov.eventos },
              ]}
            >
              <div className="space-y-6">
                <RespostaCurta id={p054.id} veredito={vereditoP054(g)}>
                  {respostaP054(g)}
                </RespostaCurta>

                <FaixaMetricas colunas={2} rotulo="Reclamações do ano de referência, cada uma com a sua base">
                  <Numero
                    variante="faixa"
                    rotulo="Reclamações na distribuidora, 1º nível"
                    natureza="CALCULADO"
                    evidencia={ev.reclamacoes_distribuidora ?? null}
                    valor={rec?.por_ucs ?? null}
                    casas={1}
                    unidade="por mil UCs"
                    motivoAusencia={rec?.motivo_ausencia ?? "Sem distribuidora com os 12 meses enviados."}
                    nota={
                      rec && rec.por_ucs !== null
                        ? `Base: 1.000 unidades consumidoras médias das mesmas distribuidoras. Na base de 100 mil UCs do cartão ao lado, seriam ${num(taxaNaBaseDaOuvidoria(rec.por_ucs), 0)}.`
                        : "Base: 1.000 unidades consumidoras médias das mesmas distribuidoras."
                    }
                    cor="var(--cor-energia)"
                    endereco={`/setor-eletrico/qualidade#${p054.ancora}`}
                  />
                  <Numero
                    variante="faixa"
                    rotulo="Reclamações na Ouvidoria da ANEEL, 2º nível"
                    natureza="CALCULADO"
                    evidencia={ev.ouvidoria_aneel ?? null}
                    casas={1}
                    unidade="por 100 mil UCs"
                    motivoAusencia="Arquivo da Ouvidoria sem os 12 meses do ano."
                    nota="Base: 100 mil UCs, diferente da do cartão ao lado (1.000). Segunda instância, depois do atendimento na distribuidora."
                    cor="var(--serie-sm-se)"
                    endereco={`/setor-eletrico/qualidade#${p054.ancora}`}
                  />
                </FaixaMetricas>

                <QualidadePar>
                  <div className="space-y-3">
                    <GraficoBarras
                      titulo="Reclamações registradas pelas distribuidoras por mil unidades consumidoras"
                      dados={linhasReclamacoesNacional(g)}
                      chaveCategoria="ano"
                      series={[
                        { id: "total", rotulo: "Todas as reclamações (1º nível)", cor: "var(--cor-energia)" },
                        { id: "interrupcao", rotulo: "Sobre interrupção (1º nível)", cor: "var(--serie-termica)" },
                      ]}
                      unidade="por mil UCs"
                      casas={1}
                      altura={280}
                    />
                    {recParcial && (
                      <p className="text-sm text-carvao-muted">
                        {recParcial.ano}: barra hachurada é ausência, não zero ({recParcial.motivo_ausencia}).
                      </p>
                    )}
                  </div>
                  <div className="space-y-3">
                    <GraficoBarras
                      titulo="Reclamações na Ouvidoria Setorial da ANEEL por 100 mil unidades consumidoras"
                      dados={linhasOuvidoriaNacional(g)}
                      chaveCategoria="ano"
                      series={[
                        { id: "total", rotulo: "Todas", cor: "var(--cor-energia)" },
                        { id: "procedentes", rotulo: "Procedentes", cor: "var(--serie-sm-se)" },
                      ]}
                      unidade="por 100 mil UCs"
                      casas={1}
                      altura={280}
                    />
                    {ouvParcial.length > 0 && (
                      <p className="text-sm text-carvao-muted">
                        {ouvParcial
                          .map((o) =>
                            o.motivo_ausencia
                              ? `${o.ano}: barra hachurada é ausência, não zero (${o.motivo_ausencia})`
                              : `${o.ano}: barra hachurada é ausência, não zero (${
                                  o.meses_max !== null ? `até ${o.meses_max} ${o.meses_max === 1 ? "mês publicado" : "meses publicados"} no arquivo do ano` : "ano incompleto no arquivo"
                                }: sem taxa anual; a contagem parcial está na tabela de indicadores nacionais)`,
                          )
                          .join("; ")}
                        .
                      </p>
                    )}
                  </div>
                </QualidadePar>

                <QualidadeRecorte
                  periodo={
                    <>
                      Reclamações de {at.reclamacoes_distribuidora[0]?.ano ?? ref} a {ref}
                      {recParcial ? ` (${recParcial.ano} sem taxa: ano parcial)` : ""}; IASC de {at.iasc.ano ?? "ano não publicado"}; telefônico desde {at.telefonico.anual[0]?.ano ?? ref}
                    </>
                  }
                  universo={
                    <>
                      {rec ? `${rec.distribuidoras} distribuidoras com os 12 meses enviados (${pctCobertura(rec.cobertura_ucs)} das UCs)` : "sem universo no ano"}; IASC com{" "}
                      {num(at.iasc.entrevistas, 0)} entrevistas
                    </>
                  }
                  unidade="reclamações por mil UCs (distribuidora) e por 100 mil UCs (Ouvidoria); índice de 0 a 100; minutos; % dos meses no padrão"
                />

                <NotasDoPainel
                  oQueMudou={mudancaP054(g)}
                  comoInterpretar={
                    <>
                      Cada indicador tem o seu escopo e a sua base, e eles não se somam: reclamações na distribuidora por mil UCs, na Ouvidoria da ANEEL por 100 mil, o IASC é uma pesquisa por
                      amostra e o TMAE uma média de tempos ponderada pelas ocorrências. Taxa só existe em ano com os 12 meses enviados.
                    </>
                  }
                  naoConcluir={naoConcluirP054}
                />

                <QualidadePar>
                  <SecaoDoPainel
                    id="satisfacao-iasc"
                    titulo={`O que dizem os consumidores entrevistados? Satisfação em ${at.iasc.ano ?? "ano não publicado"}`}
                    lead={`Pesquisa anual por amostra, o Índice ANEEL de Satisfação do Consumidor (IASC): ${num(at.iasc.entrevistas, 0)} entrevistas em ${at.iasc.distribuidoras} distribuidoras (a amostra de cada uma está na tabela de atendimento). Resultado estimado; a ANEEL não publica margem de erro por distribuidora.`}
                  >
                    <Histograma
                      titulo={`Distribuidoras por IASC, ${at.iasc.ano ?? ""}`}
                      dados={histIasc}
                      rotuloX="IASC (escala de 0 a 100)"
                      unidade="pontos"
                      casas={1}
                      contagem={{ singular: "distribuidora", plural: "distribuidoras" }}
                      periodo={String(at.iasc.ano ?? "")}
                      cor="var(--cor-energia)"
                      nota="Índice estimado por pesquisa amostral; cada distribuidora tem a sua amostra."
                    />
                  </SecaoDoPainel>
                  <SecaoDoPainel
                    id="recuperacao-da-rede"
                    titulo="Como a rede se recupera: emergências e dias críticos"
                    lead={`Parcelas do DEC nacional em situação de emergência e em dia crítico (as horas que a regra tira do apurado). ${evt.total} eventos em situação de emergência foram declarados por ${evt.distribuidoras} distribuidoras de ${evt.inicio_min ? dataBR(evt.inicio_min.slice(0, 10)) : "data não publicada"} a ${evt.inicio_max ? dataBR(evt.inicio_max.slice(0, 10)) : "data não publicada"}; duração mediana de ${num(evt.duracao_mediana_h, 0)} h e máxima de ${num(evt.duracao_max_h, 0)} h, entre os eventos com datas válidas.`}
                  >
                    <GraficoBarras
                      titulo="DEC do Brasil em situação de emergência e em dia crítico"
                      dados={linhasResiliencia(g)}
                      chaveCategoria="ano"
                      series={[
                        { id: "emergencia", rotulo: "Situação de emergência", cor: COR_PARCELA.emergencia },
                        { id: "dia_critico", rotulo: "Dia crítico", cor: COR_PARCELA.dia_critico },
                      ]}
                      unidade="h"
                      casas={2}
                      empilhado
                      altura={280}
                    />
                    <QualidadeTabela tabela="eventos" titulo="Eventos em situação de emergência com maior CHI" linhas={n("eventos")} chaveUrl="tevt" />
                    {evt.datas_invalidas.length > 0 && (
                      <p className="text-sm text-carvao-muted">
                        Datas mantidas como publicadas, sem duração: {evt.datas_invalidas.map((d) => datasLegiveis(`${d.sigla ?? "distribuidora não identificada"}, evento ${d.codigo} (${d.motivo})`)).join("; ")}.
                      </p>
                    )}
                  </SecaoDoPainel>
                </QualidadePar>

                <SecaoDoPainel id="indicadores-e-escopos" nivel="analisar" titulo="Indicadores de atendimento, cada um com o seu escopo">
                  <QualidadeTabela tabela="escopos" titulo="Indicadores nacionais de atendimento por ano" linhas={n("escopos")} chaveUrl="tesc" />
                </SecaoDoPainel>

                <SecaoDoPainel id="atendimento-telefonico" nivel="analisar" titulo="Atendimento telefônico das distribuidoras obrigadas">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    Só as distribuidoras com central obrigatória ({tel ? `${tel.distribuidoras} em ${ref}, ${pctCobertura(tel.cobertura_ucs)} das UCs` : "universo do ano não publicado"}).
                    Padrões: INS de ao menos {num(at.telefonico.padroes.ins_min_pct, 0)}%, IAb de até {num(at.telefonico.padroes.iab_max_pct, 0)}% e ICO de até{" "}
                    {num(at.telefonico.padroes.ico_max_pct, 0)}%. INS e IAb não se agregam (a fonte não publica os numeradores): o gráfico conta os meses dentro do padrão.
                  </p>
                  <GraficoLinhas
                    titulo="Distribuidora-meses dentro do padrão, por indicador"
                    dados={linhasTelefonico(g)}
                    chaveX="ano"
                    formatoX="texto"
                    series={[
                      { id: "ins", rotulo: "INS (nível de serviço)", sigla: "INS", cor: "var(--cor-energia)" },
                      { id: "iab", rotulo: "IAb (abandono)", sigla: "IAb", cor: "var(--serie-termica)" },
                      { id: "ico", rotulo: "ICO (chamadas ocupadas)", sigla: "ICO", cor: "var(--serie-sm-se)" },
                    ]}
                    unidade="%"
                    casas={1}
                    legendaInterativa
                    marcos={at.telefonico.anual.filter((t) => !t.completo).map((t) => ({ x: String(t.ano), rotulo: `${t.ano}: ${t.meses} meses` }))}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="atendimento-por-distribuidora" nivel="analisar" titulo={`Atendimento por distribuidora, ${ref}`}>
                  <QualidadeTabela tabela="atendimento" titulo={`Reclamações, IASC, TMAE e atendimento telefônico por distribuidora, ${ref}`} linhas={n("atendimento")} chaveUrl="tat" />
                </SecaoDoPainel>

                <SecaoDoPainel id="fora-de-cada-universo" nivel="auditar" titulo="Quem ficou fora de cada universo">
                  <ul className="space-y-2 text-sm text-carvao-muted">
                    {at.reclamacoes_distribuidora
                      .filter((r) => r.fora_meses_incompletos.length)
                      .map((r) => (
                        <li key={r.ano}>
                          <strong className="font-medium text-carvao">Reclamações {r.ano}:</strong> fora por não terem os 12 meses enviados:{" "}
                          {r.fora_meses_incompletos.map((x) => `${x.sigla ?? `CNPJ ${x.cnpj}`} (${x.meses} meses)`).join(", ")}.
                        </li>
                      ))}
                    {at.iasc.sem_continuidade_no_ano.length > 0 && (
                      <li>
                        <strong className="font-medium text-carvao">IASC sem continuidade no ano:</strong>{" "}
                        {at.iasc.sem_continuidade_no_ano.map((x) => `${x.sigla ?? x.nome_iasc ?? `CNPJ ${x.cnpj}`} (IASC ${num(x.iasc, 2)}, ${num(x.amostra, 0)} entrevistas)`).join(", ")}.
                      </li>
                    )}
                    <li>
                      <strong className="font-medium text-carvao">Anos do IASC publicados:</strong> {at.iasc.anos_disponiveis.join(", ")}.
                    </li>
                  </ul>
                </SecaoDoPainel>

                <SeguirPainel
                  ancora={p054.ancora}
                  downloads={downloadsDoPainel(g, "p054")}
                  proximo={{ href: "/setor-eletrico/conta-de-luz", pergunta: "Quanto essas distribuidoras cobram? Veja a conta de luz." }}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- Auditoria do módulo ---------------- */}
          <Bloco id="auditoria-qualidade" nivel="auditar">
            <section aria-labelledby="auditoria-qualidade-titulo" className="space-y-4 border-t border-dashed border-linha pt-6">
              <h2 id="auditoria-qualidade-titulo" className="ed-h2 font-serif text-carvao">
                Controles executados nesta publicação e arquivos de origem
              </h2>
              <p className="max-w-prose2 text-sm text-carvao-muted">
                Cada controle roda antes de qualquer arquivo ser escrito; reprovação crítica impede a publicação e mantém a anterior. Ressalva não descarta dado: o valor fica como a fonte
                publicou e o caso fica listado.
              </p>
              <QualidadeTabela tabela="validacao" titulo="Controles de validação" linhas={n("validacao")} chaveUrl="tval" />
              <QualidadeTabela tabela="arquivos" titulo="Arquivos de origem importados, cada um com o sha256" linhas={n("arquivos")} chaveUrl="tarq" />
              {g.mapa.correspondencia.codigos_sem_ibge.length > 0 && (
                <p className="text-sm text-carvao-muted">
                  Códigos da base IndQual Município fora do cadastro do IBGE, fora do mapa:{" "}
                  {g.mapa.correspondencia.codigos_sem_ibge
                    .map((x) => `${x.codigo} (${x.conjuntos_ativos} conjuntos ativos${x.dec_min !== null ? `, DEC de ${num(x.dec_min, 2)} a ${num(x.dec_max, 2)} h` : ""})`)
                    .join("; ")}
                  . Municípios do IBGE sem relação na base:{" "}
                  {g.mapa.correspondencia.ibge_sem_relacao.map((x) => `${x.nome ?? x.codigo} (${x.uf ?? "UF não informada"})`).join(", ") || "nenhum"}.
                </p>
              )}
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {g.downloads.map((d) => (
                  <li key={d.url}>
                    <a href={d.url} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                      {d.rotulo} ({tamanho(d.url)})
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-carvao-muted">
                Reprodução: <code className="break-all text-xs">python3 pipeline/energia/executar_modulo.py qualidade --sem-coleta</code>. Regras gerais em{" "}
                <Link href="/setor-eletrico/metodologia" className="text-energia-dark underline underline-offset-4">
                  metodologia
                </Link>
                ; fórmulas, fontes verificadas e conferências deste módulo no documento{" "}
                <code className="break-all text-xs">docs/observatorios/energia/modulos/qualidade.md</code> do{" "}
                <a href="https://github.com/genarolins1975/scrutiniums/tree/main/docs/observatorios" target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                  repositório público do projeto ↗
                </a>
                .
              </p>
            </section>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
