"use client";

import { useEffect, useState } from "react";
import type { Idioma } from "@/lib/idioma";
import {
  dataPublicacao,
  instante,
  rotuloReferencia,
  situacaoDominio,
  textoRegra,
  textoSituacao,
  textosDominio,
  type DadosFrescor,
  type SituacaoDominio,
} from "@/lib/frescor";

export type VarianteFaixa = "linha" | "metodo";

type Props = {
  dados: DadosFrescor[];
  variante: VarianteFaixa;
  idioma?: Idioma;
  /** Classe do contêiner da linha, para alinhar à grade da página (ex.: "ed-pagina"); o fio fica na largura do conteúdo. */
  conteiner?: string;
  className?: string;
};

/**
 * Faixa de frescor. O HTML do build traz só as datas (iguais no servidor e no
 * navegador); a situação é calculada no navegador, com o relógio de quem lê, e
 * recalculada a cada hora. Uma página estática não congela o "em dia".
 */
export function FaixaFrescorCliente(props: Props) {
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    const atualiza = () => setAgora(new Date());
    atualiza();
    const id = window.setInterval(atualiza, 3_600_000);
    return () => window.clearInterval(id);
  }, []);
  return <ConteudoFaixaFrescor {...props} agora={agora} />;
}

const TEXTOS = {
  pt: {
    rotulo: "Atualização dos dados",
    atualizadoEm: "Atualizado em",
    referencia: "Referência",
    cadencia: "Cadência",
    naoInformada: "data não informada",
    refNaoInformada: "não informada",
    fontes: (n: number) => `${n} fontes`,
    entre: (a: string, b: string) => (a === b ? `Atualizadas em ${a}` : `Atualizadas entre ${a} e ${b}`),
    todas: "Todas em dia",
    porFonte: "Por fonte",
    fontesReferencia: "Fontes e referência",
    atrasadasDe: (k: number, n: number) => (k === 1 ? `Atualização atrasada em 1 de ${n} fontes` : `Atualização atrasada em ${k} de ${n} fontes`),
    fechar: "Fechar",
  },
  en: {
    rotulo: "Data updates",
    atualizadoEm: "Updated on",
    referencia: "Reference",
    cadencia: "Frequency",
    naoInformada: "date not reported",
    refNaoInformada: "not reported",
    fontes: (n: number) => `${n} sources`,
    entre: (a: string, b: string) => (a === b ? `Updated on ${a}` : `Updated between ${a} and ${b}`),
    todas: "All up to date",
    porFonte: "By source",
    fontesReferencia: "Sources and reference",
    atrasadasDe: (k: number, n: number) => `Update late in ${k} of ${n} sources`,
    fechar: "Close",
  },
};

/** Marcador neutro de aviso: triângulo na cor do texto, sempre ao lado de texto explícito. */
function Marcador() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="inline-block h-[1em] w-[1em] shrink-0 self-center" focusable="false">
      <path d="M8 1.75 14.75 13.5H1.25z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 6.25v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11.6" r="0.85" fill="currentColor" />
    </svg>
  );
}

/** "Atualização atrasada" depois de "Setor Elétrico: " vira "atualização atrasada"; siglas (PLD) ficam. */
const minuscula = (t: string) => (/^[A-ZÀ-Ý][a-zà-ÿ]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);

function Situacao({ s, idioma, prefixo }: { s: SituacaoDominio; idioma: Idioma; prefixo?: string }) {
  const aviso = s.estado === "atrasado" || s.estado === "retida";
  return (
    <span data-frescor-estado={s.estado} className={`inline-flex items-baseline gap-1.5 ${aviso ? "font-medium text-carvao" : "text-carvao-muted"}`}>
      {aviso && <Marcador />}
      <span>
        {prefixo ? `${prefixo}: ` : ""}
        {prefixo ? minuscula(textoSituacao(s, idioma)) : textoSituacao(s, idioma)}
      </span>
    </span>
  );
}

