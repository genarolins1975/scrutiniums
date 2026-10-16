/**
 * Lógica pura das páginas de companhias listadas (/setor-eletrico/empresas/listadas e a ficha
 * /setor-eletrico/empresas/listadas/[papel]), sem React e testável em node
 * (src/tests/energia-listadas.test.ts).
 *
 * Nenhuma conta do pipeline é refeita: potências, retornos, razões financeiras e cadeias vêm
 * de pipeline/energia/modulos/listadas.py. Aqui ficam a seleção e a ordem das linhas, a
 * conversão de unidade de exibição (R$ para R$ milhões, índice base 1 para base 100) e as
 * frases curtas geradas por regra determinística a partir dos números publicados. Nenhuma
 * frase compara companhias por mérito: a ordem padrão é o peso no índice.
 */
import { dataBR, num, pct } from "./formato";
import type {
  Acionista,
  BolsaListada,
  CompanhiaListada,
  ListadasGold,
  LogoListada,
  ManifestoLogos,
} from "./tipos-listadas";

export const ROTA_LISTADAS = "/setor-eletrico/empresas/listadas";
export const SEM_DADO = "sem dado";

export function rotaFicha(c: Pick<CompanhiaListada, "slug">): string {
  return `${ROTA_LISTADAS}/${c.slug}`;
}

const temValor = (v: number | null | undefined): v is number => v !== null && v !== undefined && Number.isFinite(v);

/** Nome curto de exibição: o do manifesto de logos (marca usada pela própria companhia), senão o nome de pregão da B3. */
export function nomeCurto(c: CompanhiaListada, logos?: ManifestoLogos | null): string {
  const l = logos?.logos.find((x) => x.papel === c.papel);
  if (l?.nome_exibicao) return l.nome_exibicao;
  return c.nome_pregao
    .toLowerCase()
    .split(" ")
    .map((p) => (p.length <= 3 && p !== "isa" ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1)))
    .join(" ");
}

export function logoDe(logos: ManifestoLogos | null | undefined, papel: string): LogoListada | null {
  return logos?.logos.find((x) => x.papel === papel) ?? null;
}

export function mw(v: number | null | undefined, casas = 0): string {
  return temValor(v) ? `${num(v, casas)} MW` : SEM_DADO;
}

export function emMilhoesTexto(v: number | null | undefined, casas = 0): string {
  return temValor(v) ? `R$ ${num(v, casas)} milhões` : SEM_DADO;
}

/* ================================================================ atuação */

export type Segmento = "geracao" | "transmissao" | "distribuicao";
export const SEGMENTOS: readonly { id: Segmento; rotulo: string; unidade: string }[] = [
  { id: "geracao", rotulo: "Geração", unidade: "MW sob controle" },
  { id: "transmissao", rotulo: "Transmissão", unidade: "km de circuito em operação" },
  { id: "distribuicao", rotulo: "Distribuição", unidade: "unidades consumidoras" },
];

/** Medida de cada segmento por companhia, na unidade própria do segmento (nada se soma entre colunas). */
export function medidaSegmento(c: CompanhiaListada, s: Segmento): number | null {
  if (s === "geracao") return c.geracao.mw_controle || (c.atuacao.geracao ? 0 : null);
  if (s === "transmissao") return c.transmissao ? c.transmissao.km_circuito_operacao : null;
  return c.distribuicao ? c.distribuicao.unidades_consumidoras : null;
}

export type CelulaMatriz = { valor: number | null; fracao: number; texto: string };

/**
 * Matriz de atuação: uma linha por companhia (ordem do peso no IEE) e uma coluna por segmento. A barra de cada célula é a fração do
 * maior valor da MESMA coluna (escala própria por unidade); ausência do segmento é "não atua" e não vira barra zero.
 */
