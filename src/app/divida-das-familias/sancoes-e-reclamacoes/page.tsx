import type { Metadata } from "next";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import Link from "next/link";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { FiguraAnalitica, GraficoBarras, GraficoLinhas, LeituraGuiada, PaginaPainel, TabelaDados } from "@/components/painel";
import type { NumeroProps } from "@/components/painel";
import { BaixarCsv, CLASSE_BAIXAR, type CelulaCsv } from "@/components/familias/apostas/BaixarCsv";
import { Corpo, LINK, LinkFonte, Lista, Nota, Texto } from "@/components/familias/apostas/Evidencia";
import { dataBr, num } from "@/lib/perguntas/leitura";
import { limpar } from "@/lib/familias/apostas";
import {
  DESCRICAO_SANCOES,
  PAINEL_INSTITUICOES,
  PERGUNTA_SANCOES,
  ROTA_SANCOES,
  dadosSancoes,
  dataOuVazio,
  frase,
  milhoes,
  provSancoes,
  trimestre,
  trimestreCurto,
} from "@/lib/familias/sancoes-e-reclamacoes";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: PERGUNTA_SANCOES,
  description: DESCRICAO_SANCOES,
  alternates: { canonical: ROTA_SANCOES },
};

const GOLD = "/obs/data/gold/conduta.json";
const n0 = (v: number) => num(v, 0);
const reais = (v: number) => `R$ ${num(v, 0)}`;
const PESSOA: Record<string, string> = { PF: "Pessoa física", PJ: "Pessoa jurídica" };

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */

/**
 * Painel "Sanções e reclamações" (Observatório das Famílias, coleção Dívida e crédito das famílias), com conta. Reescrita, no molde de
 * painel, da vista de conduta da aplicação do Crédito (/observatorio/conduct-enforcement): mesma gold (conduta.json), mesmos valores,
 * nenhum cálculo novo. Três réguas que não se somam: decisões do Banco Central por apenado, processos da CVM por fase e o índice do
 * ranking de reclamações. Regra editorial mantida: nenhuma lista ordenada por instituição, multa ou nome; o que é nominal aparece em
 * ordem cronológica e não é ordenável.
 */
