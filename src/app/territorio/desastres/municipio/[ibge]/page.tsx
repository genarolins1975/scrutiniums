import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GraficoBarras } from "@/components/painel";
import { BuscaDesastres } from "@/components/territorio/BuscaDesastres";
import { dataBr, mesAno, n } from "@/components/territorio/Queimadas";
import { rotaFichaDesastres } from "@/lib/territorio/consultaDesastres";
import { GRUPOS, ROTULO_CURTO } from "@/lib/territorio/desastres";
import { fichaDesastres, type FichaDesastres } from "@/lib/territorio/desastresMunicipio";

// uma ficha por município, gerada na primeira visita e guardada (como a ficha de focos de calor)
export const dynamicParams = true;
export const revalidate = false;

export function generateMetadata({ params }: { params: { ibge: string } }): Metadata {
  const f = fichaDesastres(params.ibge);
  if (!f) return { title: "Município não encontrado" };
  return {
    title: `Desastres reconhecidos em ${f.nome} (${f.uf})`,
    description: `O meu município já teve desastre reconhecido? Secas, chuvas, deslizamentos e outros desastres reconhecidos pela União em ${f.nome} (${f.uf}) de ${f.periodo.inicio} a ${f.periodo.fim}, comparados com ${f.nomeUf}.`,
    alternates: { canonical: rotaFichaDesastres(f.id) },
  };
}

const PAINEL = "/territorio/desastres";
const FONTE_CURTA = "Sedec/MIDR, Atlas Digital de Desastres";
const link = "underline decoration-linha underline-offset-4 hover:decoration-carvao";
/** As mesmas cores do painel de desastres, na mesma ordem dos grupos: identidade estável, sem juízo de gravidade. */
const COR_GRUPO = ["var(--serie-1)", "var(--serie-2)", "var(--serie-3)", "var(--serie-4)"];
/** Lista à vista antes de recolher o restante dos reconhecimentos. */
const LISTA_VISIVEL = 10;

const plural = (v: number, um: string, varios: string) => `${n(v)} ${v === 1 ? um : varios}`;

/**
 * Ficha "O meu município já teve desastre reconhecido?": os registros com
 * reconhecimento federal no município de 2003 ao último ano da base, ano a ano e
 * por tipo, a comparação com o estado pela mesma gold, as pessoas atingidas desde
 * 2013 e a lista dos reconhecimentos. Montada no servidor a partir de
 * public/territorio/gold/desastres_municipios.json; o navegador não baixa a gold.
 * Município sem registro é dito como "nenhum registro na base", nunca como
 * "nenhum desastre".
 */
