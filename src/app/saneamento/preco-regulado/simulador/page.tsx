import type { Metadata } from "next";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { Fonte } from "@/components/saneamento/Editorial";
import { AmostraTarifas, FichasTabelas, SubnavPreco } from "@/components/saneamento/PrecoRegulado";
import { SimuladorComparacao, SimuladorControles, SimuladorExportacao, SimuladorFatura, SimuladorNumeros } from "@/components/saneamento/SimuladorConta";
import { FiguraAnalitica, GraficoLinhas, PaginaPainel } from "@/components/painel";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { ROTA, eixoDoCapitulo } from "@/lib/saneamento/capitulos";
import { TARIFAS, periodoConsultaTarifas } from "@/lib/saneamento/tarifas";
import { CORES_CURVA, TARIFAS_FORA_DA_CURVA, TARIFAS_NA_CURVA, curto, curvaResidencial } from "@/lib/saneamento/simulador";
import { provenienciaTarifas } from "@/lib/saneamento/proveniencia";
import { AvisoConsultaAberta } from "@/components/acesso/AvisoConsultaAberta";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Quanto pagaríamos pelo mesmo consumo? Simulador da conta de água e esgoto",
  description: "Conta mensal simulada com tabelas residenciais e sociais verificadas em atos dos reguladores: decomposição por faixa, preço médio e custo do metro cúbico seguinte.",
  alternates: { canonical: `${ROTA}/preco-regulado/simulador` },
};

/**
 * Simulador da conta de água e esgoto (capítulo 5.1) no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026), como consulta:
 * os controles são a ação da abertura, as três leituras da conta são a faixa de números, a comparação entre tabelas e a curva de 0 a
 * 40 m³ são figuras, a decomposição por faixa e as fichas dos atos ficam na fatia de tabelas, e o CSV vai para o método. O recorte
 * continua na URL (?t=, ?cat=, ?m3=, ?ad=, ?comp=), lido pelas ilhas de cliente; o cálculo não mudou.
 */
