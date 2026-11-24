"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiguraAnalitica, GraficoLinhas, LeituraGuiada } from "@/components/painel";
import { decimal } from "@/lib/eficiencia/formato";
import { provenienciaDaFicha } from "@/lib/eficiencia/proveniencia";
import { IndiceSaude, anosDaMedida, comparar, evolucaoDaDespesa, variacao, variacaoTotal, type Comparacao } from "@/lib/eficiencia/saude/consulta";
import { fraseAmplitude, fraseCapital } from "@/lib/eficiencia/saude/frases";
import { MEDIDAS_SAUDE, ROTULO_PERIODO, type MedidaSaude, type MedidaSaudeId } from "@/lib/eficiencia/saude/medidas";
import { OPCOES_PANORAMA } from "@/lib/eficiencia/saude/molde";
import type { DadosSaude } from "@/lib/eficiencia/saude/payload";
import { CAMINHO_TEMA, hrefSaude } from "@/lib/eficiencia/saude/rotas";
import type { ContextoFicha } from "../FichaConteudo";
import { Siglas } from "../Siglas";
import { useBaseSaude } from "./ExploradorSaude";
import { useCapital } from "./PanoramaSaude";
import { SobreDadoSaude as SobreEsteDado } from "./SobreDadoSaude";

const DIAMETRO = 12;
const PASSO = DIAMETRO + 2;
const MARGEM = 8;

type Marca = { valor: number; rotulo: string; tracejada?: boolean };

/** Largura do contêiner, medida no navegador; no servidor, uma largura de referência (o desenho se refaz ao hidratar). */
function useLargura(inicial: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(inicial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, w };
}

const passoBonito = (max: number) => {
  const bruto = max / 4;
  const p = 10 ** Math.floor(Math.log10(bruto));
  return [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= bruto) ?? bruto;
};

/**
 * Régua das capitais: cada capital na comparação é um ponto na mesma escala, que começa em zero; pontos de valor próximo se empilham
 * para não se esconderem. A mediana é um filete contínuo e a referência do Brasil, tracejado; os extremos vêm nomeados embaixo e a
 * capital escolhida é o ponto escuro, maior, com o nome. Clicar num ponto escolhe a capital (a mesma escolha do alto da página). O
 * desenho é decorativo para o leitor de tela: a tabela equivalente da figura traz as 26 capitais.
 */
