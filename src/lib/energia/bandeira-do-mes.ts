import type { Idioma } from "@/lib/idioma";
import { dataBR, mesAno, reais } from "./formato";
import { bandeiraNoIdioma, txEm } from "./i18n/conta-inclusao";
import type { BandeiraVigente } from "./tipos-conta";

/**
 * Bandeira do mês corrente (achado da banca de 19/10/2026: "a bandeira de outubro não está lá").
 *
 * Só o mês corrente pode ser chamado de vigente. A página é estática e pode ser lida num mês posterior ao da gold, então a escolha
 * é refeita com o mês de quem lê (`mesCorrenteBrasilia`) sobre os últimos meses publicados (`recentes` da gold). Sem o mês corrente
 * no arquivo, a página diz que ele ainda não está lá e mostra a última bandeira registrada com o mês dela: o mês que falta nunca é
 * preenchido nem copiado do anterior. Mês seguinte já anunciado pela ANEEL fica como anunciado, nunca no lugar do corrente.
 */

export type MesBandeira = { mes: string; bandeira: string | null; rs_mwh: number | null };

export type SituacaoBandeira =
  | { estado: "corrente"; mesCorrente: string; atual: MesBandeira; anunciada: MesBandeira | null }
  | { estado: "mes_ausente"; mesCorrente: string; ultima: MesBandeira; anunciada: MesBandeira | null }
  | { estado: "sem_dado"; mesCorrente: string; anunciada: MesBandeira | null };

