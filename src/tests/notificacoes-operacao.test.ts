import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  auth: vi.fn(), session: vi.fn(), send: vi.fn(), event: vi.fn(), purge: vi.fn(),
  reserve: vi.fn(), release: vi.fn(), reserveAlert: vi.fn(), releaseAlert: vi.fn(),
}));
vi.mock("@/lib/disparo", () => ({ bearerDisparoValido: m.auth }));
vi.mock("@/lib/session", () => ({ getSessionUser: m.session }));
vi.mock("@/lib/admin", () => ({ isAdmin: () => false }));
vi.mock("@/lib/mailer", () => ({ sendTransactionalEmail: m.send }));
vi.mock("@/lib/events", () => ({ trackEvent: m.event }));
vi.mock("@/lib/assinaturaResumo", () => ({
  assinaturasAtivas: async () => [{ id: "sintetica", email: "fixture@example.invalid" }],
  deveReceber: () => true, montarResumoEmail: () => ({ edicao: "2026-10-24", subject: "Resumo sintético", corpo: "Fonte e referência" }),
  purgarPendentes: m.purge, reservarEnvio: m.reserve, liberarEnvio: m.release,
  rodapeResumo: () => "", cabecalhosSaida: () => ({}),
}));
vi.mock("@/lib/conta/alertas", () => ({
  assinaturasComEmail: async () => [{ id: "sintetica", dominio: "energia", referenciaAvisada: "2026-09-01", email: "fixture@example.invalid" }],
  referenciasPublicadas: () => new Map([["energia", { referencia: "2026-10-01" }]]),
  referenciaAvancou: () => true, emailAlerta: () => ({ subject: "Alerta sintético", text: "Fonte e referência" }),
  reservarAviso: m.reserveAlert, liberarAviso: m.releaseAlert, rodapeAlerta: () => "", cabecalhosSaidaAlerta: () => ({}),
}));

import { POST as resumo, GET as simularResumo } from "@/app/api/resumo/enviar/route";
import { POST as alertas, GET as simularAlertas } from "@/app/api/alertas/enviar/route";

beforeEach(() => {
  vi.clearAllMocks(); m.auth.mockReturnValue(true); m.session.mockResolvedValue(null);
  m.purge.mockReset();
  m.send.mockResolvedValue({ sent: false }); m.reserve.mockResolvedValue(true); m.reserveAlert.mockResolvedValue(true);
});
afterEach(() => vi.restoreAllMocks());

describe("Operação de notificações sem envio real", () => {
  for (const get of [simularResumo, simularAlertas]) {
    it("GET exige modo de simulação e nunca pode disparar envio", async () => {
      expect((await get(new Request("https://scrutiniums.test/enviar"))).status).toBe(405);
      const r = await get(new Request("https://scrutiniums.test/enviar?simular=1"));
      expect(r.status).toBe(200); expect(r.headers.get("Cache-Control")).toContain("no-store");
      expect((await r.json()).simulacao).toBe(true);
      expect(m.send).not.toHaveBeenCalled();
    });
  }
  it("resumo: orçamento esgotado não reserva mensagens que não poderão ser enviadas", async () => {
    let relogio = 0;
    vi.spyOn(Date, "now").mockImplementation(() => relogio);
    m.purge.mockImplementation(async () => { relogio = 241_000; });
    const r = await resumo(new Request("https://scrutiniums.test/api/resumo/enviar", { method: "POST" }));
    expect(r.status).toBe(202);
    expect((await r.json()).pendentes).toBe(1);
    expect(m.reserve).not.toHaveBeenCalled(); expect(m.send).not.toHaveBeenCalled();
  });
  for (const [nome, post] of [["resumo", resumo], ["alertas", alertas]] as const) {
    it(`${nome}: simulação gera resumo sem reservar, purgar, enviar ou registrar sucesso operacional`, async () => {
      const r = await post(new Request(`https://scrutiniums.test/api/${nome}/enviar?simular=1`, { method: "POST" }));
      expect(r.status).toBe(200);
      const body = await r.json(); expect(body.simulacao).toBe(true); expect(body.enviados).toBe(0);
      expect(body.destinatarios).toBe(1);
      expect(JSON.stringify(body)).not.toContain("fixture@example.invalid");
      for (const fn of [m.send, m.event, m.purge, m.reserve, m.reserveAlert]) expect(fn).not.toHaveBeenCalled();
    });
    it(`${nome}: simulação mantém a autorização obrigatória`, async () => {
      m.auth.mockReturnValue(false);
      const r = await post(new Request(`https://scrutiniums.test/api/${nome}/enviar?simular=1`, { method: "POST" }));
      expect(r.status).toBe(403); expect(m.send).not.toHaveBeenCalled();
    });
    it(`${nome}: falha do provedor deixa o disparo vermelho e libera a reserva`, async () => {
      const r = await post(new Request(`https://scrutiniums.test/api/${nome}/enviar`, { method: "POST" }));
      expect(r.status).toBe(502);
      expect((await r.json()).falhas).toBe(1);
      expect(nome === "resumo" ? m.release : m.releaseAlert).toHaveBeenCalledOnce();
      expect(m.event).not.toHaveBeenCalled();
    });
  }
});
