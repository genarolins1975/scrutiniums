"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { carimbo, datasLegiveis } from "@/lib/energia/formato";
import { rotuloFicha } from "@/lib/energia/i18n/aprenda";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { MENSAGEM_COPIA_EN, unidadeNoIdioma, valorGoldNoIdioma } from "@/lib/energia/i18n/nucleo";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";
import { carregaJson, lerCaminho } from "@/lib/energia/carregaJson";
import {
  MENSAGEM_COPIA,
  ROTULO_RESULTADO,
  citacaoAcademica,
  citacaoBase,
  copiarComFallback,
  dataRef,
  ehResultado,
  numeroCompleto,
  problemasEvidencia,
  resumoChaves,
  resumoTestes,
  textoPeriodo,
  textoReproducao,
  type ArquivoEvidencia,
  type Evidencia,
  type ResultadoCopia,
  type TermoRazao,
} from "@/lib/energia/evidencia";

/**
 * "Comprove este número" (seção 11.5 da especificação): link discreto ao lado de
 * um KPI, célula ou agregado de gráfico que abre a ficha de prova daquele número,
 * em dez seções numeradas: valor exibido e valor antes do arredondamento; recorte;
 * arquivo com sha256; chaves de origem; fórmula com numerador e denominador;
 * cobertura e ausências; versão e revisões; testes e reconciliação com rótulo
 * textual; download com passos de reprodução; e citação acadêmica com a data de
 * acesso do leitor.
 *
 * Diferente de SobreEsteDado, que descreve a SÉRIE (fonte, frequência, cobertura
 * histórica, transformações), esta ficha prova UM número. Mesmo padrão de diálogo:
 * <dialog> nativo com showModal() (foco preso, Esc fecha, fundo inerte), tela cheia
 * no celular e foco devolvido ao botão que abriu. O conteúdo é montado só na
 * primeira abertura, para não repetir no HTML de cada KPI uma ficha que quase
 * ninguém abre (os dados já seguem nas props); o servidor entrega o botão e a
 * moldura do diálogo com título. Sem animação.
 *
 * Em páginas com dezenas de fichas, as props de cada evidência pesariam centenas de
 * KB no HTML e no fluxo RSC (seção 5.1 do contrato): `sobDemanda` troca a prop pela
 * URL de um JSON publicado e pelo caminho da evidência dentro dele; a ficha é lida
 * na primeira abertura (uma leitura por URL, compartilhada entre as fichas).
 */

export type ComproveNumeroProps = {
  evidencia?: Evidencia;
  /** Evidência lida sob demanda ao abrir: JSON publicado, caminho dentro dele e o que o botão anuncia. */
  sobDemanda?: { url: string; caminho: string; indicador: string; valorExibido: string };
  /** "link": texto discreto "Comprove este número"; "valor": o próprio número exibido vira o gatilho (células e agregados). */
  variante?: "link" | "valor";
  rotulo?: string;
  /** Página e âncora onde o número aparece, para a citação apontar ao lugar exato. */
  endereco?: string;
};

