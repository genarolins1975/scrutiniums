import type { Metadata } from "next";
import { Cabecalho } from "@/components/saneamento/Cabecalho";
import { Abertura, Fonte, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { ComparadorMunicipios } from "@/components/saneamento/ComparadorMunicipios";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { municipios } from "@/lib/saneamento/gold";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Comparar municípios",
  description:
    "Até quatro municípios lado a lado: carência de água e esgoto pelo Censo 2022, atendimento e tratamento declarados ao SINISA 2024, indicadores da NR 8, investimento, prestador, regulador e plano, com link compartilhável e CSV.",
  alternates: { canonical: "/saneamento/comparar" },
};

const CAPITAIS_SUDESTE = ["3550308", "3304557", "3106200", "3205309"];
const CAPITAIS_NORDESTE = ["2927408", "2611606", "2304400", "2111300"];
const CAPITAIS_NORTE = ["1302603", "1501402", "1100205", "1600303"];

export default function Pagina() {
  const lista = municipios();
  const existe = (ids: string[]) => ids.every((id) => lista.some((m) => m.id === id));
  const sugestoes = [
    { ids: CAPITAIS_SUDESTE.join(","), rotulo: "Capitais do Sudeste" },
    { ids: CAPITAIS_NORDESTE.join(","), rotulo: "Salvador, Recife, Fortaleza e São Luís" },
    { ids: CAPITAIS_NORTE.join(","), rotulo: "Manaus, Belém, Porto Velho e Macapá" },
  ].filter((s) => existe(s.ids.split(",")));

  return (
    <>
      <Cabecalho atual="comparar" />
      <MarcaVisita secao="saneamento:comparar" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          titulo="Comparar municípios"
          texto={
            <p>
              Escolha até quatro municípios. Cada linha traz sua fonte e seu período: o Censo 2022 fala de moradores, o SINISA 2024 de população
              estimada e de volumes, e a NR 8 de domicílios. Linhas com fontes diferentes não se comparam entre si, só entre municípios.
            </p>
          }
          recorte={<>{lista.length.toLocaleString("pt-BR")} municípios do IBGE; Censo 2022 e SINISA 2025 (ano de referência 2024).</>}
        />
        <Secao id="comparador" titulo="Municípios lado a lado">
          <ComparadorMunicipios sugestoes={sugestoes} />
          <Ressalva
            permite="Ver, para os mesmos municípios, carência, atendimento declarado, tratamento, investimento e arranjo institucional, cada um com sua fonte."
            naoPermite="Ordenar municípios por desempenho de gestão: porte, renda, relevo, densidade e o tipo de contrato mudam o que cada número significa."
          />
          <Fonte>IBGE, Censos 2010 e 2022 e estimativa 2024; Ministério das Cidades, SINISA 2025 (ano de referência 2024); ANA, NR 8/2024.</Fonte>
        </Secao>
      </main>
    </>
  );
}
