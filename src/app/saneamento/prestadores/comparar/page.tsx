import type { Metadata } from "next";
import { Cabecalho } from "@/components/saneamento/Cabecalho";
import { Abertura, Fonte, Ressalva, RessalvaAutodeclarado, Secao } from "@/components/saneamento/Editorial";
import { ComparadorPrestadores } from "@/components/saneamento/ComparadorPrestadores";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { agregado, prestadores } from "@/lib/saneamento/gold";
import { BalancoHidrico } from "@/components/saneamento/Ilustracoes";
import { capituloPorSlug } from "@/lib/saneamento/capitulos";
import { TARIFAS } from "@/lib/saneamento/tarifas";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Como os prestadores se comparam?",
  description:
    "Até quatro prestadores de água e esgoto lado a lado: perímetro, população atendida, perdas, receita e despesa por metro cúbico, investimento e balanço declarados ao SINISA 2024.",
  alternates: { canonical: "/saneamento/prestadores/comparar" },
};

export default function Pagina() {
  const cap = capituloPorSlug("prestadores/comparar")!;
  const lista = prestadores();
  const regionais = lista.filter((p) => p.abrangencia === "Regional");
  const maiores = regionais.slice(0, 4);
  const comTarifa = [...new Set(TARIFAS.map((t) => t.prestadorSinisa))].filter((id) => lista.some((p) => p.id === id)).slice(0, 4);
  const sugestoes = [
    { id: comTarifa.join(","), rotulo: "Prestadores com tabela tarifária verificada" },
    { id: maiores.map((p) => p.id).join(","), rotulo: "Quatro maiores regionais por população atendida" },
  ].filter((s) => s.id);

  return (
    <>
      <Cabecalho atual="prestadores/comparar" />
      <MarcaVisita secao="saneamento:prestadores-comparar" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          capitulo={8}
          titulo={cap.pergunta}
          texto={
            <p>
              Escolha até quatro prestadores. Cada número usa a fórmula oficial do SINISA aplicada às somas que o próprio prestador declarou em todos
              os municípios em que atua. A tabela não tem nota composta nem ordem de mérito: perímetros, contratos e territórios são diferentes.
            </p>
          }
          recorte={<>SINISA 2025, ano de referência 2024; {lista.length.toLocaleString("pt-BR")} prestadores no cadastro.</>}
          situacao={cap.situacao}
          pendencia={cap.pendencia}
        />
        <Secao id="comparador" titulo="Prestadores lado a lado">
          <ComparadorPrestadores sugestoes={sugestoes} />
          <Ressalva
            permite="Pôr lado a lado os números declarados de prestadores escolhidos, com a fórmula e o perímetro de cada um."
            naoPermite="Concluir que um prestador é mais eficiente: custo e perdas dependem de relevo, densidade, idade da rede e mananciais; balanços podem incluir outras atividades; e prestadores locais pequenos têm registros menos completos."
          />
          <RessalvaAutodeclarado>
            Na tabela, as linhas de receita, despesa, investimento, margem e endividamento levam a marca; população, perdas, consumo e estações
            são dados técnicos declarados pelo prestador, com a fórmula ao lado.
          </RessalvaAutodeclarado>
          <Fonte>Ministério das Cidades, SINISA 2025 (ano de referência 2024), planilhas por prestador e município e planilhas de balanço.</Fonte>
        </Secao>
        <Secao
          id="perdas"
          titulo="O que as perdas de água medem?"
          texto="Perder água não é uma coisa só. Parte vaza no caminho e nunca chega a ninguém; parte chega, mas não é medida nem cobrada. O balanço hídrico separa os dois casos; o SINISA publica a soma."
        >
          <BalancoHidrico perdasBrasil={agregado("BR")?.sinisa.agua.indicadores.IAG2013 ?? null} />
        </Secao>
      </main>
    </>
  );
}