export function ComproveNumero({ evidencia, sobDemanda, variante = "link", rotulo: rotuloDado, endereco }: ComproveNumeroProps) {
  const tx = useTx();
  const idioma = useIdioma();
  const rotulo = rotuloDado ?? tx("Comprove este número", "Check this number");
  const ref = useRef<HTMLDialogElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const [montado, setMontado] = useState(false);
  const [acesso, setAcesso] = useState<Date | null>(null);
  const [carregada, setCarregada] = useState<Evidencia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ev = evidencia ?? carregada;
  // o nome que a página passa (sobDemanda) vale mais que o indicador técnico da gold, que pode citar códigos internos
  // em inglês, o indicador da gold sai pela tabela do Aprenda (rotuloFicha) e o valor escrito pela gold ganha a grafia inglesa; sem
  // tradução exata, o indicador fica em português (no título do diálogo, marcado)
  const indicadorGold = ev?.indicador ? (rotuloFicha(ev.indicador, idioma) ?? ev.indicador) : "";
  const indicador = sobDemanda?.indicador ?? indicadorGold;
  const valorExibido = ev?.valor_exibido ? valorGoldNoIdioma(ev.valor_exibido, idioma).texto : (sobDemanda?.valorExibido ?? "");
  // o diálogo vai para o fim do <body> e só existe no cliente: o botão pode ficar dentro de um
  // parágrafo (variante "valor") sem que o <dialog> feche o <p> e quebre a hidratação
  const [alvo, setAlvo] = useState<HTMLElement | null>(null);
  useEffect(() => setAlvo(document.body), []);

  const abrir = () => {
    setMontado(true);
    setAcesso(new Date());
    ref.current?.showModal();
    if (!ev && sobDemanda && !erro) {
      carregaJson<unknown>(sobDemanda.url)
        .then((j) => {
          const e = lerCaminho(j, sobDemanda.caminho);
          if (e && typeof e === "object") setCarregada(e as Evidencia);
          else setErro(tx(`Evidência não encontrada em ${sobDemanda.caminho} de ${sobDemanda.url}.`, `Evidence not found at ${sobDemanda.caminho} in ${sobDemanda.url}.`));
        })
        .catch((x: unknown) => setErro(x instanceof Error ? x.message : String(x)));
    }
  };

  return (
    <>
      <button
        ref={gatilho}
        type="button"
        onClick={abrir}
        aria-haspopup="dialog"
        data-comprove=""
        className={
          variante === "valor"
            ? "inline-flex min-h-[44px] min-w-[44px] items-center tabular-nums text-carvao underline decoration-energia decoration-dotted underline-offset-4 hover:text-energia-dark"
            : "rotulo inline-flex min-h-[44px] items-center text-energia-dark underline decoration-energia/40 underline-offset-4 hover:text-carvao"
        }
      >
        {variante === "valor" ? (
          <>
            {ev?.valor_exibido ? <ValorGold valor={ev.valor_exibido} /> : valorExibido}
            <span className="sr-only">
              {tx(": comprove este número (", ": check this number (")}
              {indicador})
            </span>
          </>
        ) : (
          <>
            {rotulo}
            <span className="sr-only">: {indicador}, {valorExibido}</span>
          </>
        )}
      </button>
      {alvo &&
        createPortal(
          <DialogoEvidencia evidencia={ev} titulo={indicador} valor={valorExibido} erro={erro} dialogo={ref} gatilho={gatilho} montado={montado} acesso={acesso} endereco={endereco} />,
          alvo,
        )}
    </>
  );
}

