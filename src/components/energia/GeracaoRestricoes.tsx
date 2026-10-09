"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { GeracaoAviso, GeracaoEscolha, GeracaoRecorte } from "@/components/energia/GeracaoControles";
import { GeracaoMapaUsinas } from "@/components/energia/GeracaoMapaUsinas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { carregaJson } from "@/lib/energia/carregaJson";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, dataCurta, mesAno, mesAnoCurto, num } from "@/lib/energia/formato";
import { URL_GEO, lerCaminho, pontoNaRegiao, type CamadaGeo } from "@/lib/energia/geo";
import {
  COLUNAS_DESCRICOES,
  COLUNAS_RAZOES_12M,
  COLUNAS_SUBSISTEMAS_12M,
  COLUNAS_USINAS_RESTRICAO,
  COR_RAZAO,
  CURTO_RAZAO,
  FONTES_RESTRICAO,
  NOME_FONTE_RESTRICAO,
  RAZOES,
  classesTamanho,
  colunasRestricaoMensal,
  colunasUsinaMes,
  gwh,
  instanteBR,
  linhasDescricoes,
  linhasRazoes12m,
  linhasRestricaoDiaria,
  linhasRestricaoMensal,
  linhasSubsistemas12m,
  linhasUsinasRestricao,
  notaRazoesRestricao,
  notaUniversoRestricoes,
  paraTabela,
  pontosUsinas,
  respostaRestricao,
  serieUsinaCsv,
  usinaRestricaoEscolhida,
  vereditoRestricao,
  type FonteRestricao,
  type LinhaUsinaMes,
} from "@/lib/energia/geracao";
import type { RazaoRestricao, Restricao } from "@/lib/energia/tipos-geracao";

/**
 * P023, renováveis restringidas. O recorte fica na URL: fonte (?f=eolica ou solar) e usina
 * escolhida (?ru=); busca, ordem e filtros de cada tabela também (prefixos rm e ru). Escolher
 * uma usina no mapa ou na tabela seleciona a mesma usina nos dois, e o histórico mensal
 * dela é lido sob demanda do CSV publicado (geracao_restricao_usina_mensal.csv).
 *
 * Energia e potência ficam separadas: as barras somam a energia não gerada estimada por razão
 * oficial do ONS (GWh); o maior corte simultâneo (MW) tem gráfico próprio. A taxa usa o
 * denominador da gold: não gerada ÷ (verificada + não gerada). A malha de UF é lida da
 * camada publicada quando o painel aparece; sem ela, a tabela traz as mesmas usinas.
 *
 * Ordem da página: o veredito e a figura principal (energia não gerada por razão oficial, mês a mês) lado a lado, o recorte como
 * legenda e as notas do painel (`notas`); depois seções visíveis com pergunta própria: a taxa e o maior corte simultâneo (duas
 * medidas, dois gráficos, cada um na sua unidade) e o mapa das usinas com a tabela. As medidas de abertura (12 meses, por fonte)
 * ficam na faixa de métricas da página.
 */
const ESQUEMA = {
  f: campo(tiposUrl.opcao(FONTES_RESTRICAO), "eolica" as FonteRestricao),
  ru: campo(tiposUrl.texto({ max: 40 }), ""),
  // vista do mapa: ampliada nas usinas (padrão) ou Brasil inteiro; entra na URL para o link do painel reproduzir a vista
  vm: campo(tiposUrl.opcao(["usinas", "brasil"] as const), "usinas"),
};

const URL_USINAS_MES = "/energia/series/geracao_restricao_usina_mensal.csv";

/** O que o painel principal usa de cada fonte (o diário, o detalhamento do ONS e os controles ficam fora). */
export type RestricaoCliente = Pick<Restricao, "fonte" | "primeiro_mes" | "ultimo_mes_completo" | "mensal_sin" | "ultimos_12m" | "usinas_12m" | "usinas_12m_resumo">;
/** O que a análise usa de cada fonte: razões e subsistemas dos 12 meses, os últimos dias e o detalhamento do ONS no último mês. */
export type RestricaoAnaliseCliente = Pick<Restricao, "fonte" | "ultimos_12m" | "diario_recente" | "descricoes_ultimo_mes">;

