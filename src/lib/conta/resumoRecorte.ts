import { NOME_UF } from "@/lib/energia/expansao";
import type { Idioma } from "@/lib/idioma";

export type ParteRecorte = { texto: string; nome?: boolean };

/**
 * 27/10/2026, revisão independente: reconhecer o recorte sem decifrar chaves de
 * gráficos. Somente contratos conhecidos recebem rótulos; o endereço completo
 * continua disponível. O resumo não calcula indicadores nem inventa valores ausentes.
 */
export function resumoRecorte(caminho: string, idioma: Idioma = "pt"): ParteRecorte[] {
  if (!caminho.startsWith("/") || caminho.startsWith("//")) return [];
  const url = new URL(caminho, "https://scrutiniums.invalid");
  const rota = url.pathname.replace(/^\/en(?=\/)/, "");
  const q = url.searchParams;
  const partes: ParteRecorte[] = [];
  const tx = (pt: string, en: string) => idioma === "en" ? en : pt;
  const numero = (chave: string) => {
    const bruto = q.get(chave);
    return bruto !== null && /^\d+(?:\.\d+)?$/.test(bruto) && Number.isFinite(Number(bruto)) ? Number(bruto) : null;
  };
  const formatar = (valor: number) => valor.toLocaleString(idioma === "en" ? "en-GB" : "pt-BR", { maximumFractionDigits: 4 });
  if (rota === "/combustiveis" || rota === "/combustiveis/no-meu-estado") {
    const uf = q.get("uf");
    if (uf && NOME_UF[uf]) partes.push({ texto: NOME_UF[uf], nome: true });
    else if (uf === "BR") partes.push({ texto: tx("Brasil", "Brazil") });
    if (q.has("litros")) {
      const litros = numero("litros");
      partes.push({ texto: litros !== null && litros > 0 && litros <= 1000 ? `${formatar(litros)} ${tx("litros", "litres")}` : tx("Volume inválido ou vazio: sem cálculo", "Invalid or empty volume: no calculation") });
    }
  } else if (rota === "/custo-de-vida") {
    const fatias = [...q.keys()].filter((k) => /^peso_/.test(k) && numero(k) !== null).length;
    if (fatias) partes.push({ texto: tx(`Orçamento: ${fatias} fatias registradas`, `Budget: ${fatias} recorded shares`) });
  } else if (rota === "/contas-publicas-estaduais") {
    const gasto = numero("lab_gasto"), entrega = numero("lab_entrega");
    if (gasto !== null && gasto <= 100) partes.push({ texto: tx(`Cenário: despesa de R$ ${formatar(gasto)} milhões`, `Scenario: BRL ${formatar(gasto)} million in spending`) });
    if (entrega !== null && entrega <= 100) partes.push({ texto: tx(`${formatar(entrega)} unidades entregues`, `${formatar(entrega)} units delivered`) });
  } else if (rota.startsWith("/educacao-municipal")) {
    for (const [prefixo, pt, en] of [["ideb_br", "Brasil", "Brazil"], ["ideb_mun", "Município", "Municipality"]]) {
      const n = numero(`${prefixo}_n`), p = numero(`${prefixo}_p`);
      if (n !== null && p !== null && n <= 10 && p <= 100) partes.push({ texto: tx(`${pt}: aprendizagem ${formatar(n)}; fluxo ${formatar(p)}%`, `${en}: learning ${formatar(n)}; progression ${formatar(p)}%`) });
    }
  } else if (rota === "/setor-eletrico/conta-de-luz") {
    const lugar = q.get("conta_municipio")?.split("|");
    if (lugar?.length === 2 && NOME_UF[lugar[0]] && lugar[1].length <= 100) partes.push({ texto: `${lugar[1]} (${lugar[0]})`, nome: true });
    const kwh = numero("conta_kwh");
    if (kwh !== null && kwh <= 10000) partes.push({ texto: `${formatar(kwh)} kWh` });
  }
  return partes;
}
