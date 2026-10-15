import type { Locator, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarNavegadorPerfil, type NavegadorPerfil, type PaginaPerfil, type PropsPerfil } from "./suporte/conta-cpf-browser";

const INICIAIS = { orgTypeInicial: "banco", orgAreaInicial: "dados", orgRoleInicial: "analista", ufInicial: "SP" };
const CORPO = { orgType: "academia", orgArea: "pesquisa", orgRole: "professor", uf: "EX" };
const CORPO_COM_CPF = { ...CORPO, cpf: "52998224725" };
const HINT_OPCIONAL = "Para seu telefone estrangeiro, o CPF é opcional. Você precisará dele antes de trocar para um telefone brasileiro.";
const HINT_BR = "Sua conta é anterior à exigência de CPF. Usado apenas para garantir uma conta por pessoa; nunca é exibido nem compartilhado.";
let navegador: NavegadorPerfil | undefined;

beforeAll(async () => { navegador = await criarNavegadorPerfil(); }, 60_000);
afterAll(async () => { await navegador?.fechar(); });

// Prova do formulário/eventos/payload; props são fixtures e o POST é interceptado.
// Sessão, autoridade de telefone e persistência pertencem à integração separada.
async function comPerfil(props: PropsPerfil, corpo: typeof CORPO | typeof CORPO_COM_CPF, verificar: (pagina: PaginaPerfil) => Promise<void>) {
  if (!navegador) throw new Error("A prova do perfil requer Vite e Chromium disponíveis");
  const pagina = await navegador.pagina(props), erros: unknown[] = [];
  try {
    await verificar(pagina);
    expect(pagina.page.url()).toBe(pagina.url);
  } catch (e) { erros.push(e); }
  try { await pagina.fechar(); } catch (e) { erros.push(e); }
  try {
    expect(pagina.falhas, "nenhum erro de execução, rede ou limpeza omitido").toEqual([]);
    expect(pagina.pedidos).toHaveLength(1);
    const pedido = pagina.pedidos[0];
    expect(pedido.metodo).toBe("POST");
    expect(pedido.url).toBe(new URL("/api/conta/perfil", pagina.url).href);
    expect(pedido.contentType).toBe("application/json");
    expect(pedido.corpo).toEqual(corpo);
    expect(pedido.corpoBruto).toBe("cpf" in corpo
      ? '{"orgType":"academia","orgArea":"pesquisa","orgRole":"professor","uf":"EX","cpf":"52998224725"}'
      : '{"orgType":"academia","orgArea":"pesquisa","orgRole":"professor","uf":"EX"}');
  } catch (e) { erros.push(e); }
  if (erros.length === 1) throw erros[0];
  if (erros.length) throw new AggregateError(erros, "Falhas na interação ou limpeza do perfil");
}

async function alterarPerfil(page: Page) {
  await page.getByLabel("Tipo de instituição", { exact: true }).selectOption("academia");
  await page.getByLabel("Área de atuação", { exact: true }).selectOption("pesquisa");
  await page.getByLabel("Nível de cargo", { exact: true }).selectOption("professor");
  await page.getByLabel("UF", { exact: true }).selectOption("EX");
}

async function conferirDica(cpf: Locator, texto: string) {
  expect(await cpf.isVisible()).toBe(true);
  expect(await cpf.getAttribute("aria-invalid")).toBeNull();
  const descricoes = await cpf.evaluate((input) => (input.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent));
  expect(descricoes).toEqual([texto]);
}

async function conferirErro(pagina: PaginaPerfil, cpf: Locator, texto: string) {
  const alerta = pagina.page.getByRole("alert");
  await expect.poll(() => alerta.textContent()).toBe(texto);
  expect(await alerta.isVisible()).toBe(true);
  expect(await cpf.getAttribute("aria-invalid")).toBe("true");
  const idErro = await alerta.getAttribute("id");
  expect(idErro).not.toBeNull();
  expect((await cpf.getAttribute("aria-describedby"))?.split(/\s+/)).toContain(idErro);
  // Field preserva também a referência da dica oculta; este corretivo não altera Field.
  expect(pagina.pedidos).toEqual([]);
  expect(await pagina.page.getByRole("button", { name: "Salvar perfil", exact: true }).isEnabled()).toBe(true);
}

