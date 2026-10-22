import type { Metadata } from "next";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { Abertura, Fonte, NestaPagina, Nota, Numeros, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { TabelaDados } from "@/components/saneamento/TabelaDados";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { TabelaOds } from "@/components/saneamento/ReferenciaMundial";
import { EscadaJmp } from "@/components/saneamento/Ilustracoes";
import { agregado, jmpPaises, meta } from "@/lib/saneamento/gold";
import {
  DEFINICOES_JMP,
  FONTE_BRASIL_ROTULO,
  INDICADORES_JMP,
  REGIAO_ODS_PT,
  RENDA_PT,
  conciliacao,
  fontesDoBrasil,
  grupos,
  medianaDoGrupo,
  posicao,
  valorJmp,
} from "@/lib/saneamento/internacional";
import { data, inteiro, numero, sinal } from "@/lib/saneamento/formato";
import type { PaisJmp } from "@/lib/saneamento/tipos";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "O Brasil em comparação internacional",
  description:
    "Água e esgotamento no Brasil e em outros países pelas estimativas do JMP (OMS e UNICEF), de 2000 a 2024: posição entre os países, comparação com a América Latina e a renda média alta, e por que os números diferem do Censo 2022 e do SINISA.",
  alternates: { canonical: "/saneamento/internacional" },
};

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const edicaoPt = (mes: string) => `${MESES[Number(mes.slice(5)) - 1]} de ${mes.slice(0, 4)}`;

