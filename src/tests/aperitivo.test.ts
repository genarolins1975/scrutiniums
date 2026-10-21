import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { APERITIVOS, LEVA_2, desvioDoAperitivo, ehRotaPublica, exigeConta, itemAprovado } from "@/lib/rotasPublicas";
import { OBSERVATORIOS, donoDaRota } from "@/lib/observatorios/registro";

/**
 * Princípio do aperitivo (decisão do dono de 20/10/2026): tudo o que a área
 * aberta mostra existe na área com conta, com nível de detalhe muito maior; a
 * área aberta mostra só um aperitivo, e cada tema tem uma única página aberta.
 */

const APP = join(process.cwd(), "src", "app");

/** Rotas de página do App Router, com os segmentos dinâmicos trocados por valores de exemplo. */
function paginasDoApp(): string[] {
  const saida: string[] = [];
  const andar = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) andar(caminho);
      else if (nome === "page.tsx") saida.push("/" + relative(APP, dir).split(sep).join("/"));
    }
  };
  andar(APP);
  return saida.map((r) =>
    r
      .replace(/\/\([^)]+\)/g, "")
      .replace(/\[\[\.\.\.[^\]]+\]\]/g, "")
      .replace(/\[(id|ibge|municipio|codigo)\]/g, "3550308")
      .replace(/\[porta\]/g, "familias")
      .replace(/\[[^\]]+\]/g, "x")
      .replace(/\/+$/, "") || "/",
  );
}

/** Páginas abertas que não são aperitivo: explicam como a plataforma mede, levam aos temas ou cuidam da conta. */
const FORA_DO_PRINCIPIO = [
  /^\/$/, /^\/home(\/|$)/, /^\/(termos|privacidade|imprensa|glossario)$/, /^\/sobre(\/|$)/, /^\/(entrar|cadastro)(\/|$)/, /^\/boletim\/sair/,
  /\/metodologia(\/|$)/, /\/glossario(\/|$)/, /^\/setor-eletrico\/aprenda(\/|$)/, /^\/eficiencia-estatal\/[a-z0-9-]+\/metodos$/,
  /^\/perguntas(\/|$)/, /nao-encontrado/,
];

