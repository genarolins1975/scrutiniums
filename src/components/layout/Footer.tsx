import Link from "next/link";
import { LogoWordmark } from "@/components/ui/Logo";
import { LINKEDIN_URL } from "@/lib/contato";

export function Footer({ compacto = false }: { compacto?: boolean }) {
  if (compacto) return <FooterCompacto />;
  return (
    <footer className="border-t border-linha-escura bg-carvao text-marfim">
      <div className="mx-auto grid max-w-page gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-6">
        <div className="sm:col-span-2">
          <LogoWordmark onDark />
          <p className="mt-4 max-w-sm text-sm text-mineral-soft">
            Plataforma de inteligência analítica baseada em dados verificáveis.
            Três observatórios, leitura aberta, sem cadastro.
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
        <nav aria-label="Observatório Brasileiro de Eficiência Estatal">
          <p className="rotulo mb-4 text-mineral-soft">Eficiência Estatal</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/eficiencia-estatal/educacao-municipal-capitais" className="hover:text-bronze-soft">Educação nas capitais</Link></li>
            <li><Link href="/eficiencia-estatal/educacao-municipal-capitais/gastos" className="hover:text-bronze-soft">Gastos</Link></li>
            <li><Link href="/eficiencia-estatal/educacao-municipal-capitais/comparar" className="hover:text-bronze-soft">Comparar capitais</Link></li>
            <li><Link href="/eficiencia-estatal/educacao-municipal-capitais/metodos" className="hover:text-bronze-soft">Dados e métodos</Link></li>
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

/**
 * Rodapé compacto do domínio Energia (páginas de dados): uma faixa com a marca, os atalhos do observatório e os links institucionais,
 * sem a coluna de apresentação e sem o observatório de Crédito em destaque. Todos os links institucionais continuam disponíveis.
 */
function FooterCompacto() {
  const link = "inline-flex min-h-[32px] items-center hover:text-bronze-soft [@media(pointer:coarse)]:min-h-[44px]";
  return (
    <footer className="border-t border-linha-escura bg-carvao text-marfim">
      <div className="ed-pagina grid gap-x-10 gap-y-5 py-8 md:grid-cols-[auto_1fr_1fr_1fr]">
        <div>
          <LogoWordmark onDark />
          <p className="mt-2 text-xs text-mineral-soft">Informação aberta, método verificável. 100% gratuito, sem assinatura.</p>
        </div>
        <nav aria-label="Observatório Brasileiro do Setor Elétrico">
          <p className="rotulo mb-1 text-mineral-soft">Setor Elétrico</p>
          <ul className="flex flex-wrap gap-x-4 text-sm md:block">
            <li><Link href="/setor-eletrico" className={link}>Mapa do Observatório</Link></li>
            <li><Link href="/setor-eletrico/visao-geral" className={link}>Visão geral</Link></li>
            <li><Link href="/setor-eletrico/pld" className={link}>PLD explicado</Link></li>
            <li><Link href="/setor-eletrico/dados" className={link}>Dados e catálogo</Link></li>
            <li><Link href="/setor-eletrico/metodologia" className={link}>Metodologia</Link></li>
            <li><Link href="/setor-eletrico/aprenda" className={link}>Aprenda</Link></li>
          </ul>
        </nav>
        <nav aria-label="Observatório Brasileiro de Crédito">
          <p className="rotulo mb-1 text-mineral-soft">Crédito</p>
          <ul className="flex flex-wrap gap-x-4 text-sm md:block">
            <li><Link href="/observatorio" className={link}>Observatório</Link></li>
            <li><Link href="/dados" className={link}>Dados abertos</Link></li>
            <li><Link href="/observatorio/methodology" className={link}>Metodologia e fontes</Link></li>
            <li><Link href="/glossario" className={link}>Glossário</Link></li>
          </ul>
        </nav>
        <nav aria-label="Institucional">
          <p className="rotulo mb-1 text-mineral-soft">Institucional</p>
          <ul className="flex flex-wrap gap-x-4 text-sm md:block">
            <li><Link href="/imprensa" className={link}>Para a imprensa</Link></li>
            <li><Link href="/termos" className={link}>Termos de uso</Link></li>
            <li><Link href="/privacidade" className={link}>Privacidade</Link></li>
            <li><Link href="/entrar" className={link}>Entrar</Link></li>
            <li><Link href="/cadastro" className={link}>Cadastro</Link></li>
            <li>
              <a href={LINKEDIN_URL} rel="noopener noreferrer" target="_blank" className={link}>
                Contato · LinkedIn
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-linha-escura">
        <div className="ed-pagina flex flex-wrap items-center justify-between gap-2 py-3">
          <p className="text-xs text-mineral-soft">scrutiniums.com</p>
          <p className="text-xs text-mineral-soft">Dados com fontes, critérios, período de referência e limitações declaradas.</p>
        </div>
      </div>
    </footer>
  );
}
