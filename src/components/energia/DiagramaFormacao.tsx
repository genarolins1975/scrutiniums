"use client";

import Link from "next/link";
import { useState } from "react";
import type { NoFormacao } from "@/lib/energia/conteudo/pld";
import { TIPOS_RELACAO } from "@/lib/energia/conteudo/pld";
import type { Natureza } from "@/lib/energia/tipos";
import { NATUREZAS } from "@/components/evidencia/SeloNatureza";

export type EstadoNo = { texto: string; natureza?: Natureza; ref?: string; historico?: { rotulo: string; href: string } } | null;
export type NoComEstado = NoFormacao & { estado: EstadoNo };

function Conferencia({ estado }: { estado: "CONFERIDO" | "PENDENTE" | undefined }) {
  if (!estado) return null;
  return estado === "CONFERIDO" ? (
    <span className="rotulo !text-xs text-sucesso">● conferido na fonte</span>
  ) : (
    <span className="rotulo !text-xs text-aviso">○ conferência documental pendente</span>
  );
}

/**
 * De onde vem o preço: diagrama interativo da formação do PLD. Cada nó é um
 * botão; o painel explica a variável, mostra o estado atual (quando o dado está
 * integrado), a fonte, o tipo de relação com o próximo passo e o módulo.
 * Relações têm tipo explícito: relação física, informação usada pelos modelos,
 * resultado dos modelos, regra regulatória. Nenhuma seta afirma causalidade
 * estatística.
 */
export function DiagramaFormacao({ nos }: { nos: NoComEstado[] }) {
  const [sel, setSel] = useState("reservatorios");
  const por = Object.fromEntries(nos.map((n) => [n.id, n]));
  const atual = por[sel] ?? nos[0];

  const botao = (id: string, largo = false) => {
    const n = por[id];
    if (!n) return null;
    const ativo = sel === id;
    return (
      <button
        type="button"
        onClick={() => {
          setSel(id);
          // no celular o painel fica abaixo de todo o diagrama: traz para a vista se estiver fora
          window.requestAnimationFrame(() => {
            const painel = document.getElementById("formacao-painel");
            if (painel && painel.getBoundingClientRect().top > window.innerHeight * 0.8) painel.scrollIntoView({ block: "start" });
          });
        }}
        aria-pressed={ativo}
        aria-controls="formacao-painel"
        className={`flex min-h-[52px] w-full flex-col items-start justify-center border px-3 py-2 text-left transition-colors ${
          ativo ? "border-energia bg-energia-fundo" : "border-linha bg-superficie hover:border-energia"
        } ${largo ? "md:items-center md:text-center" : ""}`}
      >
        <span className="text-sm font-medium leading-snug text-carvao">{n.titulo}</span>
        {n.sigla && <span className={`rotulo !text-xs ${ativo ? "text-carvao-muted" : "text-mineral"}`}>{n.sigla}</span>}
      </button>
    );
  };

  const seta = (rotulo?: string) => (
    <div className="flex items-center justify-center gap-2 py-1.5 text-mineral" aria-hidden="true">
      <span className="text-lg leading-none">↓</span>
      {rotulo && <span className="rotulo !text-xs">{rotulo}</span>}
    </div>
  );

  const rel = atual.relacaoSaida;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div role="group" aria-label="Etapas da formação do PLD">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {botao("afluencias")}
          <span aria-hidden="true" className="text-mineral">→</span>
          {botao("reservatorios")}
        </div>
        <p className="rotulo mt-3 text-center !text-xs text-mineral" aria-hidden="true">+ junto com</p>
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

      <section id="formacao-painel" aria-live="polite" aria-labelledby="formacao-painel-titulo" className="scroll-mt-28 border border-linha bg-superficie p-5 md:p-6 lg:sticky lg:top-24 lg:self-start">
        <p className="rotulo text-mineral">Etapa selecionada</p>
        <h3 id="formacao-painel-titulo" className="mt-1 font-serif text-xl text-carvao">
          {atual.titulo}
          {atual.sigla ? <span className="ml-2 text-base text-mineral">({atual.sigla})</span> : null}
        </h3>

        <p className="rotulo mt-4 text-mineral">O que é</p>
        <p className="mt-1 text-sm leading-relaxed text-carvao">{atual.oQueE}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-mineral">
          Fonte: {atual.fonteOQueE} <Conferencia estado={atual.conferenciaOQueE} />
        </p>

        {atual.mecanismo && (
          <>
            <p className="rotulo mt-4 text-mineral">Por que importa para o preço</p>
            <p className="mt-1 text-sm leading-relaxed text-carvao">{atual.mecanismo}</p>
            <p className="mt-1 text-xs text-mineral">
              <Conferencia estado={atual.conferenciaMecanismo} />
            </p>
          </>
        )}

        <p className="rotulo mt-4 text-mineral">Estado atual</p>
        {atual.estado ? (
          <div className="mt-1 text-sm leading-relaxed text-carvao">
            <p>{atual.estado.texto}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-mineral">
              {atual.estado.natureza && (
                <span>
                  {NATUREZAS[atual.estado.natureza].glifo} {NATUREZAS[atual.estado.natureza].rotulo}
                </span>
              )}
              {atual.estado.ref && <span>Referência: {atual.estado.ref}</span>}
              {atual.estado.historico && (
                <Link href={atual.estado.historico.href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                  {atual.estado.historico.rotulo}
                </Link>
              )}
            </p>
          </div>
        ) : (
          <p className="mt-1 text-sm text-mineral">Dado desta etapa ainda não integrado ao portal.</p>
        )}

        {rel && (
          <div className="mt-4 border-t border-linha pt-3">
            <p className="rotulo text-mineral">Ligação com a próxima etapa</p>
            <p className="mt-1 text-sm text-carvao">
              <strong className="font-medium">{TIPOS_RELACAO[rel.tipo].rotulo}.</strong> {rel.texto}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-mineral">
              Base: {rel.fonte} <Conferencia estado={rel.conferencia} />
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-4">
          {atual.modulo && (
            <Link href={atual.modulo.href} className="rotulo inline-flex min-h-[44px] items-center border border-carvao px-4 text-carvao hover:bg-carvao hover:text-marfim">
              {atual.modulo.rotulo} →
            </Link>
          )}
          {atual.conceito && (
            <Link href={`/setor-eletrico/aprenda/${atual.conceito}`} className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
              Verbete
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
