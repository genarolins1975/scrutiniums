import { expect } from "vitest";
import { attr, conteudo, elementos, filhos, oculto, tag, texto, unico, type Elemento, type Forma, type No } from "./i18n-dom";

export type CaminhoAuth = "/entrar" | "/cadastro";
export type EstadoAuth = "inicial" | "vazio";
export type ComparacaoAuth = { caminho: CaminhoAuth; estado: EstadoAuth };
export const CAMINHOS_AUTH = ["/entrar", "/cadastro"] as const;

function dentro(no: No, ancestral: No): boolean {
  return no === ancestral || ("parentNode" in no && no.parentNode !== null && dentro(no.parentNode, ancestral));
}

/** Relações reais do formulário: nenhum ID, for ou aria-* é removido da prova. */
export function verificarPaginaAuth(doc: No, caminho: CaminhoAuth, estado: EstadoAuth = "inicial"): void {
  expect(CAMINHOS_AUTH).toContain(caminho);
  expect(["inicial", "vazio"]).toContain(estado);
  const idioma = attr(tag(doc, "html"), "lang");
  expect(["pt-BR", "en"]).toContain(idioma);
  const todos = elementos(doc);
  const ids = todos.filter((e) => attr(e, "id") !== undefined);
  expect(new Set(ids.map((e) => attr(e, "id"))).size, "IDs únicos no documento inteiro").toBe(ids.length);
  for (const elemento of todos) {
    for (const nome of ["for", "aria-labelledby", "aria-describedby", "aria-controls", "aria-owns", "aria-errormessage"]) {
      const valor = attr(elemento, nome);
      if (valor === undefined) continue;
      const referencias = valor.trim().split(/\s+/);
      expect(referencias.every(Boolean), `${nome} não vazio`).toBe(true);
      for (const id of referencias) unico(doc, (e) => attr(e, "id") === id, `${nome} resolve exatamente ${id}`);
    }
  }

  const header = tag(doc, "header"), main = tag(doc, "main"), footer = tag(doc, "footer");
  for (const regiao of [header, main, footer]) expect(oculto(regiao)).toBe(false);
  expect(texto(tag(main, "h1"))).toBe(caminho === "/entrar" ? "Entrar" : "Crie seu acesso");
  tag(main, "section");
  unico(header, (e) => e.tagName === "a" && attr(e, "href") === "/"
    && attr(e, "aria-label") === "Scrutiniums — página inicial", "marca do cabeçalho próprio");
  const troca = unico(header, (e) => e.tagName === "a" && attr(e, "href") === (caminho === "/entrar" ? "/cadastro" : "/entrar"), "troca de entrada existente");
  expect(texto(troca)).toBe(caminho === "/entrar" ? "Criar acesso" : "Entrar");
  expect(elementos(header).filter((e) => attr(e, "hreflang") === "en" || attr(e, "aria-label") === "Idioma")).toEqual([]);
  expect(elementos(footer).filter((e) => e.tagName === "a").map((e) => [attr(e, "href"), texto(e)]))
    .toEqual([["/termos", "Termos de uso"], ["/privacidade", "Privacidade"]]);
  expect(texto(footer)).toContain("scrutiniums.com");

  if (idioma === "en") {
    const ilha = unico(doc, (e) => attr(e, "data-i18n-estado") !== undefined, "ilha de autenticação");
    const aviso = unico(doc, (e) => attr(e, "data-i18n-aviso") !== undefined, "aviso da autenticação");
    expect(attr(ilha, "data-i18n-estado")).toBe("portugues_marcado");
    expect(attr(ilha, "lang")).toBe("pt-BR");
    expect(attr(aviso, "lang")).toBe("en");
    expect(texto(aviso).trim()).toBe("Portuguese only");
    expect(oculto(aviso) || oculto(ilha)).toBe(false);
    expect([header, main, footer].every((e) => dentro(e, ilha)), "shell inteiro dentro da ilha").toBe(true);
    const irmaos = filhos(ilha.parentNode!).filter((e): e is Elemento => "tagName" in e);
    expect(irmaos[irmaos.indexOf(ilha) - 1]).toBe(aviso);
  } else {
    expect(todos.filter((e) => attr(e, "data-i18n-estado") !== undefined || attr(e, "data-i18n-aviso") !== undefined)).toHaveLength(0);
  }

  const form = tag(doc, "form");
  expect(dentro(form, main)).toBe(true);
  expect(oculto(form)).toBe(false);
  expect(attr(form, "novalidate")).toBe("");
  expect(attr(form, "action")).toBeUndefined();
  expect(attr(form, "method")).toBeUndefined();
  const inputs = todos.filter((e) => e.tagName === "input");
  expect(inputs.every((e) => dentro(e, form) && !oculto(e))).toBe(true);
  expect(inputs.map((e) => [attr(e, "name"), attr(e, "type")])).toEqual(caminho === "/entrar"
    ? [["email", "email"], ["current-password", "password"]]
    : [["email", "email"], [undefined, "checkbox"], [undefined, "checkbox"]]);
  const labels = todos.filter((e) => e.tagName === "label");
  expect(labels).toHaveLength(inputs.length);
  expect(labels.every((e) => dentro(e, form))).toBe(true);
  const alerts = todos.filter((e) => attr(e, "role") === "alert");
  expect(alerts).toHaveLength(estado === "inicial" ? 0 : 2);
  expect(alerts.every((e) => dentro(e, form) && !oculto(e))).toBe(true);

  function erro(input: Elemento, id: string, mensagem: string): void {
    if (estado === "inicial") {
      expect(attr(input, "aria-invalid")).toBeUndefined();
      expect(attr(input, "aria-describedby")).toBeUndefined();
      return;
    }
    expect(attr(input, "aria-invalid")).toBe("true");
    expect(attr(input, "aria-describedby")).toBe(id);
    const alerta = unico(form, (e) => attr(e, "id") === id, `erro associado ${id}`);
    expect(alerta.tagName).toBe("p");
    expect(attr(alerta, "role")).toBe("alert");
    expect(texto(alerta)).toBe(mensagem);
    expect(oculto(alerta)).toBe(false);
  }

  function campo(input: Elemento, label: string, autocomplete: string, maxLength?: string): void {
    const id = attr(input, "id");
    expect(id, "Field possui ID não vazio").toBeTruthy();
    const rotulo = unico(form, (e) => e.tagName === "label" && attr(e, "for") === id, `label de ${label}`);
    expect(texto(rotulo)).toBe(label);
    expect(oculto(rotulo)).toBe(false);
    expect(attr(input, "autocomplete")).toBe(autocomplete);
    expect(attr(input, "required")).toBe("");
    expect(attr(input, "maxlength")).toBe(maxLength);
    expect(attr(input, "disabled")).toBeUndefined();
    expect(attr(input, "value")).toBe("");
    expect(attr(input, "checked")).toBeUndefined();
    erro(input, `${id}-erro`, label === "E-mail" ? "Informe um e-mail válido." : "Informe sua senha.");
  }

  campo(inputs[0], "E-mail", "email", caminho === "/entrar" ? "254" : undefined);
  expect(attr(inputs[0], "inputmode")).toBe("email");
  const submit = tag(form, "button");
  expect(attr(submit, "type")).toBe("submit");
  expect(attr(submit, "disabled")).toBeUndefined();
  expect(oculto(submit)).toBe(false);
  expect(texto(submit)).toBe(caminho === "/entrar" ? "Entrar" : "Continuar");
  const links = elementos(form).filter((e) => e.tagName === "a").map((e) => [attr(e, "href"), texto(e)]);
  if (caminho === "/entrar") {
    campo(inputs[1], "Senha", "current-password", "72");
    expect(links).toEqual([
      ["/entrar/sms?recuperar=1", "Esqueci minha senha"],
      ["/entrar/sms", "Entrar com código por SMS"],
      ["/cadastro", "Ainda não tenho cadastro"],
    ]);
  } else {
    const consentimentos = [
      "Li e aceito os Termos de uso e a Política de privacidade. Seu e-mail é usado para contato e comunicações essenciais.",
      "Quero receber novidades da plataforma por e-mail (opcional).",
    ];
    for (const [i, input] of inputs.slice(1).entries()) {
      const label = unico(form, (e) => e.tagName === "label" && dentro(input, e), "label implícita do checkbox");
      expect(texto(label)).toBe(consentimentos[i]);
      expect(attr(label, "for")).toBeUndefined();
      for (const nome of ["id", "name", "required", "checked", "disabled"]) expect(attr(input, nome), nome).toBeUndefined();
      if (i === 0) erro(input, "termos-erro", "É preciso aceitar os termos para continuar.");
      else {
        expect(attr(input, "aria-invalid")).toBeUndefined();
        expect(attr(input, "aria-describedby")).toBeUndefined();
      }
    }
    const etapa = unico(main, (e) => attr(e, "aria-label") === "Etapa 1 de 3", "etapa atual");
    expect(texto(etapa)).toBe("01Etapa 1 de 3");
    expect(texto(form)).toContain("100% gratuito · sem assinatura · sem cobrança");
    expect(links).toEqual([["/termos", "Termos de uso"], ["/privacidade", "Política de privacidade"], ["/entrar", "Já tenho cadastro"]]);
  }
}

