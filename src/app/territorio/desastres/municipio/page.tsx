import type { Metadata } from "next";
import Link from "next/link";
import { BuscaDesastres } from "@/components/territorio/BuscaDesastres";
import { DoDesastreAoReconhecimento } from "@/components/territorio/Desastres";
import { dataBr } from "@/components/territorio/Queimadas";
import { RotuloContexto } from "@/components/layout/RotuloContexto";
import { ROTA_DESASTRES_MUNICIPIO } from "@/lib/territorio/consultaDesastres";
import { lerDesastresMunicipios } from "@/lib/territorio/desastresMunicipio";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "O meu município já teve desastre reconhecido?",
  description: "Busque o município pelo nome e veja as secas, chuvas, deslizamentos e outros desastres que a União reconheceu nele desde 2003, ano a ano, comparados com o estado, pelo Atlas Digital de Desastres no Brasil.",
  alternates: { canonical: ROTA_DESASTRES_MUNICIPIO },
};

const PAINEL = "/territorio/desastres";
const link = "underline decoration-linha underline-offset-4 hover:decoration-carvao";

/**
 * Consulta "O meu município já teve desastre reconhecido?": a busca pelo nome leva à
 * ficha do município. A série nacional, os estados e os danos humanos do país ficam no
 * painel de desastres. Rota fechada, como os painéis do observatório.
 */
export default function BuscaDesastresPagina() {
  const g = lerDesastresMunicipios();

  return (
    <main className="bg-papel">
      <section aria-labelledby="busca-desastres-titulo" className="border-b border-linha bg-marfim">
        <div className="mx-auto max-w-page px-6 pb-12 pt-10 md:pb-14 md:pt-14">
          <RotuloContexto rota={ROTA_DESASTRES_MUNICIPIO} pagina="Desastres no meu município" className="mt-8 flex flex-wrap items-center gap-x-3 text-mineral" marca={<span aria-hidden="true" className="h-[3px] w-8 bg-obee" />} />
          <h1 id="busca-desastres-titulo" className="mt-5 max-w-4xl font-serif text-[clamp(2rem,4.4vw,3.2rem)] leading-[1.1] text-carvao [text-wrap:balance]">
            O meu município já teve desastre reconhecido?
          </h1>
          <p className="mt-6 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">
            {g ? (
              <>
                Escolha o município para ver as secas, chuvas, deslizamentos e outros desastres que a União reconheceu nele de {g.periodo.inicio} a{" "}
                {g.periodo.fim}, ano a ano, a comparação com o estado e as pessoas atingidas desde {g.danosDesde}.
              </>
            ) : (
              <>A contagem por município não está nesta publicação; o total do país e dos estados segue no painel de desastres.</>
            )}
          </p>
          {g && (
            <div className="mt-8">
              <BuscaDesastres grande />
            </div>
          )}
          <p className="mt-6 max-w-prose2 border-l-2 border-obee pl-3 text-sm leading-relaxed text-carvao">
            A ficha conta registros com reconhecimento federal de situação de emergência ou estado de calamidade. Município sem registro não
            prova que não houve desastre: só entra o que a prefeitura registrou no sistema da Defesa Civil.
          </p>
          {g && (
            <p className="mt-3 text-xs leading-relaxed text-mineral">
              Sedec/MIDR, Atlas Digital de Desastres no Brasil (base extraída do S2iD). Dados capturados em {dataBr(g.capturadoEm)}.
            </p>
          )}
        </div>
      </section>

      <DoDesastreAoReconhecimento />

      <section aria-labelledby="painel-desastres-titulo" className="mx-auto max-w-page px-6 py-12">
        <h2 id="painel-desastres-titulo" className="font-serif text-2xl leading-tight text-carvao">No painel de desastres</h2>
        <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          Os reconhecimentos de cada ano no país desde 2003, por tipo, os estados e as pessoas atingidas desde 2013.
        </p>
        <p className="mt-2">
          <Link href={PAINEL} prefetch={false} className={`inline-flex min-h-[44px] items-center text-sm text-carvao ${link}`}>
            Abrir o painel de desastres
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