function ReguaCapitais({ m, c, marcas, selecionada, aoEscolher }: { m: MedidaSaude; c: Comparacao; marcas: Marca[]; selecionada: string | null; aoEscolher: (id: string) => void }) {
  const { ref, w } = useLargura(720);
  const valores = c.incluidas.map((i) => i.valor);
  const topo = Math.max(...valores, ...marcas.map((x) => x.valor));
  const passo = passoBonito(topo);
  const max = Math.ceil(topo / passo) * passo;
  const x = (v: number) => MARGEM + (v / max) * (w - 2 * MARGEM);
  // empilhamento: cada ponto vai para a primeira fileira em que não encosta em outro
  const fileiras: number[][] = [];
  const pontos = c.incluidas
    .slice()
    .sort((a, b) => a.valor - b.valor)
    .map((i) => {
      const px = x(i.valor);
      let f = fileiras.findIndex((fl) => fl.every((o) => Math.abs(o - px) >= PASSO));
      if (f < 0) {
        fileiras.push([]);
        f = fileiras.length - 1;
      }
      fileiras[f].push(px);
      return { i, px, f };
    });
  const altPontos = Math.max(1, fileiras.length) * PASSO;
  const alturaArea = altPontos + 34;
  const ticks = Array.from({ length: Math.round(max / passo) + 1 }, (_, k) => k * passo);
  const sel = pontos.find((p) => p.i.cap.id === selecionada) ?? null;
  return (
    <div data-grafico="regua" ref={ref} className="relative w-full select-none" style={{ height: alturaArea + 26 }} aria-hidden="true">
      {/* filetes da mediana e do Brasil, por trás dos pontos */}
      {marcas.map((mk) => (
        <span key={mk.rotulo} className={`absolute top-6 w-0 border-l ${mk.tracejada ? "border-dashed border-carvao-muted" : "border-carvao"}`} style={{ left: x(mk.valor), height: altPontos + 6 }} />
      ))}
      {/* nomes dos filetes, acima: a mediana à esquerda do filete, o Brasil à direita, para não se cobrirem */}
      {marcas.map((mk, k) => (
        <span
          key={`r-${mk.rotulo}`}
          className="t-meta absolute top-0 whitespace-nowrap text-carvao"
          style={k === 0 ? { right: Math.max(0, w - x(mk.valor) + 6) } : { left: Math.min(x(mk.valor) + 6, w - 160) }}
        >
          {mk.rotulo}
        </span>
      ))}
      {pontos.map(({ i, px, f }) => {
        const eSel = i.cap.id === selecionada;
        return (
          <span
            key={i.cap.id}
            title={`${i.cap.nome} (${i.cap.uf}): ${m.formata(i.valor)}`}
            onClick={() => aoEscolher(i.cap.id)}
            className={`absolute cursor-pointer rounded-full motion-safe:transition-transform hover:scale-125 ${eSel ? "z-10 bg-carvao ring-2 ring-papel" : "bg-obee/70"}`}
            style={{ width: eSel ? 16 : DIAMETRO, height: eSel ? 16 : DIAMETRO, left: px - (eSel ? 8 : DIAMETRO / 2), top: 24 + altPontos - (f + 1) * PASSO + (eSel ? -2 : 1) }}
          />
        );
      })}
      {/* eixo */}
      <span className="absolute inset-x-0 border-t border-linha" style={{ top: 24 + altPontos + 6 }} />
      {/* o primeiro rótulo alinha pela esquerda e o último pela direita: nenhum sai da largura no celular */}
      {ticks.map((t, k) => (
        <span
          key={t}
          className={`t-meta absolute whitespace-nowrap tabular-nums text-carvao-muted ${k === 0 ? "" : k === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
          style={{ left: k === 0 ? 0 : k === ticks.length - 1 ? w : x(t), top: 24 + altPontos + 10 }}
        >
          {m.formataEixo(t)}
        </span>
      ))}
      {sel && (
        <span className="t-meta absolute whitespace-nowrap font-medium text-carvao" style={{ top: alturaArea + 6, ...(sel.px > w / 2 ? { right: Math.max(0, w - sel.px - 8) } : { left: Math.max(0, sel.px - 8) }) }}>
          {sel.i.cap.nome}: {m.formata(sel.i.valor)}
        </span>
      )}
    </div>
  );
}

const nomes = (cs: { nome: string; uf: string }[]) => cs.map((c) => `${c.nome} (${c.uf})`).join(" e ");

/** As três réguas da entrada: o gasto por morador, a cobertura da atenção primária e as internações evitáveis, cada uma com as capitais. */
const REGUAS: { id: MedidaSaudeId; pergunta: string }[] = [
  { id: "despesa_hab", pergunta: "Quanto cada prefeitura gasta com saúde por morador?" },
  { id: "cobertura_aps", pergunta: "Que parcela da população as equipes de atenção primária poderiam cobrir?" },
  { id: "icsap_taxa", pergunta: "Quantas internações a atenção primária poderia ter evitado?" },
];

export function ReguasSaude({ dados: dadosProp, contextos }: { dados?: DadosSaude; contextos: Record<string, ContextoFicha> }) {
  const dados = useBaseSaude(dadosProp);
  const ix = useMemo(() => new IndiceSaude(dados), [dados]);
  const { cap, definir } = useCapital(dados);
  const o = OPCOES_PANORAMA;
  return (
    <>
      {REGUAS.map(({ id, pergunta }) => {
        const m = MEDIDAS_SAUDE[id];
        const anos = anosDaMedida(ix, m, o);
        const ano = anos[anos.length - 1];
        const comp = m.componente("nominal", "ripsa");
        const c = comparar(ix, m, ano, o, "todas", null, "valor");
        const r = c.ref;
        const ficha = dados.fichas.find((f) => f.id === m.indicador)!;
        const periodo = ROTULO_PERIODO[m.periodo](ano);
        const brasil = ix.externas(m.indicador, comp, ano).find((e) => e.comparabilidade === "direta" && e.tipo !== "normativa") ?? null;
        const marcas: Marca[] = [
          ...(r?.mediana != null ? [{ valor: r.mediana, rotulo: `Mediana ${m.formata(r.mediana)}` }] : []),
          ...(brasil ? [{ valor: brasil.valor, rotulo: `Brasil ${m.formata(brasil.valor)}`, tracejada: true }] : []),
        ];
        const pt = cap ? ix.ponto(m.indicador, cap.cod, ano, comp) : null;
        const fraseCap = cap && pt ? fraseCapital(cap.nome, cap.uf, pt.valor, r?.mediana ?? null, r?.n ?? 0, m, pt.valor !== null && !pt.elegivel) : null;
        const linhas = [
          ...c.incluidas.map((i) => [`${i.cap.nome} (${i.cap.uf})`, m.formata(i.valor), "na comparação"]),
          ...c.excluidas.map((x) => [`${x.cap.nome} (${x.cap.uf})`, x.comValor && x.ponto.valor !== null ? m.formata(x.ponto.valor) : null, `fora da comparação: ${x.motivo.replace(/\.$/, "")}`]),
          ...(r?.mediana != null ? [["Mediana das capitais", m.formata(r.mediana), `${r.n} capitais`]] : []),
          ...(brasil ? [[brasil.rotulo, m.formata(brasil.valor), "referência externa"]] : []),
        ];
        return (
          <FiguraAnalitica
            key={id}
            id={`regua-${id}`}
            idioma="pt"
            pergunta={pergunta}
            subtitulo={`${m.rotulo} · ${m.unidade("nominal")} · ${periodo.toLowerCase()} · ${c.incluidas.length} de ${c.noGrupo} capitais na comparação`}
            natureza={ficha.natureza}
            proveniencia={provenienciaDaFicha(ficha, dados.fontes, { inicio: String(ano), fim: String(ano) })}
            leitura={<LeituraGuiada>{fraseAmplitude(c.incluidas.map((i) => ({ nome: i.cap.nome, uf: i.cap.uf, valor: i.valor })), m, ano, r?.mediana ?? null)}</LeituraGuiada>}
            tabela={{ colunas: ["Capital ou referência", "Valor", "Situação"], linhas, titulo: `${m.rotulo}, ${periodo}`, limite: linhas.length }}
            comoInterpretar={<Siglas texto={m.definicao} />}
            naoConcluir={<Siglas texto={m.naoE} />}
            complemento={
              <>
                {r && r.mediana !== null && r.minimo !== null && r.maximo !== null && (
                  <p className="t-meta flex flex-wrap justify-between gap-x-6 text-carvao-muted">
                    <span>Menor: {nomes(r.capitaisMinimo)}, {m.formata(r.minimo)}</span>
                    <span>Maior: {nomes(r.capitaisMaximo)}, {m.formata(r.maximo)}</span>
                  </p>
                )}
                {c.excluidas.length > 0 && (
                  <p className="t-meta text-carvao-muted">
                    Fora da comparação: {c.excluidas.map((x) => `${x.cap.nome} (${x.cap.uf})`).join(", ")}. O motivo está na tabela.
                  </p>
                )}
                {fraseCap ? <p className="t-corpo max-w-prose2 text-carvao">{fraseCap}</p> : <p className="t-meta text-carvao-muted">Escolha a sua capital no alto da página, ou toque num ponto, para destacá-la.</p>}
                <div className="flex flex-wrap items-center gap-x-5 text-[0.9375rem]">
                  <SobreEsteDado f={ficha} ctx={contextos[ficha.id]} rotulo="Ficha do indicador" />
                  <a href={`${hrefSaude("/metodos")}#trilha-${ficha.id.replace(/\./g, "-")}`} className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">
                    Fonte e como reproduzir<span className="sr-only"> ({m.rotuloCurto})</span>
                  </a>
                  <Link href={hrefSaude(CAMINHO_TEMA[m.tema], { med: id, ...(cap ? { cap: cap.id } : {}) })} className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">
                    Ver a série e os detalhes <span aria-hidden="true" className="ml-1">→</span>
                  </Link>
                </div>
              </>
            }
          >
            {c.incluidas.length ? (
              <ReguaCapitais m={m} c={c} marcas={marcas} selecionada={cap?.id ?? null} aoEscolher={(v) => definir({ cap: v })} />
            ) : (
              <p data-grafico="sem-comparacao" className="t-meta border border-dashed border-mineral px-4 py-3 text-carvao" role="note">
                Nenhuma capital tem valor comparável para este recorte.
              </p>
            )}
          </FiguraAnalitica>
        );
      })}
      <EvolucaoGastoSaude ix={ix} />
    </>
  );
}

