import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CabecalhoEntrada } from "@/components/eficiencia/CabecalhoEntrada";
import { Siglas } from "@/components/eficiencia/Siglas";
import { goldSaude } from "@/lib/eficiencia/saude/dados";
import { metaEducacao } from "@/lib/eficiencia/dados";
import { MapaServicos } from "@/components/eficiencia/MapaServicos";
import { EscoresServicos } from "@/components/eficiencia/EscoresServicos";
import { dadosAssistencia } from "@/lib/eficiencia/assistencia/dados";
import { dadosAlimentares } from "@/lib/eficiencia/alimentar/dados";
import { DIMENSOES } from "@/lib/eficiencia/dimensoes";
import { dataBr } from "@/lib/eficiencia/formato";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Observatório Brasileiro de Eficiência Estatal",
  description: "Indicadores públicos sobre recursos, atendimento e resultados do Estado brasileiro, por tema, com definição, fonte, período e limitações em cada número. Mapa dos serviços públicos ao cidadão. Educação, Saúde, Trabalho e renda, Segurança alimentar e Assistência social e cuidado, com dados e critérios de avaliação dos serviços.",
  alternates: { canonical: "/eficiencia-estatal" },
};

type Tema = { id: string; titulo: string; pergunta: string; escopo: string; naoInclui: string; cobertura: string; fontes: string; entradas: { href: string; rotulo: string }[]; atualizacao: string | null };

