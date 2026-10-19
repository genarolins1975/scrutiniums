import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho } from "@/components/saneamento/Cabecalho";
import { Abertura } from "@/components/saneamento/Editorial";
import { BuscaMunicipio } from "@/components/saneamento/BuscaMunicipio";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { meta, municipios } from "@/lib/saneamento/gold";
import { ROTA } from "@/lib/saneamento/capitulos";
import { inteiro } from "@/lib/saneamento/formato";
import { AvisoConsultaAberta } from "@/components/acesso/AvisoConsultaAberta";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Meu município: água, esgoto, prestador e metas",
  description: "Busque o município pelo nome e veja carência, prestador, regulador, plano, investimento e comparação com a UF e com municípios semelhantes.",
  alternates: { canonical: `${ROTA}/municipio` },
};

const CAPITAIS = ["1200401", "2704302", "1600303", "1302603", "2927408", "2304400", "5300108", "3205309", "5208707", "2111300", "5103403", "5002704", "3106200", "1501402", "2507507", "4106902", "2611606", "2211001", "3304557", "2408102", "4314902", "1100205", "1400100", "4205407", "3550308", "2800308", "1721000"];

export default function Pagina() {
  const m = meta();
  const lista = municipios();
  const capitais = CAPITAIS.map((id) => lista.find((x) => x.id === id)).filter(Boolean).sort((a, b) => a!.nome.localeCompare(b!.nome, "pt-BR"));
  return (
    <>
      <Cabecalho atual="municipio" />
      <AvisoConsultaAberta className="ed-pagina" comConta="A comparação entre municípios, o atlas, as fichas dos prestadores e os demais capítulos do observatório" />
      <MarcaVisita secao="saneamento:municipio-busca" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          rotuloExtra="Meu município"
          titulo="Como está o saneamento no meu município?"
          texto={<p>Uma ficha por município reúne carência, atendimento declarado, prestador e regulador, tarifa social, plano, investimento e continuidade, cada número com sua fonte e seu ano.</p>}
          recorte={<>{inteiro(m?.cobertura.municipios_ibge)} municípios no índice do IBGE; Censo 2022, SINISA 2024 e módulo Gestão Municipal, quando o município participou.</>}
        />
        <BuscaMunicipio grande rotulo="Digite o nome do município" />
        <section aria-labelledby="capitais" className="mt-12">
          <h2 id="capitais" className="rotulo text-mineral">Capitais</h2>
          <ul className="mt-3 grid grid-cols-1 gap-x-6 sm:grid-cols-3 lg:grid-cols-5">
            {capitais.map((c) => (
              <li key={c!.id} className="border-t border-linha">
                <Link href={`${ROTA}/municipio/${c!.id}`} className="flex min-h-[44px] items-center justify-between text-sm text-carvao hover:text-obee-dark">
                  {c!.nome} <span className="text-carvao-muted">{c!.uf}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
