import type { Metadata } from "next";
import Link from "next/link";
import { Numero } from "@/components/observatorios/EntradaObservatorio";
import { FocosNoMunicipio } from "@/components/territorio/FocosNoMunicipio";
import { DoSateliteAoFoco } from "@/components/territorio/Queimadas";
import { TextoReadme } from "@/components/territorio/TextoReadme";
import { observatorio } from "@/lib/observatorios/registro";
import { colecoesDe } from "@/lib/observatorios/colecoes";
import { capturasTerritorio, cartoesTerritorio, escalaTerritorio, numeroDoCaminho } from "@/lib/observatorios/entradas/territorio";
import { portas } from "@/lib/perguntas/portas";
import { lerQueimadasMunicipios } from "@/lib/territorio/queimadas";
import { frase, lacunasTerritorio } from "@/lib/territorio/metodo";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { FRESCOR_DOS_OBSERVATORIOS } from "@/lib/frescor/entradas";
import { leva2Aprovada } from "@/lib/rotasPublicas";
import { ROTA_FOCOS_MUNICIPIO } from "@/lib/territorio/consultaFocos";
import { ParaVoce } from "@/components/observatorios/ParaVoce";

export const dynamic = "force-static";

const OBS = observatorio("territorio-e-clima");

export const metadata: Metadata = {
  title: { absolute: `${OBS.nome}: ${OBS.pergunta} · Scrutiniums` },
  description: "Fogo, desmatamento, desastres reconhecidos e emissões, com fonte e período em cada número, e a consulta de focos de calor por município.",
  robots: { index: false },
};

const link = "underline decoration-linha underline-offset-4 hover:decoration-carvao";

/**
 * Entrada com conta do Observatório do Território e Clima, pela checklist de página de
 * entrada: a pergunta e quatro números de escala lidos das golds; o bloco "Para você",
 * com a consulta por município embutida, e os painéis que o observatório mantém, cada um já com um número e uma
 * lista; o índice de todas as coleções a um clique; o modelo didático do foco de
 * calor; perguntas para outras coleções; as lacunas declaradas; método recolhido.
 * Rota fechada (não consta de src/lib/rotasPublicas.ts); /observatorios/territorio-e-clima
 * redireciona para cá.
 */
