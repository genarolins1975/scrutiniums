import { numeroContaResidencial } from "@/lib/saneamento/escala-conta";
import { rotuloSinisa } from "@/lib/saneamento/edicao";
import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { BuscaMunicipio } from "@/components/saneamento/BuscaMunicipio";
import { DiagramaSistema } from "@/components/saneamento/DiagramaSistema";
import { FaixaMundo } from "@/components/saneamento/ReferenciaMundial";
import { SeloSituacao } from "@/components/saneamento/Editorial";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { FRESCOR_DAS_COLECOES } from "@/lib/frescor/entradas";
import { ParaVoce } from "@/components/observatorios/ParaVoce";
import { agregado, meta } from "@/lib/saneamento/gold";
import { EIXOS, FERRAMENTAS, ROTA, rotaCapitulo } from "@/lib/saneamento/capitulos";
import { razaoPct } from "@/lib/saneamento/municipios";
import { CAPITULOS_SEM_MANCHETE_FINANCEIRA, respostasDosCapitulos } from "@/lib/saneamento/respostas";
import { AUTODECLARADO } from "@/lib/saneamento/autodeclarado";
import { data, inteiro, numero } from "@/lib/saneamento/formato";
import { EntradaColecao } from "@/components/observatorios/EntradaColecao";
import { ModeloDidatico } from "@/components/observatorios/ModeloDidatico";
import { Recolhido } from "@/components/observatorios/Recolhido";
import type { NumeroPorta } from "@/lib/perguntas/tipos";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: { absolute: "Saneamento · Scrutiniums" },
  description:
    "Quem ainda está sem água e esgoto, quanto custa o serviço, quem o presta e fiscaliza, onde o dinheiro é investido e se o planejamento vira atendimento, município a município.",
  alternates: { canonical: ROTA },
};

