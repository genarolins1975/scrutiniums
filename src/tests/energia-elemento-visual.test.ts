import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// O Next instala o AsyncLocalStorage global no servidor dele; aqui o teste faz o mesmo antes dos imports (render da página inglesa).
vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
});
import { staticGenerationAsyncStorage } from "next/dist/client/components/static-generation-async-storage.external";
import ConceitoPage from "@/app/setor-eletrico/aprenda/[conceito]/page";
import DatasetPage, { generateStaticParams as paramsDatasets } from "@/app/setor-eletrico/dados/[dataset]/page";
import { CONCEITOS, conceito } from "@/lib/energia/conteudo/conceitos";
import { elosDoVerbete, moduloDoEndereco, posicaoNoSistema } from "@/lib/energia/conteudo/posicao-no-sistema";
import { publicacaoDados } from "@/lib/energia/dados-servidor";
import { catalogoDados, datasetPorSlug } from "@/lib/energia/datasets";
import { diaDeBrasilia, diasDaReferencia, formaDoConjunto, marcasDoEixo, numeroDoDia } from "@/lib/energia/forma-conjunto";
import { dataBR } from "@/lib/energia/formato";
import { LIGACOES, NOS_MAPA } from "@/lib/energia/mapa";

/**
 * Elemento visual dos dois moldes do Setor Elétrico (pedido do dono de 10/11/2026: "um elemento visual super bem feito em todas as
 * páginas"; a auditoria de layout do mesmo dia contou 175 páginas sem figura nestes dois moldes): a ficha de conjunto de dados
 * (`FormaDoConjunto`) e o verbete do Aprenda (`VerbeteNoSistema`).
 *
 * Invariantes, não texto literal: toda página dos dois moldes tem a figura; ela tem equivalente em texto; vem depois do título;
 * nenhuma data ou contagem desenhada que não esteja no dado de origem; nada de `undefined`, `NaN` ou data crua.
 */

const emRender = <T,>(urlPathname: string, f: () => T): T => (staticGenerationAsyncStorage as unknown as { run: (s: unknown, cb: () => T) => T }).run({ urlPathname }, f);
const texto = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
const DATA_CRUA = /(^|[\s(])20\d\d[-/]\d\d([-/]\d\d)?(T[\d:]+Z?)?(?=[\s).,;]|$)/;
const SEM_VALOR = /NaN|undefined|\[object Object\]|Infinity/;

