"use client";

import Link from "@/components/i18n/LinkIdioma";
import type { NoComEstado } from "@/components/energia/DiagramaFormacao";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { NATUREZAS, textoNatureza } from "@/components/evidencia/SeloNatureza";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { TIPOS_RELACAO_IDIOMAS } from "@/lib/energia/conteudo/pld";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { tx } from "@/lib/energia/idioma";
import { useIdioma } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";
import type { LigacaoFormacao } from "@/lib/energia/pld";

/**
 * De onde vem o preço (P008): diagrama navegável da formação do PLD. Cada etapa é
 * um botão; a etapa escolhida fica na URL (?etapa=), então o link compartilhado
 * reabre a mesma etapa e o voltar do navegador volta à anterior.
 *
 * Diferente do diagrama antigo, cada ligação traz o próprio estado de conferência
 * decidido pela gold: CONFERIDA quando todas as passagens que a sustentam foram
 * encontradas literalmente no documento baixado (Decreto nº 5.163/2004, REN ANEEL
 * nº 957/2021, Procedimentos de Rede do ONS, manual do DESSEM), com o trecho e o
 * dispositivo à vista; PENDENTE quando a base é só editorial. Nenhuma seta afirma
 * causalidade estatística: o tipo da relação é sempre escrito.
 */
const ETAPAS = ["afluencias", "reservatorios", "carga", "renovaveis", "termicas", "rede", "otimizacao", "cmo", "limites", "pld"] as const;
type Etapa = (typeof ETAPAS)[number];
const ESQUEMA = { etapa: campo(tiposUrl.opcao(ETAPAS), "reservatorios" as Etapa) };

/** Destino de ligação que não é etapa do diagrama. */
function destinoExtra(id: string, idioma: Idioma): string | undefined {
  if (id === "liquidacao") return tx("Contabilização e liquidação no Mercado de Curto Prazo", "Accounting and settlement in the Short-Term Market", idioma);
  return undefined;
}

function Estado({ estado, idioma }: { estado: "CONFERIDO" | "PENDENTE"; idioma: Idioma }) {
  return estado === "CONFERIDO" ? (
    <span className="rotulo !text-xs text-sucesso">{tx("● conferida no documento", "● verified in the document", idioma)}</span>
  ) : (
    <span className="rotulo !text-xs text-aviso">{tx("○ conferência documental pendente", "○ document verification pending", idioma)}</span>
  );
}

