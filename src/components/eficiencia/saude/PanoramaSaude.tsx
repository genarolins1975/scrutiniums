"use client";

import Link from "next/link";
import { useMemo } from "react";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { FiguraAnalitica, GraficoBarras, LeituraGuiada } from "@/components/painel";
import { IndiceSaude, anosDaMedida, comparar } from "@/lib/eficiencia/saude/consulta";
import type { DadosSaude } from "@/lib/eficiencia/saude/payload";
import { MEDIDAS_SAUDE, ROTULO_PERIODO } from "@/lib/eficiencia/saude/medidas";
import { CASAS, GRUPOS, OPCOES_PANORAMA } from "@/lib/eficiencia/saude/molde";
import { CAMINHO_TEMA, hrefSaude } from "@/lib/eficiencia/saude/rotas";
import { inteiro } from "@/lib/eficiencia/formato";
import { provenienciaDaFicha } from "@/lib/eficiencia/proveniencia";
import type { ContextoFicha } from "../FichaConteudo";
import { Selecao } from "../controles";
import { SobreDadoSaude as SobreEsteDado } from "./SobreDadoSaude";
import { Siglas } from "../Siglas";

function esquema(ids: string[]) {
  return { cap: campo(tiposUrl.opcao(["", ...ids]), "") };
}

/** A capital escolhida, lida da URL (?cap=); as peças do panorama se avisam pela mesma URL (useEstadoUrl). */
function useCapital(dados: DadosSaude) {
  const ids = useMemo(() => dados.capitais.map((c) => c.id), [dados]);
  const esq = useMemo(() => esquema(ids), [ids]);
  const [s, definir] = useEstadoUrl(esq);
  return { cap: dados.capitais.find((c) => c.id === s.cap) ?? null, valor: s.cap, definir };
}

const nomes = (cs: { nome: string; uf: string }[]) => (cs.length <= 2 ? cs.map((c) => `${c.nome} (${c.uf})`).join(" e ") : `${cs[0].nome} (${cs[0].uf}) e mais ${cs.length - 1}`);

/** Primeira frase do motivo, em minúscula inicial e sem o ponto final, para caber numa linha. */
const primeiraFrase = (texto: string) => {
  const f = (texto.split(/\.\s/)[0] ?? texto).replace(/\.$/, "");
  return f.length > 150 ? `${f.slice(0, 147)}...` : f.charAt(0).toLowerCase() + f.slice(1);
};

/** A primeira ação do panorama (abertura do molde): a capital opcional, que aparece ao lado do conjunto em cada medida. */
export function SeletorCapitalSaude({ dados }: { dados: DadosSaude }) {
  const { valor, definir } = useCapital(dados);
  return (
    <div className="max-w-sm">
      <Selecao id="capital-panorama" rotulo="Capital" ajuda="Opcional: mostra o valor da capital ao lado do conjunto." valor={valor} opcoes={[{ v: "", t: "Nenhuma: ver o conjunto" }, ...dados.capitais.map((x) => ({ v: x.id, t: `${x.nome} (${x.uf})` }))]} aoMudar={(v) => definir({ cap: v })} />
    </div>
  );
}

/** Os caminhos para as visões do módulo, levando a capital escolhida. */
export function CaminhosSaude({ dados }: { dados: DadosSaude }) {
  const { cap } = useCapital(dados);
  const p = cap ? { cap: cap.id } : {};
  const link = "inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4";
  return (
    <nav aria-labelledby="caminhos" className="mt-8">
      <h2 id="caminhos" className="rotulo text-mineral">
        Para ir além
      </h2>
      <ul className="mt-2 grid gap-x-8 gap-y-0 text-[0.9375rem] sm:grid-cols-2">
        <li><Link className={link} href={hrefSaude(CAMINHO_TEMA.gastos, p)}>Quanto se aplica, por habitante e em quais componentes</Link></li>
        <li><Link className={link} href={hrefSaude(CAMINHO_TEMA.rede, p)}>Que estabelecimentos, equipes e cobertura estão registrados</Link></li>
        <li><Link className={link} href={hrefSaude(CAMINHO_TEMA.resultados, p)}>Que resultados e que lacunas de atendimento</Link></li>
        <li><Link className={link} href={hrefSaude("/metodos")}>De onde vem cada medida e como reproduzir o cálculo</Link></li>
      </ul>
    </nav>
  );
}