export function matrizAtuacao(g: ListadasGold): { papel: string; slug: string; celulas: Record<Segmento, CelulaMatriz> }[] {
  const max = Object.fromEntries(
    SEGMENTOS.map((s) => [s.id, Math.max(0, ...g.companhias.map((c) => medidaSegmento(c, s.id) ?? 0))]),
  ) as Record<Segmento, number>;
  return g.companhias.map((c) => ({
    papel: c.papel,
    slug: c.slug,
    celulas: Object.fromEntries(
      SEGMENTOS.map((s) => {
        const v = medidaSegmento(c, s.id);
        const texto =
          v === null
            ? "não atua"
            : s.id === "geracao"
              ? `${num(v, 0)} MW`
              : s.id === "transmissao"
                ? `${num(v, 0)} km`
                : `${num(v / 1e6, 2)} milhões de UCs`;
        return [s.id, { valor: v, fracao: v && max[s.id] ? v / max[s.id] : 0, texto }];
      }),
    ) as Record<Segmento, CelulaMatriz>,
  }));
}

export function contagemAtuacao(g: ListadasGold): Record<Segmento, number> {
  return {
    geracao: g.companhias.filter((c) => c.atuacao.geracao).length,
    transmissao: g.companhias.filter((c) => c.atuacao.transmissao).length,
    distribuicao: g.companhias.filter((c) => c.atuacao.distribuicao).length,
  };
}

/* ================================================================ controle */

/** Acionistas diretos identificados (sem os rótulos coletivos "outros" e "tesouraria"). */
export function acionistasIdentificados(c: CompanhiaListada): Acionista[] {
  return (c.controle.fre?.acionistas ?? []).filter((a) => a.tipo !== "coletivo");
}

/** Controladores declarados no FRE (pessoas jurídicas e fundos; pessoas físicas só em conjunto). */
export function controladoresFre(c: CompanhiaListada): Acionista[] {
  return acionistasIdentificados(c).filter((a) => a.controlador);
}

/**
 * Frase de controle, só com o que a companhia declara: controladores no FRE (com a fatia das ações ordinárias, que é a que vota),
 * pessoas físicas do grupo de controle somadas, e a falta de controlador quando nenhum é marcado.
 */
export function textoControle(c: CompanhiaListada): string {
  const fre = c.controle.fre;
  if (!fre) return "Sem Formulário de Referência lido para a companhia.";
  const ctrl = controladoresFre(c);
  const pf = fre.pessoas_fisicas;
  const partes = ctrl.map((a) => `${semPontoFinal(a.nome)} (${pct(a.pct_on, 1)} das ordinárias)`);
  if (pf && pf.controladores > 0) partes.push(`${pf.controladores} ${pf.controladores === 1 ? "pessoa física" : "pessoas físicas"} (${pct(pf.pct_on, 1)} das ordinárias, somadas)`);
  if (!partes.length) return "Nenhum acionista marcado como controlador no Formulário de Referência.";
  const acordo = ctrl.some((a) => a.acordo) ? " Há acordo de acionistas entre os controladores." : "";
  return `Controle declarado: ${partes.join("; ")}.${acordo}`;
}

/** Agrupamento pela espécie de controle que a própria companhia declara no FCA (Estatal, Privado, Estatal Holding...). */
export function porEspecieControle(g: ListadasGold): { especie: string; papeis: string[] }[] {
  const m = new Map<string, string[]>();
  for (const c of g.companhias) {
    const e = c.controle.especie_fca ?? "não declarada";
    m.set(e, [...(m.get(e) ?? []), c.papel]);
  }
  return Array.from(m.entries())
    .map(([especie, papeis]) => ({ especie, papeis }))
    .sort((a, b) => b.papeis.length - a.papeis.length || a.especie.localeCompare(b.especie, "pt-BR"));
}

export const MOTIVO_TOPO: Record<string, string> = {
  sem_controlador: "nenhum sócio controlador declarado acima",
  compartilhado: "controle compartilhado entre sócios",
  pessoa_fisica: "controlador pessoa física",
  sem_cnpj: "controlador sem CNPJ (estrangeiro ou ente sem documento)",
  sem_declaracao: "sem declaração à ANEEL na janela",
  ambigua: "declarações que discordam sobre o controlador",
  ciclo: "ciclo na cadeia declarada",
};

