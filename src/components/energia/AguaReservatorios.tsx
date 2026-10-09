"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AguaEscolha, AguaLista } from "@/components/energia/AguaControles";
import { AguaLegenda } from "@/components/energia/AguaLegenda";
import { Comparador } from "@/components/energia/Comparador";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  COLUNAS_DECOMPOSICAO,
  COLUNAS_RESERVATORIOS,
  COR_REGIAO,
  DO_REGIAO,
  NOME_REGIAO,
  REVISOES_CAPTURA_UNICA,
  ROTULO_CONVENCAO,
  SUBSISTEMAS,
  barrasBalancoDefluencia,
  barrasBalancoResiduo,
  barrasBalancoTotais,
  barrasDecomposicaoComRestante,
  linhasDecomposicao,
  linhasMultiplosVolume,
  linhasReservatorios,
  motivoSemBalanco,
  nomeProprio,
  notaOutraJanelaCurta,
  notaVazoesCoincidem,
  reservatorioDaParcela,
  reservatorioPadrao,
  respostaBalanco,
  respostaDecomposicao,
  restanteDecomposicao,
  serieReservatorio,
  textoOutraJanelaDaEar,
  textoParcelasFaltantes,
  textoVolumeForaDaFaixa,
  vereditoBalancoReservatorio,
  vereditoDecomposicao,
  volumeForaDaFaixa,
} from "@/lib/energia/agua";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { dataBR, pct, plural } from "@/lib/energia/formato";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { Submercado } from "@/lib/energia/tipos";
import type { EntidadeEar } from "@/lib/energia/agua";
import type { AguaDecomposicaoEar, AguaReservatorio, AguaReservatorios45d } from "@/lib/energia/tipos-agua";

/**
 * P020, reservatórios e balanço: subsistema da decomposição (?sm=), reservatório
 * escolhido (?res=) e reservatórios comparados (?cmp=, até quatro) ficam na URL. A
 * barra de uma parcela da decomposição, a linha da tabela e a lista escolhem o mesmo
 * reservatório, ligado pelo código da usina (nunca pelo nome). A resposta, as barras
 * e as tabelas usam as mesmas linhas da gold. As séries diárias (45 dias na publicação
 * atual; o número exibido vem da gold) vêm de agua_reservatorios_45d.json, buscado só
 * quando a seção chega perto da tela.
 *
 * Composição (redesenho): a figura principal (variação da EAR do subsistema por reservatório,
 * com uma barra para a soma dos demais) vem logo depois da resposta e do controle de
 * subsistema, com o recorte como legenda; abaixo dela, a soma das parcelas do gráfico e a dos
 * demais ao lado da variação do subsistema; as notas do painel vêm junto da figura. A conta da
 * água do reservatório escolhido (com a lista de reservatórios ao lado do que ela controla), a
 * qualidade do balanço e a série diária são seções visíveis com pergunta própria; a comparação
 * de até quatro reservatórios fica em Analisar. Os números de cada faixa acompanham a escolha.
 */
const ESQUEMA = {
  sm: campo(tiposUrl.opcao(SUBSISTEMAS), "SE"),
  res: campo(tiposUrl.texto({ max: 20 }), ""),
  cmp: campo(tiposUrl.lista(tiposUrl.texto({ max: 20 }), { max: LIMITE_COMPARACAO }), [] as string[]),
};

type Series = { estado: "espera" | "carregando" | "pronto" | "erro"; dados: AguaReservatorios45d | null; erro: string };

/**
 * A variação da EAR do subsistema escolhido, parcela por parcela: a variação, a soma das parcelas do gráfico e a soma dos demais reservatórios
 * (por diferença, porque a gold não publica a variação de cada um dos demais), com a outra janela de 30 dias ao lado da variação quando a
 * página de armazenamento termina em outro dia. Com todas as parcelas no gráfico, uma frase diz isso.
 */
