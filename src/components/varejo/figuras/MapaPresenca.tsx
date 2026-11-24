import { plural, num } from "@/lib/varejo/formato";
import type { Presenca } from "@/lib/varejo/grupos";
import { COR_VOLUME, HACHURA_AUSENCIA } from "./escala";
import { GRADE_UF } from "./MapaBlocos";

/**
 * Mapa de presença: os 27 blocos do mapa de blocos da coleção (mesma grade de `MapaBlocos`), cheios onde o grupo atua e só com o
 * contorno onde não atua. Três estados distintos: lista de estados (cheios e vazios), "todos" (os 27 cheios, e o texto diz "todas as
 * unidades da federação") e "não divulgado" (os 27 hachurados: a lista não foi publicada, o que não quer dizer que o grupo não atue).
 * É esquema, não geografia: cada estado tem o mesmo tamanho. A lista por extenso acompanha a figura.
 */
export function MapaPresenca({ presenca, nomes, grupo }: Readonly<{ presenca: Presenca; /** Nome de cada UF, para o rótulo acessível. */ nomes: Readonly<Record<string, string>>; grupo: string }>) {
  const onde = new Set(presenca.ufs);
  const descricao =
    presenca.tipo === "nao_divulgado"
      ? `${grupo}: a lista de estados em que atua não foi divulgada.`
      : presenca.tipo === "todos"
        ? `${grupo} atua nas 27 unidades da federação.`
        : `${grupo} atua em ${num(presenca.ufs.length)} ${plural(presenca.ufs.length, "unidade da federação", "unidades da federação")}: ${presenca.ufs.map((u) => nomes[u] ?? u).join(", ")}.`;
  return (
    <div data-figura-varejo="mapa-presenca" data-mapa-presenca={presenca.tipo} data-estados={presenca.ufs.length} className="min-w-0">
      <div role="img" aria-label={descricao} className="grid w-full max-w-[15.5rem] grid-cols-6 gap-1">
        {Object.entries(GRADE_UF).map(([uf, [col, lin]]) => {
          const cheio = presenca.tipo !== "nao_divulgado" && onde.has(uf);
          const estilo = presenca.tipo === "nao_divulgado" ? { backgroundImage: HACHURA_AUSENCIA, boxShadow: "inset 0 0 0 1px var(--cor-linha)" } : cheio ? { background: COR_VOLUME } : { boxShadow: "inset 0 0 0 1px var(--cor-mineral-soft)" };
          return (
            <span key={uf} aria-hidden="true" data-uf={uf} data-presente={cheio ? "" : undefined} className={`flex aspect-square items-center justify-center text-xs leading-none ${cheio ? "font-medium text-papel" : "text-mineral"}`} style={{ gridColumn: col, gridRow: lin, ...estilo }}>
              {uf}
            </span>
          );
        })}
      </div>
      <ul className="t-meta mt-3 flex flex-wrap gap-x-5 gap-y-1 text-carvao-muted" aria-hidden="true">
        {presenca.tipo === "nao_divulgado" ? (
          <li className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0" style={{ backgroundImage: HACHURA_AUSENCIA, boxShadow: "inset 0 0 0 1px var(--cor-linha)" }} />
            lista de estados não divulgada
          </li>
        ) : (
          <>
            <li className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0" style={{ background: COR_VOLUME }} />
              {presenca.tipo === "todos" ? "atua nas 27 unidades da federação" : `atua (${num(presenca.ufs.length)})`}
            </li>
            {presenca.tipo === "lista" && (
              <li className="flex items-center gap-2">
                <span className="h-3 w-3 shrink-0" style={{ boxShadow: "inset 0 0 0 1px var(--cor-mineral-soft)" }} />
                sem loja registrada ({num(27 - presenca.ufs.length)})
              </li>
            )}
          </>
        )}
      </ul>
    </div>
  );
}
