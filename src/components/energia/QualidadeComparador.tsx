"use client";

import { useEffect, useMemo, useState } from "react";
import { Comparador, type EntidadeComparavel } from "@/components/energia/Comparador";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { QualidadeEscala } from "@/components/energia/QualidadeEscala";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl, type Leitor } from "@/lib/energia/estadoUrl";
import { carregarUmaVez, linhasSerieDistribuidoras, respostaHistoricoDistribuidora, unidadeIndicador, type AvisosFec } from "@/lib/energia/qualidade";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { EscalaPaineis } from "@/lib/energia/series-temporais";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { QualidadeSeriesDistribuidorasGold } from "@/lib/energia/tipos-qualidade";

/**
 * Pequenos múltiplos (painel de limites): DEC e FEC anuais de até quatro distribuidoras, cada uma no
 * seu painel e com o próprio limite tracejado, na mesma escala (a escala comum é dita
 * no gráfico). O DEC e o FEC ficam em blocos próprios, lado a lado a partir de 1.024 px, cada um
 * com a sua escala e com a frase de cada distribuidora (anos acima do limite, último ano e mudança
 * de perímetro). A série por distribuidora fica fora da gold (qualidade_distribuidoras_serie.json,
 * 36 KB) e é buscada quando o painel aparece.
 *
 * A escolha mora em `?dist=`, o mesmo parâmetro do painel de limites e do botão do mapa:
 * escolher ali muda aqui, e o voltar desfaz. Sem nada escolhido no link, entram as
 * quatro maiores distribuidoras em unidades consumidoras (padrão dito no texto e não
 * gravado na URL); `?dist=` vazio é a escolha explícita de nenhuma.
 */

const leitorCnpj: Leitor<string> = { ler: (b) => (/^\d{14}$/.test(b) ? b : undefined), escrever: (v) => v };

