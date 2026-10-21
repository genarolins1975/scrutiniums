import { numero } from "@/lib/saneamento/formato";

/**
 * Onde o município fica em cada medida percentual da ficha, ao lado da UF, do Brasil e da mediana dos pares.
 * Uma faixa por medida, de 0% ao máximo da linha (100%, ou mais quando algum valor passa de 100%). Cada referência
 * tem forma própria (círculo cheio, quadrado, losango, traço), para que a cor não seja o único portador; a tabela
 * logo abaixo traz os mesmos números com universo e fonte. Sem ordem de mérito: a figura não diz se mais é melhor.
 */

export type LinhaPosicao = {
  rotulo: string;
  fonte: string;
  m: number | null;
  uf: number | null;
  br: number | null;
  pares: number | null;
};

const MARCAS = {
  m: { rotulo: "Município", classe: "h-3.5 w-3.5 rounded-full bg-obee ring-2 ring-papel" },
  uf: { rotulo: "UF", classe: "h-3 w-3 border-2 border-carvao bg-papel" },
  br: { rotulo: "Brasil", classe: "h-2.5 w-2.5 rotate-45 border-2 border-carvao-muted bg-papel" },
  pares: { rotulo: "Pares, mediana", classe: "h-4 w-[3px] bg-bronze" },
} as const;

type Chave = keyof typeof MARCAS;
const ORDEM: Chave[] = ["pares", "br", "uf", "m"];

function Marca({ chave }: { chave: Chave }) {
  return <span aria-hidden="true" className={`inline-block shrink-0 ${MARCAS[chave].classe}`} />;
}

function pct(v: number | null) {
  return v == null ? "sem dado" : `${numero(v, 1)}%`;
}

export function PosicaoMunicipio({ linhas, uf }: { linhas: LinhaPosicao[]; uf: string }) {
  const rotulo = (c: Chave) => (c === "uf" ? uf : MARCAS[c].rotulo);
  return (
    <figure className="mb-8" data-figura="posicao-municipio">
      <figcaption className="text-sm text-carvao">
        <span className="font-medium">Onde o município fica em cada medida.</span>{" "}
        <span className="text-carvao-muted">Percentuais; os números, o universo e a fonte de cada linha estão na tabela abaixo.</span>
      </figcaption>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-carvao" aria-label="Legenda">
        {(["m", "uf", "br", "pares"] as Chave[]).map((c) => (
          <li key={c} className="inline-flex items-center gap-2">
            <Marca chave={c} />
            {rotulo(c)}
          </li>
        ))}
      </ul>
      <ul className="mt-4 grid grid-cols-1 gap-x-10 gap-y-5 lg:grid-cols-2">
        {linhas.map((l) => {
          const valores = [l.m, l.uf, l.br, l.pares].filter((v): v is number => v != null);
          const max = Math.max(100, Math.ceil(Math.max(0, ...valores) / 25) * 25);
          const x = (v: number) => `${(Math.max(0, v) / max) * 100}%`;
          const resumo = ORDEM.slice()
            .reverse()
            .map((c) => `${rotulo(c)}: ${pct(l[c])}`)
            .join("; ");
          return (
            <li key={l.rotulo}>
              <p className="flex items-baseline justify-between gap-3 text-sm text-carvao">
                <span>
                  {l.rotulo} <span className="text-xs text-carvao-muted">({l.fonte})</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">{pct(l.m)}</span>
              </p>
              <div className="relative mt-1 h-7" aria-hidden="true">
                <span className="absolute inset-x-0 top-1/2 border-t border-linha" />
                {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                  <span key={f} className="absolute top-1/2 h-2 -translate-y-1/2 border-l border-linha" style={{ left: `${f * 100}%` }} />
                ))}
                {ORDEM.map((c) =>
                  l[c] == null ? null : (
                    <span
                      key={c}
                      title={`${rotulo(c)}: ${pct(l[c])}`}
                      className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                      style={{ left: x(l[c]!) }}
                    >
                      <Marca chave={c} />
                    </span>
                  ),
                )}
              </div>
              <p className="flex justify-between text-xs tabular-nums text-carvao-muted" aria-hidden="true">
                <span>0%</span>
                <span>{max}%</span>
              </p>
              <p className="sr-only">{resumo}.</p>
              {l.m == null && <p className="text-xs text-carvao-muted">Sem valor do município nesta medida; o motivo está na tabela.</p>}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
