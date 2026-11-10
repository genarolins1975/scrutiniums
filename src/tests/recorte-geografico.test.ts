/**
 * Recorte geográfico dos temas da Eficiência Estatal (recomendação 3 do parecer estrutural aprovado pelo dono em 10/11/2026).
 *
 * "Eficiência Estatal" é método (recursos, acesso, resultado) e origem de dado; a unidade de navegação é a coleção do registro
 * (Observatório → Coleção → Página, src/tests/vocabulario.test.ts). E quem mora fora das capitais precisa saber, antes de abrir o
 * painel, se a cidade dele está lá. Este teste reprova:
 *
 * 1. tema sem recorte declarado no catálogo (src/lib/eficiencia/temas.ts), ou recorte que os dados publicados desmentem;
 * 2. painel restrito às capitais cujo título (registro, navegação, aba do navegador) não diz "capitais", e o contrário: título
 *    que promete capitais num painel que não publica valor por capital;
 * 3. tema restrito ao estado ou ao país cujo rótulo de contexto (acima do H1) não diz o recorte;
 * 4. rótulo de navegação, título de aba ou link que use "Eficiência Estatal" ou "OBEE" como lugar.
 *
 * Invariantes, sem texto literal de tela (decisão do dono de 23/10/2026): os nomes vêm do catálogo e do registro.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { DIMENSOES } from "@/lib/eficiencia/dimensoes";
import {
  RECORTE_CAPITAIS, TEMAS_EFICIENCIA, declaraCapitais, recorteRestrito, tituloComRecorte, type NivelRecorte, type TemaEficiencia,
} from "@/lib/eficiencia/temas";
import { TITULO_CAPITAIS } from "@/lib/educacao/paginas";
import { DOMINIOS } from "@/lib/dominios";
import { OBSERVATORIOS } from "@/lib/observatorios/lista";
import { paineis } from "@/lib/observatorios/registro";
import { idsDasColecoes, navegacaoDaColecao, navegacaoDoObservatorio } from "@/lib/observatorios/navegacaoColecao";
import { indiceCompleto } from "@/lib/observatorios/contexto";
import { resolverContexto } from "@/lib/observatorios/contextoPuro";
import { Footer } from "@/components/layout/Footer";

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const json = (p: string) => JSON.parse(ler(p));
function arquivos(dir: string, ext: RegExp): string[] {
  const abs = join(raiz, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((n) => {
    const p = join(dir, n);
    return statSync(join(raiz, p)).isDirectory() ? arquivos(p, ext) : ext.test(n) ? [p] : [];
  });
}

const TEMAS = Object.entries(TEMAS_EFICIENCIA) as [string, TemaEficiencia][];
const NIVEIS: NivelRecorte[] = ["capitais", "municipios", "ufs", "brasil"];
const DAS_CAPITAIS = TEMAS.filter(([, t]) => t.recorte.nivel === "capitais");
const FORA_DAS_CAPITAIS = TEMAS.filter(([, t]) => t.recorte.nivel !== "capitais");
/** O nome do domínio de origem e a sigla dele: valem como método e origem do dado, nunca como lugar de navegação. */
const DOMINIO = DOMINIOS.find((d) => d.id === "eficiencia")!;
const COMO_LUGAR = new RegExp(`${DOMINIO.nomeCurto}|\\bOBEE\\b`);
/** A coleção do registro que mora no endereço do domínio. */
const SINTESE = OBSERVATORIOS.flatMap((o) => o.colecoes).find((c) => c.dominio === "eficiencia")!;
const sobRota = (href: string, rota: string) => href === rota || href.startsWith(`${rota}/`);

// --------------------------------------------------------------------------------------------- 1. recorte declarado

