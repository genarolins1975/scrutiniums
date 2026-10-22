import {CabecalhoPlataforma} from '@/components/layout/CabecalhoPlataforma';
import type { Metadata } from "next";
import { modeloDeTitulo } from "@/lib/observatorios/contexto";

/** Títulos "Página · Coleção · Scrutiniums", com a coleção dona do tema no registro. */
export const metadata: Metadata = { title: modeloDeTitulo("/eficiencia-estatal/seguranca-publica") };

/** Navegação do painel, na ordem da procura: a comparação por estado logo depois da visão geral. */

export default function Layout({children}: {children: React.ReactNode}) {
  // subcabeçalho único da Eficiência Estatal (diagnóstico de 20/10/2026, item 10): caminho e abas no cabeçalho; métodos à direita
  return <><header><CabecalhoPlataforma colecao="eficiencia" destinoConta="/eficiencia-estatal/seguranca-publica" navegacao="seguranca" /></header><main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-8 sm:px-6 md:pt-10">{children}</main></>;
}
