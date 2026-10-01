"use client";

import { useMemo, type ReactNode } from "react";
import { AguaEscolha, AguaLista } from "@/components/energia/AguaControles";
import { AguaMapaBacias } from "@/components/energia/AguaMapaBacias";
import { Comparador } from "@/components/energia/Comparador";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  COLUNAS_CHUVA,
  COLUNAS_PREVISAO_CHUVA,
  COLUNAS_PREVISAO_TEMPERATURA,
  COLUNAS_TEMPERATURA,
  COR_COMPARACAO,
  COR_REGIAO,
  CORES_ANOMALIA,
  CURTO_REGIAO,
  DO_REGIAO,
  NOME_REGIAO,
  REGIOES,
  classificacaoChuva,
  linhasChuva,
  linhasMultiplosChuva,
  linhasPrevisaoChuva,
  linhasPrevisaoTemperatura,
  linhasTemperatura,
  nomeProprio,
  periodoBase,
  periodosMapa,
  respostaChuva,
  respostaPrevisao,
  respostaTemperatura,
  rotuloPeriodoMapa,
  rotuloRecorte,
  rotuloRodada,
  serieDiariaTemperatura,
  serieMensalChuva,
  serieMensalTemperatura,
  seriePrevisao,
  textoAssociacao,
  valoresMapaChuva,
} from "@/lib/energia/agua";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { carimbo, dataBR, mesAno, num, plural } from "@/lib/energia/formato";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { Regiao } from "@/lib/energia/tipos";
import type { AguaPrecipitacaoBacia, AguaPrevisao, AguaTemperatura } from "@/lib/energia/tipos-agua";

/**
 * P019, chuva, temperatura e clima: bacia escolhida (?bac=), período do mapa (?per=, a
 * janela de 30 dias ou um dos 12 meses completos), recorte da temperatura (?rt=) e
 * bacias comparadas (?cmp=, até quatro) ficam na URL. Mapa, tabela equivalente e
 * histórico da bacia usam a mesma seleção; o mapa e a tabela usam os mesmos valores
 * (valoresMapaChuva e linhasChuva sobre o mesmo período). Estimativa (satélite e
 * reanálise) e previsão (uma rodada de um modelo) ficam em blocos separados, cada um
 * com o seu selo; nenhum cenário é desenhado.
 */
const ESQUEMA = {
  bac: campo(tiposUrl.texto({ max: 40 }), ""),
  per: campo(tiposUrl.texto({ max: 7 }), "30d"),
  rt: campo(tiposUrl.opcao(REGIOES), "SIN"),
  cmp: campo(tiposUrl.lista(tiposUrl.texto({ max: 40 }), { max: LIMITE_COMPARACAO }), ["GRANDE", "PARANAIBA", "SAO FRANCISCO", "TOCANTINS"]),
};

