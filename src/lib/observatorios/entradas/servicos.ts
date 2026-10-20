/**
 * Entrada com conta do Observatório dos Serviços Públicos.
 *
 * Números de escala e o modelo didático "do recurso ao resultado", lidos das
 * golds da Eficiência Estatal (educação e saúde nas capitais, Judiciário,
 * segurança pública). Os estágios recursos, atendimento e resultados vêm do
 * mapa de temas da Eficiência Estatal (src/lib/eficiencia/dimensoes.ts); a
 * plataforma não estabelece relação causal entre eles nem calcula eficiência.
 */
import { DIMENSOES } from "@/lib/eficiencia/dimensoes";
import { lerPublico, num, numero } from "@/lib/perguntas/leitura";
import type { NumeroPorta } from "@/lib/perguntas/tipos";

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */

function judiciario(): any {
  return lerPublico("eficiencia", "judiciario", "snapshot.json");
}

function anoDaReferencia(j: any): string {
  return String(j.fonte.referencia).match(/\d{4}/)?.[0] ?? String(j.fonte.referencia);
}

function referenciaCapitais(arquivo: string, filtro: (r: any) => boolean): any {
  const refs = (lerPublico("eficiencia", "gold", arquivo).referencias as any[]).filter((r) => filtro(r) && typeof r.mediana === "number");
  return refs.reduce((a, b) => (b.ano > a.ano ? b : a));
}

/** Brasil no último ano em que as 27 UFs têm dado publicado, na gold do painel Segurança pública (pipeline/seguranca). */
function seguranca(id: string): { valor: number; taxa: number | null; variacao: number | null; ano: number; cobertura: number } {
  const g = lerPublico("eficiencia", "seguranca-publica", "gold", "seguranca.json");
  const br = g.series[id].BR;
  let k = g.anos.length - 1;
  while (k > 0 && br.situacao[k] !== "ok") k--;
  return { valor: br.n[k], taxa: br.taxa ? br.taxa[k] : null, variacao: br.variacao[k], ano: g.anos[k], cobertura: br.cobertura[k] };
}

const ideb = () => numero(
  { rotulo: "Ideb do 1º ao 5º ano nas escolas municipais das capitais (mediana)", unidade: "de 0 a 10", fonte: "INEP, Ideb", href: "/eficiencia-estatal/educacao-municipal-capitais" },
  () => {
    const r = referenciaCapitais("educacao_capitais.json", (x) => x.indicador === "edu.ideb.rede_municipal" && x.componente === "ideb" && x.etapa === "anos_iniciais" && x.grupo === "todas");
    return { valor: num(r.mediana, 2), periodo: String(r.ano), nota: `${r.n} capitais, de ${num(r.minimo, 1)} a ${num(r.maximo, 1)}.` };
  },
);

const saudePorHabitante = () => numero(
  { rotulo: "Despesa da prefeitura com saúde por morador (mediana das capitais)", unidade: "por habitante no ano", fonte: "Tesouro Nacional, Siconfi, e IBGE", href: "/eficiencia-estatal/saude-capitais/gastos", nota: "Só a despesa do município; não inclui o gasto da União e do estado. Valores nominais." },
  () => {
    const r = referenciaCapitais("saude_capitais.json", (x) => x.indicador === "sau.despesa.por_habitante" && x.componente === "nominal" && x.grupo === "todas");
    return { valor: `R$ ${num(r.mediana, 0)}`, periodo: `${r.ano}, ${r.n} capitais com dado` };
  },
);

const pendentes = () => numero(
  { rotulo: "Processos à espera de decisão final na Justiça", unidade: "milhões", fonte: "CNJ, Justiça em Números", href: "/eficiencia-estatal/judiciario" },
  () => {
    const j = judiciario();
    return { valor: num(j.nacional.pendentesMilhoes, 1), periodo: anoDaReferencia(j), nota: `Tempo médio de um processo pendente: ${num(j.nacional.tempoPendentes, 0)} meses.` };
  },
);

const homicidios = () => numero(
  { rotulo: "Vítimas de homicídio doloso registradas", unidade: "vítimas no ano", fonte: "Ministério da Justiça, Sinesp VDE", href: "/eficiencia-estatal/seguranca-publica", nota: "Registros das polícias estaduais consolidados pelo Sinesp." },
  () => {
    const s = seguranca("homicidio");
    const taxa = s.taxa === null ? "" : `${num(s.taxa, 1)} por 100 mil habitantes. `;
    const variacao = s.variacao === null ? "" : `Variação sobre o ano anterior: ${s.variacao > 0 ? "+" : "−"}${num(Math.abs(s.variacao), 1)}%. `;
    return { valor: num(s.valor, 0), periodo: String(s.ano), nota: `${taxa}${variacao}Registros das polícias estaduais, soma das 27 UFs.` };
  },
);

