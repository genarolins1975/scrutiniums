import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import {
  PARCELAS_DEFINICAO_EN,
  PARCELAS_ROTULOS_EN,
  REGRAS_QUALIDADE_EN,
  UNIVERSO_QUALIDADE_EN,
  marcarNomes,
  traducaoExata,
} from "@/lib/energia/i18n/qualidade-perdas";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Histograma } from "@/components/energia/Histograma";
import { Numero } from "@/components/energia/Numero";
import { QualidadeAviso, QualidadeCapitulos, QualidadeDatas, QualidadeIndisponivel, QualidadePar, QualidadeRecorte } from "@/components/energia/QualidadePagina";
import { QualidadeBuscaMunicipio } from "@/components/energia/QualidadeBuscaMunicipio";
import { QualidadeComparador } from "@/components/energia/QualidadeComparador";
import { QualidadeConjuntos } from "@/components/energia/QualidadeConjuntos";
import { QualidadeLimites } from "@/components/energia/QualidadeLimites";
import { QualidadeMapa } from "@/components/energia/QualidadeMapa";
import { QualidadeTabela } from "@/components/energia/QualidadeTabela";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { montaHistograma } from "@/lib/energia/distribuicao";
import { carimbo, dataBR, mesAno, num, pct } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  LIMITE_FEC_PARCIAL_CENTESIMOS,
  COR_PARCELA,
  ORDEM_PARCELAS,
  anoBrasil,
  arquivoConjuntosDoAno,
  avisoDefasagem,
  avisosFec as montaAvisosFec,
  conjuntosDoCsv,
  definicaoConjunto,
  definicaoConjuntoCurta,
  definicaoLimitesIndividuais,
  downloadsDoPainel,
  fonteContinuidade,
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
  notaQuantidadeDivulgada,
  notaTiposSemUc,
  paraLeitor,
  painelQualidade,
  pctCobertura,
  quebraCompensacao,
  recorteColunas,
  regimesCompensacao,
  resumoSemRazaoFec,
  respostaP051,
  respostaP052,
  respostaP053,
  respostaP054,
  respostaParcial,
  classificacaoNoIdioma,
  motivoAusenciaNoIdioma,
  rotuloDistribuidora,
  rotulosParcelaCurto,
  rotulosTipoNoIdioma,
  tabelaQualidade,
  taxaNaBaseDaOuvidoria,
  textoAtualidade,
  textoConcessionariasDesde,
  textoContagemFec,
  textoDivergenciasDgc,
  textoDivulgadoAno,
  textoFecBrasilConfere,
  textoParcelasAno,
  textoParticipacaoUg,
  textoQuebraApurado,
  textoQuebraCompensacao,
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
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/qualidade", {
    title: tx(
      "Qualidade do serviço de distribuição: interrupções, limites, compensações e atendimento",
      "Quality of distribution service: interruptions, limits, compensation payments and customer service",
    ),
    description: tx(
      "DEC e FEC por conjunto, distribuidora e Brasil (ANEEL), realizado diante dos limites regulatórios, compensações pagas por violação de limites individuais, reclamações por unidade consumidora, IASC com amostra, atendimento emergencial e eventos de emergência.",
      "DEC and FEC by consumer cluster, distribution utility and Brazil (ANEEL), actual values against the regulatory limits, compensation payments for violation of individual limits, complaints per consumer unit, IASC with its sample, emergency response and emergency events.",
    ),
    alternates: { canonical: "/setor-eletrico/qualidade" },
  }, anterior);
}

const URL_SERIE = "/energia/series/qualidade_distribuidoras_serie.json";
const URL_MUNICIPIOS = "/energia/series/qualidade_municipios.csv";

