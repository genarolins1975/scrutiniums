import Link from "next/link";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import { LogoWordmark } from "@/components/ui/Logo";
import { contato } from "@/lib/contato";
import { ACESSO } from "@/lib/acesso";

export function Footer({ compacto = false }: { compacto?: boolean }) {
  if (compacto) return <FooterCompacto />;
  return (
    <footer className="border-t border-linha-escura bg-carvao text-marfim">
      <div className="mx-auto grid grid-cols-1 max-w-page gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-7">
        <div className="min-w-0 [overflow-wrap:anywhere] [&>span>span]:min-w-0 sm:col-span-2">
          <LogoWordmark onDark />
          <p className="mt-4 max-w-sm text-sm text-mineral-soft">
            Plataforma de inteligência analítica baseada em dados verificáveis.
            {" "}{ACESSO.curto}
          </p>
          <p className="rotulo mt-6 text-bronze-soft">
            100% gratuito · sem assinatura · sem cobrança
          </p>
        </div>
        <nav aria-label="Observatório Brasileiro de Crédito">
          <p className="rotulo mb-4 text-mineral-soft">Crédito</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/observatorio" prefetch={prefetchDoLink("/observatorio")} className="hover:text-bronze-soft">Observatório</Link></li>
            <li><Link href="/observatorio-do-credito" prefetch={prefetchDoLink("/observatorio-do-credito")} className="hover:text-bronze-soft">O que é</Link></li>
            <li><Link href="/dados" prefetch={prefetchDoLink("/dados")} className="hover:text-bronze-soft">Dados abertos</Link></li>
            <li><Link href="/resumo" prefetch={prefetchDoLink("/resumo")} className="hover:text-bronze-soft">Resumo diário</Link></li>
            <li><Link href="/observatorio/methodology" prefetch={prefetchDoLink("/observatorio/methodology")} className="hover:text-bronze-soft">Metodologia e fontes</Link></li>
            <li><Link href="/glossario" prefetch={prefetchDoLink("/glossario")} className="hover:text-bronze-soft">Glossário</Link></li>
          </ul>
        </nav>
        <nav aria-label="Observatório Brasileiro do Setor Elétrico">
          <p className="rotulo mb-4 text-mineral-soft">Setor Elétrico</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/setor-eletrico" prefetch={prefetchDoLink("/setor-eletrico")} className="hover:text-bronze-soft">Mapa do Observatório</Link></li>
            <li><Link href="/setor-eletrico/visao-geral" prefetch={prefetchDoLink("/setor-eletrico/visao-geral")} className="hover:text-bronze-soft">Visão geral</Link></li>
            <li><Link href="/setor-eletrico/pld" prefetch={prefetchDoLink("/setor-eletrico/pld")} className="hover:text-bronze-soft">PLD explicado</Link></li>
            <li><Link href="/setor-eletrico/dados" prefetch={prefetchDoLink("/setor-eletrico/dados")} className="hover:text-bronze-soft">Dados e catálogo</Link></li>
            <li><Link href="/setor-eletrico/metodologia" prefetch={prefetchDoLink("/setor-eletrico/metodologia")} className="hover:text-bronze-soft">Metodologia</Link></li>
            <li><Link href="/setor-eletrico/aprenda" prefetch={prefetchDoLink("/setor-eletrico/aprenda")} className="hover:text-bronze-soft">Aprenda</Link></li>
          </ul>
        </nav>
        <nav aria-label="Observatório Brasileiro de Eficiência Estatal">
          <p className="rotulo mb-4 text-mineral-soft">Eficiência Estatal</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/eficiencia-estatal" prefetch={prefetchDoLink("/eficiencia-estatal")} className="hover:text-bronze-soft">Eficiência Estatal</Link></li>
            <li><Link href="/eficiencia-estatal/educacao-municipal-capitais" prefetch={prefetchDoLink("/eficiencia-estatal/educacao-municipal-capitais")} className="hover:text-bronze-soft">Educação nas capitais</Link></li>
            <li><Link href="/eficiencia-estatal/saude-capitais" prefetch={prefetchDoLink("/eficiencia-estatal/saude-capitais")} className="hover:text-bronze-soft">Saúde nas capitais</Link></li>
            <li><Link href="/eficiencia-estatal/trabalho-renda" prefetch={prefetchDoLink("/eficiencia-estatal/trabalho-renda")} className="hover:text-bronze-soft">Trabalho e renda</Link></li>
            <li><Link href="/eficiencia-estatal/educacao-municipal-capitais/metodos" prefetch={prefetchDoLink("/eficiencia-estatal/educacao-municipal-capitais/metodos")} className="hover:text-bronze-soft">Dados e métodos, Educação</Link></li>
            <li><Link href="/eficiencia-estatal/saude-capitais/metodos" prefetch={prefetchDoLink("/eficiencia-estatal/saude-capitais/metodos")} className="hover:text-bronze-soft">Dados e métodos, Saúde</Link></li>
          </ul>
        </nav>
        <nav aria-label="Contas Públicas">
          <p className="rotulo mb-4 text-mineral-soft">Contas Públicas</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/contas-publicas" prefetch={prefetchDoLink("/contas-publicas")} className="inline-flex min-h-[44px] items-center hover:text-bronze-soft">Contas Públicas Federais</Link></li>
            <li><Link href="/contas-publicas-estaduais" prefetch={prefetchDoLink("/contas-publicas-estaduais")} className="inline-flex min-h-[44px] items-center hover:text-bronze-soft">Contas Públicas Estaduais</Link></li>
            <li><Link href="/saneamento" prefetch={prefetchDoLink("/saneamento")} className="inline-flex min-h-[44px] items-center hover:text-bronze-soft">Saneamento</Link></li>
          </ul>
        </nav>
        <nav aria-label="Institucional">
          <p className="rotulo mb-4 text-mineral-soft">Institucional</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/sobre" prefetch={prefetchDoLink("/sobre")} className="hover:text-bronze-soft">Sobre a Scrutiniums</Link></li>
            <li><Link href="/imprensa" prefetch={prefetchDoLink("/imprensa")} className="hover:text-bronze-soft">Para a imprensa</Link></li>
            <li><Link href="/termos" prefetch={prefetchDoLink("/termos")} className="hover:text-bronze-soft">Termos de uso</Link></li>
            <li><Link href="/privacidade" prefetch={prefetchDoLink("/privacidade")} className="hover:text-bronze-soft">Privacidade</Link></li>
            <li><Link href="/entrar" prefetch={prefetchDoLink("/entrar")} className="hover:text-bronze-soft">Entrar</Link></li>
            <li><Link href="/cadastro" prefetch={prefetchDoLink("/cadastro")} className="hover:text-bronze-soft">Cadastro</Link></li>
            <ContatoItens classe="hover:text-bronze-soft" />
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
      <div className="ed-pagina grid gap-x-10 gap-y-5 py-8 md:grid-cols-[auto_1fr_1fr_1fr_1fr]">
        <div>
          <LogoWordmark onDark />
          <p className="mt-2 text-xs text-mineral-soft">Informação aberta, método verificável. 100% gratuito, sem assinatura.</p>
        </div>
        <nav aria-label="Observatório Brasileiro do Setor Elétrico">
          <p className="rotulo mb-1 text-mineral-soft">Setor Elétrico</p>
          <ul className="flex flex-wrap gap-x-4 text-sm md:block">
            <li><Link href="/setor-eletrico" prefetch={prefetchDoLink("/setor-eletrico")} className={link}>Mapa do Observatório</Link></li>
            <li><Link href="/setor-eletrico/visao-geral" prefetch={prefetchDoLink("/setor-eletrico/visao-geral")} className={link}>Visão geral</Link></li>
            <li><Link href="/setor-eletrico/pld" prefetch={prefetchDoLink("/setor-eletrico/pld")} className={link}>PLD explicado</Link></li>
            <li><Link href="/setor-eletrico/dados" prefetch={prefetchDoLink("/setor-eletrico/dados")} className={link}>Dados e catálogo</Link></li>
            <li><Link href="/setor-eletrico/metodologia" prefetch={prefetchDoLink("/setor-eletrico/metodologia")} className={link}>Metodologia</Link></li>
            <li><Link href="/setor-eletrico/aprenda" prefetch={prefetchDoLink("/setor-eletrico/aprenda")} className={link}>Aprenda</Link></li>
          </ul>
        </nav>
        <nav aria-label="Observatório Brasileiro de Crédito">
          <p className="rotulo mb-1 text-mineral-soft">Crédito</p>
          <ul className="flex flex-wrap gap-x-4 text-sm md:block">
            <li><Link href="/observatorio" prefetch={prefetchDoLink("/observatorio")} className={link}>Observatório</Link></li>
            <li><Link href="/dados" prefetch={prefetchDoLink("/dados")} className={link}>Dados abertos</Link></li>
            <li><Link href="/observatorio/methodology" prefetch={prefetchDoLink("/observatorio/methodology")} className={link}>Metodologia e fontes</Link></li>
            <li><Link href="/glossario" prefetch={prefetchDoLink("/glossario")} className={link}>Glossário</Link></li>
          </ul>
        </nav>
        <nav aria-label="Contas Públicas">
          <p className="rotulo mb-4 text-mineral-soft">Contas Públicas</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/contas-publicas" prefetch={prefetchDoLink("/contas-publicas")} className="inline-flex min-h-[44px] items-center hover:text-bronze-soft">Contas Públicas Federais</Link></li>
            <li><Link href="/contas-publicas-estaduais" prefetch={prefetchDoLink("/contas-publicas-estaduais")} className="inline-flex min-h-[44px] items-center hover:text-bronze-soft">Contas Públicas Estaduais</Link></li>
            <li><Link href="/saneamento" prefetch={prefetchDoLink("/saneamento")} className="inline-flex min-h-[44px] items-center hover:text-bronze-soft">Saneamento</Link></li>
          </ul>
        </nav>
        <nav aria-label="Institucional">
          <p className="rotulo mb-1 text-mineral-soft">Institucional</p>
          <ul className="flex flex-wrap gap-x-4 text-sm md:block">
            <li><Link href="/sobre" prefetch={prefetchDoLink("/sobre")} className={link}>Sobre a Scrutiniums</Link></li>
            <li><Link href="/imprensa" prefetch={prefetchDoLink("/imprensa")} className={link}>Para a imprensa</Link></li>
            <li><Link href="/termos" prefetch={prefetchDoLink("/termos")} className={link}>Termos de uso</Link></li>
            <li><Link href="/privacidade" prefetch={prefetchDoLink("/privacidade")} className={link}>Privacidade</Link></li>
            <li><Link href="/entrar" prefetch={prefetchDoLink("/entrar")} className={link}>Entrar</Link></li>
            <li><Link href="/cadastro" prefetch={prefetchDoLink("/cadastro")} className={link}>Cadastro</Link></li>
            <ContatoItens classe={link} />
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

/** Contato do rodapé: e-mail institucional quando configurado; o LinkedIn fica como secundário. */
function ContatoItens({ classe }: { classe: string }) {
  const c = contato();
  const externo = (href: string) => (href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {});
  return (
    <>
      <li>
        <a href={c.principal.href} className={classe} {...externo(c.principal.href)}>
          Contato · {c.principal.rotulo}
        </a>
      </li>
      {c.secundario ? (
        <li>
          <a href={c.secundario.href} className={classe} {...externo(c.secundario.href)}>
            {c.secundario.rotulo}
          </a>
        </li>
      ) : null}
    </>
  );
}
