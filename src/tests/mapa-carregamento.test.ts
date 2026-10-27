import { describe, expect, it, vi } from "vitest";
import { Children, isValidElement, Suspense, type ReactElement } from "react";
const consultas = vi.hoisted(() => ({ recortes: vi.fn(), alertas: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionUser: async () => ({ id: "conta-isolada", uf: null }) }));
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }));
vi.mock("@/lib/conta/recortes", () => ({ listarRecortes: consultas.recortes }));
vi.mock("@/lib/conta/alertas", () => ({ listarAlertas: consultas.alertas }));
import Pagina from "@/app/app/(foco)/observatorios/page";

describe("diretório independente da retomada", () => {
  it("entrega as coleções antes de consultar recortes; a falha dos avisos não perde recortes", async () => {
    let liberar!: (v: unknown[]) => void;
    consultas.recortes.mockImplementation(() => new Promise(resolve => { liberar = resolve; }));
    consultas.alertas.mockRejectedValue(new Error("indisponível"));
    const pagina = await Pagina();
    const mapa = Children.toArray(pagina.props.children).filter(isValidElement).at(-1) as ReactElement;
    expect(mapa.props.secoes).toHaveLength(6);
    expect(mapa.props.secoes.flatMap((s: { colecoes: unknown[] }) => s.colecoes)).toHaveLength(28);
    expect(consultas.recortes).not.toHaveBeenCalled();
    expect(mapa.props.retomada.type).toBe(Suspense);
    const bloco = mapa.props.retomada.props.children;
    const carregando = bloco.type(bloco.props);
    expect(consultas.recortes).toHaveBeenCalledWith("conta-isolada");
    liberar([{ titulo: "Recorte preservado", caminho: "/observatorio/map" }]);
    const resultado = await carregando;
    expect(resultado.props.retomar.recortes).toHaveLength(1);
    expect(resultado.props.retomar.avisos).toEqual([]);
  });
});
