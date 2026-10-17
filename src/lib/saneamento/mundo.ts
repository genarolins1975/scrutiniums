import type { PaisOds, PontoOds, SerieOds } from "./tipos";
import { numero } from "./formato";

/**
 * Referências mundiais por capítulo, a partir da base global dos ODS da ONU (gold ods.json). Cada série traz o
 * Brasil, o mundo e a América Latina e Caribe no mesmo ano, e os países com valor nesse ano. Os rótulos em
 * português são tradução livre da descrição da ONU, que vai junto na ficha. A nota de comparabilidade diz por
 * que a medida mundial não é a mesma do capítulo; nenhuma linha vira meta.
 */

export type ReferenciaMundial = {
  codigo: string;
  rotulo: string;
  unidade: string;
  casas: number;
  sufixo: string;
  /** Teto da régua; valores acima ficam na borda e são contados à parte. null: teto calculado dos dados. */
  teto: number | null;
  capitulo: string;
  comparabilidade: string;
};

export const REFERENCIAS: Record<string, ReferenciaMundial> = {
  SH_H2O_SAFE: {
    codigo: "SH_H2O_SAFE",
    rotulo: "População que usa água gerenciada com segurança",
    unidade: "% da população",
    casas: 1,
    sufixo: "%",
    teto: 100,
    capitulo: "acesso",
    comparabilidade:
      "Estimativa modelada do JMP (OMS e UNICEF): fonte melhorada, no domicílio, disponível quando necessária e sem contaminação. Não é a ligação à rede do Censo nem o atendimento declarado ao SINISA; a página Brasil no mundo concilia as três.",
  },
  SH_SAN_SAFE: {
    codigo: "SH_SAN_SAFE",
    rotulo: "População que usa esgotamento gerenciado com segurança",
    unidade: "% da população",
    casas: 1,
    sufixo: "%",
    teto: 100,
    capitulo: "acesso",
    comparabilidade:
      "Estimativa modelada do JMP: instalação não compartilhada com dejetos tratados na rede ou descartados com segurança no local. Inclui fossa esvaziada e tratada; o Censo não mede tratamento e o SINISA não mede soluções individuais.",
  },
  EN_WWT_WWDS: {
    codigo: "EN_WWT_WWDS",
    rotulo: "Esgoto doméstico tratado com segurança",
    unidade: "% do fluxo de esgoto doméstico",
    casas: 1,
    sufixo: "%",
    teto: 100,
    capitulo: "esgoto",
    comparabilidade:
      "Volume de esgoto doméstico gerado que recebe tratamento seguro, na rede ou no local. Fica mais perto do esgoto tratado sobre a água consumida (IES2003) que do tratado sobre o coletado (IES2004), mas não é nenhum dos dois: inclui soluções individuais e é estimativa da OMS.",
  },
  EN_H2O_WBAMBQ: {
    codigo: "EN_H2O_WBAMBQ",
    rotulo: "Corpos d'água com boa qualidade ambiental",
    unidade: "% dos corpos d'água avaliados",
    casas: 1,
    sufixo: "%",
    teto: 100,
    capitulo: "saude-ambiente",
    comparabilidade:
      "Cada país avalia os corpos d'água que monitora, contra metas próprias; a cobertura e o critério variam de país para país. Mede o rio, o lago e o aquífero, não a água distribuída.",
  },
  ER_H2O_STRESS: {
    codigo: "ER_H2O_STRESS",
    rotulo: "Estresse hídrico: água doce retirada em proporção da disponível",
    unidade: "% dos recursos de água doce disponíveis",
    casas: 1,
    sufixo: "%",
    teto: 100,
    capitulo: "resiliencia",
    comparabilidade:
      "Média nacional de todos os usos (agricultura, indústria e serviços). Em país grande, esconde bacias em estresse alto; não mede racionamento nem falta de água na torneira.",
  },
  ER_H2O_IWRMD: {
    codigo: "ER_H2O_IWRMD",
    rotulo: "Grau de implementação da gestão integrada de recursos hídricos",
    unidade: "pontuação de 0 a 100",
    casas: 0,
    sufixo: "",
    teto: 100,
    capitulo: "planejamento",
    comparabilidade:
      "Questionário respondido pelo próprio governo sobre leis, instituições, instrumentos e financiamento da gestão da água. Trata de recursos hídricos, não do plano de saneamento; é régua de governança, não de meta.",
  },
  DC_TOF_WASHL: {
    codigo: "DC_TOF_WASHL",
    rotulo: "Ajuda oficial ao desenvolvimento para água e saneamento, desembolso bruto recebido",
    unidade: "milhões de dólares constantes de 2024",
    casas: 1,
    sufixo: "",
    teto: null,
    capitulo: "financiamento",
    comparabilidade:
      "Recursos de doadores registrados pela OCDE, em dólares constantes de 2024. Não se soma ao investimento declarado ao SINISA, em reais correntes; serve para dar ordem de grandeza ao que vem de fora.",
  },
  SH_STA_WASHARI: {
    codigo: "SH_STA_WASHARI",
    rotulo: "Mortalidade atribuída a água, esgoto e higiene inseguros",
    unidade: "óbitos por 100 mil habitantes",
    casas: 1,
    sufixo: "",
    teto: null,
    capitulo: "saude-ambiente",
    comparabilidade:
      "Estimativa da OMS de mortes por diarreia, infecções intestinais por nematódeos, desnutrição e infecções respiratórias agudas atribuíveis a água, esgoto e higiene inseguros. Não é contagem de óbitos registrados: o capítulo conta óbitos do SIM por três grupos de doenças, com outro recorte.",
  },
};

