import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { EntradaObservatorio, type ColecaoEntrada } from "@/components/observatorios/EntradaObservatorio";
import { MetodoFamilias, OrcamentoFamilia } from "@/components/observatorios/OrcamentoFamilia";
import { MetodoServicos, RecursoResultado } from "@/components/observatorios/RecursoResultado";
import { FrentesTerritorio, MetodoTerritorio } from "@/components/observatorios/FrentesTerritorio";
import { ImpostoResultado, MetodoContas } from "@/components/observatorios/ImpostoResultado";
import { CadeiasInfra, MetodoEnergia } from "@/components/observatorios/CadeiasInfra";
import { CircuitoCredito, MetodoEconomia } from "@/components/observatorios/CircuitoCredito";
import { ATALHOS, OBSERVATORIOS, observatorio, paineis, type ObservatorioId } from "@/lib/observatorios/registro";
import { dominio } from "@/lib/dominios";
import { escalaFamilias, orcamentoFamilia } from "@/lib/observatorios/entradas/familias";
import { escalaServicos, recursoAoResultado } from "@/lib/observatorios/entradas/servicos";
import { escalaTerritorio, frentesTerritorio } from "@/lib/observatorios/entradas/territorio";
import { escalaContas, fluxoImposto } from "@/lib/observatorios/entradas/contas";
import { cadeias, escalaEnergia } from "@/lib/observatorios/entradas/energia";
import { circuitoCredito, escalaEconomia } from "@/lib/observatorios/entradas/economia";
import { portas } from "@/lib/perguntas/portas";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { FRESCOR_DOS_OBSERVATORIOS } from "@/lib/frescor/entradas";

/**
 * Entradas com conta dos seis observatórios, cada um reunindo várias
 * coleções. Rota fechada: não consta de src/lib/rotasPublicas.ts. Estática,
 * lida das golds no build. As entradas das coleções (Setor Elétrico,
 * Crédito, Contas Federais e as demais) seguem como estão.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

/** Observatórios com entrada própria, declarada no registro (campo `entrada`). */
const ENTRADAS = OBSERVATORIOS.filter((o) => o.entrada).map((o) => o.id);

export function generateStaticParams() {
  return ENTRADAS.map((id) => ({ id }));
}

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  if (!ENTRADAS.includes(params.id as ObservatorioId)) notFound();
  const o = observatorio(params.id as ObservatorioId);
  return { title: `${o.nome}: ${o.pergunta}`, robots: { index: false } };
}

/** Coleções do observatório com os painéis próprios e os atalhos, cada atalho com a coleção que o mantém. */
function colecoesDe(id: ObservatorioId): ColecaoEntrada[] {
  const todos = paineis();
  return observatorio(id).colecoes.map((c) => {
    const daColecao = todos.filter((p) => p.observatorio === id && p.colecao === c.id);
    const rotas = new Set(daColecao.map((p) => p.rota));
    // duplicata sai só quando o painel dono do tema está na mesma lista
    const proprios = daColecao.filter((p) => !(p.duplicataDe && rotas.has(p.duplicataDe))).map((p) => ({ titulo: p.titulo, href: p.rota }));
    const atalhos = ATALHOS.filter((x) => x.observatorio === id && x.colecao === c.id).flatMap((x) => {
      const dono = todos.find((p) => p.rota === x.rota);
      return dono ? [{ titulo: dono.titulo, href: dono.rota, origem: dono.origem ? dominio(dono.origem).nomeCurto : observatorio(dono.observatorio).nomeCurto }] : [];
    });
    return { id: c.id, nome: c.nome, href: c.href, paineis: [...proprios, ...atalhos] };
  });
}

/** Conteúdo próprio de cada entrada: descrição, escala, modelo didático e método. */
const CONTEUDO: Record<ObservatorioId, () => { descricao: string; escala: ReturnType<typeof escalaFamilias>; artefato: React.ReactNode; metodo: React.ReactNode }> = {
  familias: () => ({
    descricao: "Renda, gastos essenciais, dívidas e proteção social das famílias brasileiras, reunidos a partir das coleções de Crédito, Eficiência Estatal, Agronegócio, Gás Natural, Setor Elétrico e Saneamento. Cada número vem da fonte oficial do seu tema, com o próprio período.",
    escala: escalaFamilias(),
    artefato: <OrcamentoFamilia orcamento={orcamentoFamilia()} />,
    metodo: <MetodoFamilias />,
  }),
  "servicos-publicos": () => ({
    descricao: "Recursos, atendimento e resultados da educação, da saúde, da segurança pública, da Justiça e da cultura, com a mesma régua para cada capital e os recortes nacionais de cada fonte. Valores e referências, sem nota de eficiência nem conclusão sobre a gestão.",
    escala: escalaServicos(),
    artefato: <RecursoResultado temas={recursoAoResultado()} />,
    metodo: <MetodoServicos />,
  }),
  "territorio-e-clima": () => ({
    descricao: "Desmatamento e focos de calor medidos por satélite, cidades expostas a inundações e municípios onde a água falta, a partir do INPE, do Ministério das Cidades e do ONS. Cada número traz o período e o universo da sua fonte.",
    escala: escalaTerritorio(),
    artefato: <FrentesTerritorio frentes={frentesTerritorio()} />,
    metodo: <MetodoTerritorio />,
  }),
  "contas-publicas": () => ({
    descricao: "Arrecadação, despesas e resultado do governo federal, a execução do orçamento e as contas dos 27 estados, a partir do Tesouro Nacional, do SIOP e do Siconfi. Valores nominais, cada um com o período do seu demonstrativo.",
    escala: escalaContas(),
    artefato: <ImpostoResultado fluxo={fluxoImposto()} />,
    metodo: <MetodoContas />,
  }),
  "energia-e-infraestrutura": () => ({
    descricao: "Eletricidade, gás, água e esgoto, mobilidade e conectividade: oferta, preço regulado e acesso, a partir do ONS, da ANEEL, da ANP, do IBGE e do SINISA. Cada número traz o período e o universo da sua fonte.",
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
  const o = observatorio(id);
  const c = conteudo();
  const porta = portas().find((p) => p.id === id);
  return (
    <>
      <PublicHeader />
      <EntradaObservatorio
        nomeCurto={o.nomeCurto}
        nomeCompleto={o.nome}
        acento={o.acento}
        pergunta={o.pergunta}
        descricao={c.descricao}
        escala={c.escala}
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
