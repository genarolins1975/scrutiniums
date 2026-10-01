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
  COLUNAS_CARTEIRA_UF,
  ESQUEMA_CARTEIRA,
  MEDIDAS_CARTEIRA,
  MEDIDA_CARTEIRA,
  NOME_UF,
  codigoUf,
  entidadesUf,
  inteiro,
  mwTexto,
  siglaDoCodigo,
  valoresMapaCarteira,
  type LinhaCarteiraUf,
} from "@/lib/energia/expansao";
import { URL_GEO } from "@/lib/energia/geo";

/**
 * P040, carteira por UF: o mapa (malha oficial do IBGE), a tabela equivalente e a
 * comparação de até quatro UF compartilham a UF selecionada e a medida pela URL
 * (car.uf, car.med, car.cmp), então o link copiado e o voltar do navegador trazem o
 * mesmo recorte.
 *
 * As medidas nunca se misturam: as três fases do SIGA em MW outorgado (a mesma medida
 * para as três, para que as etapas se comparem) e a carteira do RALIE em MW das unidades
 * em implantação. Usina multiestadual fica na UF principal (a potência não é dividida),
 * como diz a nota do mapa.
 */

const CORES = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];
const OPCOES = MEDIDAS_CARTEIRA.map((m) => [m, MEDIDA_CARTEIRA[m].rotulo] as const);
const SERIES_COMPARACAO = [
  { id: "nao_iniciada_mw", rotulo: "Outorgado, construção não iniciada (MW outorgado)", cor: "var(--serie-comp-3)" },
  { id: "construcao_mw", rotulo: "Em construção (MW outorgado)", cor: "var(--cor-energia)" },
  { id: "operacao_mw", rotulo: "Em operação (MW outorgado)", cor: "var(--cor-mineral)" },
];

export function ExpansaoCarteiraUf({ linhas, data, dataRalie, fonte, multiestaduais }: { linhas: LinhaCarteiraUf[]; data: string; dataRalie: string; fonte: string; multiestaduais: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_CARTEIRA);
  const med = MEDIDA_CARTEIRA[v.med];
  const valores = useMemo(() => valoresMapaCarteira(linhas, v.med), [linhas, v.med]);
  const classes = useMemo(() => quebrasQuantis(Object.values(valores), 5, { casas: 0 }), [valores]);
  const sel = linhas.find((l) => l.id === v.uf) ?? null;
  const selecionar = (uf: string | null) => definir({ uf: uf ?? "" });
  const escolhidas = v.cmp.filter((u) => linhas.some((l) => l.id === u));
  const comparadas = escolhidas.map((u) => linhas.find((l) => l.id === u)!).map((l) => ({ ...l, rotulo: `${l.nome} (${l.id})` }));
  const periodo = v.med === "ralie" ? `fotografia do RALIE de ${dataRalie}` : `SIGA de ${data}`;

  return (
    <div className="space-y-6">
      <ExpansaoOpcoes rotulo="Medida do mapa" nome="expansao-car-med" opcoes={OPCOES} valor={v.med} onMudar={(m) => definir({ med: m })} />
      <MapaCoropletico
        titulo={`${med.rotulo} por UF, ${periodo}`}
        fonteGeometria={URL_GEO.uf}
        valores={valores}
        cores={CORES}
        classificacao={classes}
        unidade={med.unidade}
        casas={1}
        rotuloRegiao={{ singular: "UF", plural: "UF" }}
        selecionado={codigoUf(v.uf)}
        onSelecionar={(id) => selecionar(siglaDoCodigo(id))}
        rotulos
        periodo={periodo}
        nota={`${med.fonte}. Usina multiestadual fica na UF principal (${multiestaduais}); zero é zero observado, não falta de dado.`}
      />
      {sel && (
        <p aria-live="polite" className="max-w-prose2 text-sm leading-relaxed text-carvao">
          <strong className="font-medium">{sel.nome}</strong>: {inteiro(sel.nao_iniciada_usinas)} usinas outorgadas sem obra ({mwTexto(sel.nao_iniciada_mw)}), {inteiro(sel.construcao_usinas)} em construção ({mwTexto(sel.construcao_mw)}) e{" "}
          {inteiro(sel.operacao_usinas)} em operação ({mwTexto(sel.operacao_mw)}), em MW outorgado no SIGA de {data}; no RALIE de {dataRalie}, {mwTexto(sel.ralie_mw)} em unidades em implantação.
        </p>
      )}
      <TabelaInterativa
        titulo={`Carteira e operação por UF (SIGA de ${data}; RALIE de ${dataRalie})`}
        colunas={COLUNAS_CARTEIRA_UF}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="nome"
        fonte={fonte}
        versao={data}
        nomeArquivo="expansao-carteira-uf"
        chaveUrl="car.tab"
        ordemInicial={{ coluna: "nao_iniciada_mw", direcao: "desc" }}
        selecionado={sel?.id ?? null}
        onSelecionar={selecionar}
        dicaBusca="Nome ou sigla da UF"
        nota="MW outorgado nas três fases do SIGA, para que as etapas se comparem; o RALIE mede a potência das unidades geradoras em implantação na fotografia. As duas colunas de carteira não se somam: são o mesmo conjunto de usinas visto por cadastros diferentes."
      />
      <div className="space-y-3">
        <Comparador
          rotulo="UF para comparar (até 4)"
          entidades={entidadesUf()}
          selecionadas={escolhidas}
          onMudar={(ids) => definir({ cmp: ids })}
          dicaBusca="Nome ou sigla da UF"
          vazio="Nenhuma UF escolhida. A comparação mostra as três fases do SIGA na mesma escala."
        >
          {() => null}
        </Comparador>
        {comparadas.length > 0 && (
          <GraficoBarras
            titulo={`Fases do SIGA nas UF escolhidas, ${data} (MW outorgado, mesma escala)`}
            dados={comparadas}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={SERIES_COMPARACAO}
            unidade="MW"
            casas={1}
            orientacao="horizontal"
            alturaCategoria={Math.max(56, 22 * SERIES_COMPARACAO.length)}
            selecionado={sel?.id ?? null}
            onSelecionar={selecionar}
          />
        )}
        {comparadas.length > 0 && (
          <p className="text-xs text-carvao-muted">
            Escala comum às UF escolhidas: {comparadas.map((c) => `${NOME_UF[c.id] ?? c.id}`).join(", ")}. A fase de operação costuma dominar a escala; a tabela acima traz os valores exatos de cada fase.
          </p>
        )}
      </div>
    </div>
  );
}
