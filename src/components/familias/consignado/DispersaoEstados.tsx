"use client";

import { useId, useMemo } from "react";
import { GraficoDispersao } from "@/components/painel";
import { useEstadoUrl } from "@/components/painel/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/painel/estadoUrl";
import { n } from "./camadas";

export type EstadoDispersao = { uf: string; nome: string; outras_censo: number; cons_por_60: number; a60: number | null };

const seletor = "mt-1 block min-h-[44px] w-full max-w-xs border border-linha bg-superficie px-2 text-sm text-carvao";

/**
 * Dispersão por UF do painel "Consignado e aposentados": rendimento que não vem do trabalho (Censo) contra consignado de aposentados por
 * pessoa de 60 anos ou mais (SCR), com a área do círculo proporcional à população de 60 anos ou mais e o seletor "Consultar estado",
 * como na vista antiga (cgCircularidade em public/obs/app.js). O estado escolhido ganha destaque com o nome no gráfico, a leitura por
 * extenso e fica no endereço (?cguf=), para o link reabrir a mesma consulta. Nenhum valor é calculado aqui.
 */
export function DispersaoEstados({ estados, periodo }: { estados: EstadoDispersao[]; periodo: string }) {
  const id = useId();
  const ufs = useMemo(() => estados.map((e) => e.uf), [estados]);
  const esquema = useMemo(() => ({ cguf: campo(tiposUrl.opcao(["", ...ufs]), "") }), [ufs]);
  const [s, set] = useEstadoUrl(esquema);
  const escolhido = estados.find((e) => e.uf === s.cguf) ?? null;
  const ordenados = useMemo(() => [...estados].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), [estados]);
  return (
    <div data-dispersao-estados={s.cguf}>
      <label htmlFor={`${id}-uf`} className="block text-sm text-carvao">
        Consultar estado
        <select id={`${id}-uf`} value={s.cguf} onChange={(e) => set({ cguf: e.target.value })} className={seletor}>
          <option value="">Nenhum estado destacado</option>
          {ordenados.map((e) => (
            <option key={e.uf} value={e.uf}>
              {e.nome} ({e.uf})
            </option>
          ))}
        </select>
      </label>
      <p className="t-meta mb-4 mt-2 max-w-prose2 text-carvao" aria-live="polite" data-leitura-estado="">
        {escolhido
          ? `${escolhido.nome} (${escolhido.uf}): ${n(escolhido.outras_censo, 1)}% do rendimento domiciliar não vem do trabalho (Censo 2022); consignado de aposentados e pensionistas de R$ ${n(escolhido.cons_por_60)} por pessoa de 60 anos ou mais (${periodo}); população de 60 anos ou mais: ${escolhido.a60 === null ? "sem dado" : `${n(escolhido.a60)} pessoas`}.`
          : "Escolha um estado para destacar o círculo dele e ler as três medidas por extenso."}
      </p>
      <GraficoDispersao
        titulo="Dependência previdenciária e consignado, por unidade da federação"
        pontos={estados.map((e) => ({ id: e.uf, rotulo: `${e.nome} (${e.uf})`, x: e.outras_censo, y: e.cons_por_60, tamanho: e.a60 }))}
        eixoX={{ rotulo: "Rendimento que não vem do trabalho", unidade: "%", casas: 1 }}
        eixoY={{ rotulo: "Consignado por pessoa de 60 anos ou mais", unidade: "R$", casas: 0 }}
        tamanho={{ rotulo: "População de 60 anos ou mais", unidade: "pessoas", casas: 0 }}
        entidade={{ singular: "estado", plural: "estados" }}
        destacados={escolhido ? [escolhido.uf] : undefined}
        rodape={{
          periodo: `Censo 2022 e ${periodo}`,
          avisoCausalidade: "Associação entre estados não é causa: o mecanismo desta relação não está estabelecido.",
          nota: "A área de cada círculo acompanha a população de 60 anos ou mais do estado (Censo 2022); círculo maior não indica mais consignado por pessoa.",
        }}
        rotulosSaoNomes
      />
    </div>
  );
}
