import type { Metadata } from "next";
import { Cabecalho } from "@/components/saneamento/Cabecalho";
import { Abertura, Fonte, Nota, Numeros, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { AtlasMunicipal } from "@/components/saneamento/AtlasMunicipal";
import { TabelaDados } from "@/components/saneamento/TabelaDados";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { agregado, agregados, meta, municipiosComDesigualdades, URL_DESIGUALDADES_MUNICIPIOS } from "@/lib/saneamento/gold";
import { referencias } from "@/lib/saneamento/referencias";
import { MEDIDAS_DESIGUALDADES } from "@/lib/saneamento/medidas";
import { capituloPorSlug } from "@/lib/saneamento/capitulos";
import { razaoPct } from "@/lib/saneamento/municipios";
import { inteiro, numero } from "@/lib/saneamento/formato";
import ESPECIFICACOES from "@/lib/saneamento/dados/desigualdades.json";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Quem fica para trás no saneamento?",
  description: "Desigualdades de acesso à água e ao esgoto por cor ou raça, entre quilombolas, indígenas e em favelas, com universos explícitos do Censo 2022.",
  alternates: { canonical: "/saneamento/desigualdades" },
};

export default function Pagina() {
  const cap = capituloPorSlug("desigualdades")!;
  const br = agregado("BR");
  const ags = agregados();
  const lista = municipiosComDesigualdades();
  const auditoria = meta()?.desigualdades;
  const residuo = auditoria?.residuos_cor_raca;
  const divergencias = auditoria?.conferencias.filter((c) => c.diferenca !== 0 && c.diferenca != null) ?? [];
  const captura = auditoria ? new Date(auditoria.proveniencia.capturado_em).toLocaleDateString("pt-BR", {timeZone:"UTC"}) : "sem data";
  const ids = MEDIDAS_DESIGUALDADES.map((m) => m.id);
  const refs = referencias(ags, lista, ids);
  const proporcao = (id: string) => {
    const [n, d] = br?.desigualdades?.[id] ?? [null, null];
    return razaoPct(n, d);
  };
  const racas = ESPECIFICACOES.filter((s) => s.tabela === 6894);
  const linhas = ags.filter((a) => a.id === "BR" || a.tipo === "UF").flatMap((a) => ESPECIFICACOES.map((s) => {
    const [n, d] = a.desigualdades?.[s.id] ?? [null, null];
    return { territorio: a.nome, grupo: s.rotulo, indicador: s.medida === "agua" ? "Sem ligação à rede de água" : "Sem rede nem fossa séptica", unidade: s.unidade, carencia: n, universo: d, pct: razaoPct(n, d), tabela: String(s.tabela), periodo: "2022" };
  }));
  const cobertura = ESPECIFICACOES.map((s) => ({
    grupo: s.rotulo, indicador: s.medida === "agua" ? "Água" : "Esgoto", unidade: s.unidade,
    municipios: lista.filter((m) => m[`des_${s.id}_num`] != null && (m[`des_${s.id}_den`] ?? 0) > 0).length,
  }));
  return <>
    <Cabecalho atual="desigualdades" />
    <MarcaVisita secao="saneamento:desigualdades" />
    <main id="conteudo" className="ed-pagina pb-20 pt-8">
      <Abertura capitulo={2} titulo={cap.pergunta}
        texto={<p>Entre moradores de cor ou raça parda, {numero(proporcao("parda-esgoto"), 1)}% viviam sem rede nem fossa séptica. Entre moradores de cor ou raça branca, eram {numero(proporcao("branca-esgoto"), 1)}%. O Censo permite observar diferenças entre grupos no mesmo ano. Não identifica a causa dessas diferenças.</p>}
        recorte="Censo Demográfico 2022. Moradores em domicílios particulares permanentes ocupados; na medida de água em favelas, a unidade é domicílio. Brasil, UFs e municípios com resultado disponível."
        situacao={cap.situacao} pendencia={cap.pendencia} />
      <Numeros colunas={2} itens={[
        { rotulo: "Sem ligação à rede de água, cor ou raça parda", valor: `${numero(proporcao("parda-agua"),1)}%`, contexto: `Brasil, Censo 2022, SIDRA 6894. ${inteiro(br?.desigualdades?.["parda-agua"]?.[0])} de ${inteiro(br?.desigualdades?.["parda-agua"]?.[1])} moradores.` },
        { rotulo: "Sem ligação à rede de água, cor ou raça branca", valor: `${numero(proporcao("branca-agua"),1)}%`, contexto: `Brasil, Censo 2022, SIDRA 6894. ${inteiro(br?.desigualdades?.["branca-agua"]?.[0])} de ${inteiro(br?.desigualdades?.["branca-agua"]?.[1])} moradores.` },
      ]} />
      <Secao id="cor-raca" titulo="Como o acesso difere por cor ou raça?" texto="Cada ponto mede a proporção dentro do próprio grupo. A referência nacional reúne todos os moradores do mesmo universo domiciliar. Água e esgoto são medidas separadas; os dois grupos de carência não podem ser somados.">
        <div className="grid grid-cols-1 gap-10 xl:grid-cols-2">
          {(["agua", "esgoto"] as const).map((servico) => <GraficoPontos key={servico}
            titulo={servico === "agua" ? "Sem ligação à rede geral de água" : "Sem rede nem fossa séptica"}
            itens={racas.map((s) => ({ id:s.grupo, rotulo:s.rotulo, valor:proporcao(`${s.grupo}-${servico}`), referencia: servico === "agua" ? razaoPct(br?.censo2022.moradores?.agua.sem_ligacao, br?.censo2022.moradores?.agua.total) : razaoPct(br?.censo2022.moradores?.esgoto.sem_rede_nem_septica, br?.censo2022.moradores?.esgoto.total) }))}
            unidade="%" casas={1} rotuloValor="Dentro do grupo" rotuloReferencia="Todos os moradores, Brasil" zeroNoEixo />)}
        </div>
        <Ressalva permite="Comparar proporções de moradores de cada cor ou raça, no mesmo universo domiciliar e ano." naoPermite="Inferir renda individual, atribuir causas ou avaliar qualidade da água. A categoria indígena de cor ou raça não equivale à identificação ampliada das estatísticas indígenas." />
        <Nota titulo="As categorias não esgotam o total">A soma das cinco categorias fica {inteiro(residuo?.universo)} moradores abaixo do universo nacional oficial. A diferença é de {inteiro(residuo?.agua)} moradores na carência de água e {inteiro(residuo?.esgoto)} na de esgoto. O total oficial e cada categoria são preservados; a diferença não é atribuída a nenhum grupo.</Nota>
        <Fonte>IBGE, Censo 2022, SIDRA 6894 (água) e 7555 (esgoto). Valores absolutos; percentuais calculados com numerador e denominador do próprio grupo.</Fonte>
      </Secao>
      <Secao id="outros-universos" titulo="Quilombolas, indígenas e favelas: quais universos entram?" texto="Estes recortes se sobrepõem às categorias de cor ou raça e entre si. Não formam parcelas de um total. A ligação à rede de água em favelas é medida em domicílios, enquanto o esgoto é medido em moradores.">
        <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Quilombolas, indígenas e favelas: medidas por grupo e universo (rolável)">
          <table className="w-full min-w-[40rem] text-sm"><caption className="sr-only">Brasil, Censo 2022: medidas por grupo e universo</caption>
            <thead><tr>{["Grupo e medida", "Carência", "Universo", "Proporção", "Unidade e fonte"].map((x) => <th key={x} scope="col" className="border-b border-linha p-3 text-left">{x}</th>)}</tr></thead>
            <tbody>{ESPECIFICACOES.filter((s) => ![6894,7555].includes(s.tabela)).map((s) => {
              const [n,d] = br?.desigualdades?.[s.id] ?? [null,null];
              return <tr key={s.id}><th scope="row" className="border-b border-linha p-3 text-left font-medium">{s.rotulo}<span className="mt-1 block font-normal">{s.medida === "agua" ? "Sem ligação à rede de água" : "Sem rede nem fossa séptica"}</span></th><td className="border-b border-linha p-3 text-right tabular-nums">{inteiro(n)}</td><td className="border-b border-linha p-3 text-right tabular-nums">{inteiro(d)}</td><td className="border-b border-linha p-3 text-right tabular-nums">{numero(razaoPct(n,d),1)}%</td><td className="border-b border-linha p-3">{s.unidade}, SIDRA {s.tabela}, 2022</td></tr>;
            })}</tbody>
          </table>
        </div>
        <Nota titulo="Identificação indígena">A identificação ampliada considera moradores indígenas além da declaração de cor ou raça. Inclui habitações indígenas sem paredes ou malocas. Não subtraia esse total do grupo indígena por cor ou raça para construir um novo grupo.</Nota>
        <Nota titulo="Água: lacuna de conceito">As tabelas de esgoto 10105 e 9957 não informam ligação à rede de água. Forma principal de abastecimento e existência de ligação são perguntas diferentes. A medida de ligação para quilombolas e para a identificação indígena ampliada ainda não foi integrada.</Nota>
        <Ressalva permite="Ler a proporção dentro de cada universo, com sua unidade explícita, e comparar o mesmo grupo entre territórios." naoPermite="Ordenar estes recortes como se fossem populações mutuamente exclusivas ou comparar domicílios de água em favelas com moradores de outros grupos como a mesma medida." />
        <Fonte>IBGE, Censo 2022, SIDRA 10105 (quilombolas), 9957 (indígenas), 9894 e 9898 (favelas e comunidades urbanas). Localização e situação do domicílio: totais das respectivas tabelas.</Fonte>
      </Secao>
      <Secao id="atlas" titulo="Onde estão as diferenças dentro de cada grupo?" texto="Escolha uma medida e um território. O mapa, a tabela e a contagem usam o mesmo grupo; as referências de UF e Brasil vêm das tabulações oficiais, não da média dos municípios.">
        <AtlasMunicipal ids={ids} referencias={refs} nomesUf={Object.fromEntries(ags.filter((a) => a.tipo === "UF").map((a) => [a.id,a.nome]))} titulo="Atlas municipal das desigualdades" complemento={URL_DESIGUALDADES_MUNICIPIOS} />
        <Ressalva permite="Explorar contagens e proporções do mesmo grupo, compartilhar o recorte e exportar a tabela municipal." naoPermite="Ler ausência como zero. Sem população do grupo, sem tabulação ou sob supressão estatística, a proporção fica sem dado." />
        <Fonte>IBGE, Censo 2022. A tabela SIDRA e o universo de cada medida constam no catálogo. Referência: 2022.</Fonte>
      </Secao>
      <Secao id="dados" titulo="Conferir os números e a cobertura" texto="As referências abaixo são tabulações oficiais para Brasil e UFs. A exportação preserva grupo, unidade, numerador, denominador, tabela e ano.">
        <TabelaDados titulo="Brasil e UFs por grupo, Censo 2022" arquivo="saneamento-desigualdades-brasil-ufs-2022.csv" linhas={linhas} colunas={[
          {id:"territorio",rotulo:"Território"},{id:"grupo",rotulo:"Grupo"},{id:"indicador",rotulo:"Medida"},{id:"unidade",rotulo:"Unidade"},{id:"carencia",rotulo:"Carência",tipo:"inteiro"},{id:"universo",rotulo:"Universo",tipo:"inteiro"},{id:"pct",rotulo:"Proporção",tipo:"pct"},{id:"tabela",rotulo:"SIDRA"},{id:"periodo",rotulo:"Ano"},
        ]} />
        <TabelaDados titulo="Municípios com razão disponível, Censo 2022" arquivo="saneamento-desigualdades-cobertura-2022.csv" linhas={cobertura} limite={20} busca={false} colunas={[{id:"grupo",rotulo:"Grupo"},{id:"indicador",rotulo:"Medida"},{id:"unidade",rotulo:"Unidade"},{id:"municipios",rotulo:"Municípios com dado e universo positivo",tipo:"inteiro"}]} />
        <Nota titulo="Supressões em favelas">Células suprimidas pelo IBGE ficam sem dado. As referências de Brasil e UF mantêm as tabulações oficiais, mesmo quando a soma municipal disponível é menor. Conferências da edição:
          <ul className="mt-2 list-disc pl-5">{divergencias.map((c) => <li key={`${c.id}-${c.campo}`}>{c.id === "favelas-agua" ? "Água em favelas, domicílios" : "Esgoto em favelas, moradores"}, {c.campo}: soma municipal {inteiro(Math.abs(c.diferenca!))} abaixo do Brasil; {inteiro(c.ausentes)} municípios com valor suprimido.</li>)}</ul>
          Diferenças publicadas em meta.json e nunca redistribuídas.
        </Nota>
        <Nota titulo="Renda e situação urbana ou rural">O Censo 2022 não publicou renda individual cruzada com saneamento. Renda média territorial não substitui esse dado. O detalhamento urbano e rural não integra esta entrega.</Nota>
        <Fonte>IBGE, Censo 2022, tabelas 6894, 7555, 10105, 9957, 9894 e 9898. Coleta em {captura}. Originais e metadados com SHA-256 no pipeline; proveniência e conferências em <a className="text-obee-dark underline" href="/saneamento/gold/meta.json">meta.json</a>.</Fonte>
      </Secao>
    </main>
  </>;
}