/** O diálogo da ficha, fechado por padrão; o conteúdo só é montado na primeira abertura. */
export function DialogoEvidencia({
  evidencia: ev,
  titulo,
  valor,
  erro,
  dialogo,
  gatilho,
  montado,
  acesso,
  endereco,
}: {
  evidencia: Evidencia | null;
  /** Título e valor anunciados enquanto a evidência sob demanda ainda não chegou. */
  titulo?: string;
  valor?: string;
  erro?: string | null;
  dialogo: RefObject<HTMLDialogElement>;
  gatilho: RefObject<HTMLButtonElement>;
  montado: boolean;
  acesso: Date | null;
  endereco?: string;
}) {
  const tx = useTx();
  const idioma = useIdioma();
  const indicadorEn = ev?.indicador ? rotuloFicha(ev.indicador, idioma) : null;
  const tituloId = useId();
  const fechar = () => dialogo.current?.close();
  return (
    <dialog
      ref={dialogo}
      aria-labelledby={tituloId}
      onClose={() => gatilho.current?.focus()}
      onClick={(e) => {
        if (e.target === dialogo.current) fechar();
      }}
      className="m-0 ml-auto h-full max-h-none w-full max-w-none bg-superficie p-0 text-carvao backdrop:bg-carvao/40 sm:max-w-2xl"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-linha px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="rotulo text-mineral">{tx("Comprove este número", "Check this number")}</p>
            <h2 id={tituloId} className="mt-2 font-serif text-xl leading-snug text-carvao">
              {titulo ?? (ev ? (indicadorEn ?? <TrechoPortugues regiao="comprove-indicador">{ev.indicador}</TrechoPortugues>) : null)}
            </h2>
            <p className="mt-1 text-sm text-carvao-muted [overflow-wrap:anywhere]">
              <span className="font-medium tabular-nums text-carvao">{ev?.valor_exibido ? <ValorGold valor={ev.valor_exibido} /> : valor}</span>
              {ev && (
                <>
                  {` · ${textoPeriodo(ev.periodo)} · `}
                  <Nome>{ev.entidade}</Nome>
                </>
              )}
            </p>
          </div>
          <button type="button" onClick={fechar} className="rotulo min-h-[44px] min-w-[44px] shrink-0 text-mineral hover:text-carvao" aria-label={tx("Fechar", "Close")}>
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 sm:px-6" tabIndex={0} role="region" aria-label={tx(`Evidência: ${titulo ?? ev?.indicador ?? ""}`, `Evidence: ${titulo ?? ev?.indicador ?? ""}`)}>
          {montado &&
            (ev ? (
              <ConteudoEvidencia evidencia={ev} acesso={acesso} endereco={endereco} />
            ) : (
              <p role="status" aria-live="polite" className={`py-6 text-sm ${erro ? "text-aviso" : "text-carvao-muted"}`}>
                {erro
                  ? tx(`A ficha Comprove não pôde ser lida: ${erro}`, `The evidence sheet could not be read: ${erro}`)
                  : tx("Lendo a ficha Comprove na base publicada…", "Reading the evidence sheet from the published dataset…")}
              </p>
            ))}
        </div>
        <footer className="flex flex-wrap gap-3 border-t border-linha px-5 py-3 sm:px-6">
          <button type="button" onClick={fechar} className="rotulo inline-flex min-h-[44px] items-center border border-linha px-4 text-carvao hover:border-carvao">
            {tx("Fechar", "Close")}
          </button>
        </footer>
      </div>
    </dialog>
  );
}

/* ---------------------------------------------------------------- conteúdo (exportado para teste no servidor) */