describe("princípio do aperitivo", () => {
  const conferePainel = (origem: string, destino: string) => {
    const exemplo = destino.replace("[id]", "3550308");
    expect(donoDaRota(exemplo) ?? (exemplo === "/observatorio" ? "credito" : null), `${origem}: o painel completo ${destino} não está no registro`).not.toBeNull();
    if (exemplo === origem) {
      // mesmo endereço: sem sessão o middleware serve a versão aperitivo; a página completa só chega com sessão
      expect(desvioDoAperitivo(origem)?.tipo, origem).toBe("aperitivo");
    } else {
      expect(exigeConta(exemplo), `${origem}: o painel completo ${destino} precisa exigir conta`).toBe(true);
    }
  };

  it("cada tema tem uma única página aberta, e toda página aberta de informação é a de um tema", () => {
    const temas = new Map<string, string>();
    for (const a of APERITIVOS) {
      expect(temas.has(a.tema), `${a.tema} com duas páginas abertas: ${temas.get(a.tema)} e ${a.rota}`).toBe(false);
      temas.set(a.tema, a.rota);
    }
    for (const item of LEVA_2.filter((i) => itemAprovado(i) && i.rotas.length > 0 && i.forma !== "metodo")) {
      expect(temas.has(item.tema), `${item.tema} com duas páginas abertas: ${temas.get(item.tema)} e ${item.rotas[0]}`).toBe(false);
      temas.set(item.tema, item.rotas[0]);
    }
    const paginasDosTemas = new Set(temas.values());
    const abertas = paginasDoApp().filter((r) => r !== "/en" && !r.startsWith("/en/") && !r.startsWith("/aperitivo") && ehRotaPublica(r));
    for (const r of abertas) {
      if (FORA_DO_PRINCIPIO.some((x) => x.test(r))) continue;
      expect(paginasDosTemas.has(r), `${r} é aberta e não é a página única de nenhum tema`).toBe(true);
    }
  });

  it("toda página aberta de tema aponta onde a conta aprofunda, e o aperitivo existe", () => {
    for (const a of APERITIVOS) {
      conferePainel(a.rota, a.painelCompleto);
      if (a.versaoAberta) {
        expect(existsSync(join(APP, ...a.versaoAberta.split("/").filter(Boolean), "page.tsx")), `${a.tema}: falta a versão aperitivo ${a.versaoAberta}`).toBe(true);
        expect(desvioDoAperitivo(a.rota), a.rota).toEqual({ tipo: "aperitivo", destino: a.versaoAberta });
      }
    }
    for (const item of LEVA_2) {
      if (item.forma === "metodo") {
        expect(item.painelCompleto, item.id).toBeNull();
        continue;
      }
      expect(item.painelCompleto, `${item.id} sem painel completo`).not.toBeNull();
      conferePainel(item.rotas[0] ?? `/perguntas (${item.id})`, item.painelCompleto as string);
    }
  });

  it("toda página aberta de tema mostra o que a página com conta tem a mais (ConviteAperitivo)", () => {
    // decisão do dono de 20/10/2026: "sempre coloque na página aberta o que mais tem disponível na página logada"
    const fonteComImportacoes = (rota: string): string => {
      const arquivo = join(APP, ...rota.split("/").filter(Boolean), "page.tsx");
      const fonte = readFileSync(arquivo, "utf-8");
      const locais = [...fonte.matchAll(/from ["']@\/components\/([^"']+)["']/g)].map((m) => join(process.cwd(), "src", "components", m[1] + ".tsx"));
      return [fonte, ...locais.filter((f) => existsSync(f)).map((f) => readFileSync(f, "utf-8"))].join("\n");
    };
    const paginas = [
      ...APERITIVOS.map((a) => a.versaoAberta ?? a.rota),
      ...LEVA_2.filter((i) => itemAprovado(i) && i.rotas.length > 0 && i.forma !== "metodo").map((i) => i.rotas[0]),
    ];
    for (const rota of paginas) {
      if (!existsSync(join(APP, ...rota.split("/").filter(Boolean), "page.tsx"))) continue; // a falta da página reprova no teste acima
      expect(fonteComImportacoes(rota), `${rota} sem o bloco do que a conta tem a mais`).toMatch(/<ConviteAperitivo\b[\s\S]*?comConta=/);
    }
  });

  it("as fichas do painel completo voltam à página aberta do tema sem sessão", () => {
    expect(ehRotaPublica("/saneamento/municipio/3550308")).toBe(false);
    expect(desvioDoAperitivo("/saneamento/municipio/3550308")).toEqual({ tipo: "ficha", destino: "/saneamento/municipio?ibge=3550308" });
    expect(desvioDoAperitivo("/saneamento/municipio/355030")).toBeNull();
    expect(desvioDoAperitivo("/saneamento/municipio/3550308/x")).toBeNull();
  });

  it("o caminho interno da versão aperitivo não é endereço, e o endereço inglês segue o português", () => {
    for (const c of ["/aperitivo/conta-de-luz", "/aperitivo", "/en/aperitivo/conta-de-luz", "/aperitivo/saneamento/"]) {
      expect(desvioDoAperitivo(c), c).toEqual({ tipo: "interno" });
    }
    expect(desvioDoAperitivo("/en/setor-eletrico/conta-de-luz")).toEqual({ tipo: "aperitivo", destino: "/en/aperitivo/conta-de-luz" });
    expect(desvioDoAperitivo("/setor-eletrico/conta-de-luz/")).toEqual({ tipo: "aperitivo", destino: "/aperitivo/conta-de-luz" });
    for (const c of ["/setor-eletrico/conta-de-luz/reajustes-e-subsidios", "/setor-eletrico", "/combustiveis/no-meu-estado", "/saneamento/preco-regulado/simulador"]) {
      expect(desvioDoAperitivo(c), c).toBeNull();
    }
  });

  it("o simulador da conta de água saiu da área aberta", () => {
    expect(ehRotaPublica("/saneamento/preco-regulado/simulador")).toBe(false);
  });

  it("cada porta de O Brasil em perguntas tem a entrada completa do observatório com conta", () => {
    for (const o of OBSERVATORIOS) expect(exigeConta(`/observatorios/${o.id}`), o.id).toBe(true);
  });
});
