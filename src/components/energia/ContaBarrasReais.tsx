"use client";

import { useMemo } from "react";
import { ContaEscolha, type OpcaoConta } from "@/components/energia/ContaControles";
import { GraficoBarras, type LinhaBarras, type SerieBarra } from "@/components/energia/GraficoBarras";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { num } from "@/lib/energia/formato";
import { emReaisDoMesBase, type FatorReal } from "@/lib/energia/conta";

/**
 * Barras por ano com a alternância entre valores nominais (a moeda da época, como a fonte publica) e valores em reais constantes do
 * mês-base do IPCA. Os subsídios e o orçamento da CDE vêm da fonte em reais nominais, e a tarifa B1 da mesma página já tinha série
 * em reais com IPCA e mês-base: sem a alternância, o crescimento de 2014 a 2025 parecia o dobro do que é em poder de compra. A escolha
 * (?valores=) é uma só para os dois gráficos da página: trocar num deles troca no outro.
 *
 * O valor em reais é o nominal do ano vezes o fator do ano (`fatoresReaisPorAno`: índice do IPCA do mês-base dividido pela média dos
 * índices mensais do ano). A nota diz o mês-base, a regra e o ano em que o IPCA cobre só parte dos meses; ano sem fator fica sem valor
 * (nunca o nominal passando por real). Sem nenhum fator, só os valores nominais, e a nota diz que falta o IPCA.
 */

const ESQUEMA = { valores: campo(tiposUrl.opcao(["nominal", "real"] as const), "nominal", { param: "valores" }) };

export function ContaBarrasReais({
  titulo,
  linhas,
  chaves,
  series,
  fatores,
  base,
  unidade,
  casas = 2,
  altura = 340,
  chaveCategoria,
  chaveRotulo,
}: {
  titulo: string;
  /** Uma linha por ano, em valores nominais (R$ bilhões). */
  linhas: LinhaBarras[];
  /** Colunas de dinheiro de cada linha (as séries e os totais); as demais passam sem mudar. */
  chaves: string[];
  series: SerieBarra[];
  /** Fator do ano para reais do mês-base; null quando o IPCA não cobre o ano. */
  fatores: Record<string, FatorReal | null>;
  /** Mês-base do IPCA, "ago/2026" (texto pronto), ou null sem IPCA. */
  base: string | null;
  unidade: string;
  casas?: number;
  altura?: number;
  chaveCategoria: string;
  chaveRotulo?: string;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const temReal = base !== null && Object.values(fatores).some((f) => f !== null);
  const real = temReal && v.valores === "real";
  const dados = useMemo(() => (real ? emReaisDoMesBase(linhas as Record<string, string | number | null>[], chaves, fatores, chaveCategoria) : linhas), [real, linhas, chaves, fatores, chaveCategoria]);
  const opcoes: OpcaoConta<"nominal" | "real">[] = [
    { id: "nominal", rotulo: "Nominais (valores da época)" },
    { id: "real", rotulo: `Em reais de ${base ?? "mês-base"}` },
  ];
  const parcial = Object.entries(fatores).filter(([, f]) => f !== null && f.meses < 12);
  return (
    <div className="space-y-3" data-valores={real ? "real" : "nominal"}>
      {temReal ? (
        <ContaEscolha emLinha legenda="Valores" opcoes={opcoes} valor={v.valores} onEscolher={(x) => definir({ valores: x })} />
      ) : (
        <p className="text-xs text-carvao-muted" data-nota="sem-ipca">
          Sem IPCA publicado nesta publicação: só os valores nominais, na moeda da época.
        </p>
      )}
      <GraficoBarras
        titulo={real ? `${titulo}, em reais de ${base} (corrigidos pelo IPCA)` : `${titulo}, em reais nominais (valores da época)`}
        dados={dados}
        chaveCategoria={chaveCategoria}
        chaveRotulo={chaveRotulo}
        series={series}
        empilhado
        unidade={unidade}
        casas={casas}
        altura={altura}
      />
      {real && (
        <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-nota="deflator">
          Em reais de {base}: cada ano é multiplicado pelo índice do IPCA de {base} dividido pela média dos índices mensais do ano (IPCA do IBGE). O IPCA mede preços ao consumidor em geral, não só a energia.
          {parcial.length > 0 && ` Em ${parcial.map(([ano, f]) => `${ano} o IPCA cobre ${num(f!.meses, 0)} meses`).join(" e em ")}: a média é a desses meses.`}
        </p>
      )}
    </div>
  );
}