describe("1. todo tema da Eficiência tem recorte geográfico declarado", () => {
  it("no catálogo: nível conhecido e rótulo escrito, um por tema", () => {
    expect(TEMAS.length).toBeGreaterThan(0);
    for (const [id, t] of TEMAS) {
      expect(NIVEIS, id).toContain(t.recorte.nivel);
      expect(t.recorte.rotulo.trim().length, id).toBeGreaterThan(0);
      expect(t.recorte.rotulo, id).not.toMatch(/undefined|NaN|—/);
    }
  });

  it("todo tema do mapa com painel próprio está no catálogo, com recorte", () => {
    for (const d of DIMENSOES.filter((x) => x.href?.startsWith("/eficiencia-estatal/"))) {
      const t = (TEMAS_EFICIENCIA as Record<string, TemaEficiencia>)[d.id];
      expect(t, d.id).toBeDefined();
      expect(sobRota(d.href!, t.rota) || sobRota(t.rota, d.href!), `${d.id}: ${d.href} e ${t.rota}`).toBe(true);
    }
  });

  it("o recorte declarado é o dos dados publicados", () => {
    // capitais: as golds trazem o universo de 26 capitais em toda referência
    for (const [id, arquivo] of [["educacao", "educacao_capitais"], ["saude", "saude_capitais"]] as const) {
      expect(TEMAS_EFICIENCIA[id].recorte, id).toEqual(RECORTE_CAPITAIS);
      const gold = json(`public/eficiencia/gold/${arquivo}.json`) as { referencias: { grupo: string; capitais_no_grupo: number }[]; observacoes: { ente: number }[] };
      const n = new Set(gold.observacoes.map((o) => o.ente)).size;
      expect(RECORTE_CAPITAIS.rotulo, id).toContain(String(n));
      expect(gold.referencias.filter((r) => r.grupo === "todas").every((r) => r.capitais_no_grupo === n), id).toBe(true);
    }
    // saneamento (SINISA): Brasil, regiões e UFs; nenhum valor por município ou capital
    const tipos = new Set((json("public/eficiencia/saneamento/snapshot.json") as { valores: { tipo: string }[] }).valores.map((v) => v.tipo));
    expect([...tipos].sort()).toEqual(["Brasil", "Região", "UF"]);
    expect(TEMAS_EFICIENCIA.saneamento.recorte.nivel).toBe("ufs");
    // habitação (FJP): Brasil, regiões e UFs
    const hab = (json("public/eficiencia/habitacao/snapshot.json") as { territorios: { ano: string; nome: string }[] }).territorios;
    expect(new Set(hab.map((t) => t.nome)).size).toBeLessThanOrEqual(1 + 5 + 27);
    expect(TEMAS_EFICIENCIA.habitacao.recorte.nivel).toBe("ufs");
    // energia: a PNAD Contínua da gold de inclusão vai até a UF
    const pnad = (json("public/energia/gold/inclusao.json") as { acesso: { pnad_serie: { territorio: string }[] } }).acesso.pnad_serie;
    expect(new Set(pnad.map((r) => r.territorio)).size).toBe(1 + 5 + 27);
    expect(TEMAS_EFICIENCIA.energia.recorte.nivel).toBe("ufs");
    // trabalho e renda: chega ao município
    const niveis = new Set((json("public/eficiencia/trabalho-renda/snapshot.json") as { territorios: { nivel: string }[] }).territorios.map((t) => t.nivel));
    expect(niveis.has("municipio")).toBe(true);
    expect(TEMAS_EFICIENCIA.trabalho.recorte.nivel).toBe("municipios");
  });
});

// ---------------------------------------------------------------------------------- 2. capitais no título, e só nelas

