import type { Metadata } from "next";
import { Cabecalho } from "@/components/saneamento/Cabecalho";
import { Abertura, Fonte, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { AmostraTarifas, FichasTabelas, SubnavPreco } from "@/components/saneamento/PrecoRegulado";
import { SimuladorConta } from "@/components/saneamento/SimuladorConta";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { ROTA } from "@/lib/saneamento/capitulos";
import { TARIFAS } from "@/lib/saneamento/tarifas";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Quanto pagaríamos pelo mesmo consumo? Simulador da conta de água e esgoto",
  description: "Conta mensal simulada com tabelas residenciais e sociais verificadas em atos dos reguladores: decomposição por faixa, preço médio e custo do metro cúbico seguinte.",
  alternates: { canonical: `${ROTA}/preco-regulado/simulador` },
};

export default function Pagina() {
  return (
    <>
      <Cabecalho atual="preco-regulado/simulador" />
      <MarcaVisita secao="saneamento:preco-simulador" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          capitulo={5}
          rotuloExtra="5.1"
          titulo="Quanto pagaríamos pelo mesmo consumo?"
          texto={
            <p>
              Escolha a tabela, a categoria e o consumo do mês. A conta é calculada com a regra do ato: parte fixa ou valor mínimo, cada metro
              cúbico no preço da sua faixa e o esgoto pela tabela própria ou como percentual da água. Três leituras diferentes: a conta total, o
              preço médio efetivo e quanto custa o metro cúbico seguinte.
            </p>
          }
          recorte={<>{TARIFAS.length} tabelas verificadas; 1 economia, esgoto convencional; tabelas vigentes em 14/10/2026.</>}
        />
        <SubnavPreco atual="simulador" />
        <AmostraTarifas />
        <div className="mt-8">
          <SimuladorConta />
        </div>
        <Ressalva
          permite="Comparar, com o mesmo consumo e a mesma categoria, quanto cada tabela cobra e como a cobrança se divide entre água, esgoto e faixas."
          naoPermite="Reproduzir a conta real de um imóvel sem seu perfil completo, nem comparar qualidade ou eficiência. Receita média por metro cúbico, publicada no SINISA, não é a tarifa de uma família."
        />
        <Secao id="tabelas" titulo="As tabelas usadas, ato por ato" texto="Cada tabela foi lida no ato do regulador ou na publicação oficial do ato; quando o ato traz a tabela em imagem, foi conferida com uma segunda fonte em texto.">
          <FichasTabelas />
          <Fonte>Atos e originais listados em cada ficha, com sha256. Nenhum ato consultado traz regra de arredondamento: a conta é arredondada ao centavo só no fim.</Fonte>
        </Secao>
      </main>
    </>
  );
}