export default function Pagina() {
  const { paises, brasil } = jmpPaises();
  const m = meta()?.jmp;
  const br = paises.find((p) => p.iso3 === "BRA");
  const agregadoBr = agregado("BR");
  const b2022 = brasil.find((e) => e.ano === 2022);
  if (!m || !br || !agregadoBr) {
    return (
      <>
        <header>
          <CabecalhoPlataforma colecao="saneamento" destinoConta="/saneamento" />
          <NavegacaoColecao colecao="saneamento" />
        </header>
        <main id="conteudo" className="ed-pagina pb-20 pt-8">
          <Abertura titulo="O Brasil em comparação internacional" texto={<p>Os dados do JMP não estão disponíveis nesta publicação.</p>} recorte={<>Sem dado.</>} />
        </main>
      </>
    );
  }

  const ANO = m.ano_comparado;
  const [aguaG, aguaB, esgG, esgB, ceu] = INDICADORES_JMP;
  const kpis = [aguaG, esgG, aguaB, esgB].map((ind) => {
    const v = valorJmp(br, ind)!;
    return { ind, v, pos: posicao(paises, ind, v) };
  });

  const serie = brasil.map((e) => ({
    ano: String(e.ano),
    agua_gerenciada: e.agua?.t.gerenciada ?? null,
    agua_basica: e.agua?.t.basica ?? null,
    esgoto_gerenciado: e.esgoto?.t.gerenciada ?? null,
    esgoto_basico: e.esgoto?.t.basica ?? null,
    ceu_aberto: e.esgoto?.t.ruim ?? null,
  }));

  const gs = grupos(paises);
  const alc = gs[1].membros;
  const barras = (ind: (typeof INDICADORES_JMP)[number]) =>
    alc
      .filter((p: PaisJmp) => p.nome_origem === "IBGE")
      .map((p: PaisJmp) => ({ iso3: p.iso3, nome: p.nome, v: valorJmp(p, ind) }))
      .filter((x): x is { iso3: string; nome: string; v: number } => x.v != null)
      .sort((a, b) => b.v - a.v);

  const linhasTabela = [...paises]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .map((p) => ({
      nome: p.nome,
      detalhe: p.nome_origem === "JMP" ? "nome em inglês, como no JMP" : null,
      regiao: p.regiao_ods ? REGIAO_ODS_PT[p.regiao_ods] ?? p.regiao_ods : null,
      renda: p.renda ? RENDA_PT[p.renda] ?? p.renda : null,
      populacao_mil: p.populacao_mil,
      agua_gerenciada: valorJmp(p, aguaG),
      agua_basica: valorJmp(p, aguaB),
      esgoto_gerenciado: valorJmp(p, esgG),
      esgoto_basico: valorJmp(p, esgB),
      ceu_aberto: valorJmp(p, ceu),
    }));

  const linhasConciliacao = b2022 ? conciliacao(agregadoBr, b2022) : [];
  const fontes = fontesDoBrasil(m.brasil_fontes);
  const fontes2022 = m.brasil_fontes.filter((f) => f.ano === 2022).map((f) => f.sigla);
  const totalFontes = m.brasil_fontes.length;
  const brasilFmt = (v: number | null | undefined) => (v == null ? "sem dado" : `${numero(v, 1)}%`);

  return (
    <>
      <header>
        <CabecalhoPlataforma colecao="saneamento" destinoConta="/saneamento" />
        <NavegacaoColecao colecao="saneamento" />
      </header>
      <MarcaVisita secao="saneamento:internacional" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          rotuloExtra="Ferramenta"
          titulo="O Brasil em comparação internacional"
          texto={
            <p>
              O Programa Conjunto de Monitoramento da OMS e do UNICEF (JMP) estima, para cada país e com as mesmas definições, quanta gente usa água e
              esgotamento em cada degrau de qualidade. Serve para situar o Brasil no mundo. Não substitui o Censo nem o SINISA, que medem outra coisa:
              a última seção mostra, lado a lado, por que os números não coincidem.
            </p>
          }
          recorte={
            <>
              JMP, base de domicílios, atualização de {edicaoPt(m.edicao_mes)}: estimativas anuais de {m.periodo[0]} a {m.periodo[1]} para {inteiro(m.areas)} países, áreas
              e territórios; comparação em {ANO}. Percentual da população.
            </>
          }
        />
        <NestaPagina
          itens={[
            { id: "definicoes", rotulo: "O que o JMP mede" },
            { id: "serie", rotulo: "Evolução desde 2000" },
            { id: "posicao", rotulo: "Posição entre os países" },
            { id: "conciliacao", rotulo: "JMP, Censo e SINISA" },
            { id: "ods", rotulo: "Outros indicadores dos ODS" },
          ]}
        />

        <Numeros
          colunas={4}
          itens={kpis.map(({ ind, v, pos }) => ({
            rotulo: `${ind.rotulo}, ${ANO}`,
            valor: `${numero(v, 1)}%`,
            contexto: (
              <>
                {inteiro(pos.melhores)} de {inteiro(pos.comEstimativa)} países e áreas com estimativa têm valor maior; {inteiro(pos.iguais)} igual (contando o Brasil) e{" "}
                {inteiro(pos.piores)} menor.
              </>
            ),
          }))}
        />

        <Secao
          id="definicoes"
          titulo="O que o JMP mede?"
          texto="Cada pessoa cai em um degrau do serviço. O degrau gerenciado com segurança está dentro do degrau pelo menos básico, que inclui quem tem o serviço melhor."
        >
          <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Definições dos degraus do JMP (rolável)">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <caption className="sr-only">Definições dos degraus de serviço de água e de esgotamento no JMP</caption>
              <thead>
                <tr className="border-b border-carvao text-left">
                  <th scope="col" className="py-2 pr-4 font-medium">Serviço</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Degrau</th>
                  <th scope="col" className="py-2 font-medium">Definição do JMP, tradução livre</th>
                </tr>
              </thead>
              <tbody>
                {DEFINICOES_JMP.map((d) => (
                  <tr key={`${d.servico}-${d.degrau}`} className="border-b border-linha align-top">
                    <td className="py-2 pr-4 text-carvao-muted">{d.servico}</td>
                    <th scope="row" className="py-2 pr-4 text-left font-normal text-carvao">{d.degrau}</th>
                    <td className="py-2 text-carvao">{d.definicao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-10">
            <EscadaJmp />
          </div>
          <Nota>
            As definições são as da aba Ladders do arquivo do JMP, traduzidas livremente; o texto oficial está em inglês. O JMP não mede a qualidade do
            serviço do prestador nem a continuidade do abastecimento: mede o que a população usa, a partir de pesquisas domiciliares, censos e registros
            administrativos de cada país.
          </Nota>
        </Secao>

        <Secao
          id="serie"
          titulo="Como o Brasil evoluiu desde 2000?"
          texto="Estimativas anuais do JMP para o total da população brasileira. Os anos intermediários vêm do modelo do JMP, não de uma pesquisa em cada ano."
        >
          <div className="grid grid-cols-1 gap-10 xl:grid-cols-2">
            <GraficoLinhas
              titulo="Água: população com serviço pelo menos básico e gerenciado com segurança (%)"
              dados={serie}
              chaveX="ano"
              formatoX="texto"
              series={[
                { id: "agua_basica", rotulo: "Pelo menos básica", cor: "var(--cor-obee)" },
                { id: "agua_gerenciada", rotulo: "Gerenciada com segurança", cor: "var(--escala-seq-3)", tracejada: true },
              ]}
              unidade="%"
              casas={1}
            />
            <GraficoLinhas
              titulo="Esgotamento: pelo menos básico, gerenciado com segurança e defecação a céu aberto (%)"
              dados={serie}
              chaveX="ano"
              formatoX="texto"
              series={[
                { id: "esgoto_basico", rotulo: "Pelo menos básico", cor: "var(--cor-obee)" },
                { id: "esgoto_gerenciado", rotulo: "Gerenciado com segurança", cor: "var(--escala-seq-3)", tracejada: true },
                { id: "ceu_aberto", rotulo: "Defecação a céu aberto", cor: "var(--escala-seq-5)" },
              ]}
              unidade="%"
              casas={1}
              zeroNoEixo
            />
          </div>
          <Ressalva
            permite="Ver a direção e o ritmo da melhora no Brasil segundo o JMP, com as mesmas definições em todos os anos."
            naoPermite="Ler cada ano como medida direta: as séries são estimadas por modelo a partir das pesquisas e censos disponíveis, e o JMP publica o ajuste (aba Regressions) separadamente."
          />
        </Secao>

        <Secao
          id="posicao"
          titulo="Onde o Brasil está entre os países?"
          texto={`Comparação em ${ANO}. A mediana de cada grupo é dos países com estimativa, sem ponderar pela população; o JMP não publica o agregado por grupo neste arquivo.`}
        >
          <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Brasil e mediana dos grupos (rolável)">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <caption className="sr-only">Valor do Brasil e mediana dos países por grupo, em {ANO}</caption>
              <thead>
                <tr className="border-b border-carvao text-right">
                  <th scope="col" className="py-2 pr-4 text-left font-medium">Indicador, {ANO}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Brasil</th>
                  {gs.map((g) => (
                    <th key={g.id} scope="col" className="py-2 pr-4 font-medium">Mediana: {g.rotulo}</th>
                  ))}
                  <th scope="col" className="py-2 font-medium">Brasil frente à mediana da América Latina e Caribe</th>
                </tr>
              </thead>
              <tbody>
                {INDICADORES_JMP.map((ind) => {
                  const v = valorJmp(br, ind);
                  const med = gs.map((g) => medianaDoGrupo(g, ind));
                  const bruta = v != null && med[1].valor != null ? v - med[1].valor : null;
                  const dif = bruta != null && Math.abs(bruta) < 0.05 ? 0 : bruta;
                  return (
                    <tr key={ind.id} className="border-b border-linha text-right tabular-nums">
                      <th scope="row" className="py-2 pr-4 text-left font-normal">{ind.rotulo}</th>
                      <td className="py-2 pr-4 text-carvao">{brasilFmt(v)}</td>
                      {med.map((x, i) => (
                        <td key={gs[i].id} className="py-2 pr-4">
                          {brasilFmt(x.valor)}
                          <span className="block text-xs text-carvao-muted">{inteiro(x.n)} áreas</span>
                        </td>
                      ))}
                      <td className="py-2">{dif == null ? "sem dado" : `${sinal(dif, 1)} p.p.`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-10 xl:grid-cols-2">
            {[aguaG, esgG].map((ind) => (
              <GraficoBarras
                key={ind.id}
                titulo={`Países da América Latina e Caribe: ${ind.rotulo.toLowerCase()}, ${ANO} (% da população)`}
                dados={barras(ind)}
                chaveCategoria="iso3"
                chaveRotulo="nome"
                series={[{ id: "v", rotulo: "% da população", cor: "var(--cor-obee)" }]}
                unidade="%"
                casas={1}
                orientacao="horizontal"
                rotulosValor
                selecionado="BRA"
                limiteInicial={12}
              />
            ))}
          </div>
          <Nota>
            Os gráficos mostram só os países da América Latina e Caribe que o IBGE lista; territórios sem estatuto de país, como Porto Rico e a Guiana Francesa,
            aparecem na tabela e entram nas medianas e na posição.
          </Nota>
          <Ressalva
            permite="Situar o Brasil entre os países nas mesmas definições do JMP e ver a distância para a mediana da região e do grupo de renda."
            naoPermite={`Concluir que o serviço prestado é melhor ou pior: o JMP mede o uso pela população, e a posição depende das pesquisas de cada país. Só ${inteiro(m.com_agua_gerenciada)} de ${inteiro(m.areas)} áreas têm estimativa de água gerenciada com segurança e ${inteiro(m.com_esgoto_gerenciado)} de esgotamento; as demais ficam fora desses indicadores, e territórios sem estatuto de país entram na lista.`}
          />
          <TabelaDados
            titulo="Todos os países e áreas do JMP"
            arquivo={`saneamento-jmp-paises-${ANO}.csv`}
            colunas={[
              { id: "nome", rotulo: "País ou área", detalhe: "detalhe" },
              { id: "regiao", rotulo: "Região (ODS)" },
              { id: "renda", rotulo: "Faixa de renda" },
              { id: "populacao_mil", rotulo: "População (mil)", tipo: "inteiro" },
              { id: "agua_gerenciada", rotulo: "Água gerenciada com segurança", tipo: "pct" },
              { id: "agua_basica", rotulo: "Água pelo menos básica", tipo: "pct" },
              { id: "esgoto_gerenciado", rotulo: "Esgotamento gerenciado com segurança", tipo: "pct" },
              { id: "esgoto_basico", rotulo: "Esgotamento pelo menos básico", tipo: "pct" },
              { id: "ceu_aberto", rotulo: "Defecação a céu aberto", tipo: "pct" },
            ]}
            linhas={linhasTabela}
            ordemInicial={{ coluna: "esgoto_gerenciado", direcao: "desc" }}
            rotuloLinhas={{ singular: "país ou área", plural: "países e áreas" }}
          />
        </Secao>

        <Secao
          id="conciliacao"
          titulo="Por que os números do JMP não coincidem com o Censo e o SINISA?"
          texto="Mesmo ano, perguntas parecidas, definições diferentes. A tabela põe o JMP de 2022 ao lado do Censo 2022 e, quando há equivalente, do SINISA 2024; nenhuma linha é a mesma medida."
        >
          <div className="tabela-scroll" tabIndex={0} role="region" aria-label="JMP, Censo 2022 e SINISA lado a lado (rolável)">
            <table className="w-full min-w-[56rem] border-collapse text-sm">
              <caption className="sr-only">JMP 2022, Censo 2022 e SINISA 2024 para perguntas parecidas</caption>
              <thead>
                <tr className="border-b border-carvao text-left">
                  <th scope="col" className="py-2 pr-4 font-medium">JMP, 2022</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Censo, 2022</th>
                  <th scope="col" className="py-2 pr-4 font-medium">SINISA, 2024</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">JMP menos Censo</th>
                  <th scope="col" className="py-2 font-medium">O que muda entre as medidas</th>
                </tr>
              </thead>
              <tbody>
                {linhasConciliacao.map((l) => (
                  <tr key={l.id} className="border-b border-linha align-top">
                    <td className="py-2 pr-4">
                      <span className="block text-carvao-muted">{l.rotulo}: {l.jmp.rotulo.toLowerCase()}</span>
                      <span className="tabular-nums text-carvao">{brasilFmt(l.jmp.valor)}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="block text-carvao-muted">{l.censo.rotulo}</span>
                      <span className="tabular-nums text-carvao">{brasilFmt(l.censo.valor)}</span>
                    </td>
                    <td className="py-2 pr-4">
                      {l.sinisa ? (
                        <>
                          <span className="block text-carvao-muted">{l.sinisa.rotulo}</span>
                          <span className="tabular-nums text-carvao">{brasilFmt(l.sinisa.valor)}</span>
                        </>
                      ) : (
                        <span className="text-carvao-muted">sem equivalente</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{l.diferenca == null ? "sem dado" : `${sinal(l.diferenca, 1)} p.p.`}</td>
                    <td className="py-2 text-xs leading-relaxed text-carvao-muted">{l.nota}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Ressalva
            permite="Entender de onde vem a distância entre o que o JMP publica para o Brasil e o que o Censo 2022 e o SINISA mostram, e usar cada número para o que ele mede."
            naoPermite="Dizer que uma das fontes está errada ou escolher a que \u201cvale\u201d: são populações, perguntas e métodos diferentes. O Censo conta moradores de domicílios particulares permanentes ocupados; o JMP, a população total estimada; o SINISA, população atendida declarada pelos prestadores."
          />
          <Nota titulo="Fontes que o JMP usa para o Brasil">
            Na aba Data Summary do arquivo do Brasil, o JMP lista {inteiro(totalFontes)} fontes desde {Math.min(...m.brasil_fontes.map((f) => f.ano))}:{" "}
            {fontes.map((f) => `${f.rotulo} (${inteiro(f.n)})`).join(", ")}. Em 2022, as fontes listadas são {fontes2022.map((s) => FONTE_BRASIL_ROTULO[s] ?? s).sort((a, b) => a.localeCompare(b, "pt-BR")).join(", ")}. O arquivo não informa o
            peso de cada uma na estimativa de cada ano.
          </Nota>
          <Fonte>
            WHO/UNICEF Joint Monitoring Programme for Water Supply, Sanitation and Hygiene (JMP), base de domicílios, atualização de {edicaoPt(m.edicao_mes)}
            , capturada em {data(m.capturado_em)}; nomes de países em português da API de países do IBGE (os {inteiro(m.sem_nome_ibge.length)} territórios que o IBGE não
            lista ficam com o nome em inglês do JMP); IBGE, Censo Demográfico 2022; Ministério das Cidades, SINISA 2025 (ano de referência 2024). Arquivo em{" "}
            <a className="text-obee-dark underline" href="/saneamento/gold/jmp_paises.csv">jmp_paises.csv</a>.
          </Fonte>
        </Secao>

        <Secao
          id="ods"
          titulo="Além do acesso: o que mais os ODS medem sobre água e saneamento?"
          texto="A base global dos Objetivos de Desenvolvimento Sustentável reúne, com definição única, indicadores de esgoto tratado, qualidade dos corpos d'água, estresse hídrico, gestão da água, ajuda internacional e mortalidade. Cada um aparece também no capítulo que mede algo parecido no Brasil, com a nota do que muda."
        >
          <TabelaOds />
        </Secao>
      </main>
    </>
  );
}
