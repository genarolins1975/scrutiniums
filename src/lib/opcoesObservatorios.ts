import { DOMINIOS, type Dominio, type DominioId } from "@/lib/dominios";

/** O seletor oferece também acesso direto a módulos, sem alterar os domínios analíticos. */
export type OpcaoObservatorioId = DominioId | "judiciario";
export type OpcaoObservatorio = Omit<Dominio, "id"> & {
  id: OpcaoObservatorioId;
  dominioId: DominioId;
};

const judiciario: OpcaoObservatorio = {
  id: "judiciario",
  dominioId: "eficiencia",
  nome: "Observatório Brasileiro do Judiciário",
  nomeCurto: "Judiciário",
  pergunta: "Quanto custa o Judiciário, quanto tempo leva e como os tribunais se comparam?",
  descricao: "Recursos, tempos, filas e indicadores oficiais da Justiça Estadual, Federal e do Trabalho. Módulo conectado ao Observatório Brasileiro de Eficiência Estatal.",
  descricaoCurta: "CNJ, Justiça em Números: três ramos, 57 tribunais, despesas, tempos, congestionamento e IPC-Jus oficial. Baixa processual não comprova cumprimento do direito.",
  chips: ["Recursos", "Tempos", "Filas", "Tribunais"],
  rotaRaiz: "/eficiencia-estatal/judiciario",
  rotaApresentacao: "/eficiencia-estatal/judiciario",
  cta: "Explorar Judiciário",
  acento: "obee",
  prefixosTelemetria: [],
};

export const OPCOES_OBSERVATORIOS: OpcaoObservatorio[] = DOMINIOS.flatMap((d) => {
  const opcao = { ...d, dominioId: d.id };
  return d.id === "eficiencia" ? [opcao, judiciario] : [opcao];
});

/** Allowlist compartilhada pelo cartão e pelo POST; nunca aceita um destino arbitrário. */
export function opcaoObservatorio(id: unknown): OpcaoObservatorio | undefined {
  return typeof id === "string" ? OPCOES_OBSERVATORIOS.find((opcao) => opcao.id === id) : undefined;
}
