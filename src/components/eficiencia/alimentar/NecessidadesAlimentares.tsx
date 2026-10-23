"use client";
import { useId, useMemo } from "react";
import { Controles, FiguraAnalitica, GraficoBarras, LeituraGuiada, TabelaDados } from "@/components/painel";
import { useEstadoUrl } from "@/components/painel/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/painel/estadoUrl";
import type { Proveniencia } from "@/lib/painel/tipos";
import type { Necessidade } from "@/lib/eficiencia/alimentar/dados";

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * A EBIA no Brasil e nas Grandes Regiões (IBGE, PNAD Contínua 2023 e 2024) no molde de painel (Iniciativa 1 do parecer de UX de
 * 23/10/2026): o território na URL (?regiao=) logo antes da figura do kit, com a insegurança total de cada ano em barras na escala fixa de
 * 0 a 100% (a referência no total leva o eixo a 100), o valor do território e a insegurança grave na leitura, e a tabela com todas as
 * classes à vista, como antes. Percentuais publicados pelo IBGE, com o arredondamento original; nada é recalculado.
 */
export function NecessidadesAlimentares({ rows, proveniencia, rota }: { rows: Necessidade[]; proveniencia: Proveniencia; rota: string }) {
  const id = useId();
  const territorios = useMemo(() => rows.filter((r) => r.year === 2024).map((r) => r.territory), [rows]);
  const esquema = useMemo(() => ({ regiao: campo(tiposUrl.opcao(territorios), "Brasil") }), [territorios]);
  const [s, definir] = useEstadoUrl(esquema);
  const territorio = s.regiao;
  const selecionadas = rows.filter((r) => r.territory === territorio);
  const atual = selecionadas.find((r) => r.year === 2024)!;
  return (
    <>
      <Controles rotulo="Território da pesquisa domiciliar" resumo={`Mostrando ${territorio}, 2023 e 2024.`} limpar={territorio === "Brasil" ? undefined : { href: rota }} idioma="pt">
        <label htmlFor={`${id}-regiao`} className="min-w-[14rem] text-sm text-carvao">
          Território da pesquisa domiciliar
          <select id={`${id}-regiao`} value={territorio} onChange={(e) => definir({ regiao: e.target.value })} className="mt-2 block min-h-[44px] w-full max-w-sm border border-mineral bg-superficie px-3 text-sm text-carvao">
            {territorios.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      </Controles>
      <FiguraAnalitica
        id="ebia-regioes"
        idioma="pt"
        pergunta="Quantos domicílios enfrentam insegurança alimentar?"
        subtitulo={`Insegurança total · percentual dos domicílios · ${territorio} · 2023 e 2024`}
        natureza="OBSERVADO"
        proveniencia={proveniencia}
        download={{ href: "/eficiencia/seguranca-alimentar/pnad.csv", rotulo: "Baixar tabela completa · CSV" }}
        leitura={
          <LeituraGuiada>
            {territorio} · 2024: <strong className="tabular-nums">{fmt(atual.insecure)}%</strong> dos domicílios com insegurança alimentar. Insegurança grave: <strong className="tabular-nums">{fmt(atual.severe)}%</strong> dos domicílios.
          </LeituraGuiada>
        }
        comoInterpretar="Barras em escala fixa de 0 a 100%. Sem atribuição causal ou teste de significância. Categorias não são rescaladas para corrigir arredondamento."
        naoConcluir="EBIA mede experiência de restrição alimentar, não a entrega do serviço público. Não há estimativas municipais neste recorte."
        ressalva="Domicílios particulares; Brasil e grandes regiões. Valores da PNAD Contínua Segurança Alimentar 2024 do IBGE, tabela na página 6."
        tabela={{ naFigura: "a tabela com todas as classes da EBIA em cada ano, logo abaixo do gráfico." }}
        complemento={
          <TabelaDados
            idioma="pt"
            recolhida={false}
            titulo={`${territorio} · percentuais publicados pelo IBGE, arredondamento original`}
            colunas={["Ano", "Com segurança", "Insegurança total", "Leve", "Moderada", "Grave"]}
            linhas={selecionadas.map((r) => [String(r.year), ...[r.secure, r.insecure, r.mild, r.moderate, r.severe].map((v) => `${fmt(v)}%`)])}
            nota={`${territorio} · percentuais publicados pelo IBGE, arredondamento original.`}
          />
        }
      >
        <GraficoBarras
          titulo={`Insegurança total, percentual dos domicílios, ${territorio}, 2023 e 2024`}
          series={[{ id: "insegura", nome: "Insegurança total", pontos: selecionadas.map((r) => ({ x: String(r.year), y: r.insecure })) }]}
          eixoY={{ unidade: "%", zero: true, casas: 1 }}
          orientacao="horizontal"
          rotulosValor
          referencias={[{ valor: 100, rotulo: "Total dos domicílios" }]}
        />
      </FiguraAnalitica>
    </>
  );
}
