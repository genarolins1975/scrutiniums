import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import inventario from "../../config/i18n-inventario.json";
import { executar, gerarCobertura, serializarRelatorio } from "../../scripts/cobertura-i18n.mjs";
import { lerCatalogo } from "../../scripts/i18n/catalogo.mjs";
import { validarUsoInterface } from "../../scripts/i18n/usos.mjs";
import { PARES_DE_IDIOMA, parDeIdioma } from "@/lib/i18n-rotas";

const CHAVES = [
  "home.hero.titulo_inicio", "home.hero.titulo_destaque", "acesso.criar_conta", "home.hero.ja_cadastrado",
];
const REGIOES_PT = [
  "home-cabecalho", "home-rotulo", "home-introducao", "home-beneficios", "home-indice", "home-secoes", "home-rodape",
];
type Regiao = { id: string; estado: string; chaves?: string[] };
type Uso = { schema_version: number; rotas: Array<{ pt: string; regioes: Regiao[] }> };
function declaracao(): Uso {
  return { schema_version: 1, rotas: [{ pt: "/", regioes: [
    { id: "home-titulo", estado: "traduzido", chaves: CHAVES.slice(0, 2) },
    { id: "home-acoes", estado: "traduzido", chaves: CHAVES.slice(2) },
    ...REGIOES_PT.map((id) => ({ id, estado: "portugues_marcado" })),
  ] }] };
}
const entradasEn = Object.fromEntries([
  ...CHAVES.map((chave) => [chave, { estado: "traduzido", texto: `Synthetic ${chave}` }]),
  ["home.sem_consumidor", { estado: "traduzido", texto: "Available, without a consumer" }],
  ["traducao.portugues_apenas", { estado: "traduzido", texto: "Portuguese only" }],
]);
const irmas = { pares: [
  { pt: "/", en: "/en", dominio: "plataforma", conteudo_declarado: "parcialmente_traduzido" },
  { pt: "/sobre", en: "/en/sobre", dominio: "plataforma", conteudo_declarado: "portugues_marcado" },
] };
const alterar = (editar: (uso: Uso) => void) => {
  const uso = declaracao();
  editar(uso);
  return uso;
};

