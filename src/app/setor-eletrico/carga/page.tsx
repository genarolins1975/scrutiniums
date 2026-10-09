import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { CargaHistorico } from "@/components/energia/CargaHistorico";
import { CargaMetricas, CargaNivel } from "@/components/energia/CargaNivel";
import { CargaAviso, CargaCapitulos, CargaFontes, CargaIndisponivel, CargaSeguir } from "@/components/energia/CargaPagina";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { Unidade } from "@/components/evidencia/Unidade";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  COLUNAS_COMPARACOES_TODAS,
  NOME_REGIAO,
  REGIOES,
  ROTULO_JANELA_A07,
  ROTULO_SITUACAO_REVISAO,
  linhasComparacoesTodas,
  marcosRegimes,
  paraTabela,
  parentesesMmgd,
  perguntaPainel,
  rotaPainel,
  serieColunar,
  situacaoAtualidade,
  textoAvisoRegimes,
  textoRegimesCarga,
  textoRevisoes,
} from "@/lib/energia/carga";
import { carimbo, dataBR, mesAno, num, plural, sinal } from "@/lib/energia/formato";
import { gold, integra, lerGold } from "@/lib/energia/gold";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { CargaDetalheGold } from "@/lib/energia/tipos-carga";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Carga: nível e crescimento do consumo do sistema elétrico",
  description:
    "Carga de energia diária do SIN e dos subsistemas (ONS) com comparações de calendário equivalente, médias mensais e anuais dentro do mesmo regime metodológico, revisões entre capturas, validação física e a reprodução da variação de sete dias publicada antes, com o que ela não permite concluir.",
  alternates: { canonical: "/setor-eletrico/carga" },
};

const FONTE = "ONS, Carga de Energia Diária (validada pelo observatório)";

