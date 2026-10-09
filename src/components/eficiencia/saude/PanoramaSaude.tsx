"use client";

import Link from "next/link";
import { useMemo } from "react";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { IndiceSaude, anosDaMedida, comparar } from "@/lib/eficiencia/saude/consulta";
import type { DadosSaude } from "@/lib/eficiencia/saude/payload";
import { MEDIDAS_SAUDE, ROTULO_PERIODO, type MedidaSaudeId, type TemaSaude } from "@/lib/eficiencia/saude/medidas";
import { CAMINHO_TEMA, hrefSaude } from "@/lib/eficiencia/saude/rotas";
import { inteiro } from "@/lib/eficiencia/formato";
import type { ContextoFicha } from "../FichaConteudo";
import { PanoramaFaixa } from "./PanoramaFaixa";
import { Selecao } from "../controles";
import { SobreDadoSaude as SobreEsteDado } from "./SobreDadoSaude";
import { Siglas } from "../Siglas";
import { GlossarioDaPagina } from "./AvisosSaude";

const GRUPOS: { id: string; titulo: string; pergunta: string; mostra: string; naoPresume: string; tema: TemaSaude; medidas: MedidaSaudeId[] }[] = [
  {
    id: "recursos",
    titulo: "Recursos executados pelo município",
    pergunta: "Quanto o município aplica?",
    mostra: "Orçamento municipal e despesa declarada em Saúde (DCA e SIOPS).",
    naoPresume: "Gasto total de União, estado e município no território.",
    tema: "gastos",
    medidas: ["despesa_hab", "asps_pct"],
  },
  {
    id: "servicos",
    titulo: "Serviços localizados no território",
    pergunta: "Que estrutura está registrada?",
    mostra: "Estabelecimentos, equipes e cobertura potencial, conforme o CNES e o Relatório APS.",
    naoPresume: "Que a rede pertença à prefeitura, funcione de fato ou atenda só seus moradores.",
    tema: "rede",
    medidas: ["ubs_10mil", "esf_10mil", "cobertura_aps"],
  },
  {
    id: "residentes",
    titulo: "População residente",
    pergunta: "Que resultados são observados entre os moradores?",
    mostra: "Eventos por município de residência, com o universo declarado (SUS, AIH tipo 1).",
    naoPresume: "Que o resultado seja causado exclusivamente pela gestão municipal.",
    tema: "resultados",
    medidas: ["icsap_taxa", "icsap_part"],
  },
];

function esquema(ids: string[]) {
  return { cap: campo(tiposUrl.opcao(["", ...ids]), "") };
}