export function MedidasDecomposicao({ dec, armazenamento }: { dec: AguaDecomposicaoEar; armazenamento: Pick<EntidadeEar, "id" | "tipo" | "dia" | "variacao_30d_mwmes">[] }) {
  const restante = restanteDecomposicao(dec);
  const notaJanela = notaOutraJanelaCurta(dec, armazenamento);
  const periodo = `${dataBR(dec.inicio)} a ${dataBR(dec.fim)}`;
  if (!restante) {
    return (
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-texto="parcelas-completas">
        Todas as {dec.n_reservatorios} parcelas estão no gráfico e somam a variação da EAR do subsistema{notaJanela ? `. ${notaJanela}` : "."}
      </p>
    );
  }
  return (
    <div data-medidas-recorte="" className="space-y-2">
      <p className="rotulo text-mineral">Variação da EAR {DO_REGIAO[dec.sm]}, parcela por parcela</p>
      <FaixaMetricas colunas={3} rotulo={`Variação da EAR ${DO_REGIAO[dec.sm]} e a soma das parcelas`} nota={textoParcelasFaltantes(dec)}>
        <Numero
          variante="faixa"
          rotulo="Variação da EAR do subsistema"
          natureza="CALCULADO"
          valor={dec.delta_ear_mwmes}
          formato="num"
          casas={1}
          unidade="MWmês"
          periodo={periodo}
          cor={COR_REGIAO[dec.sm]}
          nota={notaJanela || undefined}
          motivoAusencia="Sem variação da EAR nesta publicação."
        />
        <Numero
          variante="faixa"
          rotulo={`Soma das ${restante.nListadas} parcelas do gráfico`}
          natureza="CALCULADO"
          valor={restante.somaListadas}
          formato="num"
          casas={1}
          unidade="MWmês"
          periodo={periodo}
          nota="As maiores quedas e altas publicadas."
        />
        <Numero
          variante="faixa"
          rotulo={`Soma dos demais ${plural(restante.nRestantes, "reservatório", "reservatórios")}`}
          natureza="CALCULADO"
          valor={restante.somaRestantes}
          formato="num"
          casas={1}
          unidade="MWmês"
          periodo={periodo}
          nota="Por diferença; as variações de cada um não estão publicadas."
        />
      </FaixaMetricas>
    </div>
  );
}

/**
 * A conta da água do reservatório escolhido em quatro números (variação do volume, afluência, defluência e resíduo), todos campos do próprio
 * reservatório. Sem balanço, os números ausentes dizem o motivo exato. A ficha de prova do resíduo é a do reservatório de maior volume útil,
 * a única que a gold publica, e diz que ainda não é possível detectar revisões, porque há uma única captura.
 */
export function MedidasBalanco({
  res,
  periodo,
  semCadastro,
  ehPadrao,
  evidenciaResiduo,
  endereco,
}: {
  res: AguaReservatorio;
  periodo: string;
  semCadastro?: readonly string[];
  ehPadrao: boolean;
  evidenciaResiduo?: Evidencia | null;
  endereco?: string;
}) {
  const nomeRes = nomeProprio(res.nome);
  const motivo = !res.balanco_calculado ? motivoSemBalanco(res, semCadastro) : "";
  const textoMotivo = motivo ? `${motivo.charAt(0).toUpperCase()}${motivo.slice(1)}.` : undefined;
  return (
    <FaixaMetricas colunas={4} rotulo={`Conta da água de ${nomeRes}`}>
      <Numero variante="faixa" rotulo="Variação observada do volume" natureza="CALCULADO" valor={res.dv_obs_hm3} formato="num" casas={2} unidade="hm³" periodo={periodo} motivoAusencia={textoMotivo} />
      <Numero
        variante="faixa"
        rotulo="Afluência"
        natureza="OBSERVADO"
        valor={res.afluencia_hm3}
        formato="num"
        casas={2}
        unidade="hm³"
        periodo={periodo}
        cor="var(--serie-hidraulica)"
        nota="Derivada pelo ONS, na maioria dos reservatórios a partir do próprio balanço: não é medição direta."
        motivoAusencia="Sem afluência na janela nesta publicação."
      />
      <Numero
        variante="faixa"
        rotulo="Defluência"
        natureza="OBSERVADO"
        valor={res.defluencia_hm3}
        formato="num"
        casas={2}
        unidade="hm³"
        periodo={periodo}
        cor="var(--cor-carvao)"
        motivoAusencia="Sem defluência na janela nesta publicação."
      />
      <Numero
        variante="faixa"
        rotulo="Resíduo do balanço"
        natureza="CALCULADO"
        evidencia={ehPadrao ? evidenciaResiduo : undefined}
        revisoes={ehPadrao ? REVISOES_CAPTURA_UNICA : undefined}
        valor={res.residuo_hm3}
        formato="num"
        casas={2}
        unidade="hm³"
        periodo={periodo}
        nota={`reservatório ${nomeRes}: variação observada menos afluência mais defluência.`}
        motivoAusencia={textoMotivo}
        endereco={endereco}
      />
    </FaixaMetricas>
  );
}

