"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { carimbo } from "@/lib/energia/formato";
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
 */

export type ComproveNumeroProps = {
  evidencia: Evidencia;
  /** "link": texto discreto "Comprove este número"; "valor": o próprio número exibido vira o gatilho (células e agregados). */
  variante?: "link" | "valor";
  rotulo?: string;
  /** Página e âncora onde o número aparece, para a citação apontar ao lugar exato. */
  endereco?: string;
};

export function ComproveNumero({ evidencia: ev, variante = "link", rotulo = "Comprove este número", endereco }: ComproveNumeroProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const tituloId = useId();
  const [montado, setMontado] = useState(false);
  const [acesso, setAcesso] = useState<Date | null>(null);

  const abrir = () => {
    setMontado(true);
    setAcesso(new Date());
    ref.current?.showModal();
  };
  const fechar = () => ref.current?.close();

  return (
    <>
      <button
        ref={gatilho}
        type="button"
        onClick={abrir}
        aria-haspopup="dialog"
        className={
          variante === "valor"
            ? "inline-flex min-h-[44px] min-w-[44px] items-center tabular-nums text-carvao underline decoration-energia decoration-dotted underline-offset-4 hover:text-energia-dark"
            : "rotulo inline-flex min-h-[44px] items-center text-energia-dark underline decoration-energia/40 underline-offset-4 hover:text-carvao"
        }
      >
        {variante === "valor" ? (
          <>
            {ev.valor_exibido}
            <span className="sr-only">: comprove este número ({ev.indicador})</span>
          </>
        ) : (
          <>
            {rotulo}
            <span className="sr-only">: {ev.indicador}, {ev.valor_exibido}</span>
          </>
        )}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={tituloId}
        onClose={() => gatilho.current?.focus()}
        onClick={(e) => {
          if (e.target === ref.current) fechar();
        }}
        className="m-0 ml-auto h-full max-h-none w-full max-w-none bg-superficie p-0 text-carvao backdrop:bg-carvao/40 sm:max-w-2xl"
      >
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-linha px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="rotulo text-mineral">Comprove este número</p>
              <h2 id={tituloId} className="mt-2 font-serif text-xl leading-snug text-carvao">
                {ev.indicador}
              </h2>
              <p className="mt-1 text-sm text-carvao-muted [overflow-wrap:anywhere]">
                <span className="font-medium tabular-nums text-carvao">{ev.valor_exibido}</span> · {textoPeriodo(ev.periodo)} · {ev.entidade}
              </p>
            </div>
            <button type="button" onClick={fechar} className="rotulo min-h-[44px] min-w-[44px] shrink-0 text-mineral hover:text-carvao" aria-label="Fechar">
              ✕
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 sm:px-6" tabIndex={0} role="region" aria-label={`Evidência: ${ev.indicador}`}>
            {montado && <ConteudoEvidencia evidencia={ev} acesso={acesso} endereco={endereco} />}
          </div>
          <footer className="flex flex-wrap gap-3 border-t border-linha px-5 py-3 sm:px-6">
            <button type="button" onClick={fechar} className="rotulo inline-flex min-h-[44px] items-center border border-linha px-4 text-carvao hover:border-carvao">
              Fechar
            </button>
          </footer>
        </div>
      </dialog>
    </>
  );
}

/* ---------------------------------------------------------------- conteúdo (exportado para teste no servidor) */

