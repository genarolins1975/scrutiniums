import type { Download, Periodo } from "@/lib/energia/tipos";
import { num, pct, reais, sinal } from "@/lib/energia/formato";

/**
 * Evidência "Comprove este número" (seção 11.5 da especificação): contrato do
 * objeto que o pipeline anexa às golds (pipeline/energia/evidencia.py monta e
 * valida o mesmo dicionário, com as chaves na mesma ordem) e a lógica pura que a
 * interface usa para exibi-lo.
 *
 * Por que um contrato próprio, separado da `Proveniencia`: a proveniência (drawer
 * "Sobre este dado") descreve uma SÉRIE inteira: fonte, frequência, cobertura
 * histórica, transformações. A evidência comprova UM número exibido (um KPI, uma
 * célula, um agregado de gráfico): o valor antes do arredondamento, o arquivo
 * exato e o seu sha256, as chaves das observações que entraram na conta, a fórmula
 * com numerador e denominador, os testes e a reconciliação, e como refazer a conta.
 *
 * A citação publicada pelo pipeline não tem data de acesso, porque a data é do
 * leitor: `citacaoAcademica` a acrescenta no momento da leitura (horário de
 * Brasília). `citacaoBase` e `textoPeriodo` seguem exatamente as funções
 * `citacao` e `texto_periodo` do Python; os dois lados têm teste com o mesmo
 * exemplo e o mesmo texto esperado, para que não divirjam em silêncio.
 */

/* ---------------------------------------------------------------- contrato */

export type ResultadoTeste = "aprovado" | "ressalva" | "reprovado";
export const RESULTADOS: readonly ResultadoTeste[] = ["aprovado", "ressalva", "reprovado"];

/** Um arquivo capturado: o sha256 prova a identidade do arquivo, não a acurácia do número. */
export type ArquivoEvidencia = {
  recurso: string | null;
  arquivo: string | null;
  sha256: string | null;
  capturado_em: string | null;
  /** Data de publicação pela fonte; null quando a fonte não informa (nunca inventada). */
  publicado_em: string | null;
};

export type FonteEvidencia = ArquivoEvidencia & {
  orgao: string;
  conjunto: string;
  url: string;
  /** Número que usa mais de um arquivo (anos diferentes, por exemplo). */
  arquivos?: ArquivoEvidencia[] | null;
};

/** Número extraído de PDF: documento, edição, página ou tabela e como a extração foi conferida. */
export type ExtracaoPdf = { documento: string; edicao: string; pagina: string; conferencia: string };

export type TermoRazao = { descricao: string; valor: number | null };

export type TesteEvidencia = { nome: string; resultado: ResultadoTeste; detalhe: string };

/** Conferência por outro caminho ou outro produto; tolerância é texto com unidade ("0,005 R$/MWh"). */
export type Reconciliacao = { descricao: string; resultado: ResultadoTeste; tolerancia: string };

export type VersaoEvidencia = {
  pipeline: string;
  /** Commit curto; sufixo "+alterado" quando o código tinha alteração fora do commit. */
  codigo: string | null;
  /** Carimbo UTC da publicação da gold. */
  publicacao: string;
};

export type Evidencia = {
  indicador: string;
  /** Texto exatamente como aparece na tela ("R$ 0,8123/kWh"); "sem dado" quando ausente. */
  valor_exibido: string;
  /** Valor antes do arredondamento; null é ausência (nunca zero). */
  valor_calculo: number | null;
  unidade: string;
  periodo: Periodo;
  entidade: string;
  universo: string;
  filtros: string[];
  fonte: FonteEvidencia;
  extracao_pdf?: ExtracaoPdf | null;
  /** Chaves das observações de origem (no máximo 50; acima disso, consulta e manifesto). */
  chaves_origem: string[];
  /** Contagem real quando a lista foi truncada. */
  chaves_total?: number | null;
  /** Consulta que seleciona as observações (alternativa ou complemento às chaves). */
  consulta?: string | null;
  /** Lista completa das chaves para baixar. */
  manifesto?: Download | null;
  formula: string;
  numerador?: TermoRazao | null;
  denominador?: TermoRazao | null;
  pesos?: string | null;
  exclusoes: string[];
  cobertura: string;
  tratamento_ausencia: string;
  versao: VersaoEvidencia;
  revisoes: string;
  testes: TesteEvidencia[];
  reconciliacao: Reconciliacao | null;
  download: Download[];
  /** Comando ou passos (uma linha por passo) que refazem o número. */
  reproducao: string;
  /** Citação sem data de acesso (a interface acrescenta). */
  citacao: string;
};

