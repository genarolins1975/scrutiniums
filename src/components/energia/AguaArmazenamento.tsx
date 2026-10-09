"use client";

import { useMemo, type ReactNode } from "react";
import { AguaEscolha, AguaLista } from "@/components/energia/AguaControles";
import { AguaFaixaDaData } from "@/components/energia/AguaFaixaDaData";
import { AguaRestaurar } from "@/components/energia/AguaRestaurar";
import { AguaTabela } from "@/components/energia/AguaTabela";
import { Comparador } from "@/components/energia/Comparador";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { Numero } from "@/components/energia/Numero";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  COR_REGIAO,
  CURTO_REGIAO,
  NOME_REGIAO,
  OPCOES_UNIDADE_EAR,
  ROTULO_TIPO_RECORTE,
  SUBSISTEMAS,
  TEXTO_EAR_DERIVADA,
  TEXTO_UNIDADE_MWMES,
  TIPOS_RECORTE,
  amplitudeCapacidade,
  anoInicial,
  capacidadeMuitoAlterada,
  casasMwmes,
  colunasArmazenamento,
  corDoRecorte,
  doRecorte,
  itensPontosArmazenamento,
  linhasArmazenamento,
  linhasMultiplos,
  mwmes,
  periodoBase,
  recorteEscolhido,
  recortePadrao,
  respostaArmazenamento,
  rotuloBandaDaFaixa,
  serieSemanal,
  textoAmplitude,
  textoBaseDaFaixa,
  textoEarProvisoria,
  textoForaDosPontos,
  textoOutraJanelaNaArmazenamento,
  textoPasso,
  textoPesoSubsistemas,
  textoPeriodoDoRecorte,
  vereditoArmazenamento,
  type EntidadeEar,
  type PontoMensalEar,
  type PontoRegioes,
  type TipoRecorte,
  type UnidadeEar,
} from "@/lib/energia/agua";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, plural, sinal } from "@/lib/energia/formato";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { AguaDecomposicaoEar, AguaRevisaoCaptura } from "@/lib/energia/tipos-agua";

/**
 * P017, armazenamento: tipo de recorte (?rec=), recorte escolhido (?ent=), unidade da figura (?uni=), recortes
 * comparados nos pequenos múltiplos (?cmp=, até quatro), o intervalo do histórico
 * mensal (?de=, ?ate=) e o da série diária em MWmês (?dde=, ?date=) ficam na URL;
 * voltar e avançar refazem o recorte e o zoom. A resposta, os
 * pontos pareados, a faixa da data, os números do recorte, a tabela equivalente e a exportação usam as mesmas linhas
 * (linhasArmazenamento e itensPontosArmazenamento sobre a mesma lista), e a resposta é
 * refeita pela mesma regra quando o recorte muda. O padrão (subsistemas, SIN, % da EAR máxima, os quatro
 * subsistemas na comparação) não é gravado na URL. A ordem dos pontos fica na URL (pts.ord e pts.dir), e o botão "Restaurar padrão"
 * (AguaRestaurar) tira da URL todas as escolhas de uma vez: recorte, unidade, ordem, comparação, intervalos e tabela.
 *
 * A tabela equivalente (AguaTabela) nunca abre sozinha: escolher um recorte no gráfico não muda a altura da página.
 */
const ESQUEMA = {
  rec: campo(tiposUrl.opcao(TIPOS_RECORTE), "subsistema"),
  ent: campo(tiposUrl.texto({ max: 60 }), ""),
  uni: campo(tiposUrl.opcao(["pct", "mwmes"] as const), "pct"),
  cmp: campo(tiposUrl.lista(tiposUrl.texto({ max: 60 }), { max: LIMITE_COMPARACAO }), [...SUBSISTEMAS] as string[]),
  de: campo(tiposUrl.mes(), ""),
  ate: campo(tiposUrl.mes(), ""),
  dde: campo(tiposUrl.data(), ""),
  date: campo(tiposUrl.data(), ""),
};

