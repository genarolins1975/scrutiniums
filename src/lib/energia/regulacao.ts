/**
 * Lógica pura das páginas da Regulação (P044 a P046), testável em node, sem React.
 *
 * As páginas só leem a gold (public/energia/gold/regulacao.json) e montam, a partir
 * dela, as linhas que o gráfico, a tabela equivalente e a exportação usam: a mesma
 * função alimenta os três, para que nunca mostrem números diferentes. As respostas
 * curtas de cada painel são frases montadas por regra a partir dos campos da gold;
 * nenhum número é escrito à mão no texto.
 *
 * Única regra reaplicada aqui: a situação das consultas (`situacaoConsulta`, de
 * tipos-regulacao.ts, cópia da regra do pipeline), recalculada na data em que a
 * página é lida, para que uma consulta vencida nunca continue aparecendo como aberta.
 * Valores monetários são os nominais escritos nos atos (R$/MWh); a interface não
 * calcula variação entre anos, porque comparar anos exige deflator.
 */
import { diaSerial, diferencaDatas, somarMeses, textoDuracao } from "@/lib/energia/calendario";
import { dataBR, num, reais } from "@/lib/energia/formato";
import { normalizarPeriodo, ordenarEventos, type BaseData, type EventoDatado } from "@/lib/energia/linha-do-tempo";
import type { ColunaTabela, LinhaTabela } from "@/lib/energia/tabela";
import {
  faseAtual,
  situacaoConsulta,
  type AtividadeAgenda,
  type AtoLimite,
  type CampoLimite,
  type Consulta,
  type Consultas,
  type DecisaoSemResultadoFormal,
  type EventoRegulatorio,
  type FormaResultado,
  type GoldRegulacao,
  type PainelLink,
  type Procedimento,
  type SituacaoConsulta,
  type VigenciaBandeira,
  type VigenciaLimites,
} from "@/lib/energia/tipos-regulacao";

/** Singular ou plural da palavra (o número fica no texto, ao lado). */
const pl = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/**
 * Texto copiado de uma fonte, com o travessão que ela usa como pontuação trocado por vírgula, para entrar em frase do observatório
 * ("Otimização – TEO" vira "Otimização, TEO"). O texto integral, sem mudança, continua em Analisar e no CSV.
 */
export function semTravessao(t: string): string {
  return t.replace(/\s+[–—]\s*|\s*[–—]\s+/g, ", ");
}

/* ---------------------------------------------------------------- painéis e rotas */

export type IdPainelRegulacao = "p044" | "p045" | "p046";

export const ROTA_REGULACAO = "/setor-eletrico/regulacao";

export type PainelRegulacao = { id: IdPainelRegulacao; codigo: string; rotulo: string; rota: string; pergunta: string };

/** Um painel por página: juntos, os três passariam da meta de cerca de 600 KB de HTML (contrato, seção 5.1). */
export const PAINEIS_REGULACAO: PainelRegulacao[] = [
  { id: "p044", codigo: "P044", rotulo: "Limites e regras de preço", rota: ROTA_REGULACAO, pergunta: "Que regra vale em cada período?" },
  { id: "p045", codigo: "P045", rotulo: "Linha do tempo", rota: `${ROTA_REGULACAO}/linha-do-tempo`, pergunta: "Que regras mudaram e quando passaram a valer?" },
  { id: "p046", codigo: "P046", rotulo: "Consultas e agenda", rota: `${ROTA_REGULACAO}/consultas-e-agenda`, pergunta: "Quais decisões da ANEEL estão abertas ou próximas?" },
];

export function painel(id: IdPainelRegulacao): PainelRegulacao {
  return PAINEIS_REGULACAO.find((p) => p.id === id) as PainelRegulacao;
}
export const rotaPainel = (id: IdPainelRegulacao) => painel(id).rota;
export const perguntaPainel = (id: IdPainelRegulacao) => painel(id).pergunta;

/** Próxima pergunta sugerida (seção 7.2, item 10): limites → linha do tempo → consultas → limites. */
export function proximoPainel(id: IdPainelRegulacao): PainelRegulacao {
  const i = PAINEIS_REGULACAO.findIndex((p) => p.id === id);
  return PAINEIS_REGULACAO[(i + 1) % PAINEIS_REGULACAO.length];
}

/**
 * Páginas oficiais de participação social da ANEEL. A primeira é a que o pipeline
 * captura a cada coleta (PAGINAS["consultas"] em pipeline/energia/modulos/regulacao.py);
 * a segunda é o link que essa mesma página publica para as audiências. As atas não
 * trazem o endereço de cada consulta e a lista antiga (antigo.aneel.gov.br) está
 * bloqueada, por isso o link é da página geral, nunca de uma consulta.
 */
export const PAGINAS_PARTICIPACAO = {
  consultas: "https://www.gov.br/aneel/pt-br/acesso-a-informacao/participacao-social/consultas-publicas",
  audiencias: "https://www.gov.br/aneel/pt-br/acesso-a-informacao/participacao-social/audiencias-publicas",
} as const;

/** Downloads de cada painel, na ordem da gold. */
export function downloadsDoPainel(g: Pick<GoldRegulacao, "downloads">, id: IdPainelRegulacao): { rotulo: string; url: string }[] {
  const re: Record<IdPainelRegulacao, RegExp> = {
    p044: /limites_pld|bandeiras|procedimentos/,
    p045: /linha_do_tempo|bandeiras/,
    p046: /consultas|agenda/,
  };
  return g.downloads.filter((d) => re[id].test(d.url));
}

/* ---------------------------------------------------------------- P044: limites do PLD */

export const CAMPOS_LIMITE: CampoLimite[] = ["pld_min", "pld_max_estrutural", "pld_max_horario"];

export const NOME_LIMITE: Record<CampoLimite, string> = {
  pld_min: "Piso (PLD mínimo)",
  pld_max_estrutural: "Teto estrutural",
  pld_max_horario: "Teto horário",
};

/** O que cada limite limita (REN nº 1.032/2022, arts. 22 a 24, lidos pelo pipeline). */
export const ALCANCE_LIMITE: Record<CampoLimite, string> = {
  pld_min: "menor valor do PLD em qualquer hora",
  pld_max_estrutural: "maior valor da média diária dos preços horários",
  pld_max_horario: "maior valor do PLD numa hora",
};

/** Nome com artigo, para frases ("o piso foi fixado ..."). */
export const ARTIGO_LIMITE: Record<CampoLimite, string> = {
  pld_min: "o piso",
  pld_max_estrutural: "o teto estrutural",
  pld_max_horario: "o teto horário",
};

/** Artigo que concorda com o tipo do ato: "a" (Resolução, Portaria, Lei...) ou "o" (Despacho, Decreto...). */
export function artigoAto(ato: string): "a" | "o" {
  return /^(Resolução|Retificação|Portaria|Lei|Medida|Nota|REH|REN|REA|RES)\b/i.test(ato) ? "a" : "o";
}

/** "pela Resolução ..." ou "pelo Despacho ...": concordância com o tipo do ato. */
export function porAto(ato: string): string {
  return artigoAto(ato) === "a" ? `pela ${ato}` : `pelo ${ato}`;
}

/**
 * Reunião da Diretoria como a ata a identifica ("41/2025 - RPO") escrita sem o hífen de
 * separação ("41/2025 (RPO)"): o identificador não muda, só a pontuação em volta da sigla.
 */
export function textoReuniao(r: string | null | undefined): string {
  if (!r) return "sem identificação na ata";
  return r.trim().replace(/^(\S+)\s+[-–—]\s+(\S+)$/, "$1 ($2)");
}

/** Uma cor por limite em toda a página (gráfico, comparação e faixa de métricas). Os dois tetos têm tons de famílias diferentes porque são objetos distintos. */
export const COR_LIMITE: Record<CampoLimite, string> = {
  pld_min: "var(--serie-referencia)",
  pld_max_estrutural: "var(--cor-energia)",
  pld_max_horario: "var(--serie-3)",
};

const ATO_CAMPO: Record<CampoLimite, "ato_pld_min" | "ato_pld_max_estrutural" | "ato_pld_max_horario"> = {
  pld_min: "ato_pld_min",
  pld_max_estrutural: "ato_pld_max_estrutural",
  pld_max_horario: "ato_pld_max_horario",
};

export function anosLimites(g: Pick<GoldRegulacao, "limites_pld">): number[] {
  return Array.from(new Set(g.limites_pld.vigencias.map((v) => v.ano))).sort((a, b) => a - b);
}

