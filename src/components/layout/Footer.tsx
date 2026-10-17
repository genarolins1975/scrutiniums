import Link from "next/link";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import { LogoWordmark } from "@/components/ui/Logo";
import { contato } from "@/lib/contato";
import { ACESSO } from "@/lib/acesso";
import { TEXTOS_LAYOUT } from "@/i18n/paginas/layout";
import { hrefNoIdioma } from "@/lib/i18n-href";
import type { Idioma } from "@/lib/idioma";

export function Footer({ compacto = false, idioma = "pt" }: { compacto?: boolean; idioma?: Idioma }) {
  if (compacto) return <FooterCompacto />;
  const t = TEXTOS_LAYOUT[idioma];
  const h = (href: string) => hrefNoIdioma(href, idioma);
  return (
    <footer className="border-t border-linha-escura bg-carvao text-marfim">
      <div className="mx-auto grid grid-cols-1 max-w-page gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-8">
        <div className="min-w-0 [overflow-wrap:anywhere] [&>span>span]:min-w-0 sm:col-span-2">
          <LogoWordmark onDark />
          <p className="mt-4 max-w-sm text-sm text-mineral-soft">
            {t.plataforma}
            {" "}{idioma === "pt" ? ACESSO.curto : t.acessoCurto}
          </p>
          <p className="rotulo mt-6 text-bronze-soft">
            {t.gratuito}
          </p>
        </div>
        <nav aria-label="Observatório Brasileiro de Crédito">
          <p className="rotulo mb-4 text-mineral-soft">Crédito</p>
          <ul className="space-y-2 text-sm">
            <li><Link href={h("/observatorio")} prefetch={prefetchDoLink(h("/observatorio"))} className="hover:text-bronze-soft">{t.observatorio}</Link></li>
            <li><Link href={h("/observatorio-do-credito")} prefetch={prefetchDoLink(h("/observatorio-do-credito"))} className="hover:text-bronze-soft">{t.oQueE}</Link></li>
            <li><Link href={h("/dados")} prefetch={prefetchDoLink(h("/dados"))} className="hover:text-bronze-soft">{t.dadosAbertos}</Link></li>
            <li><Link href={h("/resumo")} prefetch={prefetchDoLink(h("/resumo"))} className="hover:text-bronze-soft">{t.resumoDiario}</Link></li>
            <li><Link href={h("/observatorio/methodology")} prefetch={prefetchDoLink(h("/observatorio/methodology"))} className="hover:text-bronze-soft">{t.metodologiaFontes}</Link></li>
            <li><Link href={h("/glossario")} prefetch={prefetchDoLink(h("/glossario"))} className="hover:text-bronze-soft">{t.glossario}</Link></li>
          </ul>
        </nav>
        <nav aria-label="Observatório Brasileiro do Setor Elétrico">
          <p className="rotulo mb-4 text-mineral-soft">Setor Elétrico</p>
          <ul className="space-y-2 text-sm">
            <li><Link href={h("/setor-eletrico")} prefetch={prefetchDoLink(h("/setor-eletrico"))} className="hover:text-bronze-soft">{t.mapaObservatorio}</Link></li>
            <li><Link href={h("/setor-eletrico/visao-geral")} prefetch={prefetchDoLink(h("/setor-eletrico/visao-geral"))} className="hover:text-bronze-soft">{t.visaoGeral}</Link></li>
            <li><Link href={h("/setor-eletrico/pld")} prefetch={prefetchDoLink(h("/setor-eletrico/pld"))} className="hover:text-bronze-soft">{t.pldExplicado}</Link></li>
            <li><Link href={h("/setor-eletrico/dados")} prefetch={prefetchDoLink(h("/setor-eletrico/dados"))} className="hover:text-bronze-soft">{t.dadosCatalogo}</Link></li>
            <li><Link href={h("/setor-eletrico/metodologia")} prefetch={prefetchDoLink(h("/setor-eletrico/metodologia"))} className="hover:text-bronze-soft">{t.metodologia}</Link></li>
            <li><Link href={h("/setor-eletrico/aprenda")} prefetch={prefetchDoLink(h("/setor-eletrico/aprenda"))} className="hover:text-bronze-soft">{t.aprenda}</Link></li>
          </ul>
        </nav>
        <nav aria-label="Observatório Brasileiro de Eficiência Estatal">
          <p className="rotulo mb-4 text-mineral-soft">Eficiência Estatal</p>
          <ul className="space-y-2 text-sm">
            <li><Link href={h("/eficiencia-estatal")} prefetch={prefetchDoLink(h("/eficiencia-estatal"))} className="hover:text-bronze-soft">Eficiência Estatal</Link></li>
            <li><Link href={h("/eficiencia-estatal/educacao-municipal-capitais")} prefetch={prefetchDoLink(h("/eficiencia-estatal/educacao-municipal-capitais"))} className="hover:text-bronze-soft">{t.educacaoCapitais}</Link></li>
            <li><Link href={h("/eficiencia-estatal/saude-capitais")} prefetch={prefetchDoLink(h("/eficiencia-estatal/saude-capitais"))} className="hover:text-bronze-soft">{t.saudeCapitais}</Link></li>
            <li><Link href={h("/eficiencia-estatal/trabalho-renda")} prefetch={prefetchDoLink(h("/eficiencia-estatal/trabalho-renda"))} className="hover:text-bronze-soft">{t.trabalhoRenda}</Link></li>
            <li><Link href={h("/eficiencia-estatal/educacao-municipal-capitais/metodos")} prefetch={prefetchDoLink(h("/eficiencia-estatal/educacao-municipal-capitais/metodos"))} className="hover:text-bronze-soft">{t.metodosEducacao}</Link></li>
            <li><Link href={h("/eficiencia-estatal/saude-capitais/metodos")} prefetch={prefetchDoLink(h("/eficiencia-estatal/saude-capitais/metodos"))} className="hover:text-bronze-soft">{t.metodosSaude}</Link></li>
          </ul>
        </nav>
        <nav aria-label="Contas Públicas">
          <p className="rotulo mb-4 text-mineral-soft">Contas Públicas</p>
          <ul className="space-y-2 text-sm">
            <li><Link href={h("/contas-publicas")} prefetch={prefetchDoLink(h("/contas-publicas"))} className="inline-flex min-h-[44px] items-center hover:text-bronze-soft">Contas Públicas Federais</Link></li>
            <li><Link href={h("/contas-publicas-estaduais")} prefetch={prefetchDoLink(h("/contas-publicas-estaduais"))} className="inline-flex min-h-[44px] items-center hover:text-bronze-soft">Contas Públicas Estaduais</Link></li>
            <li><Link href={h("/saneamento")} prefetch={prefetchDoLink(h("/saneamento"))} className="inline-flex min-h-[44px] items-center hover:text-bronze-soft">Saneamento</Link></li>
          </ul>
        </nav>
        <nav aria-label="Observatório Brasileiro de Gás Natural">
          <p className="rotulo mb-4 text-mineral-soft">Gás Natural</p>
          <ul className="space-y-2 text-sm">
            <li><Link href={h("/gas-natural")} prefetch={prefetchDoLink(h("/gas-natural"))} className="hover:text-bronze-soft">{t.mapaObservatorio}</Link></li>
            <li><Link href={h("/gas-natural/producao")} prefetch={prefetchDoLink(h("/gas-natural/producao"))} className="hover:text-bronze-soft">{t.producao}</Link></li>
            <li><Link href={h("/gas-natural/gas-de-cozinha")} prefetch={prefetchDoLink(h("/gas-natural/gas-de-cozinha"))} className="hover:text-bronze-soft">{t.gasCozinha}</Link></li>
            <li><Link href={h("/gas-natural/precos")} prefetch={prefetchDoLink(h("/gas-natural/precos"))} className="hover:text-bronze-soft">{t.precosCadeia}</Link></li>
            <li><Link href={h("/gas-natural/dados")} prefetch={prefetchDoLink(h("/gas-natural/dados"))} className="hover:text-bronze-soft">{t.dadosMetodo}</Link></li>
          </ul>
        </nav>
        <nav aria-label={t.institucional}>
          <p className="rotulo mb-4 text-mineral-soft">{t.institucional}</p>
          <ul className="space-y-2 text-sm">
            <li><Link href={h("/sobre")} prefetch={prefetchDoLink(h("/sobre"))} className="hover:text-bronze-soft">{t.sobre}</Link></li>
            <li><Link href={h("/imprensa")} prefetch={prefetchDoLink(h("/imprensa"))} className="hover:text-bronze-soft">{t.paraImprensa}</Link></li>
            <li><Link href={h("/termos")} prefetch={prefetchDoLink(h("/termos"))} className="hover:text-bronze-soft">{t.termos}</Link></li>
            <li><Link href={h("/privacidade")} prefetch={prefetchDoLink(h("/privacidade"))} className="hover:text-bronze-soft">{t.privacidade}</Link></li>
            <li><Link href={h("/entrar")} prefetch={prefetchDoLink(h("/entrar"))} className="hover:text-bronze-soft">{t.entrar}</Link></li>
            <li><Link href={h("/cadastro")} prefetch={prefetchDoLink(h("/cadastro"))} className="hover:text-bronze-soft">{t.cadastro}</Link></li>
            <ContatoItens classe="hover:text-bronze-soft" idioma={idioma} />
          </ul>
        </nav>
      </div>
      <div className="border-t border-linha-escura">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-2 px-6 py-5">
          <p className="text-xs text-mineral-soft">scrutiniums.com</p>
          <p className="text-xs text-mineral-soft">
            {t.dadosDeclarados}
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
function ContatoItens({ classe, idioma = "pt" }: { classe: string; idioma?: Idioma }) {
  const c = contato(undefined, idioma);
  const t = TEXTOS_LAYOUT[idioma];
  const externo = (href: string) => (href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {});
  return (
    <>
      <li>
        <a href={c.principal.href} className={classe} {...externo(c.principal.href)}>
          {t.contato} · {c.principal.rotulo}
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
