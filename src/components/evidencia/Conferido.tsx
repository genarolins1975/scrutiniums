import { tx } from "@/lib/energia/idioma";

/**
 * Marcador de conferência de uma afirmação: conferida na fonte primária (trecho citado)
 * ou com conferência documental pendente. Usado no PLD e explicado no Mapa do Observatório.
 */
export function Conferido({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="rotulo !text-xs text-sucesso">{tx("● conferido na fonte", "● checked against the source")}</span>
  ) : (
    <span className="rotulo !text-xs text-aviso">{tx("○ conferência documental pendente", "○ documentary check pending")}</span>
  );
}
