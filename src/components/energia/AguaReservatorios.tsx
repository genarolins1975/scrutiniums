"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AguaEscolha, AguaLista } from "@/components/energia/AguaControles";
import { Comparador } from "@/components/energia/Comparador";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  COLUNAS_DECOMPOSICAO,
  COLUNAS_RESERVATORIOS,
  COR_COMPARACAO,
  COR_REGIAO,
  DO_REGIAO,
  NOME_REGIAO,
  ROTULO_CONVENCAO,
  SUBSISTEMAS,
  barrasBalanco,
  barrasDecomposicao,
  linhasDecomposicao,
  linhasMultiplosVolume,
  linhasReservatorios,
  nomeProprio,
  reservatorioDaParcela,
  reservatorioPadrao,
  respostaBalanco,
  respostaDecomposicao,
  serieReservatorio,
} from "@/lib/energia/agua";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, plural } from "@/lib/energia/formato";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { Submercado } from "@/lib/energia/tipos";
import type { AguaDecomposicaoEar, AguaReservatorio, AguaReservatorios45d } from "@/lib/energia/tipos-agua";

/**
 * P020, reservatórios e balanço: subsistema da decomposição (?sm=), reservatório
 * escolhido (?res=) e reservatórios comparados (?cmp=, até quatro) ficam na URL. A
 * barra de uma parcela da decomposição, a linha da tabela e a lista escolhem o mesmo
 * reservatório, ligado pelo código da usina (nunca pelo nome). A resposta, as barras
 * e as tabelas usam as mesmas linhas da gold. As séries diárias (45 dias na publicação
 * atual; o número exibido vem da gold) vêm de agua_reservatorios_45d.json, buscado só
 * quando a seção chega perto da tela.
 */
const ESQUEMA = {
  sm: campo(tiposUrl.opcao(SUBSISTEMAS), "SE"),
  res: campo(tiposUrl.texto({ max: 20 }), ""),
  cmp: campo(tiposUrl.lista(tiposUrl.texto({ max: 20 }), { max: LIMITE_COMPARACAO }), [] as string[]),
};

type Series = { estado: "espera" | "carregando" | "pronto" | "erro"; dados: AguaReservatorios45d | null; erro: string };

