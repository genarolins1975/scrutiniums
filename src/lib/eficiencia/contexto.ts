import type { ContextoFicha } from "@/components/eficiencia/FichaConteudo";
import type { GoldEducacao, IndicadorId, LinhaCobertura } from "./tipos";
import { dataBr } from "./formato";

/**
 * Contexto de cada passaporte, montado no servidor a partir da gold:
 * cobertura observada, datas de coleta das fontes e validações que se aplicam.
 */

/** Validações que conferem cada indicador (ids de pipeline/eficiencia/validacoes.py). */
export const VALIDACOES_DO_INDICADOR: Record<IndicadorId, string[]> = {
  "edu.despesa.funcao_educacao": ["V01", "V03", "V04", "V07", "V08", "V09", "V10"],
  "edu.despesa.subfuncao": ["V03", "V07", "V09"],
  "edu.matriculas.rede_municipal": ["V02", "V05", "V06", "V07", "V08", "V09", "V10"],
  "edu.matriculas.conveniadas_municipais": ["V02", "V06", "V07", "V09", "V10"],
  "edu.atu.rede_municipal": ["V02", "V09", "V10"],
  "edu.aprovacao.rede_municipal": ["V02", "V09", "V10", "V12"],
  "edu.ideb.rede_municipal": ["V02", "V09", "V10", "V11", "V12"],
  "edu.saeb.rede_municipal": ["V02", "V09", "V10", "V11"],
  "edu.despesa_por_matricula": ["M01"],
};

const GRUPO_FONTE: Record<string, string> = {
  siconfi_dca_anexo_i_e: "siconfi_dca_anexo_i_e",
  ibge_ipca: "ibge_ipca",
  inep_censo: "inep_censo",
  inep_atu: "inep_atu",
  inep_rendimento: "inep_rendimento",
  inep_ideb: "inep_ideb",
};

const ROTULO_FONTE: Record<string, string> = {
  siconfi_dca_anexo_i_e: "Siconfi, DCA Anexo I-E",
  ibge_ipca: "IBGE, IPCA",
  inep_censo: "INEP, microdados do Censo Escolar",
  inep_atu: "INEP, Média de Alunos por Turma",
  inep_rendimento: "INEP, Taxas de Rendimento",
  inep_ideb: "INEP, Ideb",
};

export function resumoCobertura(linhas: LinhaCobertura[] | undefined, nomesEtapa: Record<string, string>): string[] {
  if (!linhas?.length) return [];
  const porEtapa = new Map<string, LinhaCobertura[]>();
  for (const l of linhas) {
    const k = l.etapa ?? "";
    porEtapa.set(k, [...(porEtapa.get(k) ?? []), l]);
  }
  const out: string[] = [];
  for (const [etapa, ls] of Array.from(porEtapa.entries())) {
    const ord = [...ls].sort((a, b) => a.ano - b.ano);
    const rotulo = etapa ? `${nomesEtapa[etapa] ?? etapa}: ` : "";
    const faixa = ord
      .map((l) => `${l.ano}: ${l.com_valor} de ${l.elegiveis} com valor${l.comparaveis !== l.com_valor ? `, ${l.comparaveis} na comparação` : ""}`)
      .join("; ");
    const faltas = ord
      .filter((l) => l.sem_valor.length)
      .map((l) => `${l.ano} (${l.sem_valor.map((s) => s.nome).join(", ")})`)
      .join("; ");
    const fora = ord
      .filter((l) => l.fora_da_comparacao?.length)
      .map((l) => `${l.ano} (${l.fora_da_comparacao.map((s) => s.nome).join(", ")})`)
      .join("; ");
    out.push(`${rotulo}${faixa}.${faltas ? ` Sem valor: ${faltas}.` : ""}${fora ? ` Com valor oficial, fora da comparação: ${fora}.` : ""}`);
  }
  return out;
}

export function contextos(g: GoldEducacao): Record<string, ContextoFicha> {
  const nomesEtapa = Object.fromEntries(g.etapas.map((e) => [e.id, e.nome.toLowerCase()]));
  const fontes = new Map(g.fontes.map((f) => [f.id, f]));
  const val = new Map(g.validacoes.map((v) => [v.id, v]));
  const out: Record<string, ContextoFicha> = {};
  for (const f of g.indicadores) {
    const coletas = f.fontes
      .map((id) => fontes.get(GRUPO_FONTE[id] ?? id))
      .filter((x): x is NonNullable<typeof x> => !!x)
      .map((x) => {
        const ultima = [...x.capturas].sort((a, b) => (a.capturado_em < b.capturado_em ? 1 : -1))[0];
        return { fonte: ROTULO_FONTE[x.id] ?? x.id, capturado_em: dataBr(ultima.capturado_em), pagina: ultima.pagina };
      });
    out[f.id] = {
      cobertura: resumoCobertura(g.cobertura[f.id], nomesEtapa),
      coletas,
      validacoes: (VALIDACOES_DO_INDICADOR[f.id] ?? [])
        .map((id) => val.get(id))
        .filter((v): v is NonNullable<typeof v> => !!v)
        .map((v) => ({ id: v.id, titulo: v.titulo, resultado: v.resultado })),
    };
  }
  return out;
}
