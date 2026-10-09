"use client";

import { useId, useRef, useState } from "react";
import type { Proveniencia } from "@/lib/energia/tipos";
import { NATUREZAS } from "@/components/evidencia/SeloNatureza";
import { TextoEnergia } from "@/components/energia/TextoEnergia";
import type { ClasseLiteral } from "@/lib/literais-fonte";

/**
 * Drawer "Sobre este dado": o caminho número → série → transformação → fonte
 * original. <dialog> nativo com showModal(): foco preso, Esc fecha, fundo inerte.
 * Em celular ocupa a tela inteira.
 */

function dataHora(iso: string | null | undefined): string {
  if (!iso) return "não informado pela fonte";
  const temHora = iso.length > 10;
  if (!temHora) {
    const [a, m, d] = iso.split("-");
    if (d === undefined) return m === undefined ? a : `${m}/${a}`;
    return `${d}/${m}/${a}`;
  }
  if (!iso.endsWith("Z") && !iso.includes("+") && /T\d\d:\d\d$/.test(iso)) {
    const [dia, hora] = iso.split("T");
    const [a, m, d] = dia.split("-");
    return `${d}/${m}/${a} às ${hora} (Brasília)`;
  }
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
    }) + " (Brasília)"
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
function textoSemRevisao(rev: NonNullable<Proveniencia["revisoes_conhecidas"]>): string {
  const quando = `Verificação em ${dataHora(rev.detectado_em)}`;
  const recap = rev.recapturas_sem_mudanca ?? 0;
  const identicos =
    recap > 0
      ? `${recap} ${recap === 1 ? "download posterior veio idêntico" : "downloads posteriores vieram idênticos"} a arquivos já integrados${
          rev.ultimo_download_ok ? `, o último em ${dataHora(rev.ultimo_download_ok)}` : ""
        }; arquivo idêntico não gera captura nova.`
      : "";
  const umaPorArquivo = rev.vintages_comparadas !== undefined && rev.arquivos !== undefined && rev.vintages_comparadas <= rev.arquivos;
  if (umaPorArquivo && recap === 0)
    return `Ainda não é possível detectar revisões: há uma única captura de cada um dos ${rev.arquivos} arquivos integrados. A detecção começa na segunda captura de um arquivo. ${quando}.`;
  if (umaPorArquivo)
    return `Nenhuma revisão detectada: cada um dos ${rev.arquivos} arquivos integrados tem uma captura, e ${identicos} ${quando}.`;
  return `Nenhuma revisão detectada entre ${rev.vintages_comparadas ?? "as"} capturas distintas de ${rev.arquivos ?? "todos os"} arquivos integrados.${identicos ? ` Além disso, ${identicos}` : ""} ${quando}.`;
}

/** Literais que o registro reconhece em texto de proveniência (descrição da fonte, limitações, transformações). */
const LITERAIS_NA_PROVENIENCIA: ClasseLiteral[] = ["texto-direitos-camada", "marcador-ausencia-siga", "data-fim-fora-da-cronologia"];

