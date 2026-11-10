import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { definirTransporteGold, edicaoCorrenteGold, lerGold, lerGoldJson, limparCacheGold, origemGold } from "@/lib/gold/leitor";
import { calcularEdicao, caminhoObjeto, caminhoValido, montarPonteiro, sha256Hex, validarManifesto } from "@/lib/gold/manifesto";
import { ErroGold, ESQUEMA_GOLD, type ArquivoGold, type ManifestoGold } from "@/lib/gold/tipos";

/**
 * Leitor único de gold (src/lib/gold, docs/DADOS_FORA_DO_DEPLOY.md), preparado e desligado.
 *
 * Piloto: Agronegócio, o menor domínio de public/ com leitura em tempo de requisição. O manifesto é montado aqui a partir
 * do disco a cada execução: o teste não depende do retrato versionado em config/gold-manifestos/, que envelhece a cada
 * atualização do dado.
 */

const RAIZ = process.cwd();
const DOMINIO = "agro";
const PASTA = join(RAIZ, "public", DOMINIO);
const SCRIPT = join(RAIZ, "scripts", "gold-manifesto.mjs");

function listar(pasta: string, prefixo = ""): string[] {
  return readdirSync(pasta).sort().flatMap((nome) => {
    const relativo = prefixo ? `${prefixo}/${nome}` : nome;
    return statSync(join(pasta, nome)).isDirectory() ? listar(join(pasta, nome), relativo) : [relativo];
  });
}

const doDisco = (caminho: string) => readFileSync(join(PASTA, ...caminho.split("/")));

function manifestoDe(caminhos: string[]): ManifestoGold {
  const arquivos: ArquivoGold[] = caminhos.map((caminho) => {
    const bytes = doDisco(caminho);
    return { caminho, bytes: bytes.length, sha256: sha256Hex(bytes) };
  });
  return { esquema: ESQUEMA_GOLD, dominio: DOMINIO, edicao: calcularEdicao(arquivos), total_arquivos: arquivos.length, total_bytes: arquivos.reduce((s, a) => s + a.bytes, 0), arquivos };
}

const CAMINHOS = listar(PASTA);
const ALVO = "gold/snapshot.json";

/** Estado do servidor de teste: o que ele serve e como adultera, trocado por teste. */
const servidor = {
  manifesto: manifestoDe(CAMINHOS),
  /** Corpo do manifesto quando o teste quer servir bytes diferentes dos que o ponteiro registra. */
  manifestoAdulterado: null as Buffer | null,
  /** sha256 → transformação aplicada ao objeto servido. */
  adulterar: new Map<string, (b: Buffer) => Buffer>(),
  /** caminho da URL → status forçado. */
  status: new Map<string, number>(),
  pedidos: [] as string[],
  autorizacoes: [] as (string | undefined)[],
};

const bytesDoManifesto = () => Buffer.from(JSON.stringify(servidor.manifesto));
const pedidosDe = (trecho: string) => servidor.pedidos.filter((p) => p.includes(trecho)).length;

let http: Server;
let base = "";
const AMBIENTE = ["GOLD_ORIGEM", "GOLD_BASE_URL", "GOLD_TOKEN", "GOLD_PONTEIRO_TTL_S", "GOLD_TEMPO_LIMITE_MS", "GOLD_CACHE_MAX_MB"] as const;
const anterior = new Map<string, string | undefined>();

beforeAll(async () => {
  for (const nome of AMBIENTE) anterior.set(nome, process.env[nome]);
  http = createServer((req, res) => {
    const url = req.url ?? "";
    servidor.pedidos.push(url);
    servidor.autorizacoes.push(req.headers.authorization);
    const forcado = servidor.status.get(url);
    if (forcado) return void res.writeHead(forcado).end("indisponível");
    const m = servidor.manifesto;
    if (url === `/${DOMINIO}/corrente.json`) {
      return void res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(montarPonteiro(m, bytesDoManifesto(), { publicado_em: "2026-11-10T12:00:00Z" })));
    }
    if (url === `/${DOMINIO}/manifestos/${m.edicao}.json`) {
      return void res.writeHead(200, { "content-type": "application/json" }).end(servidor.manifestoAdulterado ?? bytesDoManifesto());
    }
    const arquivo = m.arquivos.find((a) => url === `/${DOMINIO}/${caminhoObjeto(a)}`);
    if (!arquivo) return void res.writeHead(404).end("não encontrado");
    const bytes = doDisco(arquivo.caminho);
    res.writeHead(200).end((servidor.adulterar.get(arquivo.sha256) ?? ((b: Buffer) => b))(bytes));
  });
  await new Promise<void>((pronto) => http.listen(0, "127.0.0.1", pronto));
  base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
});

