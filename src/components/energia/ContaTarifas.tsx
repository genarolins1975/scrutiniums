"use client";

import { useMemo } from "react";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR } from "@/lib/energia/formato";
import { CAMPO_DIST, COLUNAS_RANKING, destacar, linhasRanking, remover, respostaTarifa, type Perfil } from "@/lib/energia/conta";
import type { ResumoTarifas, TarifaVigente } from "@/lib/energia/tipos-conta";

/**
 * P047, "Quanto custa um perfil comparável?": ranking das distribuidoras pela
 * tarifa B1 residencial de aplicação vigente, em duas leituras do MESMO número
 * publicado: o custo de um perfil de consumo (R$/mês) ou a tarifa TE + TUSD
 * (R$/MWh, empilhada nas duas parcelas, que somam o total). Perfil e leitura
 * ficam na URL; a distribuidora escolhida (?dist=) acende a barra, a linha da
 * tabela e os outros painéis da página. A tabela recebe as mesmas linhas do
 * gráfico, então o que se exporta é o que se vê.
 */

const ESQUEMA = {
  dist: CAMPO_DIST,
  perfil: campo(tiposUrl.opcao(["100", "200", "300"] as const), "200", {
    param: "perfil",
  }),
  leitura: campo(tiposUrl.opcao(["perfil", "tarifa"] as const), "perfil", {
    param: "leitura",
  }),
};

export type ContaTarifasProps = {
  vigentes: TarifaVigente[];
  resumo: ResumoTarifas;
  dataReferencia: string;
  fonte: string;
};

export function ContaTarifas({ vigentes, resumo, dataReferencia, fonte }: ContaTarifasProps) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const perfil = Number(v.perfil) as Perfil;
  const linhas = useMemo(() => linhasRanking(vigentes, perfil), [vigentes, perfil]);
  const destaque = v.dist[0] ?? null;
  const naRanking = destaque !== null && linhas.some((l) => l.id === destaque);
  const selecionar = (id: string | null) => {
    if (id) definir({ dist: destacar(v.dist, id) });
    else if (destaque) definir({ dist: remover(v.dist, destaque) });
  };
  const resposta = respostaTarifa(dataReferencia, resumo, vigentes, perfil);
  const chavePerfil = String(perfil) as "100" | "200" | "300";

  return (
    <div className="space-y-5">
      <p className="max-w-prose2 text-base leading-relaxed text-carvao" aria-live="polite" data-resposta="p047">
        {resposta}
      </p>

      <fieldset className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <legend className="sr-only">Perfil e leitura do ranking</legend>
        <div role="radiogroup" aria-label="Perfil de consumo" className="flex flex-wrap items-center gap-2">
          <span className="rotulo text-mineral">Perfil</span>
          {(["100", "200", "300"] as const).map((p) => (
            <label
              key={p}
              className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 border px-3 text-sm ${v.perfil === p ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted"}`}
            >
              <input type="radio" name="conta-perfil" value={p} checked={v.perfil === p} onChange={() => definir({ perfil: p })} className="accent-energia" />
              {p} kWh/mês
            </label>
          ))}
        </div>
        <div role="radiogroup" aria-label="Leitura do ranking" className="flex flex-wrap items-center gap-2">
          <span className="rotulo text-mineral">Ver</span>
          {(
            [
              ["perfil", "Custo do perfil (R$/mês)"],
              ["tarifa", "Tarifa TE + TUSD (R$/MWh)"],
            ] as const
          ).map(([id, rot]) => (
            <label
              key={id}
              className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 border px-3 text-sm ${v.leitura === id ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted"}`}
            >
              <input type="radio" name="conta-leitura" value={id} checked={v.leitura === id} onChange={() => definir({ leitura: id })} className="accent-energia" />
              {rot}
            </label>
          ))}
        </div>
      </fieldset>

      {v.leitura === "perfil" ? (
        <GraficoBarras
          titulo={`Custo de ${perfil} kWh/mês pela tarifa B1 residencial, por distribuidora (sem tributos e sem bandeira)`}
          dados={linhas}
          chaveCategoria="id"
          chaveRotulo="sigla"
          series={[
            {
              id: "custo",
              rotulo: `Custo de ${perfil} kWh`,
              cor: "var(--cor-energia)",
            },
          ]}
          unidade="R$/mês"
          casas={2}
          orientacao="horizontal"
          referencias={[
            {
              valor: resumo.perfis_mediana[chavePerfil] ?? NaN,
              rotulo: "Mediana entre distribuidoras",
            },
          ].filter((r) => Number.isFinite(r.valor))}
          selecionado={naRanking ? destaque : null}
          onSelecionar={selecionar}
          alturaCategoria={44}
          alturaMaxima={520}
        />
      ) : (
        <GraficoBarras
          titulo="Tarifa B1 residencial de aplicação por distribuidora: TE e TUSD empilhadas (somam o total)"
          dados={linhas}
          chaveCategoria="id"
          chaveRotulo="sigla"
          series={[
            { id: "te", rotulo: "TE (energia)", cor: "var(--serie-comp-1)" },
            {
              id: "tusd",
              rotulo: "TUSD (uso da rede)",
              cor: "var(--serie-solar)",
            },
          ]}
          empilhado
          unidade="R$/MWh"
          casas={2}
          orientacao="horizontal"
          referencias={[
            { valor: resumo.p25 ?? NaN, rotulo: "1º quartil" },
            { valor: resumo.mediana ?? NaN, rotulo: "Mediana" },
            { valor: resumo.p75 ?? NaN, rotulo: "3º quartil" },
          ].filter((r) => Number.isFinite(r.valor))}
          selecionado={naRanking ? destaque : null}
          onSelecionar={selecionar}
          alturaCategoria={44}
          alturaMaxima={520}
        />
      )}

      {destaque && !naRanking && (
        <p className="text-sm text-carvao-muted" role="status">
          A distribuidora escolhida não tem tarifa B1 vigente em {dataBR(dataReferencia)} e não entra no ranking; o histórico dela aparece no modo Analisar e o motivo,
          na lista de distribuidoras sem tarifa vigente do modo Auditar.
        </p>
      )}

      <TabelaInterativa
        titulo="Tarifas B1 residenciais vigentes e custo por perfil"
        colunas={COLUNAS_RANKING}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="sigla"
        fonte={fonte}
        versao={dataReferencia}
        nomeArquivo="conta-tarifas-b1-vigentes"
        chaveUrl="tar"
        ordemInicial={{ coluna: "posicao", direcao: "asc" }}
        selecionado={naRanking ? destaque : null}
        onSelecionar={selecionar}
        dicaBusca="Sigla, razão social ou CNPJ"
        nota="Tarifa de aplicação homologada sem ICMS, PIS/Pasep, Cofins, iluminação pública e bandeira. Base econômica é a tarifa usada no cálculo tarifário, sem os componentes financeiros do processo."
      />
    </div>
  );
}
