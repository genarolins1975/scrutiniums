import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { signSessionCookie } from "@/lib/sessionCookie";
import { COOKIE_OBSERVATORIO as COOKIE_ANTIGO } from "@/lib/dominios";
import { OBSERVATORIOS } from "@/lib/observatorios/lista";
import { COOKIE_OBSERVATORIO, colecaoDoCaminho, lerUltimoAcesso, ultimoAcessoDoCaminho } from "@/lib/observatorios/ultimoAcesso";
import { LinkMedido } from "@/components/telemetria/LinkMedido";
import { SECOES_DO_MAPA, isViewSection, sectionLabel } from "@/lib/telemetry";

/**
 * Último acesso e cliques do mapa da conta (Iniciativa M1 do parecer de UX de 23/10/2026): o middleware grava o cookie
 * `scrutiniums_observatorio` na navegação de página com sessão, pelo caminho (`c:<coleção>` ou `o:<observatório>`), e o mapa lê
 * só os dois formatos novos; o clique no diretório é contado por LinkMedido, sem formulário.
 */

const ORIGEM = "https://scrutiniums.com";
const TOKEN = "cd".repeat(32);

beforeEach(() => {
  vi.stubEnv("COOKIE_SECRET", "segredo-sintetico-do-teste-ultimo-acesso");
  // a guarda do /app/admin consulta /api/admin/eu; nenhum caso aqui passa por ela
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 403 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function navegar(caminho: string, opcoes: { sessao?: boolean; accept?: string; rsc?: boolean; prefetch?: boolean; cookie?: string } = {}) {
  const headers = new Headers({ accept: opcoes.accept ?? "text/html,application/xhtml+xml" });
  const cookies: string[] = [];
  if (opcoes.sessao ?? true) cookies.push(`scrutiniums_session=${await signSessionCookie(TOKEN, new Date(Date.now() + 3_600_000))}`);
  if (opcoes.cookie) cookies.push(`${COOKIE_OBSERVATORIO}=${opcoes.cookie}`);
  if (cookies.length) headers.set("cookie", cookies.join("; "));
  if (opcoes.rsc) headers.set("rsc", "1");
  if (opcoes.prefetch) headers.set("next-router-prefetch", "1");
  return middleware(new NextRequest(ORIGEM + caminho, { headers }));
}

describe("leitura do cookie", () => {
  it("resolve os dois formatos novos e ignora o antigo e o lixo", () => {
    expect(lerUltimoAcesso("c:setor-eletrico")).toMatchObject({ tipo: "colecao", observatorio: "energia-e-infraestrutura", colecao: "setor-eletrico", nome: "Setor Elétrico", href: "/setor-eletrico" });
    expect(lerUltimoAcesso("o:familias")).toMatchObject({ tipo: "observatorio", observatorio: "familias", colecao: null, href: "/observatorios/familias" });
    for (const v of ["judiciario", "eficiencia", "familias", "energia", "c:", "c:inexistente", "o:inexistente", "x:setor-eletrico", "", null, undefined]) {
      expect(lerUltimoAcesso(v as string | null | undefined), String(v)).toBeNull();
    }
  });

  it("toda coleção e toda entrada do registro dão um valor que volta a ela", () => {
    for (const o of OBSERVATORIOS) {
      if (o.entrada) expect(lerUltimoAcesso(ultimoAcessoDoCaminho(o.entrada))?.href, o.entrada).toBe(o.entrada);
      for (const c of o.colecoes) {
        expect(ultimoAcessoDoCaminho(c.href), c.href).toBe(`c:${c.id}`);
        expect(lerUltimoAcesso(`c:${c.id}`)?.href).toBe(c.href);
      }
    }
  });

  it("o casamento mais longo decide os prefixos ambíguos", () => {
    expect(ultimoAcessoDoCaminho("/observatorio")).toBe("c:credito");
    expect(ultimoAcessoDoCaminho("/observatorio/institutions")).toBe("c:credito");
    expect(ultimoAcessoDoCaminho("/observatorio/pix")).toBe("c:pagamentos");
    expect(ultimoAcessoDoCaminho("/observatorio-do-credito")).toBeNull();
    expect(ultimoAcessoDoCaminho("/agronegocio/ambiente/emissoes")).toBe("c:desmatamento");
    expect(ultimoAcessoDoCaminho("/territorio/queimadas")).toBe("c:fogo");
    expect(ultimoAcessoDoCaminho("/contas-publicas-estaduais")).toBe("c:estaduais");
    expect(ultimoAcessoDoCaminho("/setor-eletrico/pld?x=1#a")).toBe("c:setor-eletrico");
    expect(colecaoDoCaminho("/setor-eletrico/pld?submercado=SE")?.nome).toBe("Setor Elétrico");
    for (const c of ["/", "/sobre", "/app/conta", "/app/observatorios", "/buscar", "/territorio/metodologia"]) expect(ultimoAcessoDoCaminho(c), c).toBeNull();
  });

  it("a constante continua exportada de dominios.ts, com o mesmo nome de cookie", () => {
    expect(COOKIE_ANTIGO).toBe(COOKIE_OBSERVATORIO);
    expect(COOKIE_OBSERVATORIO).toBe("scrutiniums_observatorio");
  });
});

describe("gravação pelo middleware", () => {
  it("grava a coleção e a entrada do observatório com sessão", async () => {
    const pld = await navegar("/setor-eletrico/pld");
    expect(pld.cookies.get(COOKIE_OBSERVATORIO)?.value).toBe("c:setor-eletrico");
    expect(pld.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(pld.headers.get("set-cookie")).toMatch(/SameSite=lax/i);
    expect(pld.headers.get("set-cookie")).toMatch(/Max-Age=31536000/);
    const familias = await navegar("/observatorios/familias");
    expect(familias.cookies.get(COOKIE_OBSERVATORIO)?.value).toBe("o:familias");
  });

  it("pré-carregamento do navegador não grava", async () => {
    const h = new Headers({ accept: "text/html", "sec-purpose": "prefetch", cookie: `scrutiniums_session=${await signSessionCookie(TOKEN, new Date(Date.now() + 3_600_000))}` });
    expect((await middleware(new NextRequest(ORIGEM + "/setor-eletrico/pld", { headers: h }))).cookies.get(COOKIE_OBSERVATORIO)).toBeUndefined();
  });

  it("não grava sem sessão, fora das coleções, em pré-carregamento, em pedido que não é de página nem quando o valor já é o mesmo", async () => {
    expect((await navegar("/setor-eletrico/pld", { sessao: false })).cookies.get(COOKIE_OBSERVATORIO)).toBeUndefined();
    expect((await navegar("/sobre")).cookies.get(COOKIE_OBSERVATORIO)).toBeUndefined();
    expect((await navegar("/app/conta")).cookies.get(COOKIE_OBSERVATORIO)).toBeUndefined();
    // navegação no cliente e pré-carregamento do App Router chegam ao middleware sem os cabeçalhos RSC e com accept */*
    expect((await navegar("/setor-eletrico/pld", { accept: "*/*" })).cookies.get(COOKIE_OBSERVATORIO)).toBeUndefined();
    expect((await navegar("/setor-eletrico/pld", { accept: "*/*" })).cookies.get(COOKIE_OBSERVATORIO)).toBeUndefined();
    expect((await navegar("/setor-eletrico/pld", { cookie: "c:setor-eletrico" })).headers.get("set-cookie")).toBeNull();
  });

  it("a apresentação aberta do Crédito não é a coleção; a coleção é /observatorio e abaixo", async () => {
    expect((await navegar("/observatorio-do-credito")).cookies.get(COOKIE_OBSERVATORIO)).toBeUndefined();
    expect((await navegar("/observatorio")).cookies.get(COOKIE_OBSERVATORIO)?.value).toBe("c:credito");
  });

  it("página aberta de uma coleção (método) conta com sessão e não grava sem ela", async () => {
    expect((await navegar("/setor-eletrico/metodologia")).cookies.get(COOKIE_OBSERVATORIO)?.value).toBe("c:setor-eletrico");
    expect((await navegar("/setor-eletrico/metodologia", { sessao: false })).cookies.get(COOKIE_OBSERVATORIO)).toBeUndefined();
  });
});

describe("LinkMedido", () => {
  it("é um <a href> de documento, sem formulário (a navegação inteira passa pelo middleware, que grava o último acesso)", () => {
    const h = renderToStaticMarkup(createElement(LinkMedido, { href: "/setor-eletrico", secao: "mapa:setor-eletrico" }, "Setor Elétrico"));
    expect(h).toBe('<a href="/setor-eletrico">Setor Elétrico</a>');
  });

  it("no clique, envia a seção por sendBeacon e não impede a navegação", async () => {
    const enviados: { url: string; corpo: string }[] = [];
    vi.stubGlobal("navigator", {
      sendBeacon: (url: string, corpo: Blob) => {
        void corpo.text().then((t) => enviados.push({ url, corpo: t }));
        return true;
      },
    });
    const externo = vi.fn();
    const el = LinkMedido({ href: "/setor-eletrico", secao: "mapa:setor-eletrico", onClick: externo, children: "Setor Elétrico" }) as ReactElement<{ onClick: (e: unknown) => void; href: string }>;
    expect(isValidElement(el)).toBe(true);
    expect(el.type).toBe("a");
    expect(el.props.href).toBe("/setor-eletrico");
    const evento = { defaultPrevented: false, preventDefault: vi.fn() };
    el.props.onClick(evento);
    await vi.waitFor(() => expect(enviados).toEqual([{ url: "/api/telemetria", corpo: JSON.stringify({ secao: "mapa:setor-eletrico" }) }]));
    expect(evento.preventDefault).not.toHaveBeenCalled();
    expect(externo).toHaveBeenCalledOnce();
  });

  it("as seções do mapa estão na allowlist, cabem em 40 caracteres e só vêm do registro", () => {
    const esperadas = OBSERVATORIOS.flatMap((o) => [`mapa:o:${o.id}`, ...o.colecoes.map((c) => `mapa:${c.id}`)]);
    expect(Object.keys(SECOES_DO_MAPA).sort()).toEqual([...esperadas].sort());
    for (const s of esperadas) {
      expect(isViewSection(s), s).toBe(true);
      expect(s.length, s).toBeLessThanOrEqual(40);
      expect(sectionLabel(s), s).toMatch(/^Mapa da conta · /);
    }
    expect(isViewSection("mapa:inexistente")).toBe(false);
    expect(isViewSection("mapa:/setor-eletrico")).toBe(false);
  });
});
