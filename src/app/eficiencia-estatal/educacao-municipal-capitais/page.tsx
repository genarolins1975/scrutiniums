import type { Metadata } from "next";
import { TextoComDatas } from "@/components/TextoComDatas";
import { CabecalhoObee } from "@/components/eficiencia/CabecalhoObee";
import { ESTADO_PUBLICACAO, FichaConteudo } from "@/components/eficiencia/FichaConteudo";
import { PainelEducacao } from "@/components/eficiencia/PainelEducacao";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { contextos } from "@/lib/eficiencia/contexto";
import { dadosPainel, goldEducacao } from "@/lib/eficiencia/dados";
import { dataBr, decimal, inteiro, rotuloVersaoCatalogo } from "@/lib/eficiencia/formato";
import type { GoldEducacao, IndicadorId, LinhaCobertura } from "@/lib/eficiencia/tipos";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Educação municipal nas capitais",
  description:
    "Despesa em Educação total, por habitante e por matrícula, matrículas, alunos por turma, aprovação, Ideb e Saeb das redes municipais das 26 capitais estaduais, com referências do grupo, nacionais e internacionais, fonte, período, perímetro e limitações de cada número.",
  alternates: { canonical: "/eficiencia-estatal/educacao-municipal-capitais" },
};

const RESULTADO: Record<string, string> = {
  aprovada: "Aprovada",
  aprovada_com_divergencias_documentadas: "Aprovada, com divergências documentadas",
  regra_aplicada_com_pendencias: "Regra aplicada; há pendências de conferência, fora das comparações",
  reprovada: "Reprovada",
  medicao: "Medição",
};

const GLOSSARIO: [string, string][] = [
  ["DCA", "Declaração de Contas Anuais: demonstrativo anual que cada ente envia ao Tesouro Nacional pelo Siconfi."],
  ["RREO", "Relatório Resumido da Execução Orçamentária, bimestral, exigido pela Lei de Responsabilidade Fiscal. Aqui serve só de conferência."],
  ["Siconfi", "Sistema de Informações Contábeis e Fiscais do Setor Público Brasileiro, mantido pela Secretaria do Tesouro Nacional."],
  ["Função e subfunção", "Classificação funcional da despesa (Portaria MOG nº 42/1999): a função 12 é Educação; subfunções detalham a área (361 ensino fundamental, 365 educação infantil, 122 administração geral e outras)."],
  ["Despesa liquidada", "Estágio em que o ente reconhece que o bem foi entregue ou o serviço prestado. Vem depois do empenho (reserva do recurso) e antes do pagamento. Os estágios não se somam."],
  ["Intraorçamentária", "Operação entre órgãos do mesmo ente, como a contribuição patronal ao regime próprio de previdência. A DCA a apresenta em linha separada."],
  ["IPCA", "Índice Nacional de Preços ao Consumidor Amplo, do IBGE, usado aqui só para expressar valores em reais de 2025."],
  ["INEP", "Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira, responsável pelo Censo Escolar, pelo Saeb e pelo Ideb."],
  ["Censo Escolar", "Levantamento anual do INEP com dados de escolas, turmas, matrículas e docentes, com data de referência na última quarta-feira de maio."],
  ["Rede municipal", "Escolas cuja dependência administrativa no Censo Escolar é municipal. Não inclui escolas estaduais, federais ou privadas no mesmo município."],
  ["Escola conveniada", "Escola privada que declara ao Censo Escolar parceria ou convênio com o poder público para financiar o atendimento."],
  ["Saeb", "Sistema de Avaliação da Educação Básica, avaliação bienal do INEP em Língua Portuguesa e Matemática."],
  ["Ideb", "Índice de Desenvolvimento da Educação Básica, do INEP: produto da nota média padronizada no Saeb (N) pelo indicador de rendimento (P), em escala de 0 a 10."],
  ["Mediana", "Valor do meio quando os valores são ordenados: metade das capitais na comparação fica abaixo e metade acima. Aqui, sem ponderação; não é meta, padrão nem estatística nacional."],
  ["Reais de 2025", "Valor corrigido pela inflação medida pelo IPCA: cada exercício é multiplicado pela razão entre a média do índice em 2025 e a média do índice no exercício, para expressar todos os anos no poder de compra médio de 2025."],
  ["Fora da comparação", "O valor oficial existe e pode ser consultado, mas não entra em comparações entre capitais, medianas nem variações, porque o perímetro é diferente ou a conferência com outra fonte oficial está pendente. O motivo aparece junto do dado."],
  ["MSC", "Matriz de Saldos Contábeis: saldos das contas contábeis que cada ente envia mensalmente ao Tesouro. Aqui é a terceira fonte de conferência da despesa quando DCA e RREO diferem e a fonte da ponte da despesa por matrícula (subfunção, modalidade de aplicação e elemento de cada linha da função 12)."],
  ["Despesa por habitante", "Despesa liquidada na função Educação dividida pela população residente do mesmo ano. Divisão aritmética pelo território: não é tributo pago por pessoa, benefício recebido nem despesa por aluno."],
  ["Razão da despesa de aplicação direta por matrícula", "Despesa liquidada de aplicação direta (modalidade 90) do município na função Educação, sem inativos, ensino superior, transferências e delegações, dividida pelas matrículas das escolas municipais. Razão orçamentária: a modalidade 90 diz quem executa a despesa, não quem recebe o serviço, e inclui serviços de terceiros que podem atender a rede própria ou não. É por matrícula, não por estudante único; não é custo integral nem custo marginal. A parcela de beneficiário indeterminado é medida e publicada ao lado."],
  ["Parcela de beneficiário indeterminado", "Parte do numerador da razão por matrícula formada por elementos de despesa cujo beneficiário a MSC não permite afirmar: serviços de terceiros pessoa jurídica (39), contribuições (41, quando fora do grupo 3.1), indenizações e ressarcimentos (18, 48 e 45), além de compras de consórcio (modalidades 93 e 94). O painel mede e mostra essa parcela; não define limite de aceitabilidade."],
  ["Aplicação direta e transferência", "Modalidade da despesa: aplicação direta (90) é a que o próprio ente executa; transferências a instituições privadas (50 e 60) financiam, por exemplo, creches conveniadas. Intraorçamentária (91) é operação entre órgãos do mesmo ente."],
  ["Média simples e razão agregada", "A média simples dá o mesmo peso a cada capital. A razão agregada soma os numeradores e os denominadores dos mesmos pares e divide: pesa cada capital pelo seu denominador. Respondem a perguntas diferentes e não se chamam apenas de média. Um indicador nacional oficial tem cálculo e universo definidos pela fonte e não é a média das capitais."],
  ["Faixa dos 50% centrais", "Intervalo entre o primeiro e o terceiro quartis: metade dos valores do grupo está dentro dele. Só é exibida com 8 ou mais valores (política de apresentação, não garantia estatística)."],
  ["População estimada e Censo", "As estimativas do IBGE têm data de referência em 1º de julho; o Censo 2022, em 31 de julho de 2022. A estimativa de 2021 parte do Censo de 2010 e as de 2024 em diante, do Censo de 2022, por isso há quebra de série. Para 2023 não há estimativa municipal: o IBGE adotou, por lei, a população do Censo 2022 (relação do DOU de 31/08/2023). O painel a usa em 2023 identificada como censitária, igual à de 2022, e não como população de julho de 2023."],
  ["ISCED", "Classificação Internacional Padronizada da Educação (UNESCO). No Brasil, segundo o mapeamento da UNESCO (UIS, planilha “ISCED 2011 Mapping Brazil”, ano letivo 2012/13), o ensino fundamental do 1º ao 5º ano é o nível 1 e do 6º ao 9º ano é o nível 2; creche e pré-escola são o nível 0. O mapeamento é da UNESCO, não do INEP."],
  ["PPC", "Paridade de poder de compra: fator que converte valores em moeda local para uma unidade comum de poder de compra. A OCDE o usa no lugar do câmbio comercial, que não mede o que a renda compra."],
];