/** Trechos de vigência de um ano (um por ano hoje; mais de um se um ato mudar o limite no meio do ano). */
export function vigenciasDoAno(g: Pick<GoldRegulacao, "limites_pld">, ano: number): VigenciaLimites[] {
  return g.limites_pld.vigencias.filter((v) => v.ano === ano).sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/** Trecho de vigência que contém a data (AAAA-MM-DD); null fora da cobertura. */
export function vigenteEm(vigencias: readonly VigenciaLimites[], data: string): VigenciaLimites | null {
  return vigencias.find((v) => v.inicio <= data && data <= v.fim) ?? null;
}

export function atosDoAno(g: Pick<GoldRegulacao, "limites_pld">, ano: number): AtoLimite[] {
  return g.limites_pld.atos.filter((a) => a.ano === ano).sort((a, b) => (a.data_publicacao ?? a.vigencia_inicio).localeCompare(b.data_publicacao ?? b.vigencia_inicio));
}

function atoPorNome(g: Pick<GoldRegulacao, "limites_pld">, nome: string | null): AtoLimite | null {
  return nome ? (g.limites_pld.atos.find((a) => a.ato === nome) ?? null) : null;
}

/** "com publicação no DOU em 23/12/2025" ou a ausência declarada; nunca a data de captura. */
export function textoPublicacao(data: string | null): string {
  return data ? `com publicação no DOU em ${dataBR(data)}` : "sem data de publicação no DOU conferida";
}

/** O limite de um campo na data de referência: valor, ato que o fixou, publicação e vigência, cada um no seu campo. */
export type LimiteVigente = {
  campo: CampoLimite;
  valor: number | null;
  ato: string | null;
  /** Data no Diário Oficial; null quando não conferida (nunca a data de captura). */
  publicacao: string | null;
  inicio: string;
  fim: string;
};

/**
 * Os três limites na data de referência da gold, campo a campo (cada campo pode vir de um ato diferente, como em 2022).
 * Sem trecho de vigência que cubra a data, devolve os três campos vazios: nenhum valor de reserva.
 */
export function limitesVigentes(g: Pick<GoldRegulacao, "limites_pld" | "data_referencia">): { vigencia: { inicio: string; fim: string } | null; limites: LimiteVigente[] } {
  const v = vigenteEm(g.limites_pld.vigencias, g.data_referencia);
  if (!v) return { vigencia: null, limites: [] };
  return {
    vigencia: { inicio: v.inicio, fim: v.fim },
    limites: CAMPOS_LIMITE.map((campo) => {
      const ato = v[ATO_CAMPO[campo]];
      return { campo, valor: v[campo], ato, publicacao: atoPorNome(g, ato)?.data_publicacao ?? null, inicio: v.inicio, fim: v.fim };
    }),
  };
}

export type MarcoDoAto = { chave: "publicacao" | "inicio" | "fim"; rotulo: string; data: string | null; ausencia?: string };

/**
 * Os marcos de um ato de limites, em ordem de data: publicação no Diário Oficial, início da vigência e fim do intervalo registrado.
 * Publicação não conferida fica dita (sem data), nunca a data de captura. Publicação depois do início da vigência (vigência
 * retroativa, como na REH nº 3.167/2022) aparece na ordem cronológica real.
 */
export function marcosDoAto(a: Pick<AtoLimite, "data_publicacao" | "vigencia_inicio" | "vigencia_fim">): MarcoDoAto[] {
  const datados: MarcoDoAto[] = [
    { chave: "inicio", rotulo: "Início da vigência", data: a.vigencia_inicio },
    { chave: "fim", rotulo: "Fim do intervalo registrado", data: a.vigencia_fim },
  ];
  if (a.data_publicacao) {
    datados.push({ chave: "publicacao", rotulo: "Publicação no Diário Oficial", data: a.data_publicacao });
    const peso = { publicacao: 0, inicio: 1, fim: 2 } as const;
    return datados.sort((x, y) => (x.data as string).localeCompare(y.data as string) || peso[x.chave] - peso[y.chave]);
  }
  return [{ chave: "publicacao", rotulo: "Publicação no Diário Oficial", data: null, ausencia: "não conferida: o extrato do ato não está acessível" }, ...datados];
}

export type LinhaLimites = {
  id: string;
  ano: number;
  rotulo: string;
  inicio: string;
  fim: string;
  pld_min: number | null;
  pld_max_estrutural: number | null;
  pld_max_horario: number | null;
  ato_pld_min: string | null;
  publicacao_pld_min: string | null;
  ato_tetos: string | null;
  publicacao_tetos: string | null;
};

/**
 * Uma linha por trecho de vigência: alimenta o gráfico, a tabela de vigências e a
 * exportação (mesmas linhas, mesmos valores). Publicação e vigência ficam em colunas
 * distintas; o teto horário e o estrutural, também.
 */
export function linhasLimites(g: Pick<GoldRegulacao, "limites_pld">): LinhaLimites[] {
  return g.limites_pld.vigencias
    .slice()
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .map((v) => {
      const atoTetos = Array.from(new Set([v.ato_pld_max_estrutural, v.ato_pld_max_horario].filter((x): x is string => !!x)));
      const pubTetos = Array.from(new Set(atoTetos.map((a) => atoPorNome(g, a)?.data_publicacao ?? null)));
      const doAno = g.limites_pld.vigencias.filter((x) => x.ano === v.ano).length;
      return {
        id: doAno > 1 ? `${v.ano}:${v.inicio}` : String(v.ano),
        ano: v.ano,
        rotulo: doAno > 1 ? `${v.ano} (desde ${dataBR(v.inicio)})` : String(v.ano),
        inicio: v.inicio,
        fim: v.fim,
        pld_min: v.pld_min,
        pld_max_estrutural: v.pld_max_estrutural,
        pld_max_horario: v.pld_max_horario,
        ato_pld_min: v.ato_pld_min,
        publicacao_pld_min: atoPorNome(g, v.ato_pld_min)?.data_publicacao ?? null,
        ato_tetos: atoTetos.length ? atoTetos.join(" e ") : null,
        publicacao_tetos: pubTetos.length === 1 ? pubTetos[0] : null,
      };
    });
}

export const COLUNAS_LIMITES: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Ano", tipo: "texto" },
  { id: "pld_min", rotulo: "Piso", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "pld_max_estrutural", rotulo: "Teto estrutural (média diária)", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "pld_max_horario", rotulo: "Teto horário", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "inicio", rotulo: "Vigência: início", tipo: "data" },
  { id: "fim", rotulo: "Vigência: fim", tipo: "data" },
  { id: "ato_pld_min", rotulo: "Ato do piso", tipo: "texto" },
  { id: "publicacao_pld_min", rotulo: "Publicação no DOU (piso)", tipo: "data" },
  { id: "ato_tetos", rotulo: "Ato dos tetos", tipo: "texto" },
  { id: "publicacao_tetos", rotulo: "Publicação no DOU (tetos)", tipo: "data" },
];

export const SERIES_LIMITES = CAMPOS_LIMITE.map((c) => ({ id: c, rotulo: NOME_LIMITE[c], cor: COR_LIMITE[c] }));

/**
 * Resposta curta do P044 para um ano: os três limites, o ato de cada um, a publicação
 * no DOU e a vigência, sempre como campos distintos. Campo sem ato fica dito como tal.
 */
export function respostaLimites(g: Pick<GoldRegulacao, "limites_pld">, ano: number): string {
  const vs = vigenciasDoAno(g, ano);
  if (!vs.length) return `Não há ato de limites do PLD integrado para ${ano}: os limites desse ano ficam sem valor.`;
  const v = vs[vs.length - 1];
  const val = (c: CampoLimite) => (v[c] === null ? "sem valor (nenhum ato em vigor fixa este limite)" : `${reais(v[c], 2)}/MWh`);
  const frase1 =
    `Em ${ano}, o PLD não pode ficar abaixo de ${val("pld_min")} em nenhuma hora (piso) nem passar de ${val("pld_max_horario")} numa hora (teto horário); ` +
    `a média diária dos preços horários fica limitada a ${val("pld_max_estrutural")} (teto estrutural).`;
  const frase2 = textoAtosDoAno(g, ano);
  return frase2 ? `${frase1} ${frase2}` : frase1;
}

/**
 * Que ato fixou cada limite de um ano, com a publicação no DOU de cada um e a vigência, sempre em campos ditos separadamente:
 * "Os três limites foram fixados pelo Despacho ANEEL nº 3.850/2025, com publicação no DOU em 23/12/2025; vigência de 01/01/2026 a
 * 31/12/2026." Vazio quando nenhum ato fixa limite no ano.
 */
export function textoAtosDoAno(g: Pick<GoldRegulacao, "limites_pld">, ano: number): string {
  const vs = vigenciasDoAno(g, ano);
  if (!vs.length) return "";
  const v = vs[vs.length - 1];
  const campoPorAto = new Map<string, CampoLimite[]>();
  for (const c of CAMPOS_LIMITE) {
    const a = v[ATO_CAMPO[c]];
    if (a) campoPorAto.set(a, [...(campoPorAto.get(a) ?? []), c]);
  }
  const atos = Array.from(campoPorAto.entries()).map(([nome, campos], i) => {
    const a = atoPorNome(g, nome);
    const quais = campos.length === 3 ? "os três limites" : campos.map((c) => ARTIGO_LIMITE[c]).join(" e ");
    const texto = `${quais} ${campos.length > 1 ? "foram fixados" : "foi fixado"} ${porAto(nome)}, ${textoPublicacao(a?.data_publicacao ?? null)}`;
    return i === 0 ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
  });
  const vig = vs.length > 1 ? vs.map((x) => `de ${dataBR(x.inicio)} a ${dataBR(x.fim)}`).join(" e ") : `de ${dataBR(v.inicio)} a ${dataBR(v.fim)}`;
  return atos.length ? `${atos.join("; ")}; vigência ${vig}.` : "";
}

/**
 * Resposta curta do P044 na data de referência da gold: os limites vigentes, o ato que
 * os fixou (publicação e vigência separadas), a cobertura da série e as atividades da
 * Agenda Regulatória que podem mudar os limites.
 */
export function respostaP044(g: Pick<GoldRegulacao, "limites_pld" | "data_referencia" | "limites_em_revisao">): string {
  const v = vigenteEm(g.limites_pld.vigencias, g.data_referencia);
  const anos = anosLimites(g);
  const cobertura = anos.length ? ` A série integrada cobre ${anos[0]} a ${anos[anos.length - 1]}, com ${g.limites_pld.atos.length} atos lidos.` : "";
  const rev = g.limites_em_revisao.length
    ? ` ${g.limites_em_revisao.length} ${pl(g.limites_em_revisao.length, "atividade", "atividades")} da Agenda Regulatória ${pl(g.limites_em_revisao.length, "revisa", "revisam")} a metodologia dos limites (${g.limites_em_revisao.map((a) => `${a.codigo}, prevista para ${a.ano_previsto}`).join("; ")}).`
    : "";
  if (!v) return `Em ${dataBR(g.data_referencia)} não há ato de limites do PLD integrado em vigor: os limites ficam sem valor nesta data.${cobertura}${rev}`;
  return `Em ${dataBR(g.data_referencia)}, ${respostaLimites(g, v.ano).replace(/^Em \d{4}, /, "")}${cobertura}${rev}`;
}

/** "O que mudou": o ato mais recente e os valores do ano anterior ao lado dos atuais, sem conta. */
export function oQueMudouLimites(g: Pick<GoldRegulacao, "limites_pld">): string {
  const atos = g.limites_pld.atos.slice().sort((a, b) => (b.data_publicacao ?? b.vigencia_inicio).localeCompare(a.data_publicacao ?? a.vigencia_inicio));
  const ultimo = atos[0];
  const ls = linhasLimites(g);
  const atual = ls[ls.length - 1];
  const anterior = ls[ls.length - 2];
  if (!ultimo || !atual) return "Nenhum ato de limites integrado.";
  const fmt = (x: number | null) => (x === null ? "sem valor" : reais(x, 2));
  const comp = anterior
    ? ` Em ${anterior.rotulo}, piso, teto estrutural e teto horário eram ${fmt(anterior.pld_min)}, ${fmt(anterior.pld_max_estrutural)} e ${fmt(anterior.pld_max_horario)}/MWh; em ${atual.rotulo}, ${fmt(atual.pld_min)}, ${fmt(atual.pld_max_estrutural)} e ${fmt(atual.pld_max_horario)}/MWh (nominais).`
    : "";
  return `O ato mais recente é ${artigoAto(ultimo.ato)} ${ultimo.ato}, ${textoPublicacao(ultimo.data_publicacao)}, para a vigência de ${dataBR(ultimo.vigencia_inicio)} a ${dataBR(ultimo.vigencia_fim)}.${comp}`;
}

/**
 * Aviso do modo Auditar sobre a conferência pelo IPCA: a tolerância e o ato da regra
 * vêm da gold (conferencias_detalhe e regras_limites), nunca escritos à mão. Null
 * quando a gold não traz nenhuma das duas conferências.
 */
export function avisoToleranciaIpca(g: Pick<GoldRegulacao, "limites_pld" | "regras_limites">): string | null {
  const det = g.limites_pld.conferencias_detalhe;
  const tol = Array.from(new Set(det.filter((c) => c.conferencia === "regra_ipca" && c.tolerancia).map((c) => c.tolerancia)));
  const literal = det.some((c) => c.conferencia === "art23_literal");
  const partes: string[] = [];
  if (tol.length) partes.push(`A conferência pelo IPCA aceita diferença de até ${tol.join(" ou ")} entre o teto publicado e o teto refeito.`);
  if (literal)
    partes.push(
      `A aplicação literal do art. 23, § 1º${g.regras_limites ? `, da ${abreviarAto(g.regras_limites.ato)}` : ""}, aparece só como conferência informativa, porque não reproduz os valores publicados.`,
    );
  return partes.length ? partes.join(" ") : null;
}

/** Linhas da tabela completa dos atos (modo Auditar). */
export function linhasAtos(g: Pick<GoldRegulacao, "limites_pld">): LinhaTabela[] {
  return g.limites_pld.atos.map((a) => ({
    id: a.ato,
    ano: String(a.ano),
    ato: a.ato,
    data_do_ato: a.data_do_ato,
    data_publicacao: a.data_publicacao,
    vigencia_inicio: a.vigencia_inicio,
    vigencia_fim: a.vigencia_fim,
    pld_min: a.pld_min,
    pld_max_estrutural: a.pld_max_estrutural,
    pld_max_horario: a.pld_max_horario,
    dispositivo: a.dispositivo,
    nivel: a.nivel_conferencia === "texto_do_ato" ? "texto do ato" : a.nivel_conferencia === "documento_oficial_do_processo" ? "documento oficial do processo" : null,
    documento: a.documento_titulo ?? a.documento,
    pagina: a.pagina,
    trecho_confere: a.trecho_confere === null ? null : a.trecho_confere ? "sim" : "não",
    sha256: a.sha256,
  }));
}

