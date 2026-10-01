"use client";

import { useMemo } from "react";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useSelecaoPerdas } from "@/components/energia/PerdasSelecao";
import { dataBR, mesAno, num, sinal } from "@/lib/energia/formato";
import type { ColunaTabela } from "@/lib/energia/tabela";
import { degrausRegulatorio, rotuloResolucao, type LinhaRegulatorio } from "@/lib/energia/perdas";
import type { SegmentoTecnico } from "@/lib/energia/tipos-perdas";

/**
 * Percentual técnico regulatório implícito no SAMP (P057): nível do trecho mais recente de
 * cada distribuidora contra o trecho anterior (pontos pareados: o parâmetro mudou de um
 * processo tarifário para o seguinte?), degraus mensais da distribuidora escolhida e a
 * tabela de todos os trechos de referência publicados na gold.
 *
 * O que este painel não faz, de propósito: comparar a perda técnica realizada com esse
 * percentual (a técnica do SAMP é o próprio percentual aplicado à injetada, então a
 * diferença seria zero por construção) nem comparar a não técnica realizada com a
 * referência regulatória, que a fonte aberta não publica (bloqueio no painel).
 */

const COLUNAS: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Distribuidora", tipo: "texto" },
  { id: "inicio", rotulo: "Início do trecho", tipo: "texto" },
  { id: "fim", rotulo: "Fim do trecho", tipo: "texto" },
  { id: "meses", rotulo: "Meses", tipo: "numero", casas: 0 },
  { id: "pct", rotulo: "Percentual técnico", tipo: "numero", unidade: "% da injetada publicada", casas: 3 },
  { id: "troca_pp", rotulo: "Troca contra o trecho anterior", tipo: "numero", unidade: "p.p.", casas: 3 },
  { id: "resolucao", rotulo: "Resolução homologatória associada", tipo: "texto" },
  { id: "inicio_vigencia", rotulo: "Início de vigência da resolução", tipo: "data" },
];

export type PerdasRegulatorioProps = {
  linhas: LinhaRegulatorio[];
  segmentos: Record<string, SegmentoTecnico[]>;
  ids: string[];
  rotulos: Record<string, string>;
  versao: string;
};

export function PerdasRegulatorio({ linhas, segmentos, ids, rotulos, versao }: PerdasRegulatorioProps) {
  const [sel, selecionar] = useSelecaoPerdas(ids);
  const linhaSel = sel ? linhas.find((l) => l.id === sel) ?? null : null;
  const degraus = useMemo(() => (sel && segmentos[sel] ? degrausRegulatorio(segmentos[sel]) : []), [sel, segmentos]);
  const itens = useMemo(
    () =>
      linhas.map((l) => ({
        id: l.id,
        rotulo: l.rotulo,
        valor: l.atual,
        referencia: l.anterior,
        detalhe: `trecho de ${mesAno(l.inicio)} a ${mesAno(l.fim)} (${l.meses} meses)${l.resolucao ? `; ${rotuloResolucao(l.resolucao)}, vigência em ${dataBR(l.inicio_vigencia)}` : ""}`,
      })),
    [linhas],
  );
  const linhasTabela = useMemo(
    () =>
      Object.entries(segmentos).flatMap(([cnpj, segs]) =>
        segs.map((s) => ({
          id: `${cnpj}-${s.inicio}`,
          cnpj,
          rotulo: rotulos[cnpj] ?? cnpj,
          inicio: mesAno(s.inicio),
          fim: mesAno(s.fim),
          meses: s.meses,
          pct: s.pct,
          troca_pp: s.troca_pp,
          resolucao: s.reh?.resolucao ?? null,
          inicio_vigencia: s.reh?.inicio_vigencia ?? null,
        })),
      ),
    [segmentos, rotulos],
  );
  const selTabela = sel ? linhasTabela.find((l) => l.cnpj === sel)?.id ?? null : null;

  return (
    <div className="space-y-5">
      <GraficoPontos
        titulo="Percentual técnico regulatório implícito: trecho mais recente e trecho anterior"
        itens={itens}
        unidade="%"
        casas={3}
        rotuloValor="Trecho mais recente"
        rotuloReferencia="Trecho anterior"
        selecionado={linhaSel ? linhaSel.id : null}
        onSelecionar={selecionar}
        ordemInicial={{ por: "valor", direcao: "desc" }}
      />

      <div className="border border-linha bg-papel px-4 py-3 text-sm text-carvao" data-selecao={sel ?? ""}>
        {!sel ? (
          <p className="text-carvao-muted">Escolha um ponto, uma linha da tabela ou uma área do mapa para ver os degraus mensais do percentual técnico dessa distribuidora.</p>
        ) : !linhaSel ? (
          <p>{rotulos[sel] ?? sel}: nenhum trecho de 6 meses ou mais com o mesmo percentual técnico foi identificado na série do SAMP (trechos curtos ficam só no arquivo para download).</p>
        ) : (
          <>
            <p data-resposta="regulatorio-distribuidora">
              {`${linhaSel.rotulo}: ${num(linhaSel.atual, 3)}% da energia injetada publicada de ${mesAno(linhaSel.inicio)} a ${mesAno(linhaSel.fim)} (${linhaSel.meses} meses)`}
              {linhaSel.anterior !== null && linhaSel.troca_pp !== null ? `, ${sinal(linhaSel.troca_pp, 3)} p.p. em relação ao trecho anterior (${num(linhaSel.anterior, 3)}%)` : ""}
              {linhaSel.resolucao ? `; a troca coincide com o início de vigência da ${rotuloResolucao(linhaSel.resolucao)} em ${dataBR(linhaSel.inicio_vigencia)}` : ""}.
              {linhaSel.n_segmentos > (segmentos[sel]?.length ?? 0) ? ` A gold traz os ${segmentos[sel]?.length ?? 0} trechos mais recentes de ${linhaSel.n_segmentos}; os demais estão no arquivo para download.` : ""}
            </p>
            {degraus.length > 0 && (
              <div className="mt-3">
                <GraficoLinhas
                  titulo={`${linhaSel.rotulo}: percentual técnico regulatório implícito, mês a mês`}
                  dados={degraus}
                  chaveX="m"
                  formatoX="mes"
                  series={[{ id: "pct", rotulo: "Percentual técnico", cor: "var(--escala-seq-4)" }]}
                  unidade="% da injetada publicada"
                  casas={3}
                  altura={220}
                />
                <p className="mt-2 text-xs text-carvao-muted">Lacuna é mês de troca ou trecho curto (a fonte mistura as duas taxas no mês da troca), nunca repetição do valor anterior.</p>
              </div>
            )}
          </>
        )}
      </div>

      <TabelaInterativa
        titulo="Trechos de referência do percentual técnico"
        colunas={COLUNAS}
        linhas={linhasTabela}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte="ANEEL, SAMP Balanço (perdas técnicas e energia injetada publicada); ANEEL, Componentes Tarifárias (início de vigência das resoluções)"
        versao={versao}
        nomeArquivo="perdas-percentual-tecnico-trechos"
        chaveUrl="reg"
        selecionado={selTabela}
        onSelecionar={(id) => selecionar(id ? linhasTabela.find((l) => l.id === id)?.cnpj ?? null : null)}
        ordemInicial={{ coluna: "pct", direcao: "desc" }}
        dicaBusca="Sigla ou nome"
        nota={<>Inferência do observatório (natureza estimada): trecho de 6 meses ou mais com a mesma razão técnica ÷ injetada publicada. Não é a leitura do ato homologatório.</>}
      />
    </div>
  );
}
