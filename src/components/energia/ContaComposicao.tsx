"use client";

import { useMemo } from "react";
import { ContaEscolha, type OpcaoConta } from "@/components/energia/ContaControles";
import { ContaSobDemanda } from "@/components/energia/ContaSobDemanda";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { ContaRolavel } from "@/components/energia/ContaRolavel";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { formatos } from "@/lib/energia/formato";
import { dadoTexto } from "@/lib/energia/i18n/conta-inclusao";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import {
  CAMPO_DIST,
  COR_AJUSTE,
  COR_GRUPO,
  ID_AJUSTE,
  ID_MEDIA,
  ORDEM_GRUPOS,
  rotuloAjuste,
  ajusteDeArredondamento,
  colunasComposicao,
  destacar,
  expandirComposicao,
  idsComposicaoPadrao,
  linhasComposicao,
  linhasComposicaoGrafico,
  linhasGrupos,
  maiorAjuste,
  remover,
  rotuloDistribuidora,
  type ComposicaoCompacta,
  type ComposicaoDaTela,
  type VigenteCompacto,
} from "@/lib/energia/conta";

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


export type ContaComposicaoProps = {
  /** A composição em tuplas (`compactarComposicao`): as 80 distribuidoras com as partes em R$/MWh e em %. */
  composicao: ComposicaoCompacta;
  /** As distribuidoras do ranking em tuplas, a mesma lista (e a mesma referência) que o painel de tarifas recebe: de cada uma só o CNPJ e a posição entram aqui. */
  vigentes: VigenteCompacto[];
  referencia: string | null;
  dataReferencia: string;
  fonte: string;
};

