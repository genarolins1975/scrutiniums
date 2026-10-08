"use client";

import { useMemo } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { MapaCalor } from "@/components/energia/MapaCalor";
import { Numero } from "@/components/energia/Numero";
import { PldEscolha, PldLista } from "@/components/energia/PldControles";
import { PldFaixas } from "@/components/energia/PldFaixas";
import { PldHoraDia } from "@/components/energia/PldHoraDia";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
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
  linhasMensais,
  linhasSazonal,
  nomeMes,
  perfilHoraMes,
  respostaP011,
  rotaPainel,
  serieMedidaPorSm,
  serieSazonal,
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
 * marcados no gráfico e na tabela. A resposta, os números, o gráfico e a tabela
 * leem as mesmas linhas mensais da gold.
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
  mesFichas,
  fichas,
  anoReferencia,
  diaReferencia,
  fonte,
  versao,
}: {
  h: HistoricoP011;
  marcos: { x: string; rotulo: string }[];
  /** Mês das fichas ponderadas (último mês completo com as três médias), "AAAA-MM". */
  mesFichas: string | null;
  fichas: Record<string, Evidencia>;
  anoReferencia: number;
  diaReferencia: string;
  fonte: string;
  versao: string;
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
  const pos = h.posicao_referencia.find((x) => x.sm === sm);
  const i = mesFichas ? h.mensal.meses.indexOf(mesFichas) : -1;
  const endereco = `${rotaPainel("p011")}#p011`;
  const ultimoMes = h.mensal.meses[h.mensal.meses.length - 1];
  const parcialUltimo = h.mensal.parcial[h.mensal.parcial.length - 1];
  const nominal = v.moeda === "nominal";

  return (
    <div className="space-y-6">
      <PldEscolha legenda="Submercado" opcoes={SUBMERCADOS.map((s) => ({ id: s, rotulo: CURTO_SM[s], detalhe: NOME_SM[s] }))} valor={sm} onEscolher={(s) => definir({ sm: s })} />

      <RespostaCurta id="p011" vivo veredito={vereditoP011(bloco, sm)}>
        {respostaP011(bloco, sm)}
      </RespostaCurta>

      <dl className="grid gap-x-6 gap-y-1 text-xs text-carvao-muted sm:grid-cols-3">
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

      {mesFichas && ultimoMes !== mesFichas && (
        <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-troca-de-mes="">
          Os três cartões de média mensal usam {mesAno(mesFichas)}, o último mês com as médias calculadas em todas as horas do mês. {mesAno(ultimoMes)} aparece na tabela e no
          gráfico, mas{" "}
          {h.mensal[sm].horas_com_carga[h.mensal.meses.length - 1] < h.mensal[sm].horas[h.mensal.meses.length - 1]
            ? `a carga do balanço tem ${num(h.mensal[sm].horas_com_carga[h.mensal.meses.length - 1], 0)} das ${num(h.mensal[sm].horas[h.mensal.meses.length - 1], 0)} horas do mês, e as ponderadas de ${mesAno(ultimoMes)} usam só as horas com carga publicada.`
            : "ainda não tem as três médias calculadas nas mesmas horas."}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Numero
          rotulo={`Média diária de ${dataBR(pos?.dia ?? diaReferencia)}`}
          natureza="CALCULADO"
          valor={pos?.media_dia ?? null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          periodo={dataBR(pos?.dia ?? diaReferencia)}
          motivoAusencia="Dia sem as 24 horas publicadas."
          tamanho="medio"
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
          rotulo={`Média temporal de ${mesFichas ? mesAno(mesFichas) : "mês sem dado"}`}
          natureza="CALCULADO"
          valor={i >= 0 ? (h.mensal[sm].temporal[i] ?? null) : null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          periodo={mesFichas ? mesAno(mesFichas) : undefined}
          motivoAusencia="Sem mês completo com as três médias."
          tamanho="medio"
          nota={
            <>
              Todas as horas pesam igual. Média simples das horas do mês, sem ficha de prova própria.
              <span data-nivel="analisar"> No arquivo baixado, é a coluna media_temporal de pld_mensal.csv.</span>
            </>
          }
        />
        <Numero
          rotulo={`Ponderada pela carga do balanço, ${mesFichas ? mesAno(mesFichas) : ""}`}
          natureza="CALCULADO"
          evidencia={mesFichas ? (fichas[`ponderada_${mesFichas}_${sm}`] ?? null) : null}
          valor={i >= 0 ? (h.mensal[sm].ponderada_carga[i] ?? null) : null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          motivoAusencia="Sem carga do balanço em todas as horas do mês."
          tamanho="medio"
          endereco={endereco}
          nota="Peso estimado: inclui a MMGD estimada pelo ONS desde 2023. O peso é a carga horária do Balanço de Energia nos Subsistemas do ONS, que não vai nos arquivos desta página: para refazer a média, baixe-a na fonte."
        />
        <Numero
          rotulo={`Ponderada pela carga sem MMGD, ${mesFichas ? mesAno(mesFichas) : ""}`}
          natureza="CALCULADO"
          evidencia={mesFichas ? (fichas[`ponderada_sem_mmgd_${mesFichas}_${sm}`] ?? null) : null}
          valor={i >= 0 ? (h.mensal[sm].ponderada_carga_sem_mmgd[i] ?? null) : null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          motivoAusencia="Sem a carga verificada da API do ONS no mês."
          tamanho="medio"
          endereco={endereco}
          nota="Mesma base de carga em toda a série. A carga verificada vem do ONS e também não vai nos arquivos desta página."
        />
      </div>

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
      <p className="text-xs leading-relaxed text-carvao-muted">
        Marcas verticais: mudanças do perímetro da carga do balanço declaradas pelo ONS; a ponderada pelo balanço só se compara entre meses do mesmo perímetro, e a ponderada
        sem MMGD atravessa as mudanças. Mês sem as horas de carga publicadas fica com a ponderada calculada nas horas disponíveis (coluna &ldquo;mesmas horas&rdquo; da tabela).
        Moeda constante só existe até o último mês com IPCA publicado.
      </p>
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

      <div data-nivel="analisar" className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Comparar submercados na mesma escala</h3>
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
      </div>

      <div data-nivel="analisar" className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Para esta época do ano: faixa das médias diárias de anos anteriores</h3>
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
        <p className="text-xs leading-relaxed text-carvao-muted">
          A faixa é a distribuição das médias diárias do mesmo mês nos anos anteriores; a linha de {anoReferencia} é a média do mês inteiro, naturalmente menos dispersa que os
          dias. Cada ano anterior teve piso e tetos próprios.
        </p>
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
      </div>

      <div data-nivel="analisar" className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Distribuição do PLD horário em cada regime anual de limites</h3>
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
      </div>

      <div data-nivel="analisar" className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Perfil hora × mês dos últimos 12 meses</h3>
        <MapaCalor
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
      </div>

      <div data-nivel="analisar" className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Mapa hora × dia</h3>
        <PldHoraDia url={h.hora_dia.url} sm={sm} nota={h.hora_dia.nota} />
      </div>
    </div>
  );
}