/**
 * As medidas do Panorama no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): uma FiguraAnalitica por medida, na ordem
 * dos três perímetros, com o menor valor, a mediana e o maior valor das capitais (e a capital escolhida, quando há) no gráfico de
 * barras do kit, a tabela equivalente, a ficha de origem e o que o perímetro não permite presumir. Os números e as frases são os do
 * panorama de antes (PanoramaFaixa): extremos nomeados, metade central, capitais fora da comparação e referências externas diretas.
 */
export function FigurasPanoramaSaude({ dados, contextos }: { dados: DadosSaude; contextos: Record<string, ContextoFicha> }) {
  const ix = useMemo(() => new IndiceSaude(dados), [dados]);
  const { cap } = useCapital(dados);
  const o = OPCOES_PANORAMA;
  return (
    <>
      {GRUPOS.flatMap((g, k) =>
        g.medidas.map((id) => {
          const m = MEDIDAS_SAUDE[id];
          const anos = anosDaMedida(ix, m, o);
          const ano = anos[anos.length - 1];
          const c = comparar(ix, m, ano, o, "todas", cap, "alfabetica");
          const r = c.ref;
          const ficha = dados.fichas.find((f) => f.id === m.indicador)!;
          const comp = m.componente("nominal", "ripsa");
          const ptCap = cap ? ix.ponto(m.indicador, cap.cod, ano, comp) : null;
          const externas = ix.externas(m.indicador, comp, ano).filter((e) => e.comparabilidade === "direta");
          const periodo = ROTULO_PERIODO[m.periodo](ano);
          const destaque = cap && ptCap && ptCap.valor !== null && ptCap.elegivel ? { rotulo: `${cap.nome} (${cap.uf})`, valor: ptCap.valor } : null;
          const semDestaque =
            cap && ptCap && ptCap.valor !== null && !ptCap.elegivel
              ? `${cap.nome} (${cap.uf}) tem valor oficial fora da comparação: ${m.formata(ptCap.valor)}.`
              : cap && ptCap && ptCap.valor === null
                ? `${cap.nome} (${cap.uf}) não tem valor para este recorte.`
                : null;
          const completo = r && r.mediana !== null && r.minimo !== null && r.maximo !== null ? r : null;
          const faixa = completo && completo.quartisExibicao && completo.q1 !== null && completo.q3 !== null ? { q1: completo.q1, q3: completo.q3 } : null;
          const pontos = completo
            ? [
                { x: "menor", rotulo: `Menor: ${nomes(completo.capitaisMinimo)}`, y: completo.minimo },
                { x: "mediana", rotulo: "Mediana das capitais", y: completo.mediana },
                { x: "maior", rotulo: `Maior: ${nomes(completo.capitaisMaximo)}`, y: completo.maximo },
                ...(destaque ? [{ x: "capital", rotulo: destaque.rotulo, y: destaque.valor }] : []),
              ]
            : [];
          const linhas = completo
            ? [
                ["Menor valor", nomes(completo.capitaisMinimo), m.formata(completo.minimo!)],
                ...(faixa ? [["Primeiro quartil", "metade central começa aqui", m.formata(faixa.q1)]] : []),
                ["Mediana", `${completo.n} de ${c.noGrupo} capitais na comparação`, m.formata(completo.mediana!)],
                ...(faixa ? [["Terceiro quartil", "metade central termina aqui", m.formata(faixa.q3)]] : []),
                ["Maior valor", nomes(completo.capitaisMaximo), m.formata(completo.maximo!)],
                ...externas.map((e) => [e.tipo === "normativa" ? "Mínimo legal" : e.rotulo, e.tipo === "normativa" ? "referência normativa, não meta" : e.classe, e.tipo === "normativa" ? `${inteiro(e.valor)}%` : m.formata(e.valor)]),
                ...(destaque ? [[destaque.rotulo, "capital escolhida", m.formata(destaque.valor)]] : []),
              ]
            : [];
          const leitura = completo
            ? `Menor: ${nomes(completo.capitaisMinimo)}. Maior: ${nomes(completo.capitaisMaximo)}.${faixa ? ` Metade central das capitais, de ${m.formata(faixa.q1, true)} a ${m.formata(faixa.q3, true)}.` : " Metade central não exibida: menos de 8 capitais."}`
            : null;
          return (
            <FiguraAnalitica
              key={id}
              id={`medida-${id}`}
              idioma="pt"
              pergunta={m.pergunta}
              subtitulo={`Perímetro ${k + 1} de 3, ${g.titulo.toLowerCase()} · ${m.unidade("nominal")} · ${periodo.toLowerCase()} · ${completo ? `${completo.n} de ${c.noGrupo} capitais na comparação` : "sem capital na comparação"}`}
              natureza={ficha.natureza}
              proveniencia={provenienciaDaFicha(ficha, dados.fontes, { inicio: String(anos[0]), fim: String(ano) })}
              leitura={leitura ? <LeituraGuiada>{leitura}</LeituraGuiada> : undefined}
              tabela={{ colunas: ["Referência", "Capitais", "Valor"], linhas, titulo: `${m.rotulo}, ${periodo}` }}
              comoInterpretar={
                <>
                  <Siglas texto={m.definicao} /> Permite mostrar: <Siglas texto={g.mostra} />
                </>
              }
              naoConcluir={
                <>
                  Não permite presumir: {g.naoPresume} <Siglas texto={m.naoE} />
                </>
              }
              complemento={
                <>
                  {c.excluidas.length > 0 && (
                    <p className="t-meta text-carvao-muted">
                      {c.excluidas.length <= 3
                        ? `Fora da comparação: ${c.excluidas.map((x) => `${x.cap.nome} (${x.cap.uf}), ${primeiraFrase(x.motivo)}`).join("; ")}.`
                        : `${c.excluidas.length} capitais fora da comparação; os motivos estão na página do tema.`}
                    </p>
                  )}
                  {semDestaque && (
                    <p className="t-meta text-carvao" role="note">
                      {semDestaque}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-5 text-[0.9375rem]">
                    <SobreEsteDado f={ficha} ctx={contextos[ficha.id]} rotulo="Ficha do indicador" />
                    <a href={`${hrefSaude("/metodos")}#trilha-${ficha.id.replace(/\./g, "-")}`} className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">
                      Fonte e como reproduzir<span className="sr-only"> ({m.rotuloCurto})</span>
                    </a>
                    <Link href={hrefSaude(CAMINHO_TEMA[g.tema], { med: id, ...(cap ? { cap: cap.id } : {}) })} className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">
                      Ver a distribuição e as capitais <span aria-hidden="true" className="ml-1">→</span>
                    </Link>
                  </div>
                </>
              }
            >
              {completo ? (
                <GraficoBarras
                  titulo={`${m.rotulo}, ${periodo}`}
                  series={[{ id: "valor", nome: m.rotuloCurto, pontos }]}
                  eixoY={{ unidade: m.unidade("nominal"), zero: true, casas: CASAS[id] ?? 1 }}
                  orientacao="horizontal"
                  rotulosValor
                  rotulosSaoNomes
                  selecionado={destaque ? "capital" : null}
                  referencias={externas.map((e) => ({ valor: e.valor, rotulo: e.tipo === "normativa" ? "Mínimo legal (referência normativa, não meta)" : e.rotulo }))}
                />
              ) : (
                <p data-grafico="sem-comparacao" className="t-meta border border-dashed border-mineral px-4 py-3 text-carvao" role="note">
                  Nenhuma capital tem valor comparável para este recorte.
                </p>
              )}
            </FiguraAnalitica>
          );
        }),
      )}
    </>
  );
}