/** Tamanho de um arquivo publicado, lido no build (nunca escrito à mão). */
function tamanho(url: string): string {
  try {
    const b = statSync(join(process.cwd(), "public", url)).size;
    return b >= 1e6 ? `${num(b / 1e6, 1)} MB` : `${num(b / 1e3, 0)} KB`;
  } catch {
    return tx("tamanho não disponível", "size not available");
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
  const idioma = idiomaEnergia();
  // texto da gold para o leitor: em português, sem nome de campo nem termo interno; em inglês, pela tabela exata ou marcado como só em português
  const daGold = (x: string, tabela: Readonly<Record<string, string>>, regiao: string): ReactNode =>
    idioma === "en" ? (traducaoExata(x, tabela) ?? <TrechoPortugues regiao={regiao}>{paraLeitor(x)}</TrechoPortugues>) : paraLeitor(x);
  // regras e universos da gold escritos para o leitor (sem nome de campo nem termo interno)
  const regras = Object.fromEntries(Object.entries(g.regras).map(([k, x]) => [k, daGold(x, REGRAS_QUALIDADE_EN, `regra-${k}`)])) as Record<keyof QualidadeGold["regras"], ReactNode>;
  const universo = {
    principal: daGold(g.brasil.universo.principal, UNIVERSO_QUALIDADE_EN, "universo-principal"),
    concessionarias: daGold(g.brasil.universo.concessionarias, UNIVERSO_QUALIDADE_EN, "universo-concessionarias"),
  };
  const avisoAnoCorrente = g.parcial ? daGold(g.parcial.aviso, {}, "aviso-ano-corrente") : "";
  const ROTULO_PARCELA_CURTO = rotulosParcelaCurto();
  const m = metricasAbertura(g);
  const mc = metricasCompensacao(g);
  const anual = linhasBrasilAnual(g);
  const anualDec = recorteColunas(anual, ["ano", "dec", "dec_concessionarias", "dec_limite"]); // i18n: dado
  const anualFec = recorteColunas(anual, ["ano", "fec", "fec_concessionarias", "fec_limite"]); // i18n: dado
  const primeiroAno = anual[0]?.ano ?? String(ref);
  const mensal = linhasBrasilMensal(g);
  const mensalDec = recorteColunas(mensal, ["m", "dec"]);
  const mensalFec = recorteColunas(mensal, ["m", "fec"]);
  const histConjuntos = linhasHistoricoConjuntos(g.conjuntos);
  const histUcs = recorteColunas(histConjuntos, ["ano", "pct_ucs_acima", "pct_acima"]); // i18n: dado
  const histRazoes = recorteColunas(histConjuntos, ["ano", "razao_p50", "razao_p90"]); // i18n: dado
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
    .map((d) => ({
      id: d.cnpj,
      rotulo: rotuloDistribuidora(d),
      detalhe: [d.nome_comercial, d.classificacao ? classificacaoNoIdioma(d.classificacao) : null].filter(Boolean).join(", ") || undefined,
      sinonimos: [d.cnpj],
    }))
    .sort((x, y) => x.rotulo.localeCompare(y.rotulo, "pt-BR"));
  const maiores = maioresDistribuidoras(g);
  const histRazao = histogramaDeFaixas(c.histograma_razao_dec, c.quantis_razao_dec);
  const anoComp = comp.anual.find((x) => x.ano === comp.ano_referencia) ?? null;
  const compAnual = linhasCompensacaoAnual(g);
  const compBarras = compAnual.filter((l) => l.valor_uc_mi !== null);
  const compMensal = linhasCompensacaoMensal(g);
  // quebra de regime das compensações (a fonte deixa de publicar os tipos trimestral e anual a UCs): o gráfico anual usa duas séries, uma por regime
  const quebraComp = quebraCompensacao(g);
  const regimes = regimesCompensacao(g);
  const avisoQuebraComp = textoQuebraCompensacao(g);
  const dadosCompAnual = compBarras.map((l) =>
    quebraComp ? { ano: l.ano, antes: Number(l.ano) < quebraComp.ano ? l.valor_uc_mi : null, depois: Number(l.ano) >= quebraComp.ano ? l.valor_uc_mi : null } : { ano: l.ano, valor_uc_mi: l.valor_uc_mi },
  );
  const compIncompletos = comp.mensal.filter((x) => !x.completo);
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
  const periodoMensal = g.brasil.mensal.length
    ? tx(`${mesAno(g.brasil.mensal[0].m)} a ${mesAno(g.brasil.mensal.at(-1)!.m)}`, `${mesAno(g.brasil.mensal[0].m)} to ${mesAno(g.brasil.mensal.at(-1)!.m)}`)
    : tx("sem meses publicados", "no months published");
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
  const rotulosTipo = rotulosTipoNoIdioma(comp.rotulos_tipo);
  const tipoDefinicoes = (["dicri", "dise"] as const).map((t) => rotulosTipo[t]);
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
      {regras.agregacao}
      {tx(
        " A linha tracejada é o limite agregado do mesmo ano (limites dos conjuntos ponderados pelas UCs), não um limite oficial nacional.",
        " The dashed line is the aggregate limit of the same year (limits of the consumer clusters weighted by the UCs), not an official national limit.",
      )}{" "}
      {textoConcessionariasDesde(g, inicioConcessionarias)}
    </>
  );
  const naoConcluirP051 = (
    <>
      {tx(
        "DEC e FEC são médias por UC: não dizem quanto tempo cada pessoa ficou sem energia, e parte das unidades fica muito acima da média do conjunto. O apurado exclui o que a regra expurga; comparar anos sem olhar as parcelas pode esconder eventos extremos.",
        "DEC and FEC are averages per UC: they do not say how long each person was without power, and some units are far above the average of the consumer cluster. The assessed value excludes what the rule removes; comparing years without looking at the components can hide extreme events.",
      )}
      {inicioParcelas ? tx(` Antes de ${inicioParcelas} a fonte usa outra desagregação.`, ` Before ${inicioParcelas} the source uses another breakdown.`) : ""}
    </>
  );
  const comoInterpretarP052 = (
    <>
      {tx(
        "No gráfico de pontos, o círculo é o apurado e o losango o limite agregado da distribuidora (limites dos conjuntos ponderados pelas UCs médias do ano); a diferença está escrita.",
        "In the dot chart, the circle is the assessed value and the diamond the distribution utility's aggregate limit (limits of the consumer clusters weighted by the average UCs of the year); the difference is stated.",
      )}{" "}
      {regras.limite_centesimos}
      {tx(" No histograma, à direita de 1 está o que passou do limite.", " In the histogram, what exceeded the limit is to the right of 1.")}
    </>
  );
  const naoConcluirP052 = (
    <>
      {tx(
        "Abaixo do limite agregado não quer dizer que todos os conjuntos da distribuidora ficaram abaixo, nem que nenhum consumidor teve o limite individual violado. Limites diferem entre conjuntos e anos: uma razão menor não compara áreas com limites diferentes. A razão do Brasil não é um limite oficial nacional.",
        "Below the aggregate limit does not mean that all of the distribution utility's consumer clusters were below it, nor that no consumer had an individual limit violated. Limits differ between consumer clusters and years: a lower ratio does not compare areas with different limits. Brazil's ratio is not an official national limit.",
      )}
    </>
  );
  const comoInterpretarP053 = (
    <>
      {regras.compensacao}
      {tx(
        " As barras somam o que as distribuidoras informaram por competência (o mês de apuração), só para unidades consumidoras, o universo que a ANEEL divulga; unidades geradoras ficam na tabela. Valor por UC é só normalização para comparar distribuidoras de tamanhos diferentes: soma as compensações de unidades consumidoras e geradoras e divide pelas UCs médias, por isso difere do total só de unidades consumidoras. ",
        " The bars add up what the distribution utilities reported by accrual month (the month of assessment), only for consumer units, the universe ANEEL announces; generating units stay in the table. Amount per UC is only a normalization to compare distribution utilities of different sizes: it adds the compensation payments of consumer and generating units and divides by the average UCs, so it differs from the consumer-units-only total. ",
      )}
      {textoParticipacaoUg(g)} {divulgado}
    </>
  );
  const naoConcluirP053 = (
    <>
      {tx(
        "Não se calcula o crédito de um consumidor: ele depende do DIC, FIC e DMIC da própria unidade e do encargo de uso, que não são publicados. A quantidade é de compensações (ocorrências), não de consumidores. A fonte informa a competência, não a data do crédito na fatura. Valores sem correção pela inflação.",
        "A consumer's credit is not calculated: it depends on the unit's own DIC, FIC and DMIC and on the use-of-system charge, which are not published. The quantity counts compensation payments (occurrences), not consumers. The source reports the accrual month, not the date of the credit on the bill. Values not adjusted for inflation.",
      )}
    </>
  );
  const naoConcluirP054 = (
    <>
      {tx(
        <>
          Reclamações sem a base de UCs não comparam distribuidoras, e dependem dos canais e do registro de cada uma. A ligação sobre falta de energia conta como reclamação
          {rec && rec.por_ucs !== null && rec.interrupcao_por_mil_uc !== null ? ` (${num(rec.interrupcao_por_mil_uc, 1)} das ${num(rec.por_ucs, 1)} por mil UCs em ${ref})` : ""}: a taxa não
          mede só insatisfação com o atendimento. O IASC é amostral e sai sem margem de erro. Os eventos de emergência só existem desde{" "}
          {evt.inicio_min ? mesAno(evt.inicio_min.slice(0, 7)) : "data não publicada"}.
        </>,
        <>
          Complaints without the UC base do not compare distribution utilities, and they depend on each one&apos;s channels and recording. A call about a power outage counts as a complaint
          {rec && rec.por_ucs !== null && rec.interrupcao_por_mil_uc !== null ? ` (${num(rec.interrupcao_por_mil_uc, 1)} of the ${num(rec.por_ucs, 1)} per thousand UCs in ${ref})` : ""}: the rate
          does not measure only dissatisfaction with the service. The IASC is sample-based and has no margin of error. Emergency events only exist since{" "}
          {evt.inicio_min ? mesAno(evt.inicio_min.slice(0, 7)) : "date not published"}.
        </>,
      )}
    </>
  );
  const comoInterpretarP054 = (
    <>
      {tx(
        "Cada indicador tem escopo e base próprios e eles não se somam: reclamações por mil UCs na distribuidora e por 100 mil na Ouvidoria da ANEEL; o IASC é uma pesquisa por amostra; o TMAE (tempo médio de atendimento emergencial) é uma média de tempos ponderada pelas ocorrências. Taxa só existe em ano com os 12 meses enviados.",
        "Each indicator has its own scope and base and they do not add up: complaints per thousand UCs at the distribution utility and per 100 thousand at the ANEEL Ombudsman; the IASC is a sample survey; the TMAE (average emergency response time) is an average of times weighted by occurrences. A rate only exists in a year with the 12 months sent.",
      )}
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="qualidade" />
      <MarcaVisita secao="energia:qualidade" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["DEC", "FEC", "UC", "DIC", "FIC", "ANEEL", "IBGE", "ONS"]}
          titulo={tx("Quanto tempo e quantas vezes falta luz?", "How long and how often is the power cut?")}
          lead={tx(
            "DEC mede a duração média das interrupções; FEC, a frequência média por unidade consumidora (UC). Compare cada distribuidora com o próprio limite e explore, separadamente, as compensações e o atendimento.",
            "DEC (equivalent interruption duration per consumer unit) measures the average duration of interruptions; FEC (equivalent interruption frequency per consumer unit), the average frequency per consumer unit (UC). Compare each distribution utility with its own limit and explore, separately, compensation payments and customer service.",
          )}
          recorte={tx(`${ref} · Brasil, ${distComDec} distribuidoras · horas e interrupções por UC`, `${ref} · Brazil, ${distComDec} distribution utilities · hours and interruptions per UC`)}
          fonte={tx("ANEEL, indicadores coletivos de continuidade", "ANEEL, collective continuity indicators")}
          limite={tx("o que cada consumidor viveu: DEC e FEC são médias por UC, e há UCs bem acima delas.", "what each consumer experienced: DEC and FEC are averages per UC, and some UCs are well above them.")}
          referencia={tx(
            <>
              {textoAtualidade(g)} Indicadores publicados pela ANEEL em {dataBR(prov.conjuntos.publicado_pela_fonte_em?.slice(0, 10) ?? null)}; processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              {textoAtualidade(g)} Indicators published by ANEEL on {dataBR(prov.conjuntos.publicado_pela_fonte_em?.slice(0, 10) ?? null)}; processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <QualidadeDatas
              itens={[
                {
                  rotulo: "DEC e FEC",
                  texto: tx(
                    `ano completo ${ref}; último mês nacional completo ${mesAno(g.ultimo_mes_completo)}`,
                    `complete year ${ref}; latest complete national month ${mesAno(g.ultimo_mes_completo)}`,
                  ),
                  natureza: "CALCULADO",
                },
                { rotulo: tx("Limites e ranking", "Limits and ranking"), texto: tx(`ano de apuração ${c.ano}`, `assessment year ${c.ano}`), natureza: "CALCULADO" },
                {
                  rotulo: tx("Compensações", "Compensation payments"),
                  texto: tx(
                    `ano completo ${comp.ano_referencia}; último mês completo ${comp.ultimo_mes_completo ? mesAno(comp.ultimo_mes_completo) : "não informado"}`,
                    `complete year ${comp.ano_referencia}; latest complete month ${comp.ultimo_mes_completo ? mesAno(comp.ultimo_mes_completo) : "not reported"}`,
                  ),
                  natureza: "CALCULADO",
                },
                {
                  rotulo: tx("Reclamações", "Complaints"),
                  texto: tx(
                    `de ${at.reclamacoes_distribuidora[0]?.ano ?? ref} a ${ref}${recParcial ? ` (${recParcial.ano} parcial)` : ""}`,
                    `from ${at.reclamacoes_distribuidora[0]?.ano ?? ref} to ${ref}${recParcial ? ` (${recParcial.ano} partial)` : ""}`,
                  ),
                  natureza: "CALCULADO",
                },
                { rotulo: tx("Satisfação (IASC)", "Satisfaction (IASC)"), texto: tx(`pesquisa de ${at.iasc.ano ?? "ano não publicado"}`, `${at.iasc.ano ?? "year not published"} survey`), natureza: "ESTIMADO" },
                {
                  rotulo: tx("Eventos de emergência", "Emergency events"),
                  texto:
                    evt.inicio_min && evt.inicio_max
                      ? tx(`de ${dataBR(evt.inicio_min.slice(0, 10))} a ${dataBR(evt.inicio_max.slice(0, 10))}`, `from ${dataBR(evt.inicio_min.slice(0, 10))} to ${dataBR(evt.inicio_max.slice(0, 10))}`)
                      : tx("datas não publicadas", "dates not published"),
                  natureza: "CALCULADO",
                },
              ]}
            />
          }
          metricas={
            <>
              {defasagem && <QualidadeAviso>{defasagem}</QualidadeAviso>}
              <div className="mt-4">
                <QualidadeBuscaMunicipio ano={g.mapa.ano} urlMunicipios={URL_MUNICIPIOS} />
              </div>
              <FaixaMetricas colunas={4} rotulo={tx("Indicadores de continuidade no Brasil", "Continuity indicators in Brazil")}>
                <Numero
                  variante="faixa"
                  rotulo={tx("Duração média (DEC)", "Average duration (DEC)")}
                  natureza="CALCULADO"
                  valor={m.dec}
                  formato="num"
                  casas={2}
                  unidade={tx("h por UC", "h per UC")}
                  periodo={String(m.ano)}
                  evidencia={ev.dec_brasil ?? null}
                  motivoAusencia={tx("Ano sem os 12 meses nacionais completos.", "Year without the 12 complete national months.")}
                  nota={
                    m.dec !== null ? (
                      <>
                        {tx(<>Cerca de {m.decHorasMinutos} por UC.</>, <>About {m.decHorasMinutos} per UC.</>)}
                        {m.decAnterior !== null && tx(` Em ${m.anoAnterior}: ${num(m.decAnterior, 2)} h.`, ` In ${m.anoAnterior}: ${num(m.decAnterior, 2)} h.`)}
                        {notaPerimetroAbertura(g, "dec") && ` ${notaPerimetroAbertura(g, "dec")}`}
                      </>
                    ) : undefined
                  }
                  cor="var(--cor-energia)"
                  endereco={`/setor-eletrico/qualidade#${p051.ancora}`}
                />
                <Numero
                  variante="faixa"
                  rotulo={tx("Frequência média (FEC)", "Average frequency (FEC)")}
                  natureza="CALCULADO"
                  valor={m.fec}
                  formato="num"
                  casas={2}
                  unidade={tx("interrupções por UC", "interruptions per UC")}
                  periodo={String(m.ano)}
                  evidencia={ev.fec_brasil ?? null}
                  motivoAusencia={tx("Ano sem os 12 meses nacionais completos.", "Year without the 12 complete national months.")}
                  nota={
                    m.fec !== null ? (
                      <>
                        {tx("Interrupções de 3 min ou mais.", "Interruptions of 3 min or more.")}
                        {m.fecAnterior !== null && tx(` Em ${m.anoAnterior}: ${num(m.fecAnterior, 2)}.`, ` In ${m.anoAnterior}: ${num(m.fecAnterior, 2)}.`)}
                        {notaPerimetroAbertura(g, "fec") && ` ${notaPerimetroAbertura(g, "fec")}`}
                      </>
                    ) : undefined
                  }
                  cor="var(--cor-energia)"
                  endereco={`/setor-eletrico/qualidade#${p051.ancora}`}
                />
                <Numero
                  variante="faixa"
                  rotulo={tx("Conjuntos acima do limite de DEC", "Consumer clusters above the DEC limit")}
                  natureza="CALCULADO"
                  valor={m.conjuntos.pct}
                  formato="pct"
                  casas={1}
                  // a unidade da evidência começa com "%", que o formato já escreve colado ao número
                  unidade={tx("dos conjuntos", "of the consumer clusters")}
                  periodo={String(m.conjuntos.ano)}
                  evidencia={ev.conjuntos_acima_limite ?? null}
                  nota={
                    <>
                      {tx(
                        <>
                          {num(m.conjuntos.acima, 0)} de {num(m.conjuntos.comLimite, 0)} conjuntos. {definicaoConjuntoCurta()}
                        </>,
                        <>
                          {num(m.conjuntos.acima, 0)} of {num(m.conjuntos.comLimite, 0)} consumer clusters. {definicaoConjuntoCurta()}
                        </>,
                      )}
                      {m.conjuntos.pctAnterior !== null && tx(` Em ${m.conjuntos.anoAnterior}: ${pct(m.conjuntos.pctAnterior, 1)}.`, ` In ${m.conjuntos.anoAnterior}: ${pct(m.conjuntos.pctAnterior, 1)}.`)}
                    </>
                  }
                  cor="var(--serie-referencia)"
                  endereco={`/setor-eletrico/qualidade#${p052.ancora}`}
                />
                <Numero
                  variante="faixa"
                  rotulo={tx("DEC de todas as origens", "DEC from all origins")}
                  natureza="CALCULADO"
                  valor={m.decTodasOrigens}
                  formato="num"
                  casas={2}
                  unidade={tx("h por UC", "h per UC")}
                  periodo={String(m.ano)}
                  motivoAusencia={tx("Parcelas não publicadas para o ano.", "Components not published for the year.")}
                  nota={
                    m.decTodasOrigens !== null
                      ? tx(
                          <>
                            Cerca de {m.decTodasOrigensHorasMinutos}. Inclui o que a regra deixa fora do limite: emergências, dias críticos, origem externa e cortes do operador do sistema (ONS).
                          </>,
                          <>
                            About {m.decTodasOrigensHorasMinutos}. It includes what the rule excludes from the limit: emergencies, critical days, external origin and cuts by the system operator (ONS).
                          </>,
                        )
                      : undefined
                  }
                />
              </FaixaMetricas>
            </>
          }
        >
          {tx(
            <>
              A ANEEL mede a continuidade do fornecimento por <Termo slug="conjunto-eletrico">conjunto elétrico</Termo>: o <Termo slug="dec">DEC</Termo> diz quantas horas, em média, cada
              unidade consumidora ficou sem energia, e o <Termo slug="fec">FEC</Termo> quantas vezes. Esta página mostra esses números para o Brasil, as distribuidoras e os conjuntos,
              compara cada um com o limite regulatório do mesmo ano, mostra as <Termo slug="compensacao-continuidade">compensações</Termo> pagas a quem teve limite individual violado e
              como o consumidor é atendido.
            </>,
            <>
              ANEEL measures the continuity of supply by <Termo slug="conjunto-eletrico">consumer cluster</Termo>: the <Termo slug="dec">DEC</Termo> says how many hours, on
              average, each consumer unit was without power, and the <Termo slug="fec">FEC</Termo> how many times. This page shows these numbers for Brazil, the distribution utilities and
              the consumer clusters, compares each one with the regulatory limit of the same year, and shows the <Termo slug="compensacao-continuidade">compensation payments</Termo> made to those
              whose individual limit was violated and how consumers are served.
            </>,
          )}
        </CabecalhoModulo>

        <ModoProfundidade>
          {/* ---------------- P051 ---------------- */}
          <Bloco id={p051.ancora}>
            <PainelEvidencia
              id={p051.id}
              pergunta={p051.titulo}
              subtitulo={tx(
                "DEC e FEC apurados, o que a regra conta para o limite, no Brasil, nas distribuidoras e nos conjuntos · horas e interrupções por UC",
                "Assessed DEC and FEC, what the rule counts toward the limit, in Brazil, at the distribution utilities and in the consumer clusters · hours and interruptions per UC",
              )}
              natureza="CALCULADO"
              porQueImporta={
                <>
                  {tx(
                    "DEC e FEC são os indicadores com que a ANEEL acompanha a continuidade do fornecimento: limites, ranking e compensações partem deles. A média nacional é ponderada pelas unidades consumidoras de cada conjunto em cada mês, então distribuidoras grandes pesam mais.",
                    "DEC and FEC are the indicators ANEEL uses to monitor the continuity of supply: limits, ranking and compensation payments start from them. The national average is weighted by the consumer units of each consumer cluster in each month, so large distribution utilities weigh more.",
                  )}
                </>
              }
              oQueMudou={oQueMudouP051}
              comoInterpretar={comoInterpretarP051}
              naoConcluir={naoConcluirP051}
              naoConcluirNoCorpo
              proveniencia={prov.distribuidoras}
              complementares={[
                { rotulo: tx("Conjuntos (valores da ANEEL)", "Consumer clusters (ANEEL values)"), p: prov.conjuntos },
                { rotulo: tx("Mapa por município", "Map by municipality"), p: prov.mapa },
              ]}
            >
              <div className="space-y-6">
                <CursorSincronizado>
                  <QualidadePar>
                    <GraficoLinhas
                      titulo={tx(`DEC apurado do Brasil e limite agregado, ${primeiroAno} a ${ref}`, `Assessed DEC of Brazil and aggregate limit, ${primeiroAno} to ${ref}`)}
                      dados={anualDec}
                      chaveX="ano" // i18n: dado
                      formatoX="texto"
                      series={[
                        { id: "dec", rotulo: tx("Todas as distribuidoras", "All distribution utilities"), sigla: "DEC", cor: "var(--cor-energia)" }, // i18n: dado
                        { id: "dec_concessionarias", rotulo: tx("Só concessionárias", "Concession holders only"), sigla: tx("Concess.", "Conc."), cor: "var(--serie-sm-se)" },
                        { id: "dec_limite", rotulo: tx("Limite agregado do ano", "Aggregate limit of the year"), sigla: tx("Limite", "Limit"), cor: "var(--serie-referencia)", tracejada: true },
                      ]}
                      unidade="h"
                      casas={2}
                      zeroNoEixo
                      marcos={marcos}
                    />
                    <GraficoLinhas
                      titulo={tx(`FEC apurado do Brasil e limite agregado, ${primeiroAno} a ${ref}`, `Assessed FEC of Brazil and aggregate limit, ${primeiroAno} to ${ref}`)}
                      dados={anualFec}
                      chaveX="ano" // i18n: dado
                      formatoX="texto"
                      series={[
                        { id: "fec", rotulo: tx("Todas as distribuidoras", "All distribution utilities"), sigla: "FEC", cor: "var(--cor-energia)" }, // i18n: dado
                        { id: "fec_concessionarias", rotulo: tx("Só concessionárias", "Concession holders only"), sigla: tx("Concess.", "Conc."), cor: "var(--serie-sm-se)" },
                        { id: "fec_limite", rotulo: tx("Limite agregado do ano", "Aggregate limit of the year"), sigla: tx("Limite", "Limit"), cor: "var(--serie-referencia)", tracejada: true },
                      ]}
                      unidade={tx("interrupções", "interruptions")}
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
                      {tx(
                        <>
                          Anual de {primeiroAno} a {ref}, só anos com 12 meses nacionais completos; mensal de {periodoMensal}.{" "}
                        </>,
                        <>
                          Annual from {primeiroAno} to {ref}, only years with 12 complete national months; monthly from {periodoMensal}.{" "}
                        </>,
                      )}
                      {regras.mes_completo}
                    </>
                  }
                  universo={
                    <>
                      {textoUniversoBrasil(g)}
                      {tx(<> Mapa: conjuntos com DEC em {g.mapa.ano}.</>, <> Map: consumer clusters with DEC in {g.mapa.ano}.</>)}
                    </>
                  }
                  unidade={
                    <>
                      {regras.centesimos}
                      {exemploDec !== null && tx(` Assim, as ${num(exemploDec, 2)} h do Brasil em ${ref} são ${horasEMinutos(exemploDec)}.`, ` So Brazil's ${num(exemploDec, 2)} h in ${ref} are ${horasEMinutos(exemploDec)}.`)}
                      {tx(" FEC em interrupções por UC: as de 3 minutos ou mais.", " FEC in interruptions per UC: those of 3 minutes or more.")}
                    </>
                  }
                />

                <NotasDoPainel oQueMudou={oQueMudouP051} comoInterpretar={comoInterpretarP051} naoConcluir={naoConcluirP051} />

                <QualidadeCapitulos atual={p051.ancora} />

                <SecaoDoPainel
                  id="expurgos"
                  titulo={tx("Quanto do tempo sem energia fica fora do apurado?", "How much of the time without power is excluded from the assessed value?")}
                  lead={tx(
                    <>
                      O DEC apurado, o que se compara ao limite, exclui interrupções em situação de emergência, em dia crítico, de origem externa ao sistema de distribuição e cortes
                      pedidos pelo Operador Nacional do Sistema (ONS). As barras empilham as parcelas publicadas{inicioParcelas ? ` desde ${inicioParcelas}` : ""}; a soma é o tempo sem
                      energia de todas as origens.
                    </>,
                    <>
                      The assessed DEC, the one compared with the limit, excludes interruptions in emergency situations, on critical days, of origin external to the distribution system and
                      cuts requested by the National System Operator (ONS). The bars stack the published components{inicioParcelas ? ` since ${inicioParcelas}` : ""}; the sum is the time
                      without power from all origins.
                    </>,
                  )}
                >
                  {parcelasAno && (
                    <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-texto="parcelas-do-ano">
                      {parcelasAno}
                    </p>
                  )}
                  <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] [&>*]:min-w-0">
                    <GraficoBarras
                      titulo={tx(`Parcelas do DEC do Brasil por origem, ${parcelas[0]?.ano ?? ""} a ${ref}`, `Components of Brazil's DEC by origin, ${parcelas[0]?.ano ?? ""} to ${ref}`)}
                      dados={parcelas}
                      chaveCategoria="ano" // i18n: dado
                      series={ORDEM_PARCELAS.map((p) => ({ id: p, rotulo: ROTULO_PARCELA_CURTO[p], cor: COR_PARCELA[p] }))}
                      unidade="h"
                      casas={2}
                      empilhado
                      altura={320}
                    />
                    <dl className="space-y-3 text-sm">
                      {ORDEM_PARCELAS.map((p) => (
                        <div key={p}>
                          <dt className="font-medium text-carvao">
                            {idioma === "en"
                              ? daGold(g.parcelas.rotulos[p], PARCELAS_ROTULOS_EN, `parcela-${p}`)
                              : paraLeitor(g.parcelas.rotulos[p]).replace(/\bONS\b/, "Operador Nacional do Sistema (ONS)")}
                          </dt>
                          <dd className="text-carvao-muted">
                            {idioma === "en"
                              ? g.parcelas.grupos[p].map((s, i) => (
                                  <span key={s}>
                                    {i > 0 && "; "}
                                    {s}: {g.parcelas.definicao[s] ? daGold(g.parcelas.definicao[s], PARCELAS_DEFINICAO_EN, `parcela-${s}`) : tx("sem definição no dicionário", "no definition in the dictionary")}
                                  </span>
                                ))
                              : g.parcelas.grupos[p].map((s) => tx(`${s}: ${paraLeitor(g.parcelas.definicao[s] ?? "sem definição no dicionário")}`, "")).join("; ")}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{regras.apurado}</p>
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="mapa-municipios"
                  titulo={tx("Que conjuntos atendem cada município?", "Which consumer clusters serve each municipality?")}
                  lead={tx(
                    <>
                      {num(g.mapa.municipios_com_valor, 0)} municípios com valor em {g.mapa.ano}. {definicaoConjunto()} Cada cor é o valor de um conjunto, não do município: como um município pode ter
                      vários conjuntos, o mapa pinta o maior ou o menor deles, à sua escolha, e não há média municipal. Clique num município, ou busque pelo nome, para ver os conjuntos, o limite
                      de cada um e as distribuidoras.
                    </>,
                    <>
                      {num(g.mapa.municipios_com_valor, 0)} municipalities with a value in {g.mapa.ano}. {definicaoConjunto()} Each colour is the value of a consumer cluster, not of the
                      municipality: since a municipality can have several clusters, the map paints the highest or the lowest of them, as you choose, and there is no municipal average. Click on a
                      municipality, or search by name, to see the consumer clusters, the limit of each one and the distribution utilities.
                    </>,
                  )}
                >
                  <QualidadeMapa
                    ano={g.mapa.ano}
                    urlMunicipios={URL_MUNICIPIOS}
                    urlSerie={URL_SERIE}
                    distribuidoras={nomesDist}
                    regra={g.mapa.regra}
                    totalMunicipios={g.mapa.correspondencia.cadastro_ibge}
                    fonte={tx(
                      "ANEEL, IndQual Município e Indicadores Coletivos de Continuidade; IBGE, cadastro de municípios",
                      "ANEEL, IndQual Município and Collective Continuity Indicators; IBGE, municipal registry",
                    )}
                    versao={String(g.mapa.ano)}
                    avisosFec={avisos}
                    tamanhoConjuntos={tamanhos[arquivoConjuntosDoAno(g.mapa.ano)]}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="mensal" nivel="analisar" titulo={tx("Mês a mês, nos últimos meses publicados", "Month by month, in the latest months published")}>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {regras.mes_completo}{" "}
                    {incompletos.length
                      ? tx(
                          `Ficam fora, com o valor publicado na tabela: ${incompletos.map((x) => mesAno(x.m)).join(", ")}.`,
                          `Excluded, with the published value in the table: ${incompletos.map((x) => mesAno(x.m)).join(", ")}.`,
                        )
                      : tx("Todos os meses do período estão completos.", "All months of the period are complete.")}
                  </p>
                  <CursorSincronizado>
                    <QualidadePar>
                      <GraficoLinhas
                        titulo={tx("DEC mensal do Brasil (meses completos)", "Monthly DEC of Brazil (complete months)")}
                        dados={mensalDec}
                        chaveX="m"
                        formatoX="mes"
                        series={[{ id: "dec", rotulo: tx("DEC mensal", "Monthly DEC"), cor: "var(--cor-energia)" }]} // i18n: dado
                        unidade="h"
                        casas={2}
                        zeroNoEixo
                        altura={220}
                      />
                      <GraficoLinhas
                        titulo={tx("FEC mensal do Brasil (meses completos)", "Monthly FEC of Brazil (complete months)")}
                        dados={mensalFec}
                        chaveX="m"
                        formatoX="mes"
                        series={[{ id: "fec", rotulo: tx("FEC mensal", "Monthly FEC"), cor: "var(--serie-sm-se)" }]}
                        unidade={tx("interrupções", "interruptions")}
                        casas={2}
                        zeroNoEixo
                        altura={220}
                      />
                    </QualidadePar>
                  </CursorSincronizado>
                  <QualidadeTabela tabela="mensal" titulo={tx("Meses publicados, com a situação de cada um", "Months published, with the status of each one")} linhas={n("mensal")} chaveUrl="tmes" />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="tabela-distribuidoras"
                  nivel="analisar"
                  titulo={tx(`Todas as distribuidoras em ${ref}: duração, frequência e expurgos`, `All distribution utilities in ${ref}: duration, frequency and exclusions`)}
                >
                  <QualidadeTabela tabela="dist-p051" titulo={tx(`DEC, FEC e parcelas por distribuidora, ${ref}`, `DEC, FEC and components by distribution utility, ${ref}`)} linhas={n("dist-p051")} chaveUrl="tdist" avisosFec={avisos} />
                </SecaoDoPainel>

                <SecaoDoPainel id="conjuntos-do-ano" nivel="analisar" titulo={tx("Todos os conjuntos de um ano", "All consumer clusters of a year")}>
                  <QualidadeConjuntos anoInicial={Number(primeiroAno)} anoFinal={ref} tamanhos={tamanhos} fonte={fonteContinuidade()} />
                </SecaoDoPainel>

                <SecaoDoPainel id="universos-e-arquivos" nivel="auditar" titulo={tx("Universos, pesos, controles e arquivos", "Universes, weights, checks and files")}>
                  <ul className="space-y-2 text-sm text-carvao-muted">
                    <li>
                      <strong className="font-medium text-carvao">{tx("Universo principal:", "Main universe:")}</strong> {universo.principal}
                    </li>
                    <li>
                      <strong className="font-medium text-carvao">{tx("Só concessionárias:", "Concession holders only:")}</strong> {universo.concessionarias}
                    </li>
                    <li>
                      <strong className="font-medium text-carvao">{tx("Peso:", "Weight:")}</strong> {regras.agregacao}
                    </li>
                    <li>
                      <strong className="font-medium text-carvao">{tx("Controle do número de unidades:", "Check of the number of units:")}</strong> {regras.numcon}
                    </li>
                    <li>
                      <strong className="font-medium text-carvao">{tx("Ano corrente:", "Current year:")}</strong> {regras.parcial} {avisoAnoCorrente}
                    </li>
                    <li data-texto="cobertura-fec">
                      <strong className="font-medium text-carvao">{tx("Cobertura do FEC:", "FEC coverage:")}</strong>
                      {tx(
                        <>
                          {" "}
                          o FEC anual de uma distribuidora que difere em mais de {num(LIMITE_FEC_PARCIAL_CENTESIMOS / 100, 2)} da soma das parcelas internas (FECIP + FECIND) é marcado como
                          de cobertura parcial, e o valor da base não muda.
                        </>,
                        <>
                          {" "}
                          a distribution utility&apos;s annual FEC that differs by more than {num(LIMITE_FEC_PARCIAL_CENTESIMOS / 100, 2)} from the sum of the internal components (FECIP +
                          FECIND) is marked as having partial coverage, and the database value does not change.
                        </>,
                      )}{" "}
                      {listaAvisos.length
                        ? marcarNomes(
                            listaAvisos.map((x) => x.frase).join(" "),
                            listaAvisos.map((x) => x.rotulo),
                            idioma,
                          )
                        : tx("Nenhuma distribuidora tem a marca nesta publicação.", "No distribution utility has the mark in this release.")}{" "}
                      {textoFecBrasilConfere(g)}
                    </li>
                  </ul>
                  <QualidadeTabela
                    tabela="identidade"
                    titulo={tx("Identidade do apurado: DEC e FEC iguais às parcelas internas (IP + IND), por ano", "Identity of the assessed value: DEC and FEC equal to the internal components (IP + IND), by year")}
                    linhas={n("identidade")}
                    chaveUrl="tide"
                  />
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
              subtitulo={tx("DEC e FEC apurados diante do limite regulatório do mesmo ano · razão apurado ÷ limite", "Assessed DEC and FEC against the regulatory limit of the same year · assessed ÷ limit ratio")}
              natureza="CALCULADO"
              porQueImporta={
                <>
                  {tx(
                    <>
                      A ANEEL fixa limites de DEC e de FEC para cada <Termo slug="conjunto-eletrico">conjunto</Termo> com a periodicidade das revisões tarifárias. Segundo a ANEEL, o
                      descumprimento traz consequências à distribuidora, como plano de resultados e limitação de proventos aos acionistas, e o ranking da continuidade parte da distância ao
                      limite: ela mostra quem está perto, quem passou e por quanto.
                    </>,
                    <>
                      ANEEL sets DEC and FEC limits for each <Termo slug="conjunto-eletrico">consumer cluster</Termo> at the frequency of the tariff reviews. According to ANEEL, non-compliance
                      has consequences for the distribution utility, such as a results plan and a limit on payouts to shareholders, and the continuity ranking starts from the distance to the
                      limit: it shows who is close, who exceeded it and by how much.
                    </>,
                  )}
                </>
              }
              oQueMudou={mudancaP052(c)}
              comoInterpretar={comoInterpretarP052}
              naoConcluir={naoConcluirP052}
              naoConcluirNoCorpo
              proveniencia={prov.limites}
              complementares={[{ rotulo: tx("Ranking da continuidade (DGC publicado)", "Continuity ranking (published DGC)"), p: prov.ranking }]}
            >
              <div className="space-y-6">
                <RespostaCurta id={p052.id} veredito={vereditoP052(g)}>
                  {respostaP052(g)}{" "}
                  {marcarNomes(contagemFec, [...(semRazaoFec?.acima ?? []).flatMap((x) => [x.nome, x.sigla]), ...(semRazaoFec?.porDistribuidora ?? []).map((x) => x.sigla)], idioma)}
                </RespostaCurta>

                <QualidadeLimites
                  ano={ref}
                  itens={itensLimites(g)}
                  avisosFec={avisos}
                  totalLinhas={n("limites")}
                  urlSerie={URL_SERIE}
                />

                <QualidadeRecorte
                  periodo={tx(
                    <>
                      Ano de apuração {c.ano}, com o limite do mesmo ano; histórico de {c.historico[0]?.ano ?? c.ano} a {c.ano}
                    </>,
                    <>
                      Assessment year {c.ano}, with the limit of the same year; history from {c.historico[0]?.ano ?? c.ano} to {c.ano}
                    </>,
                  )}
                  universo={tx(
                    <>
                      {num(c.com_limite, 0)} conjuntos com 12 meses e limite; {g.distribuidoras.length} distribuidoras com indicadores de continuidade ({g.distribuidoras.filter((d) => d.dec === null).length} sem valor anual); as encerradas ou absorvidas, listadas em Perdas e em Minha região, não têm
                    </>,
                    <>
                      {num(c.com_limite, 0)} consumer clusters with 12 months and a limit; {g.distribuidoras.length} distribution utilities with continuity indicators ({g.distribuidoras.filter((d) => d.dec === null).length} with no annual value); those that closed or were absorbed, listed in Losses and in My region, have none
                    </>,
                  )}
                  unidade={tx(
                    <>
                      horas (DEC), interrupções (FEC) e razão apurado ÷ limite (adimensional). DGC, o desempenho global de continuidade: média simples de DEC ÷ limite e FEC ÷ limite, calculada
                      aqui e publicada no ranking da ANEEL, lado a lado na tabela.
                    </>,
                    <>
                      hours (DEC), interruptions (FEC) and assessed ÷ limit ratio (dimensionless). DGC, the overall continuity performance: simple average of DEC ÷ limit and FEC ÷ limit,
                      calculated here and published in the ANEEL ranking, side by side in the table.
                    </>,
                  )}
                />

                <NotasDoPainel oQueMudou={mudancaP052(c)} comoInterpretar={comoInterpretarP052} naoConcluir={naoConcluirP052} />

                <SecaoDoPainel
                  id="comparar-distribuidoras"
                  titulo={tx("Como cada distribuidora se compara com o próprio limite, ano a ano?", "How does each distribution utility compare with its own limit, year by year?")}
                  lead={tx(
                    `Sem escolha no link, entram as quatro maiores distribuidoras em UCs em ${ref}. A linha tracejada é o limite de cada ano; os painéis usam a mesma escala, e com mais de uma distribuidora dá para trocar para a escala própria. Incorporações mudam a área da distribuidora e aparecem na nota do painel.`,
                    `With no choice in the link, the four largest distribution utilities by UCs in ${ref} are shown. The dashed line is the limit of each year; the panels use the same scale, and with more than one distribution utility you can switch to each panel's own scale. Mergers change the distribution utility's area and appear in the panel note.`,
                  )}
                >
                  <QualidadeComparador entidades={entidades} padrao={maiores} urlSerie={URL_SERIE} avisosFec={avisos} />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="distribuicao-dos-conjuntos"
                  titulo={tx("Como os conjuntos se distribuem diante do limite? A média esconde as caudas", "How are the consumer clusters distributed against the limit? The average hides the tails")}
                >
                  <Histograma
                    titulo={tx(`Conjuntos por razão DEC ÷ limite, ${c.ano}`, `Consumer clusters by DEC ÷ limit ratio, ${c.ano}`)}
                    dados={histRazao}
                    rotuloX={tx("DEC apurado ÷ limite do conjunto", "Assessed DEC ÷ limit of the consumer cluster")}
                    unidade={tx("vezes o limite", "times the limit")}
                    casas={2}
                    contagem={tx({ singular: "conjunto", plural: "conjuntos" }, { singular: "consumer cluster", plural: "consumer clusters" })}
                    periodo={String(c.ano)}
                    valorAtual={{ valor: 1, rotulo: tx("Limite", "Limit") }}
                    cor="var(--cor-energia)"
                    nota={tx(
                      `P10 a P90 são percentis: P90 é a razão abaixo da qual ficam 90% dos conjuntos. Com faixas de larguras diferentes, a altura da barra é densidade, não contagem.${
                        ultimaFaixaRazao && ultimaFaixaRazao.ate === null && c.quantis_razao_dec.max !== null
                          ? ` A última faixa é aberta na fonte (${num(ultimaFaixaRazao.de, 2)} vezes o limite ou mais) e é desenhada até o máximo (${num(c.quantis_razao_dec.max, 2)}).`
                          : ""
                      } ${num(c.iguais_limite_dec, 0)} conjuntos com DEC igual ao limite não contam como acima.`,
                      `P10 to P90 are percentiles: P90 is the ratio below which 90% of the consumer clusters lie. With bins of different widths, bar height is density, not count.${
                        ultimaFaixaRazao && ultimaFaixaRazao.ate === null && c.quantis_razao_dec.max !== null
                          ? ` The last bin is open in the source (${num(ultimaFaixaRazao.de, 2)} times the limit or more) and is drawn up to the maximum (${num(c.quantis_razao_dec.max, 2)}).`
                          : ""
                      } ${num(c.iguais_limite_dec, 0)} consumer clusters with DEC equal to the limit do not count as above.`,
                    )}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="ano-a-ano" titulo={tx("Quantos conjuntos passaram do limite, ano a ano?", "How many consumer clusters exceeded the limit, year by year?")} lead={textoUniversosConjuntos(g)}>
                  <QualidadePar>
                    <GraficoLinhas
                      titulo={tx(`Unidades consumidoras e conjuntos acima do limite de DEC, ${c.historico[0]?.ano ?? ""} a ${c.ano}`, `Consumer units and consumer clusters above the DEC limit, ${c.historico[0]?.ano ?? ""} to ${c.ano}`)}
                      dados={histUcs}
                      chaveX="ano" // i18n: dado
                      formatoX="texto"
                      series={[
                        { id: "pct_ucs_acima", rotulo: tx("% das unidades consumidoras (leitura principal)", "% of consumer units (main reading)"), sigla: "UCs", cor: "var(--cor-energia)" }, // i18n: dado
                        { id: "pct_acima", rotulo: tx("% dos conjuntos", "% of consumer clusters"), sigla: tx("Conjuntos", "Clusters"), cor: "var(--serie-sm-se)" },
                      ]}
                      unidade="%"
                      casas={1}
                      zeroNoEixo
                    />
                    <GraficoLinhas
                      titulo={tx("Razão DEC ÷ limite dos conjuntos: mediana e percentil 90", "DEC ÷ limit ratio of the consumer clusters: median and 90th percentile")}
                      dados={histRazoes}
                      chaveX="ano" // i18n: dado
                      formatoX="texto"
                      series={[
                        { id: "razao_p50", rotulo: tx("Mediana dos conjuntos", "Median of the consumer clusters"), sigla: tx("Mediana", "Median"), cor: "var(--cor-energia)" }, // i18n: dado
                        { id: "razao_p90", rotulo: tx("Percentil 90 dos conjuntos", "90th percentile of the consumer clusters"), sigla: "P90", cor: "var(--serie-termica)" },
                      ]}
                      unidade={tx("vezes o limite", "times the limit")}
                      casas={3}
                      zeroNoEixo
                    />
                  </QualidadePar>
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="matriz-limite-razao"
                  nivel="analisar"
                  titulo={tx("Limite apertado ou folgado: faixa do limite × distância a ele", "Tight or loose limit: limit band × distance to it")}
                >
                  <QualidadeTabela tabela="matriz" titulo={tx(`Conjuntos por faixa de limite de DEC e por razão DEC ÷ limite, ${c.ano}`, `Consumer clusters by DEC limit band and by DEC ÷ limit ratio, ${c.ano}`)} linhas={n("matriz")} chaveUrl="tmat" />
                </SecaoDoPainel>

                <SecaoDoPainel id="pontas" nivel="analisar" titulo={tx("As pontas: os conjuntos mais distantes do limite e os de maior DEC", "The tails: the consumer clusters furthest from the limit and those with the highest DEC")}>
                  <QualidadeTabela tabela="cauda-razao" titulo={tx(`Conjuntos com maior razão DEC ÷ limite, ${c.ano}`, `Consumer clusters with the highest DEC ÷ limit ratio, ${c.ano}`)} linhas={n("cauda-razao")} chaveUrl="tcr" />
                  <QualidadeTabela tabela="cauda-dec" titulo={tx(`Conjuntos com maior DEC, ${c.ano}`, `Consumer clusters with the highest DEC, ${c.ano}`)} linhas={n("cauda-dec")} chaveUrl="tcd" />
                </SecaoDoPainel>

                <SecaoDoPainel id="dgc" nivel="auditar" titulo={tx("DGC calculado × DGC publicado no ranking da ANEEL", "Calculated DGC × DGC published in the ANEEL ranking")}>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {regras.limite}
                    {tx(
                      " Tolerância de 0,01, a precisão do DGC publicado. Posição no ranking e DGC publicado são da ANEEL; o DGC calculado é do observatório.",
                      " Tolerance of 0.01, the precision of the published DGC. Ranking position and published DGC come from ANEEL; the calculated DGC is the observatory's.",
                    )}
                  </p>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-texto="divergencias-dgc">
                    {marcarNomes(
                      textoDivergenciasDgc(g),
                      g.reconciliacao.dgc.flatMap((r) => r.divergentes.map((d) => d.sigla_ranking ?? d.empresa)),
                      idioma,
                    )}
                  </p>
                  <QualidadeTabela tabela="dgc" titulo={tx("Reconciliação do DGC por ano", "DGC reconciliation by year")} linhas={n("dgc")} chaveUrl="tdgc" />
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
              subtitulo={tx(
                "Compensações pagas quando o limite individual de continuidade de uma unidade consumidora é violado · R$ nominais e quantidade",
                "Compensation payments made when the individual continuity limit of a consumer unit is violated · nominal R$ and quantity",
              )}
              natureza="CALCULADO"
              porQueImporta={
                <>
                  {tx(
                    "Quando a unidade consumidora passa do seu limite individual de duração ou de frequência, a distribuidora deve creditar uma compensação na fatura. É o efeito da continuidade que chega ao bolso do consumidor.",
                    "When a consumer unit exceeds its individual duration or frequency limit, the distribution utility must credit a compensation payment on the bill. It is the effect of continuity that reaches the consumer's pocket.",
                  )}
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
                  {definicaoLimitesIndividuais()}
                </p>

                <FaixaMetricas colunas={3} rotulo={tx("Compensações do ano de referência", "Compensation payments in the reference year")}>
                  <Numero
                    variante="faixa"
                    rotulo={tx("Pago a unidades consumidoras", "Paid to consumer units")}
                    natureza="CALCULADO"
                    valor={mc.valorUcMilhoes}
                    formato="reais"
                    casas={1}
                    unidade={tx("milhões", "million")}
                    periodo={String(comp.ano_referencia)}
                    evidencia={ev.compensacoes_ano ?? null}
                    motivoAusencia={tx("Ano sem os 12 meses informados pelas distribuidoras.", "Year without the 12 months reported by the distribution utilities.")}
                    nota={[
                      mc.valorUcAnteriorMilhoes !== null
                        ? tx(
                            `Valores nominais da competência. Em ${mc.anoAnterior}: R$ ${num(mc.valorUcAnteriorMilhoes, 1)} milhões.`,
                            `Nominal values of the accrual month. In ${mc.anoAnterior}: R$ ${num(mc.valorUcAnteriorMilhoes, 1)} million.`,
                          )
                        : tx("Valores nominais da competência.", "Nominal values of the accrual month."),
                      notaDivulgadoCartao(g),
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    cor="var(--cor-energia)"
                    endereco={`/setor-eletrico/qualidade#${p053.ancora}`}
                  />
                  <Numero
                    variante="faixa"
                    rotulo={tx("Compensações pagas a unidades consumidoras", "Compensation payments made to consumer units")}
                    natureza="CALCULADO"
                    valor={mc.quantidadeUcMilhoes}
                    formato="num"
                    casas={1}
                    unidade={tx("milhões de compensações", "million compensation payments")}
                    periodo={String(comp.ano_referencia)}
                    motivoAusencia={tx("Ano sem os 12 meses informados pelas distribuidoras.", "Year without the 12 months reported by the distribution utilities.")}
                    nota={[tx("Conta compensações, não consumidores.", "It counts compensation payments, not consumers."), notaQuantidadeDivulgada(g)].filter(Boolean).join(" ")}
                  />
                  <Numero
                    variante="faixa"
                    rotulo={tx("Pago a unidades geradoras", "Paid to generating units")}
                    natureza="CALCULADO"
                    valor={mc.valorUgMilhoes}
                    formato="reais"
                    casas={1}
                    unidade={tx("milhões", "million")}
                    periodo={String(comp.ano_referencia)}
                    motivoAusencia={tx("Sem linha de unidade geradora na fonte para o ano.", "No generating unit line in the source for the year.")}
                    nota={tx("À parte: não entra no total das unidades consumidoras.", "Separate: not included in the consumer units total.")}
                  />
                </FaixaMetricas>

                {avisoQuebraComp && (
                  <p role="note" data-aviso="quebra-compensacoes" className="max-w-prose2 border-l-2 border-mineral pl-3 text-sm leading-relaxed text-carvao">
                    {avisoQuebraComp}
                  </p>
                )}
                <GraficoBarras
                  titulo={tx(
                    `Compensações pagas a unidades consumidoras por ano, ${compBarras[0]?.ano ?? ""} a ${comp.ano_referencia}`,
                    `Compensation payments to consumer units by year, ${compBarras[0]?.ano ?? ""} to ${comp.ano_referencia}`,
                  )}
                  dados={dadosCompAnual}
                  chaveCategoria="ano" // i18n: dado
                  series={
                    regimes
                      ? [
                          { id: "antes", rotulo: regimes.antes, cor: "var(--serie-sm-se)", opcional: true },
                          { id: "depois", rotulo: regimes.depois, cor: "var(--cor-energia)", opcional: true }, // i18n: dado
                        ]
                      : [{ id: "valor_uc_mi", rotulo: tx("Valor a unidades consumidoras", "Amount to consumer units"), cor: "var(--cor-energia)" }] // i18n: dado
                  }
                  unidade={tx("R$ milhões", "R$ million")}
                  casas={1}
                  empilhado={Boolean(regimes)}
                  altura={300}
                />

                <QualidadeRecorte
                  periodo={
                    <>
                      {tx(
                        <>
                          Anos completos de {compBarras[0]?.ano ?? comp.ano_referencia} a {comp.ano_referencia}; último mês completo {comp.ultimo_mes_completo ? mesAno(comp.ultimo_mes_completo) : "não informado"}
                        </>,
                        <>
                          Complete years from {compBarras[0]?.ano ?? comp.ano_referencia} to {comp.ano_referencia}; latest complete month {comp.ultimo_mes_completo ? mesAno(comp.ultimo_mes_completo) : "not reported"}
                        </>,
                      )}
                    </>
                  }
                  universo={tx(
                    `${distComp} distribuidoras informaram compensações em ${comp.ano_referencia}; unidades consumidoras (UC) e unidades geradoras (UG) separadas`,
                    `${distComp} distribution utilities reported compensation payments in ${comp.ano_referencia}; consumer units (UC) and generating units (UG) separately`,
                  )}
                  unidade={tx("R$ nominais da competência (milhões no gráfico) e quantidade de compensações", "Nominal R$ of the accrual month (millions in the chart) and quantity of compensation payments")}
                />

                <NotasDoPainel oQueMudou={mudancaP053(g)} comoInterpretar={comoInterpretarP053} naoConcluir={naoConcluirP053} />

                <SecaoDoPainel id="compensacoes-por-ano" nivel="analisar" titulo={tx("Compensações por ano, com quantidade e unidades geradoras", "Compensation payments by year, with quantity and generating units")}>
                  <QualidadeTabela tabela="comp-anual" titulo={tx("Compensações por ano: unidades consumidoras e geradoras", "Compensation payments by year: consumer and generating units")} linhas={n("comp-anual")} chaveUrl="tcomp" />
                </SecaoDoPainel>

                <SecaoDoPainel id="tipos-de-violacao" titulo={tx(`Qual limite foi violado? Valor pago por tipo em ${comp.ano_referencia}`, `Which limit was violated? Amount paid by type in ${comp.ano_referencia}`)}>
                  <GraficoBarras
                    titulo={tx(`Valor pago a unidades consumidoras por tipo de limite violado, ${comp.ano_referencia}`, `Amount paid to consumer units by type of limit violated, ${comp.ano_referencia}`)}
                    dados={linhasTipoAnoReferencia(g)}
                    chaveCategoria="id"
                    chaveRotulo="tipo"
                    series={[{ id: "valor_mi", rotulo: tx("Valor a unidades consumidoras", "Amount to consumer units"), cor: "var(--cor-energia)" }]} // i18n: dado
                    unidade={tx("R$ milhões", "R$ million")}
                    casas={2}
                    orientacao="horizontal"
                    rotulosValor
                  />
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {tipoDefinicoes.join("; ")}.{notaSemUc ? ` ${notaSemUc}` : ""}
                  </p>
                  <QualidadeTabela tabela="comp-tipo" titulo={tx("Valor pago a unidades consumidoras por tipo de violação e ano", "Amount paid to consumer units by type of violation and year")} linhas={n("comp-tipo")} chaveUrl="tctp" />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="compensacao-entre-distribuidoras"
                  nivel="analisar"
                  titulo={tx(`Como o valor se distribui entre as distribuidoras em ${comp.ano_referencia}?`, `How is the amount distributed among the distribution utilities in ${comp.ano_referencia}?`)}
                >
                  <Histograma
                    titulo={tx(`Distribuidoras por valor de compensação ÷ unidades consumidoras, ${comp.ano_referencia}`, `Distribution utilities by compensation amount ÷ consumer units, ${comp.ano_referencia}`)}
                    dados={histValorUc}
                    rotuloX={tx("Valor no ano (UC e UG) ÷ UCs médias", "Amount in the year (UC and UG) ÷ average UCs")}
                    unidade={tx("R$ por UC", "R$ per UC")}
                    casas={2}
                    contagem={tx({ singular: "distribuidora", plural: "distribuidoras" }, { singular: "distribution utility", plural: "distribution utilities" })}
                    periodo={String(comp.ano_referencia)}
                    valorAtual={{ valor: anoComp?.valor_por_uc ?? null, rotulo: tx("Brasil", "Brazil") }}
                    cor="var(--cor-energia)"
                    nota={tx(
                      "Normalização para comparar tamanhos; não é o crédito de cada consumidor. P10 a P90 são percentis: P90 é o valor abaixo do qual ficam 90% das distribuidoras.",
                      "Normalization to compare sizes; it is not each consumer's credit. P10 to P90 are percentiles: P90 is the value below which 90% of the distribution utilities lie.",
                    )}
                  />
                  <QualidadeTabela tabela="comp-dist" titulo={tx(`Compensações por distribuidora, ${comp.ano_referencia}`, `Compensation payments by distribution utility, ${comp.ano_referencia}`)} linhas={n("comp-dist")} chaveUrl="tcdi" />
                </SecaoDoPainel>

                <SecaoDoPainel id="compensacoes-mes-a-mes" nivel="analisar" titulo={tx("Mês a mês: valor e quantidade separados", "Month by month: amount and quantity separately")}>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {tx("Competência mensal. ", "Monthly accrual. ")}
                    {regras.mes_completo_compensacao}{" "}
                    {compIncompletos.length
                      ? tx(
                          `Ficam fora, com o valor publicado na tabela: ${compIncompletos.map((x) => mesAno(x.m)).join(", ")}.`,
                          `Excluded, with the published value in the table: ${compIncompletos.map((x) => mesAno(x.m)).join(", ")}.`,
                        )
                      : tx("Todos os meses do período estão completos.", "All months of the period are complete.")}
                    {tx(" Os dois gráficos compartilham o cursor.", " The two charts share the cursor.")}
                  </p>
                  <CursorSincronizado>
                    <QualidadePar>
                      <GraficoLinhas
                        titulo={tx("Valor das compensações por mês (meses completos)", "Amount of compensation payments by month (complete months)")}
                        dados={recorteColunas(compMensal, ["m", "valor_mi"])}
                        chaveX="m"
                        formatoX="mes"
                        series={[{ id: "valor_mi", rotulo: tx("Valor (UC e UG)", "Amount (UC and UG)"), cor: "var(--cor-energia)" }]} // i18n: dado
                        unidade={tx("R$ milhões", "R$ million")}
                        casas={1}
                        zeroNoEixo
                        altura={220}
                      />
                      <GraficoLinhas
                        titulo={tx("Quantidade de compensações por mês (meses completos)", "Quantity of compensation payments by month (complete months)")}
                        dados={recorteColunas(compMensal, ["m", "quantidade_mil"])}
                        chaveX="m"
                        formatoX="mes"
                        series={[{ id: "quantidade_mil", rotulo: tx("Compensações (UC e UG)", "Compensation payments (UC and UG)"), cor: "var(--serie-sm-se)" }]}
                        unidade={tx("mil compensações", "thousand compensation payments")}
                        casas={0}
                        zeroNoEixo
                        altura={220}
                      />
                    </QualidadePar>
                  </CursorSincronizado>
                </SecaoDoPainel>

                <SecaoDoPainel id="conferencia-divulgado" nivel="auditar" titulo={tx("Conferência com o total divulgado pela ANEEL", "Check against the total announced by ANEEL")}>
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {tx(
                      "A ANEEL divulga o total anual pago a unidades consumidoras na notícia do ranking (bilhões com três casas, milhões de compensações com uma). Diferença fora da precisão fica marcada e não foi explicada; a hipótese de revisão dos envios depois da divulgação não está verificada.",
                      "ANEEL announces the annual total paid to consumer units in the ranking news release (billions with three decimals, millions of compensation payments with one). A difference outside the precision is marked and has not been explained; the hypothesis of revised submissions after the announcement is not verified.",
                    )}
                  </p>
                  <QualidadeTabela
                    tabela="divulgado"
                    titulo={tx("Total de compensações a UCs: soma dos dados abertos × total divulgado", "Total compensation payments to UCs: sum of the open data × announced total")}
                    linhas={n("divulgado")}
                    chaveUrl="tdiv"
                  />
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
              subtitulo={tx(
                "Reclamações por unidade consumidora, pesquisa de satisfação (IASC) com amostra, atendimento telefônico e emergencial, eventos de emergência · escopos separados",
                "Complaints per consumer unit, satisfaction survey (IASC) with its sample, telephone and emergency service, emergency events · separate scopes",
              )}
              natureza="CALCULADO"
              porQueImporta={
                <>
                  {tx(
                    "A continuidade mede quanto falta energia; o atendimento mede como a distribuidora responde: quantas reclamações recebe para cada mil unidades, quanto tempo leva para chegar a uma ocorrência e como os consumidores avaliam o serviço.",
                    "Continuity measures how much power is missing; customer service measures how the distribution utility responds: how many complaints it receives per thousand units, how long it takes to reach an occurrence and how consumers rate the service.",
                  )}
                </>
              }
              oQueMudou={mudancaP054(g)}
              comoInterpretar={comoInterpretarP054}
              naoConcluir={naoConcluirP054}
              naoConcluirNoCorpo
              proveniencia={prov.reclamacoes}
              complementares={[
                { rotulo: tx("Ouvidoria Setorial da ANEEL", "ANEEL Sector Ombudsman"), p: prov.ouvidoria_aneel },
                { rotulo: tx("IASC (pesquisa amostral)", "IASC (sample survey)"), p: prov.iasc },
                { rotulo: tx("Atendimento emergencial (TMAE)", "Emergency response (TMAE)"), p: prov.atendimento_emergencial },
                { rotulo: tx("Atendimento telefônico", "Telephone service"), p: prov.telefonico },
                { rotulo: tx("Eventos em situação de emergência", "Events in emergency situations"), p: prov.eventos },
              ]}
            >
              <div className="space-y-6">
                <RespostaCurta id={p054.id} veredito={vereditoP054(g)}>
                  {respostaP054(g)}
                </RespostaCurta>

                <FaixaMetricas colunas={2} rotulo={tx("Reclamações do ano de referência, cada uma com a sua base", "Complaints in the reference year, each with its own base")}>
                  <Numero
                    variante="faixa"
                    rotulo={tx("Reclamações na distribuidora, 1º nível", "Complaints at the distribution utility, 1st level")}
                    natureza="CALCULADO"
                    evidencia={ev.reclamacoes_distribuidora ?? null}
                    valor={rec?.por_ucs ?? null}
                    casas={1}
                    unidade={tx("por mil UCs", "per thousand UCs")}
                    motivoAusencia={motivoAusenciaNoIdioma(rec?.motivo_ausencia) ?? tx("Sem distribuidora com os 12 meses enviados.", "No distribution utility with the 12 months sent.")}
                    nota={
                      rec && rec.por_ucs !== null
                        ? tx(
                            `Base: 1.000 unidades consumidoras médias das mesmas distribuidoras. Na base de 100 mil UCs do cartão ao lado, seriam ${num(taxaNaBaseDaOuvidoria(rec.por_ucs), 0)}.`,
                            `Base: 1,000 average consumer units of the same distribution utilities. On the 100 thousand UC base of the card alongside, it would be ${num(taxaNaBaseDaOuvidoria(rec.por_ucs), 0)}.`,
                          )
                        : tx("Base: 1.000 unidades consumidoras médias das mesmas distribuidoras.", "Base: 1,000 average consumer units of the same distribution utilities.")
                    }
                    cor="var(--cor-energia)"
                    endereco={`/setor-eletrico/qualidade#${p054.ancora}`}
                  />
                  <Numero
                    variante="faixa"
                    rotulo={tx("Reclamações na Ouvidoria da ANEEL, 2º nível", "Complaints at the ANEEL Ombudsman, 2nd level")}
                    natureza="CALCULADO"
                    evidencia={ev.ouvidoria_aneel ?? null}
                    casas={1}
                    unidade={tx("por 100 mil UCs", "per 100 thousand UCs")}
                    motivoAusencia={tx("Arquivo da Ouvidoria sem os 12 meses do ano.", "Ombudsman file without the 12 months of the year.")}
                    nota={tx(
                      "Base: 100 mil UCs, diferente da do cartão ao lado (1.000). Segunda instância, depois do atendimento na distribuidora.",
                      "Base: 100 thousand UCs, different from the card alongside (1,000). Second level, after the distribution utility's own service.",
                    )}
                    cor="var(--serie-sm-se)"
                    endereco={`/setor-eletrico/qualidade#${p054.ancora}`}
                  />
                </FaixaMetricas>

                <QualidadePar>
                  <div className="space-y-3">
                    <GraficoBarras
                      titulo={tx("Reclamações registradas pelas distribuidoras por mil unidades consumidoras", "Complaints recorded by the distribution utilities per thousand consumer units")}
                      dados={linhasReclamacoesNacional(g)}
                      chaveCategoria="ano" // i18n: dado
                      series={[
                        { id: "total", rotulo: tx("Todas as reclamações (1º nível)", "All complaints (1st level)"), cor: "var(--cor-energia)" }, // i18n: dado
                        { id: "interrupcao", rotulo: tx("Sobre interrupção (1º nível)", "About interruptions (1st level)"), cor: "var(--serie-termica)" },
                      ]}
                      unidade={tx("por mil UCs", "per thousand UCs")}
                      casas={1}
                      altura={280}
                    />
                    {recParcial && (
                      <p className="text-sm text-carvao-muted">
                        {tx(
                          <>
                            {recParcial.ano}: barra hachurada é ausência, não zero ({recParcial.motivo_ausencia}).
                          </>,
                          <>
                            {recParcial.ano}: the hatched bar is absence, not zero ({motivoAusenciaNoIdioma(recParcial.motivo_ausencia)}).
                          </>,
                        )}
                      </p>
                    )}
                  </div>
                  <div className="space-y-3">
                    <GraficoBarras
                      titulo={tx("Reclamações na Ouvidoria Setorial da ANEEL por 100 mil unidades consumidoras", "Complaints at the ANEEL Sector Ombudsman per 100 thousand consumer units")}
                      dados={linhasOuvidoriaNacional(g)}
                      chaveCategoria="ano" // i18n: dado
                      series={[
                        { id: "total", rotulo: tx("Todas", "All"), cor: "var(--cor-energia)" }, // i18n: dado
                        { id: "procedentes", rotulo: tx("Procedentes", "Upheld"), cor: "var(--serie-sm-se)" },
                      ]}
                      unidade={tx("por 100 mil UCs", "per 100 thousand UCs")}
                      casas={1}
                      altura={280}
                    />
                    {ouvParcial.length > 0 && (
                      <p className="text-sm text-carvao-muted">
                        {ouvParcial
                          .map((o) =>
                            o.motivo_ausencia
                              ? tx(`${o.ano}: barra hachurada é ausência, não zero (${o.motivo_ausencia})`, `${o.ano}: the hatched bar is absence, not zero (${motivoAusenciaNoIdioma(o.motivo_ausencia)})`)
                              : tx(
                                  `${o.ano}: barra hachurada é ausência, não zero (${
                                    o.meses_max !== null ? `até ${o.meses_max} ${o.meses_max === 1 ? "mês publicado" : "meses publicados"} no arquivo do ano` : "ano incompleto no arquivo"
                                  }: sem taxa anual; a contagem parcial está na tabela de indicadores nacionais)`,
                                  `${o.ano}: the hatched bar is absence, not zero (${
                                    o.meses_max !== null ? `up to ${o.meses_max} ${o.meses_max === 1 ? "month published" : "months published"} in the year's file` : "incomplete year in the file"
                                  }: no annual rate; the partial count is in the table of national indicators)`,
                                ),
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
                      {tx(
                        <>
                          Reclamações de {at.reclamacoes_distribuidora[0]?.ano ?? ref} a {ref}
                          {recParcial ? ` (${recParcial.ano} sem taxa: ano parcial)` : ""}; IASC de {at.iasc.ano ?? "ano não publicado"}; telefônico desde {at.telefonico.anual[0]?.ano ?? ref}
                        </>,
                        <>
                          Complaints from {at.reclamacoes_distribuidora[0]?.ano ?? ref} to {ref}
                          {recParcial ? ` (${recParcial.ano} with no rate: partial year)` : ""}; IASC of {at.iasc.ano ?? "year not published"}; telephone since {at.telefonico.anual[0]?.ano ?? ref}
                        </>,
                      )}
                    </>
                  }
                  universo={
                    <>
                      {tx(
                        <>
                          {rec ? `${rec.distribuidoras} distribuidoras com os 12 meses enviados (${pctCobertura(rec.cobertura_ucs)} das UCs)` : "sem universo no ano"}; IASC com{" "}
                          {num(at.iasc.entrevistas, 0)} entrevistas
                        </>,
                        <>
                          {rec ? `${rec.distribuidoras} distribution utilities with the 12 months sent (${pctCobertura(rec.cobertura_ucs)} of the UCs)` : "no universe in the year"}; IASC with{" "}
                          {num(at.iasc.entrevistas, 0)} interviews
                        </>,
                      )}
                    </>
                  }
                  unidade={tx(
                    "reclamações por mil UCs (distribuidora) e por 100 mil UCs (Ouvidoria); índice de 0 a 100; minutos; % dos meses no padrão",
                    "complaints per thousand UCs (distribution utility) and per 100 thousand UCs (Ombudsman); index from 0 to 100; minutes; % of months within the standard",
                  )}
                />

                <NotasDoPainel oQueMudou={mudancaP054(g)} comoInterpretar={comoInterpretarP054} naoConcluir={naoConcluirP054} />

                <SecaoDoPainel
                  id="satisfacao-iasc"
                  titulo={tx(
                    `O que dizem os consumidores entrevistados? Satisfação em ${at.iasc.ano ?? "ano não publicado"}`,
                    `What do the interviewed consumers say? Satisfaction in ${at.iasc.ano ?? "year not published"}`,
                  )}
                  lead={tx(
                    `Pesquisa anual por amostra, o Índice ANEEL de Satisfação do Consumidor (IASC): ${num(at.iasc.entrevistas, 0)} entrevistas em ${at.iasc.distribuidoras} distribuidoras. Resultado estimado; a ANEEL não publica margem de erro por distribuidora.`,
                    `Annual sample survey, the ANEEL Consumer Satisfaction Index (IASC): ${num(at.iasc.entrevistas, 0)} interviews at ${at.iasc.distribuidoras} distribution utilities. Estimated result; ANEEL does not publish a margin of error by distribution utility.`,
                  )}
                >
                  <Histograma
                    titulo={tx(`Distribuidoras por IASC, ${at.iasc.ano ?? ""}`, `Distribution utilities by IASC, ${at.iasc.ano ?? ""}`)}
                    dados={histIasc}
                    rotuloX={tx("IASC (escala de 0 a 100)", "IASC (scale from 0 to 100)")}
                    unidade={tx("pontos", "points")}
                    casas={1}
                    contagem={tx({ singular: "distribuidora", plural: "distribuidoras" }, { singular: "distribution utility", plural: "distribution utilities" })}
                    periodo={String(at.iasc.ano ?? "")}
                    cor="var(--cor-energia)"
                    nota={tx(
                      "Índice estimado por pesquisa amostral; cada distribuidora tem a sua amostra, na tabela de atendimento. P10 a P90 são percentis: P90 é o valor abaixo do qual ficam 90% das distribuidoras.",
                      "Index estimated by sample survey; each distribution utility has its own sample, in the customer service table. P10 to P90 are percentiles: P90 is the value below which 90% of the distribution utilities lie.",
                    )}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="recuperacao-da-rede"
                  nivel="analisar"
                  titulo={tx("Como a rede se recupera: emergências e dias críticos", "How the grid recovers: emergencies and critical days")}
                  lead={tx(
                    `Parcelas do DEC nacional em situação de emergência e em dia crítico (as horas que a regra tira do apurado). ${evt.total} eventos em situação de emergência foram declarados por ${evt.distribuidoras} distribuidoras de ${evt.inicio_min ? dataBR(evt.inicio_min.slice(0, 10)) : "data não publicada"} a ${evt.inicio_max ? dataBR(evt.inicio_max.slice(0, 10)) : "data não publicada"}; duração mediana de ${num(evt.duracao_mediana_h, 0)} h e máxima de ${num(evt.duracao_max_h, 0)} h, entre os eventos com datas válidas. A tabela ordena os eventos pelo CHI, a soma de consumidores × horas interrompidas.`,
                    `Components of the national DEC in emergency situations and on critical days (the hours the rule removes from the assessed value). ${evt.total} events in emergency situations were declared by ${evt.distribuidoras} distribution utilities from ${evt.inicio_min ? dataBR(evt.inicio_min.slice(0, 10)) : "date not published"} to ${evt.inicio_max ? dataBR(evt.inicio_max.slice(0, 10)) : "date not published"}; median duration of ${num(evt.duracao_mediana_h, 0)} h and maximum of ${num(evt.duracao_max_h, 0)} h, among the events with valid dates. The table orders the events by CHI, the sum of consumers × hours interrupted.`,
                  )}
                >
                  <GraficoBarras
                    titulo={tx("DEC do Brasil em situação de emergência e em dia crítico", "Brazil's DEC in emergency situations and on critical days")}
                    dados={linhasResiliencia(g)}
                    chaveCategoria="ano" // i18n: dado
                    series={[
                      { id: "emergencia", rotulo: tx("Situação de emergência", "Emergency situation"), cor: COR_PARCELA.emergencia },
                      { id: "dia_critico", rotulo: tx("Dia crítico", "Critical day"), cor: COR_PARCELA.dia_critico },
                    ]}
                    unidade="h"
                    casas={2}
                    empilhado
                    altura={280}
                  />
                  <QualidadeTabela
                    tabela="eventos"
                    titulo={tx("Eventos em situação de emergência com maior CHI (consumidores × horas interrompidas)", "Events in emergency situations with the highest CHI (consumers × hours interrupted)")}
                    linhas={n("eventos")}
                    chaveUrl="tevt"
                  />
                  {evt.datas_invalidas.length > 0 && (
                    <p className="text-sm text-carvao-muted">
                      {tx(
                        <>
                          Datas mantidas como publicadas, sem duração: {evt.datas_invalidas.map((d) => datasLegiveis(`${d.sigla ?? "distribuidora não identificada"}, evento ${d.codigo} (${d.motivo})`)).join("; ")}.
                        </>,
                        <>
                          Dates kept as published, with no duration:{" "}
                          {evt.datas_invalidas.map((d, i) => (
                            <span key={`${d.codigo}-${i}`}>
                              {i > 0 && "; "}
                              {d.sigla ?? tx("distribuidora não identificada", "distribution utility not identified")}, event {d.codigo} (
                              <TrechoPortugues regiao="motivo-data-invalida">{datasLegiveis(d.motivo)}</TrechoPortugues>)
                            </span>
                          ))}
                          .
                        </>,
                      )}
                    </p>
                  )}
                </SecaoDoPainel>

                <SecaoDoPainel id="indicadores-e-escopos" nivel="analisar" titulo={tx("Indicadores de atendimento, cada um com o seu escopo", "Customer service indicators, each with its own scope")}>
                  <QualidadeTabela tabela="escopos" titulo={tx("Indicadores nacionais de atendimento por ano", "National customer service indicators by year")} linhas={n("escopos")} chaveUrl="tesc" />
                </SecaoDoPainel>

                <SecaoDoPainel id="atendimento-telefonico" nivel="analisar" titulo={tx("Atendimento telefônico das distribuidoras obrigadas", "Telephone service of the distribution utilities required to have it")}>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      <>
                        Só as distribuidoras com central obrigatória ({tel ? `${tel.distribuidoras} em ${ref}, ${pctCobertura(tel.cobertura_ucs)} das UCs` : "universo do ano não publicado"}).
                        Padrões: INS de ao menos {num(at.telefonico.padroes.ins_min_pct, 0)}%, IAb de até {num(at.telefonico.padroes.iab_max_pct, 0)}% e ICO de até{" "}
                        {num(at.telefonico.padroes.ico_max_pct, 0)}%. INS e IAb não se agregam (a fonte não publica os numeradores): o gráfico conta os meses dentro do padrão.
                      </>,
                      <>
                        Only the distribution utilities with a mandatory call centre ({tel ? `${tel.distribuidoras} in ${ref}, ${pctCobertura(tel.cobertura_ucs)} of the UCs` : "universe of the year not published"}).
                        Standards: INS of at least {num(at.telefonico.padroes.ins_min_pct, 0)}%, IAb of up to {num(at.telefonico.padroes.iab_max_pct, 0)}% and ICO of up to{" "}
                        {num(at.telefonico.padroes.ico_max_pct, 0)}%. INS and IAb are not aggregated (the source does not publish the numerators): the chart counts the months within the standard.
                      </>,
                    )}
                  </p>
                  <GraficoLinhas
                    titulo={tx("Distribuidora-meses dentro do padrão, por indicador", "Distribution utility-months within the standard, by indicator")}
                    dados={linhasTelefonico(g)}
                    chaveX="ano" // i18n: dado
                    formatoX="texto"
                    series={[
                      { id: "ins", rotulo: tx("INS (nível de serviço)", "INS (service level)"), sigla: "INS", cor: "var(--cor-energia)" }, // i18n: dado
                      { id: "iab", rotulo: tx("IAb (abandono)", "IAb (abandonment)"), sigla: "IAb", cor: "var(--serie-termica)" },
                      { id: "ico", rotulo: tx("ICO (chamadas ocupadas)", "ICO (busy calls)"), sigla: "ICO", cor: "var(--serie-sm-se)" },
                    ]}
                    unidade="%"
                    casas={1}
                    legendaInterativa
                    marcos={at.telefonico.anual.filter((t) => !t.completo).map((t) => ({ x: String(t.ano), rotulo: tx(`${t.ano}: ${t.meses} meses`, `${t.ano}: ${t.meses} months`) }))}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="atendimento-por-distribuidora" nivel="analisar" titulo={tx(`Atendimento por distribuidora, ${ref}`, `Customer service by distribution utility, ${ref}`)}>
                  <QualidadeTabela
                    tabela="atendimento"
                    titulo={tx(`Reclamações, IASC, TMAE e atendimento telefônico por distribuidora, ${ref}`, `Complaints, IASC, TMAE and telephone service by distribution utility, ${ref}`)}
                    linhas={n("atendimento")}
                    chaveUrl="tat"
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="fora-de-cada-universo" nivel="auditar" titulo={tx("Quem ficou fora de cada universo", "Who was excluded from each universe")}>
                  <ul className="space-y-2 text-sm text-carvao-muted">
                    {at.reclamacoes_distribuidora
                      .filter((r) => r.fora_meses_incompletos.length)
                      .map((r) => (
                        <li key={r.ano}>
                          <strong className="font-medium text-carvao">{tx(<>Reclamações {r.ano}:</>, <>Complaints {r.ano}:</>)}</strong>
                          {tx(" fora por não terem os 12 meses enviados:", " excluded for not having sent the 12 months:")}{" "}
                          {marcarNomes(
                            r.fora_meses_incompletos.map((x) => tx(`${x.sigla ?? `CNPJ ${x.cnpj}`} (${x.meses} meses)`, `${x.sigla ?? `CNPJ ${x.cnpj}`} (${x.meses} months)`)).join(", "),
                            r.fora_meses_incompletos.map((x) => x.sigla),
                            idioma,
                          )}
                          .
                        </li>
                      ))}
                    {at.iasc.sem_continuidade_no_ano.length > 0 && (
                      <li>
                        <strong className="font-medium text-carvao">{tx("IASC sem continuidade no ano:", "IASC without continuity data in the year:")}</strong>{" "}
                        {at.iasc.sem_continuidade_no_ano
                          .map((x) =>
                            tx(
                              `${x.sigla ?? x.nome_iasc ?? `CNPJ ${x.cnpj}`} (IASC ${num(x.iasc, 2)}, ${num(x.amostra, 0)} entrevistas)`,
                              `${x.sigla ?? x.nome_iasc ?? `CNPJ ${x.cnpj}`} (IASC ${num(x.iasc, 2)}, ${num(x.amostra, 0)} interviews)`,
                            ),
                          )
                          .join(", ")}
                        .
                      </li>
                    )}
                    <li>
                      <strong className="font-medium text-carvao">{tx("Anos do IASC publicados:", "IASC years published:")}</strong> {at.iasc.anos_disponiveis.join(", ")}.
                    </li>
                  </ul>
                </SecaoDoPainel>

                <SeguirPainel
                  ancora={p054.ancora}
                  downloads={downloadsDoPainel(g, "p054")}
                  proximo={{ href: "/setor-eletrico/conta-de-luz", pergunta: tx("Quanto essas distribuidoras cobram? Veja a conta de luz.", "How much do these distribution utilities charge? See the electricity bill.") }}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- Auditoria do módulo ---------------- */}
          <Bloco id="auditoria-qualidade" nivel="auditar">
            <section aria-labelledby="auditoria-qualidade-titulo" className="space-y-4 border-t border-dashed border-linha pt-6">
              <h2 id="auditoria-qualidade-titulo" className="ed-h2 font-serif text-carvao">
                {tx("Controles executados nesta publicação e arquivos de origem", "Checks run in this release and source files")}
              </h2>
              <p className="max-w-prose2 text-sm text-carvao-muted">
                {tx(
                  "Cada controle roda antes de qualquer arquivo ser escrito; reprovação crítica impede a publicação e mantém a anterior. Ressalva não descarta dado: o valor fica como a fonte publicou e o caso fica listado.",
                  "Each check runs before any file is written; a critical failure prevents publication and keeps the previous release. A caveat does not discard data: the value stays as the source published it and the case is listed.",
                )}
              </p>
              <QualidadeTabela tabela="validacao" titulo={tx("Controles de validação", "Validation checks")} linhas={n("validacao")} chaveUrl="tval" />
              <QualidadeTabela tabela="arquivos" titulo={tx("Arquivos de origem importados, cada um com o sha256", "Imported source files, each with its sha256")} linhas={n("arquivos")} chaveUrl="tarq" />
              {g.mapa.correspondencia.codigos_sem_ibge.length > 0 && (
                <p className="text-sm text-carvao-muted">
                  {tx(
                    <>Códigos da base IndQual Município fora do cadastro do IBGE, fora do mapa:</>,
                    <>
                      Codes of the <Nome>IndQual Município</Nome> database outside the IBGE registry, not on the map:
                    </>,
                  )}{" "}
                  {g.mapa.correspondencia.codigos_sem_ibge
                    .map((x) =>
                      tx(
                        `${x.codigo} (${x.conjuntos_ativos} conjuntos ativos${x.dec_min !== null ? `, DEC de ${num(x.dec_min, 2)} a ${num(x.dec_max, 2)} h` : ""})`,
                        `${x.codigo} (${x.conjuntos_ativos} active consumer clusters${x.dec_min !== null ? `, DEC from ${num(x.dec_min, 2)} to ${num(x.dec_max, 2)} h` : ""})`,
                      ),
                    )
                    .join("; ")}
                  {tx(". Municípios do IBGE sem relação na base:", ". IBGE municipalities with no relation in the database:")}{" "}
                  {g.mapa.correspondencia.ibge_sem_relacao.length
                    ? g.mapa.correspondencia.ibge_sem_relacao.map((x, i) => (
                        <span key={x.codigo}>
                          {i > 0 && ", "}
                          <Nome>{x.nome ?? x.codigo}</Nome> ({x.uf ?? tx("UF não informada", "state not reported")})
                        </span>
                      ))
                    : tx("nenhum", "none")}
                  .
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
                {tx("Reprodução:", "Reproduction:")} <code className="break-all text-xs">
                  <Nome>python3 pipeline/energia/executar_modulo.py qualidade --sem-coleta</Nome>
                </code>.{" "}
                {tx("Regras gerais em", "General rules in the")}{" "}
                <Link href="/setor-eletrico/metodologia" className="text-energia-dark underline underline-offset-4">
                  {tx("metodologia", "methodology")}
                </Link>
                {tx("; fórmulas, fontes verificadas e conferências deste módulo no documento", "; formulas, verified sources and checks of this module in the document")}{" "}
                <code className="break-all text-xs">docs/observatorios/energia/modulos/qualidade.md</code> {tx("do", "in the")}{" "}
                <a href="https://github.com/genarolins1975/scrutiniums/tree/main/docs/observatorios" target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                  {tx("repositório público do projeto ↗", "project's public repository ↗")}
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
