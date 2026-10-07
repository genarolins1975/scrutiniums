"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CHAVE_RETORNO as CHAVE, destinoDaVolta, type DestinoRetorno as Destino, type RotulosRetorno } from "@/lib/energia/retorno";

/**
 * Caminho de volta do painel ao Aprenda (P066: "o usuário chega do conceito à evidência e
 * retorna ao contexto"). Os links do Aprenda levam ?volta=trilha:<id>:<passo> ou
 * ?volta=verbete:<slug>; aqui o parâmetro vira um botão fixo "Voltar a ...", que segue
 * visível enquanto o leitor muda o recorte do painel. O parâmetro sai da URL (o link
 * copiado do painel fica limpo) e o destino fica na sessão do navegador, só para esta
 * página; em qualquer outra página o botão não aparece. Sem sessão disponível, vale só o
 * parâmetro. No servidor não renderiza nada.
 */
export function RetornoContexto({ rotulos }: { rotulos: RotulosRetorno }) {
  const [destino, setDestino] = useState<Destino | null>(null);
  // a cada troca de rota (inclusive navegação interna, em que o cabeçalho não remonta) o destino é refeito
  const caminho = usePathname();

  useEffect(() => {
    const url = new URL(window.location.href);
    const volta = url.searchParams.get("volta");
    let d: Destino | null = null;
    if (volta) {
      d = destinoDaVolta(volta, rotulos);
      url.searchParams.delete("volta");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      try {
        if (d) sessionStorage.setItem(CHAVE, JSON.stringify({ caminho: url.pathname, volta }));
      } catch {
        // sem sessão: vale só o parâmetro
      }
    } else {
      try {
        const salvo = JSON.parse(sessionStorage.getItem(CHAVE) ?? "null") as { caminho?: string; volta?: string } | null;
        if (salvo?.volta && salvo.caminho === url.pathname) d = destinoDaVolta(salvo.volta, rotulos);
      } catch {
        // sessão indisponível ou corrompida: sem botão
      }
    }
    setDestino(d);
  }, [rotulos, caminho]);

  if (!destino) return null;
  const fechar = () => {
    try {
      sessionStorage.removeItem(CHAVE);
    } catch {
      // nada a limpar
    }
    setDestino(null);
  };
  return (
    <nav aria-label="Voltar ao Aprenda" data-retorno="true" className="fixed bottom-4 left-4 right-4 z-40 flex items-stretch border border-energia bg-superficie shadow-lg print:hidden sm:right-auto">
      <Link href={destino.href} className="flex min-h-[44px] flex-1 items-center gap-2 px-4 text-sm text-energia-dark underline-offset-4 hover:underline" onClick={fechar}>
        <span aria-hidden="true">←</span>
        {destino.texto}
      </Link>
      <button type="button" onClick={fechar} aria-label="Fechar o caminho de volta" className="min-h-[44px] min-w-[44px] border-l border-linha text-carvao-muted hover:text-carvao">
        ×
      </button>
    </nav>
  );
}