export default function PaginaSancoes() {
  const { D, B, C, R } = dadosSancoes();
  const cabecalho = (
    <header>
      <MarcaVisita secao="familias:sancoes-e-reclamacoes" />
      <CabecalhoPlataforma observatorio="familias" destinoConta={ROTA_SANCOES} fontes={["credito"]} />
      <NavegacaoColecao colecao="divida" />
    </header>
  );
  const limite =
    "que mais processos significam mais irregularidade, nem que uma decisão descreve a conduta de alguém. Multa aplicada não é multa paga, a base da CVM traz a fase e não o resultado, e nenhuma instituição é ordenada aqui.";
  const lead = "O que o Banco Central e a CVM decidiram nos processos sancionadores, em quanto tempo, com que penalidade e se a multa foi paga, lido como fluxo do sistema, sem ranking por instituição.";
  const fonteCurta = "Banco Central (processos sancionadores e ranking de reclamações) e CVM";

  // a gold declara quando a carga não saiu: a página diz isso no lugar dos números, sem zero e sem estimativa
  if (!D.disponivel || !B.disponivel) {
    const motivo = limpar(D.motivo || D.error || "A carga dos quadros de decisões do Banco Central não foi concluída nesta publicação.");
    return (
      <>
        {cabecalho}
        <PaginaPainel
          rota={ROTA_SANCOES}
          abertura={{ acento: "bronze", titulo: PERGUNTA_SANCOES, lead, recorte: { periodo: "indisponível nesta publicação", universo: "Brasil", fonte: fonteCurta }, limite }}
          numeros={[{ rotulo: "Processos decididos pelo Banco Central", valor: null, motivoAusencia: motivo, unidade: "processos", periodo: "12 meses", fonte: "Banco Central, Gepad", natureza: "CALCULADO" }]}
          metodo={<p>{motivo}</p>}
        />
      </>
    );
  }

  const j = B.janela_12m;
  const ja = B.janela_12m_anterior;
  const ate = dataBr(B.ultima_decisao);
  const doze = `12 meses até ${ate}`;
  const anual: any[] = B.anual;
  const completos = anual.filter((a) => !a.incompleto);
  const primeiroAno = String(B.primeira_decisao).slice(0, 4);
  const cvmAnual: any[] = C.anual ?? [];
  const serie: any[] = R.disponivel ? R.serie : [];

  const numeros: NumeroProps[] = [
    {
      rotulo: "Processos decididos pelo Banco Central",
      valor: j.processos,
      formato: "inteiro",
      unidade: "processos, em 1ª instância",
      periodo: doze,
      fonte: "Banco Central, Gepad",
      natureza: "CALCULADO",
      nota: `${n0(j.decisoes)} decisões por apenado. Nos 12 meses anteriores: ${n0(ja.processos)} processos.`,
    },
    {
      rotulo: "Multas aplicadas pelo Banco Central",
      formato: "texto",
      valorTexto: milhoes(j.multas_valor) ?? "",
      unidade: "aplicados, não pagos",
      periodo: doze,
      fonte: "Banco Central, Gepad",
      natureza: "CALCULADO",
      nota: `${n0(j.multas_n)} multas, mediana de ${reais(j.multa_mediana)}. Multa aplicada não é multa paga.`,
    },
    {
      rotulo: "Inabilitados vigentes",
      valor: B.inabilitados.vigentes,
      formato: "inteiro",
      unidade: "pessoas",
      periodo: `em ${ate}`,
      fonte: "Banco Central, Gepad",
      natureza: "OBSERVADO",
      nota: `${n0(B.inabilitados.encerram_12m)} encerram o prazo em 12 meses. ${n0(B.proibidos_vigentes)} proibidos de atuar.`,
    },
    ...(C.disponivel
      ? [
          {
            rotulo: "Processos abertos pela CVM",
            valor: C.abertos_12m.processos as number,
            formato: "inteiro" as const,
            unidade: "processos sancionadores",
            periodo: `12 meses até ${dataBr(D.gerado_em)}`,
            fonte: "CVM, dados abertos",
            natureza: "CALCULADO" as const,
            nota: `${n0(C.abertos_12m.acusados)} acusados. ${n0(C.acervo.em_curso)} processos em curso, com idade mediana de ${num(C.idade_em_curso_meses.mediana, 0)} meses.`,
          },
        ]
      : []),
  ];

  const csvBcb: CelulaCsv[][] = [
    ["ano", "processos", "decisoes", "multas_n", "multas_valor", "inabilitacoes", "sem_penalidade", "recursos", "pj", "pf", "incompleto", "fonte"],
    ...anual.map((a) => [a.ano, a.processos, a.decisoes, a.multas_n, a.multas_valor, a.inabilitacoes, a.sem_penalidade, a.recursos, a.pj, a.pf, a.incompleto ? "sim" : "nao", "BCB/Gepad (API Olinda); penalidade final = 2ª instância quando existe; multa aplicada, não paga"]),
  ];
  const rotuloAno = (a: any) => `${a.ano}${a.incompleto ? " (parcial)" : ""}`;
  const recentesBcb: any[] = B.recentes ?? [];
  const recentesCvm: any[] = C.recentes ?? [];

  return (
    <>
      {cabecalho}
      <PaginaPainel
        rota={ROTA_SANCOES}
        abertura={{
          acento: "bronze",
          titulo: PERGUNTA_SANCOES,
          lead,
          recorte: {
            periodo: `${primeiroAno} a ${ate}`,
            universo: "Brasil, processos sancionadores e ranking de reclamações",
            fonte: fonteCurta,
          },
          limite,
          fontesDatasSiglas: (
            <>
              <p>
                Banco Central: decisões de {dataBr(B.primeira_decisao)} a {ate}.{C.disponivel && ` CVM: aberturas até ${dataBr(C.ultima_abertura)} e movimentações até ${dataBr(C.ultima_movimentacao)}.`}
                {R.disponivel && ` Reclamações: ${trimestre(serie[0].periodo)} ao ${trimestre(R.ultimo.periodo)}.`} Base gerada em {dataBr(D.gerado_em)}.
              </p>
              <p>
                PAS: processo administrativo sancionador. Gepad: sistema do Banco Central que publica os quadros de penalidades, inabilitados e proibidos. CVM: Comissão de Valores
                Mobiliários. CRSFN: Conselho de Recursos do Sistema Financeiro Nacional, a 2ª instância. p90: valor abaixo do qual ficam 90% dos casos.
              </p>
            </>
          ),
        }}
        rotuloNumeros="Decisões do Banco Central e processos da CVM nos últimos 12 meses"
        numeros={numeros}
        notaNumeros={
          <>
            Nos 12 meses até {ate}, o Banco Central decidiu {n0(j.processos)} processos sancionadores em 1ª instância, com {n0(j.decisoes)} decisões por apenado: {n0(j.multas_n)} multas
            somando {milhoes(j.multas_valor)} (mediana de {reais(j.multa_mediana)}), {n0(j.inabilitacoes)} inabilitações e {n0(j.sem_penalidade)} decisões sem penalidade; {n0(j.recursos)}{" "}
            apenados recorreram.
            {R.disponivel && ` Índice mediano de reclamações no ranking do Banco Central: ${num(R.ultimo.mediana, 1)} no ${trimestre(R.ultimo.periodo)}, entre ${n0(R.ultimo.n_instituicoes)} instituições.`}{" "}
            São três réguas que não se somam, e nenhuma instituição é ordenada por multa, processo ou reclamação.
          </>
        }
        figuras={
          <>
            <FiguraAnalitica
              id="bcb"
              pergunta="O que o Banco Central decidiu, ano a ano?"
              subtitulo={`Decisões por apenado e inabilitações · número por ano da decisão de 1ª instância · Brasil, ${completos[0].ano} a ${completos[completos.length - 1].ano}`}
              natureza="OBSERVADO"
              proveniencia={provSancoes(D, "bcb", {
                indicador: "Decisões de processos sancionadores do Banco Central, por ano da decisão de 1ª instância",
                natureza: "OBSERVADO",
                unidade: "decisões por apenado",
                frequencia: "contínua, agregada por ano",
                inicio: String(B.primeira_decisao),
                fim: String(B.ultima_decisao),
                limitacoes: [limpar(B.nota)],
              })}
              leitura={
                <LeituraGuiada>
                  Acervo de {dataBr(B.primeira_decisao)} a {ate}: {n0(B.acervo.decisoes)} decisões em {n0(B.acervo.processos)} processos. Em {completos[completos.length - 1].ano}, último
                  ano completo, foram {n0(completos[completos.length - 1].decisoes)} decisões e {n0(completos[completos.length - 1].inabilitacoes)} inabilitações.
                </LeituraGuiada>
              }
              comoInterpretar={limpar(B.nota)}
              ressalva={anual.some((a) => a.incompleto) ? "O ano em curso fica fora do gráfico por estar incompleto; na tabela ele aparece marcado como parcial." : undefined}
              naoConcluir="que um ano com mais decisões teve mais irregularidades. O número depende do ritmo de julgamento e de quantos apenados cada processo tem; uma pessoa pode ter várias decisões."
              tabela={{
                titulo: "Decisões de processos sancionadores do Banco Central por ano da decisão de 1ª instância",
                colunas: ["Ano", "Processos", "Decisões", "Multas", "Valor das multas, R$ milhões", "Inabilitações", "Sem penalidade, %", "Com recurso, %", "Pessoas jurídicas", "Pessoas físicas"],
                linhas: anual.map((a) => [rotuloAno(a), a.processos, a.decisoes, a.multas_n, a.multas_valor / 1e6, a.inabilitacoes, a.sem_penalidade_share, a.recurso_share, a.pj, a.pf]),
                casas: [null, 0, 0, 0, 1, 0, 0, 0, 0, 0],
                limite: anual.length,
              }}
              depois={
                <p>
                  <BaixarCsv nome={`conduta_bcb_pas_${B.ultima_decisao}.csv`} linhas={csvBcb} rotulo="Baixar as decisões do Banco Central, ano a ano (CSV)" />
                </p>
              }
            >
              <GraficoLinhas
                semTabela
                titulo="Decisões por apenado e inabilitações do Banco Central, por ano"
                dados={completos.map((a) => ({ ano: String(a.ano), decisoes: a.decisoes, inabilitacoes: a.inabilitacoes }))}
                chaveX="ano"
                formatoX="texto"
                series={[
                  { id: "decisoes", rotulo: "Decisões por apenado", sigla: "Decisões", cor: "var(--serie-1)" },
                  { id: "inabilitacoes", rotulo: "Inabilitações", sigla: "Inabilitações", cor: "var(--serie-2)" },
                ]}
                unidade="decisões"
                casas={0}
                zeroNoEixo
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="bcb-multas"
              pergunta="Quanto o Banco Central aplicou em multas, ano a ano?"
              subtitulo={`Soma das multas aplicadas · R$ milhões nominais por ano da decisão · Brasil, ${completos[0].ano} a ${completos[completos.length - 1].ano}`}
              natureza="OBSERVADO"
              proveniencia={provSancoes(D, "bcb", {
                indicador: "Multas aplicadas em processos sancionadores do Banco Central, por ano",
                natureza: "OBSERVADO",
                unidade: "R$ milhões nominais",
                frequencia: "contínua, agregada por ano",
                inicio: String(B.primeira_decisao),
                fim: String(B.ultima_decisao),
                limitacoes: ["Multa aplicada, não paga; a cobrança tem situação própria.", "Valores nominais, sem correção pela inflação."],
              })}
              leitura={
                <LeituraGuiada>
                  Em {completos[completos.length - 1].ano}: {milhoes(completos[completos.length - 1].multas_valor)} em {n0(completos[completos.length - 1].multas_n)} multas. Poucas multas
                  grandes mudam o total de um ano.
                </LeituraGuiada>
              }
              naoConcluir="quanto foi efetivamente pago, nem que o valor mede a gravidade das infrações de um ano. A soma é do valor aplicado, em reais da época, e a situação da cobrança está no bloco seguinte."
              tabela={{
                titulo: "Multas aplicadas pelo Banco Central por ano da decisão",
                colunas: ["Ano", "Multas", "Valor das multas, R$ milhões"],
                linhas: anual.map((a) => [rotuloAno(a), a.multas_n, a.multas_valor / 1e6]),
                casas: [null, 0, 1],
                limite: anual.length,
              }}
            >
              <GraficoBarras
                semTabela
                titulo="Multas aplicadas pelo Banco Central por ano"
                dados={completos.map((a) => ({ ano: String(a.ano), v: a.multas_valor / 1e6 }))}
                chaveCategoria="ano"
                series={[{ id: "v", rotulo: "Multas aplicadas", cor: "var(--serie-1)" }]}
                unidade="R$ mi"
                casas={1}
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="bcb-12-meses"
              pergunta="Que penalidades o Banco Central aplicou nos últimos 12 meses?"
              subtitulo={`Decisões por penalidade final · número de decisões por apenado · Brasil, ${doze}`}
              natureza="CALCULADO"
              proveniencia={provSancoes(D, "bcb", {
                indicador: "Decisões do Banco Central por penalidade final, janela de 12 meses",
                natureza: "CALCULADO",
                unidade: "decisões por apenado",
                frequencia: "janela de 12 meses fechada na data da coleta",
                inicio: String(j.ini),
                fim: String(B.ultima_decisao),
                formula: "contagem das decisões de 1ª instância na janela, pela penalidade final (a de 2ª instância quando existe)",
                limitacoes: [limpar(B.nota)],
              })}
              leitura={
                <LeituraGuiada>
                  Multa mediana de {reais(j.multa_mediana)} e p90 de {reais(j.multa_p90)}. {n0(j.pj)} decisões contra pessoas jurídicas e {n0(j.pf)} contra pessoas físicas;{" "}
                  {num(j.decisoes ? (j.recursos / j.decisoes) * 100 : 0, 0)}% com recurso.
                </LeituraGuiada>
              }
              naoConcluir="que a penalidade aplicada foi cumprida, nem que a mais frequente é a mais grave. A penalidade que vale é a de 2ª instância quando existe, e a situação da cobrança das multas está na tabela abaixo."
              tabela={{
                titulo: `Decisões do Banco Central por penalidade final, ${doze}`,
                colunas: ["Penalidade final", "Decisões", "Parcela das decisões, %"],
                linhas: (B.penas_12m as any[]).map((x) => [frase(x.pena), x.n, x.share]),
                casas: [null, 0, 1],
                limite: B.penas_12m.length,
              }}
              depois={
                <>
                  <TabelaDados
                    recolhida={false}
                    id="cobranca"
                    tituloVisivel="Cobrança das multas, acervo inteiro"
                    lead="A situação de cada multa aplicada desde o início do acervo. Multa aplicada não é multa paga."
                    titulo="Situação da cobrança das multas aplicadas pelo Banco Central, acervo inteiro"
                    colunas={["Situação da cobrança", "Multas", "Parcela do acervo, %"]}
                    linhas={(B.cobranca_multas as any[]).map((x) => [frase(x.situacao), x.n, x.share])}
                    casas={[null, 0, 1]}
                    limite={B.cobranca_multas.length}
                  />
                  <Texto>
                    Tempo entre a citação e a decisão de 1ª instância, nas decisões dos últimos 36 meses: mediana de {num(B.tempo_citacao_decisao_meses.mediana, 0)} meses e p90 de{" "}
                    {num(B.tempo_citacao_decisao_meses.p90, 0)} ({n0(B.tempo_citacao_decisao_meses.n)} decisões; só as já decididas).
                  </Texto>
                  <TabelaDados
                    titulo="Inabilitados vigentes por prazo da inabilitação"
                    colunas={["Prazo, anos", "Inabilitados vigentes", "Encerram em 12 meses"]}
                    linhas={(B.inabilitados.por_prazo as any[]).map((p) => [`${num(p.prazo_anos, p.prazo_anos % 1 ? 1 : 0)}`, p.n, p.encerram_12m])}
                    casas={[null, 0, 0]}
                    limite={B.inabilitados.por_prazo.length}
                  />
                </>
              }
            >
              <GraficoBarras
                semTabela
                titulo={`Decisões do Banco Central por penalidade final, ${doze}`}
                dados={(B.penas_12m as any[]).map((x) => ({ id: String(x.pena), rotulo: frase(x.pena), v: x.n }))}
                chaveCategoria="id"
                chaveRotulo="rotulo"
                series={[{ id: "v", rotulo: "Decisões", cor: "var(--serie-1)" }]}
                unidade="decisões"
                casas={0}
                orientacao="horizontal"
                rotulosValor
              />
            </FiguraAnalitica>

            {C.disponivel && (
              <FiguraAnalitica
                id="cvm"
                pergunta="Em que fase estão os processos da CVM?"
                subtitulo={`Processos sancionadores por fase atual · número de processos · Brasil, aberturas de ${cvmAnual[0]?.ano} a ${dataBr(C.ultima_abertura)}`}
                natureza="OBSERVADO"
                proveniencia={provSancoes(D, "cvm", {
                  indicador: "Processos sancionadores da CVM por fase atual",
                  natureza: "OBSERVADO",
                  unidade: "processos",
                  frequencia: "contínua",
                  inicio: String(cvmAnual[0]?.ano ?? ""),
                  fim: String(C.ultima_movimentacao),
                  limitacoes: [limpar(C.nota)],
                })}
                leitura={
                  <LeituraGuiada>
                    {n0(C.acervo.processos)} processos e {n0(C.acervo.acusados)} acusados, {num(C.acusados_por_processo, 1)} por processo em média. Os finalizados levaram{" "}
                    {num(C.duracao_finalizados_meses.mediana, 0)} meses em mediana (p90 de {num(C.duracao_finalizados_meses.p90, 0)}) entre a abertura e a última movimentação; os{" "}
                    {n0(C.acervo.em_curso)} em curso têm idade mediana de {num(C.idade_em_curso_meses.mediana, 0)} meses, {n0(C.idade_em_curso_meses.acima_36)} deles acima de 36.
                  </LeituraGuiada>
                }
                comoInterpretar={limpar(C.nota).replace(/'finalizado'/, "finalizado")}
                naoConcluir="o resultado dos processos. A base da CVM traz a fase do rito, não se houve absolvição, multa ou termo de compromisso; finalizado quer dizer só que o rito terminou."
                tabela={{
                  titulo: "Processos sancionadores da CVM por fase atual",
                  colunas: ["Fase atual", "Processos", "Parcela dos processos, %"],
                  linhas: (C.fases as any[]).map((x) => [limpar(x.fase), x.n, x.share]),
                  casas: [null, 0, 1],
                  limite: C.fases.length,
                }}
                depois={
                  <>
                    <TabelaDados
                      recolhida={false}
                      id="cvm-por-ano"
                      tituloVisivel="Ano a ano, por abertura"
                      lead="Processos pelo ano em que foram abertos, com os acusados e a parcela já finalizada."
                      titulo="Processos sancionadores da CVM por ano de abertura"
                      colunas={["Ano de abertura", "Processos", "Acusados", "Finalizados, %"]}
                      linhas={cvmAnual.map((a) => [rotuloAno(a), a.processos, a.acusados, a.finalizados_share])}
                      casas={[null, 0, 0, 0]}
                      limite={cvmAnual.length}
                    />
                    <TabelaDados
                      titulo="Processos sancionadores da CVM por área que instruiu"
                      colunas={["Área que instruiu", "Processos", "Parcela dos processos, %"]}
                      linhas={(C.areas as any[]).map((x) => [String(x.area), x.n, x.share])}
                      casas={[null, 0, 1]}
                      limite={C.areas.length}
                      nota="As siglas são as das gerências e superintendências da CVM, como a base as publica."
                    />
                  </>
                }
              >
                <GraficoBarras
                  semTabela
                  titulo="Processos sancionadores da CVM por fase atual"
                  dados={(C.fases as any[]).map((x) => ({ id: String(x.fase), rotulo: limpar(x.fase), v: x.n }))}
                  chaveCategoria="id"
                  chaveRotulo="rotulo"
                  series={[{ id: "v", rotulo: "Processos", cor: "var(--serie-1)" }]}
                  unidade="processos"
                  casas={0}
                  orientacao="horizontal"
                  rotulosValor
                />
              </FiguraAnalitica>
            )}

            <Recolhido
              id="recentes"
              nivelTitulo={2}
              titulo="As decisões e os processos mais recentes"
              resumo={`${n0(recentesBcb.length)} decisões do Banco Central e ${n0(recentesCvm.length)} processos da CVM, em ordem cronológica, nunca por valor ou por nome.`}
            >
              <Corpo>
                <Nota>Dados públicos do próprio supervisor, reproduzidos como publicados. A ordem é a da data, da mais recente para a mais antiga; nenhuma coluna é ordenável nesta página.</Nota>
                <TabelaDados
                  recolhida={false}
                  id="recentes-bcb"
                  tituloVisivel="Decisões do Banco Central"
                  titulo="Decisões mais recentes do Banco Central em processos sancionadores, em ordem cronológica"
                  colunas={["Decisão", "Apenado", "Pessoa", "Penalidade", "Multa, R$", "Recurso", "Situação"]}
                  linhas={recentesBcb.map((x) => [
                    dataOuVazio(x.decisao),
                    String(x.nome),
                    PESSOA[String(x.pessoa)] ?? null,
                    x.pena ? frase(x.pena) : null,
                    typeof x.multa === "number" && x.multa > 0 ? x.multa : null,
                    x.recurso ? frase(x.recurso) : null,
                    x.situacao ? frase(x.situacao) : null,
                  ])}
                  casas={[null, null, null, null, 2, null, null]}
                  ausencia={{ "Multa, R$": "sem multa nesta decisão", Recurso: "não informado", Situação: "não informada", Pessoa: "não informada", Penalidade: "não informada" }}
                  idiomaTexto={[null, "nome", null, null, null, null, null]}
                  limite={recentesBcb.length}
                />
                {C.disponivel && (
                  <TabelaDados
                    recolhida={false}
                    id="recentes-cvm"
                    tituloVisivel="Processos da CVM"
                    titulo="Processos sancionadores mais recentes da CVM, em ordem cronológica de abertura"
                    colunas={["Abertura", "Objeto, como publicado pela CVM", "Área", "Fase", "Acusados", "Última movimentação"]}
                    linhas={recentesCvm.map((x) => [
                      dataOuVazio(x.abertura),
                      `${limpar(x.objeto)}${String(x.objeto).length >= 220 ? "…" : ""}`,
                      x.area ? String(x.area) : null,
                      limpar(x.fase),
                      x.acusados,
                      dataOuVazio(x.ultima_mov),
                    ])}
                    casas={[null, null, null, null, 0, null]}
                    ausencia={{ Área: "não informada", "Última movimentação": "sem movimentação registrada" }}
                    limite={recentesCvm.length}
                    nota="O objeto vem truncado na base. Travessões e hifens soltos do texto original aparecem como vírgula."
                  />
                )}
              </Corpo>
            </Recolhido>

            {R.disponivel ? (
              <FiguraAnalitica
                id="reclamacoes"
                pergunta="Como anda o índice de reclamações contra instituições?"
                subtitulo={`Índice mediano do ranking trimestral · reclamações procedentes por milhão de clientes · instituições do ranking, ${trimestreCurto(serie[0].periodo)} a ${trimestreCurto(R.ultimo.periodo)}`}
                natureza="CALCULADO"
                proveniencia={provSancoes(D, "reclamacoes", {
                  indicador: "Mediana e p90 do índice de reclamações entre as instituições do ranking trimestral",
                  natureza: "CALCULADO",
                  unidade: "reclamações procedentes por milhão de clientes",
                  frequencia: "trimestral",
                  inicio: String(serie[0].periodo).slice(0, 4),
                  fim: String(R.ultimo.periodo).slice(0, 4),
                  formula: "mediana e percentil 90 do índice entre as instituições do ranking, sem nome",
                  limitacoes: ["Só instituições com mais de 4 milhões de clientes entram no ranking."],
                })}
                leitura={
                  <LeituraGuiada>
                    De {num(serie[0].mediana, 1)} no {trimestre(serie[0].periodo)} para {num(R.ultimo.mediana, 1)} no {trimestre(R.ultimo.periodo)}, entre {n0(R.ultimo.n_instituicoes)}{" "}
                    instituições.
                  </LeituraGuiada>
                }
                comoInterpretar={limpar(R.nota).replace(/^./, (c) => c.toUpperCase()).replace(/\bBCB\b/g, "Banco Central")}
                naoConcluir="qual instituição recebe mais reclamações, nem que o atendimento do sistema piorou ou melhorou. A mediana resume o ranking sem nomes e o conjunto de instituições muda de um trimestre para outro."
                tabela={{
                  titulo: "Índice de reclamações do ranking trimestral do Banco Central: mediana, p90 e instituições",
                  colunas: ["Trimestre", "Mediana", "p90", "Instituições no ranking"],
                  linhas: serie.map((p) => [trimestreCurto(p.periodo), p.mediana, p.p90 ?? null, p.n_instituicoes]),
                  casas: [null, 1, 1, 0],
                  limite: serie.length,
                }}
                depois={
                  <p className="t-meta text-carvao-muted">
                    <Link href={PAINEL_INSTITUICOES} prefetch={false} className={`inline-flex min-h-[44px] items-center text-carvao ${LINK}`}>
                      O índice de cada instituição, na ficha dela, no painel Instituições
                    </Link>{" "}
                    Lá o índice aparece por instituição, ao lado de capital e inadimplência, nunca como ranking.
                  </p>
                }
              >
                <GraficoLinhas
                  semTabela
                  titulo="Índice mediano de reclamações por trimestre"
                  dados={serie.map((p) => ({ tri: trimestreCurto(p.periodo), mediana: p.mediana }))}
                  chaveX="tri"
                  formatoX="texto"
                  series={[{ id: "mediana", rotulo: "Índice mediano", cor: "var(--serie-1)" }]}
                  unidade="por milhão de clientes"
                  casas={1}
                  zeroNoEixo
                />
              </FiguraAnalitica>
            ) : (
              <Recolhido id="reclamacoes" aberto nivelTitulo={2} titulo="Reclamações: o índice do ranking trimestral" resumo="Indisponível nesta publicação.">
                <Texto>O ranking de reclamações ainda não foi coletado nesta publicação; a série aparece na próxima carga.</Texto>
              </Recolhido>
            )}
          </>
        }
        notas={{
          id: "para-ler",
          itens: [
            { termo: "Processo sancionador (PAS)", definicao: "O rito pelo qual o Banco Central e a CVM apuram uma infração e decidem se aplicam penalidade. Volume de processos não é irregularidade." },
            { termo: "Decisão por apenado", definicao: "Uma linha por pessoa ou empresa e decisão. Um processo pode ter várias, e a mesma pessoa pode ter mais de uma.", exemplo: `No acervo: ${n0(B.acervo.decisoes)} decisões em ${n0(B.acervo.processos)} processos.` },
            { termo: "Penalidade final", definicao: "A penalidade que vale é a de 2ª instância quando existe recurso julgado; sem ele, a de 1ª instância." },
            { termo: "Multa aplicada", definicao: "O valor decidido, não o valor pago. A situação da cobrança (paga, transferida, vencida, parcelada) é contada à parte." },
            { termo: "Mediana e p90", definicao: "Metade dos casos fica abaixo da mediana; 90% ficam abaixo do p90." },
            { termo: "Índice de reclamações", definicao: "Reclamações procedentes por milhão de clientes, no ranking trimestral do Banco Central." },
          ],
        }}
        metodo={
          <>
            <p>{limpar(D.metodo)}</p>
            <TabelaDados
              recolhida={false}
              titulo="Catálogo dos indicadores: definição, unidade, fonte e limitações"
              colunas={["Indicador", "Definição", "Unidade", "Fonte", "Limitações"]}
              linhas={(D.catalogo as any[]).map((c) => [limpar(c.nome), limpar(c.definicao), limpar(c.unidade), limpar(c.fonte), limpar(c.limitacoes).replace(/'finalizado'/, "finalizado")])}
              limite={D.catalogo.length}
            />
            <div>
              <h3 className="text-sm font-medium text-carvao">Cautelas</h3>
              <div className="mt-2">
                <Lista itens={(D.cautelas as string[]).map(limpar)} />
              </div>
            </div>
            <p>
              Fontes:{" "}
              {Object.values(D.fontes as Record<string, any>).map((f, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  <LinkFonte href={f.catalogo}>{limpar(f.nome)}</LinkFonte> ({limpar(f.licenca)}; nível {limpar(f.nivel)})
                </span>
              ))}
              .
            </p>
            <div className="flex flex-wrap items-center gap-x-6">
              <BaixarCsv nome={`conduta_bcb_pas_${B.ultima_decisao}.csv`} linhas={csvBcb} rotulo="Baixar as decisões do Banco Central, ano a ano (CSV)" />
              <a href={GOLD} download className={CLASSE_BAIXAR}>
                Baixar a base completa (JSON)
              </a>
            </div>
          </>
        }
      />
    </>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