export function QualidadeComparador({
  entidades,
  padrao,
  urlSerie,
  avisosFec = {},
}: {
  entidades: EntidadeComparavel[];
  /** Quatro maiores em UCs no ano de referência (maioresDistribuidoras). */
  padrao: string[];
  urlSerie: string;
  /** Distribuidoras cujo FEC do ano é de cobertura parcial: a frase vai com o histórico do FEC e o ano leva um marco. */
  avisosFec?: AvisosFec;
}) {
  // o padrão depende da gold, então o esquema é montado uma vez por instância (estável)
  const esquema = useMemo(() => ({ dist: campo(tiposUrl.lista(leitorCnpj, { max: LIMITE_COMPARACAO }), padrao, { param: "dist" }) }), [padrao.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const [v, definir] = useEstadoUrl(esquema);
  const idioma = useIdioma();
  const tx = useTx();
  const [serie, setSerie] = useState<QualidadeSeriesDistribuidorasGold | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [escala, setEscala] = useState<EscalaPaineis>("compartilhada");

  useEffect(() => {
    let vivo = true;
    carregarUmaVez(urlSerie, (r) => r.json() as Promise<QualidadeSeriesDistribuidorasGold>).then(
      (s) => vivo && setSerie(s),
      (e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [urlSerie]);

  const nomes = useMemo(() => new Map(entidades.map((e) => [e.id, e.rotulo])), [entidades]);
  const escolhidas = v.dist;
  const dadosDec = useMemo(() => (serie ? linhasSerieDistribuidoras(serie, escolhidas, "dec") : []), [serie, escolhidas.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const dadosFec = useMemo(() => (serie ? linhasSerieDistribuidoras(serie, escolhidas, "fec") : []), [serie, escolhidas.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const paineis = (ind: "dec" | "fec") =>
    escolhidas.map((c) => ({
      id: c,
      // o título do painel diz o indicador: a mesma distribuidora aparece uma vez no bloco do DEC e outra no do FEC
      titulo: `${nomes.get(c) ?? `CNPJ ${c}`}, ${ind === "dec" ? "DEC" : "FEC"}`,
      series: [
        { id: `${ind}_${c}`, rotulo: ind === "dec" ? tx("DEC apurado", "Assessed DEC") : tx("FEC apurado", "Assessed FEC"), cor: "var(--cor-energia)" }, // i18n: dado
        { id: `lim_${c}`, rotulo: tx("Limite", "Limit"), cor: "var(--serie-referencia)", tracejada: true },
      ],
      nota:
        [
          serie?.distribuidoras[c]?.quebras.length
            ? tx(`perímetro mudou em ${serie.distribuidoras[c].quebras.join(", ")}`, `perimeter changed in ${serie.distribuidoras[c].quebras.join(", ")}`)
            : null,
          ind === "fec" && avisosFec[c] ? tx(`${avisosFec[c].ano}: FEC de cobertura parcial`, `${avisosFec[c].ano}: FEC with partial coverage`) : null,
        ]
          .filter(Boolean)
          .join("; ") || undefined,
    }));

  const bloco = (ind: "dec" | "fec", dados: ReturnType<typeof linhasSerieDistribuidoras>) => {
    const nome = ind === "dec" ? "DEC" : "FEC";
    const unidade = unidadeIndicador(ind, idioma);
    const unica = escolhidas.length === 1 ? escolhidas[0] : null;
    return (
      <div className="space-y-3" data-comparador-indicador={ind}>
        {/* só a lista do DEC é região viva: a troca de escolha é anunciada uma vez, não duas */}
        <ul className="space-y-1 text-sm text-carvao" aria-live={ind === "dec" ? "polite" : undefined}>
          {escolhidas.map((c) => (
            <li key={c}>
              {respostaHistoricoDistribuidora(nomes.get(c) ?? `CNPJ ${c}`, serie?.distribuidoras[c], ind, idioma)}
              {ind === "fec" && avisosFec[c] && ` ${avisosFec[c].frase}`}
            </li>
          ))}
        </ul>
        {unica ? (
          // uma distribuidora só (o link vindo de outra página): um gráfico com a largura da coluna, em vez de um painel com a célula vizinha vazia
          <GraficoLinhas
            titulo={tx(`${nome} anual e limite de ${nomes.get(unica) ?? `CNPJ ${unica}`}`, `Annual ${nome} and limit of ${nomes.get(unica) ?? `CNPJ ${unica}`}`)}
            dados={dados}
            chaveX="ano" // i18n: dado
            formatoX="texto"
            series={[
              { id: `${ind}_${unica}`, rotulo: tx(`${nome} apurado`, `Assessed ${nome}`), cor: "var(--cor-energia)" }, // i18n: dado
              { id: `lim_${unica}`, rotulo: tx("Limite do ano", "Limit of the year"), cor: "var(--serie-referencia)", tracejada: true },
            ]}
            unidade={unidade}
            casas={2}
            altura={240}
            marcos={[
              ...(serie?.distribuidoras[unica]?.quebras ?? []).map((q) => ({ x: String(q), rotulo: tx(`${q}: perímetro mudou`, `${q}: perimeter changed`) })),
              ...(ind === "fec" && avisosFec[unica]
                ? [{ x: String(avisosFec[unica].ano), rotulo: tx(`${avisosFec[unica].ano}: FEC de cobertura parcial`, `${avisosFec[unica].ano}: FEC with partial coverage`) }]
                : []),
            ]}
          />
        ) : (
          <PequenosMultiplos
            titulo={tx(`${nome} anual diante do limite de cada distribuidora`, `Annual ${nome} against the limit of each distribution utility`)}
            dados={dados}
            chaveX="ano" // i18n: dado
            formatoX="texto"
            unidade={unidade}
            casas={2}
            colunas={2}
            nivelTitulo={4}
            escala={escala}
            paineis={paineis(ind)}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <Comparador
        rotulo={tx("Distribuidoras nos pequenos múltiplos (até 4)", "Distribution utilities in the small multiples (up to 4)")}
        entidades={entidades}
        selecionadas={escolhidas}
        onMudar={(ids) => definir({ dist: ids })}
        dicaBusca={tx("Sigla, nome ou CNPJ", "Acronym, name or CNPJ")}
        vazio={tx(
          "Nenhuma distribuidora escolhida. Escolha aqui, no gráfico de limites ou pelo município no mapa.",
          "No distribution utility selected. Choose here, in the limits chart or through the municipality on the map.",
        )}
      >
        {() => null}
      </Comparador>
      {erro && (
        <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
          {tx(
            <>Não foi possível carregar as séries por distribuidora ({erro}). Os mesmos valores estão no CSV anual por distribuidora, na lista de downloads do painel.</>,
            <>The series by distribution utility could not be loaded ({erro}). The same values are in the annual CSV by distribution utility, in the panel&apos;s download list.</>,
          )}
        </p>
      )}
      {!serie && !erro && (
        <p role="status" className="text-sm text-carvao-muted">
          {tx("Carregando as séries anuais por distribuidora…", "Loading the annual series by distribution utility…")}
        </p>
      )}
      {serie && escolhidas.length > 1 && <QualidadeEscala valor={escala} onMudar={setEscala} />}
      {serie && escolhidas.length > 0 && (
        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2 [&>*]:min-w-0">
          {bloco("dec", dadosDec)}
          {bloco("fec", dadosFec)}
        </div>
      )}
    </div>
  );
}
