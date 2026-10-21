import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COPIAS } from "@/lib/observatorios/copias";
import { donoDaRota, paineis } from "@/lib/observatorios/registro";
import { PainelPrincipal } from "@/components/observatorios/PainelPrincipal";

/**
 * Painel canônico por tema (achado A8 da banca de 19/10/2026): toda cópia de
 * um tema que continua publicada mostra "Painel principal", com link, pelo
 * mesmo componente. O teste percorre o registro e a tabela de cópias e reprova
 * duplicata sem aviso.
 */

const APP = join(process.cwd(), "src", "app");

/**
 * Arquivo que atende a uma rota (page.tsx, ou route.ts quando aceito), preferindo o
 * segmento estático ao dinâmico, como o App Router.
 */
function paginaDaRota(rota: string, arquivos: readonly string[] = ["page.tsx"]): string | null {
  const em = (dir: string) => arquivos.map((a) => join(dir, a)).find((f) => existsSync(f)) ?? null;
  let dir = APP;
  const segmentos = rota.split("/").filter(Boolean);
  for (let i = 0; i < segmentos.length; i++) {
    const estatico = join(dir, segmentos[i]);
    if (existsSync(estatico)) { dir = estatico; continue; }
    const nomes = readdirSync(dir);
    const capturaTudo = nomes.find((n) => /^\[\[?\.\.\./.test(n));
    if (capturaTudo) return em(join(dir, capturaTudo));
    const dinamico = nomes.find((n) => /^\[[^.[]/.test(n));
    if (!dinamico) return null;
    dir = join(dir, dinamico);
  }
  const arquivo = em(dir);
  if (arquivo) return arquivo;
  const opcional = readdirSync(dir).find((n) => n.startsWith("[[..."));
  return opcional ? em(join(dir, opcional)) : null;
}

describe("painel principal de cada tema repetido", () => {
  const todos = paineis();

  it("toda cópia registrada tem página que mostra o aviso único, com a própria rota", () => {
    for (const c of COPIAS) {
      const arquivo = paginaDaRota(c.rota);
      expect(arquivo, `${c.rota}: página inexistente`).not.toBeNull();
      const fonte = readFileSync(arquivo as string, "utf-8");
      expect(fonte, `${c.rota}: sem <PainelPrincipal rota="${c.rota}"/>`).toContain(`<PainelPrincipal rota="${c.rota}"`);
    }
  });

  it("toda duplicata do registro está na tabela de cópias, e toda cópia integral registrada é duplicata", () => {
    const rotas = new Set(COPIAS.map((c) => c.rota));
    for (const p of todos.filter((x) => x.duplicataDe)) {
      expect(rotas.has(p.rota), `${p.rota} é duplicata sem aviso registrado`).toBe(true);
      expect(COPIAS.find((c) => c.rota === p.rota)?.principal).toBe(p.duplicataDe);
    }
    for (const c of COPIAS.filter((x) => !x.parcial)) {
      const p = todos.find((x) => x.rota === c.rota);
      if (p) expect(p.duplicataDe, c.rota).toBe(c.principal);
    }
    for (const c of COPIAS.filter((x) => x.parcial)) {
      expect(todos.find((x) => x.rota === c.rota)?.duplicataDe, `${c.rota}: cópia parcial não sai das listas`).toBeUndefined();
    }
  });

  it("o painel principal existe, tem dono no registro e não é ele mesmo uma cópia", () => {
    const copias = new Set(COPIAS.map((c) => c.rota));
    expect(copias.size, "uma entrada por cópia").toBe(COPIAS.length);
    for (const c of COPIAS) {
      expect(c.principal).not.toBe(c.rota);
      expect(donoDaRota(c.principal), `${c.rota} → ${c.principal}`).not.toBeNull();
      expect(paginaDaRota(c.principal, ["page.tsx", "route.ts"]), `${c.principal}: página inexistente`).not.toBeNull();
      expect(copias.has(c.principal), `${c.principal}: cadeia de cópias`).toBe(false);
      expect(c.texto.length, c.rota).toBeGreaterThan(40);
      if (c.parcial) expect(c.tema, `${c.rota}: cópia parcial diz o tema`).toBeTruthy();
    }
  });

  it("o aviso diz \"Painel principal\" e leva ao painel principal", () => {
    for (const c of COPIAS) {
      const html = renderToStaticMarkup(createElement(PainelPrincipal, { rota: c.rota }));
      expect(html).toContain("Painel principal");
      expect(html).toContain(`href="${c.principal}"`);
      expect(html).toContain(c.titulo);
    }
    expect(() => renderToStaticMarkup(createElement(PainelPrincipal, { rota: "/rota-sem-registro" }))).toThrow(/sem painel principal/);
  });

  it("os temas apontados pela banca têm painel principal declarado", () => {
    const principal = (rota: string) => COPIAS.find((c) => c.rota === rota)?.principal;
    // Saneamento: o painel principal é /saneamento; drenagem e resíduos ficam em Cidades e clima.
    for (const r of ["", "/agua", "/esgoto", "/recursos", "/dados"]) {
      expect(principal(`/eficiencia-estatal/saneamento${r}`)?.startsWith("/saneamento"), r || "raiz").toBe(true);
    }
    for (const r of ["/drenagem", "/residuos"]) {
      expect(principal(`/eficiencia-estatal/saneamento${r}`)?.startsWith("/eficiencia-estatal/meio-ambiente-clima"), r).toBe(true);
    }
    // Emissões: a série principal é o inventário oficial.
    expect(principal("/agronegocio/ambiente")).toBe("/territorio/emissoes");
    expect(principal("/eficiencia-estatal/trabalho-renda/emprego-formal")).toBe("/observatorio/formal-employment");
    expect(principal("/eficiencia-estatal/judiciario/acesso")).toBe("/eficiencia-estatal/acesso-justica/cobertura");
  });

  it("Meio ambiente e clima leva aos painéis do Território e Clima e ao desmatamento", () => {
    const fonte = readFileSync(join(APP, "eficiencia-estatal", "meio-ambiente-clima", "[[...painel]]", "page.tsx"), "utf-8");
    for (const rota of ["/territorio/desastres", "/territorio/queimadas", "/territorio/emissoes", "/agronegocio/ambiente"]) {
      expect(fonte, rota).toContain(`'${rota}'`);
      expect(donoDaRota(rota), rota).not.toBeNull();
    }
  });
});