const bi = (v: number) => `R$ ${decimal(v / 1e9, 1)} bilhões`;

/** "O gasto cresceu acima da inflação?": a despesa somada num conjunto fixo de capitais, em reais de 2025 e em reais correntes. */
function EvolucaoGastoSaude({ ix }: { ix: IndiceSaude }) {
  const dados = ix.d;
  const { cap } = useCapital(dados);
  const evo = useMemo(() => evolucaoDaDespesa(ix), [ix]);
  const ficha = dados.fichas.find((f) => f.id === "sau.despesa.funcao_saude")!;
  if (!evo.pontos.length) return null;
  const p0 = evo.pontos[0];
  const pN = evo.pontos[evo.pontos.length - 1];
  const vt = variacaoTotal(evo.pontos);
  const frase = vt === null ? "Sem dois exercícios comparáveis." : `Em reais de ${pN.ano}, a soma das ${evo.capitais.length} capitais passou de ${bi(p0.real)} em ${p0.ano} para ${bi(pN.real)} em ${pN.ano}: ${vt >= 0 ? "alta" : "queda"} de ${decimal(Math.abs(vt), 1)}% já descontada a inflação.`;
  let fraseCap: string | null = null;
  if (cap) {
    const a = ix.ponto("sau.despesa.funcao_saude", cap.cod, p0.ano, "real_2025");
    const b = ix.ponto("sau.despesa.funcao_saude", cap.cod, pN.ano, "real_2025");
    const v = variacao(b, a);
    fraseCap = !v
      ? `${cap.nome} (${cap.uf}) não tem os dois valores para a variação.`
      : "pct" in v
        ? `${cap.nome} (${cap.uf}), de ${p0.ano} a ${pN.ano}: ${v.pct >= 0 ? "+" : "−"}${decimal(Math.abs(v.pct), 1)}% em reais de ${pN.ano}.`
        : `${cap.nome} (${cap.uf}): variação de ${p0.ano} a ${pN.ano} não calculada, porque ${v.bloqueio}.`;
  }
  return (
    <FiguraAnalitica
      id="evolucao-despesa"
      idioma="pt"
      pergunta="O gasto da prefeitura com saúde cresceu acima da inflação?"
      subtitulo={`Despesa liquidada na função Saúde, soma de ${evo.capitais.length} de ${dados.capitais.length} capitais com valor comparável em todos os exercícios · R$ bilhões · ${p0.ano} a ${pN.ano}`}
      natureza="CALCULADO"
      proveniencia={provenienciaDaFicha(ficha, dados.fontes, { inicio: String(p0.ano), fim: String(pN.ano) })}
      leitura={<LeituraGuiada>{frase}</LeituraGuiada>}
      tabela={{
        colunas: ["Exercício", `R$ de ${pN.ano} (IPCA)`, "R$ correntes"],
        linhas: evo.pontos.map((p) => [String(p.ano), bi(p.real), bi(p.nominal)]),
        titulo: `Despesa em saúde das ${evo.capitais.length} capitais, ${p0.ano} a ${pN.ano}`,
      }}
      comoInterpretar={`A linha em reais de ${pN.ano} corrige cada ano pelo IPCA médio do ano; a de reais correntes mostra o valor da época. A distância entre as duas é a inflação acumulada.`}
      naoConcluir="O total cresce também com a população e com a troca de serviços entre prefeitura, estado e União; a variação não mede mais atendimento nem melhor atendimento, e não inclui o gasto de estado e União na capital."
      complemento={
        <>
          <p className="t-meta max-w-prose2 text-carvao-muted">
            Fora do conjunto fixo: {evo.fora.map((f) => `${f.cap.nome} (${f.cap.uf}), ${f.motivo.charAt(0).toLowerCase()}${f.motivo.slice(1)}`).join("; ")}.
          </p>
          {fraseCap && <p className="t-corpo max-w-prose2 text-carvao">{fraseCap}</p>}
        </>
      }
    >
      <GraficoLinhas
        titulo="Despesa em saúde das capitais do conjunto fixo"
        series={[
          { id: "real", nome: `Em reais de ${pN.ano} (IPCA)`, pontos: evo.pontos.map((p) => ({ x: String(p.ano), y: p.real / 1e9 })) },
          { id: "nominal", nome: "Em reais correntes", pontos: evo.pontos.map((p) => ({ x: String(p.ano), y: p.nominal / 1e9 })) },
        ]}
        eixoY={{ unidade: "R$ bilhões", zero: true, casas: 1 }}
        formatoX="texto"
        altura={260}
      />
    </FiguraAnalitica>
  );
}

