"use client";
import Link from "next/link";
import { useId, useMemo } from "react";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { Controles, FaixaNumeros, FiguraAnalitica, GraficoLinhas, LeituraGuiada, NumeroIndicador, type NumeroProps } from "@/components/painel";
import { comLacunas, naturezaDe, provenienciaTrabalho, useBaseTrabalho } from "./ExploradorTrabalho";
import { BASE, formato, total, type Snapshot } from "./modelo";

/**
 * O panorama de Trabalho e renda no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): três ilhas de cliente que seguem o
 * território da URL (?ter=, o mesmo que os painéis do tema leem) e leem a base pelo ProvedorTrabalho, uma vez só no HTML: os três números
 * do território, a figura da desocupação ao longo do tempo (com o controle do território logo antes) e os percursos de leitura, que levam
 * o território escolhido aos painéis. A página do servidor (PaginaTrabalho) monta a abertura, as dimensões e o método.
 */

const DESTAQUES = ["desocupacao", "participacao", "rendimento-trabalho"] as const;

/** O território em vigor: Brasil ou uma Unidade da Federação (o panorama não desce ao município). */
function useTerritorioPanorama(dados: Snapshot) {
  const territorios = useMemo(() => dados.territorios.filter((t) => t.nivel !== "municipio"), [dados]);
  const nacional = territorios.find((t) => t.nivel === "brasil") ?? territorios[0];
  const esquema = useMemo(() => ({ ter: campo(tiposUrl.opcao(territorios.map((t) => t.id)), nacional.id) }), [territorios, nacional.id]);
  const [estado, definir] = useEstadoUrl(esquema);
  const ter = territorios.find((t) => t.id === estado.ter) ?? nacional;
  const serieDe = (id: string) =>
    dados.observacoes.filter((o) => o.indicadorId === id && o.territorioId === ter.id && o.sexo === "total" && total(o.grupo)).sort((a, b) => a.periodo.localeCompare(b.periodo));
  return { territorios, nacional, ter, estado, definir, serieDe };
}

/** A faixa: o último valor publicado de desocupação, participação e rendimento real habitual do trabalho no território. */
export function FaixaPanoramaTrabalho() {
  const dados = useBaseTrabalho();
  const { ter, serieDe } = useTerritorioPanorama(dados);
  const numeros: NumeroProps[] = DESTAQUES.flatMap((id): NumeroProps[] => {
    const med = dados.indicadores.find((i) => i.id === id);
    if (!med) return [];
    const o = serieDe(id).at(-1);
    const fonte = (dados.fontes.find((f) => f.id === med.fonteId)?.nome ?? med.fonteId).split(" · ").slice(0, 2).join(", ");
    const base = { rotulo: `${med.nome} · ${ter.nome}`, fonte, natureza: naturezaDe(med) };
    return [
      o && o.valor !== null
        ? { ...base, valor: o.valor, valorTexto: formato(o.valor, med.unidade), formato: "texto" as const, unidade: "", periodo: o.periodoNome }
        : { ...base, valor: null, motivoAusencia: "Este território não tem observação publicada para a medida.", unidade: med.unidade, periodo: o?.periodoNome ?? "Não disponível" },
    ];
  });
  return (
    <FaixaNumeros nota="Último trimestre publicado de cada medida, no território escolhido logo abaixo. Estimativas amostrais da PNAD Contínua." idioma="pt">
      {numeros.map((n, i) => (
        <NumeroIndicador key={n.rotulo} {...n} tamanho={i === 0 ? "g" : "m"} idioma="pt" />
      ))}
    </FaixaNumeros>
  );
}

