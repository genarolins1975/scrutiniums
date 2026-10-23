"use client";

import { useId, useMemo } from "react";
import { Controles, FiguraAnalitica, GraficoBarras, LeituraGuiada } from "@/components/painel";
import { useEstadoUrl } from "@/components/painel/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/painel/estadoUrl";
import type { Proveniencia } from "@/lib/painel/tipos";
import type { SuasData } from "@/lib/eficiencia/assistencia/dados";

const NOMES: Record<string, string> = { a1: "Famílias em acompanhamento PAIF", a2: "Novas famílias inseridas no PAIF", c1: "Atendimentos particularizados", c5: "Atendimentos com encaminhamento ao CREAS" };
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const fmt = (v: number | null) => (v === null ? "Não informado" : v.toLocaleString("pt-BR"));

/**
 * O volume mensal do RMA CRAS 2025 no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): os controles (território e medida)
 * logo antes da figura, com o recorte na URL (?ter=, o mesmo território das respostas da rede, e ?rma=), e a figura do kit com as barras
 * por mês desde zero, a tabela equivalente (soma observada, formulários com valor entre os presentes e valores alterados pelo
 * tratamento), a fonte e o que não é possível concluir. Os números e as frases são os da série de antes; nulo continua "Não informado"
 * na tabela e lacuna no gráfico, nunca zero.
 */
export function SerieRma({
  series,
  ufs,
  proveniencias,
  rota,
}: {
  series: Record<string, SuasData["stats"][string]["monthly"]>;
  ufs: string[];
  proveniencias: Record<string, Proveniencia>;
  rota: string;
}) {
  const id = useId();
  const esquema = useMemo(
    () => ({
      ter: campo(tiposUrl.opcao(["Brasil", ...ufs]), "Brasil"),
      rma: campo(tiposUrl.opcao(Object.keys(NOMES)), "a1"),
    }),
    [ufs],
  );
  const [s, definir] = useEstadoUrl(esquema);
  const linhas = series[s.ter];
  const nome = NOMES[s.rma];
  const padrao = s.ter === "Brasil" && s.rma === "a1";
  const ultimo = [...linhas].reverse().find((r) => r.values[s.rma].sum !== null);
  const rotuloSelect = "mt-2 block min-h-[44px] max-w-full border border-carvao-muted bg-superficie px-3 text-sm text-carvao";
  return (
    <>
      <Controles rotulo="Recorte do volume mensal" resumo={`Mostrando ${s.ter}, ${nome}, 2025.`} limpar={padrao ? undefined : { href: rota }} idioma="pt">
        <label className="text-sm text-carvao" htmlFor={`${id}-uf`}>
          Território
          <select id={`${id}-uf`} value={s.ter} onChange={(e) => definir({ ter: e.target.value })} className={rotuloSelect}>
            <option>Brasil</option>
            {ufs.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
        <label className="min-w-0 max-w-full text-sm text-carvao" htmlFor={`${id}-m`}>
          Medida
          <select id={`${id}-m`} value={s.rma} onChange={(e) => definir({ rma: e.target.value })} className={`${rotuloSelect} w-full`}>
            {Object.entries(NOMES).map(([k, n]) => (
              <option key={k} value={k}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </Controles>
      <FiguraAnalitica
        id="volume-mensal"
        pergunta="O volume observado em cada mês."
        subtitulo={`${nome} · ${s.ter} · 2025 · contagem, somas apenas de formulários com valor observado`}
        natureza="CALCULADO"
        proveniencia={proveniencias[s.rma]}
        download={{ href: "/eficiencia/assistencia-social/rma-cras.csv", rotulo: "Baixar todos os registros, valores tratados e originais (CSV)" }}
        idioma="pt"
        leitura={
          <LeituraGuiada>
            RMA CRAS 2025 · Base tratada pelo MDS.{" "}
            {ultimo ? `Em ${MESES[ultimo.month - 1].toLowerCase()}/2025, ${fmt(ultimo.values[s.rma].sum)}, de ${fmt(ultimo.values[s.rma].observed)} formulários com valor entre ${fmt(ultimo.values[s.rma].total)} presentes.` : "Nenhum mês tem valor observado neste recorte."}
          </LeituraGuiada>
        }
        tabela={{
          titulo: "Tabela equivalente · valores tratados e cobertura dos formulários presentes",
          colunas: ["Mês", "Soma observada", "Com valor / presentes", "Valores alterados pelo tratamento"],
          linhas: linhas.map((r) => {
            const v = r.values[s.rma];
            return [`${MESES[r.month - 1]} / 2025`, v.sum, `${fmt(v.observed)} / ${fmt(v.total)}`, v.changed];
          }),
          casas: [null, 0, null, 0],
        }}
        comoInterpretar="A composição e o preenchimento podem variar por mês. Famílias em acompanhamento são um estoque mensal; somá-las no ano repetiria famílias. Barras desde zero; nulo permanece não informado."
        naoConcluir="Encaminhar não comprova atendimento no destino. O denominador de cobertura são os formulários presentes neste arquivo, não todas as unidades que deveriam informar; sem comparação com o cadastro de unidades ativas, não se mede a completude de envio."
        ressalva="Os critérios do MDS retiram formulários inteiramente zerados e valores discrepantes."
      >
        <GraficoBarras
          titulo={`${nome} por mês de 2025 em ${s.ter}; somas apenas de formulários com valor observado`}
          series={[{ id: "soma", nome, pontos: linhas.map((r) => ({ x: String(r.month), rotulo: MESES[r.month - 1], y: r.values[s.rma].sum })) }]}
          eixoY={{ unidade: "contagem", zero: true, casas: 0 }}
          orientacao="vertical"
        />
      </FiguraAnalitica>
    </>
  );
}
