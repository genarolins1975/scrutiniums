import Link from "next/link";
import { LogoWordmark } from "@/components/ui/Logo";
import { LINKEDIN_URL } from "@/lib/contato";

export function Footer() {
  return (
    <footer className="border-t border-linha-escura bg-carvao text-marfim">
      <div className="mx-auto grid max-w-page gap-10 px-6 py-14 md:grid-cols-5">
        <div className="md:col-span-2">
          <LogoWordmark onDark />
          <p className="mt-4 max-w-sm text-sm text-mineral-soft">
            Plataforma de inteligência analítica baseada em dados verificáveis.
            Dois observatórios, leitura aberta, sem cadastro.
          </p>
          <p className="rotulo mt-6 text-bronze-soft">
            100% gratuito · sem assinatura · sem cobrança
          </p>
        </div>
        <nav aria-label="Observatório Brasileiro de Crédito">
          <p className="rotulo mb-4 text-mineral-soft">Crédito</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/observatorio" className="hover:text-bronze-soft">Observatório</Link></li>
            <li><Link href="/observatorio-do-credito" className="hover:text-bronze-soft">O que é</Link></li>
            <li><Link href="/dados" className="hover:text-bronze-soft">Dados abertos</Link></li>
            <li><Link href="/resumo" className="hover:text-bronze-soft">Resumo diário</Link></li>
            <li><Link href="/observatorio/methodology" className="hover:text-bronze-soft">Metodologia e fontes</Link></li>
            <li><Link href="/glossario" className="hover:text-bronze-soft">Glossário</Link></li>
          </ul>
        </nav>
        <nav aria-label="Observatório Brasileiro do Setor Elétrico">
          <p className="rotulo mb-4 text-mineral-soft">Setor Elétrico</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/setor-eletrico" className="hover:text-bronze-soft">Mapa do Observatório</Link></li>
            <li><Link href="/setor-eletrico/visao-geral" className="hover:text-bronze-soft">Visão geral</Link></li>
            <li><Link href="/setor-eletrico/pld" className="hover:text-bronze-soft">PLD explicado</Link></li>
            <li><Link href="/setor-eletrico/dados" className="hover:text-bronze-soft">Dados e catálogo</Link></li>
            <li><Link href="/setor-eletrico/metodologia" className="hover:text-bronze-soft">Metodologia</Link></li>
            <li><Link href="/setor-eletrico/aprenda" className="hover:text-bronze-soft">Aprenda</Link></li>
          </ul>
        </nav>
        <nav aria-label="Institucional">
          <p className="rotulo mb-4 text-mineral-soft">Institucional</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/imprensa" className="hover:text-bronze-soft">Para a imprensa</Link></li>
            <li><Link href="/termos" className="hover:text-bronze-soft">Termos de uso</Link></li>
            <li><Link href="/privacidade" className="hover:text-bronze-soft">Privacidade</Link></li>
            <li><Link href="/entrar" className="hover:text-bronze-soft">Entrar</Link></li>
            <li><Link href="/cadastro" className="hover:text-bronze-soft">Cadastro</Link></li>
            <li>
              <a href={LINKEDIN_URL} rel="noopener noreferrer" target="_blank" className="hover:text-bronze-soft">
                Contato · LinkedIn
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-linha-escura">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-2 px-6 py-5">
          <p className="text-xs text-mineral-soft">scrutiniums.com</p>
          <p className="text-xs text-mineral-soft">
            Dados com fontes, critérios, período de referência e limitações declaradas.
          </p>
        </div>
      </div>
    </footer>
  );
}
