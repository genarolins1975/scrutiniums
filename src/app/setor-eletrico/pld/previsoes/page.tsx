import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { PrevisoesArquivo } from "@/components/energia/PrevisoesArquivo";
import { PrevisoesAtual } from "@/components/energia/PrevisoesAtual";
import {
  PrevisoesAnalise,
  PrevisoesAuditoria,
  PrevisoesAviso,
  PrevisoesFichaLinha,
  PrevisoesIndisponivel,
  PrevisoesLeitura,
  PrevisoesNavegacao,
  PrevisoesRecorte,
  PrevisoesResposta,
  PrevisoesSeguir,
} from "@/components/energia/PrevisoesPagina";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { CURTO_SM, carimbo, dataBR, datasLegiveis, num, plural } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  COLUNAS_REVISOES,
  COR_SM,
  GOLD_PREVISOES,
  ROTA_PREVISOES,
  SUBMERCADOS,
  diasSemRodada,
  downloadsDoPainel,
  enderecoPainel,
  instanteBR,
  linhasArquivo,
  linhasGrade,
  linhasPublicadoNoCorte,
  linhasRevisoes,
  oQueMudouRodada,
  particoesCitadas,
  primeiraEntregaAMaturar,
  perguntaPainel,
  proximoPainel,
  resumoRodadas,
  respostaP013,
  rodadasRecentes,
  temRodada,
  textoAlertas,
  textoEmissao,
  textoTolerancia,
} from "@/lib/energia/previsoes";
import { lerCsvPrevisoes } from "@/lib/energia/previsoes-arquivos";
import type { PrevisoesDesempenhoGold } from "@/lib/energia/tipos-previsoes";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Previsão do PLD: rodada atual e arquivo de emissões",
  description:
    "Referência experimental B0 para as próximas quatro semanas e três meses nos quatro submercados, com a prova de cada número, o PLD já publicado no corte, e o arquivo imutável de todas as emissões com corte, atraso, versão, faixa e realizado.",
  alternates: { canonical: ROTA_PREVISOES },
};

const CSV_EMISSOES = "/energia/series/previsoes_emissoes.csv";
/** Rodadas levadas ao HTML (o CSV completo é o download): cerca de 28 linhas por rodada. */
const MAX_RODADAS_PAGINA = 14;

