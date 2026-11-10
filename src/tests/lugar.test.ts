import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fichaDoLugar, type CartaoLugar } from "@/lib/lugar/ficha";
import { ROTA_LUGAR, hrefLugar } from "@/lib/lugar/paginas";
import { ehRotaPublica } from "@/lib/rotasPublicas";
import { municipio as municipioSaneamento } from "@/lib/saneamento/gold";
import { consultarMunicipio as consultarEducacao, idebRecente } from "@/lib/educacao/dados";
import { fichaFocos } from "@/lib/territorio/focosMunicipio";
import { navegacaoDaConta } from "@/lib/observatorios/navegacaoColecao";
import { num } from "@/lib/perguntas/leitura";

/**
 * Ficha do lugar (/app/minha-cidade, eixo do lugar, pedido do dono de 10/11/2026). Invariantes: o lugar só vem do código
 * IBGE da URL; todo cartão traz número com fonte e período ou diz por que não traz; o número é o mesmo da ficha do tema;
 * ausência nunca vira zero; todo destino existe; a página exige conta e os arquivos que ela lê vão para a função.
 */
const RECIFE = "2611606";
const AMOSTRA = [RECIFE, "3550308", "1302603", "5300108", "4314902"];

/** Página do App Router que atende um endereço (sem consulta nem âncora), com segmentos dinâmicos. */
function paginaExiste(href: string): boolean {
  const partes = href.split(/[?#]/)[0].split("/").filter(Boolean);
  const andar = (dir: string, i: number): boolean => {
    if (!existsSync(dir)) return false;
    if (i === partes.length) return existsSync(join(dir, "page.tsx")) || existsSync(join(dir, "route.ts")) || readdirSync(dir).some((n) => n.startsWith("[[..."));
    if (existsSync(join(dir, partes[i])) && andar(join(dir, partes[i]), i + 1)) return true;
    for (const nome of readdirSync(dir)) {
      if (nome.startsWith("[[...")) return true;
      if (nome.startsWith("[") && andar(join(dir, nome), i + 1)) return true;
      if (nome.startsWith("(") && andar(join(dir, nome), i)) return true;
    }
    return false;
  };
  return andar(join(process.cwd(), "src", "app"), 0);
}

describe("ficha do lugar", () => {
  it("só aceita código IBGE de sete dígitos de um município da lista; o resto é vazio ou inválido, nunca palpite", () => {
    expect(fichaDoLugar(undefined)).toEqual({ estado: "vazia" });
    expect(fichaDoLugar("  ")).toEqual({ estado: "vazia" });
    expect(fichaDoLugar("recife")).toEqual({ estado: "invalida", codigo: null });
    expect(fichaDoLugar("261160")).toEqual({ estado: "invalida", codigo: null });
    expect(fichaDoLugar("9999999")).toEqual({ estado: "invalida", codigo: "9999999" });
    expect(fichaDoLugar([RECIFE, "3550308"]).estado).toBe("ok");
  });

  it("todo cartão traz número com fonte e período, ou o motivo de não trazer; nada de undefined, NaN ou zero no lugar de ausência", () => {
    for (const id of AMOSTRA) {
      const f = fichaDoLugar(id);
      if (f.estado !== "ok") throw new Error(`ficha indisponível: ${id}`);
      expect(f.nome.length, id).toBeGreaterThan(0);
      expect(f.cidade.length, id).toBeGreaterThanOrEqual(6);
      expect(f.noEstado, id).toHaveLength(4);
      const todos: CartaoLugar[] = [...f.cidade, ...f.noEstado, ...f.consultas];
      expect(new Set(todos.map((c) => c.id)).size, id).toBe(todos.length);
      for (const c of todos) {
        const onde = `${id}/${c.id}`;
        expect(paginaExiste(c.href), `${onde}: destino ${c.href}`).toBe(true);
        if (!c.numero) {
          expect(c.semNumero?.length ?? 0, `${onde}: sem número e sem motivo`).toBeGreaterThan(10);
          continue;
        }
        expect(c.numero.fonte.length, onde).toBeGreaterThan(2);
        expect(c.numero.periodo.length, onde).toBeGreaterThan(2);
        expect(c.numero.unidade.length, onde).toBeGreaterThan(0);
        expect(c.numero.href, onde).toBe(c.href);
        expect(`${c.numero.valor} ${c.numero.periodo} ${c.numero.rotulo}`, onde).not.toMatch(/undefined|NaN|null \d|Infinity/);
        if (c.numero.valor === null) expect(c.numero.periodo, onde).toBe("indisponível nesta publicação");
      }
      // os cartões do município levam o código do município no destino
      for (const c of f.cidade) expect(c.href, `${id}/${c.id}`).toContain(id);
    }
  });

  it("o número é o mesmo da base do tema", () => {
    const f = fichaDoLugar(RECIFE);
    if (f.estado !== "ok") throw new Error("Recife indisponível");
    const valor = (id: string) => f.cidade.find((c) => c.id === id)?.numero?.valor;
    const s = municipioSaneamento(RECIFE)!;
    expect(valor("saneamento-agua")).toBe(s.IAG0001 == null ? null : num(s.IAG0001, 1));
    expect(valor("saneamento-esgoto")).toBe(s.IES0001 == null ? null : num(s.IES0001, 1));
    const e = consultarEducacao(RECIFE);
    if (e.estado !== "ok") throw new Error("Recife fora da Educação");
    const ideb = idebRecente(e.m.ai.municipal);
    expect(valor("escola-ai")).toBe(ideb === null ? null : num(ideb, 1));
    const focos = fichaFocos(RECIFE)?.focos.acumuladoAnoCorrente;
    expect(valor("fogo")).toBe(focos == null ? null : focos.toLocaleString("pt-BR"));
  });

  it("dado ausente na fonte sai indisponível, não zero", () => {
    // município sem indicador de esgoto no SINISA: procura um na tabela e confere o cartão
    const semEsgoto = AMOSTRA.concat(["1100015", "1500107", "2100055", "2900108"]).find((id) => {
      const m = municipioSaneamento(id);
      return m && m.IES0001 == null;
    });
    if (!semEsgoto) return;
    const f = fichaDoLugar(semEsgoto);
    if (f.estado !== "ok") throw new Error("ficha indisponível");
    expect(f.cidade.find((c) => c.id === "saneamento-esgoto")?.numero?.valor).toBeNull();
  });

  it("a página exige conta, está na navegação da conta e os arquivos que lê vão para a função", () => {
    expect(ehRotaPublica(ROTA_LUGAR)).toBe(false);
    expect(hrefLugar(RECIFE)).toBe(`${ROTA_LUGAR}?ibge=${RECIFE}`);
    expect(navegacaoDaConta(false).itens.map((i) => i.href)).toContain(ROTA_LUGAR);
    const config = readFileSync(join(process.cwd(), "next.config.mjs"), "utf-8");
    const bloco = config.slice(config.indexOf(`"${ROTA_LUGAR}": [`));
    const lista = bloco.slice(0, bloco.indexOf("],"));
    for (const arquivo of [
      "saneamento/gold/municipios.json", "saneamento/gold/meta.json", "saneamento/gold/indice.json", "educacao/gold/educacao.json",
      "educacao/gold/municipios/*.json", "conectividade/gold/conectividade.json", "conectividade/gold/municipios/*.json",
      "previdencia/gold/municipios/*.json", "territorio/gold/queimadas_municipios.json", "gas/gold/*.json",
      "eficiencia/seguranca-publica/gold/seguranca.json",
    ]) expect(lista, arquivo).toContain(`./public/${arquivo}`);
  });
});
