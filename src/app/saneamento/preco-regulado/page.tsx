import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho } from "@/components/saneamento/Cabecalho";
import { Abertura, Fonte, Nota, Secao } from "@/components/saneamento/Editorial";
import { AmostraTarifas, SubnavPreco } from "@/components/saneamento/PrecoRegulado";
import { LabReceitaTarifa } from "@/components/saneamento/Laboratorios";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { ROTA, capituloPorSlug } from "@/lib/saneamento/capitulos";
import { TARIFAS, periodoConsultaTarifas } from "@/lib/saneamento/tarifas";
import { calcularConta } from "@/lib/saneamento/conta";
import { ESTUDOS } from "@/lib/saneamento/dados/estudos";
import atos from "@/lib/saneamento/dados/atos.json";
import { reais } from "@/lib/saneamento/formato";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Preço regulado: o que pagamos, por que foi autorizado e o que ele financia",
  description:
    "Simulador com tabelas verificadas, formação da tarifa pelo regulador em dois modelos, reajustes, contrapartidas de serviço e repartição de riscos, a partir de atos oficiais.",
  alternates: { canonical: `${ROTA}/preco-regulado` },
};

const PASSOS = [
  { n: "1", titulo: "O regulador decide a receita", texto: "Reconhece custos, investimentos e a remuneração do capital; rejeita o que não aceita. Em contrato, segue regras fixadas antes.", href: "formacao" },
  { n: "2", titulo: "A receita vira tarifa média", texto: "Receita requerida dividida pelo volume faturado: R$ por metro cúbico.", href: "formacao" },
  { n: "3", titulo: "A estrutura reparte a média", texto: "Categorias, faixas de consumo, parte fixa ou consumo mínimo e tarifa social distribuem a média entre os usuários.", href: "simulador" },
  { n: "4", titulo: "A estrutura vira a sua conta", texto: "Seu consumo, categoria e tipo de esgoto definem o valor; reajustes mudam a tabela a cada ano.", href: "simulador" },
];

/** Escolhas documentadas de cada regulador da amostra, sem ranking. */
const REGULADORES = [
  {
    sigla: "ARSESP",
    prestador: "SABESP (URAE-1)",
    modelo: "Contratual: tarifa de equilíbrio anual por blocos de custo; parâmetros fixados no contrato",
    estrutura: "Consumo mínimo de 10 m³; esgoto igual à água na Tabela 1; 10 tabelas regionais",
    social: "Social II com 50% até 15 m³ (Deliberação 1.699/2025), além das categorias Social e Vulnerável",
    documentos: "Notas técnicas e planilha de cálculo publicadas e acessadas",
  },
  {
    sigla: "AGEPAR",
    prestador: "SANEPAR",
    modelo: "Discricionário: revisão periódica por fluxo de caixa descontado (preço-teto) e reajustes anuais",
    estrutura: "Valor da primeira faixa até 5 m³; esgoto a 85% (Curitiba) ou 80% da fatura de água",
    social: "50% sobre a primeira faixa e preço por m³ estendido até 15 m³ (Resolução 36/2025); programa estadual Água Solidária mantido, com tabela própria e esgoto a 50% da água (Resolução 23/2026)",
    documentos: "Resoluções no portal oficial; nota técnica acessada em cópia assinada publicada pela Sanepar",
  },
  {
    sigla: "ARSAE-MG",
    prestador: "COPASA",
    modelo: "Discricionário: revisão periódica (3ª, ciclo 2026-2029) e reajustes anuais",
    estrutura: "Tarifa fixa e faixas sem consumo mínimo; esgoto dinâmico com tabela própria",
    social: "Social I e II com desconto em todo o consumo (Resoluções 150/2021 e 199/2024)",
    documentos: "Site do regulador inacessível a este ambiente; ato lido no Diário Oficial",
  },
  {
    sigla: "ARPE",
    prestador: "COMPESA",
    modelo: "Reajustes e revisão extraordinária por resolução",
    estrutura: "Valor fixo até 10 m³ e faixas progressivas; esgoto convencional a 100% da água",
    social: "Tarifa Social Pernambucana: R$ 27,50 cobrindo 15 m³ (Resoluções 289 e 292/2025)",
    documentos: "Resoluções e estrutura tarifária publicadas e acessadas; nota técnica não baixada",
  },
  {
    sigla: "ADASA",
    prestador: "CAESB",
    modelo: "Reajuste tarifário anual por resolução",
    estrutura: "Tarifa fixa por unidade e seis faixas; sem consumo mínimo desde 2019",
    social: "50% até 30 m³ (Resolução 14/2011, art. 101, II)",
    documentos: "Resolução publicada e acessada; Diário Oficial do DF inacessível",
  },
  {
    sigla: "AGR, AR, AMAE e ARM",
    prestador: "SANEAGO (GO)",
    modelo: "Reajuste anual por índice, em resolução conjunta da AGR com as agências de Goiânia, de Rio Verde e de Anápolis; revisão periódica com tarifa máxima (P0) e Fator X na última lida, de Goiânia (2021)",
    estrutura: "Tarifa básica por economia somada à conta; faixas de consumo sem consumo mínimo; esgoto em coleta (80%) e tratamento (20%) da água",
    social: "Tabela própria até 20 m³, cerca de 53% abaixo da residencial normal, e básica pela metade (Resolução Conjunta 1/2026)",
    documentos: "Resoluções no site da Saneago e da AGR lidas; Nota Técnica Conjunta 12/2021 (Goiânia) lida; Nota Técnica Conjunta 1/2026 não localizada",
  },
  {
    sigla: "ARESC, ARIS, AGIR e CISAM-SUL",
    prestador: "CASAN (SC)",
    modelo: "Reajuste anual pelo IPCA acumulado, por resolução da ARESC com nota técnica; revisão periódica por resolução própria (Resolução ARESC 281/2024, não lida)",
    estrutura: "TFDI por economia e quatro faixas sem consumo mínimo; esgoto a 100% do faturamento de água, inclusive a TFDI; planilha oficial de cálculo publicada",
    social: "Lei 14.898/2024: metade da residencial na TFDI e até 15 m³; tabela social anterior só para solicitações até 10/12/2024",
    documentos: "Resoluções ARESC 321/2025 e 389/2026, tabela e duas planilhas da CASAN lidas; notas técnicas e atos de ARIS, AGIR e CISAM-SUL não lidos",
  },
  {
    sigla: "AGERGS, AGESAN e outras agências",
    prestador: "CORSAN (RS)",
    modelo: "Revisão extraordinária de 5,76% em julho de 2026 (RED 892/2026, não lida) sobre o reajuste de 4,68% de janeiro; revisão periódica prevista para 2027",
    estrutura: "Serviço básico por economia mais água pelo preço-base vezes o consumo elevado a um expoente por faixa, sem mínimo na ligação com hidrômetro; esgoto a 70% do preço-base por m³ (50% só com coleta). Tabelas próprias em Canoas e Esteio, Santa Cruz do Sul e Erechim",
    social: "Categoria da Lei 14.898/2024 (desconto a partir das faturas de agosto de 2026), simulada até 15 m³ nas tabelas de julho de 2026; a mínima publicada é metade da Residencial B e difere em centavos de serviço básico mais 10 m³ aos preços impressos; Erechim não tem a linha na tabela de janeiro de 2026",
    documentos: "Tabelas de 2025 e 2026 (298 municípios, AGESAN, Canoas e Esteio, Santa Cruz do Sul e Erechim), Tabela de Exponenciais, comunicados da Corsan e Regulamento da AGERGS (2008) lidos; resoluções da AGERGS, da AGESAN e da agência de Santa Cruz do Sul não localizadas ou não lidas",
  },
];