/** Fonte da URL quando publicada; senão a primeira publicada. */
function fonteValida(pedida: FonteRestricao, disponiveis: readonly FonteRestricao[]): FonteRestricao {
  return disponiveis.includes(pedida) ? pedida : (disponiveis[0] ?? "eolica");
}

export function GeracaoRestricoes({
  restricoes,
  fonte,
  versao,
  notas,
  rotulosRazao,
  potenciaOperacao,
}: {
  restricoes: Partial<Record<FonteRestricao, RestricaoCliente>>;
  fonte: string;
  versao: string;
  /** Notas do painel (NotasDoPainel), logo depois da figura principal e do recorte. */
  notas?: ReactNode;
  /** Potência em operação comercial de cada fonte no retrato da Capacidade Instalada: referência do maior corte simultâneo (outra data e outro universo). */
  potenciaOperacao?: { data: string; eolica: number | null; solar: number | null };
  /** Rótulo oficial de cada razão (a gold publica; vai para a chave sob o gráfico mensal). */
  rotulosRazao?: Partial<Record<RazaoRestricao, string>>;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const disponiveis = FONTES_RESTRICAO.filter((f) => restricoes[f]);
  const f = fonteValida(v.f, disponiveis);
  const r = restricoes[f]!;
  const u = r.ultimos_12m;

  const mensal = useMemo(() => linhasRestricaoMensal(r), [r]);
  const barras = useMemo(() => mensal.linhas.map((l) => ({ ...l, rotulo: l.parcial === "sim" ? `${mesAnoCurto(l.m)} (parcial)` : mesAnoCurto(l.m) })), [mensal]);
  const ultimo = mensal.linhas[mensal.linhas.length - 1];
  const usinas = useMemo(() => linhasUsinasRestricao(r), [r]);
  const usina = usinaRestricaoEscolhida(r, v.ru);
  const selecionar = (id: string | null) => definir({ ru: id ?? "" });

  // malha de UF publicada, lida uma vez por página (carregaJson compartilha a promessa)
  const [camada, setCamada] = useState<CamadaGeo | null>(null);
  const [erroMalha, setErroMalha] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    carregaJson<CamadaGeo>(URL_GEO.uf)
      .then((c) => vivo && setCamada(c))
      .catch((x: unknown) => vivo && setErroMalha(x instanceof Error ? x.message : String(x)));
    return () => {
      vivo = false;
    };
  }, []);
  const mapa = useMemo(() => (camada ? pontosUsinas(r.usinas_12m, camada.projecao) : null), [camada, r]);
  const classes = useMemo(() => classesTamanho(r.usinas_12m), [r]);
  const ufs = useMemo(() => (camada ? camada.features.map((x) => ({ id: x.id, uf: x.uf, d: x.d })) : []), [camada]);
  // coordenada fora da UF que o ONS informa (subestação coletora de conjunto em UF vizinha): contada e declarada
  const foraDaUf = useMemo(() => {
    if (!camada || !mapa) return [];
    const aneis = new Map(camada.features.map((x) => [x.uf, lerCaminho(x.d)]));
    return mapa.pontos.filter((p) => p.uf && aneis.has(p.uf) && !pontoNaRegiao([p.x, p.y], aneis.get(p.uf)!));
  }, [camada, mapa]);

  // histórico mensal da usina escolhida, do CSV publicado, só quando o leitor pede
  const [csv, setCsv] = useState<string | null>(null);
  const [pedidoCsv, setPedidoCsv] = useState(false);
  const [erroCsv, setErroCsv] = useState<string | null>(null);
  useEffect(() => {
    if (!pedidoCsv || csv !== null) return;
    let vivo = true;
    fetch(URL_USINAS_MES)
      .then((x) => {
        if (!x.ok) throw new Error(`HTTP ${x.status} ao ler ${URL_USINAS_MES}`);
        return x.text();
      })
      .then((t) => vivo && setCsv(t))
      .catch((x: unknown) => vivo && setErroCsv(x instanceof Error ? x.message : String(x)));
    return () => {
      vivo = false;
    };
  }, [pedidoCsv, csv]);
  const historico: LinhaUsinaMes[] = useMemo(() => (csv && usina ? serieUsinaCsv(csv, f, usina.id) : []), [csv, usina, f]);
  const razoesUsina = razoesComValor(historico);

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          {disponiveis.length > 1 && (
            <GeracaoEscolha
              legenda="Fonte"
              opcoes={disponiveis.map((x) => ({ id: x, rotulo: NOME_FONTE_RESTRICAO[x] }))}
              valor={f}
              onEscolher={(x) => definir({ f: x, ru: "" })}
            />
          )}
          <RespostaCurta id="p023" veredito={vereditoRestricao(restricoes) || respostaRestricao(r)}>
            <span data-fonte={f}>{respostaRestricao(r)}</span>
          </RespostaCurta>
          {notaUniversoRestricoes(restricoes) && (
            <p className="text-xs leading-relaxed text-carvao-muted" data-nota="universo-fontes">
              {notaUniversoRestricoes(restricoes)}
            </p>
          )}
        </div>
        <div id="restricao-mensal" className="scroll-mt-28 space-y-3">
          <GraficoBarras
            titulo={`Energia não gerada estimada por razão, ${NOME_FONTE_RESTRICAO[f].toLowerCase()}, SIN`}
            dados={paraTabela(barras)}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={mensal.razoes.map((z) => ({ id: z, rotulo: CURTO_RAZAO[z], cor: COR_RAZAO[z] }))}
            unidade="GWh"
            casas={1}
            empilhado
            altura={300}
          />
          {ultimo?.parcial === "sim" && (
            <GeracaoAviso>O último mês ({ultimo.mes}) é parcial: soma só os dias já publicados e não se compara com meses completos.</GeracaoAviso>
          )}
          <p className="text-xs leading-relaxed text-carvao-muted" data-nota="ess-restricao">
            Compensação: pela norma lida em cópia de 08/01/2025, só a razão elétrica (indisponibilidade externa) dá direito ao ESS, o encargo de serviços do sistema; alterações posteriores indicadas em fontes secundárias não foram verificadas aqui.
          </p>
          {notaRazoesRestricao(r, rotulosRazao ?? {}, mensal.razoes) && (
            <p className="text-xs leading-relaxed text-carvao-muted" data-nota="razoes-restricao">
              {notaRazoesRestricao(r, rotulosRazao ?? {}, mensal.razoes)}
            </p>
          )}
        </div>
      </div>

      <GeracaoRecorte
        periodo={
          u
            ? `${mesAno(u.inicio)} a ${mesAno(u.fim)} (12 meses completos); série mensal desde ${mesAno(r.primeiro_mes)}`
            : `série mensal desde ${mesAno(r.primeiro_mes)}, sem 12 meses completos`
        }
        universo={
          u ? (
            <>
              {NOME_FONTE_RESTRICAO[f]} despachadas ou programadas pelo ONS <span data-nivel="analisar">(Tipo I, II-B e II-C) </span>com limitação registrada: {num(u.usinas_com_restricao, 0)} de {num(u.usinas_no_universo, 0)} usinas e conjuntos no
              período
            </>
          ) : (
            <>
              {NOME_FONTE_RESTRICAO[f]} despachadas ou programadas pelo ONS <span data-nivel="analisar">(Tipo I, II-B e II-C)</span>
            </>
          )
        }
        unidade="GWh (energia não gerada estimada); % de verificada mais não gerada (taxa); MW (maior corte simultâneo numa meia hora)"
      />

      {notas}

      <SecaoDoPainel
        id="taxa-e-corte"
        titulo="Qual foi a taxa de restrição, e qual o maior corte simultâneo?"
        lead="Duas medidas diferentes, cada uma na sua unidade: a taxa é uma parcela da energia (%), e o maior corte é uma potência (MW) numa única meia hora."
      >
        <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
          <GraficoLinhas
            titulo="Taxa de restrição: não gerada ÷ (verificada + não gerada)"
            dados={mensal.linhas.map((l) => ({ m: l.m, taxa: l.taxa_pct }))}
            chaveX="m"
            formatoX="mes"
            series={[{ id: "taxa", rotulo: "Taxa de restrição", cor: COR_RAZAO.ENE, espessura: 2.5 }]}
            unidade="%"
            casas={1}
            zeroNoEixo
            altura={220}
          />
          <GraficoLinhas
            titulo="Maior corte simultâneo numa meia hora do mês (potência, não energia)"
            dados={mensal.linhas.map((l) => ({ m: l.m, potencia: l.potencia_mw }))}
            chaveX="m"
            formatoX="mes"
            series={[{ id: "potencia", rotulo: "Maior corte simultâneo", cor: "var(--serie-referencia)", espessura: 2.5 }]}
            unidade="MW"
            casas={0}
            zeroNoEixo
            altura={220}
          />
        </div>
        {potenciaOperacao && (potenciaOperacao.eolica !== null || potenciaOperacao.solar !== null) && (
          <p className="text-xs leading-relaxed text-carvao-muted" data-referencia-corte="">
            Para ler o maior corte: a potência em operação comercial era de{" "}
            {[
              potenciaOperacao.eolica !== null ? `${num(potenciaOperacao.eolica, 1)} MW nas eólicas` : null,
              potenciaOperacao.solar !== null ? `${num(potenciaOperacao.solar, 1)} MW na solar centralizada` : null,
            ]
              .filter((x): x is string => x !== null)
              .join(" e ")}{" "}
            em {dataBR(potenciaOperacao.data)} (retrato da Capacidade Instalada, usinas despachadas pelo ONS). Corte e potência são medidas de datas e universos diferentes: a razão entre elas não é publicada.
          </p>
        )}
        <TabelaInterativa
          titulo="Tabela equivalente: energia não gerada, taxa e maior corte, mês a mês"
          colunas={colunasRestricaoMensal(mensal.razoes).map((c) => (c.id === "mes" ? { ...c, id: "m", tipo: "data" as const } : c))}
          linhas={paraTabela(mensal.linhas)}
          chaveLinha="id"
          colunaRotulo="m"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`geracao-restricao-mensal-${f}`}
          chaveUrl="rm"
          ordemInicial={{ coluna: "m", direcao: "desc" }}
          nota="Razão sem energia em nenhum mês fica fora das colunas. A potência é o maior corte simultâneo do mês, não a soma dos cortes."
        />
      </SecaoDoPainel>

      <SecaoDoPainel
        id="mapa-usinas"
        titulo={`Onde estão as ${num(r.usinas_12m_resumo.publicadas, 0)} usinas e conjuntos com mais energia não gerada (${num(r.usinas_12m_resumo.cobertura_da_energia_pct, 1)}% do total)?`}
      >
        {mapa ? (
          <GeracaoMapaUsinas
            titulo={`${NOME_FONTE_RESTRICAO[f]} com mais energia não gerada por restrição${u ? `, ${mesAno(u.inicio)} a ${mesAno(u.fim)}` : ""}`}
            ufs={ufs}
            viewBox={camada!.viewBox}
            pontos={mapa.pontos}
            rotulosClasse={classes.rotulos}
            selecionado={usina?.id ?? null}
            onSelecionar={selecionar}
            ampliado={v.vm === "usinas"}
            onAmpliar={(b) => definir({ vm: b ? "usinas" : "brasil" })}
            semCoordenada={mapa.semCoordenada}
            nota={`Cada marca é uma usina ou um conjunto de usinas como o ONS publica; o ponto não indica onde o corte foi decidido.${
              foraDaUf.length
                ? ` Em ${foraDaUf.length === 1 ? "1 caso" : `${foraDaUf.length} casos`} a coordenada fica fora da UF que o ONS informa (${foraDaUf.map((p) => `${p.nome}, ${p.uf}`).join("; ")}): a subestação coletora de um conjunto pode ficar em UF vizinha.`
                : ""
            }`}
          />
        ) : (
          <p className="text-sm text-carvao-muted" role="status" aria-live="polite">
            {erroMalha ? `A malha de UF não pôde ser lida (${erroMalha}); a tabela abaixo traz as mesmas usinas.` : "Lendo a malha de UF publicada para desenhar o mapa…"}
          </p>
        )}
        <TabelaInterativa
          titulo={`Usinas e conjuntos: energia não gerada, taxa e razão principal, 12 meses (${NOME_FONTE_RESTRICAO[f].toLowerCase()})`}
          colunas={COLUNAS_USINAS_RESTRICAO}
          linhas={paraTabela(usinas)}
          chaveLinha="id"
          colunaRotulo="nome"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`geracao-restricao-usinas-${f}`}
          chaveUrl="tu"
          selecionado={usina?.id ?? null}
          onSelecionar={selecionar}
          ordemInicial={{ coluna: "nao_gerada_gwh", direcao: "desc" }}
          dicaBusca="Nome da usina ou UF"
          nota={`Lista completa, mês a mês, no CSV de restrição por usina, no fim do painel. Coordenada publicada pelo ONS no conjunto de fator de capacidade (subestação coletora; sem ela, ponto de conexão).`}
        />
        {usina && (
          <div className="space-y-3 border-l-2 border-energia pl-4" data-usina={usina.id}>
            <p className="text-sm text-carvao">
              <span className="font-medium">{usina.nome ?? usina.id}</span>
              {usina.uf ? ` (${usina.uf})` : ""}: {num(gwh(usina.energia_nao_gerada_mwh), 1)} GWh não gerados nos 12 meses, taxa de {num(usina.taxa_pct, 1)}%; razão com mais
              energia: {CURTO_RAZAO[usina.razao_principal].toLowerCase()}.
            </p>
            {!csv && (
              <button
                type="button"
                onClick={() => setPedidoCsv(true)}
                disabled={pedidoCsv && !erroCsv}
                className="rotulo inline-flex min-h-[44px] items-center border border-linha px-3 text-carvao hover:border-energia disabled:opacity-60"
              >
                {pedidoCsv && !erroCsv ? "Lendo o histórico mensal…" : "Ver o histórico mensal desta usina"}
              </button>
            )}
            {erroCsv && <GeracaoAviso>O histórico não pôde ser lido: {erroCsv}.</GeracaoAviso>}
            {csv && historico.length === 0 && <GeracaoAviso>O arquivo publicado não tem meses desta usina para {NOME_FONTE_RESTRICAO[f].toLowerCase()}.</GeracaoAviso>}
            {historico.length > 0 && (
              <>
                <GraficoBarras
                  titulo={`${usina.nome ?? usina.id}: energia não gerada por razão, mês a mês`}
                  dados={historico.map((l) => ({ ...l, rotulo: mesAnoCurto(l.m) }))}
                  chaveCategoria="m"
                  chaveRotulo="rotulo"
                  series={razoesUsina.map((z) => ({ id: z, rotulo: CURTO_RAZAO[z], cor: COR_RAZAO[z] }))}
                  unidade="MWh"
                  casas={0}
                  empilhado
                  altura={240}
                />
                <TabelaInterativa
                  chaveUrl="um"
                  titulo={`Tabela equivalente: ${usina.nome ?? usina.id}, mês a mês`}
                  colunas={colunasUsinaMes(razoesUsina).map((c) => (c.id === "mes" ? { ...c, id: "m", tipo: "data" as const } : c))}
                  linhas={paraTabela(historico)}
                  chaveLinha="id"
                  colunaRotulo="m"
                  fonte={fonte}
                  versao={versao}
                  nomeArquivo={`geracao-restricao-usina-${usina.id}`}
                  ordemInicial={{ coluna: "m", direcao: "desc" }}
                />
              </>
            )}
          </div>
        )}
      </SecaoDoPainel>
    </div>
  );
}

