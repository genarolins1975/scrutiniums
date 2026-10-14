/**
 * Atualidade de cada observatório, lida das golds e snapshots publicados.
 *
 * Usada na página inicial e na escolha de observatório pós login. Leitura
 * síncrona de arquivos do repositório; devolve texto já formatado e declara a
 * ausência ("indisponível no momento") em vez de inventar data.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DominioId } from "@/lib/dominios";
import { gold, integra } from "@/lib/energia/gold";
import { metaEducacao } from "@/lib/eficiencia/dados";
import { carimbo, dataBR, mesAno } from "@/lib/energia/formato";
import primariosEstaduais from "@/lib/contas-estaduais/primarios.json";
import custos from "@/lib/contas-publicas/snapshots/custos.json";
import { goldGas } from "@/lib/gas/gold";
import { mesExtenso } from "@/lib/gas/formato";

export function atualizacaoObservatorio(id: DominioId): { rotulo: string; linhas: string[] } {
  if (id === "saneamento") {
    try {
      const m = JSON.parse(readFileSync(join(process.cwd(), "public", "saneamento", "gold", "meta.json"), "utf-8"));
      return { rotulo: "Fontes e cobertura", linhas: [
        `SINISA ${m.sinisa.ano_referencia + 1} (ano de referência ${m.sinisa.ano_referencia}): ${m.cobertura.agua_participantes.toLocaleString("pt-BR")} municípios em água e ${m.cobertura.esgoto_participantes.toLocaleString("pt-BR")} com indicadores de esgoto.`,
        `IBGE, Censo 2022 e 2010: ${m.cobertura.municipios_censo_2022.toLocaleString("pt-BR")} municípios.`,
        `Captura em ${dataBR(m.sinisa.capturado_em.slice(0, 10))}. Base municipal de água retificada em ${dataBR(m.sinisa.retificacao_agua_municipal)}.`,
        "Preço regulado em amostra de atos verificados; capítulos de saúde e desigualdades em preparação.",
      ] };
    } catch {
      return { rotulo: "Fontes e cobertura", linhas: ["Dados indisponíveis no momento."] };
    }
  }
  if (id === "estados") {
    return { rotulo: "Fontes e cobertura", linhas: [
      "Tesouro Nacional / Siconfi: RREO Anexo 01 e RGF Anexo 02.",
      `${primariosEstaduais.cobertura.ufs} UFs · ${primariosEstaduais.cobertura.observacoes} observações · ${primariosEstaduais.cobertura.respostas} respostas preservadas.`,
      `Captura em ${dataBR(primariosEstaduais.captura)}. Encerramento de 2025 e dívida parcial de 2026.`,
      "Indicadores de execução financeira; dados educacionais ainda não publicados.",
    ] };
  }
  if (id === "gas") {
    try {
      const m = goldGas.meta();
      const u = m.ultimos_meses;
      const linhas = [];
      if (u.producao) linhas.push(`Produção e aproveitamento (ANP): até ${mesExtenso(u.producao)}`);
      if (u["gas-de-cozinha"]) linhas.push(`Preço do botijão e do GNV (ANP): até ${mesExtenso(u["gas-de-cozinha"])}`);
      if (u.precos) linhas.push(`Preço de venda às distribuidoras (ANP): até ${mesExtenso(u.precos)}`);
      if (m.dados_capturados_em) linhas.push(`Fontes capturadas até ${carimbo(m.dados_capturados_em)}`);
      return { rotulo: "Último dado disponível", linhas: linhas.length ? linhas : ["Data de referência indisponível no momento."] };
    } catch {
      return { rotulo: "Último dado disponível", linhas: ["Data de referência indisponível no momento."] };
    }
  }
  if (id === "contas") {
    return { rotulo: "Fontes e cobertura", linhas: [
      "SIOP: execução orçamentária e acompanhamento das entregas físicas.",
      "Tesouro Nacional: resultado fiscal, restos a pagar e custos da União.",
      `Custos: RFC ${custos.periodo[1]}; captura em ${dataBR(custos.captura.slice(0, 10))}.`,
      "Os períodos variam por base e estão identificados em cada painel.",
    ] };
  }
  if (id === "credito") {
    try {
      const meta = JSON.parse(readFileSync(join(process.cwd(), "public", "obs", "data", "gold", "meta.json"), "utf-8"));
      const linhas = [];
      if (meta?.vintages?.sgs) linhas.push(`Crédito do SFN (BCB/SGS): data-base ${mesAno(meta.vintages.sgs)}`);
      if (meta?.vintages?.ifdata) linhas.push(`Instituições (IF.data): data-base ${mesAno(meta.vintages.ifdata)}`);
      if (meta?.gerado_em) linhas.push(`Processado em ${carimbo(meta.gerado_em)}`);
      return { rotulo: "Último dado disponível", linhas: linhas.length ? linhas : ["Data-base indisponível no momento."] };
    } catch {
      return { rotulo: "Último dado disponível", linhas: ["Data-base indisponível no momento."] };
    }
  }
  if (id === "eficiencia") {
    const m = metaEducacao();
    const linhas = [];
    if (m?.dados_capturados_ate) linhas.push(`Educação municipal nas capitais: dados capturados até ${dataBR(m.dados_capturados_ate.slice(0, 10))}`);
    if (m?.gerado_em) linhas.push(`Processado em ${carimbo(m.gerado_em)}`);
    return { rotulo: "Último dado disponível", linhas: linhas.length ? linhas : ["Data de captura indisponível no momento."] };
  }
  const hid = gold.hidrologia();
  const pld = gold.pld();
  const meta = gold.meta();
  const linhas = [];
  if (integra(hid)) linhas.push(`Operação do SIN (ONS): dados até ${dataBR(hid.dia_referencia_ear)}`);
  if (integra(pld)) linhas.push(`PLD (CCEE): até ${dataBR(pld.dia_referencia)}`);
  if (meta?.gerado_em) linhas.push(`Processado em ${carimbo(meta.gerado_em)}`);
  return { rotulo: "Última atualização operacional", linhas: linhas.length ? linhas : ["Atualização indisponível no momento."] };
}
