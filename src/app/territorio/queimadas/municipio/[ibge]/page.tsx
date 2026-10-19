import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AvisoConsultaAberta } from "@/components/acesso/AvisoConsultaAberta";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { BuscaFocos } from "@/components/territorio/BuscaFocos";
import { dataBr, mesAno, n } from "@/components/territorio/Queimadas";
import { leva2Aprovada, prefetchDoLink } from "@/lib/rotasPublicas";
import { ROTA_FOCOS_MUNICIPIO, rotaFichaFocos } from "@/lib/territorio/consultaFocos";
import { fichaFocos, type FichaFocos, type PeriodoPublicado } from "@/lib/territorio/focosMunicipio";

// uma ficha por município, gerada na primeira visita e guardada (como a ficha do Saneamento)
export const dynamicParams = true;
export const revalidate = false;

export function generateMetadata({ params }: { params: { ibge: string } }): Metadata {
  const f = fichaFocos(params.ibge);
  if (!f) return { title: "Município não encontrado" };
  return {
    title: `Focos de calor em ${f.nome} (${f.uf})`,
    description: `Teve fogo perto de mim? Focos de calor detectados pelo satélite de referência do INPE em ${f.nome} (${f.uf}), por área e comparados com ${f.nomeUf}.`,
    alternates: { canonical: rotaFichaFocos(f.id) },
  };
}

const PAINEL = "/territorio/queimadas";
const link = "underline decoration-linha underline-offset-4 hover:decoration-carvao";

function intervalo(p: PeriodoPublicado): string {
  return p ? `${mesAno(p.inicio)} a ${mesAno(p.fim)}` : "";
}

function anoDo(p: PeriodoPublicado): string {
  return p ? p.inicio.slice(0, 4) : "";
}

const valor = (v: number | null, casas = 0) => (v == null ? "Indisponível" : n(v, casas));

/**
 * Ficha da consulta "Teve fogo perto de mim?" (leva 2, item teve-fogo-perto-de-mim
 * de src/lib/rotasPublicas.ts): os focos de calor no município no último ano
 * completo e no ano em curso, por área, e a comparação com a UF pela mesma gold.
 * Montada no servidor: o navegador não baixa a gold municipal. Sem série nem
 * ranking, que ficam no painel de queimadas. Ausência é dita como ausência;
 * zero só quando a regra da gold o calcula.
 */
