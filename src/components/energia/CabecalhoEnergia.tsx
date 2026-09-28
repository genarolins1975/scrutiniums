import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";
import { SwitcherObservatorio } from "@/components/layout/SwitcherObservatorio";
import { AcessoConta } from "@/components/energia/AcessoConta";
import { MODULOS_ENERGIA } from "@/lib/energia/navegacao";
import { AtivoVisivel } from "@/components/energia/AtivoVisivel";

/**
 * Cabeçalho do Observatório Brasileiro do Setor Elétrico: marca Scrutiniums
 * acima do observatório, switcher de domínio e navegação dos módulos. Estático
 * (sem leitura de sessão no servidor): a conta é resolvida no cliente.
 */
export function CabecalhoEnergia({ atual }: { atual: string }) {
  return (
    <header className="border-b border-linha bg-superficie">
      <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 pt-4">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" aria-label="Scrutiniums: página inicial" className="inline-flex min-h-[44px] items-center gap-2.5">
            <LogoMark size={20} />
            <span className="font-serif text-base uppercase tracking-wide2 text-carvao">Scrutiniums</span>
          </Link>
          <span aria-hidden="true" className="h-5 w-px bg-linha" />
          <SwitcherObservatorio atual="energia" />
        </div>
        <div className="flex items-center gap-5">
          <Link href="/setor-eletrico/metodologia" className="rotulo hidden min-h-[44px] items-center text-carvao-muted hover:text-energia-dark md:inline-flex">
            Metodologia
          </Link>
          <AcessoConta destino="/setor-eletrico" />
        </div>
      </div>
      <div className="mx-auto max-w-page px-6 pb-1 pt-2">
        <p className="font-serif text-lg leading-snug text-carvao md:text-xl">
          <span aria-hidden="true" className="mr-2 inline-block h-2.5 w-2.5 bg-energia align-middle" />
          Observatório Brasileiro do Setor Elétrico
        </p>
      </div>
      <nav aria-label="Módulos do Observatório do Setor Elétrico" className="mx-auto max-w-page">
        <ul id="modulos-energia" className="tabela-scroll relative flex gap-0.5 px-4 md:px-5">
          {MODULOS_ENERGIA.map((m) => {
            const ativo = m.slug === atual;
            return (
              <li key={m.slug} className="shrink-0">
                <Link
                  href={m.href}
                  aria-current={ativo ? "page" : undefined}
                  className={`rotulo inline-flex min-h-[44px] items-center gap-1 whitespace-nowrap border-b-2 px-2 ${
                    ativo ? "border-energia text-carvao" : "border-transparent text-carvao-muted hover:text-carvao"
                  }`}
                >
                  {m.rotulo}
                  {!m.integrado && (
                    <span className="text-[0.62rem] tracking-normal text-mineral" title="Módulo em integração: escopo e fontes catalogadas, sem números publicados">
                      <span aria-hidden="true">○</span>
                      <span className="sr-only">(em integração)</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <AtivoVisivel alvo="modulos-energia" />
    </header>
  );
}