export function PldFormacao({ nos, ligacoes }: { nos: NoComEstado[]; ligacoes: Record<string, LigacaoFormacao[]> }) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const idioma = useIdioma();
  const TIPOS_RELACAO = TIPOS_RELACAO_IDIOMAS[idioma];
  const por = Object.fromEntries(nos.map((n) => [n.id, n]));
  const atual = por[v.etapa] ?? nos[0];
  const ligs = ligacoes[atual?.id ?? ""] ?? [];

  const botao = (id: Etapa, largo = false) => {
    const n = por[id];
    if (!n) return null;
    const ativo = v.etapa === id;
    const pend = (ligacoes[id] ?? []).some((l) => l.estado !== "CONFERIDO");
    return (
      <button
        type="button"
        onClick={() => {
          definir({ etapa: id });
          // no celular o painel fica abaixo de todo o diagrama: traz para a vista se estiver fora
          window.requestAnimationFrame(() => {
            const painel = document.getElementById("formacao-painel");
            if (painel && painel.getBoundingClientRect().top > window.innerHeight * 0.8) painel.scrollIntoView({ block: "start" });
          });
        }}
        aria-pressed={ativo}
        aria-controls="formacao-painel"
        className={`flex min-h-[52px] w-full flex-col items-start justify-center border px-3 py-2 text-left ${
          ativo ? "border-energia bg-energia-fundo" : "border-linha bg-superficie hover:border-energia"
        } ${largo ? "md:items-center md:text-center" : ""}`}
      >
        <span className="text-sm font-medium leading-snug text-carvao">{n.titulo}</span>
        <span className={`rotulo !text-xs ${ativo ? "text-carvao-muted" : "text-mineral"}`}>
          {n.sigla ? `${n.sigla} · ` : ""}
          {pend ? tx("ligação pendente", "link pending", idioma) : tx("ligações conferidas", "links verified", idioma)}
        </span>
      </button>
    );
  };

  const seta = (rotulo?: string) => (
    <div className="flex items-center justify-center gap-2 py-1.5 text-mineral" aria-hidden="true">
      <span className="text-lg leading-none">↓</span>
      {rotulo && <span className="rotulo !text-xs">{rotulo}</span>}
    </div>
  );

  if (!atual) return null;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div role="group" aria-label={tx("Etapas da formação do PLD", "Stages of PLD formation", idioma)} className="min-w-0">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {botao("afluencias")}
          <span aria-hidden="true" className="text-mineral">→</span>
          {botao("reservatorios")}
        </div>
        <p className="rotulo mt-3 text-center !text-xs text-mineral" aria-hidden="true">
          {tx("+ junto com", "+ together with", idioma)}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          {botao("carga")}
          {botao("renovaveis")}
          {botao("termicas")}
          {botao("rede")}
        </div>
        {seta(TIPOS_RELACAO.informacao_modelos.rotulo)}
        {botao("otimizacao", true)}
        {seta(TIPOS_RELACAO.resultado_modelos.rotulo)}
        {botao("cmo", true)}
        {seta(TIPOS_RELACAO.regra_regulatoria.rotulo)}
        {botao("limites", true)}
        {seta()}
        {botao("pld", true)}
      </div>

      <section
        id="formacao-painel"
        aria-live="polite"
        aria-labelledby="formacao-painel-titulo"
        className="min-w-0 scroll-mt-28 border border-linha bg-superficie p-5 md:p-6 lg:sticky lg:top-24 lg:self-start"
      >
        <p className="rotulo text-mineral">{tx("Etapa selecionada", "Selected stage", idioma)}</p>
        <h3 id="formacao-painel-titulo" className="mt-1 font-serif text-xl text-carvao">
          {atual.titulo}
          {atual.sigla ? <span className="ml-2 text-base text-mineral">({atual.sigla})</span> : null}
        </h3>

        <p className="rotulo mt-4 text-mineral">{tx("O que é", "What it is", idioma)}</p>
        <p className="mt-1 text-sm leading-relaxed text-carvao">{atual.oQueE}</p>
        <p className="mt-1 text-xs text-mineral">
          {tx("Fonte:", "Source:", idioma)} {atual.fonteOQueE}.{" "}
          {atual.conferenciaOQueE === "CONFERIDO"
            ? tx("Definição conferida na fonte.", "Definition verified at the source.", idioma)
            : tx("Definição com conferência pendente.", "Definition with verification pending.", idioma)}
        </p>

        {atual.mecanismo && (
          <>
            <p className="rotulo mt-4 text-mineral">{tx("Leitura usual do setor", "Usual reading in the sector", idioma)}</p>
            <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{atual.mecanismo}</p>
            <p className="mt-1 text-xs text-aviso">
              {atual.conferenciaMecanismo === "CONFERIDO"
                ? tx("Mecanismo conferido na fonte.", "Mechanism verified at the source.", idioma)
                : tx(
                    "Conferência pendente: o manual do DESSEM cita a função de custo futuro, mas os manuais do DECOMP e do NEWAVE não estão entre os arquivos públicos do CEPEL.",
                    "Verification pending: the DESSEM manual cites the future cost function, but the DECOMP and NEWAVE manuals are not among CEPEL's public files.",
                    idioma,
                  )}
            </p>
          </>
        )}

        <p className="rotulo mt-4 text-mineral">{tx("Último dado publicado", "Latest published data", idioma)}</p>
        {atual.estado ? (
          <div className="mt-1 text-sm leading-relaxed text-carvao">
            <p>{atual.estado.texto}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-mineral">
              {atual.estado.natureza && (
                <span>
                  {NATUREZAS[atual.estado.natureza].glifo} {textoNatureza(atual.estado.natureza, idioma).rotulo}
                </span>
              )}
              {atual.estado.historico && (
                <Link href={atual.estado.historico.href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                  {atual.estado.historico.rotulo}
                </Link>
              )}
            </p>
          </div>
        ) : (
          <p className="mt-1 text-sm text-carvao-muted">
            {tx(
              "Esta etapa não tem uma grandeza única publicada; a ligação abaixo diz como ela entra na formação do preço.",
              "This stage has no single published quantity; the link below explains how it enters price formation.",
              idioma,
            )}
          </p>
        )}

        <div className="mt-4 space-y-4 border-t border-linha pt-3">
          <p className="rotulo text-mineral">
            {ligs.length === 1 ? tx("Ligação com a etapa seguinte", "Link to the next stage", idioma) : tx("Ligações com as etapas seguintes", "Links to the next stages", idioma)}
          </p>
          {ligs.length === 0 && <p className="text-sm text-carvao-muted">{tx("Última etapa do diagrama.", "Last stage of the diagram.", idioma)}</p>}
          {ligs.map((l) => (
            <div key={`${l.de}-${l.para}`} className="space-y-1.5">
              <p className="text-sm text-carvao">
                <strong className="font-medium">
                  {TIPOS_RELACAO[l.tipo].rotulo} <span aria-hidden="true">→</span>
                  <span className="sr-only">{tx("para", "to", idioma)}</span> {por[l.para]?.titulo ?? destinoExtra(l.para, idioma) ?? l.para}.
                </strong>{" "}
                {l.texto}
              </p>
              <p className="flex flex-wrap items-center gap-2 text-xs text-mineral">
                <Estado estado={l.estado} idioma={idioma} />
                {l.baseTexto ? (
                  <span>
                    {tx("Base editorial:", "Editorial basis:", idioma)} {l.baseTexto}
                  </span>
                ) : null}
                {l.estado !== "CONFERIDO" && l.origem === "conteudo" ? (
                  <span>
                    {tx(
                      "Nenhuma passagem dos documentos integrados (Decreto nº 5.163/2004, REN ANEEL nº 957/2021, Procedimentos de Rede do ONS e manual do DESSEM) sustenta esta ligação como está escrita.",
                      "No passage of the integrated documents (Decree No. 5.163/2004, ANEEL Normative Resolution No. 957/2021, ONS Grid Procedures and the DESSEM manual) supports this link as written.",
                      idioma,
                    )}
                  </span>
                ) : null}
                {l.faltantes.length ? (
                  <span>
                    {tx("Passagens não encontradas na publicação:", "Passages not found in the publication:", idioma)} {l.faltantes.join(", ")}
                  </span>
                ) : null}
              </p>
              {l.bases.length > 0 && (
                <ul className="space-y-1.5">
                  {l.bases.map((b) => (
                    <li key={b.id} className="border-l-2 border-energia pl-3 text-xs leading-relaxed text-carvao-muted [overflow-wrap:anywhere]">
                      <TrechoPortugues regiao="pld-passagem-normativa">“{b.texto}”</TrechoPortugues>{" "}
                      <span className="text-mineral">
                        (<Nome>{b.origem}</Nome>
                        {b.url ? (
                          <>
                            ,{" "}
                            <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                              {tx("documento", "document", idioma)}
                            </a>
                          </>
                        ) : null}
                        )
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-4">
          {atual.modulo && (
            <Link href={atual.modulo.href} className="rotulo inline-flex min-h-[44px] items-center border border-carvao px-4 text-carvao hover:bg-carvao hover:text-marfim">
              {atual.modulo.rotulo} →
            </Link>
          )}
          {atual.conceito && (
            <Link href={`/setor-eletrico/aprenda/${atual.conceito}`} className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
              {tx("Verbete", "Glossary entry", idioma)}
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
