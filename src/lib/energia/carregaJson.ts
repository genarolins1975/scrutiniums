/**
 * Leitura sob demanda, no navegador, de um JSON publicado em /energia/ (seção 5.1 do
 * contrato dos módulos: séries e fichas grandes não viajam nas props de componente
 * cliente; a página entrega o recorte e busca o detalhe quando o leitor pede). Uma
 * promessa por URL, compartilhada entre todos os componentes da página; falha não
 * fica em cache.
 */
const cache = new Map<string, Promise<unknown>>();

export function carregaJson<T>(url: string): Promise<T> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} ao ler ${url}`);
      return r.json() as Promise<unknown>;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p as Promise<T>;
}

/** Valor num caminho "a.b[2].c" de um objeto JSON; undefined quando qualquer trecho falta. */
export function lerCaminho(obj: unknown, caminho: string): unknown {
  const partes = caminho
    .split(".")
    .flatMap((s) => s.split(/\[|\]/))
    .filter((s) => s !== "");
  let v: unknown = obj;
  for (const p of partes) {
    if (v === null || typeof v !== "object") return undefined;
    v = (v as Record<string, unknown>)[p];
  }
  return v;
}