export default function Pagina() {
  const m = meta();
  const br = agregado("BR");
  const respostas = respostasDosCapitulos();
  const mor = br?.censo2022.moradores;
  // Números de abertura: sem valores financeiros autodeclarados ao SINISA (src/lib/saneamento/autodeclarado.ts); o investimento fica no capítulo 9.
  const pctOuNulo = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? `${numero(v, 1)}%` : null);
  const escala: NumeroPorta[] = [
    {
      rotulo: "Moradores sem ligação à rede geral de água",
      valor: pctOuNulo(razaoPct(mor?.agua.sem_ligacao, mor?.agua.total)),
      unidade: "dos moradores",
      periodo: "2022",
      fonte: "IBGE, Censo 2022",
      nota: `${inteiro(mor?.agua.sem_ligacao)} pessoas.`,
      href: `${ROTA}/acesso`,
    },
    {
      rotulo: "Moradores sem rede de esgoto nem fossa séptica",
      valor: pctOuNulo(razaoPct(mor?.esgoto.sem_rede_nem_septica, mor?.esgoto.total)),
      unidade: "dos moradores",
      periodo: "2022",
      fonte: "IBGE, Censo 2022",
      nota: `${inteiro(mor?.esgoto.sem_rede_nem_septica)} pessoas.`,
      href: `${ROTA}/acesso`,
    },
    {
      rotulo: "Esgoto coletado que é tratado",
      valor: pctOuNulo(br?.sinisa.esgoto.indicadores.IES2004),
      unidade: "do esgoto coletado",
      periodo: rotuloSinisa("ano"),
      fonte: `Ministério das Cidades, ${rotuloSinisa("curta")}`,
      nota: `Sobre a água consumida: ${numero(br?.sinisa.esgoto.indicadores.IES2003, 1)}%.`,
      href: `${ROTA}/esgoto`,
    },
    numeroContaResidencial(),
  ];
  const semManchete = new Set<number>(CAPITULOS_SEM_MANCHETE_FINANCEIRA);

  return (
    <>
      <header>
        <CabecalhoPlataforma colecao="saneamento" destinoConta="/saneamento" />
        <NavegacaoColecao colecao="saneamento" />
      </header>
      <MarcaVisita secao="saneamento:inicio" />
      {/* molde único de entrada (Iniciativa 4 do parecer de UX, 22/10/2026): os quinze capítulos são os destinos, com os cinco eixos
          à vista; a busca do município fica no "Para você"; o diagrama do sistema é o modelo didático; o Brasil no mundo, recolhido */}
      <EntradaColecao
        tipo="colecao"
        rota="/saneamento"
        acento="obee"
        titulo="Quem ainda está sem água e esgoto, e quanto custa?"
        frase="Dados oficiais de acesso, tarifa, prestadores, reguladores, investimentos e metas, organizados pelas perguntas da sociedade. Os números trazem fonte, período e limitação; a conclusão fica com o leitor."
        frescor={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/saneamento"]} conteiner="mx-auto max-w-page px-6" />}
        escala={escala}
        notaEscala={`Censo 2022: moradores em domicílios particulares permanentes ocupados. ${rotuloSinisa()}: ${inteiro(m?.cobertura.agua_participantes)} municípios no módulo de água e ${inteiro(m?.cobertura.esgoto_participantes)} com indicadores de esgoto; valores declarados pelos prestadores. As medidas têm universos diferentes e não se somam.`}
        paraVoce={
          <ParaVoce entrada="/saneamento">
            <BuscaMunicipio grande />
          </ParaVoce>
        }
        destinos={
          <section aria-labelledby="eixos" className="mx-auto max-w-page px-6 py-10 md:py-12">
            <h2 id="eixos" className="font-serif text-[1.7rem] leading-snug text-carvao md:text-[2rem]">
              Cinco eixos, quinze perguntas
            </h2>
            <p className="mt-3 max-w-prose2 text-[0.95rem] leading-relaxed text-carvao-muted">
              Cada capítulo traz a resposta curta, o número que a sustenta e a fonte; a cobertura, o método e os limites estão no capítulo.
              Capítulo em preparação não vira link: diz o que falta e de que depende.
            </p>
            <div className="mt-8 grid gap-px border border-linha bg-linha md:grid-cols-2 lg:grid-cols-3">
              {EIXOS.map((e, i) => (
                <section key={e.id} aria-labelledby={`eixo-curto-${e.id}`} className={`bg-papel p-5 ${i === EIXOS.length - 1 && EIXOS.length % 3 === 2 ? "lg:col-span-2" : ""}`}>
                  <h3 id={`eixo-curto-${e.id}`} className="flex items-baseline gap-3">
                    <span className="font-label text-sm text-mineral">{e.id}</span>
                    <span className="font-serif text-xl text-carvao">{e.rotulo}</span>
                  </h3>
                  <ol className="mt-3">
                    {e.capitulos.map((c) => {
                      const r = c.situacao === "em_preparacao" ? undefined : respostas[c.numero];
                      return (
                        <li key={c.numero} className="border-t border-linha py-3" data-capitulo-destino={c.numero}>
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            {c.situacao === "em_preparacao" ? (
                              <p className="text-sm text-carvao-muted">
                                <span className="mr-2 tabular-nums text-mineral">{c.numero}</span>
                                {c.pergunta}
                              </p>
                            ) : (
                              <Link href={rotaCapitulo(c)} className="text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-obee">
                                <span className="mr-2 tabular-nums text-mineral">{c.numero}</span>
                                {c.pergunta}
                              </Link>
                            )}
                            <SeloSituacao situacao={c.situacao} />
                          </div>
                          {r && (
                            <p className="mt-1.5 text-xs text-carvao-muted">
                              <span className="font-serif text-base tabular-nums text-carvao">{r.valor}</span> {r.rotulo} <span className="block text-mineral">{r.fonte}</span>
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
            <section aria-labelledby="ferramentas" className="mt-8">
              <h3 id="ferramentas" className="font-serif text-xl text-carvao">
                Ferramentas
              </h3>
              <ul className="mt-3 grid grid-cols-1 gap-x-10 md:grid-cols-3">
                {FERRAMENTAS.map((f) => (
                  <li key={f.slug} className="border-t border-linha py-3">
                    <Link href={`${ROTA}/${f.slug}`} className="text-base text-carvao underline decoration-linha underline-offset-4 hover:decoration-obee">
                      {f.rotulo}
                    </Link>
                    <p className="mt-1 text-sm text-carvao-muted">{f.descricao}</p>
                  </li>
                ))}
              </ul>
            </section>
          </section>
        }
        artefato={
          <ModeloDidatico
            recolhido
            id="como-funciona"
            titulo="Como o serviço funciona e onde cada capítulo mede"
            descricao="A água percorre um caminho físico; a tarifa, as metas e o dinheiro percorrem outro, institucional. Os dois aparecem separados."
            deixaDeFora={[
              "A escala: a ilustração é conceitual, sem as distâncias e os volumes reais",
              "A drenagem urbana e o manejo de resíduos sólidos, que ficam fora do diagrama",
              "Quanto dinheiro passa por cada relação institucional, que fica nos capítulos de tarifa e investimento",
            ]}
          >
            <DiagramaSistema />
          </ModeloDidatico>
        }
        recolhidos={
          <>
          <Recolhido id="capitulos-em-detalhe" titulo="As quinze respostas, em detalhe" resumo="A frase de cada resposta, os valores autodeclarados e os subpainéis de cada capítulo.">
<div>
                {EIXOS.map((e) => (
                  <section
                    key={e.id}
                    aria-labelledby={`eixo-${e.id}`}
                    className={`border-t-2 py-6 ${e.id === "B" ? "border-obee" : "border-carvao"}`}
                  >
                    <h3 id={`eixo-${e.id}`} className="flex items-baseline gap-3">
                      <span className="font-label text-sm text-mineral">{e.id}</span>
                      <span className="font-serif text-xl text-carvao">{e.rotulo}</span>
                    </h3>
                    <p className="mt-1 max-w-prose2 text-sm text-carvao-muted">{e.resumo}</p>
                    <ol className="mt-4 grid grid-cols-1 gap-x-10 md:grid-cols-2">
                      {e.capitulos.map((c) => {
                        const r = c.situacao === "em_preparacao" ? undefined : respostas[c.numero];
                        return (
                        <li key={c.numero} className="border-t border-linha py-4" data-capitulo={c.numero}>
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            {c.situacao === "em_preparacao" ? (
                              <p className="text-base text-carvao-muted">
                                <span className="mr-2 tabular-nums text-mineral">{c.numero}</span>
                                {c.pergunta}
                              </p>
                            ) : (
                              <Link href={rotaCapitulo(c)} className="text-base text-carvao underline decoration-linha underline-offset-4 hover:decoration-obee">
                                <span className="mr-2 tabular-nums text-mineral">{c.numero}</span>
                                {c.pergunta}
                              </Link>
                            )}
                            <SeloSituacao situacao={c.situacao} />
                          </div>
                          {r ? (
                            <div data-resposta="">
                              <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
                                <span className="font-serif text-[1.55rem] leading-none tabular-nums text-carvao">{r.valor}</span>
                                <span className="text-sm text-carvao">{r.rotulo}</span>
                              </p>
                              <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">{r.frase}</p>
                              <p className="mt-1 text-xs text-mineral">{r.fonte}</p>
                            </div>
                          ) : (
                            <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{c.situacao === "em_preparacao" ? c.pendencia : c.resumo}</p>
                          )}
                          {semManchete.has(c.numero) && (
                            <p data-autodeclarado="" className="mt-1 max-w-prose2 text-xs leading-relaxed text-mineral">
                              Os valores ficam dentro do capítulo, com a ressalva: {AUTODECLARADO}.
                            </p>
                          )}
                          {c.subpaineis && (
                            <ul className="mt-3 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                              {c.subpaineis.map((s) => (
                                <li key={s.slug}>
                                  <Link href={`${rotaCapitulo(c)}/${s.slug}`} className="flex min-h-[44px] items-center gap-2 text-sm text-obee-dark underline-offset-4 hover:underline">
                                    <span className="tabular-nums text-mineral">{s.numero}</span> {s.pergunta}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                        );
                      })}
                    </ol>
                  </section>
                ))}
</div>
          </Recolhido>
          <Recolhido id="no-mundo" titulo="O Brasil no mundo" resumo="Três indicadores dos Objetivos de Desenvolvimento Sustentável, com a mesma definição para todos os países.">
              <p className="max-w-prose2 text-[0.95rem] leading-relaxed text-carvao-muted">
                Três indicadores dos Objetivos de Desenvolvimento Sustentável, com a mesma definição para todos os países, no ano mais recente em que o
                Brasil tem valor.
              </p>
              <div className="mt-8">
                <FaixaMundo
                  itens={[
                    { codigo: "SH_H2O_SAFE", titulo: "Água gerenciada com segurança", href: `${ROTA}/acesso#mundo` },
                    { codigo: "SH_SAN_SAFE", titulo: "Esgotamento gerenciado com segurança", href: `${ROTA}/acesso#mundo` },
                    { codigo: "EN_WWT_WWDS", titulo: "Esgoto doméstico tratado com segurança", href: `${ROTA}/esgoto#mundo` },
                  ]}
                />
              </div>
              <p className="mt-6">
                <Link href={`${ROTA}/internacional`} className="text-sm text-obee-dark underline underline-offset-4">
                  Brasil no mundo: todos os indicadores e a conciliação com o Censo e o SINISA
                </Link>
              </p>
          </Recolhido>
          </>
        }
        metodo={
          <div id="fontes" className="space-y-6">
            <h3 className="font-serif text-xl text-carvao">Fontes e atualização</h3>
            <dl className="grid grid-cols-1 gap-x-10 gap-y-4 text-sm leading-relaxed sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="font-medium text-carvao">{rotuloSinisa()}</dt>
                <dd className="text-carvao-muted">
                  Ministério das Cidades. Publicado em {data(m?.sinisa.publicacao)}; base municipal de água retificada em{" "}
                  {data(m?.sinisa.retificacao_agua_municipal)}. Capturado em {data(m?.sinisa.capturado_em)}.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-carvao">Censos Demográficos 2022 e 2010</dt>
                <dd className="text-carvao-muted">IBGE, SIDRA. Estimativa de população de 2024 (tabela 6579). Capturado em {data(m?.censo.capturado_em)}.</dd>
              </div>
              <div>
                <dt className="font-medium text-carvao">Atos tarifários e normas</dt>
                <dd className="text-carvao-muted">
                  Decisões e notas técnicas dos reguladores, contratos, Lei 11.445/2007, Lei 14.898/2024 e normas de referência da ANA.
                </dd>
              </div>
            </dl>
            <p>
              <Link href={`${ROTA}/metodologia`} className="inline-flex min-h-[44px] items-center border border-obee px-4 text-sm font-medium text-obee-dark hover:bg-obee-fundo">
                Método, conferências entre bases e downloads
              </Link>
            </p>
          </div>
        }
        frescorMetodo={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/saneamento"]} variante="metodo" />}
      />
    </>
  );
}
