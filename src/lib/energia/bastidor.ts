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
export function fraseDeRecusa(evidencia: string, quem: string): string {
  if (!/HTTP [45]\d{2}|\bcurl\b|desafio (?:do Cloudflare|de navegador)|cf-mitigated|Acesso bloqueado/i.test(evidencia)) return "";
  const data = /(\d{2}\/\d{2}\/\d{4})/.exec(evidencia)?.[1];
  return data ? `Em ${data}, os servidores ${quem} recusaram as consultas automáticas do observatório.` : `Os servidores ${quem} recusaram as consultas automáticas do observatório.`;
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

/** Nome de fonte como o leitor o lê: sem "pipeline", "silver" e "gold" e sem caminho de arquivo. */
export function fonteLegivel(nome: string): string {
  return semCaminhosDeArquivo(nome)
    .replace(/\(pipeline do observatório\)/g, "(observatório)")
    .replace(/Silvers e golds do domínio/g, "Bases do domínio")
    .replace(/Silvers do domínio/g, "Histórico de capturas do domínio")
    .replace(/silvers do pipeline/g, "histórico de capturas do observatório");
}

/**
 * Vocabulário de engenharia que a gold e os módulos usam entre si (gold, silver, vintage, pipeline) trocado pelo que o leitor
 * entende. Só para frases escritas para o leitor; a evidência técnica mantém a palavra original em Analisar e Auditar.
 */
export function leitor(texto: string): string {
  return texto
    .replace(/\buma gold\b/g, "uma base publicada")
    .replace(/\bgolds\b/g, "bases publicadas")
    .replace(/\bgold\b/g, "base publicada")
    .replace(/\bsilvers\b/g, "históricos de capturas")
    .replace(/\bsilver\b/g, "histórico de capturas")
    .replace(/\bvintages\b/g, "versões")
    .replace(/\bvintage\b/g, "versão")
    .replace(/\bpipeline\b/g, "observatório");
}