describe("forma-conjunto: datas viram posições, nada é recalculado", () => {
  it("lê ano, mês, dia, hora, intervalo de anos e vigência; o que não é data não tem período", () => {
    expect(diasDaReferencia("2026")).toEqual({ inicio: numeroDoDia("2026-01-01"), fim: numeroDoDia("2026-12-31") });
    expect(diasDaReferencia("2024-02")).toEqual({ inicio: numeroDoDia("2024-02-01"), fim: numeroDoDia("2024-02-29") });
    expect(diasDaReferencia("2026-09-30T23:00")).toEqual({ inicio: numeroDoDia("2026-09-30"), fim: numeroDoDia("2026-09-30") });
    expect(diasDaReferencia("2017-2018")).toEqual({ inicio: numeroDoDia("2017-01-01"), fim: numeroDoDia("2018-12-31") });
    expect(diasDaReferencia("2025-09-30|2025-12-31|REH 3.537/2025")).toEqual({ inicio: numeroDoDia("2025-09-30"), fim: numeroDoDia("2025-12-31") });
    for (const naoData of ["1100015", "", "abc", "2026-13"]) expect(diasDaReferencia(naoData), naoData).toBeNull();
    expect(diasDaReferencia(undefined)).toBeNull();
  });

  it("instante em UTC vira o dia de Brasília; data sem hora fica como está", () => {
    expect(diaDeBrasilia("2026-09-30T02:19:44Z")).toBe("2026-09-29");
    expect(diaDeBrasilia("2026-09-30")).toBe("2026-09-30");
    expect(diaDeBrasilia(null)).toBeNull();
  });

  it("o eixo tem de duas a cinco marcas dentro do intervalo, ou nenhuma", () => {
    for (const [de, ate] of [["2000-01-01", "2026-10-01"], ["2021-01-01", "2026-10-01"], ["2026-07-01", "2026-10-01"], ["2026-09-29", "2026-10-01"], ["1979-12-01", "2026-10-01"], ["2025-01-01", "2035-12-31"]]) {
      const m = marcasDoEixo(numeroDoDia(de)!, numeroDoDia(ate)!);
      expect(m.length === 0 || (m.length >= 2 && m.length <= 5), `${de} a ${ate}: ${m.length}`).toBe(true);
      for (const x of m) {
        expect(x.x).toBeGreaterThanOrEqual(0);
        expect(x.x).toBeLessThanOrEqual(1);
      }
      for (let i = 1; i < m.length; i++) expect(m[i].x).toBeGreaterThan(m[i - 1].x);
    }
    expect(marcasDoEixo(10, 10)).toEqual([]);
  });

  it("referência futura fica separada, período em curso para na data da publicação e o atraso é o que o pipeline publica", () => {
    const base = { capturas: { ultima: "2026-09-30T22:00:00Z" } };
    const futuro = formaDoConjunto({ ...base, atualidade: { situacao: "SEM SLA" }, dado: { granularidade: "anual", ref_min: "2025", ref_max: "2035" } } as never, "2026-10-01");
    expect(futuro.periodo!.xFuturo).toBe(1);
    expect(futuro.periodo!.x1).toBeCloseTo(futuro.eixo!.xHoje, 9);
    const emCurso = formaDoConjunto({ ...base, atualidade: { situacao: "EM DIA" }, dado: { granularidade: "anual", ref_min: "2013", ref_max: "2026" } } as never, "2026-10-01");
    expect(emCurso.periodo!.xFuturo).toBeNull();
    expect(emCurso.periodo!.x1).toBeCloseTo(emCurso.eixo!.xHoje, 9);
    expect(emCurso.periodo!.x1).toBeLessThan(1);
    const atrasado = formaDoConjunto(
      { ...base, atualidade: { situacao: "ATRASADO", prazo_proximo: "2025-09-29", fim_ultimo_periodo: "2025-06-30", dias_atraso: 367 }, dado: { granularidade: "mensal", ref_min: "2011-12", ref_max: "2025-06" } } as never,
      "2026-10-01",
    );
    expect(atrasado.atraso?.dias).toBe(367);
    expect(atrasado.eventos.map((e) => e.id)).toEqual(["fim_periodo", "prazo", "captura", "publicacao"]);
    const semPeriodo = formaDoConjunto({ ...base, atualidade: { situacao: "SEM SLA" }, dado: { granularidade: "sem referência temporal", formato: "nao_temporal", ref_min: "1100015", ref_max: "5300108" } } as never, "2026-10-01");
    expect(semPeriodo.periodo).toBeNull();
    expect(formaDoConjunto(null, "2026-10-01")).toEqual({ hoje: "2026-10-01", periodo: null, eixo: null, quebras: [], eventos: [], atraso: null });
  });
});

