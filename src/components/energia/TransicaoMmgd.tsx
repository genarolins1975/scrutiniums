"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { MapaCoropletico } from "@/components/energia/MapaCoropletico";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { TransicaoOpcoes } from "@/components/energia/TransicaoOpcoes";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { quebrasFixas, quebrasQuantis, type ValorClassificavel } from "@/lib/energia/escalas";
import { dataBR } from "@/lib/energia/formato";
import { URL_GEO, type CamadaGeo } from "@/lib/energia/geo";
import { LIMITE_COMPARACAO, alternarSelecao } from "@/lib/energia/tabela";
import {
  DIMENSOES_PERFIL,
  ESQUEMA_MMGD,
  LISTAS_DESTAQUE,
  MEDIDAS_MUN,
  MEDIDAS_UF,
  MEDIDA_UF,
  medidasMun,
  medidasUf,
  rotulosDestaque,
  rotulosDimensao,
  codigoUf,
  colunasMunicipios,
  colunasUfs,
  contagem,
  dadosBarrasUf,
  dadosHistoricoUfs,
  historicoMunicipiosCsv,
  inteiro,
  linhasPerfil,
  mes,
  municipiosDoJson,
  numTexto,
  participacaoTexto,
  pctTexto,
  referenciaUf,
  rotuloMedidaUf,
  siglaDoCodigo,
  valorMunicipio,
  valoresMapaUf,
  type DimensaoPerfil,
  type LinhaDestaque,
  type LinhaMensal,
  type ListaDestaque,
  type LinhaUf,
  type MedidaMun,
  type MedidaUf,
  type MunicipioMmgd,
  type UfAnoCompacto,
} from "@/lib/energia/transicao";
import type { BlocoMmgd, MunicipiosMmgdArquivo } from "@/lib/energia/tipos-transicao";
import type { Idioma } from "@/lib/idioma";
import { tx } from "@/lib/energia/idioma";
import { Nome } from "@/components/i18n/Nome";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * P063, MMGD no território: o mapa por UF, as barras com a referência nacional, a
 * tabela e o histórico de conexões de até quatro UF leem a mesma lista de UF na
 * URL (mmgd.uf); a última escolhida é a que o mapa e a tabela destacam. A série
 * mensal tem o intervalo na URL (mmgd.de e mmgd.ate); o perfil, a dimensão
 * (mmgd.perfil). O mapa municipal (malha de 1,3 MB e JSON de cerca de 600 KB) e o
 * histórico municipal (CSV de 2,3 MB) só são baixados quando alguém pede.
 *
 * Nenhum número é refeito aqui: as linhas vêm de src/lib/energia/transicao.ts.
 * Capacidade cadastrada (kW, MW) nunca aparece como energia.
 */

const CORES_MAPA = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];
const CORES_COMP = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)"];
function nomesMedidaUf(idioma: Idioma): Record<MedidaUf, string> {
  return {
    whab: tx("W por habitante", "W per inhabitant", idioma),
    mw: tx("MW instalados", "MW installed", idioma),
    umil: tx("Unidades por mil hab.", "Units per thousand inhab.", idioma),
    cresc: tx("Crescimento no ano", "Growth in the year", idioma),
    mwref: tx("MW conectados no ano", "MW connected in the year", idioma),
  };
}
function opcoesMun(idioma: Idioma): readonly (readonly [MedidaMun, string])[] {
  const m = medidasMun(idioma);
  return MEDIDAS_MUN.map((k) => [k, k === "fora" ? tx("Distribuidora sem conjunto na UF", "Utility with no consumer set in the state", idioma) : m[k].rotulo] as const);
}

// requisições sob demanda, compartilhadas pelas instâncias; falha não fica em cache
const cache = new Map<string, Promise<unknown>>();
function carregar<T>(url: string, tipo: "json" | "texto"): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (tipo === "json" ? r.json() : r.text()) as Promise<T>;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

function Falha({ erro, url, nome }: { erro: string; url: string; nome: string }) {
  const tx = useTx();
  return (
    <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
      {tx(`Não foi possível carregar ${nome} (${erro}). Os mesmos números estão em`, `Could not load ${nome} (${erro}). The same figures are in`)}{" "}
      <a href={url} download className="text-energia-dark underline underline-offset-4">
        {url.split("/").at(-1)}
      </a>
      .
    </p>
  );
}

/* ================================================================ por UF */

