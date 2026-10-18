/**
 * Leitura dos números de manchete a partir das golds publicadas: formato
 * brasileiro, período da própria base e ausência declarada quando a leitura
 * falha. Usada pelas páginas abertas (portas.ts) e pelas entradas dos
 * observatórios.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NumeroPorta } from "./tipos";

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */
export function lerPublico(...partes: string[]): any {
  return JSON.parse(readFileSync(join(process.cwd(), "public", ...partes), "utf-8"));
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-07" ou "2026-07-01" → "jul/2026". */
export function mesAno(iso: string): string {
  return `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`;
}

/** "2026-09-29" → "29/09/2026". */
export function dataBr(iso: string): string {
  return iso.slice(0, 10).split("-").reverse().join("/");
}

export function num(v: number, casas: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** Número com sinal tipográfico de menos, como no resto da plataforma. */
export function comSinal(v: number, casas: number): string {
  return v < 0 ? `−${num(Math.abs(v), casas)}` : num(v, casas);
}

export type Leitura = { valor: string; periodo: string; nota?: string };

/** Lê um número; qualquer falha vira ausência declarada, nunca zero. */
export function numero(def: Omit<NumeroPorta, "valor" | "periodo">, ler: () => Leitura): NumeroPorta {
  try {
    const l = ler();
    return { ...def, valor: l.valor, periodo: l.periodo, nota: l.nota ?? def.nota };
  } catch {
    return { ...def, valor: null, periodo: "indisponível nesta publicação" };
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */
