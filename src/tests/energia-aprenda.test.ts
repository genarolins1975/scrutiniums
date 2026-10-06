import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ConceitoPage from "@/app/setor-eletrico/aprenda/[conceito]/page";
import AprendaPage from "@/app/setor-eletrico/aprenda/page";
import TrilhasPage from "@/app/setor-eletrico/aprenda/trilhas/page";
import TrilhaPage from "@/app/setor-eletrico/aprenda/trilhas/[trilha]/page";
import { CONCEITOS, conceito } from "@/lib/energia/conteudo/conceitos";
import { CONTRASTES, EXEMPLO_SINTETICO, UNIDADE, conferidosSemContraste, contrastesDe } from "@/lib/energia/conteudo/complementos";
import { EXEMPLO_EVIDENCIA, exemploComEvidencia } from "@/lib/energia/conteudo/evidencias-verbetes";
import { exemploDe } from "@/lib/energia/conteudo/exemplos";
import { provaDoPasso, provaDoVerbete } from "@/lib/energia/conteudo/provas";
import { TRILHAS_APRENDA, comVolta, passosComVerbete } from "@/lib/energia/conteudo/trilhas";
import { rotulosRetorno } from "@/lib/energia/conteudo/rotulos-retorno";
import { TIPOS_LIGACAO } from "@/lib/energia/mapa";
import { destinoDaVolta } from "@/lib/energia/retorno";
import { AVISO_SINTETICO, ROTULO_SINTETICO } from "@/lib/energia/sintetico";
import { VIEW_SECTIONS } from "@/lib/telemetry";

/**
 * Aprenda, P065 (glossário completo) e P066 (trilhas e exemplos): trechos literais nas
 * capturas versionadas, todo verbete conferido com unidade quando é grandeza, exemplo ligado
 * a um painel, contraste "não confundir com" e data de conferência; pendente sem definição;
 * trilhas com relações tipificadas, número real em cada passo, exemplo sintético rotulado
 * e caminho de volta do painel ao contexto.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const espacos = (s: string) => s.replace(/\s+/g, " ").trim();
const conferidos = CONCEITOS.filter((c) => c.estado === "CONFERIDO");
const pendentes = CONCEITOS.filter((c) => c.estado === "PENDENTE");

/** Rota do app para um href do portal ("/setor-eletrico/x?y#z" → src/app/setor-eletrico/x/page.tsx). */
function rotaExiste(href: string): boolean {
  const caminho = href.split("#")[0].split("?")[0];
  if (/^\/setor-eletrico\/aprenda\/[^/]+$/.test(caminho) && !caminho.endsWith("/trilhas")) return !!conceito(caminho.split("/").pop()!);
  return existsSync(join(raiz, "src/app", caminho, "page.tsx"));
}

describe("P065: fontes primárias versionadas", () => {
  const dir = readdirSync(join(raiz, "pipeline/energia/seed/documentos_aprenda")).sort().at(-1)!;
  const base = join("pipeline/energia/seed/documentos_aprenda", dir);
  const manifesto = JSON.parse(ler(join(base, "MANIFESTO.json"))) as { arquivos: { arquivo: string; url: string; sha256: string; capturado_em: string }[] };

  it("cada captura confere com o sha256 do manifesto", () => {
    for (const a of manifesto.arquivos) {
      const h = createHash("sha256").update(readFileSync(join(raiz, base, a.arquivo))).digest("hex");
      expect(h, a.arquivo).toBe(a.sha256);
    }
  });

  it("todo trecho citado de uma fonte versionada aparece literalmente na captura, a menos de espaços", () => {
    let conferidosNaCaptura = 0;
    for (const c of conferidos) {
      for (const f of c.fontes) {
        const cap = manifesto.arquivos.find((a) => a.url === f.url);
        if (!cap || !f.trecho) continue;
        const texto = espacos(ler(join(base, cap.arquivo)));
        for (const parte of f.trecho.split("[...]").map(espacos).filter(Boolean)) expect(texto, `${c.slug}: ${parte.slice(0, 60)}`).toContain(parte);
        conferidosNaCaptura++;
      }
    }
    // MRE (InfoMercado) e ACR, ACL, garantia física (três parágrafos) e ESS (dois) no Decreto nº 5.163/2004
    expect(conferidosNaCaptura).toBeGreaterThanOrEqual(5);
  });
});

