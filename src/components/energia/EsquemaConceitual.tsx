import Link from "next/link";
import { IconeSetor, type TipoIcone } from "@/components/energia/IconeSetor";

/**
 * Infográfico estrutural de um módulo (atores, etapas ou categorias) em linhas
 * ligadas por setas rotuladas. É um esquema, não um dado: cada nó diz se a sua
 * definição está conferida em fonte primária, pendente (verbete em preparação)
 * ou é leitura usual do setor. Sem números. Renderizado no servidor.
 */
export type NoEsquema = {
  rotulo: string;
  descricao?: string;
  icone?: TipoIcone;
  /** conferido: definição com fonte primária; pendente: verbete em preparação; leitura: leitura usual do setor. */
  estado?: "conferido" | "pendente" | "leitura";
  href?: string;
  destaque?: boolean;
};
export type LinhaEsquema = { nos: NoEsquema[]; separador?: "↔" | "·" | "|"; setaAntes?: string };

/* colunas por número de nós: uma no celular, duas a partir de sm, todas a partir de md */
const COLUNAS: Record<number, string> = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 md:grid-cols-4" };

const ESTADO: Record<NonNullable<NoEsquema["estado"]>, { rotulo: string; cls: string }> = {
  conferido: { rotulo: "● conferido na fonte", cls: "text-sucesso" },
  pendente: { rotulo: "○ verbete em preparação", cls: "text-aviso" },
  leitura: { rotulo: "leitura usual do setor", cls: "text-mineral" },
};

export function EsquemaConceitual({ titulo, linhas, nota }: { titulo: string; linhas: LinhaEsquema[]; nota: string }) {
  return (
    <figure className="border border-linha bg-papel p-4 md:p-6" aria-label={titulo}>
      <ol className="space-y-1">
        {linhas.map((l, i) => (
          <li key={i}>
            {l.setaAntes !== undefined && (
              <div className="flex flex-col items-center py-1" aria-hidden="true">
                <span className="h-4 w-px bg-mineral-soft" />
                {l.setaAntes && <span className="rotulo my-0.5 !text-[0.62rem] text-mineral">{l.setaAntes}</span>}
                <span className="h-3 w-px bg-mineral-soft" />
                <span className="-mt-1 text-mineral-soft">▼</span>
              </div>
            )}
            <ul className={`grid gap-2 ${COLUNAS[Math.min(4, l.nos.length)] ?? ""}`}>
              {l.nos.map((n, k) => {
                const est = n.estado ? ESTADO[n.estado] : null;
                const conteudo = (
                  <>
                    <span className="flex items-center gap-2 text-sm font-medium leading-snug text-carvao">
                      {n.icone && <IconeSetor tipo={n.icone} tamanho={15} className="text-mineral" />}
                      {n.rotulo}
                    </span>
                    {n.descricao && <span className="mt-1 block text-xs leading-relaxed text-carvao-muted">{n.descricao}</span>}
                    {est && <span className={`rotulo mt-2 block !text-[0.62rem] ${est.cls}`}>{est.rotulo}</span>}
                  </>
                );
                return (
                  <li key={n.rotulo} className="relative min-w-0">
                    {n.href ? (
                      <Link href={n.href} className={`block h-full min-h-[56px] border px-3 py-2 transition-colors hover:border-energia ${n.destaque ? "border-energia bg-superficie" : "border-linha bg-superficie"}`}>
                        {conteudo}
                      </Link>
                    ) : (
                      <div className={`h-full min-h-[56px] border px-3 py-2 ${n.destaque ? "border-energia bg-superficie" : "border-linha bg-superficie"}`}>{conteudo}</div>
                    )}
                    {l.separador && k < l.nos.length - 1 && (
                      <span aria-hidden="true" className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 bg-papel px-0.5 text-mineral sm:block">
                        {l.separador}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
      <figcaption className="mt-4 text-xs leading-relaxed text-mineral">{nota}</figcaption>
    </figure>
  );
}
