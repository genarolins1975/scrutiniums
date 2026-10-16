import Link from "@/components/energia/LinkSemPrefetch";
import { ListadasLogo } from "@/components/energia/ListadasLogo";
import { SEGMENTOS, type CelulaMatriz, type Segmento } from "@/lib/energia/listadas";
import type { LogoListada } from "@/lib/energia/tipos-listadas";

/**
 * Matriz de atuação: uma linha por companhia e uma coluna por segmento, cada coluna na sua unidade e com a sua escala (fração do maior
 * valor da coluna). "Não atua" é texto, sem barra: ausência de ativo sob controle não é barra de tamanho zero. Tabela semântica; as barras
 * são decorativas e o valor está escrito em cada célula.
 */
export function ListadasMatriz({
  linhas,
  legenda,
}: {
  linhas: { papel: string; nome: string; href: string; logo: LogoListada | null; celulas: Record<Segmento, CelulaMatriz> }[];
  legenda: string;
}) {
  return (
    <div className="tabela-scroll overflow-x-auto" role="region" aria-label={legenda} tabIndex={0}>
      <table className="w-full min-w-[720px] border-collapse text-sm" data-matriz-atuacao="">
        <caption className="sr-only">{legenda}</caption>
        <thead>
          <tr>
            <th scope="col" className="pb-2 pr-3 text-left text-xs font-medium text-carvao-muted">
              Companhia
            </th>
            {SEGMENTOS.map((s) => (
              <th key={s.id} scope="col" className="w-[26%] px-3 pb-2 text-left text-xs font-medium text-carvao-muted">
                {s.rotulo}
                <span className="block font-normal text-mineral">{s.unidade}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.papel} className="border-t border-linha">
              <th scope="row" className="py-2 pr-3 text-left font-normal">
                <Link href={l.href} className="flex min-h-[44px] items-center gap-3 text-carvao hover:text-energia-dark">
                  <ListadasLogo logo={l.logo} nome={l.nome} tamanho="sm" decorativo={!!l.logo?.arquivo} />
                  <span className="leading-tight">
                    <span className="block font-medium underline underline-offset-4">{l.nome}</span>
                    <span className="block text-xs text-mineral">{l.papel}</span>
                  </span>
                </Link>
              </th>
              {SEGMENTOS.map((s) => {
                const c = l.celulas[s.id];
                return (
                  <td key={s.id} className="px-3 py-2 align-middle">
                    {c.valor === null ? (
                      <span className="text-xs text-mineral">não atua</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="relative h-3 w-full max-w-[9rem] bg-energia-fundo" aria-hidden="true">
                          <span className="absolute inset-y-0 left-0 bg-energia" style={{ width: `${Math.max(1.5, 100 * c.fracao)}%` }} />
                        </span>
                        <span className="whitespace-nowrap text-xs tabular-nums text-carvao">{c.texto}</span>
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
