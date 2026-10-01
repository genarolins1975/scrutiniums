"use client";

import { useRef, useState, type ReactNode } from "react";
import { MENSAGEM_COPIA, copiarComFallback, type ResultadoCopia } from "@/lib/energia/evidencia";

/**
 * Link compartilhável de um painel da Conta de luz: copia o endereço atual com
 * os filtros que estão na URL (perfil, distribuidoras, janela, simulação) e a
 * âncora do painel, para que quem receber abra o mesmo recorte (seção 7.3:
 * "URLs reproduzíveis"). Sem área de transferência, o endereço aparece num campo
 * já selecionado para cópia manual. No servidor sai só o botão.
 */
export function ContaLinkPainel({ ancora, rotulo = "Copiar link deste painel" }: { ancora: string; rotulo?: string }) {
  const [estado, setEstado] = useState<ResultadoCopia | null>(null);
  const [url, setUrl] = useState("");
  const campo = useRef<HTMLInputElement>(null);

  const copiar = async () => {
    setEstado(null);
    const endereco = `${window.location.origin}${window.location.pathname}${window.location.search}#${ancora}`;
    setUrl(endereco);
    const r = await copiarComFallback(endereco, {
      clipboard: window.isSecureContext && navigator.clipboard ? navigator.clipboard : null,
      selecionar: () => {
        const el = campo.current;
        if (!el) return false;
        el.value = endereco;
        el.select();
        return true;
      },
      copiarSelecao: () => document.execCommand("copy"),
    });
    setEstado(r);
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      <button type="button" onClick={copiar} className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
        {rotulo}
      </button>
      <input
        ref={campo}
        readOnly
        aria-label="Endereço deste painel com os filtros atuais"
        value={url}
        className={estado && estado !== "copiado" ? "min-h-[44px] w-full max-w-md border border-linha bg-superficie px-2 text-xs text-carvao" : "sr-only"}
        tabIndex={estado && estado !== "copiado" ? 0 : -1}
      />
      <span role="status" aria-live="polite" className="text-xs text-carvao-muted">
        {estado ? MENSAGEM_COPIA[estado] : ""}
      </span>
    </span>
  );
}

/**
 * Link para outra página da Conta de luz que leva junto a escolha de
 * distribuidoras (?dist=) feita nesta: quem escolheu a CEMIG-D no ranking chega à
 * página de reajustes com a CEMIG-D em destaque. O endereço é montado na hora do
 * toque, do foco ou do ponteiro, porque a escolha muda sem recarregar a página;
 * sem JavaScript, o link vale como está.
 */
export function ContaLinkFiltros({ href, children, className, manter = ["dist"] }: { href: string; children: ReactNode; className?: string; manter?: string[] }) {
  const [alvo, setAlvo] = useState(href);
  const atualizar = () => {
    const atual = new URLSearchParams(window.location.search);
    const [base, ancora] = href.split("#");
    const q = new URLSearchParams();
    for (const k of manter) {
      const v = atual.get(k);
      if (v) q.set(k, v);
    }
    const busca = q.toString();
    setAlvo(`${base}${busca ? `?${busca}` : ""}${ancora ? `#${ancora}` : ""}`);
  };
  return (
    <a href={alvo} className={className} onPointerEnter={atualizar} onPointerDown={atualizar} onFocus={atualizar}>
      {children}
    </a>
  );
}
