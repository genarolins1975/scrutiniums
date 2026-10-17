import { conjuntoLegivel } from "@/lib/energia/evidencia";
import { dataBR } from "@/lib/energia/formato";
import { idiomaEnergia, tx as traduz } from "@/lib/energia/idioma";
import type { Idioma } from "@/lib/idioma";

/**
 * Texto de coleta e de engenharia dentro de frases escritas para a gold: código HTTP, desafio de navegador,
 * hash de arquivo, nome de banco intermediário. O leitor de Entender precisa saber que a fonte não respondeu e o
 * que se entrega no lugar; o resto é evidência para quem audita. As frases que citam bastidor saem do texto do
 * leitor e ficam disponíveis em Analisar e Auditar, na mesma ordem.
 */
const TECNICA =
  /HTTP \d{3}|cf-mitigated|Cloudflare|CloudFront|\bcurl\b|firewall|User-Agent|Acesso bloqueado|desafio de navegador|\bchallenge\b|package_(?:search|show)|\bsha256\b|\bsilver\b|\bvintages?\b|\bpipeline\b|\b[\w-]+\.(?:json|py|yml)\b|\bworkflow\b/i;

/** Códigos internos de pergunta ("P057, P058") entre parênteses, que o leitor não tem como consultar. */
export function semCodigosDePergunta(texto: string): string {
  return texto.replace(/\s*\((?:[PS]\d{3}(?:\s*(?:,|e)\s*[PS]\d{3})*)\)/g, "");
}

/** Separa as frases do texto entre as que o leitor lê e as que citam bastidor. */
export function partirBastidor(texto: string): { leitor: string; tecnico: string } {
  const frases = texto.split(/(?<=[.;])\s+(?=[A-ZÀ-Ú0-9"“(])/);
  const leitor: string[] = [];
  const tecnico: string[] = [];
  for (const f of frases) (TECNICA.test(f) ? tecnico : leitor).push(f);
  return { leitor: leitor.join(" ").trim(), tecnico: tecnico.join(" ").trim() };
}

/**
 * Frase de leitor para uma recusa documentada de fonte: diz quem recusou e quando, sem o código da resposta.
 * Vazia quando a evidência não descreve recusa de acesso.
 */
export function fraseDeRecusa(evidencia: string, quem: string, idioma: Idioma = idiomaEnergia()): string {
  const tx = <T,>(pt: T, en: T): T => traduz(pt, en, idioma);
  if (!/HTTP [45]\d{2}|\bcurl\b|desafio (?:do Cloudflare|de navegador)|cf-mitigated|Acesso bloqueado/i.test(evidencia)) return "";
  const data = /(\d{2}\/\d{2}\/\d{4})/.exec(evidencia)?.[1];
  // em inglês, "da ANEEL" vira "the ANEEL servers"; a data da evidência (dd/mm/aaaa) vai para a forma inglesa
  const orgao = quem.replace(/^d[oa]s?\s+/, "");
  const dataEn = data ? dataBR(data.split("/").reverse().join("-"), "en") : null;
  return data
    ? tx(`Em ${data}, os servidores ${quem} recusaram as consultas automáticas do observatório.`, `On ${dataEn}, the ${orgao} servers refused the observatory's automated requests.`)
    : tx(`Os servidores ${quem} recusaram as consultas automáticas do observatório.`, `The ${orgao} servers refused the observatory's automated requests.`);
}

/** Troca, dentro de uma frase, a descrição técnica da recusa pela forma que o leitor entende. */
export function recusaEmLinguagemSimples(texto: string): string {
  return texto
    .replace(/responderam 403 com desafio de navegador \(Cloudflare\)/g, "recusaram as consultas automáticas do observatório")
    .replace(/respondeu(?: com)? HTTP 403 com cf-mitigated: challenge \(desafio do Cloudflare\)/g, "recusou as consultas automáticas do observatório");
}

/** Remove o caminho de arquivo entre parênteses ("(projeto_pld/config/x.json)"), que o leitor não tem como abrir. */
export function semCaminhosDeArquivo(texto: string): string {
  return texto.replace(/\s*\((?:[\w.-]+\/)+[\w.-]+\.(?:json|jsonl|py|csv|parquet)\)/g, "");
}

/** Nome de fonte como o leitor o lê: sem "pipeline", "silver" e "gold" e sem caminho de arquivo. Em inglês, as trocas saem em inglês. */
export function fonteLegivel(nome: string, idioma: Idioma = idiomaEnergia()): string {
  const tx = <T,>(pt: T, en: T): T => traduz(pt, en, idioma);
  return conjuntoLegivel(semCaminhosDeArquivo(nome), idioma)
    .texto.replace(/\(pipeline do observatório\)/g, tx("(observatório)", "(observatory)"))
    .replace(/Silvers e golds do domínio/g, tx("Bases do domínio", "Domain bases"))
    .replace(/Silvers do domínio/g, tx("Histórico de capturas do domínio", "Domain capture history"))
    .replace(/silvers do pipeline/g, tx("histórico de capturas do observatório", "observatory capture history"))
    .replace(/\(avaliação do observatório\)/g, tx("(avaliação do observatório)", "(observatory evaluation)"));
}

/**
 * Vocabulário de engenharia que a gold e os módulos usam entre si (gold, silver, vintage, pipeline) trocado pelo que o leitor
 * entende. Só para frases escritas para o leitor; a evidência técnica mantém a palavra original em Analisar e Auditar.
 */
export function leitor(texto: string, idioma: Idioma = idiomaEnergia()): string {
  // em português, as palavras do leitor em português; em inglês, as inglesas (texto português da gold chama com "pt")
  const tx = <T,>(pt: T, en: T): T => traduz(pt, en, idioma);
  return texto
    .replace(/\buma gold\b/g, tx("uma base publicada", "a published base"))
    .replace(/\bgolds\b/g, tx("bases publicadas", "published bases"))
    .replace(/\bgold\b/g, tx("base publicada", "published base"))
    .replace(/\bsilvers\b/g, tx("históricos de capturas", "capture histories"))
    .replace(/\bsilver\b/g, tx("histórico de capturas", "capture history"))
    .replace(/\bvintages\b/g, tx("versões", "versions"))
    .replace(/\bvintage\b/g, tx("versão", "version"))
    .replace(/\bpipeline\b/g, tx("observatório", "observatory"));
}
