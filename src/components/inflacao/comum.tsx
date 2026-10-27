"use client";

import { useId } from "react";
import { useSelecaoGas } from "@/components/gas/useSelecaoGas";
import { BRASIL, type TipoArea } from "@/lib/inflacao/tipos";

/** Cores das figuras: a área escolhida no acento das Famílias (bronze) e o Brasil como referência neutra. */
export const COR_AREA = "var(--cor-bronze)";
export const COR_BRASIL = "var(--serie-referencia)";

type AreaBasica = { id: string; nome: string; uf: string | null; tipo: TipoArea };

/** Rótulo do seletor: a cidade, a UF e se a área do IBGE é a região metropolitana ou só o município. */
export function rotuloOpcao(a: AreaBasica): string {
  if (a.id === BRASIL) return "Brasil (as 16 áreas juntas)";
  return `${a.nome} (${a.uf}), ${a.tipo === "regiao_metropolitana" ? "região metropolitana" : "só o município"}`;
}

/** Brasil primeiro, depois as 16 áreas em ordem alfabética (a mesma lista em todas as ilhas da página). */
export function opcoesArea(areas: AreaBasica[]): { valor: string; rotulo: string }[] {
  const br = areas.find((a) => a.id === BRASIL);
  const resto = areas.filter((a) => a.id !== BRASIL).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return [...(br ? [br] : []), ...resto].map((a) => ({ valor: a.id, rotulo: rotuloOpcao(a) }));
}

/**
 * A área escolhida, guardada na URL (`?area=` com o código do IBGE). Todas as ilhas da página leem e escrevem a mesma
 * chave e andam juntas (useSelecaoGas avisa as outras); código fora da lista volta ao Brasil, com aviso.
 */
export function useArea(areas: AreaBasica[]) {
  return useSelecaoGas("area", areas.map((a) => a.id), BRASIL);
}

export function SeletorArea({ areas, valor, onChange, rotulo = "Sua cidade ou região", grande = false }: {
  areas: AreaBasica[];
  valor: string;
  onChange: (v: string) => void;
  rotulo?: string;
  grande?: boolean;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm text-carvao">{rotulo}</label>
      <select
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 min-h-[44px] max-w-full border border-mineral bg-superficie px-3 text-carvao ${grande ? "w-[18rem] text-base" : "text-sm"}`}
      >
        {opcoesArea(areas).map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
      </select>
    </div>
  );
}

/**
 * Barra horizontal que parte do zero para a direita (positivo) ou para a esquerda (negativo), numa escala comum dada por
 * [min, max] (min ≤ 0 ≤ max). Um traço opcional marca a referência (o Brasil). Só desenho: o número vai sempre em texto ao
 * lado, e a cor nunca é a única portadora do valor.
 */
export function BarraDivergente({ valor, min, max, referencia, cor = COR_AREA, altura = 10 }: {
  valor: number | null;
  min: number;
  max: number;
  referencia?: number | null;
  cor?: string;
  altura?: number;
}) {
  const span = max - min || 1;
  const zero = ((0 - min) / span) * 100;
  const pos = (v: number) => ((Math.min(max, Math.max(min, v)) - min) / span) * 100;
  return (
    <span aria-hidden="true" className="relative block w-full" style={{ height: altura + 6 }}>
      <span className="absolute inset-y-0 w-px bg-linha" style={{ left: `${zero}%` }} />
      {valor !== null && (
        <span
          className="absolute"
          style={{
            top: 3,
            height: altura,
            left: `${Math.min(zero, pos(valor))}%`,
            width: `${Math.max(0.6, Math.abs(pos(valor) - zero))}%`,
            background: cor,
          }}
        />
      )}
      {referencia !== null && referencia !== undefined && (
        <span className="absolute inset-y-0 w-[2px] bg-carvao" style={{ left: `calc(${pos(referencia)}% - 1px)` }} />
      )}
    </span>
  );
}

/** Domínio comum [min, max] com o zero dentro e uma pequena folga. */
export function dominio(valores: (number | null | undefined)[]): { min: number; max: number } {
  const v = valores.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  const min = Math.min(0, ...v);
  const max = Math.max(0, ...v);
  const folga = (max - min || 1) * 0.04;
  return { min: min < 0 ? min - folga : 0, max: max + folga };
}