/**
 * Os wrappers EN mudam os useId dos Fields no build real. Somente esta chamada
 * explícita projeta a bijeção desses controles, suas labels e seus erros.
 * Os documentos originais, inclusive o usado pelo detector, permanecem intactos.
 */
export function projetarIlhaAuth(pt: No, en: No, { caminho, estado }: ComparacaoAuth): Forma[] {
  verificarPaginaAuth(pt, caminho, estado);
  verificarPaginaAuth(en, caminho, estado);
  expect(attr(tag(pt, "html"), "lang")).toBe("pt-BR");
  expect(attr(tag(en, "html"), "lang")).toBe("en");
  const campos = caminho === "/entrar"
    ? [["email", "email", "E-mail"], ["current-password", "password", "Senha"]] as const
    : [["email", "email", "E-mail"]] as const;
  const substituicoes = new Map<Elemento, Map<string, string>>();
  const bijecao = new Map<string, string>();
  const destinos = new Set<string>();

  function field(doc: No, nome: string, tipo: string, rotulo: string) {
    const controle = unico(tag(doc, "form"), (e) => e.tagName === "input" && attr(e, "name") === nome, `Field ${nome}`);
    const id = attr(controle, "id")!;
    expect(id, "formato React observado na entrada direta e na navegação cliente").toMatch(/^:[Rr][0-9a-v]+:$/);
    const label = unico(doc, (e) => e.tagName === "label" && attr(e, "for") === id, `label do Field ${nome}`);
    const identidade = [attr(controle, "name"), attr(controle, "type"), texto(label)];
    expect(identidade).toEqual([nome, tipo, rotulo]);
    const erro = estado === "vazio" ? unico(doc, (e) => attr(e, "id") === `${id}-erro`, `erro do Field ${nome}`) : undefined;
    return { controle, label, id, identidade, erro };
  }

  for (const [nome, tipo, rotulo] of campos) {
    const campoPt = field(pt, nome, tipo, rotulo), campoEn = field(en, nome, tipo, rotulo);
    expect(campoEn.identidade).toEqual(campoPt.identidade);
    expect(bijecao.has(campoEn.id) || destinos.has(campoPt.id), "bijeção sem colisão entre Fields").toBe(false);
    bijecao.set(campoEn.id, campoPt.id);
    destinos.add(campoPt.id);
    const atributosControle = new Map([["id", campoPt.id]]);
    if (estado === "vazio") atributosControle.set("aria-describedby", `${campoPt.id}-erro`);
    substituicoes.set(campoEn.controle, atributosControle);
    substituicoes.set(campoEn.label, new Map([["for", campoPt.id]]));
    if (campoEn.erro) substituicoes.set(campoEn.erro, new Map([["id", `${campoPt.id}-erro`]]));
  }
  expect(bijecao.size).toBe(campos.length);
  expect(destinos.size).toBe(campos.length);

  function copiar<T extends No>(no: T): T {
    if ("tagName" in no) {
      const atributos = substituicoes.get(no);
      return { ...no, attrs: no.attrs.map((a) => ({ ...a, value: atributos?.get(a.name) ?? a.value })), childNodes: no.childNodes.map((filho) => copiar(filho)) };
    }
    if ("childNodes" in no) return { ...no, childNodes: no.childNodes.map((filho) => copiar(filho)) };
    return { ...no };
  }
  const ilha = unico(en, (e) => attr(e, "data-i18n-estado") === "portugues_marcado", "ilha auth validada");
  // O mapa usa a identidade dos nós verificados, nunca uma troca global de strings.
  // termos-erro, IDs externos aos Fields e todas as outras referências ficam literais.
  return conteudo(copiar(ilha));
}
