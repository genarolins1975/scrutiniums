import type { Metadata } from "next";
import Link from "next/link";
import { PanoramaInterativo, SeletorCapitalPanorama } from "@/components/eficiencia/PanoramaInterativo";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { Indice } from "@/lib/eficiencia/consulta";
import { contextos } from "@/lib/eficiencia/contexto";
import { dadosPainel, goldEducacao } from "@/lib/eficiencia/dados";
import { dataBr } from "@/lib/eficiencia/formato";
import { montaPanorama } from "@/lib/eficiencia/panorama";
import { CAMINHO_METODOS, href } from "@/lib/eficiencia/visao";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Educação nas capitais",
  description: "Recursos, atendimento e resultados da educação municipal nas 26 capitais estaduais, com referências para entender cada número.",
  alternates: { canonical: "/eficiencia-estatal/educacao-municipal-capitais" },
};

/** Panorama: a entrada padrão. Nenhuma capital vem selecionada; a primeira tela já traz um número, a pergunta e a referência. */
export default function PaginaPanorama() {
  const g = goldEducacao();
  if (!g) {
    return (
      <Indisponivel
        titulo="Painel indisponível"
        motivo="A base do painel não foi encontrada nesta publicação. Nenhum número é exibido no lugar."
        faltante={["public/eficiencia/gold/educacao_capitais.json"]}
      />
    );
  }
  const dados = dadosPainel(g);
  const capitulos = montaPanorama(dados, new Indice(dados));
  const ctx = contextos(g);
  const fichas = Object.fromEntries(capitulos.map((c) => [c.id, dados.fichas.find((f) => f.id === ({ gastos: "edu.despesa.por_habitante", atendimento: "edu.atu.rede_municipal", resultados: "edu.ideb.rede_municipal" } as const)[c.id])!]));
  const contextosCap = Object.fromEntries(capitulos.map((c) => [c.id, ctx[fichas[c.id].id]]));
  const fin = g.periodos.financeiros;
  return (
    <div>
      <section aria-labelledby="titulo-painel" className="grid gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
        <div>
          <h1 id="titulo-painel" className="font-serif text-[2.4rem] leading-[1.08] text-obee-tinta md:text-[3.2rem]">
            Educação nas capitais
          </h1>
          <p className="mt-3 max-w-[38rem] text-lg leading-relaxed text-obee-tinta">Recursos, atendimento e resultados da educação municipal, com referências para entender cada número.</p>
          <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            {g.universo.capitais.length} capitais estaduais, rede municipal · despesa de {fin[0]} a {fin[fin.length - 1]} · dados até {dataBr(g.meta.dados_capturados_ate)} ·{" "}
            <Link href={href(CAMINHO_METODOS)} className="text-obee-dark underline underline-offset-4">
              fontes e método
            </Link>
          </p>
        </div>
        <SeletorCapitalPanorama capitais={dados.capitais.map((c) => ({ id: c.id, nome: c.nome, uf: c.uf }))} />
      </section>
      <div className="mt-8 border-t border-linha pt-8 md:mt-10 md:pt-10">
        <PanoramaInterativo
          capitulos={capitulos}
          capitais={dados.capitais.map((c) => ({ id: c.id, nome: c.nome, uf: c.uf }))}
          fichas={fichas}
          contextos={contextosCap}
        />
      </div>
    </div>
  );
}
