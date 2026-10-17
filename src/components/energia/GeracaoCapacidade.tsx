"use client";

import { GeracaoAviso, GeracaoEscolha, GeracaoLista } from "@/components/energia/GeracaoControles";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Histograma } from "@/components/energia/Histograma";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { formatos } from "@/lib/energia/formato";
import {
  CATEGORIAS_CAPACIDADE,
  GRUPOS_ANEEL,
  MINIMO_PARA_DISTRIBUICAO,
  colunasExtremosFc,
  colunasSigaHistorico,
  curtoCategoria,
  histogramaFc,
  nomeGrupoAneel,
  linhasExtremosFc,
  linhasSigaHistorico,
  observacoesFc,
  paraTabela,
  type GrupoAneel,
} from "@/lib/energia/geracao";
import type { Capacidade, Capacidade12m, CategoriaCapacidade } from "@/lib/energia/tipos-geracao";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * P024, capacidade e utilização: as duas partes que mudam com o recorte do leitor, com o
 * recorte na URL. GeracaoCapacidadeDistribuicao mostra a distribuição por usina do fator de
 * capacidade dos 12 meses da categoria escolhida (?cat=) e as usinas nos extremos;
 * GeracaoCapacidadeAneel põe a capacidade da ANEEL ao lado da potência do ONS nas datas da
 * série histórica oficial, para o grupo escolhido (?ga=). O resto do painel é desenhado no
 * servidor. Nada aqui recalcula fator de capacidade: as classes, os quantis e as razões vêm da
 * gold.
 */
const ESQUEMA_DISTRIBUICAO = { cat: campo(tiposUrl.opcao(CATEGORIAS_CAPACIDADE), "eolica" as CategoriaCapacidade) };
const ESQUEMA_ANEEL = { ga: campo(tiposUrl.opcao(GRUPOS_ANEEL), "eolica" as GrupoAneel) };

