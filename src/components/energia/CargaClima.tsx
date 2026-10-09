"use client";

import { useMemo, type ReactNode } from "react";
import { CargaEscolha, CargaLista } from "@/components/energia/CargaControles";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  COR_REGIAO,
  CURTO_REGIAO,
  DO_REGIAO,
  NOME_REGIAO,
  REGIOES,
  ROTULO_GRUPO,
  ROTULO_TIPO,
  TIPOS_COMPARACAO,
  VARIANTES,
  barrasDecomposicao,
  decomposicaoEscolhida,
  linhasRecenteModelo,
  linhasRespostaTemperatura,
  linhasSensibilidade,
  paraTabela,
  partesDaDiferenca,
  respostaClima,
  respostaDecomposicao,
  respostaUltimoDia,
  textoJanelaCurta,
  vereditoClima,
  textoDefasagemTemperatura,
  type TipoComparacao,
} from "@/lib/energia/carga";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { dataBR, mesAno, num, plural } from "@/lib/energia/formato";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { Regiao } from "@/lib/energia/tipos";
import type { A07, P027, VarianteModelo } from "@/lib/energia/tipos-carga";

/**
 * P027, clima e calendário: decomposição estatística (não causal) da carga diária,
 * estimada só com o passado e avaliada fora da amostra. Região (?sm=), variante do
 * modelo (?var=) e tipo de comparação da janela do achado (?cmp=) ficam na URL, assim
 * como busca, filtros, ordem e página de cada tabela (prefixos prev, dec, met, ori, sen
 * e tmp); as datas do achado e as contagens dos títulos vêm da gold. O
 * gráfico real × previsto, o de contribuições e a tabela usam as mesmas linhas; a
 * resposta é refeita pela mesma regra quando a região muda.
 */
const ESQUEMA = {
  sm: campo(tiposUrl.opcao(REGIOES), "SIN"),
  var: campo(tiposUrl.opcao(VARIANTES), "principal"),
  cmp: campo(tiposUrl.opcao(TIPOS_COMPARACAO), "equivalente"),
};

const OPCOES_REGIAO = REGIOES.map((sm) => ({ id: sm, rotulo: sm === "SE" ? "SE/CO" : NOME_REGIAO[sm], detalhe: NOME_REGIAO[sm] }));
const OPCOES_TIPO = TIPOS_COMPARACAO.map((t) => ({ id: t, rotulo: t === "equivalente" ? "Mesmos dias da semana" : "Mesmas datas", detalhe: ROTULO_TIPO[t] }));

