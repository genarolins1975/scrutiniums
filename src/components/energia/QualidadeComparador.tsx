"use client";

import { useEffect, useMemo, useState } from "react";
import { Comparador, type EntidadeComparavel } from "@/components/energia/Comparador";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl, type Leitor } from "@/lib/energia/estadoUrl";
import { carregarUmaVez, linhasSerieDistribuidoras, respostaHistoricoDistribuidora } from "@/lib/energia/qualidade";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { QualidadeSeriesDistribuidorasGold } from "@/lib/energia/tipos-qualidade";

/**
 * P051, pequenos múltiplos: DEC e FEC anuais de até quatro distribuidoras, cada uma no
 * seu painel e com o próprio limite tracejado, na mesma escala (a escala comum é dita
 * no gráfico). A série por distribuidora fica fora da gold (qualidade_distribuidoras_serie.json,
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
}: {
  entidades: EntidadeComparavel[];
  /** Quatro maiores em UCs no ano de referência (maioresDistribuidoras). */
  padrao: string[];
  urlSerie: string;
}) {
  // o padrão depende da gold, então o esquema é montado uma vez por instância (estável)
  const esquema = useMemo(() => ({ dist: campo(tiposUrl.lista(leitorCnpj, { max: LIMITE_COMPARACAO }), padrao, { param: "dist" }) }), [padrao.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const [v, definir] = useEstadoUrl(esquema);
  const [serie, setSerie] = useState<QualidadeSeriesDistribuidorasGold | null>(null);
  const [erro, setErro] = useState<string | null>(null);

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
      nota: serie?.distribuidoras[c]?.quebras.length ? `perímetro mudou em ${serie.distribuidoras[c].quebras.join(", ")}` : undefined,
    }));

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
      {serie && escolhidas.length > 0 && (
        <>
          <ul className="space-y-1 text-sm text-carvao" aria-live="polite">
            {escolhidas.map((c) => (
              <li key={c}>{respostaHistoricoDistribuidora(nomes.get(c) ?? `CNPJ ${c}`, serie.distribuidoras[c], "dec")}</li>
            ))}
          </ul>
          <PequenosMultiplos
            titulo="DEC anual diante do limite de cada distribuidora"
            dados={dadosDec}
            chaveX="ano"
            formatoX="texto"
            unidade="h"
            casas={2}
            colunas={2}
            nivelTitulo={4}
            paineis={paineis("dec")}
          />
          <PequenosMultiplos
            titulo="FEC anual diante do limite de cada distribuidora"
            dados={dadosFec}
            chaveX="ano"
            formatoX="texto"
            unidade="interrupções"
            casas={2}
            colunas={2}
            nivelTitulo={4}
            paineis={paineis("fec")}
          />
        </>
      )}
    </div>
  );
}
