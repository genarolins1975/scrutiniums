import { readFile } from "node:fs/promises";
import { request as pedirHttp } from "node:http";
import { request as pedirHttps } from "node:https";
import { join } from "node:path";
import {
  CAMINHO_PONTEIRO,
  caminhoObjeto,
  caminhoValido,
  dominioValido,
  sha256Hex,
  validarManifesto,
  validarPonteiro,
} from "./manifesto";
import { ErroGold, type ArquivoGold, type ManifestoGold, type OrigemGold, type PonteiroGold } from "./tipos";

/**
 * Leitor único de gold: `lerGold(dominio, caminho)` devolve os bytes de public/<dominio>/<caminho>.
 *
 * PREPARADO E DESLIGADO. Nenhuma página, rota ou componente importa este módulo; a adoção é decisão posterior, domínio
 * por domínio (docs/DADOS_FORA_DO_DEPLOY.md).
 *
 * - GOLD_ORIGEM ausente, vazia ou "repositorio": lê o arquivo de public/, como os leitores de hoje. Não abre rede, não
 *   consulta manifesto, não guarda nada em memória.
 * - GOLD_ORIGEM="externo": lê o ponteiro "edição corrente" do domínio, o manifesto daquela edição e o objeto endereçado
 *   pelo sha256, por HTTP, e só devolve os bytes depois de conferir tamanho e sha256 contra o manifesto.
 * - Qualquer outro valor: erro de configuração. Um erro de digitação na variável não pode escolher uma origem em silêncio.
 *
 * Falha é sempre ErroGold. Não há leitura de reserva em public/ quando a origem externa falha, nem reaproveitamento de
 * ponteiro vencido: dado antigo servido sem aviso é o defeito que este desenho existe para impedir.
 *
 * Variáveis do modo externo: GOLD_BASE_URL (obrigatória; https, ou http só para localhost), GOLD_TOKEN (opcional; vai em
 * Authorization: Bearer, para armazenamento privado), GOLD_PONTEIRO_TTL_S (padrão 60), GOLD_TEMPO_LIMITE_MS (padrão
 * 10000) e GOLD_CACHE_MAX_MB (padrão 64).
 *
 * O transporte usa node:http/https, não o fetch global: o Next 14 intercepta o fetch do servidor e aplica o cache de dados
 * dele, o que tiraria deste módulo o controle sobre a validade do ponteiro.
 */

export type RespostaTransporte = { status: number; corpo: Buffer };
export type TransporteGold = (url: string, opcoes: { token?: string; tempoLimiteMs: number; maxBytes: number }) => Promise<RespostaTransporte>;

interface Configuracao {
  base: string;
  token?: string;
  ttlPonteiroMs: number;
  tempoLimiteMs: number;
  cacheMaxBytes: number;
}

const MAX_PONTEIRO = 64 * 1024;
const MAX_MANIFESTO = 32 * 1024 * 1024;

/** Origem em vigor, pela variável de ambiente lida a cada chamada. */
export function origemGold(): OrigemGold {
  const bruto = process.env.GOLD_ORIGEM;
  if (bruto === undefined || bruto === "" || bruto === "repositorio") return "repositorio";
  if (bruto === "externo") return "externo";
  throw new ErroGold("configuracao", "-", "-", `GOLD_ORIGEM="${bruto}" não é reconhecida; use "repositorio" (padrão) ou "externo"`);
}

function numeroDoAmbiente(nome: string, padrao: number, dominio: string, caminho: string): number {
  const bruto = process.env[nome];
  if (bruto === undefined || bruto === "") return padrao;
  const n = Number(bruto);
  if (!Number.isFinite(n) || n < 0) throw new ErroGold("configuracao", dominio, caminho, `${nome}="${bruto}" não é um número válido`);
  return n;
}