function rotuloCaptura(c: { chave: string }): string {
  const ano = c.chave.match(/(\d{4})$/)?.[1] ?? "";
  if (c.chave.startsWith("inep_atu_brasil")) return `ATU, Brasil, ${ano}`;
  if (c.chave.startsWith("inep_rendimento_brasil")) return `rendimento, Brasil, ${ano}`;
  if (c.chave.startsWith("inep_ideb_brasil")) return `Ideb, Brasil, ${ano}`;
  if (c.chave.startsWith("inep_investimento_estudante")) return `investimento por estudante, ${c.chave.endsWith("real") ? "valores reais" : "valores nominais"}`;
  if (c.chave.startsWith("inep_ideb_ai")) return `anos iniciais, edição ${ano}`;
  if (c.chave.startsWith("inep_ideb_af")) return `anos finais, edição ${ano}`;
  return ano;
}

function cob(l: LinhaCobertura[] | undefined, ano: number, etapa: string | null = null) {
  const x = l?.find((c) => c.ano === ano && c.etapa === etapa);
  if (!x) return "sem dado";
  return `${x.com_valor} de ${x.elegiveis} com valor${x.comparaveis !== x.com_valor ? ` (${x.comparaveis} na comparação)` : ""}`;
}

function Secao({ id, rotulo, titulo, children }: { id: string; rotulo: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-24 border-t border-linha pt-10">
      <p className="rotulo text-mineral">{rotulo}</p>
      <h2 id={`${id}-titulo`} className="mt-2 font-serif text-2xl leading-tight text-obee-tinta md:text-[1.75rem]">
        {titulo}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function ComoLer({ g }: { g: GoldEducacao }) {
  const colunas = [
    {
      rotulo: "Recursos",
      titulo: "Gasto em Educação, em três escalas",
      quem: "Total: todo o orçamento do município na função Educação. Por habitante: o total dividido pela população residente. Por matrícula: a despesa liquidada de aplicação direta (modalidade 90) dividida pelas matrículas das escolas municipais, uma razão orçamentária que não separa o que atende a rede própria.",
      quando: `Exercício financeiro (janeiro a dezembro), ${g.periodos.financeiros[0]} a ${g.periodos.financeiros.at(-1)}. Em 2023 a população oficial é a do Censo 2022, a mesma de 2022.`,
      fonte: "Tesouro Nacional (DCA e MSC), IBGE (população) e INEP (matrículas).",
    },
    {
      rotulo: "Atendimento",
      titulo: "Matrículas e alunos por turma",
      quem: "Escolas de dependência municipal no território da capital. Escolas privadas com parceria só com o município são contadas à parte e nunca somadas; parceria simultânea com estado e município fica fora.",
      quando: `Data de referência do Censo Escolar (maio), ${g.periodos.censo[0]} a ${g.periodos.censo.at(-1)}.`,
      fonte: "INEP, Censo Escolar.",
    },
    {
      rotulo: "Resultados educacionais",
      titulo: "Aprovação, Ideb e Saeb",
      quem: "Estudantes da rede municipal: aprovação nos anos iniciais e finais; Ideb e Saeb no 5º e no 9º ano, nas escolas que atendem aos critérios do Saeb.",
      quando: "Aprovação: ano letivo. Ideb e Saeb: edições bienais, de 2005 a 2025.",
      fonte: "INEP, indicadores educacionais e Ideb.",
    },
  ];
  return (
    <Secao id="como-ler" rotulo="Entender · como ler" titulo="Três famílias de medidas, cada uma com o seu perímetro">
      <div className="grid gap-px border border-linha bg-linha md:grid-cols-3">
        {colunas.map((c) => (
          <div key={c.rotulo} className="bg-superficie px-5 py-5">
            <p className="rotulo text-obee-dark">{c.rotulo}</p>
            <p className="mt-2 font-semibold leading-snug text-obee-tinta">{c.titulo}</p>
            <dl className="mt-3 space-y-2 text-sm leading-relaxed text-obee-tinta">
              <div>
                <dt className="text-carvao-muted">Quem está incluído</dt>
                <dd>{c.quem}</dd>
              </div>
              <div>
                <dt className="text-carvao-muted">Período</dt>
                <dd>{c.quando}</dd>
              </div>
              <div>
                <dt className="text-carvao-muted">Fonte</dt>
                <dd>{c.fonte}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 text-[0.95rem] leading-relaxed text-obee-tinta md:grid-cols-2">
        <p>
          O gasto total mede volume e depende do tamanho da cidade. Por habitante, ele coloca capitais de portes diferentes na mesma escala territorial. Por matrícula, ele aproxima a despesa da rede atendida: do total
          declarado na DCA sai o que não tem matrícula correspondente (transferências, delegações, inativos, ensino superior), e a ponte mostra cada parcela, inclusive a de beneficiário indeterminado. Nenhuma das três escalas substitui as outras, e nenhuma
          é custo integral de um aluno. A despesa de toda a educação tampouco é específica de uma etapa:{" "}
          <a href="#ponte" className="text-obee-dark underline underline-offset-2">
            veja a ponte
          </a>
          .
        </p>
        <p>
          O gasto de um exercício e o Ideb de uma edição não estão ligados por causa e efeito no painel: o resultado educacional depende de muitos fatores, acumulados em anos. Colocar os números próximos não
          estabelece relação entre eles. Média não é meta, máximo não é ideal, menor gasto não demonstra eficiência e gasto maior não demonstra qualidade; as referências do grupo, nacionais e internacionais servem
          para situar um número, não para julgá-lo.
        </p>
      </div>
    </Secao>
  );
}

function Metodos({ g, ctx }: { g: GoldEducacao; ctx: ReturnType<typeof contextos> }) {
  const m01 = g.validacoes.find((v) => v.id === "M01");
  const naoPub = g.indicadores.find((i) => i.estado === "NAO_PUBLICAVEL");
  const v04 = g.validacoes.find((v) => v.id === "V04");
  const m02 = g.validacoes.find((v) => v.id === "M02");
  const v14 = g.validacoes.find((v) => v.id === "V14");
  const v16 = g.validacoes.find((v) => v.id === "V16");
  const m03 = g.validacoes.find((v) => v.id === "M03");
  const m04 = g.validacoes.find((v) => v.id === "M04");
  const fichaMat = g.indicadores.find((i) => i.id === "edu.despesa.aplicacao_direta_por_matricula");
  const pol = g.politica_conferencia;
  return (
    <Secao id="metodos" rotulo="Auditar · métodos e fontes" titulo="Passaportes, fontes, validações e reprodução">
      <div className="space-y-12">
        <div>
          <h3 className="font-serif text-xl text-obee-tinta">Passaportes dos indicadores</h3>
          <p className="mt-1 max-w-prose2 text-sm text-carvao-muted">
            Cada ficha existe antes da publicação do número e tem os mesmos dezesseis campos. Estado de publicação entre parênteses.
          </p>
          <div className="mt-4 divide-y divide-linha border-y border-linha">
            {g.indicadores.map((f) => (
              <details key={f.id} id={`ficha-${f.id}`} className="group">
                <summary className="flex min-h-[48px] cursor-pointer items-center justify-between gap-4 py-2 text-obee-tinta">
                  <span>
                    <span className="font-semibold">{f.nome}</span>{" "}
                    <span className="text-sm text-carvao-muted">({ESTADO_PUBLICACAO[f.estado].toLowerCase()})</span>
                  </span>
                  <span aria-hidden="true" className="rotulo text-obee-dark group-open:hidden">
                    Abrir
                  </span>
                  <span aria-hidden="true" className="rotulo hidden text-obee-dark group-open:inline">
                    Fechar
                  </span>
                </summary>
                <div className="pb-4">
                  <FichaConteudo f={f} ctx={ctx[f.id]} />
                </div>
              </details>
            ))}
          </div>
        </div>

        {v04 && (
          <div id="conferencia" className="scroll-mt-24">
            <h3 className="font-serif text-xl text-obee-tinta">Conferência da despesa e elegibilidade para comparação</h3>
            <p className="mt-2 max-w-prose2 text-[0.95rem] leading-relaxed text-obee-tinta">
              Cada valor da DCA é conferido com o RREO do 6º bimestre. Diferença de até R$ 1,00 confere; até{" "}
              {decimal(pol.tolerancia_relativa * 100, 1)}% da DCA é diferença menor. Acima disso, só a Matriz de Saldos Contábeis (MSC) de
              dezembro reconcilia. Valores com perímetro distinto ou conferência pendente continuam disponíveis para consulta e ficam fora
              de comparações, medianas e variações. Política {pol.versao}.
            </p>
            <ul className="mt-4 space-y-4">
              {v04.casos
                .filter((c) => c.situacao && c.situacao !== "DIFERENCA_MENOR")
                .map((c) => (
                  <li key={`${String(c.ente)}-${String(c.ano)}`} className="border-l-2 border-obee-tinta pl-4 text-sm leading-relaxed text-obee-tinta">
                    <p className="font-semibold">
                      {String(c.nome)}, {String(c.ano)}: {String(c.rotulo)}
                      {c.elegivel ? " · elegível" : " · fora das comparações"}
                    </p>
                    <p className="mt-1">{String(c.explicacao)}</p>
                    {Array.isArray(c.evidencias) && c.evidencias.length > 0 && (
                      <ul className="mt-1 list-disc pl-5 text-carvao-muted">
                        {(c.evidencias as string[]).map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
            </ul>
            <p className="mt-3 text-xs text-carvao-muted">
              Diferenças menores (abaixo de {decimal(pol.tolerancia_relativa * 100, 1)}% da DCA):{" "}
              {v04.casos
                .filter((c) => c.situacao === "DIFERENCA_MENOR")
                .map((c) => `${String(c.nome)} ${String(c.ano)}`)
                .join("; ") || "nenhuma"}
              . Detalhe de todos os casos na validação V04.
            </p>
            {m02 && <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-obee-tinta">{m02.detalhe}</p>}
          </div>
        )}

        {fichaMat && v16 && (
          <div id="despesa-por-matricula" className="scroll-mt-24">
            <h3 className="font-serif text-xl text-obee-tinta">Razão da despesa de aplicação direta por matrícula: definição, ponte e cobertura</h3>
            <p className="mt-2 max-w-prose2 border-l-2 border-obee-tinta pl-4 text-[0.95rem] leading-relaxed text-obee-tinta" role="note">
              <span className="font-semibold">Definição corrigida.</span> Até a versão 1.2 o indicador se chamava despesa efetiva da rede própria por aluno. A modalidade de aplicação 90 diz quem executa a despesa, não quem recebe o serviço, e o nome prometia mais do que a MSC sustenta. O indicador passou a se
              chamar razão da despesa de aplicação direta por matrícula, com identificador novo (<code>edu.despesa.aplicacao_direta_por_matricula</code>) para que o identificador antigo não passe a designar outro conceito. Os valores antigos e novos não são a mesma série.
            </p>
            <p className="mt-2 max-w-prose2 text-[0.95rem] leading-relaxed text-obee-tinta">
              <span className="font-semibold">Fórmula.</span> {fichaMat.formula}
            </p>
            <ul className="mt-3 max-w-prose2 list-disc space-y-1.5 pl-5 text-[0.95rem] leading-relaxed text-obee-tinta">
              <li>
                <span className="font-semibold">Entra no numerador:</span> despesa liquidada de aplicação direta (modalidade 90) na função Educação, nas contas de despesa liquidada da MSC de dezembro (6.2.2.1.3.03, .04 e .07), em saldo líquido (natureza C soma, D subtrai). As compras de consórcio (modalidades 93 e 94, desdobramento da 90) entram na parcela de beneficiário indeterminado.
              </li>
              <li>
                <span className="font-semibold">Fica fora:</span> transferências a instituições privadas (modalidades 50 e 60, como as creches conveniadas, cujas matrículas também ficam fora do denominador), transferências a outros entes e consórcios (20 a 46, 70 a 76 e 80), recursos recebidos por delegação (92), parcerias público-privadas (67), modalidades de uso atípico em Educação (95, 96 e 99), aposentadorias, pensões e outros
                benefícios previdenciários (elementos 01, 03 e 05 do grupo 3.1.90), ensino superior (subfunção 364) e intraorçamentárias (modalidade 91, fora do total da DCA).
              </li>
              <li>
                <span className="font-semibold">Não se faz:</span> somar matrículas conveniadas ao denominador, ratear despesa por etapa, ou chamar matrícula de pessoa. O rótulo é por matrícula.
              </li>
              <li>
                <span className="font-semibold">Reconciliação.</span> A soma das linhas da MSC (sem intraorçamentárias) precisa igualar a DCA em até R$ 1,00 ou, como na política de conferência da despesa, em até 0,1% da DCA, com nota. Sem isso, não há valor, e o motivo aparece junto da capital.
              </li>
            </ul>
            <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-obee-tinta">{v16.detalhe}</p>
            {m03 && <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-obee-tinta">{m03.detalhe}</p>}
            <details className="mt-3">
              <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-obee-dark">
                Ver os {v16.casos.filter((c) => c.situacao).length} pares capital × exercício sem despesa por matrícula, com o motivo
              </summary>
              <ul className="mt-2 max-w-prose2 space-y-1.5 text-xs leading-snug text-carvao-muted">
                {v16.casos
                  .filter((c) => c.situacao)
                  .map((c) => (
                    <li key={`${String(c.ente)}-${String(c.ano)}`}>
                      <span className="font-semibold text-obee-tinta">
                        {String(c.nome)}, {String(c.ano)}:
                      </span>{" "}
                      {String(c.resultado)}
                      {c.diferenca_pct_dca !== undefined && c.diferenca_pct_dca !== null ? ` (diferença de ${decimal(Number(c.diferenca_pct_dca), 2)}% da DCA)` : ""}.
                    </li>
                  ))}
              </ul>
            </details>
            <div className="mt-4 border-l-2 border-obee-tinta pl-4">
              <p className="font-semibold text-obee-tinta">O que impede o valor nos demais casos, e o dado que resolveria</p>
              <p className="mt-1 max-w-prose2 text-sm leading-relaxed text-obee-tinta">
                A MSC de dezembro de alguns entes não traz a função Educação ou não fecha com a DCA (diferença acima de 0,1%). O que resolveria: a MSC retificada ou a DCA retificada do ente, ou a abertura da DCA por modalidade de aplicação
                (hoje a DCA só abre por função e subfunção). Nada é estimado no lugar.
              </p>
            </div>
            {m04 && (
              <div className="mt-6">
                <p className="font-semibold text-obee-tinta">Fonte examinada e não adotada: indicadores por aluno do SIOPE (FNDE)</p>
                <p className="mt-1 max-w-prose2 text-sm leading-relaxed text-obee-tinta">{m04.detalhe}</p>
                <p className="mt-1 text-xs leading-relaxed text-carvao-muted">
                  O SIOPE é declaratório (a responsabilidade pelas informações é do ente). Respostas preservadas no seed com sha256; evidência detalhada na validação M04.
                </p>
              </div>
            )}
            {v14 && (
              <div className="mt-6">
                <p className="font-semibold text-obee-tinta">População, o denominador da despesa por habitante</p>
                <p className="mt-1 max-w-prose2 text-sm leading-relaxed text-obee-tinta">
                  2021: estimativa de 1º de julho de 2021, calculada a partir do Censo de 2010. 2022: Censo Demográfico (31 de julho de 2022). 2023: o IBGE não publicou estimativa municipal e adotou como oficial a população do Censo 2022 (relação do DOU de
                  31/08/2023); a despesa por habitante de 2023 usa essa população censitária, a mesma de 2022, sem interpolação, e variações com 2023 são bloqueadas. 2024 e 2025: estimativas de 1º de julho calculadas a partir do Censo de 2022. {v14.detalhe}
                </p>
              </div>
            )}
          </div>
        )}

        {naoPub && m01 && (
          <div id="nao-publicado" className="scroll-mt-24">
            <h3 className="font-serif text-xl text-obee-tinta">Definição avaliada e descartada: despesa total da função ÷ matrículas da rede municipal</h3>
            <ul className="mt-3 max-w-prose2 list-disc space-y-1.5 pl-5 text-[0.95rem] leading-relaxed text-obee-tinta">
              {naoPub.motivo_nao_publicacao?.map((t) => <li key={t}>{t}</li>)}
            </ul>
            <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-obee-tinta">{m01.detalhe}</p>
            <div className="tabela-scroll mt-3 border border-linha" tabIndex={0} role="region" aria-label="Medição do perímetro, 2025 (role na horizontal se necessário)">
              <table className="w-full min-w-[44rem] border-collapse text-sm">
                <caption className="sr-only">Medição do perímetro entre despesa e matrículas, por capital, 2025</caption>
                <thead>
                  <tr className="text-left">
                    {["Capital", "Matrículas na rede municipal", "Matrículas em conveniadas com o município", "Conveniadas ÷ rede", "Despesa em administração geral", "Despesa em demais subfunções", "Despesa em ensino superior"].map((c, i) => (
                      <th key={c} scope="col" className={`border-b border-carvao-muted px-2.5 py-2 font-semibold ${i ? "text-right" : ""}`}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...m01.casos]
                    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"))
                    .map((c) => (
                      <tr key={String(c.ente)} className="border-b border-linha">
                        <th scope="row" className="px-2.5 py-1.5 text-left font-normal">
                          {String(c.nome)}
                        </th>
                        <td className="px-2.5 py-1.5 text-right">{inteiro(Number(c.matriculas_rede))}</td>
                        <td className="px-2.5 py-1.5 text-right">{inteiro(Number(c.matriculas_conveniadas_municipio))}</td>
                        <td className="px-2.5 py-1.5 text-right">{decimal(Number(c.conveniadas_sobre_rede_pct), 1)}%</td>
                        <td className="px-2.5 py-1.5 text-right">{decimal(Number(c.pct_despesa_administracao_geral), 1)}%</td>
                        <td className="px-2.5 py-1.5 text-right">{decimal(Number(c.pct_despesa_demais_subfuncoes), 1)}%</td>
                        <td className="px-2.5 py-1.5 text-right">{decimal(Number(c.pct_despesa_ensino_superior), 1)}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-carvao-muted">
              Fontes: INEP, Censo Escolar 2025; Siconfi, DCA 2025, Anexo I-E. Percentuais de despesa sobre o total liquidado na função
              Educação. Subfunção sem linha na DCA aparece como 0%: a soma das linhas declaradas já reconcilia com o total da função.
            </p>
          </div>
        )}

        <div id="matriz-referencias" className="scroll-mt-24">
          <h3 className="font-serif text-xl text-obee-tinta">Matriz de referências: aceitas, de contexto e rejeitadas</h3>
          <p className="mt-1 max-w-prose2 text-sm text-carvao-muted">
            Cada candidata, com fonte, universo, unidade, período, método, compatibilidade, uso permitido e a decisão fundamentada. A classe combina duas dimensões: quem produziu o número (oficial publicado ou calculado pelo OBEE com fontes
            oficiais) e o quanto ele é comparável às dimensões de origem do indicador da capital (direta, contextual ou incompatível). Oficial publicado e calculado pelo OBEE com fonte oficial podem ser mostrados com diferença para a capital quando o universo
            é o mesmo; contextual aparece ao lado, sem diferença; incompatível foi examinada e rejeitada, com o motivo.
          </p>
          <div className="tabela-scroll mt-3 border border-linha" tabIndex={0} role="region" aria-label="Matriz de referências (role na horizontal se necessário)">
            <table className="w-full min-w-[78rem] border-collapse text-xs leading-snug">
              <caption className="sr-only">Candidatas a referência para os indicadores do painel, com a classificação e a decisão</caption>
              <thead>
                <tr className="text-left">
                  {["Indicador", "Candidata", "Fonte", "Universo", "Unidade", "Período", "Método", "Compatibilidade", "Classe", "Uso permitido", "Decisão"].map((c) => (
                    <th key={c} scope="col" className="border-b border-carvao-muted px-2 py-2 font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {g.matriz_referencias.map((m) => (
                  <tr key={m.id} className="border-b border-linha align-top">
                    <th scope="row" className="px-2 py-2 text-left font-normal">
                      {g.indicadores.find((i) => i.id === m.indicador)?.nome_curto ?? m.indicador}
                    </th>
                    <td className="px-2 py-2 font-semibold">{m.candidata}</td>
                    <td className="px-2 py-2">{m.fonte}</td>
                    <td className="px-2 py-2">{m.universo}</td>
                    <td className="px-2 py-2">{m.unidade}</td>
                    <td className="px-2 py-2">{m.periodo}</td>
                    <td className="px-2 py-2">{m.metodo}</td>
                    <td className="px-2 py-2">{m.compatibilidade}</td>
                    <td className="px-2 py-2">{m.classe}</td>
                    <td className="px-2 py-2">{m.uso}</td>
                    <td className="px-2 py-2">{m.decisao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
            {g.politica_referencias.media} {g.politica_referencias.razao_agregada} {g.politica_referencias.mediana} Quartis: {g.politica_referencias.quartis} {g.politica_referencias.limiar_quartis_nota}{" "}
            {g.politica_referencias.empates} {g.politica_referencias.nacional}
          </p>
        </div>

        <div>
          <h3 className="font-serif text-xl text-obee-tinta">Fontes e capturas</h3>
          <div className="tabela-scroll mt-3 border border-linha" tabIndex={0} role="region" aria-label="Fontes e capturas (role na horizontal se necessário)">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <caption className="sr-only">Fontes usadas pelo painel, papel de cada uma e capturas</caption>
              <thead>
                <tr className="text-left">
                  {["Fonte", "Papel no painel", "Capturas", "Integridade"].map((c) => (
                    <th key={c} scope="col" className="border-b border-carvao-muted px-2.5 py-2 font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {g.fontes.map((f) => {
                  const c0 = f.capturas[0];
                  return (
                    <tr key={f.id} className="border-b border-linha align-top">
                      <th scope="row" className="px-2.5 py-2 text-left font-normal">
                        <a href={c0.pagina} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-2">
                          {c0.instituicao}
                          <span className="sr-only"> (abre em nova aba)</span>
                        </a>
                        <br />
                        <span className="text-carvao-muted">{f.capturas.length > 1 ? c0.conjunto.replace(/,?\s(\d{4}).*$/, "").replace(/,\s*municípios$/, ", municípios") : c0.conjunto}</span>
                      </th>
                      <td className="px-2.5 py-2">{f.papel}</td>
                      <td className="px-2.5 py-2">
                        {f.capturas.length > 1
                          ? `${f.capturas.length} arquivos (${f.capturas.map(rotuloCaptura).join(", ")})`
                          : c0.arquivos_capturados
                            ? `${c0.arquivos_capturados} consultas à API`
                            : "1 consulta"}
                        , coletados até {dataBr(f.capturas.map((c) => c.capturado_em).sort().at(-1))}
                      </td>
                      <td className="px-2.5 py-2 text-xs leading-snug text-carvao-muted">
                        {f.capturas.some((c) => c.md5_conferido)
                          ? "MD5 do arquivo lido conferido com o publicado pelo INEP; sha256 do pacote no manifesto."
                          : "Resposta preservada no seed com sha256."}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-carvao-muted">
            Manifesto completo de capturas (URL, parâmetros, data, sha256 e MD5 de cada arquivo): <code className="font-mono">pipeline/eficiencia/seed/manifesto.json</code> no
            repositório. Gold usada nesta página:{" "}
            <a href="/eficiencia/gold/educacao_capitais.json" className="text-obee-dark underline underline-offset-2">
              educacao_capitais.json
            </a>{" "}
            (hash dos dados <span className="font-mono">{g.meta.hash_dados.slice(0, 16)}</span>).
          </p>
        </div>

        <div>
          <h3 className="font-serif text-xl text-obee-tinta">Validações executadas</h3>
          <p className="mt-1 max-w-prose2 text-sm text-carvao-muted">
            Conferem o produto: cálculo, integridade, perímetros e estados de dado. Rodam a cada reconstrução da gold; uma validação reprovada
            impede a publicação.
          </p>
          <ul className="mt-4 divide-y divide-linha border-y border-linha">
            {g.validacoes.map((v) => (
              <li key={v.id} className="py-3">
                <details>
                  <summary className="cursor-pointer text-sm text-obee-tinta">
                    <span className="font-mono text-[0.8rem]">{v.id}</span> <span className="font-semibold">{v.titulo}</span>
                    <span className="ml-2 text-carvao-muted">· {RESULTADO[v.resultado]}</span>
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-obee-tinta">{v.detalhe}</p>
                  {v.casos.length > 0 && v.id !== "M01" && (
                    <ul className="mt-2 space-y-1 text-xs leading-snug text-carvao-muted">
                      {v.casos.slice(0, 40).map((c, i) => (
                        <li key={i}>
                          {"nome" in c ? `${String(c.nome)}${"ano" in c ? `, ${String(c.ano)}` : ""}: ` : ""}
                          {"explicacao" in c ? String(c.explicacao) : "resultado" in c ? String(c.resultado) : "situacao" in c ? String(c.situacao) : JSON.stringify(c)}
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-10 lg:grid-cols-2">
          <div className="min-w-0">
            <h3 className="font-serif text-xl text-obee-tinta">Exemplos de reprodução</h3>
            <p className="mt-1 text-sm text-carvao-muted">
              Uma trilha completa por indicador publicado, da fonte ao número. Regra de escolha: a primeira capital, em ordem alfabética, com
              valor no período mais recente.
            </p>
            <div className="mt-3 space-y-4">
              {g.trilhas.map((t) => (
                <details key={t.indicador} className="text-sm">
                  <summary className="cursor-pointer py-3 text-obee-tinta">
                    {g.indicadores.find((i) => i.id === t.indicador)?.nome}: {t.nome}, {t.ano}
                  </summary>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-obee-tinta">
                    {t.passos.map((p) => (
                      <li key={p} className="break-words">
                        <TextoComDatas texto={p} />
                      </li>
                    ))}
                  </ol>
                </details>
              ))}
            </div>
            <h3 className="mt-8 font-serif text-xl text-obee-tinta">Como reproduzir</h3>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-obee-tinta">
              <li>
                Reconstruir a gold a partir dos recortes versionados, sem rede: <code className="break-all font-mono text-[0.8rem]">python3 -m pipeline.eficiencia.run</code>.
              </li>
              <li>
                Recoletar o Siconfi e o IPCA: <code className="break-all font-mono text-[0.8rem]">python3 -m pipeline.eficiencia.run --coleta-siconfi</code>.
              </li>
              <li>
                Reextrair os recortes do INEP a partir dos pacotes oficiais baixados: <code className="break-all font-mono text-[0.8rem]">--inep &lt;pasta&gt;</code>; as referências nacionais, de{" "}
                <code className="break-all font-mono text-[0.8rem]">--inep-nacional &lt;pasta&gt;</code>.
              </li>
              <li>
                Recoletar a MSC, a população, a OCDE e o SIOPE examinado: <code className="break-all font-mono text-[0.8rem]">--coleta-msc</code>, <code className="break-all font-mono text-[0.8rem]">--coleta-populacao</code>,{" "}
                <code className="break-all font-mono text-[0.8rem]">--coleta-ocde</code> e <code className="break-all font-mono text-[0.8rem]">--coleta-siope</code>.
              </li>
              <li>
                Testes: <code className="break-all font-mono text-[0.8rem]">python3 -m unittest pipeline.tests.test_eficiencia pipeline.tests.test_eficiencia_comparacoes</code>.
              </li>
            </ol>
            <p className="mt-2 text-xs text-carvao-muted">
              Processamento {g.meta.versao_pipeline}, catálogo de <data value={g.meta.versao_catalogo}>{rotuloVersaoCatalogo(g.meta.versao_catalogo)}</data>
              {g.meta.versao_codigo ? `, código gerador ${g.meta.versao_codigo}` : ""}, gerado em {dataBr(g.meta.gerado_em)}.
            </p>
            {g.meta.proveniencia && (
              <p className="mt-1 text-xs leading-relaxed text-carvao-muted">
                Proveniência: o código gerador é identificado pelo conteúdo ({g.meta.proveniencia.codigo_gerador.arquivos} arquivos, sha256{" "}
                <span className="break-all font-mono">{g.meta.proveniencia.codigo_gerador.sha256.slice(0, 16)}</span>), as entradas pelo manifesto do seed ({g.meta.proveniencia.entradas.capturas_no_manifesto} capturas, sha256{" "}
                <span className="break-all font-mono">{g.meta.proveniencia.entradas.manifesto_do_seed_sha256.slice(0, 16)}</span>) e as saídas pelo hash dos dados{" "}
                <span className="break-all font-mono">{g.meta.proveniencia.saidas.hash_dados.slice(0, 16)}</span>. O commit que incorpora estes dados é posterior à geração e consta no histórico do repositório.
              </p>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-serif text-xl text-obee-tinta">Glossário</h3>
            <dl className="mt-3 space-y-3 text-sm leading-relaxed">
              {GLOSSARIO.map(([t, d]) => (
                <div key={t}>
                  <dt className="font-semibold text-obee-tinta">{t}</dt>
                  <dd className="text-obee-tinta">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="min-w-0">
          <h3 className="font-serif text-xl text-obee-tinta">Limitações gerais</h3>
          <ul className="mt-3 max-w-prose2 list-disc space-y-1.5 pl-5 text-[0.95rem] leading-relaxed text-obee-tinta">
            <li>O universo é o das 26 capitais estaduais. Brasília não entra: {g.universo.excluidos[0]?.motivo}</li>
            <li>As comparações são descritivas. Não há ajuste por população, renda, composição da rede ou atribuições de cada município.</li>
            <li>A classificação funcional da despesa segue a prática de cada município e pode mudar entre exercícios.</li>
            <li>Os indicadores do INEP são reproduzidos como publicados, inclusive os códigos de não divulgação.</li>
            <li>
              O painel cobre uma fração do que o Observatório pretende acompanhar. Outras áreas, poderes e níveis de governo serão publicados
              quando tiverem cadeia de dados verificada.
            </li>
          </ul>
        </div>
      </div>
    </Secao>
  );
}

export default function PaginaEducacaoCapitais() {
  const g = goldEducacao();
  const ctx = g ? contextos(g) : {};
  const ultimoFin = g?.periodos.financeiros.at(-1) ?? 2025;
  const c = g?.cobertura ?? {};
  return (
    <>
      <CabecalhoObee />
      <main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-10 sm:px-6">
        {!g ? (
          <Indisponivel
            titulo="Painel indisponível"
            motivo="A base do painel não foi encontrada nesta publicação. Nenhum número é exibido no lugar."
            faltante={["public/eficiencia/gold/educacao_capitais.json"]}
          />
        ) : (
          <div className="space-y-14">
            {/* A: identidade e contexto */}
            <section aria-labelledby="titulo-painel">
              <p className="rotulo text-obee-dark">Painel de referência · educação</p>
              <h1 id="titulo-painel" className="mt-3 font-serif text-[2.1rem] leading-[1.15] text-obee-tinta md:text-[2.75rem]">
                {g.painel.titulo}
              </h1>
              <p className="mt-4 max-w-prose2 text-lg leading-relaxed text-obee-tinta">{g.painel.frase}</p>
              <p className="mt-3 max-w-prose2 text-[0.95rem] leading-relaxed text-carvao-muted">
                O painel apresenta valores, definições, fontes e limitações. Não classifica redes nem avalia governos: as conclusões ficam com
                quem lê.
              </p>
              <dl className="mt-7 grid gap-px border border-linha bg-linha text-sm sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Universo", `${g.universo.capitais.length} capitais estaduais, rede municipal. Brasília fora do recorte municipal.`],
                  ["Períodos", `Despesa: exercícios ${g.periodos.financeiros[0]} a ${ultimoFin}. Censo Escolar: ${g.periodos.censo[0]} a ${g.periodos.censo.at(-1)}. Ideb: edições ${g.periodos.ideb[0]} a ${g.periodos.ideb.at(-1)}.`],
                  [
                    `Cobertura em ${ultimoFin}`,
                    `Despesa total: ${cob(c["edu.despesa.funcao_educacao" as IndicadorId], ultimoFin)}. Por habitante: ${cob(c["edu.despesa.por_habitante" as IndicadorId], ultimoFin)}. Por matrícula: ${cob(c["edu.despesa.aplicacao_direta_por_matricula" as IndicadorId], ultimoFin)}. Matrículas: ${cob(c["edu.matriculas.rede_municipal" as IndicadorId], ultimoFin, "total")}. Ideb anos iniciais: ${cob(c["edu.ideb.rede_municipal" as IndicadorId], 2025, "anos_iniciais")}; anos finais: ${cob(c["edu.ideb.rede_municipal" as IndicadorId], 2025, "anos_finais")}.`,
                  ],
                  ["Dados", `Coletados até ${dataBr(g.meta.dados_capturados_ate)}. ${inteiro(g.meta.observacoes)} observações, todas com estado e fonte.`],
                ].map(([t, d]) => (
                  <div key={t} className="bg-superficie px-4 py-4">
                    <dt className="rotulo text-mineral">{t}</dt>
                    <dd className="mt-1.5 leading-snug text-obee-tinta">{d}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <ComoLer g={g} />

            <PainelEducacao dados={dadosPainel(g)} contextos={ctx} />

            <Metodos g={g} ctx={ctx} />
          </div>
        )}
      </main>
    </>
  );
}
