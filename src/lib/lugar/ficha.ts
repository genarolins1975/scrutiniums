/**
 * Ficha do lugar: para um código IBGE, os números que cada coleção já publica por município, lidos pelos mesmos leitores
 * das consultas de cada tema (Saneamento, Educação, Conectividade, Previdência, Queimadas), e os quatro números do estado
 * (combustíveis, botijão, violência e contas), pelos leitores do mapa da conta. Só servidor.
 *
 * Regras: nada é calculado aqui além de escolher o campo; cada número leva fonte, período e o endereço da ficha do tema
 * no mesmo município; leitura que falha ou dado ausente vira "indisponível", nunca zero; tema sem dado por município
 * (conta de luz, custo de vida) aparece como consulta, com o motivo de não trazer número.
 */
import { mesAno, num, numero } from "@/lib/perguntas/leitura";
import type { NumeroPorta } from "@/lib/perguntas/tipos";
import { NOME_UF } from "@/lib/nomesUf";
import { municipiosIbge, fichaFocos } from "@/lib/territorio/focosMunicipio";
import { rotaFichaFocos } from "@/lib/territorio/consultaFocos";
import { meta as metaSaneamento, municipio as municipioSaneamento } from "@/lib/saneamento/gold";
import { consultarMunicipio as consultarEducacao, goldEducacao, idebRecente } from "@/lib/educacao/dados";
import { hrefFichaMunicipio as hrefEducacao } from "@/lib/educacao/paginas";
import { cobertos, consultarMunicipio as consultarConectividade, goldConectividade } from "@/lib/conectividade/dados";
import { hrefMunicipio as hrefConectividade } from "@/lib/conectividade/paginas";
import { consultarMunicipio as consultarPrevidencia, municipioNoAno } from "@/lib/previdencia/dados";
import { hrefMunicipio as hrefPrevidencia } from "@/lib/previdencia/paginas";
import { CONSULTAS } from "@/lib/perguntas/portas";
import { nomeDaColecao } from "@/lib/observatorios/lista";
import { numeroBotijaoNaUf, numeroContasNaUf, numeroTanqueNaUf, numeroViolenciaNaUf, type NumeroParaVoce } from "@/lib/observatorios/paraVoce";

export type CartaoLugar = {
  id: string;
  /** Coleção dona do número, como o leitor a vê: o nome do registro (nomeDaColecao), que mudou em quatro delas na fusão de 10/11/2026. */
  colecao: string;
  pergunta: string;
  /** O que a ficha do tema mostra a mais, em uma frase. */
  resposta: string;
  href: string;
  numero: NumeroPorta | null;
  /** Por que o cartão não traz número; obrigatório quando `numero` é null. */
  semNumero?: string;
};

export type FichaLugar =
  | { estado: "vazia" }
  | { estado: "invalida"; codigo: string | null }
  | { estado: "ok"; id: string; nome: string; uf: string; nomeUf: string; cidade: CartaoLugar[]; noEstado: CartaoLugar[]; consultas: CartaoLugar[] };

const inteiro = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
/** Dado ausente na base é falha de leitura para `numero`: o cartão sai "indisponível", nunca zero. */
function exigir<T>(v: T | null | undefined, oQue: string): T {
  if (v === null || v === undefined) throw new Error(`sem ${oQue}`);
  return v;
}

function saneamento(id: string, servico: "agua" | "esgoto"): CartaoLugar {
  const href = `/saneamento/municipio/${id}`;
  const agua = servico === "agua";
  return {
    id: `saneamento-${servico}`,
    colecao: "Saneamento",
    pergunta: agua ? "Quanta gente recebe água da rede?" : "Quanta gente tem o esgoto coletado?",
    resposta: agua
      ? "Atendimento, perdas, interrupções e qualidade da água, com o prestador e a tarifa, na ficha do município."
      : "Coleta e tratamento do esgoto, o que diz o Censo e o investimento, na ficha do município.",
    href,
    numero: numero(
      {
        rotulo: agua ? "População atendida com rede de abastecimento de água" : "População atendida com rede coletora de esgoto",
        unidade: "% da população",
        fonte: "Ministério das Cidades, SINISA",
        href,
        nota: "Informado pelo prestador do serviço ao SINISA.",
      },
      () => {
        const m = exigir(municipioSaneamento(id), "município");
        const v = exigir(agua ? m.IAG0001 : m.IES0001, "indicador");
        return { valor: num(v, 1), periodo: String(exigir(metaSaneamento(), "meta").sinisa.ano_referencia) };
      },
    ),
  };
}

