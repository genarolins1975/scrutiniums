import type { Metadata } from "next";
import { statSync } from "node:fs";
import { join } from "node:path";
import { PanoramaInterativo, SeletorCapitalPanorama } from "@/components/eficiencia/PanoramaInterativo";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { Indice } from "@/lib/eficiencia/consulta";
import { contextos } from "@/lib/eficiencia/contexto";
import { dadosPainel, goldEducacao } from "@/lib/eficiencia/dados";
import { dataBr, decimal } from "@/lib/eficiencia/formato";
import { montaPanorama } from "@/lib/eficiencia/panorama";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Educação nas capitais",
  description: "Recursos, atendimento e resultados da educação municipal nas 26 capitais estaduais, com referências para entender cada número.",
  alternates: { canonical: "/eficiencia-estatal/educacao-municipal-capitais" },
};

const ARQUIVO_GOLD = "/eficiencia/gold/educacao_capitais.json";

/** Tamanho do arquivo de dados completo, para quem decide baixar saber o que vem (lido na geração da página). */
function tamanhoDoArquivo(): string {
  try {
    return `${decimal(statSync(join(process.cwd(), "public", ARQUIVO_GOLD)).size / 1_000_000, 1)} MB`;
  } catch {
    return "tamanho não verificado";
  }
}

/** Panorama: a entrada padrão. Nenhuma capital vem selecionada; a primeira tela já traz a pergunta, os números e o gráfico. */
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
  const usados = new Set(capitulos.flatMap((c) => c.medidas.map((m) => m.indicador)));
  const fichas = Object.fromEntries(
    dados.fichas.filter((f) => usados.has(f.id)).map((f) => [f.id, { ficha: f, ctx: ctx[f.id] }]),
  );
  return (
    <div>
      <section aria-labelledby="titulo-painel" className="grid gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
        <div>
          <h1 id="titulo-painel" className="font-serif text-[2.6rem] leading-[1.05] tracking-tight text-obee-tinta md:text-[3.6rem]">
            Educação nas capitais
          </h1>
          <p className="mt-3 max-w-[40rem] font-serif text-[1.35rem] leading-snug text-obee-tinta md:text-[1.65rem]">Quanto se gasta, quem é atendido e quais resultados são observados.</p>
          <p className="mt-3 max-w-[44rem] text-[0.9375rem] leading-relaxed text-carvao-muted">
            {g.universo.capitais.length} capitais estaduais · educação municipal · dados capturados até {dataBr(g.meta.dados_capturados_ate)} · anos de referência indicados em cada indicador
          </p>
        </div>
        <div className="lg:pt-3">
          <SeletorCapitalPanorama capitais={dados.capitais.map((c) => ({ id: c.id, nome: c.nome, uf: c.uf }))} />
        </div>
      </section>
      <div className="mt-8 border-t border-linha pt-10 md:mt-10 md:pt-12">
        <PanoramaInterativo
          capitulos={capitulos}
          capitais={dados.capitais.map((c) => ({ id: c.id, nome: c.nome, uf: c.uf }))}
          fichas={fichas}
          baixar={{ href: ARQUIVO_GOLD, detalhe: `arquivo JSON com todas as observações do painel, ${tamanhoDoArquivo()}` }}
        />
      </div>
    </div>
  );
}
