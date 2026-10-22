import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { Abertura, Fonte, Indisponivel, NestaPagina, Nota, Numeros, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { TabelaDados } from "@/components/saneamento/TabelaDados";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { agregado, agregados, municipios, reguladores } from "@/lib/saneamento/gold";
import { capituloPorSlug, ROTA } from "@/lib/saneamento/capitulos";
import { razaoPct } from "@/lib/saneamento/municipios";
import { inteiro, numero } from "@/lib/saneamento/formato";
import atos from "@/lib/saneamento/dados/atos.json";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Quem responde pelas metas, fiscaliza e atende o cidadão?",
  description:
    "Titular, prestador e regulador de cada município; catálogo das entidades reguladoras declaradas ao SINISA 2024 por CNPJ; conselhos, ouvidorias e consórcios declarados pelos municípios.",
  alternates: { canonical: "/saneamento/responsaveis" },
};

const PAPEIS = [
  { quem: "Município (titular)", faz: "É dono do serviço: planeja, decide como prestar, delega por contrato e define a entidade reguladora. Responde pelo plano municipal." },
  { quem: "Prestador", faz: "Opera os sistemas, cobra a tarifa, investe conforme o contrato e informa os dados ao SINISA. Responde pelas metas contratuais." },
  { quem: "Entidade reguladora", faz: "Fixa tarifas e reajustes, fiscaliza o contrato, verifica metas e recebe reclamações em segunda instância. Pode ser municipal, intermunicipal ou estadual." },
  { quem: "ANA", faz: "Edita normas de referência nacionais para a regulação (como a NR 8/2024, que define como medir as metas). Não regula contratos diretamente." },
];