function escola(id: string, etapa: "ai" | "af"): CartaoLugar {
  const href = hrefEducacao(id);
  const iniciais = etapa === "ai";
  return {
    id: `escola-${etapa}`,
    colecao: nomeDaColecao("educacao"),
    pergunta: iniciais ? "Como vão as escolas da prefeitura, do 1º ao 5º ano?" : "E do 6º ao 9º ano?",
    resposta: "O Ideb desde 2005, a meta, o aprendizado, a aprovação e o tamanho da rede, na ficha do município.",
    href,
    numero: numero(
      { rotulo: `Ideb da rede municipal, ${iniciais ? "anos iniciais" : "anos finais"}`, unidade: "de 0 a 10", fonte: "INEP, Ideb", href, nota: "Junta o aprendizado dos alunos e a aprovação." },
      () => {
        const c = consultarEducacao(id);
        if (c.estado !== "ok") throw new Error("município fora da base");
        const v = exigir(idebRecente(c.m[etapa].municipal), "Ideb");
        return { valor: num(v, 1), periodo: String(goldEducacao().ideb.ano) };
      },
    ),
  };
}

function internet(id: string, qual: "fixa" | "g5"): CartaoLugar {
  const href = hrefConectividade(id);
  const fixa = qual === "fixa";
  return {
    id: `internet-${qual}`,
    colecao: nomeDaColecao("conectividade"),
    pergunta: fixa ? "Quanta internet fixa a cidade tem?" : "O 5G chega a quem mora aqui?",
    resposta: fixa
      ? "Acessos, fibra, velocidade e empresas que atendem o município, no painel Conectividade."
      : "Cobertura 4G e 5G por moradores, domicílios e área, operadora por operadora.",
    href,
    numero: numero(
      fixa
        ? { rotulo: "Acessos de banda larga fixa", unidade: "para cada 100 habitantes", fonte: "Anatel, acessos de banda larga fixa", href }
        : { rotulo: "Moradores dentro da cobertura 5G", unidade: "% dos moradores", fonte: "Anatel, cobertura da telefonia móvel", href, nota: "Cobertura declarada pelas operadoras; não mede a qualidade do sinal." },
      () => {
        const c = consultarConectividade(id);
        if (c.estado !== "ok") throw new Error("município fora da base");
        const ref = goldConectividade().referencia;
        if (fixa) return { valor: num(exigir(exigir(c.m.fixa, "banda larga fixa").densidade, "densidade"), 1), periodo: mesAno(ref.fixa) };
        return { valor: num(exigir(cobertos(c.m, "g5"), "cobertura 5G"), 1), periodo: mesAno(ref.cobertura) };
      },
    ),
  };
}

function inss(id: string): CartaoLugar {
  const href = hrefPrevidencia(id);
  return {
    id: "inss",
    colecao: "Contas Federais",
    pergunta: "Quanto o INSS paga na cidade?",
    resposta: "Aposentadorias, pensões, auxílios e benefícios assistenciais, em quantidade e valor, ano a ano.",
    href,
    numero: numero(
      { rotulo: "Benefícios do INSS pagos no município", unidade: "benefícios", fonte: "Ministério da Previdência Social, benefícios emitidos por município", href, nota: "Benefícios emitidos em dezembro, previdenciários e assistenciais." },
      () => {
        const c = consultarPrevidencia(id);
        if (c.estado !== "ok") throw new Error("município fora da base");
        const i = c.arquivo.anos.length - 1;
        const g = exigir(municipioNoAno(c.m, i), "benefícios no ano");
        return { valor: inteiro(g.q.total), periodo: `dez/${c.arquivo.anos[i]}` };
      },
    ),
  };
}