async function salvar(pagina: PaginaPerfil) {
  await pagina.page.getByRole("button", { name: "Salvar perfil", exact: true }).click();
  await expect.poll(() => pagina.pedidos.length).toBe(1);
  expect(await pagina.page.getByRole("button", { name: "Salvando…", exact: true }).isDisabled()).toBe(true);
  pagina.liberarResposta();
  const status = pagina.page.getByRole("status");
  await status.waitFor({ state: "visible" });
  expect(await status.textContent()).toBe("Perfil atualizado.");
  expect(await pagina.page.getByRole("button", { name: "Salvar perfil", exact: true }).isEnabled()).toBe(true);
  expect(await pagina.page.getByRole("alert").count()).toBe(0);
}

describe("Conta: CPF opcional e obrigatório no PerfilForm real", () => {
  it("salva o perfil estrangeiro vazio sem propriedade cpf", { timeout: 30_000 }, async () => {
    await comPerfil({ ...INICIAIS, temCpf: false, cpfObrigatorio: false }, CORPO, async (pagina) => {
      const cpf = pagina.page.getByLabel("CPF (opcional)", { exact: true });
      await conferirDica(cpf, HINT_OPCIONAL);
      expect(await cpf.inputValue()).toBe("");
      await alterarPerfil(pagina.page);
      await salvar(pagina);
      expect(await cpf.inputValue()).toBe("");
    });
  });

  it("recusa CPF opcional inválido e permite inclusão válida normalizada", { timeout: 30_000 }, async () => {
    await comPerfil({ ...INICIAIS, temCpf: false, cpfObrigatorio: false }, CORPO_COM_CPF, async (pagina) => {
      const cpf = pagina.page.getByLabel("CPF (opcional)", { exact: true });
      await conferirDica(cpf, HINT_OPCIONAL);
      await alterarPerfil(pagina.page);
      await cpf.fill("52998224726");
      expect(await cpf.inputValue()).toBe("529.982.247-26");
      await pagina.page.getByRole("button", { name: "Salvar perfil", exact: true }).click();
      await conferirErro(pagina, cpf, "CPF inválido. Confira os dígitos.");
      await cpf.fill("52998224725");
      expect(await cpf.inputValue()).toBe("529.982.247-25");
      await salvar(pagina);
      await conferirDica(cpf, HINT_OPCIONAL);
    });
  });

  it.each(["explícita", "omitida"] as const)("preserva a exigência brasileira %s até receber CPF válido", { timeout: 30_000 }, async (modo) => {
    const props: PropsPerfil = { ...INICIAIS, temCpf: false, ...(modo === "explícita" ? { cpfObrigatorio: true } : {}) };
    await comPerfil(props, CORPO_COM_CPF, async (pagina) => {
      const cpf = pagina.page.getByLabel("CPF", { exact: true });
      await conferirDica(cpf, HINT_BR);
      await alterarPerfil(pagina.page);
      await pagina.page.getByRole("button", { name: "Salvar perfil", exact: true }).click();
      await conferirErro(pagina, cpf, "Informe seu CPF para completar o cadastro.");
      await cpf.fill("52998224725");
      expect(await cpf.inputValue()).toBe("529.982.247-25");
      await salvar(pagina);
    });
  });

  it("preserva CPF já registrado e salva somente os outros campos", { timeout: 30_000 }, async () => {
    await comPerfil({ ...INICIAIS, temCpf: true, cpfObrigatorio: true }, CORPO, async (pagina) => {
      expect(await pagina.page.getByLabel(/^CPF/).count()).toBe(0);
      expect(await pagina.page.locator('input[name="cpf"]').count()).toBe(0);
      await alterarPerfil(pagina.page);
      await salvar(pagina);
    });
  });
});