export function GeracaoCapacidadeDistribuicao({ ultimos12m, fonte, versao, usinasNoRetrato }: { ultimos12m: NonNullable<Capacidade["ultimos_12m"]>; fonte: string; versao: string; usinasNoRetrato?: Record<string, number> }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_DISTRIBUICAO);
  const idioma = useIdioma();
  const tx = useTx();
  const { mesAno, num } = formatos(idioma);
  const CURTO_CATEGORIA = curtoCategoria(idioma);
  const comDistribuicao = ultimos12m.por_categoria.filter((x) => x.distribuicao_usinas && x.distribuicao_usinas.n > 0);
  const u: Capacidade12m | undefined = comDistribuicao.find((x) => x.categoria === v.cat) ?? comDistribuicao[0];
  if (!u) return <GeracaoAviso>{tx("Nenhuma categoria tem distribuição por usina publicada nos 12 meses.", "No category has a by-plant distribution published for the 12 months.")}</GeracaoAviso>;
  const h = histogramaFc(u);
  const n = u.distribuicao_usinas!.n;
  const pequena = n < MINIMO_PARA_DISTRIBUICAO;
  const periodo = tx(`${mesAno(ultimos12m.inicio)} a ${mesAno(ultimos12m.fim)}`, `${mesAno(ultimos12m.inicio)} to ${mesAno(ultimos12m.fim)}`);
  const nomeCat = CURTO_CATEGORIA[u.categoria];
  return (
    <div className="space-y-4" data-categoria={u.categoria}>
      <GeracaoLista
        rotulo={tx("Categoria", "Category")}
        opcoes={comDistribuicao.map((x) => ({
          id: x.categoria,
          rotulo: tx(`${CURTO_CATEGORIA[x.categoria]} (${num(x.distribuicao_usinas!.n, 0)} usinas e conjuntos)`, `${CURTO_CATEGORIA[x.categoria]} (${num(x.distribuicao_usinas!.n, 0)} plants and plant clusters)`),
        }))}
        valor={u.categoria}
        onEscolher={(x) => definir({ cat: x })}
      />
      {pequena ? (
        <>
          <p className="text-sm leading-relaxed text-carvao">
            {tx(
              <>
                {CURTO_CATEGORIA[u.categoria]}: fator de capacidade agregado de {num(u.fator_capacidade_pct, 1)}% nos 12 meses. Com só {num(n, 0)} {n === 1 ? "usina ou conjunto pareado" : "usinas e conjuntos pareados"}, a figura mostra o valor de
                cada um: com tão poucas observações não há distribuição nem quantis a descrever.
              </>,
              <>
                {CURTO_CATEGORIA[u.categoria]}: aggregate capacity factor of {num(u.fator_capacidade_pct, 1)}% over the 12 months. With only {num(n, 0)} matched {n === 1 ? "plant or plant cluster" : "plants and plant clusters"}, the chart shows the value of
                each one: with so few observations there is no distribution or quantiles to describe.
              </>,
            )}
          </p>
          <GraficoBarras
            titulo={tx(`Fator de capacidade de cada usina ou conjunto, ${nomeCat.toLowerCase()}, ${periodo}`, `Capacity factor of each plant or plant cluster, ${nomeCat.toLowerCase()}, ${periodo}`)}
            dados={observacoesFc(u, idioma).map((x) => ({ id: x.id, rotulo: x.nome, fc: x.fc_pct }))}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={[{ id: "fc", rotulo: tx("Fator de capacidade em 12 meses", "Capacity factor over 12 months"), cor: "var(--cor-energia)" }]} // i18n: dado
            unidade="%"
            casas={1}
            orientacao="horizontal"
            alturaCategoria={44}
            rotulosValor
            rotulosSaoNomes
          />
        </>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-carvao">
            {tx(
              <>
                {CURTO_CATEGORIA[u.categoria]}: fator de capacidade agregado de {num(u.fator_capacidade_pct, 1)}% nos 12 meses; entre as {num(n, 0)} usinas e conjuntos pareados, metade teve fator entre {num(u.distribuicao_usinas!.p25, 1)}% e{" "}
                {num(u.distribuicao_usinas!.p75, 1)}%.
                {u.histograma_10pp[10] > 0 ? ` ${num(u.histograma_10pp[10], 0)} com 100% ou mais ficam fora das classes (ver os controles).` : ""}
              </>,
              <>
                {CURTO_CATEGORIA[u.categoria]}: aggregate capacity factor of {num(u.fator_capacidade_pct, 1)}% over the 12 months; among the {num(n, 0)} matched plants and plant clusters, half had a factor between {num(u.distribuicao_usinas!.p25, 1)}% and{" "}
                {num(u.distribuicao_usinas!.p75, 1)}%.
                {u.histograma_10pp[10] > 0 ? ` ${num(u.histograma_10pp[10], 0)} with 100% or more are left out of the classes (see the checks).` : ""}
              </>,
            )}
          </p>
          {h ? (
            <Histograma
              titulo={tx(`Fator de capacidade das usinas e conjuntos, ${nomeCat.toLowerCase()}, ${periodo}`, `Capacity factor of the plants and plant clusters, ${nomeCat.toLowerCase()}, ${periodo}`)}
              dados={h}
              rotuloX={tx("Fator de capacidade em 12 meses", "Capacity factor over 12 months")}
              unidade="%"
              casas={1}
              contagem={tx({ singular: "usina ou conjunto", plural: "usinas e conjuntos" }, { singular: "plant or plant cluster", plural: "plants and plant clusters" })}
              periodo={periodo}
              marcadores={["mediana"]}
              valorAtual={{ valor: u.fator_capacidade_pct, rotulo: tx("Agregado da categoria", "Category aggregate") }}
              cor="var(--cor-energia-soft)"
              nota={tx(
                "Cada observação é uma usina (mesmo CEG) ou um conjunto com relacionamento vigente, pareados com a Capacidade Instalada do ONS. Classes de 10 pontos publicadas pelo observatório.",
                "Each observation is a plant (same CEG) or a plant cluster with a current relationship, matched with the ONS installed capacity dataset. 10-point classes published by the observatory.",
              )}
            />
          ) : (
            <GeracaoAviso>{tx("A distribuição desta categoria não foi publicada em classes.", "The distribution of this category was not published in classes.")}</GeracaoAviso>
          )}
        </>
      )}
      <p className="text-xs leading-relaxed text-carvao-muted" data-criterio-distribuicao="">
        {tx(
          <>
            Entram só as usinas e conjuntos pareados com a Capacidade Instalada do ONS nos 12 meses: {num(n, 0)} nesta categoria
            {usinasNoRetrato?.[u.categoria] ? `, de ${num(usinasNoRetrato[u.categoria], 0)} usinas no retrato de capacidade` : ""}. O que não tem os 12 meses pareados fica fora.
          </>,
          <>
            Only the plants and plant clusters matched with the ONS installed capacity dataset over the 12 months are included: {num(n, 0)} in this category
            {usinasNoRetrato?.[u.categoria] ? `, out of ${num(usinasNoRetrato[u.categoria], 0)} plants in the capacity snapshot` : ""}. Anything without the 12 months matched is left out.
          </>,
        )}
      </p>
      <TabelaInterativa
        titulo={tx(`Usinas e conjuntos com menor e maior fator de capacidade, ${nomeCat.toLowerCase()}`, `Plants and plant clusters with the lowest and highest capacity factor, ${nomeCat.toLowerCase()}`)}
        colunas={colunasExtremosFc(idioma)}
        linhas={paraTabela(linhasExtremosFc(u, idioma), idioma)}
        chaveLinha="id"
        colunaRotulo="nome"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`geracao-capacidade-extremos-${u.categoria}`}
        chaveUrl="fx"
        nota={tx(
          "Fator de capacidade baixo pode vir de entrada recente em operação, manutenção ou restrição: o painel não separa a causa. A série de cada usina está no arquivo por usina e mês.",
          "A low capacity factor may come from recent entry into operation, maintenance or restriction: the panel does not separate the cause. Each plant's series is in the by-plant, by-month file.",
        )}
      />
    </div>
  );
}

