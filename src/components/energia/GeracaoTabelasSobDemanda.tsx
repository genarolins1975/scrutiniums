"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { carregaJson } from "@/lib/energia/carregaJson";
import { REGISTRO_TABELAS_GERACAO, URL_GOLD_GERACAO_DETALHE, type DefinicaoTabelaGeracao, type TabelaGeracao } from "@/lib/energia/geracao-tabelas";
import type { GoldGeracaoDetalhe } from "@/lib/energia/tipos-geracao";

/**
 * Tabelas dos níveis Analisar e Auditar de Geração (P021) e da Térmica (P022) lidas sob demanda (seção 5.1 do
 * contrato dos módulos), no mesmo desenho de MercadoTabelasSobDemanda: a gold geracao_detalhe.json é buscada quando a
 * tabela chega perto da janela (ou ao toque no botão, ou quando o link já traz o estado dela na URL) e as linhas saem
 * das funções puras de src/lib/energia/geracao-tabelas.ts. Antes disso, o HTML e as props da página não carregam as
 * linhas; os arquivos CSV do painel ficam no fim da página.
 */
export type { TabelaGeracao };

export function GeracaoTabelaSobDemanda({ tabela, versao }: { tabela: TabelaGeracao; versao: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [pedido, setPedido] = useState(false);
  const [g, setG] = useState<GoldGeracaoDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const def: DefinicaoTabelaGeracao = REGISTRO_TABELAS_GERACAO[tabela];

  // o estado da tabela na URL (busca, filtro, ordem ou página de um link compartilhado) pede a leitura de imediato
  useEffect(() => {
    const prefixo = `${def.chaveUrl}.`;
    const chaves: string[] = [];
    new URLSearchParams(window.location.search).forEach((_, k) => chaves.push(k));
    if (chaves.some((k) => k.startsWith(prefixo))) setPedido(true);
  }, [def.chaveUrl]);

  // o bloco pede a gold quando chega perto da janela; sem IntersectionObserver, só pelo botão
  useEffect(() => {
    const el = caixa.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setPedido(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!pedido || g || erro) return;
    let vivo = true;
    carregaJson<GoldGeracaoDetalhe>(URL_GOLD_GERACAO_DETALHE)
      .then((j) => {
        if (vivo) setG(j);
      })
      .catch((x: unknown) => {
        if (vivo) setErro(x instanceof Error ? x.message : String(x));
      });
    return () => {
      vivo = false;
    };
  }, [pedido, g, erro]);

  const p = useMemo(() => (g ? def.monta(g) : null), [g, def]);
  if (g) {
    if (!p) return null;
    return (
      <div data-tabela-geracao={tabela}>
        <TabelaInterativa {...p} versao={def.versao?.(g) || versao} chaveLinha={def.chaveLinha ?? "id"} chaveUrl={def.chaveUrl} iniciarAberta />
      </div>
    );
  }
  return (
    <div ref={caixa} className="space-y-2 border border-dashed border-linha p-4 text-sm text-carvao-muted" role="status" aria-live="polite" data-tabela-geracao={tabela}>
      <p>
        {erro
          ? `A tabela não pôde ser lida da base publicada: ${erro}`
          : pedido
            ? "Lendo a tabela na base publicada…"
            : "A tabela é lida da base publicada quando aparece na tela. Os arquivos CSV do painel estão no fim da página."}
      </p>
      {!pedido && (
        <button type="button" onClick={() => setPedido(true)} className="rotulo inline-flex min-h-[44px] items-center border border-linha px-3 text-carvao hover:border-energia">
          Carregar a tabela
        </button>
      )}
      {erro && (
        <button type="button" onClick={() => setErro(null)} className="rotulo inline-flex min-h-[44px] items-center border border-linha px-3 text-carvao hover:border-energia">
          Tentar de novo
        </button>
      )}
    </div>
  );
}