export function TransicaoMmgdUf({
  linhas,
  ufAnual,
  anoReferencia,
  anoPopulacao,
  primeiroCoberto,
  wPorHabitanteBrasil,
  dataCadastro,
  fonte,
}: {
  linhas: LinhaUf[];
  ufAnual: UfAnoCompacto[];
  anoReferencia: number;
  anoPopulacao: number | null;
  primeiroCoberto: number;
  wPorHabitanteBrasil: number | null;
  dataCadastro: string;
  fonte: string;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const [v, definir] = useEstadoUrl(ESQUEMA_MMGD);
  const [aviso, setAviso] = useState("");
  const medida = medidasUf(idioma)[v.med];
  const rotuloMed = rotuloMedidaUf(v.med, anoReferencia, idioma);
  const escolhidas = useMemo(() => v.ufs.filter((u) => linhas.some((l) => l.uf === u)), [v.ufs, linhas]);
  const ultima = escolhidas.at(-1) ?? null;
  const valores = useMemo(() => valoresMapaUf(linhas, v.med), [linhas, v.med]);
  const classes = useMemo(() => quebrasQuantis(Object.values(valores), 5, { casas: medida.casas }), [valores, medida.casas]);
  const barras = useMemo(() => dadosBarrasUf(linhas, v.med), [linhas, v.med]);
  const referencias = referenciaUf(wPorHabitanteBrasil, v.med, idioma);
  const historico = useMemo(() => dadosHistoricoUfs(ufAnual, escolhidas, primeiroCoberto), [ufAnual, escolhidas, primeiroCoberto]);
  const entidades = useMemo(() => linhas.map((l) => ({ id: l.uf, rotulo: `${l.nome} (${l.uf})`, sinonimos: [l.uf] })), [linhas]);
  const colunas = useMemo(() => colunasUfs(anoReferencia, anoPopulacao, idioma), [anoReferencia, anoPopulacao, idioma]);
  const nomesMedida = nomesMedidaUf(idioma);
  const opcoes = MEDIDAS_UF.map((m) => [m, nomesMedida[m]] as const);

  const alternar = (uf: string | null) => {
    if (!uf) {
      if (ultima) definir({ ufs: escolhidas.filter((x) => x !== ultima) });
      return;
    }
    const r = alternarSelecao(escolhidas, uf, LIMITE_COMPARACAO);
    if (r.motivo === "limite") {
      setAviso(tx(`Limite de ${LIMITE_COMPARACAO} UF na comparação: remova uma para incluir ${uf}.`, `Limit of ${LIMITE_COMPARACAO} states in the comparison: remove one to include ${uf}.`));
      return;
    }
    setAviso("");
    definir({ ufs: r.ids });
  };

  return (
    <div className="space-y-6">
      <TransicaoOpcoes rotulo={tx("Medida do mapa e das barras", "Measure of the map and bars")} nome="transicao-mmgd-med" opcoes={opcoes} valor={v.med} onMudar={(med) => definir({ med })} />
      <MapaCoropletico
        titulo={tx(`${rotuloMed} por UF, cadastro de ${dataBR(dataCadastro, idioma)}`, `${rotuloMed} by state, register of ${dataBR(dataCadastro, idioma)}`)}
        fonteGeometria={URL_GEO.uf}
        valores={valores}
        cores={CORES_MAPA}
        classificacao={classes}
        unidade={medida.unidade}
        casas={medida.casas}
        rotuloRegiao={tx({ singular: "UF", plural: "UF" }, { singular: "state", plural: "states" })}
        selecionado={ultima ? codigoUf(ultima) : null}
        onSelecionar={(id) => alternar(siglaDoCodigo(id))}
        rotulos
        nota={tx(
          "Classes por quantis (cinco grupos com o mesmo número de UF). Capacidade cadastrada, não energia gerada. Clique numa UF para incluí-la na comparação (até quatro); clicar de novo a retira.",
          "Classes by quantiles (five groups with the same number of states). Registered capacity, not energy generated. Click a state to include it in the comparison (up to four); clicking again removes it.",
        )}
      />
      {aviso && (
        <p role="status" className="text-sm text-carvao">
          {aviso}
        </p>
      )}
      <GraficoBarras
        titulo={tx(`${rotuloMed} por UF, em ordem decrescente`, `${rotuloMed} by state, in descending order`)}
        dados={barras}
        chaveCategoria="id"
        chaveRotulo="nome"
        rotulosSaoNomes
        series={[{ id: "valor", rotulo: rotuloMed, cor: "var(--serie-solar)" }]} // i18n: dado
        unidade={medida.unidade}
        casas={medida.casas}
        orientacao="horizontal"
        referencias={referencias}
        selecionado={ultima}
        onSelecionar={(id) => alternar(id)}
        alturaMaxima={520}
      />
      {referencias.length === 0 && (
        <p className="max-w-prose2 text-sm text-carvao-muted">
          {tx(
            "Referência nacional só na potência por habitante, a única medida desta lista com valor do Brasil publicado pelo pipeline; nas demais, compare as UF entre si.",
            "National reference only for capacity per inhabitant, the only measure in this list with a value for Brazil published by the pipeline; for the others, compare the states with each other.",
          )}
        </p>
      )}
      <TabelaInterativa
        titulo={tx(`MMGD por UF, cadastro de ${dataBR(dataCadastro, idioma)}`, `MMGD by state, register of ${dataBR(dataCadastro, idioma)}`)}
        colunas={colunas}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="nome"
        fonte={fonte}
        versao={dataCadastro}
        nomeArquivo="transicao-mmgd-uf"
        chaveUrl="mmgd.tab"
        ordemInicial={{ coluna: MEDIDA_UF[v.med].campo, direcao: "desc" }}
        selecionado={ultima}
        onSelecionar={(id) => alternar(id)}
        dicaBusca={tx("Nome ou sigla da UF", "State name or code")}
        nota={tx(
          `Por habitante: população estimada pelo IBGE${anoPopulacao ? ` para ${anoPopulacao}` : ""}. Crescimento do estoque: potência conectada em ${anoReferencia} sobre o estoque do fim de ${anoReferencia - 1}.`,
          `Per inhabitant: population estimated by the IBGE${anoPopulacao ? ` for ${anoPopulacao}` : ""}. Growth of the stock: capacity connected in ${anoReferencia} over the stock at the end of ${anoReferencia - 1}.`,
        )}
      />
      <div className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">{tx("Como as UF escolhidas acrescentaram potência ano a ano?", "How did the chosen states add capacity year by year?")}</h3>
        <Comparador
          rotulo={tx("UF no histórico (até 4)", "States in the history (up to 4)")}
          entidades={entidades}
          selecionadas={escolhidas}
          onMudar={(ids) => definir({ ufs: ids })}
          dicaBusca={tx("Nome ou sigla da UF", "State name or code")}
          vazio={tx(
            "Nenhuma UF escolhida. Escolha aqui, no mapa, nas barras ou na tabela para ver as conexões por ano na mesma escala.",
            "No state chosen. Choose here, on the map, in the bars or in the table to see the connections by year on the same scale.",
          )}
        >
          {() => null}
        </Comparador>
        {historico.length > 0 && (
          <GraficoLinhas
            titulo={tx(`Potência conectada por ano: ${escolhidas.join(", ")} (o último ano é parcial)`, `Capacity connected by year: ${escolhidas.join(", ")} (the last year is partial)`)}
            dados={historico}
            chaveX="ano" // i18n: dado
            formatoX="texto"
            series={escolhidas.map((uf, i) => ({ id: uf, rotulo: uf, sigla: uf, cor: CORES_COMP[i % CORES_COMP.length] }))}
            unidade="MW"
            casas={1}
            zeroNoEixo
            altura={280}
          />
        )}
        {historico.length > 0 && (
          <p className="max-w-prose2 text-sm text-carvao-muted">
            {tx(
              `Ano anterior à primeira conexão da UF, dentro da cobertura declarada pela ANEEL (a partir de ${primeiroCoberto}), vale zero: o cadastro é completo e não tem conexão ali. Antes dessa data, sem registro é lacuna. O último ano vai só até a data do cadastro e não compete com os anos completos.`,
              `A year before the state's first connection, within the coverage declared by ANEEL (from ${primeiroCoberto}), is zero: the register is complete and has no connection there. Before that date, no record is a gap. The last year only runs through the register date and does not compete with the full years.`,
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/* ================================================================ série mensal */

export function TransicaoMmgdMensal({ dados, corte }: { dados: LinhaMensal[]; corte: string }) {
  const idioma = useIdioma();
  const tx = useTx();
  const [v, definir] = useEstadoUrl(ESQUEMA_MMGD);
  const intervalo = v.de && v.ate && v.de <= v.ate ? { inicio: v.de, fim: v.ate } : null;
  const onIntervalo = (i: { inicio: string; fim: string } | null) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" });
  return (
    <CursorSincronizado>
      <div className="space-y-5">
        <GraficoLinhas
          titulo={tx("Potência conectada por mês de conexão, Brasil", "Capacity connected by month of connection, Brazil")}
          dados={dados}
          chaveX="m"
          formatoX="mes"
          series={[
            { id: "consolidado", rotulo: tx("Conectada no mês", "Connected in the month"), sigla: tx("Consolidado", "Consolidated"), cor: "var(--serie-solar)" },
            {
              id: "provisorio",
              rotulo: tx(`Provisório (depois de ${mes(corte, idioma)})`, `Provisional (after ${mes(corte, idioma)})`),
              sigla: tx("Provisório", "Provisional"),
              cor: "var(--serie-referencia)",
              tracejada: true,
            },
          ]}
          unidade="MW"
          casas={1}
          zeroNoEixo
          zoom
          intervalo={intervalo}
          onIntervalo={onIntervalo}
          altura={280}
        />
        <GraficoLinhas
          titulo={tx("Estoque cadastrado ao fim de cada mês, Brasil", "Registered stock at the end of each month, Brazil")}
          dados={dados}
          chaveX="m"
          formatoX="mes"
          series={[{ id: "acumulado_mw", rotulo: tx("Estoque de potência instalada", "Stock of installed capacity"), sigla: tx("Estoque", "Stock"), cor: "var(--cor-energia)" }]} // i18n: dado
          unidade="MW"
          casas={0}
          zeroNoEixo
          zoom
          intervalo={intervalo}
          onIntervalo={onIntervalo}
          altura={220}
        />
      </div>
    </CursorSincronizado>
  );
}

/* ================================================================ perfil */

export function TransicaoMmgdPerfil({ perfis, anoReferencia }: { perfis: BlocoMmgd["perfis"]; anoReferencia: number }) {
  const idioma = useIdioma();
  const tx = useTx();
  const ROTULO_DIMENSAO = rotulosDimensao(idioma);
  const [v, definir] = useEstadoUrl(ESQUEMA_MMGD);
  const linhas = useMemo(() => linhasPerfil(perfis, v.perfil, idioma), [perfis, v.perfil, idioma]);
  const opcoes = DIMENSOES_PERFIL.map((d) => [d, ROTULO_DIMENSAO[d]] as const) as readonly (readonly [DimensaoPerfil, string])[];
  const titulo = tx(`${ROTULO_DIMENSAO[v.perfil]}: potência instalada cadastrada`, `${ROTULO_DIMENSAO[v.perfil]}: registered installed capacity`);
  return (
    <div className="space-y-4">
      <TransicaoOpcoes rotulo={tx("Dimensão", "Dimension")} nome="transicao-mmgd-perfil" opcoes={opcoes} valor={v.perfil} onMudar={(perfil) => definir({ perfil })} />
      <GraficoBarras
        titulo={titulo}
        dados={linhas}
        chaveCategoria="id"
        chaveRotulo="rotulo"
        series={[{ id: "potencia_mw", rotulo: tx("Potência instalada", "Installed capacity"), cor: "var(--serie-solar)" }]}
        unidade="MW"
        casas={1}
        orientacao="horizontal"
        rotulosValor
      />
      <div className="tabela-scroll" tabIndex={0} role="region" aria-label={tx(`${ROTULO_DIMENSAO[v.perfil]} (tabela rolável)`, `${ROTULO_DIMENSAO[v.perfil]} (scrollable table)`)}>
        <table className="w-full min-w-[34rem] border-collapse text-xs tabular-nums">
          <caption className="pb-2 text-left text-sm font-medium text-carvao">
            {tx(`${ROTULO_DIMENSAO[v.perfil]}: unidades, potência e participação`, `${ROTULO_DIMENSAO[v.perfil]}: units, capacity and share`)}
          </caption>
          <thead>
            <tr>
              {tx(
                ["Categoria", "Unidades", "Participação nas unidades", "Potência (MW)", `Unidades em ${anoReferencia}`, `Potência em ${anoReferencia} (MW)`],
                ["Category", "Units", "Share of units", "Capacity (MW)", `Units in ${anoReferencia}`, `Capacity in ${anoReferencia} (MW)`],
              ).map((c, i) => (
                <th key={c} scope="col" className={`border-b border-linha px-2 py-1.5 font-medium text-mineral ${i ? "text-right" : "text-left"}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id} className="border-b border-linha last:border-b-0">
                <th scope="row" className="px-2 py-1.5 text-left font-normal text-carvao">
                  {l.rotulo}
                  {l.rotulo !== l.id && (
                    <span data-nivel="analisar" className="ml-1 text-carvao-muted">
                      ({l.id})
                    </span>
                  )}
                </th>
                <td className="px-2 py-1.5 text-right text-carvao">{inteiro(l.unidades, idioma)}</td>
                <td className="px-2 py-1.5 text-right text-carvao">{participacaoTexto(l.participacao_unidades_pct, idioma)}</td>
                <td className="px-2 py-1.5 text-right text-carvao">
                  {numTexto(l.potencia_mw, 1, idioma)}
                  {l.unidades_sem_potencia > 0 && (
                    <span className="ml-1 text-carvao-muted">
                      {tx(`(parcial: ${inteiro(l.unidades_sem_potencia, idioma)} sem potência)`, `(partial: ${inteiro(l.unidades_sem_potencia, idioma)} without capacity)`)}
                    </span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right text-carvao">{inteiro(l.unidades_ano_referencia, idioma)}</td>
                <td className="px-2 py-1.5 text-right text-carvao">{numTexto(l.potencia_mw_ano_referencia, 1, idioma)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="max-w-prose2 text-sm text-carvao-muted">
        {tx(
          "Categorias como a ANEEL publica (o código original fica entre parênteses no modo Analisar, quando o rótulo foi acentuado). Participação abaixo de 0,01% com dois algarismos significativos, para que uma categoria pequena não apareça como zero.",
          "Categories as ANEEL publishes them (the original code is in parentheses in Analyze mode, when the label was translated). Shares below 0.01% with two significant digits, so that a small category does not appear as zero.",
        )}
      </p>
    </div>
  );
}

/* ================================================================ destaques municipais */

/**
 * Rankings municipais publicados na gold (população de pelo menos o mínimo da
 * gold e potência completa), um por vez, com a lista escolhida na URL (mmgd.rank).
 */
export function TransicaoDestaques({ listas, anoReferencia, populacaoMinima }: { listas: Record<ListaDestaque, LinhaDestaque[]>; anoReferencia: number; populacaoMinima: number }) {
  const idioma = useIdioma();
  const tx = useTx();
  const ROTULO_DESTAQUE = rotulosDestaque(idioma);
  const [v, definir] = useEstadoUrl(ESQUEMA_MMGD);
  const linhas = listas[v.rank] ?? [];
  const opcoes = LISTAS_DESTAQUE.map((k) => [k, ROTULO_DESTAQUE[k]] as const) as readonly (readonly [ListaDestaque, string])[];
  return (
    <div className="space-y-3">
      <TransicaoOpcoes rotulo={tx("Ranking", "Ranking")} nome="transicao-mmgd-rank" opcoes={opcoes} valor={v.rank} onMudar={(rank) => definir({ rank })} />
      <div className="tabela-scroll" tabIndex={0} role="region" aria-label={tx(`${ROTULO_DESTAQUE[v.rank]} (tabela rolável)`, `${ROTULO_DESTAQUE[v.rank]} (scrollable table)`)}>
        <table className="w-full min-w-[36rem] border-collapse text-xs tabular-nums">
          <caption className="pb-2 text-left text-sm font-medium text-carvao">
            {ROTULO_DESTAQUE[v.rank]}
            {v.rank === "maior_crescimento_estoque" ? ` (${anoReferencia})` : ""}
            {tx(`: municípios com pelo menos ${inteiro(populacaoMinima, idioma)} habitantes`, `: municipalities with at least ${inteiro(populacaoMinima, idioma)} inhabitants`)}
          </caption>
          <thead>
            <tr>
              {tx(
                ["Município", "Unidades", "Potência (kW)", "População", "W/hab", `Crescimento do estoque em ${anoReferencia}`, "Distribuidora sem conjunto na UF"],
                ["Municipality", "Units", "Capacity (kW)", "Population", "W/inhab.", `Growth of the stock in ${anoReferencia}`, "Utility with no consumer set in the state"],
              ).map((c, i) => (
                <th key={c} scope="col" className={`border-b border-linha px-2 py-1.5 font-medium text-mineral ${i ? "text-right" : "text-left"}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((x) => (
              <tr key={x.id} className="border-b border-linha last:border-b-0">
                <th scope="row" className="px-2 py-1.5 text-left font-normal text-carvao">
                  {x.posicao}. <Nome>{x.municipio}</Nome> ({x.uf})
                </th>
                <td className="px-2 py-1.5 text-right text-carvao">{inteiro(x.unidades, idioma)}</td>
                <td className="px-2 py-1.5 text-right text-carvao">{numTexto(x.potencia_kw, 0, idioma)}</td>
                <td className="px-2 py-1.5 text-right text-carvao">{inteiro(x.populacao, idioma)}</td>
                <td className="px-2 py-1.5 text-right text-carvao">{numTexto(x.w_por_habitante, 1, idioma)}</td>
                <td className="px-2 py-1.5 text-right text-carvao">{pctTexto(x.crescimento_estoque_pct, 1, idioma)}</td>
                <td className="px-2 py-1.5 text-right text-carvao">{inteiro(x.unidades_distribuidora_fora_da_uf, idioma)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================================ municípios */

/** Código e nome dos municípios para o comparador; o código IBGE é a chave, o nome só rótulo. */
function entidadesMunicipios(mun: readonly MunicipioMmgd[]) {
  return mun.map((m) => ({ id: m.id, rotulo: `${m.municipio} (${m.uf})`, detalhe: m.id, sinonimos: [m.id] }));
}

export function TransicaoMunicipios({
  jsonUrl,
  csvUrl,
  anoReferencia,
  anoPopulacao,
  anoFinal,
  primeiroCoberto,
  fonte,
  versao,
}: {
  jsonUrl: string;
  csvUrl: string;
  anoReferencia: number;
  anoPopulacao: number | null;
  anoFinal: number;
  primeiroCoberto: number;
  fonte: string;
  versao: string;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const [v, definir] = useEstadoUrl(ESQUEMA_MMGD);
  const [dados, setDados] = useState<{ geo: CamadaGeo; mun: MunicipioMmgd[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [erroCsv, setErroCsv] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  // o botão some quando o mapa abre: o foco vai para o bloco carregado, não se perde no corpo da página
  const [pediuMapa, setPediuMapa] = useState(false);
  const blocoMapa = useRef<HTMLDivElement>(null);
  // o link com municípios escolhidos abre o mapa: a seleção não fica escondida atrás do botão
  const ativo = v.mun || v.muns.length > 0;

  useEffect(() => {
    if (!ativo || dados) return;
    let vivo = true;
    setErro(null);
    Promise.all([carregar<CamadaGeo>(URL_GEO.municipios, "json"), carregar<MunicipiosMmgdArquivo>(jsonUrl, "json")]).then(
      ([geo, arq]) => vivo && setDados({ geo, mun: municipiosDoJson(arq, idioma) }),
      (e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [ativo, dados, jsonUrl, idioma]);

  useEffect(() => {
    if (!pediuMapa || !dados) return;
    blocoMapa.current?.focus();
    setPediuMapa(false);
  }, [pediuMapa, dados]);

  const escolhidos = useMemo(() => (dados ? v.muns.filter((id) => dados.mun.some((m) => m.id === id)) : v.muns), [dados, v.muns]);
  const ultimo = escolhidos.at(-1) ?? null;
  const precisaCsv = escolhidos.length > 0;

  useEffect(() => {
    if (!precisaCsv || csv) return;
    let vivo = true;
    setErroCsv(null);
    carregar<string>(csvUrl, "texto").then(
      (t) => vivo && setCsv(t),
      (e: unknown) => vivo && setErroCsv(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [precisaCsv, csv, csvUrl]);

  const montado = useMemo(() => {
    if (!dados) return null;
    const valores: Record<string, ValorClassificavel> = {};
    for (const m of dados.mun) valores[m.id] = valorMunicipio(m, v.mmed);
    const nums = Object.values(valores);
    const classes = v.mmed === "fora" ? quebrasFixas([1, 10, 50, 100], nums, { casas: 0 }) : quebrasQuantis(nums, 5, { casas: medidasMun(idioma)[v.mmed].casas });
    const comPoligono = new Set(dados.geo.features.map((f) => f.id));
    const semGeometria = dados.mun.filter((m) => !comPoligono.has(m.id)).length;
    return { valores, classes, semGeometria, entidades: entidadesMunicipios(dados.mun) };
  }, [dados, v.mmed, idioma]);

  const historico = useMemo(
    () => (csv && escolhidos.length ? historicoMunicipiosCsv(csv, escolhidos, anoFinal, primeiroCoberto) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a lista escolhida resume a dependência
    [csv, escolhidos.join(","), anoFinal, primeiroCoberto],
  );
  const nomeDe = (id: string) => dados?.mun.find((m) => m.id === id)?.municipio ?? id;

  const alternar = (id: string | null) => {
    if (!id) {
      if (ultimo) definir({ muns: escolhidos.filter((x) => x !== ultimo) });
      return;
    }
    const r = alternarSelecao(escolhidos, id, LIMITE_COMPARACAO);
    if (r.motivo === "limite") {
      setAviso(tx(`Limite de ${LIMITE_COMPARACAO} municípios na comparação: remova um para incluir outro.`, `Limit of ${LIMITE_COMPARACAO} municipalities in the comparison: remove one to include another.`));
      return;
    }
    setAviso("");
    definir({ muns: r.ids });
  };

  if (!ativo) {
    return (
      <div className="flex flex-wrap items-center gap-3 border border-dashed border-linha px-4 py-3">
        <p className="max-w-prose2 text-sm text-carvao-muted">
          {tx(
            "O mapa municipal usa a malha de municípios do IBGE e o JSON de municípios do módulo, os dois arquivos mais pesados da página; eles só são baixados quando pedidos.",
            "The municipal map uses the IBGE municipal boundaries and the module's municipalities JSON, the two heaviest files on the page; they are only downloaded when requested.",
          )}
        </p>
        <button
          type="button"
          onClick={() => {
            setPediuMapa(true);
            definir({ mun: true });
          }}
          className="rotulo inline-flex min-h-[44px] items-center border border-energia bg-superficie px-4 text-carvao hover:bg-energia-fundo"
        >
          {tx("Carregar o mapa por município", "Load the map by municipality")}
        </button>
      </div>
    );
  }
  if (erro) return <Falha erro={erro} url={jsonUrl} nome={tx("o mapa municipal", "the municipal map")} />;
  if (!dados || !montado) {
    return (
      <p role="status" className="text-sm text-carvao-muted">
        {tx("Carregando a malha municipal e o JSON de municípios…", "Loading the municipal boundaries and the municipalities JSON…")}
      </p>
    );
  }
  const med = medidasMun(idioma)[v.mmed];
  return (
    <div ref={blocoMapa} tabIndex={-1} aria-label={tx("Mapa, tabela e histórico por município", "Map, table and history by municipality")} className="space-y-5">
      <TransicaoOpcoes rotulo={tx("Medida do mapa municipal", "Measure of the municipal map")} nome="transicao-mmgd-mmed" opcoes={opcoesMun(idioma)} valor={v.mmed} onMudar={(mmed) => definir({ mmed })} />
      <MapaCoropletico
        titulo={tx(`${med.rotulo} por município${v.mmed === "cresc" ? ` (${anoReferencia})` : ""}`, `${med.rotulo} by municipality${v.mmed === "cresc" ? ` (${anoReferencia})` : ""}`)}
        geometria={dados.geo}
        valores={montado.valores}
        cores={CORES_MAPA}
        classificacao={montado.classes}
        unidade={med.unidade}
        casas={med.casas}
        rotuloRegiao={tx({ singular: "município", plural: "municípios" }, { singular: "municipality", plural: "municipalities" })}
        selecionado={ultimo}
        onSelecionar={alternar}
        contornos
        nota={tx(
          `${v.mmed === "fora" ? "Cortes fixos em 1, 10, 50 e 100 unidades; zero fica na primeira classe. Unidades cuja distribuidora (CNPJ) não tem conjunto elétrico na UF: algum campo está errado na origem, e nada é corrigido." : "Classes por quantis. O município é o da unidade geradora; no autoconsumo remoto e na geração compartilhada o crédito pode ser usado em outro município."}${montado.semGeometria ? ` ${contagem(montado.semGeometria, "município sem polígono na malha fica", "municípios sem polígono na malha ficam", idioma)} só na tabela.` : ""} Clique para incluir o município na comparação (até quatro).`,
          `${v.mmed === "fora" ? "Fixed cuts at 1, 10, 50 and 100 units; zero is in the first class. Units whose distribution utility (CNPJ) has no consumer set in the state: some field is wrong at the source, and nothing is corrected." : "Classes by quantiles. The municipality is the generating unit's; in remote self-consumption and shared generation the credit may be used in another municipality."}${montado.semGeometria ? ` ${contagem(montado.semGeometria, "municipality without a polygon in the boundaries stays", "municipalities without a polygon in the boundaries stay", idioma)} only in the table.` : ""} Click to include the municipality in the comparison (up to four).`,
        )}
      />
      {aviso && (
        <p role="status" className="text-sm text-carvao">
          {aviso}
        </p>
      )}
      <TabelaInterativa
        titulo={tx("MMGD por município", "MMGD by municipality")}
        colunas={colunasMunicipios(anoReferencia, anoPopulacao, idioma)}
        linhas={dados.mun}
        chaveLinha="id"
        colunaRotulo="municipio"
        fonte={fonte}
        versao={versao}
        nomeArquivo="transicao-mmgd-municipios"
        chaveUrl="mmgd.mtab"
        ordemInicial={{ coluna: "potencia_kw", direcao: "desc" }}
        selecionado={ultimo}
        onSelecionar={alternar}
        dicaBusca={tx("Nome do município ou código IBGE", "Municipality name or IBGE code")}
        nota={tx(
          "Município sem população estimada fica sem razão por habitante (nunca zero). A classe de provável município errado é a única que pode inflar a potência por habitante do município publicado.",
          "A municipality without an estimated population has no per-inhabitant ratio (never zero). The likely-wrong-municipality class is the only one that can inflate the published municipality's capacity per inhabitant.",
        )}
      />
      <div className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">{tx("Como os municípios escolhidos acrescentaram potência ano a ano?", "How did the chosen municipalities add capacity year by year?")}</h3>
        <Comparador
          rotulo={tx("Municípios no histórico (até 4)", "Municipalities in the history (up to 4)")}
          entidades={montado.entidades}
          selecionadas={escolhidos}
          onMudar={(ids) => definir({ muns: ids })}
          dicaBusca={tx("Nome do município ou código IBGE", "Municipality name or IBGE code")}
          vazio={tx("Nenhum município escolhido. Escolha aqui, no mapa ou na tabela.", "No municipality chosen. Choose here, on the map or in the table.")}
        >
          {() => null}
        </Comparador>
        {precisaCsv && !csv && !erroCsv && (
          <p role="status" className="text-sm text-carvao-muted">
            {tx("Carregando o histórico por município (CSV publicado, cerca de 2 MB)…", "Loading the history by municipality (published CSV, about 2 MB)…")}
          </p>
        )}
        {erroCsv && <Falha erro={erroCsv} url={csvUrl} nome={tx("o histórico por município", "the history by municipality")} />}
        {historico && historico.linhas.length > 0 && (
          <>
            <GraficoLinhas
              titulo={tx(
                `Potência conectada por ano, soma das fontes: ${escolhidos.map(nomeDe).join(", ")} (o último ano é parcial)`,
                `Capacity connected by year, sum of sources: ${escolhidos.map(nomeDe).join(", ")} (the last year is partial)`,
              )}
              dados={historico.linhas}
              chaveX="ano" // i18n: dado
              formatoX="texto"
              series={escolhidos.map((id, i) => ({ id, rotulo: nomeDe(id), cor: CORES_COMP[i % CORES_COMP.length] }))}
              unidade="kW"
              casas={0}
              zeroNoEixo
              altura={280}
            />
            <p className="max-w-prose2 text-sm text-carvao-muted">
              {tx(
                `Soma das fontes de cada município e ano, lida do CSV municipal por ano e fonte. Dentro da cobertura declarada pela ANEEL (a partir de ${primeiroCoberto}), ano sem conexão vale zero; antes dela, é lacuna.`,
                `Sum of the sources of each municipality and year, read from the municipal CSV by year and source. Within the coverage declared by ANEEL (from ${primeiroCoberto}), a year without connection is zero; before it, it is a gap.`,
              )}
              {historico.parciais > 0
                ? tx(
                    ` ${inteiro(historico.parciais, idioma)} unidades sem potência informada deixam o ano correspondente sem valor.`,
                    ` ${inteiro(historico.parciais, idioma)} units without reported capacity leave the corresponding year without a value.`,
                  )
                : ""}
              {historico.semData > 0
                ? tx(
                    ` ${inteiro(historico.semData, idioma)} unidades com data de conexão inválida no cadastro estão no total do município, mas fora dos anos.`,
                    ` ${inteiro(historico.semData, idioma)} units with an invalid connection date in the register are in the municipality's total, but outside the years.`,
                  )
                : ""}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