function configuracaoExterna(dominio: string, caminho: string): Configuracao {
  const bruta = process.env.GOLD_BASE_URL;
  if (!bruta) throw new ErroGold("configuracao", dominio, caminho, 'GOLD_ORIGEM="externo" exige GOLD_BASE_URL');
  let url: URL;
  try {
    url = new URL(bruta);
  } catch (e) {
    throw new ErroGold("configuracao", dominio, caminho, "GOLD_BASE_URL não é um endereço válido", e);
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new ErroGold("configuracao", dominio, caminho, "GOLD_BASE_URL deve usar https (http só para localhost)");
  }
  if (url.search || url.hash || url.username || url.password) {
    throw new ErroGold("configuracao", dominio, caminho, "GOLD_BASE_URL não aceita consulta, fragmento nem credencial no endereço");
  }
  return {
    base: url.href.replace(/\/+$/, ""),
    token: process.env.GOLD_TOKEN || undefined,
    ttlPonteiroMs: numeroDoAmbiente("GOLD_PONTEIRO_TTL_S", 60, dominio, caminho) * 1000,
    tempoLimiteMs: numeroDoAmbiente("GOLD_TEMPO_LIMITE_MS", 10_000, dominio, caminho),
    cacheMaxBytes: numeroDoAmbiente("GOLD_CACHE_MAX_MB", 64, dominio, caminho) * 1024 * 1024,
  };
}

/** GET sem seguir redirecionamento, com limite de tempo e de tamanho. Rejeita em erro de rede; status é devolvido a quem chama. */
const transporteHttp: TransporteGold = (endereco, { token, tempoLimiteMs, maxBytes }) =>
  new Promise((resolver, rejeitar) => {
    const url = new URL(endereco);
    const pedir = url.protocol === "https:" ? pedirHttps : pedirHttp;
    const req = pedir(url, { method: "GET", headers: { accept: "*/*", "accept-encoding": "identity", ...(token ? { authorization: `Bearer ${token}` } : {}) } }, (res) => {
      const partes: Buffer[] = [];
      let total = 0;
      res.on("data", (parte: Buffer) => {
        total += parte.length;
        if (total > maxBytes) {
          req.destroy(new Error(`resposta maior que o limite de ${maxBytes} bytes`));
          return;
        }
        partes.push(parte);
      });
      res.on("error", rejeitar);
      res.on("end", () => {
        if (!res.complete) rejeitar(new Error("conexão encerrada antes do fim da resposta"));
        else resolver({ status: res.statusCode ?? 0, corpo: Buffer.concat(partes) });
      });
    });
    req.setTimeout(tempoLimiteMs, () => req.destroy(new Error(`sem resposta em ${tempoLimiteMs} ms`)));
    req.on("error", rejeitar);
    req.end();
  });

let transporte: TransporteGold = transporteHttp;

/**
 * Troca o transporte do modo externo e devolve o anterior. Existe para a adoção com credencial rotativa (por exemplo, o
 * SDK do armazenamento no lugar do GET com token fixo) e para testes de falha; limpa os caches.
 */
export function definirTransporteGold(novo: TransporteGold | null): TransporteGold {
  const anterior = transporte;
  transporte = novo ?? transporteHttp;
  limparCacheGold();
  return anterior;
}

type ManifestoIndexado = { manifesto: ManifestoGold; porCaminho: Map<string, ArquivoGold> };

const ponteiros = new Map<string, { ponteiro: PonteiroGold; lidoEm: number }>();
const manifestos = new Map<string, ManifestoIndexado>();
/** Objetos por sha256: o conteúdo de um hash nunca muda, então este cache não tem como ficar velho. */
const objetos = new Map<string, Buffer>();
let bytesEmCache = 0;
const emAndamento = new Map<string, Promise<unknown>>();

/** Esvazia os caches do modo externo (ponteiros, manifestos e objetos). */
export function limparCacheGold(): void {
  ponteiros.clear();
  manifestos.clear();
  objetos.clear();
  bytesEmCache = 0;
  emAndamento.clear();
}

/** Uma só requisição por chave ao mesmo tempo; a promessa sai do mapa ao terminar, com sucesso ou erro. */
function unica<T>(chave: string, fazer: () => Promise<T>): Promise<T> {
  const existente = emAndamento.get(chave) as Promise<T> | undefined;
  if (existente) return existente;
  const nova = fazer().finally(() => {
    if (emAndamento.get(chave) === nova) emAndamento.delete(chave);
  });
  emAndamento.set(chave, nova);
  return nova;
}