afterAll(async () => {
  for (const nome of AMBIENTE) {
    const valor = anterior.get(nome);
    if (valor === undefined) delete process.env[nome];
    else process.env[nome] = valor;
  }
  await new Promise<void>((pronto) => http.close(() => pronto()));
});

beforeEach(() => {
  for (const nome of AMBIENTE) delete process.env[nome];
  servidor.manifesto = manifestoDe(CAMINHOS);
  servidor.manifestoAdulterado = null;
  servidor.adulterar.clear();
  servidor.status.clear();
  servidor.pedidos.length = 0;
  servidor.autorizacoes.length = 0;
  limparCacheGold();
});

afterEach(() => {
  definirTransporteGold(null);
});

function ligar() {
  process.env.GOLD_ORIGEM = "externo";
  process.env.GOLD_BASE_URL = base;
}

async function erroDe(promessa: Promise<unknown>): Promise<ErroGold> {
  const erro = await promessa.then(
    () => null,
    (e: unknown) => e,
  );
  expect(erro, "a leitura deveria ter falhado").toBeInstanceOf(ErroGold);
  return erro as ErroGold;
}

describe("piloto", () => {
  it("o domínio piloto tem arquivos e o arquivo lido em tempo de requisição está entre eles", () => {
    expect(CAMINHOS.length).toBeGreaterThan(0);
    expect(CAMINHOS).toContain(ALVO);
    expect(doDisco(ALVO).length).toBeGreaterThan(0);
  });
});

describe("chave desligada (GOLD_ORIGEM ausente ou repositorio)", () => {
  it("devolve bytes idênticos aos de public/ para todos os arquivos do piloto, sem abrir rede", async () => {
    // Endereço configurado de propósito: desligado, o leitor não pode nem olhar para ele.
    process.env.GOLD_BASE_URL = base;
    expect(origemGold()).toBe("repositorio");
    for (const caminho of CAMINHOS) {
      const lido = await lerGold(DOMINIO, caminho);
      expect(lido.equals(doDisco(caminho)), caminho).toBe(true);
    }
    process.env.GOLD_ORIGEM = "repositorio";
    expect((await lerGold(DOMINIO, ALVO)).equals(doDisco(ALVO))).toBe(true);
    process.env.GOLD_ORIGEM = "";
    expect((await lerGold(DOMINIO, ALVO)).equals(doDisco(ALVO))).toBe(true);
    expect(servidor.pedidos).toEqual([]);
  });

  it("lê o disco a cada chamada: não guarda cópia que possa envelhecer", async () => {
    const pasta = mkdtempSync(join(tmpdir(), "gold-leitor-"));
    const cwd = process.cwd();
    try {
      cpSync(PASTA, join(pasta, "public", DOMINIO), { recursive: true });
      process.chdir(pasta);
      const antes = await lerGold(DOMINIO, ALVO);
      writeFileSync(join(pasta, "public", DOMINIO, ...ALVO.split("/")), "{\"trocado\":true}");
      const depois = await lerGold(DOMINIO, ALVO);
      expect(antes.equals(doDisco(ALVO))).toBe(true);
      expect(depois.toString("utf-8")).toBe("{\"trocado\":true}");
    } finally {
      process.chdir(cwd);
      rmSync(pasta, { recursive: true, force: true });
    }
  });

  it("JSON lido pelo leitor é o mesmo objeto que o JSON.parse do arquivo", async () => {
    expect(await lerGoldJson(DOMINIO, ALVO)).toEqual(JSON.parse(doDisco(ALVO).toString("utf-8")));
  });

  it("arquivo inexistente falha com erro explícito, sem valor substituto", async () => {
    const erro = await erroDe(lerGold(DOMINIO, "gold/nao-existe.json"));
    expect(erro.codigo).toBe("ausente");
    expect(erro.message).toContain("agro/gold/nao-existe.json");
  });

  it("recusa caminho que sai da pasta do domínio", async () => {
    for (const caminho of ["../agro/gold/snapshot.json", "gold/../../agro/gold/snapshot.json", "/etc/passwd", "gold//snapshot.json", "gold\\snapshot.json", ""]) {
      expect(caminhoValido(caminho), caminho).toBe(false);
      expect((await erroDe(lerGold(DOMINIO, caminho))).codigo, caminho).toBe("caminho_invalido");
    }
    expect((await erroDe(lerGold("../src", "lib/dominios.ts"))).codigo).toBe("caminho_invalido");
  });

  it("não há edição no modo repositório, e a ausência não vira identificador", async () => {
    expect(await edicaoCorrenteGold(DOMINIO)).toEqual({ origem: "repositorio", edicao: null, publicado_em: null });
  });
});