export default function Pagina() {
  const nPrestadoresAtos = new Set((atos as { atos: { prestador: string }[] }).atos.map((a) => a.prestador)).size;
  const cap = capituloPorSlug("responsaveis")!;
  const br = agregado("BR");
  const g = br?.gestao;
  const ufs = agregados().filter((a) => a.tipo === "UF");
  const regs = reguladores();
  const lista = municipios();
  const respondentes = lista.filter((m) => m.gm_respondeu === "Sim");
  const semRegAgua = respondentes.filter((m) => m.reg_ag == null).length;
  // A tabela por UF conta quem respondeu Sim à pergunta de regulação; o número ao lado conta quem informou a entidade. Quem respondeu
  // Sim sem informar a entidade está nos dois.
  const simSemEntidade = Math.max(0, (g?.regulacao_agua_sim ?? 0) - (respondentes.length - semRegAgua));
  const porAbr = (a: string) => regs.filter((r) => r.abrangencia === a).length;

  const linhasReg = regs.map((r) => ({
    nome: r.sigla ? `${r.sigla}` : r.nome,
    nomeCompleto: r.sigla ? r.nome : null,
    abrangencia: r.abrangencia,
    ufs: r.ufs.join(", "),
    mun_agua: r.municipios_agua.length,
    mun_esgoto: r.municipios_esgoto.length,
    cnpj: r.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"),
  }));

  const linhasUf = ufs.map((u) => {
    const x = u.gestao;
    return {
      uf: u.nome,
      respondentes: x.respondentes,
      regulacao_agua: razaoPct(x.regulacao_agua_sim, x.respondentes),
      regulacao_esgoto: razaoPct(x.regulacao_esgoto_sim, x.respondentes),
      conselho: razaoPct(x.conselho_especifico_sim, x.respondentes),
      ouvidoria: razaoPct(x.ouvidoria_sim, x.respondentes),
      consorcio: razaoPct(x.consorcio_sim, x.respondentes),
    };
  });

  return (
    <>
      <header>
        <CabecalhoPlataforma colecao="saneamento" destinoConta="/saneamento" />
        <NavegacaoColecao colecao="saneamento" />
      </header>
      <MarcaVisita secao="saneamento:responsaveis" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          capitulo={12}
          titulo={cap.pergunta}
          texto={
            <p>
              A meta de universalização tem mais de um responsável. O município é o titular do serviço; o prestador executa; a entidade reguladora
              fixa preço e fiscaliza; a ANA define a régua nacional. Este capítulo mostra o que o SINISA registra sobre cada papel e quais canais de
              controle social os municípios declaram ter.
            </p>
          }
          recorte={<>Módulo Gestão Municipal do SINISA 2024: {inteiro(g?.respondentes)} municípios responderam; {inteiro(g?.nao_respondentes)} não responderam.</>}
          situacao={cap.situacao}
          pendencia={cap.pendencia}
        />
        <NestaPagina
          itens={[
            { id: "papeis", rotulo: "Quem faz o quê" },
            { id: "reguladores", rotulo: "Reguladores" },
            { id: "controle-social", rotulo: "Controle social" },
            { id: "fiscalizacao", rotulo: "Fiscalização e sanções" },
          ]}
        />

        <Numeros
          colunas={4}
          itens={[
            {
              rotulo: "Entidades reguladoras declaradas, por CNPJ",
              valor: inteiro(regs.length),
              contexto: (
                <>
                  {inteiro(porAbr("Estadual (ou distrital)"))} estaduais ou distrital, {inteiro(porAbr("Intermunicipal"))} intermunicipais e{" "}
                  {inteiro(porAbr("Municipal"))} municipais.
                </>
              ),
            },
            {
              rotulo: "Respondentes sem entidade reguladora declarada para água",
              valor: inteiro(semRegAgua),
              contexto: (
                <>
                  {numero(razaoPct(semRegAgua, respondentes.length), 1)}% dos {inteiro(respondentes.length)} municípios que responderam.
                  {simSemEntidade > 0 && (
                    <>
                      {" "}
                      Inclui {inteiro(simSemEntidade)} {simSemEntidade === 1 ? "município que respondeu" : "municípios que responderam"} Sim à pergunta
                      de regulação sem informar a entidade; a tabela por UF conta pela resposta.
                    </>
                  )}
                </>
              ),
            },
            {
              rotulo: "Com conselho específico de saneamento",
              valor: inteiro(g?.conselho_especifico_sim),
              contexto: <>{numero(razaoPct(g?.conselho_especifico_sim, g?.respondentes), 1)}% dos respondentes.</>,
            },
            {
              rotulo: "Com ouvidoria para saneamento",
              valor: inteiro(g?.ouvidoria_sim),
              contexto: <>{numero(razaoPct(g?.ouvidoria_sim, g?.respondentes), 1)}% dos respondentes.</>,
            },
          ]}
        />

        <Secao id="papeis" titulo="Quem faz o quê">
          <dl className="grid max-w-5xl grid-cols-1 gap-x-10 md:grid-cols-2">
            {PAPEIS.map((p) => (
              <div key={p.quem} className="border-t border-linha py-4">
                <dt className="font-serif text-lg text-carvao">{p.quem}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">{p.faz}</dd>
              </div>
            ))}
          </dl>
          <Nota>
            Para ver o prestador, o instrumento, a vigência e o regulador declarados de um município, use{" "}
            <Link href={`${ROTA}/municipio`} className="text-obee-dark underline underline-offset-2">
              Meu município
            </Link>
            . Base legal: Lei 11.445/2007, com a redação da Lei 14.026/2020.
          </Nota>
        </Secao>

        <Secao
          id="reguladores"
          titulo="Catálogo de entidades reguladoras"
          texto="Entidades declaradas pelos municípios no módulo Gestão Municipal, unificadas pelo CNPJ (o mesmo regulador aparece com várias grafias de nome). Contagem de municípios que a declararam para cada serviço."
        >
          <TabelaDados
            titulo="Entidades reguladoras"
            arquivo="saneamento-reguladores-2024.csv"
            colunas={[
              { id: "nome", rotulo: "Entidade", detalhe: "nomeCompleto" },
              { id: "abrangencia", rotulo: "Abrangência" },
              { id: "ufs", rotulo: "UFs dos municípios" },
              { id: "mun_agua", rotulo: "Municípios, água", tipo: "inteiro" },
              { id: "mun_esgoto", rotulo: "Municípios, esgoto", tipo: "inteiro" },
              { id: "cnpj", rotulo: "CNPJ" },
            ]}
            linhas={linhasReg}
            ordemInicial={{ coluna: "mun_agua", direcao: "desc" }}
            rotuloLinhas={{ singular: "entidade", plural: "entidades" }}
          />
          <Ressalva
            permite="Saber quais entidades os municípios declaram como reguladoras e quantos municípios cada uma alcança."
            naoPermite="Confirmar que existe contrato de delegação da regulação nem avaliar a atuação da entidade: o SINISA registra a declaração do município. Quando a UF de um município difere da sede do regulador, a declaração pode estar errada ou refletir convênio."
          />
          <Fonte>Ministério das Cidades, SINISA 2025 (ano de referência 2024), módulo Gestão Municipal, aba Detalhamento Reguladores.</Fonte>
        </Secao>

        <Secao id="controle-social" titulo="Que canais de controle social os municípios declaram?" texto="Proporção dos municípios respondentes de cada UF que declararam regulação, conselho específico, ouvidoria e participação em consórcio.">
          <TabelaDados
            titulo="Governança declarada por UF"
            arquivo="saneamento-governanca-uf-2024.csv"
            colunas={[
              { id: "uf", rotulo: "UF" },
              { id: "respondentes", rotulo: "Respondentes", tipo: "inteiro" },
              { id: "regulacao_agua", rotulo: "Regulação de água", tipo: "pct" },
              { id: "regulacao_esgoto", rotulo: "Regulação de esgoto", tipo: "pct" },
              { id: "conselho", rotulo: "Conselho específico", tipo: "pct" },
              { id: "ouvidoria", rotulo: "Ouvidoria", tipo: "pct" },
              { id: "consorcio", rotulo: "Consórcio", tipo: "pct" },
            ]}
            linhas={linhasUf}
            limite={27}
            busca={false}
            rotuloLinhas={{ singular: "UF", plural: "UFs" }}
          />
          <Ressalva
            permite="Comparar a presença declarada de instâncias de regulação e de participação entre UFs."
            naoPermite="Avaliar se os conselhos se reúnem ou se a ouvidoria resolve reclamações: o formulário pergunta só se existem."
          />
        </Secao>

        <Secao id="fiscalizacao" titulo="Fiscalizações, sanções e reclamações">
          <Indisponivel titulo="Atos dos reguladores ainda não integrados">
            <p>
              Relatórios de fiscalização, autos de infração, sanções e estatísticas de ouvidoria ficam nos portais de cada regulador, em formatos
              diferentes. Não há base nacional. O capítulo 5.3 já cataloga os atos tarifários verificados de {nPrestadoresAtos} prestadores; os demais atos não foram
              coletados.
            </p>
          </Indisponivel>
        </Secao>
      </main>
    </>
  );
}