async function buscar(cfg: Configuracao, dominio: string, caminho: string, relativo: string, maxBytes: number, oQue: string): Promise<Buffer> {
  const url = `${cfg.base}/${dominio}/${relativo.split("/").map(encodeURIComponent).join("/")}`;
  let resposta: RespostaTransporte;
  try {
    resposta = await transporte(url, { token: cfg.token, tempoLimiteMs: cfg.tempoLimiteMs, maxBytes });
  } catch (e) {
    throw new ErroGold("rede", dominio, caminho, `falha ao buscar ${oQue} em ${url}: ${e instanceof Error ? e.message : String(e)}`, e);
  }
  if (resposta.status !== 200) throw new ErroGold("http", dominio, caminho, `${oQue} respondeu HTTP ${resposta.status} em ${url}`);
  return resposta.corpo;
}

function lerJson(bytes: Buffer): unknown {
  return JSON.parse(bytes.toString("utf-8"));
}

async function ponteiroCorrente(cfg: Configuracao, dominio: string, caminho: string): Promise<PonteiroGold> {
  const chave = `${cfg.base}|${dominio}`;
  const guardado = ponteiros.get(chave);
  if (guardado && Date.now() - guardado.lidoEm < cfg.ttlPonteiroMs) return guardado.ponteiro;
  // Vencido: sai do cache antes da nova leitura. Se a leitura falhar, o erro sobe; o ponteiro antigo não volta a valer.
  ponteiros.delete(chave);
  return unica(`ponteiro|${chave}`, async () => {
    const bytes = await buscar(cfg, dominio, caminho, CAMINHO_PONTEIRO, MAX_PONTEIRO, "o ponteiro da edição corrente");
    let ponteiro: PonteiroGold;
    try {
      ponteiro = validarPonteiro(lerJson(bytes), dominio);
    } catch (e) {
      throw new ErroGold("ponteiro_invalido", dominio, caminho, `ponteiro da edição corrente inválido: ${e instanceof Error ? e.message : String(e)}`, e);
    }
    ponteiros.set(chave, { ponteiro, lidoEm: Date.now() });
    return ponteiro;
  });
}

async function manifestoDaEdicao(cfg: Configuracao, dominio: string, caminho: string, ponteiro: PonteiroGold): Promise<ManifestoIndexado> {
  const chave = `${cfg.base}|${dominio}|${ponteiro.edicao}`;
  const guardado = manifestos.get(chave);
  if (guardado) return guardado;
  return unica(`manifesto|${chave}`, async () => {
    const bytes = await buscar(cfg, dominio, caminho, ponteiro.manifesto.caminho, MAX_MANIFESTO, `o manifesto da edição ${ponteiro.edicao.slice(0, 12)}`);
    const obtido = sha256Hex(bytes);
    if (bytes.length !== ponteiro.manifesto.bytes || obtido !== ponteiro.manifesto.sha256) {
      throw new ErroGold("manifesto_invalido", dominio, caminho, `manifesto da edição ${ponteiro.edicao.slice(0, 12)} não confere com o ponteiro (sha256 esperado ${ponteiro.manifesto.sha256}, obtido ${obtido})`);
    }
    let manifesto: ManifestoGold;
    try {
      manifesto = validarManifesto(lerJson(bytes), dominio);
    } catch (e) {
      throw new ErroGold("manifesto_invalido", dominio, caminho, `manifesto inválido: ${e instanceof Error ? e.message : String(e)}`, e);
    }
    if (manifesto.edicao !== ponteiro.edicao) {
      throw new ErroGold("manifesto_invalido", dominio, caminho, `manifesto é da edição ${manifesto.edicao.slice(0, 12)}, o ponteiro indica ${ponteiro.edicao.slice(0, 12)}`);
    }
    const indexado = { manifesto, porCaminho: new Map(manifesto.arquivos.map((a) => [a.caminho, a])) };
    manifestos.set(chave, indexado);
    return indexado;
  });
}

function guardarObjeto(sha256: string, bytes: Buffer, limite: number): void {
  if (bytes.length > limite || objetos.has(sha256)) return;
  // Map preserva a ordem de inserção: sai primeiro o que entrou há mais tempo.
  for (const [chave, antigo] of objetos) {
    if (bytesEmCache + bytes.length <= limite) break;
    objetos.delete(chave);
    bytesEmCache -= antigo.length;
  }
  objetos.set(sha256, bytes);
  bytesEmCache += bytes.length;
}