export function ConteudoEvidencia({ evidencia: ev, acesso, endereco }: { evidencia: Evidencia; acesso: Date | null; endereco?: string }) {
  const problemas = problemasEvidencia(ev);
  const resumo = resumoTestes(ev.testes);
  const arquivos: ArquivoEvidencia[] = ev.fonte.arquivos?.length ? ev.fonte.arquivos : [ev.fonte];
  const citacao = acesso ? citacaoAcademica(ev, acesso, endereco) : `${citacaoBase(ev, endereco)} Acesso em: [data do seu acesso].`;
  return (
    <div className="py-4">
      <p className="text-sm leading-relaxed text-carvao-muted">
        Esta ficha comprova só este número: de onde veio, como foi calculado e como refazer a conta. A descrição da série inteira fica em &quot;Sobre este
        dado&quot;.
      </p>
      {problemas.length > 0 && (
        <div role="note" className="mt-4 border-l-2 border-aviso bg-papel px-4 py-3 text-sm text-carvao">
          <p className="font-medium">Evidência incompleta: esta ficha não cobre tudo o que a prova de um número exige.</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            {problemas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <Secao n={1} titulo="Valor exibido e valor de cálculo">
        <dl>
          <Linha rotulo="Valor exibido">
            <span className="font-serif text-2xl tabular-nums text-carvao">{ev.valor_exibido}</span>
          </Linha>
          <Linha rotulo="Valor de cálculo">
            {ev.valor_calculo === null ? (
              <>
                <SemDado />
                <span className="mt-1 block text-carvao-muted">A fonte não trouxe valor para este recorte; ausência não é zero.</span>
              </>
            ) : (
              <>
                <span className="font-mono tabular-nums">{numeroCompleto(ev.valor_calculo)}</span> {ev.unidade}
                <span className="mt-1 block text-xs text-mineral">Antes do arredondamento, com todos os algarismos guardados no cálculo.</span>
              </>
            )}
          </Linha>
        </dl>
      </Secao>

      <Secao n={2} titulo="Unidade, período, entidade, universo e filtros">
        <dl>
          <Linha rotulo="Unidade">{ev.unidade}</Linha>
          <Linha rotulo="Período">
            {textoPeriodo(ev.periodo)}
            <span className="ml-2 font-mono text-xs text-mineral">
              {ev.periodo.inicio} a {ev.periodo.fim}
            </span>
          </Linha>
          <Linha rotulo="Entidade">{ev.entidade}</Linha>
          <Linha rotulo="Universo">{ev.universo}</Linha>
          <Linha rotulo="Filtros">
            <Lista itens={ev.filtros} vazio="Nenhum filtro além do universo." />
          </Linha>
        </dl>
      </Secao>

      <Secao n={3} titulo="Fonte, recurso e arquivo utilizado">
        <dl>
          <Linha rotulo="Fonte">
            {ev.fonte.orgao} · {ev.fonte.conjunto}
          </Linha>
          {arquivos.map((a, i) => (
            <Linha key={`${a.arquivo ?? a.recurso ?? "arquivo"}-${i}`} rotulo={arquivos.length > 1 ? `Arquivo ${i + 1}` : "Arquivo"}>
              <Arquivo a={a} />
            </Linha>
          ))}
          {ev.extracao_pdf && (
            <Linha rotulo="Extração de PDF">
              {ev.extracao_pdf.documento}, edição {ev.extracao_pdf.edicao}, {ev.extracao_pdf.pagina}.
              <span className="mt-1 block text-carvao-muted">Conferência: {ev.extracao_pdf.conferencia}</span>
            </Linha>
          )}
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-mineral">
          O sha256 prova que este é o arquivo usado. A acurácia do número depende da extração, da definição, da transformação e da reconciliação (itens 5 e
          8).
        </p>
        <a
          href={ev.fonte.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rotulo mt-2 inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao"
        >
          Abrir fonte primária <span aria-hidden="true">&nbsp;↗</span>
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
      </Secao>

      <Secao n={4} titulo="Observações de origem">
        <p>{resumoChaves(ev)}</p>
        {ev.chaves_origem.length > 0 && (
          <ul
            className="mt-2 max-h-48 space-y-0.5 overflow-y-auto border border-linha bg-papel px-3 py-2 font-mono text-xs text-carvao [overflow-wrap:anywhere]"
            tabIndex={0}
            role="region"
            aria-label="Chaves das observações de origem"
          >
            {ev.chaves_origem.map((c, i) => (
              <li key={`${c}-${i}`}>{c}</li>
            ))}
          </ul>
        )}
        {ev.consulta && (
          <>
            <p className="rotulo mt-3 text-mineral">Consulta que seleciona as observações</p>
            <Codigo>{ev.consulta}</Codigo>
          </>
        )}
        {ev.manifesto && (
          <a href={ev.manifesto.url} download={baixavel(ev.manifesto.url) || undefined} className="rotulo mt-2 inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
            {ev.manifesto.rotulo}
          </a>
        )}
      </Secao>

      <Secao n={5} titulo="Fórmula, numerador, denominador, pesos e exclusões">
        <Codigo>{ev.formula}</Codigo>
        <dl className="mt-2">
          <Linha rotulo="Numerador">
            <Termo t={ev.numerador} />
          </Linha>
          <Linha rotulo="Denominador">
            <Termo t={ev.denominador} />
          </Linha>
          <Linha rotulo="Pesos">{ev.pesos ?? "Não se aplica: sem ponderação."}</Linha>
          <Linha rotulo="Exclusões">
            <Lista itens={ev.exclusoes} vazio="Nenhuma exclusão." />
          </Linha>
        </dl>
      </Secao>

      <Secao n={6} titulo="Cobertura e tratamento de ausências">
        <dl>
          <Linha rotulo="Cobertura">{ev.cobertura}</Linha>
          <Linha rotulo="Ausências">{ev.tratamento_ausencia}</Linha>
        </dl>
      </Secao>

      <Secao n={7} titulo="Versão e revisões">
        <dl>
          <Linha rotulo="Pipeline">{ev.versao.pipeline}</Linha>
          <Linha rotulo="Código">
            {ev.versao.codigo ? <span className="font-mono text-[0.8rem]">{ev.versao.codigo}</span> : "não registrado"}
            {ev.versao.codigo?.endsWith("+alterado") && (
              <span className="mt-1 block text-carvao-muted">Publicado com alterações fora do commit: a reprodução pode diferir.</span>
            )}
          </Linha>
          <Linha rotulo="Publicado em">{quando(ev.versao.publicacao, "não registrado")}</Linha>
          <Linha rotulo="Revisões">{ev.revisoes}</Linha>
        </dl>
      </Secao>

      <Secao n={8} titulo="Testes executados e reconciliação">
        <p>{resumo.texto}</p>
        {ev.testes.length > 0 && (
          <ul className="mt-2 divide-y divide-linha border-y border-linha">
            {ev.testes.map((t, i) => (
              <li key={`${t.nome}-${i}`} className="grid gap-1 py-2.5 sm:grid-cols-[9.5rem_1fr] sm:gap-3">
                <span>
                  <SeloResultado resultado={t.resultado} />
                </span>
                <span>
                  <span className="font-medium text-carvao">{t.nome}</span>
                  {t.detalhe && <span className="block text-carvao-muted">{t.detalhe}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="rotulo mt-4 text-mineral">Reconciliação</p>
        {ev.reconciliacao ? (
          <div className="mt-1.5 grid gap-1 sm:grid-cols-[9.5rem_1fr] sm:gap-3">
            <span>
              <SeloResultado resultado={ev.reconciliacao.resultado} />
            </span>
            <span>
              {ev.reconciliacao.descricao}
              <span className="block text-carvao-muted">Tolerância: {ev.reconciliacao.tolerancia}</span>
            </span>
          </div>
        ) : (
          <p className="mt-1.5 text-carvao-muted">Nenhuma reconciliação por outro caminho ou produto registrada para este número.</p>
        )}
      </Secao>

      <Secao n={9} titulo="Download e reprodução">
        {ev.download.length > 0 ? (
          <ul className="flex flex-wrap gap-x-5">
            {ev.download.map((d) => (
              <li key={d.url}>
                <a href={d.url} download={baixavel(d.url) || undefined} className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                  {d.rotulo}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-carvao-muted">Sem download publicado para este número.</p>
        )}
        <BlocoCopiavel rotulo="Passos de reprodução" texto={textoReproducao(ev)} rotuloBotao="Copiar passos" />
      </Secao>

      <Secao n={10} titulo="Como citar">
        <BlocoCopiavel rotulo="Citação acadêmica (ABNT simplificada)" texto={citacao} rotuloBotao="Copiar citação" />
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

function Lista({ itens, vazio }: { itens: string[]; vazio: string }) {
  if (!itens.length) return <span className="text-carvao-muted">{vazio}</span>;
  return (
    <ul className="list-disc space-y-0.5 pl-5">
      {itens.map((x, i) => (
        <li key={`${x}-${i}`}>{x}</li>
      ))}
    </ul>
  );
}

function Codigo({ children }: { children: ReactNode }) {
  return <code className="mt-1 block whitespace-pre-wrap break-words bg-papel px-2 py-1.5 font-mono text-[0.8rem] text-carvao">{children}</code>;
}

/** Ausência com padrão visual próprio (hachura) e texto: nunca zero, nunca traço solto. */
function SemDado() {
  return (
    <span className="inline-flex items-center gap-2 text-carvao-muted">
      <span
        aria-hidden="true"
        className="inline-block h-3 w-3 border border-mineral"
        style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--cor-mineral) 0 1px, transparent 1px 4px)" }}
      />
      sem dado
    </span>
  );
}

/** Termo de razão: campo ausente é "não se aplica" (o número não é razão); valor nulo é "sem dado". */
function Termo({ t }: { t: TermoRazao | null | undefined }) {
  if (!t) return <span className="text-carvao-muted">Não se aplica: o número não é uma razão.</span>;
  return (
    <>
      {t.descricao}
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
  if (!ehResultado(resultado)) {
    return <span className="rotulo inline-flex items-center gap-1.5 border border-dashed border-mineral bg-superficie px-1.5 py-0.5 text-carvao-muted">? Fora do padrão ({resultado})</span>;
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
  return (
    <>
      {a.recurso && <span className="block">{a.recurso}</span>}
      {a.arquivo && a.arquivo !== a.recurso && <span className="block font-mono text-xs text-carvao-muted">{a.arquivo}</span>}
      {!a.recurso && !a.arquivo && <span className="block text-carvao-muted">arquivo não identificado</span>}
      <span className="mt-1 block break-all font-mono text-[0.72rem] text-mineral">{a.sha256 ? `sha256 ${a.sha256}` : "sha256 não registrado"}</span>
      <span className="mt-1 block text-xs text-carvao-muted">
        Capturado em {quando(a.capturado_em, "data não registrada")}; publicado pela fonte em {quando(a.publicado_em, "data não informada pela fonte")}.
      </span>
    </>
  );
}

/** Carimbo com fuso vira horário de Brasília; data local fica como está. */
function quando(iso: string | null | undefined, ausente: string): string {
  if (!iso) return ausente;
  if (iso.length > 10 && iso.includes("T") && /(Z|[+-]\d\d:?\d\d)$/.test(iso)) return carimbo(iso);
  return dataRef(iso, true) ?? ausente;
}

/** `download` só funciona na mesma origem; endereço externo abre normalmente. */
function baixavel(url: string): boolean {
  return url.startsWith("/");
}

function BlocoCopiavel({ rotulo, texto, rotuloBotao }: { rotulo: string; texto: string; rotuloBotao: string }) {
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
          {estado ? MENSAGEM_COPIA[estado] : ""}
        </span>
      </div>
    </div>
  );
}
