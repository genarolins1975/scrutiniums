import { Recolhido } from "@/components/observatorios/Recolhido";
import { GraficoIdeb, GraficoDistribuicao } from "./Graficos";
import { ETAPAS, type GoldEducacao, type MunicipioGold, type Serie, type Motivo, type ComposicaoMatriculas } from "@/lib/educacao/tipos";
import { NOME_ETAPA, TEXTO_MOTIVO } from "@/lib/educacao/paginas";
import { DO_ESTADO } from "@/lib/previdencia/paginas";
import { num, ideb } from "@/lib/educacao/formato";

const nomeUf = (uf: string) => (DO_ESTADO[uf] ?? uf).replace(/^(do|da|de|dos|das) /, "");

const motivoHistorico = (motivo: Motivo) => motivo === "nao_divulgado" ? "O INEP não divulgou o Ideb nesta edição." : TEXTO_MOTIVO[motivo];

export function MetasEducacao({ g, m, mostrarTitulo = true }: { g: GoldEducacao; m?: MunicipioGold; mostrarTitulo?: boolean }) {
  const anos = g.ideb.anos_meta;
  const posteriores = g.ideb.anos.filter(a => a > anos.at(-1)!);
  return <section className="edm-sub" id="metas-inep">
    {mostrarTitulo && <h2>As metas projetadas pelo INEP</h2>}
    <p>{m ? `Rede municipal de ${m.nome}` : "Redes municipais do Brasil"}, {anos[0]} a {anos.at(-1)}. Alcançar a meta compara o Ideb publicado com a projeção do Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira (INEP); não avalia a gestão nem explica o resultado.</p>
    {ETAPAS.map(e => <section key={e} className="mt-6"><h3>{NOME_ETAPA[e]}</h3>
      <dl className={`edm-placar-metas ${m ? "edm-placar-cidade" : ""}`}>{m ? m.analises[e].metas.map(a => <div key={a.ano}><dt>{a.ano}</dt><dd><span aria-hidden="true">{a.estado === "alcancou" ? "● " : a.estado === "nao_alcancou" ? "○ " : ""}</span>{a.estado === "alcancou" ? "Alcançou a meta projetada pelo INEP" : a.estado === "nao_alcancou" ? "Não alcançou a meta projetada pelo INEP" : a.estado === "sem_meta" ? `Sem meta publicada${a.motivo ? `. Sem Ideb: ${motivoHistorico(a.motivo)}` : ""}` : `Sem Ideb. ${a.motivo ? motivoHistorico(a.motivo) : "Não divulgado"}`}</dd></div>) : g.metas[e].map(a => <div key={a.ano}><dt>{a.ano}</dt><dd><strong>{num(a.alcancou)}</strong> de {num(a.alcancou+a.nao_alcancou)} redes com meta e Ideb alcançaram a meta projetada pelo INEP.</dd><dd className="edm-fonte">{num(a.sem_ideb)} com meta e sem Ideb; {num(a.sem_meta)} sem meta.</dd></div>)}</dl>
    </section>)}
    <p className="edm-fonte">{posteriores.join(" e ")} não têm meta publicada neste ciclo. Fonte: INEP, Ideb {g.ideb.ano}; contagens calculadas pela Scrutiniums. O universo usa os {num(g.municipios.total)} códigos municipais da base atual. Edições sem Ideb ficam fora do denominador, nunca contam como zero.</p>
  </section>;
}

