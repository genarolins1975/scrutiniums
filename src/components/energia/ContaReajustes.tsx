"use client";

import { useMemo } from "react";
import { ContaSobDemanda } from "@/components/energia/ContaSobDemanda";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, mesAno, pct } from "@/lib/energia/formato";
import { CAMPO_DIST, COLUNAS_JANELA, destacar, linhasJanela, remover, respostaReajustes, rotuloDistribuidora } from "@/lib/energia/conta";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { JanelaInflacao, UltimoEvento } from "@/lib/energia/tipos-conta";

/**
 * P050, "Quanto a tarifa mudou contra a inflação?": variação da tarifa B1
 * residencial de cada distribuidora entre o fim do mês inicial e o fim do mês
 * final de uma janela de 12, 60 ou 120 meses, com o IPCA dos mesmos meses como
 * linha de referência. Distribuidoras sem tarifa numa das datas ou com área
 * alterada por incorporação ficam fora e são listadas. É a variação da tarifa
 * B1, não o efeito médio do processo tarifário (bloqueado na fonte).
 *
 * Janela na URL (?jan=); a distribuidora em destaque (?dist=) é a mesma dos
 * outros painéis.
 */

const ESQUEMA = {
  dist: CAMPO_DIST,
  janela: campo(tiposUrl.opcao(["12", "60", "120"] as const), "12", {
    param: "jan",
  }),
};

const COLUNAS_ULTIMOS: ColunaTabela[] = [
  { id: "sigla", rotulo: "Distribuidora", tipo: "texto" },
  { id: "data", rotulo: "Data da última mudança", tipo: "data" },
  { id: "ato", rotulo: "Ato da ANEEL", tipo: "texto", literal: { classe: "ato-retificacao-sem-numero", origem: "https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica" } },
  {
    id: "variacao",
    rotulo: "Variação da tarifa B1",
    tipo: "percentual",
    casas: 2,
  },
  {
    id: "ipca",
    rotulo: "IPCA desde a mudança anterior",
    tipo: "percentual",
    casas: 2,
  },
  { id: "meses", rotulo: "Meses do IPCA", tipo: "texto" },
  { id: "perimetro", rotulo: "Mudança de perímetro (ato)", tipo: "texto" },
];

export type ContaReajustesProps = {
  janelas: JanelaInflacao[];
  ultimos: UltimoEvento[];
  dataReferencia: string;
  fonte: string;
};