describe("2. painel restrito às capitais diz o recorte no título", () => {
  it("o nome do tema diz \"capitais\" se, e só se, o recorte são as capitais", () => {
    expect(DAS_CAPITAIS.length).toBeGreaterThan(0);
    for (const [id, t] of TEMAS) expect(declaraCapitais(t.nome), `${id}: ${t.nome}`).toBe(t.recorte.nivel === "capitais");
    // a forma é uma só, a do catálogo, também para quem escreve o título à mão em outro módulo
    expect(TITULO_CAPITAIS).toBe(TEMAS_EFICIENCIA.educacao.nome);
    expect(tituloComRecorte("X", RECORTE_CAPITAIS)).toBe(`X ${TEMAS_EFICIENCIA.saude.nome.split(" ").slice(1).join(" ")}`);
    expect(tituloComRecorte(TEMAS_EFICIENCIA.saude.nome, RECORTE_CAPITAIS)).toBe(TEMAS_EFICIENCIA.saude.nome);
    for (const [, t] of FORA_DAS_CAPITAIS) expect(tituloComRecorte(t.nome, t.recorte)).toBe(t.nome);
  });

  const daEficiencia = paineis().filter((p) => p.origem === "eficiencia");
  const temaDaRota = (rota: string) => TEMAS.filter(([, t]) => sobRota(rota, t.rota)).sort((a, b) => b[1].rota.length - a[1].rota.length)[0]?.[1];

  it("no registro: os painéis da Síntese e os dos temas das capitais dizem \"capitais\"; os demais não prometem capitais", () => {
    expect(daEficiencia.length).toBeGreaterThan(TEMAS.length);
    for (const p of daEficiencia) {
      const tema = temaDaRota(p.rota);
      const soCapitais = tema ? tema.recorte.nivel === "capitais" : p.colecao === SINTESE.id;
      if (soCapitais) expect(declaraCapitais(p.titulo), `${p.rota}: "${p.titulo}" não diz o recorte`).toBe(true);
      else expect(declaraCapitais(p.titulo), `${p.rota}: "${p.titulo}" promete capitais que o painel não tem`).toBe(false);
    }
  });

  it("na navegação das coleções: rótulo que leva a um tema só diz \"capitais\" quando o tema é das capitais", () => {
    for (const id of idsDasColecoes()) {
      const nav = navegacaoDaColecao(id);
      for (const item of nav.itens) {
        const tema = temaDaRota(item.href);
        if (!tema || item.href !== tema.rota) continue;
        // o tema aparece como grupo de outra coleção, ou como início da própria
        if (tema.recorte.nivel !== "capitais") expect(declaraCapitais(item.rotulo), `${id}: "${item.rotulo}" → ${item.href}`).toBe(false);
        else if (item.subpaginas?.length) expect(declaraCapitais(item.rotulo), `${id}: "${item.rotulo}" → ${item.href}`).toBe(true);
      }
    }
  });

  it("no título da aba: toda página dos temas das capitais diz \"capitais\"", () => {
    for (const [id, t] of DAS_CAPITAIS) {
      const paginas = arquivos(`src/app${t.rota}`, /^page\.tsx$/);
      expect(paginas.length, id).toBeGreaterThan(1);
      for (const f of paginas) {
        const fonte = ler(f);
        // o título é um texto com o recorte, ou o nome do tema lido do catálogo
        const titulo = /\btitle:\s*(?:tituloNaColecao\()?\s*["'`]([^"'`]+)["'`]/.exec(fonte)?.[1] ?? (/\btitle:[^\n]*TEMAS_EFICIENCIA\.\w+\.nome/.test(fonte) ? t.nome : null);
        expect(titulo, `${f}: sem título`).not.toBeNull();
        expect(declaraCapitais(titulo!), `${f}: "${titulo}"`).toBe(true);
      }
    }
  });
});

// ------------------------------------------------------------------------------------ 3. recorte no rótulo de contexto

describe("3. tema que para no estado ou no país diz o recorte no rótulo de contexto", () => {
  it("o contexto do catálogo traz o recorte de todo tema restrito; tema que chega ao município fica só com o nome", () => {
    for (const [id, t] of TEMAS) {
      expect(t.contexto.startsWith(t.nome), id).toBe(true);
      if (!recorteRestrito(t.recorte)) expect(t.contexto, id).toBe(t.nome);
      else expect(declaraCapitais(t.contexto) || t.contexto.includes(t.recorte.rotulo), `${id}: ${t.contexto}`).toBe(true);
    }
  });

  it("as páginas leem o rótulo do catálogo: nenhuma abertura usa o nome do tema sem o recorte", () => {
    const achados: string[] = [];
    for (const f of [...arquivos("src/app/eficiencia-estatal", /\.tsx$/), ...arquivos("src/components/eficiencia", /\.tsx$/)]) {
      ler(f).split("\n").forEach((linha, i) => {
        for (const m of linha.matchAll(/grupo:\s*TEMAS_EFICIENCIA\.(\w+)\.nome\b([^\n]{0,120})/g)) {
          if (!m[2].includes(`TEMAS_EFICIENCIA.${m[1]}.recorte.rotulo`)) achados.push(`${f}:${i + 1}`);
        }
      });
    }
    expect(achados).toEqual([]);
  });

  it("todo tema restrito fora das capitais tem ao menos uma página que escreve o contexto ou o recorte do catálogo", () => {
    const fontes = [...arquivos("src/app/eficiencia-estatal", /\.tsx$/), ...arquivos("src/components/eficiencia", /\.tsx$/)].map(ler).join("\n");
    for (const [id, t] of FORA_DAS_CAPITAIS.filter(([, x]) => recorteRestrito(x.recorte))) {
      expect(new RegExp(`TEMAS_EFICIENCIA\\.${id}\\.(contexto|recorte\\.rotulo)`).test(fontes), `${id} (${t.recorte.rotulo})`).toBe(true);
    }
  });
});

// ------------------------------------------------------------------------- 4. "Eficiência Estatal" não é lugar de navegação

describe("4. nenhum rótulo de navegação usa \"Eficiência Estatal\" como unidade", () => {
  it("o domínio se apresenta com o nome da coleção do registro", () => {
    expect(DOMINIO.nome).toBe(SINTESE.nome);
    expect(COMO_LUGAR.test(SINTESE.nome)).toBe(false);
    for (const o of OBSERVATORIOS) {
      expect(COMO_LUGAR.test(o.nome) || COMO_LUGAR.test(o.nomeCurto), o.id).toBe(false);
      for (const c of o.colecoes) expect(COMO_LUGAR.test(c.nome), `${o.id}/${c.id}`).toBe(false);
    }
  });

  it("navegação das 28 coleções e do observatório que mantém painéis próprios: rótulos e aria-label", () => {
    const navs = [...idsDasColecoes().map((id) => navegacaoDaColecao(id)), navegacaoDoObservatorio("territorio-e-clima")];
    expect(navs.length).toBeGreaterThanOrEqual(28);
    for (const nav of navs) {
      expect(COMO_LUGAR.test(nav.nome), nav.id).toBe(false);
      for (const item of nav.itens) {
        expect(COMO_LUGAR.test(item.rotulo), `${nav.id}: ${item.rotulo}`).toBe(false);
        for (const s of item.subpaginas ?? []) expect(COMO_LUGAR.test(s.rotulo), `${nav.id}: ${s.rotulo}`).toBe(false);
      }
    }
  });

  it("rótulo de contexto e trilha: observatório, coleção e página de toda rota do registro", () => {
    const indice = indiceCompleto();
    for (const p of paineis()) {
      expect(COMO_LUGAR.test(p.titulo), `${p.rota}: ${p.titulo}`).toBe(false);
      const ctx = resolverContexto(p.rota, indice);
      expect(ctx, p.rota).not.toBeNull();
      for (const nome of [ctx!.observatorio.nome, ctx!.colecao?.nome, ctx!.pagina?.titulo]) expect(COMO_LUGAR.test(nome ?? ""), `${p.rota}: ${nome}`).toBe(false);
    }
  });

  it("rodapé: nenhuma coluna nem link com o nome do domínio", () => {
    for (const el of [createElement(Footer), createElement(Footer, { compacto: true })]) expect(COMO_LUGAR.test(renderToStaticMarkup(el))).toBe(false);
  });

  it("páginas da origem Eficiência Estatal: nenhum link nem título de aba com o nome do domínio ou a sigla", () => {
    const achados: string[] = [];
    const LINK = /<(?:Link|a)\b[^>]*>([^<{]*)<\/(?:Link|a)>/g;
    for (const f of [...arquivos("src/app/eficiencia-estatal", /\.tsx?$/), ...arquivos("src/components/eficiencia", /\.tsx$/)]) {
      const fonte = ler(f);
      for (const m of fonte.matchAll(LINK)) if (COMO_LUGAR.test(m[1])) achados.push(`${f}: link "${m[1].trim()}"`);
      for (const m of fonte.matchAll(/\btitle:\s*(["'`])((?:(?!\1).)*)\1/g)) if (COMO_LUGAR.test(m[2])) achados.push(`${f}: título "${m[2]}"`);
      for (const m of fonte.matchAll(/<title>([^<]*)<\/title>/g)) if (COMO_LUGAR.test(m[1])) achados.push(`${f}: título "${m[1]}"`);
    }
    expect(achados).toEqual([]);
  });

  it("os links de contexto dos temas levam o nome da coleção do registro", () => {
    for (const f of arquivos("src/app/eficiencia-estatal", /^layout\.tsx$/)) {
      const fonte = ler(f);
      // link para a entrada do domínio escrito à mão: o rótulo tem de vir do registro (colecaoDoDominio)
      expect(/<Link href="\/eficiencia-estatal"[^>]*>[^<{]/.test(fonte), f).toBe(false);
    }
  });
});
