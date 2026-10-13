/**
 * API pública de leitura: os JSON estáticos de /obs/data/gold, sem backend novo.
 * Catálogo lido do gold publicado no build; contrato versionado em
 * docs/api/contrato-gold.json (scripts/contrato-gold.mjs).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import contrato from "../../docs/api/contrato-gold.json";

export const BASE_API = "https://scrutiniums.com/obs/data/gold/";
export const CONTRATO = contrato as {
  versao: string;
  data: string;
  base: string;
  arquivos: { arquivo: string; chaves: string[] }[];
  diretorios: { diretorio: string; padrao: string; descricao: string; quantidade: number; chaves: string[] }[];
  outros: string[];
};

const GOLD = () => join(process.cwd(), "public", "obs", "data", "gold");

export type ItemCatalogo = { arquivo: string; bytes: number; chaves: string[]; geradoEm: string | null; noContrato: boolean };

export function catalogoGold(): ItemCatalogo[] {
  const noContrato = new Set(CONTRATO.arquivos.map((a) => a.arquivo));
  return readdirSync(GOLD())
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const p = join(GOLD(), f);
      let chaves: string[] = [];
      let geradoEm: string | null = null;
      try {
        const j = JSON.parse(readFileSync(p, "utf-8"));
        if (j && typeof j === "object" && !Array.isArray(j)) {
          chaves = Object.keys(j);
          geradoEm = typeof j.gerado_em === "string" ? j.gerado_em : null;
        }
      } catch {
        chaves = [];
      }
      return { arquivo: f, bytes: statSync(p).size, chaves, geradoEm, noContrato: noContrato.has(f) };
    });
}

export function tamanho(bytes: number): string {
  if (bytes >= 1e6) return `${(bytes / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1e3)).toLocaleString("pt-BR")} kB`;
}
