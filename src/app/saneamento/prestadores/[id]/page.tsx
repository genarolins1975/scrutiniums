import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecalho } from "@/components/saneamento/Cabecalho";
import { Fonte, NestaPagina, Nota, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { QuadroSocietario } from "@/components/saneamento/QuadroSocietario";
import { TabelaDados } from "@/components/saneamento/TabelaDados";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { controleDoPrestador, fichaMunicipio, meta, municipio, prestador } from "@/lib/saneamento/gold";
import { controladoresDiretos, pctSocietario, referenciaPosteriorAoRecebimento } from "@/lib/saneamento/controle";
import { ROTA } from "@/lib/saneamento/capitulos";
import { data, inteiro, reaisCompacto } from "@/lib/saneamento/formato";
import { NATUREZA_CURTA } from "@/lib/saneamento/rotulos";
import { MEDIDAS_PRESTADOR, formatarMedidaPrestador } from "@/lib/saneamento/prestadores";
import { TARIFAS } from "@/lib/saneamento/tarifas";

export const dynamicParams = true;
export const revalidate = false;

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const p = prestador(params.id);
  if (!p) return { title: "Prestador não encontrado" };
  const nome = p.sigla ? `${p.nome} (${p.sigla})` : p.nome ?? p.id;
  return {
    title: `${nome}: municípios, atendimento, perdas e investimento`,
    description: `Ficha de ${nome} no SINISA 2024: natureza jurídica, municípios atendidos, população, perdas, receita e despesa por metro cúbico, investimento e balanço declarado.`,
    alternates: { canonical: `${ROTA}/prestadores/${p.id}` },
  };
}

