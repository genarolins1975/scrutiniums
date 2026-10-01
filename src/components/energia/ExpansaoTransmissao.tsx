"use client";

import { useMemo } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { ExpansaoOpcoes } from "@/components/energia/ExpansaoOpcoes";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { MapaCoropletico } from "@/components/energia/MapaCoropletico";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { quebrasQuantis } from "@/lib/energia/escalas";
import {
  COLUNAS_GERACAO_REDE_UF,
  ESQUEMA_TRANSMISSAO,
  MEDIDAS_REDE,
  MEDIDA_REDE,
  codigoUf,
  entidadesUf,
  inteiro,
  kmTexto,
  mvaTexto,
  mwTexto,
  siglaDoCodigo,
  valoresMapaRede,
  type LinhaGeracaoRedeUf,
} from "@/lib/energia/expansao";
import { URL_GEO } from "@/lib/energia/geo";

/**
 * P042, geração e rede por UF lado a lado. O mapa, a tabela e a comparação de até
 * quatro UF compartilham a UF e a medida pela URL (tra.uf, tra.med, tra.cmp).
 *
 * Cada medida tem a sua unidade e o seu painel: MW de geração (RALIE), km de circuito e
 * MVA de transformação em obra (SIGET), km de traçado da rede da EPE. Nenhuma é somada
 * ou dividida por outra; a comparação entre UF desenha um painel por unidade, com escala
 * comum só dentro da mesma unidade.
 */

const CORES = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];
const OPCOES = MEDIDAS_REDE.map((m) => [m, MEDIDA_REDE[m].rotulo] as const);

