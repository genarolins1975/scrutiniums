import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarNavegadorCadastro, type NavegadorCadastro, type PaginaCadastro } from "./suporte/cadastro-perfil-browser";

/**
 * Fluxo do formulário da etapa 3 renderizado num navegador real: senha uma
 * vez com "Mostrar", perfil de uso obrigatório e campos profissionais que só
 * aparecem (e só são enviados) nos perfis profissionais.
 */
let navegador: NavegadorCadastro | undefined;
beforeAll(async () => { navegador = await criarNavegadorCadastro(); }, 60_000);
afterAll(async () => { await navegador?.fechar(); });

async function comFormulario(exigeCpf: boolean, verificar: (p: PaginaCadastro) => Promise<void>, largura?: number) {
  if (!navegador) throw new Error("A prova do cadastro requer Vite e Chromium disponíveis");
  const pagina = await navegador.pagina({ exigeCpf }, largura);
  try {
    await verificar(pagina);
    expect(pagina.falhas).toEqual([]);
  } finally {
    await pagina.fechar();
  }
}

const CAMPOS_PROFISSIONAIS = ["Tipo de instituição", "Área de atuação", "Nível de cargo"];

describe("Cadastro, etapa 3: formulário real", () => {
  it("senha digitada uma vez, com Mostrar e Ocultar anunciados", { timeout: 30_000 }, async () => {
    await comFormulario(true, async ({ page }) => {
      expect(await page.locator('input[type="password"]').count()).toBe(1);
      const senha = page.getByLabel("Senha", { exact: true });
      await senha.fill("senha-secreta-1");
      const mostrar = page.getByRole("button", { name: "Mostrar senha", exact: true });
      expect(await mostrar.getAttribute("aria-controls")).toBe(await senha.getAttribute("id"));
      await mostrar.click();
      expect(await senha.getAttribute("type")).toBe("text");
      expect(await page.getByRole("status").textContent()).toBe("Sua senha está visível.");
      await page.getByRole("button", { name: "Ocultar senha", exact: true }).click();
      expect(await senha.getAttribute("type")).toBe("password");
      expect(await senha.inputValue()).toBe("senha-secreta-1");
    });
  });

  it("recusa o envio sem as informações básicas e sem os campos do perfil profissional", { timeout: 30_000 }, async () => {
    await comFormulario(true, async ({ page, pedidos }) => {
      const concluir = page.getByRole("button", { name: "Concluir cadastro", exact: true });
      await concluir.click();
      const alertas = await page.getByRole("alert").allTextContents();
      expect(alertas).toEqual(expect.arrayContaining([
        "A senha deve ter entre 8 e 72 caracteres.", "CPF inválido. Confira os dígitos.",
        "Selecione sua UF.", "Escolha como você vai usar a plataforma.",
      ]));
      for (const campo of CAMPOS_PROFISSIONAIS) expect(await page.getByLabel(campo, { exact: true }).count()).toBe(0);

      await page.getByLabel("Senha", { exact: true }).fill("senha-secreta-1");
      await page.getByLabel("CPF", { exact: true }).fill("52998224725");
      await page.getByLabel("UF onde você mora", { exact: true }).selectOption("SP");
      await page.getByRole("radio", { name: "Empresa", exact: true }).check();
      for (const campo of CAMPOS_PROFISSIONAIS) expect(await page.getByLabel(campo, { exact: true }).isVisible()).toBe(true);
      await concluir.click();
      expect(await page.getByRole("alert").allTextContents()).toEqual([
        "Selecione o tipo de instituição.", "Selecione sua área de atuação.", "Selecione seu nível de cargo.",
      ]);
      expect(pedidos).toEqual([]);
    });
  });

  it("perfil profissional envia instituição, área e cargo e segue para o destino", { timeout: 30_000 }, async () => {
    await comFormulario(true, async ({ page, pedidos, navegacoes }) => {
      await page.getByLabel("Senha", { exact: true }).fill("senha-secreta-1");
      await page.getByLabel("CPF", { exact: true }).fill("52998224725");
      await page.getByLabel("UF onde você mora", { exact: true }).selectOption("DF");
      await page.getByRole("radio", { name: "Setor público", exact: true }).check();
      await page.getByLabel("Tipo de instituição", { exact: true }).selectOption("regulador");
      await page.getByLabel("Área de atuação", { exact: true }).selectOption("politicas_publicas");
      await page.getByLabel("Nível de cargo", { exact: true }).selectOption("analista");
      await page.getByRole("button", { name: "Concluir cadastro", exact: true }).click();
      await expect.poll(() => pedidos.length).toBe(1);
      expect(pedidos[0].corpo).toEqual({
        password: "senha-secreta-1", cpf: "52998224725", perfilUso: "setor_publico",
        orgType: "regulador", orgArea: "politicas_publicas", orgRole: "analista", uf: "DF",
      });
      await expect.poll(navegacoes).toEqual(["/setor-eletrico/conta-de-luz"]);
    });
  });

  it("ao trocar para um perfil não profissional, os campos somem e não são enviados", { timeout: 30_000 }, async () => {
    await comFormulario(false, async ({ page, pedidos }) => {
      expect(await page.getByLabel("CPF", { exact: true }).count()).toBe(0);
      await page.getByLabel("Senha", { exact: true }).fill("senha-secreta-1");
      await page.getByLabel("UF onde você mora", { exact: true }).selectOption("EX");
      await page.getByRole("radio", { name: "Mercado financeiro", exact: true }).check();
      await page.getByLabel("Tipo de instituição", { exact: true }).selectOption("banco");
      await page.getByLabel("Área de atuação", { exact: true }).selectOption("dados");
      await page.getByLabel("Nível de cargo", { exact: true }).selectOption("analista");
      await page.getByRole("radio", { name: "Estudante", exact: true }).check();
      for (const campo of CAMPOS_PROFISSIONAIS) expect(await page.getByLabel(campo, { exact: true }).count()).toBe(0);
      await page.getByRole("button", { name: "Concluir cadastro", exact: true }).click();
      await expect.poll(() => pedidos.length).toBe(1);
      expect(pedidos[0].corpoBruto).toBe('{"password":"senha-secreta-1","perfilUso":"estudante","uf":"EX"}');
    });
  });
});
