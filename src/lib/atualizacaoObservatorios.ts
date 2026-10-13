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

export function atualizacaoObservatorio(id: DominioId): { rotulo: string; linhas: string[] } {
  if (id === "estados") {
    return { rotulo: "Fontes e cobertura", linhas: [
      "Tesouro Nacional / Siconfi: RREO Anexo 01 e RGF Anexo 02.",
      `${primariosEstaduais.cobertura.ufs} UFs · ${primariosEstaduais.cobertura.observacoes} observações · ${primariosEstaduais.cobertura.respostas} respostas preservadas.`,
      `Captura em ${dataBR(primariosEstaduais.captura)}. Encerramento de 2025 e dívida parcial de 2026.`,
      "Indicadores de execução financeira; dados educacionais ainda não publicados.",
    ] };
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
