import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ getSessionUser: vi.fn(async () => ({ id: "seletor-teste" })) }));
vi.mock("@/lib/events", () => ({ trackEvent: vi.fn(async () => undefined) }));

import { GET, POST } from "@/app/app/(foco)/observatorios/entrar/route";
import { COOKIE_OBSERVATORIO, DOMINIOS } from "@/lib/dominios";
import { OPCOES_OBSERVATORIOS } from "@/lib/opcoesObservatorios";
import { trackEvent } from "@/lib/events";

function escolher(id: string, origem = "https://scrutiniums.com") {
  return POST(new Request("https://scrutiniums.com/app/observatorios/entrar", {
    method: "POST",
    headers: { origin: origem },
    body: new URLSearchParams({ d: id }),
  }));
}

describe("entrada do Judiciário no seletor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("oferece o Judiciário ao lado do OBEE e preserva todos os observatórios", () => {
    expect(OPCOES_OBSERVATORIOS.map((d) => d.id)).toEqual([
      "credito", "energia", "eficiencia", "judiciario", "contas", "estados", "saneamento", "gas", "agro",
    ]);
    for (const d of DOMINIOS) expect(OPCOES_OBSERVATORIOS.find((o) => o.id === d.id)?.rotaRaiz).toBe(d.rotaRaiz);
  });

  it("o POST abre o módulo diretamente, guarda sua escolha e mantém atribuição ao OBEE", async () => {
    const response = await escolher("judiciario");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://scrutiniums.com/eficiencia-estatal/judiciario");
    expect(response.cookies.get(COOKIE_OBSERVATORIO)?.value).toBe("judiciario");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith("observatorio_escolhido:eficiencia", "seletor-teste");
  });

  it.each(DOMINIOS)("preserva destino e preferência de $id", async (dominio) => {
    const response = await escolher(dominio.id);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://scrutiniums.com" + dominio.rotaRaiz);
    expect(response.cookies.get(COOKIE_OBSERVATORIO)?.value).toBe(dominio.id);
  });

  it.each(["https://externo.invalid", "//externo.invalid", "/eficiencia-estatal/judiciario", "inexistente"])("recusa destino não cadastrado: %s", async (id) => {
    const response = await escolher(id);
    expect(response.headers.get("location")).toBe("https://scrutiniums.com/app/observatorios");
    expect(response.cookies.get(COOKIE_OBSERVATORIO)).toBeUndefined();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("recusa POST de origem externa, inclusive para a nova opção", async () => {
    const response = await escolher("judiciario", "https://externo.invalid");
    expect(response.status).toBe(403);
    expect(response.cookies.get(COOKIE_OBSERVATORIO)).toBeUndefined();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("GET/prefetch não escolhe o módulo nem grava preferência", async () => {
    const response = await GET(new Request("https://scrutiniums.com/app/observatorios/entrar?d=judiciario"));
    expect(response.headers.get("location")).toBe("https://scrutiniums.com/app/observatorios");
    expect(response.cookies.get(COOKIE_OBSERVATORIO)).toBeUndefined();
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