describe("declaração fechada de uso em rotas parcialmente traduzidas", () => {
  it("conta somente quatro chaves declaradas, sem transformar sete regiões PT em chaves", () => {
    const r = validarUsoInterface({ uso_interface: declaracao() }, irmas, entradasEn);
    expect(r).toMatchObject({
      rotas_parciais_declaradas: 1, chaves_en_declaradas_em_uso: 4,
      ocorrencias_en_declaradas: 4, regioes_pt_nao_catalogadas: 7, html_verificado_pelo_inventario: false,
    });
    expect(r?.rotas[0]).toMatchObject({ pt: "/", en: "/en", dominio: "plataforma" });
    expect(r?.rotas[0].regioes.filter((regiao) => regiao.estado === "portugues_marcado")
      .map((regiao) => regiao.id).sort()).toEqual([...REGIOES_PT].sort());
    expect(JSON.stringify(r)).not.toContain("home.sem_consumidor");
    expect(JSON.stringify(r)).not.toContain("traducao.portugues_apenas");
  });

  it("distingue chave única de ocorrências e mantém ordenação determinística", () => {
    const uso = alterar((d) => {
      d.rotas[0].regioes[0].chaves = ["acesso.criar_conta"];
      d.rotas[0].regioes[1].chaves = ["acesso.criar_conta"];
    });
    const primeiro = validarUsoInterface({ uso_interface: uso }, irmas, entradasEn);
    expect(primeiro).toMatchObject({ chaves_en_declaradas_em_uso: 1, ocorrencias_en_declaradas: 2, regioes_pt_nao_catalogadas: 7 });
    uso.rotas[0].regioes.reverse();
    expect(validarUsoInterface({ uso_interface: uso }, irmas, entradasEn)).toEqual(primeiro);
    const normal = declaracao();
    const a = validarUsoInterface({ uso_interface: normal }, irmas, entradasEn);
    for (const regiao of normal.rotas[0].regioes) regiao.chaves?.reverse();
    expect(validarUsoInterface({ uso_interface: normal }, irmas, entradasEn)).toEqual(a);
  });

  it("exige uma declaração para cada par parcial, sem obrigá-la aos fallbacks integrais", () => {
    expect(validarUsoInterface({}, { pares: [irmas.pares[1]] }, entradasEn)).toBeNull();
    expect(() => validarUsoInterface({}, irmas, entradasEn)).toThrow("requer declaração");
    const maisUma = { pares: [...irmas.pares, {
      pt: "/outra", en: "/en/outra", dominio: "plataforma", conteudo_declarado: "parcialmente_traduzido",
    }] };
    expect(() => validarUsoInterface({ uso_interface: declaracao() }, maisUma, entradasEn)).toThrow("Toda rota parcial");
  });

  it("uma mensagem compartilhada entre rotas e domínios continua sendo uma única chave", () => {
    const uso = declaracao();
    uso.rotas.push({ ...declaracao().rotas[0], pt: "/setor-eletrico" });
    const pares = { pares: [...irmas.pares, {
      pt: "/setor-eletrico", en: "/en/setor-eletrico", dominio: "energia", conteudo_declarado: "parcialmente_traduzido",
    }] };
    const r = validarUsoInterface({ uso_interface: uso }, pares, entradasEn);
    expect(r).toMatchObject({
      rotas_parciais_declaradas: 2, chaves_en_declaradas_em_uso: 4,
      ocorrencias_en_declaradas: 8, regioes_pt_nao_catalogadas: 14,
    });
  });

  it.each([
    { caso: "versão desconhecida", uso: { ...declaracao(), schema_version: 2 } },
    { caso: "campo extra", uso: { ...declaracao(), ignorar: true } },
    { caso: "nenhuma rota", uso: { schema_version: 1, rotas: [] } },
    { caso: "rota sem irmã", uso: alterar((d) => { d.rotas[0].pt = "/nao-publicada"; }) },
    { caso: "rota integral declarada como parcial", uso: alterar((d) => { d.rotas[0].pt = "/sobre"; }) },
    { caso: "rota duplicada", uso: alterar((d) => { d.rotas.push(d.rotas[0]); }) },
    { caso: "campo extra na rota", uso: alterar((d) => { Object.assign(d.rotas[0], { ignorar: true }); }) },
    { caso: "regiões ausentes", uso: alterar((d) => { d.rotas[0].regioes = []; }) },
    { caso: "ID inválido", uso: alterar((d) => { d.rotas[0].regioes[0].id = "#hero span"; }) },
    { caso: "ID duplicado", uso: alterar((d) => { d.rotas[0].regioes[0].id = "home-acoes"; }) },
    { caso: "estado desconhecido", uso: alterar((d) => { d.rotas[0].regioes[0].estado = "completo"; }) },
    { caso: "chave inexistente", uso: alterar((d) => { d.rotas[0].regioes[0].chaves = ["home.inexistente"]; }) },
    { caso: "chave duplicada", uso: alterar((d) => { d.rotas[0].regioes[0].chaves = [CHAVES[0], CHAVES[0]]; }) },
    { caso: "região EN sem chave", uso: alterar((d) => { delete d.rotas[0].regioes[0].chaves; }) },
    { caso: "região EN com lista vazia", uso: alterar((d) => { d.rotas[0].regioes[0].chaves = []; }) },
    { caso: "campo extra na região EN", uso: alterar((d) => { Object.assign(d.rotas[0].regioes[0], { ignorar: true }); }) },
    { caso: "fallback com chave fictícia", uso: alterar((d) => { d.rotas[0].regioes[2].chaves = ["home.restante"]; }) },
    { caso: "só regiões EN", uso: alterar((d) => { d.rotas[0].regioes = d.rotas[0].regioes.slice(0, 2); }) },
    { caso: "só regiões PT", uso: alterar((d) => { d.rotas[0].regioes = d.rotas[0].regioes.slice(2); }) },
    { caso: "aviso contado como conteúdo", uso: alterar((d) => { d.rotas[0].regioes[0].chaves = ["traducao.portugues_apenas"]; }) },
  ])("rejeita $caso", ({ uso }) => {
    expect(() => validarUsoInterface({ uso_interface: uso }, irmas, entradasEn)).toThrow();
  });

  it("não aceita como traduzida uma chave cuja entrada EN declara fallback", () => {
    const en = { ...entradasEn, [CHAVES[0]]: { estado: "portugues_marcado", motivo: "Pendente." } };
    expect(() => validarUsoInterface({ uso_interface: declaracao() }, irmas, en)).toThrow("sem tradução disponível");
  });

  it("mantém a home parcial, as seis institucionais e de entrada traduzidas e os seis pares integrais no registro único real", () => {
    expect(parDeIdioma("/")).toEqual({ pt: "/", en: "/en", conteudo: "parcialmente_traduzido" });
    expect(parDeIdioma("/en")).toEqual(parDeIdioma("/"));
    // O Setor Elétrico (fase 3) declara todas as páginas literais como traduzidas; a prova delas é energia-i18n-html.test.ts.
    // a versão aperitivo da Conta de luz (servida por rewrite em /setor-eletrico/conta-de-luz) conta com o Setor Elétrico
    const doSetor = (pt: string) => pt.startsWith("/setor-eletrico") || pt === "/aperitivo/conta-de-luz";
    const plataforma = PARES_DE_IDIOMA.filter((par) => !doSetor(par.pt));
    const setor = PARES_DE_IDIOMA.filter((par) => doSetor(par.pt));
    expect(plataforma).toHaveLength(13);
    expect(setor.length).toBeGreaterThanOrEqual(73);
    expect(setor.every((par) => par.conteudo === "traduzido")).toBe(true);
    expect(plataforma.filter((par) => par.conteudo === "traduzido").map((par) => par.pt)).toEqual([
      "/entrar", "/entrar/sms", "/entrar/sms/verificar", "/sobre", "/sobre/erros", "/sobre/governanca",
    ]);
    expect(PARES_DE_IDIOMA.filter((par) => par.conteudo === "portugues_marcado").map((par) => par.pt)).toEqual([
      "/cadastro", "/glossario", "/imprensa", "/observatorio-do-credito", "/privacidade", "/termos",
    ]);
    // O estado publicado evolui sem transformar a fixture sintética 4/7
    // em uma cópia da implementação real.
    expect(inventario.uso_interface).toEqual({ schema_version: 1, rotas: [{ pt: "/", regioes: [
      { id: "home-titulo", estado: "traduzido", chaves: ["home.hero.titulo_inicio", "home.hero.titulo_destaque"] },
      { id: "home-acoes", estado: "traduzido", chaves: ["acesso.criar_conta", "home.hero.ja_cadastrado"] },
      { id: "home-cabecalho", estado: "portugues_marcado" },
      { id: "home-perguntas", estado: "portugues_marcado" },
      { id: "home-rotulo", estado: "traduzido", chaves: ["home.hero.rotulo"] },
      { id: "home-introducao", estado: "traduzido", chaves: ["home.hero.introducao"] },
      { id: "home-beneficios", estado: "traduzido", chaves: [
        "home.hero.beneficio_conta", "home.hero.beneficio_evidencia", "home.hero.beneficio_gratuidade",
      ] },
      { id: "home-indice", estado: "traduzido", chaves: [
        "home.indice.rotulo", "home.indice.ilustracoes", "home.indice.paginas_tematicas",
        "home.indice.secoes_publicadas", "home.indice.temas_publicados", "home.indice.capitulos_com_dados",
        "home.indice.unidades_federacao", "home.indice.paginas_por_pergunta", "home.indice.contagem_parcial",
      ] },
      { id: "home-secoes", estado: "portugues_marcado" },
      { id: "home-rodape", estado: "portugues_marcado" },
    ] }] });
    const catalogo = lerCatalogo(
      readFileSync(join(process.cwd(), inventario.catalogo.pt), "utf8"),
      readFileSync(join(process.cwd(), inventario.catalogo.en), "utf8"),
    );
    expect(Object.keys(catalogo.pt)).toHaveLength(22);
    expect(Object.keys(catalogo.en)).toHaveLength(22);
    const registro = { pares: PARES_DE_IDIOMA.map((par) => ({
      pt: par.pt, en: par.en, conteudo_declarado: par.conteudo,
      dominio: par.pt === "/observatorio-do-credito" ? "credito" : "plataforma",
    })) };
    const usoReal = validarUsoInterface(inventario, registro, catalogo.en);
    expect(usoReal).toMatchObject({
      schema_version: 1, rotas_parciais_declaradas: 1,
      chaves_en_declaradas_em_uso: 18, ocorrencias_en_declaradas: 18,
      regioes_pt_nao_catalogadas: 4, html_verificado_pelo_inventario: false,
    });
    expect(usoReal?.rotas).toHaveLength(1);
    expect(usoReal?.rotas[0]).toMatchObject({ pt: "/", en: "/en", dominio: "plataforma" });
    expect(usoReal?.rotas[0].regioes).toHaveLength(10);
    expect(usoReal?.rotas[0].regioes.filter((regiao) => regiao.estado === "traduzido").map((regiao) => regiao.id))
      .toEqual(["home-acoes", "home-beneficios", "home-indice", "home-introducao", "home-rotulo", "home-titulo"]);
    expect(usoReal?.rotas[0].regioes.filter((regiao) => regiao.estado === "portugues_marcado").map((regiao) => regiao.id))
      .toEqual(["home-cabecalho", "home-perguntas", "home-rodape", "home-secoes"]);
  });
});

