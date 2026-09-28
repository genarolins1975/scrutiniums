/**
 * Marcador de conferência de uma afirmação: conferida na fonte primária (trecho citado)
 * ou com conferência documental pendente. Usado no PLD e explicado no Mapa do Observatório.
 */
export function Conferido({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="rotulo text-sucesso">● conferido na fonte</span>
  ) : (
    <span className="rotulo text-aviso">○ conferência documental pendente</span>
  );
}
