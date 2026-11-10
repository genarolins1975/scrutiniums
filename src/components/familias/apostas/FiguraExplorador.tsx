import type { ReactNode } from "react";
import { FiguraAnalitica } from "@/components/painel/FiguraAnalitica";
import { LeituraGuiada } from "@/components/painel/LeituraGuiada";
import { mesAno } from "@/lib/perguntas/leitura";
import { provCurada, type SeriesCredito } from "@/lib/familias/apostas";
import { ExploradorCredito } from "./ExploradorCredito";

/**
 * A figura do explorador de crédito, comum a "Apostas e crédito das famílias" e a "Golpes e fraudes": um indicador mensal de crédito
 * das famílias por vez (gold pulse.json, séries do Banco Central), com os marcos do tema anotados. A tabela equivalente traz todos os
 * indicadores da janela, no valor publicado, e sai inteira no HTML do servidor.
 */
export function FiguraExplorador({
  id,
  pergunta,
  credito,
  desde,
  marcos,
  rotuloMarcos,
  arquivo,
  naoConcluir,
  comoInterpretar,
  ressalva,
  depois,
}: Readonly<{
  id: string;
  pergunta: string;
  credito: SeriesCredito;
  /** Primeiro mês da janela ("AAAA-MM"). */
  desde: string;
  marcos: readonly { x: string; rotulo: string }[];
  rotuloMarcos: string;
  arquivo: string;
  naoConcluir: ReactNode;
  comoInterpretar: ReactNode;
  ressalva: ReactNode;
  depois?: ReactNode;
}>) {
  const janela = credito.linhas.filter((l) => l.mes >= desde);
  const inicio = janela[0]?.mes ?? desde;
  const primeiro = credito.indicadores[0];
  return (
    <FiguraAnalitica
      id={id}
      pergunta={pergunta}
      subtitulo={`Um indicador mensal de crédito das famílias por vez · unidade de cada série · Brasil, ${mesAno(inicio)} a ${mesAno(credito.ultimoMes)}`}
      natureza="OBSERVADO"
      proveniencia={provCurada({
        indicador: "Indicadores mensais de crédito das famílias e de controle",
        natureza: "OBSERVADO",
        orgao: "Banco Central",
        dataset: "Sistema Gerenciador de Séries Temporais",
        recurso: credito.indicadores.map((i) => `${i.rotulo}: série ${i.codigo}`).join("; "),
        url: primeiro?.url ?? "",
        unidade: "a de cada série",
        frequencia: "mensal",
        inicio: credito.primeiroMes,
        fim: credito.ultimoMes,
        geradoEm: credito.geradoEm,
        capturadoEm: primeiro?.coletadoEm ?? null,
        pipeline: "Pipeline do Observatório do Crédito, gold pulse.json",
        curada: false,
        transformacoes: ["Base 100 e desvios-padrão são calculados na página, sobre a janela exibida, a partir do valor publicado."],
        limitacoes: ["As séries terminam em meses diferentes: comprometimento e endividamento saem com cerca de dois meses de defasagem."],
      })}
      leitura={
        <LeituraGuiada>
          Escolha um indicador e veja onde caem os marcos. A linha é só a série de crédito: a exposição ao tema não entra no gráfico, porque não há observações
          bastantes para comparar.
        </LeituraGuiada>
      }
      comoInterpretar={comoInterpretar}
      naoConcluir={naoConcluir}
      ressalva={ressalva}
      tabela={{
        titulo: `Indicadores de crédito das famílias e de controle, valor publicado, ${mesAno(inicio)} a ${mesAno(credito.ultimoMes)}`,
        colunas: ["Mês", ...credito.indicadores.map((i) => `${i.rotulo} (${i.unidade})`)],
        linhas: janela.map((l) => [mesAno(l.mes), ...credito.indicadores.map((i) => (typeof l[i.key] === "number" ? (l[i.key] as number) : null))]),
        casas: [null, ...credito.indicadores.map(() => 2)],
        limite: janela.length,
      }}
      depois={depois}
    >
      <ExploradorCredito
        indicadores={credito.indicadores.map(({ key, rotulo, unidade, fonte, codigo }) => ({ key, rotulo, unidade, fonte, codigo }))}
        linhas={credito.linhas}
        desde={desde}
        marcos={marcos}
        rotuloMarcos={rotuloMarcos}
        arquivo={arquivo}
      />
    </FiguraAnalitica>
  );
}