export type ParticipacaoCruzada = {
  /** Companhia da carteira que detém a participação. */
  de: CompanhiaListada;
  /** Companhia da carteira em que ela é acionista. */
  em: CompanhiaListada;
  pctTotal: number | null;
  pctOn: number | null;
  controlador: boolean;
  acordo: boolean;
};

/** Participações entre companhias da carteira declaradas no FRE da investida (Cemig na Taesa, AXIA na ISA Energia), pela raiz do CNPJ. */
export function participacoesCruzadas(g: ListadasGold): ParticipacaoCruzada[] {
  const porRaiz = new Map(g.companhias.filter((c) => c.cnpj).map((c) => [(c.cnpj as string).slice(0, 8), c]));
  const out: ParticipacaoCruzada[] = [];
  for (const em of g.companhias) {
    for (const a of em.controle.fre?.acionistas ?? []) {
      const de = a.cnpj ? porRaiz.get(a.cnpj.slice(0, 8)) : undefined;
      if (de && de.papel !== em.papel) out.push({ de, em, pctTotal: a.pct_total, pctOn: a.pct_on, controlador: a.controlador, acordo: a.acordo });
    }
  }
  return out;
}

/** Sem o ponto final do nome (S.A.), para a frase não terminar em dois pontos. */
export function semPontoFinal(t: string): string {
  return t.replace(/\.+$/, "");
}

/**
 * Frase de uma participação cruzada e do efeito dela nas medidas de ativos: a investida só entra nas medidas da investidora quando
 * está na cadeia de controladores únicos dela (ANEEL). Controle compartilhado ou outro controlador deixam a investida fora.
 */
export function textoCruzada(x: ParticipacaoCruzada, nome: (c: CompanhiaListada) => string): string {
  const base = `${nome(x.de)} declara ${pct(x.pctTotal, 1)} do total de ações da ${nome(x.em)} (${pct(x.pctOn, 1)} das ordinárias)${x.controlador ? ", como controladora" : ""}${x.acordo ? " em acordo de acionistas" : ""}.`;
  const naCadeia = [x.em.controle.topo_cnpj, ...x.em.controle.cadeia_acima.map((c) => c.cnpj)].includes(x.de.cnpj ?? "");
  if (naCadeia) return `${base} A ${nome(x.em)} está na cadeia de controle da ${nome(x.de)}, e os ativos dela entram nas medidas da ${nome(x.de)}.`;
  if (x.em.controle.motivo_parada === "compartilhado" && x.em.controle.topo_cnpj === x.em.cnpj)
    return `${base} O controle da ${nome(x.em)} é compartilhado, sem controlador único na cadeia declarada à ANEEL: os ativos dela não entram nas medidas da ${nome(x.de)} e aparecem só na ficha da ${nome(x.em)}.`;
  const outro = controladoresFre(x.em).filter((a) => (a.cnpj ?? "").slice(0, 8) !== (x.de.cnpj ?? "").slice(0, 8));
  return `${base} A ${nome(x.em)} tem outro controlador${outro.length ? ` (${semPontoFinal(outro.map((a) => a.nome).join(", "))})` : ""}: os ativos dela não entram nas medidas da ${nome(x.de)}.`;
}

/* ================================================================ bolsa */

/** Série mensal em base 100 no mês escolhido (ou no primeiro mês da série), para preço ajustado e retorno total. */
export function serieBase100(b: BolsaListada, inicio?: string): { m: string; preco: number; total: number }[] {
  const pts = b.mensal.filter(([m]) => !inicio || m >= inicio);
  if (!pts.length) return [];
  const [, , ip0, it0] = pts[0];
  return pts.map(([m, , ip, it]) => ({ m, preco: (100 * ip) / ip0, total: (100 * it) / it0 }));
}

