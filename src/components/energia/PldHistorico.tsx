"use client";

import { useMemo, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { PldEscolha, PldLista } from "@/components/energia/PldControles";
import { PldFaixas } from "@/components/energia/PldFaixas";
import { PldHoraDia } from "@/components/energia/PldHoraDia";
import { PldMapaHoras } from "@/components/energia/PldMapaHoras";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, mesAno, num } from "@/lib/energia/formato";
import {
  COLUNAS_MENSAIS,
  COLUNAS_REGIMES_DIST,
  COLUNAS_SAZONAL,
  COR_SM,
  CURTO_MEDIDA,
  CURTO_SM,
  DO_SM,
  ESCALA_PLD,
  HORAS_DO_DIA,
  MEDIDAS_MENSAIS,
  NOME_SM,
  ROTULO_MEDIDA,
  SUBMERCADOS,
  faixasRegimes,
  inflacaoAcumulada,
  linhasMensais,
  linhasSazonal,
  nomeMes,
  perfilHoraMes,
  respostaP011,
  rotaPainel,
  serieMedidaPorSm,
  serieSazonal,
  textoInflacao,
  vereditoP011,
  type MedidaMensal,
} from "@/lib/energia/pld";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { Submercado } from "@/lib/energia/tipos";
import type { BlocoHistorico } from "@/lib/energia/tipos-pld";

/**
 * P011, histórico e distribuição: submercado (?sm=), moeda do gráfico mensal
 * (?moeda=), intervalo (?de=, ?ate=), submercados comparados (?sms=, até quatro) e
 * medida comparada (?med=) ficam na URL; busca, ordem e filtros das tabelas também
 * (prefixos mes, saz e reg). Média temporal e médias ponderadas pela carga aparecem
 * sempre com o nome; o mês parcial e as mudanças de perímetro do peso ficam
 * marcados no gráfico e na tabela. A resposta, as medidas da faixa, o gráfico e a tabela
 * leem as mesmas linhas mensais da gold.
 *
 * Ordem da página: resposta e escolha do submercado, figura principal (a faixa sazonal: a pergunta da
 * página é "está alto para esta época?"), faixa de medidas (a média do dia e as três médias do mês, cada
 * uma com o nome e o peso declarados, e a definição de cada régua junto delas, logo antes do gráfico das
 * médias mensais, que é onde as réguas são comparadas), as médias
 * mensais em moeda nominal ou constante, tabela, notas do painel e as outras visões que dão a régua,
 * todas visíveis em Entender com a sua pergunta: distribuição por regime anual de limites, perfil por
 * hora e mês e mapa hora por dia (em tela estreita, por faixa de quatro horas). A comparação entre
 * submercados fica em Analisar.
 */
const ESQUEMA = {
  sm: campo(tiposUrl.opcao(SUBMERCADOS), "SE" as Submercado),
  moeda: campo(tiposUrl.opcao(["nominal", "constante"] as const), "nominal" as "nominal" | "constante"),
  de: campo(tiposUrl.data(), ""),
  ate: campo(tiposUrl.data(), ""),
  med: campo(tiposUrl.opcao(MEDIDAS_MENSAIS), "temporal" as MedidaMensal),
  sms: campo(tiposUrl.lista(tiposUrl.opcao(SUBMERCADOS), { max: LIMITE_COMPARACAO }), [...SUBMERCADOS] as Submercado[]),
};

export type HistoricoP011 = Pick<BlocoHistorico, "mensal" | "sazonal_mes" | "posicao_referencia" | "mes_corrente" | "regimes" | "perfil_hora_mes" | "hora_dia" | "deflator">;