export function DecadaIdeb({ g, mostrarTitulo = true }: { g: GoldEducacao; mostrarTitulo?: boolean }) {
  const anos = g.ideb.anos;
  const grafico = (ai: Serie, af: Serie, universo: string, compacto = false) => <>
    <GraficoIdeb compacto={compacto} anos={anos} anoNota={anos.includes(2021) ? { ano: 2021, texto: "2021, pandemia" } : undefined}
      series={ETAPAS.map((e, i) => ({ nome: e, rotulo: i ? "Finais" : "Iniciais", classe: i ? "edm-linha-ref" : "edm-linha", pontos: anos.map((x, k) => ({ x, y: (i ? af : ai).ideb[k] })) }))}
      descricao={`Ideb de ${universo}, anos iniciais e finais, ${anos[0]} a ${anos.at(-1)}, de 0 a 10. Lacunas não são interpoladas.`} />
    <Recolhido id={`serie-tabela-${universo.replace(/[^a-zA-Z]/g, "")}`} titulo="Valores por edição" resumo="Tabela equivalente, com as duas etapas."><table className="edm-tabela"><caption>{universo}, INEP, Ideb de 0 a 10</caption><thead><tr><th>Ano</th><th>Anos iniciais</th><th>Anos finais</th></tr></thead><tbody>{anos.map((a, k) => <tr key={a}><th scope="row">{a}</th><td>{ideb(ai.ideb[k])}</td><td>{ideb(af.ideb[k])}</td></tr>)}</tbody></table></Recolhido>
  </>;
  return <section className="edm-sub" id="decada-ideb">{mostrarTitulo && <h2>A década do Ideb</h2>}<p>A série completa, de {anos[0]} a {anos.at(-1)}. Em 2021, a pandemia e as mudanças na aprovação limitam a comparação; não se atribui a variação a uma causa.</p>
    <figure className="edm-figura"><h3>Brasil, redes municipais</h3>{grafico(g.ideb.brasil.ai.municipal, g.ideb.brasil.af.municipal, "Brasil, redes municipais")}<figcaption>INEP, Ideb {g.ideb.ano}. O agregado nacional é publicado pelo INEP; não é a média simples dos municípios.</figcaption></figure>
    <h3 className="mt-8">Estados, rede pública</h3><p className="edm-intro">A rede pública reúne escolas municipais, estaduais e federais. A planilha estadual não separa a rede municipal. Mesma escala, ordem pelo nome do estado.</p>
    <div className="edm-componentes-grade">{Object.keys(g.ideb.ufs.ai).sort((a,b) => nomeUf(a).localeCompare(nomeUf(b), "pt-BR")).map(uf => <figure key={uf} className="edm-figura"><h4>{nomeUf(uf)}</h4>{grafico(g.ideb.ufs.ai[uf].publica, g.ideb.ufs.af[uf].publica, `rede pública ${DO_ESTADO[uf]}`, true)}<figcaption>INEP, Ideb {g.ideb.ano}; rede pública {DO_ESTADO[uf]}.</figcaption></figure>)}</div>
  </section>;
}