export function AguaReservatorios({
  lista,
  decomposicao,
  janela,
  urlSeries,
  diasSeries,
  fonte,
  versao,
  destaques,
}: {
  lista: AguaReservatorio[];
  decomposicao: AguaDecomposicaoEar[];
  janela: { inicio: string; fim: string; periodo_fecham_por_construcao: { inicio: string; fim: string } | null };
  urlSeries: string;
  /** Dias de cada série diária do arquivo sob demanda (gold: reservatorios.series_45d.dias). */
  diasSeries: number;
  fonte: string;
  versao: string;
  destaques?: ReactNode;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const sm = v.sm as Submercado;
  const dec = decomposicao.find((d) => d.sm === sm) ?? decomposicao[0] ?? null;
  const padrao = useMemo(() => reservatorioPadrao(lista), [lista]);
  const res = lista.find((r) => r.id === v.res) ?? lista.find((r) => r.id === padrao) ?? null;
  const barrasDec = useMemo(() => (dec ? barrasDecomposicao(dec) : []), [dec]);
  const barraSel = res ? (barrasDec.find((b) => b.cod === res.cod)?.id ?? null) : null;
  const linhasDec = useMemo(() => (dec ? linhasDecomposicao(dec) : []), [dec]);
  const linhasRes = useMemo(() => linhasReservatorios(lista), [lista]);
  const barrasBal = useMemo(() => (res ? barrasBalanco(res) : []), [res]);
  const selecionar = (id: string | null) => id && definir({ res: id === padrao ? "" : id });
  const selecionarParcela = (id: string | null) => {
    const b = barrasDec.find((x) => x.id === id);
    const r = b ? reservatorioDaParcela(lista, b.cod) : null;
    if (r) selecionar(r.id);
  };
  const escolhidos = (v.cmp as string[]).filter((id) => lista.some((r) => r.id === id));

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
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <AguaEscolha
          legenda="Subsistema da decomposição"
          opcoes={SUBSISTEMAS.map((s) => ({ id: s, rotulo: s === "SE" ? "SE/CO" : NOME_REGIAO[s], detalhe: NOME_REGIAO[s] }))}
          valor={sm}
          onEscolher={(x) => definir({ sm: x })}
        />
        <AguaLista
          rotulo="Reservatório"
          opcoes={[...lista].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((r) => ({ id: r.id, rotulo: nomeProprio(r.nome) }))}
          valor={res?.id ?? ""}
          onEscolher={(x) => selecionar(x)}
        />
      </div>

      <div className="max-w-prose2 space-y-2 text-base leading-relaxed text-carvao" data-resposta="p020" aria-live="polite">
        <p>{dec ? respostaDecomposicao(dec) : "Sem decomposição da EAR nesta publicação."}</p>
        <p>{res ? respostaBalanco(res, janela) : "Sem reservatório com balanço nesta publicação."}</p>
      </div>

      <dl className="grid gap-x-6 gap-y-1 text-xs text-carvao-muted sm:grid-cols-3">
        <div>
          <dt className="rotulo text-mineral">Período</dt>
          <dd className="mt-0.5">
            Decomposição: {dec ? `${dataBR(dec.inicio)} a ${dataBR(dec.fim)}` : "sem janela"} (último dia da EAR por reservatório); balanço: {dataBR(janela.inicio)} a{" "}
            {dataBR(janela.fim)} (vazões do dia, volume inicial do dia anterior)
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Universo</dt>
          <dd className="mt-0.5">
            {dec ? `${dec.n_reservatorios} reservatórios que contam na EAR ${DO_REGIAO[dec.sm]} (parte própria e parte a jusante)` : ""}; no balanço, {lista.length} reservatórios
            com EAR máxima positiva (todos os do ONS estão no CSV)
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Unidade</dt>
          <dd className="mt-0.5">MWmês na decomposição da EAR; hm³ no balanço (m³/s × 86.400 s ÷ 10⁶ por dia); m³/s e % do volume útil nas séries diárias</dd>
        </div>
      </dl>

      {destaques}

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
            nota={`O gráfico mostra as maiores quedas e altas publicadas; a soma de todos os ${dec.n_reservatorios} reservatórios e o resíduo estão na resposta acima e na tabela dos subsistemas.`}
          />
        </>
      )}

      {res && (
        <div className="space-y-3 border-t border-linha pt-5">
          <h3 className="font-serif text-lg text-carvao">
            {nomeRes}: componentes do balanço de 30 dias, em hm³ ({ROTULO_CONVENCAO[res.convencao_defluencia]})
          </h3>
          <GraficoBarras
            titulo={`Balanço hídrico de ${nomeRes}, ${dataBR(janela.inicio)} a ${dataBR(janela.fim)}`}
            dados={barrasBal.map((b) => ({ id: b.id, rotulo: b.rotulo, v: b.v }))}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={[{ id: "v", rotulo: "hm³ na janela", cor: "var(--serie-hidraulica)" }]}
            unidade="hm³"
            casas={2}
            orientacao="horizontal"
          />
          <p className="text-sm text-carvao-muted">
            Identidade: variação observada = afluência − defluência + resíduo. Turbinado, vertido, outras estruturas e defluência não discriminada são partes da defluência
            conforme a convenção do reservatório; a vazão natural é reconstituída e não entra no balanço. Componente sem dado aparece como &ldquo;sem dado&rdquo;, nunca como zero.
          </p>
        </div>
      )}

      <div ref={alvo} className="space-y-4 border-t border-linha pt-5" data-series={series.estado}>
        <h3 className="font-serif text-lg text-carvao">{nomeRes ? `${nomeRes}: volume e vazões dia a dia nos últimos ${dias}` : "Volume e vazões dia a dia"}</h3>
        {estadoSeries}
        {series.estado === "pronto" &&
          (serieSel.length ? (
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
          ) : (
            <p role="status" className="text-sm text-carvao-muted">
              Sem série diária publicada para este reservatório.
            </p>
          ))}

      </div>

      <div data-nivel="analisar" className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Até quatro reservatórios na mesma escala</h3>
        <Comparador
          rotulo={`Reservatórios comparados (até ${LIMITE_COMPARACAO})`}
          entidades={lista.map((r) => ({ id: r.id, rotulo: nomeProprio(r.nome), detalhe: r.subsistema ?? undefined, sinonimos: [r.nome, r.id] }))}
          selecionadas={escolhidos}
          onMudar={(ids) => definir({ cmp: ids })}
          dicaBusca="Serra da Mesa, Furnas, Sobradinho"
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
            colunas={escolhidos.length >= 4 ? 4 : escolhidos.length >= 3 ? 3 : 2}
            paineis={seriesComp.map((s, i) => ({
              id: s.id,
              titulo: nomeProprio(s.nome),
              series: [{ id: s.id, rotulo: "Volume útil", cor: COR_COMPARACAO[i % COR_COMPARACAO.length], espessura: 2 }],
            }))}
          />
        )}
        {escolhidos.length > 0 && series.estado !== "pronto" && estadoSeries}
      </div>

      <TabelaInterativa
        titulo={`Balanço de 30 dias dos ${lista.length} reservatórios com EAR máxima positiva`}
        colunas={COLUNAS_RESERVATORIOS}
        linhas={linhasRes}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte={fonte}
        versao={versao}
        nomeArquivo="agua-reservatorios-balanco"
        selecionado={res?.id ?? null}
        onSelecionar={selecionar}
        chaveUrl="res"
        dicaBusca="Nome, bacia ou identificador"
        nota="Sem balanço: falta volume ou vazão na janela, ou volume útil no cadastro (motivo no CSV). Nada é preenchido; o resíduo nunca é zerado por ajuste."
      />
    </div>
  );
}
