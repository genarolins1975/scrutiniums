"use client";

import { useId, useState } from "react";
import type { AnoBalanca } from "@/lib/territorio/emissoes";

/** Mt com uma casa, sinal de menos tipográfico. */
function mt(kt: number): string {
  return (kt / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).replace(/^-/, "−");
}

const ALTURA = 280;

/**
 * A balança do carbono (modelo didático do painel de emissões, dentro do envelope ModeloDidatico): para o ano escolhido, a soma das
 * categorias do inventário com saldo acima de zero sobe da linha do zero, a soma das categorias com saldo abaixo de zero desce, e o
 * saldo líquido é a diferença, que é o total publicado. A escala é a mesma em todos os anos, para o leitor comparar um ano com outro.
 * Sem script, o servidor entrega o último ano; o desenho é decorativo (aria-hidden) e os números estão no texto ao lado.
 */
export function BalancaCarbono({
  anos,
  anoReferencia,
  setores,
}: Readonly<{
  anos: AnoBalanca[];
  /** 2005, o ano de referência da meta climática. */
  anoReferencia: number;
  /** Ordem, nome e cor (token CSS) de cada setor, as mesmas da figura da série. */
  setores: { id: keyof AnoBalanca["positivoPorSetor"]; nome: string; cor: string }[];
}>) {
  const ultimo = anos[anos.length - 1];
  const [ano, setAno] = useState(ultimo.ano);
  const a = anos.find((x) => x.ano === ano) ?? ultimo;
  const ref = anos.find((x) => x.ano === anoReferencia);
  const idAno = useId();
  // escala única da série inteira: o maior lado positivo e o maior lado negativo de todos os anos
  const maxPos = Math.max(...anos.map((x) => x.positivo));
  const maxNeg = Math.max(...anos.map((x) => -x.negativo));
  const escala = ALTURA / (maxPos + maxNeg);
  const zero = maxPos * escala; // distância do topo até a linha do zero
  const px = (kt: number) => Math.max(kt === 0 ? 0 : 1, Math.abs(kt) * escala);

  const atalho = (alvo: number, rotulo: string) => (
    <button
      type="button"
      onClick={() => setAno(alvo)}
      aria-pressed={ano === alvo}
      className="inline-flex min-h-[44px] items-center border border-linha bg-papel px-3 text-sm text-carvao transition-transform duration-150 ease-out hover:border-carvao active:scale-[0.97] aria-pressed:border-carvao aria-pressed:font-medium motion-reduce:transition-none"
    >
      {rotulo}
    </button>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
      <div>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <label htmlFor={idAno} className="block min-w-0 flex-1 basis-56 text-sm text-carvao">
            Ano da balança: <span className="font-label text-[1.6rem] leading-none tabular-nums">{a.ano}</span>
            <input
              id={idAno}
              type="range"
              min={anos[0].ano}
              max={ultimo.ano}
              step={1}
              value={a.ano}
              onChange={(e) => setAno(Number(e.target.value))}
              aria-valuetext={String(a.ano)}
              className="mt-2 block h-11 w-full cursor-pointer accent-[var(--cor-obee)]"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {ref && atalho(ref.ano, `${ref.ano}, referência da meta`)}
            {atalho(ultimo.ano, `${ultimo.ano}, último ano`)}
          </div>
        </div>

        {/* o desenho: três colunas na mesma escala, a linha do zero no meio */}
        <div aria-hidden="true" className="relative mt-6" style={{ height: ALTURA + 48 }}>
          <div className="absolute inset-x-0 border-t border-carvao" style={{ top: zero }} />
          <span className="absolute left-0 -translate-y-full pb-0.5 text-xs text-mineral" style={{ top: zero }}>
            zero
          </span>
          <div className="absolute inset-y-0 left-10 right-0 top-0 grid grid-cols-3 gap-4 sm:gap-6" style={{ height: ALTURA }}>
            {/* acima do zero, empilhado por setor */}
            <div className="relative">
              <div className="absolute inset-x-0 flex flex-col-reverse" style={{ bottom: ALTURA - zero }}>
                {setores.map((s) => (
                  <span key={s.id} className="block w-full" style={{ height: a.positivoPorSetor[s.id] * escala, background: s.cor }} />
                ))}
              </div>
              <span className="absolute inset-x-0 text-center text-xs tabular-nums text-carvao" style={{ bottom: ALTURA - zero + px(a.positivo) + 4 }}>
                +{mt(a.positivo)}
              </span>
            </div>
            {/* abaixo do zero */}
            <div className="relative">
              <span className="absolute inset-x-0 block" style={{ top: zero, height: px(a.negativo), background: "var(--serie-comp-3)" }} />
              <span className="absolute inset-x-0 text-center text-xs tabular-nums text-carvao" style={{ top: zero + px(a.negativo) + 4 }}>
                {mt(a.negativo)}
              </span>
            </div>
            {/* o saldo */}
            <div className="relative">
              <span className="absolute inset-x-0 block bg-carvao" style={a.liquido >= 0 ? { bottom: ALTURA - zero, height: px(a.liquido) } : { top: zero, height: px(a.liquido) }} />
              <span className="absolute inset-x-0 text-center text-xs font-medium tabular-nums text-carvao" style={a.liquido >= 0 ? { bottom: ALTURA - zero + px(a.liquido) + 4 } : { top: zero + px(a.liquido) + 4 }}>
                {mt(a.liquido)}
              </span>
            </div>
          </div>
          <div className="absolute bottom-0 left-10 right-0 grid grid-cols-3 gap-4 text-center text-xs leading-tight text-carvao-muted sm:gap-6">
            <span>Saldo positivo</span>
            <span>Saldo negativo</span>
            <span className="text-carvao">Líquido</span>
          </div>
        </div>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-carvao-muted">
          {setores.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-2.5 w-2.5" style={{ background: s.cor }} />
              {s.nome}
            </span>
          ))}
        </p>
      </div>

      <div className="min-w-0">
        <dl className="divide-y divide-linha border-y border-linha">
          <div className="py-4">
            <dt className="text-sm text-carvao">Categorias com saldo positivo em {a.ano}</dt>
            <dd className="mt-1">
              <span className="font-label text-[1.5rem] tabular-nums text-carvao">+{mt(a.positivo)}</span> <span className="text-sm text-carvao-muted">Mt CO2e</span>
            </dd>
            <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">
              Toda categoria em que o inventário registrou mais emissão que remoção: queima de combustíveis, gado, adubação, lixo e também a conversão
              de vegetação em pasto ou lavoura.
            </dd>
          </div>
          <div className="py-4">
            <dt className="text-sm text-carvao">Categorias com saldo negativo em {a.ano}</dt>
            <dd className="mt-1">
              <span className="font-label text-[1.5rem] tabular-nums text-carvao">{mt(a.negativo)}</span> <span className="text-sm text-carvao-muted">Mt CO2e</span>
            </dd>
            <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">
              {a.categoriasNegativas.length > 0 ? (
                <>
                  {a.categoriasNegativas.map((c, i) => (
                    <span key={c.codigo}>
                      {i > 0 && (i === a.categoriasNegativas.length - 1 ? " e " : "; ")}
                      {c.codigo} {c.nome}, <span className="tabular-nums">{mt(c.valor)} Mt</span>
                      {i === a.categoriasNegativas.length - 1 && "."}
                    </span>
                  ))}{" "}
                  O saldo é o que a categoria retirou da atmosfera menos o que emitiu; a remoção bruta não é publicada.
                </>
              ) : (
                <>Nenhuma categoria ficou com saldo negativo neste ano.</>
              )}
            </dd>
          </div>
          <div className="py-4">
            <dt className="text-sm text-carvao">Emissões líquidas em {a.ano}, o total publicado</dt>
            <dd className="mt-1">
              <span className="font-label text-[1.5rem] tabular-nums text-carvao">{mt(a.liquido)}</span> <span className="text-sm text-carvao-muted">Mt CO2e</span>
            </dd>
            <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">
              O lado positivo menos o lado negativo.
              {a.semValor > 0 && ` ${a.semValor} categorias sem valor publicado neste ano ficam fora dos dois lados.`}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