export default function Pagina() {
  const cap = capituloPorSlug("preco-regulado")!;
  const contas10 = TARIFAS.map((t) => ({ t, v: calcularConta(t.categorias.residencial, 10).total })).sort((a, b) => a.v - b.v);
  const lista = (atos as { atos: { verificado: boolean }[] }).atos;
  return (
    <>
      <Cabecalho atual="preco-regulado" />
      <MarcaVisita secao="saneamento:preco-regulado" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          capitulo={5}
          titulo={cap.pergunta}
          texto={
            <p>
              A conta de água e esgoto não é um preço livre: um regulador autoriza a receita do prestador e a forma de cobrá-la. Este capítulo segue
              o caminho da decisão até a conta e mostra o que cada decisão financia, quem a pediu, quem a aprovou e quem assume os riscos. A ANA
              edita normas de referência; ela não fixa as tarifas locais.
            </p>
          }
          recorte={
            <>
              {TARIFAS.length} tabelas verificadas, 2 estudos completos de formação de tarifa (ARSESP e AGEPAR) e {lista.length} atos tarifários de
              2023 a 2026, {lista.filter((a) => a.verificado).length} lidos no texto oficial. Consultas em {periodoConsultaTarifas()}.
            </>
          }
          situacao={cap.situacao}
          pendencia={cap.pendencia}
        />
        <SubnavPreco atual="" />
        <AmostraTarifas />

        <Secao id="caminho" titulo="Como uma decisão do regulador chega à sua conta">
          <ol className="grid grid-cols-1 gap-x-8 md:grid-cols-4">
            {PASSOS.map((p) => (
              <li key={p.n} className="border-t-2 border-obee pt-3">
                <span className="font-label text-xs text-mineral">{p.n}</span>
                <Link href={`${ROTA}/preco-regulado/${p.href}`} className="mt-1 block font-serif text-lg leading-snug text-carvao underline decoration-linha underline-offset-4 hover:decoration-obee">
                  {p.titulo}
                </Link>
                <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{p.texto}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8">
            <LabReceitaTarifa />
          </div>
        </Secao>

        <Secao id="subpaineis" titulo="Cinco perguntas sobre o preço">
          <ul className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
            <li className="border-t border-linha py-4">
              <Link href={`${ROTA}/preco-regulado/simulador`} className="font-serif text-xl text-carvao underline decoration-linha underline-offset-4 hover:decoration-obee">
                5.1 Quanto pagaríamos pelo mesmo consumo?
              </Link>
              <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                Com 10 m³ por mês na categoria residencial, a conta de água e esgoto vai de {reais(contas10[0].v)} a{" "}
                {reais(contas10[contas10.length - 1].v)} nas {TARIFAS.length} tabelas verificadas. Atos e datas de vigência diferem; a diferença não mede
                qualidade nem eficiência.
              </p>
            </li>
            <li className="border-t border-linha py-4">
              <Link href={`${ROTA}/preco-regulado/formacao`} className="font-serif text-xl text-carvao underline decoration-linha underline-offset-4 hover:decoration-obee">
                5.2 Como o regulador chega ao valor?
              </Link>
              <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                Dois modelos reconstruídos com documentos oficiais: o contrato da Sabesp, com receita requerida de R$ 25,35 bilhões, e a revisão da
                Sanepar, que considerou R$ 6,82 bilhões dos R$ 8,15 bilhões de investimento pedidos.
              </p>
            </li>
            <li className="border-t border-linha py-4">
              <Link href={`${ROTA}/preco-regulado/reajustes`} className="font-serif text-xl text-carvao underline decoration-linha underline-offset-4 hover:decoration-obee">
                5.3 Por que a conta aumentou?
              </Link>
              <p className="mt-2 text-sm leading-relaxed text-carvao-muted">Catálogo de {lista.length} atos com tipo, pedido, decisão, vigência e documento; linha do tempo por prestador.</p>
            </li>
            <li className="border-t border-linha py-4">
              <Link href={`${ROTA}/preco-regulado/contrapartidas`} className="font-serif text-xl text-carvao underline decoration-linha underline-offset-4 hover:decoration-obee">
                5.4 O preço está associado a melhor serviço?
              </Link>
              <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                Da premissa da decisão à obrigação, ao resultado observado e à providência do regulador; preço e indicadores de serviço lado a lado, sem nota
                composta.
              </p>
            </li>
            <li className="border-t border-linha py-4">
              <Link href={`${ROTA}/preco-regulado/riscos`} className="font-serif text-xl text-carvao underline decoration-linha underline-offset-4 hover:decoration-obee">
                5.5 Quem assume os riscos e paga pelos desvios?
              </Link>
              <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                Demanda, inadimplência, energia, obras e eventos extraordinários: o que diz cada documento, sem deduzir repasse que ele não prevê.
              </p>
            </li>
            <li className="border-t border-linha py-4">
              <Link href={`${ROTA}/tarifa-social`} className="font-serif text-xl text-carvao underline decoration-linha underline-offset-4 hover:decoration-obee">
                Capítulo 6: a conta cabe no orçamento?
              </Link>
              <p className="mt-2 text-sm leading-relaxed text-carvao-muted">Regras da tarifa social e cenários de comprometimento de renda com as tabelas verificadas.</p>
            </li>
          </ul>
        </Secao>

        <Secao
          id="reguladores"
          titulo="Escolhas de cada regulador da amostra"
          texto="Comparação descritiva das escolhas documentadas. Não há ordem de mérito: modelos diferentes respondem a contratos e leis diferentes."
        >
          <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Escolhas metodológicas dos reguladores (rolável)">
            <table className="w-full min-w-[60rem] border-collapse text-sm">
              <caption className="sr-only">Modelo, estrutura tarifária, tarifa social e documentos por regulador</caption>
              <thead>
                <tr className="border-b border-carvao text-left">
                  <th scope="col" className="py-2 pr-4 font-medium">Regulador e prestador</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Modelo de regulação</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Estrutura da conta</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Tarifa social</th>
                  <th scope="col" className="py-2 font-medium">Documentos acessados</th>
                </tr>
              </thead>
              <tbody>
                {REGULADORES.map((r) => (
                  <tr key={r.sigla} className="border-b border-linha align-top">
                    <th scope="row" className="py-2 pr-4 text-left font-medium text-carvao">
                      {r.sigla}
                      <span className="block font-normal text-carvao-muted">{r.prestador}</span>
                    </th>
                    <td className="py-2 pr-4 text-carvao">{r.modelo}</td>
                    <td className="py-2 pr-4 text-carvao">{r.estrutura}</td>
                    <td className="py-2 pr-4 text-carvao">{r.social}</td>
                    <td className="py-2 text-carvao-muted">{r.documentos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Nota titulo="Normas de referência da ANA">
            A NR 6/2024 estabelece os modelos de regulação tarifária (com retificação pela Resolução ANA 238/2025), a NR 10/2024 trata da metodologia de
            reajustes e a NR 13/2025, da estrutura tarifária e da tarifa social. A adesão de cada regulador é comprovada à ANA; o Observatório não
            presume adoção local uniforme e não verificou, nesta entrega, a situação de cada entidade.
          </Nota>
          <Fonte>
            Atos e notas técnicas listados em cada subpainel; ANA, página de normas de referência (consulta em 14/10/2026). Estudos completos: {ESTUDOS.map((e) => e.regulador).join(" e ")}.
          </Fonte>
        </Secao>
      </main>
    </>
  );
}