export default function EntradaTerritorio() {
  const escala = escalaTerritorio();
  const cartoes = cartoesTerritorio();
  const proprios = new Set(cartoes.map((c) => c.href));
  const porta = portas().find((p) => p.id === OBS.id);
  const caminhos = (porta?.caminhos ?? []).filter((c) => !proprios.has(c.href)).map((c) => ({ ...c, numero: numeroDoCaminho(c.href) }));
  const colecoes = colecoesDe(OBS.id);
  const lacunas = lacunasTerritorio();
  const capturas = capturasTerritorio();
  const gm = lerQueimadasMunicipios();
  const anoMun = gm?.periodos.ultimoAnoCompleto ? Number(gm.periodos.ultimoAnoCompleto.periodo.inicio.slice(0, 4)) : null;

  return (
    <main className="bg-papel">
      <section aria-labelledby="entrada-titulo" className="border-b border-linha bg-marfim">
        <FaixaFrescor dominios={FRESCOR_DOS_OBSERVATORIOS["territorio-e-clima"]} conteiner="mx-auto max-w-page px-6" />
        <div className="mx-auto max-w-page px-6 pb-12 pt-10 md:pb-16 md:pt-14">
          <nav aria-label="Trilha" className="text-sm text-carvao-muted">
            <Link href="/app/observatorios" prefetch={false} className={link}>Observatórios</Link>
            <span aria-hidden="true" className="mx-2 text-mineral">/</span>
            <span aria-current="page">{OBS.nomeCurto}</span>
          </nav>
          <p className="rotulo mt-8 flex items-center gap-3 text-mineral">
            <span aria-hidden="true" className="h-[3px] w-8 bg-obee" />
            {OBS.nome}
          </p>
          <h1 id="entrada-titulo" className="mt-5 max-w-4xl font-serif text-[clamp(2rem,4.4vw,3.2rem)] leading-[1.1] text-carvao [text-wrap:balance]">
            {OBS.pergunta}
          </h1>
          <p className="mt-6 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">
            O fogo e o desmatamento vistos por satélite, os desastres que a União reconheceu em cada município e as emissões do
            inventário oficial, cada número com a fonte e o período dele.
          </p>
          <h2 className="sr-only">O tema em números</h2>
          <dl className="mt-10 grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-4">
            {escala.map((n) => (
              <div key={n.rotulo} className="flex flex-col bg-papel p-5">
                <dt className="text-sm leading-snug text-carvao-muted">{n.rotulo}</dt>
                <dd className="mt-2"><Numero n={n} grande /></dd>
                {n.nota && <dd className="mt-3 border-l-2 border-linha pl-3 text-xs leading-relaxed text-carvao-muted">{n.nota}</dd>}
                <dd className="mt-auto pt-3">
                  <Link href={n.href} prefetch={false} className={`inline-flex min-h-[44px] items-center text-sm text-carvao ${link}`}>Ver no painel</Link>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-mineral">
            Os números vêm de fontes e períodos diferentes e não se somam nem se comparam entre si.
          </p>
        </div>
      </section>

      {/* "Para você" (Onda 2): o fogo e os desastres no município do leitor, a um clique, com a consulta dos focos por município embutida (antes "Teve fogo perto de você?") */}
      <ParaVoce entrada="/territorio" className="">
        <div className="grid gap-8 border-t border-linha pt-8 lg:grid-cols-12" data-consulta-municipio="">
          <div className="lg:col-span-5">
            <h3 id="municipio-titulo" className="font-serif text-xl leading-snug text-carvao">Focos de calor no seu município</h3>
            <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              {anoMun
                ? <>Escolha o município para ver os focos de calor de {anoMun}, a posição dele no país, os focos por área e o ano em curso contra os mesmos meses do ano anterior.</>
                : <>A contagem por município não está nesta publicação; o total do país e dos estados segue no painel de queimadas.</>}
            </p>
            <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-mineral">
              INPE, Programa Queimadas, satélite de referência. Zero focos não prova que não houve fogo: queimadas pequenas, rasteiras ou sob nuvem não aparecem.
            </p>
            <p className="mt-2">
              <Link href="/territorio/queimadas" prefetch={false} className={`inline-flex min-h-[44px] items-center text-sm text-carvao ${link}`}>Rankings de municípios no painel de queimadas</Link>
            </p>
            {/* consulta da leva 2 (src/lib/rotasPublicas.ts): o link só entra com a data da aprovação do dono */}
            {leva2Aprovada("teve-fogo-perto-de-mim") && (
              <p data-leva2="teve-fogo-perto-de-mim">
                <Link href={ROTA_FOCOS_MUNICIPIO} className={`inline-flex min-h-[44px] items-center text-sm text-carvao ${link}`}>A ficha de cada município, aberta para quem não tem conta</Link>
              </p>
            )}
          </div>
          <div className="min-w-0 lg:col-span-7">
            {anoMun ? <FocosNoMunicipio ano={anoMun} /> : <p className="border border-linha bg-papel p-5 text-sm text-carvao">Consulta por município indisponível nesta publicação.</p>}
          </div>
        </div>
      </ParaVoce>

      <section aria-labelledby="paineis-titulo" className="border-t border-linha">
        <div className="mx-auto max-w-page px-6 py-14 md:py-16">
          <h2 id="paineis-titulo" className="font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight text-carvao">Os painéis do observatório</h2>
          <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            Os três painéis que o observatório mantém, com dados próprios. Cada cartão já traz o número mais recente e uma lista; o
            painel tem a série, os estados, os municípios e o arquivo completo.
          </p>
          <ul className="mt-8 grid gap-px border border-linha bg-linha lg:grid-cols-3">
            {cartoes.map((c) => (
              <li key={c.id} className="flex min-w-0 flex-col bg-papel p-5 md:p-6">
                <p className="rotulo text-mineral">{c.titulo}</p>
                <h3 className="mt-2 font-serif text-xl leading-snug text-carvao">
                  <Link href={c.href} prefetch={false} className="hover:underline">{c.pergunta}</Link>
                </h3>
                <p className="mt-4 text-xs leading-snug text-carvao-muted">{c.numero.rotulo}</p>
                <div className="mt-1"><Numero n={c.numero} grande /></div>
                {c.numero.nota && <p className="mt-2 text-xs leading-relaxed text-carvao-muted">{c.numero.nota}</p>}
                {c.lista && (
                  <div className="mt-5">
                    <p className="text-xs font-medium text-carvao">{c.lista.titulo}</p>
                    <table className="mt-1 w-full text-sm">
                      <caption className="sr-only">{`${c.lista.titulo}, ${c.lista.unidade}, ${c.lista.periodo}`}</caption>
                      <tbody>
                        {c.lista.itens.map((it) => (
                          <tr key={it.nome}>
                            <th scope="row" className="border-b border-linha py-1.5 pr-3 text-left font-normal text-carvao">{it.nome}</th>
                            <td className="whitespace-nowrap border-b border-linha py-1.5 text-right tabular-nums text-carvao">{it.valor}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-2 text-xs leading-relaxed text-mineral">{c.lista.unidade} · {c.lista.fonte} · {c.lista.periodo}</p>
                  </div>
                )}
                <p className="mt-auto pt-5">
                  <Link href={c.href} prefetch={false} className={`inline-flex min-h-[44px] items-center gap-2 text-sm text-carvao ${link}`}>
                    Abrir o painel <span aria-hidden="true">→</span>
                  </Link>
                </p>
              </li>
            ))}
          </ul>

          <h3 className="mt-14 font-serif text-xl leading-snug text-carvao">Todos os painéis, por coleção</h3>
          <p className="mt-1 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            Os marcados com a origem são mantidos por outro observatório e aparecem aqui como atalho.
          </p>
          <div className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {colecoes.map((c) => (
              <section key={c.id} aria-labelledby={`colecao-${c.id}`} className="min-w-0">
                <h4 id={`colecao-${c.id}`} className="rotulo text-mineral">{c.nome}</h4>
                <ul className="mt-2">
                  {c.paineis.map((p) => (
                    <li key={p.href}>
                      <Link href={p.href} prefetch={false} className="group flex min-h-[44px] items-baseline justify-between gap-3 border-t border-linha py-2 text-sm text-carvao">
                        <span className="group-hover:underline">{p.titulo}</span>
                        {p.origem && <span className="shrink-0 text-xs text-mineral">{p.origem}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </section>

      <DoSateliteAoFoco
        introducao={
          <>
            O primeiro número desta página e o <Link href="/territorio/queimadas" prefetch={false} className={link}>painel de queimadas</Link> contam
            focos: pixels com fogo ativo vistos pelo satélite de referência do INPE. O esquema mostra por que foco não é área queimada nem número
            de incêndios. É uma ilustração, sem escala nem dado real.
          </>
        }
      />

      {caminhos.length > 0 && (
        <section aria-labelledby="caminhos-titulo" className="mx-auto max-w-page px-6 py-14 md:py-16">
          <h2 id="caminhos-titulo" className="font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight text-carvao">Outras perguntas do observatório</h2>
          <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            Desmatamento, cidades e água, nos painéis de outras coleções que o observatório reúne.
          </p>
          <ul className="mt-6 grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-3">
            {caminhos.map((c, i) => (
              <li key={c.href} className={`bg-papel ${i === caminhos.length - 1 ? `${caminhos.length % 2 === 1 ? "sm:col-span-2" : ""} ${caminhos.length % 3 === 2 ? "lg:col-span-2" : caminhos.length % 3 === 1 ? "lg:col-span-3" : "lg:col-span-1"}` : ""}`}>
                <Link href={c.href} prefetch={false} className="group flex h-full min-h-[44px] flex-col p-5">
                  <span className="rotulo text-mineral">{c.colecao}</span>
                  <span className="mt-2 font-serif text-lg leading-snug text-carvao group-hover:text-obee-dark">{c.pergunta}</span>
                  <span className="mt-1 text-sm leading-relaxed text-carvao-muted">{c.resumo}</span>
                  {c.numero && (
                    <span className="mt-4 block border-t border-linha pt-3">
                      <span className="block text-xs leading-snug text-carvao-muted">{c.numero.rotulo}</span>
                      <span className="mt-1 block"><Numero n={c.numero} /></span>
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lacunas.length > 0 && (
        <section aria-labelledby="lacunas-titulo" className="border-t border-linha">
          <div className="mx-auto max-w-page px-6 py-12 md:py-14">
            <h2 id="lacunas-titulo" className="font-serif text-[clamp(1.4rem,2.6vw,1.8rem)] leading-tight text-carvao">O que estes dados ainda não mostram</h2>
            <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              Lacunas declaradas: onde a fonte não publica o recorte, a plataforma não mostra zero nem estimativa.
            </p>
            <ul className="mt-6 grid gap-px border border-linha bg-linha md:grid-cols-3">
              {lacunas.map((l) => (
                <li key={l.rotulo} className="bg-papel p-5">
                  <p className="text-sm font-medium text-carvao">{l.rotulo}</p>
                  <p className="mt-2 text-sm leading-relaxed text-carvao-muted"><TextoReadme texto={frase(l.texto)} /></p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section aria-labelledby="metodo-titulo" className="mx-auto max-w-page px-6 pb-14">
        <details className="border-t border-linha pt-4">
          <summary id="metodo-titulo" className="rotulo flex min-h-[44px] cursor-pointer items-center text-carvao-muted hover:text-carvao">Método, fontes e atualização</summary>
          <div className="mt-2 max-w-prose2 space-y-3 text-sm leading-relaxed text-carvao-muted">
            <p>
              Fogo: focos de calor do satélite de referência do Programa Queimadas do INPE. Desastres: registros municipais com reconhecimento
              federal do Atlas Digital de Desastres no Brasil (Sedec/MIDR). Emissões: inventário nacional do MCTI (SIRENE). Desmatamento: PRODES do
              INPE, ano de agosto a julho. Cidades e água: SINISA do Ministério das Cidades, declarado por municípios e prestadores. Reservatórios: ONS.
            </p>
            <p>
              Os números são lidos das bases na publicação do site; quando uma base não pode ser lida, o número aparece como indisponível, nunca como zero.
            </p>
            <ul className="space-y-1">
              {capturas.map((c) => (
                <li key={c.href}>
                  {c.fonte}: {c.capturadoEm ? `capturado em ${c.capturadoEm}` : "data de captura indisponível nesta publicação"}.
                </li>
              ))}
            </ul>
            <ul className="flex flex-wrap gap-x-6 gap-y-1">
              {OBS.metodo && <li><Link href={OBS.metodo} className={`inline-flex min-h-[44px] items-center text-carvao ${link}`}>Método do Território e Clima: fontes, sha256 e validações</Link></li>}
              <li><Link href="/agronegocio/metodologia" className={`inline-flex min-h-[44px] items-center text-carvao ${link}`}>Agronegócio: método</Link></li>
              <li><Link href="/saneamento/metodologia" className={`inline-flex min-h-[44px] items-center text-carvao ${link}`}>Saneamento: método</Link></li>
              <li><Link href="/setor-eletrico/metodologia" className={`inline-flex min-h-[44px] items-center text-carvao ${link}`}>Setor Elétrico: método</Link></li>
              <li><Link href="/perguntas/territorio-e-clima" className={`inline-flex min-h-[44px] items-center text-carvao ${link}`}>Resumo aberto do observatório</Link></li>
            </ul>
          </div>
          <div className="mt-6"><FaixaFrescor dominios={FRESCOR_DOS_OBSERVATORIOS["territorio-e-clima"]} variante="metodo" /></div>
        </details>
      </section>
    </main>
  );
}