/** Nome com que o leitor reconhece alguns conjuntos cujo código é o nome técnico da fonte. */
const NOME_DO_CONJUNTO: Record<string, string> = {
  PLD_HORARIO: "PLD horário por submercado",
};

const CODIGO_DE_CONJUNTO = /^(?:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+|[a-z][a-z0-9]*(?:_[a-z0-9]+)+)$/;

/**
 * Nome do conjunto da fonte como o leitor o lê, mais os códigos técnicos que ficaram de fora. Códigos de conjunto da
 * CCEE (PLD_HORARIO, mre_mensal) saem do texto de Entender e vão para Analisar: o nome legível vem do dicionário acima,
 * do texto entre parênteses que a própria fonte já traz ("PLD_HORARIO (PLD horário por submercado)") ou, na falta de
 * ambos, do próprio código com espaços no lugar do sublinhado. Itens separados por ponto e vírgula são tratados um a um.
 */
export function conjuntoLegivel(conjunto: string): { texto: string; codigos: string[] } {
  const codigos: string[] = [];
  const itens = conjunto.split(/;\s*/).map((item) => {
    const m = /^([A-Za-z0-9_]+)\s*\((.+)\)$/.exec(item.trim());
    const cod = m ? m[1] : item.trim();
    if (!CODIGO_DE_CONJUNTO.test(cod)) return item.trim();
    codigos.push(cod);
    if (m) return m[2];
    return NOME_DO_CONJUNTO[cod] ?? cod.replace(/_/g, " ").toLowerCase();
  });
  return { texto: itens.join("; "), codigos };
}

export const SEM_DADO = "sem dado";
export const SITE = "https://scrutiniums.com/setor-eletrico";

/* ---------------------------------------------------------------- datas e números */

const MESES_ABNT = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

/** 'AAAA', 'AAAA-MM', 'AAAA-MM-DD' ou 'AAAA-MM-DDTHH:MM' → texto brasileiro, sem conversão
 * de fuso (datas de referência são locais). `hora` mantém a hora local (espelho de _data_br). */
export function dataRef(iso: string | null | undefined, hora = false): string | null {
  if (!iso) return null;
  const partes = iso.slice(0, 10).split("-");
  if (partes.length === 1) return partes[0];
  if (partes.length === 2) return `${partes[1]}/${partes[0]}`;
  const [a, m, d] = partes;
  let txt = `${d}/${m}/${a}`;
  if (hora && iso.length >= 16 && iso[10] === "T" && !iso.endsWith("Z")) txt += ` ${iso.slice(11, 16)}`;
  return txt;
}

/** Dia (AAAA-MM-DD) de um carimbo com fuso no horário de Brasília (UTC−3 fixo desde 2019,
 * sem horário de verão). Data sem hora passa igual; hora sem fuso é local. */
export function diaBrasilia(instante: string | null | undefined): string | null {
  if (!instante) return null;
  if (instante.length <= 10) return instante;
  const temFuso = instante.includes("T") && /(Z|[+-]\d\d:?\d\d)$/.test(instante);
  if (!temFuso) return instante.slice(0, 10);
  const t = Date.parse(instante);
  if (Number.isNaN(t)) return instante.slice(0, 10);
  return new Date(t - 3 * 3_600_000).toISOString().slice(0, 10);
}

/** Um só instante quando início e fim coincidem; hora local mantida quando o período é horário. */
export function textoPeriodo(p: Partial<Periodo> | null | undefined): string {
  const ini = dataRef(p?.inicio, true);
  const fim = dataRef(p?.fim, true);
  if (!ini && !fim) return "período não informado";
  if (ini === fim || !fim) return ini as string;
  if (!ini) return `até ${fim}`;
  return `${ini} a ${fim}`;
}

/** Data de acesso no formato ABNT ("30 set. 2026"), no dia de Brasília. */
export function dataAbnt(acesso: Date | string): string {
  const iso = typeof acesso === "string" ? acesso : acesso.toISOString();
  const dia = diaBrasilia(iso) ?? iso.slice(0, 10);
  const [a, m, d] = dia.split("-");
  return `${Number(d)} ${MESES_ABNT[Number(m) - 1]} ${a}`;
}

