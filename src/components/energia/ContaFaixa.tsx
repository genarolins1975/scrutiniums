"use client";

import { useMemo } from "react";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { Numero } from "@/components/energia/Numero";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  CAMPO_PERFIL,
  expandirInfo,
  expandirVigentes,
  medianaPonderadaDoPerfil,
  notaFaixaTarifa,
  referenciasDoPerfil,
  textoUcs,
  type CoberturaRanking,
  type ComparacaoMesmoConjunto,
  type InfoCompacta,
  type Perfil,
  type VigenteCompacto,
} from "@/lib/energia/conta";
import type { Evidencia } from "@/lib/energia/evidencia";
import { dataBR } from "@/lib/energia/formato";
import type { ResumoTarifas } from "@/lib/energia/tipos-conta";

/**
 * Faixa de métricas da abertura da Conta de luz: o menor, a mediana e o maior custo do perfil de consumo entre as distribuidoras com
 * tarifa vigente, e a tarifa mediana em R$/kWh. É um componente de cliente só porque o perfil (?perfil=) é escolhido no painel de
 * tarifas, mais abaixo: a faixa lê o mesmo parâmetro da URL e acompanha a escolha (100, 200 ou 300 kWh) junto com a figura, o ranking, a
 * frase e a tabela. Os valores vêm de `referenciasDoPerfil`, o mesmo seletor da figura das referências: a faixa não calcula nada.
 *
 * O menor e o maior dizem, no rótulo, que são "entre as N com tarifa vigente" no arquivo, e o peso de cada um em consumidores (UCs): os
 * extremos são pequenas cooperativas, e o leitor lê o valor sabendo quantos consumidores ele alcança. A ressalva da faixa traz a mediana
 * ponderada pelas UCs ao lado da simples, a cobertura do ranking (distribuidoras e UCs, contra o piso de 99% das UCs de Qualidade) e o que
 * mudaria no menor e no maior com a última tarifa das distribuidoras que ficaram de fora. A mediana leva a variação no MESMO conjunto de
 * distribuidoras (as que têm tarifa no dia 1º e no ranking), que é a comparação válida com o início do mês: o ranking tem menos
 * distribuidoras que o do dia 1º, e a ressalva diz quantas saíram.
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
  info: infoCompacta,
  cobertura,
}: {
  /** As distribuidoras do ranking em tuplas (`compactarVigentes`): a mesma lista, com a mesma referência, que o painel de tarifas recebe. */
  vigentes: VigenteCompacto[];
  resumo: ResumoTarifas;
  dataReferencia: string;
  evidenciaMediana: Evidencia | null;
  /** A mediana nas mesmas distribuidoras do dia 1º e do ranking; null quando a série não permite. */
  comparacao: ComparacaoMesmoConjunto | null;
  /** UF, tipo e UCs de cada distribuidora (`compactarInfo`): a mesma lista, com a mesma referência, que os outros painéis recebem. */
  info: InfoCompacta;
  /** A regra de completude do ranking, medida no servidor (distribuidoras, UCs e o que mudaria nos extremos). */
  cobertura: CoberturaRanking | null;
}) {
  const [v] = useEstadoUrl(ESQUEMA);
  const perfil = Number(v.perfil) as Perfil;
  const todas = useMemo(() => expandirVigentes(vigentes), [vigentes]);
  const info = useMemo(() => expandirInfo(infoCompacta), [infoCompacta]);
  const r = referenciasDoPerfil(todas, resumo, perfil);
  const ponderada = useMemo(() => medianaPonderadaDoPerfil(todas, info, perfil).valor, [todas, info, perfil]);
  const data = dataBR(dataReferencia);
  const ucsDe = (cnpj: string | undefined) => (cnpj ? textoUcs(info[cnpj]?.ucs) : "");
  const nota = notaFaixaTarifa(resumo, comparacao, {
    perfil,
    ponderada,
    cobertura,
    extremos: { menor: r.menor?.valor ?? null, maior: r.maior?.valor ?? null, siglaMenor: r.menor?.sigla ?? null, siglaMaior: r.maior?.sigla ?? null },
  });
  const abaixoDoPiso = cobertura !== null && cobertura.atingePiso === false;
  return (
    <FaixaMetricas
      colunas={4}
      rotulo={`Custo de ${perfil} kWh por mês e tarifa mediana`}
      nota={
        <p className={`text-sm leading-relaxed ${abaixoDoPiso ? "border border-dashed border-mineral px-3 py-2 text-carvao" : "text-carvao-muted"}`} role={abaixoDoPiso ? "status" : undefined} data-nota="cobertura-ranking">
          {nota}
        </p>
      }
    >
      <Numero
        variante="faixa"
        rotulo={`Menor custo de ${perfil} kWh/mês, entre as ${r.n} com tarifa vigente`}
        natureza="CALCULADO"
        valor={r.menor?.valor ?? null}
        formato="reais"
        casas={2}
        unidade="R$/mês"
        periodo={r.menor ? `${r.menor.sigla} (${ucsDe(r.menor.cnpj)}), ${data}` : data}
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
        rotulo={`Maior custo de ${perfil} kWh/mês, entre as ${r.n} com tarifa vigente`}
        natureza="CALCULADO"
        valor={r.maior?.valor ?? null}
        formato="reais"
        casas={2}
        unidade="R$/mês"
        periodo={r.maior ? `${r.maior.sigla} (${ucsDe(r.maior.cnpj)}), ${data}` : data}
        motivoAusencia="Nenhuma distribuidora com tarifa vigente na data."
        cor="var(--serie-1)"
      />
      <Numero
        variante="faixa"
        rotulo="Tarifa mediana simples, TE + TUSD"
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
