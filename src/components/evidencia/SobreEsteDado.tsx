"use client";

import { useId, useRef, useState } from "react";
import type { Proveniencia } from "@/lib/energia/tipos";
import type { Idioma } from "@/lib/idioma";
import { textoNatureza } from "@/components/evidencia/SeloNatureza";
import { TextoEnergia } from "@/components/energia/TextoEnergia";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { dataBR, carimbo } from "@/lib/energia/formato";
import { FREQUENCIA_EN, LICENCA_EN, traducaoDoDado, unidadeNoIdioma } from "@/lib/energia/i18n/nucleo";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { tx } from "@/lib/energia/idioma";
import type { ClasseLiteral } from "@/lib/literais-fonte";

/**
 * Drawer "Sobre este dado": o caminho número → série → transformação → fonte
 * original. <dialog> nativo com showModal(): foco preso, Esc fecha, fundo inerte.
 * Em celular ocupa a tela inteira.
 *
 * Em inglês, os rótulos são do componente; o que vem da proveniência (indicador, limitações, transformações, descrição da fonte)
 * é texto publicado em português e sai em <TrechoPortugues>, salvo frequência, unidade e licença com tradução exata na tabela.
 */

function dataHora(iso: string | null | undefined, idioma: Idioma = "pt"): string {
  if (!iso) return tx("não informado pela fonte", "not reported by the source", idioma);
  const temHora = iso.length > 10;
  if (!temHora) {
    if (idioma === "en") return dataBR(iso, "en");
    const [a, m, d] = iso.split("-");
    if (d === undefined) return m === undefined ? a : `${m}/${a}`;
    return `${d}/${m}/${a}`;
  }
  if (!iso.endsWith("Z") && !iso.includes("+") && /T\d\d:\d\d$/.test(iso)) {
    const [dia, hora] = iso.split("T");
    const [a, m, d] = dia.split("-");
    return tx(`${d}/${m}/${a} às ${hora} (Brasília)`, `${dataBR(dia, "en")}, ${hora} (Brasília time)`, idioma);
  }
  if (idioma === "en") return carimbo(iso, "en");
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return (
    d.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " (Brasília)" // i18n: dado (ramo português; o inglês sai de carimbo)
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-linha py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="rotulo text-mineral">{rotulo}</dt>
      <dd className="text-sm leading-relaxed text-carvao">{children}</dd>
    </div>
  );
}

/** Texto de "nenhuma revisão", distinguindo arquivo capturado uma vez de arquivo recapturado sem mudança. */
function textoSemRevisao(rev: NonNullable<Proveniencia["revisoes_conhecidas"]>, idioma: Idioma = "pt"): string {
  const quando = tx(`Verificação em ${dataHora(rev.detectado_em)}`, `Checked on ${dataHora(rev.detectado_em, "en")}`, idioma);
  const recap = rev.recapturas_sem_mudanca ?? 0;
  const ultimo = rev.ultimo_download_ok;
  const identicos =
    recap > 0
      ? tx(
          `${recap} ${recap === 1 ? "download posterior veio idêntico" : "downloads posteriores vieram idênticos"} a arquivos já integrados${
            ultimo ? `, o último em ${dataHora(ultimo)}` : ""
          }; arquivo idêntico não gera captura nova.`,
          `${recap} ${recap === 1 ? "later download was identical" : "later downloads were identical"} to files already integrated${
            ultimo ? `, the last one on ${dataHora(ultimo, "en")}` : ""
          }; an identical file does not create a new capture.`,
          idioma,
        )
      : "";
  const umaPorArquivo = rev.vintages_comparadas !== undefined && rev.arquivos !== undefined && rev.vintages_comparadas <= rev.arquivos;
  const arquivosEn = `${rev.arquivos} integrated ${rev.arquivos === 1 ? "file" : "files"}`;
  if (umaPorArquivo && recap === 0)
    return tx(
      `Ainda não é possível detectar revisões: há uma única captura de cada um dos ${rev.arquivos} arquivos integrados. A detecção começa na segunda captura de um arquivo. ${quando}.`,
      `Revisions cannot be detected yet: there is a single capture of each of the ${arquivosEn}. Detection starts with the second capture of a file. ${quando}.`,
      idioma,
    );
  if (umaPorArquivo)
    return tx(
      `Nenhuma revisão detectada: cada um dos ${rev.arquivos} arquivos integrados tem uma captura, e ${identicos} ${quando}.`,
      `No revision detected: each of the ${arquivosEn} has one capture, and ${identicos} ${quando}.`,
      idioma,
    );
  return tx(
    `Nenhuma revisão detectada entre ${rev.vintages_comparadas ?? "as"} capturas distintas de ${rev.arquivos ?? "todos os"} arquivos integrados.${identicos ? ` Além disso, ${identicos}` : ""} ${quando}.`,
    `No revision detected among ${rev.vintages_comparadas === undefined ? "the distinct captures" : `${rev.vintages_comparadas} distinct captures`} of ${
      rev.arquivos === undefined ? "all integrated files" : arquivosEn
    }.${identicos ? ` In addition, ${identicos}` : ""} ${quando}.`,
    idioma,
  );
}

