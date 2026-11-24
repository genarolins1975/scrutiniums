/**
 * Fichas de proveniência das figuras do painel Segurança pública (Sinesp, SIM e IBGE), lidas da gold. Saíram da página por estado
 * para servir também à figura de evolução do panorama, com o mesmo texto: uma ficha por fonte, nunca duas versões do mesmo método.
 */
import { fichaDaFigura } from "@/lib/eficiencia/fichaDaFigura";
import { HREF_GOLD } from "@/lib/eficiencia/seguranca/dados";
import type { GoldSeguranca } from "@/lib/eficiencia/seguranca/tipos";

export function fichasSeguranca(g: GoldSeguranca) {
  const periodo = { inicio: String(g.anos[0]), fim: String(g.anos.at(-1)) };
  const base = { referencia: periodo, versao: g.versao, sha256: g.hash_dados, snapshot: HREF_GOLD.replace(/^\//, "public/") };
  const sinesp = fichaDaFigura({
    ...base,
    indicador: "Ocorrências e vítimas registradas pelas polícias estaduais, por UF, e taxa por 100 mil habitantes",
    natureza: "CALCULADO",
    orgao: "Ministério da Justiça e Segurança Pública",
    conjunto: "Sinesp VDE",
    recurso: "Bases anuais do Sinesp VDE, uma planilha por ano",
    url: g.fontes.sinesp.pagina,
    unidade: "ocorrências ou vítimas; taxa por 100 mil habitantes",
    frequencia: "Mensal, somada nos 12 meses do ano",
    capturadoEm: g.fontes.sinesp.capturado_em,
    formula: "Taxa = contagem do ano ÷ população residente da UF (IBGE) × 100 mil",
    limitacoes: [
      "O Sinesp traz o que as polícias estaduais registraram e classificaram. Mudança de sistema ou de regra de classificação numa UF muda a série dela.",
      "Ano que não chegou completo ao Sinesp aparece como ausência, não como queda.",
    ],
  });
  const sim = fichaDaFigura({
    ...base,
    indicador: "Óbitos por agressão, por UF de residência, e taxa por 100 mil habitantes",
    natureza: "CALCULADO",
    orgao: "Ministério da Saúde",
    conjunto: "SIM, pelo TabNet do DATASUS",
    recurso: "Óbitos por causas externas, por UF de residência",
    url: g.fontes.sim.pagina,
    unidade: "óbitos; taxa por 100 mil habitantes",
    frequencia: "Anual",
    capturadoEm: g.fontes.sim.capturado_em,
    limitacoes: ["O dado mais recente do SIM é preliminar e costuma subir quando se torna final."],
  });
  const ibge = fichaDaFigura({
    ...base,
    indicador: "População residente por UF, total e mulheres",
    natureza: "ESTIMADO",
    orgao: "IBGE",
    conjunto: g.fontes.ibge.rotulo,
    recurso: g.fontes.ibge.nome,
    url: g.fontes.ibge.url,
    unidade: "pessoas",
    frequencia: "Anual (população em 1º de julho)",
    capturadoEm: g.fontes.ibge.capturado_em,
    limitacoes: [`A população é a do IBGE, ${g.fontes.ibge.rotulo}, ${g.fontes.ibge.base}. Taxas publicadas antes, com as estimativas da época, diferem destas.`],
  });
  return { sinesp, sim, ibge };
}
