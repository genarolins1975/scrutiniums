"use client";

/**
 * Grupo de opções exclusivas das páginas Transição e ambiente (medida do mapa,
 * dimensão do perfil, MWmed ou participação): rádios nativos dentro de um
 * radiogroup rotulado, com alvo de 44 px e o estado escolhido marcado por borda e
 * fundo, além do próprio rádio (cor nunca é o único portador). O estado vem da URL
 * pelo componente do painel.
 */
export function TransicaoOpcoes<T extends string>({
  rotulo,
  nome,
  opcoes,
  valor,
  onMudar,
}: {
  rotulo: string;
  /** Nome do grupo de rádios (único na página). */
  nome: string;
  opcoes: readonly (readonly [T, string])[];
  valor: T;
  onMudar: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap items-center gap-2">
      <span className="rotulo text-mineral">{rotulo}</span>
      {opcoes.map(([id, rot]) => (
        <label
          key={id}
          className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 border px-3 text-sm ${
            valor === id ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted"
          }`}
        >
          <input type="radio" name={nome} value={id} checked={valor === id} onChange={() => onMudar(id)} className="accent-energia" />
          {rot}
        </label>
      ))}
    </div>
  );
}
