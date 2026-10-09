"use client";

import { useMemo, type ReactNode } from "react";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEvidenciaPerdas, useSelecaoPerdas } from "@/components/energia/PerdasSelecao";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { dataBR, mesAno } from "@/lib/energia/formato";
import type { ColunaTabela } from "@/lib/energia/tabela";
import { degrausRegulatorio, fraseSelecaoRegulatorio, linhasTrechosRegulatorio, rotuloResolucao, type LinhaRegulatorio } from "@/lib/energia/perdas";
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
  // AAAA-MM como data: ordena pelo tempo (como texto, "abr/2025" viria antes de "jan/2020")
  { id: "inicio", rotulo: "Início do trecho", tipo: "data" },
  { id: "fim", rotulo: "Fim do trecho", tipo: "data" },
  { id: "meses", rotulo: "Meses", tipo: "numero", casas: 0 },
  { id: "pct", rotulo: "Percentual técnico do trecho", tipo: "numero", unidade: "% da injetada publicada", casas: 3 },
  { id: "pct_anterior", rotulo: "Percentual do trecho anterior de referência", tipo: "numero", unidade: "% da injetada publicada", casas: 3 },
  { id: "diferenca", rotulo: "Diferença contra o trecho anterior de referência", tipo: "numero", unidade: "p.p.", casas: 3 },
  { id: "resolucao", rotulo: "Resolução homologatória associada", tipo: "texto" },
  { id: "inicio_vigencia", rotulo: "Início de vigência da resolução", tipo: "data" },
];

export type PerdasRegulatorioProps = {
  linhas: LinhaRegulatorio[];
  /** perdas_evidencias_tecnica.json, lido só quando há distribuidora escolhida. */
  urlEvidencias: string;
  segmentos: Record<string, SegmentoTecnico[]>;
  ids: string[];
  rotulos: Record<string, string>;
  versao: string;
  /** Encaixe da página entre a figura (com a distribuidora escolhida) e a tabela: o estado de cada comparação que a página poderia fazer. */
  aposFigura?: ReactNode;
};

export function PerdasRegulatorio({ linhas, urlEvidencias, segmentos, ids, rotulos, versao, aposFigura }: PerdasRegulatorioProps) {
  const [sel, selecionar] = useSelecaoPerdas(ids);
  const linhaSel = sel ? linhas.find((l) => l.id === sel) ?? null : null;
  const [prova, tentarProva] = useEvidenciaPerdas(urlEvidencias, linhaSel ? linhaSel.id : null);
  const degraus = useMemo(() => (sel && segmentos[sel] ? degrausRegulatorio(segmentos[sel]) : []), [sel, segmentos]);
  const itens = useMemo(
    () =>
      linhas.map((l) => ({
        id: l.id,
        rotulo: l.rotulo,
        valor: l.atual,
        referencia: l.anterior,
        detalhe: `trecho mais recente de ${mesAno(l.inicio)} a ${mesAno(l.fim)} (${l.meses} meses)${l.anterior_inicio && l.anterior_fim ? `; trecho anterior de referência de ${mesAno(l.anterior_inicio)} a ${mesAno(l.anterior_fim)}` : "; sem trecho anterior de referência"}${l.resolucao ? `; ${rotuloResolucao(l.resolucao)}, vigência em ${dataBR(l.inicio_vigencia)}` : ""}`,
      })),
    [linhas],
  );
  const linhasTabela = useMemo(() => linhasTrechosRegulatorio(segmentos, rotulos), [segmentos, rotulos]);
  const selTabela = sel ? linhasTabela.find((l) => l.cnpj === sel)?.id ?? null : null;

  return (
    <div className="space-y-5">
      <GraficoPontos
        titulo="Percentual técnico regulatório implícito: trecho mais recente e trecho anterior"
        itens={itens}
        unidade="%"
        casas={3}
        rotuloValor="Trecho mais recente"
        rotuloReferencia="Trecho anterior de referência"
        textoSentido={{ acima: "maior que no trecho anterior", abaixo: "menor que no trecho anterior", igual: "igual ao trecho anterior" }}
        selecionado={linhaSel ? linhaSel.id : null}
        onSelecionar={selecionar}
        ordemInicial={{ por: "valor", direcao: "desc" }}
        chaveUrl="graf"
      />

      <div className="border border-linha bg-papel px-4 py-3 text-sm text-carvao" data-selecao={sel ?? ""}>
        {!sel ? (
          <p className="text-carvao-muted">Escolha um ponto ou uma linha da tabela para ver, mês a mês, o percentual técnico dessa distribuidora.</p>
        ) : !linhaSel ? (
          <p>{rotulos[sel] ?? sel}: nenhum trecho de 6 meses ou mais com o mesmo percentual técnico foi identificado na série do SAMP (trechos curtos ficam só no arquivo para download).</p>
        ) : (
          <>
            <p data-resposta="regulatorio-distribuidora">{fraseSelecaoRegulatorio(linhaSel, segmentos[sel]?.length ?? 0)}</p>
            <div className="mt-1">
              {prova.estado === "pronta" ? (
                <ComproveNumero evidencia={prova.evidencia} rotulo="Comprove este percentual" endereco={`https://scrutiniums.com/setor-eletrico/perdas/regulatorio?d=${linhaSel.id}#regulatorio`} />
              ) : prova.estado === "carregando" ? (
                <span role="status" className="text-xs text-carvao-muted">
                  Carregando a evidência do trecho.
                </span>
              ) : prova.estado === "erro" ? (
                <button type="button" className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4" onClick={tentarProva}>
                  A evidência não carregou ({prova.erro}); tentar de novo
                </button>
              ) : null}
            </div>
            {linhaSel.resolucao && (
              <p className="mt-1 max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-nota-ficha="">
                A ficha cita a troca contra o trecho imediatamente anterior, curto ou não, que o observatório usa para associar a resolução; a diferença desta página é contra o trecho de referência anterior.
              </p>
            )}
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

      {aposFigura}

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
        nota={
          <>
            Inferência do observatório (natureza estimada): trecho de 6 meses ou mais com a mesma razão técnica ÷ injetada publicada. Não é a leitura do ato homologatório. A diferença é a mesma do gráfico: percentual do trecho
            menos o do trecho de referência anterior da lista; fica sem dado no primeiro trecho de referência da série ou quando o anterior não consta na lista (o arquivo para baixar traz todos os trechos, e a coluna troca_pp dele é
            contra o trecho imediatamente anterior, curto ou não, ou contra o mês anterior).
          </>
        }
      />
    </div>
  );
}