export const COLUNAS_ATOS: ColunaTabela[] = [
  { id: "ano", rotulo: "Ano", tipo: "texto", categorica: true },
  { id: "ato", rotulo: "Ato", tipo: "texto" },
  { id: "data_do_ato", rotulo: "Data do ato", tipo: "data" },
  { id: "data_publicacao", rotulo: "Publicação no DOU", tipo: "data" },
  { id: "vigencia_inicio", rotulo: "Vigência: início", tipo: "data" },
  { id: "vigencia_fim", rotulo: "Vigência: fim", tipo: "data" },
  { id: "pld_min", rotulo: "Piso", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "pld_max_estrutural", rotulo: "Teto estrutural", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "pld_max_horario", rotulo: "Teto horário", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "dispositivo", rotulo: "Dispositivo", tipo: "texto" },
  { id: "nivel", rotulo: "Onde o valor foi lido", tipo: "texto", categorica: true },
  { id: "documento", rotulo: "Documento", tipo: "texto" },
  { id: "pagina", rotulo: "Página do PDF", tipo: "numero", casas: 0 },
  { id: "trecho_confere", rotulo: "Trecho encontrado no PDF", tipo: "texto", categorica: true },
  { id: "sha256", rotulo: "sha256 do PDF", tipo: "texto" },
];

export const ROTULO_CONFERENCIA: Record<string, string> = {
  trecho_no_pdf: "Trecho literal no PDF",
  publicacao_no_extrato: "Data do DOU no extrato",
  deliberacao_na_ata: "Deliberação na ata da Diretoria",
  valor_na_ata: "Valor escrito na ata",
  piso_teo: "Piso igual ao maior entre TEO e TEO de Itaipu",
  regra_ipca: "Teto do ano anterior encadeado pelo IPCA de novembro",
  art23_literal: "Aplicação literal do art. 23, § 1º (informativa)",
};

export const ROTULO_RESULTADO_CONFERENCIA: Record<string, string> = {
  aprovado: "aprovado",
  ressalva: "ressalva",
  reprovado: "reprovado",
  nao_executada: "não executada",
};

/** Contagem das conferências por tipo, na ordem de ROTULO_CONFERENCIA (linhas da tabela do modo Auditar). */
export function linhasContagemConferencias(g: Pick<GoldRegulacao, "limites_pld">): LinhaTabela[] {
  return Object.keys(ROTULO_CONFERENCIA)
    .filter((k) => g.limites_pld.conferencias[k as keyof typeof g.limites_pld.conferencias])
    .map((k) => {
      const c = g.limites_pld.conferencias[k as keyof typeof g.limites_pld.conferencias]!;
      return { id: k, conferencia: ROTULO_CONFERENCIA[k], aprovado: c.aprovado, ressalva: c.ressalva, reprovado: c.reprovado, nao_executada: c.nao_executada };
    });
}

export const COLUNAS_CONTAGEM_CONFERENCIAS: ColunaTabela[] = [
  { id: "conferencia", rotulo: "Conferência", tipo: "texto" },
  { id: "aprovado", rotulo: "Aprovadas", tipo: "numero", casas: 0 },
  { id: "ressalva", rotulo: "Com ressalva", tipo: "numero", casas: 0 },
  { id: "reprovado", rotulo: "Reprovadas", tipo: "numero", casas: 0 },
  { id: "nao_executada", rotulo: "Não executadas", tipo: "numero", casas: 0 },
];

export function linhasConferenciasDetalhe(g: Pick<GoldRegulacao, "limites_pld">): LinhaTabela[] {
  return g.limites_pld.conferencias_detalhe.map((c, i) => ({
    id: `${c.conferencia}:${c.ano}:${c.campo}:${i}`,
    conferencia: ROTULO_CONFERENCIA[c.conferencia] ?? c.conferencia,
    ano: c.ano === null ? null : String(c.ano),
    ato: c.ato,
    campo: NOME_LIMITE[c.campo as CampoLimite] ?? c.campo,
    valor_ato: c.valor_ato,
    valor_esperado: c.valor_esperado,
    diferenca: c.diferenca,
    tolerancia: c.tolerancia,
    resultado: ROTULO_RESULTADO_CONFERENCIA[c.resultado] ?? c.resultado,
    detalhe: c.detalhe,
  }));
}

export const COLUNAS_CONFERENCIAS_DETALHE: ColunaTabela[] = [
  { id: "conferencia", rotulo: "Conferência", tipo: "texto", categorica: true },
  { id: "ano", rotulo: "Ano", tipo: "texto", categorica: true },
  { id: "ato", rotulo: "Ato", tipo: "texto" },
  { id: "campo", rotulo: "Campo", tipo: "texto", categorica: true },
  { id: "valor_ato", rotulo: "Valor no ato", tipo: "numero", unidade: "R$/MWh", casas: 4 },
  { id: "valor_esperado", rotulo: "Valor esperado", tipo: "numero", unidade: "R$/MWh", casas: 4 },
  { id: "diferenca", rotulo: "Diferença (ato menos esperado)", tipo: "numero", unidade: "R$/MWh", casas: 4 },
  { id: "tolerancia", rotulo: "Tolerância", tipo: "texto" },
  { id: "resultado", rotulo: "Resultado", tipo: "texto", categorica: true },
  { id: "detalhe", rotulo: "Detalhe", tipo: "texto" },
];

/**
 * Pares publicado × esperado do encadeamento anual pelo IPCA (gráfico de pontos do modo Auditar). Quando um ano tem mais de um ato
 * que fixa o mesmo teto (2023: a REH nº 3.167/2022 e a retificação dela), cada par leva o ato no identificador e no rótulo, para o
 * gráfico não repetir a mesma chave nem o mesmo rótulo; os valores são os da conferência, sem mudança.
 */
export function paresRegraIpca(g: Pick<GoldRegulacao, "limites_pld">): { id: string; rotulo: string; valor: number | null; referencia: number | null; detalhe: string }[] {
  const conferencias = g.limites_pld.conferencias_detalhe.filter((c) => c.conferencia === "regra_ipca");
  const vezes = new Map<string, number>();
  for (const c of conferencias) vezes.set(`${c.ano}:${c.campo}`, (vezes.get(`${c.ano}:${c.campo}`) ?? 0) + 1);
  return conferencias.map((c) => {
    const chave = `${c.ano}:${c.campo}`;
    const repetido = (vezes.get(chave) ?? 0) > 1;
    const ato = c.ato ? abreviarAto(c.ato) : "ato não identificado";
    const nome = `${c.ano}, ${ARTIGO_LIMITE[c.campo as CampoLimite]?.replace(/^o /, "") ?? c.campo}`;
    return {
      id: repetido ? `${chave}:${c.ato ?? "sem-ato"}` : chave,
      rotulo: repetido ? `${nome} (${ato})` : nome,
      valor: c.valor_ato,
      referencia: c.valor_esperado,
      detalhe: `${c.ato ?? "ato não identificado"}; tolerância ${c.tolerancia}; ${ROTULO_RESULTADO_CONFERENCIA[c.resultado] ?? c.resultado}`,
    };
  });
}

/* ---------------------------------------------------------------- P044: bandeiras */

export const ROTULO_ORIGEM_FIM: Record<string, string> = {
  valor_seguinte: "véspera do valor seguinte do mesmo patamar",
  ultimo_acionamento: "último mês com acionamento (patamar extinto)",
  acionamento_diverge: "último mês coerente antes de valor diferente no recurso Acionamento",
};

/** Fim da vigência de um adicional em texto, na precisão da fonte (dia, mês ou sem fim). */
export function textoFimBandeira(v: Pick<VigenciaBandeira, "vigencia_fim" | "vigencia_fim_mes" | "vigencia_fim_grao">): string {
  if (v.vigencia_fim_grao === "dia" && v.vigencia_fim) return dataBR(v.vigencia_fim);
  if (v.vigencia_fim_grao === "mes" && v.vigencia_fim_mes) return `${dataBR(v.vigencia_fim_mes)} (só o mês é conhecido)`;
  return "sem fim (vigente ou sem valor posterior na fonte)";
}

/** Contagem da conferência mês a mês dos adicionais com o recurso Acionamento, com a concordância de cada parte. */
export function textoConferenciaAcionamento(c: GoldRegulacao["bandeiras"]["conferencia_acionamento"]): string {
  return (
    `${c.meses_conferidos} ${pl(c.meses_conferidos, "mês acionado conferido", "meses acionados conferidos")}: ` +
    `${c.meses_coerentes} ${pl(c.meses_coerentes, "coerente", "coerentes")}, ${c.meses_divergentes} com outro valor, ` +
    `${c.meses_parciais} ${pl(c.meses_parciais, "parcial", "parciais")} e ${c.meses_sem_vigencia} sem resolução no recurso de adicionais.`
  );
}

/** Uma linha por (ato, patamar), ordenada por patamar e início: gráfico de barras, tabela e exportação. */
export function linhasBandeiras(g: Pick<GoldRegulacao, "bandeiras">): LinhaTabela[] {
  const ordem = ["Amarela", "Vermelha P1", "Vermelha P2", "Escassez Hídrica"];
  const pos = (p: string) => (ordem.includes(p) ? ordem.indexOf(p) : ordem.length);
  return g.bandeiras.vigencias
    .slice()
    .sort((a, b) => pos(a.patamar) - pos(b.patamar) || a.vigencia_inicio.localeCompare(b.vigencia_inicio))
    .map((v) => ({
      id: `${v.patamar}:${v.vigencia_inicio}`,
      // rótulo curto para a coluna do gráfico (o ato e a vigência completa estão nas colunas da tabela)
      rotulo: `${v.patamar}, desde ${dataBR(v.vigencia_inicio)}`,
      patamar: v.patamar,
      ato: v.ato,
      rs_mwh: v.rs_mwh,
      vigencia_inicio: v.vigencia_inicio,
      vigencia_fim: textoFimBandeira(v),
      origem_fim: v.vigencia_fim_origem ? (ROTULO_ORIGEM_FIM[v.vigencia_fim_origem] ?? v.vigencia_fim_origem) : "sem fim (nenhum valor posterior na fonte)",
      fim_pelo_adicional: v.fim_pelo_recurso_adicional && v.vigencia_fim_origem === "acionamento_diverge" ? v.fim_pelo_recurso_adicional : null,
      meses_conferidos: v.conferencia_acionamento?.meses_conferidos ?? null,
      meses_divergentes: v.conferencia_acionamento?.meses_divergentes.length ? v.conferencia_acionamento.meses_divergentes.map((m) => `${dataBR(m.competencia)}: ${m.rs_mwh === null ? "sem valor" : `${reais(m.rs_mwh)}/MWh`}`).join("; ") : null,
    }));
}

export const COLUNAS_BANDEIRAS: ColunaTabela[] = [
  { id: "patamar", rotulo: "Patamar", tipo: "texto", categorica: true },
  { id: "ato", rotulo: "Resolução", tipo: "texto" },
  { id: "rs_mwh", rotulo: "Adicional", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "vigencia_inicio", rotulo: "Vigência: início", tipo: "data" },
  { id: "vigencia_fim", rotulo: "Vigência: fim", tipo: "texto" },
  { id: "origem_fim", rotulo: "Como o fim foi determinado", tipo: "texto", categorica: true },
  { id: "fim_pelo_adicional", rotulo: "Fim que o recurso Adicional sozinho daria", tipo: "data" },
  { id: "meses_conferidos", rotulo: "Meses acionados conferidos", tipo: "numero", casas: 0 },
  { id: "meses_divergentes", rotulo: "Meses com outro valor no Acionamento", tipo: "texto" },
];

/* ---------------------------------------------------------------- P044: procedimentos */