export default function PrevisoesPage() {
  const g = lerGold<PrevisoesDesempenhoGold>(GOLD_PREVISOES);
  if (!integra(g)) return <PrevisoesIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const at = g.previsao_atual;
  const comRodada = temRodada(at);
  const linhas = comRodada ? linhasGrade(at.celulas) : [];
  const pub = at.ja_publicado_no_corte;
  const atraso = comRodada ? diasSemRodada(at.origem, g.rotina.dias_vencidos_ate) : null;
  const csv = lerCsvPrevisoes(CSV_EMISSOES);
  const estados = Object.fromEntries(g.modelos.map((m) => [m.codigo, m.estado]));
  const todas = csv ? linhasArquivo(csv.linhas, estados) : [];
  const recorte = rodadasRecentes(todas, MAX_RODADAS_PAGINA);
  const rodadasArquivo = resumoRodadas(todas);
  const evidenciasAtual = Object.fromEntries(
    Object.entries(g.evidencias).filter(([k]) => k.startsWith("b0_") || k.startsWith("pld_no_corte_")),
  );
  const versao = g.gerado_em.slice(0, 10);
  const fonteGrade = "Observatório, rodada de previsão do PLD (referência B0 sobre o PLD horário da CCEE)";
  const fonteArquivo = "Observatório, arquivo imutável de emissões de previsão";
  const ref = g.governanca.referencia_experimental;
  const reex = g.prospectivo.reexecucao;
  const particoes = particoesCitadas(g);
  const revisoes = linhasRevisoes(g);
  const publicadoNoCorte = linhasPublicadoNoCorte(pub);
  const apuradas = g.prospectivo.apuracoes.filter((a) => a.realizado !== null).length;
  const proxima = primeiraEntregaAMaturar(g.prospectivo.apuracoes);
  const retido = !g.desempenho.publicado;
  const transcritas = rodadasArquivo.filter((r) => r.transcrito);

  return (
    <>
      <CabecalhoEnergia atual="pld-modelos" />
      <MarcaVisita secao="energia:pld-previsoes" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-4 pb-16 sm:px-6">
        <nav aria-label="Trilha" className="pt-6 text-sm text-mineral">
          <Link href="/setor-eletrico/pld" className="inline-flex min-h-[44px] items-center underline underline-offset-4">
            PLD
          </Link>{" "}
          · Previsões e modelos · Previsão atual e arquivo
        </nav>
        <CabecalhoModulo siglas={["SIN", "CCEE"]}
          rotulo="Previsões e modelos do PLD"
          titulo="O que se projeta para o PLD, e o que ficou registrado antes do resultado"
          referencia={
            <>
              Rodada de {comRodada ? dataBR(at.origem) : "sem data"} com o <Termo slug="pld">PLD</Termo> horário da CCEE até {dataBR(g.dados.ultimo_dia_pld)}; arquivo
              com {plural(todas.length, "registro", "registros")} de {plural(rodadasArquivo.length, "rodada", "rodadas")}; processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          Nenhum modelo de previsão do PLD está aprovado: o que aparece aqui é uma referência simples, a persistência (B0), identificada como tal, com a prova de cada
          número. O segundo painel guarda todas as emissões como foram registradas, antes do resultado, para que o desempenho possa ser medido depois sem reescrever
          nada. Como cada número é calculado está no registro de modelos.
        </CabecalhoModulo>
        <PrevisoesNavegacao pagina="previsoes" />
        <ModoProfundidade>
          <Bloco id="atual">
            <PainelEvidencia
              id="p013"
              pergunta={perguntaPainel("p013")}
              subtitulo="Referência experimental B0 por submercado e entrega · R$/MWh nominais, média temporal simples das horas"
              natureza="PREVISTO"
              porQueImporta={
                <>
                  Quem compra, vende ou planeja consumo quer saber o preço das próximas semanas e meses. Um número de previsão só serve se vier com o que o produziu, a
                  informação disponível no corte e o quanto se pode confiar nele; por isso o número publicado aqui é chamado de referência, não de previsão aprovada.
                </>
              }
              oQueMudou={<>{oQueMudouRodada(g)}</>}
              comoInterpretar={
                <>
                  O B0 repete a média do PLD do último período completo disponível às 07h do dia de origem: a última semana de sábado a sexta para W1 a W4 e o último mês
                  civil para M1 a M3. Por isso as quatro semanas têm o mesmo número, e os três meses também. Cada número é a média simples de todas as horas da entrega,
                  não ponderada pelo consumo.
                </>
              }
              naoConcluir={
                <>
                  Não é previsão aprovada nem diz que o preço vai ficar onde está: a persistência ignora chuva, reservatórios e vazões. Sem faixa calibrada, não há
                  probabilidade associada ao número. O PLD já publicado no corte vale só para as horas restantes do dia de origem e não entra em nenhuma entrega.
                </>
              }
              proveniencia={comRodada && at.proveniencia ? at.proveniencia : g.proveniencia}
              complementares={pub ? [{ rotulo: "PLD já publicado no corte", p: pub.proveniencia }] : []}
            >
              <div className="space-y-6">
                <PrevisoesResposta id="p013">{respostaP013(g)}</PrevisoesResposta>
                <PrevisoesRecorte
                  periodo={
                    linhas.length ? (
                      <>
                        Entregas de {dataBR(linhas.reduce((a, l) => (l.inicio < a ? l.inicio : a), linhas[0].inicio))} a{" "}
                        {dataBR(linhas.reduce((a, l) => (l.fim > a ? l.fim : a), linhas[0].fim))}; rodada de {comRodada ? dataBR(at.origem) : ""}, corte às 07h00 de Brasília
                      </>
                    ) : (
                      "sem rodada com células"
                    )
                  }
                  universo={
                    <>
                      Quatro <Termo slug="submercado">submercados</Termo> (SE/CO, Sul, Nordeste e Norte), sete horizontes (W1 a W4 e M1 a M3); modelo B0, referência
                      experimental
                    </>
                  }
                  unidade="R$/MWh nominais"
                />
                {comRodada && (
                  <PrevisoesAviso tipo={at.atraso_min !== null && at.atraso_min > 0 ? "alerta" : "nota"}>
                    Rodada {textoEmissao(at)}. {at.alertas.length ? `Alertas registrados: ${textoAlertas(at.alertas)}.` : ""}{" "}
                    {atraso !== null && atraso > 0
                      ? `Fonte defasada: a verificação de ${carimbo(g.rotina.verificado_em)} já tinha o prazo de ${dataBR(g.rotina.dias_vencidos_ate)} vencido, e a rodada mais recente é de ${dataBR(at.origem)}, ${plural(atraso, "dia", "dias")} antes.`
                      : `Na verificação de ${carimbo(g.rotina.verificado_em)}, nenhum prazo de rodada posterior a ${dataBR(at.origem)} tinha vencido.`}
                  </PrevisoesAviso>
                )}
                {comRodada && linhas.length > 0 ? (
                  <PrevisoesAtual
                    linhas={linhas}
                    origem={at.origem}
                    evidencias={evidenciasAtual}
                    publicado={pub ? { origem: pub.origem, submercados: pub.submercados } : null}
                    fonte={fonteGrade}
                    versao={versao}
                    endereco={enderecoPainel("p013")}
                  />
                ) : (
                  <PrevisoesAviso tipo="alerta">
                    Nenhuma rodada com células está registrada nesta publicação{!comRodada ? `: ${at.motivo}` : ""}. A grade 4 × 7 aparece quando a primeira rodada for
                    emitida.
                  </PrevisoesAviso>
                )}
                <PrevisoesLeitura
                  comoLer={
                    <>
                      Em cada painel, um traço horizontal por entrega, do primeiro ao último dia, na altura do número previsto: contínuo para as semanas, tracejado para os
                      meses. À esquerda do corte, em cinza, o período que o B0 repete (dado observado). A linha pontilhada é o piso médio do PLD na entrega. Os quatro painéis
                      usam a mesma escala; a grade 4 × 7 e a tabela trazem os mesmos números.
                    </>
                  }
                  naoPermite={
                    <>
                      Não permite dizer qual submercado terá o preço mais alto nas próximas semanas: as diferenças repetem as da semana usada.{" "}
                      {apuradas === 0
                        ? `Não permite medir o acerto do B0: nenhuma entrega prevista terminou${proxima ? ` (a primeira termina em ${dataBR(proxima.termina)})` : ""}`
                        : `O acerto prospectivo tem só ${plural(apuradas, "previsão apurada", "previsões apuradas")}`}
                      {retido ? ", e os resultados do teste retrospectivo estão retidos (painel de desempenho)." : "; o teste retrospectivo está no painel de desempenho."}
                    </>
                  }
                />
                {comRodada && (
                  <PrevisoesAviso>
                    {at.bandas} {at.candidatos.emitidos ? "" : at.candidatos.motivo}
                  </PrevisoesAviso>
                )}

                {pub && publicadoNoCorte.length > 0 && (
                  <PrevisoesAnalise id="publicado-no-corte" titulo={`PLD já publicado para ${dataBR(pub.origem)}, depois do corte`}>
                    <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{pub.nota}</p>
                    <GraficoLinhas
                      titulo={`PLD horário de ${dataBR(pub.origem)} já publicado no corte, por submercado`}
                      dados={publicadoNoCorte}
                      chaveX="h"
                      formatoX="hora"
                      series={SUBMERCADOS.filter((sm) => pub.submercados[sm]?.horas).map((sm) => ({ id: sm, rotulo: CURTO_SM[sm], cor: COR_SM[sm] }))}
                      unidade="R$/MWh"
                      casas={2}
                      altura={260}
                    />
                  </PrevisoesAnalise>
                )}

                {comRodada && (
                  <PrevisoesAuditoria id="rodada" titulo="A rodada: corte, emissão, código e condições da referência experimental">
                    <dl>
                      <PrevisoesFichaLinha rotulo="Identificador">
                        <span className="font-mono text-xs">{at.run_id}</span>
                      </PrevisoesFichaLinha>
                      <PrevisoesFichaLinha rotulo="Corte e prazo">
                        corte em {instanteBR(at.cutoff)}; prazo de emissão {at.prazo ? instanteBR(at.prazo) : "não registrado"} (Brasília)
                      </PrevisoesFichaLinha>
                      <PrevisoesFichaLinha rotulo="Emissão">{textoEmissao(at)}</PrevisoesFichaLinha>
                      <PrevisoesFichaLinha rotulo="Versão do código">
                        <span className="font-mono text-xs">{at.versao_codigo ?? "não registrada"}</span>
                      </PrevisoesFichaLinha>
                      <PrevisoesFichaLinha rotulo="Referência experimental">
                        {ref.autorizada ? "autorizada" : "não autorizada"} ({ref.fundamento}); verificada em {dataBR(ref.verificada_em)}. Não equivale a {ref.nao_equivale_a}.
                      </PrevisoesFichaLinha>
                      {ref.condicoes.map((c) => (
                        <PrevisoesFichaLinha key={c.id} rotulo={`Condição: ${c.id.replace(/_/g, " ")}`}>
                          {c.descricao}: {c.verificada ? "verificada" : "não verificada"}. {c.evidencia}
                        </PrevisoesFichaLinha>
                      ))}
                      <PrevisoesFichaLinha rotulo="Faixas">{ref.faixas}</PrevisoesFichaLinha>
                      <PrevisoesFichaLinha rotulo="Reexecução">
                        {reex.conferidas} {reex.conferidas === 1 ? "previsão refeita" : "previsões refeitas"} com o dado como estava no corte,{" "}
                        {reex.divergentes.length ? `${reex.divergentes.length} com divergência` : "nenhuma divergente"} (tolerância {textoTolerancia(reex.tolerancia)}).
                      </PrevisoesFichaLinha>
                    </dl>
                  </PrevisoesAuditoria>
                )}

                <PrevisoesSeguir
                  ancora="p013"
                  proximo={{ href: enderecoPainel(proximoPainel("p013").id), pergunta: proximoPainel("p013").pergunta }}
                  downloads={downloadsDoPainel(g, "p013")}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          <Bloco id="arquivo">
            <PainelEvidencia
              id="p015"
              pergunta={perguntaPainel("p015")}
              subtitulo="Arquivo imutável de emissões · uma linha por célula, R$/MWh e minutos"
              natureza="PREVISTO"
              porQueImporta={
                <>
                  Só se mede uma previsão com o que foi registrado antes do resultado. Se um número pudesse ser trocado depois, qualquer modelo pareceria bom. Aqui cada
                  emissão fica como saiu, com corte, horário, versão e motivo de falha; correção vira registro novo que aponta para o original.
                </>
              }
              oQueMudou={
                <>
                  {rodadasArquivo.length
                    ? `Última inclusão no arquivo em ${dataBR(rodadasArquivo[rodadasArquivo.length - 1].registrado)}: ${rodadasArquivo[rodadasArquivo.length - 1].rotulo.toLowerCase()}, com ${rodadasArquivo[rodadasArquivo.length - 1].celulas} registros.`
                    : "Nenhum registro incluído."}{" "}
                  {g.prospectivo.leitura}
                </>
              }
              comoInterpretar={
                <>
                  Cada linha é uma célula de uma rodada: modelo, horizonte, entrega e submercado. A data de inclusão diz quando o registro entrou no arquivo do observatório;
                  quando é posterior à emissão, o registro foi transcrito de outra fonte e não é emissão original. O realizado e o erro só aparecem depois que a entrega
                  termina.
                </>
              }
              naoConcluir={
                <>
                  {apuradas === 0
                    ? "Não mede desempenho: sem entrega terminada, não há erro a calcular."
                    : `O erro das ${plural(apuradas, "previsão apurada", "previsões apuradas")} é amostra pequena, não desempenho.`}{" "}
                  {g.rotina.comprovada
                    ? "A rotina diária está comprovada pelo critério publicado."
                    : `${plural(rodadasArquivo.length, "rodada registrada não comprova", "rodadas registradas não comprovam")} a rotina diária: ${g.rotina.criterio_comprovacao.charAt(0).toLowerCase()}${g.rotina.criterio_comprovacao.slice(1)}`}
                </>
              }
              proveniencia={g.proveniencia}
            >
              <div className="space-y-6">
                {csv ? (
                  <PrevisoesArquivo
                    linhas={recorte.linhas}
                    total={todas.length}
                    omitidas={recorte.omitidas}
                    fonte={fonteArquivo}
                    versao={versao}
                    recorte={
                      <PrevisoesRecorte
                        periodo={
                          rodadasArquivo.length
                            ? `Rodadas de ${dataBR(rodadasArquivo[0].origem)} a ${dataBR(rodadasArquivo[rodadasArquivo.length - 1].origem)}`
                            : "sem rodada registrada"
                        }
                        universo="Todas as células emitidas, com e sem número, de todos os modelos registrados"
                        unidade="R$/MWh nominais (previsão, faixa, realizado e erro); minutos (atraso)"
                      />
                    }
                  />
                ) : (
                  <>
                    <p data-resposta="p015" className="max-w-prose2 text-base leading-relaxed text-carvao md:text-lg">
                      O arquivo de emissões não pôde ser lido nesta publicação ({CSV_EMISSOES}); nenhum registro é exibido em vez de um registro de reserva.
                    </p>
                    <PrevisoesRecorte periodo="sem leitura do arquivo" universo="células emitidas" unidade="R$/MWh nominais; minutos" />
                  </>
                )}
                {csv && csv.invalidas > 0 && (
                  <PrevisoesAviso tipo="alerta">
                    {csv.invalidas} {csv.invalidas === 1 ? "linha do CSV ficou fora" : "linhas do CSV ficaram fora"} por ter número de campos diferente do cabeçalho.
                  </PrevisoesAviso>
                )}
                <PrevisoesLeitura
                  comoLer={
                    <>
                      Escolha um dia para ver o arquivo como estava ao fim dele: registros incluídos depois somem, e a resposta acima é refeita para esse recorte. Clique numa
                      rodada no gráfico para filtrar a tabela, e numa linha para ver o registro inteiro. A exportação leva exatamente as linhas exibidas.
                    </>
                  }
                  naoPermite={
                    <>
                      Não permite saber se o número estava certo antes que a entrega termine. Rodada sem número não é previsão de preço zero: é ausência, com o motivo
                      gravado.
                    </>
                  }
                />

                <PrevisoesAnalise id="revisoes" titulo="Revisão entre rodadas para a mesma entrega">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {revisoes.some((r) => r.rodadas > 1)
                      ? "Para cada entrega e submercado, as previsões com número de cada rodada e a mudança da última sobre a anterior."
                      : `Nenhuma das ${revisoes.length} entregas e submercados tem duas previsões com número: só a rodada mais recente tem números, então não há revisão a mostrar.`}
                  </p>
                  <TabelaInterativa
                    titulo="Previsões por entrega e rodada"
                    colunas={COLUNAS_REVISOES}
                    linhas={revisoes}
                    chaveLinha="id"
                    colunaRotulo="entrega"
                    fonte={fonteArquivo}
                    versao={versao}
                    nomeArquivo="previsoes-pld-revisoes-entre-rodadas"
                    chaveUrl="rev"
                    semLinhas="Nenhuma entrega tem previsão com número."
                  />
                </PrevisoesAnalise>

                <PrevisoesAnalise id="rotina" titulo="Rotina diária: o que está escrito e o que já foi comprovado">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao">{g.rotina.leitura}</p>
                  <dl>
                    <PrevisoesFichaLinha rotulo="Horários">{g.rotina.horarios}</PrevisoesFichaLinha>
                    <PrevisoesFichaLinha rotulo="Fuso">{g.rotina.fuso}</PrevisoesFichaLinha>
                    <PrevisoesFichaLinha rotulo="Execuções agendadas">
                      {g.rotina.execucoes_agendadas} registradas: {g.rotina.no_prazo} no prazo, {g.rotina.atrasadas} atrasadas, {g.rotina.falhas} com falha;{" "}
                      {g.rotina.dias_sem_rodada_total} {g.rotina.dias_sem_rodada_total === 1 ? "dia" : "dias"} sem rodada desde{" "}
                      {g.rotina.inicio_operacao_agendada ? dataBR(g.rotina.inicio_operacao_agendada) : "o início da operação agendada, que ainda não aconteceu"}.
                    </PrevisoesFichaLinha>
                    <PrevisoesFichaLinha rotulo="Critério">{g.rotina.criterio_comprovacao}</PrevisoesFichaLinha>
                    <PrevisoesFichaLinha rotulo="Comprovada">{g.rotina.comprovada ? "sim" : "não"}</PrevisoesFichaLinha>
                    <PrevisoesFichaLinha rotulo="Verificado em">
                      {carimbo(g.rotina.verificado_em)}; prazos vencidos até {dataBR(g.rotina.dias_vencidos_ate)}
                    </PrevisoesFichaLinha>
                  </dl>
                </PrevisoesAnalise>

                <PrevisoesAuditoria id="imutabilidade" titulo="Imutabilidade, reexecução e achados">
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    Registros novos entram em partições mensais encadeadas: cada registro guarda o sha256 do anterior, e qualquer alteração, remoção ou reordenação quebra a
                    cadeia.{" "}
                    {transcritas.length
                      ? `${transcritas.map((r) => r.rotulo).join(", ")}: registros transcritos, incluídos no arquivo depois da emissão, no arquivo legado congelado.`
                      : "Nenhum registro foi transcrito depois da emissão."}{" "}
                    A reexecução refez {reex.conferidas}{" "}
                    {reex.conferidas === 1 ? "previsão arquivada" : "previsões arquivadas"} com o dado como estava no corte:{" "}
                    {reex.divergentes.length ? `${reex.divergentes.length} divergentes` : "nenhuma divergente"} (tolerância {textoTolerancia(reex.tolerancia)}).
                  </p>
                  {particoes.length > 0 && (
                    <ul className="space-y-1 text-sm">
                      {particoes.map((p) => (
                        <li key={p.url}>
                          <a href={p.url} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 [overflow-wrap:anywhere]">
                            {datasLegiveis(p.rotulo)}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    {g.prospectivo.calibracao_regra_antiga.descricao} Registros afetados: {g.prospectivo.calibracao_regra_antiga.registros}; com estado de calibração diferente
                    depois da correção: {g.prospectivo.calibracao_regra_antiga.status_diferente}.
                  </p>
                  <dl>
                    <PrevisoesFichaLinha rotulo={`Achado A08 (${g.governanca.achados.A08.estado})`}>
                      {g.governanca.achados.A08.diagnostico} Correção: {g.governanca.achados.A08.correcao} {g.governanca.achados.A08.confirmacao}
                    </PrevisoesFichaLinha>
                    <PrevisoesFichaLinha rotulo={`Achado A09 (${g.governanca.achados.A09.estado})`}>{g.governanca.achados.A09.leitura}</PrevisoesFichaLinha>
                  </dl>
                  <p className="text-xs text-mineral">
                    {num(todas.length, 0)} linhas no CSV; para reproduzir: python3 pipeline/energia/executar_modulo.py previsoes --sem-coleta.
                  </p>
                </PrevisoesAuditoria>

                <PrevisoesSeguir
                  ancora="p015"
                  proximo={{ href: enderecoPainel(proximoPainel("p015").id), pergunta: proximoPainel("p015").pergunta }}
                  downloads={[...downloadsDoPainel(g, "p015"), ...particoes]}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}

