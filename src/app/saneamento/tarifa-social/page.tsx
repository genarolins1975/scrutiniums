import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho } from "@/components/saneamento/Cabecalho";
import { Abertura, Fonte, Indisponivel, Nota, Numeros, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { fichas } from "@/lib/saneamento/gold";
import { capituloPorSlug, ROTA } from "@/lib/saneamento/capitulos";
import { calcularConta } from "@/lib/saneamento/conta";
import { TARIFAS } from "@/lib/saneamento/tarifas";
import { razaoPct } from "@/lib/saneamento/municipios";
import { inteiro, numero, reais } from "@/lib/saneamento/formato";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "A conta cabe no orçamento? A tarifa social chega a quem precisa?",
  description:
    "Regras da tarifa social da Lei 14.898/2024, o que os prestadores declararam ao SINISA 2024 sobre tarifa social, desconto efetivo nas tabelas verificadas e cenários de peso da conta na renda de famílias no limite de elegibilidade.",
  alternates: { canonical: "/saneamento/tarifa-social" },
};

/** Salário mínimo de 2026: Decreto 12.797, de 23/12/2025 (vigência em 01/01/2026). */
const SALARIO_MINIMO_2026 = 1621;
const LIMITE_PER_CAPITA = SALARIO_MINIMO_2026 / 2;
const CONSUMOS = [10, 15];
const FAMILIAS = [3, 4];