export function GeracaoCapacidadeAneel({ historico, fonte }: { historico: NonNullable<Capacidade["contexto"]["siga_historico"]>; fonte: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_ANEEL);
  const idioma = useIdioma();
  const tx = useTx();
  const { dataBR } = formatos(idioma);
  const NOME_GRUPO_ANEEL = nomeGrupoAneel(idioma);
  const g = v.ga;
  const linhas = linhasSigaHistorico(historico, g, idioma);
  return (
    <div className="space-y-4" data-grupo={g}>
      <GeracaoEscolha legenda={tx("Tipo de geração", "Generation type")} opcoes={GRUPOS_ANEEL.map((x) => ({ id: x, rotulo: NOME_GRUPO_ANEEL[x] }))} valor={g} onEscolher={(x) => definir({ ga: x })} />
      <GraficoLinhas
        titulo={tx(`${NOME_GRUPO_ANEEL[g]}: capacidade da ANEEL e potência das usinas do ONS na mesma data`, `${NOME_GRUPO_ANEEL[g]}: ANEEL capacity and the capacity of ONS plants on the same date`)}
        dados={linhas.map((l) => ({ m: l.m, aneel: l.aneel_mw, ons: l.ons_mw }))}
        chaveX="m"
        formatoX="mes"
        series={[
          { id: "aneel", rotulo: tx("ANEEL, potência em operação", "ANEEL, capacity in operation"), cor: "var(--serie-3)", espessura: 2.5 },
          { id: "ons", rotulo: tx("ONS, usinas despachadas", "ONS, dispatched plants"), cor: "var(--cor-energia)", tracejada: true }, // i18n: dado
        ]}
        unidade="MW"
        casas={0}
        zeroNoEixo
        altura={240}
      />
      <TabelaInterativa
        titulo={tx(`Tabela equivalente: ${NOME_GRUPO_ANEEL[g]}, ANEEL e ONS nas datas da série oficial`, `Equivalent table: ${NOME_GRUPO_ANEEL[g]}, ANEEL and ONS on the dates of the official series`)}
        colunas={colunasSigaHistorico(idioma).map((c) => (c.id === "mes" ? { ...c, id: "m", tipo: "data" as const } : c))}
        linhas={paraTabela(linhas, idioma)}
        chaveLinha="id"
        colunaRotulo="m"
        fonte={fonte}
        versao={historico.data_geracao_arquivo ?? historico.datas[historico.datas.length - 1] ?? ""}
        nomeArquivo={`geracao-capacidade-aneel-ons-${g}`}
        chaveUrl="ga"
        ordemInicial={{ coluna: "m", direcao: "desc" }}
        nota={tx(
          `A parcela ONS ÷ ANEEL mede quanto de um universo o outro cobre, não fator de capacidade. Série da ANEEL gerada em ${historico.data_geracao_arquivo ? dataBR(historico.data_geracao_arquivo) : "data não informada"}.`,
          `The ONS ÷ ANEEL share measures how much of one universe the other covers, not a capacity factor. ANEEL series generated on ${historico.data_geracao_arquivo ? dataBR(historico.data_geracao_arquivo) : "an unreported date"}.`,
        )}
      />
    </div>
  );
}
