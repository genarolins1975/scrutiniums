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

  const linhaBase = "flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5 text-[0.8125rem] leading-snug text-carvao-muted";

  if (dados.length === 1) {
    const d = dados[0];
    return (
      <div className={`${conteiner} ${className}`} data-frescor-faixa="linha" data-frescor-geral={estadoGeral}>
        <p className={`border-b border-linha ${linhaBase}`}>
          <span className="rotulo text-mineral">{t.rotulo}</span>
          <span className="text-carvao">{textosDominio(d.id, idioma).rotulo}</span>
          <Campos d={d} s={situacoes[0]} idioma={idioma} />
        </p>
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
          <span className="rotulo text-mineral">{t.rotulo}</span>
          <span className="text-carvao">{t.fontes(dados.length)}</span>
          {maisAntiga && maisRecente ? <span className="tabular-nums">{t.entre(maisAntiga, maisRecente)}</span> : <span>{t.naoInformada}</span>}
          {agora && fora.length === 0 && <span data-frescor-estado="em-dia">{t.todas}</span>}
          {fora.map(({ d, s }) => (
            <Situacao key={d.id} s={s} idioma={idioma} prefixo={textosDominio(d.id, idioma).nome} />
          ))}
          <span className="inline-flex min-h-[24px] items-center text-carvao underline decoration-linha underline-offset-4">
            <span className="group-open/frescor:hidden">{t.porFonte} +</span>
            <span className="hidden group-open/frescor:inline">{t.fechar} −</span>
          </span>
        </summary>
        <div className="pb-4 pt-1">
          <ListaPorFonte dados={dados} situacoes={situacoes} idioma={idioma} />
        </div>
      </details>
    </div>
  );
}
