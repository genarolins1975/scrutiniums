import { TrilhaCliente, type ItemExtra } from "@/components/layout/NavegacaoContexto";
import { idiomaEnergia } from "@/lib/energia/idioma";
import { caminhoAtual, indiceDoCaminho } from "@/lib/observatorios/contexto";

/**
 * Trilha única da plataforma (Iniciativa 1 do parecer de UX, 21/10/2026): aria-label "Você está em", raiz "Observatórios",
 * depois observatório, coleção e página, tudo lido do registro (contextoPuro.ts). Sem sessão, a raiz e o observatório levam
 * à página aberta do observatório (/perguntas/<id>); com sessão, à escolha pós login e à entrada do observatório.
 *
 * A barra comum dos painéis (CabecalhoPlataforma) já traz a trilha, que segue a página aberta a cada navegação; este
 * componente fica para as páginas abertas fora dela (portas /perguntas/<id>, dados abertos). `rota` fixa o endereço;
 * `extras` continua a trilha abaixo da coleção. Fora dos observatórios (home, conta, entrar, cadastro), não desenha nada.
 */
export function Trilha({ rota, extras, className }: { rota?: string; extras?: ItemExtra[]; className?: string }) {
  const caminho = rota ?? caminhoAtual();
  return <TrilhaCliente indice={indiceDoCaminho(caminho)} caminho={caminho} rota={rota} extras={extras} idioma={idiomaEnergia()} className={className} />;
}