const despesaSeguranca = () => numero(
  { rotulo: "Despesa dos governos estaduais com segurança pública por habitante", unidade: "por habitante no ano", fonte: "Tesouro Nacional, Siconfi, e IBGE", href: "/eficiencia-estatal/seguranca-publica/recursos", nota: "Só o governo estadual e o do DF; não inclui a União nem os municípios. Valores nominais." },
  () => {
    const s = seguranca("despesa_habitante");
    return { valor: `R$ ${num(s.taxa as number, 0)}`, periodo: `${s.ano}, ${s.cobertura} governos estaduais` };
  },
);

/** Até quatro números de escala do tema. */
export function escalaServicos(): NumeroPorta[] {
  return [ideb(), saudePorHabitante(), pendentes(), homicidios()];
}

export type EstagioServico = { texto: string; numero: NumeroPorta | null };
export type TemaServico = { id: string; titulo: string; href: string; recursos: EstagioServico; atendimento: EstagioServico; resultados: EstagioServico };

function tema(id: string): { titulo: string; href: string; recursos: string; acesso: string; resultados: string } {
  const d = DIMENSOES.find((x) => x.id === id);
  if (!d || !d.href) throw new Error(`tema sem painel: ${id}`);
  return { titulo: d.titulo, href: d.href, recursos: d.recursos, acesso: d.acesso, resultados: d.resultados };
}

/**
 * Do recurso ao resultado, tema a tema: o que o mapa da Eficiência Estatal
 * entende por recursos, atendimento e resultados, com um número publicado em
 * cada estágio quando existe.
 */
export function recursoAoResultado(): TemaServico[] {
  const despesaJustica = numero(
    { rotulo: "Despesa do Judiciário por habitante", unidade: "por habitante", fonte: "CNJ, Justiça em Números", href: "/eficiencia-estatal/judiciario" },
    () => {
      const j = judiciario();
      return { valor: `R$ ${num(j.porHabitante.valor, 2)}`, periodo: anoDaReferencia(j), nota: `${num(j.porHabitante.pib, 1)}% do PIB.` };
    },
  );
  const tempo = numero(
    { rotulo: "Tempo médio até a baixa do processo", unidade: "meses", fonte: "CNJ, Justiça em Números", href: "/eficiencia-estatal/judiciario" },
    () => {
      const j = judiciario();
      return { valor: num(j.nacional.tempoBaixados, 0), periodo: anoDaReferencia(j), nota: "Baixa não comprova que o direito foi cumprido." };
    },
  );
  const armas = numero(
    { rotulo: "Armas de fogo apreendidas", unidade: "armas no ano", fonte: "Ministério da Justiça, Sinesp", href: "/eficiencia-estatal/seguranca-publica" },
    () => {
      const s = seguranca("armas");
      return { valor: num(s.valor, 0), periodo: String(s.ano) };
    },
  );
  const educacao = tema("educacao"), saude = tema("saude"), seg = tema("seguranca"), justica = tema("justica");
  return [
    { id: "educacao", titulo: educacao.titulo, href: educacao.href, recursos: { texto: educacao.recursos, numero: null }, atendimento: { texto: educacao.acesso, numero: null }, resultados: { texto: educacao.resultados, numero: ideb() } },
    { id: "saude", titulo: saude.titulo, href: saude.href, recursos: { texto: saude.recursos, numero: saudePorHabitante() }, atendimento: { texto: saude.acesso, numero: null }, resultados: { texto: saude.resultados, numero: null } },
    { id: "seguranca", titulo: seg.titulo, href: seg.href, recursos: { texto: seg.recursos, numero: despesaSeguranca() }, atendimento: { texto: seg.acesso, numero: armas }, resultados: { texto: seg.resultados, numero: homicidios() } },
    { id: "justica", titulo: justica.titulo, href: "/eficiencia-estatal/judiciario", recursos: { texto: justica.recursos, numero: despesaJustica }, atendimento: { texto: justica.acesso, numero: pendentes() }, resultados: { texto: justica.resultados, numero: tempo } },
  ];
}

/* eslint-enable @typescript-eslint/no-explicit-any */