async function lerExterno(dominio: string, caminho: string): Promise<Buffer> {
  const cfg = configuracaoExterna(dominio, caminho);
  const ponteiro = await ponteiroCorrente(cfg, dominio, caminho);
  const { porCaminho } = await manifestoDaEdicao(cfg, dominio, caminho, ponteiro);
  const arquivo = porCaminho.get(caminho);
  if (!arquivo) {
    throw new ErroGold("fora_do_manifesto", dominio, caminho, `arquivo não consta do manifesto da edição corrente (${ponteiro.edicao.slice(0, 12)})`);
  }
  const guardado = objetos.get(arquivo.sha256);
  if (guardado) return Buffer.from(guardado);
  const bytes = await unica(`objeto|${cfg.base}|${dominio}|${arquivo.sha256}`, async () => {
    const recebido = await buscar(cfg, dominio, caminho, caminhoObjeto(arquivo), arquivo.bytes, "o arquivo");
    if (recebido.length !== arquivo.bytes) {
      throw new ErroGold("tamanho_divergente", dominio, caminho, `tamanho divergente: o manifesto registra ${arquivo.bytes} bytes, chegaram ${recebido.length}`);
    }
    const obtido = sha256Hex(recebido);
    if (obtido !== arquivo.sha256) {
      throw new ErroGold("hash_divergente", dominio, caminho, `sha256 divergente: o manifesto registra ${arquivo.sha256}, o conteúdo recebido tem ${obtido}`);
    }
    guardarObjeto(arquivo.sha256, recebido, cfg.cacheMaxBytes);
    return recebido;
  });
  // Cópia: quem chama pode alterar o que recebe sem estragar o cache nem a leitura concorrente.
  return Buffer.from(bytes);
}

async function lerRepositorio(dominio: string, caminho: string): Promise<Buffer> {
  try {
    return await readFile(join(process.cwd(), "public", dominio, ...caminho.split("/")));
  } catch (e) {
    const codigo = (e as NodeJS.ErrnoException)?.code;
    if (codigo === "ENOENT" || codigo === "ENOTDIR" || codigo === "EISDIR") {
      throw new ErroGold("ausente", dominio, caminho, `arquivo não existe em public/${dominio}/${caminho}`, e);
    }
    throw new ErroGold("ausente", dominio, caminho, `não foi possível ler public/${dominio}/${caminho}: ${e instanceof Error ? e.message : String(e)}`, e);
  }
}

/**
 * Bytes de um arquivo de gold. `dominio` é a pasta em public/ (ex.: "agro"); `caminho` é relativo a ela, com "/"
 * (ex.: "gold/snapshot.json"). Lança ErroGold em qualquer falha.
 */
export async function lerGold(dominio: string, caminho: string): Promise<Buffer> {
  if (!dominioValido(dominio)) throw new ErroGold("caminho_invalido", String(dominio), String(caminho), "domínio inválido");
  if (!caminhoValido(caminho)) throw new ErroGold("caminho_invalido", dominio, String(caminho), "caminho inválido (relativo à pasta do domínio, sem \"..\")");
  return origemGold() === "externo" ? lerExterno(dominio, caminho) : lerRepositorio(dominio, caminho);
}

/** O mesmo arquivo, interpretado como JSON em UTF-8. JSON malformado lança o erro do JSON.parse, sem valor substituto. */
export async function lerGoldJson<T = unknown>(dominio: string, caminho: string): Promise<T> {
  return JSON.parse((await lerGold(dominio, caminho)).toString("utf-8")) as T;
}

/**
 * Edição que o leitor serviria agora. No modo repositório não há edição: a versão é o commit do deploy, e a resposta é
 * null (ausência não vira identificador inventado).
 */
export async function edicaoCorrenteGold(dominio: string): Promise<{ origem: OrigemGold; edicao: string | null; publicado_em: string | null }> {
  if (!dominioValido(dominio)) throw new ErroGold("caminho_invalido", String(dominio), "-", "domínio inválido");
  if (origemGold() === "repositorio") return { origem: "repositorio", edicao: null, publicado_em: null };
  const ponteiro = await ponteiroCorrente(configuracaoExterna(dominio, "-"), dominio, "-");
  return { origem: "externo", edicao: ponteiro.edicao, publicado_em: ponteiro.publicado_em ?? null };
}
