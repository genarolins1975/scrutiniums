import { num } from "@/lib/varejo/formato";
import { eixo } from "./geometria";
import { COR_VOLUME, HACHURA, HACHURA_AUSENCIA } from "./escala";

export type ColunaPequena = {
  rotulo: string;
  /** null: período sem valor (lacuna desenhada, nunca zero). */
  valor: number | null;
  /** Segundo valor na mesma escala (o par da série). */
  par?: number | null;
  /** Valor republicado depois (reapresentação): vira o ponto cheio, e o publicado, o vazado. */
  reapresentado?: number | null;
};

/** Cor do que fica abaixo do zero (prejuízo, caixa consumido): o tom de aviso da plataforma, sempre com hachura junto. */
export const COR_ABAIXO_DO_ZERO = "var(--cor-aviso)";
const COR_PAR = "var(--serie-referencia)";

/**
 * Colunas pequenas de uma série curta (cinco exercícios, alguns trimestres), para andar em grade com outras: as colunas partem do
 * zero, cada período ocupa a mesma largura em todos os gráficos da grade, o valor vem escrito sobre a coluna e o período embaixo.
 * Valor negativo desce do zero, no tom de aviso e hachurado (a leitura não depende da cor). Período sem valor é uma lacuna tracejada
 * com "sem dado". Reapresentação: o valor publicado no exercício leva um ponto vazado no topo da coluna e o valor republicado no
 * exercício seguinte, um ponto cheio na altura dele. Escala própria de cada gráfico: comparam-se os anos, não os gráficos entre si.
 */