const OPCOES_TIPO = TIPOS_RECORTE.map((t) => ({ id: t, rotulo: ROTULO_TIPO_RECORTE[t] }));

const UNIVERSO: Record<TipoRecorte, string> = {
  subsistema: "Subsistemas do SIN publicados pelo ONS; o SIN é a soma das EAR dos quatro sobre a soma das EAR máximas, no mesmo dia",
  ree: "Reservatórios equivalentes de energia (REE) do ONS, cada um com o próprio perímetro e a própria EAR máxima",
  bacia: "Bacias hidroenergéticas do ONS; bacias só com usinas a fio d'água não têm armazenamento (não se aplica)",
};

/**
 * Números do recorte escolhido: a EAR do dia em % da EAR máxima, a mediana da mesma data, a energia armazenada em MWmês e a variação de
 * 30 dias. Os valores são os campos da própria entidade (os mesmos do gráfico, da faixa da data, da tabela e da resposta): a faixa nunca
 * calcula. O SIN é o recorte dos quatro números do alto da página (com as fichas "Comprove este número", as únicas que a gold publica): quando
 * ele é o escolhido, os mesmos cartões não se repetem aqui, e a seção diz de onde vêm os números e guarda a nota de provisório. Outro recorte
 * traz os quatro números dele, sem ficha. Os últimos dias são ditos provisórios, e as duas janelas de 30 dias do mesmo subsistema (esta
 * página e a de reservatórios) são ditas junto dos números.
 */
export function MedidasArmazenamento({ e, revisoes, decomposicoes }: { e: EntidadeEar; revisoes: AguaRevisaoCaptura[]; decomposicoes: AguaDecomposicaoEar[] }) {
  const ehSin = e.tipo === "subsistema" && e.id === "SIN";
  const amp = capacidadeMuitoAlterada(e) ? amplitudeCapacidade(e) : null;
  const outraJanela = textoOutraJanelaNaArmazenamento(e, decomposicoes);
  const semFaixa = e.sem_armazenamento
    ? "Sem armazenamento (EAR máxima zero): faixa e percentual não se aplicam."
    : `Sem faixa do mesmo dia: ${plural(e.anos_na_base, "ano", "anos")} na base, menos que os 5 exigidos.`;
  // o SIN é o recorte do alto da página: repetir os mesmos quatro números logo abaixo da figura só somaria 270 px de cartões iguais
  if (ehSin) {
    return (
      <div data-medidas-recorte="" data-igual-ao-alto="" className="border-t border-linha pt-3">
        <div className="max-w-prose2 space-y-1.5 text-sm leading-relaxed text-carvao-muted">
          <p className="rotulo text-mineral">Números do recorte escolhido: {e.rotulo}</p>
          <p>São os quatro números do alto da página, que ficam sempre no SIN. Escolha outro recorte para ver os dele aqui.</p>
          <p>{textoEarProvisoria(revisoes)}</p>
        </div>
      </div>
    );
  }
  return (
    <div data-medidas-recorte="" className="space-y-2">
      <p className="rotulo text-mineral">Números do recorte escolhido: {e.rotulo}</p>
      <p className="text-sm text-carvao-muted">Os quatro números do alto da página continuam sendo os do SIN.</p>
      <FaixaMetricas
        colunas={4}
        rotulo={`Indicadores do armazenamento: ${e.rotulo}`}
        nota={
          <div className="space-y-1.5 text-sm">
            <p>{textoEarProvisoria(revisoes)}</p>
            {amp && (
              <p data-texto="capacidade-alterada">
                A EAR máxima variou {textoAmplitude(amp.razao)} na base (de {mwmes(amp.min)} a {mwmes(amp.max)} MWmês). Em %, a faixa compara capacidades de tamanhos diferentes; em MWmês, compara a energia
                de anos com capacidades diferentes. Nas duas unidades, a posição frente à faixa não é dita.
              </p>
            )}
            {outraJanela && <p data-texto="outra-janela">{outraJanela}</p>}
          </div>
        }
      >
        <Numero
          variante="faixa"
          rotulo="EAR do dia"
          natureza="CALCULADO"
          valor={e.ear_pct}
          formato="pct"
          casas={1}
          unidade="da EAR máxima"
          periodo={e.dia ? dataBR(e.dia) : undefined}
          cor={corDoRecorte(e)}
          motivoAusencia={e.sem_armazenamento ? "Sem armazenamento (EAR máxima zero): o percentual não se aplica." : "Sem EAR publicada no dia de referência."}
        />
        <Numero
          variante="faixa"
          rotulo="Mediana da mesma data"
          natureza="CALCULADO"
          valor={e.p50}
          formato="pct"
          casas={1}
          unidade="da EAR máxima"
          periodo={e.periodo_base ? `mesmo dia do ano em ${periodoBase(e.periodo_base)}` : undefined}
          cor="var(--serie-referencia)"
          motivoAusencia={semFaixa}
        />
        <Numero
          variante="faixa"
          rotulo="Energia armazenada"
          natureza="CALCULADO"
          valor={e.ear_mwmes}
          formato="num"
          casas={casasMwmes(e.ear_mwmes)}
          unidade="MWmês"
          periodo={e.dia ? dataBR(e.dia) : undefined}
          cor={corDoRecorte(e)}
          nota={e.ear_max_mwmes !== null && !e.sem_armazenamento ? `EAR máxima de ${mwmes(e.ear_max_mwmes)} MWmês` : undefined}
          motivoAusencia="Sem EAR publicada no dia de referência."
        />
        <Numero
          variante="faixa"
          rotulo="Variação em 30 dias"
          natureza="CALCULADO"
          valor={e.variacao_30d_pp}
          formato="num"
          casas={1}
          unidade="p.p. da EAR máxima"
          periodo={e.dia ? `30 dias até ${dataBR(e.dia)}` : undefined}
          nota={e.variacao_30d_mwmes !== null ? `${sinal(e.variacao_30d_mwmes, casasMwmes(e.variacao_30d_mwmes))} MWmês` : undefined}
          motivoAusencia={e.sem_armazenamento ? "Sem armazenamento: a variação em p.p. não se aplica." : "Sem variação de 30 dias nesta publicação."}
        />
      </FaixaMetricas>
    </div>
  );
}