function fogo(id: string): CartaoLugar {
  const href = rotaFichaFocos(id);
  return {
    id: "fogo",
    colecao: nomeDaColecao("fogo"),
    pergunta: "Teve fogo no município este ano?",
    resposta: "Focos de calor no ano em curso, no mesmo período do ano anterior e no último ano completo, com a posição no estado.",
    href,
    numero: numero(
      { rotulo: "Focos de calor detectados por satélite", unidade: "no acumulado do ano", fonte: "INPE, Programa Queimadas", href, nota: "Foco de calor é detecção por satélite; não é área queimada nem número de incêndios." },
      () => {
        const f = exigir(fichaFocos(id), "ficha de focos");
        if (f.semCobertura) throw new Error("sem cobertura");
        const p = exigir(f.periodos.acumuladoAnoCorrente, "período");
        return { valor: inteiro(exigir(f.focos.acumuladoAnoCorrente, "focos")), periodo: `${mesAno(p.inicio)} a ${mesAno(p.fim)}` };
      },
    ),
  };
}

const daUf = (id: string, colecao: string, pergunta: string, resposta: string, n: NumeroParaVoce): CartaoLugar => ({
  id, colecao, pergunta, resposta, href: n.origem,
  numero: { rotulo: n.rotulo, valor: n.valor, unidade: n.unidade, periodo: n.periodo, fonte: n.fonte, nota: n.nota, href: n.origem },
});

/** A ficha do lugar para o `ibge` da URL. Só código de sete dígitos de município da lista do IBGE; o resto é inválido, nunca palpite. */
export function fichaDoLugar(ibge: string | string[] | undefined): FichaLugar {
  const valor = (Array.isArray(ibge) ? ibge[0] : ibge)?.trim() ?? "";
  if (valor === "") return { estado: "vazia" };
  if (!/^\d{7}$/.test(valor)) return { estado: "invalida", codigo: null };
  const m = municipiosIbge().get(valor);
  if (!m) return { estado: "invalida", codigo: valor };
  const uf = m.uf;
  const noEstado = uf === "DF" ? "no DF" : `em ${uf}`;
  return {
    estado: "ok",
    id: valor,
    nome: m.nome,
    uf,
    nomeUf: NOME_UF[uf] ?? uf,
    cidade: [saneamento(valor, "agua"), saneamento(valor, "esgoto"), escola(valor, "ai"), escola(valor, "af"), internet(valor, "fixa"), internet(valor, "g5"), inss(valor), fogo(valor)],
    noEstado: [
      daUf("tanque-uf", nomeDaColecao("gas"), `Quanto custa a gasolina ${noEstado}?`, "Gasolina, etanol e diesel no estado, mês a mês, e a distância para a média do Brasil.", numeroTanqueNaUf(uf)),
      daUf("botijao-uf", nomeDaColecao("gas"), `Quanto custa o botijão ${noEstado}?`, "O botijão de 13 kg no estado, mês a mês, comparado com a média do Brasil.", numeroBotijaoNaUf(uf)),
      daUf("violencia-uf", "Segurança pública", `Como está a violência ${noEstado}?`, "Homicídios e outros registros por 100 mil habitantes, ao lado da taxa do Brasil.", numeroViolenciaNaUf(uf)),
      daUf("contas-uf", "Contas Estaduais", "Como estão as contas do estado?", "Execução do orçamento, receitas, despesas e dívida, como o estado declara ao Tesouro.", numeroContasNaUf(uf)),
    ],
    consultas: [
      { id: "luz", colecao: "Setor Elétrico", pergunta: CONSULTAS.luz.pergunta, resposta: CONSULTAS.luz.resumo, href: CONSULTAS.luz.href, numero: null, semNumero: "A tarifa depende da distribuidora e do consumo; a consulta encontra a distribuidora pelo nome do município." },
      { id: "custo-de-vida", colecao: "Custo de vida", pergunta: "Quanto subiu o custo de vida na região?", resposta: "A inflação do IPCA em 16 regiões metropolitanas e capitais, comparada com a do Brasil.", href: "/custo-de-vida", numero: null, semNumero: "O IBGE mede a inflação em 16 áreas, não por município." },
    ],
  };
}
