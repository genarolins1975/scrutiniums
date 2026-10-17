import { semCaminhosDeArquivo } from "@/lib/energia/bastidor";
import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { SituacaoDoModelo } from "@/components/energia/EstadoModelo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { Numero } from "@/components/energia/Numero";
import { PrevisoesFichas, PrevisoesPesos } from "@/components/energia/PrevisoesModelos";
import {
  PrevisoesAnalise,
  PrevisoesAuditoria,
  PrevisoesCapitulos,
  PrevisoesDatas,
  PrevisoesFichaLinha,
  PrevisoesIndisponivel,
  PrevisoesLegenda,
  PrevisoesPainel,
  PrevisoesRecorte,
  PrevisoesResposta,
  PrevisoesSeguir,
  PrevisoesTermos,
} from "@/components/energia/PrevisoesPagina";
import { PrevisoesReexecucao } from "@/components/energia/PrevisoesReexecucao";
import { TabelaAdaptativa, type ColunaAdaptativa } from "@/components/energia/PrevisoesTabela";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, num, plural } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { traducaoPrevisoes } from "@/lib/energia/i18n/mercado-preco";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import type { Idioma } from "@/lib/idioma";
import {
  colunasAmostra,
  colunasDecisoes,
  colunasDesempenho,
  colunasProspectivo,
  colunasValidacoes,
  GOLD_PREVISOES,
  ROTA_MODELOS,
  rotuloConferencia,
  cartoesModelos,
  coeficientesDoSegmento,
  colunasCoeficientes,
  d7AcimaDe1,
  decisoesPendentes,
  downloadsDoPainel,
  enderecoPainel,
  fichasOrdenadas,
  linhasAmostra,
  linhasCoeficientes,
  linhasDesempenho,
  linhasEntradasFormula,
  linhasModelos,
  linhasProspectivo,
  linhasReexecucao,
  liberacaoEmPalavras,
  listaE,
  matrizModelos,
  metricasModelos,
  minimoCalibracao,
  notaEntradas,
  partirInterno,
  perguntaPainel,
  proximoPainel,
  respostaP014,
  respostaP016,
  revisaoIndependentePendente,
  rotuloEstadoModelo,
  segmentosCoeficientes,
  semCodigosInternos,
  termosPrevisoes,
  textoCoeficientes,
  vereditoP014,
  vereditoP016,
  type LinhaEntradas,
  type LinhaMatrizModelo,
} from "@/lib/energia/previsoes";
import type { ModelosGold } from "@/lib/energia/tipos";
import type { PrevisoesDesempenhoGold } from "@/lib/energia/tipos-previsoes";
import { snapshotLegivel } from "@/lib/energia/visao";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/pld/modelos", {
    title: tx("O que os modelos de previsão do PLD conseguem prever", "What the PLD forecast models can predict"),
    description: tx(
      "Estado de pesquisa, papel, número publicado e protocolo de cada modelo de previsão do PLD (B0, S0, C1, C2-P e C2-H), com entradas, fórmula, pesos do último ajuste, reexecução das previsões arquivadas e a situação do teste fora da amostra e da calibração das faixas.",
      "Research state, role, published number and protocol of each spot price (PLD) forecast model (B0, S0, C1, C2-P and C2-H), with inputs, formula, weights of the latest fit, rerun of the archived forecasts and the status of the out-of-sample test and of band calibration.",
    ),
    alternates: { canonical: ROTA_MODELOS },
  }, anterior);
}

const LINK_MODELO =
  "inline-flex min-h-[44px] items-center font-serif text-lg text-energia-dark underline underline-offset-4 hover:text-carvao [@media(pointer:fine)]:md:min-h-0"; // i18n: dado

function colunasMatriz(idioma: Idioma): ColunaAdaptativa<LinhaMatrizModelo>[] {
  return [
    {
      id: "modelo",
      rotulo: tx("Modelo", "Model", idioma),
      classe: "w-[12rem]",
      celula: (l) => (
        <>
          <Link href={l.href} className={LINK_MODELO}>
            {l.codigo} · {l.nome}
          </Link>
          <span className="block text-xs text-mineral">
            {tx("versão", "version", idioma)} {l.versao}
          </span>
        </>
      ),
    },
    { id: "papel", rotulo: tx("Papel", "Role", idioma), classe: "w-[8.5rem]", celula: (l) => l.papel },
    { id: "situacao", rotulo: tx("Situação", "Status", idioma), classe: "w-[11rem]", celula: (l) => <SituacaoDoModelo situacao={l.situacao} idioma={idioma} /> },
    { id: "comparado", rotulo: tx("Comparado com", "Compared with", idioma), classe: "w-[8.5rem]", celula: (l) => l.comparado },
    { id: "emissao", rotulo: tx("Número publicado", "Published number", idioma), classe: "w-[12rem]", celula: (l) => l.emissao },
    {
      id: "protocolo",
      rotulo: tx("Protocolo", "Protocol", idioma),
      celula: (l) => (
        <>
          {l.protocolo}
          <span className="mt-1 block text-xs text-carvao-muted">
            {tx("Reexecução do arquivo:", "Archive rerun:", idioma)} {l.reexecucao}
          </span>
        </>
      ),
    },
  ];
}

