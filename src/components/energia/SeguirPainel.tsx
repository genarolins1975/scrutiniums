import Link from "next/link";
import type { ReactNode } from "react";
import { DetalheDoNivel } from "@/components/energia/DetalheDoNivel";
import { LinkDoPainel } from "@/components/energia/LinkDoPainel";

/**
 * Próximos passos de um painel numa linha só: baixar os dados, copiar o link com o recorte e seguir para a próxima pergunta.
 * Um arquivo vira link direto; vários arquivos ficam num bloco recolhível com a contagem, para a lista não ocupar a página (os
 * links continuam no HTML do servidor). Substitui os blocos `*Seguir` de cada módulo, que repetiam a mesma estrutura.
 */
export function SeguirPainel({
  ancora,
  downloads,
  proximo,
  extra,
}: {
  ancora: string;
  downloads: { rotulo: string; url: string }[];
  proximo?: { href: string; pergunta: string };
  extra?: ReactNode;
}) {
  const link = "inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4 hover:text-carvao";
  return (
    <div className="space-y-2 border-t border-linha pt-1" data-seguir-painel="">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-0">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-0">
          {downloads.length === 1 && (
            <a href={downloads[0].url} download className={link}>
              Baixar os dados: {downloads[0].rotulo}
            </a>
          )}
          {downloads.length > 1 && (
            <DetalheDoNivel resumo={`Baixar os dados (${downloads.length} arquivos)`} abreEm="analisar" className="[&[open]]:basis-full" dados={{ "data-downloads": "" }}>
              <ul className="flex flex-col gap-x-6 pb-2 md:flex-row md:flex-wrap">
                {downloads.map((d) => (
                  <li key={d.url}>
                    <a href={d.url} download className={link}>
                      {d.rotulo}
                    </a>
                  </li>
                ))}
              </ul>
            </DetalheDoNivel>
          )}
          <LinkDoPainel ancora={ancora} />
        </div>
        {proximo && (
          <p className="text-sm">
            <span className="text-mineral">Próxima pergunta: </span>
            <Link href={proximo.href} className={link}>
              {proximo.pergunta}
            </Link>
          </p>
        )}
      </div>
      {extra}
    </div>
  );
}