export function AguaArmazenamento({
  entidades,
  diaria,
  mensal,
  textoMensal,
  fonte,
  versao,
  notas,
  destaquesHistoria,
  decomposicoes,
  revisoes,
}: {
  entidades: EntidadeEar[];
  /** EAR diária por subsistema e SIN nos últimos dias publicados na gold (MWmês). */
  diaria: PontoRegioes[];
  /** EAR no último dia de cada mês desde o início da série (MWmês), com a EAR máxima do SIN. */
  mensal: PontoMensalEar[];
  textoMensal: string;
  fonte: string;
  versao: string;
  /** Notas do painel (NotasDoPainel: o que mudou e a ressalva essencial), logo depois da figura principal e da tabela. */
  notas?: ReactNode;
  /** Medida que acompanha a história mensal (mudanças da EAR máxima), com a ficha de prova. */
  destaquesHistoria?: ReactNode;
  /** Variação da EAR por reservatório (página de reservatórios): a outra janela de 30 dias do mesmo subsistema. */
  decomposicoes: AguaDecomposicaoEar[];
  /** Revisões do ONS entre as duas capturas mais recentes (a mesma lista da tabela de revisões, em Auditar). */
  revisoes: AguaRevisaoCaptura[];
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const tipo = v.rec as TipoRecorte;
  const unidade = v.uni as UnidadeEar;
  const emMw = unidade === "mwmes";
  const padrao = useMemo(() => recortePadrao(entidades, tipo), [entidades, tipo]);
  const e = recorteEscolhido(entidades, tipo, v.ent || padrao, padrao);
  const doTipo = useMemo(() => entidades.filter((x) => x.tipo === tipo), [entidades, tipo]);
  const linhas = useMemo(() => linhasArmazenamento(doTipo), [doTipo]);
  const colunas = useMemo(() => colunasArmazenamento(unidade), [unidade]);
  const itens = useMemo(() => itensPontosArmazenamento(doTipo, unidade), [doTipo, unidade]);
  const semanal = useMemo(() => serieSemanal(e?.semanal ?? null), [e]);
  const comArmazenamento = useMemo(() => entidades.filter((x) => !x.sem_armazenamento && x.semanal), [entidades]);
  const escolhidas = useMemo(
    () => (v.cmp as string[]).map((id) => comArmazenamento.find((x) => x.id === id)).filter((x): x is EntidadeEar => !!x),
    [v.cmp, comArmazenamento],
  );
  const multiplos = useMemo(() => linhasMultiplos(escolhidas), [escolhidas]);
  const intervalo = v.de && v.ate ? { inicio: v.de, fim: v.ate } : null;
  const intervaloDiario = v.dde && v.date ? { inicio: v.dde, fim: v.date } : null;
  // a cor de um recorte é a mesma em todos os gráficos da página: a do subsistema, ou a da energia
  const cor = e ? corDoRecorte(e) : "var(--cor-energia)";
  // períodos e passos dos títulos saem das séries publicadas, nunca de número escrito aqui
  const passoMultiplos = escolhidas.find((x) => x.semanal)?.semanal?.passo_dias ?? null;
  const diasDiaria = plural(diaria.length, "dia", "dias");
  const anoMensal = anoInicial(mensal[0]?.m);
  const fora = textoForaDosPontos(doTipo);
  const peso = textoPesoSubsistemas(entidades);
  const baseDaFaixa = e ? textoBaseDaFaixa(e) : "";
  const selecionar = (id: string | null) => id && definir({ ent: id === padrao ? "" : id });

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <RespostaCurta id="p017" vivo veredito={e ? vereditoArmazenamento(e) : "Recorte sem dado nesta publicação."}>
          {e ? respostaArmazenamento(e) : "Recorte sem dado nesta publicação."}
        </RespostaCurta>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <AguaEscolha legenda="Recorte" opcoes={OPCOES_TIPO} valor={tipo} onEscolher={(x) => definir({ rec: x, ent: "" })} />
          <AguaLista
            rotulo={tipo === "subsistema" ? "Subsistema" : tipo === "ree" ? "REE" : "Bacia"}
            opcoes={doTipo.map((x) => ({ id: x.id, rotulo: x.sem_armazenamento ? `${x.rotulo} (sem armazenamento)` : x.rotulo }))}
            valor={e?.id ?? padrao}
            onEscolher={(x) => selecionar(x)}
          />
          <AguaRestaurar />
        </div>
      </div>

      {/* a tabela equivalente da página é a única porta para estes dados: a do próprio gráfico repetiria as mesmas linhas */}
      <div data-grafico-pontos="armazenamento" className="relative [&_details]:hidden">
        {/* a unidade da figura: no cabeçalho dela, à direita do título em tela larga (onde há espaço), e acima dela nas demais */}
        <div className="mb-3 xl:absolute xl:right-0 xl:top-0 xl:z-[1] xl:mb-0">
          <AguaEscolha legenda="Unidade da figura" opcoes={OPCOES_UNIDADE_EAR} valor={unidade} onEscolher={(x) => definir({ uni: x })} emLinha />
        </div>
        <GraficoPontos
          titulo={`EAR de cada recorte (${ROTULO_TIPO_RECORTE[tipo]}) no dia e a mediana da mesma data`}
          itens={itens}
          unidade={emMw ? "MWmês" : "%"}
          casas={emMw && tipo === "subsistema" ? 0 : 1}
          zeroNoEixo={emMw}
          rotuloValor="EAR do dia"
          rotuloReferencia="Mediana da data nos anos da base"
          corValor="var(--cor-energia)"
          corReferencia="var(--serie-referencia)"
          selecionado={e?.id ?? null}
          onSelecionar={selecionar}
          ordemInicial={{ por: "valor", direcao: "desc" }}
          chaveUrl="pts"
        />
      </div>
      {fora && (
        <p className="text-sm text-carvao-muted" data-texto="fora-dos-pontos">
          {fora}
        </p>
      )}

      {e && <AguaFaixaDaData e={e} unidade={unidade} />}

      {e && !e.sem_armazenamento && semanal.length > 0 ? (
        <GraficoLinhas
          titulo={`EAR ${doRecorte(e.tipo, e.nome)} no último ano, ${e.semanal ? textoPasso(e.semanal.passo_dias) : ""}, com a faixa do 10º ao 90º percentil da mesma data`}
          dados={semanal}
          chaveX="d"
          series={[{ id: "v", rotulo: e.rotulo, cor, espessura: 2.5 }]}
          banda={{ inferior: "p10", superior: "p90", rotulo: rotuloBandaDaFaixa(e) }}
          unidade="%"
          casas={1}
        />
      ) : (
        <p role="status" className="border border-dashed border-linha bg-superficie px-5 py-4 text-sm text-carvao-muted">
          {e?.sem_armazenamento
            ? "Este recorte não tem armazenamento (EAR máxima zero): não há série em % nem faixa sazonal; a EAR em MWmês, zero, está na tabela."
            : "Sem série do último ano para este recorte nesta publicação."}
        </p>
      )}
      {e && !e.sem_armazenamento && semanal.length > 0 && (
        <p className="text-sm text-carvao-muted" data-texto="base-da-faixa">
          {baseDaFaixa}
          {emMw ? " A série do último ano e a faixa de cada data só existem em % da EAR máxima, a única unidade em que são publicadas; em MWmês, a faixa da data de referência está na figura acima." : ""}
        </p>
      )}

      <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-sm text-carvao-muted sm:grid-cols-3">
        <div>
          <dt className="rotulo text-mineral">Período</dt>
          <dd className="mt-0.5">{e ? textoPeriodoDoRecorte(e) : "sem dia de referência"}</dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Universo</dt>
          <dd className="mt-0.5">
            {UNIVERSO[tipo]}. {TEXTO_EAR_DERIVADA}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Unidade</dt>
          <dd className="mt-0.5">
            {TEXTO_UNIDADE_MWMES}, e % da EAR máxima do próprio recorte; p.p., pontos percentuais: de 60% para 62% são 2 p.p.
          </dd>
        </div>
      </dl>

      {e && <MedidasArmazenamento e={e} revisoes={revisoes} decomposicoes={decomposicoes} />}

      <AguaTabela
        titulo={`Tabela equivalente: ${ROTULO_TIPO_RECORTE[tipo]}, EAR do dia, faixa da data e variação`}
        colunas={colunas}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`agua-armazenamento-${tipo}`}
        selecionado={e?.id ?? null}
        onSelecionar={selecionar}
        chaveUrl="arm"
        nota="Recortes sem armazenamento aparecem com percentual vazio e posição “não se aplica”; com menos de 5 anos na base, não há faixa. Em Analisar, a tabela traz a faixa da data em % e em MWmês, a variação de 30 dias e a EAR máxima da base."
      />

      {notas}

      <div id="historia" className="scroll-mt-28 space-y-4 border-t border-linha pt-6">
        <h3 className="ed-h3 font-serif text-carvao">{anoMensal ? `Desde ${anoMensal}: e` : "E"}nergia armazenada e capacidade no fim de cada mês</h3>
        {destaquesHistoria}
        <GraficoLinhas
          titulo={`EAR do SIN e EAR máxima do SIN no último dia de cada mês${anoMensal ? `, desde ${anoMensal}` : ""}`}
          dados={mensal}
          chaveX="m"
          formatoX="mes"
          series={[
            { id: "SIN", rotulo: "EAR do SIN", cor: "var(--cor-energia)", espessura: 2.5 },
            { id: "SIN_max", rotulo: "EAR máxima do SIN (capacidade)", cor: "var(--serie-referencia)", tracejada: true },
            ...SUBSISTEMAS.map((sm) => ({ id: sm, rotulo: NOME_REGIAO[sm], sigla: CURTO_REGIAO[sm], cor: COR_REGIAO[sm] })),
          ]}
          ocultasIniciais={[...SUBSISTEMAS]}
          legendaInterativa
          unidade="MWmês"
          casas={0}
          zoom
          intervalo={intervalo}
          onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
          zeroNoEixo
        />
        <p className="text-sm text-carvao-muted">{textoMensal} A EAR máxima cresceu com a entrada de usinas: o mesmo percentual em anos diferentes não mede a mesma energia.</p>
      </div>

      <div id="comparar" className="scroll-mt-28 space-y-4 border-t border-linha pt-6">
        <h3 className="ed-h3 font-serif text-carvao">Até quatro recortes na mesma escala</h3>
        <Comparador
          rotulo={`Recortes comparados (até ${LIMITE_COMPARACAO})`}
          entidades={comArmazenamento.map((x) => ({ id: x.id, rotulo: x.rotulo, detalhe: ROTULO_TIPO_RECORTE[x.tipo], sinonimos: [x.nome] }))}
          selecionadas={escolhidas.map((x) => x.id)}
          onMudar={(ids) => definir({ cmp: ids })}
          dicaBusca="Buscar, por exemplo SIN, Sul, REE Paraná, Bacia do Grande"
          vazio="Nenhum recorte escolhido. Escolha até quatro para ver a EAR do último ano com a faixa da data, na mesma escala."
        >
          {() => null}
        </Comparador>
        {escolhidas.length > 0 && (
          <PequenosMultiplos
            titulo={`EAR no último ano (% da EAR máxima)${passoMultiplos ? `, ${textoPasso(passoMultiplos)}` : ""}, com o 10º e o 90º percentil da data`}
            dados={multiplos}
            chaveX="d"
            unidade="%"
            casas={1}
            colunas={escolhidas.length >= 4 ? 4 : escolhidas.length >= 3 ? 3 : 2}
            nivelTitulo={4}
            paineis={escolhidas.map((x) => ({
              id: x.id,
              titulo: x.rotulo,
              nota: x.capacidade_mudou_na_base ? "EAR máxima mudou mais de 5% na base" : undefined,
              // a cor é a do recorte, a mesma dos outros gráficos da página; os rótulos são iguais nos painéis, e a legenda os junta
              series: [
                { id: x.id, rotulo: "EAR", cor: corDoRecorte(x), espessura: 2 },
                { id: `${x.id}·p10`, rotulo: "10º percentil da data", cor: "var(--serie-referencia)", tracejada: true, espessura: 1 },
                { id: `${x.id}·p90`, rotulo: "90º percentil da data", cor: "var(--serie-referencia)", tracejada: true, espessura: 1 },
              ],
            }))}
          />
        )}
        <p className="text-sm text-carvao-muted">
          Esta escolha é independente do recorte da figura principal: trocar um não troca o outro. O percentual de cada painel é da EAR máxima do próprio recorte: a mesma altura em
          dois painéis é o mesmo grau de enchimento, não a mesma energia. A energia de cada recorte em MWmês está na tabela.
        </p>
      </div>

      <div data-nivel="analisar" className="space-y-4 border-t border-linha pt-6">
        <h3 className="ed-h3 font-serif text-carvao">Energia armazenada nos últimos {diasDiaria}, em MWmês</h3>
        <GraficoLinhas
          titulo={`EAR diária por subsistema nos últimos ${diasDiaria}`}
          dados={diaria}
          chaveX="d"
          series={SUBSISTEMAS.map((sm) => ({ id: sm, rotulo: NOME_REGIAO[sm], sigla: CURTO_REGIAO[sm], cor: COR_REGIAO[sm] }))}
          unidade="MWmês"
          casas={0}
          zoom
          intervalo={intervaloDiario}
          onIntervalo={(i) => definir({ dde: i?.inicio ?? "", date: i?.fim ?? "" })}
          legendaInterativa
        />
        {peso && <p className="text-sm text-carvao-muted">{peso}</p>}
      </div>
    </div>
  );
}
