/**
 * Data de referência de cada fonte integrada, lida da gold do build. Cada fonte tem o
 * seu calendário: nenhuma data única de "operação" resume EAR, ENA, carga, geração e
 * intercâmbio, que chegam em dias diferentes.
 */
import { dataBR } from "./formato";
import { gold, integra } from "./gold";

export type ChaveReferencia = "ear" | "ena" | "geracao" | "carga" | "intercambio" | "saldos" | "pld" | "cmo";

/** Referência dos dados como frase ("até 26/09/2026"); sem gold, null. */
export function datasDeReferencia(): Record<ChaveReferencia, string | null> {
  const hid = gold.hidrologia();
  const ger = gold.geracao();
  const car = gold.carga();
  const rede = gold.rede();
  const pld = gold.pld();
  const cmo = gold.cmo();
  return {
    ear: integra(hid) ? `até ${dataBR(hid.dia_referencia_ear)}` : null,
    ena: integra(hid) ? `até ${dataBR(hid.dia_referencia_ena)}` : null,
    geracao: integra(ger) ? `até ${dataBR(ger.dia_referencia)}` : null,
    carga: integra(car) ? `até ${dataBR(car.dia_referencia)}` : null,
    intercambio: integra(rede) ? `até ${dataBR(rede.dia_referencia)}` : null,
    saldos: integra(rede) && rede.dia_referencia_liquido ? `até ${dataBR(rede.dia_referencia_liquido)}` : null,
    pld: integra(pld) ? `até ${dataBR(pld.dia_referencia)}` : null,
    // o ONS identifica a semana operativa por uma data, que pode ser posterior ao dia de hoje
    cmo: integra(cmo) ? `última semana operativa publicada, que o ONS identifica pela data ${dataBR(cmo.semana_referencia)}` : null,
  };
}

/** Linha curta do cabeçalho: a data de cada fonte principal, sem juntar calendários diferentes. */
export function linhaDeDatas(): string {
  const d = datasDeReferencia();
  const itens: [string, string | null][] = [
    ["EAR (ONS)", d.ear],
    ["ENA (ONS)", d.ena],
    ["geração (ONS)", d.geracao],
    ["carga (ONS)", d.carga],
    ["intercâmbios (ONS)", d.intercambio],
    ["PLD (CCEE)", d.pld],
  ];
  return itens.map(([r, v]) => `${r} ${v ?? "sem dado"}`).join(" · ");
}