/**
 * Valor de cálculo com todos os algarismos que o número de ponto flutuante carrega
 * (a menor representação que volta ao mesmo valor), em pt-BR: vírgula decimal,
 * ponto de milhar e sinal de menos tipográfico. Nunca arredonda e nunca usa notação
 * científica: é a leitura "antes do arredondamento" da seção 11.5.
 */
export function numeroCompleto(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return SEM_DADO;
  let s = String(Math.abs(v));
  if (/e/i.test(s)) {
    const [mant, expTxt] = s.toLowerCase().split("e");
    const exp = Number(expTxt);
    const [int, frac = ""] = mant.split(".");
    const digitos = int + frac;
    const pos = int.length + exp;
    if (pos <= 0) s = `0.${"0".repeat(-pos)}${digitos}`;
    else if (pos >= digitos.length) s = digitos + "0".repeat(pos - digitos.length);
    else s = `${digitos.slice(0, pos)}.${digitos.slice(pos)}`;
  }
  const [inteira, fracao] = s.split(".");
  const agrupada = inteira.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${v < 0 ? "−" : ""}${agrupada}${fracao ? `,${fracao}` : ""}`;
}

/** Mesmo valor no formato de máquina (ponto decimal), como um programa o imprime. */
export function numeroMaquina(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return SEM_DADO;
  return numeroCompleto(v).replace(/−/, "-").replaceAll(".", "").replace(",", ".");
}

/* ---------------------------------------------------------------- citação */

const SO_NUMERO = /^[−+-]?[\d.,]+$/;

/** Número de um texto pt-BR com milhar em ponto e decimal em vírgula ("12,12%" vira 12.12); null se o texto não começa por número. */
function numeroDoTexto(s: string): { valor: number; casas: number; resto: string } | null {
  const m = /^(-?\d{1,3}(?:\.\d{3})*|-?\d+)(?:,(\d+))?/.exec(s.trim());
  if (!m) return null;
  return { valor: Number(m[1].replace(/\./g, "") + (m[2] ? `.${m[2]}` : "")), casas: m[2]?.length ?? 0, resto: s.trim().slice(m[0].length) };
}

/**
 * Ficha com o valor escrito como o cartão o exibe. O Comprove tem de mostrar o mesmo texto do número que
 * prova; quando a ficha foi publicada com menos casas que o cartão (12,1% na ficha, 12,12% no cartão), o
 * texto é reescrito, mas só se o novo for o arredondamento de `valor_calculo` e trouxer a mesma unidade
 * escrita: nunca inventa dígito. Qualquer dúvida devolve a ficha como veio.
 */
export function comValorExibido(ev: Evidencia, texto: string): Evidencia {
  const novo = numeroDoTexto(texto);
  const velho = numeroDoTexto(ev.valor_exibido);
  if (!novo || !velho || ev.valor_calculo === null || !Number.isFinite(ev.valor_calculo)) return ev;
  if (novo.resto.trim() !== velho.resto.trim()) return ev;
  if (Math.abs(novo.valor - ev.valor_calculo) > 0.5 * 10 ** -novo.casas + 1e-9) return ev;
  const citacao = ev.citacao?.includes(`: ${ev.valor_exibido},`) ? ev.citacao.replace(`: ${ev.valor_exibido},`, `: ${texto.trim()},`) : ev.citacao;
  return { ...ev, valor_exibido: texto.trim(), citacao };
}

/** Referência ABNT simplificada sem data de acesso: espelho de `citacao()` no Python. */
export function citacaoBase(ev: Evidencia, endereco: string = SITE): string {
  const pub = diaBrasilia(ev.versao?.publicacao);
  const ano = pub ? pub.slice(0, 4) : "s.d.";
  const cap = dataRef(diaBrasilia(ev.fonte?.capturado_em));
  const recurso = ev.fonte?.recurso ? `recurso ${ev.fonte.recurso}` : "recurso não identificado";
  const captura = cap ? `, capturado em ${cap}` : "";
  const codigo = ev.versao?.codigo ? `código ${ev.versao.codigo}` : "código não registrado";
  // a unidade entra só quando o texto exibido é um número puro ("123,46"); texto que
  // já traz unidade própria ("R$ 0,8123/kWh", "12,3%") fica como está na tela
  const valor = SO_NUMERO.test(ev.valor_exibido) && ev.unidade ? `${ev.valor_exibido} ${ev.unidade}` : ev.valor_exibido;
  return (
    `SCRUTINIUMS. ${ev.indicador}: ${valor}, ${ev.entidade}, ${textoPeriodo(ev.periodo)}. ` +
    `Observatório Brasileiro do Setor Elétrico, ${ano}. ` +
    `Dados primários: ${ev.fonte?.orgao}, ${ev.fonte?.conjunto} (${recurso}${captura}). ` +
    `Versão ${ev.versao?.pipeline}, ${codigo}, publicada em ${dataRef(pub) ?? "data não registrada"}. ` +
    `Disponível em: ${endereco}.`
  );
}

/**
 * Citação acadêmica completa (ABNT simplificada) com a data de acesso do leitor.
 * Sem `endereco`, usa a citação publicada pelo pipeline (ou a recalcula se vier
 * vazia); com `endereco` (a página e a âncora onde o número aparece), recalcula
 * a partir dos campos para apontar ao lugar exato.
 */
export function citacaoAcademica(ev: Evidencia, acesso: Date | string, endereco?: string): string {
  const publicada = ev.citacao?.trim();
  const base = endereco || !publicada ? citacaoBase(ev, endereco ?? SITE) : publicada;
  // uma citação publicada nunca deveria trazer acesso; se trouxer, vale o do leitor
  const semAcesso = base.replace(/\s*Acesso em:[\s\S]*$/, "");
  return `${semAcesso} Acesso em: ${dataAbnt(acesso)}.`;
}

/* ---------------------------------------------------------------- testes e chaves */

export const ROTULO_RESULTADO: Record<ResultadoTeste, { rotulo: string; glifo: string }> = {
  aprovado: { rotulo: "Aprovado", glifo: "✓" },
  ressalva: { rotulo: "Com ressalva", glifo: "!" },
  reprovado: { rotulo: "Reprovado", glifo: "✕" },
};

export function ehResultado(r: unknown): r is ResultadoTeste {
  return typeof r === "string" && (RESULTADOS as readonly string[]).includes(r);
}

/** Contagem por resultado e frase de resumo ("3 testes: 2 aprovados, 1 com ressalva, nenhum reprovado."). */
export function resumoTestes(testes: { resultado: string }[]): { aprovado: number; ressalva: number; reprovado: number; fora: number; texto: string } {
  const c = { aprovado: 0, ressalva: 0, reprovado: 0, fora: 0 };
  for (const t of testes) {
    if (ehResultado(t.resultado)) c[t.resultado] += 1;
    else c.fora += 1;
  }
  if (!testes.length) return { ...c, texto: "Nenhum teste registrado para este número." };
  const parte = (n: number, um: string, varios: string) => (n === 0 ? `nenhum ${um}` : `${n} ${n === 1 ? um : varios}`);
  const partes = [
    parte(c.aprovado, "aprovado", "aprovados"),
    parte(c.ressalva, "com ressalva", "com ressalva"),
    parte(c.reprovado, "reprovado", "reprovados"),
  ];
  if (c.fora) partes.push(`${c.fora} com resultado fora do padrão`);
  const total = testes.length === 1 ? "1 teste" : `${testes.length} testes`;
  return { ...c, texto: `${total}: ${partes.join(", ")}.` };
}

/** Como as observações de origem estão identificadas (lista, lista truncada com manifesto ou consulta). */
export function resumoChaves(ev: Pick<Evidencia, "chaves_origem" | "chaves_total" | "consulta" | "manifesto">): string {
  const n = ev.chaves_origem.length;
  const total = ev.chaves_total ?? n;
  const milhar = (x: number) => x.toLocaleString("pt-BR");
  if (n === 0 && ev.consulta) return "Observações selecionadas pela consulta abaixo; a lista não é publicada na interface.";
  if (n === 0) return "Nenhuma chave de origem registrada.";
  if (total > n) {
    const man = ev.manifesto ? " A lista completa está no manifesto para baixar." : " A lista completa não foi publicada.";
    return `Primeiras ${milhar(n)} de ${milhar(total)} chaves de origem.${man}`;
  }
  return n === 1 ? "1 chave de origem." : `${milhar(n)} chaves de origem.`;
}

/* ---------------------------------------------------------------- reprodução */

function recuo(texto: string, prefixo = "   "): string {
  return texto
    .split("\n")
    .map((l) => (l.trim() ? prefixo + l : l))
    .join("\n");
}

function linhasArquivo(a: ArquivoEvidencia): string[] {
  const out: string[] = [];
  const nome = a.arquivo ?? a.recurso;
  if (nome) out.push(`Arquivo: ${nome}${a.capturado_em ? ` (capturado em ${a.capturado_em})` : ""}`);
  if (a.publicado_em) out.push(`Publicado pela fonte em: ${a.publicado_em}`);
  if (a.sha256 && nome) out.push(`Integridade: sha256sum ${nome} deve resultar em ${a.sha256}`);
  else if (!a.sha256) out.push("Integridade: sha256 não registrado para este arquivo.");
  return out;
}

/**
 * Texto copiável que refaz o número, em passos numerados: versão do código,
 * arquivo e hash, execução, seleção das observações, fórmula e o valor esperado
 * antes do arredondamento (em formato de máquina, para comparar com a saída do
 * programa). `reproducao` de várias linhas entra como está, recuada.
 */
export function textoReproducao(ev: Evidencia): string {
  const l: string[] = [];
  l.push(`Reproduzir: ${ev.indicador}, ${ev.valor_exibido} (${textoPeriodo(ev.periodo)}).`);
  const pub = dataRef(diaBrasilia(ev.versao.publicacao));
  l.push(`Versão ${ev.versao.pipeline}, código ${ev.versao.codigo ?? "não registrado"}, publicada em ${pub ?? "data não registrada"}.`);
  l.push("");
  let n = 0;
  const passo = (titulo: string, corpo: string[] = []) => {
    n += 1;
    l.push(`${n}. ${titulo}`);
    for (const c of corpo) l.push(recuo(c));
  };

  const codigo = ev.versao.codigo;
  if (codigo) {
    const commit = codigo.replace(/\+alterado$/, "");
    const aviso = codigo.endsWith("+alterado")
      ? [`Atenção: a publicação saiu de código com alterações fora do commit ${commit}; o resultado pode diferir.`]
      : [];
    passo(`Obtenha o código na versão publicada: git checkout ${commit}`, aviso);
  } else {
    passo(`Código não registrado nesta publicação: use a versão ${ev.versao.pipeline} do pipeline.`);
  }

  const f = ev.fonte;
  const corpoFonte = [`Endereço: ${f.url}`];
  if (f.arquivos?.length) for (const a of f.arquivos) corpoFonte.push(...linhasArquivo(a));
  else corpoFonte.push(...linhasArquivo(f));
  if (ev.extracao_pdf) {
    const x = ev.extracao_pdf;
    corpoFonte.push(`PDF: ${x.documento}, edição ${x.edicao}, ${x.pagina}.`, `Conferência da extração: ${x.conferencia}`);
  }
  passo(`Obtenha o arquivo da fonte: ${f.orgao}, ${f.conjunto}.`, corpoFonte);

  passo("Execute:", [ev.reproducao.trim() || "rotina de reprodução não registrada"]);

  const obs: string[] = [];
  if (ev.consulta) obs.push(`Consulta: ${ev.consulta}`);
  if (ev.chaves_origem.length) obs.push(`Chaves: ${ev.chaves_origem.join("; ")}`);
  if ((ev.chaves_total ?? 0) > ev.chaves_origem.length) obs.push(`Lista truncada: ${ev.chaves_origem.length} de ${ev.chaves_total}.`);
  if (ev.manifesto) obs.push(`Manifesto completo: ${ev.manifesto.url}`);
  if (ev.filtros.length) obs.push(`Filtros: ${ev.filtros.join("; ")}`);
  if (ev.exclusoes.length) obs.push(`Exclusões: ${ev.exclusoes.join("; ")}`);
  passo("Selecione as observações de origem.", obs.length ? obs : ["nenhuma chave nem consulta registrada"]);

  const conta = [ev.formula];
  if (ev.numerador) conta.push(`Numerador: ${ev.numerador.descricao} = ${numeroMaquina(ev.numerador.valor)}`);
  if (ev.denominador) conta.push(`Denominador: ${ev.denominador.descricao} = ${numeroMaquina(ev.denominador.valor)}`);
  if (ev.pesos) conta.push(`Pesos: ${ev.pesos}`);
  passo("Aplique a fórmula:", conta);

  passo(
    ev.valor_calculo === null
      ? `Confira: não há valor para este recorte (${ev.tratamento_ausencia}); a tela mostra "${ev.valor_exibido}".`
      : `Confira: valor antes do arredondamento ${numeroMaquina(ev.valor_calculo)} ${ev.unidade}; exibido como ${ev.valor_exibido}.`,
  );
  return l.join("\n");
}

/* ---------------------------------------------------------------- conferência na interface */

const ALGARISMO = /\d/;
const SHA256 = /^[0-9a-f]{64}$/;
const texto = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/**
 * Problemas que impedem a evidência de comprovar o número. O pipeline já recusa
 * esses casos na geração (evidencia.py, `validar`); a interface confere de novo
 * um subconjunto e mostra o aviso em vez de exibir uma prova incompleta como se
 * fosse completa (gold antiga, montada à mão ou de módulo fora do construtor).
 */
export function problemasEvidencia(ev: Evidencia): string[] {
  const p: string[] = [];
  for (const campo of ["indicador", "valor_exibido", "unidade", "entidade", "universo", "formula", "cobertura", "tratamento_ausencia", "reproducao"] as const) {
    if (!texto(ev[campo])) p.push(`campo "${campo}" vazio`);
  }
  const v = ev.valor_calculo;
  const valido = v === null || (typeof v === "number" && Number.isFinite(v));
  if (!valido) p.push("valor de cálculo não é número finito nem ausência");
  const presente = valido && v !== null;
  if (v === null && ALGARISMO.test(ev.valor_exibido ?? "")) p.push("valor de cálculo ausente, mas a tela mostra um número");
  if (presente && !ALGARISMO.test(ev.valor_exibido ?? "")) p.push("valor de cálculo presente, mas a tela não mostra número");
  if (!texto(ev.periodo?.inicio) || !texto(ev.periodo?.fim)) p.push("período sem início ou fim");
  if (!texto(ev.fonte?.orgao) || !texto(ev.fonte?.url)) p.push("fonte sem órgão ou endereço");
  if (presente) {
    const arquivos = ev.fonte?.arquivos?.length ? ev.fonte.arquivos : [ev.fonte];
    if (arquivos.some((a) => !a?.sha256 || !SHA256.test(a.sha256))) p.push("arquivo da fonte sem sha256 válido");
    if (arquivos.some((a) => !a?.capturado_em)) p.push("arquivo da fonte sem instante de captura");
    if (!ev.chaves_origem?.length && !texto(ev.consulta)) p.push("sem chaves nem consulta das observações de origem");
    if (!ev.testes?.length) p.push("nenhum teste executado");
    if (!ev.download?.length) p.push("sem download dos dados");
  }
  if (!ev.numerador !== !ev.denominador) p.push("numerador sem denominador (ou o contrário)");
  for (const t of ev.testes ?? []) if (!ehResultado(t.resultado)) p.push(`teste "${t.nome}" com resultado fora de aprovado, ressalva, reprovado`);
  if (ev.reconciliacao) {
    if (!ehResultado(ev.reconciliacao.resultado)) p.push("reconciliação com resultado fora de aprovado, ressalva, reprovado");
    if (!texto(ev.reconciliacao.tolerancia)) p.push("reconciliação sem tolerância com unidade");
  }
  return p;
}

/* ---------------------------------------------------------------- número de destaque */

/** "variacao" e "variacao_pct": o próprio número de destaque é uma variação e leva sinal
 * explícito (+ ou −, tipográfico); zero depois de arredondar não leva sinal. */
export type FormatoNumero = "num" | "reais" | "pct" | "variacao" | "variacao_pct";

/** Valor grande do KPI; ausência vira "sem dado", nunca zero nem traço. */
export function valorDestaque(v: number | null | undefined, formato: FormatoNumero = "num", casas = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return SEM_DADO;
  if (formato === "reais") return reais(v, casas);
  if (formato === "pct") return pct(v, casas);
  if (formato === "variacao" || formato === "variacao_pct") {
    const arred = Number(v.toFixed(casas));
    const suf = formato === "variacao_pct" ? "%" : "";
    return arred === 0 ? `${num(0, casas)}${suf}` : sinal(arred, casas, suf);
  }
  return num(v, casas);
}

/** Unidade ao lado do número grande sem repetir o que o formato já escreve:
 * "R$/MWh" com formato reais vira "/MWh"; "%" com formato pct some; "% da energia injetada"
 * com formato pct vira "da energia injetada" (o número já termina em %). */
export function unidadeDestaque(unidade: string | null | undefined, formato: FormatoNumero = "num"): string {
  const u = (unidade ?? "").trim();
  if (formato === "reais") return u.replace(/^R\$\s*/, "");
  if (formato === "pct" || formato === "variacao_pct") return u.replace(/^%\s*/, "");
  return u;
}

export type Variacao = {
  valor: number | null;
  casas?: number;
  /** Colado ao número: "%", " p.p.", " R$/MWh". */
  sufixo?: string;
  /** "em relação ao dia anterior". */
  referencia: string;
};

/**
 * Variação com direção decidida sobre o valor JÁ arredondado: +0,04 com uma casa
 * é "estável 0,0", não "+0,0" com seta de alta. Glifo e palavra ao mesmo tempo
 * (a cor nunca é o único portador), sem juízo de bom ou ruim.
 */
export function descreverVariacao(v: Variacao): { direcao: "alta" | "queda" | "estavel" | null; glifo: string | null; texto: string; leitura: string } {
  const casas = v.casas ?? 1;
  const sufixo = v.sufixo ?? "";
  if (v.valor === null || !Number.isFinite(v.valor)) {
    return { direcao: null, glifo: null, texto: SEM_DADO, leitura: `Variação ${v.referencia}: sem dado.` };
  }
  const arred = Number(v.valor.toFixed(casas));
  if (arred === 0) {
    const t = `${num(0, casas)}${sufixo}`;
    return { direcao: "estavel", glifo: "=", texto: t, leitura: `Estável ${v.referencia} (${t}).` };
  }
  const t = sinal(arred, casas, sufixo);
  const alta = arred > 0;
  return {
    direcao: alta ? "alta" : "queda",
    glifo: alta ? "▲" : "▼",
    texto: t,
    leitura: `${alta ? "Alta" : "Queda"} de ${num(Math.abs(arred), casas)}${sufixo} ${v.referencia}.`,
  };
}

/* ---------------------------------------------------------------- cópia */

export type ResultadoCopia = "copiado" | "selecionado" | "falhou";

export type MeiosCopia = {
  /** navigator.clipboard (só existe em contexto seguro). */
  clipboard?: { writeText(t: string): Promise<void> } | null;
  /** Seleciona o texto do bloco na página; devolve se conseguiu. */
  selecionar?: () => boolean;
  /** document.execCommand("copy") sobre a seleção; devolve se copiou. */
  copiarSelecao?: () => boolean;
};

/**
 * Copia com três degraus: API da área de transferência; seleção do bloco com o
 * comando de cópia antigo; e, se nada copiar, deixa o texto selecionado para o
 * leitor usar Ctrl+C. Cada degrau falho segue para o próximo sem lançar erro.
 */
export async function copiarComFallback(textoCopiar: string, meios: MeiosCopia): Promise<ResultadoCopia> {
  if (meios.clipboard) {
    try {
      await meios.clipboard.writeText(textoCopiar);
      return "copiado";
    } catch {
      // permissão negada ou contexto inseguro: segue para a seleção
    }
  }
  let selecionou = false;
  try {
    selecionou = meios.selecionar?.() ?? false;
  } catch {
    selecionou = false;
  }
  if (selecionou) {
    try {
      if (meios.copiarSelecao?.()) return "copiado";
    } catch {
      // comando descontinuado ou bloqueado: o texto continua selecionado
    }
    return "selecionado";
  }
  return "falhou";
}

export const MENSAGEM_COPIA: Record<ResultadoCopia, string> = {
  copiado: "Copiado para a área de transferência.",
  selecionado: "Texto selecionado: use Ctrl+C (ou Copiar, no menu) para copiar.",
  falhou: "Não foi possível copiar: selecione o texto do bloco e copie.",
};