export default function FichaFocosPagina({ params }: { params: { ibge: string } }) {
  const f = fichaFocos(params.ibge);
  if (!f) notFound();
  const aberta = leva2Aprovada("teve-fogo-perto-de-mim");
  const p = f.periodos;
  const ano = anoDo(p.ultimoAnoCompleto);

  return (
    <main className="bg-papel">
      {aberta && (
        <AvisoConsultaAberta
          className="mx-auto max-w-page px-6"
          comConta="A série desde 2003, os estados e biomas, os rankings de municípios e o arquivo completo"
        />
      )}
      <section aria-labelledby="ficha-focos-titulo" className="border-b border-linha bg-marfim">
        <div className="mx-auto max-w-page px-6 pb-12 pt-10 md:pb-14 md:pt-14">
          <nav aria-label="Trilha" className="text-sm text-carvao-muted">
            <Link href="/territorio" prefetch={prefetchDoLink("/territorio")} className={link}>Território e Clima<SeloComConta href="/territorio" /></Link>
            <span aria-hidden="true" className="mx-2 text-mineral">/</span>
            <Link href={ROTA_FOCOS_MUNICIPIO} className={link}>Meu município</Link>
            <span aria-hidden="true" className="mx-2 text-mineral">/</span>
            <span aria-current="page">{f.nome}</span>
          </nav>
          <p className="rotulo mt-8 flex items-center gap-3 text-mineral"><span aria-hidden="true" className="h-[3px] w-8 bg-obee" />Teve fogo perto de mim?</p>
          <h1 id="ficha-focos-titulo" className="mt-5 max-w-4xl font-serif text-[clamp(2rem,4.4vw,3.2rem)] leading-[1.1] text-carvao [text-wrap:balance]">
            Focos de calor em {f.nome} ({f.uf})
          </h1>
          <Resumo f={f} />

          <h2 className="sr-only">Os números do município</h2>
          {f.semCobertura ? (
            <p className="mt-10 max-w-prose2 border border-linha bg-papel p-5 text-sm leading-relaxed text-carvao">Indisponível. {f.semCobertura}</p>
          ) : (
            <dl className="mt-10 grid gap-px border border-linha bg-linha sm:grid-cols-3">
              <div className="flex flex-col bg-papel p-5">
                <dt className="text-sm leading-snug text-carvao-muted">Focos em {ano || "último ano completo"}</dt>
                <dd className="mt-2"><span className="font-label text-[2rem] leading-none tabular-nums text-carvao">{valor(f.focos.ultimoAnoCompleto)}</span> {f.focos.ultimoAnoCompleto != null && <span className="text-sm text-carvao-muted">focos</span>}</dd>
                <dd className="mt-2 text-xs leading-relaxed text-mineral">
                  {p.ultimoAnoCompleto ? `${ano}, ano fechado, arquivo anual do satélite de referência` : "Período ausente desta publicação"}
                </dd>
                {f.posicaoBrasil && <dd className="mt-3 border-l-2 border-linha pl-3 text-xs leading-relaxed text-carvao-muted">{n(f.posicaoBrasil)}º entre os {n(f.comFocoBrasil)} municípios do país com foco no ano.</dd>}
              </div>
              <div className="flex flex-col bg-papel p-5">
                <dt className="text-sm leading-snug text-carvao-muted">Focos por 1.000 km² em {ano || "último ano completo"}</dt>
                <dd className="mt-2"><span className="font-label text-[2rem] leading-none tabular-nums text-carvao">{valor(f.porMilKm2, 1)}</span></dd>
                <dd className="mt-2 text-xs leading-relaxed text-mineral">
                  {f.areaKm2 != null ? `Área de ${n(f.areaKm2)} km², Censo 2022` : f.porMilKm2 === 0 ? "Nenhum foco no ano: zero por qualquer área" : "Área indisponível nesta publicação"}
                </dd>
                <dd className="mt-3 border-l-2 border-linha pl-3 text-xs leading-relaxed text-carvao-muted">Divide pela área para comparar municípios de tamanhos diferentes.</dd>
              </div>
              <div className="flex flex-col bg-papel p-5">
                <dt className="text-sm leading-snug text-carvao-muted">{p.acumuladoAnoCorrente ? `Focos de ${intervalo(p.acumuladoAnoCorrente)}` : "Focos no ano em curso"}</dt>
                <dd className="mt-2"><span className="font-label text-[2rem] leading-none tabular-nums text-carvao">{valor(f.focos.acumuladoAnoCorrente)}</span> {f.focos.acumuladoAnoCorrente != null && <span className="text-sm text-carvao-muted">focos</span>}</dd>
                <dd className="mt-2 text-xs leading-relaxed text-mineral">
                  {f.focos.mesmoPeriodoAnoAnterior != null && p.mesmoPeriodoAnoAnterior
                    ? `${n(f.focos.mesmoPeriodoAnoAnterior)} nos mesmos meses de ${anoDo(p.mesmoPeriodoAnoAnterior)}`
                    : "Comparação com o ano anterior indisponível"}
                </dd>
                <dd className="mt-3 border-l-2 border-linha pl-3 text-xs leading-relaxed text-carvao-muted">Ano em curso, preliminar: o INPE pode regerar os arquivos mensais.</dd>
              </div>
            </dl>
          )}
          <p className="mt-4 max-w-prose2 border-l-2 border-obee pl-3 text-sm leading-relaxed text-carvao">
            Foco de calor não é incêndio nem área queimada: é um pixel de cerca de 1 km com fogo ativo na passagem do satélite. Fogo pequeno,
            rasteiro ou sob nuvem não aparece, e zero focos não prova que não houve fogo.
          </p>
        </div>
      </section>

      {!f.semCobertura && <ComparacaoUf f={f} />}

      <section aria-labelledby="outro-municipio-titulo" className="border-t border-linha">
        <div className="mx-auto grid max-w-page gap-8 px-6 py-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 id="outro-municipio-titulo" className="font-serif text-2xl leading-tight text-carvao">Ver outro município</h2>
            <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              A série desde 2003, os estados, os biomas e os municípios com mais focos ficam no{" "}
              <Link href={PAINEL} prefetch={prefetchDoLink(PAINEL)} className={link}>painel de queimadas<SeloComConta href={PAINEL} /></Link>.
            </p>
          </div>
          <div className="min-w-0 lg:col-span-7"><BuscaFocos /></div>
        </div>
      </section>

      <section aria-labelledby="metodo-focos-titulo" className="mx-auto max-w-page px-6 pb-12">
        <details className="border-t border-linha pt-4">
          <summary id="metodo-focos-titulo" className="rotulo flex min-h-[44px] cursor-pointer items-center text-carvao-muted hover:text-carvao">Método, fontes e ressalvas</summary>
          <div className="mt-3 max-w-prose2 space-y-3 text-sm leading-relaxed text-carvao-muted">
            <p>
              Fonte: {f.fonte.portal ? <a href={f.fonte.portal} className={link}>{f.fonte.nome}</a> : f.fonte.nome}. Satélite de referência {f.fonte.satelite}.
              Captura em {dataBr(f.fonte.capturadoEm)}, com data de referência {dataBr(f.fonte.dataReferencia)}. Área territorial: {f.fonte.area}.
            </p>
            <p>
              O último ano completo vem do arquivo anual do satélite de referência; o ano em curso, dos arquivos mensais filtrados para o mesmo
              satélite. A soma do estado usa a mesma contagem por município, por isso fecha com a ficha. O arquivo anual traz o nome do
              município, não o código: o nome é casado com a lista oficial do IBGE.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              {f.fonte.ressalvas.map((r) => <li key={r}>{r}</li>)}
            </ul>
            <p>
              O método completo do observatório está em <Link href="/territorio/metodologia" className={link}>Território e Clima: método</Link>.
            </p>
          </div>
        </details>
      </section>
    </main>
  );
}