function colunasEntradas(idioma: Idioma): ColunaAdaptativa<LinhaEntradas>[] {
  return [
    {
      id: "modelo",
      rotulo: tx("Modelo", "Model", idioma),
      classe: "w-[12rem]",
      celula: (l) => (
        <Link href={l.href} className={LINK_MODELO}>
          {l.codigo} · {l.nome}
        </Link>
      ),
    },
    {
      id: "entradas",
      rotulo: tx("Entradas", "Inputs", idioma),
      classe: "w-[17rem]",
      celula: (l) =>
        l.entradas ? (
          <ul className="list-disc space-y-0.5 pl-4">
            {l.entradas.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        ) : (
          tx("não publicadas", "not published", idioma)
        ),
    },
    { id: "formula", rotulo: tx("Como calcula", "How it calculates", idioma), celula: (l) => <span className="[overflow-wrap:anywhere]">{l.formula}</span> },
    { id: "pesos", rotulo: tx("Pesos", "Weights", idioma), classe: "w-[13rem]", celula: (l) => l.pesos },
  ];
}

/** Frase fixa da gold de previsões: a forma inglesa pela tabela exata; sem entrada, o texto sai em português marcado. */
function Gold({ texto, regiao = "previsoes-gold" }: { texto: string | null | undefined; regiao?: string }) {
  if (!texto) return null;
  const en = traducaoPrevisoes(texto, idiomaEnergia());
  return en ? <>{en}</> : <TrechoPortugues regiao={regiao}>{texto}</TrechoPortugues>;
}

export default function ModelosPage() {
  const idioma = idiomaEnergia();
  const g = lerGold<PrevisoesDesempenhoGold>(GOLD_PREVISOES);
  if (!integra(g)) return <PrevisoesIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const fichas = fichasOrdenadas(g.fichas);
  const registro = lerGold<ModelosGold>("modelos.json");
  const reg = integra(registro) ? registro : null;
  const cartoes = cartoesModelos(g, reg, idioma);
  const matriz = matrizModelos(g, reg, idioma);
  const entradas = linhasEntradasFormula(fichas, idioma);
  const mm = metricasModelos(g);
  const coef = linhasCoeficientes(fichas, idioma);
  const segmentos = segmentosCoeficientes(fichas, idioma);
  const barras = Object.fromEntries(segmentos.map((s) => [s.id, coeficientesDoSegmento(fichas, s.id, idioma)]));
  const textos = Object.fromEntries(segmentos.map((s) => [s.id, textoCoeficientes(fichas, s.id, idioma)]));
  const acima = d7AcimaDe1(fichas);
  const ajuste = coef[0]?.origem_ajuste ?? null;
  const reexec = linhasReexecucao(g, idioma);
  const amostra = linhasAmostra(g, idioma);
  const prospectivo = linhasProspectivo(g);
  const minimo = minimoCalibracao(g.definicoes.calibracao);
  const estadosAmostra = Array.from(new Set(amostra.map((a) => a.estado)));
  const versao = g.gerado_em.slice(0, 10);
  const fonte = tx("Observatório, registro de modelos de previsão do PLD", "Observatory, PLD forecast model registry");
  const pubDes = g.publicacao_desempenho;
  const pendentes = decisoesPendentes(g, idioma);
  const revisaoPendente = revisaoIndependentePendente(g);
  const decisoes = g.governanca.decisao_revisavel.map((d, i) => ({
    id: `d${i}`,
    item: d.item,
    estado: d.estado ?? tx("sem estado", "no state"),
    responsavel: d.responsavel ?? tx("não indicado", "not stated"),
    evidencia: d.evidencia ?? tx("sem evidência registrada", "no evidence recorded"),
  }));
  const validacoes = g.validacoes.map((v, i) => ({ id: `v${i}`, nome: v.nome, resultado: rotuloConferencia(v.resultado, idioma), detalhe: v.detalhe }));
  const avaliados = g.modelos.filter((m) => m.avaliado).map((m) => m.codigo);
  const naoAvaliados = g.modelos.filter((m) => !m.avaliado);
  const desempenho = g.desempenho.publicado ? linhasDesempenho(g.desempenho.por_horizonte) : [];
  const termos = termosPrevisoes(g.definicoes, idioma);
  const dia = g.gerado_em.slice(0, 10);
  const tolerancia = fichas.find((f) => f.reproducao?.reexecucao_do_arquivo)?.reproducao?.reexecucao_do_arquivo?.tolerancia;

  const configuracaoIgual = g.dados.configuracao_registrada_sha256 === g.dados.configuracao_sha256;
  const oQueMudou14 = (
    <>
      {tx(
        `${ajuste ? `Último ajuste dos candidatos C2 em ${dataBR(ajuste)} (os pesos mudam a cada domingo). ` : ""}A configuração registrada dos modelos é ${configuracaoIgual ? "igual" : "diferente"} à usada para calcular esta página.${pendentes.length ? ` ${plural(pendentes.length, "decisão da governança segue pendente", "decisões da governança seguem pendentes")} (lista em Auditar).` : ""}`,
        `${ajuste ? `Latest fit of the C2 candidates on ${dataBR(ajuste)} (the weights change every Sunday). ` : ""}The registered configuration of the models is ${configuracaoIgual ? "the same as" : "different from"} the one used to calculate this page.${pendentes.length ? ` ${plural(pendentes.length, "governance decision remains pending", "governance decisions remain pending", idioma)} (list in Audit).` : ""}`,
      )}
    </>
  );
  const comoInterpretar14 = (
    <>
      {tx(
        "Pesquisa quer dizer que o modelo está em estudo e não alimenta a previsão principal; referência experimental, que o número é publicado e identificado como tal, sem aprovação; produção, que o modelo está aprovado. B0 e S0 são referências simples: repetir o último período ou o mesmo período do ano anterior. Os candidatos C2 partem do B0 e somam correções pesadas pelos coeficientes; coeficiente zero não corrige, e acima de 1 na média dos 7 dias amplia o desvio recente.",
        "Research means the model is under study and does not feed the main forecast; experimental benchmark, that the number is published and identified as such, without approval; production, that the model is approved. B0 and S0 are simple benchmarks: repeating the last period or the same period of the previous year. The C2 candidates start from B0 and add corrections weighted by the coefficients; a zero coefficient does not correct, and above 1 in the 7-day average it widens the recent deviation.",
      )}
    </>
  );
  const naoConcluir14 = (
    <>
      {tx(
        `Situação, número publicado e protocolo não dizem se um modelo acerta: isso é o painel de desempenho. Coeficiente grande não quer dizer que a variável cause o preço. A reexecução refaz o número arquivado com o dado do corte; é uma conferência do próprio observatório e não substitui a revisão metodológica independente${revisaoPendente ? ", que está pendente" : ""}.`,
        `Status, published number and protocol do not say whether a model is accurate: that is the performance panel. A large coefficient does not mean the variable drives the price. The rerun redoes the archived number with the data as of the cutoff; it is the observatory's own check and does not replace the independent methodological review${revisaoPendente ? ", which is pending" : ""}.`,
      )}{" "}
      {fichas
        .filter((f) => !f.implementado_no_repositorio)
        .map((f) => tx(`Os pesos do ${f.codigo} não são publicáveis e não foram reconstruídos.`, `The weights of ${f.codigo} are not publishable and were not reconstructed.`))
        .join(" ")}
    </>
  );
  const oQueMudou16 = (
    <>
      {pubDes.publicado
        ? tx("Números de desempenho liberados para o portal.", "Performance numbers released to the portal.")
        : tx(
            `Decisão de publicação: ${pubDes.decisao?.estado === "PENDENTE" || !pubDes.decisao ? "pendente" : (pubDes.decisao?.estado ?? "").toLowerCase()}.`,
            `Publication decision: ${pubDes.decisao?.estado === "PENDENTE" || !pubDes.decisao ? "pending" : (pubDes.decisao?.estado ?? "").toLowerCase()}.`,
          )}{" "}
      <Gold texto={g.prospectivo.leitura} />
    </>
  );
  const comoInterpretar16 = (
    <>
      {tx(
        `O teste fora da amostra refaz, para cada dia desde ${dataBR(g.dados.origens.inicio)}, a previsão com o dado disponível naquele corte (um dado só entra se o seu período terminou até 1 dia antes do corte) e a compara com o realizado; o acompanhamento depois da emissão usa só rodadas registradas antes do resultado. Uma faixa é calibrada quando contém o realizado na proporção prometida, medida em entregas distintas, não em origens.`,
        `The out-of-sample test redoes, for each day since ${dataBR(g.dados.origens.inicio)}, the forecast with the data available at that cutoff (a piece of data only enters if its period ended up to 1 day before the cutoff) and compares it with the actual value; the follow-up after issue uses only runs recorded before the outcome. A band is calibrated when it contains the actual value in the promised proportion, measured in distinct deliveries, not in origins.`,
      )}
    </>
  );
  const naoConcluir16 = (
    <>
      {pubDes.publicado
        ? tx("Ganho pequeno com intervalo que inclui zero não mostra que um modelo supera outro.", "A small gain with an interval that includes zero does not show that one model beats another.")
        : tx("Enquanto os números estiverem retidos, nada aqui diz que um modelo supera outro.", "While the numbers are withheld, nothing here says that one model beats another.")}{" "}
      {tx(
        "Teste com dados do passado é reconstrução sob hipótese, não operação real. Origens vizinhas preveem a mesma entrega: o tamanho que conta é o de entregas distintas, e a contagem de controles que passam não mede a capacidade de prever.",
        "A test with past data is a reconstruction under a hypothesis, not real operation. Neighboring origins forecast the same delivery: the size that counts is that of distinct deliveries, and the count of checks that pass does not measure forecasting ability.",
      )}
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="pld-modelos" />
      <MarcaVisita secao="energia:pld-modelos" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["PLD", "MLT", "CCEE", "ONS", "EAR", "ENA"]}
          titulo={tx("O que os modelos conseguem prever?", "What can the models predict?")}
          lead={tx(
            "O estado de cada modelo de previsão do Preço de Liquidação das Diferenças (PLD), o que ele publica e o que já se pode afirmar sobre o acerto fora da amostra.",
            "The state of each forecast model for the spot price (PLD), what it publishes and what can already be said about its out-of-sample accuracy.",
          )}
          recorte={tx(
            `Registro de ${dataBR(dia)} · ${plural(fichas.length, "modelo", "modelos")} · 7 horizontes e 4 submercados · R$/MWh nominais`,
            `Registry of ${dataBR(dia)} · ${plural(fichas.length, "model", "models", idioma)} · 7 horizons and 4 submarkets · nominal R$/MWh`,
          )}
          fonte={tx("Observatório, registro de modelos de previsão do PLD", "Observatory, PLD forecast model registry")}
          referencia={
            <>
              {tx(
                `${plural(fichas.length, "modelo registrado", "modelos registrados")}; teste fora da amostra com ${g.dados.origens.n.toLocaleString("pt-BR")} origens diárias; processado em ${carimbo(g.gerado_em)}.`,
                `${plural(fichas.length, "registered model", "registered models", idioma)}; out-of-sample test with ${num(g.dados.origens.n, 0)} daily origins; processed on ${carimbo(g.gerado_em)}.`,
              )}
              <span data-nivel="analisar">{tx(` Configuração sha256 ${g.dados.configuracao_sha256.slice(0, 12)}.`, ` Configuration sha256 ${g.dados.configuracao_sha256.slice(0, 12)}.`)}</span>
            </>
          }
          datas={
            <PrevisoesDatas
              itens={[
                { rotulo: tx("Registro de modelos", "Model registry"), texto: tx(`processado em ${carimbo(g.gerado_em)}`, `processed on ${carimbo(g.gerado_em)}`), natureza: "CALCULADO" },
                { rotulo: tx("PLD horário", "Hourly PLD"), texto: tx(`até ${dataBR(g.dados.ultimo_dia_pld)}`, `through ${dataBR(g.dados.ultimo_dia_pld)}`), natureza: "OBSERVADO" },
                {
                  rotulo: "EAR",
                  texto: g.dados.ultimo_dia_ear ? tx(`até ${dataBR(g.dados.ultimo_dia_ear)}`, `through ${dataBR(g.dados.ultimo_dia_ear)}`) : tx("sem dado nesta publicação", "no data in this publication"),
                  natureza: "OBSERVADO",
                },
                {
                  rotulo: "ENA",
                  texto: g.dados.ultimo_dia_ena ? tx(`até ${dataBR(g.dados.ultimo_dia_ena)}`, `through ${dataBR(g.dados.ultimo_dia_ena)}`) : tx("sem dado nesta publicação", "no data in this publication"),
                  natureza: "OBSERVADO",
                },
                {
                  rotulo: tx("Pesos dos candidatos C2", "Weights of the C2 candidates"),
                  texto: ajuste ? tx(`ajuste de ${dataBR(ajuste)}`, `fit of ${dataBR(ajuste)}`) : tx("sem ajuste registrado", "no fit recorded"),
                  natureza: "CALCULADO",
                },
                {
                  rotulo: tx("Teste fora da amostra", "Out-of-sample test"),
                  texto: tx(`origens de ${dataBR(g.dados.origens.inicio)} a ${dataBR(g.dados.origens.fim)}`, `origins from ${dataBR(g.dados.origens.inicio)} to ${dataBR(g.dados.origens.fim)}`),
                  natureza: "CALCULADO",
                },
              ]}
            />
          }
          metricas={
            <FaixaMetricas colunas={4} rotulo={tx("Indicadores do registro de modelos", "Model registry indicators")}>
              <Numero
                variante="faixa"
                rotulo={tx("Modelos registrados", "Registered models")}
                natureza="CALCULADO"
                valor={mm.registrados.length}
                formato="num"
                casas={0}
                unidade={mm.registrados.length === 1 ? tx("modelo", "model") : tx("modelos", "models")}
                periodo={tx(`registro de ${dataBR(dia)}`, `registry of ${dataBR(dia)}`)}
                cor="var(--cor-energia)"
                nota={listaE(mm.registrados, idioma)}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Em produção", "In production")}
                natureza="CALCULADO"
                valor={mm.emProducao.length}
                formato="num"
                casas={0}
                unidade={mm.emProducao.length === 1 ? tx("modelo", "model") : tx("modelos", "models")}
                periodo={tx(`registro de ${dataBR(dia)}`, `registry of ${dataBR(dia)}`)}
                cor="var(--serie-referencia)"
                nota={tx("Produção alimenta a previsão principal.", "Production feeds the main forecast.")}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Com número publicado", "With a published number")}
                natureza="CALCULADO"
                valor={mm.comNumero.length}
                formato="num"
                casas={0}
                unidade={mm.comNumero.length === 1 ? tx("modelo", "model") : tx("modelos", "models")}
                periodo={tx("arquivo de emissões", "forecast archive")}
                cor="var(--cor-energia)"
                nota={
                  mm.comNumeroExperimental.length
                    ? tx(`${listaE(mm.comNumeroExperimental)}, como referência experimental.`, `${listaE(mm.comNumeroExperimental, idioma)}, as an experimental benchmark.`)
                    : undefined
                }
              />
              <Numero
                variante="faixa"
                rotulo={tx("Com desempenho publicado", "With published performance")}
                natureza="CALCULADO"
                valor={mm.desempenhoPublicado.length}
                formato="num"
                casas={0}
                unidade={tx(`de ${mm.avaliados.length} avaliados`, `of ${mm.avaliados.length} evaluated`)}
                periodo={tx("teste fora da amostra", "out-of-sample test")}
                cor="var(--serie-referencia)"
                nota={mm.publicado ? undefined : tx("Números retidos até a liberação formal.", "Numbers withheld until formal release.")}
              />
            </FaixaMetricas>
          }
        >
          {tx(
            "Cada modelo tem uma ficha com entradas, fórmula, pesos, corte, hipóteses, aprovação e limitações, e cada previsão arquivada pode ser refeita. O segundo painel diz o que já se pode afirmar sobre o desempenho: o teste fora da amostra, o acompanhamento depois de cada rodada e a calibração das faixas.",
            "Each model has a sheet with inputs, formula, weights, cutoff, hypotheses, approval and limitations, and each archived forecast can be redone. The second panel says what can already be stated about performance: the out-of-sample test, the follow-up after each run and band calibration.",
          )}
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="registro">
            <PrevisoesPainel id="p014">
              <PainelEvidencia
                id="p014"
                pergunta={perguntaPainel("p014")}
                subtitulo={tx(
                  "Registro de modelos: situação, número publicado e protocolo · entradas, fórmulas e pesos · reexecução do arquivo",
                  "Model registry: status, published number and protocol · inputs, formulas and weights · archive rerun",
                )}
                natureza="PREVISTO"
                porQueImporta={tx(
                  "Um número de previsão sem a receita não pode ser conferido nem comparado. A ficha diz que informação entra, como é transformada, o que estava disponível no corte e quem aprovou o uso; a reexecução mostra que o número arquivado sai de novo do mesmo dado.",
                  "A forecast number without its recipe cannot be checked or compared. The sheet says what information goes in, how it is transformed, what was available at the cutoff and who approved its use; the rerun shows that the archived number comes out again from the same data.",
                )}
                oQueMudou={oQueMudou14}
                comoInterpretar={comoInterpretar14}
                naoConcluir={naoConcluir14}
                naoConcluirNoCorpo
                proveniencia={g.proveniencia}
              >
                <div className="space-y-6">
                  <PrevisoesResposta id="p014" veredito={vereditoP014(g, idioma)}>
                    {respostaP014(g, idioma)}
                  </PrevisoesResposta>
                  <section aria-labelledby="matriz-titulo" className="space-y-3" data-matriz-modelos="">
                    <h3 id="matriz-titulo" className="ed-h3 font-serif text-carvao">
                      {tx(
                        `${plural(fichas.length, "modelo registrado", "modelos registrados")}: situação, número publicado e protocolo`,
                        `${plural(fichas.length, "registered model", "registered models", idioma)}: status, published number and protocol`,
                      )}
                    </h3>
                    <TabelaAdaptativa
                      legenda={tx(
                        "Modelos de previsão do PLD: papel, situação, referência de comparação, número publicado e protocolo",
                        "PLD forecast models: role, status, comparison benchmark, published number and protocol",
                      )}
                      colunas={colunasMatriz(idioma)}
                      linhas={matriz}
                      nome="matriz-modelos"
                    />
                    <PrevisoesLegenda>
                      {tx(
                        <>
                          <span className="font-medium text-carvao">Pesquisa</span>: o modelo está em estudo e não alimenta previsão.{" "}
                          <span className="font-medium text-carvao">Referência experimental</span>: em pesquisa, com número publicado e identificado como tal, sem aprovação.{" "}
                          <span className="font-medium text-carvao">Produção</span>: aprovado, alimenta a previsão principal. São situações diferentes, e o número de controles
                          que passam não mede a capacidade de prever.
                        </>,
                        <>
                          <span className="font-medium text-carvao">Research</span>: the model is under study and does not feed a forecast.{" "}
                          <span className="font-medium text-carvao">Experimental benchmark</span>: in research, with a published number identified as such, without approval.{" "}
                          <span className="font-medium text-carvao">Production</span>: approved, feeds the main forecast. They are different situations, and the number of checks
                          that pass does not measure forecasting ability.
                        </>,
                      )}
                    </PrevisoesLegenda>
                    <PrevisoesLegenda>
                      {tx("Protocolo do teste fora da amostra, igual para os modelos avaliados: seleção com as", "Out-of-sample test protocol, the same for the evaluated models: selection with the")}{" "}
                      <Gold texto={g.definicoes.periodos.desenvolvimento} />
                      {tx("; teste final com as", "; final test with the")} <Gold texto={g.definicoes.periodos.teste} />; <Gold texto={g.definicoes.periodos.fronteira} />.{" "}
                      <Gold texto={semCodigosInternos(g.definicoes.cenario_de_elegibilidade)} />
                    </PrevisoesLegenda>
                  </section>

                  <PrevisoesRecorte
                    periodo={tx(
                      `Versões vigentes em ${carimbo(g.gerado_em)}${ajuste ? `; pesos do ajuste de ${dataBR(ajuste)}` : ""}`,
                      `Versions in force on ${carimbo(g.gerado_em)}${ajuste ? `; weights from the fit of ${dataBR(ajuste)}` : ""}`,
                    )}
                    universo={tx(
                      `${fichas.map((f) => f.codigo).join(", ")}; sete horizontes e quatro submercados`,
                      `${fichas.map((f) => f.codigo).join(", ")}; seven horizons and four submarkets`,
                    )}
                    unidade={tx(
                      "R$/MWh nas previsões; coeficientes em R$/MWh de correção por R$/MWh (ou por ponto percentual) da variável",
                      "R$/MWh in the forecasts; coefficients in R$/MWh of correction per R$/MWh (or per percentage point) of the variable",
                    )}
                  />


                  <NotasDoPainel oQueMudou={oQueMudou14} comoInterpretar={comoInterpretar14} naoConcluir={naoConcluir14} />

                  <PrevisoesCapitulos pagina="modelos" />

                  <SecaoDoPainel id="entradas" titulo={tx("O que cada modelo recebe e como calcula", "What each model receives and how it calculates")}>
                    <TabelaAdaptativa
                      legenda={tx("Entradas, fórmula em palavras e pesos de cada modelo registrado", "Inputs, formula in words and weights of each registered model")}
                      colunas={colunasEntradas(idioma)}
                      linhas={entradas}
                      nome="entradas-formula"
                    />
                    {notaEntradas({ entradas: fichas.flatMap((f) => f.entradas ?? []) }, idioma) && (
                      <PrevisoesLegenda>{notaEntradas({ entradas: fichas.flatMap((f) => f.entradas ?? []) }, idioma)}</PrevisoesLegenda>
                    )}
                    <PrevisoesTermos itens={termos} />
                  </SecaoDoPainel>

                  {reexec.length > 0 && (
                    <SecaoDoPainel
                      id="reexecucao"
                      titulo={tx("Os números arquivados do B0 se repetem com o dado do corte?", "Do the archived B0 numbers repeat with the data as of the cutoff?")}
                      lead={tx(
                        "Cada valor abaixo é o número arquivado na rodada mais recente; a prova de cada um mostra as horas somadas, os arquivos da CCEE capturados até o corte e o resultado da reexecução.",
                        "Each value below is the number archived in the latest run; the evidence for each one shows the hours added up, the CCEE files captured up to the cutoff and the rerun result.",
                      )}
                    >
                      <PrevisoesReexecucao linhas={reexec} evidencias={g.evidencias} endereco={enderecoPainel("p014")} tolerancia={tolerancia} />
                    </SecaoDoPainel>
                  )}

                  <SecaoDoPainel id="pesos" titulo={tx("Pesos do último ajuste dos candidatos C2, por segmento", "Weights of the latest fit of the C2 candidates, by segment")} nivel="analisar">
                    <PrevisoesPesos
                      coeficientes={coef}
                      colunasCoeficientes={colunasCoeficientes(fichas, idioma)}
                      segmentos={segmentos}
                      barras={barras}
                      textos={textos}
                      segmentoPadrao={segmentos[0]?.id ?? ""}
                      fonte={fonte}
                      versao={versao}
                    />
                    <PrevisoesLegenda>
                      {tx(
                        "A barra à direita do zero soma ao B0 quando a variável é positiva, e à esquerda subtrai. A linha 1 marca o ponto a partir do qual a correção pela média dos 7 dias amplia o desvio. Os coeficientes são do último ajuste e mudam a cada domingo.",
                        "A bar to the right of zero adds to B0 when the variable is positive, and to the left it subtracts. Line 1 marks the point from which the correction by the 7-day average widens the deviation. The coefficients are from the latest fit and change every Sunday.",
                      )}{" "}
                      {acima.length
                        ? tx(
                            `No último ajuste, ${plural(acima.length, "segmento passa", "segmentos passam")} de 1 na média dos 7 dias (${acima.map((a) => `${a.modelo} ${a.segmento}`).join(", ")}), um sinal de que a correção amplia o desvio recente em vez de reduzi-lo.`,
                            `In the latest fit, ${plural(acima.length, "segment exceeds", "segments exceed", idioma)} 1 in the 7-day average (${acima.map((a) => `${a.modelo} ${a.segmento}`).join(", ")}), a sign that the correction widens the recent deviation instead of reducing it.`,
                          )
                        : tx("No último ajuste, nenhum segmento passa de 1 na média dos 7 dias.", "In the latest fit, no segment exceeds 1 in the 7-day average.")}
                    </PrevisoesLegenda>
                  </SecaoDoPainel>

                  <SecaoDoPainel id="fichas" titulo={tx("Como as fichas dos modelos se comparam lado a lado?", "How do the model sheets compare side by side?")} nivel="analisar">
                    <PrevisoesFichas cartoes={cartoes} linhasModelos={linhasModelos(g, idioma)} fonte={fonte} versao={versao} />
                  </SecaoDoPainel>

                  <PrevisoesAuditoria id="configuracao" titulo={tx("Configuração congelada, dados de entrada e pendências da governança", "Frozen configuration, input data and governance pending items")}>
                    <dl>
                      <PrevisoesFichaLinha rotulo={tx("Configuração", "Configuration")}>
                        sha256 <span className="font-mono text-xs">{g.dados.configuracao_sha256}</span>;{" "}
                        {g.dados.configuracao_registrada_sha256 === g.dados.configuracao_sha256
                          ? tx("confere com a registrada no registro de modelos", "matches the one recorded in the model registry")
                          : tx("diferente da registrada no registro de modelos", "different from the one recorded in the model registry")}
                        .
                      </PrevisoesFichaLinha>
                      {Object.entries(g.dados.snapshots).map(([k, s]) => (
                        <PrevisoesFichaLinha key={k} rotulo={tx(`Dado ${k}`, `Data ${k}`)}>
                          {tx(
                            `${s.id ? snapshotLegivel(s.id) : "sem identificador"}; última captura ${carimbo(s.ultima_captura)}; ${s.revisoes ?? 0} revisões detectadas`,
                            `${s.id ? snapshotLegivel(s.id) : "no identifier"}; latest capture ${carimbo(s.ultima_captura)}; ${s.revisoes ?? 0} revisions detected`,
                          )}
                        </PrevisoesFichaLinha>
                      ))}
                      {(["ear", "ena"] as const).map((k) => (
                        <PrevisoesFichaLinha key={k} rotulo={tx(`Dicionário ONS (${k.toUpperCase()})`, `ONS dictionary (${k.toUpperCase()})`)}>
                          <TrechoPortugues regiao="previsoes-dicionario">{g.dados.dicionarios_ons[k].leitura}</TrechoPortugues>{" "}
                          <a href={g.dados.dicionarios_ons[k].url} className="text-energia-dark underline underline-offset-4 [overflow-wrap:anywhere]">
                            {tx("dicionário em PDF", "dictionary in PDF")}
                          </a>
                        </PrevisoesFichaLinha>
                      ))}
                      <PrevisoesFichaLinha rotulo={tx("Integrado até", "Integrated through")}>
                        {tx("PLD até", "PLD through")} {dataBR(g.dados.ultimo_dia_pld)}; <Termo slug="ear">EAR</Termo> {tx("até", "through")} {dataBR(g.dados.ultimo_dia_ear)};{" "}
                        <Termo slug="ena">ENA</Termo> {tx("até", "through")} {dataBR(g.dados.ultimo_dia_ena)}
                      </PrevisoesFichaLinha>
                      <PrevisoesFichaLinha rotulo={tx("Estados", "States")}>
                        <TrechoPortugues regiao="previsoes-governanca">{g.governanca.estados}</TrechoPortugues>
                      </PrevisoesFichaLinha>
                      {g.governanca.pendencias.map((p) => (
                        <PrevisoesFichaLinha key={p.id} rotulo={`${p.id}: ${p.titulo}`}>
                          <TrechoPortugues regiao="previsoes-governanca">
                            {p.descricao} Encaminhamento: {p.encaminhamento} Responsável: {p.responsavel}. Estado: {p.estado.replace(/_/g, " ").toLowerCase()}.
                          </TrechoPortugues>
                        </PrevisoesFichaLinha>
                      ))}
                    </dl>
                    <TabelaInterativa
                      titulo={tx("Decisões revisáveis e quem as toma", "Reviewable decisions and who takes them")}
                      colunas={colunasDecisoes(idioma)}
                      linhas={decisoes}
                      chaveLinha="id"
                      colunaRotulo="item"
                      fonte={fonte}
                      versao={versao}
                      nomeArquivo="previsoes-pld-decisoes-revisaveis"
                    />
                  </PrevisoesAuditoria>

                  <PrevisoesSeguir
                    ancora="p014"
                    proximo={{ href: `#${proximoPainel("p014").id}`, pergunta: proximoPainel("p014", idioma).pergunta }}
                    downloads={downloadsDoPainel(g, "p014")}
                  />
                </div>
              </PainelEvidencia>
            </PrevisoesPainel>
          </Bloco>

          <Bloco id="desempenho">
            <PrevisoesPainel id="p016">
              <PainelEvidencia
                id="p016"
                pergunta={perguntaPainel("p016")}
                subtitulo={tx(
                  "Desempenho e calibração: teste fora da amostra, acompanhamento depois da emissão e calibração das faixas · entregas e R$/MWh",
                  "Performance and calibration: out-of-sample test, follow-up after issue and band calibration · deliveries and R$/MWh",
                )}
                natureza="PREVISTO"
                porQueImporta={tx(
                  "Um modelo só se distingue da referência simples se errar menos que repetir o último preço (B0) ou o do ano anterior (S0), em amostra que ele não viu e com a informação disponível em cada corte. Sem isso, um gráfico de previsão não diz nada sobre acerto.",
                  "A model only stands out from the simple benchmark if it errs less than repeating the last price (B0) or last year's (S0), on a sample it has not seen and with the information available at each cutoff. Without that, a forecast chart says nothing about accuracy.",
                )}
                oQueMudou={oQueMudou16}
                comoInterpretar={comoInterpretar16}
                naoConcluir={naoConcluir16}
                naoConcluirNoCorpo
                proveniencia={g.proveniencia}
              >
                <div className="space-y-6">
                  <PrevisoesResposta id="p016" veredito={vereditoP016(g, idioma)}>
                    {respostaP016(g, idioma)}
                  </PrevisoesResposta>
                  {!pubDes.publicado && (
                    <Indisponivel
                      titulo={tx("Desempenho fora da amostra: números retidos", "Out-of-sample performance: numbers withheld")}
                      motivo={
                        <>
                          <p>
                            <span className="font-medium">{tx("Por que não há números de desempenho aqui:", "Why there are no performance numbers here:")}</span>{" "}
                            <Gold texto={partirInterno(pubDes.motivo).leitor || pubDes.motivo} />
                          </p>
                          <p className="mt-2">
                            <span className="font-medium">{tx("O que libera a publicação:", "What releases the publication:")}</span> {liberacaoEmPalavras(pubDes.para_liberar, idioma)}
                          </p>
                          <p className="mt-2 text-carvao-muted">
                            {tx(
                              "Quando liberados, o erro médio absoluto (MAE), o ganho sobre o B0 e a cobertura entram aqui por modelo e horizonte, nas mesmas células do B0 e com o número de entregas distintas de cada recorte.",
                              "When released, the mean absolute error (MAE), the gain over B0 and the coverage go here by model and horizon, in the same cells as B0 and with the number of distinct deliveries of each selection.",
                            )}
                          </p>
                          <div data-nivel="analisar" className="mt-3 border-t border-linha pt-2 text-xs text-carvao-muted">
                            <p className="rotulo text-mineral">{tx("Texto do registro, sem edição", "Registry text, unedited")}</p>
                            <p className="mt-1">
                              <TrechoPortugues regiao="previsoes-publicacao">{pubDes.motivo}</TrechoPortugues>
                            </p>
                            <p className="mt-1">
                              <TrechoPortugues regiao="previsoes-publicacao">{pubDes.para_liberar}</TrechoPortugues>
                            </p>
                          </div>
                        </>
                      }
                    />
                  )}

                  <PrevisoesRecorte
                    periodo={
                      <>
                        {tx(`Origens de ${dataBR(g.dados.origens.inicio)} a ${dataBR(g.dados.origens.fim)};`, `Origins from ${dataBR(g.dados.origens.inicio)} to ${dataBR(g.dados.origens.fim)};`)}{" "}
                        <Gold texto={g.definicoes.periodos.desenvolvimento} />; <Gold texto={g.definicoes.periodos.teste} />
                      </>
                    }
                    universo={tx(
                      `Modelos avaliados: ${avaliados.join(", ")}${naoAvaliados.length ? ` (sem avaliação: ${naoAvaliados.map((m) => m.codigo).join(", ")})` : ""}; sete horizontes; quatro submercados`,
                      `Models evaluated: ${avaliados.join(", ")}${naoAvaliados.length ? ` (not evaluated: ${naoAvaliados.map((m) => m.codigo).join(", ")})` : ""}; seven horizons; four submarkets`,
                    )}
                    unidade={tx("Entregas distintas; R$/MWh nominais para erro e ganho", "Distinct deliveries; nominal R$/MWh for error and gain")}
                  />

                  {g.desempenho.publicado && desempenho.length > 0 && (
                    <SecaoDoPainel
                      id="desempenho-fora-da-amostra"
                      titulo={tx("Quanto cada modelo erra no teste final, contra o B0 nas mesmas células?", "How much does each model err in the final test, against B0 in the same cells?")}
                      lead={tx(
                        "Erro médio absoluto (MAE) por modelo e horizonte no período de teste, com o MAE do B0 nas mesmas células e o número de entregas distintas de cada recorte.",
                        "Mean absolute error (MAE) by model and horizon in the test period, with the B0 MAE in the same cells and the number of distinct deliveries of each selection.",
                      )}
                    >
                      <GraficoPontos
                        titulo={tx("MAE no teste final por modelo e horizonte, contra o B0 nas mesmas células", "MAE in the final test by model and horizon, against B0 in the same cells")}
                        itens={desempenho
                          .filter((l) => l.periodo === "teste" && l.modelo !== "B0")
                          .map((l) => ({ id: l.id, rotulo: `${l.modelo} ${l.horizonte}`, valor: l.mae, referencia: l.mae_b0, detalhe: tx(`${l.entregas} entregas distintas`, `${l.entregas} distinct deliveries`) }))}
                        unidade="R$/MWh"
                        casas={2}
                        rotuloValor={tx("MAE do modelo", "Model MAE")}
                        rotuloReferencia={tx("MAE do B0", "B0 MAE")}
                      />
                      <TabelaInterativa
                        titulo={tx("Métricas por modelo, horizonte e período", "Metrics by model, horizon and period")}
                        colunas={colunasDesempenho(idioma)}
                        linhas={desempenho}
                        chaveLinha="id"
                        colunaRotulo="modelo"
                        fonte={fonte}
                        versao={versao}
                        nomeArquivo="previsoes-pld-desempenho"
                        chaveUrl="des"
                      />
                    </SecaoDoPainel>
                  )}

                  {amostra.length > 0 && (
                    <SecaoDoPainel
                      id="calibracao"
                      titulo={tx("Há entregas suficientes para calibrar uma faixa de incerteza?", "Are there enough deliveries to calibrate an uncertainty band?")}
                      lead={
                        minimo !== null
                          ? tx(
                              `A regra pede pelo menos ${minimo} entregas distintas fora do ajuste em cada horizonte. Semanas (W1 a W4) e meses (M1 a M3) têm amostras diferentes.`,
                              `The rule requires at least ${minimo} distinct deliveries outside the fit in each horizon. Weeks (W1 to W4) and months (M1 to M3) have different samples.`,
                            )
                          : tx("Semanas (W1 a W4) e meses (M1 a M3) têm amostras diferentes.", "Weeks (W1 to W4) and months (M1 to M3) have different samples.")
                      }
                    >
                      <GraficoPontos
                        titulo={tx("Entregas distintas do teste por horizonte, contra o mínimo para calibrar a faixa", "Distinct test deliveries by horizon, against the minimum to calibrate the band")}
                        itens={amostra.map((a) => ({ id: a.id, rotulo: a.horizonte, valor: a.entregas, referencia: a.minimo, detalhe: tx(`estado: ${a.estado}`, `state: ${a.estado}`) }))}
                        unidade={tx("entregas", "deliveries")}
                        casas={0}
                        rotuloValor={tx("Entregas no teste", "Deliveries in the test")}
                        rotuloReferencia={minimo !== null ? tx(`Mínimo de ${minimo}`, `Minimum of ${minimo}`) : tx("Mínimo para calibrar", "Minimum to calibrate")}
                        unidadeDiferenca={tx("entregas", "deliveries")}
                        zeroNoEixo
                      />
                      <div data-nivel="analisar">
                        <TabelaInterativa
                          titulo={tx("Amostra de calibração por horizonte", "Calibration sample by horizon")}
                          colunas={colunasAmostra(idioma)}
                          linhas={amostra}
                          chaveLinha="id"
                          colunaRotulo="horizonte"
                          fonte={fonte}
                          versao={versao}
                          nomeArquivo="previsoes-pld-amostra-calibracao"
                          nota={tx(
                            "Contagem de entregas distintas do período de teste com faixas de incerteza, gravada em cada célula da rodada mais recente; a cobertura medida está retida com os demais números de desempenho.",
                            "Count of distinct deliveries of the test period with uncertainty bands, recorded in each cell of the latest run; the measured coverage is withheld with the other performance numbers.",
                          )}
                        />
                      </div>
                      <PrevisoesLegenda>
                        {tx(
                          `O círculo é o número de entregas distintas do teste em cada horizonte e o losango, o mínimo da regra de calibração; a diferença aparece escrita. Estado da calibração: ${estadosAmostra.length === 1 ? `${estadosAmostra[0]} em todos os horizontes` : amostra.map((a) => `${a.horizonte}, ${a.estado}`).join("; ")}. Sem amostra mínima, a calibração não é avaliada: não se pode dizer que a faixa de algum modelo é confiável.`,
                          `The circle is the number of distinct test deliveries in each horizon and the diamond, the minimum of the calibration rule; the difference is written out. Calibration state: ${estadosAmostra.length === 1 ? `${estadosAmostra[0]} in all horizons` : amostra.map((a) => `${a.horizonte}, ${a.estado}`).join("; ")}. Without the minimum sample, calibration is not evaluated: it cannot be said that any model's band is reliable.`,
                        )}
                      </PrevisoesLegenda>
                    </SecaoDoPainel>
                  )}

                  <NotasDoPainel oQueMudou={oQueMudou16} comoInterpretar={comoInterpretar16} naoConcluir={naoConcluir16} />

                  {prospectivo.length > 0 && (
                    <SecaoDoPainel
                      id="acompanhamento"
                      titulo={tx("Quantas previsões em acompanhamento já têm resultado?", "How many forecasts being followed already have an outcome?")}
                      lead={tx(
                        "Cada previsão com número só ganha realizado quando a entrega termina. A contagem de previsões apuradas não é medida de acerto.",
                        "Each forecast with a number only gets an actual value when the delivery ends. The count of settled forecasts is not a measure of accuracy.",
                      )}
                    >
                      <GraficoBarras
                        titulo={tx("Acompanhamento prospectivo: previsões com número por horizonte, com e sem realizado", "Prospective follow-up: forecasts with a number by horizon, with and without an actual value")}
                        dados={prospectivo}
                        chaveCategoria="id"
                        chaveRotulo="horizonte"
                        series={[
                          { id: "apuradas", rotulo: tx("com realizado", "with actual"), cor: "var(--cor-energia)" }, // i18n: dado
                          { id: "aguardando", rotulo: tx("aguardando o fim da entrega", "waiting for the delivery to end"), cor: "var(--cor-mineral-soft)" },
                        ]}
                        unidade={tx("previsões", "forecasts")}
                        casas={0}
                        empilhado
                        rotulosValor
                        altura={200}
                      />
                      <div data-nivel="analisar">
                        <TabelaInterativa
                          titulo={tx("Previsões registradas e apuradas por horizonte", "Forecasts recorded and settled by horizon")}
                          colunas={colunasProspectivo(idioma)}
                          linhas={prospectivo}
                          chaveLinha="id"
                          colunaRotulo="horizonte"
                          fonte={fonte}
                          versao={versao}
                          nomeArquivo="previsoes-pld-prospectivo"
                        />
                      </div>
                      <PrevisoesLegenda>
                        {tx(
                          "Cada barra soma as previsões com número de um horizonte, separando as que já têm realizado das que aguardam o fim da entrega.",
                          "Each bar adds up the forecasts with a number of one horizon, separating those that already have an actual value from those waiting for the delivery to end.",
                        )}
                      </PrevisoesLegenda>
                    </SecaoDoPainel>
                  )}

                  <PrevisoesAnalise id="metodo" titulo={tx("Como o desempenho é medido", "How performance is measured")}>
                    <dl>
                      {(["alvo", "realizado", "entregas", "cenario_de_elegibilidade", "erro", "ganho", "perda_quantilica", "cobertura", "calibracao", "quantis"] as const).map((k) => (
                        <PrevisoesFichaLinha key={k} rotulo={rotuloDefinicao(k, idioma)}>
                          <Gold texto={g.definicoes[k]} regiao="previsoes-definicoes" />
                        </PrevisoesFichaLinha>
                      ))}
                      <PrevisoesFichaLinha rotulo={tx("Fronteira entre períodos", "Boundary between periods")}>
                        <Gold texto={g.definicoes.periodos.fronteira} />
                      </PrevisoesFichaLinha>
                      {naoAvaliados.map((m) => (
                        <PrevisoesFichaLinha key={m.codigo} rotulo={tx(`${m.codigo} sem avaliação`, `${m.codigo} not evaluated`)}>
                          {/* // i18n: dado (chave do texto da gold) */}
                          <Gold texto={semCaminhosDeArquivo(m.motivo_sem_avaliacao ?? "motivo não registrado")} />
                        </PrevisoesFichaLinha>
                      ))}
                    </dl>
                  </PrevisoesAnalise>

                  <PrevisoesAnalise id="controles" titulo={tx("Controles do teste retrospectivo, executados a cada publicação", "Checks of the retrospective test, run on every publication")}>
                    <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                      {tx(
                        "Os controles conferem a integridade do cálculo (datas, limites de preço, refazer o B0 por outro caminho). São verificações do próprio observatório: não medem a capacidade de prever e não substituem a revisão independente.",
                        "The checks verify the integrity of the calculation (dates, price limits, redoing B0 by another route). They are the observatory's own checks: they do not measure forecasting ability and do not replace the independent review.",
                      )}
                    </p>
                    <TabelaInterativa
                      titulo={tx("Controles do teste e da rodada", "Checks of the test and of the run")}
                      colunas={colunasValidacoes(idioma)}
                      linhas={validacoes}
                      chaveLinha="id"
                      colunaRotulo="nome"
                      fonte={fonte}
                      versao={versao}
                      nomeArquivo="previsoes-pld-controles"
                    />
                  </PrevisoesAnalise>

                  <PrevisoesAuditoria id="publicacao" titulo={tx("Regra de publicação e decisão pendente", "Publication rule and pending decision")}>
                    <dl>
                      <PrevisoesFichaLinha rotulo={tx("Regra", "Rule")}>
                        <TrechoPortugues regiao="previsoes-publicacao">{pubDes.regra}</TrechoPortugues>
                      </PrevisoesFichaLinha>
                      <PrevisoesFichaLinha rotulo={tx("Decisão", "Decision")}>
                        {pubDes.decisao
                          ? tx(
                              `${pubDes.decisao.estado.toLowerCase()}; decidido por ${pubDes.decisao.decidido_por ?? "ninguém registrado"} em ${pubDes.decisao.decidido_em ? dataBR(pubDes.decisao.decidido_em) : "data não registrada"}`,
                              `${pubDes.decisao.estado === "PENDENTE" ? "pending" : pubDes.decisao.estado.toLowerCase()}; decided by ${pubDes.decisao.decidido_por ?? "nobody recorded"} on ${pubDes.decisao.decidido_em ? dataBR(pubDes.decisao.decidido_em) : "date not recorded"}`,
                            )
                          : tx("nenhuma registrada", "none recorded")}
                        {pubDes.decisao?.pergunta ? (
                          <>
                            {tx(". Pergunta: ", ". Question: ")}
                            <TrechoPortugues regiao="previsoes-publicacao">{pubDes.decisao.pergunta}</TrechoPortugues>
                          </>
                        ) : (
                          ""
                        )}
                      </PrevisoesFichaLinha>
                      {pubDes.decisao?.registro && (
                        <PrevisoesFichaLinha rotulo={tx("Registro", "Record")}>
                          <TrechoPortugues regiao="previsoes-publicacao">{pubDes.decisao.registro}</TrechoPortugues>
                        </PrevisoesFichaLinha>
                      )}
                      {!pubDes.publicado && (
                        <PrevisoesFichaLinha rotulo={tx("Leitura do implementador", "Implementer's reading")}>
                          <TrechoPortugues regiao="previsoes-publicacao">{pubDes.interpretacao_do_implementador}</TrechoPortugues>
                        </PrevisoesFichaLinha>
                      )}
                      <PrevisoesFichaLinha rotulo={tx("Onde estão os resultados", "Where the results are")}>
                        {g.desempenho.publicado ? tx("nesta página", "on this page") : <TrechoPortugues regiao="previsoes-publicacao">{g.desempenho.calculado}</TrechoPortugues>}
                      </PrevisoesFichaLinha>
                      <PrevisoesFichaLinha rotulo={tx("Linhas do teste", "Test rows")}>
                        {tx(
                          `${g.dados.linhas_csv.semanal.toLocaleString("pt-BR")} semanais e ${g.dados.linhas_csv.mensal.toLocaleString("pt-BR")} mensais; última entrega apurada no teste: ${g.dados.ultima_entrega_apurada_teste ? dataBR(g.dados.ultima_entrega_apurada_teste) : "nenhuma"}`,
                          `${num(g.dados.linhas_csv.semanal, 0)} weekly and ${num(g.dados.linhas_csv.mensal, 0)} monthly; latest delivery settled in the test: ${g.dados.ultima_entrega_apurada_teste ? dataBR(g.dados.ultima_entrega_apurada_teste) : "none"}`,
                        )}
                      </PrevisoesFichaLinha>
                      {Object.entries(g.dados.revisoes_hidrologia).map(([k, r]) => (
                        <PrevisoesFichaLinha key={k} rotulo={tx(`Revisões em ${k.split(":")[1] ?? k}`, `Revisions in ${k.split(":")[1] ?? k}`)}>
                          {tx(
                            `${r.observacoes_revisadas} observações revisadas pelo ONS entre capturas; maior revisão ${r.maior_revisao === null ? "sem registro" : `${r.maior_revisao.toLocaleString("pt-BR")} p.p.`}. O teste retrospectivo do modelo com hidrologia usa o valor revisado.`,
                            `${r.observacoes_revisadas} observations revised by ONS between captures; largest revision ${r.maior_revisao === null ? "no record" : `${num(r.maior_revisao, 2)} pp`}. The retrospective test of the model with hydrology uses the revised value.`,
                          )}
                        </PrevisoesFichaLinha>
                      ))}
                      <PrevisoesFichaLinha rotulo={tx("Estado dos modelos", "State of the models")}>
                        {g.modelos.map((m) => tx(`${m.codigo} em ${rotuloEstadoModelo(m.estado, "pt")}`, `${m.codigo} in ${rotuloEstadoModelo(m.estado, idioma)}`)).join("; ")}
                      </PrevisoesFichaLinha>
                    </dl>
                  </PrevisoesAuditoria>

                  <PrevisoesSeguir
                    ancora="p016"
                    proximo={{ href: enderecoPainel(proximoPainel("p016").id), pergunta: proximoPainel("p016", idioma).pergunta }}
                    downloads={downloadsDoPainel(g, "p016")}
                  />
                </div>
              </PainelEvidencia>
            </PrevisoesPainel>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}

function rotuloDefinicao(k: string, idioma: Idioma): string {
  switch (k) {
    case "alvo":
      return tx("Alvo", "Target", idioma);
    case "realizado":
      return tx("Realizado", "Actual", idioma);
    case "entregas":
      return tx("Entregas", "Deliveries", idioma);
    case "cenario_de_elegibilidade":
      return tx("Dado elegível no corte", "Data eligible at the cutoff", idioma);
    case "erro":
      return tx("Erro e viés", "Error and bias", idioma);
    case "ganho":
      return tx("Ganho sobre o B0", "Gain over B0", idioma);
    case "perda_quantilica":
      return tx("Perda quantílica", "Quantile loss", idioma);
    case "cobertura":
      return tx("Cobertura", "Coverage", idioma);
    case "calibracao":
      return tx("Calibração", "Calibration", idioma);
    case "quantis":
      return tx("Quantis", "Quantiles", idioma);
    default:
      return k;
  }
}
