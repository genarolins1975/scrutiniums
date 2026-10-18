import Link from "next/link";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import { LogoWordmark } from "@/components/ui/Logo";
import { contato } from "@/lib/contato";
import { ACESSO } from "@/lib/acesso";
import { TEXTOS_LAYOUT } from "@/i18n/paginas/layout";
import { hrefNoIdioma } from "@/lib/i18n-href";
import type { Idioma } from "@/lib/idioma";
import { Nome } from "@/components/i18n/Nome";
import LinkIdioma from "@/components/i18n/LinkIdioma";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { OBSERVATORIOS } from "@/lib/observatorios/lista";
import { rotaPorta } from "@/lib/perguntas/rotas";

export function Footer({ compacto = false, idioma = "pt" }: { compacto?: boolean; idioma?: Idioma }) {
  if (compacto) return <FooterCompacto />;
  const t = TEXTOS_LAYOUT[idioma];
  const h = (href: string) => hrefNoIdioma(href, idioma);
  return (
    <footer className="border-t border-linha-escura bg-carvao text-marfim">
      <div className="mx-auto grid grid-cols-1 max-w-page gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0 [overflow-wrap:anywhere] [&>span>span]:min-w-0">
          <LogoWordmark onDark />
          <p className="mt-4 max-w-sm text-sm text-mineral-soft">
            {t.plataforma}
            {" "}{idioma === "pt" ? ACESSO.curto : t.acessoCurto}
          </p>
          <p className="rotulo mt-6 text-bronze-soft">
            {t.gratuito}
          </p>
        </div>
        {/* os seis observatórios levam às páginas abertas; as colunas seguintes são as coleções com seus métodos e glossários */}
        <nav aria-label={t.observatorios}>
          <p className="rotulo mb-4 text-mineral-soft">{t.observatorios}</p>
          <ul className="space-y-2 text-sm">
            {OBSERVATORIOS.map((o) => (
              <li key={o.id}><Link href={h(rotaPorta(o.id))} prefetch={prefetchDoLink(h(rotaPorta(o.id)))} className="hover:text-bronze-soft"><Nome>{o.nomeCurto}</Nome></Link></li>
            ))}
          </ul>
        </nav>
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
        <nav aria-label={tx("Observatório do Agronegócio Brasileiro", "Brazilian agribusiness observatory", idioma)}>
          <p className="rotulo mb-4 text-mineral-soft"><Nome>Agronegócio</Nome></p>
          <ul className="space-y-2 text-sm">
            <li><LinkIdioma href="/agronegocio" prefetch={false} className="inline-flex min-h-[44px] items-center hover:text-bronze-soft">{t.mapaObservatorio}</LinkIdioma></li>
            <li><LinkIdioma href="/agronegocio/aprenda" prefetch={false} className="inline-flex min-h-[44px] items-center hover:text-bronze-soft">{t.aprenda}</LinkIdioma></li>
            <li><LinkIdioma href="/agronegocio/metodologia" className="inline-flex min-h-[44px] items-center hover:text-bronze-soft">{t.metodologia}</LinkIdioma></li>
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
  // o idioma vem do endereço (idiomaEnergia vale para qualquer página): /en/setor-eletrico sai em inglês, o resto como sempre
  // os links seguem o idioma da página (LinkIdioma leva à irmã /en quando ela existe)
  const idioma = idiomaEnergia();
  const t = TEXTOS_LAYOUT[idioma];
  const link = "inline-flex min-h-[32px] items-center hover:text-bronze-soft [@media(pointer:coarse)]:min-h-[44px]";
  return (
    <footer className="border-t border-linha-escura bg-carvao text-marfim">
      <div className="ed-pagina grid gap-x-10 gap-y-5 py-8 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))]">
        <div>
          <LogoWordmark onDark />
          <p className="mt-2 text-xs text-mineral-soft">
            {tx("Informação aberta, método verificável. 100% gratuito, sem assinatura.", "Open information, verifiable method. 100% free, no subscription.", idioma)}
          </p>
        </div>
        <nav aria-label={tx("Observatório Brasileiro do Setor Elétrico", "Brazilian power sector observatory", idioma)}>
          <p className="rotulo mb-1 text-mineral-soft">
            <Nome>Setor Elétrico</Nome>
          </p>
          <ul className="flex flex-wrap gap-x-4 text-sm md:block">
            <li><LinkIdioma href="/setor-eletrico" prefetch={prefetchDoLink("/setor-eletrico")} className={link}>{t.mapaObservatorio}</LinkIdioma></li>
            <li><LinkIdioma href="/setor-eletrico/visao-geral" prefetch={prefetchDoLink("/setor-eletrico/visao-geral")} className={link}>{t.visaoGeral}</LinkIdioma></li>
            <li><LinkIdioma href="/setor-eletrico/pld" prefetch={prefetchDoLink("/setor-eletrico/pld")} className={link}>{t.pldExplicado}</LinkIdioma></li>
            <li><LinkIdioma href="/setor-eletrico/dados" prefetch={prefetchDoLink("/setor-eletrico/dados")} className={link}>{t.dadosCatalogo}</LinkIdioma></li>
            <li><LinkIdioma href="/setor-eletrico/metodologia" prefetch={prefetchDoLink("/setor-eletrico/metodologia")} className={link}>{t.metodologia}</LinkIdioma></li>
            <li><LinkIdioma href="/setor-eletrico/aprenda" prefetch={prefetchDoLink("/setor-eletrico/aprenda")} className={link}>{t.aprenda}</LinkIdioma></li>
          </ul>
        </nav>
        <nav aria-label={tx("Observatório Brasileiro de Crédito", "Brazilian credit observatory", idioma)}>
          <p className="rotulo mb-1 text-mineral-soft">
            <Nome>Crédito</Nome>
          </p>
          <ul className="flex flex-wrap gap-x-4 text-sm md:block">
            <li><LinkIdioma href="/observatorio" prefetch={prefetchDoLink("/observatorio")} className={link}>{t.observatorio}</LinkIdioma></li>
            <li><LinkIdioma href="/dados" prefetch={prefetchDoLink("/dados")} className={link}>{t.dadosAbertos}</LinkIdioma></li>
            <li><LinkIdioma href="/observatorio/methodology" prefetch={prefetchDoLink("/observatorio/methodology")} className={link}>{t.metodologiaFontes}</LinkIdioma></li>
            <li><LinkIdioma href="/glossario" prefetch={prefetchDoLink("/glossario")} className={link}>{t.glossario}</LinkIdioma></li>
          </ul>
        </nav>
        <nav aria-label={tx("Contas Públicas", "Public accounts", idioma)}>
          <p className="rotulo mb-4 text-mineral-soft">
            <Nome>Contas Públicas</Nome>
          </p>
          <ul className="space-y-2 text-sm">
            <li>
              <LinkIdioma href="/contas-publicas" prefetch={prefetchDoLink("/contas-publicas")} className="inline-flex min-h-[44px] items-center hover:text-bronze-soft">
                <Nome>Contas Públicas Federais</Nome>
              </LinkIdioma>
            </li>
            <li>
              <LinkIdioma href="/contas-publicas-estaduais" prefetch={prefetchDoLink("/contas-publicas-estaduais")} className="inline-flex min-h-[44px] items-center hover:text-bronze-soft">
                <Nome>Contas Públicas Estaduais</Nome>
              </LinkIdioma>
            </li>
            <li>
              <LinkIdioma href="/saneamento" prefetch={prefetchDoLink("/saneamento")} className="inline-flex min-h-[44px] items-center hover:text-bronze-soft">
                <Nome>Saneamento</Nome>
              </LinkIdioma>
            </li>
          </ul>
        </nav>
        <nav aria-label={tx("Observatório do Agronegócio Brasileiro", "Brazilian agribusiness observatory", idioma)}>
          <p className="rotulo mb-4 text-mineral-soft"><Nome>Agronegócio</Nome></p>
          <ul className="space-y-2 text-sm">
            <li><LinkIdioma href="/agronegocio" prefetch={false} className="inline-flex min-h-[44px] items-center hover:text-bronze-soft">{t.mapaObservatorio}</LinkIdioma></li>
            <li><LinkIdioma href="/agronegocio/aprenda" prefetch={false} className="inline-flex min-h-[44px] items-center hover:text-bronze-soft">{t.aprenda}</LinkIdioma></li>
            <li><LinkIdioma href="/agronegocio/metodologia" className="inline-flex min-h-[44px] items-center hover:text-bronze-soft">{t.metodologia}</LinkIdioma></li>
          </ul>
        </nav>
        <nav aria-label={t.institucional}>
          <p className="rotulo mb-1 text-mineral-soft">{t.institucional}</p>
          <ul className="flex flex-wrap gap-x-4 text-sm md:block">
            <li><LinkIdioma href="/sobre" prefetch={prefetchDoLink("/sobre")} className={link}>{t.sobre}</LinkIdioma></li>
            <li><LinkIdioma href="/imprensa" prefetch={prefetchDoLink("/imprensa")} className={link}>{t.paraImprensa}</LinkIdioma></li>
            <li><LinkIdioma href="/termos" prefetch={prefetchDoLink("/termos")} className={link}>{t.termos}</LinkIdioma></li>
            <li><LinkIdioma href="/privacidade" prefetch={prefetchDoLink("/privacidade")} className={link}>{t.privacidade}</LinkIdioma></li>
            <li><LinkIdioma href="/entrar" prefetch={prefetchDoLink("/entrar")} className={link}>{t.entrar}</LinkIdioma></li>
            <li><LinkIdioma href="/cadastro" prefetch={prefetchDoLink("/cadastro")} className={link}>{t.cadastro}</LinkIdioma></li>
            <ContatoItens classe={link} idioma={idioma} />
          </ul>
        </nav>
      </div>
      <div className="border-t border-linha-escura">
        <div className="ed-pagina flex flex-wrap items-center justify-between gap-2 py-3">
          {/* // i18n: dado (endereço do site) */}
          <p className="text-xs text-mineral-soft">scrutiniums.com</p>
          <p className="text-xs text-mineral-soft">{t.dadosDeclarados}</p>
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