export const ROTULO_CONF_PROCEDIMENTO: Record<string, string> = {
  confirmada_por_ato_integrado: "Confirmada por ato integrado",
  sem_conferencia_externa: "Sem conferência externa",
  pagina_possivelmente_desatualizada: "Página possivelmente desatualizada",
};

export const ROTULO_CONF_VERSAO: Record<string, string> = {
  confere: "versão confere com o ato",
  diverge: "versão da página diverge do ato",
  ato_lido_nao_cita_o_item: "ato lido não cita o item",
};

export function linhasProcedimentos(itens: readonly Procedimento[]): LinhaTabela[] {
  return itens.map((p) => ({
    id: `${p.conjunto}:${p.modulo}`,
    conjunto: p.conjunto,
    modulo: p.modulo,
    titulo: p.titulo,
    versao_na_pagina: p.versao_na_pagina,
    ato_na_pagina: p.ato_na_pagina,
    data_ato_na_pagina: p.data_ato_na_pagina,
    conferencia: ROTULO_CONF_PROCEDIMENTO[p.conferencia] ?? p.conferencia,
    ato_vigente: p.ato_vigente,
    conferencia_versao: p.conferencia_versao ? (ROTULO_CONF_VERSAO[p.conferencia_versao] ?? p.conferencia_versao) : "ato não escreve a versão ou não foi lido",
    versao_no_ato: p.versao_no_ato,
    atos_posteriores: p.atos_posteriores.length
      ? Array.from(new Set(p.atos_posteriores.map((a) => `${a.ato ?? `${a.ato_na_fonte ?? "ato"} (número suspeito, não exibido como ato)`} em ${dataBR(a.data)}`))).join("; ")
      : null,
    ressalvas: p.ressalvas.length ? p.ressalvas.join(" ") : null,
    observacao: p.observacao,
  }));
}

export const COLUNAS_PROCEDIMENTOS: ColunaTabela[] = [
  { id: "conjunto", rotulo: "Conjunto", tipo: "texto", categorica: true },
  { id: "modulo", rotulo: "Módulo", tipo: "texto" },
  { id: "titulo", rotulo: "Título", tipo: "texto" },
  { id: "versao_na_pagina", rotulo: "Versão na página oficial", tipo: "texto" },
  { id: "ato_na_pagina", rotulo: "Ato na página oficial", tipo: "texto" },
  { id: "data_ato_na_pagina", rotulo: "Data do ato da página", tipo: "data" },
  { id: "conferencia", rotulo: "Conferência", tipo: "texto", categorica: true },
  { id: "ato_vigente", rotulo: "Ato vigente confirmado", tipo: "texto" },
  { id: "conferencia_versao", rotulo: "Versão contra o ato", tipo: "texto", categorica: true },
  { id: "versao_no_ato", rotulo: "Versão escrita no ato", tipo: "texto" },
  { id: "atos_posteriores", rotulo: "Atos posteriores sobre o módulo", tipo: "texto" },
  { id: "ressalvas", rotulo: "Ressalvas", tipo: "texto" },
  { id: "observacao", rotulo: "Observação da página", tipo: "texto" },
];

/** Contagem por conjunto e conferência (barras empilhadas: as três partes somam o total do conjunto). */
export function contagemProcedimentos(itens: readonly Procedimento[]): LinhaTabela[] {
  const conjuntos = Array.from(new Set(itens.map((p) => p.conjunto)));
  return conjuntos.map((c) => {
    const doConj = itens.filter((p) => p.conjunto === c);
    const n = (k: string) => doConj.filter((p) => p.conferencia === k).length;
    return {
      id: c,
      conjunto: c,
      confirmada_por_ato_integrado: n("confirmada_por_ato_integrado"),
      sem_conferencia_externa: n("sem_conferencia_externa"),
      pagina_possivelmente_desatualizada: n("pagina_possivelmente_desatualizada"),
      total: doConj.length,
    };
  });
}

export const SERIES_PROCEDIMENTOS = [
  { id: "confirmada_por_ato_integrado", rotulo: ROTULO_CONF_PROCEDIMENTO.confirmada_por_ato_integrado, cor: "var(--cor-energia)" },
  { id: "sem_conferencia_externa", rotulo: ROTULO_CONF_PROCEDIMENTO.sem_conferencia_externa, cor: "var(--serie-referencia)" },
  { id: "pagina_possivelmente_desatualizada", rotulo: ROTULO_CONF_PROCEDIMENTO.pagina_possivelmente_desatualizada, cor: "var(--cor-erro)" },
];

export function respostaProcedimentos(p: GoldRegulacao["procedimentos"]): string {
  const c = p.contagem_conferencia;
  const v = p.contagem_versao;
  const total = p.itens.length;
  const desat = p.itens.filter((i) => i.conferencia === "pagina_possivelmente_desatualizada").map((i) => `${i.conjunto} ${i.modulo}`);
  return (
    `Das ${total} versões que as páginas oficiais do PRODIST e do PRORET publicam como vigentes, ${c.confirmada_por_ato_integrado} foram confirmadas por ato lido ou deliberado, ` +
    `${c.sem_conferencia_externa} não têm ato integrado que permita conferir e ${c.pagina_possivelmente_desatualizada} têm ato posterior que aprova nova versão` +
    (desat.length ? ` (${desat.join(", ")}): nesses, a versão vigente não é conhecida` : "") +
    `. Onde o próprio ato escreve a versão, ${v.confere} conferem e ${v.diverge} divergem da página.`
  );
}

/* ---------------------------------------------------------------- P045: linha do tempo */

export type OrigemEvento = "ato" | "registro";

export const ROTULO_ORIGEM_EVENTO: Record<OrigemEvento, string> = {
  ato: "Atos e leis lidos no texto",
  registro: "Registros do conjunto de dados de bandeiras",
};

export const ROTULO_NIVEL_EVENTO: Record<string, string> = {
  texto_do_ato: "lido no texto do ato",
  documento_oficial_do_processo: "lido em documento oficial do processo",
  documento_oficial_que_cita_o_ato: "citado por documento oficial (texto do ato não lido)",
  ata_da_diretoria: "lido na ata da Diretoria",
  registro_em_conjunto_de_dados_oficial: "registro em conjunto de dados oficial (ato não lido)",
};

export const origemEvento = (e: Pick<EventoRegulatorio, "origem">): OrigemEvento => (e.origem === "curadoria" ? "ato" : "registro");

