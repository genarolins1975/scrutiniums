import { rotuloSinisa } from "@/lib/saneamento/edicao";
import type { Metadata } from "next";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { Abertura, Fonte, Indisponivel, NestaPagina, Nota, Numeros, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { TabelaDados } from "@/components/saneamento/TabelaDados";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { FiguraOds, MundoNoCapitulo } from "@/components/saneamento/ReferenciaMundial";
import { agregado, agregados, fichas, municipios } from "@/lib/saneamento/gold";
import { capituloPorSlug, ROTA } from "@/lib/saneamento/capitulos";
import { inteiro } from "@/lib/saneamento/formato";
import { MANANCIAL } from "@/lib/saneamento/respostas";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "O serviço está preparado para secas e eventos extremos?",
  description:
    `Interrupções sistemáticas por baixa disponibilidade do manancial e dias de colapso do sistema de água declarados pelos prestadores ao ${rotuloSinisa()}, por UF e município.`,
  alternates: { canonical: "/saneamento/resiliencia" },
};


export default function Pagina() {
  const cap = capituloPorSlug("resiliencia")!;
  const br = agregado("BR");
  const c = br?.continuidade;
  const ufs = agregados().filter((a) => a.tipo === "UF");
  const pop = new Map(municipios().map((m) => [m.id, m]));
  const todas = fichas();

  const motivos = Object.entries(c?.motivos_interrupcoes ?? {}).map(([k, v]) => ({ id: k, rotulo: k === "Outro (especificar)" ? "Outro" : k, v }));
  // A gold só soma o motivo de quem declarou interrupção e informou o motivo; quem declarou sem informar fica numa barra própria,
  // para que as barras fechem com os municípios com interrupção sistemática.
  const semMotivo = (c?.municipios_com_interrupcoes ?? 0) - motivos.reduce((s, m) => s + m.v, 0);
  if (semMotivo > 0) motivos.push({ id: "sem-motivo", rotulo: "Sem motivo informado", v: semMotivo });
  const manancialUf = ufs
    .map((u) => ({ id: u.id, rotulo: u.nome, v: u.continuidade.motivos_interrupcoes[MANANCIAL] ?? 0 }))
    .filter((u) => u.v > 0)
    .sort((a, b) => b.v - a.v);

  const linha = (f: (typeof todas)[number]) => {
    const t = f.sinisa.agua.tecnica ?? {};
    return {
      municipio: f.nome,
      uf: f.uf,
      href: `${ROTA}/municipio/${f.id}`,
      moradores: pop.get(f.id)?.pop22 ?? null,
      colapso: t.GTA3006 ?? null,
      interrupcoes: t.GTA3003 ?? null,
      horas: t.GTA3008 ?? null,
      motivo: (t.GTA3003 ?? 0) > 0 ? f.sinisa.agua.motivo_interrupcoes ?? null : null,
    };
  };
  const comColapso = todas.filter((f) => (f.sinisa.agua.tecnica?.GTA3006 ?? 0) > 0).map(linha);
  const porManancial = todas
    .filter((f) => (f.sinisa.agua.tecnica?.GTA3003 ?? 0) > 0 && f.sinisa.agua.motivo_interrupcoes === MANANCIAL)
    .map(linha);
  const moradoresManancial = porManancial.reduce((s, l) => s + (l.moradores ?? 0), 0);

  return (
    <>
      <header>
        <CabecalhoPlataforma colecao="saneamento" destinoConta="/saneamento" />
        <NavegacaoColecao colecao="saneamento" />
      </header>
      <MarcaVisita secao="saneamento:resiliencia" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          capitulo={14}
          titulo={cap.pergunta}
          texto={
            <p>
              Seca e escassez aparecem no SINISA de forma indireta: o motivo declarado para o racionamento e os dias em que o sistema ficou em colapso.
              É o que existe de público e municipal sobre o tema no sistema nacional. Mananciais e bacias ainda não foram integrados; os desastres
              reconhecidos pela União, como secas e estiagens, estão no <a href="/territorio/desastres" className="underline decoration-linha underline-offset-4">painel de desastres</a> do Território e Clima, por estado e tipo.
            </p>
          }
          recorte={<>{inteiro(c?.municipios_participantes)} municípios do módulo de água do {rotuloSinisa()}; motivo informado só por quem declarou interrupção sistemática.</>}
          situacao={cap.situacao}
          pendencia={cap.pendencia}
        />
        <NestaPagina
          itens={[
            { id: "motivos", rotulo: "Motivos do racionamento" },
            { id: "manancial", rotulo: "Falta de água bruta" },
            { id: "colapso", rotulo: "Colapso do sistema" },
            { id: "mundo", rotulo: "Estresse hídrico" },
            { id: "lacunas", rotulo: "O que ainda falta" },
          ]}
        />

        <Numeros
          colunas={3}
          itens={[
            {
              rotulo: "Municípios com racionamento atribuído à baixa disponibilidade do manancial",
              valor: inteiro(porManancial.length),
              contexto: <>{inteiro(moradoresManancial)} moradores nesses municípios (Censo 2022), não necessariamente todos atingidos.</>,
            },
            {
              rotulo: "Municípios com dias de colapso do sistema",
              valor: inteiro(comColapso.length),
              contexto: <>De {inteiro(c?.municipios_informaram_colapso)} que informaram o campo GTA3006.</>,
            },
            {
              rotulo: "Dias de colapso somados",
              valor: inteiro(c?.dias_colapso),
              contexto: <>Soma municipal; o mesmo dia em dois municípios conta duas vezes.</>,
            },
          ]}
        />

        <Secao
          id="motivos"
          titulo="Por que houve racionamento?"
          texto={`Motivo principal declarado pelo prestador para as interrupções sistemáticas, em número de municípios. Um município, um motivo.${semMotivo > 0 ? " A última barra reúne quem declarou interrupção sem informar o motivo." : ""}`}
        >
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            <GraficoBarras
              titulo="Municípios com interrupção sistemática, por motivo declarado (Brasil)"
              dados={motivos}
              chaveCategoria="id"
              chaveRotulo="rotulo"
              series={[{ id: "v", rotulo: "municípios", cor: "var(--cor-obee)" }]}
              unidade="municípios"
              casas={0}
              orientacao="horizontal"
              rotulosValor
            />
            <GraficoBarras
              titulo="Municípios com racionamento por baixa disponibilidade do manancial, por UF"
              dados={manancialUf}
              chaveCategoria="id"
              chaveRotulo="rotulo"
              series={[{ id: "v", rotulo: "municípios", cor: "var(--escala-seq-4)" }]}
              unidade="municípios"
              casas={0}
              orientacao="horizontal"
              rotulosValor
              limiteInicial={14}
            />
          </div>
          <Ressalva
            permite="Separar o racionamento atribuído à falta de água bruta daquele atribuído a sistema insuficiente de produção ou de distribuição."
            naoPermite="Atribuir o evento à mudança do clima nem medir a gravidade da seca: o motivo é escolhido pelo prestador numa lista fechada, e muitos marcaram outro motivo ou remeteram ao dado por prestador."
          />
          <Fonte>Ministério das Cidades, {rotuloSinisa()}, base municipal de água, campos GTA3003 e GTA3004.</Fonte>
        </Secao>

        <Secao
          id="manancial"
          titulo="Onde a falta de água bruta levou a racionamento?"
          texto="Municípios cujo prestador atribuiu as interrupções sistemáticas de 2024 à baixa disponibilidade do manancial."
        >
          <TabelaDados
            titulo="Municípios com racionamento por baixa disponibilidade do manancial"
            arquivo="saneamento-racionamento-manancial-2024.csv"
            colunas={[
              { id: "municipio", rotulo: "Município", href: "href" },
              { id: "uf", rotulo: "UF" },
              { id: "moradores", rotulo: "Moradores (Censo 2022)", tipo: "inteiro" },
              { id: "interrupcoes", rotulo: "Interrupções", tipo: "inteiro" },
              { id: "horas", rotulo: "Horas somadas", tipo: "inteiro" },
              { id: "colapso", rotulo: "Dias de colapso", tipo: "inteiro" },
            ]}
            linhas={porManancial}
            ordemInicial={{ coluna: "horas", direcao: "desc" }}
            rotuloLinhas={{ singular: "município", plural: "municípios" }}
          />
        </Secao>

        <Secao
          id="colapso"
          titulo="Onde o sistema chegou ao colapso?"
          texto="Municípios com dias em que o prestador declarou o sistema de abastecimento em colapso, com o motivo do racionamento quando houve."
        >
          <TabelaDados
            titulo="Municípios com dias de colapso"
            arquivo="saneamento-colapso-2024.csv"
            colunas={[
              { id: "municipio", rotulo: "Município", href: "href" },
              { id: "uf", rotulo: "UF" },
              { id: "moradores", rotulo: "Moradores (Censo 2022)", tipo: "inteiro" },
              { id: "colapso", rotulo: "Dias de colapso", tipo: "inteiro" },
              { id: "interrupcoes", rotulo: "Interrupções sistemáticas", tipo: "inteiro" },
              { id: "motivo", rotulo: "Motivo do racionamento" },
            ]}
            linhas={comColapso}
            ordemInicial={{ coluna: "colapso", direcao: "desc" }}
            rotuloLinhas={{ singular: "município", plural: "municípios" }}
          />
          <Ressalva
            permite="Localizar onde o próprio prestador reconhece falha completa do sistema e por quantos dias."
            naoPermite="Comparar a resiliência entre municípios: cada prestador aplica o conceito de colapso ao próprio sistema, e quem não registra aparece com zero ou sem dado."
          />
          <Nota>Zero declarado entra como zero; município que não informou o campo fica fora da contagem.</Nota>
        </Secao>

        <Secao
          id="mundo"
          titulo="O Brasil tem estresse hídrico?"
          texto="A FAO mede, para cada país, quanto da água doce disponível é retirada por todos os usos. É a régua internacional de pressão sobre a água; a média nacional não mostra a bacia nem o município, onde o racionamento acontece."
        >
          <MundoNoCapitulo>
            <FiguraOds codigo="ER_H2O_STRESS" />
          </MundoNoCapitulo>
        </Secao>

        <Secao id="lacunas" titulo="O que ainda não está aqui">
          <Indisponivel titulo="Mananciais, eventos extremos e contingência">
            <p>
              Disponibilidade hídrica dos mananciais (ANA), alertas do Cemaden e planos de contingência dos prestadores ainda não foram integrados.
              Os reconhecimentos de situação de emergência por estiagem e inundação estão no painel de desastres do Território e Clima, por estado, sem
              cruzamento com o município de cada prestador. Sem eles, o capítulo não mede exposição nem preparo; mostra
              apenas os eventos que os prestadores declararam.
            </p>
          </Indisponivel>
        </Secao>
      </main>
    </>
  );
}