export function DistribuicoesCidade({ g, m, uf }: { g: GoldEducacao; m: MunicipioGold; uf: string }) {
  return <section className="edm-sub" id="distribuicoes-cidade"><h2>Onde a cidade está na distribuição</h2><p>Redes municipais com Ideb {g.ideb.ano}. Mesma escala de Ideb, de 0 a 10; a contagem vertical é própria de cada universo. Cada rede conta uma vez, independentemente do número de alunos. A marca da cidade indica uma faixa, não um julgamento da gestão.</p>
    {ETAPAS.map(e => <section key={e} className="mt-8"><h3>{NOME_ETAPA[e]}</h3><div className="edm-componentes-grade">{[{ nome: "Brasil", d: g.distribuicao[e].brasil }, { nome: nomeUf(uf), d: g.distribuicao[e].ufs[uf] }].map(({nome,d}) => !d ? <p key={nome}>{nome}: sem redes com Ideb publicado.</p> : <figure key={nome} className="edm-figura"><h4>{nome}</h4><GraficoDistribuicao compacto escalaCompleta faixas={d.faixas} destaque={m[e].municipal?.ideb.at(-1) ?? null} mediana={d.mediana} unidade="redes municipais" descricao={`${nome}, ${NOME_ETAPA[e]}, ${num(d.n)} redes. Mediana ${ideb(d.mediana)}, primeiro quartil ${ideb(d.p25)}, terceiro quartil ${ideb(d.p75)}. INEP, Ideb ${g.ideb.ano}.`} /><figcaption>{num(d.n)} redes · mediana {ideb(d.mediana)} · primeiro quartil {ideb(d.p25)} · terceiro quartil {ideb(d.p75)}. INEP, Ideb {g.ideb.ano}; estatísticas da Scrutiniums. {m[e].municipal?.ideb.at(-1) == null ? "Cidade sem Ideb nesta edição, sem faixa destacada." : `A faixa de ${m.nome} está destacada.`}</figcaption>
    <Recolhido id={`faixas-${e}-${nome}`} titulo="As 20 faixas" resumo="Número de redes em cada intervalo de meio ponto."><table className="edm-tabela"><caption>{nome}, {NOME_ETAPA[e]}, rede municipal, Ideb {g.ideb.ano}</caption><thead><tr><th>Ideb</th><th>Redes</th></tr></thead><tbody>{d.faixas.map((n,i) => <tr key={i}><th scope="row">{num(i/2,1)} a {i===19 ? "10,0, inclusive" : `menos de ${num((i+1)/2,1)}`}</th><td>{num(n)}</td></tr>)}</tbody></table></Recolhido></figure>)}</div></section>)}
  </section>;
}

const ROTULOS: Record<string,string> = { basica: "Educação básica", creche: "Creche", pre: "Pré escola", ai: "Anos iniciais", af: "Anos finais", municipal: "Municipal", estadual: "Estadual", federal: "Federal", privada: "Privada", outras_publicas: "Estadual e federal juntas", demais_redes: "Demais redes juntas" };
const CORES: Record<string,string> = { municipal: "var(--edm-acento)", estadual: "var(--cor-carvao-muted)", federal: "var(--cor-mineral)", privada: "var(--serie-2)", outras_publicas: "var(--cor-carvao-muted)", demais_redes: "var(--serie-2)" };
export function QuemAtende({ m, ano }: { m: MunicipioGold; ano: number }) {
  return <section className="edm-sub" id="quem-atende"><h2>Quem atende os alunos da cidade</h2><p>Matrículas em {m.nome}, Censo Escolar {ano}, INEP. A educação básica separa as quatro dependências; por etapa, a base só permite os agrupamentos indicados abaixo. Não estimamos a separação que falta.</p>
    {m.composicao_matriculas.length ? m.composicao_matriculas.map(linha => <BarraComposicao key={linha.etapa} linha={linha} />) : <p className="edm-aviso">Sem contagens do Censo Escolar nesta cidade.</p>}
    <p className="edm-fonte">Matrículas são vínculos, não crianças distintas. A educação básica inclui outras etapas e modalidades; as barras por etapa não esgotam seu total. Creche e pré escola não têm Ideb. As barras descrevem quem atende, não a qualidade do atendimento.</p>
  </section>;
}
function BarraComposicao({ linha }: { linha: ComposicaoMatriculas }) {
  return <figure className="edm-figura"><h3>{ROTULOS[linha.etapa]}: {num(linha.total)} matrículas</h3>{linha.total > 0 ? <div className="edm-barra-composicao" aria-hidden="true">{Object.entries(linha.partes).map(([rede,n]) => <span key={rede} style={{ width: `${n!/linha.total*100}%`, background: CORES[rede] }} />)}</div> : <p>Nenhuma matrícula publicada nesta etapa.</p>}<figcaption><dl className="edm-legenda-composicao">{Object.entries(linha.partes).map(([rede,n]) => <div key={rede}><dt><i aria-hidden="true" style={{background:CORES[rede]}} />{ROTULOS[rede]}</dt><dd>{num(n!)} matrículas</dd></div>)}</dl></figcaption></figure>;
}