describe("ficha de conjunto de dados: a figura da forma do conjunto", () => {
  const pub = publicacaoDados()!;
  const cat = catalogoDados()!;
  const slugs = paramsDatasets().map((p) => p.dataset);
  const paginas = Object.fromEntries(slugs.map((s) => [s, renderToStaticMarkup(createElement(DatasetPage, { params: { dataset: s } }))]));
  const figura = (h: string) => {
    const i = h.indexOf('<section id="forma-do-conjunto"');
    return i < 0 ? "" : h.slice(i, h.indexOf("</figure>", i));
  };

  it("toda ficha tem a figura, depois do título e antes dos metadados, com equivalente em texto", () => {
    expect(slugs.length).toBeGreaterThan(100);
    for (const s of slugs) {
      const h = paginas[s];
      const f = figura(h);
      expect(f, s).toContain('data-elemento-visual="forma-do-conjunto"');
      expect(h.indexOf('data-elemento-visual="forma-do-conjunto"'), s).toBeGreaterThan(h.indexOf("</h1>"));
      expect(h.indexOf('data-elemento-visual="forma-do-conjunto"'), s).toBeLessThan(h.indexOf('id="arquivos"'));
      // equivalente em texto: o resumo no rótulo da figura, o período (ou a frase que diz por que não há régua) e as cinco etapas escritas
      expect(f, s).toMatch(/<figure[^>]* aria-label="[^"]{20,}"/);
      expect(f, s).toMatch(/data-periodo=""|data-sem-periodo=""/);
      expect(f.match(/data-etapa="/g)?.length, s).toBe(5);
      // todo desenho é decorativo para leitor de tela: o que ele mostra está escrito ao lado
      for (const svg of f.match(/<svg[^>]*>/g) ?? []) if (!/ (x|y)="/.test(svg) || /width="100%"/.test(svg)) expect(svg, s).toContain('aria-hidden="true"');
    }
  });

  it("régua só quando o conjunto tem primeira e última referência; sem elas, a figura diz isso e não desenha período", () => {
    let comRegua = 0;
    for (const s of slugs) {
      const d = datasetPorSlug(s)!;
      const c = pub.conjuntos.find((x) => x.id.endsWith(`/${d.interno}`));
      const forma = formaDoConjunto(c ?? null, pub.referencia.hoje);
      const f = figura(paginas[s]);
      expect(f.includes('data-regua="periodo"'), s).toBe(forma.periodo !== null);
      expect(f.includes('data-sem-periodo=""'), s).toBe(forma.periodo === null);
      if (forma.periodo) comRegua++;
      for (const x of [forma.periodo?.x0, forma.periodo?.x1, forma.periodo?.xFuturo, forma.eixo?.xHoje, ...forma.eventos.map((e) => e.x)]) {
        if (x === null || x === undefined) continue;
        expect(x, s).toBeGreaterThanOrEqual(0);
        expect(x, s).toBeLessThanOrEqual(1);
      }
    }
    expect(comRegua).toBeGreaterThan(50);
  });

  it("nenhuma data e nenhuma contagem na figura que não esteja na publicação ou no catálogo", () => {
    const br = (iso: string | null | undefined) => (iso ? dataBR(iso, "pt") : null);
    for (const s of slugs) {
      const d = datasetPorSlug(s)!;
      const e = cat.entradas.find((x) => x.id === d.catalogoId)!;
      const c = pub.conjuntos.find((x) => x.id.endsWith(`/${d.interno}`));
      const t = texto(figura(paginas[s]));
      const partes = (ref: string | undefined) => (ref ?? "").split("|").filter((p) => /^\d{4}/.test(p));
      const permitidas = new Set(
        [
          pub.referencia.hoje,
          c?.atualidade.fim_ultimo_periodo,
          c?.atualidade.prazo_proximo,
          diaDeBrasilia(c?.capturas.ultima),
          diaDeBrasilia(c?.capturas.ultima_publicacao_fonte),
          ...partes(c?.dado?.ref_min),
          ...partes(c?.dado?.ref_max),
          ...partes(c?.atualidade.ultimo_periodo),
          ...e.quebras.map((q) => q.data),
        ].map((x) => br(x?.slice(0, 10))),
      );
      for (const m of t.match(/\b\d{2}\/\d{2}\/\d{4}\b/g) ?? []) expect(permitidas.has(m), `${s}: ${m}`).toBe(true);
      // contagens das etapas: as que a integração publica
      const et = c?.etapas;
      const numeros = new Set([et?.recurso_verificado?.arquivos, et?.recurso_verificado?.capturas, et?.integrado?.observacoes, et?.integrado?.registros, et?.validado?.aprovadas, et?.validado?.ressalvas, et?.validado?.reprovadas, d.paginas.length, c?.dado?.series, c?.dado?.series_com_lacuna, c?.atualidade.dias_atraso].filter((n): n is number => typeof n === "number").map((n) => n.toLocaleString("pt-BR")));
      const escada = t.slice(t.indexOf("as etapas deste conjunto"));
      for (const m of escada.replace(/\d{2}\/\d{2}\/\d{4}/g, "").match(/\d[\d.]*/g) ?? []) expect(numeros.has(m.replace(/\.$/, "")), `${s}: ${m}`).toBe(true);
      for (const m of t.match(/([\d.]+) séries?\b/g) ?? []) expect(numeros.has(m.split(" ")[0]), `${s}: ${m}`).toBe(true);
    }
  });

  it("sem valor de reserva, sem data crua e dentro do peso; a página inglesa não mistura idiomas na figura", () => {
    for (const s of slugs) {
      const f = figura(paginas[s]);
      expect(f, s).not.toMatch(SEM_VALOR);
      expect(texto(f), s).not.toMatch(DATA_CRUA);
      expect(f, s).not.toMatch(/#[0-9a-fA-F]{6}\b/);
      // a figura fica em Entender: nenhum identificador técnico no texto (o mesmo critério de energia-conteudo-r8-D)
      expect(texto(f), s).not.toMatch(/sha256|pipeline|\bsilver|\bbronze\b|\bgolds?\b|snapshot|\bSLA\b|\bhoje\b|\b[a-z]+_[a-z0-9_]+\b|\.(csv|json|parquet)\b|[\u2013\u2014…]|CKAN/);
      expect(Buffer.byteLength(f, "utf-8"), s).toBeLessThan(16 * 1024);
      expect(Buffer.byteLength(paginas[s], "utf-8"), s).toBeLessThan(600 * 1024);
    }
    const en = emRender("/en/setor-eletrico/dados/aneel-scs", () => renderToStaticMarkup(createElement(DatasetPage, { params: { dataset: "aneel-scs" } })));
    const f = figura(en);
    expect(f).toContain('data-elemento-visual="forma-do-conjunto"');
    expect(texto(f)).not.toMatch(/Período coberto|referências publicadas|Última captura|Catalogado|além do prazo|checagens/);
    expect(texto(f)).not.toMatch(SEM_VALOR);
  });
});

describe("verbete do Aprenda: a figura do conceito no sistema", () => {
  const paginas = Object.fromEntries(CONCEITOS.map((c) => [c.slug, renderToStaticMarkup(createElement(ConceitoPage, { params: { conceito: c.slug } }))]));
  const figura = (h: string) => {
    const i = h.indexOf('data-elemento-visual="verbete-no-sistema"');
    return i < 0 ? "" : h.slice(i, h.indexOf("</section>", h.indexOf("data-deixa-de-fora", i)));
  };

  it("todo verbete tem a figura no envelope de modelo didático, depois do título e da definição", () => {
    expect(CONCEITOS.length).toBeGreaterThan(50);
    for (const c of CONCEITOS) {
      const h = paginas[c.slug];
      const f = figura(h);
      expect(f, c.slug).toContain("data-modelo-didatico");
      expect(f, c.slug).toContain("data-modelo-rotulo");
      // a lista obrigatória do que o modelo deixa de fora
      expect((h.slice(h.indexOf("data-deixa-de-fora")).match(/<li>/g) ?? []).length, c.slug).toBeGreaterThanOrEqual(3);
      const onde = h.indexOf('data-elemento-visual="verbete-no-sistema"');
      expect(onde, c.slug).toBeGreaterThan(h.indexOf("</h1>"));
      if (c.estado === "CONFERIDO") expect(onde, c.slug).toBeGreaterThan(h.indexOf('id="exemplo"'));
    }
  });

  it("o desenho tem equivalente em texto: os sete elos na versão vertical, o elo do verbete e as suas ligações escritos", () => {
    for (const c of CONCEITOS) {
      const f = figura(paginas[c.slug]);
      const desenho = f.slice(f.indexOf('data-mapa="desenho"'), f.indexOf('data-mapa="vertical"'));
      const vertical = f.slice(f.indexOf('data-mapa="vertical"'), f.indexOf('data-mapa="texto"'));
      expect(f, c.slug).toMatch(/<div class="hidden md:block" aria-hidden="true" data-mapa="desenho"/);
      expect(desenho.match(/data-no="/g)?.length, c.slug).toBe(NOS_MAPA.length);
      expect(vertical.match(/data-no="/g)?.length, c.slug).toBe(NOS_MAPA.length);
      for (const n of NOS_MAPA) expect(texto(vertical), `${c.slug}: ${n.id}`).toContain(n.titulo);
      // nada depende só de cor: o elo marcado diz em texto que é o do verbete, no desenho e na lista
      const pos = posicaoNoSistema(c, (s) => conceito(s));
      expect(desenho.match(/data-estado="verbete"/g)?.length ?? 0, c.slug).toBe(pos.elos.length);
      if (c.atuaEm?.length) for (const e of pos.elos) expect(texto(vertical), `${c.slug}: ${e.no}`).toContain(e.oQueFaz!);
      else expect(vertical.match(/Este verbete aparece aqui\./g)?.length ?? 0, c.slug).toBe(pos.elos.length);
      expect(f.match(/<li[^>]* data-tipo="/g)?.length ?? 0, c.slug).toBe(pos.ligacoes.length);
      for (const l of pos.ligacoes) expect(texto(f), `${c.slug}: ${l.de}-${l.para}`).toContain(l.texto);
    }
  });

  it("o ONS aparece em Operação, e não só onde estão os painéis com os dados dele", () => {
    const ons = conceito("ons")!;
    expect(elosDoVerbete(ons).map((e) => e.no)).toEqual(["geracao", "rede", "operacao"]);
    expect(elosDoVerbete(conceito("ibge")!).every((e) => e.motivo !== "atuacao")).toBe(true);
  });

  it("a posição sai do acervo: o elo que o mapa lista, ou o das páginas de “Veja no painel”; sem elo, só os relacionados", () => {
    let semElo = 0;
    for (const c of CONCEITOS) {
      const elos = elosDoVerbete(c);
      const f = figura(paginas[c.slug]);
      expect(f, c.slug).toContain(`data-elos="${elos.map((e) => e.no).join(" ")}"`);
      const doMapa = NOS_MAPA.filter((n) => n.conceitos.some((x) => x.slug === c.slug)).map((n) => n.id);
      if (c.atuaEm?.length) {
        // instituição: o elo é onde as fontes do verbete lhe dão papel, não onde o observatório publica os dados dela (10/11/2026)
        expect(new Set(elos.map((e) => e.no)), c.slug).toEqual(new Set(c.atuaEm.map((a) => a.no)));
        for (const e of elos) {
          expect(e.motivo, c.slug).toBe("atuacao");
          expect(texto(f), `${c.slug}: ${e.no}`).toContain(e.oQueFaz!);
          expect(texto(f), `${c.slug}: ${e.no}`).toContain(e.base!);
          // a base citada é um dispositivo das fontes do próprio verbete, ou os verbetes que ele mesmo cita como fonte
          const lei = /n[ºo.]+ ?([\d.]+)/i.exec(e.base!)?.[1];
          if (lei) expect(c.fontes.some((x) => x.documento.includes(lei)), `${c.slug}: ${e.base}`).toBe(true);
          else expect(c.porQueImporta, c.slug).toContain(e.base!.replace(/^(fontes|sources)/, "").trim().split(" ").slice(-3).join(" "));
        }
      } else if (doMapa.length) expect(elos.map((e) => e.no), c.slug).toEqual(doMapa);
      else
        for (const e of elos) {
          expect(e.motivo, c.slug).toBe("painel");
          expect(e.paineis.length, c.slug).toBeGreaterThan(0);
          for (const p of e.paineis) {
            expect(c.vejaNoPortal, c.slug).toContainEqual(p);
            expect(NOS_MAPA.find((n) => n.id === e.no)!.destinos, c.slug).toContain(moduloDoEndereco(p.href));
          }
        }
      const pos = posicaoNoSistema(c, (s) => conceito(s));
      for (const v of pos.vizinhos) expect(c.relacoes, c.slug).toContain(v.slug);
      expect(pos.ligacoes, c.slug).toEqual(LIGACOES.filter((l) => elos.some((e) => e.no === l.de || e.no === l.para)));
      if (elos.length === 0) {
        semElo++;
        // verbete sem elo próprio não é forçado a um: a figura assinala só os elos dos relacionados, e precisa ter algum
        expect(pos.vizinhos.length, c.slug).toBeGreaterThan(0);
        expect(f, c.slug).not.toContain('data-estado="verbete"');
      }
    }
    expect(semElo).toBeLessThan(CONCEITOS.length / 5);
  });

  it("sem valor de reserva, sem data crua, sem cor solta e dentro do teto de peso do verbete", () => {
    for (const c of CONCEITOS) {
      const f = figura(paginas[c.slug]);
      expect(f, c.slug).not.toMatch(SEM_VALOR);
      expect(texto(f), c.slug).not.toMatch(DATA_CRUA);
      expect(f, c.slug).not.toMatch(/#[0-9a-fA-F]{6}\b/);
      expect(Buffer.byteLength(f, "utf-8"), c.slug).toBeLessThan(32 * 1024);
      expect(Buffer.byteLength(paginas[c.slug], "utf-8"), c.slug).toBeLessThan(120 * 1024);
    }
  });

  it("a página inglesa traz a figura em inglês", () => {
    const en = emRender("/en/setor-eletrico/aprenda/pld", () => renderToStaticMarkup(createElement(ConceitoPage, { params: { conceito: "pld" } })));
    const f = figura(en);
    expect(f).toContain("data-modelo-didatico");
    expect(texto(f)).not.toMatch(/Modelo didático|este verbete|Caminho físico|elo deste|Verbetes relacionados|aparece aqui/);
    expect(texto(f)).not.toMatch(SEM_VALOR);
  });
});