export function ContaComposicao({ composicao, vigentes: compactos, referencia, dataReferencia, fonte }: ContaComposicaoProps) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const idioma = useIdioma();
  const tx = useTx();
  const { dataBR, num, pct, reais } = formatos(idioma);
  const ROTULO_AJUSTE = rotuloAjuste(idioma);
  const OPCOES_UNIDADE: OpcaoConta<"rs" | "pct">[] = [
    { id: "rs", rotulo: "R$/MWh" },
    { id: "pct", rotulo: tx("% da tarifa", "% of the tariff") },
  ];
  const comp = useMemo(() => expandirComposicao(composicao), [composicao]);
  const vigentes = useMemo(() => compactos.map((x) => ({ cnpj: x[0], posicao: x[13] })), [compactos]);
  const comComposicao = useMemo(() => new Set(comp.distribuidoras.map((d) => d.cnpj)), [comp.distribuidoras]);
  const escolhidas = v.dist.filter((id) => comComposicao.has(id));
  const ids = escolhidas.length ? escolhidas : idsComposicaoPadrao(comp, vigentes, referencia);
  const chaveIds = ids.join(",");
  const emPct = v.unidade === "pct";
  const unidade = emPct ? "%" : "R$/MWh";
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a chave resume a lista de ids
  const grafico = useMemo(() => linhasComposicaoGrafico(comp, vigentes, v.unidade, ids, idioma), [comp, vigentes, v.unidade, chaveIds, idioma]);
  // o rótulo do grupo vem da gold em português: a tabela exata dá a forma inglesa
  const rotulo = useMemo(() => new Map(comp.grupos.map((g) => [g.id, dadoTexto(g.rotulo, idioma)])), [comp.grupos, idioma]);
  const temAjuste = grafico.some((l) => l.ajuste !== null && l.ajuste !== 0);
  const series = [
    ...ORDEM_GRUPOS.map((g) => ({
      id: g as string,
      rotulo: rotulo.get(g) ?? g,
      cor: COR_GRUPO[g],
    })),
    // a pilha termina no total publicado: a diferença de arredondamento das partes é a última parte, e o total do gráfico é o da tabela
    ...(temAjuste ? [{ id: ID_AJUSTE, rotulo: ROTULO_AJUSTE, cor: COR_AJUSTE }] : []),
  ];
  const maiorRs = useMemo(() => maiorAjuste(linhasComposicao(comp, vigentes, "rs")), [comp, vigentes]);
  const maiorPct = useMemo(() => maiorAjuste(linhasComposicao(comp, vigentes, "pct")), [comp, vigentes]);
  const destaque = escolhidas[0] ?? null;
  const pedida = v.dist[0] ?? null;
  const dDestaque = destaque ? (comp.distribuidoras.find((d) => d.cnpj === destaque) ?? null) : null;
  const grupos = useMemo(() => linhasGrupos(comp, destaque), [comp, destaque]);
  const nomeDestaque = dDestaque ? rotuloDistribuidora(dDestaque.sigla, dDestaque.cnpj) : null;
  // diferença de arredondamento de cada coluna da decomposição (média e destaque, em R$/MWh e em %): a linha só aparece quando existe
  const ajMediaRs = comp.media ? ajusteDeArredondamento(ORDEM_GRUPOS.map((g) => comp.media!.grupos_rs_mwh[g]), comp.media.total_rs_mwh) : null;
  const ajMediaPct = comp.media ? ajusteDeArredondamento(ORDEM_GRUPOS.map((g) => comp.media!.grupos_pct[g]), 100) : null;
  const ajDestRs = dDestaque ? ajusteDeArredondamento(ORDEM_GRUPOS.map((g) => dDestaque.grupos[g]), dDestaque.total) : null;
  const ajDestPct = dDestaque ? ajusteDeArredondamento(ORDEM_GRUPOS.map((g) => dDestaque.pct[g]), 100) : null;
  const mostrarAjuste = [ajMediaRs, ajMediaPct, ajDestRs, ajDestPct].some((a) => a !== null && a !== 0);
  const reclassificadas = (dDestaque?.reclassificadas ?? []).map((r) => tx(`${r.codigo} de ${num(r.valor, 2)} R$/MWh`, `${r.codigo} of ${num(r.valor, 2)} R$/MWh`));
  const selecionar = (id: string | null) => {
    if (id === ID_MEDIA) return;
    if (id) definir({ dist: destacar(v.dist, id) });
    else if (destaque) definir({ dist: remover(v.dist, destaque) });
  };

  return (
    <div className="space-y-5">
      <ContaEscolha legenda={tx("Unidade da composição", "Composition unit")} opcoes={OPCOES_UNIDADE} valor={v.unidade} onEscolher={(u) => definir({ unidade: u })} />

      <p className="text-sm text-carvao-muted">
        {escolhidas.length
          ? tx(
              "Distribuidoras escolhidas no ranking, no histórico ou na tabela completa (até quatro), ao lado da composição média.",
              "Distribution utilities chosen in the ranking, the history or the full table (up to four), next to the average composition.",
            )
          : tx(
              "Sem distribuidora escolhida: a de referência (tarifa mais próxima da mediana) e as de menor e maior tarifa, ao lado da composição média. Escolha outras no ranking ou na tabela completa.",
              "No distribution utility chosen: the reference one (tariff closest to the median) and those with the lowest and highest tariff, next to the average composition. Choose others in the ranking or in the full table.",
            )}
      </p>

      <GraficoBarras
        titulo={tx(
          `Composição da tarifa B1 residencial, ${emPct ? "em % de TE + TUSD" : "em R$/MWh"}: média das distribuidoras e ${escolhidas.length ? "distribuidoras escolhidas" : "três distribuidoras de referência"} (as partes somam a tarifa)`,
          `Composition of the residential B1 tariff, ${emPct ? "in % of TE + TUSD" : "in R$/MWh"}: average of the distribution utilities and ${escolhidas.length ? "chosen distribution utilities" : "three reference distribution utilities"} (the parts add up to the tariff)`,
        )}
        dados={grafico}
        chaveCategoria="id"
        chaveRotulo="sigla"
        series={series}
        empilhado
        unidade={unidade}
        casas={2}
        orientacao="horizontal"
        selecionado={destaque}
        onSelecionar={selecionar}
        alturaCategoria={56}
      />

      <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-nota="arredondamento-composicao">
        {tx(
          <>
            As partes são publicadas com duas casas, cada uma arredondada em separado: a soma delas difere da tarifa em até R$ {num(maiorRs, 2)}/MWh, ou {num(maiorPct, 2)} ponto percentual na leitura em %.
          </>,
          <>
            The parts are published with two decimal places, each rounded separately: their sum differs from the tariff by up to R$ {num(maiorRs, 2)}/MWh, or {num(maiorPct, 2)} percentage point in
            the % view.
          </>,
        )}
        {temAjuste
          ? tx(` O gráfico mostra essa diferença como "${ROTULO_AJUSTE}"`, ` The chart shows this difference as "${ROTULO_AJUSTE}"`)
          : tx(" Nesta seleção a soma das partes fecha com a tarifa", " In this selection the sum of the parts matches the tariff")}
        {tx(
          ", e todo total é o publicado: o mesmo valor no gráfico, na tabela e no arquivo.",
          ", and every total is the published one: the same value in the chart, the table and the file.",
        )}
      </p>

      {pedida && !destaque && (
        <p role="status" className="text-sm text-carvao-muted">
          {tx(
            <>
              A distribuidora escolhida não tem composição publicada para a vigência de {dataBR(dataReferencia)} (sem tarifa vigente ou sem componentes no conjunto).
            </>,
            <>
              The chosen distribution utility has no composition published for the validity period of {dataBR(dataReferencia)} (no tariff in force or no components in the dataset).
            </>,
          )}
        </p>
      )}

      <div>
        <h3 className="font-serif text-lg text-carvao">
          {tx(
            <>Decomposição: média, mediana e {nomeDestaque ?? "distribuidora em destaque"}</>,
            <>Breakdown: average, median and {nomeDestaque ?? "highlighted distribution utility"}</>,
          )}
        </h3>
        <ContaRolavel rotulo={tx("Tabela de decomposição da tarifa B1", "B1 tariff breakdown table")} className="mt-2">
          <table className="w-full min-w-[640px] border-collapse text-sm tabular-nums">
            <caption className="sr-only">
              {tx(
                "Grupos de componentes: média simples das distribuidoras, participação, mediana e a distribuidora em destaque",
                "Component groups: simple average of the distribution utilities, share, median and the highlighted distribution utility",
              )}
            </caption>
            <thead>
              <tr className="border-b border-linha text-left text-xs text-mineral">
                <th scope="col" className="py-2 pr-3 font-normal">
                  {tx("Grupo", "Group")}
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">
                  {tx("Média (R$/MWh)", "Average (R$/MWh)")}
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">
                  {tx("Participação média", "Average share")}
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">
                  {tx("Mediana (R$/MWh, não soma)", "Median (R$/MWh, does not add up)")}
                </th>
                {dDestaque && (
                  <>
                    <th scope="col" className="py-2 pr-3 text-right font-normal">
                      {nomeDestaque ? `${nomeDestaque} (R$/MWh)` : tx("Destaque (R$/MWh)", "Highlight (R$/MWh)")}
                    </th>
                    <th scope="col" className="py-2 text-right font-normal">
                      {nomeDestaque ? `${nomeDestaque} (%)` : tx("Destaque (%)", "Highlight (%)")}
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
                    {dadoTexto(g.grupo, idioma)}
                  </th>
                  <td className="py-2 pr-3 text-right">{num(g.media_rs, 2)}</td>
                  <td className="py-2 pr-3 text-right">{pct(g.media_pct, 2)}</td>
                  <td className="py-2 pr-3 text-right text-carvao-muted">{num(g.mediana_rs, 2)}</td>
                  {dDestaque && (
                    <>
                      <td className="py-2 pr-3 text-right">{num(g.dist_rs, 2)}</td>
                      <td className="py-2 text-right">{pct(g.dist_pct, 2)}</td>
                    </>
                  )}
                </tr>
              ))}
              {mostrarAjuste && (
                <tr className="border-b border-linha text-carvao-muted">
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    {ROTULO_AJUSTE}
                  </th>
                  <td className="py-2 pr-3 text-right">{num(ajMediaRs, 2)}</td>
                  <td className="py-2 pr-3 text-right">{pct(ajMediaPct, 2)}</td>
                  <td className="py-2 pr-3 text-right" />
                  {dDestaque && (
                    <>
                      <td className="py-2 pr-3 text-right">{num(ajDestRs, 2)}</td>
                      <td className="py-2 text-right">{pct(ajDestPct, 2)}</td>
                    </>
                  )}
                </tr>
              )}
              <tr className="border-b border-linha font-medium">
                <th scope="row" className="py-2 pr-3 text-left text-carvao">
                  {tx("Tarifa (TE + TUSD)", "Tariff (TE + TUSD)")}
                </th>
                <td className="py-2 pr-3 text-right">{num(comp.media?.total_rs_mwh, 2)}</td>
                <td className="py-2 pr-3 text-right">{comp.media ? pct(100, 2) : tx("sem dado", "no data")}</td>
                <td className="py-2 pr-3 text-right text-carvao-muted">
                  {num(comp.mediana.mediana_do_total_rs_mwh, 2)} {tx("(soma das medianas:", "(sum of the medians:")} {num(comp.mediana.soma_das_medianas_rs_mwh, 2)})
                </td>
                {dDestaque && (
                  <>
                    <td className="py-2 pr-3 text-right">{num(dDestaque.total, 2)}</td>
                    <td className="py-2 text-right">{pct(100, 2)}</td>
                  </>
                )}
              </tr>
              <tr>
                <th scope="row" className="py-2 pr-3 text-left font-normal text-carvao-muted">
                  {tx("Dos encargos: componentes CDE", "Of the sector charges: CDE components")}
                </th>
                <td className="py-2 pr-3 text-right text-carvao-muted">{num(comp.media?.cde_rs_mwh, 2)}</td>
                <td className="py-2 pr-3 text-right text-carvao-muted">{pct(comp.cde.razao_de_somas_pct, 2)}</td>
                <td className="py-2 pr-3 text-right text-carvao-muted">{num(comp.cde.mediana_rs_mwh, 2)}</td>
                {dDestaque && (
                  <>
                    <td className="py-2 pr-3 text-right text-carvao-muted">{num(dDestaque.cde, 2)}</td>
                    <td className="py-2 text-right text-carvao-muted">{pct(dDestaque.cde_pct, 2)}</td>
                  </>
                )}
              </tr>
            </tbody>
          </table>
        </ContaRolavel>
        <p className="mt-2 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
          {tx(
            <>
              A média é simples entre {comp.media?.n ?? "as"} distribuidoras (cada uma pesa igual) e fecha com a tarifa média de{" "}
              {comp.media && comp.media.total_rs_mwh !== null ? `${reais(comp.media.total_rs_mwh / 1000, 4)}/kWh` : "sem dado"}; a participação é a razão de somas. As medianas são lidas grupo a
              grupo e não somam a tarifa mediana. Componentes CDE estão dentro dos encargos: não some à parte.
            </>,
            <>
              The average is a simple one across {comp.media?.n ?? "the"} distribution utilities (each weighs the same) and matches the average tariff of{" "}
              {comp.media && comp.media.total_rs_mwh !== null ? `${reais(comp.media.total_rs_mwh / 1000, 4)}/kWh` : "no data"}; the share is the ratio of sums. The medians are read group by group
              and do not add up to the median tariff. CDE components are within sector charges: do not add them separately.
            </>,
          )}
          {dDestaque &&
            (dDestaque.reclassificadas?.length ?? 0) > 0 &&
            tx(
              ` Na ${nomeDestaque}, ${reclassificadas.join(" e ")} saiu dos encargos e está em créditos (valor negativo em componente de custo).`,
              ` At ${nomeDestaque}, ${reclassificadas.join(" and ")} left sector charges and is in credits (negative value in a cost component).`,
            )}
        </p>
      </div>

      <ContaSobDemanda
        chaveUrl="comp"
        rotulo={tx("a composição de todas as distribuidoras", "the composition of all distribution utilities")}
        detalhe={tx(`${comp.distribuidoras.length} linhas, ordenáveis por grupo e exportáveis`, `${comp.distribuidoras.length} rows, sortable by group and exportable`)}
      >
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
  comp: ComposicaoDaTela;
  vigentes: { cnpj: string; posicao: number }[];
  emPct: boolean;
  rotulo: Map<string, string>;
  destaque: string | null;
  onSelecionar: (id: string | null) => void;
  dataReferencia: string;
  fonte: string;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const linhas = useMemo(() => linhasComposicao(comp, vigentes, emPct ? "pct" : "rs"), [comp, vigentes, emPct]);
  const colunas = useMemo(() => colunasComposicao(rotulo, emPct, idioma), [rotulo, emPct, idioma]);
  return (
    <TabelaInterativa
      titulo={tx(`Composição por distribuidora (${emPct ? "% de TE + TUSD" : "R$/MWh"})`, `Composition by distribution utility (${emPct ? "% of TE + TUSD" : "R$/MWh"})`)}
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
      dicaBusca={tx("Sigla ou CNPJ", "Acronym or CNPJ")}
      iniciarAberta
      nota={tx(
        "Grupos pela classificação do observatório a partir do código da componente; tributos e iluminação pública não fazem parte da tarifa homologada e ficam fora. Clique numa linha para levá-la ao gráfico.",
        "Groups follow the observatory's classification based on the component code; taxes and public lighting are not part of the ratified tariff and are left out. Click a row to bring it to the chart.",
      )}
    />
  );
}