export default function PaginaEntradaEficiencia() {
  const alimentar = dadosAlimentares();
  const assistencia = dadosAssistencia();
  const edu = metaEducacao();
  const g = goldSaude();
  const trabalho = JSON.parse(readFileSync(join(process.cwd(), "public/eficiencia/trabalho-renda/snapshot.json"), "utf8")) as { capturadoEm: string };
  const temas: Tema[] = [
    {
      id: "educacao",
      titulo: "Educação nas capitais",
      pergunta: "Quanto se gasta, quem é atendido e quais resultados são observados na rede municipal de ensino?",
      escopo: "Rede municipal das 26 capitais estaduais: despesa na função Educação (total, por habitante e razão por matrícula de aplicação direta), matrículas, alunos por turma, aprovação, Ideb e Saeb.",
      naoInclui: "Redes estaduais, federais e privadas na capital; custo por aluno; causa do resultado.",
      cobertura: "26 capitais; despesa e matrículas de 2021 a 2025; Ideb de 2005 a 2025, a cada dois anos.",
      fontes: "Tesouro Nacional (Siconfi), INEP (Censo Escolar, Ideb e Saeb) e IBGE (população e IPCA).",
      entradas: [
        { href: "/eficiencia-estatal/educacao-municipal-capitais", rotulo: "Panorama" },
        { href: "/eficiencia-estatal/educacao-municipal-capitais/gastos", rotulo: "Gastos" },
        { href: "/eficiencia-estatal/educacao-municipal-capitais/atendimento", rotulo: "Atendimento" },
        { href: "/eficiencia-estatal/educacao-municipal-capitais/resultados", rotulo: "Resultados" },
        { href: "/eficiencia-estatal/educacao-municipal-capitais/comparar", rotulo: "Comparar capitais" },
        { href: "/eficiencia-estatal/educacao-municipal-capitais/metodos", rotulo: "Dados e métodos" },
      ],
      atualizacao: edu?.dados_capturados_ate ? dataBr(edu.dados_capturados_ate) : null,
    },
    {
      id: "saude",
      titulo: "Saúde nas capitais",
      pergunta: "Quanto as capitais aplicam em Saúde, que estrutura e atendimento são registrados e quais resultados são observados entre seus moradores?",
      escopo: "Três perímetros separados nas 26 capitais: recursos executados pelo município (despesa, aplicação em ações e serviços públicos de saúde, fonte de recursos), serviços localizados no território (unidades básicas de saúde, equipes e cobertura da atenção primária) e resultados por residência (internações por condições sensíveis à atenção primária, ICSAP).",
      naoInclui: "Gasto de União e estado no território; rede privada e filantrópica; produção da atenção primária, profissionais e custo por atendimento (avaliados e não publicados, com o motivo); filas e tempo de espera (não pesquisados nesta rodada).",
      cobertura: g
        ? `26 capitais, com o Distrito Federal fora e o motivo à vista; despesa e aplicação em ações e serviços públicos de saúde de ${g.periodos.financeiros[0]} a ${g.periodos.financeiros[g.periodos.financeiros.length - 1]}; unidades, equipes e cobertura em dezembro de ${g.periodos.dezembros[0]} a ${g.periodos.dezembros[g.periodos.dezembros.length - 1]}; internações por condições sensíveis à atenção primária de ${g.periodos.resultados[0]} a ${g.periodos.resultados[g.periodos.resultados.length - 1]}; ${g.indicadores.filter((f) => f.estado !== "NAO_PUBLICAVEL").length} indicadores publicados com ressalvas.`
        : "Dados indisponíveis nesta publicação.",
      fontes: "Tesouro Nacional (Siconfi), Ministério da Saúde (SIOPS, CNES, Relatório APS e RIPSA) e IBGE (população e IPCA).",
      entradas: [
        { href: "/eficiencia-estatal/saude-capitais", rotulo: "Panorama" },
        { href: "/eficiencia-estatal/saude-capitais/gastos", rotulo: "Gastos" },
        { href: "/eficiencia-estatal/saude-capitais/rede-e-atencao-primaria", rotulo: "Rede e atenção primária" },
        { href: "/eficiencia-estatal/saude-capitais/atendimento-e-resultados", rotulo: "Atendimento e resultados" },
        { href: "/eficiencia-estatal/saude-capitais/comparar", rotulo: "Comparar capitais" },
        { href: "/eficiencia-estatal/saude-capitais/metodos", rotulo: "Dados e métodos" },
      ],
      atualizacao: g ? dataBr(g.meta.dados_capturados_ate) : null,
    },
    {
      id: "trabalho", titulo: "Trabalho e renda", pergunta: "Quem consegue trabalhar, quanto recebe e que recursos públicos são registrados?",
      escopo: "Indicadores de trabalho e rendimento da população residente, movimentação do emprego formal, proteção social e despesas municipais na função Trabalho. Cada painel declara seu universo e seu período.",
      naoInclui: "Uma taxa atual de desemprego para todos os municípios; causalidade entre despesa e emprego; acompanhamento individual; ações públicas sem dados reconciliados.",
      cobertura: "Brasil e Unidades da Federação nos indicadores conjunturais; municípios no retrato de rendimento do Censo 2022; 26 capitais estaduais nas declarações financeiras municipais de 2021 a 2025.",
      fontes: "IBGE (PNAD Contínua e Censo 2022), MTE/Novo Caged republicado por BCB e Ipea, MDS (Cadastro Único), Tesouro Nacional (Siconfi).",
      entradas: [{ href: "/eficiencia-estatal/trabalho-renda", rotulo: "Panorama" }, { href: "/eficiencia-estatal/trabalho-renda/metodos", rotulo: "Dados e métodos" }],
      atualizacao: dataBr(trabalho.capturadoEm.slice(0,10)),
    },
    {
      id: "alimentacao", titulo: "Segurança alimentar", pergunta: "Quais famílias enfrentam restrição alimentar e que atuação pública é declarada no território?",
      escopo: "Situação alimentar dos domicílios no Brasil e nas grandes regiões (PNADC); dez variáveis de ações, gestão, orçamento e equipamentos da MUNIC, em todos os municípios.",
      naoInclui: "EBIA municipal; beneficiários únicos e demanda elegível; continuidade real das entregas; conformidade nutricional ou sanitária; causalidade entre atuação pública e situação alimentar.",
      cobertura: "Brasil e cinco Grandes Regiões em 2023 e 2024; 5.570 municípios na MUNIC 2024, incluindo ausências, com períodos próprios de cada pergunta.",
      fontes: "IBGE (PNAD Contínua Segurança Alimentar 2024 e MUNIC Segurança Alimentar 2024).",
      entradas: [{ href: "/eficiencia-estatal/seguranca-alimentar", rotulo: "Panorama" }, { href: "/eficiencia-estatal/seguranca-alimentar/dados", rotulo: "Explorar dados" }, { href: "/eficiencia-estatal/seguranca-alimentar/metodos", rotulo: "Dados e métodos" }],
      atualizacao: dataBr(alimentar.manifest.captured_at.slice(0,10)),
    },
    {id:"assistencia",titulo:"Assistência social e cuidado",pergunta:"Quando uma pessoa precisa de apoio, a rede consegue acolher e acompanhar?",escopo:"Rede de CRAS, CREAS e centros-dia e similares; oferta declarada, acessibilidade, cuidado domiciliar e quatro medidas do RMA CRAS.",naoInclui:"Demanda elegível, usuários únicos, resolução, espera geral, despesa reconciliada ou escore numérico validado.",cobertura:`Censo SUAS ${assistencia.year}: ${Object.values(assistencia.manifest.counts).reduce((a,b)=>a+b,0).toLocaleString("pt-BR")} unidades, incluindo redes regionais, estaduais e organizações da sociedade civil; ${assistencia.manifest.rma_rows.toLocaleString("pt-BR")} formulários RMA CRAS unidade-mês de ${assistencia.year}.`,fontes:"MDS (Censo SUAS e RMA CRAS 2025).",entradas:[{href:"/eficiencia-estatal/assistencia-social",rotulo:"Panorama"},{href:"/eficiencia-estatal/assistencia-social/dados",rotulo:"Explorar dados"},{href:"/eficiencia-estatal/assistencia-social/metodos",rotulo:"Dados e métodos"}],atualizacao:dataBr(assistencia.manifest.captured_at)},
  ];
  return (
    <div>
      <CabecalhoEntrada />
      <main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-6 sm:px-6 md:pt-8">
        <section aria-labelledby="titulo-eficiencia" className="bg-obee-tinta px-5 py-8 text-superficie sm:px-8 md:px-10 md:py-10">
          <div className="grid gap-8 lg:grid-cols-[1.55fr_1fr] lg:gap-16">
            <div>
              <p className="font-label text-xs uppercase tracking-label text-marfim">Painel geral · Estado e cidadão</p>
              <h1 id="titulo-eficiencia" className="mt-4 max-w-[42rem] font-serif text-[2.5rem] leading-[1.08] tracking-tight md:text-[3.5rem]">O Estado na vida<br className="hidden sm:block" /> de cada cidadão.</h1>
              <p className="mt-5 max-w-[38rem] text-base leading-relaxed text-marfim">Acesso, resposta e qualidade dos serviços públicos. O panorama reúne os escores dos capítulos e permite explorar os dados que sustentam a análise, com suas lacunas explícitas.</p>
              <a href="#escores-servicos" className="mt-6 inline-flex min-h-[44px] items-center gap-5 bg-marfim px-5 py-3 text-sm font-semibold text-obee-tinta">Examinar os escores <span aria-hidden="true">↓</span></a>
            </div>
            <div className="border-t border-superficie/30 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-1">
              <p className="font-label text-xs uppercase tracking-label text-marfim">Três perguntas para cada área</p>
              {[
                ["01", "Quem consegue acessar?", "Atendimento efetivo e demanda não atendida."],
                ["02", "A resposta chega a tempo?", "Espera, regularidade e continuidade da entrega."],
                ["03", "A entrega cumpre o padrão?", "Qualidade, segurança e resultados do atendimento."],
              ].map(([n, titulo, texto]) => <div key={n} className="mt-5 flex gap-4"><span className="pt-1 font-label text-sm text-marfim">{n}</span><div><h2 className="font-serif text-xl">{titulo}</h2><p className="mt-1 text-sm leading-relaxed text-marfim">{texto}</p></div></div>)}
            </div>
          </div>
        </section>

        <dl className="grid grid-cols-2 border-b border-linha bg-superficie md:grid-cols-4">
          {[
            [String(DIMENSOES.length), "dimensões no mapa", "Visão geral dos serviços ao cidadão"],
            [String(temas.length), "temas publicados", "Educação, Saúde, Trabalho e renda, Segurança alimentar e Assistência social e cuidado"],
            ["Brasil", "recortes territoriais", "Estados e municípios conforme a fonte"],
            ["3", "componentes do escore", "Acesso, resposta e qualidade"],
          ].map(([n, titulo, texto]) => <div key={titulo} className="border-linha px-5 py-5 even:border-l md:border-l md:first:border-l-0"><dd className="font-serif text-3xl text-obee-tinta">{n}</dd><dt className="mt-1 text-sm font-semibold">{titulo}</dt><dd className="mt-1 text-xs leading-relaxed text-carvao-muted">{texto}</dd></div>)}
        </dl>

        <EscoresServicos />

        <section aria-labelledby="dados-publicados" className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="rotulo text-obee">Explore os dados</p><h2 id="dados-publicados" className="mt-1 font-serif text-2xl md:text-3xl">Escolha uma área, explore os dados.</h2></div>
            <a href="#cobertura" className="inline-flex min-h-[44px] items-center text-sm text-obee-dark underline underline-offset-4">Entender a cobertura ↓</a>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {temas.map((t, i) => <article key={t.id} className="border border-linha border-t-4 border-t-obee bg-superficie p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-label text-xs uppercase tracking-label text-obee-dark">Dados publicados</span><span className="text-xs text-carvao-muted">{["trabalho","alimentacao","assistencia"].includes(t.id) ? "Recortes próprios" : "26 capitais"} · captura {t.atualizacao ?? "não informada"}</span></div>
              <h3 className="mt-4 font-serif text-2xl">{t.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-carvao-muted">{i === 0 ? "Da aplicação de recursos às condições de ensino e à aprendizagem na rede municipal." : i === 1 ? "Dos recursos municipais à rede de atenção primária e às internações dos moradores." : i === 2 ? "Oportunidades, condições de trabalho e renda das pessoas, com recortes territoriais próprios." : "Situação alimentar dos domicílios, ações declaradas e estrutura pública municipal."}</p>
              <dl className="mt-5 grid grid-cols-3 gap-3 border-y border-linha py-4 text-xs leading-relaxed">
                {(i === 0 ? [["Recursos", "Despesa e gasto por habitante"], ["Acesso", "Matrículas e alunos por turma"], ["Resultados", "Aprovação, Ideb e Saeb"]] : i === 2 ? [["Recursos", "Função Trabalho nas capitais"], ["Acesso", "Participação e ocupação"], ["Resultados", "Rendimento e emprego formal"]] : i === 3 ? [["Necessidades", "EBIA no Brasil e nas regiões"], ["Atuação", "Ações e equipamentos declarados"], ["Avaliação", "Critérios e lacunas do serviço"]] : [["Recursos", "Despesa e aplicação em saúde"], ["Acesso", "Unidades, equipes e cobertura"], ["Resultados", "Internações sensíveis à atenção primária"]]).map(([dt, dd]) => <div key={dt}><dt className="font-semibold text-obee-dark">{dt}</dt><dd className="mt-1 text-carvao-muted">{dd}</dd></div>)}
              </dl>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><Link href={t.entradas[0].href} className="inline-flex min-h-[44px] items-center gap-6 bg-obee-tinta px-4 text-sm font-semibold text-superficie">Abrir painel <span aria-hidden="true">↗</span></Link><Link href={(t.entradas.find(e => e.rotulo === "Comparar capitais") ?? t.entradas[1]).href} className="inline-flex min-h-[44px] items-center text-sm text-obee-dark underline underline-offset-4">{["trabalho","alimentacao","assistencia"].includes(t.id) ? "Dados e métodos" : "Comparar capitais"}</Link></div>
            </article>)}
          </div>
        </section>

        <MapaServicos />

        <section id="cobertura" aria-labelledby="titulo-cobertura" className="mt-12 scroll-mt-6 border-t border-linha pt-8">
          <p className="rotulo text-obee">Transparência da cobertura</p>
          <h2 id="titulo-cobertura" className="mt-1 font-serif text-2xl md:text-3xl">Um mapa amplo. Um recorte declarado.</h2>
          <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">O mapa organiza as dimensões do Estado na vida do cidadão. Os dados cobrem Educação municipal e Saúde nas 26 capitais estaduais, além de Trabalho e Renda no Brasil, nos estados e nos municípios conforme a fonte, e Segurança alimentar na pesquisa domiciliar e na MUNIC. A União, os estados e os municípios têm responsabilidades distintas; as fontes e os perímetros de cada tema estão abaixo. O Distrito Federal fica fora das comparações financeiras entre prefeituras; os indicadores de Trabalho e Renda podem incluí-lo como Unidade da Federação.</p>
          <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">Cada número tem definição, fonte, período e limitação. Os valores e as referências permitem comparações dentro de um mesmo recorte. A metodologia de escores dos serviços é experimental e ainda não produz notas; os dados descritivos permanecem disponíveis. O observatório não infere causa a partir do gasto.</p>
        </section>
        <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
          {temas.map((t) => (
            <details key={t.id} className="border border-linha bg-superficie p-5">
              <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-4 font-semibold">{t.titulo}: escopo, fontes e acessos</summary>
              <div className="pt-4">
              <p className="rotulo text-mineral">Tema publicado</p>
              <h2 id={`tema-${t.id}`} className="mt-1 font-serif text-[1.75rem] leading-snug text-obee-tinta">{t.titulo}</h2>
              <p className="mt-2 max-w-prose2 text-[1.0625rem] leading-snug text-obee-tinta">{t.pergunta}</p>
              <dl className="mt-4 space-y-3 text-sm leading-snug">
                <div><dt className="rotulo text-carvao-muted">O que mostra</dt><dd className="mt-0.5 max-w-prose2 text-obee-tinta">{t.escopo}</dd></div>
                <div><dt className="rotulo text-carvao-muted">O que não inclui</dt><dd className="mt-0.5 max-w-prose2 text-obee-tinta">{t.naoInclui}</dd></div>
                <div><dt className="rotulo text-carvao-muted">Cobertura</dt><dd className="mt-0.5 max-w-prose2 text-obee-tinta">{t.cobertura}</dd></div>
                <div><dt className="rotulo text-carvao-muted">Fontes</dt><dd className="mt-0.5 max-w-prose2 text-obee-tinta"><Siglas texto={t.fontes} /></dd></div>
                <div><dt className="rotulo text-carvao-muted">Última captura de dados</dt><dd className="mt-0.5 text-obee-tinta">{t.atualizacao ?? "não informada"}; os anos de referência estão em cada medida.</dd></div>
              </dl>
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1">
                {t.entradas.map((e, i) => (
                  <li key={e.href}>
                    <Link href={e.href} className={`inline-flex min-h-[44px] items-center underline-offset-4 ${i === 0 ? "font-semibold text-obee-tinta underline" : "text-obee-dark hover:underline"}`}>
                      {e.rotulo}
                    </Link>
                  </li>
                ))}
              </ul>
              </div>
            </details>
          ))}
        </div>

        <aside className="mt-8 grid gap-5 border-l-4 border-obee bg-obee-fundo p-5 md:grid-cols-2">
          <div><h2 className="font-serif text-xl">Quem financia, quem entrega, quem responde?</h2><p className="mt-2 text-sm leading-relaxed">A análise completa precisa distinguir recursos da União, dos estados e dos municípios, transferências e a instituição responsável pelo atendimento.</p></div>
          <div><h3 className="text-sm font-semibold">Estrutura e funcionamento do Estado</h3><p className="mt-2 text-sm leading-relaxed">Administração, arrecadação, pessoal, Legislativo e Judiciário atravessam essas dimensões. A comparação entre esferas e poderes ainda não tem dados publicados neste observatório.</p></div>
        </aside>
      </main>
    </div>
  );
}