export function ColunasPequenas({ titulo, unidade, colunas, casas = 1, altura = 120, rotuloPar, descricao, rotulos = "todos" }: Readonly<{
  titulo: string;
  unidade: string;
  colunas: readonly ColunaPequena[];
  casas?: number;
  altura?: number;
  /** Nome da segunda série, quando há `par`. */
  rotuloPar?: string;
  /** Descrição acessível; sem ela, monta-se uma com todos os valores. */
  descricao?: string;
  /** "pontas": no celular só a primeira e a última coluna levam o valor escrito (as demais estão na tabela equivalente). */
  rotulos?: "todos" | "pontas";
}>) {
  const todos = colunas.flatMap((c) => [c.valor, c.par ?? null, c.reapresentado ?? null]);
  const validos = todos.filter((v): v is number => v !== null);
  const temPar = colunas.some((c) => c.par !== undefined);
  if (validos.length === 0) {
    return (
      <div data-colunas-pequenas="" className="min-w-0">
        <p className="text-sm font-medium leading-snug text-carvao">{titulo}</p>
        <p className="mt-2 text-xs italic text-mineral">sem valores publicados nos períodos</p>
      </div>
    );
  }
  const { min, max } = eixo(validos, { n: 2, incluir: 0 });
  const amplitude = max - min || 1;
  const topo = (v: number) => (100 * (max - v)) / amplitude;
  const zero = topo(0);
  const texto = (v: number) => num(v, casas);
  const acessivel = descricao ?? `${titulo}, ${unidade}: ${colunas.map((c) => `${c.rotulo}, ${c.valor === null ? "sem dado" : texto(c.valor)}${c.par !== undefined ? ` (${rotuloPar ?? "par"}: ${c.par === null ? "sem dado" : texto(c.par)})` : ""}${c.reapresentado != null ? `, reapresentado ${texto(c.reapresentado)}` : ""}`).join("; ")}.`;
  const barra = (v: number, cor: string, largura: string, esquerda: string) => {
    const neg = v < 0;
    return <span className="absolute min-h-[2px]" style={{ left: esquerda, width: largura, top: `${neg ? zero : topo(v)}%`, height: `${Math.abs(topo(v) - zero)}%`, background: neg ? COR_ABAIXO_DO_ZERO : cor, ...(neg ? { backgroundImage: HACHURA } : {}) }} />;
  };
  return (
    <div data-colunas-pequenas="" className="min-w-0">
      <p className="text-sm font-medium leading-snug text-carvao">
        {titulo} <span className="font-normal text-carvao-muted">· {unidade}</span>
      </p>
      {temPar && rotuloPar && (
        <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-carvao-muted" aria-hidden="true">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0" style={{ background: COR_VOLUME }} />
            {titulo.toLowerCase()}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0" style={{ background: COR_PAR }} />
            {rotuloPar.toLowerCase()}
          </span>
        </p>
      )}
      <div role="img" aria-label={acessivel} className="mt-6 grid" style={{ gridTemplateColumns: `repeat(${colunas.length}, minmax(0, 1fr))` }}>
        {colunas.map((c, i) => {
          const ponta = i === 0 || i === colunas.length - 1;
          const escondeNoCelular = rotulos === "pontas" && !ponta ? "hidden sm:block" : "";
          const acima = c.valor === null ? null : c.valor >= 0 ? topo(Math.max(c.valor, c.par ?? c.valor, c.reapresentado ?? c.valor)) : zero;
          return (
            <div key={c.rotulo} className="min-w-0" aria-hidden="true">
              <div className="relative" style={{ height: altura }}>
                {c.valor === null && (c.par ?? null) === null ? (
                  <span className="absolute inset-x-[18%] inset-y-0" style={{ backgroundImage: HACHURA_AUSENCIA, boxShadow: "inset 0 0 0 1px var(--cor-linha)" }} />
                ) : (
                  <>
                    {c.valor !== null && barra(c.valor, COR_VOLUME, temPar ? "34%" : "60%", temPar ? "14%" : "20%")}
                    {temPar && c.par != null && barra(c.par, COR_PAR, "34%", "52%")}
                    {c.reapresentado != null && c.valor !== null && (
                      <>
                        <span className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-papel" style={{ top: `${topo(c.valor)}%`, boxShadow: "inset 0 0 0 2px var(--cor-carvao)" }} />
                        <span className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-carvao" style={{ top: `${topo(c.reapresentado)}%`, boxShadow: "0 0 0 1.5px var(--cor-papel)" }} />
                      </>
                    )}
                    {acima !== null && c.valor !== null && !temPar && (
                      <span className={`absolute inset-x-0 -translate-y-full whitespace-nowrap pb-1 text-center text-xs leading-none tabular-nums text-carvao ${escondeNoCelular}`} style={{ top: `${acima}%` }}>
                        {texto(c.valor)}
                      </span>
                    )}
                  </>
                )}
                <span className="absolute inset-x-0 h-px bg-carvao" style={{ top: `${zero}%` }} />
              </div>
              {temPar && (
                <p className={`mt-1 text-center text-xs leading-tight tabular-nums text-carvao ${escondeNoCelular}`}>
                  {c.valor === null ? "" : texto(c.valor)}
                  <span className="block text-carvao-muted">{c.par == null ? "" : texto(c.par)}</span>
                </p>
              )}
              <p className="mt-1 text-center text-xs leading-tight tabular-nums text-mineral">
                {c.rotulo}
                {c.valor === null && (c.par ?? null) === null && <span className="block italic">sem dado</span>}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Legenda comum de uma grade de ColunasPequenas: abaixo do zero, lacuna e, quando houver, publicado e reapresentado. */
export function LegendaDasColunas({ reapresentacao = false, negativos = false, lacunas = false }: Readonly<{ reapresentacao?: boolean; negativos?: boolean; lacunas?: boolean }>) {
  if (!reapresentacao && !negativos && !lacunas) return null;
  return (
    <ul className="t-meta flex flex-wrap gap-x-6 gap-y-1 text-carvao-muted" aria-label="Como ler" data-legenda-colunas="">
      {negativos && (
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-3 shrink-0" style={{ background: COR_ABAIXO_DO_ZERO, backgroundImage: HACHURA }} />
          abaixo do zero (prejuízo, caixa consumido)
        </li>
      )}
      {reapresentacao && (
        <>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-papel" style={{ boxShadow: "inset 0 0 0 2px var(--cor-carvao)" }} />
            valor publicado no exercício
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-carvao" />
            reapresentado no exercício seguinte
          </li>
        </>
      )}
      {lacunas && (
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-3 shrink-0" style={{ backgroundImage: HACHURA_AUSENCIA, boxShadow: "inset 0 0 0 1px var(--cor-linha)" }} />
          exercício sem demonstração na base
        </li>
      )}
    </ul>
  );
}
