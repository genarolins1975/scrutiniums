import type { Metadata } from "next";
import Link from "next/link";
import { AvisoConsultaAberta } from "@/components/acesso/AvisoConsultaAberta";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { BuscaFocos } from "@/components/territorio/BuscaFocos";
import { DoSateliteAoFoco, dataBr, mesAno } from "@/components/territorio/Queimadas";
import { leva2Aprovada, prefetchDoLink } from "@/lib/rotasPublicas";
import { ROTA_FOCOS_MUNICIPIO } from "@/lib/territorio/consultaFocos";
import { lerQueimadasMunicipios } from "@/lib/territorio/queimadas";
import { RotuloContexto } from "@/components/layout/RotuloContexto";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Teve fogo perto de mim?",
  description: "Busque o município pelo nome e veja os focos de calor detectados pelo satélite de referência do INPE no último ano completo e no ano em curso, por área e comparados com o estado.",
  alternates: { canonical: ROTA_FOCOS_MUNICIPIO },
};

const PAINEL = "/territorio/queimadas";
const link = "underline decoration-linha underline-offset-4 hover:decoration-carvao";

/**
 * Consulta "Teve fogo perto de mim?" (leva 2 da estratégia "aberto e com conta",
 * item teve-fogo-perto-de-mim de src/lib/rotasPublicas.ts). Modo de consulta: a
 * busca pelo nome leva à ficha do município. A série desde 2003, os estados, os
 * biomas, os rankings e o arquivo completo ficam no painel de queimadas.
 * Enquanto o dono não aprova, a rota é fechada como os painéis e a faixa de
 * consulta aberta não aparece.
 */
export default function BuscaFocosPagina() {
  const aberta = leva2Aprovada("teve-fogo-perto-de-mim");
  const g = lerQueimadasMunicipios();
  const ano = g?.periodos.ultimoAnoCompleto ? Number(g.periodos.ultimoAnoCompleto.periodo.inicio.slice(0, 4)) : null;
  const corrente = g?.periodos.acumuladoAnoCorrente?.periodo;

  return (
    <main className="bg-papel">
      {aberta && (
        <AvisoConsultaAberta
          className="mx-auto max-w-page px-6"
          comConta="A série desde 2003, os estados e biomas, os rankings de municípios e o arquivo completo"
        />
      )}
      <section aria-labelledby="busca-focos-titulo" className="border-b border-linha bg-marfim">
        <div className="mx-auto max-w-page px-6 pb-12 pt-10 md:pb-14 md:pt-14">
          <RotuloContexto rota="/territorio/queimadas/municipio" pagina="Fogo no meu município" className="mt-8 flex flex-wrap items-center gap-x-3 text-mineral" marca={<span aria-hidden="true" className="h-[3px] w-8 bg-obee" />} />
          <h1 id="busca-focos-titulo" className="mt-5 max-w-4xl font-serif text-[clamp(2rem,4.4vw,3.2rem)] leading-[1.1] text-carvao [text-wrap:balance]">
            Teve fogo perto de mim?
          </h1>
          <p className="mt-6 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">
            {ano ? (
              <>
                Escolha o município para ver os focos de calor de {ano}
                {corrente ? <> e de {mesAno(corrente.inicio)} a {mesAno(corrente.fim)}</> : null}, os focos por área e a comparação com o
                estado, pelo satélite de referência do INPE.
              </>
            ) : (
              <>A contagem por município não está nesta publicação.</>
            )}
          </p>
          {ano && (
            <div className="mt-8">
              <BuscaFocos grande />
            </div>
          )}
          <p className="mt-6 max-w-prose2 border-l-2 border-obee pl-3 text-sm leading-relaxed text-carvao">
            Foco de calor não é incêndio nem área queimada: é um pixel de cerca de 1 km com fogo ativo na passagem do satélite. Zero
            focos não prova que não houve fogo.
          </p>
          {g && (
            <p className="mt-3 text-xs leading-relaxed text-mineral">
              INPE, Programa Queimadas, satélite de referência {g.sateliteReferencia}. Dados capturados em {dataBr(g.capturadoEm)}.
            </p>
          )}
        </div>
      </section>

      <DoSateliteAoFoco
        introducao={
          <>
            A ficha do município conta focos: pixels com fogo ativo vistos pelo satélite de referência do INPE. O esquema mostra por que
            foco não é área queimada nem número de incêndios. É uma ilustração, sem escala nem dado real.
          </>
        }
      />

      <section aria-labelledby="painel-focos-titulo" className="mx-auto max-w-page px-6 py-12">
        <h2 id="painel-focos-titulo" className="font-serif text-2xl leading-tight text-carvao">No painel de queimadas</h2>
        <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          A série anual desde 2003, o mês a mês, os estados e os biomas, os municípios com mais focos e com mais focos por área, e a área
          queimada mapeada.
        </p>
        <p className="mt-2">
          <Link href={PAINEL} prefetch={prefetchDoLink(PAINEL)} className={`inline-flex min-h-[44px] items-center text-sm text-carvao ${link}`}>
            Abrir o painel de queimadas<SeloComConta href={PAINEL} />
          </Link>
        </p>
        <details className="mt-8 border-t border-linha pt-4">
          <summary className="rotulo flex min-h-[44px] cursor-pointer items-center text-carvao-muted hover:text-carvao">Método, fontes e ressalvas</summary>
          <ul className="mt-3 max-w-prose2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-carvao-muted">
            {(g?.ressalvas ?? []).map((r) => <li key={r}>{r}</li>)}
          </ul>
          <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            A busca é só pelo nome, sem localização automática. O método completo do observatório está em{" "}
            <Link href="/territorio/metodologia" className={link}>Território e Clima: método</Link>.
          </p>
        </details>
      </section>
    </main>
  );
}