export default function Pagina({ params }: { params: { id: string } }) {
  const p = prestador(params.id);
  if (!p) notFound();
  const tarifas = TARIFAS.filter((t) => t.prestadorSinisa === p.id);
  const controle = controleDoPrestador(p.id);
  const cvm = meta()?.cvm;
  const b = p.balanco.find((x) => x.planilha === "agua") ?? p.balanco[0] ?? null;

  const ids = [...new Set([...p.municipios_agua, ...p.municipios_esgoto])];
  const linhas = ids.flatMap((id) => {
    const m = municipio(id);
    const f = fichaMunicipio(id);
    return (f?.sinisa.prestadores ?? [])
      .filter((v) => v.prestador === p.id)
      .map((v) => ({
        municipio: m?.nome ?? id,
        href: `${ROTA}/municipio/${id}`,
        uf: m?.uf ?? null,
        servico: v.servico === "agua" ? "Água" : "Esgoto",
        forma: v.forma ?? null,
        instrumento: v.instrumento ?? null,
        termino: v.termino ? data(v.termino) : null,
        populacao: v.populacao_atendida ?? null,
        area: v.area ?? null,
      }));
  });

  const nome = p.nome ?? p.id;
  return (
    <>
      <Cabecalho atual="prestadores" />
      <MarcaVisita secao="saneamento:prestador" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <header className="mb-2">
          <p className="rotulo text-obee-dark">
            <Link href={`${ROTA}/prestadores`} className="underline underline-offset-2">
              Prestadores
            </Link>{" "}
            · Ficha do prestador
          </p>
          <h1 className="mt-4 max-w-4xl font-serif text-[2rem] leading-tight text-carvao [text-wrap:balance] md:text-[2.6rem]">
            {nome}
            {p.sigla && <span className="text-carvao-muted"> ({p.sigla})</span>}
          </h1>
          <dl className="mt-5 grid max-w-4xl grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-carvao-muted">Natureza jurídica declarada</dt>
              <dd className="text-carvao">{p.natureza ? NATUREZA_CURTA[p.natureza] ?? p.natureza : "sem dado"}</dd>
            </div>
            <div>
              <dt className="text-carvao-muted">Abrangência</dt>
              <dd className="text-carvao">{p.abrangencia ?? "sem dado"}</dd>
            </div>
            <div>
              <dt className="text-carvao-muted">UFs de atuação</dt>
              <dd className="text-carvao">{p.ufs.join(", ") || "sem dado"}</dd>
            </div>
          </dl>
          <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href={`${ROTA}/prestadores/comparar?p=${p.id}`} className="inline-flex min-h-[44px] items-center font-medium text-obee-dark underline underline-offset-4">
              Comparar com outros prestadores
            </Link>
            {tarifas.length > 0 && (
              <Link
                href={`${ROTA}/preco-regulado/simulador?t=${tarifas[0].id}`}
                className="inline-flex min-h-[44px] items-center font-medium text-obee-dark underline underline-offset-4"
              >
                Simular a conta com a tabela verificada
              </Link>
            )}
          </p>
        </header>
        <NestaPagina
          itens={[
            { id: "medidas", rotulo: "Operação, finanças e investimento" },
            { id: "balanco", rotulo: "Balanço" },
            ...(controle && cvm ? [{ id: "controle", rotulo: "Controle" }] : []),
            { id: "municipios", rotulo: "Municípios e contratos" },
          ]}
        />

        <Secao id="medidas" titulo="Operação, finanças e investimento declarados" texto="Fórmulas oficiais do SINISA aplicadas às somas que o prestador declarou em todos os municípios em que atua, ano de referência 2024.">
          <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Medidas do prestador (rolável)">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <caption className="sr-only">Medidas do prestador</caption>
              <thead>
                <tr className="border-b border-carvao text-left">
                  <th scope="col" className="py-2 pr-4 font-medium">Medida</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Valor</th>
                  <th scope="col" className="py-2 font-medium">Como é calculada</th>
                </tr>
              </thead>
              <tbody>
                {MEDIDAS_PRESTADOR.map((m) => {
                  const v = m.valor(p);
                  return (
                    <tr key={m.id} className="border-b border-linha align-top">
                      <th scope="row" className="py-2 pr-4 text-left font-normal text-carvao">{m.rotulo}</th>
                      <td className={`py-2 pr-4 text-right tabular-nums ${v == null ? "text-carvao-muted" : "text-carvao"}`}>{formatarMedidaPrestador(m, v)}</td>
                      <td className="py-2 text-xs text-carvao-muted">{m.nota}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Ressalva
            permite="Ver o perímetro e os principais números que o prestador declarou para 2024, com a fórmula de cada um."
            naoPermite="Julgar o desempenho isoladamente: perdas, custos e investimento dependem da área atendida, do estágio do contrato e da qualidade do registro. Para comparar, use prestadores de perfil semelhante."
          />
        </Secao>

        <Secao id="balanco" titulo="Balanço declarado ao SINISA" texto="Demonstrações informadas pelo prestador ao SINISA para 2024, em reais. Não substituem as demonstrações auditadas.">
          {b ? (
            <dl className="grid max-w-4xl grid-cols-1 gap-x-10 gap-y-3 text-sm sm:grid-cols-2">
              {(
                [
                  ["Ativo total", b.ativo_total],
                  ["Patrimônio líquido", b.patrimonio_liquido],
                  ["Passivo circulante", b.passivo_circulante],
                  ["Passivo não circulante", b.passivo_nao_circulante],
                  ["Receita operacional bruta", b.receita_bruta],
                  ["Receita operacional líquida", b.receita_liquida],
                  ["Resultado operacional com depreciação", b.resultado_operacional_com_depreciacao],
                  ["Lucro líquido com depreciação", b.lucro_liquido_com_depreciacao],
                ] as [string, number | null][]
              ).map(([r, v]) => (
                <div key={r} className="flex items-baseline justify-between gap-4 border-b border-linha py-2">
                  <dt className="text-carvao-muted">{r}</dt>
                  <dd className="tabular-nums text-carvao">{reaisCompacto(v == null ? null : v * 1000)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <Nota>O prestador não declarou balanço ao SINISA 2024 ou não tem balanço próprio (administração direta).</Nota>
          )}
          {b && (
            <Nota>
              Valores da planilha de balanço, publicada em milhares de reais e convertida para reais aqui; tipo de serviço declarado: {b.tipo_servico ?? "sem dado"}.
              Quando a empresa tem outras atividades, o balanço pode ser o da empresa inteira.
            </Nota>
          )}
          <Fonte>Ministério das Cidades, SINISA 2025 (ano de referência 2024), planilhas de balanço dos prestadores locais e regionais, campos GFI3001 a GFI3011.</Fonte>
        </Secao>

        {controle && cvm && (
          <Secao
            id="controle"
            titulo="Quem controla a empresa?"
            texto={
              <>
                Posição acionária que a companhia declarou à CVM no Formulário de Referência: versão {controle.documento.versao}, recebida em{" "}
                {data(controle.documento.recebido_em)}. Dados capturados em {data(cvm.capturado_em)}.
              </>
            }
          >
            <dl className="grid max-w-4xl grid-cols-1 gap-x-10 gap-y-3 text-sm sm:grid-cols-2">
              <div className="border-b border-linha py-2">
                <dt className="text-carvao-muted">Controlador declarado</dt>
                <dd className="text-carvao">
                  {controladoresDiretos(controle).length === 0
                    ? "Nenhum controlador declarado"
                    : controladoresDiretos(controle)
                        .map((a) => `${a.nome}, ${pctSocietario(a, "pct_total")} do capital total e ${pctSocietario(a, "pct_on")} das ordinárias`)
                        .join("; ")}
                </dd>
              </div>
              <div className="border-b border-linha py-2">
                <dt className="text-carvao-muted">Acordo de acionistas</dt>
                <dd className="text-carvao">{controle.acordo_acionistas ? "Há acionistas diretos participantes" : "Nenhum participante declarado entre os acionistas diretos"}</dd>
              </div>
            </dl>
            <div className="mt-6">
              <QuadroSocietario companhia={controle} />
            </div>
            <Ressalva
              permite="Ver quem a companhia declara como acionista e como controlador, com a cadeia de controle que informou, na data de recebimento do documento."
              naoPermite="Concluir quem controla de fato além do que foi declarado, ou acompanhar mudanças posteriores ao documento. Os demais acionistas aparecem agregados como Outros, como na fonte; pessoas físicas que não controlam nem participam de acordo aparecem somadas, sem nome."
            />
            <Nota>
              O percentual de cada nível é o do acionista na empresa imediatamente acima. Sem controlador declarado não significa sem controle: a companhia
              pode ter controle compartilhado ou disperso.
              {referenciaPosteriorAoRecebimento(controle) && (
                <> A data de referência do arquivo da CVM ({data(controle.documento.referencia)}) é posterior ao recebimento do documento e não é a data da posição.</>
              )}{" "}
              <a className="text-obee-dark underline" href={controle.documento.link}>Abrir o documento na CVM</a>.
              {controle.pessoas_fisicas_somadas > 0 && (
                <> {controle.pessoas_fisicas_somadas === 1 ? "1 pessoa física não controladora está somada" : `${controle.pessoas_fisicas_somadas} pessoas físicas não controladoras estão somadas`} na cadeia.</>
              )}
            </Nota>
            <Fonte>
              CVM, dados abertos, Formulário de Referência {cvm.ano}, arquivo posicao_acionaria, capturado em {data(cvm.capturado_em)}. O CNPJ {controle.cnpj} foi
              ligado a esta ficha pelos municípios que o declaram como prestador no SINISA 2024. Árvore completa em{" "}
              <a className="text-obee-dark underline" href="/saneamento/gold/controle_societario.csv">controle_societario.csv</a>.
            </Fonte>
          </Secao>
        )}

        <Secao id="municipios" titulo="Em que municípios atua e sob qual instrumento?" texto="Vínculos declarados ao SINISA 2024: serviço, forma de prestação, instrumento e término da vigência informados.">
          <TabelaDados
            titulo="Municípios atendidos"
            arquivo={`saneamento-prestador-${p.id}-municipios-2024.csv`}
            colunas={[
              { id: "municipio", rotulo: "Município", href: "href" },
              { id: "uf", rotulo: "UF" },
              { id: "servico", rotulo: "Serviço" },
              { id: "forma", rotulo: "Forma de prestação" },
              { id: "instrumento", rotulo: "Instrumento" },
              { id: "termino", rotulo: "Término da vigência" },
              { id: "populacao", rotulo: "População atendida", tipo: "inteiro" },
            ]}
            linhas={linhas}
            ordemInicial={{ coluna: "populacao", direcao: "desc" }}
            rotuloLinhas={{ singular: "vínculo", plural: "vínculos" }}
          />
          <Nota>
            {inteiro(p.municipios_agua.length)} municípios com água e {inteiro(p.municipios_esgoto.length)} com esgoto. Datas e instrumentos são os
            declarados; contratos e aditivos não foram lidos.
          </Nota>
        </Secao>
      </main>
    </>
  );
}
