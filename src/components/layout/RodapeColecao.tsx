import Link from "next/link";
import type { ReactNode } from "react";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { ParceriaTecnica } from "@/components/layout/ParceriaTecnica";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import { navegacaoDaColecao } from "@/lib/observatorios/navegacaoColecao";

/** Coleções de infraestrutura feitas com a parceria técnica do FGV CERI (decisão do dono de 20/10/2026: a marca em todos os painéis delas). */
export const COLECOES_COM_PARCERIA = ["setor-eletrico", "gas", "saneamento", "combustiveis"] as const;

/**
 * Rodapé da coleção, antes do rodapé institucional (Footer): as fontes e a data de atualização que a coleção declara
 * (`children`), os caminhos para a entrada, os dados, o método e o glossário, lidos do mesmo catálogo da navegação
 * (navegacaoColecao.ts), e, nas coleções de infraestrutura, a marca da parceria técnica com o FGV CERI. Iniciativa 2 do
 * parecer de UX de 21/10/2026: a marca saiu das linhas de navegação, para não gastar cromo, e vem aqui, com e sem sessão.
 * Numa página aberta, destino que pede conta leva o selo "com conta" (SeloComConta).
 */
export function RodapeColecao({ colecao, extras = [], children }: { colecao: string; extras?: { rotulo: string; href: string }[]; children?: ReactNode }) {
  const nav = navegacaoDaColecao(colecao);
  const nome = nav.nome;
  const destinos = [
    { rotulo: `Início de ${nome}`, href: nav.itens[0].href },
    ...(nav.atalhos.dados ? [{ rotulo: "Dados", href: nav.atalhos.dados }] : []),
    ...(nav.atalhos.metodo ? [{ rotulo: "Método", href: nav.atalhos.metodo }] : []),
    ...(nav.atalhos.glossario ? [{ rotulo: "Glossário", href: nav.atalhos.glossario }] : []),
    ...extras,
  ];
  const parceria = (COLECOES_COM_PARCERIA as readonly string[]).includes(colecao);
  const link = "inline-flex min-h-[44px] items-center gap-1 text-carvao underline-offset-4 hover:underline";
  return (
    <aside aria-label={`${nome}: fontes, método e parceria`} className="border-t border-linha bg-papel" data-rodape-colecao={colecao}>
      <div className="ed-pagina grid gap-x-10 gap-y-4 py-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          {children}
          <ul className="flex flex-wrap gap-x-6 text-sm">
            {destinos.map((d) => (
              <li key={d.href}>
                <Link href={d.href} prefetch={prefetchDoLink(d.href)} className={link}>
                  {d.rotulo}
                  <SeloComConta href={d.href} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        {parceria && <ParceriaTecnica variante="compacto" />}
      </div>
    </aside>
  );
}