export default function FichaDesastresPagina({ params }: { params: { ibge: string } }) {
  const f = fichaDesastres(params.ibge);
  if (!f) notFound();
  const total = f.reconhecimentos.length;
  const ultimo = f.reconhecimentos.at(-1);
  const periodo = `${f.periodo.inicio} a ${f.periodo.fim}`;
  const grupoLider = total > 0 ? [...GRUPOS].sort((a, b) => f.porGrupo[b] - f.porGrupo[a])[0] : null;

  return (
    <main className="bg-papel">
      <section aria-labelledby="ficha-desastres-titulo" className="border-b border-linha bg-marfim">
        <div className="mx-auto max-w-page px-6 pb-12 pt-10 md:pb-14 md:pt-14">
          <p className="rotulo mt-8 flex items-center gap-3 text-mineral"><span aria-hidden="true" className="h-[3px] w-8 bg-obee" />O meu município já teve desastre reconhecido?</p>
          <h1 id="ficha-desastres-titulo" className="mt-5 max-w-4xl font-serif text-[clamp(2rem,4.4vw,3.2rem)] leading-[1.1] text-carvao [text-wrap:balance]">
            Desastres reconhecidos em {f.nome} ({f.uf})
          </h1>
          <Resumo f={f} />

          <h2 className="sr-only">Os números do município</h2>
          <dl className="mt-10 grid gap-px border border-linha bg-linha sm:grid-cols-3">
            <div className="flex flex-col bg-papel p-5">
              <dt className="text-sm leading-snug text-carvao-muted">Registros com reconhecimento federal, {periodo}</dt>
              <dd className="mt-2"><span className="font-label text-[2rem] leading-none tabular-nums text-carvao">{n(total)}</span> <span className="text-sm text-carvao-muted">{total === 1 ? "registro" : "registros"}</span></dd>
              <dd className="mt-2 text-xs leading-relaxed text-mineral">Ocorrências de {periodo} · Fonte: {FONTE_CURTA}</dd>
              <dd className="mt-3 border-l-2 border-linha pl-3 text-xs leading-relaxed text-carvao-muted">
                {f.semReconhecimento > 0
                  ? `E ${plural(f.semReconhecimento, "registro", "registros")} sem reconhecimento no período: não pedido, negado ou pendente.`
                  : "Nenhum outro registro no período, com ou sem reconhecimento."}
              </dd>
            </div>
            <div className="flex flex-col bg-papel p-5">
              <dt className="text-sm leading-snug text-carvao-muted">Anos com ao menos um reconhecimento</dt>
              <dd className="mt-2"><span className="font-label text-[2rem] leading-none tabular-nums text-carvao">{n(f.anosComReconhecimento)}</span> <span className="text-sm text-carvao-muted">de {n(f.anosNoPeriodo)} anos</span></dd>
              <dd className="mt-2 text-xs leading-relaxed text-mineral">{periodo}, por ano da ocorrência · Calculado</dd>
              <dd className="mt-3 border-l-2 border-linha pl-3 text-xs leading-relaxed text-carvao-muted">
                {grupoLider ? `O tipo mais frequente: ${ROTULO_CURTO[grupoLider].toLowerCase()}, com ${plural(f.porGrupo[grupoLider], "registro", "registros")}.` : "Sem reconhecimento no período: não há tipo mais frequente."}
              </dd>
            </div>
            <div className="flex flex-col bg-papel p-5">
              <dt className="text-sm leading-snug text-carvao-muted">Reconhecimento mais recente</dt>
              {ultimo ? (
                <>
                  <dd className="mt-2"><span className="font-label text-[1.5rem] leading-tight text-carvao">{ultimo.tipo}</span></dd>
                  <dd className="mt-2 text-xs leading-relaxed text-mineral">Ocorrência em {dataBr(ultimo.data)} · Fonte: {FONTE_CURTA}</dd>
                </>
              ) : (
                <dd className="mt-2"><span className="font-label text-[1.5rem] leading-tight text-carvao">Nenhum no período</span></dd>
              )}
              <dd className="mt-3 border-l-2 border-linha pl-3 text-xs leading-relaxed text-carvao-muted">
                A base vai até {dataBr(f.fonte.ultimoRegistro)}. Reconhecimentos mais recentes ainda não estão nesta fonte; não são zero.
              </dd>
            </div>
          </dl>
          <p className="mt-4 max-w-prose2 border-l-2 border-obee pl-3 text-sm leading-relaxed text-carvao">
            Um registro é o município atingido por um desastre que a União reconheceu como situação de emergência ou estado de calamidade. Não é o
            número de desastres: só entra quem pediu e obteve o reconhecimento, e uma seca longa pode gerar mais de um registro.
          </p>
        </div>
      </section>

      {total > 0 && <AnoAAno f={f} />}
      <ComparacaoUf f={f} />
      <Danos f={f} />
      {total > 0 && <Lista f={f} />}

      <section aria-labelledby="outro-municipio-titulo" className="border-t border-linha">
        <div className="mx-auto grid max-w-page gap-8 px-6 py-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 id="outro-municipio-titulo" className="font-serif text-2xl leading-tight text-carvao">Ver outro município</h2>
            <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              A série do país desde 2003, os estados e as pessoas atingidas ficam no{" "}
              <Link href={PAINEL} prefetch={false} className={link}>painel de desastres</Link>.
            </p>
          </div>
          <div className="min-w-0 lg:col-span-7"><BuscaDesastres /></div>
        </div>
      </section>

      <section aria-labelledby="metodo-desastres-mun-titulo" className="mx-auto max-w-page px-6 pb-12">
        <details className="border-t border-linha pt-4">
          <summary id="metodo-desastres-mun-titulo" className="rotulo flex min-h-[44px] cursor-pointer items-center text-carvao-muted hover:text-carvao">Método, fontes e ressalvas</summary>
          <div className="mt-3 max-w-prose2 space-y-3 text-sm leading-relaxed text-carvao-muted">
            <p>
              Fonte: <a href={f.fonte.pagina} className={link}>{f.fonte.nome}</a>. Captura em {dataBr(f.fonte.capturadoEm)}; último registro na base em{" "}
              {dataBr(f.fonte.ultimoRegistro)}.
            </p>
            <p>
              Cada registro é um protocolo da Defesa Civil para um município, uma data de ocorrência e um tipo de desastre (classificação oficial
              COBRADE, agrupada pela plataforma nos mesmos quatro grupos do painel). O ano é o da ocorrência, não o da portaria. A comparação com o
              estado usa a mesma base e todos os municípios do estado na lista do IBGE, com ou sem registro. Os municípios somam, ano a ano, a
              série nacional do painel: a publicação é bloqueada se não somarem.
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

function Resumo({ f }: Readonly<{ f: FichaDesastres }>) {
  const total = f.reconhecimentos.length;
  const ultimo = f.reconhecimentos.at(-1);
  let frase: string;
  if (total === 0 && f.semReconhecimento === 0)
    frase = `A base do Atlas não tem registro de desastre em ${f.nome} de ${f.periodo.inicio} a ${f.periodo.fim}. Isso não prova que não houve desastre: só entra o que a prefeitura registrou no sistema da Defesa Civil.`;
  else if (total === 0)
    frase = `De ${f.periodo.inicio} a ${f.periodo.fim}, ${f.nome} teve ${plural(f.semReconhecimento, "registro", "registros")} de desastre, nenhum com reconhecimento federal.`;
  else
    frase = `De ${f.periodo.inicio} a ${f.periodo.fim}, a União reconheceu ${plural(total, "registro", "registros")} de desastre em ${f.nome}, em ${plural(f.anosComReconhecimento, "ano", "anos")} diferentes. O mais recente: ${ultimo!.tipo.toLowerCase()}, em ${mesAno(ultimo!.data)}.`;
  return <p className="mt-6 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">{frase}</p>;
}

function AnoAAno({ f }: Readonly<{ f: FichaDesastres }>) {
  const titulo = `Registros com reconhecimento federal em ${f.nome} por ano, ${f.periodo.inicio} a ${f.periodo.fim}, por tipo de desastre`;
  return (
    <section aria-labelledby="ano-a-ano-titulo" className="mx-auto max-w-page px-6 py-12 md:py-14">
      <h2 id="ano-a-ano-titulo" className="font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight text-carvao">Ano a ano</h2>
      <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        Cada barra soma os registros reconhecidos no ano da ocorrência, pela cor do tipo. Ano sem barra não teve reconhecimento; pode ter tido
        desastre sem pedido ou com pedido negado.
      </p>
      <figure className="mt-6" aria-labelledby="ano-a-ano-titulo">
        <GraficoBarras
          titulo={titulo}
          dados={f.porAno.map((a) => ({ ano: String(a.ano), ...a.porGrupo }))}
          chaveCategoria="ano"
          series={GRUPOS.map((g, i) => ({ id: g, rotulo: ROTULO_CURTO[g], cor: COR_GRUPO[i] }))}
          unidade="registros"
          casas={0}
          empilhado
        />
        <figcaption className="mt-3 text-xs leading-relaxed text-mineral">
          Registros municipais com reconhecimento federal, por ano da ocorrência. {FONTE_CURTA}, captura em {dataBr(f.fonte.capturadoEm)}. As regras
          de reconhecimento mudaram em 2012, 2016, 2020 e 2022.
        </figcaption>
      </figure>
    </section>
  );
}

function ComparacaoUf({ f }: Readonly<{ f: FichaDesastres }>) {
  const total = f.reconhecimentos.length;
  const e = f.estado;
  const parcelaMun = e.municipios > 0 ? (100 * e.comReconhecimento) / e.municipios : null;
  const media = e.municipios > 0 ? e.reconhecimentos / e.municipios : null;
  const linhas: { medida: string; municipio: string; estado: string }[] = [
    { medida: `Registros com reconhecimento, ${f.periodo.inicio} a ${f.periodo.fim}`, municipio: n(total), estado: n(e.reconhecimentos) },
    { medida: "Registros por município", municipio: n(total), estado: media == null ? "Indisponível" : n(media, 1) },
    { medida: "Municípios com ao menos um reconhecimento", municipio: total > 0 ? "Sim" : "Não", estado: `${n(e.comReconhecimento)} de ${n(e.municipios)}` },
  ];
  return (
    <section aria-labelledby="uf-desastres-titulo" className="border-t border-linha">
      <div className="mx-auto max-w-page px-6 py-12 md:py-14">
        <h2 id="uf-desastres-titulo" className="font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight text-carvao">Comparado com {f.nomeUf}</h2>
        <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          {parcelaMun != null && <>De {f.periodo.inicio} a {f.periodo.fim}, {n(e.comReconhecimento)} dos {n(e.municipios)} municípios de {f.nomeUf} ({n(parcelaMun, 0)}%) tiveram ao menos um desastre reconhecido. </>}
          {f.posicaoUf != null
            ? <>{f.nome} ficou na {n(f.posicaoUf)}ª posição do estado pelo número de registros reconhecidos (empates dividem a posição).</>
            : <>{f.nome} não teve registro reconhecido no período.</>}
        </p>
        <div className="mt-6 overflow-x-auto" role="region" aria-label={`Desastres reconhecidos em ${f.nome} e em ${f.nomeUf} (rolável)`} tabIndex={0}>
          <table className="w-full text-sm">
            <caption className="sr-only">Registros com reconhecimento federal do município e do estado, {FONTE_CURTA}</caption>
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
                  <td className="whitespace-nowrap py-2 pl-2 text-right align-top tabular-nums text-carvao-muted">{l.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-mineral">
          O estado é a soma dos seus municípios na mesma base; a média divide pelo total de municípios do estado na lista do IBGE, com ou sem
          registro. Mais registros não querem dizer município mais vulnerável: dependem também de a prefeitura pedir o reconhecimento.
        </p>
      </div>
    </section>
  );
}

function Danos({ f }: Readonly<{ f: FichaDesastres }>) {
  const d = f.danos;
  return (
    <section aria-labelledby="danos-mun-titulo" className="border-t border-linha">
      <div className="mx-auto max-w-page px-6 py-12 md:py-14">
        <h2 id="danos-mun-titulo" className="font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight text-carvao">As pessoas atingidas, desde {d?.desde ?? 2013}</h2>
        {d ? (
          <>
            <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              Somados dos {plural(d.registros, "registro", "registros")} de {f.nome} de {d.desde} a {f.periodo.fim}, reconhecidos ou não. Desabrigados ficaram sem
              casa e foram para abrigo público; desalojados saíram de casa para a de parentes ou amigos.
            </p>
            <dl className="mt-6 grid gap-px border border-linha bg-linha sm:grid-cols-3">
              {[
                ["Óbitos", d.obitos],
                ["Desabrigados", d.desabrigados],
                ["Desalojados", d.desalojados],
              ].map(([rotulo, v]) => (
                <div key={rotulo as string} className="bg-papel p-5">
                  <dt className="text-sm text-carvao-muted">{rotulo}</dt>
                  <dd className="mt-2"><span className="font-label text-[1.75rem] leading-none tabular-nums text-carvao">{n(v as number)}</span> <span className="text-sm text-carvao-muted">pessoas</span></dd>
                  <dd className="mt-2 text-xs text-mineral">{d.desde} a {f.periodo.fim} · Soma dos formulários do município</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-mineral">
              {d.semDanoInformado > 0 ? `${n(d.semDanoInformado)} de ${n(d.registros)} registros não têm nenhum dano humano informado: na base, campo vazio aparece como zero. ` : ""}
              Os danos são os do momento do registro e não são atualizados depois. {FONTE_CURTA}.
            </p>
          </>
        ) : (
          <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            Indisponível: {f.nome} não tem registro de desastre na base desde {f.danos?.desde ?? 2013}, por isso não há danos humanos a somar. Não é zero.
          </p>
        )}
      </div>
    </section>
  );
}

function Lista({ f }: Readonly<{ f: FichaDesastres }>) {
  const itens = [...f.reconhecimentos].reverse();
  const linha = (r: (typeof itens)[number], i: number) => (
    <tr key={`${r.data}-${i}`} className="border-b border-linha">
      <td className="whitespace-nowrap py-2 pr-4 align-top tabular-nums text-carvao">{dataBr(r.data)}</td>
      <th scope="row" className="py-2 pr-4 text-left align-top font-normal text-carvao">{r.tipo}</th>
      <td className="py-2 align-top text-carvao-muted">{ROTULO_CURTO[r.grupo]}</td>
    </tr>
  );
  const cabecalho = (
    <thead>
      <tr className="border-b border-carvao text-left">
        <th scope="col" className="py-2 pr-4 font-medium text-carvao">Ocorrência</th>
        <th scope="col" className="py-2 pr-4 font-medium text-carvao">Tipo</th>
        <th scope="col" className="py-2 font-medium text-carvao">Grupo no painel</th>
      </tr>
    </thead>
  );
  return (
    <section aria-labelledby="lista-desastres-titulo" className="border-t border-linha">
      <div className="mx-auto max-w-page px-6 py-12 md:py-14">
        <h2 id="lista-desastres-titulo" className="font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight text-carvao">Cada reconhecimento</h2>
        <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          Do mais recente para o mais antigo, com a data da ocorrência e o tipo registrado pela Defesa Civil.
        </p>
        <div className="mt-6 overflow-x-auto" role="region" aria-label={`Reconhecimentos de desastre em ${f.nome} (rolável)`} tabIndex={0}>
          <table className="w-full text-sm">
            <caption className="sr-only">Registros com reconhecimento federal em {f.nome}, {f.periodo.inicio} a {f.periodo.fim}, do mais recente ao mais antigo</caption>
            {cabecalho}
            <tbody>{itens.slice(0, LISTA_VISIVEL).map(linha)}</tbody>
          </table>
        </div>
        {itens.length > LISTA_VISIVEL && (
          <details className="mt-4">
            <summary className="flex min-h-[44px] cursor-pointer items-center text-sm text-carvao-muted hover:text-carvao">
              Ver os outros {n(itens.length - LISTA_VISIVEL)} reconhecimentos
            </summary>
            <div className="mt-2 overflow-x-auto" role="region" aria-label={`Reconhecimentos anteriores em ${f.nome} (rolável)`} tabIndex={0}>
              <table className="w-full text-sm">
                <caption className="sr-only">Reconhecimentos anteriores em {f.nome}</caption>
                {cabecalho}
                <tbody>{itens.slice(LISTA_VISIVEL).map((r, i) => linha(r, i + LISTA_VISIVEL))}</tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