export function ExpansaoGeracaoRedeUf({ linhas, datas, fonte }: { linhas: LinhaGeracaoRedeUf[]; datas: { ralie: string; siget: string; epe: string }; fonte: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_TRANSMISSAO);
  const med = MEDIDA_REDE[v.med];
  const valores = useMemo(() => valoresMapaRede(linhas, v.med), [linhas, v.med]);
  const classes = useMemo(() => quebrasQuantis(Object.values(valores), 5, { casas: 0 }), [valores]);
  const sel = linhas.find((l) => l.id === v.uf) ?? null;
  const selecionar = (uf: string | null) => definir({ uf: uf ?? "" });
  const escolhidas = v.cmp.filter((u) => linhas.some((l) => l.id === u));
  const comparadas = escolhidas.map((u) => linhas.find((l) => l.id === u)!).map((l) => ({ ...l, rotulo: `${l.nome} (${l.id})` }));
  const periodo = med.fonte.includes("RALIE") ? `RALIE de ${datas.ralie}` : med.fonte.includes("SIGET") ? `SIGET de ${datas.siget}` : `EPE, capturada em ${datas.epe}`;

  return (
    <div className="space-y-6">
      <ExpansaoOpcoes rotulo="Medida do mapa" nome="expansao-tra-med" opcoes={OPCOES} valor={v.med} onMudar={(m) => definir({ med: m })} />
      <MapaCoropletico
        titulo={`${med.rotulo} por UF, ${periodo}`}
        fonteGeometria={URL_GEO.uf}
        valores={valores}
        cores={CORES}
        classificacao={classes}
        unidade={med.unidade}
        casas={med.casas}
        rotuloRegiao={{ singular: "UF", plural: "UF" }}
        selecionado={codigoUf(v.uf)}
        onSelecionar={(id) => selecionar(siglaDoCodigo(id))}
        rotulos
        periodo={periodo}
        nota={`${med.fonte}. Linha interestadual entra em todas as UF que toca: a soma das UF supera o total nacional. Zero é zero observado.`}
      />
      {sel && (
        <p aria-live="polite" className="max-w-prose2 text-sm leading-relaxed text-carvao">
          <strong className="font-medium">{sel.nome}</strong>, lado a lado e sem soma: {mwTexto(sel.mw_impl)} de geração em implantação ({mwTexto(sel.mw_24m)} previstos para 24 meses);{" "}
          {kmTexto(sel.km_obra)} de linhas em obra que tocam a UF e {mvaTexto(sel.mva_obra, 0)} de transformação em obra, em {inteiro(sel.empreendimentos)} empreendimentos; rede da EPE com{" "}
          {kmTexto(sel.km_epe)} existentes e {kmTexto(sel.km_epe_plan)} planejados de traçado.
        </p>
      )}
      <TabelaInterativa
        titulo={`Geração e rede por UF, lado a lado (RALIE de ${datas.ralie}; SIGET de ${datas.siget}; EPE capturada em ${datas.epe})`}
        colunas={COLUNAS_GERACAO_REDE_UF}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="nome"
        fonte={fonte}
        versao={datas.siget}
        nomeArquivo="expansao-geracao-e-rede-uf"
        chaveUrl="tra.tab"
        ordemInicial={{ coluna: "mw_impl", direcao: "desc" }}
        selecionado={sel?.id ?? null}
        onSelecionar={selecionar}
        dicaBusca="Nome ou sigla da UF"
        nota="Grandezas diferentes em colunas próprias, nunca somadas nem divididas: MW é potência de geração, km de circuito conta cada circuito de linha dupla, km de traçado da EPE mede a geometria, MVA é transformação."
      />
      <div className="space-y-3">
        <Comparador
          rotulo="UF para comparar (até 4)"
          entidades={entidadesUf()}
          selecionadas={escolhidas}
          onMudar={(ids) => definir({ cmp: ids })}
          dicaBusca="Nome ou sigla da UF"
          vazio="Nenhuma UF escolhida. A comparação desenha um painel por grandeza (MW, km de circuito, MVA e km de traçado), cada um com a sua escala."
        >
          {() => null}
        </Comparador>
        {comparadas.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-2">
            <GraficoBarras
              titulo="Geração em implantação (MW)"
              dados={comparadas}
              chaveCategoria="id"
              chaveRotulo="rotulo"
              series={[
                { id: "mw_impl", rotulo: "Em implantação", cor: "var(--cor-energia)" },
                { id: "mw_24m", rotulo: "Prevista em 24 meses", cor: "var(--escala-seq-2)" },
              ]}
              unidade="MW"
              casas={1}
              orientacao="horizontal"
              alturaCategoria={56}
              selecionado={sel?.id ?? null}
              onSelecionar={selecionar}
            />
            <GraficoBarras
              titulo="Linhas em obra que tocam a UF (km de circuito, SIGET)"
              dados={comparadas}
              chaveCategoria="id"
              chaveRotulo="rotulo"
              series={[{ id: "km_obra", rotulo: "Em obra", cor: "var(--serie-comp-3)" }]}
              unidade="km"
              casas={1}
              orientacao="horizontal"
              alturaCategoria={44}
              selecionado={sel?.id ?? null}
              onSelecionar={selecionar}
            />
            <GraficoBarras
              titulo="Transformação em obra (MVA)"
              dados={comparadas}
              chaveCategoria="id"
              chaveRotulo="rotulo"
              series={[{ id: "mva_obra", rotulo: "Em obra", cor: "var(--serie-comp-2)" }]}
              unidade="MVA"
              casas={0}
              orientacao="horizontal"
              alturaCategoria={44}
              selecionado={sel?.id ?? null}
              onSelecionar={selecionar}
            />
            <GraficoBarras
              titulo="Rede da EPE dentro da UF (km de traçado)"
              dados={comparadas}
              chaveCategoria="id"
              chaveRotulo="rotulo"
              series={[
                { id: "km_epe", rotulo: "Existente", cor: "var(--cor-mineral)" },
                { id: "km_epe_plan", rotulo: "Planejada", cor: "var(--escala-seq-3)" },
              ]}
              unidade="km"
              casas={1}
              orientacao="horizontal"
              alturaCategoria={56}
              selecionado={sel?.id ?? null}
              onSelecionar={selecionar}
            />
          </div>
        )}
        {comparadas.length > 0 && (
          <p className="text-xs text-carvao-muted">
            Um painel por grandeza; dentro de cada painel, a mesma escala para as UF escolhidas. km de circuito (SIGET) e km de traçado (EPE) ficam em painéis separados porque medem coisas
            diferentes e não se somam.
          </p>
        )}
      </div>
    </div>
  );
}