export function AguaClima({
  precipitacao,
  temperatura,
  previsao,
  base,
  baciaPadrao,
  urlGeo,
  fonteChuva,
  fonteTemperatura,
  versaoChuva,
  versaoTemperatura,
  destaques,
  motivoSemPrevisao,
}: {
  precipitacao: AguaPrecipitacaoBacia[];
  temperatura: AguaTemperatura[];
  previsao: AguaPrevisao | null;
  base: string;
  baciaPadrao: string;
  urlGeo: string;
  fonteChuva: string;
  fonteTemperatura: string;
  versaoChuva: string;
  versaoTemperatura: string;
  destaques?: ReactNode;
  motivoSemPrevisao: string;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const periodos = useMemo(() => periodosMapa(precipitacao), [precipitacao]);
  const per = periodos.includes(v.per) ? v.per : "30d";
  const bacia = precipitacao.find((b) => b.bacia === v.bac) ?? precipitacao.find((b) => b.bacia === baciaPadrao) ?? precipitacao[0] ?? null;
  const rt = v.rt as Regiao;
  const temp = temperatura.find((t) => t.recorte === rt) ?? temperatura.find((t) => t.recorte === "SIN") ?? null;
  const dia30 = precipitacao[0]?.dia ?? null;
  const valores = useMemo(() => valoresMapaChuva(precipitacao, per), [precipitacao, per]);
  const classes = useMemo(() => classificacaoChuva(valores), [valores]);
  const linhas = useMemo(() => linhasChuva(precipitacao, per), [precipitacao, per]);
  const nomes = useMemo(() => Object.fromEntries(precipitacao.map((b) => [b.bacia, rotuloRecorte("bacia", b.bacia)])), [precipitacao]);
  const historico = useMemo(() => (bacia ? serieMensalChuva(bacia) : []), [bacia]);
  const escolhidas = useMemo(
    () => (v.cmp as string[]).map((id) => precipitacao.find((b) => b.bacia === id)).filter((b): b is AguaPrecipitacaoBacia => !!b),
    [v.cmp, precipitacao],
  );
  const multiplos = useMemo(() => linhasMultiplosChuva(escolhidas), [escolhidas]);
  const tDiaria = useMemo(() => (temp ? serieDiariaTemperatura(temp) : []), [temp]);
  const tMensal = useMemo(() => (temp ? serieMensalTemperatura(temp) : []), [temp]);
  const linhasTemp = useMemo(() => linhasTemperatura(temperatura), [temperatura]);
  const prev = useMemo(() => (previsao && bacia ? seriePrevisao(previsao, bacia.bacia) : []), [previsao, bacia]);
  const selecionar = (id: string | null) => id && definir({ bac: id === baciaPadrao ? "" : id });
  const assoc = bacia ? textoAssociacao(bacia) : null;
  // base, janelas e períodos dos títulos saem da gold (tamanho das séries publicadas), nunca de número escrito aqui
  const baseTxt = periodoBase(base);
  const baseAssoc = periodoBase(precipitacao.find((b) => b.associacao_ena?.periodo)?.associacao_ena?.periodo ?? base);
  const mesesHistorico = plural(historico.length, "mês completo", "meses completos");
  const mesesMultiplos = plural(multiplos.length, "mês completo", "meses completos");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <AguaLista rotulo="Bacia" opcoes={precipitacao.map((b) => ({ id: b.bacia, rotulo: nomes[b.bacia] }))} valor={bacia?.bacia ?? ""} onEscolher={(x) => selecionar(x)} />
        <AguaLista
          rotulo="Período do mapa"
          opcoes={periodos.map((p) => ({ id: p, rotulo: rotuloPeriodoMapa(p, dia30) }))}
          valor={per}
          onEscolher={(x) => definir({ per: x })}
        />
        <AguaEscolha legenda="Temperatura" opcoes={REGIOES.map((r) => ({ id: r, rotulo: CURTO_REGIAO[r], detalhe: NOME_REGIAO[r] }))} valor={rt} onEscolher={(x) => definir({ rt: x })} />
      </div>

      <div className="max-w-prose2 space-y-2 text-base leading-relaxed text-carvao" data-resposta="p019" aria-live="polite">
        <p>{bacia ? respostaChuva(bacia, base) : "Sem estimativa de chuva por bacia nesta publicação."}</p>
        <p>{temp ? respostaTemperatura(temp, base) : "Sem temperatura estimada nesta publicação."}</p>
        {assoc && <p className="text-sm text-carvao-muted">{assoc}</p>}
      </div>

      <dl className="grid gap-x-6 gap-y-1 text-xs text-carvao-muted sm:grid-cols-3">
        <div>
          <dt className="rotulo text-mineral">Período</dt>
          <dd className="mt-0.5">
            Chuva: {rotuloPeriodoMapa(per, dia30)}; temperatura: 30 dias até {dataBR(temp?.dia)}; base {periodoBase(base)}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Universo</dt>
          <dd className="mt-0.5">
            Chuva: média dos pontos de grade dentro do contorno de cada bacia do ONS, ponderada pela área. Temperatura: células mais populosas de cada UF, ponderadas pela
            população, somadas por subsistema
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Unidade</dt>
          <dd className="mt-0.5">mm de chuva acumulada; anomalia em % da média da base; °C e anomalia em °C</dd>
        </div>
      </dl>

      {destaques}

      <AguaMapaBacias
        titulo="Chuva estimada por bacia contra a média dos mesmos dias, em %"
        fonteGeometria={urlGeo}
        valores={valores}
        classificacao={classes}
        cores={CORES_ANOMALIA}
        unidade="% da média"
        casas={1}
        nomes={nomes}
        selecionado={bacia?.bacia ?? null}
        onSelecionar={selecionar}
        periodo={rotuloPeriodoMapa(per, dia30)}
        nota={`Anomalia = chuva do período ÷ média dos mesmos dias (ou do mesmo mês) em ${baseTxt} − 1. No período seco, médias pequenas geram percentuais grandes: confira os milímetros na tabela.`}
      />
      <TabelaInterativa
        titulo={`Tabela equivalente ao mapa: chuva por bacia, ${rotuloPeriodoMapa(per, dia30)}`}
        colunas={COLUNAS_CHUVA}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte={fonteChuva}
        versao={versaoChuva}
        nomeArquivo={`agua-chuva-bacias-${per}`}
        selecionado={bacia?.bacia ?? null}
        onSelecionar={selecionar}
        chaveUrl="chu"
        nota={`Percentil e cobertura só na janela de 30 dias. A correlação com a ENA é associação descritiva (${baseAssoc}), não causa.`}
      />

      {bacia && (
        <div className="space-y-3">
          <GraficoLinhas
            titulo={`${nomes[bacia.bacia]}: chuva em cada um dos últimos ${mesesHistorico} e a média do mesmo mês`}
            dados={historico}
            chaveX="m"
            formatoX="mes"
            series={[
              { id: "mm", rotulo: "Chuva estimada no mês", cor: "var(--serie-hidraulica)", espessura: 2.5 },
              { id: "media", rotulo: `Média do mês em ${periodoBase(base)}`, cor: "var(--serie-referencia)", tracejada: true },
            ]}
            banda={{ inferior: "p10", superior: "p90", rotulo: "10º a 90º percentil do mês" }}
            unidade="mm"
            casas={1}
            zeroNoEixo
          />
          {bacia.mensal.preliminar_desde && (
            <p className="text-sm text-carvao-muted">
              Desde {mesAno(bacia.mensal.preliminar_desde)} os meses têm dias do IMERG Late (preliminar, sem calibração por pluviômetros).
            </p>
          )}
        </div>
      )}

      <div data-nivel="analisar" className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Até quatro bacias na mesma escala</h3>
        <Comparador
          rotulo={`Bacias comparadas (até ${LIMITE_COMPARACAO})`}
          entidades={precipitacao.map((b) => ({ id: b.bacia, rotulo: nomes[b.bacia], sinonimos: [b.bacia] }))}
          selecionadas={escolhidas.map((b) => b.bacia)}
          onMudar={(ids) => definir({ cmp: ids })}
          dicaBusca="Grande, Paranaíba, São Francisco"
          vazio="Nenhuma bacia escolhida. Escolha até quatro para ver a chuva mensal e a média na mesma escala."
        >
          {() => null}
        </Comparador>
        {escolhidas.length > 0 && (
          <PequenosMultiplos
            titulo={`Chuva mensal estimada e média do mês, últimos ${mesesMultiplos}`}
            dados={multiplos}
            chaveX="m"
            formatoX="mes"
            unidade="mm"
            casas={1}
            zeroNoEixo
            colunas={escolhidas.length >= 4 ? 4 : escolhidas.length >= 3 ? 3 : 2}
            paineis={escolhidas.map((b, i) => ({
              id: b.bacia,
              titulo: nomes[b.bacia],
              series: [
                { id: b.bacia, rotulo: "Chuva no mês", cor: COR_COMPARACAO[i % COR_COMPARACAO.length], espessura: 2 },
                { id: `${b.bacia}·media`, rotulo: "Média do mês", cor: "var(--serie-referencia)", tracejada: true, espessura: 1 },
              ],
            }))}
          />
        )}
      </div>

      <div id="temperatura" className="scroll-mt-28 space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Temperatura {temp ? DO_REGIAO[temp.recorte] : ""}</h3>
        {temp && (
          <>
            <GraficoLinhas
              titulo={`Temperatura média diária ${DO_REGIAO[temp.recorte]} nos últimos ${plural(tDiaria.length, "dia", "dias")}, com a faixa do mesmo dia`}
              dados={tDiaria}
              chaveX="d"
              series={[
                { id: "t", rotulo: "Média do dia", cor: COR_REGIAO[temp.recorte], espessura: 2.5 },
                { id: "tmax", rotulo: "Máxima do dia", cor: "var(--serie-termica)", tracejada: true },
              ]}
              banda={{ inferior: "p10", superior: "p90", rotulo: `10º a 90º percentil da média do mesmo dia (${periodoBase(base)})` }}
              unidade="°C"
              casas={1}
            />
            <GraficoBarras
              titulo={`Anomalia da temperatura média mensal ${DO_REGIAO[temp.recorte]}, últimos ${plural(tMensal.length, "mês completo", "meses completos")}`}
              dados={tMensal.map((x) => ({ m: x.m, rotulo: mesAno(x.m), anomalia: x.anomalia }))}
              chaveCategoria="m"
              chaveRotulo="rotulo"
              series={[{ id: "anomalia", rotulo: `Diferença para a média do mês em ${periodoBase(base)}`, cor: "var(--serie-termica)" }]}
              unidade="°C"
              casas={2}
            />
          </>
        )}
        <TabelaInterativa
          titulo="Tabela equivalente: temperatura de 30 dias por recorte"
          colunas={COLUNAS_TEMPERATURA}
          linhas={linhasTemp}
          chaveLinha="id"
          colunaRotulo="rotulo"
          fonte={fonteTemperatura}
          versao={versaoTemperatura}
          nomeArquivo="agua-temperatura-30d"
          selecionado={rt}
          onSelecionar={(id) => id && definir({ rt: id as Regiao })}
        />
      </div>

      <div id="previsao" className="scroll-mt-28 space-y-4 border-t-2 border-dashed border-linha pt-5" data-natureza="PREVISTO">
        <h3 className="font-serif text-lg text-carvao">Previsão meteorológica: uma rodada de um modelo, não observação</h3>
        {previsao ? (
          <>
            <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-texto="previsao">
              {bacia ? respostaPrevisao(previsao, bacia.bacia) : ""}
            </p>
            <p className="text-xs text-carvao-muted">
              Rodada de {rotuloRodada(previsao.emitida_em)}, capturada em {carimbo(previsao.capturada_em)}
              {previsao.idade_horas !== null ? `, com ${num(previsao.idade_horas, 0)} horas no processamento` : ""}. {previsao.comparabilidade}
            </p>
            {bacia && (
              <GraficoBarras
                titulo={`Chuva prevista por dia na bacia do ${nomeProprio(bacia.bacia)} (dia UTC)`}
                dados={prev.map((p) => ({ d: p.d, rotulo: dataBR(p.d), mm: p.mm }))}
                chaveCategoria="d"
                chaveRotulo="rotulo"
                series={[{ id: "mm", rotulo: "Chuva prevista", cor: "var(--cor-previsto)" }]}
                unidade="mm"
                casas={1}
              />
            )}
            <GraficoLinhas
              titulo="Temperatura média prevista por dia (dia UTC), por recorte"
              dados={prev}
              chaveX="d"
              series={REGIOES.map((r) => ({ id: r, rotulo: NOME_REGIAO[r], sigla: CURTO_REGIAO[r], cor: COR_REGIAO[r], tracejada: true }))}
              unidade="°C"
              casas={1}
            />
            <TabelaInterativa
              titulo="Chuva prevista por bacia e a média IMERG dos mesmos dias"
              colunas={COLUNAS_PREVISAO_CHUVA}
              linhas={linhasPrevisaoChuva(previsao)}
              chaveLinha="id"
              colunaRotulo="rotulo"
              fonte={`${previsao.modelo} (previsão); NASA POWER IMERG (média)`}
              versao={previsao.emitida_em}
              nomeArquivo="agua-previsao-chuva"
              selecionado={bacia?.bacia ?? null}
              onSelecionar={selecionar}
            />
            <TabelaInterativa
              titulo="Temperatura média prevista nos 7 primeiros dias e a média MERRA-2 dos mesmos dias"
              colunas={COLUNAS_PREVISAO_TEMPERATURA}
              linhas={linhasPrevisaoTemperatura(previsao)}
              chaveLinha="id"
              colunaRotulo="rotulo"
              fonte={`${previsao.modelo} (previsão); NASA POWER MERRA-2 (média)`}
              versao={previsao.emitida_em}
              nomeArquivo="agua-previsao-temperatura"
            />
          </>
        ) : (
          <p role="status" className="border border-dashed border-linha bg-superficie px-5 py-4 text-sm text-carvao-muted">
            {motivoSemPrevisao}
          </p>
        )}
      </div>
    </div>
  );
}