const COLUNAS_RECENTE: ColunaTabela[] = [
  { id: "d", rotulo: "Dia", tipo: "data" },
  { id: "real", rotulo: "Real", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "previsto", rotulo: "Previsto", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "p10", rotulo: "Limite inferior de 80%", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "p90", rotulo: "Limite superior de 80%", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "p025", rotulo: "Limite inferior de 95%", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "p975", rotulo: "Limite superior de 95%", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "residuo_pct", rotulo: "Real contra previsto", tipo: "percentual", casas: 2 },
  { id: "dentro_80", rotulo: "Dentro do intervalo de 80%", tipo: "texto", categorica: true },
  { id: "calendario", rotulo: "Calendário", tipo: "numero", unidade: "log × 100", casas: 2 },
  { id: "temperatura", rotulo: "Temperatura", tipo: "numero", unidade: "log × 100", casas: 2 },
  { id: "sazonalidade", rotulo: "Sazonalidade", tipo: "numero", unidade: "log × 100", casas: 2 },
  { id: "nivel_tendencia", rotulo: "Nível e tendência", tipo: "numero", unidade: "log × 100", casas: 2 },
  { id: "origem", rotulo: "Origem do modelo", tipo: "data" },
];
const COLUNAS_BARRAS: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Parte", tipo: "texto" },
  { id: "valor", rotulo: "Valor", tipo: "numero", unidade: "log × 100", casas: 2 },
];
const COLUNAS_ORIGENS: ColunaTabela[] = [
  { id: "origem", rotulo: "Origem", tipo: "data" },
  { id: "dias_treino", rotulo: "Dias de treino", tipo: "numero", casas: 0 },
  { id: "dias", rotulo: "Dias previstos", tipo: "numero", casas: 0 },
  { id: "mape_pct", rotulo: "Erro absoluto médio", tipo: "percentual", casas: 2 },
  { id: "vies_pct", rotulo: "Viés", tipo: "percentual", casas: 2 },
  { id: "fonte_intervalo", rotulo: "Base do intervalo", tipo: "texto", categorica: true },
];
const COLUNAS_METRICAS: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Variante", tipo: "texto" },
  { id: "dias", rotulo: "Dias previstos", tipo: "numero", casas: 0 },
  { id: "origens", rotulo: "Origens", tipo: "numero", casas: 0 },
  { id: "mape_pct", rotulo: "Erro absoluto médio", tipo: "percentual", casas: 2 },
  { id: "mape_principal", rotulo: "Erro do modelo principal", tipo: "percentual", casas: 2 },
  { id: "mape_referencia_364d_pct", rotulo: "Erro da referência de 364 dias", tipo: "percentual", casas: 2 },
  { id: "vies_pct", rotulo: "Viés", tipo: "percentual", casas: 2 },
  { id: "mae_mwmed", rotulo: "Erro absoluto médio", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "rmse_mwmed", rotulo: "Raiz do erro quadrático médio", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "cobertura_80_pct", rotulo: "Cobertura do intervalo de 80%", tipo: "percentual", casas: 1 },
  { id: "cobertura_95_pct", rotulo: "Cobertura do intervalo de 95%", tipo: "percentual", casas: 1 },
];
const COLUNAS_REGIOES: ColunaTabela[] = [
  { id: "regiao", rotulo: "Região", tipo: "texto" },
  ...COLUNAS_METRICAS.filter((c) => !["rotulo", "mape_principal"].includes(c.id)),
];
const COLUNAS_TEMPERATURA: ColunaTabela[] = [
  { id: "t", rotulo: "Temperatura média ponderada", tipo: "texto" },
  ...REGIOES.map((sm): ColunaTabela => ({ id: sm, rotulo: CURTO_REGIAO[sm], tipo: "numero", unidade: "log × 100", casas: 2 })),
];

/**
 * Faixa de métricas da abertura: a diferença real entre as janelas, a parte que calendário, temperatura e estação do ano acompanham, a parte que
 * o modelo não reproduz (o resíduo) e o erro do modelo em dias que ele não viu. Lê da URL a mesma região, base e variante que o painel (por isso é
 * cliente) e as partes publicadas da decomposição (partesDaDiferenca), as mesmas do veredito e do gráfico. É associação estatística, não causa.
 */
