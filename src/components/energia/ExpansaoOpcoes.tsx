"use client";

import type React from "react";

/**
 * Grupo de opções exclusivas das páginas da Expansão (medida do mapa, figura do
 * PDE, unidades em data em bloco): rádios
 * nativos dentro de um radiogroup rotulado, com alvo de 44 px e o estado
 * escolhido marcado por borda e fundo, além do próprio rádio (cor nunca é o único
 * portador). O estado vem da URL pelo componente do painel.
 */
export function ExpansaoOpcoes<T extends string>({
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

/**
 * Grupo de escolhas múltiplas (viabilidade, estágios do mapa de usinas, camadas da rede):
 * caixas nativas num grupo rotulado, alvo de 44 px. Desmarcar a última opção não é
 * permitido (um gráfico sem nenhuma série não responde a nada); a tentativa é anunciada.
 * `marcador` desenha a amostra da série ao lado do rótulo (cor e forma juntas).
 */
export function ExpansaoMarcas<T extends string>({
  rotulo,
  opcoes,
  valor,
  onMudar,
}: {
  rotulo: string;
  opcoes: readonly { id: T; rotulo: string; marcador?: React.ReactNode }[];
  valor: readonly T[];
  onMudar: (v: T[]) => void;
}) {
  const alternar = (id: T) => {
    const tem = valor.includes(id);
    if (tem && valor.length === 1) return;
    // mantém a ordem das opções, não a ordem dos cliques: a URL fica estável
    onMudar(opcoes.map((o) => o.id).filter((x) => (x === id ? !tem : valor.includes(x))));
  };
  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap items-center gap-2">
      <span className="rotulo text-mineral">{rotulo}</span>
      {opcoes.map((o) => {
        const marcado = valor.includes(o.id);
        const unico = marcado && valor.length === 1;
        return (
          <label
            key={o.id}
            className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 border px-3 text-sm ${
              marcado ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted"
            }`}
          >
            <input
              type="checkbox"
              checked={marcado}
              aria-disabled={unico || undefined}
              title={unico ? "Pelo menos uma opção fica marcada" : undefined}
              onChange={() => alternar(o.id)}
              className="accent-energia"
            />
            {o.marcador}
            {o.rotulo}
          </label>
        );
      })}
    </div>
  );
}