export function ConteudoEvidencia({ evidencia: ev, acesso, endereco }: { evidencia: Evidencia; acesso: Date | null; endereco?: string }) {
  const idioma = useIdioma();
  const tx = useTx();
  const en = idioma === "en";
  /** Texto escrito pelo pipeline na evidência (prosa portuguesa): em inglês, marcado como trecho português. */
  const pt = (texto: ReactNode, regiao: string) => (en && texto ? <TrechoPortugues regiao={regiao}>{texto}</TrechoPortugues> : texto);
  const unidade = unidadeNoIdioma(ev.unidade, idioma) ?? pt(ev.unidade, "comprove-unidade");
  const problemas = problemasEvidencia(ev);
  const resumo = resumoTestes(ev.testes);
  const arquivos: ArquivoEvidencia[] = ev.fonte.arquivos?.length ? ev.fonte.arquivos : [ev.fonte];
  const citacao = acesso
    ? citacaoAcademica(ev, acesso, endereco)
    : tx(`${citacaoBase(ev, endereco)} Acesso em: [data do seu acesso].`, `${citacaoBase(ev, endereco)} Accessed on: [date of your access].`);
  return (
    <div className="py-4">
      <p className="text-sm leading-relaxed text-carvao-muted">
        {tx(
          <>
            Esta ficha comprova só este número: de onde veio, como foi calculado e como refazer a conta. A descrição da série inteira fica em &quot;Sobre este
            dado&quot;.
          </>,
          <>
            This sheet proves only this number: where it came from, how it was calculated and how to redo the calculation. The description of the whole series is in
            &quot;About this data&quot;.
          </>,
        )}
      </p>
      {problemas.length > 0 && (
        <div role="note" className="mt-4 border-l-2 border-aviso bg-papel px-4 py-3 text-sm text-carvao">
          <p className="font-medium">
            {tx(
              "Evidência incompleta: esta ficha não cobre tudo o que a prova de um número exige.",
              "Incomplete evidence: this sheet does not cover everything that proving a number requires.",
            )}
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            {problemas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <Secao n={1} titulo={tx("Valor exibido e valor de cálculo", "Displayed value and calculation value")}>
        <dl>
          <Linha rotulo={tx("Valor exibido", "Displayed value")}>
            <span className="font-serif text-2xl tabular-nums text-carvao"><ValorGold valor={ev.valor_exibido} /></span>
          </Linha>
          <Linha rotulo={tx("Valor de cálculo", "Calculation value")}>
            {ev.valor_calculo === null ? (
              <>
                <SemDado />
                <span className="mt-1 block text-carvao-muted">
                  {tx("A fonte não trouxe valor para este recorte; ausência não é zero.", "The source gave no value for this selection; missing is not zero.")}
                </span>
              </>
            ) : (
              <>
                <span className="font-mono tabular-nums">{numeroCompleto(ev.valor_calculo)}</span> {unidade}
                <span className="mt-1 block text-xs text-mineral">
                  {tx("Antes do arredondamento, com todos os algarismos guardados no cálculo.", "Before rounding, with all the digits kept in the calculation.")}
                </span>
              </>
            )}
          </Linha>
        </dl>
      </Secao>

      <Secao n={2} titulo={tx("Unidade, período, entidade, universo e filtros", "Unit, period, entity, universe and filters")}>
        <dl>
          <Linha rotulo={tx("Unidade", "Unit")}>{unidade}</Linha>
          <Linha rotulo={tx("Período", "Period")}>
            {textoPeriodo(ev.periodo)}
            <span className="ml-2 font-mono text-xs text-mineral">
              {ev.periodo.inicio} {tx("a", "to")} {ev.periodo.fim}
            </span>
          </Linha>
          <Linha rotulo={tx("Entidade", "Entity")}>
            <Nome>{ev.entidade}</Nome>
          </Linha>
          <Linha rotulo={tx("Universo", "Universe")}>{pt(ev.universo, "comprove-universo")}</Linha>
          <Linha rotulo={tx("Filtros", "Filters")}>
            <Lista itens={ev.filtros} vazio={tx("Nenhum filtro além do universo.", "No filter beyond the universe.")} idioma={idioma} />
          </Linha>
        </dl>
      </Secao>

      <Secao n={3} titulo={tx("Fonte, recurso e arquivo utilizado", "Source, resource and file used")}>
        <dl>
          <Linha rotulo={tx("Fonte", "Source")}>
            {ev.fonte.orgao} · <Nome>{ev.fonte.conjunto}</Nome>
          </Linha>
          {arquivos.map((a, i) => (
            <Linha key={`${a.arquivo ?? a.recurso ?? "arquivo"}-${i}`} rotulo={arquivos.length > 1 ? tx(`Arquivo ${i + 1}`, `File ${i + 1}`) : tx("Arquivo", "File")}>
              <Arquivo a={a} />
            </Linha>
          ))}
          {ev.extracao_pdf && (
            <Linha rotulo={tx("Extração de PDF", "PDF extraction")}>
              <Nome>{ev.extracao_pdf.documento}</Nome>
              {tx(", edição ", ", edition ")}
              {ev.extracao_pdf.edicao}, {pt(ev.extracao_pdf.pagina, "comprove-pdf-pagina")}.
              <span className="mt-1 block text-carvao-muted">
                {tx("Conferência: ", "Check: ")}
                {pt(ev.extracao_pdf.conferencia, "comprove-pdf-conferencia")}
              </span>
            </Linha>
          )}
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-mineral">
          {tx(
            <>
              O sha256 prova que este é o arquivo usado. A acurácia do número depende da extração, da definição, da transformação e da reconciliação (itens 5 e
              8).
            </>,
            <>
              The sha256 proves that this is the file used. The accuracy of the number depends on the extraction, the definition, the transformation and the
              reconciliation (items 5 and 8).
            </>,
          )}
        </p>
        <a
          href={ev.fonte.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rotulo mt-2 inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao"
        >
          {tx("Abrir fonte primária", "Open primary source")} <span aria-hidden="true">&nbsp;↗</span>
          <span className="sr-only">{tx(" (abre em nova aba)", " (opens in a new tab)")}</span>
        </a>
      </Secao>

      <Secao n={4} titulo={tx("Observações de origem", "Source observations")}>
        <p>{resumoChaves(ev)}</p>
        {ev.chaves_origem.length > 0 && (
          <div
            className="mt-2 max-h-48 overflow-y-auto border border-linha bg-papel px-3 py-2 font-mono text-xs text-carvao [overflow-wrap:anywhere]"
            tabIndex={0}
            role="region"
            aria-label={tx("Chaves das observações de origem", "Keys of the source observations")}
          >
            <ul className="space-y-0.5">
              {ev.chaves_origem.map((c, i) => (
                <li key={`${c}-${i}`}>{c}</li>
              ))}
            </ul>
          </div>
        )}
        {ev.consulta && (
          <>
            <p className="rotulo mt-3 text-mineral">{tx("Consulta que seleciona as observações", "Query that selects the observations")}</p>
            <Codigo>{ev.consulta}</Codigo>
          </>
        )}
        {ev.manifesto && (
          <a href={ev.manifesto.url} download={baixavel(ev.manifesto.url) || undefined} className="rotulo mt-2 inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
            {ev.manifesto.rotulo}
          </a>
        )}
      </Secao>

      <Secao n={5} titulo={tx("Fórmula, numerador, denominador, pesos e exclusões", "Formula, numerator, denominator, weights and exclusions")}>
        <Codigo>{ev.formula}</Codigo>
        <dl className="mt-2">
          <Linha rotulo={tx("Numerador", "Numerator")}>
            <Termo t={ev.numerador} />
          </Linha>
          <Linha rotulo={tx("Denominador", "Denominator")}>
            <Termo t={ev.denominador} />
          </Linha>
          <Linha rotulo={tx("Pesos", "Weights")}>{ev.pesos ? pt(ev.pesos, "comprove-pesos") : tx("Não se aplica: sem ponderação.", "Not applicable: no weighting.")}</Linha>
          <Linha rotulo={tx("Exclusões", "Exclusions")}>
            <Lista itens={ev.exclusoes} vazio={tx("Nenhuma exclusão.", "No exclusions.")} idioma={idioma} />
          </Linha>
        </dl>
      </Secao>

      <Secao n={6} titulo={tx("Cobertura e tratamento de ausências", "Coverage and handling of missing values")}>
        <dl>
          <Linha rotulo={tx("Cobertura", "Coverage")}>{pt(ev.cobertura, "comprove-cobertura")}</Linha>
          <Linha rotulo={tx("Ausências", "Missing values")}>{pt(ev.tratamento_ausencia, "comprove-ausencias")}</Linha>
        </dl>
      </Secao>

      <Secao n={7} titulo={tx("Versão e revisões", "Version and revisions")}>
        <dl>
          <Linha rotulo={tx("Pipeline", "Pipeline")}>{ev.versao.pipeline}</Linha>
          <Linha rotulo={tx("Código", "Code")}>
            {ev.versao.codigo ? <span className="font-mono text-[0.8rem]">{ev.versao.codigo}</span> : tx("não registrado", "not recorded")}
            {ev.versao.codigo?.endsWith("+alterado") && ( // i18n: dado
              <span className="mt-1 block text-carvao-muted">
                {tx(
                  "O código desta execução tinha alterações locais ainda não confirmadas em commit (sufixo +alterado). O sha256 dos arquivos de entrada e o comando de reprodução valem, mas o código exato não se reconstitui a partir do commit: a reprodução pode diferir.",
                  "The code of this run had local changes not yet committed (suffix +alterado). The sha256 of the input files and the reproduction command are valid, but the exact code cannot be rebuilt from the commit: the reproduction may differ.",
                )}
              </span>
            )}
          </Linha>
          <Linha rotulo={tx("Publicado em", "Published on")}>{quando(ev.versao.publicacao, tx("não registrado", "not recorded"), idioma)}</Linha>
          <Linha rotulo={tx("Revisões", "Revisions")}>{pt(ev.revisoes, "comprove-revisoes")}</Linha>
        </dl>
      </Secao>

      <Secao n={8} titulo={tx("Testes executados e reconciliação", "Tests run and reconciliation")}>
        <p>{resumo.texto}</p>
        {ev.testes.length > 0 && (
          <ul className="mt-2 divide-y divide-linha border-y border-linha">
            {ev.testes.map((t, i) => (
              <li key={`${t.nome}-${i}`} className="grid gap-1 py-2.5 sm:grid-cols-[9.5rem_1fr] sm:gap-3">
                <span>
                  <SeloResultado resultado={t.resultado} />
                </span>
                <span>
                  <span className="font-medium text-carvao">{pt(t.nome, "comprove-teste")}</span>
                  {t.detalhe && <span className="block text-carvao-muted">{pt(t.detalhe, "comprove-teste-detalhe")}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="rotulo mt-4 text-mineral">{tx("Reconciliação", "Reconciliation")}</p>
        {ev.reconciliacao ? (
          <div className="mt-1.5 grid gap-1 sm:grid-cols-[9.5rem_1fr] sm:gap-3">
            <span>
              <SeloResultado resultado={ev.reconciliacao.resultado} />
            </span>
            <span>
              {pt(ev.reconciliacao.descricao, "comprove-reconciliacao")}
              <span className="block text-carvao-muted">
                {tx("Tolerância: ", "Tolerance: ")}
                {pt(ev.reconciliacao.tolerancia, "comprove-tolerancia")}
              </span>
            </span>
          </div>
        ) : (
          <p className="mt-1.5 text-carvao-muted">
            {tx("Nenhuma reconciliação por outro caminho ou produto registrada para este número.", "No reconciliation through another path or product is recorded for this number.")}
          </p>
        )}
      </Secao>

      <Secao n={9} titulo={tx("Download e reprodução", "Download and reproduction")}>
        {ev.download.length > 0 ? (
          <ul className="flex flex-wrap gap-x-5">
            {ev.download.map((d) => (
              <li key={d.url}>
                <a href={d.url} download={baixavel(d.url) || undefined} className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                  {pt(datasLegiveis(d.rotulo, "pt"), "comprove-download")}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-carvao-muted">{tx("Sem download publicado para este número.", "No download published for this number.")}</p>
        )}
        <BlocoCopiavel rotulo={tx("Passos de reprodução", "Reproduction steps")} texto={textoReproducao(ev)} rotuloBotao={tx("Copiar passos", "Copy steps")} />
      </Secao>

      <Secao n={10} titulo={tx("Como citar", "How to cite")}>
        <BlocoCopiavel rotulo={tx("Citação acadêmica (ABNT simplificada)", "Academic citation (simplified ABNT)")} texto={citacao} rotuloBotao={tx("Copiar citação", "Copy citation")} />
      </Secao>
    </div>
  );
}

/* ---------------------------------------------------------------- peças */

function Secao({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="border-b border-linha py-5 last:border-b-0">
      <h3 id={id} className="flex items-baseline gap-3 font-serif text-lg leading-snug text-carvao">
        <span className="rotulo w-6 shrink-0 tabular-nums !text-[0.8rem] text-energia-dark">{n}.</span>
        <span>{titulo}</span>
      </h3>
      <div className="mt-2 text-sm leading-relaxed text-carvao sm:pl-9">{children}</div>
    </section>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-linha py-2.5 last:border-b-0 sm:grid-cols-[9.5rem_1fr] sm:gap-3">
      <dt className="rotulo text-mineral">{rotulo}</dt>
      <dd className="min-w-0 text-carvao [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function Lista({ itens, vazio, idioma = "pt" }: { itens: string[]; vazio: string; idioma?: Idioma }) {
  if (!itens.length) return <span className="text-carvao-muted">{vazio}</span>;
  return (
    <ul className="list-disc space-y-0.5 pl-5">
      {itens.map((x, i) => (
        <li key={`${x}-${i}`}>{idioma === "en" ? <TrechoPortugues regiao="comprove-lista">{x}</TrechoPortugues> : x}</li>
      ))}
    </ul>
  );
}

function Codigo({ children }: { children: ReactNode }) {
  return <code className="mt-1 block whitespace-pre-wrap break-words bg-papel px-2 py-1.5 font-mono text-[0.8rem] text-carvao">{children}</code>;
}

/** Ausência com padrão visual próprio (hachura) e texto: nunca zero, nunca traço solto. */
function SemDado() {
  const tx = useTx();
  return (
    <span className="inline-flex items-center gap-2 text-carvao-muted">
      <span
        aria-hidden="true"
        className="inline-block h-3 w-3 border border-mineral"
        style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--cor-mineral) 0 1px, transparent 1px 4px)" }}
      />
      {tx("sem dado", "no data")}
    </span>
  );
}

/** Termo de razão: campo ausente é "não se aplica" (o número não é razão); valor nulo é "sem dado". */
function Termo({ t }: { t: TermoRazao | null | undefined }) {
  const tx = useTx();
  const en = useIdioma() === "en";
  if (!t) return <span className="text-carvao-muted">{tx("Não se aplica: o número não é uma razão.", "Not applicable: the number is not a ratio.")}</span>;
  return (
    <>
      {en ? <TrechoPortugues regiao="comprove-termo">{t.descricao}</TrechoPortugues> : t.descricao}
      <span className="block">{t.valor === null ? <SemDado /> : <span className="font-mono tabular-nums">{numeroCompleto(t.valor)}</span>}</span>
    </>
  );
}

const CLASSE_RESULTADO = {
  aprovado: "border-sucesso text-sucesso",
  ressalva: "border-aviso text-aviso",
  reprovado: "border-erro text-erro",
} as const;

/** Resultado com glifo e palavra (a cor nunca é o único portador). */
function SeloResultado({ resultado }: { resultado: string }) {
  const tx = useTx();
  if (!ehResultado(resultado)) {
    return (
      <span className="rotulo inline-flex items-center gap-1.5 border border-dashed border-mineral bg-superficie px-1.5 py-0.5 text-carvao-muted">
        {tx("? Fora do padrão", "? Non-standard")} ({resultado})
      </span>
    );
  }
  const r = ROTULO_RESULTADO[resultado];
  return (
    <span className={`rotulo inline-flex items-center gap-1.5 whitespace-nowrap border bg-superficie px-1.5 py-0.5 ${CLASSE_RESULTADO[resultado]}`}>
      <span aria-hidden="true">{r.glifo}</span>
      {r.rotulo}
    </span>
  );
}

function Arquivo({ a }: { a: ArquivoEvidencia }) {
  const tx = useTx();
  const idioma = useIdioma();
  return (
    <>
      {a.recurso && (
        <span className="block">
          <Nome>{a.recurso}</Nome>
        </span>
      )}
      {a.arquivo && a.arquivo !== a.recurso && <span className="block font-mono text-xs text-carvao-muted">{a.arquivo}</span>}
      {!a.recurso && !a.arquivo && <span className="block text-carvao-muted">{tx("arquivo não identificado", "file not identified")}</span>}
      <span className="mt-1 block break-all font-mono text-[0.72rem] text-mineral">{a.sha256 ? `sha256 ${a.sha256}` : tx("sha256 não registrado", "sha256 not recorded")}</span>
      <span className="mt-1 block text-xs text-carvao-muted">
        {tx(
          <>
            Capturado em {quando(a.capturado_em, "data não registrada")}; publicado pela fonte em {quando(a.publicado_em, "data não informada pela fonte")}.
          </>,
          <>
            Captured on {quando(a.capturado_em, "date not recorded", idioma)}; published by the source on {quando(a.publicado_em, "date not reported by the source", idioma)}.
          </>,
        )}
      </span>
    </>
  );
}

/** Carimbo com fuso vira horário de Brasília; data local fica como está. */
function quando(iso: string | null | undefined, ausente: string, idioma: Idioma = "pt"): string {
  if (!iso) return ausente;
  if (iso.length > 10 && iso.includes("T") && /(Z|[+-]\d\d:?\d\d)$/.test(iso)) return carimbo(iso, idioma);
  if (idioma === "en") return datasLegiveis(iso.slice(0, 16), "en");
  return dataRef(iso, true) ?? ausente;
}

/** `download` só funciona na mesma origem; endereço externo abre normalmente. */
function baixavel(url: string): boolean {
  return url.startsWith("/");
}

function BlocoCopiavel({ rotulo, texto, rotuloBotao }: { rotulo: string; texto: string; rotuloBotao: string }) {
  const tx = useTx();
  const pre = useRef<HTMLPreElement>(null);
  const rotuloId = useId();
  const [estado, setEstado] = useState<ResultadoCopia | null>(null);

  const copiar = async () => {
    setEstado(null); // limpa antes, para a mesma mensagem ser anunciada de novo
    const r = await copiarComFallback(texto, {
      clipboard: typeof window !== "undefined" && window.isSecureContext && navigator.clipboard ? navigator.clipboard : null,
      selecionar: () => {
        const el = pre.current;
        const sel = typeof window !== "undefined" ? window.getSelection() : null;
        if (!el || !sel) return false;
        const faixa = document.createRange();
        faixa.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(faixa);
        return true;
      },
      copiarSelecao: () => document.execCommand("copy"),
    });
    setEstado(r);
  };

  return (
    <div className="mt-3">
      <p id={rotuloId} className="rotulo text-mineral">
        {rotulo}
      </p>
      <pre
        ref={pre}
        aria-labelledby={rotuloId}
        className="mt-1.5 whitespace-pre-wrap break-words border border-linha bg-papel px-3 py-2.5 font-mono text-[0.78rem] leading-relaxed text-carvao [overflow-wrap:anywhere]"
      >
        {texto}
      </pre>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <button
          type="button"
          onClick={copiar}
          className="rotulo inline-flex min-h-[44px] items-center border border-carvao px-4 text-carvao hover:bg-carvao hover:text-marfim"
        >
          {rotuloBotao}
        </button>
        <span role="status" className="text-xs text-carvao-muted">
          {estado ? tx(MENSAGEM_COPIA[estado], MENSAGEM_COPIA_EN[estado]) : ""}
        </span>
      </div>
    </div>
  );
}

/**
 * valor_exibido da gold no idioma da página: número na grafia inglesa e unidade pela tabela; se sobrar palavra portuguesa sem
 * tradução, o valor original sai marcado como trecho só em português.
 */
function ValorGold({ valor }: { valor: string }) {
  const idioma = useIdioma();
  const r = valorGoldNoIdioma(valor, idioma);
  return r.portugues ? <TrechoPortugues regiao="comprove-valor">{valor}</TrechoPortugues> : <>{r.texto}</>;
}