describe("configuração", () => {
  it("valor desconhecido em GOLD_ORIGEM é erro, não escolha silenciosa de origem", async () => {
    process.env.GOLD_ORIGEM = "externa";
    const erro = await erroDe(lerGold(DOMINIO, ALVO));
    expect(erro.codigo).toBe("configuracao");
    expect(erro.message).toContain("externa");
  });

  it("externo sem endereço, com endereço http fora de localhost ou com credencial no endereço é erro de configuração", async () => {
    process.env.GOLD_ORIGEM = "externo";
    expect((await erroDe(lerGold(DOMINIO, ALVO))).codigo).toBe("configuracao");
    for (const endereco of ["http://exemplo.invalid/gold", "ftp://localhost/gold", "https://usuario:senha@exemplo.invalid/gold", "não é endereço"]) {
      process.env.GOLD_BASE_URL = endereco;
      expect((await erroDe(lerGold(DOMINIO, ALVO))).codigo, endereco).toBe("configuracao");
    }
    expect(servidor.pedidos).toEqual([]);
  });
});

describe("chave ligada (GOLD_ORIGEM=externo) contra o servidor local", () => {
  it("devolve os mesmos bytes de public/ para todos os arquivos do piloto", async () => {
    ligar();
    for (const caminho of CAMINHOS) {
      const lido = await lerGold(DOMINIO, caminho);
      expect(lido.equals(doDisco(caminho)), caminho).toBe(true);
    }
    expect(await lerGoldJson(DOMINIO, ALVO)).toEqual(JSON.parse(doDisco(ALVO).toString("utf-8")));
    expect(await edicaoCorrenteGold(DOMINIO)).toEqual({ origem: "externo", edicao: servidor.manifesto.edicao, publicado_em: "2026-11-10T12:00:00Z" });
  });

  it("guarda em memória: ponteiro, manifesto e objeto são buscados uma vez; leituras simultâneas não duplicam pedidos", async () => {
    ligar();
    const leituras = await Promise.all([lerGold(DOMINIO, ALVO), lerGold(DOMINIO, ALVO), lerGold(DOMINIO, ALVO)]);
    await lerGold(DOMINIO, ALVO);
    for (const l of leituras) expect(l.equals(doDisco(ALVO))).toBe(true);
    expect(pedidosDe("/corrente.json")).toBe(1);
    expect(pedidosDe("/manifestos/")).toBe(1);
    expect(pedidosDe("/objetos/")).toBe(1);
    // quem recebe pode alterar o que recebeu sem estragar a leitura seguinte
    leituras[0].fill(0);
    expect((await lerGold(DOMINIO, ALVO)).equals(doDisco(ALVO))).toBe(true);
  });

  it("envia o token em Authorization quando GOLD_TOKEN existe, e nada quando não existe", async () => {
    ligar();
    await lerGold(DOMINIO, ALVO);
    expect(servidor.autorizacoes.every((a) => a === undefined)).toBe(true);
    limparCacheGold();
    servidor.autorizacoes.length = 0;
    process.env.GOLD_TOKEN = "segredo-de-teste";
    await lerGold(DOMINIO, ALVO);
    expect(servidor.autorizacoes.length).toBe(3);
    expect(servidor.autorizacoes.every((a) => a === "Bearer segredo-de-teste")).toBe(true);
  });

  it("sha256 divergente reprova com erro claro, e o conteúdo reprovado não entra no cache", async () => {
    ligar();
    const arquivo = servidor.manifesto.arquivos.find((a) => a.caminho === ALVO)!;
    // mesmo tamanho, um byte trocado: só o hash acusa
    servidor.adulterar.set(arquivo.sha256, (b) => {
      const c = Buffer.from(b);
      c[c.length - 2] ^= 0x01;
      return c;
    });
    const erro = await erroDe(lerGold(DOMINIO, ALVO));
    expect(erro.codigo).toBe("hash_divergente");
    expect(erro.message).toContain("sha256 divergente");
    expect(erro.message).toContain(arquivo.sha256);
    expect(erro.message).toContain("agro/gold/snapshot.json");
    // repetir continua reprovando (nada foi guardado); corrigida a origem, a leitura volta a devolver os bytes certos
    expect((await erroDe(lerGold(DOMINIO, ALVO))).codigo).toBe("hash_divergente");
    servidor.adulterar.clear();
    expect((await lerGold(DOMINIO, ALVO)).equals(doDisco(ALVO))).toBe(true);
  });

  it("conteúdo truncado ou vazio reprova: nunca devolve resposta parcial nem zero byte", async () => {
    ligar();
    const arquivo = servidor.manifesto.arquivos.find((a) => a.caminho === ALVO)!;
    servidor.adulterar.set(arquivo.sha256, (b) => b.subarray(0, 100));
    expect((await erroDe(lerGold(DOMINIO, ALVO))).codigo).toBe("tamanho_divergente");
    servidor.adulterar.set(arquivo.sha256, () => Buffer.alloc(0));
    const erro = await erroDe(lerGold(DOMINIO, ALVO));
    expect(erro.codigo).toBe("tamanho_divergente");
    expect(erro.message).toContain(`${arquivo.bytes} bytes`);
  });

  it("arquivo fora do manifesto reprova, mesmo existindo em public/: não há leitura de reserva no disco", async () => {
    ligar();
    const erro = await erroDe(lerGold(DOMINIO, "gold/nao-existe.json"));
    expect(erro.codigo).toBe("fora_do_manifesto");
    expect(erro.message).toContain("não consta do manifesto");
    // edição corrente sem o arquivo-alvo: ele existe no disco e o leitor não pode ir buscá-lo lá
    servidor.manifesto = manifestoDe(CAMINHOS.filter((c) => c !== ALVO));
    limparCacheGold();
    expect(doDisco(ALVO).length).toBeGreaterThan(0);
    const fora = await erroDe(lerGold(DOMINIO, ALVO));
    expect(fora.codigo).toBe("fora_do_manifesto");
    expect(pedidosDe("/objetos/")).toBe(0);
  });

  it("manifesto que não confere com o ponteiro reprova antes de qualquer arquivo ser buscado", async () => {
    ligar();
    const trocado = manifestoDe(CAMINHOS.filter((c) => c !== ALVO));
    servidor.manifestoAdulterado = Buffer.from(JSON.stringify(trocado));
    const erro = await erroDe(lerGold(DOMINIO, ALVO));
    expect(erro.codigo).toBe("manifesto_invalido");
    expect(pedidosDe("/objetos/")).toBe(0);
  });

  it("origem fora do ar falha com o status, sem cair para public/", async () => {
    ligar();
    servidor.status.set(`/${DOMINIO}/corrente.json`, 503);
    const erro = await erroDe(lerGold(DOMINIO, ALVO));
    expect(erro.codigo).toBe("http");
    expect(erro.message).toContain("503");
  });

  it("ponteiro vencido não é reaproveitado quando a nova leitura falha: nunca edição antiga em silêncio", async () => {
    ligar();
    process.env.GOLD_PONTEIRO_TTL_S = "0";
    expect((await lerGold(DOMINIO, ALVO)).equals(doDisco(ALVO))).toBe(true);
    servidor.status.set(`/${DOMINIO}/corrente.json`, 500);
    expect((await erroDe(lerGold(DOMINIO, ALVO))).codigo).toBe("http");
  });

  it("troca de ponteiro passa a valer na leitura seguinte ao vencimento, e a volta atrás devolve a edição anterior", async () => {
    ligar();
    process.env.GOLD_PONTEIRO_TTL_S = "0";
    const completa = servidor.manifesto.edicao;
    expect((await edicaoCorrenteGold(DOMINIO)).edicao).toBe(completa);
    servidor.manifesto = manifestoDe(CAMINHOS.filter((c) => c !== ALVO));
    expect((await edicaoCorrenteGold(DOMINIO)).edicao).toBe(servidor.manifesto.edicao);
    expect((await erroDe(lerGold(DOMINIO, ALVO))).codigo).toBe("fora_do_manifesto");
    servidor.manifesto = manifestoDe(CAMINHOS);
    expect((await edicaoCorrenteGold(DOMINIO)).edicao).toBe(completa);
    expect((await lerGold(DOMINIO, ALVO)).equals(doDisco(ALVO))).toBe(true);
  });

  it("falha de rede vira ErroGold com a causa", async () => {
    ligar();
    definirTransporteGold(async () => {
      throw new Error("conexão recusada (teste)");
    });
    const erro = await erroDe(lerGold(DOMINIO, ALVO));
    expect(erro.codigo).toBe("rede");
    expect(erro.message).toContain("conexão recusada (teste)");
    expect(erro.cause).toBeInstanceOf(Error);
  });
});