/** Identificador curto de um painel afetado ("/setor-eletrico/conta-de-luz" → "conta-de-luz"). */
export function slugPainel(href: string): string {
  return href.replace(/^\/setor-eletrico\/?/, "").replace(/\/+$/, "").replace(/\//g, "-") || "mapa";
}

export type FiltroLinhaTempo = {
  painel: string;
  origem: "" | OrigemEvento;
  base: BaseData;
  de: string;
  ate: string;
};

export const FILTRO_LINHA_TEMPO_PADRAO: FiltroLinhaTempo = { painel: "", origem: "", base: "vigencia", de: "", ate: "" };

const comoDatado = (e: EventoRegulatorio): EventoDatado => ({
  id: e.id,
  titulo: e.titulo,
  categoria: origemEvento(e),
  publicacao: e.data_publicacao,
  vigencia: e.vigencia_inicio,
  fonte: null,
});

/**
 * Recorte da linha do tempo: painel afetado, origem e período na data escolhida
 * (publicação ou vigência). Eventos sem a data escolhida ficam fora do recorte por
 * período e são contados, nunca somem em silêncio. Ordem: mais recentes primeiro.
 */
export function filtrarLinhaTempo(eventos: readonly EventoRegulatorio[], f: FiltroLinhaTempo): { eventos: EventoRegulatorio[]; semDataNaBase: number } {
  const { inicio, fim } = normalizarPeriodo(f.de || null, f.ate || null);
  let semData = 0;
  const dentro: EventoRegulatorio[] = [];
  for (const e of eventos) {
    if (f.painel && !e.paineis.some((p) => slugPainel(p.href) === f.painel)) continue;
    if (f.origem && origemEvento(e) !== f.origem) continue;
    if (inicio || fim) {
      const d = f.base === "publicacao" ? e.data_publicacao : e.vigencia_inicio;
      if (!d) {
        semData++;
        continue;
      }
      const dd = d.length === 7 ? `${d}-01` : d.slice(0, 10);
      if ((inicio && dd < inicio) || (fim && dd > fim)) continue;
    }
    dentro.push(e);
  }
  const ordem = ordenarEventos(dentro.map(comoDatado), f.base, "recentes").map((x) => x.id);
  const porId = new Map(dentro.map((e) => [e.id, e]));
  return { eventos: ordem.map((id) => porId.get(id) as EventoRegulatorio), semDataNaBase: semData };
}

/** Defasagem publicação → vigência em dias (null sem as duas datas ou com vigência de grão mensal). */
export function defasagemDias(e: Pick<EventoRegulatorio, "data_publicacao" | "vigencia_inicio" | "vigencia_grao">): number | null {
  if (!e.data_publicacao || e.vigencia_grao !== "dia") return null;
  const d = diferencaDatas(e.data_publicacao, e.vigencia_inicio);
  return d && d.unidade === "dias" ? d.valor : null;
}

export function textoDefasagemEvento(e: Pick<EventoRegulatorio, "data_publicacao" | "vigencia_inicio" | "vigencia_grao" | "vigencia_calculada">): string {
  if (!e.data_publicacao) return "publicação no DOU não informada pela fonte";
  if (e.vigencia_grao === "mes") return "vigência conhecida só pelo mês";
  const d = defasagemDias(e);
  if (d === null) return "defasagem não calculável";
  const calc = e.vigencia_calculada ? " (vigência calculada pela LC nº 95/1998)" : "";
  if (d === 0) return `vigência na data da publicação${calc}`;
  return d > 0 ? `vigência ${textoDuracao({ valor: d, unidade: "dias" })} após a publicação${calc}` : `vigência retroativa: ${textoDuracao({ valor: d, unidade: "dias" })} antes da publicação${calc}`;
}

/** Painéis afetados, do mais citado ao menos citado, no recorte. */
export function contagemPaineisAfetados(eventos: readonly EventoRegulatorio[]): { href: string; rotulo: string; n: number }[] {
  const m = new Map<string, { href: string; rotulo: string; n: number }>();
  for (const e of eventos) for (const p of e.paineis) {
    const k = slugPainel(p.href);
    const x = m.get(k) ?? { href: p.href, rotulo: p.rotulo, n: 0 };
    x.n++;
    m.set(k, x);
  }
  return Array.from(m.values()).sort((a, b) => b.n - a.n || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

/** Órgãos que emitem os eventos da linha do tempo, do que tem mais eventos para o que tem menos (empate: ordem alfabética). */
export function orgaosDosEventos(eventos: readonly Pick<EventoRegulatorio, "orgao">[]): string[] {
  const m = new Map<string, number>();
  for (const e of eventos) m.set(e.orgao, (m.get(e.orgao) ?? 0) + 1);
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .map(([orgao]) => orgao);
}

/** Atos e leis lidos no texto e registros do conjunto de dados de bandeiras, contados no recorte. */
export function contagemPorOrigem(eventos: readonly Pick<EventoRegulatorio, "origem">[]): { atos: number; registros: number } {
  const atos = eventos.filter((e) => origemEvento(e) === "ato").length;
  return { atos, registros: eventos.length - atos };
}

/**
 * Resposta curta do P045 para o recorte atual: quantos eventos, de que origem, o mais
 * recente com publicação e vigência, quantos começaram a valer depois da publicação e
 * quem é mais afetado. Nada de efeito: a linha do tempo não estima impacto.
 */
export function respostaLinhaTempo(eventos: readonly EventoRegulatorio[], total: number, base: BaseData = "vigencia"): string {
  if (!eventos.length) return `Nenhum dos ${total} eventos da linha do tempo está no recorte escolhido.`;
  const atos = eventos.filter((e) => origemEvento(e) === "ato").length;
  const reg = eventos.length - atos;
  const datas = eventos.map((e) => e.vigencia_inicio).sort();
  const recente = eventos[0];
  const depois = eventos.filter((e) => (defasagemDias(e) ?? 0) > 0).length;
  const semPub = eventos.filter((e) => !e.data_publicacao).length;
  const quem = contagemPaineisAfetados(eventos).slice(0, 3);
  const partes = [
    `${eventos.length === total ? `Os ${total} eventos` : `${eventos.length} de ${total} eventos`} da linha do tempo começam a valer entre ${dataBR(datas[0])} e ${dataBR(datas[datas.length - 1])}: ` +
      `${atos} ${pl(atos, "ato ou lei lido", "atos e leis lidos")} no texto e ${reg} ${pl(reg, "registro", "registros")} do conjunto de dados de bandeiras.`,
    `O evento ${base === "publicacao" ? "de publicação mais recente" : "de vigência mais recente"} é "${recente.titulo}" (${recente.ato ?? recente.tipo_ato}; ${textoPublicacao(recente.data_publicacao)}, vigência a partir de ${dataBR(recente.vigencia_inicio)}).`,
    `${depois} ${pl(depois, "evento começou", "eventos começaram")} a valer depois da data de publicação, e ${semPub} ${pl(semPub, "não tem", "não têm")} data de publicação na fonte.`,
  ];
  // contagem de eventos que a curadoria liga a cada painel, não tamanho de efeito
  if (quem.length) partes.push(`Painéis indicados em mais eventos: ${quem.map((q) => `${q.rotulo} (${q.n})`).join(", ")}.`);
  return partes.join(" ");
}

export const COLUNAS_LINHA_TEMPO: ColunaTabela[] = [
  { id: "titulo", rotulo: "Evento", tipo: "texto" },
  { id: "ato", rotulo: "Ato", tipo: "texto" },
  { id: "orgao", rotulo: "Órgão", tipo: "texto", categorica: true },
  { id: "origem", rotulo: "Origem", tipo: "texto", categorica: true },
  { id: "data_publicacao", rotulo: "Publicação", tipo: "data" },
  { id: "vigencia_inicio", rotulo: "Vigência: início", tipo: "data" },
  { id: "defasagem", rotulo: "Publicação até a vigência", tipo: "numero", unidade: "dias", casas: 0 },
  { id: "dispositivo", rotulo: "Dispositivo", tipo: "texto" },
  { id: "paineis", rotulo: "Painéis afetados", tipo: "texto" },
  { id: "efeito_declarado", rotulo: "Efeito declarado pelo ato (literal)", tipo: "texto" },
  { id: "impacto_estimado", rotulo: "Impacto estimado pelo observatório", tipo: "texto" },
  { id: "nivel", rotulo: "Conferência", tipo: "texto", categorica: true },
];

/** Linhas da tabela equivalente da linha do tempo (as mesmas, na mesma ordem, do gráfico e da lista). */
export function linhasLinhaTempo(eventos: readonly EventoRegulatorio[]): LinhaTabela[] {
  return eventos.map((e) => ({
    id: e.id,
    titulo: e.titulo,
    ato: e.ato ?? e.tipo_ato,
    orgao: e.orgao,
    origem: ROTULO_ORIGEM_EVENTO[origemEvento(e)],
    data_publicacao: e.data_publicacao,
    vigencia_inicio: e.vigencia_grao === "mes" ? e.vigencia_inicio.slice(0, 7) : e.vigencia_inicio,
    defasagem: defasagemDias(e),
    dispositivo: e.dispositivo,
    paineis: e.paineis.map((p) => p.rotulo).join(", "),
    efeito_declarado: e.efeito_declarado,
    impacto_estimado: e.impacto_estimado,
    nivel: ROTULO_NIVEL_EVENTO[e.nivel_conferencia] ?? e.nivel_conferencia,
  }));
}

/* ---------------------------------------------------------------- faixas de tempo (gráfico) */

export type MarcaTempo = { data: string; forma: "cheio" | "vazado"; rotulo: string; mes?: boolean };

/**
 * Uma linha do gráfico de faixas de tempo: duas marcas (início e fim, ou publicação e
 * vigência) ligadas por um traço. Marca ausente não é desenhada numa data inventada:
 * a linha diz o que falta em `ausencia`.
 */
export type FaixaTempo = {
  id: string;
  rotulo: string;
  inicio: MarcaTempo | null;
  fim: MarcaTempo | null;
  /** Estilo do traço entre as marcas. */
  traco: "cheio" | "tracejado" | "fino" | "nenhum";
  cor: string;
  /** Leitura completa (rótulo acessível e dica). */
  leitura: string;
  ausencia?: string;
};

export type ReferenciaTempo = { data: string; rotulo: string };

/** Domínio em dias seriais de todas as datas das faixas e das referências, com folga; null sem datas. */
export function dominioFaixas(faixas: readonly FaixaTempo[], referencias: readonly ReferenciaTempo[] = []): { min: number; max: number } | null {
  const s: number[] = [];
  for (const f of faixas)
    for (const m of [f.inicio, f.fim]) {
      if (!m) continue;
      const v = diaSerial(m.data);
      if (v === null) continue;
      s.push(v);
      if (m.mes) {
        // marca de grão mensal ocupa o mês inteiro: o domínio vai até o último dia dele
        const seguinte = diaSerial(somarMeses(m.data.slice(0, 7), 1));
        if (seguinte !== null) s.push(seguinte - 1);
      }
    }
  for (const r of referencias) {
    const v = diaSerial(r.data);
    if (v !== null) s.push(v);
  }
  if (!s.length) return null;
  const min = Math.min(...s);
  const max = Math.max(...s);
  const folga = Math.max(7, Math.round((max - min) * 0.03));
  return { min: min - folga, max: max + folga };
}

/** Faixas da linha do tempo: publicação (vazada) até a vigência (cheia). */
export function faixasLinhaTempo(eventos: readonly EventoRegulatorio[]): FaixaTempo[] {
  return eventos.map((e) => {
    const pub = e.data_publicacao ? { data: e.data_publicacao, forma: "vazado" as const, rotulo: `publicação ${dataBR(e.data_publicacao)}` } : null;
    const mes = e.vigencia_grao === "mes";
    const vig = { data: e.vigencia_inicio, forma: "cheio" as const, rotulo: mes ? `vigência a partir de ${dataBR(e.vigencia_inicio.slice(0, 7))} (só o mês)` : `vigência a partir de ${dataBR(e.vigencia_inicio)}`, mes };
    return {
      id: e.id,
      rotulo: rotuloCurtoEvento(e),
      inicio: pub,
      fim: vig,
      traco: pub ? "cheio" : "nenhum",
      cor: origemEvento(e) === "ato" ? "var(--cor-energia)" : "var(--serie-referencia)",
      leitura: `${e.titulo}. ${e.ato ?? e.tipo_ato}. ${pub ? pub.rotulo : "publicação não informada"}; ${vig.rotulo}; ${textoDefasagemEvento(e)}.`,
    };
  });
}

/** Rótulo da coluna estreita do gráfico: o ato abreviado ou, no valor visto só no recurso Acionamento, o mês. */
export function rotuloCurtoEvento(e: Pick<EventoRegulatorio, "ato" | "titulo" | "tipo_ato" | "vigencia_inicio">): string {
  if (e.ato) return abreviarAto(e.ato);
  if (/acionamento/i.test(e.tipo_ato)) return `Acionamento ${dataBR(e.vigencia_inicio.slice(0, 7))}`;
  return e.titulo;
}

/** Rótulo curto de ato para a coluna estreita do gráfico ("Resolução Normativa ANEEL nº 1.147, de 9 de..." → "REN nº 1.147/2025"). */
export function abreviarAto(ato: string): string {
  const siglas: [RegExp, string][] = [
    [/^Retificação da Resolução Homologatória/i, "Retif. REH"],
    [/^Resolução Normativa/i, "REN"],
    [/^Resolução Homologatória/i, "REH"],
    [/^Resolução Autorizativa/i, "REA"],
    [/^Medida Provisória/i, "MP"],
    [/^Lei Complementar/i, "LC"],
    [/^Lei/i, "Lei"],
    [/^Despacho/i, "Despacho"],
    [/^Portaria/i, "Portaria"],
    [/^Resolução CREG/i, "RES CREG"],
    [/^RES CREG/i, "RES CREG"],
    [/^REH/i, "REH"],
  ];
  const sig = siglas.find(([re]) => re.test(ato))?.[1];
  const numero = /nº\s*([\d.]+)(?:\/(\d{4}))?/i.exec(ato);
  const anoExtenso = /de\s+\d{1,2}º?\s+de\s+\S+\s+de\s+(\d{4})/i.exec(ato);
  if (!sig || !numero) return ato.length > 28 ? `${ato.slice(0, 27).trimEnd()}…` : ato;
  const ano = numero[2] ?? anoExtenso?.[1] ?? "";
  const orgao = /\bMME\b/.test(ato) ? " MME" : "";
  return `${sig}${orgao} nº ${numero[1]}${ano ? `/${ano}` : ""}`;
}

/* ---------------------------------------------------------------- P046: consultas */

export const ORDEM_SITUACAO: SituacaoConsulta[] = [
  "aberta",
  "a_abrir",
  "encerrada_aguardando",
  "resultado_em_pauta",
  "prazo_nao_datado",
  "sessao_sem_periodo",
  "sem_periodo_na_ata",
  "decidida",
];

export const ROTULO_CURTO_SITUACAO: Record<SituacaoConsulta, string> = {
  aberta: "Recebendo contribuições",
  a_abrir: "A abrir",
  encerrada_aguardando: "Encerrada, sem resultado",
  resultado_em_pauta: "Resultado em pauta",
  decidida: "Decidida",
  prazo_nao_datado: "Prazo sem datas na ata",
  sessao_sem_periodo: "Só a sessão na ata",
  sem_periodo_na_ata: "Sem período na ata",
};

/** Situações que o filtro mostra por padrão: tudo o que ainda não foi decidido. */
export const SITUACOES_PADRAO: SituacaoConsulta[] = ORDEM_SITUACAO.filter((s) => s !== "decidida");

export const ROTULO_FORMA_RESULTADO: Record<FormaResultado, string> = {
  resultado: "\"Resultado da ...\" deliberado",
  encerramento: "encerramento",
  apos_contribuicoes: "decisão após a análise das contribuições",
  consolidacao: "consolidação do documento submetido à consulta",
  resultado_sem_numero: "resultado de revisão tarifária ligado pelo processo",
  objeto_aprovado_no_processo: "módulo de procedimento aprovado no mesmo processo",
};

export type ConsultaNaData = Consulta & { situacao_na_data: SituacaoConsulta };

export function consultasNaData(itens: readonly Consulta[], data: string): ConsultaNaData[] {
  return itens.map((c) => ({ ...c, situacao_na_data: situacaoConsulta(c, data) }));
}

export function contarSituacoes(itens: readonly { situacao_na_data: SituacaoConsulta }[]): Record<SituacaoConsulta, number> {
  const r = Object.fromEntries(ORDEM_SITUACAO.map((s) => [s, 0])) as Record<SituacaoConsulta, number>;
  for (const c of itens) r[c.situacao_na_data]++;
  return r;
}

/**
 * Ordem de leitura: abertas pelo prazo mais próximo, a abrir pelo início, encerradas
 * aguardando pelo fim mais recente, depois as sem janela e as decididas pelo resultado
 * mais recente. Empate: rótulo.
 */
export function ordenarConsultas<T extends ConsultaNaData>(itens: readonly T[]): T[] {
  const pos = (s: SituacaoConsulta) => ORDEM_SITUACAO.indexOf(s);
  const chave = (c: T): string => {
    const s = c.situacao_na_data;
    if (s === "aberta") return c.fim ?? "";
    if (s === "a_abrir") return c.inicio ?? "";
    if (s === "decidida") return inverter(c.resultado?.data ?? "");
    if (s === "encerrada_aguardando" || s === "resultado_em_pauta") return inverter(c.fim ?? c.resultado?.data ?? faseAtual(c)?.data_deliberacao ?? "");
    return inverter(faseAtual(c)?.data_deliberacao ?? "");
  };
  return itens.slice().sort((a, b) => pos(a.situacao_na_data) - pos(b.situacao_na_data) || chave(a).localeCompare(chave(b)) || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

/** Inverte a ordem lexicográfica de uma data AAAA-MM-DD (mais recente primeiro numa ordenação crescente). */
function inverter(d: string): string {
  return d.replace(/\d/g, (x) => String(9 - Number(x)));
}

/** Rótulo curto da consulta para a coluna estreita ("Consulta Pública nº 30/2026" → "CP 30/2026"). */
export function rotuloCurtoConsulta(c: Pick<Consulta, "modalidade" | "numero" | "ano">): string {
  return `${c.modalidade === "Audiência Pública" ? "AP" : "CP"} ${c.numero}/${c.ano}`;
}

const PREFIXOS_TEMA = [
  /^proposta de abertura de (consulta|audi[eê]ncia) p[uú]blica,?\s*(com vistas a|para)\s*(colher|obter)\s*subs[ií]dios( e informa[cç][oõ]es adicionais)?\s*(para|acerca d[aoe]s?|sobre|referentes? [àa]s?|relativos? [àa]s?)?\s*/i,
  /^proposta de abertura de (consulta|audi[eê]ncia) p[uú]blica,?\s*(com vistas a|com vistas ao|para)\s*/i,
  /^proposta de abertura de (consulta|audi[eê]ncia) p[uú]blica\s*/i,
];

/**
 * Assunto da consulta sem a fórmula de abertura que se repete em quase todas as atas. É
 * rótulo do observatório, não citação: o travessão que a ata usa como pontuação vira
 * vírgula ("Energia Eletrica – CEEE-D" vira "Energia Eletrica, CEEE-D"); o texto
 * integral, sem mudança, está no CSV do painel.
 */
export function temaCurto(tema: string): string {
  let t = tema.trim().replace(/\s+[–—]\s*|\s*[–—]\s+/g, ", ");
  for (const re of PREFIXOS_TEMA) {
    if (re.test(t)) {
      t = t.replace(re, "");
      break;
    }
  }
  t = t.replace(/^[,:;\s]+/, "");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : tema;
}

/** Situação que uma decisão de abertura sem resultado formal teria na data, se a ata a confirmar. */
export function situacaoSeConfirmada(d: Pick<DecisaoSemResultadoFormal, "inicio" | "fim">, data: string): "aberta" | "a_abrir" | "encerrada_aguardando" | null {
  if (!d.inicio || !d.fim) return null;
  if (data < d.inicio) return "a_abrir";
  if (data <= d.fim) return "aberta";
  return "encerrada_aguardando";
}

/**
 * Recorte das consultas da gold em texto ("com atividade nos últimos 200 dias"). Sem a
 * janela na gold, a ausência é dita: nenhum número de reserva entra no lugar.
 */
export function textoJanela(dias: number | null | undefined): string {
  return typeof dias === "number" ? `com atividade nos últimos ${dias} ${pl(dias, "dia", "dias")}` : "com atividade recente (a publicação não informa a janela)";
}

/** Ano de início do histórico de consultas, lido da proveniência da gold; null sem a data. */
export function anoInicioHistorico(g: Pick<GoldRegulacao, "proveniencia">): string | null {
  return g.proveniencia.consultas.cobertura_historica?.inicio?.slice(0, 4) ?? null;
}

/**
 * Nome da agenda com o biênio lido dos anos previstos na própria portaria ("Agenda
 * Regulatória de 2026 e 2027"), nunca escrito à mão; sem anos, o nome genérico.
 */
export function nomeAgenda(a: Pick<GoldRegulacao["agenda"], "por_ano" | "itens">): string {
  const anos = textoAnosAgenda(a);
  return anos ? `Agenda Regulatória de ${anos}` : "Agenda Regulatória da ANEEL";
}

/** Anos previstos na agenda, em ordem e em texto ("2026 e 2027"); null quando a portaria não traz ano. */
export function textoAnosAgenda(a: Pick<GoldRegulacao["agenda"], "por_ano" | "itens">): string | null {
  const anos = Array.from(new Set([...Object.keys(a.por_ano ?? {}), ...a.itens.map((i) => String(i.ano_previsto))])).sort();
  if (!anos.length) return null;
  return anos.length === 1 ? anos[0] : `${anos.slice(0, -1).join(", ")} e ${anos[anos.length - 1]}`;
}

/**
 * Aviso à vista quando a página oficial diz que a agenda foi atualizada por outra portaria e o texto da atualização não pôde ser
 * lido: os anos previstos são os da versão original. null quando não há atualização pendente de leitura. O detalhe da tentativa de
 * leitura (endereço, resposta do servidor) fica em Analisar.
 */
export function avisoRevisaoAgenda(a: Pick<GoldRegulacao["agenda"], "revisao" | "disponivel">): string | null {
  const r = a.revisao;
  if (!a.disponivel || !r.atualizada_por || r.texto_lido) return null;
  return `A página oficial da agenda diz que ela foi ${r.trecho ?? `atualizada pela ${r.atualizada_por}`}. O texto dessa atualização não pôde ser lido, então os anos previstos são os da versão original e podem ter mudado.`;
}

/**
 * Nome de arquivo para baixar, em frase: "(histórico)" vira ", histórico", o intervalo de anos ganha "a" no lugar do hífen e o
 * formato fecha o rótulo.
 */
export function rotuloDownload(rotulo: string, formato = "CSV"): string {
  const sem = rotulo.replace(/\s*\(([^)]*)\)\s*$/, ", $1").replace(/(\d{4})-(\d{4})/, "$1 a $2");
  return `${sem} (${formato})`;
}

/** Dias entre a geração do arquivo das atas pela fonte e a data de leitura; a fonte se declara semanal. */
export function defasagemAtas(c: Pick<Consultas, "atas_geradas_em" | "atas_deliberadas_ate">, data: string): { dias: number | null; defasada: boolean } {
  const ger = c.atas_geradas_em ?? c.atas_deliberadas_ate ?? null;
  const d = ger ? diferencaDatas(ger.slice(0, 10), data) : null;
  const dias = d && d.unidade === "dias" ? d.valor : null;
  // semanal declarada: duas semanas sem arquivo novo já indicam atraso da fonte ou da coleta
  return { dias, defasada: dias !== null && dias > 14 };
}

/**
 * Resposta curta do P046 na data de leitura: quantas recebem contribuições, a que
 * fecha primeiro, quantas estão encerradas sem resultado e quantas decisões de abertura
 * ainda sem resultado formal ficariam abertas. A contagem é das consultas com atividade
 * recente que a gold traz; o histórico completo está no CSV.
 */
export function respostaConsultas(c: Pick<Consultas, "itens" | "janela_dias" | "decisoes_sem_resultado_formal" | "atas_deliberadas_ate">, data: string): string {
  const itens = consultasNaData(c.itens, data);
  const n = contarSituacoes(itens);
  const abertas = ordenarConsultas(itens.filter((x) => x.situacao_na_data === "aberta"));
  const aAbrir = ordenarConsultas(itens.filter((x) => x.situacao_na_data === "a_abrir"));
  const semData = n.prazo_nao_datado + n.sessao_sem_periodo + n.sem_periodo_na_ata;
  const partes: string[] = [];
  if (abertas.length) {
    const p = abertas[0];
    partes.push(
      `Em ${dataBR(data)}, ${abertas.length} ${pl(abertas.length, "consulta ou audiência pública da ANEEL recebe", "consultas e audiências públicas da ANEEL recebem")} contribuições; ` +
        `a primeira a fechar é a ${p.rotulo}, até ${dataBR(p.fim)}${p.fim_calculado ? " (fim calculado do início e da duração)" : ""}.`,
    );
  } else {
    partes.push(`Em ${dataBR(data)}, nenhuma consulta ou audiência pública com janela escrita nas atas recebe contribuições.`);
  }
  if (aAbrir.length) partes.push(`${aAbrir.length} ${pl(aAbrir.length, "tem", "têm")} abertura deliberada e período ainda por começar; a primeira começa em ${dataBR(aAbrir[0].inicio)}.`);
  partes.push(
    `${n.encerrada_aguardando} ${pl(n.encerrada_aguardando, "teve", "tiveram")} as contribuições encerradas sem resultado deliberado em reunião registrada até ${dataBR(c.atas_deliberadas_ate ?? null)}` +
      (n.resultado_em_pauta ? `, ${n.resultado_em_pauta} ${pl(n.resultado_em_pauta, "tem", "têm")} resultado levado à reunião sem decisão` : "") +
      (semData ? ` e ${semData} ${pl(semData, "não tem", "não têm")} datas na ata, por isso a situação não é derivável` : "") +
      `, entre as ${itens.length} consultas ${textoJanela(c.janela_dias)}.`,
  );
  const pend = (c.decisoes_sem_resultado_formal ?? []).map((d) => situacaoSeConfirmada(d, data));
  const ab = pend.filter((s) => s === "aberta").length;
  const aa = pend.filter((s) => s === "a_abrir").length;
  if (ab || aa) {
    partes.push(
      (pend.length === 1
        ? "Outra decisão de abertura da última pauta ainda não tem resultado formal na ata e fica fora da contagem: se confirmada, "
        : `Outras ${pend.length} decisões de abertura da última pauta ainda não têm resultado formal na ata e ficam fora da contagem: se confirmadas, `) +
        [ab ? `${ab} ${pl(ab, "estaria aberta", "estariam abertas")}` : "", aa ? `${aa} ${pl(aa, "estaria", "estariam")} a abrir` : ""].filter(Boolean).join(" e ") +
        ".",
    );
  }
  return partes.join(" ");
}

export function linhasConsultas(itens: readonly ConsultaNaData[]): LinhaTabela[] {
  return itens.map((c) => ({
    id: c.id,
    rotulo: c.rotulo,
    modalidade: c.modalidade,
    situacao: ROTULO_CURTO_SITUACAO[c.situacao_na_data],
    tema: temaCurto(c.tema),
    fase: c.fase_atual,
    inicio: c.inicio,
    fim: c.fim,
    fim_calculado: c.fim ? (c.fim_calculado ? "calculado (início e duração)" : "escrito na ata") : "a ata não escreve o fim",
    duracao_dias: c.duracao_dias,
    sessao: c.sessao,
    deliberacao: faseAtual(c)?.data_deliberacao ?? c.deliberacao_abertura.data,
    resultado_data: c.resultado?.data ?? null,
    resultado_ato: c.resultado ? (c.resultado.ato ?? (c.resultado.ato_suspeito ? `número suspeito na ata (${c.resultado.ato_na_ata ?? "sem registro"})` : null)) : null,
    resultado_forma: c.resultado ? ROTULO_FORMA_RESULTADO[c.resultado.forma] : "sem resultado nas atas",
    processo: c.processos.join(", "),
    relator: c.relator,
    agenda: c.agenda_codigos.length ? c.agenda_codigos.join(", ") : null,
  }));
}

export const COLUNAS_CONSULTAS: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Consulta", tipo: "texto" },
  { id: "situacao", rotulo: "Situação na data", tipo: "texto", categorica: true },
  { id: "modalidade", rotulo: "Modalidade", tipo: "texto", categorica: true },
  { id: "tema", rotulo: "Assunto", tipo: "texto" },
  { id: "fase", rotulo: "Fase atual", tipo: "texto", categorica: true },
  { id: "inicio", rotulo: "Contribuições: início", tipo: "data" },
  { id: "fim", rotulo: "Contribuições: fim", tipo: "data" },
  { id: "fim_calculado", rotulo: "Origem do fim", tipo: "texto", categorica: true },
  { id: "duracao_dias", rotulo: "Duração declarada", tipo: "numero", unidade: "dias", casas: 0 },
  { id: "sessao", rotulo: "Sessão da audiência", tipo: "data" },
  { id: "deliberacao", rotulo: "Deliberação da fase atual", tipo: "data" },
  { id: "resultado_data", rotulo: "Resultado: reunião", tipo: "data" },
  { id: "resultado_ato", rotulo: "Resultado: ato", tipo: "texto" },
  { id: "resultado_forma", rotulo: "Resultado: forma", tipo: "texto", categorica: true },
  { id: "processo", rotulo: "Processo", tipo: "texto" },
  { id: "relator", rotulo: "Relator", tipo: "texto", categorica: true },
  { id: "agenda", rotulo: "Atividade da Agenda citada", tipo: "texto" },
];

const ESTILO_SITUACAO: Record<SituacaoConsulta, { cor: string; traco: FaixaTempo["traco"] }> = {
  aberta: { cor: "var(--cor-energia)", traco: "cheio" },
  a_abrir: { cor: "var(--cor-energia)", traco: "tracejado" },
  encerrada_aguardando: { cor: "var(--serie-termica)", traco: "cheio" },
  resultado_em_pauta: { cor: "var(--serie-termica)", traco: "tracejado" },
  decidida: { cor: "var(--serie-referencia)", traco: "fino" },
  prazo_nao_datado: { cor: "var(--serie-referencia)", traco: "nenhum" },
  sessao_sem_periodo: { cor: "var(--serie-referencia)", traco: "nenhum" },
  sem_periodo_na_ata: { cor: "var(--serie-referencia)", traco: "nenhum" },
};

export const LEGENDA_SITUACAO = ORDEM_SITUACAO.filter((s) => ESTILO_SITUACAO[s].traco !== "nenhum").map((s) => ({ situacao: s, rotulo: ROTULO_CURTO_SITUACAO[s], ...ESTILO_SITUACAO[s] }));

/** Faixas das janelas de contribuição (início cheio, fim cheio ou vazado quando calculado). */
export function faixasConsultas(itens: readonly ConsultaNaData[]): FaixaTempo[] {
  return itens.map((c) => {
    const est = ESTILO_SITUACAO[c.situacao_na_data];
    const f = faseAtual(c);
    const semJanela = !c.inicio || !c.fim;
    const ausencia = semJanela
      ? c.situacao_na_data === "prazo_nao_datado"
        ? (c.duracao_dias ?? f?.duracao_dias) != null
          ? `a ata informa só a duração (${c.duracao_dias ?? f?.duracao_dias} dias), sem datas`
          : "a ata informa só que há prazo, sem datas nem duração"
        : c.sessao
          ? `só a sessão de ${dataBR(c.sessao)} na ata, sem período de contribuições`
          : "a ata não informa período, duração nem sessão"
      : undefined;
    const res = c.resultado ? `; resultado ${c.resultado.decidido ? "deliberado" : "levado à reunião sem decisão"} em ${dataBR(c.resultado.data)}${c.resultado.ato ? ` (${c.resultado.ato})` : ""}` : "";
    return {
      id: c.id,
      rotulo: rotuloCurtoConsulta(c),
      inicio: c.inicio ? { data: c.inicio, forma: "cheio", rotulo: `início ${dataBR(c.inicio)}` } : null,
      fim: c.fim ? { data: c.fim, forma: c.fim_calculado ? "vazado" : "cheio", rotulo: `fim ${dataBR(c.fim)}${c.fim_calculado ? " (calculado do início e da duração)" : ""}` } : null,
      traco: semJanela ? "nenhum" : est.traco,
      cor: est.cor,
      leitura:
        `${c.rotulo}: ${ROTULO_CURTO_SITUACAO[c.situacao_na_data].toLowerCase()}. ` +
        (semJanela ? `Sem janela de contribuições: ${ausencia}` : `Contribuições de ${dataBR(c.inicio)} a ${dataBR(c.fim)}${c.fim_calculado ? " (fim calculado)" : ""}`) +
        `${res}. ${temaCurto(c.tema)}`,
      ausencia,
    };
  });
}

/* ---------------------------------------------------------------- P046: agenda */

/** Atividades por painel relacionado e ano previsto (uma atividade pode ter mais de um painel). */
export function contagemAgendaPorPainel(itens: readonly AtividadeAgenda[]): { linhas: LinhaTabela[]; anos: string[]; semPainel: number } {
  const anos = Array.from(new Set(itens.map((i) => String(i.ano_previsto)))).sort();
  const m = new Map<string, LinhaTabela>();
  let semPainel = 0;
  for (const i of itens) {
    if (!i.paineis.length) semPainel++;
    for (const p of i.paineis) {
      const k = slugPainel(p.href);
      const l = m.get(k) ?? { id: k, rotulo: p.rotulo, ...Object.fromEntries(anos.map((a) => [a, 0])) };
      l[String(i.ano_previsto)] = ((l[String(i.ano_previsto)] as number) ?? 0) + 1;
      m.set(k, l);
    }
  }
  const total = (l: LinhaTabela) => anos.reduce((s, a) => s + ((l[a] as number) ?? 0), 0);
  const linhas = Array.from(m.values()).sort((a, b) => total(b) - total(a) || String(a.rotulo).localeCompare(String(b.rotulo), "pt-BR"));
  return { linhas, anos, semPainel };
}

export function linhasAgenda(itens: readonly AtividadeAgenda[], limites: readonly { codigo: string }[] = []): LinhaTabela[] {
  const lim = new Set(limites.map((l) => l.codigo));
  return itens.map((i) => ({
    id: i.codigo,
    codigo: i.codigo,
    atividade: i.atividade,
    ano_previsto: String(i.ano_previsto),
    paineis: i.paineis.length ? i.paineis.map((p) => p.rotulo).join(", ") : "nenhum (sem palavra-chave da regra)",
    limites_pld: lim.has(i.codigo) ? "sim" : "não",
    consultas: i.consultas.length ? i.consultas.join(", ") : null,
  }));
}

export const COLUNAS_AGENDA: ColunaTabela[] = [
  { id: "codigo", rotulo: "Código", tipo: "texto" },
  { id: "atividade", rotulo: "Atividade", tipo: "texto" },
  { id: "ano_previsto", rotulo: "Ano previsto", tipo: "texto", categorica: true },
  { id: "paineis", rotulo: "Painéis relacionados (palavra-chave)", tipo: "texto", categorica: true },
  { id: "limites_pld", rotulo: "Trata dos limites do PLD", tipo: "texto", categorica: true },
  { id: "consultas", rotulo: "Consultas que citam o código", tipo: "texto" },
];

export function respostaAgenda(a: GoldRegulacao["agenda"], limites: GoldRegulacao["limites_em_revisao"]): string {
  if (!a.disponivel) return `A Agenda Regulatória não está disponível nesta publicação: ${a.motivo ?? "motivo não informado"}.`;
  const anos = Object.entries(a.por_ano ?? {}).sort(([x], [y]) => x.localeCompare(y));
  const comConsulta = a.itens.filter((i) => i.consultas.length).length;
  const portaria = a.portaria ?? "portaria da Agenda Regulatória";
  // a vírgula fecha o aposto da data ("Portaria ..., de 2 de dezembro de 2025, prevê"); sem aposto, não há vírgula
  return (
    `A ${portaria}${portaria.includes(",") ? "," : ""} prevê ${a.itens.length} atividades para o biênio` +
    (anos.length ? ` (${anos.map(([ano, n]) => `${n} em ${ano}`).join(" e ")})` : "") +
    `; ${limites.length} ${pl(limites.length, "trata", "tratam")} dos limites do PLD (${limites.map((l) => `${l.codigo}, prevista para ${l.ano_previsto}`).join("; ")}) e ` +
    `${comConsulta} ${pl(comConsulta, "tem", "têm")} consulta que cita o código. O ano é previsão da própria ANEEL, reprogramável` +
    (a.revisao.atualizada_por && !a.revisao.texto_lido ? `, e a revisão (${a.revisao.atualizada_por}) não pôde ser lida: os anos podem ter mudado.` : ".")
  );
}

/* ---------------------------------------------------------------- P046: histórico e cobertura */

export function linhasHistoricoSituacao(c: Pick<Consultas, "contagem_por_situacao">): LinhaTabela[] {
  // situação sem contagem na gold fica sem valor (barra "sem dado"), nunca zero
  return ORDEM_SITUACAO.map((s) => ({ id: s, situacao: ROTULO_CURTO_SITUACAO[s], n: c.contagem_por_situacao[s] ?? null }));
}

export function paresCobertura(c: Pick<Consultas, "cobertura">, modalidade: "consultas" | "audiencias"): { id: string; rotulo: string; valor: number | null; referencia: number | null; detalhe?: string }[] {
  return c.cobertura.map((x) => ({
    id: String(x.ano),
    rotulo: `${x.ano}${x.parcial ? " (ano parcial)" : ""}`,
    valor: modalidade === "consultas" ? x.nas_atas : x.audiencias_nas_atas,
    referencia: modalidade === "consultas" ? x.total_anual_aneel : x.audiencias_total_anual_aneel,
    detalhe: x.parcial ? `contagem anual da ANEEL gerada em ${dataBR(x.gerado_em)}, antes do fim do ano` : undefined,
  }));
}

/** Texto da faixa de cobertura publicada pela gold (sem recalcular percentuais na interface). */
export function textoCoberturaFaixa(c: Pick<Consultas, "cobertura_faixa">): string {
  const f = c.cobertura_faixa;
  if (!f?.consultas) return "Cobertura anual não publicada nesta gold.";
  const aud = f.audiencias ? ` e de ${num(f.audiencias.min_pct, 1)}% a ${num(f.audiencias.max_pct, 1)}% das audiências públicas` : "";
  return `Entre ${f.consultas.de} e ${f.consultas.ate}, as atas registram de ${num(f.consultas.min_pct, 1)}% a ${num(f.consultas.max_pct, 1)}% das consultas públicas que a ANEEL conta em cada ano${aud}.`;
}

/** Painéis relacionados a um conjunto de links, sem repetir. */
export function unicosPaineis(links: readonly PainelLink[]): PainelLink[] {
  const m = new Map<string, PainelLink>();
  for (const l of links) if (!m.has(l.href)) m.set(l.href, l);
  return Array.from(m.values());
}

/* ---------------------------------------------------------------- vereditos (resposta em duas camadas) */

/**
 * Cada veredito responde, em palavras simples e com poucos números, à pergunta do título do painel. Sai dos mesmos
 * campos da resposta completa (que continua inteira como segunda camada, em Analisar e Auditar) e nunca escreve
 * número à mão. Sigla de uso corrente (PLD, ANEEL) está em siglas.ts; termo técnico novo fica fora do veredito.
 */

/** "A", "A e B", "A, B e C". */
export function listaComE(itens: readonly string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/**
 * Veredito dos limites do PLD num ano: o piso e o teto de uma hora, com o ato que os fixou. O teto da média
 * diária (teto estrutural) e as datas de publicação e de vigência ficam na resposta completa.
 */
export function vereditoLimites(g: Pick<GoldRegulacao, "limites_pld">, ano: number): string {
  const vs = vigenciasDoAno(g, ano);
  if (!vs.length) return `Não há ato de limites do PLD integrado para ${ano}: os limites desse ano ficam sem valor.`;
  const v = vs[vs.length - 1];
  const piso = v.pld_min === null ? null : `${reais(v.pld_min, 2)}/MWh`;
  const teto = v.pld_max_horario === null ? null : `${reais(v.pld_max_horario, 2)}/MWh`;
  let frase: string;
  if (piso && teto) frase = `Em ${ano}, o PLD não pode ficar abaixo de ${piso} nem passar de ${teto} numa hora.`;
  else if (piso) frase = `Em ${ano}, o PLD não pode ficar abaixo de ${piso}; o teto de uma hora fica sem valor (nenhum ato em vigor o fixa).`;
  else if (teto) frase = `Em ${ano}, o PLD não pode passar de ${teto} numa hora; o piso fica sem valor (nenhum ato em vigor o fixa).`;
  else frase = `Em ${ano}, nenhum ato em vigor fixa o piso nem o teto de uma hora do PLD.`;
  const atos = Array.from(new Set(CAMPOS_LIMITE.map((c) => v[ATO_CAMPO[c]]).filter((a): a is string => !!a)));
  if (!atos.length) return frase;
  return atos.length === 1
    ? `${frase} Os limites foram fixados ${porAto(atos[0])}.`
    : `${frase} Os limites foram fixados por ${atos.length} atos: ${listaComE(atos)}.`;
}

/** Veredito do P044 na data de referência da gold: o ano em vigor nessa data. */
export function vereditoP044(g: Pick<GoldRegulacao, "limites_pld" | "data_referencia">): string {
  const v = vigenteEm(g.limites_pld.vigencias, g.data_referencia);
  if (!v) return `Em ${dataBR(g.data_referencia)} não há ato de limites do PLD integrado em vigor: os limites ficam sem valor nesta data.`;
  return vereditoLimites(g, v.ano);
}

/**
 * Painéis ligados a um evento, em texto ("ligada a A e B"); vazio sem painel indicado. A ligação é a da curadoria do ato
 * (painéis em que o número passa a ser lido com a regra nova), não uma estimativa de efeito. Duas palavras de ligação, para o
 * veredito caber nas 40 palavras mesmo quando o ato se liga a dois painéis.
 */
function textoAfeta(e: Pick<EventoRegulatorio, "paineis">): string {
  if (!e.paineis.length) return "";
  return `, ligada a ${listaComE(e.paineis.map((p) => p.rotulo))}`;
}

/**
 * Veredito do P045 para o recorte atual: a regra mais recente (título, desde quando vale, quem é afetado), a natureza
 * da lista (seleção de marcos, conferida numa data) e o limite de leitura (nenhum impacto é estimado). Os eventos já
 * vêm na ordem de filtrarLinhaTempo, o mais recente primeiro na data escolhida.
 */
export function vereditoLinhaTempo(eventos: readonly EventoRegulatorio[], total: number, base: BaseData = "vigencia", conferidoEm?: string | null): string {
  if (!eventos.length) return `Nenhum dos ${total} eventos da linha do tempo está no recorte escolhido.`;
  const r = eventos[0];
  const recorte = eventos.length !== total ? " deste recorte" : "";
  const quando =
    base === "publicacao"
      ? r.data_publicacao
        ? `saiu no Diário Oficial em ${dataBR(r.data_publicacao)}`
        : "não tem data de publicação na fonte"
      : `vale desde ${dataBR(r.vigencia_grao === "mes" ? r.vigencia_inicio.slice(0, 7) : r.vigencia_inicio)}`;
  const abre = base === "publicacao" ? `A regra publicada por último${recorte}` : `A regra mais recente${recorte}`;
  const comImpacto = eventos.filter((e) => e.impacto_estimado).length;
  const limite = comImpacto === 0 ? "sem impacto estimado nesta fonte" : `${comImpacto} de ${eventos.length} eventos trazem impacto estimado`;
  const lista = conferidoEm ? `É uma seleção de marcos conferida em ${dataBR(conferidoEm)}, ${limite}.` : `É uma seleção de marcos, ${limite}.`;
  return `${abre} ${quando}: “${r.titulo}”${textoAfeta(r)}. ${lista}`;
}

/** Primeira frase de um texto (até o primeiro ponto final seguido de maiúscula); o resto fica para Analisar. */
export function primeiraFrase(texto: string): string {
  const t = texto.trim();
  const m = /^[\s\S]+?[.!?](?=\s+[A-ZÀ-Ú"“(]|$)/.exec(t);
  return m ? m[0] : t;
}

/** Tira de um texto os parênteses que citam identificador interno (nome_com_sublinhado), que o leitor de Entender não consulta. */
export function semIdentificadores(texto: string): string {
  return texto.replace(/\s*\([^()]*\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b[^()]*\)/g, "").replace(/\s{2,}/g, " ");
}

/** Resumo do evento como o leitor de Entender o lê: a primeira frase do resumo do observatório, com as datas na forma da página. */
export function resumoCurtoEvento(e: Pick<EventoRegulatorio, "resumo">, legivel: (t: string) => string): string {
  return legivel(primeiraFrase(semIdentificadores(e.resumo)));
}

export type GrupoRegistros = {
  tipo: string;
  n: number;
  /** O mais antigo e o mais recente do grupo, pela data de vigência. */
  primeiro: EventoRegulatorio;
  ultimo: EventoRegulatorio;
  /** Títulos distintos do grupo, na ordem em que aparecem. */
  titulos: string[];
};

/**
 * Registros do conjunto de dados de bandeiras agrupados por tipo de ato: um cartão por tipo, com a quantidade e o
 * período. O grupo do registro mais recente vem primeiro. Os eventos já vêm filtrados e ordenados.
 */
export function agruparRegistros(eventos: readonly EventoRegulatorio[]): GrupoRegistros[] {
  const m = new Map<string, EventoRegulatorio[]>();
  for (const e of eventos) if (origemEvento(e) === "registro") m.set(e.tipo_ato, [...(m.get(e.tipo_ato) ?? []), e]);
  return Array.from(m.entries())
    .map(([tipo, es]) => {
      const porVigencia = es.slice().sort((a, b) => a.vigencia_inicio.localeCompare(b.vigencia_inicio));
      return { tipo, n: es.length, primeiro: porVigencia[0], ultimo: porVigencia[porVigencia.length - 1], titulos: Array.from(new Set(es.map((x) => x.titulo))) };
    })
    .sort((a, b) => b.ultimo.vigencia_inicio.localeCompare(a.ultimo.vigencia_inicio));
}

/**
 * O que os registros de bandeiras têm em comum de vazio, dito uma vez em vez de em cada cartão: sem data de publicação,
 * sem efeito declarado e com o texto do ato não lido. Só afirma o que vale para todos; senão conta quantos.
 */
export function textoVaziosRegistros(regs: readonly EventoRegulatorio[]): string {
  const n = regs.length;
  if (!n) return "";
  const semPub = regs.filter((e) => !e.data_publicacao).length;
  const semEfeito = regs.filter((e) => !e.efeito_declarado).length;
  const naoLido = regs.filter((e) => e.nivel_conferencia === "registro_em_conjunto_de_dados_oficial").length;
  if (semPub === n && semEfeito === n && naoLido === n) return `Nos ${num(n, 0)} registros, a fonte é um conjunto de dados: não informa a data de publicação nem o efeito declarado, e o texto do ato não foi lido.`;
  return `${num(semPub, 0)} dos ${num(n, 0)} registros não têm data de publicação, ${num(semEfeito, 0)} não têm efeito declarado e em ${num(naoLido, 0)} o texto do ato não foi lido.`;
}

/**
 * Veredito do P046 na data de leitura: quantas consultas e audiências recebem contribuições, quando fecha a primeira
 * e o limite do universo (só entram as abertas em reunião pública registrada em ata).
 */
export function vereditoConsultas(c: Pick<Consultas, "itens">, data: string): string {
  const itens = consultasNaData(c.itens, data);
  const abertas = ordenarConsultas(itens.filter((x) => x.situacao_na_data === "aberta"));
  const aAbrir = itens.filter((x) => x.situacao_na_data === "a_abrir").length;
  const partes: string[] = [];
  if (abertas.length) {
    const n = abertas.length;
    partes.push(
      `Em ${dataBR(data)}, ${n} ${pl(n, "consulta ou audiência pública da ANEEL recebe", "consultas e audiências públicas da ANEEL recebem")} contribuições; a primeira a fechar encerra em ${dataBR(abertas[0].fim)}.`,
    );
  } else {
    partes.push(`Em ${dataBR(data)}, nenhuma consulta ou audiência pública da ANEEL com janela escrita nas atas recebe contribuições.`);
  }
  if (aAbrir) partes.push(`${num(aAbrir, 0)} ${pl(aAbrir, "ainda não começou", "ainda não começaram")}.`);
  partes.push("Só entram as consultas abertas em reunião pública registrada em ata.");
  return partes.join(" ");
}

/**
 * Consultas que mudaram de situação aberta entre a data de referência da gold e a data de leitura: as que estavam abertas
 * e já fecharam, e as que ainda não tinham começado e já abriram.
 */
export function mudancasDeAbertas(itens: readonly Consulta[], referencia: string, data: string): { antes: number; depois: number; fecharam: ConsultaNaData[]; abriram: ConsultaNaData[] } {
  const naRef = consultasNaData(itens, referencia).filter((x) => x.situacao_na_data === "aberta");
  const naData = consultasNaData(itens, data).filter((x) => x.situacao_na_data === "aberta");
  const idsRef = new Set(naRef.map((x) => x.id));
  const idsData = new Set(naData.map((x) => x.id));
  return {
    antes: naRef.length,
    depois: naData.length,
    fecharam: ordenarConsultas(naRef.filter((x) => !idsData.has(x.id))),
    abriram: ordenarConsultas(naData.filter((x) => !idsRef.has(x.id))),
  };
}

/** Frase que concilia a contagem da data de referência com a da data de leitura; vazia quando as duas datas coincidem. */
export function textoMudancaDeAbertas(itens: readonly Consulta[], referencia: string, data: string): string {
  if (data <= referencia) return "";
  const m = mudancasDeAbertas(itens, referencia, data);
  const fim = (x: ConsultaNaData) => `${x.rotulo}, prazo até ${dataBR(x.fim)}`;
  const partes = [`Em ${dataBR(referencia)} eram ${num(m.antes, 0)} abertas; em ${dataBR(data)}, ${pl(m.depois, "é", "são")} ${num(m.depois, 0)}.`];
  if (m.fecharam.length) partes.push(`${pl(m.fecharam.length, "Encerrou o prazo", "Encerraram o prazo")} no intervalo: ${listaComE(m.fecharam.map(fim))}.`);
  if (m.abriram.length) partes.push(`${pl(m.abriram.length, "Passou a receber contribuições", "Passaram a receber contribuições")} no intervalo: ${listaComE(m.abriram.map((x) => `${x.rotulo}, desde ${dataBR(x.inicio)}`))}.`);
  return partes.join(" ");
}

/**
 * Veredito da Agenda Regulatória: quantas atividades a ANEEL prevê no biênio, quantas tratam dos limites do PLD e o limite
 * de leitura (o ano é previsão).
 */
export function vereditoAgenda(a: GoldRegulacao["agenda"], limites: GoldRegulacao["limites_em_revisao"]): string {
  if (!a.disponivel) return `A Agenda Regulatória não está disponível nesta publicação: ${a.motivo ?? "motivo não informado"}.`;
  const n = a.itens.length;
  const k = limites.length;
  return `A ${nomeAgenda(a)} prevê ${num(n, 0)} ${pl(n, "atividade", "atividades")}; ${num(k, 0)} ${pl(k, "trata", "tratam")} dos limites do PLD. O ano de cada uma é uma previsão da ANEEL, que pode mudar.`;
}
