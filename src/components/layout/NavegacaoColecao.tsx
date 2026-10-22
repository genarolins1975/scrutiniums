import type { ReactNode } from "react";
import { NavegacaoColecaoCliente } from "@/components/layout/NavegacaoColecaoCliente";
import { idiomaEnergia } from "@/lib/energia/idioma";
import { caminhoAtual } from "@/lib/observatorios/contexto";
import { navegacaoDaColecao, navegacaoDoObservatorio, type NavegacaoDaColecao } from "@/lib/observatorios/navegacaoColecao";

/**
 * A navegação de módulo de toda coleção (Iniciativa 2 do parecer de UX de 21/10/2026), logo abaixo da barra comum
 * (CabecalhoPlataforma). Uma só anatomia, em duas linhas no máximo:
 *
 *  - linha 1: os destinos de primeiro nível da coleção (navegacaoColecao.ts): "Início", a consulta pessoal quando existe,
 *    os grupos e as páginas; até oito à vista, o resto em "Mais" (<details> fechável: Esc fecha e devolve o foco). À direita,
 *    sempre nesta ordem quando existem, os atalhos Dados, Método e Glossário;
 *  - linha 2: só quando o destino atual tem subpáginas (um grupo), as páginas dele.
 *
 * O atual leva aria-current="page" e o filete de 2 px no acento da coleção; alvos de 44 px. Abaixo de 640 px as duas linhas
 * viram faixas que rolam só nelas mesmas, com o atual trazido à vista (AtivoVisivel); nada de botão "Menu", nada de menu
 * suspenso por grupo, e os itens de "Mais" e os atalhos entram no fim da faixa. Destino sem página é texto "em preparação".
 * Renderizada no servidor: funciona sem JavaScript.
 *
 * `colecao`: id da coleção no registro (lista.ts). `observatorio`: navegação de um observatório que mantém painéis próprios
 * (Território e Clima). `nav`: lista pronta (a navegação da conta, em /app). `atual`: fixa o endereço a marcar quando a página
 * não está na lista (ex.: ficha por município). `acoes`: o que vem depois dos atalhos (o "Sair" da conta).
 */
export function NavegacaoColecao({
  colecao,
  observatorio,
  nav: pronta,
  atual,
  acoes,
}: {
  colecao?: string;
  observatorio?: "territorio-e-clima";
  nav?: NavegacaoDaColecao;
  atual?: string;
  acoes?: ReactNode;
}) {
  const nav = pronta ?? (observatorio ? navegacaoDoObservatorio(observatorio) : colecao ? navegacaoDaColecao(colecao) : null);
  if (!nav) throw new Error("NavegacaoColecao sem coleção, observatório ou lista");
  return <NavegacaoColecaoCliente nav={nav} caminho={caminhoAtual()} atual={atual} idioma={idiomaEnergia()} acoes={acoes} />;
}
