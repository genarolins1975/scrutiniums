"use client";

import { useState } from "react";
import { GraficoBarras, type ReferenciaBarra } from "@/components/energia/GraficoBarras";
import { TransicaoOpcoes } from "@/components/energia/TransicaoOpcoes";

/**
 * Mercado livre por UF em duas medidas, no mesmo lugar: participação e volume de energia. A participação é uma razão e esconde a escala (um
 * estado de consumo pequeno chega a participação alta com pouca energia, e o maior volume pode estar num estado de participação média); o
 * volume mostra o tamanho do mercado livre de cada UF e, empilhado com o cativo, o consumo na rede da UF. As duas medidas saem da mesma
 * janela de 12 meses da EPE e das mesmas UFs.
 *
 * O volume empilha livre e cativo porque as duas partes somam o consumo na rede (composição aditiva, a regra do GraficoBarras), e a ordem
 * é a do volume livre: o livre parte da base e pode ser comparado de uma UF para outra. Sem o rádio de volume quando não há UF com dado.
 *
 * A medida inicial é a participação (o que o servidor já entregava); `medidaInicial` existe para a página abrir no volume e para o teste
 * de servidor ler as duas visões. Cada visão é um GraficoBarras novo (`key`): dica, foco e "Mostrar todas" não passam de uma para outra.
 */
export type MedidaUf = "participacao" | "volume";

export type LinhaParticipacaoUf = { uf: string; livre: number | null };
export type LinhaVolumeUf = { uf: string; livre: number; cativo: number };

const OPCOES = [
  ["participacao", "Participação do livre (%)"],
  ["volume", "Volume de energia (GWh)"],
] as const;

export function GraficoLivreUf({
  janela,
  participacao,
  volume,
  referencias = [],
  medidaInicial = "participacao",
}: {
  /** Mês final da janela de 12 meses, por extenso (ex.: "jul/2026"), ou o texto que a substitui quando a fonte não publicou o mês. */
  janela: string;
  participacao: LinhaParticipacaoUf[];
  volume: LinhaVolumeUf[];
  /** Linhas de referência da participação (o total do Brasil); o volume não tem referência. */
  referencias?: ReferenciaBarra[];
  medidaInicial?: MedidaUf;
}) {
  const temVolume = volume.length > 0;
  const [escolhida, setMedida] = useState<MedidaUf>(medidaInicial);
  const medida: MedidaUf = temVolume ? escolhida : "participacao";
  const tituloParticipacao = `Participação do livre por UF, 12 meses até ${janela}`;
  const tituloVolume = `Consumo na rede por UF, livre e cativo, 12 meses até ${janela}`;

  return (
    <div className="space-y-3" data-livre-uf={medida}>
      {temVolume && <TransicaoOpcoes rotulo="Ver por" nome="livre-uf-medida" opcoes={OPCOES} valor={medida} onMudar={setMedida} />}
      {medida === "participacao" ? (
        <GraficoBarras
          key="participacao"
          titulo={tituloParticipacao}
          dados={participacao}
          chaveCategoria="uf"
          series={[{ id: "livre", rotulo: "Livre no consumo na rede", cor: "var(--cor-energia)" }]}
          unidade="%"
          casas={1}
          orientacao="horizontal"
          alturaCategoria={28}
          alturaMaxima={760}
          referencias={referencias}
        />
      ) : (
        <GraficoBarras
          key="volume"
          titulo={tituloVolume}
          dados={volume}
          chaveCategoria="uf"
          series={[
            { id: "livre", rotulo: "Livre", cor: "var(--cor-energia)" },
            { id: "cativo", rotulo: "Cativo", cor: "var(--serie-referencia)" },
          ]}
          unidade="GWh"
          casas={0}
          orientacao="horizontal"
          empilhado
          alturaCategoria={28}
          alturaMaxima={760}
        />
      )}
      {/* a troca de visão muda o gráfico abaixo do rádio: leitor de tela ouve qual passou a valer */}
      <p className="sr-only" aria-live="polite">
        {medida === "volume" ? `Mostrando: ${tituloVolume}, em GWh.` : `Mostrando: ${tituloParticipacao}.`}
      </p>
    </div>
  );
}