export function CargaClimaMetricas({
  p027,
  a07,
  evidencia,
}: {
  p027: Pick<NonNullable<P027>, "metricas" | "periodo_avaliacao">;
  a07: Pick<A07, "decomposicao">;
  /** Ficha "Comprove este número" do erro do modelo no SIN (a ficha só existe para esse recorte). */
  evidencia: Evidencia | null;
}) {
  const [v] = useEstadoUrl(ESQUEMA);
  const sm = v.sm as Regiao;
  const d = decomposicaoEscolhida(a07, sm, v.var as VarianteModelo, v.cmp as TipoComparacao);
  const partes = d ? partesDaDiferenca(d) : null;
  const m = p027.metricas[sm];
  const periodoJanela = d ? `${dataBR(d.inicio)} a ${dataBR(d.fim)} contra ${dataBR(d.inicio_ant)} a ${dataBR(d.fim_ant)}` : undefined;
  const semDecomposicao = "Esta combinação de região, variante e comparação não tem decomposição publicada.";
  const porCento = (x: number | null) => (x === null ? undefined : `${num(Math.round(x * 100), 0)}% da diferença entre as janelas`);
  return (
    <FaixaMetricas colunas={4} rotulo="Diferença entre as janelas, partes do modelo e erro fora da amostra" nota="Associação estatística, não causa: cada parte é a mudança da previsão associada a um grupo de variáveis, e o resíduo é o que o modelo não reproduz.">
      <Numero
        variante="faixa"
        rotulo={`Diferença entre as janelas ${DO_REGIAO[sm]}`}
        natureza="CALCULADO"
        valor={partes?.diferenca ?? null}
        formato="num"
        casas={2}
        unidade="pontos"
        periodo={periodoJanela}
        cor={COR_REGIAO[sm]}
        nota="Em log × 100, que se lê, aproximadamente, como pontos percentuais."
        motivoAusencia={semDecomposicao}
      />
      <Numero
        variante="faixa"
        rotulo="Acompanham calendário, temperatura e estação do ano"
        natureza="ESTIMADO"
        valor={partes?.clima ?? null}
        formato="num"
        casas={2}
        unidade="pontos"
        periodo={partes ? porCento(partes.proporcaoClima) : undefined}
        cor="var(--serie-termica)"
        motivoAusencia={semDecomposicao}
      />
      <Numero
        variante="faixa"
        rotulo="O modelo não reproduz (resíduo)"
        natureza="ESTIMADO"
        valor={partes?.residuo ?? null}
        formato="num"
        casas={2}
        unidade="pontos"
        periodo={partes ? porCento(partes.proporcaoResto) : undefined}
        cor="var(--serie-referencia)"
        motivoAusencia={semDecomposicao}
      />
      <Numero
        variante="faixa"
        rotulo={`Erro absoluto médio do modelo em dias que não viu, ${NOME_REGIAO[sm]}`}
        natureza="ESTIMADO"
        valor={m?.mape_pct ?? null}
        formato="pct"
        casas={2}
        periodo={`${dataBR(p027.periodo_avaliacao.inicio)} a ${dataBR(p027.periodo_avaliacao.fim)}`}
        evidencia={sm === "SIN" ? evidencia : null}
        endereco={sm === "SIN" ? "/setor-eletrico/carga/clima-e-calendario#p027" : undefined}
        nota={m?.mape_referencia_364d_pct != null ? `Referência ingênua de 364 dias: ${num(m.mape_referencia_364d_pct, 2)}% nos mesmos dias.` : "Sem erro da referência ingênua de 364 dias nesta publicação."}
        motivoAusencia="Sem métricas fora da amostra para esta região nesta publicação."
      />
    </FaixaMetricas>
  );
}

