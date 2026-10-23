"use client";
/**
 * EBIA por estado (IBGE, SIDRA 9552): percentual publicado de domicílios em cada classe, com o
 * coeficiente de variação ao lado. Só filtra e ordena o que a gold traz; não recalcula nada.
 *
 * Molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): os controles (medida e ano, na URL como ?classe= e ?ano=) logo antes
 * da figura do kit, com as barras desde zero, o Brasil como linha de referência, a tabela com o coeficiente de variação e o número de
 * domicílios como tabela equivalente e a procedência da medida logo abaixo.
 */
import { useId, useMemo, type ReactNode } from "react";
import { Controles, FiguraAnalitica, GraficoBarras, LeituraGuiada } from "@/components/painel";
import { useEstadoUrl } from "@/components/painel/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/painel/estadoUrl";
import type { Natureza, Proveniencia } from "@/lib/painel/tipos";
import type { ClasseEbia, LinhaEbia } from "@/lib/eficiencia/alimentar/complementos";

const CLASSES: { id: Exclude<ClasseEbia, "total" | "segura">; nome: string }[] = [
  { id: "insegura", nome: "Insegurança alimentar total" },
  { id: "grave", nome: "Insegurança alimentar grave" },
  { id: "moderada", nome: "Insegurança alimentar moderada" },
  { id: "leve", nome: "Insegurança alimentar leve" },
];
const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const sem = "Sem valor publicado";

export function EbiaPorEstado({
  linhas,
  regiaoDe,
  proveniencia,
  natureza,
  complemento,
  contexto,
  download,
  rota,
}: {
  linhas: LinhaEbia[];
  regiaoDe: Record<string, string>;
  proveniencia: Proveniencia;
  natureza: Natureza;
  complemento: ReactNode;
  contexto?: ReactNode;
  download: { href: string; rotulo: string };
  rota: string;
}) {
  const id = useId();
  const anos = useMemo(() => [...new Set(linhas.map((l) => l.ano))].sort((a, b) => b - a), [linhas]);
  const esquema = useMemo(
    () => ({
      classe: campo(tiposUrl.opcao(CLASSES.map((c) => c.id)), "insegura" as (typeof CLASSES)[number]["id"]),
      ano: campo(tiposUrl.opcao(anos.map(String)), String(anos[0])),
    }),
    [anos],
  );
  const [s, definir] = useEstadoUrl(esquema);
  const ano = Number(s.ano);
  const classe = s.classe;
  const nomeClasse = CLASSES.find((c) => c.id === classe)!.nome;
  const brasil = linhas.find((l) => l.nivel === "brasil" && l.ano === ano)!.classes[classe].pct;
  const ufs = linhas
    .filter((l) => l.nivel === "uf" && l.ano === ano)
    .sort((a, b) => (b.classes[classe].pct ?? -1) - (a.classes[classe].pct ?? -1) || a.territorio.localeCompare(b.territorio, "pt-BR"));
  const padrao = classe === "insegura" && ano === anos[0];
  const textoBrasil = brasil === null ? "sem valor publicado" : `${fmt(brasil)}%`;
  const rotuloSelect = "mt-2 block min-h-[44px] w-full max-w-full border border-mineral bg-superficie px-3 text-sm text-carvao";
  return (
    <>
      <Controles rotulo="Recorte da comparação entre estados" resumo={`Mostrando ${nomeClasse.toLowerCase()}, ${ano}, 27 estados.`} limpar={padrao ? undefined : { href: `${rota}#estados` }} idioma="pt">
        <label htmlFor={`${id}-classe`} className="min-w-[14rem] max-w-full text-sm text-carvao">
          Medida
          <select id={`${id}-classe`} value={classe} onChange={(e) => definir({ classe: e.target.value as typeof classe })} className={rotuloSelect}>
            {CLASSES.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label htmlFor={`${id}-ano`} className="text-sm text-carvao">
          Ano
          <select id={`${id}-ano`} value={s.ano} onChange={(e) => definir({ ano: e.target.value })} className={rotuloSelect}>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </Controles>
      <FiguraAnalitica
        id="estados"
        idioma="pt"
        pergunta="Como a insegurança alimentar varia entre os estados?"
        subtitulo={`${nomeClasse} · % dos domicílios · 27 estados · ${ano}`}
        natureza={natureza}
        proveniencia={proveniencia}
        download={download}
        leitura={<LeituraGuiada>A linha tracejada marca o Brasil ({textoBrasil}). A ordem segue o valor e não indica diferença estatisticamente significativa entre estados vizinhos na lista.</LeituraGuiada>}
        comoInterpretar="Insegurança total soma as classes leve, moderada e grave. Barras desde zero; a escala acompanha os valores do ano e da medida escolhidos. CV: coeficiente de variação publicado pelo IBGE; quanto maior, menos precisa a estimativa amostral."
        naoConcluir="Estimativa amostral: diferenças pequenas entre estados ou anos podem estar dentro do erro amostral, e nenhuma diferença é apresentada como estatisticamente significativa. Não existe EBIA municipal nesta fonte."
        tabela={{
          titulo: `${nomeClasse} por estado, ${ano}: percentual publicado, coeficiente de variação e mil domicílios`,
          colunas: ["Estado", "Região", "% dos domicílios", "CV do percentual", "Mil domicílios"],
          linhas: ufs.map((l) => {
            const v = l.classes[classe];
            return [l.territorio, regiaoDe[l.codigo] ?? "", v.pct === null ? sem : `${fmt(v.pct)}%`, v.cv_pct === null ? sem : `${fmt(v.cv_pct)}%`, v.mil_domicilios === null ? sem : v.mil_domicilios];
          }),
          casas: [null, null, null, null, 0],
        }}
        complemento={complemento}
      >
        {contexto && <div className="t-corpo mb-6 max-w-prose2 space-y-2 text-carvao">{contexto}</div>}
        <GraficoBarras
          titulo={`${nomeClasse}, % dos domicílios por estado, ${ano}; Brasil ${textoBrasil}`}
          series={[{ id: "pct", nome: nomeClasse, pontos: ufs.map((l) => ({ x: l.codigo, rotulo: l.territorio, y: l.classes[classe].pct })) }]}
          eixoY={{ unidade: "%", zero: true, casas: 1 }}
          orientacao="horizontal"
          alturaCategoria={32}
          rotulosValor
          rotulosSaoNomes
          referencias={brasil === null ? undefined : [{ valor: brasil, rotulo: "Brasil" }]}
        />
      </FiguraAnalitica>
    </>
  );
}
