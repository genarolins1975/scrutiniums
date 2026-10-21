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
      <div className="mx-auto grid max-w-page grid-cols-1 gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0 sm:col-span-2 lg:col-span-1 [overflow-wrap:anywhere] [&>span>span]:min-w-0">
          <LogoWordmark onDark />
          <p className="mt-4 max-w-sm text-sm text-mineral-soft">
            {t.plataforma}
            {" "}{idioma === "pt" ? ACESSO.curto : t.acessoCurto}
          </p>
          <p className="rotulo mt-6 text-bronze-soft">
            {t.gratuito}
          </p>
        </div>
        <ColunasObservatorios idioma={idioma} link="inline-flex min-h-[32px] items-center hover:text-bronze-soft [@media(pointer:coarse)]:min-h-[44px]" />
        <nav aria-label={t.institucional}>
          <p className="rotulo mb-4 text-mineral-soft">{t.institucional}</p>
          <ul className="space-y-2 text-sm">
            <li><Link href={h("/sobre")} prefetch={prefetchDoLink(h("/sobre"))} className="hover:text-bronze-soft">{t.sobre}</Link></li>
            <li><Link href={h("/observatorio-do-credito")} prefetch={prefetchDoLink(h("/observatorio-do-credito"))} className="hover:text-bronze-soft">{t.apresentacaoCredito}</Link></li>
            <li><Link href={h("/dados")} prefetch={prefetchDoLink(h("/dados"))} className="hover:text-bronze-soft">{t.dadosAbertos}</Link></li>
            <li><Link href={h("/resumo")} prefetch={prefetchDoLink(h("/resumo"))} className="hover:text-bronze-soft">{t.resumoDiario}</Link></li>
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
 * Uma coluna por observatório (Iniciativa 1 do parecer de UX, 21/10/2026): o nome do observatório leva à sua página aberta
 * (/perguntas/<id>), as coleções vêm do registro (src/lib/observatorios/lista.ts) com os nomes dele, e no fim da coluna
 * ficam o método e o glossário de cada coleção que os tem. Nomes de observatório e coleção são nomes de produto: ficam em
 * português nas duas línguas, marcados com <Nome>. Os rodapés completo e compacto usam as mesmas colunas.
 */
function ColunasObservatorios({ idioma, link }: { idioma: Idioma; link: string }) {
  const t = TEXTOS_LAYOUT[idioma];
  const h = (href: string) => hrefNoIdioma(href, idioma);
  return (
    <>
      {OBSERVATORIOS.map((o) => {
        const referencias = [
          ...o.colecoes.filter((c) => c.metodo || c.glossario).map((c) => ({ id: c.id, nome: c.nome, metodo: c.metodo, glossario: c.glossario })),
          ...(o.metodo ? [{ id: o.id, nome: o.nomeCurto, metodo: o.metodo, glossario: undefined }] : []),
        ];
        return (
          <nav key={o.id} aria-label={o.nome} className="min-w-0">
            <p className="rotulo mb-3 text-mineral-soft">
              <Link href={h(rotaPorta(o.id))} prefetch={prefetchDoLink(h(rotaPorta(o.id)))} className="hover:text-bronze-soft"><Nome>{o.nomeCurto}</Nome></Link>
            </p>
            <ul className="text-sm">
              {o.colecoes.map((c) => (
                <li key={c.id}><Link href={h(c.href)} prefetch={prefetchDoLink(h(c.href))} className={link}><Nome>{c.nome}</Nome></Link></li>
              ))}
            </ul>
            {referencias.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-mineral-soft">
                {referencias.map((r) => (
                  <li key={r.id}>
                    <Nome>{r.nome}</Nome>:{" "}
                    {r.metodo && <Link href={h(r.metodo)} prefetch={prefetchDoLink(h(r.metodo))} className="underline-offset-2 hover:text-bronze-soft hover:underline">{t.metodo}</Link>}
                    {r.metodo && r.glossario && " · "}
                    {r.glossario && <Link href={h(r.glossario)} prefetch={prefetchDoLink(h(r.glossario))} className="underline-offset-2 hover:text-bronze-soft hover:underline">{t.glossario}</Link>}
                  </li>
                ))}
              </ul>
            )}
          </nav>
        );
      })}
    </>
  );
}

/**
 * Rodapé compacto do domínio Energia (páginas de dados): a marca, as colunas dos seis observatórios e os links
 * institucionais, sem a coluna de apresentação. Todos os links institucionais continuam disponíveis.
 */
function FooterCompacto() {
  // o idioma vem do endereço (idiomaEnergia vale para qualquer página): /en/setor-eletrico sai em inglês, o resto como sempre
  // os links seguem o idioma da página (LinkIdioma leva à irmã /en quando ela existe)
  const idioma = idiomaEnergia();
  const t = TEXTOS_LAYOUT[idioma];
  const link = "inline-flex min-h-[32px] items-center hover:text-bronze-soft [@media(pointer:coarse)]:min-h-[44px]";
  return (
    <footer className="border-t border-linha-escura bg-carvao text-marfim">
      <div className="ed-pagina grid gap-x-10 gap-y-8 py-8 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <LogoWordmark onDark />
          <p className="mt-2 text-xs text-mineral-soft">
            {tx("Informação aberta, método verificável. 100% gratuito, sem assinatura.", "Open information, verifiable method. 100% free, no subscription.", idioma)}
          </p>
        </div>
        <ColunasObservatorios idioma={idioma} link={link} />
        <nav aria-label={t.institucional}>
          <p className="rotulo mb-1 text-mineral-soft">{t.institucional}</p>
          <ul className="flex flex-wrap gap-x-4 text-sm md:block">
            <li><LinkIdioma href="/sobre" prefetch={prefetchDoLink("/sobre")} className={link}>{t.sobre}</LinkIdioma></li>
            <li><LinkIdioma href="/dados" prefetch={prefetchDoLink("/dados")} className={link}>{t.dadosAbertos}</LinkIdioma></li>
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