export function SobreEsteDado({ p, rotulo = "Sobre este dado" }: { p: Proveniencia; rotulo?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  // o corpo do diálogo só se vê depois de abri-lo: monta na primeira abertura e não pesa no HTML de cada página (cerca de 7 kB por diálogo)
  const [montado, setMontado] = useState(false);
  const n = NATUREZAS[p.natureza];
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
        <span aria-hidden="true">ⓘ</span> {rotulo}
        <span className="sr-only">: {p.indicador}</span>
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
              <p className="rotulo text-mineral">Sobre este dado</p>
              <h2 id={tituloId} className="mt-2 font-serif text-xl leading-snug text-carvao">
                {p.indicador}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="rotulo min-h-[44px] min-w-[44px] text-mineral hover:text-carvao"
              aria-label="Fechar"
            >
              ✕
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-6 py-2" tabIndex={0} role="region" aria-label={`Proveniência: ${p.indicador}`}>
            {montado && <dl>
              <Linha rotulo="Natureza">
                <strong>{n.rotulo}.</strong> {n.definicao}
              </Linha>
              <Linha rotulo="Fonte primária">
                {p.fonte.orgao} · {p.fonte.dataset}
                <br />
                <span className="text-mineral">{p.fonte.recurso}</span>
              </Linha>
              <Linha rotulo="Unidade">{p.unidade}</Linha>
              <Linha rotulo="Frequência">{p.frequencia}</Linha>
              <Linha rotulo="Período de referência">
                {dataHora(p.periodo_referencia.inicio)} a {dataHora(p.periodo_referencia.fim)}
              </Linha>
              <Linha rotulo="Publicado pela fonte em">
                {p.publicado_pela_fonte_em ? `${dataHora(p.publicado_pela_fonte_em)} (arquivo mais recente, data de modificação informada pela fonte)` : "não informado pela fonte"}
              </Linha>
              <Linha rotulo="Capturado pela Scrutiniums em">{dataHora(p.capturado_em)}</Linha>
              <Linha rotulo="Última validação">{dataHora(p.validado_em)}</Linha>
              <Linha rotulo="Cobertura histórica">
                {dataHora(p.cobertura_historica.inicio)} a {dataHora(p.cobertura_historica.fim)}
              </Linha>
              <Linha rotulo="Transformações">
                {p.transformacoes.length ? (
                  <ol className="list-decimal space-y-1 pl-5">
                    {p.transformacoes.map((t) => (
                      <li key={t}>
                        <TextoEnergia texto={t} origem={p.fonte.url_dataset} literais={LITERAIS_NA_PROVENIENCIA} />
                      </li>
                    ))}
                  </ol>
                ) : (
                  "Nenhuma além da leitura do arquivo da fonte."
                )}
              </Linha>
              {p.formula && (
                <Linha rotulo="Fórmula">
                  <code className="block whitespace-pre-wrap break-words bg-papel px-2 py-1.5 font-mono text-[0.8rem]">{p.formula}</code>
                </Linha>
              )}
              <Linha rotulo="Snapshot">
                <span className="break-all font-mono text-[0.78rem]">{p.snapshot.id ?? "não informado"}</span>
                {p.snapshot.sha256 && (
                  <>
                    <br />
                    <span className="break-all font-mono text-[0.72rem] text-mineral">sha256 {p.snapshot.sha256}</span>
                  </>
                )}
              </Linha>
              <Linha rotulo="Versão do processamento">
                {p.versao_pipeline}
                {p.versao_codigo && (
                  <span className="text-mineral">
                    {" "}
                    · código {p.versao_codigo}
                    {p.versao_codigo.endsWith("+alterado") ? " (o código tinha mudanças ainda não registradas quando a base foi gerada)" : ""}
                  </span>
                )}
              </Linha>
              <Linha rotulo="Revisões conhecidas">
                {!rev ? (
                  "Detecção de revisões não disponível para este indicador."
                ) : rev.total === 0 ? (
                  textoSemRevisao(rev)
                ) : (
                  <>
                    {rev.total.toLocaleString("pt-BR")} observações com valor revisado pela fonte entre as vintages integradas. Mais recentes:{" "}
                    {rev.exemplos.slice(0, 5).map((e) => `${e.serie} em ${dataHora(e.ref)}`).join("; ")}. Verificação em {dataHora(rev.detectado_em)}.
                  </>
                )}
              </Linha>
              <Linha rotulo="Limitações">
                <ul className="list-disc space-y-1.5 pl-5">
                  {p.limitacoes.map((l) => (
                    <li key={l}>
                      <TextoEnergia texto={l} origem={p.fonte.url_dataset} literais={LITERAIS_NA_PROVENIENCIA} />
                    </li>
                  ))}
                </ul>
              </Linha>
              <Linha rotulo="Licença e condições de uso">{p.fonte.licenca}</Linha>
              {p.notas_fonte && (
                <Linha rotulo="Descrição da fonte">
                  <span className="whitespace-pre-line text-carvao-muted">
                    <TextoEnergia texto={p.notas_fonte} origem={p.fonte.url_dataset} literais={LITERAIS_NA_PROVENIENCIA} />
                  </span>
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
                Baixar série (CSV)
              </a>
            )}
            {montado && (
              <a
                href={p.fonte.url_dataset}
                target="_blank"
                rel="noopener noreferrer"
                className="rotulo inline-flex min-h-[44px] items-center border border-linha px-4 text-carvao hover:border-carvao"
              >
                Abrir fonte primária ↗
              </a>
            )}
          </footer>
        </div>
      </dialog>
    </>
  );
}
