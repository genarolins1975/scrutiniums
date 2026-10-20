import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { Footer } from "@/components/layout/Footer";
import { EntradaObservatorio } from "@/components/observatorios/EntradaObservatorio";
import { MetodoFamilias, OrcamentoFamilia } from "@/components/observatorios/OrcamentoFamilia";
import { MetodoServicos, RecursoResultado } from "@/components/observatorios/RecursoResultado";
import { ImpostoResultado, MetodoContas } from "@/components/observatorios/ImpostoResultado";
import { CadeiasInfra, MetodoEnergia } from "@/components/observatorios/CadeiasInfra";
import { CircuitoCredito, MetodoEconomia } from "@/components/observatorios/CircuitoCredito";
import { OBSERVATORIOS, observatorio, type ObservatorioId } from "@/lib/observatorios/registro";
import { colecoesDe } from "@/lib/observatorios/colecoes";
import { escalaFamilias, orcamentoFamilia } from "@/lib/observatorios/entradas/familias";
import { escalaServicos, recursoAoResultado } from "@/lib/observatorios/entradas/servicos";
import { escalaContas, fluxoImposto } from "@/lib/observatorios/entradas/contas";
import { cadeias, escalaEnergia } from "@/lib/observatorios/entradas/energia";
import { circuitoCredito, escalaEconomia } from "@/lib/observatorios/entradas/economia";
import { portas } from "@/lib/perguntas/portas";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { FRESCOR_DOS_OBSERVATORIOS } from "@/lib/frescor/entradas";
import { ParaVoce } from "@/components/observatorios/ParaVoce";
import { ehEntradaParaVoce } from "@/lib/observatorios/paraVoce";

/**
 * Entradas com conta dos seis observatórios, cada um reunindo várias
 * coleções. Rota fechada: não consta de src/lib/rotasPublicas.ts. Estática,
 * lida das golds no build. As entradas das coleções (Setor Elétrico,
 * Crédito, Contas Federais e as demais) seguem como estão. O Território e Clima
 * tem entrada própria em /territorio (src/app/territorio/page.tsx), junto dos painéis
 * e do método que ele mesmo mantém; /observatorios/territorio-e-clima redireciona
 * para ela (next.config.mjs).
 */
export const dynamic = "force-static";
export const dynamicParams = false;

/** Observatórios cuja entrada, declarada no registro (campo `entrada`), é esta rota genérica. */
const ENTRADAS = OBSERVATORIOS.filter((o) => o.entrada === `/observatorios/${o.id}`).map((o) => o.id);

export function generateStaticParams() {
  return ENTRADAS.map((id) => ({ id }));
}

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  if (!ENTRADAS.includes(params.id as ObservatorioId)) notFound();
  const o = observatorio(params.id as ObservatorioId);
  return { title: `${o.nome}: ${o.pergunta}`, robots: { index: false } };
}

/** Conteúdo próprio de cada entrada: descrição, escala, modelo didático e método. */
const CONTEUDO: Partial<Record<ObservatorioId, () => { descricao: string; escala: ReturnType<typeof escalaFamilias>; artefato: React.ReactNode; metodo: React.ReactNode }>> = {
  familias: () => ({
    descricao: "Renda, custo de vida, gastos essenciais, dívidas e proteção social das famílias brasileiras, reunidos a partir das coleções de Crédito, Eficiência Estatal, Agronegócio, Gás Natural, Setor Elétrico e Saneamento e do painel próprio de inflação por cidade. Cada número vem da fonte oficial do seu tema, com o próprio período.",
    escala: escalaFamilias(),
    artefato: <OrcamentoFamilia orcamento={orcamentoFamilia()} />,
    metodo: <MetodoFamilias />,
  }),
  "servicos-publicos": () => ({
    descricao: "Recursos, atendimento e resultados da educação, da saúde, da segurança pública, da Justiça e da cultura: o Ideb e as matrículas da escola pública de cada município, a mesma régua para cada capital e os recortes nacionais de cada fonte. Valores e referências, sem nota de eficiência nem conclusão sobre a gestão.",
    escala: escalaServicos(),
    artefato: <RecursoResultado temas={recursoAoResultado()} />,
    metodo: <MetodoServicos />,
  }),
  "contas-publicas": () => ({
    descricao: "Arrecadação, despesas e resultado do governo federal, a execução do orçamento, os benefícios do INSS e as contas dos 27 estados, a partir do Tesouro Nacional, do SIOP, do Ministério da Previdência Social e do Siconfi. Valores nominais, cada um com o período do seu demonstrativo.",
    escala: escalaContas(),
    artefato: <ImpostoResultado fluxo={fluxoImposto()} />,
    metodo: <MetodoContas />,
  }),
  "energia-e-infraestrutura": () => ({
    descricao: "Eletricidade, gás, combustíveis nos postos, água e esgoto, mobilidade e conectividade: oferta, preço e acesso, a partir do ONS, da ANEEL, da ANP, do IBGE e do SINISA. Cada número traz o período e o universo da sua fonte.",
    escala: escalaEnergia(),
    artefato: <CadeiasInfra cadeias={cadeias()} />,
    metodo: <MetodoEnergia />,
  }),
  economia: () => ({
    descricao: "Crédito, juros e inadimplência, os pagamentos e o agronegócio, a partir do Banco Central, do IBGE e do Comex Stat. Estoque e fluxo, taxa e spread aparecem separados, cada um com a série de origem.",
    escala: escalaEconomia(),
    artefato: <CircuitoCredito circuito={circuitoCredito()} />,
    metodo: <MetodoEconomia />,
  }),
};

export default function EntradaObservatorioPage({ params }: { params: { id: string } }) {
  const id = params.id as ObservatorioId;
  if (!ENTRADAS.includes(id)) notFound();
  const conteudo = CONTEUDO[id];
  if (!conteudo) notFound();
  const o = observatorio(id);
  const c = conteudo();
  const porta = portas().find((p) => p.id === id);
  return (
    <>
      <header className="grade-pagina">
        <CabecalhoPlataforma observatorio={id} destinoConta={`/observatorios/${id}`} />
      </header>
      <EntradaObservatorio
        nomeCurto={o.nomeCurto}
        nomeCompleto={o.nome}
        acento={o.acento}
        pergunta={o.pergunta}
        descricao={c.descricao}
        escala={c.escala}
        paraVoce={o.entrada && ehEntradaParaVoce(o.entrada) ? <ParaVoce entrada={o.entrada} /> : null}
        colecoes={colecoesDe(id)}
        artefato={c.artefato}
        caminhos={porta?.caminhos ?? []}
        metodo={c.metodo}
        frescor={<FaixaFrescor dominios={FRESCOR_DOS_OBSERVATORIOS[id]} conteiner="mx-auto max-w-page px-6" />}
        frescorMetodo={<FaixaFrescor dominios={FRESCOR_DOS_OBSERVATORIOS[id]} variante="metodo" />}
      />
      <Footer />
    </>
  );
}
