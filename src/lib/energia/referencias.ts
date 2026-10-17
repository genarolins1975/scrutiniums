/**
 * Data de referência de cada fonte integrada, lida da gold do build. Cada fonte tem o
 * seu calendário: nenhuma data única de "operação" resume EAR, ENA, carga, geração e
 * intercâmbio, que chegam em dias diferentes.
 */
import type { Idioma } from "@/lib/idioma";
import { dataBR } from "./formato";
import { gold, integra } from "./gold";
import { idiomaEnergia, tx } from "./idioma";

export type ChaveReferencia = "ear" | "ena" | "geracao" | "carga" | "intercambio" | "saldos" | "pld" | "cmo";

/** Referência dos dados como frase ("até 26/09/2026", "up to Sep 26, 2026"); sem gold, null. */
export function datasDeReferencia(idioma: Idioma = idiomaEnergia()): Record<ChaveReferencia, string | null> {
  const ate = (iso: string) => tx(`até ${dataBR(iso, idioma)}`, `up to ${dataBR(iso, idioma)}`, idioma);
  const hid = gold.hidrologia();
  const ger = gold.geracao();
  const car = gold.carga();
  const rede = gold.rede();
  const pld = gold.pld();
  const cmo = gold.cmo();
  return {
    ear: integra(hid) ? ate(hid.dia_referencia_ear) : null,
    ena: integra(hid) ? ate(hid.dia_referencia_ena) : null,
    geracao: integra(ger) ? ate(ger.dia_referencia) : null,
    carga: integra(car) ? ate(car.dia_referencia) : null,
    intercambio: integra(rede) ? ate(rede.dia_referencia) : null,
    saldos: integra(rede) && rede.dia_referencia_liquido ? ate(rede.dia_referencia_liquido) : null,
    pld: integra(pld) ? ate(pld.dia_referencia) : null,
    // o ONS identifica a semana operativa por uma data, que pode ser posterior ao dia de hoje
    cmo: integra(cmo)
      ? tx(
          `última semana operativa publicada, que o ONS identifica pela data ${dataBR(cmo.semana_referencia, idioma)}`,
          `latest published operating week, which ONS identifies by the date ${dataBR(cmo.semana_referencia, idioma)}`,
          idioma,
        )
      : null,
  };
}

/** Linha curta do cabeçalho: a data de cada fonte principal, sem juntar calendários diferentes. */
export function linhaDeDatas(idioma: Idioma = idiomaEnergia()): string {
  const d = datasDeReferencia(idioma);
  const itens: [string, string | null][] = [
    ["EAR (ONS)", d.ear],
    ["ENA (ONS)", d.ena],
    [tx("geração (ONS)", "generation (ONS)", idioma), d.geracao],
    [tx("carga (ONS)", "load (ONS)", idioma), d.carga],
    [tx("intercâmbios (ONS)", "interchanges (ONS)", idioma), d.intercambio],
    ["PLD (CCEE)", d.pld],
  ];
  return itens.map(([r, v]) => `${r} ${v ?? tx("sem dado", "no data", idioma)}`).join(" · ");
}
