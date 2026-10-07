import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lerGold } from "./gold";
import { provenienciaLegivel } from "./mercado";
import type { ConferenciaManifesto, MetricaPublicada } from "./dados";
import type { ManifestoGold, PublicacaoGold } from "./tipos-dados";
import type { Proveniencia } from "./tipos";

/**
 * Leituras de disco das páginas de Dados e Metodologia, só no servidor (build): as golds
 * publicacao.json, manifesto.json e metricas.json, a conferência do manifesto contra os
 * arquivos entregues e a proveniência com as datas escritas como na página.
 */

export function publicacaoDados(): PublicacaoGold | null {
  const g = lerGold<PublicacaoGold>("publicacao.json");
  return g && g.disponivel ? g : null;
}

export function manifestoDados(): ManifestoGold | null {
  const g = lerGold<ManifestoGold>("manifesto.json");
  return g && g.disponivel ? g : null;
}

export function provenienciaDados(p: Proveniencia): Proveniencia {
  return provenienciaLegivel(p);
}

/**
 * Confere, no build, o sha256 e o tamanho de cada arquivo do manifesto com o arquivo que a
 * publicação entrega. Divergência não é escondida: a página mostra o número e a lista.
 */
export function conferirManifestoNoDisco(m: ManifestoGold, raiz = join(process.cwd(), "public")): ConferenciaManifesto {
  const divergentes: string[] = [];
  const ausentes: string[] = [];
  let conferidos = 0;
  for (const a of m.arquivos) {
    try {
      const b = readFileSync(join(raiz, a.caminho));
      if (b.length === a.bytes && createHash("sha256").update(b).digest("hex") === a.sha256) conferidos++;
      else divergentes.push(a.caminho);
    } catch {
      ausentes.push(a.caminho);
    }
  }
  return { total: m.arquivos.length, conferidos, divergentes, ausentes, foraDoManifesto: m.fora_do_manifesto.map((x) => x.caminho) };
}

export function metricasPublicadas(): MetricaPublicada[] {
  const g = lerGold<{ disponivel: boolean; metricas: MetricaPublicada[] }>("metricas.json");
  return g && g.disponivel ? g.metricas : [];
}
