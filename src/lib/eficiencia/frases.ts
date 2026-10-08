/**
 * Frases factuais do painel, geradas dos dados elegíveis do recorte em exibição. A frase descreve o que o gráfico
 * comprova: amplitude, posição frente à mediana, referência, variação entre dois períodos, cobertura. Nunca avalia
 * governo, nunca sugere meta, nunca infere causa. Ausência, empate e quebra de série têm texto próprio; ausência
 * nunca vira zero.
 *
 * Lógica pura, sem React: o mesmo texto serve ao servidor (HTML inicial), ao cliente e aos testes.
 */
import { MEDIDA, diferenca, formata, type MedidaId } from "./consulta";
import { decimal } from "./formato";
import type { EtapaId } from "./tipos";

export type ItemFrase = { nome: string; uf: string; valor: number };

const SUJEITO: Record<MedidaId, string> = {
  despesa: "A despesa total em Educação",
  despesa_hab: "A despesa em Educação por habitante",
  despesa_mat: "A razão da despesa de aplicação direta por matrícula",
  matriculas: "O número de matrículas na rede municipal",
  conveniadas: "O número de matrículas em escolas conveniadas com o município",
  atu: "A média de alunos por turma",
  aprovacao: "A taxa de aprovação",
  ideb: "O Ideb",
  saeb: "A proficiência média no Saeb",
};

/** "em 2025" ou, para as edições bienais, "na edição 2023". */
export function periodoCurto(m: MedidaId, ano: number): string {
  return MEDIDA[m].anos === "ideb" ? `na edição ${ano}` : `em ${ano}`;
}

/** Até dois nomes por extenso; acima disso, "e mais N". Empates aparecem todos até esse limite, nunca um só por acaso. */
export function listaNomes(itens: { nome: string; uf: string }[], max = 2): string {
  const nomes = itens.map((i) => `${i.nome} (${i.uf})`);
  if (nomes.length <= max) return nomes.length === 2 ? `${nomes[0]} e ${nomes[1]}` : nomes.join("");
  return `${nomes.slice(0, max).join(", ")} e mais ${nomes.length - max}`;
}

/** Etapa em linguagem natural, para a frase ("nos anos iniciais"). */
export const ETAPA_FRASE: Record<EtapaId, string> = {
  total: "em toda a educação básica",
  creche: "na creche",
  pre_escola: "na pré-escola",
  anos_iniciais: "nos anos iniciais",
  anos_finais: "nos anos finais",
  ensino_medio: "no ensino médio",
  eja: "na educação de jovens e adultos",
  profissional: "na educação profissional",
};

export type OpcoesFrase = {
  medida: MedidaId;
  ano: number;
  /** etapa em exibição; só entra na frase quando a medida é desagregada por etapa */
  etapa?: EtapaId | null;
  /** disciplina do Saeb em linguagem natural */
  disciplina?: string | null;
};

function complemento(o: OpcoesFrase): string {
  const partes: string[] = [];
  if (o.medida === "saeb" && o.disciplina) partes.push(`em ${o.disciplina}`);
  if (MEDIDA[o.medida].etapas && o.etapa) partes.push(ETAPA_FRASE[o.etapa]);
  return partes.length ? ` ${partes.join(" ")}` : "";
}

/**
 * Amplitude do grupo: "A despesa em Educação por habitante vai de R$ 702 em Belém (PA) a R$ 2.362 em Vitória (ES) entre as 26 capitais
 * com dado comparável em 2025." Com um único valor ou valores iguais, a frase diz isso; sem valor, diz que não há dado.
 */
export function fraseAmplitude(itens: ItemFrase[], o: OpcoesFrase): string {
  const suj = SUJEITO[o.medida] + complemento(o);
  const per = periodoCurto(o.medida, o.ano);
  if (!itens.length) return `Nenhuma capital tem dado comparável para esta medida ${per}.`;
  const min = Math.min(...itens.map((i) => i.valor));
  const max = Math.max(...itens.map((i) => i.valor));
  const nMin = itens.filter((i) => i.valor === min);
  const nMax = itens.filter((i) => i.valor === max);
  if (itens.length === 1) return `Só ${listaNomes(itens)} tem dado comparável ${per}: ${formata(o.medida, itens[0].valor)}.`;
  if (min === max) return `${suj} é ${formata(o.medida, min)} nas ${itens.length} capitais com dado comparável ${per}.`;
  return `${suj} vai de ${formata(o.medida, min)} em ${listaNomes(nMin)} a ${formata(o.medida, max)} em ${listaNomes(nMax)} entre as ${itens.length} capitais com dado comparável ${per}.`;
}

