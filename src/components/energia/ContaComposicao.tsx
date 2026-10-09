"use client";

import { useMemo } from "react";
import { ContaEscolha, type OpcaoConta } from "@/components/energia/ContaControles";
import { ContaSobDemanda } from "@/components/energia/ContaSobDemanda";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, num, pct, reais } from "@/lib/energia/formato";
import {
  CAMPO_DIST,
  COR_GRUPO,
  ID_MEDIA,
  ORDEM_GRUPOS,
  colunasComposicao,
  destacar,
  idsComposicaoPadrao,
  linhasComposicao,
  linhasComposicaoGrafico,
  linhasGrupos,
  remover,
  rotuloDistribuidora,
} from "@/lib/energia/conta";
import type { Composicao, TarifaVigente } from "@/lib/energia/tipos-conta";

/**
 * P048, "Para onde vai o valor da conta?": a tarifa B1 decomposta nos grupos de
 * componentes oficiais da ANEEL (classificação do observatório pelo código), em
 * barras empilhadas que somam TE + TUSD. Itens negativos (créditos lançados em
 * componente de custo e devoluções) ficam do outro lado do zero: a pilha positiva
 * passa do total e a negativa traz de volta, sem dupla contagem (os totais TE e
 * TUSD do conjunto não entram nos grupos).
 *
 * O gráfico compara a composição média com até quatro distribuidoras: as escolhidas
 * em ?dist= (as mesmas do ranking da P047) ou, sem escolha, a de referência e as de
 * menor e maior tarifa. Oitenta pilhas de sete partes não se leem de relance; a
 * tabela completa, ordenável por qualquer grupo e exportável, abre sob demanda.
 * Unidade (R$/MWh ou % da tarifa) na URL.
 */

const ESQUEMA = {
  dist: CAMPO_DIST,
  unidade: campo(tiposUrl.opcao(["rs", "pct"] as const), "rs", {
    param: "cunid",
  }),
};

const OPCOES_UNIDADE: OpcaoConta<"rs" | "pct">[] = [
  { id: "rs", rotulo: "R$/MWh" },
  { id: "pct", rotulo: "% da tarifa" },
];

export type ContaComposicaoProps = {
  composicao: Pick<Composicao, "grupos" | "distribuidoras" | "media" | "mediana" | "cde" | "creditos">;
  vigentes: Pick<TarifaVigente, "cnpj" | "posicao">[];
  referencia: string | null;
  dataReferencia: string;
  fonte: string;
};