/** O território (controle) e a desocupação ao longo do tempo, na figura do kit. */
export function FiguraPanoramaTrabalho({ rota }: { rota: string }) {
  const dados = useBaseTrabalho();
  const id = useId();
  const { territorios, nacional, ter, estado, definir, serieDe } = useTerritorioPanorama(dados);
  const med = dados.indicadores.find((i) => i.id === "desocupacao");
  const serie = serieDe("desocupacao");
  if (!med) return null;
  const fonte = dados.fontes.find((f) => f.id === med.fonteId);
  const lacunas = comLacunas(serie);
  const disponiveis = serie.filter((o) => o.valor !== null);
  const primeiro = disponiveis[0];
  const ult = disponiveis.at(-1);
  return (
    <>
      <Controles rotulo="Território do panorama" resumo={`Mostrando ${ter.nome}.`} limpar={ter.id === nacional.id ? undefined : { href: rota }} idioma="pt">
        <label htmlFor={`${id}-ter`} className="flex min-w-[12rem] flex-col text-sm text-carvao">
          Território do panorama
          <select id={`${id}-ter`} value={estado.ter} onChange={(e) => definir({ ter: e.target.value })} className="mt-1 block min-h-[44px] w-full border border-linha bg-superficie px-3 text-sm text-carvao">
            {territorios.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
      </Controles>
      <FiguraAnalitica
        id="desocupacao"
        idioma="pt"
        pergunta="A desocupação ao longo do tempo"
        subtitulo={`Taxa de desocupação · % · ${ter.nome} · pessoas de 14 anos ou mais na força de trabalho`}
        natureza={naturezaDe(med)}
        proveniencia={provenienciaTrabalho(dados, med, fonte, serie)}
        leitura={
          primeiro && ult && primeiro !== ult ? (
            <LeituraGuiada>
              A série disponível vai de {primeiro.periodoNome} ({formato(primeiro.valor, "%")}) a {ult.periodoNome} ({formato(ult.valor, "%")}).
            </LeituraGuiada>
          ) : undefined
        }
        comoInterpretar="Cada ponto mantém o trimestre da fonte, sem interpolação: período sem observação fica como lacuna e interrompe a linha."
        naoConcluir="Estimativas amostrais; diferenças pequenas não demonstram mudança estatisticamente significativa. A taxa descreve os moradores, não o efeito de uma política pública."
        tabela={{
          titulo: `Taxa de desocupação · pessoas de 14 anos ou mais na força de trabalho · ${ter.nome}`,
          colunas: ["Período", "Taxa · %"],
          linhas: lacunas.map((p) => [p.nome, p.valor === null ? null : formato(p.valor, "%")]),
          limite: 200,
        }}
        complemento={
          <Link href={`${BASE}/acesso-ao-trabalho?ter=${ter.id}`} className="inline-flex min-h-[44px] items-center text-sm text-obee-dark underline underline-offset-4">
            Explorar a série, exportação e comparação →
          </Link>
        }
      >
        {disponiveis.length > 1 ? (
          <GraficoLinhas
            titulo={`Taxa de desocupação · ${ter.nome}`}
            series={[{ id: "desocupacao", nome: `Taxa de desocupação · ${ter.nome}`, pontos: lacunas.map((p) => ({ x: p.nome, y: p.valor })) }]}
            eixoY={{ unidade: "%", zero: true, casas: 1 }}
            formatoX="texto"
            altura={280}
          />
        ) : (
          <p data-grafico="ponto-unico" className="t-corpo max-w-prose2 border-l-2 border-linha pl-3 text-carvao">
            {formato(ult?.valor ?? null, "%")} · {ult?.periodoNome ?? "Sem observação no território"}. Uma única referência temporal está disponível; não há uma linha de evolução.
          </p>
        )}
      </FiguraAnalitica>
    </>
  );
}

const PERCURSOS = [
  { titulo: "Oportunidades", texto: "Participar do mercado, procurar trabalho e conseguir uma ocupação são situações diferentes.", slug: "acesso-ao-trabalho", cta: "Explorar acesso ao trabalho" },
  { titulo: "Condições de trabalho", texto: "A informalidade descreve uma dimensão das condições de trabalho. Remuneração e participação completam o contexto.", slug: "qualidade-do-trabalho", cta: "Explorar informalidade" },
  { titulo: "Renda e poder de compra", texto: "Acompanhe o rendimento real habitual dos ocupados. A referência de preços e o universo acompanham a medida.", slug: "renda-do-trabalho", cta: "Explorar renda do trabalho" },
  { titulo: "Vida das famílias", texto: "Compare média e mediana da renda domiciliar por pessoa. O Censo 2022 oferece um retrato estrutural, inclusive municipal.", slug: "renda-das-familias", cta: "Explorar renda das famílias" },
];

/** "Entre pela pergunta que importa": os quatro percursos, que levam o território escolhido (?ter=) aos painéis. */
export function PercursosTrabalho() {
  const dados = useBaseTrabalho();
  const { ter } = useTerritorioPanorama(dados);
  return (
    <nav aria-labelledby="percursos-trabalho" className="mt-8">
      <h2 id="percursos-trabalho" className="t-h2 text-carvao">
        Entre pela pergunta que importa.
      </h2>
      <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">Escolha um percurso. Dentro dos painéis, território, período e população podem ser explorados e compartilhados.</p>
      <ul className="mt-2 grid gap-x-12 md:grid-cols-2">
        {PERCURSOS.map((c) => (
          <li key={c.slug} className="border-b border-linha py-4">
            <h3 className="t-h3 text-carvao">{c.titulo}</h3>
            <p className="t-meta mt-1 text-carvao-muted">{c.texto}</p>
            <Link href={`${BASE}/${c.slug}?ter=${ter.id}`} className="inline-flex min-h-[44px] items-center text-sm text-obee-dark underline underline-offset-4">
              {c.cta} →
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
