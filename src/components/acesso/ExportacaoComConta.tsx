"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ehRotaPublica } from "@/lib/rotasPublicas";
import { Cadeado } from "./SeloComConta";
import { hrefEntrar, textosAcesso, useSessao } from "./sessao";

/**
 * Exportação gerada no navegador (CSV, XLSX montados na página) numa página aberta: sem sessão, o
 * botão sai da versão aberta e no lugar fica o convite para entrar, com o selo "com conta" (skill,
 * seção "aberto e com conta"). Com sessão, e em qualquer página fechada, os botões aparecem como
 * sempre. Enquanto a sessão não é conhecida, vale a versão aberta, que é também a do HTML do servidor.
 */
export function ExportacaoComConta({ rotulo, children, className = "" }: { rotulo: ReactNode; children?: ReactNode; className?: string }) {
  const caminho = usePathname();
  const logado = useSessao();
  const aberta = !!caminho && ehRotaPublica(caminho);
  if (!aberta || logado === true) return <>{children}</>;
  const t = textosAcesso(caminho);
  return (
    <a
      href={hrefEntrar(caminho)}
      data-exportacao-com-conta=""
      className={`inline-flex min-h-[44px] items-center gap-1.5 text-sm text-carvao-muted underline decoration-linha underline-offset-4 hover:text-carvao ${className}`}
    >
      {rotulo}
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-mineral">
        <Cadeado /> {t.selo}
      </span>
    </a>
  );
}