describe("P065: glossário completo", () => {
  it("inclui os temas pedidos: tarifa, perdas, DEC/FEC, inclusão e emissões, além do núcleo operacional", () => {
    for (const s of ["tarifa-te-tusd", "bandeira-tarifaria", "perdas-de-energia", "perdas-tecnicas", "perdas-nao-tecnicas", "dec", "fec", "tarifa-social", "fator-de-emissao", "pld", "cmo", "ear", "ena", "acl", "acr", "ess", "garantia-fisica"]) {
      expect(conceito(s)?.estado, s).toBe("CONFERIDO");
    }
  });

  it("todo verbete conferido tem data de conferência, contraste e exemplo (real ou sintético rotulado)", () => {
    expect(conferidosSemContraste()).toEqual([]);
    for (const c of conferidos) {
      expect(c.conferidoEm, c.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (c.revisadoEm) expect(c.revisadoEm >= c.conferidoEm!, c.slug).toBe(true);
      const prova = provaDoVerbete(c.slug);
      expect(prova !== null || !!EXEMPLO_SINTETICO[c.slug], c.slug).toBe(true);
    }
  });

  it("os três pendentes não publicam definição, contraste, unidade nem exemplo, e dizem o que já foi consultado", () => {
    expect(pendentes.map((c) => c.slug).sort()).toEqual(["constrained-off", "gsf", "ree"]);
    for (const c of pendentes) {
      expect(c.emUmaFrase, c.slug).toBeUndefined();
      expect(contrastesDe(c.slug), c.slug).toEqual([]);
      expect(UNIDADE[c.slug], c.slug).toBeUndefined();
      expect(EXEMPLO_EVIDENCIA[c.slug], c.slug).toBeUndefined();
      expect(c.fontePlanejada, c.slug).toMatch(/Consultad[oa]s? em 06\/10\/2026/);
    }
  });

  it("contrastes só entre verbetes conferidos, sem par repetido e sem travessão", () => {
    const pares = new Set<string>();
    for (const x of CONTRASTES) {
      expect(conceito(x.a)?.estado, x.a).toBe("CONFERIDO");
      if (typeof x.b === "string") expect(conceito(x.b)?.estado, x.b).toBe("CONFERIDO");
      const chave = [x.a, typeof x.b === "string" ? x.b : x.b.rotulo].sort().join("|");
      expect(pares.has(chave), chave).toBe(false);
      pares.add(chave);
      expect(x.texto, chave).not.toMatch(/[—–]| - /);
    }
    for (const s of Object.keys(UNIDADE)) expect(conceito(s)?.estado, s).toBe("CONFERIDO");
  });

  it("cada exemplo com evidência resolve na gold publicada e aponta um painel que existe; o texto lido da gold também", () => {
    for (const [slug, f] of Object.entries(EXEMPLO_EVIDENCIA)) {
      const ex = exemploComEvidencia(slug);
      expect(ex, slug).not.toBeNull();
      expect(ex!.evidencia.valor_exibido, slug).not.toMatch(/sem dado|NaN|undefined/);
      expect(rotaExiste(f.painel.href), `${slug} → ${f.painel.href}`).toBe(true);
      expect(f.painel.href, slug).toContain("#");
      // um conceito, um exemplo: o texto da gold não disputa com a ficha
      expect(exemploDe(slug), slug).toBeNull();
    }
    for (const c of conferidos) {
      const tx = exemploDe(c.slug);
      if (tx) expect(rotaExiste(tx.href), `${c.slug} → ${tx.href}`).toBe(true);
      for (const v of c.vejaNoPortal) expect(rotaExiste(v.href), `${c.slug} → ${v.href}`).toBe(true);
    }
  });

  it("o exemplo derivado da gold muda com o número (garantia física: menos ou mais que a geração)", () => {
    const t = exemploDe("garantia-fisica")!.partes.map((p) => p.texto).join("");
    expect(t).toMatch(/geraram (menos|mais|o mesmo) que a garantia física/);
  });
});

describe("P065: páginas dos verbetes", () => {
  const paginas = Object.fromEntries(CONCEITOS.map((c) => [c.slug, renderToStaticMarkup(createElement(ConceitoPage, { params: { conceito: c.slug } }))]));

  it("conferido: unidade quando é grandeza, exemplo ancorado, não confundir, fonte e data; pendente sem nada disso", () => {
    for (const c of conferidos) {
      const h = paginas[c.slug];
      expect(h, c.slug).toContain('id="exemplo"');
      expect(h, c.slug).toContain("Não confundir com");
      expect(h, c.slug).toContain("conferido na fonte primária em");
      expect(h, c.slug).toContain("Documentos acessados e texto conferido em");
      if (UNIDADE[c.slug]) expect(h, c.slug).toContain(">Unidade<");
      if (EXEMPLO_SINTETICO[c.slug]) {
        expect(h, c.slug).toContain('data-sintetico="true"');
        expect(h, c.slug).toContain(ROTULO_SINTETICO);
        expect(h, c.slug).toContain(AVISO_SINTETICO);
      } else {
        expect(h, c.slug).toMatch(/data-prova="(evidencia|texto)"/);
        expect(h, c.slug).toContain(encodeURIComponent(`verbete:${c.slug}`));
      }
    }
    for (const c of pendentes) {
      const h = paginas[c.slug];
      expect(h, c.slug).toContain("verbete em preparação");
      expect(h, c.slug).not.toContain("Não confundir com");
      expect(h, c.slug).not.toContain("data-prova");
      expect(h, c.slug).not.toContain(">Unidade<");
    }
  });

  it("verbete revisado mostra as duas datas; trilhas listadas no verbete", () => {
    expect(paginas.cvu).toContain("revisado em 06/10/2026");
    expect(paginas.cvu).not.toContain("ainda não integrado");
    expect(paginas.ear).toContain("Nas trilhas");
    expect(paginas.ear).toContain("/setor-eletrico/aprenda/trilhas/agua-operacao-preco#passo-armazenamento");
    expect(passosComVerbete("tarifa-social").map((x) => x.trilha.id)).toEqual(["custo-tarifa-orcamento"]);
  });

  it("sem valor de reserva, sem data crua no texto e leves", () => {
    for (const [slug, h] of Object.entries(paginas)) {
      expect(h, slug).not.toMatch(/NaN|undefined|\[object Object\]/);
      const texto = h.replace(/<[^>]+>/g, " ");
      expect(texto, slug).not.toMatch(/(^|[\s(])20\d\d[-/]\d\d([-/]\d\d)?(T[\d:]+Z?)?(?=[\s).,;]|$)/);
      expect(Buffer.byteLength(h, "utf-8"), slug).toBeLessThan(120 * 1024);
    }
  });
});

describe("P066: trilhas", () => {
  it("duas trilhas: água → operação → preço e custo → tarifa → orçamento, com relações tipificadas", () => {
    expect(TRILHAS_APRENDA.map((t) => t.id)).toEqual(["agua-operacao-preco", "custo-tarifa-orcamento"]);
    const agua = TRILHAS_APRENDA[0].passos.flatMap((p) => p.conceitos);
    for (const s of ["ena", "ear", "cvu", "cmo", "pld", "mcp", "mre"]) expect(agua, s).toContain(s);
    const custo = TRILHAS_APRENDA[1].passos.flatMap((p) => p.conceitos);
    for (const s of ["percentual-regulatorio-de-perdas", "cde", "tarifa-te-tusd", "bandeira-tarifaria", "tarifa-social"]) expect(custo, s).toContain(s);
    for (const t of TRILHAS_APRENDA) {
      t.passos.forEach((p, i) => {
        const ultimo = i === t.passos.length - 1;
        expect(!!p.ligacao, `${t.id}/${p.id}`).toBe(!ultimo);
        if (p.ligacao) expect(Object.keys(TIPOS_LIGACAO), p.id).toContain(p.ligacao.tipo);
        for (const s of p.conceitos) expect(conceito(s)?.estado, `${p.id}: ${s}`).toBe("CONFERIDO");
        const prova = provaDoPasso(p.prova);
        expect(prova, `${t.id}/${p.id}`).not.toBeNull();
        const href = prova!.tipo === "evidencia" ? prova!.dado.painel.href : prova!.href;
        expect(rotaExiste(href), `${p.id} → ${href}`).toBe(true);
      });
      expect(new Set(t.passos.map((p) => p.id)).size).toBe(t.passos.length);
      expect(t.naoConclua.length).toBeGreaterThan(0);
    }
    // os tipos que a pergunta pede: físico e operação até o preço; mercado no preço; custo até a conta
    expect(TRILHAS_APRENDA[0].passos.map((p) => p.ligacao?.tipo).filter(Boolean)).toEqual(["fisico", "operacao", "operacao", "mercado", "mercado"]);
    expect(TRILHAS_APRENDA[1].passos.map((p) => p.ligacao?.tipo).filter(Boolean)).toEqual(["custo", "custo", "custo", "associacao"]);
  });

  const paginas = Object.fromEntries(TRILHAS_APRENDA.map((t) => [t.id, renderToStaticMarkup(createElement(TrilhaPage, { params: { trilha: t.id } }))]));
  const indice = renderToStaticMarkup(createElement(TrilhasPage));
  const aprenda = renderToStaticMarkup(createElement(AprendaPage));

  it("cada passo com âncora, número real e link ao painel com o caminho de volta; ligações com o traço do tipo", () => {
    for (const t of TRILHAS_APRENDA) {
      const h = paginas[t.id];
      for (const p of t.passos) {
        expect(h, p.id).toContain(`id="passo-${p.id}"`);
        expect(h, p.id).toContain(encodeURIComponent(`trilha:${t.id}:${p.id}`));
      }
      expect((h.match(/data-prova="(evidencia|texto)"/g) ?? []).length, t.id).toBe(t.passos.length);
      expect((h.match(/data-ligacao="/g) ?? []).length, t.id).toBe(t.passos.length - 1);
      for (const p of t.passos) if (p.ligacao && TIPOS_LIGACAO[p.ligacao.tipo].traco) expect(h).toContain(`stroke-dasharray="${TIPOS_LIGACAO[p.ligacao.tipo].traco}"`);
      expect(h, t.id).toContain("O que esta trilha não permite concluir");
    }
  });

  it("exemplo sintético com rótulo permanente, sem selo de natureza e sem número da gold", () => {
    for (const t of TRILHAS_APRENDA) {
      const h = paginas[t.id];
      const ini = h.indexOf('data-sintetico="true"');
      expect(ini, t.id).toBeGreaterThan(0);
      const quadro = h.slice(ini, h.indexOf("</section>", ini));
      expect(quadro, t.id).toContain(ROTULO_SINTETICO);
      expect(quadro, t.id).toContain(AVISO_SINTETICO);
      expect(quadro, t.id).not.toContain("Natureza do dado");
      expect(quadro, t.id).not.toContain("Comprove");
      // cada resultado carrega o rótulo ao lado
      const resultados = quadro.match(/data-resultado-sintetico="true"/g) ?? [];
      expect(resultados.length, t.id).toBeGreaterThan(0);
      expect((quadro.match(/· sintético/g) ?? []).length, t.id).toBe(resultados.length);
    }
    // valores de partida hipotéticos e redondos, longe dos limites vigentes
    expect(paginas["agua-operacao-preco"]).toContain("R$ 250/MWh");
    expect(paginas["custo-tarifa-orcamento"]).toContain("R$ 120,00");
  });

  it("o simulador não grava na URL, não usa a gold e não manda telemetria", () => {
    const t = ler("src/components/energia/AprendaSimulacao.tsx");
    expect(t).not.toMatch(/useEstadoUrl|lerGold|carregaJson|fetch\(|sendBeacon|MarcaVisita/);
  });

  it("índice das trilhas, Aprenda com as trilhas e telemetria própria", () => {
    for (const t of TRILHAS_APRENDA) {
      expect(indice).toContain(`/setor-eletrico/aprenda/trilhas/${t.id}`);
      expect(aprenda).toContain(`/setor-eletrico/aprenda/trilhas/${t.id}`);
    }
    expect(VIEW_SECTIONS).toContain("energia:aprenda:trilhas");
    for (const [id, h] of Object.entries({ ...paginas, indice, aprenda })) {
      expect(h, id).not.toMatch(/NaN|undefined|\[object Object\]/);
      const texto = h.replace(/<[^>]+>/g, " ");
      expect(texto, id).not.toMatch(/(^|[\s(])20\d\d[-/]\d\d([-/]\d\d)?(T[\d:]+Z?)?(?=[\s).,;]|$)/);
      expect(Buffer.byteLength(h, "utf-8"), id).toBeLessThan(200 * 1024);
    }
  });
});

describe("links do Aprenda no site construído", () => {
  const app = join(raiz, ".next/server/app");
  it.skipIf(!existsSync(join(app, "setor-eletrico/aprenda/trilhas.html")))("todo link do Aprenda aponta para rota e âncora pré-renderizadas (quando o build existe)", () => {
    const paginas = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? paginas(join(dir, e.name)) : e.name.endsWith(".html") ? [join(dir, e.name)] : []));
    const html = new Map(paginas(app).map((f) => ["/" + f.slice(app.length + 1, -5), readFileSync(f, "utf-8")]));
    const falhas: string[] = [];
    for (const [rota, h] of Array.from(html.entries())) {
      if (!rota.startsWith("/setor-eletrico/aprenda")) continue;
      for (const m of Array.from(h.matchAll(/href="(\/setor-eletrico[^"]*)"/g))) {
        const href = m[1].replace(/&amp;/g, "&");
        const [base, ancora] = href.split("#");
        const alvo = html.get(base.split("?")[0]);
        if (!alvo) falhas.push(`${rota} → ${href} (rota)`);
        else if (ancora && !alvo.includes(`id="${ancora}"`)) falhas.push(`${rota} → ${href} (âncora)`);
      }
    }
    expect(Array.from(new Set(falhas))).toEqual([]);
  });
});

describe("P066: volta do painel ao contexto", () => {
  const r = rotulosRetorno();

  it("o parâmetro entra antes da âncora e preserva a busca existente", () => {
    expect(comVolta("/setor-eletrico/pld#hoje", "verbete:pld")).toBe("/setor-eletrico/pld?volta=verbete%3Apld#hoje");
    expect(comVolta("/setor-eletrico/pld/historico?modo=analisar#p011", "trilha:agua-operacao-preco:pld")).toBe(
      "/setor-eletrico/pld/historico?modo=analisar&volta=trilha%3Aagua-operacao-preco%3Apld#p011",
    );
  });

  it("destino e texto do botão para verbete e trilha; parâmetro desconhecido não vira botão", () => {
    expect(destinoDaVolta("verbete:ear", r)).toEqual({ href: "/setor-eletrico/aprenda/ear#exemplo", texto: "Voltar ao verbete EAR" });
    expect(destinoDaVolta("trilha:agua-operacao-preco:cmo", r)).toEqual({
      href: "/setor-eletrico/aprenda/trilhas/agua-operacao-preco#passo-cmo",
      texto: "Voltar à trilha Água, operação e preço, passo 4",
    });
    expect(destinoDaVolta("trilha:agua-operacao-preco:xyz", r)?.href).toBe("/setor-eletrico/aprenda/trilhas/agua-operacao-preco");
    expect(destinoDaVolta("verbete:gsf", r)).toBeNull();
    expect(destinoDaVolta("https://exemplo.com", r)).toBeNull();
    expect(destinoDaVolta("trilha:outra:x", r)).toBeNull();
  });

  it("o cabeçalho de toda página do observatório carrega o botão de volta só com rótulos curtos", () => {
    expect(ler("src/components/energia/CabecalhoEnergia.tsx")).toContain("<RetornoContexto rotulos={rotulosRetorno()} />");
    expect(Buffer.byteLength(JSON.stringify(r), "utf-8")).toBeLessThan(2 * 1024);
  });
});
