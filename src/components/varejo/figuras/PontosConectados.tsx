import type { MedidaEmPontos, SinalDoExercicio } from "@/lib/varejo/comparador";
import { num } from "@/lib/varejo/formato";
import { nomeCurtoDoGrupo } from "@/lib/varejo/grupos";
import { eixo } from "./geometria";
import { HACHURA_AUSENCIA } from "./escala";

/** Marca de cada companhia, pela ordem da seleção: forma e tom diferentes, para a leitura não depender da cor. */
const MARCAS = [
  { cor: "var(--cor-gas)", forma: "circulo", cheia: true },
  { cor: "var(--serie-3)", forma: "losango", cheia: false },
  { cor: "var(--serie-4)", forma: "quadrado", cheia: true },
  { cor: "var(--serie-1)", forma: "circulo", cheia: false },
] as const;

export function MarcaDaCompanhia({ i, className = "" }: Readonly<{ i: number; className?: string }>) {
  const m = MARCAS[i % MARCAS.length];
  const base = `block h-3 w-3 shrink-0 ${m.forma === "circulo" ? "rounded-full" : ""} ${m.forma === "losango" ? "rotate-45" : ""} ${className}`;
  return <span aria-hidden="true" className={base} style={m.cheia ? { background: m.cor, boxShadow: "0 0 0 1.5px var(--cor-papel)" } : { background: "var(--cor-papel)", boxShadow: `inset 0 0 0 2.5px ${m.cor}` }} />;
}

export type PersistenciaDesenhada = { sinais: readonly SinalDoExercicio[]; texto: string };

/**
 * Pontos conectados: uma linha por medida, com a marca de cada companhia na posição do valor dela e um traço ligando a menor à
 * maior. O comprimento do traço é a distância entre as companhias naquela medida. As medidas de mesma unidade dividem o mesmo eixo
 * (as em % da receita líquida num grupo, as em dias de custo noutro), para os traços se compararem entre linhas. Para duas
 * companhias, a persistência vem desenhada ao lado: um quadrinho por exercício, cheio quando a primeira ficou acima, vazado quando
 * a segunda ficou, hachurado quando faltou o dado de uma delas. Nenhuma medida é somada às outras e nada vira nota.
 */
export function PontosConectados({ medidas, nomes, persistencia }: Readonly<{
  medidas: readonly MedidaEmPontos[];
  nomes: readonly string[];
  /** Por id de medida, só quando a comparação é de duas companhias. */
  persistencia?: Readonly<Record<string, PersistenciaDesenhada>>;
}>) {
  const unidades = Array.from(new Set(medidas.map((m) => m.medida.unidade)));
  return (
    <div data-figura-varejo="pontos-conectados" data-pontos-conectados={medidas.length} className="min-w-0">
      <ul className="t-meta flex flex-wrap gap-x-6 gap-y-1 text-carvao" aria-label="Marca de cada companhia">
        {nomes.map((n, i) => (
          <li key={n} className="flex items-center gap-2">
            <MarcaDaCompanhia i={i} />
            {n}
          </li>
        ))}
        {persistencia && (
          <li className="flex items-center gap-2 text-carvao-muted">
            <span aria-hidden="true" className="flex gap-[2px]">
              <span className="block h-3 w-3" style={{ background: MARCAS[0].cor }} />
              <span className="block h-3 w-3" style={{ boxShadow: `inset 0 0 0 2px ${MARCAS[1].cor}` }} />
            </span>
            um quadrinho por exercício: cheio, {nomeCurtoDoGrupo(nomes[0])} acima; vazado, {nomeCurtoDoGrupo(nomes[1])} acima
          </li>
        )}
      </ul>
      {unidades.map((unidade) => {
        const grupo = medidas.filter((m) => m.medida.unidade === unidade);
        const { min, max, marcas } = eixo(grupo.flatMap((m) => m.valores), { n: 5, incluir: 0 });
        const x = (v: number) => 6 + (88 * (v - min)) / (max - min || 1);
        return (
          <section key={unidade} className="mt-6" data-grupo-de-medidas={unidade}>
            <div className="grid items-end gap-x-4 border-b border-carvao pb-1 md:grid-cols-[14rem_minmax(0,1fr)_13rem]">
              <h3 className="rotulo text-mineral">{unidade}</h3>
              <div className="relative hidden h-4 md:block" aria-hidden="true">
                {marcas.map((m) => (
                  <span key={m} className={`absolute bottom-0 -translate-x-1/2 text-xs tabular-nums ${m === 0 ? "text-carvao" : "text-mineral"}`} style={{ left: `${x(m)}%` }}>
                    {num(m)}
                  </span>
                ))}
              </div>
              {persistencia && <p className="rotulo hidden text-mineral md:block">Nos exercícios</p>}
            </div>
            <ol>
              {grupo.map((m) => {
                const com = m.valores.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
                const lo = com.length ? Math.min(...com.map((p) => p.v)) : null;
                const hi = com.length ? Math.max(...com.map((p) => p.v)) : null;
                const pers = persistencia?.[m.medida.id];
                const casas = m.medida.casas;
                return (
                  <li key={m.medida.id} data-medida-em-pontos={m.medida.id} className="grid gap-x-4 gap-y-1 border-b border-linha py-2.5 md:grid-cols-[14rem_minmax(0,1fr)_13rem] md:items-center">
                    <p className="text-sm leading-snug text-carvao">
                      <span className="font-medium">{m.medida.rotulo}</span>
                      <span className="block text-xs text-carvao-muted">{m.medida.explica}</span>
                    </p>
                    <div className="min-w-0">
                      <div className="relative h-7" aria-hidden="true">
                        <span className="absolute inset-y-0 w-px bg-linha" style={{ left: `${x(0)}%` }} />
                        {lo !== null && hi !== null && hi > lo && <span className="absolute top-1/2 h-[3px] -translate-y-1/2 bg-mineral-soft" style={{ left: `${x(lo)}%`, width: `${x(hi) - x(lo)}%` }} />}
                        {com.map((p) => (
                          <span key={p.i} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${x(p.v)}%` }}>
                            <MarcaDaCompanhia i={p.i} />
                          </span>
                        ))}
                      </div>
                      <ul className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs tabular-nums text-carvao">
                        {m.valores.map((v, i) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <MarcaDaCompanhia i={i} className="scale-75" />
                            <span className="sr-only">{nomes[i]}: </span>
                            {v === null ? <span className="italic text-mineral">sem dado</span> : `${num(v, casas)}${unidade.startsWith("%") ? "%" : " dias"}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {pers && (
                      <p className="flex items-center gap-2.5 text-xs leading-snug text-carvao" data-persistencia-desenhada="">
                        <span aria-hidden="true" className="flex shrink-0 gap-[2px]">
                          {pers.sinais.map((s) => (
                            <span key={s.exercicio} title={String(s.exercicio)} className="block h-3.5 w-3.5" style={s.sinal === null ? { backgroundImage: HACHURA_AUSENCIA, boxShadow: "inset 0 0 0 1px var(--cor-linha)" } : s.sinal > 0 ? { background: MARCAS[0].cor } : s.sinal < 0 ? { boxShadow: `inset 0 0 0 2px ${MARCAS[1].cor}` } : { background: "var(--cor-linha)" }} />
                          ))}
                        </span>
                        <span>{pers.texto}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