const temporarios: string[] = [];
afterEach(() => { for (const raiz of temporarios.splice(0)) rmSync(raiz, { recursive: true, force: true }); });
function escrever(raiz: string, path: string, texto: string) {
  mkdirSync(dirname(join(raiz, path)), { recursive: true });
  writeFileSync(join(raiz, path), texto);
}
function fixture() {
  const raiz = mkdtempSync(join(tmpdir(), "i18n-uso-cobertura-"));
  temporarios.push(raiz);
  execFileSync("git", ["init", "--quiet"], { cwd: raiz });
  const manifesto = {
    schema_version: 1,
    catalogo: { schema_version: 1, dominio: "plataforma", pt: "src/i18n/pt.ts", en: "src/i18n/en.ts" },
    rotas: { schema_version: 1, literais: [
      { pt: "/", conteudo: "parcialmente_traduzido" }, { pt: "/sobre", conteudo: "portugues_marcado" },
      { pt: "/setor-eletrico/metodologia", conteudo: "portugues_marcado" },
    ] },
    uso_interface: declaracao(),
    ui: { raizes: ["src/app", "src/components"] },
    dominios: [
      { id: "plataforma", nome: "Plataforma", ui: ["src/app", "src/components"], gold: ["gold"] },
      { id: "energia", nome: "Energia", ui: ["src/app/setor-eletrico"], gold: [] },
    ],
    observar: ["src/app", "src/components", "src/i18n", "gold"],
  };
  escrever(raiz, "config/i18n-inventario.json", JSON.stringify(manifesto));
  for (const path of ["src/app/page.tsx", "src/app/en/page.tsx", "src/app/sobre/page.tsx", "src/app/en/sobre/page.tsx",
    "src/app/setor-eletrico/metodologia/page.tsx", "src/app/en/setor-eletrico/metodologia/page.tsx"]) {
    // Propositalmente sem tradução: presença de fontes não é prova do conteúdo renderizado.
    escrever(raiz, path, "export default () => <p>Dados publicados: 1234.5</p>;");
  }
  escrever(raiz, "src/components/Hero.tsx", "export const Hero = () => <h1>Dados</h1>;");
  escrever(raiz, "src/i18n/pt.ts", `export const pt = ${JSON.stringify(Object.fromEntries(Object.keys(entradasEn).map((chave) => [chave, `Sintético ${chave}`])))} as const;`);
  escrever(raiz, "src/i18n/en.ts", `export const en = ${JSON.stringify(entradasEn)} as const;`);
  escrever(raiz, "gold/base.json", '{"nome":"Série portuguesa","valor":1234.5}\n');
  return { raiz, manifesto };
}

