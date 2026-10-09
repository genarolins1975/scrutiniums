"use client";

import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { Numero } from "@/components/energia/Numero";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { CAMPO_PERFIL, notaFaixaTarifa, referenciasDoPerfil, type ComparacaoMesmoConjunto, type Perfil } from "@/lib/energia/conta";
import type { Evidencia } from "@/lib/energia/evidencia";
import { dataBR } from "@/lib/energia/formato";
import type { ResumoTarifas, TarifaVigente } from "@/lib/energia/tipos-conta";

/**
 * Faixa de métricas da abertura da Conta de luz: o menor, a mediana e o maior custo do perfil de consumo entre as distribuidoras com
 * tarifa vigente, e a tarifa mediana em R$/kWh. É um componente de cliente só porque o perfil (?perfil=) é escolhido no painel de
 * tarifas, mais abaixo: a faixa lê o mesmo parâmetro da URL e acompanha a escolha (100, 200 ou 300 kWh) junto com a figura, o ranking, a
 * frase e a tabela. Os valores vêm de `referenciasDoPerfil`, o mesmo seletor da figura das referências: a faixa não calcula nada.
 *
 * A ressalva da faixa diz o que a tarifa não inclui e que a mediana é simples entre as distribuidoras (o `n` é o do próprio resumo). A
 * mediana leva a variação no MESMO conjunto de distribuidoras (as que têm tarifa no dia 1º e no ranking), que é a comparação válida com
 * o início do mês: o ranking tem menos distribuidoras que o do dia 1º, e a ressalva diz quantas saíram.
 * O menor, a mediana e o maior do perfil são leituras da tabela do ranking (custo = kWh × (TE + TUSD) ÷ 1000, com CSV e a ficha "Sobre
 * este dado" do painel); a ficha "Comprove este número" acompanha a tarifa mediana, que é a evidência que a gold publica.
 */

const ESQUEMA = { perfil: CAMPO_PERFIL };

export function ContaFaixa({
  vigentes,
  resumo,
  dataReferencia,
  evidenciaMediana,
  comparacao,
}: {
  vigentes: TarifaVigente[];
  resumo: ResumoTarifas;
  dataReferencia: string;
  evidenciaMediana: Evidencia | null;
  /** A mediana nas mesmas distribuidoras do dia 1º e do ranking; null quando a série não permite. */
  comparacao: ComparacaoMesmoConjunto | null;
}) {
  const [v] = useEstadoUrl(ESQUEMA);
  const perfil = Number(v.perfil) as Perfil;
  const r = referenciasDoPerfil(vigentes, resumo, perfil);
  const data = dataBR(dataReferencia);
  return (
    <FaixaMetricas colunas={4} rotulo={`Custo de ${perfil} kWh por mês e tarifa mediana`} nota={notaFaixaTarifa(resumo, comparacao)}>
      <Numero
        variante="faixa"
        rotulo={`Menor custo de ${perfil} kWh/mês`}
        natureza="CALCULADO"
        valor={r.menor?.valor ?? null}
        formato="reais"
        casas={2}
        unidade="R$/mês"
        periodo={r.menor ? `${r.menor.sigla}, ${data}` : data}
        motivoAusencia="Nenhuma distribuidora com tarifa vigente na data."
        cor="var(--serie-1)"
      />
      <Numero
        variante="faixa"
        rotulo={`Mediana simples de ${r.n} distribuidoras`}
        natureza="CALCULADO"
        valor={r.mediana}
        formato="reais"
        casas={2}
        unidade="R$/mês"
        periodo={`${perfil} kWh/mês, ${data}`}
        variacao={
          comparacao && comparacao.variacaoPct !== null
            ? { valor: comparacao.variacaoPct, casas: 2, sufixo: "%", referencia: `nas mesmas ${comparacao.nComum} distribuidoras, de ${dataBR(comparacao.de)} a ${dataBR(comparacao.ate)}` }
            : undefined
        }
        motivoAusencia="Nenhuma distribuidora com tarifa vigente na data."
        cor="var(--cor-energia)"
      />
      <Numero
        variante="faixa"
        rotulo={`Maior custo de ${perfil} kWh/mês`}
        natureza="CALCULADO"
        valor={r.maior?.valor ?? null}
        formato="reais"
        casas={2}
        unidade="R$/mês"
        periodo={r.maior ? `${r.maior.sigla}, ${data}` : data}
        motivoAusencia="Nenhuma distribuidora com tarifa vigente na data."
        cor="var(--serie-1)"
      />
      <Numero
        variante="faixa"
        rotulo="Tarifa mediana, TE + TUSD"
        natureza="CALCULADO"
        valor={resumo.mediana === null ? null : resumo.mediana / 1000}
        formato="reais"
        casas={4}
        unidade="R$/kWh"
        evidencia={evidenciaMediana}
        motivoAusencia="Nenhuma distribuidora com tarifa vigente na data."
        endereco="/setor-eletrico/conta-de-luz#tarifa"
      />
    </FaixaMetricas>
  );
}