/** Linhas da comparação de retornos (12 meses e desde o fim de 2020), na ordem do peso; papel sem pregão fica com ausência. */
export function linhasRetorno(g: ListadasGold): { papel: string; preco12: number | null; total12: number | null; preco20: number | null; total20: number | null; desde: string | null }[] {
  return g.companhias.map((c) => ({
    papel: c.papel,
    preco12: c.bolsa?.retorno_12m?.preco_pct ?? null,
    total12: c.bolsa?.retorno_12m?.total_pct ?? null,
    preco20: c.bolsa?.retorno_desde_2020?.preco_pct ?? null,
    total20: c.bolsa?.retorno_desde_2020?.total_pct ?? null,
    desde: c.bolsa?.retorno_desde_2020?.de ?? c.bolsa?.primeiro_pregao ?? null,
  }));
}

/** Papéis cuja série começa depois do fim de 2020 (estreia ou troca não emendada): a janela "desde 2020" deles é outra. */
export function estreiasDepoisDe2020(g: ListadasGold): CompanhiaListada[] {
  return g.companhias.filter((c) => c.bolsa && !c.bolsa.motivo && c.bolsa.primeiro_pregao > "2020-12-31");
}

/* ================================================================ frases */

/** Resposta curta do panorama, só com contagens e datas da gold. */
export function respostaPanorama(g: ListadasGold): string {
  const n = contagemAtuacao(g);
  const tres = g.companhias.filter((c) => c.atuacao.geracao && c.atuacao.transmissao && c.atuacao.distribuicao).length;
  return (
    `A carteira do Índice de Energia Elétrica da B3 de ${dataBR(g.datas.carteira_iee)} tem ${g.universo.papeis} papéis de ${g.universo.companhias} companhias. ` +
    `${n.geracao} controlam usinas em operação, ${n.transmissao} controlam linhas de transmissão e ${n.distribuicao} controlam distribuidoras; ` +
    `${tres} ${tres === 1 ? "atua" : "atuam"} nos três segmentos.`
  );
}

/** Frase de atuação da ficha. */
export function textoAtuacao(c: CompanhiaListada): string {
  const s: string[] = [];
  if (c.atuacao.geracao) s.push(`geração (${mw(c.geracao.mw_controle)} em ${num(c.geracao.usinas_controle, 0)} usinas sob controle)`);
  if (c.atuacao.transmissao && c.transmissao) s.push(`transmissão (${num(c.transmissao.km_circuito_operacao, 0)} km de circuito em ${c.transmissao.concessionarias} concessionárias)`);
  if (c.atuacao.distribuicao && c.distribuicao)
    s.push(`distribuição (${c.distribuicao.distribuidoras.length} ${c.distribuicao.distribuidoras.length === 1 ? "distribuidora" : "distribuidoras"}, ${num((c.distribuicao.unidades_consumidoras ?? 0) / 1e6, 2)} milhões de unidades consumidoras)`);
  if (!s.length) return "Nenhum ativo de geração, transmissão ou distribuição sob controle da companhia nas bases da ANEEL lidas.";
  return `Sob controle da companhia, pela cadeia declarada à ANEEL: ${s.join("; ")}.`;
}

/** Frase de desempenho em bolsa: janela, retorno de preço e retorno total, sem adjetivo. */
export function textoBolsa(b: BolsaListada | null): string {
  if (!b || b.motivo || !b.retorno_12m) return "Sem série de cotações do papel para 12 meses.";
  const r = b.retorno_12m;
  return `De ${dataBR(r.de)} a ${dataBR(r.ate)}, o preço ajustado variou ${sinalPct(r.preco_pct)} e o retorno com proventos reinvestidos foi ${sinalPct(r.total_pct)}.`;
}

export function sinalPct(v: number | null | undefined, casas = 1): string {
  if (!temValor(v)) return SEM_DADO;
  const s = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${s}${num(Math.abs(v), casas)}%`;
}