export default function Pagina() {
  const cap = capituloPorSlug("tarifa-social")!;

  // Declarações por vínculo prestador × município de água.
  let vinculos = 0;
  let semResposta = 0;
  let comSocial = 0;
  let economias = 0;
  let exigeCad = 0;
  let exigeRenda = 0;
  let volMaxInformado = 0;
  let volMaxAte15 = 0;
  const municipiosCom = new Set<string>();
  const municipiosAgua = new Set<string>();
  for (const f of fichas()) {
    for (const v of f.sinisa.prestadores ?? []) {
      if (v.servico !== "agua") continue;
      vinculos += 1;
      municipiosAgua.add(f.id);
      const t = v.tarifa ?? {};
      if (t.GFI1019 == null) semResposta += 1;
      if (t.GFI1019 !== "Sim") continue;
      comSocial += 1;
      municipiosCom.add(f.id);
      if (typeof t.GFI1036 === "number") economias += t.GFI1036;
      if (t.GFI1030 === "Sim") exigeCad += 1;
      if (t.GFI1033 === "Sim") exigeRenda += 1;
      if (typeof t.GFI1025 === "number") {
        volMaxInformado += 1;
        if (t.GFI1025 < 15) volMaxAte15 += 1;
      }
    }
  }

  // Tabelas verificadas: conta residencial e social para o mesmo consumo.
  const linhas = TARIFAS.flatMap((t) => {
    const res = t.categorias.residencial;
    if (!res) return [];
    return Object.entries(t.categorias)
      .filter(([k]) => k !== "residencial")
      .map(([k, cat]) => {
        // Sem esgoto verificado na categoria, compara só a água dos dois lados: nunca conta completa contra conta parcial.
        const soAgua = !cat.esgoto || !!cat.esgotoNaoVerificado || !res.esgoto || !!res.esgotoNaoVerificado;
        const porConsumo = CONSUMOS.map((c) => {
          const r = calcularConta(res, c);
          const x = calcularConta(cat, c);
          const vr = soAgua ? r.agua : r.total;
          const vs = soAgua ? x.agua : x.total;
          return { c, r: vr, s: vs, desconto: vr > 0 ? (1 - vs / vr) * 100 : null };
        });
        return {
          id: `${t.id}-${k}`,
          tarifa: t.id,
          prestador: t.prestador.replace(/^.*\(([^)]+)\)$/, "$1"),
          area: t.area,
          categoria: cat.rotulo,
          porConsumo,
          soAgua,
        };
      });
  });

  const cenarios = FAMILIAS.map((n) => ({ n, renda: n * LIMITE_PER_CAPITA }));

  return (
    <>
      <Cabecalho atual="tarifa-social" />
      <MarcaVisita secao="saneamento:tarifa-social" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          capitulo={6}
          titulo={cap.pergunta}
          texto={
            <p>
              A Lei 14.898/2024 criou regras nacionais para a tarifa social de água e esgoto. Antes dela, cada prestador definia a sua, com critérios
              e descontos próprios. Este capítulo mostra a regra legal, o que os prestadores declararam ao SINISA para 2024, o desconto efetivo nas
              tabelas verificadas e o peso da conta na renda de famílias no limite da elegibilidade.
            </p>
          }
          recorte={<>SINISA 2024: {inteiro(vinculos)} vínculos prestador × município de água; tabelas verificadas de cinco prestadores, vigentes em 2026.</>}
          situacao={cap.situacao}
          pendencia={cap.pendencia}
        />

        <Secao id="regra" titulo="O que a lei garante">
          <dl className="grid max-w-5xl grid-cols-1 gap-x-10 md:grid-cols-3">
            <div className="border-t border-linha py-4">
              <dt className="font-medium text-carvao">Quem tem direito</dt>
              <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">
                Usuários com renda per capita de até meio salário-mínimo, de família inscrita no Cadastro Único ou de família com pessoa com
                deficiência ou idosa de 65 anos ou mais que receba o Benefício de Prestação Continuada. O valor do BPC, entre outros benefícios listados na lei, não entra no cálculo
                da renda.
              </dd>
            </div>
            <div className="border-t border-linha py-4">
              <dt className="font-medium text-carvao">Desconto mínimo</dt>
              <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">50% sobre a tarifa da primeira faixa de consumo, aplicado aos primeiros 15 m³ do mês.</dd>
            </div>
            <div className="border-t border-linha py-4">
              <dt className="font-medium text-carvao">Limite de renda em 2026</dt>
              <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">
                Meio salário-mínimo: {reais(LIMITE_PER_CAPITA)} por pessoa, com o salário-mínimo de {reais(SALARIO_MINIMO_2026)} fixado pelo Decreto 12.797,
                de 23/12/2025.
              </dd>
            </div>
          </dl>
          <Fonte>Lei 14.898, de 13/06/2024, arts. 2º e 6º; Decreto 12.797/2025, conforme Ministério da Previdência Social, gov.br, publicação de 05/01/2026.</Fonte>
        </Secao>

        <Secao
          id="declaracoes"
          titulo="O que os prestadores declararam para 2024"
          texto="Respostas do formulário financeiro do SINISA para cada prestador em cada município atendido com água. Ano de referência 2024, antes de a lei produzir todos os efeitos."
        >
          <Numeros
            colunas={4}
            itens={[
              {
                rotulo: "Municípios com tarifa social de água declarada",
                valor: inteiro(municipiosCom.size),
                contexto: <>De {inteiro(municipiosAgua.size)} municípios com prestador de água declarado ({numero(razaoPct(municipiosCom.size, municipiosAgua.size), 1)}%).</>,
              },
              {
                rotulo: "Economias residenciais com tarifa social",
                valor: inteiro(economias),
                contexto: <>Soma do campo GFI1036 nos vínculos que declararam tarifa social.</>,
              },
              {
                rotulo: "Vínculos que exigem inscrição no CadÚnico",
                valor: inteiro(exigeCad),
                contexto: <>De {inteiro(comSocial)} vínculos com tarifa social; {inteiro(exigeRenda)} exigem comprovação de renda ao prestador.</>,
              },
              {
                rotulo: "Volume máximo com desconto abaixo de 15 m³",
                valor: inteiro(volMaxAte15),
                contexto: <>Vínculos, entre {inteiro(volMaxInformado)} que informaram o volume máximo (GFI1025).</>,
              },
            ]}
          />
          <Ressalva
            permite="Saber onde o prestador declara oferecer tarifa social, com que critérios e para quantas economias."
            naoPermite="Calcular a cobertura do benefício: falta o número de famílias elegíveis por município no mesmo período. Economias não são famílias, e vínculos sem resposta ficam fora."
          />
          <Nota>
            {inteiro(semResposta)} vínculos não responderam se há tarifa social. O valor médio declarado da tarifa social (GFI1037) tem registros
            incompatíveis com uma conta mensal, alguns acima de R$ 100 mil, e não é publicado aqui. A ficha de cada município mostra a declaração local.
          </Nota>
          <Fonte>Ministério das Cidades, SINISA 2025 (ano de referência 2024), informações financeiras por prestador e município, campos GFI1019 a GFI1037.</Fonte>
        </Secao>

        <Secao
          id="desconto"
          titulo="Quanto a tarifa social reduz a conta, nas tabelas verificadas?"
          texto="Conta mensal calculada com as tabelas vigentes em 2026, para a categoria residencial e cada categoria social ou de vulnerabilidade, no mesmo consumo. Água e esgoto quando as duas tabelas da categoria foram verificadas; só água, dos dois lados, quando não."
        >
          <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Desconto efetivo da tarifa social (rolável)">
            <table className="w-full min-w-[48rem] border-collapse text-sm">
              <caption className="sr-only">Conta residencial e social para 10 e 15 m³</caption>
              <thead>
                <tr className="border-b border-carvao text-right align-bottom">
                  <th scope="col" className="py-2 pr-4 text-left font-medium">Prestador e categoria</th>
                  {CONSUMOS.map((c) => (
                    <th key={c} scope="col" colSpan={3} className="py-2 pr-4 text-center font-medium">
                      {c} m³
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-linha text-right text-xs text-carvao-muted">
                  <th scope="col" className="py-1 pr-4 text-left font-normal">
                    <span className="sr-only">Categoria</span>
                  </th>
                  {CONSUMOS.flatMap((c) => [
                    <th key={`${c}r`} scope="col" className="py-1 pr-4 font-normal">Residencial</th>,
                    <th key={`${c}s`} scope="col" className="py-1 pr-4 font-normal">Categoria</th>,
                    <th key={`${c}d`} scope="col" className="py-1 pr-4 font-normal">Desconto</th>,
                  ])}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id} className="border-b border-linha text-right tabular-nums align-top">
                    <th scope="row" className="py-2 pr-4 text-left font-normal text-carvao">
                      <Link href={`${ROTA}/preco-regulado/simulador?t=${l.tarifa}`} className="underline decoration-linha underline-offset-4 hover:decoration-obee">
                        {l.prestador}
                      </Link>{" "}
                      · {l.categoria}
                      <span className="block text-xs text-carvao-muted">
                        {l.area}
                        {l.soAgua ? "; só água: esgoto da categoria não verificado" : "; água e esgoto"}
                      </span>
                    </th>
                    {l.porConsumo.flatMap((p) => [
                      <td key={`${p.c}r`} className="whitespace-nowrap py-2 pr-4">{reais(p.r)}</td>,
                      <td key={`${p.c}s`} className="whitespace-nowrap py-2 pr-4">{reais(p.s)}</td>,
                      <td key={`${p.c}d`} className="py-2 pr-4">{numero(p.desconto, 1)}%</td>,
                    ])}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Ressalva
            permite="Comparar o desconto efetivo na conta, no mesmo consumo, entre categorias e prestadores da amostra."
            naoPermite="Verificar a conformidade com a lei: a regra legal incide sobre a primeira faixa, e cada estrutura tarifária define faixas diferentes; categorias de vulnerabilidade podem ter critérios distintos da tarifa social da lei."
          />
          <Fonte>Tabelas tarifárias verificadas nos atos dos reguladores; mesma regra de cálculo do simulador (capítulo 5.1).</Fonte>
        </Secao>

        <Secao
          id="orcamento"
          titulo="Quanto a conta pesa na renda de uma família no limite?"
          texto={
            <>
              Cenário, não medida: família com renda per capita exatamente no limite da lei ({reais(LIMITE_PER_CAPITA)} em 2026), com {FAMILIAS.join(" ou ")}{" "}
              pessoas, consumindo 10 m³ por mês. Percentual da renda familiar mensal.
            </>
          }
        >
          <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Peso da conta na renda (rolável)">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <caption className="sr-only">Conta de 10 m³ como percentual da renda familiar no limite de elegibilidade</caption>
              <thead>
                <tr className="border-b border-carvao text-right align-bottom">
                  <th scope="col" className="py-2 pr-4 text-left font-medium">Prestador e categoria</th>
                  {cenarios.map((c) => (
                    <th key={c.n} scope="col" className="py-2 pr-4 font-medium">
                      {c.n} pessoas, renda de {reais(c.renda)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const conta = l.porConsumo.find((p) => p.c === 10);
                  return (
                    <tr key={l.id} className="border-b border-linha text-right tabular-nums">
                      <th scope="row" className="py-2 pr-4 text-left font-normal text-carvao">
                        {l.prestador} · {l.categoria}
                        {l.soAgua && <span className="text-xs text-carvao-muted"> (só água)</span>}
                        <span className="block text-xs text-carvao-muted">Residencial: {cenarios.map((c) => `${numero(razaoPct(conta?.r, c.renda), 1)}%`).join(" e ")}</span>
                      </th>
                      {cenarios.map((c) => (
                        <td key={c.n} className="py-2 pr-4">{numero(razaoPct(conta?.s, c.renda), 1)}%</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Ressalva
            permite="Dimensionar a ordem de grandeza da conta no orçamento de uma família elegível, com e sem a tarifa social."
            naoPermite="Afirmar que a conta cabe ou não cabe no orçamento de famílias reais: renda, tamanho da família e consumo variam, e não há limiar legal de comprometimento."
          />
        </Secao>

        <Secao id="cobertura" titulo="Quantas famílias elegíveis recebem o benefício?">
          <Indisponivel titulo="Elegíveis por município ainda não integrados">
            <p>
              A cobertura exige o número de famílias do CadÚnico com renda per capita até meio salário-mínimo e de beneficiários do BPC, por município,
              no mesmo período das economias com tarifa social. Esses dados não foram integrados; sem eles, o Observatório não calcula nem estima a
              cobertura.
            </p>
          </Indisponivel>
        </Secao>
      </main>
    </>
  );
}
