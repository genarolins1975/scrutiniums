"use client";

import { useEffect, useMemo, useState } from "react";
import { Comparador, type EntidadeComparavel } from "@/components/energia/Comparador";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { QualidadeEscala } from "@/components/energia/QualidadeEscala";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl, type Leitor } from "@/lib/energia/estadoUrl";
import { carregarUmaVez, linhasSerieDistribuidoras, respostaHistoricoDistribuidora, type AvisosFec } from "@/lib/energia/qualidade";
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
      titulo: nomes.get(c) ?? `CNPJ ${c}`,
      series: [
        { id: `${ind}_${c}`, rotulo: ind === "dec" ? "DEC apurado" : "FEC apurado", cor: "var(--cor-energia)" },
        { id: `lim_${c}`, rotulo: "Limite", cor: "var(--serie-referencia)", tracejada: true },
      ],
      nota:
        [
          serie?.distribuidoras[c]?.quebras.length ? `perímetro mudou em ${serie.distribuidoras[c].quebras.join(", ")}` : null,
          ind === "fec" && avisosFec[c] ? `${avisosFec[c].ano}: FEC de cobertura parcial` : null,
        ]
          .filter(Boolean)
          .join("; ") || undefined,
    }));

  const bloco = (ind: "dec" | "fec", dados: ReturnType<typeof linhasSerieDistribuidoras>) => {
    const nome = ind === "dec" ? "DEC" : "FEC";
    const unidade = ind === "dec" ? "h" : "interrupções";
    const unica = escolhidas.length === 1 ? escolhidas[0] : null;
    return (
      <div className="space-y-3" data-comparador-indicador={ind}>
        {/* só a lista do DEC é região viva: a troca de escolha é anunciada uma vez, não duas */}
        <ul className="space-y-1 text-sm text-carvao" aria-live={ind === "dec" ? "polite" : undefined}>
          {escolhidas.map((c) => (
            <li key={c}>
              {respostaHistoricoDistribuidora(nomes.get(c) ?? `CNPJ ${c}`, serie?.distribuidoras[c], ind)}
              {ind === "fec" && avisosFec[c] && ` ${avisosFec[c].frase}`}
            </li>
          ))}
        </ul>
        {unica ? (
          // uma distribuidora só (o link vindo de outra página): um gráfico com a largura da coluna, em vez de um painel com a célula vizinha vazia
          <GraficoLinhas
            titulo={`${nome} anual e limite de ${nomes.get(unica) ?? `CNPJ ${unica}`}`}
            dados={dados}
            chaveX="ano"
            formatoX="texto"
            series={[
              { id: `${ind}_${unica}`, rotulo: `${nome} apurado`, cor: "var(--cor-energia)" },
              { id: `lim_${unica}`, rotulo: "Limite do ano", cor: "var(--serie-referencia)", tracejada: true },
            ]}
            unidade={unidade}
            casas={2}
            altura={240}
            marcos={[
              ...(serie?.distribuidoras[unica]?.quebras ?? []).map((q) => ({ x: String(q), rotulo: `${q}: perímetro mudou` })),
              ...(ind === "fec" && avisosFec[unica] ? [{ x: String(avisosFec[unica].ano), rotulo: `${avisosFec[unica].ano}: FEC de cobertura parcial` }] : []),
            ]}
          />
        ) : (
          <PequenosMultiplos
            titulo={`${nome} anual diante do limite de cada distribuidora`}
            dados={dados}
            chaveX="ano"
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
        rotulo="Distribuidoras nos pequenos múltiplos (até 4)"
        entidades={entidades}
        selecionadas={escolhidas}
        onMudar={(ids) => definir({ dist: ids })}
        dicaBusca="Sigla, nome ou CNPJ"
        vazio="Nenhuma distribuidora escolhida. Escolha aqui, no gráfico de limites ou pelo município no mapa."
      >
        {() => null}
      </Comparador>
      {erro && (
        <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
          Não foi possível carregar as séries por distribuidora ({erro}). Os mesmos valores estão no CSV anual por distribuidora, na lista de downloads do painel.
        </p>
      )}
      {!serie && !erro && (
        <p role="status" className="text-sm text-carvao-muted">
          Carregando as séries anuais por distribuidora…
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