const COLUNAS_CAPTURAS: ColunaTabela[] = [
  { id: "captura", rotulo: "Captura", tipo: "texto", categorica: true },
  { id: "d", rotulo: "Dia", tipo: "data" },
  ...(["SE", "S", "NE", "N", "SIN"] as const).map((sm): ColunaTabela => ({ id: sm, rotulo: sm === "SE" ? "SE/CO" : sm, tipo: "numero", unidade: "MWmed", casas: 3 })),
  { id: "fora", rotulo: "Fora do domínio", tipo: "texto" },
];
/** Colunas da tabela do A07; os anos das duas janelas vêm da referência do achado na gold. */
const colunasA07Regioes = (ano: string, anoAnt: string): ColunaTabela[] => [
  { id: "regiao", rotulo: "Região", tipo: "texto" },
  { id: "mesmas", rotulo: "Mesmas datas", tipo: "percentual", casas: 2 },
  { id: "equivalente", rotulo: "Mesmos dias da semana", tipo: "percentual", casas: 2 },
  { id: "curva", rotulo: "Curva horária, mesmas datas", tipo: "percentual", casas: 2 },
  { id: "global", rotulo: "Carga global (API), mesmas datas", tipo: "percentual", casas: 2 },
  { id: "mmgd", rotulo: "MMGD (API), mesmas datas", tipo: "percentual", casas: 2 },
  { id: "liquida", rotulo: "Carga líquida (API), mesmas datas", tipo: "percentual", casas: 2 },
  { id: "pontos", rotulo: "Aumento da MMGD em pontos da carga global", tipo: "numero", unidade: "p.p.", casas: 2 },
  { id: "temp_a", rotulo: `Temperatura em ${ano}`, tipo: "numero", unidade: "°C", casas: 1 },
  { id: "temp_b", rotulo: `Temperatura nas mesmas datas de ${anoAnt}`, tipo: "numero", unidade: "°C", casas: 1 },
];
const COLUNAS_RESIDUOS: ColunaTabela[] = [
  { id: "regiao", rotulo: "Região", tipo: "texto", categorica: true },
  { id: "janela", rotulo: "Janela", tipo: "texto", categorica: true },
  { id: "inicio", rotulo: "Início", tipo: "data" },
  { id: "fim", rotulo: "Fim", tipo: "data" },
  { id: "dias", rotulo: "Dias previstos", tipo: "numero", casas: 0 },
  { id: "dias_janela", rotulo: "Dias da janela", tipo: "numero", casas: 0 },
  { id: "real", rotulo: "Real", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "previsto", rotulo: "Previsto", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "residuo_pct", rotulo: "Real contra previsto", tipo: "percentual", casas: 2 },
  { id: "dias_acima_p90", rotulo: "Dias acima do intervalo de 80%", tipo: "numero", casas: 0 },
  { id: "dias_abaixo_p10", rotulo: "Dias abaixo do intervalo de 80%", tipo: "numero", casas: 0 },
];
const COLUNAS_REVISOES: ColunaTabela[] = [
  { id: "sm", rotulo: "Subsistema", tipo: "texto", categorica: true },
  { id: "dia", rotulo: "Dia", tipo: "data" },
  { id: "valor_ant", rotulo: "Valor anterior", tipo: "numero", unidade: "MWmed", casas: 3 },
  { id: "valor", rotulo: "Valor revisado", tipo: "numero", unidade: "MWmed", casas: 3 },
  { id: "diferenca", rotulo: "Diferença", tipo: "numero", unidade: "MWmed", casas: 3 },
  { id: "diferenca_pct", rotulo: "Diferença relativa", tipo: "percentual", casas: 4 },
  { id: "situacao", rotulo: "Situação", tipo: "texto", categorica: true },
  { id: "capturado_em_ant", rotulo: "Captura anterior", tipo: "texto" },
  { id: "capturado_em", rotulo: "Captura", tipo: "texto" },
];
const COLUNAS_OCORRENCIAS: ColunaTabela[] = [
  { id: "sm", rotulo: "Subsistema", tipo: "texto", categorica: true },
  { id: "dia", rotulo: "Dia", tipo: "data" },
  { id: "valor", rotulo: "Valor da fonte", tipo: "numero", unidade: "MWmed", casas: 3 },
  { id: "regras", rotulo: "Regras violadas", tipo: "texto" },
  { id: "situacao", rotulo: "Situação", tipo: "texto", categorica: true },
  { id: "conferencia", rotulo: "Conferência", tipo: "texto" },
];
const COLUNAS_ESPERADOS: ColunaTabela[] = [
  { id: "sm", rotulo: "Subsistema", tipo: "texto" },
  { id: "inicio", rotulo: "Primeiro dia", tipo: "data" },
  { id: "fim", rotulo: "Último dia", tipo: "data" },
  { id: "esperados", rotulo: "Dias esperados", tipo: "numero", casas: 0 },
  { id: "presentes", rotulo: "Presentes", tipo: "numero", casas: 0 },
  { id: "ausentes", rotulo: "Ausentes na fonte", tipo: "numero", casas: 0 },
  { id: "quarentena", rotulo: "Em quarentena", tipo: "numero", casas: 0 },
];
const COLUNAS_AUSENTES: ColunaTabela[] = [
  { id: "sm", rotulo: "Subsistema", tipo: "texto", categorica: true },
  { id: "dia", rotulo: "Dia", tipo: "data" },
  { id: "estado", rotulo: "Estado no arquivo atual da fonte", tipo: "texto", categorica: true },
  { id: "valor_arquivo_atual", rotulo: "Valor no arquivo atual", tipo: "numero", unidade: "MWmed", casas: 3 },
];
const ROTULO_AUSENCIA: Record<string, string> = {
  celula_vazia_na_fonte: "célula vazia na fonte",
  linha_ausente_na_fonte: "linha ausente na fonte",
  presente_no_arquivo_atual: "presente no arquivo atual",
  nao_conferido: "não conferido",
};

