"use client";

import { useEffect, useState } from "react";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { carregarUmaVez, tabelaQualidade, type AvisosFec, type DefinicaoTabela, type IdTabela } from "@/lib/energia/qualidade";
import type { QualidadeGold } from "@/lib/energia/tipos-qualidade";

/**
 * Tabela de análise ou auditoria do módulo Qualidade aberta sob demanda: no HTML do
 * servidor sai só o botão com o número de linhas; ao abrir, o navegador busca a gold
 * publicada (uma vez por visita, compartilhada por todas as tabelas) e monta a
 * TabelaInterativa com as mesmas funções que o teste confere contra os CSV (contrato,
 * seção 5.1: as linhas não viajam na página). Link com filtros dessa tabela na URL
 * (`<chaveUrl>.q`, `.ord`, `.f.*`) já abre a tabela.
 */
export function QualidadeTabela({
  tabela,
  titulo,
  linhas,
  chaveUrl,
  selecionado,
  onSelecionar,
  avisosFec,
  urlGold = "/energia/gold/qualidade.json",
}: {
  tabela: IdTabela;
  titulo: string;
  /** Número de linhas (dito no botão antes de abrir). */
  linhas: number;
  chaveUrl?: string;
  selecionado?: string | null;
  onSelecionar?: (id: string | null) => void;
  /** Distribuidoras de FEC com cobertura parcial (a página lê os meses do CSV mensal); sem isto, a marca vem só da gold. */
  avisosFec?: AvisosFec;
  urlGold?: string;
}) {
  const [aberta, setAberta] = useState(false);
  const [def, setDef] = useState<DefinicaoTabela | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // link compartilhado com o recorte desta tabela, ou seleção vinda de outro painel: abre já
  useEffect(() => {
    if (!chaveUrl) return;
    const p = new URLSearchParams(window.location.search);
    if (Array.from(p.keys()).some((k) => k.startsWith(`${chaveUrl}.`))) setAberta(true);
  }, [chaveUrl]);

  useEffect(() => {
    if (!aberta || def) return;
    let vivo = true;
    carregarUmaVez(urlGold, (r) => r.json() as Promise<QualidadeGold>).then(
      (g) => vivo && setDef(tabelaQualidade(tabela, g, avisosFec)),
      (e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [aberta, def, tabela, urlGold, avisosFec]);

  if (!aberta) {
    return (
      <button
        type="button"
        onClick={() => setAberta(true)}
        className="inline-flex min-h-[44px] max-w-full items-center gap-2 border border-linha bg-superficie px-3 py-2 text-left text-sm text-carvao hover:border-energia focus:outline-none focus-visible:ring-2 focus-visible:ring-energia"
      >
        <span aria-hidden="true" className="rotulo text-mineral">
          Tabela
        </span>
        Abrir: {titulo} ({linhas.toLocaleString("pt-BR")} {linhas === 1 ? "linha" : "linhas"}, com busca, filtros e exportação)
      </button>
    );
  }
  if (erro) {
    return (
      <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
        Não foi possível montar a tabela ({erro}). Os mesmos dados estão nos arquivos de download do painel.
      </p>
    );
  }
  if (!def) {
    return (
      <p role="status" className="text-sm text-carvao-muted">
        Montando a tabela: {titulo}…
      </p>
    );
  }
  return (
    <TabelaInterativa
      titulo={titulo}
      colunas={def.colunas}
      linhas={def.linhas}
      chaveLinha="id"
      colunaRotulo={def.colunaRotulo}
      fonte={def.fonte}
      versao={def.versao}
      nomeArquivo={def.nomeArquivo}
      chaveUrl={chaveUrl}
      ordemInicial={def.ordemInicial}
      dicaBusca={def.dicaBusca}
      nota={def.nota}
      selecionado={selecionado}
      onSelecionar={onSelecionar}
      iniciarAberta
    />
  );
}