/** Literais que o registro reconhece em texto de proveniência (descrição da fonte, limitações, transformações). */
const LITERAIS_NA_PROVENIENCIA: ClasseLiteral[] = ["texto-direitos-camada", "marcador-ausencia-siga", "data-fim-fora-da-cronologia"];

export function SobreEsteDado({ p, rotulo }: { p: Proveniencia; rotulo?: string }) {
  const idioma = useIdioma();
  const en = idioma === "en";
  const tx = useTx();
  const ref = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  // o corpo do diálogo só se vê depois de abri-lo: monta na primeira abertura e não pesa no HTML de cada página (cerca de 7 kB por diálogo)
  const [montado, setMontado] = useState(false);
  const n = textoNatureza(p.natureza, idioma);
  const dh = (iso: string | null | undefined) => dataHora(iso, idioma);
  /** Texto publicado pela fonte ou pelo pipeline em português: em inglês, marcado como trecho português (datas na língua da frase). */
  const prosa = (texto: string, regiao: string) =>
    en ? (
      <TrechoPortugues regiao={regiao}>
        <TextoEnergia texto={texto} origem={p.fonte.url_dataset} literais={LITERAIS_NA_PROVENIENCIA} idioma="pt" />
      </TrechoPortugues>
    ) : (
      <TextoEnergia texto={texto} origem={p.fonte.url_dataset} literais={LITERAIS_NA_PROVENIENCIA} />
    );
  /** Valor com tradução exata na tabela; sem entrada, o original em TrechoPortugues. */
  const doDado = (valor: string, traduzido: string | null, regiao: string) =>
    traduzido !== null ? traduzido : <TrechoPortugues regiao={regiao}>{valor}</TrechoPortugues>;
  const indicador = en ? <TrechoPortugues regiao="sobre-dado-indicador">{p.indicador}</TrechoPortugues> : p.indicador;
  const rev = p.revisoes_conhecidas;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMontado(true);
          ref.current?.showModal();
        }}
        className="rotulo inline-flex min-h-[44px] items-center gap-1.5 text-energia-dark underline decoration-energia/40 underline-offset-4 hover:text-carvao"
        aria-haspopup="dialog"
      >
        <span aria-hidden="true">ⓘ</span> {rotulo ?? tx("Sobre este dado", "About this data")}
        <span className="sr-only">: {indicador}</span>
      </button>
      <dialog
        ref={ref}
        aria-labelledby={tituloId}
        className="m-0 ml-auto h-full max-h-none w-full max-w-none bg-superficie p-0 text-carvao backdrop:bg-carvao/40 sm:max-w-xl"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
      >
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-linha px-6 py-5">
            <div>
              <p className="rotulo text-mineral">{tx("Sobre este dado", "About this data")}</p>
              <h2 id={tituloId} className="mt-2 font-serif text-xl leading-snug text-carvao">
                {indicador}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="rotulo min-h-[44px] min-w-[44px] text-mineral hover:text-carvao"
              aria-label={tx("Fechar", "Close")}
            >
              ✕
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-6 py-2" tabIndex={0} role="region" aria-label={tx(`Proveniência: ${p.indicador}`, `Provenance: ${p.indicador}`)}>
            {montado && <dl>
              <Linha rotulo={tx("Natureza", "Nature of the data")}>
                <strong>{n.rotulo}.</strong> {n.definicao}
              </Linha>
              <Linha rotulo={tx("Fonte primária", "Primary source")}>
                <Nome>{p.fonte.orgao}</Nome> · <Nome>{p.fonte.dataset}</Nome>
                <br />
                <span className="text-mineral">
                  <Nome>{p.fonte.recurso}</Nome>
                </span>
              </Linha>
              <Linha rotulo={tx("Unidade", "Unit")}>{doDado(p.unidade, unidadeNoIdioma(p.unidade, idioma), "sobre-dado-unidade")}</Linha>
              <Linha rotulo={tx("Frequência", "Frequency")}>{doDado(p.frequencia, traducaoDoDado(FREQUENCIA_EN, p.frequencia, idioma), "sobre-dado-frequencia")}</Linha>
              <Linha rotulo={tx("Período de referência", "Reference period")}>
                {dh(p.periodo_referencia.inicio)} {tx("a", "to")} {dh(p.periodo_referencia.fim)}
              </Linha>
              <Linha rotulo={tx("Publicado pela fonte em", "Published by the source on")}>
                {p.publicado_pela_fonte_em
                  ? tx(
                      `${dataHora(p.publicado_pela_fonte_em)} (arquivo mais recente, data de modificação informada pela fonte)`,
                      `${dh(p.publicado_pela_fonte_em)} (most recent file, modification date reported by the source)`,
                    )
                  : dh(null)}
              </Linha>
              <Linha rotulo={tx("Capturado pela Scrutiniums em", "Captured by Scrutiniums on")}>{dh(p.capturado_em)}</Linha>
              <Linha rotulo={tx("Última validação", "Last validation")}>{dh(p.validado_em)}</Linha>
              <Linha rotulo={tx("Cobertura histórica", "Historical coverage")}>
                {dh(p.cobertura_historica.inicio)} {tx("a", "to")} {dh(p.cobertura_historica.fim)}
              </Linha>
              <Linha rotulo={tx("Transformações", "Transformations")}>
                {p.transformacoes.length ? (
                  <ol className="list-decimal space-y-1 pl-5">
                    {p.transformacoes.map((t) => (
                      <li key={t}>{prosa(t, "sobre-dado-transformacao")}</li>
                    ))}
                  </ol>
                ) : (
                  tx("Nenhuma além da leitura do arquivo da fonte.", "None beyond reading the source file.")
                )}
              </Linha>
              {p.formula && (
                <Linha rotulo={tx("Fórmula", "Formula")}>
                  <code className="block whitespace-pre-wrap break-words bg-papel px-2 py-1.5 font-mono text-[0.8rem]">{p.formula}</code>
                </Linha>
              )}
              <Linha rotulo={tx("Snapshot", "Snapshot")}>
                <span className="break-all font-mono text-[0.78rem]">{p.snapshot.id ?? tx("não informado", "not reported")}</span>
                {p.snapshot.sha256 && (
                  <>
                    <br />
                    <span className="break-all font-mono text-[0.72rem] text-mineral">sha256 {p.snapshot.sha256}</span>
                  </>
                )}
              </Linha>
              <Linha rotulo={tx("Versão do processamento", "Processing version")}>
                {p.versao_pipeline}
                {p.versao_codigo && (
                  <span className="text-mineral">
                    {" "}
                    {tx("· código ", "· code ")}
                    {p.versao_codigo}
                    {p.versao_codigo.endsWith("+alterado") // i18n: dado
                      ? tx(
                          " (o código tinha mudanças ainda não registradas quando a base foi gerada)",
                          " (the code had changes not yet committed when the dataset was generated)",
                        )
                      : ""}
                  </span>
                )}
              </Linha>
              <Linha rotulo={tx("Revisões conhecidas", "Known revisions")}>
                {!rev ? (
                  tx("Detecção de revisões não disponível para este indicador.", "Revision detection is not available for this indicator.")
                ) : rev.total === 0 ? (
                  textoSemRevisao(rev, idioma)
                ) : (
                  tx(
                    <>
                      {rev.total.toLocaleString("pt-BR")} observações com valor revisado pela fonte entre as vintages integradas. Mais recentes:{" "}
                      {/* // i18n: dado (ramo português do tx) */}
                      {rev.exemplos.slice(0, 5).map((e) => `${e.serie} em ${dataHora(e.ref)}`).join("; ")}. Verificação em {dataHora(rev.detectado_em)}.
                    </>,
                    <>
                      {rev.total.toLocaleString("en-US")} {rev.total === 1 ? "observation" : "observations"} with a value revised by the source across
                      the integrated vintages. Most recent:{" "}
                      {rev.exemplos.slice(0, 5).map((e, i) => (
                        <span key={`${e.serie}-${e.ref}`}>
                          {i > 0 && "; "}
                          {/* // i18n: dado (ramo inglês do tx) */}
                          <Nome>{e.serie}</Nome> on {dh(e.ref)}
                        </span>
                      ))}
                      . Checked on {dh(rev.detectado_em)}.
                    </>,
                  )
                )}
              </Linha>
              <Linha rotulo={tx("Limitações", "Limitations")}>
                <ul className="list-disc space-y-1.5 pl-5">
                  {p.limitacoes.map((l) => (
                    <li key={l}>{prosa(l, "sobre-dado-limitacao")}</li>
                  ))}
                </ul>
              </Linha>
              <Linha rotulo={tx("Licença e condições de uso", "License and terms of use")}>
                {doDado(p.fonte.licenca, traducaoDoDado(LICENCA_EN, p.fonte.licenca, idioma), "sobre-dado-licenca")}
              </Linha>
              {p.notas_fonte && (
                <Linha rotulo={tx("Descrição da fonte", "Source description")}>
                  <span className="whitespace-pre-line text-carvao-muted">{prosa(p.notas_fonte, "sobre-dado-fonte")}</span>
                </Linha>
              )}
            </dl>}
          </div>
          <footer className="flex flex-wrap gap-3 border-t border-linha px-6 py-4">
            {montado && p.download && (
              <a
                href={p.download}
                download
                className="rotulo inline-flex min-h-[44px] items-center border border-carvao px-4 text-carvao hover:bg-carvao hover:text-marfim"
              >
                {tx("Baixar série (CSV)", "Download series (CSV)")}
              </a>
            )}
            {montado && (
              <a
                href={p.fonte.url_dataset}
                target="_blank"
                rel="noopener noreferrer"
                className="rotulo inline-flex min-h-[44px] items-center border border-linha px-4 text-carvao hover:border-carvao"
              >
                {tx("Abrir fonte primária ↗", "Open primary source ↗")}
              </a>
            )}
          </footer>
        </div>
      </dialog>
    </>
  );
}