/** Mês corrente em Brasília ('AAAA-MM'), o mesmo fuso da data de referência do pipeline. */
export function mesCorrenteBrasilia(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(agora);
  const ano = partes.find((p) => p.type === "year")?.value ?? String(agora.getUTCFullYear());
  const mes = partes.find((p) => p.type === "month")?.value ?? String(agora.getUTCMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

/** Meses publicados que a gold traz para a escolha (os recentes, ou só o da gold quando a gold é anterior a este campo), sem repetição. */
export function mesesDaBandeira(v: BandeiraVigente | null | undefined): MesBandeira[] {
  if (!v) return [];
  const lista: MesBandeira[] = [...(v.recentes ?? []), ...(v.anunciadas ?? []), { mes: v.mes, bandeira: v.bandeira, rs_mwh: v.rs_mwh }];
  const porMes = new Map<string, MesBandeira>();
  for (const x of lista) if (!porMes.has(x.mes)) porMes.set(x.mes, x);
  return Array.from(porMes.values()).sort((a, b) => a.mes.localeCompare(b.mes));
}

/** Situação da bandeira no mês `mesCorrente`: publicada (corrente), ausente (com a última registrada antes dele) ou sem dado. */
export function situacaoBandeira(v: BandeiraVigente | null | undefined, mesCorrente: string): SituacaoBandeira {
  const meses = mesesDaBandeira(v);
  const anunciada = meses.find((m) => m.mes > mesCorrente) ?? null;
  const atual = meses.find((m) => m.mes === mesCorrente);
  if (atual) return { estado: "corrente", mesCorrente, atual, anunciada };
  const antes = meses.filter((m) => m.mes < mesCorrente);
  const ultima = antes[antes.length - 1];
  if (ultima) return { estado: "mes_ausente", mesCorrente, ultima, anunciada };
  return { estado: "sem_dado", mesCorrente, anunciada };
}

/** O mês que o simulador usa em "bandeira do mês": o corrente, ou a última registrada quando o corrente ainda não está no arquivo. */
export function bandeiraUsada(s: SituacaoBandeira): MesBandeira | null {
  return s.estado === "corrente" ? s.atual : s.estado === "mes_ausente" ? s.ultima : null;
}

function nomeMinusculo(b: string | null, idioma: Idioma): string {
  const tx = txEm(idioma);
  return b ? bandeiraNoIdioma(b, idioma).toLowerCase() : tx("sem nome publicado", "no published name");
}

function valorDoMes(x: MesBandeira, idioma: Idioma): string {
  const tx = txEm(idioma);
  if (x.rs_mwh === null) return tx("sem valor publicado", "no published value");
  if (x.rs_mwh === 0) return tx("sem acréscimo", "no surcharge");
  return tx(`acréscimo de ${reais(x.rs_mwh / 1000, 5, idioma)} por kWh`, `a surcharge of ${reais(x.rs_mwh / 1000, 5, idioma)} per kWh`);
}

/** Frase completa da situação, para o leitor: o mês, a cor e, quando o mês corrente falta, a última registrada com o mês dela. */
export function fraseBandeira(s: SituacaoBandeira, idioma: Idioma): string {
  const tx = txEm(idioma);
  const mc = mesAno(`${s.mesCorrente}-01`, idioma);
  const anunciada = s.anunciada
    ? tx(
        ` A ANEEL já publicou a de ${mesAno(`${s.anunciada.mes}-01`, idioma)}: ${nomeMinusculo(s.anunciada.bandeira, idioma)}.`,
        ` ANEEL has already published the one for ${mesAno(`${s.anunciada.mes}-01`, idioma)}: ${nomeMinusculo(s.anunciada.bandeira, idioma)}.`,
      )
    : "";
  if (s.estado === "corrente")
    return tx(
      `A bandeira de ${mc}, o mês corrente, é ${nomeMinusculo(s.atual.bandeira, idioma)}: ${valorDoMes(s.atual, idioma)}.${anunciada}`,
      `The tariff flag for ${mc}, the current month, is ${nomeMinusculo(s.atual.bandeira, idioma)}: ${valorDoMes(s.atual, idioma)}.${anunciada}`,
    );
  if (s.estado === "mes_ausente") {
    const mu = mesAno(`${s.ultima.mes}-01`, idioma);
    return tx(
      `A bandeira de ${mc} ainda não está no arquivo da ANEEL; a última registrada é a de ${mu} (${nomeMinusculo(s.ultima.bandeira, idioma)}).${anunciada}`,
      `The tariff flag for ${mc} is not yet in ANEEL's file; the latest recorded is the one for ${mu} (${nomeMinusculo(s.ultima.bandeira, idioma)}).${anunciada}`,
    );
  }
  return tx(
    `A bandeira de ${mc} não está no arquivo da ANEEL, e não há bandeira registrada antes dele nesta publicação.${anunciada}`,
    `The tariff flag for ${mc} is not in ANEEL's file, and no earlier tariff flag is recorded in this publication.${anunciada}`,
  );
}

/** Rótulo curto para a lista de datas do cabeçalho. */
export function rotuloBandeira(s: SituacaoBandeira, idioma: Idioma): string {
  const tx = txEm(idioma);
  const mc = mesAno(`${s.mesCorrente}-01`, idioma);
  if (s.estado === "corrente")
    return tx(`${mc}, mês corrente (${nomeMinusculo(s.atual.bandeira, idioma)})`, `${mc}, current month (${nomeMinusculo(s.atual.bandeira, idioma)})`);
  if (s.estado === "mes_ausente") {
    const mu = mesAno(`${s.ultima.mes}-01`, idioma);
    return tx(
      `${mc} ainda não está no arquivo; a última registrada é a de ${mu} (${nomeMinusculo(s.ultima.bandeira, idioma)})`,
      `${mc} not yet in the file; the latest recorded is ${mu} (${nomeMinusculo(s.ultima.bandeira, idioma)})`,
    );
  }
  return tx(`${mc} sem bandeira no arquivo`, `${mc} has no tariff flag in the file`);
}

/** Fonte e data do arquivo de acionamento, para acompanhar a frase. */
export function fonteBandeira(v: BandeiraVigente | null | undefined, idioma: Idioma): string {
  const tx = txEm(idioma);
  const publicado = v?.fonte_publicada_em ? dataBR(v.fonte_publicada_em.slice(0, 10), idioma) : null;
  const capturado = v?.fonte_capturada_em ? dataBR(v.fonte_capturada_em.slice(0, 10), idioma) : null;
  const datas = [
    publicado ? tx(`arquivo atualizado pela fonte em ${publicado}`, `file updated by the source on ${publicado}`) : null,
    capturado ? tx(`lido pelo observatório em ${capturado}`, `read by the observatory on ${capturado}`) : null,
  ].filter(Boolean);
  return tx(
    `Fonte: ANEEL, Bandeiras Tarifárias, recurso Acionamento${datas.length ? ` (${datas.join("; ")})` : ""}.`,
    `Source: ANEEL, Bandeiras Tarifárias (tariff flags), Acionamento resource${datas.length ? ` (${datas.join("; ")})` : ""}.`,
  );
}
