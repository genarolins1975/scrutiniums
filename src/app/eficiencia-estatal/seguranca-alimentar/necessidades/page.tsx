import type { Metadata } from "next";
import { dadosAlimentares } from "@/lib/eficiencia/alimentar/dados";
import { dadosComplementares } from "@/lib/eficiencia/alimentar/complementos";
import { NecessidadesAlimentares } from "@/components/eficiencia/alimentar/NecessidadesAlimentares";
import { EbiaPorEstado } from "@/components/eficiencia/alimentar/EbiaPorEstado";
import { ConsultaMunicipalAlimentar } from "@/components/eficiencia/alimentar/ConsultaMunicipalAlimentar";
import { CadinsanEstados, EbiaUrbanoRural, FonteDaMedida, SecaoComplementar } from "@/components/eficiencia/alimentar/Complementos";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Necessidades alimentares dos domicílios" };

export default function Necessidades() {
  const c = dadosComplementares();
  const regiaoDe = Object.fromEntries(c.ufs.map((u) => [u.codigo, u.regiao]));
  const ufs = [...c.ufs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return (
    <>
      <p className="rotulo text-obee">Necessidades da população</p>
      <h1 className="mt-3 font-serif text-4xl">Quais famílias enfrentam restrição alimentar?</h1>
      <p className="mt-4 max-w-prose2 text-sm leading-relaxed">
        A Escala Brasileira de Insegurança Alimentar (EBIA) organiza as experiências dos domicílios em segurança alimentar ou insegurança leve, moderada e grave. Esse retrato informa a necessidade social; não é uma nota de atendimento público.
      </p>
      <nav aria-label="Nesta página" className="mt-5 flex flex-wrap gap-x-5 text-sm">
        <a href="#estados" className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">Por estado</a>
        <a href="#urbano-rural" className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">Urbano e rural</a>
        <a href="#cadinsan" className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">Risco no Cadastro Único, por município</a>
      </nav>
      <NecessidadesAlimentares rows={dadosAlimentares().needs} />
      <a href="/eficiencia/seguranca-alimentar/pnad.csv" download className="mt-5 inline-flex min-h-[44px] items-center text-sm text-obee-dark underline">Baixar tabela completa · CSV ↓</a>

      <SecaoComplementar
        id="estados"
        pergunta="Como a insegurança alimentar varia entre os estados?"
        contexto={<p>Percentual de domicílios em cada classe da EBIA nos 27 estados, como publicado pelo IBGE, com o coeficiente de variação de cada estimativa. Estados menores têm amostras menores e estimativas menos precisas.</p>}
      >
        <EbiaPorEstado linhas={c.ebia.filter((e) => e.situacao === "total" && e.nivel !== "regiao")} regiaoDe={regiaoDe} />
        <FonteDaMedida c={c} fonteId="sidra-9552-percentual" ficha="san.ebia.uf.percentual" periodo="2023 e 2024" unidade="% dos domicílios particulares permanentes" csv="ebia-territorios.csv"
          ressalva="Percentual e coeficiente de variação publicados pelo IBGE, sem recálculo. A PNAD Contínua não produz EBIA por município. Nenhuma diferença entre estados ou anos é apresentada como estatisticamente significativa." />
      </SecaoComplementar>

      <SecaoComplementar
        id="urbano-rural"
        pergunta="A restrição é maior no campo ou na cidade?"
        contexto={<p>Percentual de domicílios com insegurança alimentar entre os domicílios urbanos e entre os rurais, no Brasil e nas Grandes Regiões. Cada percentual tem como base os domicílios da própria situação.</p>}
      >
        <EbiaUrbanoRural c={c} />
      </SecaoComplementar>

      <SecaoComplementar
        id="cadinsan"
        pergunta="Quantas famílias do Cadastro Único estão em risco de insegurança alimentar grave?"
        contexto={
          <>
            <p>O CadINSAN, do Ministério do Desenvolvimento e Assistência Social, aplica um modelo estatístico às famílias do Cadastro Único para estimar quais estão em risco de insegurança alimentar grave. É o único número desta área publicado para cada município.</p>
            <p className="mt-2">Não é a EBIA: mede risco estimado, e só entre famílias cadastradas com cadastro atualizado, não em toda a população.</p>
          </>
        }
      >
        <CadinsanEstados c={c} />
        <ConsultaMunicipalAlimentar tema="necessidades" ufs={ufs} />
      </SecaoComplementar>
    </>
  );
}
