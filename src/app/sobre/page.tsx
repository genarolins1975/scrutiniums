import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeaderView } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { PageTitle } from "@/components/ui/SectionHeading";
import { contato, registroErros, secoesInstitucionais, type Secao } from "@/lib/sobre";
import { INSTITUCIONAL, preenchido } from "@/lib/institucional";
import { listaObservatorios } from "@/lib/acesso";

/**
 * Sobre a plataforma, no nível de todos os observatórios. As seções de decisão do
 * mantenedor (quem mantém, financiamento, conflitos, conselho) vêm de
 * config/institucional.json e não aparecem enquanto vazias.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Sobre a Scrutiniums",
  description: "Quem mantém a plataforma, como ela se financia, que regras editoriais seguem as notas, como erros são corrigidos e registrados, como citar, sob qual licença e como entrar em contato.",
  alternates: { canonical: "/sobre" },
};

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

export default function SobrePage() {
  const inst = secoesInstitucionais();
  const c = contato();
  const { erros } = registroErros();
  const doi = INSTITUCIONAL.zenodo.doi_conceito;
  const licenca = INSTITUCIONAL.dados.licenca_derivados;
  let n = 0;
  return (
    <div className="flex min-h-screen flex-col bg-marfim">
      <PublicHeaderView />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-14">
        <PageTitle
          label="Institucional"
          title="Sobre a Scrutiniums"
          description={`Plataforma de observatórios com dados oficiais, fonte e data em cada número: ${listaObservatorios()}.`}
        />
        <div className="mt-10 max-w-prose2 space-y-10">
          {inst.map((s) => <Bloco key={s.id} s={s} n={++n} />)}

          <section aria-labelledby="correcao">
            <div className="mb-3 flex items-baseline gap-4">
              <span className="font-serif text-xl text-bronze" aria-hidden="true">{String(++n).padStart(2, "0")}</span>
              <h2 id="correcao" className="font-serif text-2xl text-carvao">Política de correção</h2>
            </div>
            <p className="text-carvao-muted">
              Todo erro publicado entra no registro público de erros, com a superfície afetada, a gravidade, a data e o canal
              de detecção e a correção. Nada é apagado do registro, e campo não apurado fica como não apurado, nunca estimado.
              Uma auditoria automática roda todo dia 5 sobre as notas aprovadas; erro factual vira errata e entrada no registro.
            </p>
            <p className="mt-3 text-carvao-muted">
              <Link href="/sobre/erros" className={link}>Registro público de erros</Link> ({erros.length}{" "}
              {erros.length === 1 ? "erro registrado" : "erros registrados"}). Encontrou um erro? Escreva pelo contato abaixo, com o
              endereço da página e o número.
            </p>
          </section>

          <section aria-labelledby="governanca">
            <div className="mb-3 flex items-baseline gap-4">
              <span className="font-serif text-xl text-bronze" aria-hidden="true">{String(++n).padStart(2, "0")}</span>
              <h2 id="governanca" className="font-serif text-2xl text-carvao">Governança editorial</h2>
            </div>
            <p className="text-carvao-muted">
              As notas do Observatório do crédito seguem uma Constituição editorial: todo número vem da camada gold, cada parágrafo
              declara se é evidência ou inferência, há temas vedados e três revisões independentes, e a checagem de números é feita
              por código. <Link href="/sobre/governanca" className={link}>Ler a Constituição editorial</Link>.
            </p>
          </section>

          <section aria-labelledby="citar">
            <div className="mb-3 flex items-baseline gap-4">
              <span className="font-serif text-xl text-bronze" aria-hidden="true">{String(++n).padStart(2, "0")}</span>
              <h2 id="citar" className="font-serif text-2xl text-carvao">Como citar</h2>
            </div>
            <p className="text-carvao-muted">
              Cite o observatório, a fonte primária, a data de referência e o endereço da página, de preferência com link. Cada
              indicador em <Link href="/dados" className={link}>Dados abertos</Link> e cada gráfico do Observatório do crédito tem
              o botão Copiar citação, que monta esse texto com a data de acesso.
            </p>
            <p className="mt-3 text-carvao-muted">
              Para uso por programa, quem tem conta lê os arquivos pela <Link href="/dados/api" className={link}>API de leitura</Link>.
              {preenchido(doi) ? <> Séries depositadas com DOI: <a href={`https://doi.org/${doi}`} className={link}>{doi}</a>.</> : null}
            </p>
            {preenchido(licenca) ? <p className="mt-3 text-carvao-muted">{licenca}</p> : null}
          </section>

          <section aria-labelledby="contato">
            <div className="mb-3 flex items-baseline gap-4">
              <span className="font-serif text-xl text-bronze" aria-hidden="true">{String(++n).padStart(2, "0")}</span>
              <h2 id="contato" className="font-serif text-2xl text-carvao">Contato</h2>
            </div>
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
              Imprensa: <Link href="/imprensa" className={link}>números citáveis e orientações</Link>. Dados pessoais:{" "}
              <Link href="/privacidade" className={link}>política de privacidade</Link>.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
