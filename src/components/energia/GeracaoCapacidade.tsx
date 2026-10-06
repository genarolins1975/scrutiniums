"use client";

import { GeracaoAviso, GeracaoEscolha, GeracaoLista } from "@/components/energia/GeracaoControles";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Histograma } from "@/components/energia/Histograma";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, mesAno, num } from "@/lib/energia/formato";
import {
  CATEGORIAS_CAPACIDADE,
  COLUNAS_EXTREMOS_FC,
  COLUNAS_SIGA_HISTORICO,
  CURTO_CATEGORIA,
  GRUPOS_ANEEL,
  NOME_GRUPO_ANEEL,
  histogramaFc,
  linhasExtremosFc,
  linhasSigaHistorico,
  paraTabela,
  type GrupoAneel,
} from "@/lib/energia/geracao";
import type { Capacidade, Capacidade12m, CategoriaCapacidade } from "@/lib/energia/tipos-geracao";

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

export function GeracaoCapacidadeDistribuicao({ ultimos12m, fonte, versao }: { ultimos12m: NonNullable<Capacidade["ultimos_12m"]>; fonte: string; versao: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_DISTRIBUICAO);
  const comDistribuicao = ultimos12m.por_categoria.filter((x) => x.distribuicao_usinas && x.distribuicao_usinas.n > 0);
  const u: Capacidade12m | undefined = comDistribuicao.find((x) => x.categoria === v.cat) ?? comDistribuicao[0];
  if (!u) return <GeracaoAviso>Nenhuma categoria tem distribuição por usina publicada nos 12 meses.</GeracaoAviso>;
  const h = histogramaFc(u);
  const periodo = `${mesAno(ultimos12m.inicio)} a ${mesAno(ultimos12m.fim)}`;
  return (
    <div className="space-y-4" data-categoria={u.categoria}>
      <GeracaoLista
        rotulo="Categoria"
        opcoes={comDistribuicao.map((x) => ({ id: x.categoria, rotulo: `${CURTO_CATEGORIA[x.categoria]} (${num(x.distribuicao_usinas!.n, 0)} grupos)` }))}
        valor={u.categoria}
        onEscolher={(x) => definir({ cat: x })}
      />
      <p className="text-sm leading-relaxed text-carvao">
        {CURTO_CATEGORIA[u.categoria]}: fator de capacidade agregado de {num(u.fator_capacidade_pct, 1)}% nos 12 meses; entre as {num(u.distribuicao_usinas!.n, 0)} usinas e conjuntos
        pareados, a mediana foi {num(u.distribuicao_usinas!.p50, 1)}%, com metade entre {num(u.distribuicao_usinas!.p25, 1)}% e {num(u.distribuicao_usinas!.p75, 1)}%.
        {u.histograma_10pp[10] > 0 ? ` ${num(u.histograma_10pp[10], 0)} com 100% ou mais ficam fora das classes (ver os controles).` : ""}
      </p>
      {h ? (
        <Histograma
          titulo={`Fator de capacidade das usinas e conjuntos, ${CURTO_CATEGORIA[u.categoria].toLowerCase()}, ${periodo}`}
          dados={h}
          rotuloX="Fator de capacidade em 12 meses"
          unidade="%"
          casas={1}
          contagem={{ singular: "usina ou conjunto", plural: "usinas e conjuntos" }}
          periodo={periodo}
          valorAtual={{ valor: u.fator_capacidade_pct, rotulo: "Agregado da categoria" }}
          cor="var(--cor-energia-soft)"
          nota="Cada observação é um grupo de pareamento (usina com o mesmo CEG ou conjunto com relacionamento vigente). Classes de 10 pontos publicadas pela gold."
        />
      ) : (
        <GeracaoAviso>A distribuição desta categoria não foi publicada em classes.</GeracaoAviso>
      )}
      <TabelaInterativa
        titulo={`Usinas e conjuntos com menor e maior fator de capacidade, ${CURTO_CATEGORIA[u.categoria].toLowerCase()}`}
        colunas={COLUNAS_EXTREMOS_FC}
        linhas={paraTabela(linhasExtremosFc(u))}
        chaveLinha="id"
        colunaRotulo="nome"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`geracao-capacidade-extremos-${u.categoria}`}
        chaveUrl="fx"
        nota="Fator de capacidade baixo pode vir de entrada recente em operação, manutenção ou restrição: o painel não separa a causa. A série de cada usina está no arquivo por usina e mês."
      />
    </div>
  );
}

export function GeracaoCapacidadeAneel({ historico, fonte }: { historico: NonNullable<Capacidade["contexto"]["siga_historico"]>; fonte: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_ANEEL);
  const g = v.ga;
  const linhas = linhasSigaHistorico(historico, g);
  return (
    <div className="space-y-4" data-grupo={g}>
      <GeracaoEscolha legenda="Tipo de geração" opcoes={GRUPOS_ANEEL.map((x) => ({ id: x, rotulo: NOME_GRUPO_ANEEL[x] }))} valor={g} onEscolher={(x) => definir({ ga: x })} />
      <GraficoLinhas
        titulo={`${NOME_GRUPO_ANEEL[g]}: capacidade da ANEEL e potência das usinas do ONS na mesma data`}
        dados={linhas.map((l) => ({ m: l.m, aneel: l.aneel_mw, ons: l.ons_mw }))}
        chaveX="m"
        formatoX="mes"
        series={[
          { id: "aneel", rotulo: "ANEEL, potência em operação", cor: "var(--serie-3)", espessura: 2.5 },
          { id: "ons", rotulo: "ONS, usinas despachadas", cor: "var(--cor-energia)", tracejada: true },
        ]}
        unidade="MW"
        casas={0}
        zeroNoEixo
        altura={240}
      />
      <TabelaInterativa
        titulo={`Tabela equivalente: ${NOME_GRUPO_ANEEL[g]}, ANEEL e ONS nas datas da série oficial`}
        colunas={COLUNAS_SIGA_HISTORICO.map((c) => (c.id === "mes" ? { ...c, id: "m", tipo: "data" as const } : c))}
        linhas={paraTabela(linhas)}
        chaveLinha="id"
        colunaRotulo="m"
        fonte={fonte}
        versao={historico.data_geracao_arquivo ?? historico.datas[historico.datas.length - 1] ?? ""}
        nomeArquivo={`geracao-capacidade-aneel-ons-${g}`}
        chaveUrl="ga"
        ordemInicial={{ coluna: "m", direcao: "desc" }}
        nota={`A parcela ONS ÷ ANEEL mede quanto de um universo o outro cobre, não fator de capacidade. Série da ANEEL gerada em ${historico.data_geracao_arquivo ? dataBR(historico.data_geracao_arquivo) : "data não informada"}.`}
      />
    </div>
  );
}
