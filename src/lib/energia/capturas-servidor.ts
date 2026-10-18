import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { lerCsvComAspas } from "./dados-servidor";
import type { CapturaHistoricaEnergia, MetaGold } from "./tipos";

const URL = "/energia/series/capturas_fontes.csv";
const COLUNAS = ["dataset", "recurso", "sha256", "capturado_em", "publicado_em", "origem", "vigente"];
const cache = new Map<string, { assinatura: string; fontes: Map<string, CapturaHistoricaEnergia[]> }>();

/** Lido uma vez no build; a ficha mantém a tabela integral, sem carregar o CSV no navegador. */
export function capturasDoConjunto(f: MetaGold["fontes"][string] | undefined, dataset: string, raiz = join(process.cwd(), "public")): CapturaHistoricaEnergia[] {
  // Compatibilidade com publicações anteriores à primeira execução do novo pipeline.
  if (!f?.resumo_capturas) return f?.historico?.length ? f.historico : (f?.capturas ?? []).map((x) => ({ ...x, vigente: true }));
  if (f.historico_csv !== URL) throw new Error("Endereço inválido do histórico de capturas");
  const caminho = join(raiz, URL.slice(1));
  const st = statSync(caminho); // Ausência é falha de contrato, nunca uma amostra apresentada como total.
  const assinatura = `${st.mtimeMs}:${st.size}`;
  let entrada = cache.get(caminho);
  if (!entrada || entrada.assinatura !== assinatura) {
    const [cabecalho, ...linhas] = lerCsvComAspas(readFileSync(caminho, "utf8"));
    if (JSON.stringify(cabecalho) !== JSON.stringify(COLUNAS)) throw new Error("Colunas inválidas do histórico de capturas");
    const fontes = new Map<string, CapturaHistoricaEnergia[]>();
    for (const linha of linhas) {
      if (linha.length !== COLUNAS.length || !["true", "false"].includes(linha[6])) throw new Error("Linha inválida do histórico de capturas");
      const [ds, recurso, sha256, capturado_em, publicado, origem, vigente] = linha;
      const lista = fontes.get(ds) ?? [];
      lista.push({ recurso, sha256, capturado_em, publicado_em: publicado || null, origem, vigente: vigente === "true" });
      fontes.set(ds, lista);
    }
    entrada = { assinatura, fontes };
    cache.set(caminho, entrada);
  }
  const lista = entrada.fontes.get(dataset) ?? [];
  if (lista.length !== f.resumo_capturas.total_historico || lista.filter((x) => x.vigente).length !== f.resumo_capturas.total_capturas) {
    throw new Error(`Resumo e CSV de capturas divergentes: ${dataset}`);
  }
  return lista;
}