export function PldHistorico({
  h,
  marcos,
  legendaMarcos,
  mesFichas,
  fichas,
  anoReferencia,
  diaReferencia,
  fonte,
  versao,
  notas,
  definicoes,
  notasRegimes,
  urlBalanco,
  urlCargaVerificada,
}: {
  h: HistoricoP011;
  /** Marcas do gráfico mensal já numeradas (1, 2); o texto de cada uma vem em `legendaMarcos`. */
  marcos: { x: string; rotulo: string }[];
  legendaMarcos: { n: number; data: string; texto: string }[];
  /** Mês das fichas ponderadas (último mês completo com as três médias), "AAAA-MM". */
  mesFichas: string | null;
  fichas: Record<string, Evidencia>;
  anoReferencia: number;
  diaReferencia: string;
  fonte: string;
  versao: string;
  /** Notas do painel (NotasDoPainel), logo depois da figura principal e da tabela. */
  notas?: ReactNode;
  /** Definição de cada régua e dos termos (perímetro, MMGD, moeda constante), em texto visível junto das medidas. */
  definicoes?: ReactNode;
  /** Por submercado, o que a distribuição desde 2021 mistura (nominal e regimes de limites diferentes). */
  notasRegimes?: Partial<Record<Submercado, string | null>>;
  /** Conjunto do Balanço de Energia nos Subsistemas, no ONS (peso da média ponderada pela carga). */
  urlBalanco?: string | null;
  /** Arquivo da carga verificada com e sem MMGD publicado pelo observatório (peso da média ponderada sem MMGD). */
  urlCargaVerificada?: string;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const sm = v.sm as Submercado;
  const bloco = h as BlocoHistorico;
  const linhas = useMemo(() => linhasMensais(bloco, sm), [bloco, sm]);
  // o eixo mensal usa o primeiro dia do mês como data (o filtro de intervalo da URL é uma data)
  const serie = useMemo(() => linhas.map((l) => ({ ...l, x: `${l.m}-01` })), [linhas]);
  const marcosX = marcos.map((m) => ({ x: `${m.x}-01`, rotulo: m.rotulo }));
  const intervalo = v.de && v.ate ? { inicio: v.de, fim: v.ate } : null;
  const escolhidos = v.sms as Submercado[];
  const medida = v.med as MedidaMensal;
  const comparacao = useMemo(() => serieMedidaPorSm(bloco, medida, escolhidos).map((l) => ({ ...l, x: `${l.m}-01` })), [bloco, medida, escolhidos]);
  const sazonal = useMemo(() => serieSazonal(bloco, sm, anoReferencia), [bloco, sm, anoReferencia]);
  const sazonalTabela = useMemo(() => linhasSazonal(bloco, sm), [bloco, sm]);
  const faixas = useMemo(() => faixasRegimes(bloco, sm), [bloco, sm]);
  const perfil = useMemo(() => perfilHoraMes(bloco, sm), [bloco, sm]);
  const inflacao = useMemo(() => textoInflacao(inflacaoAcumulada(bloco.mensal)), [bloco]);
  const pos = h.posicao_referencia.find((x) => x.sm === sm);
  const i = mesFichas ? h.mensal.meses.indexOf(mesFichas) : -1;
  const endereco = `${rotaPainel("p011")}#p011`;
  const ultimoMes = h.mensal.meses[h.mensal.meses.length - 1];
  const parcialUltimo = h.mensal.parcial[h.mensal.parcial.length - 1];
  const nominal = v.moeda === "nominal";
  const iUltimo = h.mensal.meses.length - 1;
  const trocaDeMes =
    mesFichas && ultimoMes !== mesFichas ? (
      <p data-troca-de-mes="">
        As três médias mensais usam {mesAno(mesFichas)}, o último mês com as médias calculadas em todas as horas do mês. {mesAno(ultimoMes)} aparece na tabela e no gráfico, mas{" "}
        {h.mensal[sm].horas_com_carga[iUltimo] < h.mensal[sm].horas[iUltimo]
          ? `a carga do balanço tem ${num(h.mensal[sm].horas_com_carga[iUltimo], 0)} das ${num(h.mensal[sm].horas[iUltimo], 0)} horas do mês, e as ponderadas de ${mesAno(ultimoMes)} usam só as horas com carga publicada.`
          : "ainda não tem as três médias calculadas nas mesmas horas."}
      </p>
    ) : null;
  const linkArquivo = "underline underline-offset-4 text-energia-dark hover:text-carvao";

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <RespostaCurta id="p011" vivo veredito={vereditoP011(bloco, sm)}>
          {respostaP011(bloco, sm)}
        </RespostaCurta>
        <PldEscolha legenda="Submercado" opcoes={SUBMERCADOS.map((s) => ({ id: s, rotulo: CURTO_SM[s], detalhe: NOME_SM[s] }))} valor={sm} onEscolher={(s) => definir({ sm: s })} />
      </div>

      {/* a pergunta da página: onde a média do dia fica entre as médias diárias do mesmo mês nos anos anteriores */}
      <SecaoDoPainel id="sazonalidade" titulo="Qual é a faixa das médias diárias nesta época do ano, em anos anteriores?">
        <GraficoLinhas
          titulo={`Médias diárias do PLD por mês do ano (anos anteriores a ${anoReferencia}) e média mensal de ${anoReferencia}, ${NOME_SM[sm]}`}
          dados={sazonal}
          chaveX="mes"
          formatoX="texto"
          series={[
            { id: "p50", rotulo: "Mediana das médias diárias", sigla: "mediana", cor: "var(--serie-referencia)" },
            { id: "ano", rotulo: `Média mensal de ${anoReferencia} (média das horas)`, sigla: String(anoReferencia), cor: COR_SM[sm], espessura: 2.5 },
          ]}
          banda={{ inferior: "p10", superior: "p90", rotulo: "percentil 10 a 90 das médias diárias" }}
          unidade="R$/MWh"
          casas={2}
          zeroNoEixo
        />
        <div className="space-y-1.5 text-xs leading-relaxed text-carvao-muted" data-texto="sazonal-nominal">
          <p>
            A faixa é a distribuição das médias diárias do mesmo mês nos anos anteriores; a linha de {anoReferencia} é a média do mês inteiro, naturalmente menos dispersa que os
            dias. {notasRegimes?.[sm] ?? "Os valores são nominais, e cada ano anterior teve piso e tetos próprios."}
          </p>
          {inflacao && <p>{inflacao}</p>}
          <p>A série semanal do PLD de 2001 a 2020, que a CCEE também publica, tem outra granularidade e ainda não está integrada: a referência começa em janeiro de 2021.</p>
        </div>
        <TabelaInterativa
          titulo={`Tabela equivalente: percentis das médias diárias por mês, ${NOME_SM[sm]}`}
          colunas={COLUNAS_SAZONAL}
          linhas={sazonalTabela}
          chaveLinha="id"
          colunaRotulo="mes"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`pld-sazonal-${sm}`}
          chaveUrl="saz"
        />
      </SecaoDoPainel>

      <FaixaMetricas
        colunas={4}
        rotulo={`Médias do PLD ${DO_SM[sm]}, cada uma com o seu peso`}
        nota={
          definicoes || trocaDeMes ? (
            <div className="space-y-2">
              {definicoes}
              {trocaDeMes}
            </div>
          ) : undefined
        }
      >
        <Numero
          variante="faixa"
          rotulo={`Média diária de ${dataBR(pos?.dia ?? diaReferencia)}`}
          natureza="CALCULADO"
          valor={pos?.media_dia ?? null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          periodo={dataBR(pos?.dia ?? diaReferencia)}
          motivoAusencia="Dia sem as 24 horas publicadas."
          cor={COR_SM[sm]}
          nota={
            pos && pos.mesmo_mes.percentil !== null
              ? pos.mesmo_mes.empates === 0
                ? `Em ${num(pos.mesmo_mes.percentil, 1)}% dos ${num(pos.mesmo_mes.n_dias, 0)} dias de ${nomeMes(pos.mesmo_mes.mes)} de anos anteriores, a média diária foi menor.`
                : `Percentil ${num(pos.mesmo_mes.percentil, 1)} entre ${num(pos.mesmo_mes.n_dias, 0)} dias do mesmo mês de anos anteriores.`
              : undefined
          }
        />
        <Numero
          variante="faixa"
          rotulo={`Média temporal de ${mesFichas ? mesAno(mesFichas) : "mês sem dado"}`}
          natureza="CALCULADO"
          valor={i >= 0 ? (h.mensal[sm].temporal[i] ?? null) : null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          periodo={mesFichas ? mesAno(mesFichas) : undefined}
          motivoAusencia="Sem mês completo com as três médias."
          nota={
            <>
              Todas as horas pesam igual. Média simples das horas do mês, sem ficha de prova própria.
              <span data-nivel="auditar"> No arquivo baixado, é a coluna media_temporal de pld_mensal.csv.</span>
            </>
          }
        />
        <Numero
          variante="faixa"
          rotulo={`Ponderada pela carga do balanço, ${mesFichas ? mesAno(mesFichas) : ""}`}
          natureza="CALCULADO"
          evidencia={mesFichas ? (fichas[`ponderada_${mesFichas}_${sm}`] ?? null) : null}
          valor={i >= 0 ? (h.mensal[sm].ponderada_carga[i] ?? null) : null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          motivoAusencia="Sem carga do balanço em todas as horas do mês."
          endereco={endereco}
          nota={
            <>
              Peso estimado: inclui a MMGD estimada pelo ONS desde 2023.
              {urlBalanco ? (
                <>
                  {" "}
                  A carga do balanço está no{" "}
                  <a href={urlBalanco} target="_blank" rel="noopener noreferrer" className={linkArquivo}>
                    conjunto de dados do ONS
                  </a>
                  .
                </>
              ) : null}
            </>
          }
        />
        <Numero
          variante="faixa"
          rotulo={`Ponderada pela carga sem MMGD, ${mesFichas ? mesAno(mesFichas) : ""}`}
          natureza="CALCULADO"
          evidencia={mesFichas ? (fichas[`ponderada_sem_mmgd_${mesFichas}_${sm}`] ?? null) : null}
          valor={i >= 0 ? (h.mensal[sm].ponderada_carga_sem_mmgd[i] ?? null) : null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          motivoAusencia="Sem a carga verificada da API do ONS no mês."
          endereco={endereco}
          nota={
            <>
              Mesma base de carga em toda a série.
              {urlCargaVerificada ? (
                <>
                  {" "}
                  A carga por hora, com e sem MMGD, está em{" "}
                  <a href={urlCargaVerificada} download className={linkArquivo}>
                    arquivo da carga verificada (CSV)
                  </a>
                  .
                </>
              ) : null}
            </>
          }
        />
      </FaixaMetricas>

      <SecaoDoPainel id="medias-mensais" titulo="Como as três médias do mês evoluíram desde 2021?">
        <div className="space-y-3">
          <PldEscolha
            legenda="Moeda no gráfico mensal"
            opcoes={[
              { id: "nominal" as const, rotulo: "Nominal, três médias" },
              { id: "constante" as const, rotulo: "Temporal, nominal e em moeda constante" },
            ]}
            valor={v.moeda}
            onEscolher={(m) => definir({ moeda: m })}
          />
          <GraficoLinhas
            titulo={nominal ? `PLD médio mensal ${DO_SM[sm]}: média temporal e médias ponderadas pela carga` : `PLD médio mensal, média temporal nominal e em moeda constante, ${NOME_SM[sm]}`}
            dados={serie}
            chaveX="x"
            formatoX="mes"
            series={
              nominal
                ? [
                    { id: "temporal", rotulo: ROTULO_MEDIDA.temporal, sigla: "temporal", cor: COR_SM[sm], espessura: 2.5 },
                    { id: "ponderada_carga", rotulo: ROTULO_MEDIDA.ponderada_carga, sigla: "ponderada (balanço)", cor: "var(--serie-referencia)", tracejada: true },
                    { id: "ponderada_carga_sem_mmgd", rotulo: ROTULO_MEDIDA.ponderada_carga_sem_mmgd, sigla: "ponderada sem MMGD", cor: "var(--serie-hidraulica)" },
                  ]
                : [
                    { id: "temporal", rotulo: "Média temporal nominal", sigla: "nominal", cor: COR_SM[sm], espessura: 2.5 },
                    { id: "real", rotulo: ROTULO_MEDIDA.real, sigla: "moeda constante", cor: "var(--serie-referencia)", tracejada: true },
                  ]
            }
            unidade="R$/MWh"
            casas={2}
            zeroNoEixo
            marcos={marcosX}
            zoom
            intervalo={intervalo}
            onIntervalo={(iv) => definir({ de: iv?.inicio ?? "", ate: iv?.fim ?? "" })}
            legendaInterativa
          />
          {legendaMarcos.length > 0 && (
            <ol className="space-y-0.5 text-xs leading-relaxed text-carvao-muted" data-legenda="marcas-do-grafico" aria-label="Marcas verticais do gráfico">
              {legendaMarcos.map((m) => (
                <li key={m.n}>
                  <span className="font-medium text-carvao">{m.n}</span> {m.data}: {m.texto}.
                </li>
              ))}
            </ol>
          )}
          <p className="text-xs leading-relaxed text-carvao-muted">
            Marcas numeradas: mudanças do perímetro da carga do balanço declaradas pelo ONS; a ponderada pelo balanço só se compara entre meses do mesmo perímetro, e a ponderada
            sem MMGD atravessa as mudanças. Mês sem as horas de carga publicadas fica com a ponderada calculada nas horas disponíveis (coluna &ldquo;mesmas horas&rdquo; da tabela).
            Moeda constante só existe até o último mês com IPCA publicado.
            {nominal && (
              <span data-texto="escala-das-tres-medias">
                {" "}
                A escala vai de zero ao maior preço da série, e por isso as três linhas parecem juntas; a diferença entre elas no último mês completo está em O que mudou, mais
                abaixo.
              </span>
            )}
          </p>
        </div>

        <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
          <div>
            <dt className="rotulo text-mineral">Período</dt>
            <dd className="mt-0.5">
              Dia de referência {dataBR(diaReferencia)}; meses de {mesAno(h.mensal.meses[0])} a {mesAno(ultimoMes)}
              {parcialUltimo ? " (último mês parcial)" : ""}; percentis com os anos anteriores a {anoReferencia}
            </dd>
          </div>
          <div>
            <dt className="rotulo text-mineral">Universo</dt>
            <dd className="mt-0.5">Horas com PLD publicado {DO_SM[sm]}; ponderadas só nas horas com carga positiva publicada</dd>
          </div>
          <div>
            <dt className="rotulo text-mineral">Unidade</dt>
            <dd className="mt-0.5">
              R$/MWh nominais; moeda constante: valores corrigidos pelo IPCA para os reais de {h.deflator.mes_base ? mesAno(h.deflator.mes_base) : "mês sem índice"}
            </dd>
          </div>
        </dl>

        <TabelaInterativa
          titulo={`Tabela equivalente: PLD médio mensal, ${NOME_SM[sm]}`}
          colunas={COLUNAS_MENSAIS}
          linhas={linhas}
          chaveLinha="id"
          colunaRotulo="m"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`pld-mensal-${sm}`}
          chaveUrl="mes"
          ordemInicial={{ coluna: "m", direcao: "desc" }}
        />
      </SecaoDoPainel>

      {notas}

      <SecaoDoPainel id="distribuicao" titulo="Como o preço horário se distribui em cada regime anual de limites?">
        <PldFaixas faixas={faixas} titulo={`PLD horário por ano, ${NOME_SM[sm]} (R$/MWh)`} />
        <p className="text-xs leading-relaxed text-carvao-muted">
          Anos com muitas horas no piso têm a caixa encostada no tracejado: são horas com preço igual por regra (empates no piso), não preços parecidos por acaso.
        </p>
        <TabelaInterativa
          titulo={`Tabela equivalente: quantis do PLD horário por ano, ${NOME_SM[sm]}`}
          colunas={COLUNAS_REGIMES_DIST}
          linhas={faixas.map((f) => ({ ...f, parcial: f.parcial ? "sim" : "não" }))}
          chaveLinha="id"
          colunaRotulo="rotulo"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`pld-distribuicao-${sm}`}
          chaveUrl="reg"
        />
      </SecaoDoPainel>

      <SecaoDoPainel id="perfil-hora-mes" titulo="Como o PLD médio varia pelas horas do dia, mês a mês?" lead="Média de cada hora do dia em cada um dos últimos 12 meses.">
        <PldMapaHoras
          titulo={`PLD médio por hora do dia em cada mês, ${NOME_SM[sm]}`}
          linhas={perfil.linhas}
          colunas={HORAS_DO_DIA}
          nomeLinhas="Mês"
          nomeColunas="Hora"
          valores={perfil.valores}
          escala={ESCALA_PLD}
          unidade="R$/MWh"
          casas={2}
          passoRotuloColunas={3}
          nota="Escala fixa em R$/MWh nominais, a mesma do mapa hora × dia: a mesma cor é o mesmo preço em qualquer submercado e mês."
        />
      </SecaoDoPainel>

      <SecaoDoPainel id="mapa-hora-dia" titulo="Como o PLD varia hora a hora nos últimos dias?">
        <PldHoraDia url={h.hora_dia.url} sm={sm} nota={h.hora_dia.nota} />
      </SecaoDoPainel>

      <SecaoDoPainel id="comparar" titulo="Comparar submercados na mesma escala" nivel="analisar">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <PldLista rotulo="Medida" opcoes={MEDIDAS_MENSAIS.map((m) => ({ id: m, rotulo: ROTULO_MEDIDA[m] }))} valor={medida} onEscolher={(m) => definir({ med: m })} />
        </div>
        <Comparador
          rotulo={`Submercados no gráfico (até ${LIMITE_COMPARACAO})`}
          entidades={SUBMERCADOS.map((s) => ({ id: s, rotulo: NOME_SM[s], sinonimos: [CURTO_SM[s]] }))}
          selecionadas={escolhidos}
          onMudar={(ids) => definir({ sms: ids as Submercado[] })}
          dicaBusca="Sul, Nordeste, Norte"
          vazio="Nenhum submercado escolhido. Escolha até quatro para ver a mesma medida na mesma escala."
        >
          {() => null}
        </Comparador>
        {escolhidos.length > 0 && (
          <GraficoLinhas
            titulo={`${ROTULO_MEDIDA[medida]}, por submercado`}
            dados={comparacao}
            chaveX="x"
            formatoX="mes"
            series={escolhidos.map((s) => ({ id: s, rotulo: NOME_SM[s], sigla: CURTO_SM[s], cor: COR_SM[s] }))}
            unidade="R$/MWh"
            casas={2}
            zeroNoEixo
            marcos={medida === "ponderada_carga" ? marcosX : []}
          />
        )}
        <p className="text-xs text-carvao-muted">Medida: {CURTO_MEDIDA[medida]}. Os valores de cada submercado estão na tabela mensal ao escolher o submercado acima e no CSV mensal.</p>
      </SecaoDoPainel>
    </div>
  );
}