export function CargaClima({
  p027,
  a07,
  achado,
  diaReferencia,
  fonte,
  versao,
  notas,
}: {
  p027: Pick<NonNullable<P027>, "metricas" | "periodo_avaliacao" | "sensibilidade" | "por_origem_sin" | "recente_sin" | "resposta_temperatura">;
  a07: Pick<A07, "decomposicao" | "comparacoes">;
  /** Janela do achado A07 (a07.referencia), os dias dela e o motivo publicado quando o modelo cobre menos dias (a07.janela_modelo). */
  achado: { inicio: string; fim: string; dias_janela: number; motivo: string | null };
  diaReferencia: string;
  fonte: string;
  versao: string;
  /** Notas do painel (NotasDoPainel: o que mudou e a ressalva essencial), logo depois da figura principal e da tabela. */
  notas?: ReactNode;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const p = p027;
  const sm = v.sm as Regiao;
  const variante = v.var as VarianteModelo;
  const tipo = v.cmp as TipoComparacao;
  const recente = useMemo(() => paraTabela(linhasRecenteModelo(p)), [p]);
  const d = decomposicaoEscolhida(a07, sm, variante, tipo);
  const barras = useMemo(() => (d ? barrasDecomposicao(d) : []), [d]);
  const barrasTabela = useMemo(() => barras.map((b) => ({ ...b })), [barras]);
  const sens = useMemo(() => linhasSensibilidade(p, sm), [p, sm]);
  const sensTabela = useMemo(() => paraTabela(sens), [sens]);
  const origens = useMemo(() => p.por_origem_sin.map((o) => ({ ...o, id: o.origem, mes: mesAno(o.origem.slice(0, 7)) })), [p]);
  const temperatura = useMemo(() => linhasRespostaTemperatura(p), [p]);
  const metricasRegioes = REGIOES.map((r) => ({ id: r, regiao: NOME_REGIAO[r], ...p.metricas[r] }));
  const janelaCurta = textoJanelaCurta(d, { fim: achado.fim, dias_janela: achado.dias_janela }, a07.comparacoes);
  const variantesDisponiveis = VARIANTES.filter((x) => a07.decomposicao.some((y) => y.sm === sm && y.variante === x && y.comparacao === tipo));

  return (
    <div className="space-y-6">
      <div className="grid gap-y-4">
        <RespostaCurta id="p027" vivo veredito={vereditoClima(d, p, sm)}>
          {respostaClima(p, sm)}
        </RespostaCurta>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <CargaEscolha legenda="Região" opcoes={OPCOES_REGIAO} valor={sm} onEscolher={(x) => definir({ sm: x })} />
          <CargaEscolha legenda="Comparar com" opcoes={OPCOES_TIPO} valor={tipo} onEscolher={(x) => definir({ cmp: x })} />
          <CargaLista
            rotulo="Variante do modelo"
            opcoes={variantesDisponiveis.map((x) => ({ id: x, rotulo: p.sensibilidade.find((s) => s.variante === x)?.rotulo ?? x }))}
            valor={variante}
            onEscolher={(x) => definir({ var: x })}
          />
        </div>
      </div>

      <div className="space-y-4" id="decomposicao-a07">
        {d ? (
          <>
            <div data-nivel="analisar" data-resposta="p027-decomposicao" aria-live="polite" className="max-w-prose2 border-l-2 border-linha pl-3 text-sm leading-relaxed text-carvao-muted">
              <p className="rotulo mb-1 text-mineral">Os números por trás da resposta</p>
              <p>{respostaDecomposicao(d)}</p>
            </div>
            {d.fim < achado.fim && (
              <p className="border-l-2 border-mineral pl-3 text-sm text-carvao-muted">
                Esta variante cobre {plural(d.dias, "dia", "dias")}, até {dataBR(d.fim)}, e não a janela inteira ({dataBR(achado.inicio)} a {dataBR(achado.fim)})
                {achado.motivo ? `: ${achado.motivo}` : ": dia sem temperatura não entra no modelo"}.
              </p>
            )}
            <GraficoBarras
              titulo={`Diferença entre as janelas ${DO_REGIAO[sm]}, por parte do modelo (log × 100)`}
              dados={barrasTabela}
              chaveCategoria="id"
              chaveRotulo="rotulo"
              series={[{ id: "valor", rotulo: "Parte da diferença", cor: COR_REGIAO[sm] }]}
              unidade="log × 100"
              casas={2}
              orientacao="horizontal"
              referencias={[{ valor: d.real_log100, rotulo: "Diferença real" }]}
            />
            <TabelaInterativa
              titulo="Tabela equivalente: partes da diferença"
              colunas={COLUNAS_BARRAS}
              linhas={barrasTabela}
              chaveLinha="id"
              colunaRotulo="rotulo"
              fonte={fonte}
              versao={d.origem_modelo}
              nomeArquivo={`carga-decomposicao-a07-${sm}-${variante}-${tipo}`}
              chaveUrl="dec"
              nota={`As quatro partes do modelo somam a diferença prevista (${num(d.previsto_log100, 2)}); com o resíduo (${num(d.residuo_log100, 2)}), a diferença real (${num(d.real_log100, 2)}). Valores publicados, com duas casas.`}
            />
          </>
        ) : (
          <p className="text-sm text-carvao-muted">
            Esta combinação de região, variante e comparação não foi publicada: a janela não tem todos os dias com temperatura ou a variante não foi estimada para ela.
          </p>
        )}
        <p className="border-l-2 border-mineral pl-3 text-sm text-carvao-muted">
          {textoDefasagemTemperatura(p, diaReferencia)}
          {janelaCurta ? ` ${janelaCurta}` : ""}
        </p>
      </div>

      <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
        <div>
          <dt className="rotulo text-mineral">Período</dt>
          <dd className="mt-0.5">
            Avaliação fora da amostra de {dataBR(p.periodo_avaliacao.inicio)} a {dataBR(p.periodo_avaliacao.fim)} ({num(p.periodo_avaliacao.dias, 0)} dias)
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Universo</dt>
          <dd className="mt-0.5">
            Carga diária {DO_REGIAO[sm]}; temperatura média das capitais ponderada pela população
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Unidade</dt>
          <dd className="mt-0.5">
            MWmed; erro em %; contribuições em log × 100: o modelo trabalha com o logaritmo natural da carga, e a diferença entre duas cargas nessa escala se lê, aproximadamente,
            como pontos percentuais
          </dd>
        </div>
      </dl>

      {notas}

      <SecaoDoPainel
        id="validacao"
        titulo={`Últimos ${plural(recente.length, "dia previsto", "dias previstos")}: real, previsto e intervalo (SIN)`}
        lead="O modelo acerta dias que não viu? A carga real contra a prevista com os dados anteriores a cada origem mensal, e o que cada grupo de variáveis contribuiu à previsão."
      >
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao">{respostaUltimoDia(p)}</p>
        <CursorSincronizado>
          <GraficoLinhas
            titulo="Carga diária do SIN e previsão fora da amostra, com o intervalo de 80%"
            dados={recente}
            chaveX="d"
            series={[
              { id: "real", rotulo: "Real", cor: "var(--cor-energia)" },
              { id: "previsto", rotulo: "Previsto pelo modelo", sigla: "Previsto", cor: "var(--serie-referencia)", tracejada: true },
            ]}
            banda={{ inferior: "p10", superior: "p90", rotulo: "intervalo de 80% (quantis dos erros fora da amostra)" }}
            unidade="MWmed"
            casas={0}
            altura={280}
          />
          <GraficoLinhas
            titulo="Contribuição de cada grupo de variáveis à previsão, em relação à média do treino"
            dados={recente}
            chaveX="d"
            series={[
              { id: "calendario", rotulo: ROTULO_GRUPO.calendario, cor: "var(--serie-1)" },
              { id: "temperatura", rotulo: ROTULO_GRUPO.temperatura, cor: "var(--serie-termica)" },
              { id: "sazonalidade", rotulo: ROTULO_GRUPO.sazonalidade, cor: "var(--serie-hidraulica)" },
              { id: "nivel_tendencia", rotulo: ROTULO_GRUPO.nivel_tendencia, sigla: "Tendência", cor: "var(--serie-referencia)", tracejada: true },
            ]}
            unidade="log × 100"
            casas={1}
            altura={240}
            legendaInterativa
          />
        </CursorSincronizado>
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          No primeiro gráfico, a linha contínua é a carga real e a tracejada, a prevista pelo modelo; a faixa é o intervalo de 80%. No segundo, cada linha é a contribuição de um
          grupo de variáveis. A do calendário sobe e desce ao longo da semana porque dia útil, sábado e domingo ou feriado entram no modelo como grupos diferentes.
        </p>
        <TabelaInterativa
          titulo="Tabela equivalente: os mesmos dias dos dois gráficos"
          colunas={COLUNAS_RECENTE}
          linhas={recente}
          chaveLinha="id"
          colunaRotulo="d"
          fonte={fonte}
          versao={versao}
          nomeArquivo="carga-decomposicao-recente-sin"
          chaveUrl="prev"
          ordemInicial={{ coluna: "d", direcao: "desc" }}
          nota="Contribuição: mudança da previsão associada ao grupo, com o resto fixo. Não é efeito causal nem parcela explicada."
        />
      </SecaoDoPainel>

      <SecaoDoPainel id="sensibilidade" titulo="Sensibilidade: o resultado depende das escolhas do modelo?" lead="O erro de cada variante do modelo ao lado do erro do modelo principal, na mesma região.">
        <GraficoPontos
          titulo={`Erro absoluto médio de cada variante e do modelo principal, ${NOME_REGIAO[sm]}`}
          itens={sens.map((s) => ({ id: s.id, rotulo: s.rotulo, valor: s.mape_pct, referencia: s.mape_principal, detalhe: `${num(s.dias, 0)} dias; cobertura de 80%: ${num(s.cobertura_80_pct, 1)}%` }))}
          unidade="%"
          casas={2}
          rotuloValor="Erro da variante"
          rotuloReferencia="Erro do modelo principal"
          corValor={COR_REGIAO[sm]}
          corReferencia="var(--serie-referencia)"
          selecionado={variante}
          onSelecionar={(id) => id && definir({ var: id as VarianteModelo })}
        />
        <TabelaInterativa
          titulo="Tabela equivalente: variantes do modelo"
          colunas={COLUNAS_METRICAS}
          linhas={sensTabela}
          chaveLinha="id"
          colunaRotulo="rotulo"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`carga-decomposicao-sensibilidade-${sm}`}
          chaveUrl="sen"
          selecionado={variante}
          onSelecionar={(id) => id && definir({ var: id as VarianteModelo })}
        />
      </SecaoDoPainel>

      <SecaoDoPainel id="temperatura-resposta" titulo="Como a previsão responde à temperatura?">
        <GraficoLinhas
          titulo="Contribuição da temperatura à previsão, por grau, em relação à média do treino"
          dados={temperatura}
          chaveX="t"
          formatoX="texto"
          series={REGIOES.map((r) => ({ id: r, rotulo: NOME_REGIAO[r], sigla: CURTO_REGIAO[r], cor: COR_REGIAO[r] }))}
          unidade="log × 100"
          casas={1}
          legendaInterativa
          altura={280}
        />
        <p className="text-sm text-carvao-muted">
          Cada curva cobre só a faixa de temperatura observada no treino da região; fora dela, a célula fica sem dado. É a resposta do modelo, não uma relação física
          medida.
        </p>
        <TabelaInterativa
          titulo="Tabela equivalente: resposta à temperatura"
          colunas={COLUNAS_TEMPERATURA}
          linhas={temperatura}
          chaveLinha="id"
          colunaRotulo="t"
          fonte={fonte}
          versao={versao}
          nomeArquivo="carga-resposta-temperatura"
          chaveUrl="tmp"
        />
      </SecaoDoPainel>

      <SecaoDoPainel nivel="analisar" titulo="Quão bem o modelo reproduz dias que não viu">
        <TabelaInterativa
          titulo="Erro fora da amostra por região (modelo principal)"
          colunas={COLUNAS_REGIOES}
          linhas={metricasRegioes}
          chaveLinha="id"
          colunaRotulo="regiao"
          fonte={fonte}
          versao={versao}
          nomeArquivo="carga-decomposicao-metricas"
          chaveUrl="met"
          selecionado={sm}
          onSelecionar={(id) => id && definir({ sm: id as Regiao })}
          nota="Cobertura abaixo da nominal (80% e 95%) indica intervalos mais estreitos que a incerteza real."
        />
        <GraficoBarras
          titulo="SIN: erro absoluto médio de cada mês previsto (origem mensal)"
          dados={origens}
          chaveCategoria="id"
          chaveRotulo="mes"
          series={[{ id: "mape_pct", rotulo: "Erro absoluto médio do mês", cor: "var(--cor-energia)" }]}
          unidade="%"
          casas={2}
          referencias={[{ valor: p.metricas.SIN.mape_pct, rotulo: "Erro médio em todos os dias" }]}
        />
        <TabelaInterativa
          titulo="Tabela equivalente: erro por origem (SIN)"
          colunas={COLUNAS_ORIGENS}
          linhas={origens}
          chaveLinha="id"
          colunaRotulo="origem"
          fonte={fonte}
          versao={versao}
          nomeArquivo="carga-decomposicao-origens-sin"
          chaveUrl="ori"
        />
      </SecaoDoPainel>
    </div>
  );
}