export function ContaComposicao({ composicao, vigentes, referencia, dataReferencia, fonte }: ContaComposicaoProps) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const comp = composicao as Composicao;
  const comComposicao = useMemo(() => new Set(comp.distribuidoras.map((d) => d.cnpj)), [comp.distribuidoras]);
  const escolhidas = v.dist.filter((id) => comComposicao.has(id));
  const ids = escolhidas.length ? escolhidas : idsComposicaoPadrao(comp, vigentes, referencia);
  const chaveIds = ids.join(",");
  const emPct = v.unidade === "pct";
  const unidade = emPct ? "%" : "R$/MWh";
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a chave resume a lista de ids
  const grafico = useMemo(() => linhasComposicaoGrafico(comp, vigentes, v.unidade, ids), [comp, vigentes, v.unidade, chaveIds]);
  const rotulo = useMemo(() => new Map(comp.grupos.map((g) => [g.id, g.rotulo])), [comp.grupos]);
  const series = ORDEM_GRUPOS.map((g) => ({
    id: g,
    rotulo: rotulo.get(g) ?? g,
    cor: COR_GRUPO[g],
  }));
  const destaque = escolhidas[0] ?? null;
  const pedida = v.dist[0] ?? null;
  const dDestaque = destaque ? (comp.distribuidoras.find((d) => d.cnpj === destaque) ?? null) : null;
  const grupos = useMemo(() => linhasGrupos(comp, destaque), [comp, destaque]);
  const nomeDestaque = dDestaque ? rotuloDistribuidora(dDestaque.sigla, dDestaque.cnpj) : null;
  const selecionar = (id: string | null) => {
    if (id === ID_MEDIA) return;
    if (id) definir({ dist: destacar(v.dist, id) });
    else if (destaque) definir({ dist: remover(v.dist, destaque) });
  };

  return (
    <div className="space-y-5">
      <ContaEscolha legenda="Unidade da composição" opcoes={OPCOES_UNIDADE} valor={v.unidade} onEscolher={(u) => definir({ unidade: u })} />

      <p className="text-sm text-carvao-muted">
        {escolhidas.length
          ? "Distribuidoras escolhidas no ranking, no histórico ou na tabela completa (até quatro), ao lado da composição média."
          : "Sem distribuidora escolhida: a de referência (tarifa mais próxima da mediana) e as de menor e maior tarifa, ao lado da composição média. Escolha outras no ranking ou na tabela completa."}
      </p>

      <GraficoBarras
        titulo={`Composição da tarifa B1 residencial, ${emPct ? "em % de TE + TUSD" : "em R$/MWh"}: média das distribuidoras e ${escolhidas.length ? "distribuidoras escolhidas" : "três distribuidoras de referência"} (as partes somam a tarifa)`}
        dados={grafico}
        chaveCategoria="id"
        chaveRotulo="sigla"
        series={series}
        empilhado
        unidade={unidade}
        casas={emPct ? 1 : 2}
        orientacao="horizontal"
        selecionado={destaque}
        onSelecionar={selecionar}
        alturaCategoria={56}
      />

      {pedida && !destaque && (
        <p role="status" className="text-sm text-carvao-muted">
          A distribuidora escolhida não tem composição publicada para a vigência de {dataBR(dataReferencia)} (sem tarifa vigente ou sem componentes no conjunto).
        </p>
      )}

      <div>
        <h3 className="font-serif text-lg text-carvao">Decomposição: média, mediana e {nomeDestaque ?? "distribuidora em destaque"}</h3>
        <div className="tabela-scroll mt-2" tabIndex={0} role="region" aria-label="Tabela de decomposição da tarifa B1">
          <table className="w-full min-w-[640px] border-collapse text-sm tabular-nums">
            <caption className="sr-only">Grupos de componentes: média simples das distribuidoras, participação, mediana e a distribuidora em destaque</caption>
            <thead>
              <tr className="border-b border-linha text-left text-xs text-mineral">
                <th scope="col" className="py-2 pr-3 font-normal">
                  Grupo
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">
                  Média (R$/MWh)
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">
                  Participação média
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">
                  Mediana (R$/MWh, não soma)
                </th>
                {dDestaque && (
                  <>
                    <th scope="col" className="py-2 pr-3 text-right font-normal">
                      {nomeDestaque ? `${nomeDestaque} (R$/MWh)` : "Destaque (R$/MWh)"}
                    </th>
                    <th scope="col" className="py-2 text-right font-normal">
                      {nomeDestaque ? `${nomeDestaque} (%)` : "Destaque (%)"}
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.id} className="border-b border-linha">
                  <th scope="row" className="py-2 pr-3 text-left font-normal text-carvao">
                    <span aria-hidden="true" className="mr-2 inline-block h-2.5 w-2.5 align-middle" style={{ background: COR_GRUPO[g.id] }} />
                    {g.grupo}
                  </th>
                  <td className="py-2 pr-3 text-right">{num(g.media_rs, 2)}</td>
                  <td className="py-2 pr-3 text-right">{pct(g.media_pct, 1)}</td>
                  <td className="py-2 pr-3 text-right text-carvao-muted">{num(g.mediana_rs, 2)}</td>
                  {dDestaque && (
                    <>
                      <td className="py-2 pr-3 text-right">{num(g.dist_rs, 2)}</td>
                      <td className="py-2 text-right">{pct(g.dist_pct, 1)}</td>
                    </>
                  )}
                </tr>
              ))}
              <tr className="border-b border-linha font-medium">
                <th scope="row" className="py-2 pr-3 text-left text-carvao">
                  Tarifa (TE + TUSD)
                </th>
                <td className="py-2 pr-3 text-right">{num(comp.media?.total_rs_mwh, 2)}</td>
                <td className="py-2 pr-3 text-right">{comp.media ? pct(100, 1) : "sem dado"}</td>
                <td className="py-2 pr-3 text-right text-carvao-muted">
                  {num(comp.mediana.mediana_do_total_rs_mwh, 2)} (soma das medianas: {num(comp.mediana.soma_das_medianas_rs_mwh, 2)})
                </td>
                {dDestaque && (
                  <>
                    <td className="py-2 pr-3 text-right">{num(dDestaque.total, 2)}</td>
                    <td className="py-2 text-right">{pct(100, 1)}</td>
                  </>
                )}
              </tr>
              <tr>
                <th scope="row" className="py-2 pr-3 text-left font-normal text-carvao-muted">
                  Dos encargos: componentes CDE
                </th>
                <td className="py-2 pr-3 text-right text-carvao-muted">{num(comp.media?.cde_rs_mwh, 2)}</td>
                <td className="py-2 pr-3 text-right text-carvao-muted">{pct(comp.cde.razao_de_somas_pct, 1)}</td>
                <td className="py-2 pr-3 text-right text-carvao-muted">{num(comp.cde.mediana_rs_mwh, 2)}</td>
                {dDestaque && (
                  <>
                    <td className="py-2 pr-3 text-right text-carvao-muted">{num(dDestaque.cde, 2)}</td>
                    <td className="py-2 text-right text-carvao-muted">{pct(dDestaque.cde_pct, 1)}</td>
                  </>
                )}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
          A média é simples entre {comp.media?.n ?? "as"} distribuidoras (cada uma pesa igual) e fecha com a tarifa média de{" "}
          {comp.media && comp.media.total_rs_mwh !== null ? `${reais(comp.media.total_rs_mwh / 1000, 4)}/kWh` : "sem dado"}; a participação é a razão de somas. As medianas são
          lidas grupo a grupo e não somam a tarifa mediana. Componentes CDE estão dentro dos encargos: não some à parte.
          {dDestaque &&
            dDestaque.reclassificadas.length > 0 &&
            ` Na ${nomeDestaque}, ${dDestaque.reclassificadas.map((r) => `${r.codigo} de ${num(r.valor, 2)} R$/MWh`).join(" e ")} saiu dos encargos e está em créditos (valor negativo em componente de custo).`}
        </p>
      </div>

      <ContaSobDemanda chaveUrl="comp" rotulo="a composição de todas as distribuidoras" detalhe={`${comp.distribuidoras.length} linhas, ordenáveis por grupo e exportáveis`}>
        <TabelaComposicao
          comp={comp}
          vigentes={vigentes}
          emPct={emPct}
          rotulo={rotulo}
          destaque={destaque}
          onSelecionar={selecionar}
          dataReferencia={dataReferencia}
          fonte={fonte}
        />
      </ContaSobDemanda>
    </div>
  );
}