export default function Pagina() {
  const curva = curvaResidencial();
  const eixo = eixoDoCapitulo(5);
  const proveniencia = (indicador: string) =>
    provenienciaTarifas({ indicador, natureza: "CALCULADO", unidade: "R$ por mês, 1 economia", inicio: TARIFAS.map((t) => t.acessado).sort()[0], fim: TARIFAS.map((t) => t.acessado).sort().at(-1)! });
  return (
    <>
      <header>
        <CabecalhoPlataforma colecao="saneamento" destinoConta="/saneamento" />
        <NavegacaoColecao colecao="saneamento" />
      </header>
      <AvisoConsultaAberta className="ed-pagina" comConta="Os capítulos 5.2 a 5.5, o CSV com todas as tabelas e os demais capítulos do observatório" />
      <MarcaVisita secao="saneamento:preco-simulador" />
      <PaginaPainel
        rota="/saneamento/preco-regulado/simulador"
        abertura={{
          grupo: eixo?.rotulo,
          acento: "obee",
          titulo: "Quanto pagaríamos pelo mesmo consumo?",
          lead: "Escolha a tabela, a categoria e o consumo do mês. A conta é calculada com a regra do ato: parte fixa ou valor mínimo, cada metro cúbico no preço da sua faixa e o esgoto pela tabela própria ou como percentual da água.",
          acao: <SimuladorControles />,
          recorte: {
            periodo: `tabelas vigentes nas consultas de ${periodoConsultaTarifas()}`,
            universo: `${TARIFAS.length} tabelas verificadas; 1 economia, esgoto convencional`,
            unidade: "R$ por mês e R$/m³",
            fonte: "atos dos reguladores e publicações oficiais dos atos",
          },
          limite:
            "reproduzir a conta real de um imóvel sem seu perfil completo, nem comparar qualidade ou eficiência. Receita média por metro cúbico, publicada no SINISA, não é a tarifa de uma família.",
        }}
        aviso={
          <div className="mt-4">
            <AmostraTarifas />
          </div>
        }
        faixaNumeros={<SimuladorNumeros />}
        navegacaoLocal={
          <div className="mt-8">
            <SubnavPreco atual="simulador" />
          </div>
        }
        figuras={
          <>
            <FiguraAnalitica
              id="comparar"
              pergunta="Mesmo consumo, tabelas diferentes"
              subtitulo="Conta mensal por tabela verificada, água e esgoto · R$ por mês, 1 economia · consumo e categoria escolhidos"
              natureza="CALCULADO"
              comoInterpretar="Permite observar: comparar, com o mesmo consumo e a mesma categoria, quanto cada tabela cobra e como a cobrança se divide entre água, esgoto e faixas."
              naoConcluir="qualidade nem eficiência do prestador: a diferença de conta vem do ato e da vigência de cada tabela, e a conta real de um imóvel depende do seu perfil completo."
              proveniencia={proveniencia("Conta mensal simulada por tabela verificada, mesmo consumo e categoria")}
              tabela={{ naFigura: "a tabela do gráfico, logo abaixo das barras, recalculada para o consumo e a categoria escolhidos." }}
            >
              <SimuladorComparacao />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="curva"
              pergunta="Conta residencial de 0 a 40 m³"
              subtitulo="Conta residencial de água e esgoto conforme o consumo · R$ por mês · tabelas verificadas, 1 economia"
              natureza="CALCULADO"
              comoInterpretar="Os degraus são as faixas: onde a curva fica plana, o valor mínimo cobre o consumo; onde ela empina, cada metro cúbico custa mais."
              ressalva={
                TARIFAS_FORA_DA_CURVA.length > 0
                  ? `Ficam fora do gráfico de curvas, para não sobrepor a linha do mesmo prestador, as tabelas próprias de ${TARIFAS_FORA_DA_CURVA.map((x) => x.recorte ?? x.prestador).join(", ")}. Elas estão no seletor, nas barras de comparação e no CSV.`
                  : undefined
              }
              naoConcluir="a conta de um imóvel real: a curva usa a categoria residencial, 1 economia e esgoto convencional, sem tributos, multas, serviços avulsos nem taxas municipais."
              proveniencia={proveniencia("Conta residencial simulada de 0 a 40 m³ por tabela verificada")}
              tabela={{
                titulo: "Conta residencial de água e esgoto conforme o consumo, de 0 a 40 m³ (R$ por mês)",
                colunas: ["Consumo (m³)", ...TARIFAS_NA_CURVA.map(curto)],
                linhas: curva.map((p) => [p.consumo as string, ...TARIFAS_NA_CURVA.map((x) => p[x.id] as number | null)]),
                casas: [null, ...TARIFAS_NA_CURVA.map(() => 2)],
                limite: curva.length,
              }}
            >
              <GraficoLinhas
                semTabela
                titulo="Conta residencial de água e esgoto conforme o consumo, de 0 a 40 m³ (R$ por mês)"
                dados={curva}
                chaveX="consumo"
                series={TARIFAS_NA_CURVA.map((x, i) => ({ id: x.id, rotulo: curto(x), cor: CORES_CURVA[i % CORES_CURVA.length] }))}
                unidade="R$"
                casas={2}
                formatoX="texto"
                zeroNoEixo
                rotulosDiretos
              />
            </FiguraAnalitica>
          </>
        }
        tabelas={
          <>
            <SimuladorFatura />
            <Recolhido
              id="tabelas"
              nivelTitulo={2}
              titulo="As tabelas usadas, ato por ato"
              resumo="Cada tabela foi lida no ato do regulador ou na publicação oficial do ato; quando o ato traz a tabela em imagem, foi conferida com uma segunda fonte em texto."
            >
              <div className="pb-6">
                <FichasTabelas />
              </div>
            </Recolhido>
          </>
        }
        metodo={
          <>
            <Fonte>
              Atos e originais listados em cada ficha, com sha256. Nenhum ato consultado traz regra de arredondamento: cada valor é arredondado ao centavo e o total é arredondado uma só vez,
              sobre a soma sem arredondar, então a soma das parcelas pode diferir do total em R$ 0,01 (o aviso aparece junto da conta quando isso ocorre).
            </Fonte>
            <SimuladorExportacao />
          </>
        }
      />
    </>
  );
}