/** "Há dados comparáveis para 24 das 26 capitais." */
export function fraseCobertura(n: number, universo: number): string {
  if (n === 0) return `Não há dados comparáveis para nenhuma das ${universo} capitais.`;
  if (n === universo) return `Há dados comparáveis para as ${universo} capitais.`;
  return `Há dados comparáveis para ${n} das ${universo} capitais.`;
}

/**
 * Posição de uma capital frente à mediana do grupo, em valores e sem adjetivo:
 * "Recife (PE) registra R$ 1.172; a mediana das 26 capitais é R$ 1.160 (R$ 12 acima)."
 */
export function fraseCapital(nome: string, uf: string, valor: number | null, mediana: number | null, n: number, medida: MedidaId, foraDaComparacao = false): string {
  const quem = `${nome} (${uf})`;
  if (valor === null) return `${quem} não tem valor observado para esta medida neste recorte.`;
  if (foraDaComparacao) return `${quem} registra ${formata(medida, valor)}, valor fora da comparação entre capitais (o motivo está ao lado).`;
  if (mediana === null) return `${quem} registra ${formata(medida, valor)}.`;
  const d = diferenca(medida, valor, mediana);
  const dif = d ? ` (${d.abs === 0 ? "igual à mediana" : `${diferencaCurta(medida, d.abs)} ${d.abs > 0 ? "acima" : "abaixo"}`})` : "";
  return `${quem} registra ${formata(medida, valor)}; a mediana das ${n} capitais é ${formata(medida, mediana)}${dif}.`;
}

function diferencaCurta(m: MedidaId, abs: number): string {
  const a = Math.abs(abs);
  switch (m) {
    case "despesa":
      return formata(m, a);
    case "despesa_hab":
    case "despesa_mat":
      return formata(m, a);
    case "matriculas":
    case "conveniadas":
      return `${formata(m, a)} matrículas`;
    case "atu":
      return `${decimal(a, 1)} aluno${a >= 1.05 ? "s" : ""} por turma`;
    case "aprovacao":
      return `${decimal(a, 1)} ponto${a >= 1.05 ? "s" : ""} percentua${a >= 1.05 ? "is" : "l"}`;
    default:
      return `${decimal(a, m === "saeb" ? 2 : 1)} ponto${a >= 1.05 ? "s" : ""}`;
  }
}

/** Referência nacional ao lado do valor do grupo: "A referência nacional da rede municipal (INEP) é 20,9 alunos por turma." */
export function fraseReferenciaNacional(rotulo: string, medida: MedidaId, valor: number): string {
  return `${rotulo}: ${formata(medida, valor)}.`;
}

export type PontoFrase = { ano: number; valor: number | null; elegivel: boolean; quebraSerie: boolean };

/**
 * Evolução entre dois períodos: só com valores elegíveis. Quebra de série entre os dois extremos bloqueia a comparação e
 * diz por quê; anos sem dado ficam fora da conta (nunca contam como zero) e nada de "melhorou" ou "piorou".
 */
export function fraseEvolucao(pontos: PontoFrase[], medida: MedidaId, motivoQuebra = "a base do dado mudou", onde?: string): string {
  const validos = pontos.filter((p) => p.valor !== null && p.elegivel);
  if (validos.length === 0) return "Não há dado comparável para mostrar a evolução neste recorte.";
  if (validos.length === 1) return `Há dado comparável em um só período (${validos[0].ano}: ${formata(medida, validos[0].valor as number)}).`;
  const a = validos[0];
  const b = validos[validos.length - 1];
  // a regra é a da variação do painel: dois períodos de bases diferentes não se comparam; um ponto intermediário com ruptura não impede a leitura dos extremos
  const quebra = a.quebraSerie !== b.quebraSerie;
  if (quebra) {
    return `Entre ${a.ano} e ${b.ano} ${motivoQuebra}: os valores desses dois períodos não são diretamente comparáveis, e o gráfico marca a ruptura.`;
  }
  // o sujeito diz qual medida e de quem: "Em Recife (PE), a despesa em Educação por habitante passou de ..."
  const suj = SUJEITO[medida][0].toLowerCase() + SUJEITO[medida].slice(1);
  const quem = onde ? `${onde}, ` : "";
  const frase = `${quem}${suj} passou de ${formata(medida, a.valor as number)} em ${a.ano} para ${formata(medida, b.valor as number)} em ${b.ano}.`;
  return frase[0].toUpperCase() + frase.slice(1);
}