function Resumo({ f }: Readonly<{ f: FichaFocos }>) {
  const ano = anoDo(f.periodos.ultimoAnoCompleto);
  let frase: string;
  if (f.semCobertura) frase = `A fonte não traz contagem própria para ${f.nome}.`;
  else if (f.focos.ultimoAnoCompleto == null) frase = `A contagem de ${f.nome} no último ano completo está indisponível nesta publicação.`;
  else if (f.focos.ultimoAnoCompleto === 0) frase = `O satélite de referência do INPE não detectou foco de calor em ${f.nome} em ${ano}.`;
  else frase = `O satélite de referência do INPE detectou ${n(f.focos.ultimoAnoCompleto)} ${f.focos.ultimoAnoCompleto === 1 ? "foco" : "focos"} de calor em ${f.nome} em ${ano}.`;
  return <p className="mt-6 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">{frase}</p>;
}

/** Município ao lado do estado, pelas mesmas contagens. A densidade do estado não sai desta gold: ela traz a área só dos municípios com foco. */
function ComparacaoUf({ f }: Readonly<{ f: FichaFocos }>) {
  const p = f.periodos;
  const ano = anoDo(p.ultimoAnoCompleto);
  const parcela = f.focos.ultimoAnoCompleto != null && f.focosUf.ultimoAnoCompleto ? (100 * f.focos.ultimoAnoCompleto) / f.focosUf.ultimoAnoCompleto : null;
  const linhas: { medida: string; municipio: string; uf: string }[] = [
    { medida: `Focos em ${ano}`, municipio: valor(f.focos.ultimoAnoCompleto), uf: valor(f.focosUf.ultimoAnoCompleto) },
    ...(p.acumuladoAnoCorrente ? [{ medida: `Focos de ${intervalo(p.acumuladoAnoCorrente)}`, municipio: valor(f.focos.acumuladoAnoCorrente), uf: valor(f.focosUf.acumuladoAnoCorrente) }] : []),
    ...(p.mesmoPeriodoAnoAnterior ? [{ medida: `Focos de ${intervalo(p.mesmoPeriodoAnoAnterior)}`, municipio: valor(f.focos.mesmoPeriodoAnoAnterior), uf: valor(f.focosUf.mesmoPeriodoAnoAnterior) }] : []),
    { medida: `Focos por 1.000 km² em ${ano}`, municipio: valor(f.porMilKm2, 1), uf: "Indisponível" },
  ];
  return (
    <section aria-labelledby="uf-titulo" className="mx-auto max-w-page px-6 py-12 md:py-14">
      <h2 id="uf-titulo" className="font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight text-carvao">Comparado com {f.nomeUf}</h2>
      <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        {f.focos.ultimoAnoCompleto === 0 && f.focosUf.ultimoAnoCompleto
          ? <>Em {ano}, nenhum foco de calor foi detectado em {f.nome}; {f.nomeUf} somou {n(f.focosUf.ultimoAnoCompleto)} focos na mesma contagem.</>
          : parcela != null && f.focosUf.ultimoAnoCompleto
          ? <>Em {ano}, {f.nome} teve {n(parcela, 1)}% dos focos de calor de {f.nomeUf}{f.posicaoUf ? <> e foi o {n(f.posicaoUf)}º entre os {n(f.comFocoUf)} municípios do estado com foco</> : null}.</>
          : f.focosUf.ultimoAnoCompleto === 0
            ? <>Nenhum foco de calor detectado no estado em {ano}: a parcela do município não se calcula.</>
            : <>A contagem do último ano completo está indisponível nesta publicação: a parcela do município no estado não se calcula.</>}
      </p>
      <div className="mt-6 overflow-x-auto" role="region" aria-label={`Focos de calor de ${f.nome} e de ${f.nomeUf} (rolável)`} tabIndex={0}>
        <table className="w-full text-sm">
          <caption className="sr-only">Focos de calor do município e do estado, satélite de referência do INPE</caption>
          <thead>
            <tr className="border-b border-carvao text-left">
              <th scope="col" className="py-2 pr-4 font-medium text-carvao">Medida</th>
              <th scope="col" className="py-2 pl-2 pr-4 text-right align-bottom font-medium text-carvao">{f.nome}</th>
              <th scope="col" className="py-2 pl-2 text-right align-bottom font-medium text-carvao-muted">{f.nomeUf}</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.medida} className="border-b border-linha">
                <th scope="row" className="py-2 pr-2 text-left align-top font-normal text-carvao">{l.medida}</th>
                <td className="whitespace-nowrap py-2 pl-2 pr-4 text-right align-top tabular-nums text-carvao">{l.municipio}</td>
                <td className="whitespace-nowrap py-2 pl-2 text-right align-top tabular-nums text-carvao-muted">{l.uf}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-mineral">
        Focos de calor, satélite de referência {f.fonte.satelite}. O estado é a soma dos seus municípios na mesma contagem. Focos por 1.000 km²
        do estado: indisponível, porque esta publicação traz a área só dos municípios que tiveram foco. O ano em curso é preliminar.
      </p>
    </section>
  );
}
