"use client";

import Link from "next/link";
import { useState } from "react";
import type { NoFormacao } from "@/lib/energia/conteudo/pld";
import { TIPOS_RELACAO } from "@/lib/energia/conteudo/pld";
import type { Natureza } from "@/lib/energia/tipos";
import { NATUREZAS } from "@/components/evidencia/SeloNatureza";
import { IconeSetor, type TipoIcone } from "@/components/energia/IconeSetor";

export type EstadoNo = { texto: string; natureza?: Natureza; ref?: string; historico?: { rotulo: string; href: string }; resumo?: string } | null;
export type NoComEstado = NoFormacao & { estado: EstadoNo };

const ICONE: Record<string, TipoIcone> = {
  afluencias: "clima",
  reservatorios: "agua",
  carga: "carga",
  renovaveis: "eolica",
  termicas: "termica",
  rede: "rede",
  otimizacao: "modelo",
  cmo: "sistema",
  limites: "regulacao",
  pld: "preco",
};

function Conferencia({ estado }: { estado: "CONFERIDO" | "PENDENTE" | undefined }) {
  if (!estado) return null;
  return estado === "CONFERIDO" ? (
    <span className="rotulo text-sucesso">● conferido na fonte</span>
  ) : (
    <span className="rotulo text-aviso">○ conferência documental pendente</span>
  );
}

/**
 * De onde vem o preço: o infográfico da formação do PLD. Uma espinha vertical,
 * do clima ao preço: afluências, reservatórios e valor da água; a linha das
 * condições do sistema (carga, renováveis, térmicas, rede); os modelos
 * oficiais; o CMO; as regras e limites; o PLD. Cada nó é um botão com o estado
 * atual em uma linha; o painel ao lado explica a variável, mostra o dado, a
 * fonte, o tipo de relação com o passo seguinte e o caminho para o módulo.
 * Cada seta declara o tipo de relação e se foi conferida em documento
 * primário: nenhuma afirma causalidade estatística.
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
          window.requestAnimationFrame(() => {
            const painel = document.getElementById("formacao-painel");
            if (painel && painel.getBoundingClientRect().top > window.innerHeight * 0.8) painel.scrollIntoView({ block: "start" });
          });
        }}
        aria-pressed={ativo}
        aria-controls="formacao-painel"
        className={`flex min-h-[56px] w-full flex-col justify-center border px-3 py-2 text-left transition-colors ${
          ativo ? "border-energia bg-energia-fundo" : "border-linha bg-superficie hover:border-energia"
        } ${largo ? "items-center text-center" : "items-start"}`}
      >
        <span className="flex min-w-0 max-w-full items-center gap-2 text-sm font-medium leading-snug text-carvao">
          <IconeSetor tipo={ICONE[id] ?? "sistema"} tamanho={15} className={`shrink-0 ${ativo ? "text-energia-dark" : "text-mineral"}`} />
          <span className="min-w-0">{n.curto ?? n.titulo}</span>
          {n.sigla && !n.curto && <span className={`rotulo ${ativo ? "text-carvao-muted" : "text-mineral"}`}>{n.sigla}</span>}
        </span>
        <span className={`mt-1 text-xs tabular-nums ${ativo ? "text-carvao-muted" : "text-mineral"}`}>{n.estado?.resumo ?? (n.estado ? "dado integrado" : "ainda não integrado")}</span>
      </button>
    );
  };

  const seta = (rotulo?: string, conferencia?: "CONFERIDO" | "PENDENTE") => (
    <div className="flex flex-col items-center py-1" aria-hidden="true">
      <span className="h-4 w-px bg-mineral-soft" />
      {rotulo && (
        <span className="rotulo my-0.5 text-mineral">
          {rotulo}
          {conferencia === "PENDENTE" ? " · pendente" : ""}
        </span>
      )}
      <span className="h-3 w-px bg-mineral-soft" />
      <span className="-mt-1 text-mineral-soft">▼</span>
    </div>
  );

  const rel = atual.relacaoSaida;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div role="group" aria-label="Etapas da formação do PLD" className="border border-linha bg-papel p-4 md:p-5">
        <p className="rotulo mb-3 text-center text-mineral">Clima</p>
        {botao("afluencias", true)}
        {seta(TIPOS_RELACAO.relacao_fisica.rotulo, por.afluencias?.relacaoSaida?.conferencia)}
        {botao("reservatorios", true)}
        {seta("junto com as condições do sistema")}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {botao("carga")}
          {botao("renovaveis")}
          {botao("termicas")}
          {botao("rede")}
        </div>
        {seta(TIPOS_RELACAO.informacao_modelos.rotulo)}
        {botao("otimizacao", true)}
        {seta(TIPOS_RELACAO.resultado_modelos.rotulo, por.otimizacao?.relacaoSaida?.conferencia)}
        {botao("cmo", true)}
        {seta(TIPOS_RELACAO.regra_regulatoria.rotulo, por.cmo?.relacaoSaida?.conferencia)}
        {botao("limites", true)}
        {seta(undefined, por.limites?.relacaoSaida?.conferencia)}
        {botao("pld", true)}
        <p className="mt-3 text-center text-[0.7rem] leading-snug text-mineral">
          A ordem é a das etapas descritas pelas fontes; as setas declaram o tipo de relação e não afirmam causa estatística.
        </p>
      </div>

      <section id="formacao-painel" aria-live="polite" aria-labelledby="formacao-painel-titulo" className="scroll-mt-28 border border-linha bg-superficie p-5 md:p-6 lg:sticky lg:top-24 lg:self-start">
        <p className="rotulo text-mineral">Etapa selecionada</p>
        <h3 id="formacao-painel-titulo" className="mt-1 flex items-center gap-2 font-serif text-xl text-carvao">
          <IconeSetor tipo={ICONE[atual.id] ?? "sistema"} tamanho={18} className="text-energia-dark" />
          {atual.titulo}
          {atual.sigla ? <span className="text-base text-mineral">({atual.sigla})</span> : null}
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
            {atual.estado.resumo && <p className="font-serif text-2xl leading-tight tabular-nums">{atual.estado.resumo}</p>}
            <p className={atual.estado.resumo ? "mt-1" : ""}>{atual.estado.texto}</p>
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