export default function CargaPage() {
  const g = lerGold<CargaDetalheGold>("carga_detalhe.json");
  const c = gold.carga();
  if (!integra(g) || !integra(c)) return <CargaIndisponivel motivo={(g as { motivo?: string } | null)?.motivo ?? (c as { motivo?: string } | null)?.motivo} />;

  const p = g.p025;
  const a = g.a07;
  const atual = situacaoAtualidade(g.dia_referencia, g.gerado_em);
  const ev = g.evidencias;
  const versao = g.dia_referencia;
  const downloads = [...c.downloads, ...g.downloads.filter((d) => /comparacoes|revisoes/.test(d.url))];
  const val = p.validacao;
  const fimMensal = c.mensal[c.mensal.length - 1];
  const residuosA07 = a.residuos_fora_da_amostra.filter((r) => r.sm === "SIN");
  const inicioMensal = c.mensal[0]?.m.slice(0, 4) ?? "";
  const oQueMudou = (
    <>
      {atual.texto} {textoRevisoes(p.revisoes)}
    </>
  );
  const comoInterpretar = (
    <>
      &ldquo;Mesmos dias da semana&rdquo; compara com a janela deslocada 364 dias (cada dia da semana com o seu par); &ldquo;mesmas datas&rdquo; compara com o mesmo
      calendário do ano anterior, como a publicação diária do observatório fazia. A variação só existe quando as duas janelas têm todos os dias e estão no mesmo
      regime do ONS: {g.regimes.map((r) => `${dataBR(r.inicio)}${r.observado_nos_dados ? ` (observado nos dados em ${dataBR(r.observado_nos_dados)})` : ""}`).join(", ")}.
      A composição de dias úteis, sábados e domingos ou feriados de cada janela aparece abaixo do gráfico de pontos e na tabela equivalente.
    </>
  );
  const naoConcluir = (
    <>
      A variação da carga não mede atividade econômica: este painel não tem dado de atividade que sustente essa leitura. A carga inclui uma estimativa de MMGD que o
      ONS não publica separada{parentesesMmgd(g.regimes)}, então não se sabe quanto da variação vem dela. A carga não é ajustada por temperatura; a decomposição
      estatística está na página Clima e calendário. As duas bases dão taxas diferentes para a mesma janela, e nenhuma delas isola clima, calendário ou atividade.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="carga" />
      <MarcaVisita secao="energia:carga" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["MWmed", "MMGD", "SIN", "ONS"]}
          titulo={perguntaPainel("p025")}
          lead="A carga média do sistema interligado (SIN) em uma janela de dias, ao lado da janela equivalente de um ano antes. Mesmos dias da semana e mesmas datas são bases diferentes e dão taxas diferentes para a mesma janela."
          recorte={`até ${dataBR(g.dia_referencia)} · SIN e subsistemas · MWmed e %`}
          fonte="ONS, Carga de Energia Diária"
          referencia={
            <>
              ONS, Carga de Energia Diária, até {dataBR(g.dia_referencia)}; processado em {carimbo(g.gerado_em)}.
            </>
          }
          metricas={<CargaMetricas comparacoes={p.comparacoes} evidencias={{ equivalente: ev.p025_7d_equivalente ?? null, mesmasDatas: ev.a07_reproducao ?? null }} />}
        >
          A <Termo slug="carga">carga</Termo> é a energia atendida no sistema interligado, publicada pelo ONS por subsistema, em <Unidade u="MWmed" />. Esta página compara a
          carga média de uma janela de dias com a de uma janela de comparação, e diz quando as duas não têm a mesma mistura de dias úteis, sábados e domingos ou feriados.
          Só compara janelas completas e medidas do mesmo modo: {textoRegimesCarga(g.regimes)}. O perfil horário e a MMGD estão na página MMGD e perfil horário, e a
          decomposição por clima e calendário na página Clima e calendário.
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="nivel">
            <PainelEvidencia
              id="p025"
              pergunta="Cada janela frente à janela de comparação"
              subtitulo="Carga diária por região, janelas comparáveis e médias mensais e anuais · MWmed e %"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  A carga é o lado da demanda no balanço de energia. Comparar janelas com os mesmos dias da semana e o mesmo regime de medição separa o que mudou na carga do
                  que mudou no calendário ou na forma de medir.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.comparacoes}
              complementares={[{ rotulo: "Carga diária por subsistema (série)", p: c.proveniencia.carga }]}
            >
              <div className="space-y-6">
                {atual.defasada && <CargaAviso tipo="alerta">{atual.texto}</CargaAviso>}
                <CargaNivel
                  p025={{ comparacoes: p.comparacoes, mensal: p.mensal, anual: p.anual, acumulado_ano: p.acumulado_ano }}
                  serie={serieColunar(c.serie)}
                  regimes={g.regimes}
                  fonte={FONTE}
                  versao={versao}
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                  aposPrincipal={<CargaCapitulos />}
                  historia={
                    <SecaoDoPainel
                      id="historico"
                      titulo={`Como a carga média do SIN evoluiu desde ${inicioMensal}, e o que mudou na medida?`}
                      lead="Cada marca no gráfico é uma mudança do que o ONS inclui na carga: antes e depois dela, os níveis não medem a mesma coisa."
                    >
                      <CargaHistorico
                        titulo={`Carga média mensal do SIN desde ${inicioMensal}`}
                        dados={c.mensal.map((x) => ({ m: x.m, SIN: x.SIN ?? null }))}
                        cor="var(--cor-energia)"
                        marcos={marcosRegimes(g.regimes, c.mensal[0]?.m ?? "", fimMensal?.m ?? "", "mes")}
                      />
                      <CargaAviso>
                        {textoAvisoRegimes(g.regimes)}
                        {fimMensal && fimMensal.m === g.dia_referencia.slice(0, 7) ? ` O último mês (${mesAno(fimMensal.m)}) é parcial, com ${plural(fimMensal.dias, "dia", "dias")}.` : ""}
                      </CargaAviso>
                    </SecaoDoPainel>
                  }
                />

                <SecaoDoPainel id="a07" nivel="analisar" titulo={`O ${sinal(a.referencia.variacao_publicada_pct, 1)}% publicado em ${carimbo(a.referencia.gerado_em)}: o que se reproduz e o que não se conclui`}>
                  <div className="max-w-sm">
                    <Numero
                      rotulo="Variação da carga do SIN: os mesmos 7 dias contra as mesmas datas do ano anterior (reprodução do diagnóstico)"
                      natureza="CALCULADO"
                      evidencia={ev.a07_reproducao}
                      formato="pct"
                      casas={2}
                      tamanho="medio"
                      cor="var(--serie-referencia)"
                      nota="Variação maior que zero não indica, sozinha, mais atividade econômica."
                      endereco={`${rotaPainel("p025")}#a07`}
                    />
                  </div>
                  <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-carvao" data-textos="a07">
                    {a.textos.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  <TabelaInterativa
                    titulo="Variação nas mesmas janelas, por região e produto"
                    colunas={colunasA07Regioes(a.referencia.inicio.slice(0, 4), a.referencia.inicio_anterior.slice(0, 4))}
                    linhas={REGIOES.map((sm) => {
                      const cp = a.comparacoes.find((x) => x.sm === sm);
                      const m = a.mmgd.find((x) => x.sm === sm);
                      const t = a.temperatura.find((x) => x.sm === sm);
                      return {
                        id: sm,
                        regiao: NOME_REGIAO[sm],
                        mesmas: cp?.mesmas_datas?.variacao_pct ?? null,
                        equivalente: cp?.equivalente?.variacao_pct ?? null,
                        curva: cp?.curva_horaria_mesmas_datas ?? null,
                        global: m?.var_b?.global_pct ?? null,
                        mmgd: m?.var_b?.mmgd_pct ?? null,
                        liquida: m?.var_b?.liquida_pct ?? null,
                        pontos: m?.var_b?.mmgd_na_variacao_pct_pontos ?? null,
                        temp_a: t?.a ?? null,
                        temp_b: t?.b ?? null,
                      };
                    })}
                    chaveLinha="id"
                    colunaRotulo="regiao"
                    fonte="ONS (carga diária, curva horária e carga verificada) e NASA POWER (temperatura)"
                    versao={a.referencia.fim}
                    nomeArquivo="carga-a07-regioes"
                    chaveUrl="a07"
                    nota={`Temperatura de ${dataBR(a.janela_modelo.inicio)} a ${dataBR(a.janela_modelo.fim)} (${a.janela_modelo.dias} de ${a.janela_modelo.dias_janela} dias)${a.janela_modelo.motivo ? `: ${a.janela_modelo.motivo}` : ""}.`}
                  />
                  <TabelaInterativa
                    titulo="Real contra o previsto fora da amostra nas janelas do achado (SIN)"
                    colunas={COLUNAS_RESIDUOS}
                    linhas={paraTabela(residuosA07.map((r) => ({ ...r, id: `${r.sm}:${r.janela}`, regiao: NOME_REGIAO[r.sm], janela: ROTULO_JANELA_A07[r.janela] ?? r.janela })))}
                    chaveLinha="id"
                    colunaRotulo="janela"
                    fonte="Decomposição estatística do observatório"
                    versao={a.referencia.fim}
                    nomeArquivo="carga-a07-residuos"
                    chaveUrl="a07r"
                  />
                  <p className="text-sm text-carvao-muted">
                    A divisão da diferença entre calendário, temperatura, sazonalidade, tendência e resíduo, por região e variante do modelo, está na página{" "}
                    <a href={`${rotaPainel("p027")}#p027`} className="text-energia-dark underline underline-offset-4">
                      Clima e calendário
                    </a>
                    ; a parcela de MMGD da carga verificada, na página{" "}
                    <a href={`${rotaPainel("p026")}#p026`} className="text-energia-dark underline underline-offset-4">
                      MMGD e perfil horário
                    </a>
                    .
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="a07-capturas"
                  nivel="auditar"
                  titulo={`${a.por_captura_2026.length === 1 ? "A captura" : `As ${num(a.por_captura_2026.length, 0)} capturas`} do arquivo de ${a.referencia.fim.slice(0, 4)} usadas no achado`}
                >
                  {a.por_captura_2026.map((cap) => (
                    <p key={cap.sha256} className="text-sm text-carvao-muted">
                      Captura de {carimbo(cap.capturado_em)} (sha256 {cap.sha256.slice(0, 12)}…):{" "}
                      {cap.janela_completa && cap.variacao_pct !== null
                        ? `janela completa, variação de ${sinal(cap.variacao_pct, 2)}% sobre as mesmas datas de ${a.referencia.inicio_anterior.slice(0, 4)}.`
                        : "janela incompleta ou com valor fora do domínio: a variação não existe com esta captura."}
                    </p>
                  ))}
                  <TabelaInterativa
                    titulo={`Carga diária de cada captura, de ${dataBR(a.referencia.inicio)} a ${dataBR(a.referencia.fim)}`}
                    colunas={COLUNAS_CAPTURAS}
                    linhas={a.por_captura_2026.flatMap((cap) =>
                      cap.dias.map((d) => ({ id: `${cap.capturado_em}:${d.d}`, captura: carimbo(cap.capturado_em), d: d.d, SE: d.SE, S: d.S, NE: d.NE, N: d.N, SIN: d.SIN, fora: d.fora_do_dominio.join(", ") })),
                    )}
                    chaveLinha="id"
                    colunaRotulo="d"
                    fonte="ONS, Carga de Energia Diária (silver principal, capturas guardadas)"
                    versao={a.referencia.fim}
                    nomeArquivo="carga-a07-capturas"
                    chaveUrl="cap"
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="revisoes" nivel="auditar" titulo="Revisões da fonte entre capturas">
                  <p className="text-sm text-carvao-muted">{textoRevisoes(p.revisoes)}</p>
                  <TabelaInterativa
                    titulo="Valores revisados pela fonte"
                    colunas={COLUNAS_REVISOES}
                    linhas={paraTabela(
                      p.revisoes.linhas.map((l) => ({
                        ...l,
                        id: `${l.sm}:${l.dia}:${l.capturado_em}`,
                        situacao: ROTULO_SITUACAO_REVISAO[l.situacao] ?? l.situacao,
                        capturado_em: carimbo(l.capturado_em),
                        capturado_em_ant: carimbo(l.capturado_em_ant),
                      })),
                    )}
                    chaveLinha="id"
                    colunaRotulo="dia"
                    fonte="ONS, Carga de Energia Diária (capturas do observatório)"
                    versao={versao}
                    nomeArquivo="carga-revisoes"
                    chaveUrl="rev"
                    ordemInicial={{ coluna: "dia", direcao: "desc" }}
                  />
                  <p className="text-sm text-carvao-muted">
                    Curva horária contra a carga diária: {num(p.revisoes.curva_contra_diaria.dias_comparados, 0)} pares comparados,{" "}
                    {num(p.revisoes.curva_contra_diaria.dias_diferentes, 0)} diferentes (tolerância {p.revisoes.curva_contra_diaria.tolerancia}). {p.revisoes.curva_contra_diaria.leitura}
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel id="validacao" nivel="auditar" titulo="Validação física antes da publicação">
                  <ul className="space-y-1 text-sm text-carvao-muted">
                    {val.regras.map((r) => (
                      <li key={r.id}>
                        <span className="text-carvao">{r.id}</span> ({r.tipo}
                        {r.critica ? ", crítica" : ""}): {r.descricao}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-carvao-muted">
                    {num(val.valores_verificados, 0)} valores verificados; {val.quarentena.length} em quarentena (publicados como ausência, nunca zero) e{" "}
                    {val.atipicos_conferidos.length} atípicos confirmados no balanço de energia.
                  </p>
                  <TabelaInterativa
                    titulo="Quarentena e atípicos conferidos"
                    colunas={COLUNAS_OCORRENCIAS}
                    linhas={paraTabela([...val.quarentena, ...val.atipicos_conferidos].map((o) => ({ id: `${o.sm}:${o.dia}`, sm: o.sm, dia: o.dia, valor: o.valor, regras: o.regras, situacao: o.situacao === "quarentena" ? "quarentena" : "atípico conferido", conferencia: o.conferencia })))}
                    chaveLinha="id"
                    colunaRotulo="dia"
                    fonte="Validação do observatório sobre ONS (carga diária e balanço de energia)"
                    versao={versao}
                    nomeArquivo="carga-validacao-ocorrencias"
                    chaveUrl="oc"
                  />
                  <TabelaInterativa
                    titulo="Registros esperados por subsistema"
                    colunas={COLUNAS_ESPERADOS}
                    linhas={Object.entries(val.registros_esperados).map(([sm, r]) => ({ id: sm, sm, ...r }))}
                    chaveLinha="id"
                    colunaRotulo="sm"
                    fonte="Validação do observatório (regra A1)"
                    versao={versao}
                    nomeArquivo="carga-registros-esperados"
                    chaveUrl="esp"
                  />
                  <TabelaInterativa
                    titulo="Dias sem valor e o estado conferido no arquivo atual da fonte"
                    colunas={COLUNAS_AUSENTES}
                    linhas={val.ausentes.map((x) => ({ id: `${x.sm}:${x.dia}`, sm: x.sm, dia: x.dia, estado: ROTULO_AUSENCIA[x.estado] ?? x.estado, valor_arquivo_atual: x.valor_arquivo_atual }))}
                    chaveLinha="id"
                    colunaRotulo="dia"
                    fonte="ONS, Carga de Energia Diária (arquivo atual)"
                    versao={versao}
                    nomeArquivo="carga-dias-ausentes"
                    chaveUrl="aus"
                    semLinhas="Nenhum dia sem valor entre o primeiro e o último dia publicado."
                  />
                  {val.historico_fora_do_dominio.length > 0 && (
                    <ul className="space-y-1 text-sm text-carvao-muted">
                      {val.historico_fora_do_dominio.map((f) => (
                        <li key={`${f.sm}:${f.dia}:${f.capturado_em}`}>
                          {NOME_REGIAO[f.sm]} em {dataBR(f.dia)}: {num(f.valor, 3)} MWmed na captura de {carimbo(f.capturado_em)}
                          {f.revisado_para !== null ? `, revisado pela fonte para ${num(f.revisado_para, 3)} MWmed em ${carimbo(f.revisado_em)}` : ", ainda em quarentena"}.
                        </li>
                      ))}
                    </ul>
                  )}
                </SecaoDoPainel>

                <SecaoDoPainel id="comparacoes-todas" nivel="auditar" titulo="Todas as comparações publicadas">
                  <TabelaInterativa
                    titulo="Comparações por região, janela e tipo"
                    colunas={COLUNAS_COMPARACOES_TODAS}
                    linhas={paraTabela(linhasComparacoesTodas(p))}
                    chaveLinha="id"
                    colunaRotulo="rotulo"
                    fonte={FONTE}
                    versao={versao}
                    nomeArquivo="carga-comparacoes"
                    chaveUrl="cmp.t"
                  />
                  <CargaFontes fontes={g.fontes.filter((f) => f.id === "diaria" || f.id === "leis")} />
                </SecaoDoPainel>

                <CargaSeguir ancora="p025" proximo={{ href: `${rotaPainel("p026")}#p026`, pergunta: perguntaPainel("p026") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
