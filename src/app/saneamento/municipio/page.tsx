import { rotuloSinisa } from "@/lib/saneamento/edicao";
import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { BuscaMunicipio } from "@/components/saneamento/BuscaMunicipio";
import { PaginaPainel } from "@/components/painel";
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

/**
 * Busca do município com sessão, no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a busca é a ação da abertura e as
 * capitais, os atalhos logo depois; a ficha de cada município (/saneamento/municipio/[id]) é outra página. Sem sessão, este endereço
 * serve o aperitivo de src/app/aperitivo/saneamento, que não muda.
 */
export default function Pagina() {
  const m = meta();
  const lista = municipios();
  const capitais = CAPITAIS.map((id) => lista.find((x) => x.id === id)).filter(Boolean).sort((a, b) => a!.nome.localeCompare(b!.nome, "pt-BR"));
  const recorte = <>{inteiro(m?.cobertura.municipios_ibge)} municípios no índice do IBGE; Censo 2022, {rotuloSinisa()} e módulo Gestão Municipal, quando o município participou.</>;
  return (
    <>
      <header>
        <CabecalhoPlataforma colecao="saneamento" destinoConta="/saneamento" />
        <NavegacaoColecao colecao="saneamento" />
      </header>
      <AvisoConsultaAberta className="ed-pagina" comConta="A comparação entre municípios, o atlas, as fichas dos prestadores e os demais capítulos do observatório" />
      <MarcaVisita secao="saneamento:municipio-busca" />
      <PaginaPainel
        rota="/saneamento/municipio"
        abertura={{
          grupo: "Meu município",
          acento: "obee",
          titulo: "Como está o saneamento no meu município?",
          lead: "Uma ficha por município reúne carência, atendimento declarado, prestador e regulador, tarifa social, plano, investimento e continuidade, cada número com sua fonte e seu ano.",
          acao: <BuscaMunicipio grande rotulo="Digite o nome do município" />,
          recorte: {
            periodo: `Censo 2022 e ${rotuloSinisa()}`,
            universo: `${inteiro(m?.cobertura.municipios_ibge)} municípios no índice do IBGE`,
            fonte: `IBGE, Censo 2022; Ministério das Cidades, ${rotuloSinisa()} e módulo Gestão Municipal`,
          },
          limite:
            "como o município se compara aos demais nem a qualidade da gestão: a ficha reúne números de bases e anos diferentes, e o SINISA só traz o município quando ele participou.",
          fontesDatasSiglas: <p>{recorte}</p>,
        }}
        navegacaoLocal={
          <nav aria-labelledby="capitais" className="mt-10">
            <h2 id="capitais" className="rotulo text-mineral">
              Capitais
            </h2>
            <ul className="mt-3 grid grid-cols-1 gap-x-6 sm:grid-cols-3 lg:grid-cols-5">
              {capitais.map((c) => (
                <li key={c!.id} className="border-t border-linha">
                  <Link href={`${ROTA}/municipio/${c!.id}`} className="flex min-h-[44px] items-center justify-between text-sm text-carvao hover:text-obee-dark">
                    {c!.nome} <span className="text-carvao-muted">{c!.uf}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        }
        metodo={
          <>
            <p>{recorte}</p>
            <p>
              Cada número da ficha traz a sua fonte e o seu ano. Método, conferências e arquivos em{" "}
              <Link className="text-obee-dark underline underline-offset-2" href={`${ROTA}/metodologia`}>
                Metodologia do Saneamento
              </Link>
              .
            </p>
          </>
        }
      />
    </>
  );
}
