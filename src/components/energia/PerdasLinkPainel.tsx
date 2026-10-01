"use client";

import { useState } from "react";
import { MENSAGEM_COPIA, copiarComFallback, type ResultadoCopia } from "@/lib/energia/evidencia";

/**
 * Link compartilhável de um painel do módulo Perdas: copia o endereço atual (com o
 * período, a medida, a distribuidora e a ordem da tabela que estão na URL) apontando
 * para a âncora do painel. Sem JavaScript, o link da âncora continua funcionando.
 */
export function PerdasLinkPainel({ ancora, rotulo = "Copiar link deste painel" }: { ancora: string; rotulo?: string }) {
  const [resultado, setResultado] = useState<ResultadoCopia | null>(null);
  const [endereco, setEndereco] = useState("");
  async function copiar(ev: React.MouseEvent<HTMLAnchorElement>) {
    ev.preventDefault();
    const url = new URL(window.location.href);
    url.hash = ancora;
    // campo provisório para o degrau de cópia antigo (sem a API da área de transferência)
    const provisorio: { el: HTMLInputElement | null } = { el: null };
    const r = await copiarComFallback(url.toString(), {
      clipboard: typeof navigator !== "undefined" && navigator.clipboard ? navigator.clipboard : null,
      selecionar: () => {
        const el = document.createElement("input");
        el.value = url.toString();
        el.setAttribute("readonly", "");
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        provisorio.el = el;
        return true;
      },
      copiarSelecao: () => document.execCommand?.("copy") ?? false,
    });
    provisorio.el?.remove();
    // o campo provisório é invisível: "selecionado" não ajudaria o leitor, então vale como falha
    setResultado(r === "selecionado" ? "falhou" : r);
    setEndereco(url.toString());
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2">
      <a href={`#${ancora}`} onClick={copiar} className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
        {rotulo}
      </a>
      <span role="status" className="text-xs text-carvao-muted">
        {resultado === "copiado" ? MENSAGEM_COPIA.copiado : resultado ? "Não foi possível copiar: selecione o endereço abaixo e copie." : ""}
      </span>
      {resultado && resultado !== "copiado" && (
        <input
          readOnly
          value={endereco}
          aria-label="Endereço deste painel"
          onFocus={(e) => e.currentTarget.select()}
          className="mt-1 h-11 w-full min-w-0 border border-linha bg-superficie px-2 text-xs text-carvao"
        />
      )}
    </span>
  );
}
