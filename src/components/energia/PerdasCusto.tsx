"use client";

import { useMemo } from "react";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEvidenciaPerdas, useSelecaoPerdas } from "@/components/energia/PerdasSelecao";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { Nome } from "@/components/i18n/Nome";
import { dataBR, num } from "@/lib/energia/formato";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { ColunaTabela } from "@/lib/energia/tabela";
import { componentesParaBarra, pctOu, rotuloResolucao, type LinhaCusto } from "@/lib/energia/perdas";

/**
 * Custo unitário das perdas na tarifa residencial B1 (P058): as três componentes de perdas
 * (técnicas, não técnicas e na Rede Básica) em R$/MWh por distribuidora, empilhadas porque
 * somam a componente de perdas da tarifa (composição aditiva publicada pela fonte). O
 * gráfico só traz processos vigentes na data da consulta; o processo com vigência
 * encerrada fica na tabela com a situação escrita, nunca como a tarifa em vigor. Nada é
 * multiplicado por mercado ou por tarifa cheia: é o nível reconhecido por MWh, não o
 * custo total em reais (bloqueado: a fonte não publica o valor por processo em base aberta).
 */

function colunas(tx: <T>(pt: T, en: T) => T): ColunaTabela[] {
  return [
    { id: "rotulo", rotulo: tx("Distribuidora", "Distribution utility"), tipo: "texto", idiomaTexto: "nome" },
    { id: "situacao", rotulo: tx("Situação na data da consulta", "Status on the query date"), tipo: "texto", categorica: true },
    { id: "reh", rotulo: tx("Resolução", "Resolution"), tipo: "texto" },
    { id: "inicio", rotulo: tx("Início da vigência", "Effective from"), tipo: "data" },
    { id: "fim", rotulo: tx("Fim da vigência", "Effective until"), tipo: "data" },
    { id: "pt", rotulo: tx("Perdas técnicas", "Technical losses"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "pnt", rotulo: tx("Perdas não técnicas", "Non-technical losses"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "rede_basica", rotulo: tx("Perdas na Rede Básica", "Losses in the basic transmission grid"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "perdas", rotulo: tx("Perdas, base econômica (soma das componentes)", "Losses, economic base (sum of the components)"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "total", rotulo: tx("Tarifa B1, base econômica (TUSD + TE)", "B1 tariff, economic base (TUSD + TE)"), tipo: "numero", unidade: "R$/MWh", casas: 2 }, // i18n: dado
    { id: "participacao_perdas_pct", rotulo: tx("Perdas na tarifa, base econômica", "Losses in the tariff, economic base"), tipo: "percentual", casas: 2 },
    { id: "participacao_pnt_pct", rotulo: tx("Não técnicas na tarifa, base econômica", "Non-technical losses in the tariff, economic base"), tipo: "percentual", casas: 2 },
  ];
}

export type PerdasCustoProps = {
  linhas: LinhaCusto[];
  /** perdas_evidencias_tarifa.json, lido só quando há distribuidora escolhida. */
  urlEvidencias: string;
  ids: string[];
  rotulos: Record<string, string>;
  consultadaEm: string;
  /** Anos dos arquivos de componentes tarifárias lidos (proveniência da gold), ex.: "2012 a 2026". */
  anosArquivos: string;
  versao: string;
};

export function PerdasCusto({ linhas, urlEvidencias, ids, rotulos, consultadaEm, anosArquivos, versao }: PerdasCustoProps) {
  const [sel, selecionar] = useSelecaoPerdas(ids);
  const idioma = useIdioma();
  const tx = useTx();
  const vigentes = useMemo(() => linhas.filter((l) => l.situacao === "vigente"), [linhas]);
  // valores de desenho (ver componentesParaBarra): o total no fim da barra, na dica e na tabela do gráfico é o mesmo número da coluna Perdas da tabela
  const dados = useMemo(() => vigentes.map((l) => ({ id: l.id, rotulo: l.rotulo, ...componentesParaBarra(l) })), [vigentes]);
  const linhasTabela = useMemo(
    () =>
      linhas.map((l) => ({
        id: l.id,
        rotulo: l.rotulo,
        situacao:
          l.situacao === "vigente"
            ? tx("vigente", "in force")
            : l.ativa
              ? tx("vigência encerrada, distribuidora ativa", "validity ended, distribution utility active")
              : tx("vigência encerrada, série encerrada no SAMP", "validity ended, series ended in SAMP"),
        reh: rotuloResolucao(l.resolucao),
        inicio: l.inicio,
        fim: l.fim,
        pt: l.pt,
        pnt: l.pnt,
        rede_basica: l.rede_basica,
        perdas: l.perdas,
        total: l.total,
        participacao_perdas_pct: l.participacao_perdas_pct,
        participacao_pnt_pct: l.participacao_pnt_pct,
      })),
    // tx muda só com o idioma
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linhas, idioma],
  );
  const linhaSel = sel ? linhas.find((l) => l.id === sel) ?? null : null;
  const [prova, tentarProva] = useEvidenciaPerdas(urlEvidencias, linhaSel ? linhaSel.id : null);
  return (
    <div className="space-y-5">
      <GraficoBarras
        titulo={tx(
          `Componentes de perdas na tarifa residencial B1 (base econômica) vigente em ${dataBR(consultadaEm)}`,
          `Loss components in the B1 residential tariff (economic base) in force on ${dataBR(consultadaEm, idioma)}`,
        )}
        dados={dados}
        chaveCategoria="id"
        chaveRotulo="rotulo"
        series={[
          { id: "pt", rotulo: tx("Técnicas", "Technical"), cor: "var(--escala-seq-4)" },
          { id: "pnt", rotulo: tx("Não técnicas", "Non-technical"), cor: "var(--serie-termica)" },
          { id: "rede_basica", rotulo: tx("Rede Básica", "Basic transmission grid"), cor: "var(--serie-referencia)" },
        ]}
        unidade="R$/MWh"
        casas={2}
        orientacao="horizontal"
        empilhado
        rotulosValor
        selecionado={linhaSel && linhaSel.situacao === "vigente" ? linhaSel.id : null}
        onSelecionar={selecionar}
      />
      <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-ordem="custo">
        {tx(
          "Ordem das barras: soma das três componentes de perdas, da maior para a menor. Só entram os processos vigentes na data da consulta; o processo com vigência encerrada fica na tabela, com a situação escrita.",
          "Order of the bars: sum of the three loss components, from largest to smallest. Only processes in force on the query date are included; a process whose validity has ended stays in the table, with its status written.",
        )}
      </p>
      <div className="border border-linha bg-papel px-4 py-3 text-sm text-carvao" data-selecao={sel ?? ""}>
        {!sel ? (
          <p className="text-carvao-muted">
            {tx(
              "Escolha uma barra ou uma linha da tabela para ler a componente de perdas da tarifa de uma distribuidora.",
              "Choose a bar or a table row to read the loss component of a distribution utility's tariff.",
            )}
          </p>
        ) : !linhaSel ? (
          <p>
            {tx(
              <>{rotulos[sel] ?? sel}: sem processo tarifário com tarifa residencial B1 convencional nos arquivos de componentes tarifárias de {anosArquivos}.</>,
              <>
                <Nome>{rotulos[sel] ?? sel}</Nome>: no tariff process with a conventional B1 residential tariff in the tariff component files of {anosArquivos}.
              </>,
            )}
          </p>
        ) : (
          <>
          <p data-resposta="custo-distribuidora">
            {tx(
              <>{`${linhaSel.rotulo}, ${rotuloResolucao(linhaSel.resolucao) ?? "resolução não informada"} (${dataBR(linhaSel.inicio)} a ${dataBR(linhaSel.fim)}): `}</>,
              <>
                <Nome>{linhaSel.rotulo}</Nome>
                {`, ${rotuloResolucao(linhaSel.resolucao) ?? "resolution not reported"} (${dataBR(linhaSel.inicio, idioma)} to ${dataBR(linhaSel.fim, idioma)}): `}
              </>,
            )}
            {linhaSel.situacao === "vigente"
              ? tx("vigente na data da consulta. ", "in force on the query date. ")
              : tx(
                  `vigência encerrada em ${dataBR(linhaSel.fim)}, sem processo seguinte no arquivo da fonte em ${dataBR(consultadaEm)}; não é a tarifa em vigor. `,
                  `validity ended on ${dataBR(linhaSel.fim, idioma)}, with no following process in the source file on ${dataBR(consultadaEm, idioma)}; it is not the tariff in force. `,
                )}
            {tx(
              `Na base econômica (base de cálculo tarifário, não a tarifa que aparece na conta): técnicas ${num(linhaSel.pt, 2)}, não técnicas ${num(linhaSel.pnt, 2)} e Rede Básica ${num(linhaSel.rede_basica, 2)} R$/MWh; perdas de ${num(linhaSel.perdas, 2)} R$/MWh, ${pctOu(linhaSel.participacao_perdas_pct, 2)} da tarifa B1 sem tributos (${num(linhaSel.total, 2)} R$/MWh).`,
              `In the economic base (the tariff calculation base, not the tariff that appears on the bill): technical ${num(linhaSel.pt, 2, idioma)}, non-technical ${num(linhaSel.pnt, 2, idioma)} and basic transmission grid ${num(linhaSel.rede_basica, 2, idioma)} R$/MWh; losses of ${num(linhaSel.perdas, 2, idioma)} R$/MWh, ${pctOu(linhaSel.participacao_perdas_pct, 2, idioma)} of the B1 tariff before taxes (${num(linhaSel.total, 2, idioma)} R$/MWh).`,
            )}
          </p>
          <div className="mt-1">
            {prova.estado === "pronta" ? (
              <ComproveNumero evidencia={prova.evidencia} rotulo={tx("Comprove este valor", "Verify this value")} endereco={`https://scrutiniums.com/setor-eletrico/perdas/custo-e-contexto?d=${linhaSel.id}#custo`} />
            ) : prova.estado === "carregando" ? (
              <span role="status" className="text-xs text-carvao-muted">
                {tx("Carregando a evidência do processo tarifário.", "Loading the evidence for the tariff process.")}
              </span>
            ) : prova.estado === "erro" ? (
              <button type="button" className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4" onClick={tentarProva}>
                {tx(<>A evidência não carregou ({prova.erro}); tentar de novo</>, <>The evidence did not load ({prova.erro}); try again</>)}
              </button>
            ) : null}
          </div>
          </>
        )}
      </div>
      <TabelaInterativa
        titulo={tx("Componentes de perdas na tarifa residencial B1, por distribuidora", "Loss components in the B1 residential tariff, by distribution utility")}
        colunas={colunas(tx)}
        linhas={linhasTabela}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte={tx(
          "ANEEL, Componentes Tarifárias (TUSD_PT, TUSD_PNT, TUSD_Per_RB_D e TE_Per_RB da subclasse residencial B1 convencional)",
          "ANEEL, Componentes Tarifárias (TUSD_PT, TUSD_PNT, TUSD_Per_RB_D and TE_Per_RB of the conventional B1 residential subclass)",
        )}
        versao={versao}
        nomeArquivo="perdas-custo-tarifa-b1"
        chaveUrl="custo"
        selecionado={linhaSel ? linhaSel.id : null}
        onSelecionar={selecionar}
        ordemInicial={{ coluna: "perdas", direcao: "desc" }}
        dicaBusca={tx("Sigla ou nome", "Acronym or name")}
        nota={tx(
          <>
            Valores nominais, sem tributos, da base econômica do último processo tarifário de cada distribuidora no arquivo da fonte (base de cálculo tarifário, não a tarifa de aplicação que aparece na conta; o arquivo para
            baixar traz as duas bases). Processo vigente: início ≤ {dataBR(consultadaEm)} ≤ fim.
          </>,
          <>
            Nominal values, before taxes, of the economic base of the latest tariff process of each distribution utility in the source file (the tariff calculation base, not the applied tariff that appears on the bill; the
            download file has both bases). Process in force: start ≤ {dataBR(consultadaEm, idioma)} ≤ end.
          </>,
        )}
      />
    </div>
  );
}
