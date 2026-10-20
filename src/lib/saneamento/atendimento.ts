import type { FichaMunicipio, Municipio } from "./tipos";
import { MOTIVO_TEXTO, SITUACAO_AGUA, SITUACAO_ESGOTO } from "./rotulos";

/**
 * População atendida com rede de abastecimento de água (IAG0001) e com rede coletora de esgoto (IES0001), como o prestador declara ao
 * SINISA. Um só rótulo, um só texto de contexto e uma só regra de ausência para a página aberta (src/app/aperitivo/saneamento), a ficha
 * completa do município, o capítulo de acesso e a comparação entre municípios: o mesmo número não pode ter duas leituras na plataforma.
 */

export type Servico = "agua" | "esgoto";

export const ATENDIMENTO_REDE: Record<
  Servico,
  { codigo: "IAG0001" | "IES0001"; rotulo: string; contexto: string; formula: string; medida: string }
> = {
  agua: {
    codigo: "IAG0001",
    rotulo: "População atendida com rede de abastecimento de água",
    contexto: "Parcela da população residente estimada pelo IBGE para 2024 que o prestador declara atender com rede de água (IAG0001).",
    formula: "(GTA0001 + GTA0002) ÷ DFE0001",
    medida: "sinisa-agua-atendida",
  },
  esgoto: {
    codigo: "IES0001",
    rotulo: "População atendida com rede coletora de esgoto",
    contexto: "Parcela da população residente estimada pelo IBGE para 2024 que o prestador declara atender com rede coletora de esgoto (IES0001).",
    formula: "(GTE0001 + GTE0002) ÷ DFE0001",
    medida: "sinisa-esgoto-atendida",
  },
};

/** Casas decimais do percentual, iguais nas páginas aberta e completa. */
export const CASAS_ATENDIMENTO = 2;

export type Atendimento = {
  /** Percentual (IAG0001 ou IES0001); null é ausência, nunca zero. */
  pct: number | null;
  /** Pessoas atendidas declaradas (GTA0001 + GTA0002 ou GTE0001 + GTE0002), só quando o indicador existe. */
  pessoas: number | null;
  /** Por que não há valor: o motivo publicado pelo SINISA e, se o município não participou, a situação no módulo. */
  motivo: string | null;
};

export function atendimentoRede(m: Municipio, ficha: FichaMunicipio, servico: Servico): Atendimento {
  const bloco = servico === "agua" ? ficha.sinisa.agua : ficha.sinisa.esgoto;
  const pct = servico === "agua" ? m.IAG0001 : m.IES0001;
  const pessoas = pct == null ? null : servico === "agua" ? m.ag_pop_at : m.es_pop_at;
  if (pct != null) return { pct, pessoas, motivo: null };
  const codigo = ATENDIMENTO_REDE[servico].codigo;
  const motivo = MOTIVO_TEXTO[bloco.motivos?.[codigo] ?? ""];
  const situacao = servico === "agua" ? SITUACAO_AGUA[ficha.sinisa.agua.situacao] : SITUACAO_ESGOTO[ficha.sinisa.esgoto.situacao];
  const participou = bloco.situacao === "participou";
  return { pct: null, pessoas: null, motivo: [motivo ?? situacao, motivo && !participou ? situacao : null].filter(Boolean).join(". ") + "." };
}
