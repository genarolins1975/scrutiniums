import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { CatalogoFiltro } from "@/components/energia/CatalogoFiltro";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold } from "@/lib/energia/gold";
import { carimbo } from "@/lib/energia/formato";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Dados do setor elétrico: catálogo, integração e downloads",
  description:
    "Catálogo dos dados abertos do setor elétrico (CCEE, ONS, ANEEL e outros) com o estado de integração de cada conjunto, séries para download em CSV e metadados oficiais.",
  alternates: { canonical: "/setor-eletrico/dados" },
};

export default function DadosEnergiaPage() {
  const cat = gold.catalogo();
  if (!cat) {
    return (
      <>
        <CabecalhoEnergia atual="dados" />
        <main className="mx-auto max-w-page px-6 py-14">
          <Indisponivel titulo="Catálogo indisponível" motivo="O catálogo não foi gerado nesta publicação." />
        </main>
      </>
    );
  }
  const integrados = cat.entradas.filter((e) => e.estado !== "CATALOGADO");
  return (
    <>
      <CabecalhoEnergia atual="dados" />
      <MarcaVisita secao="energia:dados" />
      <main className="mx-auto max-w-page px-6 pb-16">
        <CabecalhoModulo rotulo="Dados e metodologia" titulo="Tudo o que é público sobre o setor elétrico, e o que já está integrado">
          Catalogar é registrar que um conjunto existe, com seus metadados oficiais. Integrar é trazê-lo para o pipeline com captura, sha256,
          validação e proveniência. Só conjuntos integrados alimentam números no portal.{" "}
          <Link href="/setor-eletrico/metodologia" className="text-energia-dark underline underline-offset-4">Metodologia</Link>
        </CabecalhoModulo>

        <section aria-labelledby="estados-h" className="grid gap-px border border-linha bg-linha sm:grid-cols-3 lg:grid-cols-6">
          <h2 id="estados-h" className="sr-only">Conjuntos por estado</h2>
          {cat.estados.map((s, i) => (
            <div key={s} className="bg-superficie p-4">
              <p className="rotulo !text-[0.62rem] text-mineral">{s}</p>
              {/* contagem cumulativa: conjuntos neste estado ou em qualquer estado posterior */}
              <p className="mt-1 font-serif text-2xl tabular-nums text-carvao">
                {cat.estados.slice(i).reduce((t, e) => t + (cat.contagem[e] ?? 0), 0).toLocaleString("pt-BR")}
              </p>
              <p className="text-[0.7rem] text-mineral">neste estado ou além; exatamente neste: {(cat.contagem[s] ?? 0).toLocaleString("pt-BR")}</p>
              <p className="mt-1 text-xs leading-snug text-carvao-muted">{cat.definicoes_estado[s]}</p>
            </div>
          ))}
        </section>
        <p className="mt-3 text-xs text-mineral">
          Estados cumulativos: um conjunto utilizado em indicador passou por todos os anteriores. Metadados colhidos das APIs oficiais:{" "}
          {Object.entries(cat.portais)
            .map(([o, p]) => `${o} ${p.conjuntos} conjuntos (${p.colhido_em ? carimbo(p.colhido_em) : "sem coleta"})`)
            .join("; ")}
          .
        </p>
        {cat.portais.CCEE?.erro && <p className="mt-1 text-xs text-aviso">CCEE: {cat.portais.CCEE.erro}</p>}

        <section aria-labelledby="integrados-h" className="mt-10">
          <h2 id="integrados-h" className="font-serif text-2xl text-carvao">Integrados ao pipeline</h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {integrados.map((e) => (
              <li key={e.id}>
                <Link href={`/setor-eletrico/dados/${e.slug}`} className="flex h-full flex-col border border-linha bg-superficie p-5 hover:border-energia">
                  <span className="rotulo text-mineral">{e.orgao} · {e.estado}</span>
                  <span className="mt-2 font-serif text-lg text-carvao">{e.titulo}</span>
                  <span className="mt-1 text-sm text-carvao-muted">Usado em: {e.usado_em.join(", ")}{e.modelos.length ? ` · modelos ${e.modelos.join(", ")}` : ""}</span>
                  {e.quebras.length > 0 && <span className="mt-1 text-xs text-aviso">{e.quebras.length} mudanças metodológicas declaradas pela fonte</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="catalogo-h" className="mt-12">
          <h2 id="catalogo-h" className="font-serif text-2xl text-carvao">Catálogo completo</h2>
          <p className="mt-1 mb-4 text-sm text-carvao-muted">{cat.total} conjuntos. Filtre por órgão, tema e estado.</p>
          <CatalogoFiltro
            itens={cat.entradas.map((e) => ({
              id: e.id,
              slug: e.slug,
              orgao: e.orgao,
              titulo: e.titulo,
              url: e.url,
              tema: e.tema,
              estado: e.estado,
              formatos: e.formatos,
              modificado: e.modificado_na_fonte,
              verificado: e.metadados_verificados,
              descontinuado: e.descontinuado,
            }))}
          />
        </section>
      </main>
    </>
  );
}
