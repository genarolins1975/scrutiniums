import type { ContextoFicha } from "@/components/eficiencia/FichaConteudo";
import { resumoCobertura } from "../contexto";
import { dataBr } from "../formato";
import { ROTULO_FONTE } from "./rotulos";
import type { GoldSaude } from "./tipos";

/** Validações (ids de pipeline/eficiencia_saude/validacoes.py) que conferem cada indicador. */
export const VALIDACOES_DO_INDICADOR_SAUDE: Record<string, string[]> = {
  "ctx.populacao.residente": ["S10", "S13"],
  "sau.despesa.funcao_saude": ["S01", "S02", "S03", "S10", "S11", "S12", "S13", "M01", "M02"],
  "sau.despesa.por_habitante": ["S03", "S10", "S11", "S14"],
  "sau.despesa.subfuncao": ["S02", "S10", "S13"],
  "sau.despesa.natureza": ["S03", "S04", "S10", "M01"],
  "sau.asps.percentual_aplicado": ["S05", "S06", "S10", "S13"],
  "sau.asps.valor_aplicado": ["S05", "S10", "S13"],
  "sau.asps.base_receita": ["S05", "S10", "S13"],
  "sau.despesa.por_fonte": ["S07", "S10", "S13"],
  "sau.rede.ubs_publicas": ["S10", "S13", "M03"],
  "sau.rede.ubs_publicas_por_10mil": ["S10", "S13", "S15", "M03"],
  "sau.rede.ubs_retrato": ["S10", "S13", "M03"],
  "sau.aps.equipes": ["S08", "S10", "S13"],
  "sau.aps.equipes_por_10mil": ["S08", "S10", "S13", "S15"],
  "sau.aps.cobertura_potencial": ["S08", "S10", "S11", "S13", "M05"],
  "sau.icsap.internacoes": ["S09", "S10", "S13"],
  "sau.icsap.taxa": ["S09", "S10", "S13", "S15", "M04"],
  "sau.icsap.participacao": ["S09", "S10", "S13", "S15"],
  "sau.icsap.grupos": ["S09", "S10", "S13"],
  "sau.ctx.cobertura_planos": ["S10", "S13"],
  "sau.aps.producao": ["S16"],
  "sau.rede.profissionais_carga_horaria": ["S16"],
  "sau.despesa.por_atendimento": ["S16"],
};

export function contextosSaude(g: GoldSaude): Record<string, ContextoFicha> {
  const fontes = new Map(g.fontes.map((f) => [f.id, f]));
  const val = new Map(g.validacoes.map((v) => [v.id, v]));
  const out: Record<string, ContextoFicha> = {};
  for (const f of g.indicadores) {
    const coletas = f.fontes
      .map((id) => fontes.get(id))
      .filter((x): x is NonNullable<typeof x> => !!x)
      .map((x) => {
        const ultima = [...x.capturas].sort((a, b) => ((a.capturado_em ?? "") < (b.capturado_em ?? "") ? 1 : -1))[0];
        return { fonte: ROTULO_FONTE[x.id] ?? x.id, capturado_em: dataBr(ultima.capturado_em), pagina: ultima.pagina };
      });
    out[f.id] = {
      cobertura: resumoCobertura(g.cobertura[f.id], {}),
      coletas,
      validacoes: (VALIDACOES_DO_INDICADOR_SAUDE[f.id] ?? []).map((id) => val.get(id)).filter((v): v is NonNullable<typeof v> => !!v).map((v) => ({ id: v.id, titulo: v.titulo, resultado: v.resultado })),
    };
  }
  return out;
}
