import { execFileSync } from "node:child_process";
import { existsSync, realpathSync, statSync } from "node:fs";
import { join, sep } from "node:path";

const PREFIXO_EN = "src/app/en";
const chaves = (valor) => valor && typeof valor === "object" && !Array.isArray(valor)
  ? Object.keys(valor).sort().join(",") : "";
const ordenar = (a, b) => a.pt < b.pt ? -1 : a.pt > b.pt ? 1 : 0;

function caminhoLiteral(caminho) {
  return typeof caminho === "string" && caminho !== "/en" && !caminho.startsWith("/en/")
    && (caminho === "/" || /^\/[\p{L}\p{N}][\p{L}\p{N}\p{M}_-]*(?:\/[\p{L}\p{N}][\p{L}\p{N}\p{M}_-]*)*$/u.test(caminho));
}

/** Adaptador inicial: somente page.tsx em diretórios literais, sem grupos ou parâmetros. */
export function caminhoDaPaginaLiteral(path) {
  if (!path.startsWith("src/app/") || !path.endsWith("/page.tsx")) return null;
  const caminho = path.slice("src/app".length).replace(/\/page\.tsx$/, "") || "/";
  return caminhoLiteral(caminho) ? caminho : null;
}

/** Presença de fontes não comprova HTML, autorização ou implantação. Não executa a aplicação. */
export function validarRotasLiterais(raiz, manifesto, fontes) {
  const declaracao = manifesto.rotas;
  if (declaracao === undefined) {
    if (existsSync(join(raiz, PREFIXO_EN))) throw new Error("A cobertura precisa integrar o catálogo e as rotas antes de medir src/app/en.");
    return null;
  }
  if (chaves(declaracao) !== "literais,schema_version" || declaracao.schema_version !== 1
    || !Array.isArray(declaracao.literais) || !declaracao.literais.length) {
    throw new Error("Declaração de rotas literais i18n inválida.");
  }
  if (!manifesto.catalogo) throw new Error("A cobertura precisa integrar o catálogo antes de declarar rotas inglesas.");
  const base = realpathSync(raiz);
  const ui = new Map(fontes.ui.map((fonte) => [fonte.path, fonte]));
  const vistos = new Set();
  const arquivo = (path) => {
    const real = realpathSync(join(base, path));
    if (!real.startsWith(base + sep)) throw new Error(`Fonte de rota fora do repositório: ${path}`);
    if (!statSync(real).isFile()) throw new Error(`Fonte de rota não é arquivo: ${path}`);
    return real;
  };
  const pares = declaracao.literais.map((item) => {
    if (chaves(item) !== "conteudo,pt" || !caminhoLiteral(item.pt)
      || !["portugues_marcado", "parcialmente_traduzido"].includes(item.conteudo)) {
      throw new Error("Rota literal i18n ou estado de conteúdo não suportado.");
    }
    if (vistos.has(item.pt)) throw new Error(`Rota literal i18n duplicada: ${item.pt}`);
    vistos.add(item.pt);
    const en = item.pt === "/" ? "/en" : `/en${item.pt}`;
    const caminhos = { pt: `src/app${item.pt === "/" ? "" : item.pt}/page.tsx`, en: `src/app${en}/page.tsx` };
    for (const path of Object.values(caminhos)) {
      arquivo(path);
      if (!ui.has(path)) throw new Error(`Fonte da irmã literal ausente do inventário de interface: ${path}`);
    }
    return { pt: item.pt, en, dominio: ui.get(caminhos.pt).dominio, conteudo_declarado: item.conteudo,
      fontes: caminhos, arquivos_presentes: true };
  }).sort(ordenar);

  // Ler também fontes excluídas e arquivos binários: metadata routes não podem
  // desaparecer porque o inventário de texto não tem extrator para sua extensão.
  const inglesas = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", PREFIXO_EN], {
    cwd: base, encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
  }).split("\0").filter(Boolean).sort();
  const declaradas = new Set(pares.map((par) => par.fontes.en));
  for (const path of inglesas) {
    arquivo(path);
    const segmentos = path.slice(PREFIXO_EN.length + 1).split("/");
    const nome = segmentos[segmentos.length - 1];
    if (segmentos.some((segmento) => /[\[\]()@]/.test(segmento)) || /^route\.[cm]?[jt]sx?$/.test(nome)) {
      throw new Error(`Rota inglesa fora do adaptador literal: ${path}`);
    }
    if (/^(opengraph-image|twitter-image|icon|apple-icon)\d*(?:[-.]|$)|^(robots|sitemap|manifest|favicon)\./.test(nome)) {
      throw new Error(`Metadata route inglesa ainda sem integração: ${path}`);
    }
    if (/^page\.[cm]?[jt]sx?$/.test(nome) && !declaradas.has(path)) {
      throw new Error(`Página inglesa não declarada: ${path}`);
    }
    // Layouts, boundaries e componentes são fontes de UI, nunca pares adicionais.
    if (/\.[cm]?[jt]sx?$/.test(nome) && !ui.has(path)) {
      throw new Error(`Fonte inglesa ausente do inventário de interface: ${path}`);
    }
  }
  return { schema_version: 1, pares, pares_estruturais: pares.length,
    fallbacks_declarados: pares.filter((par) => par.conteudo_declarado === "portugues_marcado").length,
    html_verificado_pelo_inventario: false, acesso_verificado_pelo_inventario: false };
}