describe("gerador scripts/gold-manifesto.mjs", () => {
  it("gera o mesmo manifesto e a mesma edição que o leitor calcula", () => {
    const gerado = JSON.parse(execFileSync(process.execPath, [SCRIPT, DOMINIO, "--stdout"], { encoding: "utf-8" }));
    expect(gerado).toEqual(manifestoDe(CAMINHOS));
    expect(validarManifesto(gerado, DOMINIO).edicao).toBe(calcularEdicao(gerado.arquivos));
  });

  it("--check aprova o manifesto recém-gerado e reprova arquivo alterado, arquivo a mais e arquivo a menos", () => {
    const pasta = mkdtempSync(join(tmpdir(), "gold-manifesto-"));
    try {
      const raiz = join(pasta, "publico");
      const saida = join(pasta, "manifesto.json");
      cpSync(PASTA, join(raiz, DOMINIO), { recursive: true });
      const rodar = (...extra: string[]) => spawnSync(process.execPath, [SCRIPT, DOMINIO, "--raiz", raiz, "--saida", saida, ...extra], { encoding: "utf-8" });
      expect(rodar().status).toBe(0);
      expect(rodar("--check").status).toBe(0);

      const alvo = join(raiz, DOMINIO, ...ALVO.split("/"));
      const original = readFileSync(alvo);
      const alterado = Buffer.from(original);
      alterado[alterado.length - 2] ^= 0x01;
      writeFileSync(alvo, alterado);
      const divergente = rodar("--check");
      expect(divergente.status).toBe(1);
      expect(divergente.stderr).toContain(`${ALVO}: sha256`);
      writeFileSync(alvo, original);
      expect(rodar("--check").status).toBe(0);

      writeFileSync(join(raiz, DOMINIO, "novo.json"), "{}");
      const aMais = rodar("--check");
      expect(aMais.status).toBe(1);
      expect(aMais.stderr).toContain("novo.json: existe no disco e não está no manifesto");
      rmSync(join(raiz, DOMINIO, "novo.json"));

      rmSync(alvo);
      const aMenos = rodar("--check");
      expect(aMenos.status).toBe(1);
      expect(aMenos.stderr).toContain(`${ALVO}: está no manifesto e não existe no disco`);
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  });

  it("domínio inexistente é erro de uso (saída 2), não manifesto vazio", () => {
    const r = spawnSync(process.execPath, [SCRIPT, "dominio-que-nao-existe", "--stdout"], { encoding: "utf-8" });
    expect(r.status).toBe(2);
    expect(r.stdout).toBe("");
  });
});

describe("desligado de fato", () => {
  it("nenhum arquivo de src/ fora de src/lib/gold e deste teste importa o leitor", () => {
    const fontes = (pasta: string): string[] =>
      readdirSync(pasta, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? fontes(join(pasta, e.name)) : /\.(ts|tsx|mts|js|mjs)$/.test(e.name) ? [join(pasta, e.name)] : [],
      );
    const propria = join(RAIZ, "src", "lib", "gold");
    const usuarios = fontes(join(RAIZ, "src"))
      .filter((f) => !f.startsWith(propria) && f !== join(RAIZ, "src", "tests", "gold-leitor.test.ts"))
      .filter((f) => /["'](?:@\/lib\/gold|(?:\.\.?\/)+(?:lib\/)?gold)\/(?:leitor|manifesto|tipos)["']/.test(readFileSync(f, "utf-8")));
    // Quando a adoção for decidida, este teste muda junto com a primeira chamada trocada.
    expect(usuarios.map((f) => f.slice(RAIZ.length + 1))).toEqual([]);
  });
});
