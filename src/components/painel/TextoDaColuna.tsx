"use client";

import type { ReactNode } from "react";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import type { ColunaTabela } from "@/lib/painel/tabela";
import { useIdioma } from "@/lib/painel/useIdioma";

/**
 * Conteúdo de célula (ou de opção de filtro) de uma coluna com `idiomaTexto`: na página inglesa, nome próprio em <Nome> e texto livre
 * da fonte em <TrechoPortugues>; em português, o conteúdo como está. Exportado para a ListaConsultavel e a TabelaDados do kit usarem a mesma regra; separado da TabelaInterativa para quem só precisa dele não
 * levar a tabela interativa ao navegador.
 */
export function TextoDaColuna({ coluna, children }: { coluna: Pick<ColunaTabela, "id" | "idiomaTexto">; children: ReactNode }) {
  if (coluna.idiomaTexto === "nome") return <Nome>{children}</Nome>;
  if (coluna.idiomaTexto === "portugues") return <TrechoPortugues regiao={`tabela-${coluna.id}`}>{children}</TrechoPortugues>;
  if (coluna.idiomaTexto === "codigo") return <CodigoNoIngles>{children}</CodigoNoIngles>;
  return <>{children}</>;
}

/** Identificador técnico: <code> na página inglesa (não é prosa de nenhum idioma); em português, como sempre foi. */
function CodigoNoIngles({ children }: { children: ReactNode }) {
  const idioma = useIdioma();
  return idioma === "en" ? <code className="text-[0.95em]">{children}</code> : <>{children}</>;
}