export function PanoramaSaude({ dados, contextos }: { dados: DadosSaude; contextos: Record<string, ContextoFicha> }) {
  const ix = useMemo(() => new IndiceSaude(dados), [dados]);
  const ids = useMemo(() => dados.capitais.map((c) => c.id), [dados]);
  const esq = useMemo(() => esquema(ids), [ids]);
  const [s, definir] = useEstadoUrl(esq);
  const cap = dados.capitais.find((c) => c.id === s.cap) ?? null;

  return (
    <div>
      <section aria-labelledby="titulo-painel" className="grid gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
        <div>
          <h1 id="titulo-painel" className="font-serif text-[2.3rem] leading-[1.05] tracking-tight text-obee-tinta md:text-[2.9rem]">
            Saúde nas capitais
          </h1>
          <p className="mt-3 max-w-[44rem] font-serif text-[1.2rem] leading-snug text-obee-tinta md:text-[1.4rem]">
            Quanto as capitais aplicam em Saúde, que estrutura e atendimento são registrados e quais resultados são observados entre seus moradores?
          </p>
          <p className="mt-2 max-w-[46rem] text-[0.9375rem] leading-snug text-carvao-muted">
            26 capitais estaduais; o Distrito Federal fica fora porque a saúde distrital reúne competências de estado e de município (motivo completo em Dados e métodos) · três perímetros diferentes, abaixo · o ano de cada medida está ao lado dela
          </p>
        </div>
        <div className="lg:pt-3">
          <Selecao id="capital-panorama" rotulo="Capital" ajuda="Opcional: mostra o valor da capital ao lado do conjunto." valor={s.cap} opcoes={[{ v: "", t: "Nenhuma: ver o conjunto" }, ...dados.capitais.map((x) => ({ v: x.id, t: `${x.nome} (${x.uf})` }))]} aoMudar={(v) => definir({ cap: v })} />
        </div>
      </section>

      <div className="mt-6 space-y-12 border-t border-linha pt-8">
        {GRUPOS.map((g, k) => (
          <section key={g.id} aria-labelledby={`g-${g.id}`}>
            <div className="grid gap-x-10 gap-y-3 md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
              <div>
                <p className="rotulo text-mineral">Perímetro {k + 1} de 3</p>
                <h2 id={`g-${g.id}`} className="mt-1 font-serif text-[1.4rem] leading-snug text-obee-tinta">
                  {g.titulo}
                </h2>
                <p className="mt-0.5 text-[1rem] leading-snug text-obee-tinta">{g.pergunta}</p>
              </div>
              <dl className="grid gap-x-8 gap-y-2 text-sm leading-snug sm:grid-cols-2">
                <div>
                  <dt className="rotulo text-carvao-muted">Permite mostrar</dt>
                  <dd className="mt-0.5 text-obee-tinta"><Siglas texto={g.mostra} /></dd>
                </div>
                <div>
                  <dt className="rotulo text-carvao-muted">Não permite presumir</dt>
                  <dd className="mt-0.5 text-obee-tinta">{g.naoPresume}</dd>
                </div>
              </dl>
            </div>
            <ul className="mt-4 divide-y divide-linha border-y border-linha">
              {g.medidas.map((id) => {
                const m = MEDIDAS_SAUDE[id];
                const o = { moeda: "nominal" as const, denominador: "ripsa" as const };
                const anos = anosDaMedida(ix, m, o);
                const ano = anos[anos.length - 1];
                const c = comparar(ix, m, ano, o, "todas", cap, "alfabetica");
                const ficha = dados.fichas.find((f) => f.id === m.indicador)!;
                const ptCap = cap ? ix.ponto(m.indicador, cap.cod, ano, m.componente("nominal", "ripsa")) : null;
                const externas = ix.externas(m.indicador, m.componente("nominal", "ripsa"), ano).filter((e) => e.comparabilidade === "direta");
                return (
                  <li key={id} className="grid gap-x-10 gap-y-3 py-5 md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
                    <div className="min-w-0 max-md:contents">
                    <div className="min-w-0 max-md:order-1">
                      <h3 className="text-[1.0625rem] font-semibold leading-snug text-obee-tinta">{m.rotulo}</h3>
                      <p className="mt-0.5 text-[0.8125rem] leading-snug text-carvao-muted">
                        {m.unidade("nominal")} · {ROTULO_PERIODO[m.periodo](ano).toLowerCase()} · {c.ref ? `${c.ref.n} de ${c.noGrupo} capitais na comparação` : "sem capital na comparação"}
                      </p>
                      {c.ref && c.ref.mediana !== null && (
                        <p className="mt-2 font-serif text-[1.8rem] leading-none text-obee-tinta">
                          {m.formata(c.ref.mediana)}
                          <span className="ml-2 text-[0.8125rem] font-sans text-carvao-muted">mediana das capitais</span>
                        </p>
                      )}
                      {externas.map((e) => (
                        <p key={e.id} className="mt-1.5 text-sm leading-snug text-obee-tinta">
                          <span className="font-semibold">{e.tipo === "normativa" ? "Mínimo legal" : e.rotulo}:</span> <span className="tabular-nums">{e.tipo === "normativa" ? `${inteiro(e.valor)}%` : m.formata(e.valor)}</span>
                          <span className="text-carvao-muted"> · {e.tipo === "normativa" ? "referência normativa, não meta" : e.classe}</span>
                        </p>
                      ))}
                    </div>
                    <div className="min-w-0 max-md:order-3">
                      <p className="mt-2 text-sm leading-snug text-carvao-muted"><Siglas texto={m.definicao} /></p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-5">
                        <SobreEsteDado f={ficha} ctx={contextos[ficha.id]} />
                        <Link href={hrefSaude(CAMINHO_TEMA[g.tema], { med: id, ...(cap ? { cap: cap.id } : {}) })} className="inline-flex min-h-[44px] items-center text-[0.9375rem] text-obee-dark underline underline-offset-4">
                          Ver a distribuição e as capitais <span aria-hidden="true" className="ml-1">→</span>
                        </Link>
                      </div>
                    </div>
                    </div>
                    <div className="min-w-0 max-md:order-2">
                      <PanoramaFaixa m={m} c={c} ano={ano} destaque={cap && ptCap && ptCap.valor !== null && ptCap.elegivel ? { rotulo: cap.nome, valor: ptCap.valor } : null} semDestaqueMotivo={cap && ptCap && ptCap.valor !== null && !ptCap.elegivel ? `${cap.nome} (${cap.uf}) tem valor oficial fora da comparação: ${m.formata(ptCap.valor)}.` : cap && ptCap && ptCap.valor === null ? `${cap.nome} (${cap.uf}) não tem valor para este recorte.` : null} />
                      <div className="mt-1 flex flex-wrap items-center gap-x-5 text-[0.9375rem]">
                        {ficha.download && (
                          <a href={ficha.download} download className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">
                            Baixar a série completa (CSV)
                          </a>
                        )}
                        <a href={`${hrefSaude("/metodos")}#trilha-${ficha.id.replace(/\./g, "-")}`} className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">
                          Fonte e como reproduzir<span className="sr-only"> ({m.rotuloCurto})</span>
                        </a>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <section aria-label="Siglas do Panorama" className="mt-12 border-t border-linha pt-6">
        <GlossarioDaPagina tema="panorama" />
      </section>

      <section aria-labelledby="caminhos" className="mt-14 border-t border-linha pt-10">
        <h2 id="caminhos" className="font-serif text-[1.6rem] leading-snug text-obee-tinta">
          Para ir além
        </h2>
        <ul className="mt-4 grid gap-x-8 gap-y-2 text-[0.9375rem] sm:grid-cols-2">
          <li><Link className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4" href={hrefSaude(CAMINHO_TEMA.gastos, cap ? { cap: cap.id } : {})}>Quanto se aplica, por habitante e em quais componentes</Link></li>
          <li><Link className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4" href={hrefSaude(CAMINHO_TEMA.rede, cap ? { cap: cap.id } : {})}>Que estabelecimentos, equipes e cobertura estão registrados</Link></li>
          <li><Link className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4" href={hrefSaude(CAMINHO_TEMA.resultados, cap ? { cap: cap.id } : {})}>Que resultados e que lacunas de atendimento</Link></li>
          <li><Link className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4" href={hrefSaude("/metodos")}>De onde vem cada medida e como reproduzir o cálculo</Link></li>
        </ul>
      </section>
    </div>
  );
}
