import Link from "next/link";
import { PublicHeaderView } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { PageTitle } from "@/components/ui/SectionHeading";
import { contato, registroErros, secoesInstitucionais, type Secao } from "@/lib/sobre";
import { INSTITUCIONAL, preenchido, textosInstitucionais } from "@/lib/institucional";
import { listaObservatorios } from "@/lib/acesso";
import { TEXTOS_SOBRE } from "@/i18n/paginas/sobre";
import { hrefNoIdioma } from "@/lib/i18n-href";
import type { Idioma } from "@/lib/idioma";

/**
 * Sobre a plataforma, no nível de todos os observatórios, nos dois idiomas. As seções
 * de decisão do mantenedor (quem mantém, financiamento, conflitos, conselho) vêm de
 * config/institucional.json e não aparecem enquanto vazias.
 */
const link = "text-bronze underline underline-offset-4 hover:text-bronze-dark";

function Bloco({ s, n }: { s: Secao; n: number }) {
  return (
    <section aria-labelledby={s.id}>
      <div className="mb-3 flex items-baseline gap-4">
        <span className="font-serif text-xl text-bronze" aria-hidden="true">{String(n).padStart(2, "0")}</span>
        <h2 id={s.id} className="font-serif text-2xl text-carvao">{s.titulo}</h2>
      </div>
      {s.paragrafos.map((p) => <p key={p} className="text-carvao-muted">{p}</p>)}
      {s.itens?.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-carvao-muted">{s.itens.map((i) => <li key={i}>{i}</li>)}</ul> : null}
    </section>
  );
}

function Titulo({ id, n, children }: { id: string; n: number; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline gap-4">
      <span className="font-serif text-xl text-bronze" aria-hidden="true">{String(n).padStart(2, "0")}</span>
      <h2 id={id} className="font-serif text-2xl text-carvao">{children}</h2>
    </div>
  );
}

export function SobreConteudo({ idioma }: { idioma: Idioma }) {
  const t = TEXTOS_SOBRE[idioma];
  const h = (href: string) => hrefNoIdioma(href, idioma);
  const inst = secoesInstitucionais(INSTITUCIONAL, idioma);
  const c = contato(INSTITUCIONAL, idioma);
  const { erros } = registroErros();
  const doi = INSTITUCIONAL.zenodo.doi_conceito;
  const licenca = textosInstitucionais(INSTITUCIONAL, idioma).licenca_derivados;
  let n = 0;
  return (
    <div className="flex min-h-screen flex-col bg-papel">
      <PublicHeaderView idioma={idioma} />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-14">
        <PageTitle label={t.rotulo} title={t.titulo} description={t.descricao(listaObservatorios(idioma))} />
        <div className="mt-10 max-w-prose2 space-y-10">
          {inst.map((s) => <Bloco key={s.id} s={s} n={++n} />)}

          <section aria-labelledby="correcao">
            <Titulo id="correcao" n={++n}>{t.correcaoTitulo}</Titulo>
            <p className="text-carvao-muted">{t.correcaoTexto}</p>
            <p className="mt-3 text-carvao-muted">
              <Link href={h("/sobre/erros")} className={link}>{t.registroLink}</Link> ({erros.length}{" "}
              {t.registroContagem(erros.length)}). {t.registroConvite}
            </p>
          </section>

          <section aria-labelledby="governanca">
            <Titulo id="governanca" n={++n}>{t.governancaTitulo}</Titulo>
            <p className="text-carvao-muted">
              {t.governancaTexto} <Link href={h("/sobre/governanca")} className={link}>{t.governancaLink}</Link>.
            </p>
          </section>

          <section aria-labelledby="citar">
            <Titulo id="citar" n={++n}>{t.citarTitulo}</Titulo>
            <p className="text-carvao-muted">
              {t.citarAntes} <Link href={h("/dados")} className={link}>{t.citarLink}</Link> {t.citarDepois}
            </p>
            <p className="mt-3 text-carvao-muted">
              {t.apiAntes} <Link href={h("/dados/api")} className={link}>{t.apiLink}</Link>.
              {preenchido(doi) ? <> {t.doi} <a href={`https://doi.org/${doi}`} className={link}>{doi}</a>.</> : null}
            </p>
            {preenchido(licenca) ? <p className="mt-3 text-carvao-muted">{licenca}</p> : null}
          </section>

          <section aria-labelledby="contato">
            <Titulo id="contato" n={++n}>{t.contatoTitulo}</Titulo>
            <p className="text-carvao-muted">
              <a href={c.principal.href} className={link} {...(c.principal.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {c.principal.rotulo}
              </a>
              {c.secundario ? (
                <>
                  {" "}· <a href={c.secundario.href} target="_blank" rel="noopener noreferrer" className={link}>{c.secundario.rotulo}</a>
                </>
              ) : null}
            </p>
            <p className="mt-3 text-carvao-muted">
              {t.imprensa} <Link href={h("/imprensa")} className={link}>{t.imprensaLink}</Link>. {t.dadosPessoais}{" "}
              <Link href={h("/privacidade")} className={link}>{t.privacidadeLink}</Link>.
            </p>
          </section>
        </div>
      </main>
      <Footer idioma={idioma} />
    </div>
  );
}