/** Os quatro campos de um domínio: data, referência, cadência e situação. */
function Campos({ d, s, idioma }: { d: DadosFrescor; s: SituacaoDominio | null; idioma: Idioma }) {
  const t = TEXTOS[idioma];
  const x = textosDominio(d.id, idioma);
  const ref = rotuloReferencia(d.referencia, idioma);
  return (
    <>
      <span data-frescor-campo="atualizado">
        <span className="text-mineral">{t.atualizadoEm}</span> <span className="tabular-nums text-carvao">{dataPublicacao(d.publicadoEm, idioma) ?? t.naoInformada}</span>
      </span>
      <span data-frescor-campo="referencia">
        <span className="text-mineral">{t.referencia}</span>{" "}
        <span className="tabular-nums text-carvao">{ref ?? t.refNaoInformada}</span>
        {ref && <span className="text-carvao-muted"> ({x.referencia})</span>}
      </span>
      <span data-frescor-campo="cadencia">
        <span className="text-mineral">{t.cadencia}</span> <span className="text-carvao">{x.cadencia}</span>
      </span>
      {s && <Situacao s={s} idioma={idioma} />}
    </>
  );
}

/** Lista por fonte, com a nota de cada domínio e a regra: usada no método e no "Por fonte" da linha. */
function ListaPorFonte({ dados, situacoes, idioma }: { dados: DadosFrescor[]; situacoes: (SituacaoDominio | null)[]; idioma: Idioma }) {
  return (
    <>
      <ul className="divide-y divide-linha border-y border-linha">
        {dados.map((d, i) => {
          const x = textosDominio(d.id, idioma);
          return (
            <li key={d.id} data-frescor-dominio={d.id} className="grid gap-x-8 gap-y-1 py-3 md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
              <p className="min-w-0 text-sm leading-snug">
                <span className="block font-medium text-carvao">{x.nome}</span>
                <span className="block text-xs text-mineral">{x.rotulo}</span>
              </p>
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm leading-snug">
                  <Campos d={d} s={situacoes[i]} idioma={idioma} />
                </p>
                <p className="mt-1 max-w-prose2 text-xs leading-relaxed text-mineral">{x.nota}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-mineral" data-frescor-regra="">
        {textoRegra(idioma)}
      </p>
    </>
  );
}

/** Apresentação pura: `agora` nulo é o HTML do build, antes do cálculo no navegador. */
export function ConteudoFaixaFrescor({ dados, variante, idioma = "pt", conteiner = "", className = "", agora }: Props & { agora: Date | null }) {
  const t = TEXTOS[idioma];
  const situacoes = dados.map((d) => (agora ? situacaoDominio(d, agora) : null));
  const estadoGeral = agora ? (situacoes.some((s) => s && s.estado !== "em-dia") ? "aviso" : "em-dia") : "calculando";

  if (variante === "metodo") {
    return (
      <div className={className} data-frescor-faixa="metodo" data-frescor-geral={estadoGeral}>
        <p className="rotulo mb-2 text-mineral">{t.rotulo}</p>
        <ListaPorFonte dados={dados} situacoes={situacoes} idioma={idioma} />
      </div>
    );
  }

  // uma linha só, logo abaixo da navegação: entra no orçamento de cromo (Iniciativa 2 do parecer de UX de 21/10/2026)
  const linhaBase = "flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2 text-[0.8125rem] leading-snug text-carvao-muted";
  const alternar = (rotulo: string) => (
    // a linha inteira é o alvo de toque do <summary>; o rótulo não aumenta a altura da linha
    <span className="inline-flex items-center text-carvao underline decoration-linha underline-offset-4">
      <span className="group-open/frescor:hidden">{rotulo} +</span>
      <span className="hidden group-open/frescor:inline">{t.fechar} −</span>
    </span>
  );

  if (dados.length === 1) {
    const d = dados[0];
    const ref = rotuloReferencia(d.referencia, idioma);
    const x = textosDominio(d.id, idioma);
    return (
      <div className={`${conteiner} ${className}`} data-frescor-faixa="linha" data-frescor-geral={estadoGeral}>
        {/* de 640 px em diante: os quatro campos numa linha */}
        <p className={`hidden border-b border-linha sm:flex ${linhaBase}`}>
          <span className="rotulo text-mineral">{t.rotulo}</span>
          <span className="text-carvao">{x.rotulo}</span>
          <Campos d={d} s={situacoes[0]} idioma={idioma} />
        </p>
        {/* no celular: a data e a situação; a fonte, a referência e a cadência ficam em "Fontes e referência" */}
        <details className="group/frescor border-b border-linha sm:hidden">
          <summary className={`${linhaBase} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
            <span>
              <span className="text-mineral">{t.atualizadoEm}</span> <span className="tabular-nums text-carvao">{dataPublicacao(d.publicadoEm, idioma) ?? t.naoInformada}</span>
            </span>
            {situacoes[0] && <Situacao s={situacoes[0]} idioma={idioma} />}
            {alternar(t.fontesReferencia)}
          </summary>
          <p className={`${linhaBase} pt-0`}>
            <span className="text-carvao">{x.rotulo}</span>
            <span>
              <span className="text-mineral">{t.referencia}</span> <span className="tabular-nums text-carvao">{ref ?? t.refNaoInformada}</span>
              {ref && <span className="text-carvao-muted"> ({x.referencia})</span>}
            </span>
            <span>
              <span className="text-mineral">{t.cadencia}</span> <span className="text-carvao">{x.cadencia}</span>
            </span>
          </p>
        </details>
      </div>
    );
  }

  // várias fontes: resumo numa linha e a lista por fonte recolhida
  const ordenadas = dados
    .flatMap((d) => {
      const t = instante(d.publicadoEm);
      return t ? [{ iso: d.publicadoEm, t: t.getTime() }] : [];
    })
    .sort((a, b) => a.t - b.t);
  const maisAntiga = ordenadas.length ? dataPublicacao(ordenadas[0].iso, idioma) : null;
  const maisRecente = ordenadas.length ? dataPublicacao(ordenadas[ordenadas.length - 1].iso, idioma) : null;
  const fora = dados.flatMap((d, i) => (situacoes[i] && situacoes[i]!.estado !== "em-dia" ? [{ d, s: situacoes[i]! }] : []));
  return (
    <div className={`${conteiner} ${className}`} data-frescor-faixa="linha" data-frescor-geral={estadoGeral}>
      <details className="group/frescor border-b border-linha">
        <summary className={`${linhaBase} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
          {/* no celular ficam só as datas e a situação; o rótulo e a contagem de fontes voltam de 640 px em diante */}
          <span className="rotulo hidden text-mineral sm:inline">{t.rotulo}</span>
          <span className="hidden text-carvao sm:inline">{t.fontes(dados.length)}</span>
          {/* com atraso, o celular mostra só a frase do atraso (as datas de cada fonte estão na lista); sem atraso, as datas e "Todas em dia" */}
          <span className={fora.length > 0 ? "hidden tabular-nums sm:inline" : "tabular-nums"}>{maisAntiga && maisRecente ? t.entre(maisAntiga, maisRecente) : t.naoInformada}</span>
          {agora && fora.length === 0 && <span data-frescor-estado="em-dia">{t.todas}</span>}
          {fora.map(({ d, s }) => (
            <span key={d.id} className="hidden sm:contents">
              <Situacao s={s} idioma={idioma} prefixo={textosDominio(d.id, idioma).nome} />
            </span>
          ))}
          {/* no celular, uma frase só para os atrasos; quais e há quanto tempo ficam na lista por fonte */}
          {fora.length > 0 && (
            <span data-frescor-estado="resumo" className="inline-flex items-baseline gap-1.5 font-medium text-carvao sm:hidden">
              <Marcador />
              <span>{t.atrasadasDe(fora.length, dados.length)}</span>
            </span>
          )}
          <span className="hidden sm:contents">{alternar(t.porFonte)}</span>
          <span className="contents sm:hidden">{alternar(t.fontesReferencia)}</span>
        </summary>
        <div className="pb-4 pt-1">
          <ListaPorFonte dados={dados} situacoes={situacoes} idioma={idioma} />
        </div>
      </details>
    </div>
  );
}