export function AguaReservatorios({
  lista,
  decomposicao,
  janela,
  armazenamento,
  urlSeries,
  diasSeries,
  fonte,
  versao,
  notas,
  qualidade,
  semCadastro,
  evidenciaResiduo,
  enderecoBalanco,
}: {
  lista: AguaReservatorio[];
  decomposicao: AguaDecomposicaoEar[];
  janela: { inicio: string; fim: string; periodo_fecham_por_construcao: { inicio: string; fim: string } | null };
  /** Variação de 30 dias de cada subsistema na página de armazenamento (para dizer por que o número difere da decomposição). */
  armazenamento: Pick<EntidadeEar, "id" | "tipo" | "dia" | "variacao_30d_mwmes">[];
  urlSeries: string;
  /** Dias de cada série diária do arquivo sob demanda (gold: reservatorios.series_45d.dias). */
  diasSeries: number;
  fonte: string;
  versao: string;
  /** Notas do painel (NotasDoPainel: o que mudou, como interpretar e o que não é possível concluir), logo depois da figura principal e da tabela. */
  notas?: ReactNode;
  /** Seção da qualidade do balanço (fechamento por construção), que vem logo depois da conta da água. */
  qualidade?: ReactNode;
  /** Identificadores dos reservatórios sem correspondência no cadastro do ONS (gold: sem_cadastro): o motivo exato de não terem balanço. */
  semCadastro?: string[];
  /** Ficha de prova do resíduo do reservatório de maior volume útil: aparece só quando é ele o reservatório escolhido. */
  evidenciaResiduo?: Evidencia | null;
  /** Página e âncora dos números da conta da água, repassadas à citação da ficha. */
  enderecoBalanco?: string;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const sm = v.sm as Submercado;
  const dec = decomposicao.find((d) => d.sm === sm) ?? decomposicao[0] ?? null;
  const padrao = useMemo(() => reservatorioPadrao(lista), [lista]);
  const res = lista.find((r) => r.id === v.res) ?? lista.find((r) => r.id === padrao) ?? null;
  const barrasDec = useMemo(() => (dec ? barrasDecomposicaoComRestante(dec) : []), [dec]);
  const barraSel = res ? (barrasDec.find((b) => b.cod === res.cod)?.id ?? null) : null;
  const linhasDec = useMemo(() => (dec ? linhasDecomposicao(dec) : []), [dec]);
  const linhasRes = useMemo(() => linhasReservatorios(lista, semCadastro), [lista, semCadastro]);
  const selecionar = (id: string | null) => id && definir({ res: id === padrao ? "" : id });
  const selecionarParcela = (id: string | null) => {
    const b = barrasDec.find((x) => x.id === id);
    const r = b && b.cod ? reservatorioDaParcela(lista, b.cod) : null;
    if (r) selecionar(r.id);
  };
  const escolhidos = (v.cmp as string[]).filter((id) => lista.some((r) => r.id === id));
  const outraJanela = textoOutraJanelaDaEar(dec, armazenamento);
  const foraDaFaixa = res ? volumeForaDaFaixa(res.vol_util_pct_fim) : null;
  const opcoesRes = useMemo(
    () =>
      [...lista]
        .sort((a, b) => {
          const ia = SUBSISTEMAS.indexOf((a.subsistema ?? "") as Submercado);
          const ib = SUBSISTEMAS.indexOf((b.subsistema ?? "") as Submercado);
          return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || nomeProprio(a.nome).localeCompare(nomeProprio(b.nome), "pt-BR");
        })
        .map((r) => ({
          id: r.id,
          rotulo: `${nomeProprio(r.nome)}${r.balanco_calculado ? "" : " (sem balanço)"}`,
          grupo: r.subsistema && (SUBSISTEMAS as readonly string[]).includes(r.subsistema) ? NOME_REGIAO[r.subsistema as Submercado] : undefined,
        })),
    [lista],
  );

  // séries de 45 dias: buscadas quando a seção chega perto da tela (carregamento progressivo)
  const alvo = useRef<HTMLDivElement>(null);
  const [series, setSeries] = useState<Series>({ estado: "espera", dados: null, erro: "" });
  const [pedir, setPedir] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (pedir) return;
    const el = alvo.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setPedir(true);
      return;
    }
    const obs = new IntersectionObserver((ents) => ents.some((e) => e.isIntersecting) && setPedir(true), { rootMargin: "600px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [pedir]);
  useEffect(() => {
    if (!pedir) return;
    let vivo = true;
    setSeries((s) => ({ ...s, estado: "carregando" }));
    fetch(urlSeries)
      .then(async (r) => {
        if (!r.ok) throw new Error(`resposta ${r.status}`);
        const j = (await r.json()) as AguaReservatorios45d;
        if (!Array.isArray(j.reservatorios)) throw new Error("arquivo sem a lista de reservatórios");
        if (vivo) setSeries({ estado: "pronto", dados: j, erro: "" });
      })
      .catch((e: unknown) => vivo && setSeries({ estado: "erro", dados: null, erro: e instanceof Error ? e.message : String(e) }));
    return () => {
      vivo = false;
    };
  }, [pedir, urlSeries, tentativa]);

  const serieSel = useMemo(() => serieReservatorio(series.dados?.reservatorios.find((s) => s.id === res?.id)), [series.dados, res]);
  const seriesComp = useMemo(
    () => escolhidos.map((id) => series.dados?.reservatorios.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s),
    [escolhidos, series.dados],
  );
  const multiplos = useMemo(() => linhasMultiplosVolume(seriesComp), [seriesComp]);
  const nomeRes = res ? nomeProprio(res.nome) : "";
  const dias = plural(diasSeries, "dia", "dias");
  const periodoJanela = `${dataBR(janela.inicio)} a ${dataBR(janela.fim)}`;
  const ehPadrao = !!res && res.id === padrao;
  const coincidem = serieSel.length ? notaVazoesCoincidem(serieSel) : "";

  const estadoSeries =
    series.estado === "erro" ? (
      <div role="alert" className="space-y-2 border border-dashed border-linha bg-superficie px-5 py-4 text-sm text-carvao">
        <p>Não foi possível carregar as séries diárias ({series.erro}). O balanço de 30 dias acima vem da publicação e continua válido.</p>
        <button
          type="button"
          onClick={() => setTentativa((t) => t + 1)}
          className="rotulo inline-flex min-h-[44px] items-center border border-linha bg-superficie px-4 text-energia-dark hover:border-carvao"
        >
          Tentar de novo
        </button>
      </div>
    ) : series.estado !== "pronto" ? (
      <p role="status" className="border border-dashed border-linha bg-superficie px-5 py-4 text-sm text-carvao-muted">
        Carregando as séries diárias de {dias} (arquivo à parte, para não pesar na abertura da página).
      </p>
    ) : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <RespostaCurta id="p020" vivo veredito={dec ? vereditoDecomposicao(dec) : "Sem decomposição da EAR nesta publicação."}>
          {dec ? respostaDecomposicao(dec) : "Sem decomposição da EAR nesta publicação."}
        </RespostaCurta>
        <AguaEscolha
          legenda="Subsistema da decomposição"
          opcoes={SUBSISTEMAS.map((s) => ({ id: s, rotulo: NOME_REGIAO[s] }))}
          valor={sm}
          onEscolher={(x) => definir({ sm: x })}
        />
      </div>

      {dec && (
        <>
          <GraficoBarras
            titulo={`Variação da EAR ${DO_REGIAO[dec.sm]} por reservatório, ${dataBR(dec.inicio)} a ${dataBR(dec.fim)}: maiores quedas e maiores altas`}
            dados={barrasDec.map((b) => ({ id: b.id, rotulo: b.rotulo, delta: b.delta }))}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={[{ id: "delta", rotulo: "Variação da EAR no reservatório", cor: COR_REGIAO[dec.sm] }]}
            unidade="MWmês"
            casas={1}
            orientacao="horizontal"
            selecionado={barraSel}
            onSelecionar={selecionarParcela}
          />
          <AguaLegenda
            periodo={`${dataBR(dec.inicio)} a ${dataBR(dec.fim)}, o último dia da EAR por reservatório`}
            universo={`${dec.n_reservatorios} reservatórios que contam na EAR ${DO_REGIAO[dec.sm]}: na parte própria, a energia que a água do reservatório produz na própria usina; na parte a jusante, a que ela produz nas usinas rio abaixo, na cascata`}
            unidade="MWmês: energia equivalente a um megawatt médio durante um mês; a EAR e a variação dos reservatórios usam esta unidade"
          />
          <p className="text-xs text-carvao-muted">
            Escolher uma barra troca o reservatório da conta da água, mais abaixo (<a href="#balanco" className="text-energia-dark underline underline-offset-4">ir para a conta da água</a>).
          </p>
          <MedidasDecomposicao dec={dec} armazenamento={armazenamento} />
          {outraJanela && <p className="border-l-2 border-mineral pl-3 text-sm text-carvao-muted">{outraJanela}</p>}
          <TabelaInterativa
            titulo={`Tabela equivalente: parcelas da variação da EAR ${DO_REGIAO[dec.sm]}`}
            colunas={COLUNAS_DECOMPOSICAO}
            linhas={linhasDec}
            chaveLinha="id"
            colunaRotulo="rotulo"
            fonte="ONS, EAR Diário por Reservatório"
            versao={dec.fim}
            nomeArquivo={`agua-decomposicao-ear-${dec.sm}`}
            selecionado={barraSel}
            onSelecionar={selecionarParcela}
            recolher
            nota={`O gráfico mostra as maiores quedas e altas publicadas e a soma dos demais; a soma de todos os ${dec.n_reservatorios} reservatórios e o resíduo estão na resposta completa (modo Analisar) e na tabela dos subsistemas.`}
          />
        </>
      )}

      {notas}

      {res && (
        <SecaoDoPainel
          id="balanco"
          titulo={`Como foi a conta da água em ${nomeRes}?`}
          lead="A conta de 30 dias, em hm³ (milhões de metros cúbicos): o que entrou (afluência), o que saiu (defluência, pelas turbinas, pelos vertedouros e por outras estruturas) e o resíduo, a diferença que sobra quando a conta não fecha."
        >
          <AguaLista
            rotulo="Reservatório da conta da água"
            opcoes={opcoesRes}
            valor={res.id}
            onEscolher={(x) => selecionar(x)}
            dica="Troca a conta da água e as séries diárias abaixo, em qualquer subsistema."
          />
          {/* depois: a resposta fica na ordem do documento, abaixo do título e da lista, e não antes do título da seção */}
          <RespostaCurta id="p020-balanco" vivo depois veredito={vereditoBalancoReservatorio(res, janela, semCadastro)}>
            {respostaBalanco(res, janela, semCadastro)}
          </RespostaCurta>
          {foraDaFaixa && (
            <p data-aviso="volume-fora-da-faixa" className="max-w-prose2 border-l-2 border-aviso pl-3 text-sm leading-relaxed text-carvao-muted">
              O volume no fim da janela é {pct(res.vol_util_pct_fim, 2)} do volume útil: valor da fonte, {foraDaFaixa === "acima" ? "acima do volume máximo normal do reservatório" : "abaixo de zero"}. A conta
              da água o usa como veio.
            </p>
          )}
          <MedidasBalanco res={res} periodo={periodoJanela} semCadastro={semCadastro} ehPadrao={ehPadrao} evidenciaResiduo={evidenciaResiduo} endereco={enderecoBalanco} />
          <GraficoBarras
            titulo={`Balanço hídrico de ${nomeRes}, ${periodoJanela}, em hm³ (${ROTULO_CONVENCAO[res.convencao_defluencia]})`}
            dados={barrasBalancoTotais(res).map((b) => ({ id: b.id, rotulo: b.rotulo, v: b.v }))}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={[{ id: "v", rotulo: "hm³ na janela", cor: "var(--serie-hidraulica)" }]}
            unidade="hm³"
            casas={2}
            orientacao="horizontal"
          />
          <GraficoBarras
            titulo={`Como a defluência de ${nomeRes} se divide, ${periodoJanela}, em hm³`}
            dados={barrasBalancoDefluencia(res).map((b) => ({ id: b.id, rotulo: b.rotulo, v: b.v }))}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={[{ id: "v", rotulo: "hm³ na janela", cor: "var(--cor-carvao)" }]}
            unidade="hm³"
            casas={2}
            orientacao="horizontal"
          />
          <GraficoBarras
            titulo={`Resíduo e transferência de ${nomeRes}, ${periodoJanela}, em hm³ (régua própria, porque são pequenos)`}
            dados={barrasBalancoResiduo(res).map((b) => ({ id: b.id, rotulo: b.rotulo, v: b.v }))}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={[{ id: "v", rotulo: "hm³ na janela", cor: "var(--cor-mineral)" }]}
            unidade="hm³"
            casas={2}
            orientacao="horizontal"
          />
          <dl className="grid gap-x-6 gap-y-2 text-sm leading-relaxed text-carvao-muted sm:grid-cols-2" data-termos="balanco">
            <div>
              <dt className="inline font-medium text-carvao">Afluência: </dt>
              <dd className="inline">a água que entra no reservatório.</dd>
            </div>
            <div>
              <dt className="inline font-medium text-carvao">Defluência: </dt>
              <dd className="inline">a água que sai, pelas turbinas (turbinado, que gera energia), pelos vertedouros (vertido, que não gera) ou por outras estruturas.</dd>
            </div>
            <div>
              <dt className="inline font-medium text-carvao">Resíduo: </dt>
              <dd className="inline">a diferença que sobra quando a conta não fecha: variação observada menos afluência mais defluência.</dd>
            </div>
            <div>
              <dt className="inline font-medium text-carvao">Transferência: </dt>
              <dd className="inline">volume que o ONS publica à parte; a convenção do sinal dele não está documentada.</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="inline font-medium text-carvao">Convenção da defluência: </dt>
              <dd className="inline">se o número publicado inclui ou não as outras estruturas; o observatório a detecta nos dados de cada reservatório.</dd>
            </div>
          </dl>
          <p className="text-sm text-carvao-muted">
            A conta da água: variação observada = afluência − defluência + resíduo. Turbinado, vertido, outras estruturas e defluência não discriminada são partes da defluência
            conforme a convenção do reservatório; a vazão natural é reconstituída e não entra no balanço. Componente sem dado aparece como &ldquo;sem dado&rdquo;, nunca como zero.
          </p>
          <AguaLegenda
            periodo={`${periodoJanela}, com as vazões do dia e o volume inicial do dia anterior`}
            universo={`${lista.length} reservatórios com EAR máxima positiva (todos os do ONS estão no CSV)`}
            unidade="hm³: hectômetro cúbico, um milhão de metros cúbicos, com a vazão do dia convertida por m³/s × 86.400 s ÷ 10⁶; m³/s e % do volume útil nas séries diárias"
          />
          <TabelaInterativa
            titulo={`Balanço de 30 dias dos ${lista.length} reservatórios com EAR máxima positiva`}
            colunas={COLUNAS_RESERVATORIOS}
            linhas={linhasRes}
            chaveLinha="id"
            colunaRotulo="rotulo"
            fonte={fonte}
            versao={versao}
            nomeArquivo="agua-reservatorios-balanco"
            selecionado={res.id}
            onSelecionar={selecionar}
            chaveUrl="res"
            dicaBusca="Nome, bacia ou identificador"
            recolher
            nota={`Sem balanço: ${plural(lista.filter((r) => !r.balanco_calculado).length, "reservatório", "reservatórios")} nesta lista, com o motivo exato na coluna Observação (modo Analisar) e no CSV. Nada é preenchido; o resíduo nunca é zerado por ajuste. ${textoVolumeForaDaFaixa(lista)}`}
          />
        </SecaoDoPainel>
      )}

      {qualidade}

      <div ref={alvo} data-series={series.estado}>
        <SecaoDoPainel
          id="serie-diaria"
          titulo={nomeRes ? `Como o volume e as vazões variaram dia a dia em ${nomeRes}?` : "Como o volume e as vazões variaram dia a dia?"}
          lead={`Últimos ${dias}, em % do volume útil e em m³/s; o balanço de 30 dias começa na marca da janela.`}
        >
          {/* espaço reservado até as séries chegarem: as duas figuras ocupam a mesma altura que o aviso, e a página não salta */}
          <div className={series.estado === "pronto" ? undefined : "min-h-[640px]"}>
            {estadoSeries}
            {series.estado === "pronto" &&
              (serieSel.length ? (
                <div className="space-y-4">
                  <CursorSincronizado>
                    <GraficoLinhas
                      titulo={`Volume útil de ${nomeRes}`}
                      dados={serieSel}
                      chaveX="d"
                      series={[{ id: "vol", rotulo: "Volume útil", cor: "var(--serie-hidraulica)", espessura: 2.5 }]}
                      unidade="% do volume útil"
                      casas={2}
                      marcos={[{ x: janela.inicio, rotulo: "início da janela do balanço" }]}
                      altura={220}
                    />
                    <GraficoLinhas
                      titulo={`Vazões de ${nomeRes}`}
                      dados={serieSel}
                      chaveX="d"
                      series={[
                        { id: "afl", rotulo: "Afluente", cor: "var(--serie-hidraulica)", espessura: 2 },
                        { id: "defl", rotulo: "Defluente", cor: "var(--cor-carvao)" },
                        { id: "turb", rotulo: "Turbinada", cor: "var(--serie-eolica)", tracejada: true },
                        { id: "vert", rotulo: "Vertida", cor: "var(--serie-termica)", tracejada: true },
                      ]}
                      unidade="m³/s"
                      casas={0}
                      marcos={[{ x: janela.inicio, rotulo: "início da janela do balanço" }]}
                      legendaInterativa
                    />
                  </CursorSincronizado>
                  {coincidem && (
                    <p className="text-sm text-carvao-muted" data-nota="vazoes-coincidem">
                      {coincidem}
                    </p>
                  )}
                </div>
              ) : (
                <p role="status" className="text-sm text-carvao-muted">
                  Sem série diária publicada para este reservatório.
                </p>
              ))}
          </div>
        </SecaoDoPainel>
      </div>

      <SecaoDoPainel id="comparar" nivel="analisar" titulo="Até quatro reservatórios na mesma escala">
        <Comparador
          rotulo={`Reservatórios comparados (até ${LIMITE_COMPARACAO})`}
          entidades={lista.map((r) => ({ id: r.id, rotulo: nomeProprio(r.nome), detalhe: r.subsistema ?? undefined, sinonimos: [r.nome, r.id] }))}
          selecionadas={escolhidos}
          onMudar={(ids) => definir({ cmp: ids })}
          dicaBusca="Buscar, por exemplo Serra da Mesa, Furnas, Sobradinho"
          vazio={`Nenhum reservatório escolhido. Escolha até ${LIMITE_COMPARACAO} para ver o volume útil dos últimos ${dias} na mesma escala.`}
        >
          {() => null}
        </Comparador>
        {escolhidos.length > 0 && series.estado === "pronto" && (
          <PequenosMultiplos
            titulo={`Volume útil nos últimos ${dias} (% do volume útil de cada reservatório)`}
            dados={multiplos}
            chaveX="d"
            unidade="%"
            casas={2}
            nivelTitulo={4}
            colunas={escolhidos.length >= 4 ? 4 : escolhidos.length >= 3 ? 3 : 2}
            // a mesma grandeza (volume útil) tem a mesma cor em todos os painéis e na série do reservatório escolhido; o nome do reservatório é o do painel
            paineis={seriesComp.map((s) => ({
              id: s.id,
              titulo: nomeProprio(s.nome),
              series: [{ id: s.id, rotulo: "Volume útil", cor: "var(--serie-hidraulica)", espessura: 2 }],
            }))}
          />
        )}
        {escolhidos.length > 0 && series.estado !== "pronto" && estadoSeries}
      </SecaoDoPainel>
    </div>
  );
}
