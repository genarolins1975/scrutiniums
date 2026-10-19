import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ABAS_INSTITUCIONAIS_CREDITO, ATALHOS, DESTINO_ABAS_CREDITO, DESTINO_TEMAS_EFICIENCIA, OBSERVATORIOS,
  donoDaRota, paineis, rotasDoObservatorio,
} from "@/lib/observatorios/registro";
import { ABAS_OBSERVATORIO } from "@/lib/data/observatorioAbas";
import { DIMENSOES } from "@/lib/eficiencia/dimensoes";
import { DOMINIOS } from "@/lib/dominios";

/** Diretórios das coleções no App Router; toda página dentro deles precisa de dono. */
const RAIZES = ["setor-eletrico", "gas-natural", "saneamento", "contas-publicas", "contas-publicas-estaduais", "eficiencia-estatal", "agronegocio", "territorio"];

/** Rotas de página (page.tsx) sob uma raiz, com segmentos dinâmicos preservados. */
function paginas(raiz: string): string[] {
  const base = join(process.cwd(), "src", "app");
  const saida: string[] = [];
  const andar = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) andar(caminho);
      else if (nome === "page.tsx") saida.push("/" + relative(base, dir).split(sep).join("/"));
    }
  };
  andar(join(base, raiz));
  return saida;
}

describe("registro dos seis observatórios", () => {
  const todos = paineis();

  it("são seis, com coleções de identificadores únicos e porta de entrada com dono", () => {
    expect(OBSERVATORIOS.map((o) => o.id)).toEqual([
      "familias", "servicos-publicos", "contas-publicas", "energia-e-infraestrutura", "economia", "territorio-e-clima",
    ]);
    for (const o of OBSERVATORIOS) {
      expect(new Set(o.colecoes.map((c) => c.id)).size, o.id).toBe(o.colecoes.length);
      for (const c of o.colecoes) {
        expect(todos.some((p) => p.observatorio === o.id && p.colecao === c.id), `${o.id}/${c.id} sem painel`).toBe(true);
        expect(rotasDoObservatorio(o.id).has(c.href), `${o.id}/${c.id}: entrada ${c.href} fora do observatório`).toBe(true);
      }
    }
  });

  it("cada rota tem um único dono, numa coleção que existe", () => {
    const vistas = new Map<string, string>();
    for (const p of todos) {
      expect(vistas.has(p.rota), `${p.rota} com dois donos: ${vistas.get(p.rota)} e ${p.observatorio}`).toBe(false);
      vistas.set(p.rota, p.observatorio);
      const o = OBSERVATORIOS.find((x) => x.id === p.observatorio);
      expect(o?.colecoes.some((c) => c.id === p.colecao), `${p.rota}: coleção ${p.colecao}`).toBe(true);
    }
  });

  it("toda aba do Crédito e todo tema publicado da Eficiência Estatal têm destino", () => {
    for (const a of ABAS_OBSERVATORIO.filter((x) => !ABAS_INSTITUCIONAIS_CREDITO.has(x.caminho) && !x.caminho.endsWith("/"))) {
      expect(DESTINO_ABAS_CREDITO[a.caminho], a.caminho).toBeDefined();
    }
    for (const caminho of Object.keys(DESTINO_ABAS_CREDITO)) expect(ABAS_OBSERVATORIO.some((a) => a.caminho === caminho), `aba inexistente ${caminho}`).toBe(true);
    for (const d of DIMENSOES.filter((x) => x.href)) expect(DESTINO_TEMAS_EFICIENCIA[d.id], d.id).toBeDefined();
  });

  it("o Crédito se divide entre Famílias e Economia, e nenhum domínio fica sem observatório", () => {
    const daOrigem = (id: string) => new Set(todos.filter((p) => p.origem === id).map((p) => p.observatorio));
    expect([...daOrigem("credito")].sort()).toEqual(["contas-publicas", "economia", "familias"]);
    for (const d of DOMINIOS) expect(daOrigem(d.id).size, d.id).toBeGreaterThan(0);
  });

  it("toda página das coleções no App Router tem dono", () => {
    for (const raiz of RAIZES) {
      for (const rota of paginas(raiz)) {
        // a entrada e o método do próprio observatório (Território e Clima) pertencem a ele, não a uma coleção
        if (OBSERVATORIOS.some((o) => o.entrada === rota || o.metodo === rota)) continue;
        expect(donoDaRota(rota), `${rota} sem observatório`).not.toBeNull();
      }
    }
  });

  it("os painéis apontam para páginas que existem", () => {
    const base = join(process.cwd(), "src", "app");
    for (const p of todos.filter((x) => x.origem !== "credito")) {
      const dir = join(base, ...p.rota.split("/").filter(Boolean));
      const pai = join(dir, "..");
      const existe = existsSync(join(dir, "page.tsx")) || existsSync(join(dir, "route.ts"))
        || ["[capitulo]", "[[...painel]]", "[id]"].some((d) => existsSync(join(pai, d)))
        || existsSync(join(dir, "[[...painel]]", "page.tsx"));
      expect(existe, p.rota).toBe(true);
    }
  });

  it("atalhos apontam para painéis de outro observatório, sem repetir o dono", () => {
    const vistos = new Set<string>();
    for (const a of ATALHOS) {
      const dono = todos.find((p) => p.rota === a.rota);
      expect(dono, `atalho sem painel: ${a.rota}`).toBeDefined();
      expect(dono?.observatorio, `atalho para o próprio observatório: ${a.rota}`).not.toBe(a.observatorio);
      const o = OBSERVATORIOS.find((x) => x.id === a.observatorio);
      expect(o?.colecoes.some((c) => c.id === a.colecao), `${a.rota}: coleção ${a.colecao}`).toBe(true);
      const chave = `${a.observatorio}:${a.rota}`;
      expect(vistos.has(chave), chave).toBe(false);
      vistos.add(chave);
    }
  });

  it("duplicatas apontam para um painel registrado", () => {
    for (const p of todos.filter((x) => x.duplicataDe)) {
      expect(donoDaRota(p.duplicataDe as string), `${p.rota} → ${p.duplicataDe}`).not.toBeNull();
    }
  });

  it("subpáginas herdam o dono do painel acima delas", () => {
    expect(donoDaRota("/setor-eletrico/geracao/termica")?.observatorio).toBe("energia-e-infraestrutura");
    expect(donoDaRota("/eficiencia-estatal/trabalho-renda/renda-das-familias/")?.observatorio).toBe("familias");
    expect(donoDaRota("/observatorio/states/PE")?.observatorio).toBe("economia");
    expect(donoDaRota("/termos")).toBeNull();
  });

  it("o bloco Para ir além está no layout de toda coleção com páginas Next e nomeia só o que existe no registro", async () => {
    const { mapaParaIrAlem } = await import("@/lib/observatorios/mapaParaIrAlem");
    const mapa = mapaParaIrAlem();
    for (const p of [...mapa.paineis, ...mapa.atalhos]) {
      const o = mapa.observatorios.find((x) => x.id === p.observatorio);
      expect(o?.colecoes.some((c) => c.id === p.colecao), `${p.rota}`).toBe(true);
    }
    const { readFileSync } = await import("node:fs");
    for (const raiz of RAIZES) {
      const layout = readFileSync(join(process.cwd(), "src", "app", raiz, "layout.tsx"), "utf-8");
      expect(layout, raiz).toContain("<ParaIrAlem mapa={mapaParaIrAlem()} />");
    }
  });
});