export const NATUREZA_PT: Record<string, string> = {
  C: "dado do país",
  CA: "dado do país ajustado",
  E: "estimativa",
  G: "dado de monitoramento global",
  M: "modelado",
  N: "agregado regional",
  NA: "natureza não informada",
};

export function natureza(p: PontoOds | PaisOds | null | undefined): string | null {
  return p?.natureza ? (NATUREZA_PT[p.natureza] ?? p.natureza) : null;
}

export function formatar(ref: ReferenciaMundial, v: number | null | undefined): string {
  return v == null ? "sem valor" : `${numero(v, ref.casas)}${ref.sufixo}`;
}

const arredonda = (v: number, casas: number) => Math.round(v * 10 ** casas) / 10 ** casas;

export type PosicaoOds = { comValor: number; maior: number; igual: number; menor: number };

/**
 * Quantos países, no ano comparado, têm valor maior, igual ou menor que o do Brasil, na precisão exibida. O Brasil
 * conta como igual. Contagem neutra: maior não é melhor nem pior.
 */
export function posicao(s: SerieOds, casas: number): PosicaoOds | null {
  const b = s.brasil?.valor;
  if (b == null) return null;
  const v = arredonda(b, casas);
  const r: PosicaoOds = { comValor: 0, maior: 0, igual: 0, menor: 0 };
  for (const p of s.paises) {
    r.comValor += 1;
    const x = arredonda(p.valor, casas);
    if (x === v) r.igual += 1;
    else if (x > v) r.maior += 1;
    else r.menor += 1;
  }
  return r;
}

/** Teto da régua: o fixo da referência ou o múltiplo de 10 acima do maior valor entre países, Brasil e agregados. */
export function tetoRegua(s: SerieOds, ref: ReferenciaMundial): number {
  if (ref.teto != null) return ref.teto;
  const vals = [...s.paises.map((p) => p.valor), s.brasil?.valor, s.mundo?.valor, s.alc?.valor].filter((x): x is number => x != null);
  const max = Math.max(1, ...vals);
  const passo = max > 200 ? 100 : max > 50 ? 25 : 10;
  return Math.ceil(max / passo) * passo;
}

export const FONTE_ODS = "ONU, base global dos indicadores dos ODS";