function TabelaComposicao({
  comp,
  vigentes,
  emPct,
  rotulo,
  destaque,
  onSelecionar,
  dataReferencia,
  fonte,
}: {
  comp: Composicao;
  vigentes: Pick<TarifaVigente, "cnpj" | "posicao">[];
  emPct: boolean;
  rotulo: Map<string, string>;
  destaque: string | null;
  onSelecionar: (id: string | null) => void;
  dataReferencia: string;
  fonte: string;
}) {
  const linhas = useMemo(() => linhasComposicao(comp, vigentes, emPct ? "pct" : "rs"), [comp, vigentes, emPct]);
  const colunas = useMemo(() => colunasComposicao(rotulo, emPct), [rotulo, emPct]);
  return (
    <TabelaInterativa
      titulo={`Composição por distribuidora (${emPct ? "% de TE + TUSD" : "R$/MWh"})`}
      colunas={colunas}
      linhas={linhas}
      chaveLinha="id"
      colunaRotulo="sigla"
      fonte={fonte}
      versao={dataReferencia}
      nomeArquivo={`conta-composicao-b1-${emPct ? "pct" : "rs-mwh"}`}
      chaveUrl="comp"
      ordemInicial={{ coluna: "posicao", direcao: "asc" }}
      selecionado={destaque}
      onSelecionar={onSelecionar}
      dicaBusca="Sigla ou CNPJ"
      nota="Grupos pela classificação do observatório a partir do código da componente; tributos e iluminação pública não fazem parte da tarifa homologada e ficam fora. Clique numa linha para levá-la ao gráfico."
    />
  );
}