export function ContaReajustes({ janelas, ultimos, dataReferencia, fonte }: ContaReajustesProps) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const janela = janelas.find((j) => String(j.meses) === v.janela) ?? janelas[0];
  const linhas = useMemo(() => (janela ? linhasJanela(janela) : []), [janela]);
  const destaque = v.dist.find((id) => linhas.some((l) => l.id === id)) ?? null;
  const selecionar = (id: string | null) => {
    if (id) definir({ dist: destacar(v.dist, id) });
    else if (destaque) definir({ dist: remover(v.dist, destaque) });
  };
  const ultimasLinhas = useMemo(
    () =>
      ultimos.map((u) => ({
        id: u[0],
        sigla: rotuloDistribuidora(u[1], u[0]),
        data: u[2],
        ato: u[3],
        variacao: u[4],
        ipca: u[5],
        meses: `${mesAno(`${u[6]}-01`)} a ${mesAno(`${u[7]}-01`)}`,
        perimetro: u[8],
      })),
    [ultimos],
  );
  if (!janela) return <p className="text-sm text-carvao-muted">Sem janela de comparação com o IPCA publicada.</p>;

  const refs = [
    ...(janela.ipca_pct !== null
      ? [
          {
            valor: janela.ipca_pct,
            rotulo: `IPCA de ${mesAno(`${janela.ipca_meses[0]}-01`)} a ${mesAno(`${janela.ipca_meses[1]}-01`)}`,
          },
        ]
      : []),
    ...(janela.mediana_pct !== null ? [{ valor: janela.mediana_pct, rotulo: "Mediana das distribuidoras" }] : []),
  ];

  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="Janela de comparação" className="flex flex-wrap items-center gap-2">
        <span className="rotulo text-mineral">Janela</span>
        {janelas.map((j) => {
          const id = String(j.meses) as "12" | "60" | "120";
          return (
            <label
              key={id}
              className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 border px-3 text-sm ${v.janela === id ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted"}`}
            >
              <input type="radio" name="conta-jan" value={id} checked={v.janela === id} onChange={() => definir({ janela: id })} className="accent-energia" />
              {j.meses} meses
            </label>
          );
        })}
      </div>

      <p className="max-w-prose2 text-base leading-relaxed text-carvao" aria-live="polite" data-resposta="p050-reajustes">
        {respostaReajustes(janela)}
      </p>

      <GraficoBarras
        titulo={`Variação da tarifa B1 residencial de ${dataBR(janela.de)} a ${dataBR(janela.ate)}, por distribuidora, com o IPCA do período`}
        dados={linhas}
        chaveCategoria="id"
        chaveRotulo="sigla"
        series={[
          {
            id: "variacao",
            rotulo: "Variação da tarifa B1",
            cor: "var(--cor-energia)",
          },
        ]}
        unidade="%"
        casas={2}
        orientacao="horizontal"
        referencias={refs}
        selecionado={destaque}
        onSelecionar={selecionar}
        alturaCategoria={44}
        alturaMaxima={520}
      />

      {(janela.excluidas_mudanca_perimetro.length > 0 || janela.excluidas_sem_tarifa_nas_duas_datas > 0) && (
        <div className="text-sm text-carvao-muted">
          <p>
            Fora desta janela: {janela.excluidas_sem_tarifa_nas_duas_datas} {janela.excluidas_sem_tarifa_nas_duas_datas === 1 ? "distribuidora" : "distribuidoras"} sem tarifa B1
            numa das duas datas
            {janela.excluidas_mudanca_perimetro.length > 0 ? ` e ${janela.excluidas_mudanca_perimetro.length} com a área alterada por incorporação entre as datas:` : "."}
          </p>
          {janela.excluidas_mudanca_perimetro.length > 0 && (
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {janela.excluidas_mudanca_perimetro.map((e) => (
                <li key={e.cnpj}>
                  {rotuloDistribuidora(e.sigla, e.cnpj)}: incorporação com tarifa unificada desde {dataBR(e.data)} ({e.ato}); a variação de {pct(e.variacao_pct_nao_comparavel, 2)}{" "}
                  compara áreas diferentes e não entra na mediana.
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ContaSobDemanda chaveUrl="reaj" rotulo="a tabela da janela com a variação real" detalhe={`${linhas.length} distribuidoras, ordenável e exportável`}>
        <TabelaInterativa
          titulo={`Variação em ${janela.meses} meses e IPCA de ${pct(janela.ipca_pct, 2)}`}
          colunas={COLUNAS_JANELA}
          linhas={linhas}
          chaveLinha="id"
          colunaRotulo="sigla"
          fonte={fonte}
          versao={dataReferencia}
          nomeArquivo={`conta-variacao-${janela.meses}-meses`}
          chaveUrl="reaj"
          ordemInicial={{ coluna: "variacao", direcao: "asc" }}
          selecionado={destaque}
          onSelecionar={selecionar}
          dicaBusca="Sigla ou CNPJ"
          nota="Variação real = (1 + variação) ÷ (1 + IPCA) − 1, publicada pelo pipeline. Positiva: a tarifa subiu mais que o IPCA."
        />
      </ContaSobDemanda>

      <div data-nivel="analisar">
        <ContaSobDemanda chaveUrl="ult" rotulo="a última mudança de cada distribuidora" detalhe={`${ultimasLinhas.length} distribuidoras`}>
          <TabelaInterativa
            titulo="Última mudança da tarifa B1 de cada distribuidora do ranking"
            colunas={COLUNAS_ULTIMOS}
            linhas={ultimasLinhas}
            chaveLinha="id"
            colunaRotulo="sigla"
            fonte={fonte}
            versao={dataReferencia}
            nomeArquivo="conta-ultimas-mudancas-b1"
            chaveUrl="ult"
            ordemInicial={{ coluna: "data", direcao: "desc" }}
            selecionado={v.dist[0] && ultimasLinhas.some((l) => l.id === v.dist[0]) ? v.dist[0] : null}
            onSelecionar={selecionar}
            dicaBusca="Sigla ou ato"
            nota="O conjunto não informa se o ato é reajuste, revisão periódica ou extraordinária; o histórico completo de cada distribuidora está no histórico da tarifa B1, na página principal da Conta de luz (modo Analisar)."
          />
        </ContaSobDemanda>
      </div>
    </div>
  );
}