describe("relatório de uso declarado, separado do catálogo e do HTML", () => {
  it("distingue seis traduções disponíveis, quatro chaves declaradas e sete regiões pendentes", () => {
    const { raiz } = fixture();
    const gold = readFileSync(join(raiz, "gold/base.json"));
    const r = gerarCobertura(raiz);
    expect(r.dominios.plataforma.gold).toBeUndefined();
    expect(r.catalogo).toMatchObject({ chaves: 6, traducoes_disponiveis: 6, uso_na_interface_verificado: false });
    expect(r.uso_interface_declarado).toMatchObject({
      chaves_en_declaradas_em_uso: 4, ocorrencias_en_declaradas: 4,
      regioes_pt_nao_catalogadas: 7, html_verificado_pelo_inventario: false,
    });
    expect(r.irmas_declaradas).toMatchObject({ pares_estruturais: 3, fallbacks_declarados: 2, html_verificado_pelo_inventario: false });
    expect(r.dominios.plataforma).toMatchObject({
      rotas: { pares_estruturais: 2, fallbacks_declarados: 1, parciais_declarados: 1, paridade_verificada: false },
      interface: { chaves_catalogadas: { traduzidas: null, portugues_marcado: null, sem_traducao: null, nomes_preservados: null }, percentual_traduzido: null },
      cobertura_completa: false,
    });
    expect(r.dominios.energia).toMatchObject({
      rotas: { pares_estruturais: 1, fallbacks_declarados: 1, paridade_verificada: false },
      interface: { chaves_catalogadas: { traduzidas: 0, portugues_marcado: 0 }, percentual_traduzido: null }, cobertura_completa: false,
    });
    expect(readFileSync(join(raiz, "gold/base.json"))).toEqual(gold);
    expect(serializarRelatorio(gerarCobertura(raiz))).toBe(serializarRelatorio(r));
  });

  it("mudar somente a disponibilidade não inventa um novo consumidor", () => {
    const { raiz } = fixture();
    const antes = gerarCobertura(raiz);
    const novoEn = { ...entradasEn, "home.sem_consumidor": { estado: "portugues_marcado", motivo: "Revisão pendente." } };
    escrever(raiz, "src/i18n/en.ts", `export const en = ${JSON.stringify(novoEn)} as const;`);
    const depois = gerarCobertura(raiz);
    expect(depois.catalogo?.traducoes_disponiveis).toBe(5);
    expect(depois.uso_interface_declarado).toEqual(antes.uso_interface_declarado);
    expect(depois.catalogo?.arquivos.en.sha256).not.toBe(antes.catalogo?.arquivos.en.sha256);
  });

  it("assina as fontes consumidoras e a declaração, sem regravar relatório durante --check", () => {
    const { raiz, manifesto } = fixture();
    executar([], raiz);
    const path = join(raiz, "docs/i18n/cobertura.json");
    const original = readFileSync(path);
    escrever(raiz, "src/components/Hero.tsx", "export const Hero = () => <h1>Fonte alterada</h1>;");
    expect(() => executar(["--check"], raiz)).toThrow("desatualizada");
    expect(readFileSync(path)).toEqual(original);
    executar([], raiz);
    const atualizado = readFileSync(path);
    manifesto.uso_interface.rotas[0].regioes[0].id = "home-titulo-revisado";
    escrever(raiz, "config/i18n-inventario.json", JSON.stringify(manifesto));
    expect(() => executar(["--check"], raiz)).toThrow("desatualizada");
    expect(readFileSync(path)).toEqual(atualizado);
  });

  it("não permite publicar estado parcial sem seu contrato de uso", () => {
    const { raiz, manifesto } = fixture();
    escrever(raiz, "config/i18n-inventario.json", JSON.stringify({ ...manifesto, uso_interface: undefined }));
    expect(() => gerarCobertura(raiz)).toThrow("requer declaração");
  });
});