/**
 * Análise do P023 para a fonte escolhida na URL (o mesmo ?f= do painel): razões e origem dos 12
 * meses, subsistemas, energia não gerada e maior corte de cada um dos últimos dias e o
 * detalhamento publicado pelo ONS no último mês. Só a fonte escolhida é desenhada.
 */
export function GeracaoRestricoesAnalise({ restricoes, fonte, versao }: { restricoes: Partial<Record<FonteRestricao, RestricaoAnaliseCliente>>; fonte: string; versao: string }) {
  const [v] = useEstadoUrl(ESQUEMA);
  const disponiveis = FONTES_RESTRICAO.filter((x) => restricoes[x]);
  const f = fonteValida(v.f, disponiveis);
  const r = restricoes[f];
  const diario = useMemo(() => (r ? linhasRestricaoDiaria(r) : []), [r]);
  if (!r) return null;
  const u = r.ultimos_12m;
  const razoesDia = RAZOES.filter((z) => diario.some((l) => (l[z] ?? 0) > 0));
  return (
    <div className="space-y-4" data-fonte={f}>
      <p className="rotulo text-mineral">{NOME_FONTE_RESTRICAO[f]} (fonte escolhida no painel)</p>
      {u && (
        <>
          <p className="text-sm leading-relaxed text-carvao-muted">
            De {mesAno(u.inicio)} a {mesAno(u.fim)}, o maior corte simultâneo foi de {num(u.potencia_max_cortada_mw, 1)} MW em {instanteBR(u.quando_potencia_max)}. A origem (local ou
            sistêmica) é a que o ONS registra em cada limitação; o observatório não a reclassifica.
          </p>
          <TabelaInterativa
            chaveUrl="rz"
            titulo={`Energia não gerada por razão e origem, ${mesAno(u.inicio)} a ${mesAno(u.fim)}`}
            colunas={COLUNAS_RAZOES_12M}
            linhas={paraTabela(linhasRazoes12m(r))}
            chaveLinha="id"
            colunaRotulo="razao"
            fonte={fonte}
            versao={versao}
            nomeArquivo={`geracao-restricao-razoes-${f}`}
          />
          <TabelaInterativa
            chaveUrl="ss"
            titulo={`Energia não gerada e taxa por subsistema, ${mesAno(u.inicio)} a ${mesAno(u.fim)}`}
            colunas={COLUNAS_SUBSISTEMAS_12M}
            linhas={paraTabela(linhasSubsistemas12m(r))}
            chaveLinha="id"
            colunaRotulo="sm"
            fonte={fonte}
            versao={versao}
            nomeArquivo={`geracao-restricao-subsistemas-${f}`}
            nota="Subsistema com pouca geração verificada tem taxa sobre base pequena: a taxa de poucos GWh se move mais que a do Nordeste. Leia a taxa junto da energia verificada."
          />
        </>
      )}
      {diario.length > 0 && (
        <>
          <GraficoBarras
            titulo={`Energia não gerada por dia e razão, ${dataBR(diario[0].d)} a ${dataBR(diario[diario.length - 1].d)}`}
            dados={diario.map((l) => ({ ...l, rotulo: dataCurta(l.d) }))}
            chaveCategoria="d"
            chaveRotulo="rotulo"
            series={razoesDia.map((z) => ({ id: z, rotulo: CURTO_RAZAO[z], cor: COR_RAZAO[z] }))}
            unidade="MWh"
            casas={0}
            empilhado
            altura={260}
          />
          <GraficoLinhas
            titulo="Maior corte simultâneo de cada dia (potência)"
            dados={diario.map((l) => ({ d: l.d, potencia: l.potencia_mw }))}
            chaveX="d"
            series={[{ id: "potencia", rotulo: "Maior corte simultâneo", cor: "var(--serie-referencia)", espessura: 2 }]}
            unidade="MW"
            casas={0}
            zeroNoEixo
            altura={200}
          />
        </>
      )}
      {r.descricoes_ultimo_mes && r.descricoes_ultimo_mes.itens.length > 0 && (
        <TabelaInterativa
          chaveUrl="ds"
          titulo={`Detalhamento publicado pelo ONS em ${mesAno(r.descricoes_ultimo_mes.mes)} (${num(r.descricoes_ultimo_mes.n_descricoes, 0)} descrições)`}
          colunas={COLUNAS_DESCRICOES}
          linhas={paraTabela(linhasDescricoes(r))}
          chaveLinha="id"
          colunaRotulo="descricao"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`geracao-restricao-detalhamento-${f}`}
          ordemInicial={{ coluna: "gwh", direcao: "desc" }}
          nota="Texto da descrição como o ONS publica; o observatório não o reclassifica."
        />
      )}
    </div>
  );
}

/** Razões com algum valor positivo no histórico da usina (as demais não viram série vazia). */
function razoesComValor(linhas: readonly LinhaUsinaMes[]): RazaoRestricao[] {
  return RAZOES.filter((z) => linhas.some((l) => (l[z] ?? 0) > 0));
}
