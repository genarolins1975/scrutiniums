/**
 * "Quem passa fome no Brasil?": recortes sociais nacionais da EBIA (IBGE, PNAD Contínua, tabelas SIDRA 9553 a
 * 9562; follow-up do PR #325). Componente de servidor: lê o bloco `ebia_social` da gold, já conferido pelo
 * pipeline (classes somam 100%, grupos somam o total, totais iguais aos da tabela 9552), e só formata.
 *
 * O gráfico compara, para cada grupo, duas parcelas publicadas pelo IBGE na mesma tabela: a do grupo entre todos os
 * domicílios e a do grupo entre os domicílios em insegurança alimentar grave. Barras desde zero, escala comum a todos
 * os quadros, cor só para distinguir as duas parcelas. A única conta do painel (a cada 100 domicílios do grupo,
 * quantos em insegurança grave) fica na tabela de apoio, marcada como calculada e sem coeficiente de variação.
 * Nenhuma diferença é chamada de significativa: o IBGE não publica o teste.
 */
import Link from "next/link";
import { BASE_COMPLEMENTOS, int, milhoes, pct1, type ClasseSocial, type Complementos, type RecorteSocial, type ValorSocial } from "@/lib/eficiencia/alimentar/complementos";
import { dataBr } from "@/lib/eficiencia/formato";

const METODOS = "/eficiencia-estatal/seguranca-alimentar/metodos";
const ANO = 2024;

/** Rótulos curtos para leitura; o nome exato do IBGE fica na tabela de apoio e no arquivo. */
const CURTO: Record<string, string> = {
  "Ensino fundamental incompleto ou equivalente": "Fundamental incompleto",
  "Ensino fundamental completo ou equivalente": "Fundamental completo",
  "Ensino médio incompleto ou equivalente": "Médio incompleto",
  "Ensino médio completo ou equivalente": "Médio completo",
  "Ensino superior incompleto ou equivalente": "Superior incompleto",
  "Trabalhador doméstico": "Trabalho doméstico",
  "Empregado no setor privado com carteira de trabalho assinada": "Empregado com carteira",
  "Empregado no setor privado sem carteira de trabalho assinada": "Empregado sem carteira",
  "Empregado no setor público, inclusive servidor estatutário e militar": "Setor público e militares",
  "Outros": "Outros¹",
  "Até ¼ salário mínimo": "Até ¼ de salário mínimo",
  "Mais de 1/4 a 1/2 do salário mínimo": "Mais de ¼ a ½",
  "Mais de 1/2 a 1 salário mínimo": "Mais de ½ a 1",
  "Mais de 1 a 2 salários mínimos": "Mais de 1 a 2",
  "Mais de 2 salários mínimos": "Mais de 2",
  "Existe": "Com",
  "Não existe": "Sem",
};
const curto = (g: string) => CURTO[g] ?? g;

const NOME_CLASSE: Record<ClasseSocial, string> = {
  total: "todos os domicílios",
  segura: "segurança alimentar",
  insegura: "alguma insegurança alimentar",
  leve: "insegurança leve",
  moderada: "insegurança moderada",
  grave: "insegurança grave",
  moderada_grave: "insegurança moderada ou grave",
};

/** Classe em foco do recorte: a grave; na tabela de renda, que só publica moderada e grave juntas, essa soma. */
const foco = (r: RecorteSocial): ClasseSocial => (r.classes.includes("grave") ? "grave" : "moderada_grave");
const linha = (r: RecorteSocial, ano: number, grupo: string) => r.linhas.find((l) => l.ano === ano && l.grupo === grupo && l.situacao === "total")!;
const cel = (r: RecorteSocial, ano: number, grupo: string, classe: ClasseSocial): ValorSocial => linha(r, ano, grupo).classes[classe]!;
const recorte = (c: Complementos, id: RecorteSocial["id"]) => c.ebia_social.recortes.find((r) => r.id === id)!;

/** Valor publicado com a marca de precisão: ausência escrita, nunca zero; asterisco quando o CV passa do limiar do painel. */
function Pct({ v, limiar }: { v: ValorSocial; limiar: number }) {
  if (v.pct === null) return <>Não publicado</>;
  const alto = v.cv_pct !== null && v.cv_pct >= limiar;
  return (
    <>
      {pct1(v.pct)}
      {alto && <><span aria-hidden="true">*</span><span className="sr-only"> (estimativa menos precisa: coeficiente de variação de {pct1(v.cv_pct!)})</span></>}
    </>
  );
}

function BarraPar({ valor, maximo, cor, rotulo, children }: { valor: number | null; maximo: number; cor: "neutro" | "foco"; rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_4.25rem] items-center gap-x-3">
      <div className="h-2.5 bg-obee-fundo" aria-hidden="true">
        {valor !== null && <div className={`h-full ${cor === "foco" ? "bg-obee" : "bg-obee-neutro"}`} style={{ width: `${(100 * valor) / maximo}%` }} />}
      </div>
      <span className="text-right text-sm tabular-nums text-obee-tinta">
        <span className="sr-only">{rotulo}: </span>
        {children}
      </span>
    </div>
  );
}

function Quadro({ r, maximo, limiar }: { r: RecorteSocial; maximo: number; limiar: number }) {
  const f = foco(r);
  return (
    <section aria-labelledby={`fome-${r.id}`} className="min-w-0">
      <h4 id={`fome-${r.id}`} className="font-serif text-xl leading-snug">{r.rotulo}</h4>
      <p className="mt-1 text-xs text-carvao-muted">
        Tabela {r.tabela}{f === "moderada_grave" ? " · barra escura: insegurança moderada ou grave, que o IBGE publica juntas nesta tabela" : ""}
      </p>
      <ul className="mt-3 space-y-3">
        {r.grupos.map((g) => {
          const todos = cel(r, ANO, g, "total");
          const emFoco = cel(r, ANO, g, f);
          return (
            <li key={g} className="grid gap-x-4 gap-y-1 sm:grid-cols-[10.5rem_minmax(0,1fr)]">
              <span className="text-sm leading-snug" title={g}>{curto(g)}</span>
              <div className="space-y-1">
                <BarraPar valor={todos.pct} maximo={maximo} cor="neutro" rotulo="entre todos os domicílios"><Pct v={todos} limiar={limiar} /></BarraPar>
                <BarraPar valor={emFoco.pct} maximo={maximo} cor="foco" rotulo={`entre os domicílios em ${NOME_CLASSE[f]}`}><Pct v={emFoco} limiar={limiar} /></BarraPar>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Frases factuais, montadas do mesmo dado do gráfico: dois percentuais publicados, sem julgamento nem causa. */
function leituras(c: Complementos): string[] {
  const s = recorte(c, "sexo"), cor = recorte(c, "cor_raca"), renda = recorte(c, "renda");
  const p = (r: RecorteSocial, g: string, k: ClasseSocial) => {
    const v = cel(r, ANO, g, k).pct;
    return v === null ? "valor não publicado" : pct1(v);
  };
  return [
    `Uma mulher é a pessoa responsável por ${p(s, "Mulheres", "total")} dos domicílios do país e por ${p(s, "Mulheres", "grave")} dos domicílios em insegurança grave.`,
    `A pessoa responsável é parda em ${p(cor, "Parda", "grave")} dos domicílios em insegurança grave e preta em ${p(cor, "Preta", "grave")}; entre todos os domicílios, essas parcelas são de ${p(cor, "Parda", "total")} e ${p(cor, "Preta", "total")}.`,
    `Domicílios com renda de até ¼ de salário mínimo por pessoa são ${p(renda, "Até ¼ salário mínimo", "total")} do total e ${p(renda, "Até ¼ salário mínimo", "moderada_grave")} dos domicílios em insegurança moderada ou grave.`,
  ];
}

function TabelaComposicao({ r, limiar }: { r: RecorteSocial; limiar: number }) {
  const f = foco(r);
  const anos = [...new Set(r.linhas.map((l) => l.ano))].sort((a, b) => b - a);
  const cab = ["Grupo, como o IBGE publica", "Ano", "Mil domicílios", "% de todos os domicílios", `% dos domicílios em ${NOME_CLASSE[f]}`, "CV desse %", `Mil domicílios em ${NOME_CLASSE[f]}`, `A cada 100 domicílios do grupo, em ${NOME_CLASSE[f]} (calculado)`];
  return (
    <div>
    <p className="text-sm font-medium">{r.rotulo} · tabela SIDRA {r.tabela} · Brasil</p>
    <div className="tabela-scroll mt-2 min-w-0 max-w-full" tabIndex={0} role="region" aria-label={`${r.rotulo}, tabela ${r.tabela} (tabela; role na horizontal se necessário)`}>
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <caption className="sr-only">{r.rotulo} · tabela SIDRA {r.tabela} · Brasil</caption>
        <thead>
          <tr>{cab.map((t, i) => <th key={t} scope="col" className={`border-b border-carvao-muted px-2 py-1.5 align-bottom font-semibold text-obee-tinta ${i > 1 ? "text-right" : "text-left"}`}>{t}</th>)}</tr>
        </thead>
        <tbody>
          {["Total", ...r.grupos].flatMap((g) => anos.map((ano) => {
            const todos = cel(r, ano, g, "total"), v = cel(r, ano, g, f);
            const total = g === "Total";
            return (
              <tr key={`${g}-${ano}`} className="border-b border-linha">
                <th scope="row" className={`px-2 py-1.5 text-left font-normal ${total ? "font-medium" : ""}`}>{g}</th>
                <td className="px-2 py-1.5 tabular-nums">{ano}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{todos.mil_domicilios === null ? "Não publicado" : int(todos.mil_domicilios)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{total ? "100,0%" : <Pct v={todos} limiar={limiar} />}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{total ? "100,0%" : <Pct v={v} limiar={limiar} />}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{total ? "Não se aplica" : v.cv_pct === null ? "Não publicado" : pct1(v.cv_pct)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{v.mil_domicilios === null ? "Não publicado" : int(v.mil_domicilios)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{v.pct_no_grupo_calculado == null ? "Sem base" : pct1(v.pct_no_grupo_calculado)}</td>
              </tr>
            );
          }))}
        </tbody>
      </table>
    </div>
    </div>
  );
}

function TabelaMoradores({ c, ano, limiar }: { c: Complementos; ano: number; limiar: number }) {
  const recortes = (["menores_5", "menores_18", "idosos"] as const).map((id) => recorte(c, id));
  const nomes: Record<string, string> = { menores_5: "criança menor de 5 anos", menores_18: "morador menor de 18 anos", idosos: "morador com 60 anos ou mais" };
  // a grave logo depois do total: no celular, a coluna da pergunta da seção fica à vista antes da rolagem da tabela
  const classes: ClasseSocial[] = ["insegura", "grave", "moderada", "leve"];
  return (
    <>
    <p className="mt-3 text-sm font-medium">% dos domicílios de cada grupo · Brasil · {ano} · tabelas SIDRA 9559, 9562 e 9560</p>
    <div className="tabela-scroll mt-2 min-w-0 max-w-full" tabIndex={0} role="region" aria-label={`Insegurança alimentar por presença de crianças, adolescentes e pessoas idosas, ${ano} (tabela; role na horizontal se necessário)`}>
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <caption className="sr-only">% dos domicílios de cada grupo · Brasil · {ano} · tabelas SIDRA 9559, 9562 e 9560</caption>
        <thead>
          <tr>
            {["Domicílios", "Com alguma insegurança", "Grave", "Moderada", "Leve", "CV da grave", "Mil domicílios"].map((t, i) => (
              <th key={t} scope="col" className={`border-b border-carvao-muted px-2 py-1.5 align-bottom font-semibold text-obee-tinta ${i ? "text-right" : "text-left"}`}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {recortes.flatMap((r) => r.grupos.map((g) => {
            const l = linha(r, ano, g).classes;
            return (
              <tr key={`${r.id}-${g}`} className="border-b border-linha">
                <th scope="row" className="px-2 py-1.5 text-left font-normal">{curto(g)} {nomes[r.id]}</th>
                {classes.map((k) => <td key={k} className="px-2 py-1.5 text-right tabular-nums"><Pct v={l[k]!} limiar={limiar} /></td>)}
                <td className="px-2 py-1.5 text-right tabular-nums">{l.grave!.cv_pct === null ? "Não publicado" : pct1(l.grave!.cv_pct)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{l.total!.mil_domicilios === null ? "Não publicado" : int(l.total!.mil_domicilios)}</td>
              </tr>
            );
          }))}
        </tbody>
      </table>
    </div>
    </>
  );
}

export function QuemPassaFome({ c }: { c: Complementos }) {
  const s = c.ebia_social;
  const limiar = s.limiar_cv;
  const composicao = s.recortes.filter((r) => r.orientacao === "composicao");
  const br = c.ebia.find((e) => e.nivel === "brasil" && e.ano === ANO && e.situacao === "total")!.classes.grave;
  // escala comum a todos os quadros, desde zero, arredondada para cima à dezena
  const valores = composicao.flatMap((r) => r.grupos.flatMap((g) => [cel(r, ANO, g, "total").pct, cel(r, ANO, g, foco(r)).pct])).filter((v): v is number => v !== null);
  const maximo = Math.ceil(Math.max(...valores) / 10) * 10;
  // só as estimativas que a seção mostra: na composição, a parcela entre todos e a da classe em foco; na distribuição, as quatro classes de insegurança
  const mostradas = (r: RecorteSocial): ClasseSocial[] => (r.orientacao === "composicao" ? ["total", foco(r)] : ["insegura", "leve", "moderada", "grave"]);
  const altos = s.recortes.flatMap((r) => r.linhas.filter((l) => l.situacao === "total" && l.grupo !== "Total").flatMap((l) =>
    Object.entries(l.classes).filter(([k, v]) => mostradas(r).includes(k as ClasseSocial) && v!.cv_pct !== null && v!.cv_pct >= limiar).map(([k, v]) => `${curto(l.grupo).replace("¹", "")} (${r.rotulo.toLowerCase()}), ${NOME_CLASSE[k as ClasseSocial]}, ${l.ano}: ${pct1(v!.cv_pct!)}`)));
  const captura = dataBr(s.manifesto.capturado_em);
  const criancas = cel(recorte(c, "menores_5"), ANO, "Existe", "insegura").pct;
  const semCriancas = cel(recorte(c, "menores_5"), ANO, "Não existe", "insegura").pct;
  const renda = recorte(c, "renda");
  return (
    <>
      <p className="mt-6 max-w-prose2 text-base leading-relaxed">
        Em {ANO}, <strong className="tabular-nums">{br.mil_domicilios === null ? "um número não publicado" : milhoes(br.mil_domicilios * 1000)}</strong> de domicílios
        {br.pct === null ? "" : <> (<span className="tabular-nums">{pct1(br.pct)}</span> do total)</>} estavam em insegurança alimentar grave: a quantidade de comida diminuiu também para as crianças, ou a falta de alimentos rompeu as refeições de todos os moradores. Segundo o IBGE, nessa situação a fome passa a ser vivida no domicílio.
      </p>
      <ul className="mt-4 max-w-prose2 space-y-2 border-l-2 border-obee pl-4 text-base leading-relaxed">
        {leituras(c).map((t) => <li key={t}>{t}</li>)}
      </ul>

      <h3 className="mt-10 font-serif text-2xl">Quem são os domicílios em insegurança grave</h3>
      <figure className="mt-3" aria-labelledby="fome-figura-titulo">
        <figcaption id="fome-figura-titulo" className="text-sm">
          Parcela de cada grupo entre os domicílios em insegurança alimentar grave (na renda, moderada ou grave, que o IBGE publica juntas) e entre todos os domicílios · % · Brasil · {ANO}
        </figcaption>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm" aria-hidden="true">
          <span className="inline-flex items-center gap-2"><span className="inline-block h-2.5 w-6 bg-obee-neutro" />Parcela entre todos os domicílios</span>
          <span className="inline-flex items-center gap-2"><span className="inline-block h-2.5 w-6 bg-obee" />Parcela entre os domicílios em insegurança grave (na renda, moderada ou grave)</span>
        </div>
        <div className="mt-6 grid gap-x-14 gap-y-10 lg:grid-cols-2">
          {composicao.map((r) => <Quadro key={r.id} r={r} maximo={maximo} limiar={limiar} />)}
        </div>
        <div className="mt-6 max-w-prose2 space-y-1 text-xs leading-relaxed text-carvao-muted">
          <p>Percentuais publicados pelo IBGE. Em cada quadro, os grupos somam cerca de 100% em cada cor de barra, como o IBGE publica (na cor ou raça, só branca, preta e parda). Barras desde zero, na mesma escala de 0 a {maximo}% em todos os quadros. Grupo com barra escura maior que a clara aparece mais entre os domicílios em insegurança do que entre todos; isso não indica causa, e nenhuma diferença é apresentada como estatisticamente significativa.</p>
          <p>¹ No trabalho da pessoa responsável, “Outros” é a categoria do IBGE para quem não está nas demais; como os grupos somam o total de domicílios, inclui também quem não trabalhava (inferência a partir da soma; a tabela não detalha).</p>
          {altos.length > 0 && <p>* Estimativa menos precisa: coeficiente de variação de {int(limiar)}% ou mais, limiar do painel e não regra do IBGE. {altos.join("; ")}.</p>}
        </div>
      </figure>

      <h3 className="mt-12 font-serif text-2xl">E nas casas com crianças, adolescentes ou pessoas idosas?</h3>
      <p className="mt-3 max-w-prose2 text-base leading-relaxed">
        Aqui o IBGE publica outra conta: a parcela dos domicílios de cada grupo em cada classe. Em {ANO}, {criancas === null ? "valor não publicado" : pct1(criancas)} dos domicílios com criança menor de 5 anos tinham alguma insegurança alimentar, contra {semCriancas === null ? "valor não publicado" : pct1(semCriancas)} dos domicílios sem criança dessa idade.
      </p>
      <TabelaMoradores c={c} ano={ANO} limiar={limiar} />
      <p className="mt-2 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
        As linhas se sobrepõem: um domicílio com criança de 3 anos também tem morador menor de 18. A idade é dos moradores, não da pessoa responsável. “Com alguma insegurança” soma leve, moderada e grave, como o IBGE publica.
      </p>

      <details className="mt-8 border-y border-linha py-2">
        <summary className="min-h-[44px] cursor-pointer py-3 text-sm font-medium">Tabelas de apoio, 2023 e 2024, com domicílios, coeficientes de variação e a parcela de cada grupo</summary>
        <div className="space-y-8 pb-4">
          {composicao.map((r) => <TabelaComposicao key={r.id} r={r} limiar={limiar} />)}
          <TabelaMoradores c={c} ano={2023} limiar={limiar} />
        </div>
        <p className="pb-3 text-xs leading-relaxed text-carvao-muted">
          “A cada 100 domicílios do grupo” é calculado pelo painel com os domicílios publicados em mil (domicílios do grupo na classe ÷ domicílios do grupo), sem coeficiente de variação; os demais valores são do IBGE. O arquivo traz também todas as classes e a divisão urbana e rural da tabela de renda.
        </p>
      </details>

      <details className="mt-4 border-b border-linha py-2">
        <summary className="min-h-[44px] cursor-pointer py-3 text-sm font-medium">Como ler, conferências e limites</summary>
        <div className="max-w-prose2 space-y-3 pb-4 text-sm leading-relaxed">
          <p>A EBIA classifica cada domicílio pelas experiências dos três meses anteriores à entrevista: segurança alimentar e insegurança leve, moderada ou grave. As tabelas de sexo, cor ou raça, escolaridade, trabalho, número de moradores e renda mostram como se dividem os domicílios de cada classe; as de crianças, adolescentes e pessoas idosas mostram como se dividem os domicílios de cada grupo.</p>
          <p>Antes de publicar, o pipeline confere que as classes somam 100% (tolerância de {dec2(s.tolerancias.pct_por_parcela)} ponto por parcela somada, o arredondamento do IBGE), que os domicílios dos grupos somam o total ({dec2(s.tolerancias.mil_por_parcela)} mil por parcela) e que o total de cada tabela repete o da tabela 9552, usada na seção por estado: {int(s.conferencias.classes_pct + s.conferencias.classes_mil + s.conferencias.grupos_pct + s.conferencias.grupos_mil + s.conferencias.totais_9552)} conferências, todas aprovadas. Qualquer falha retém a publicação.</p>
          {renda.universo_menor && <p>Renda (tabela 9558): {renda.universo_menor}</p>}
          <p>Estimativas amostrais: cada valor tem o coeficiente de variação publicado pelo IBGE. O painel marca com asterisco os de {int(limiar)}% ou mais. O IBGE não publica teste das diferenças entre grupos, e o painel não usa microdados; por isso nenhuma diferença é chamada de significativa.</p>
          <p>{s.tabela_ausente.motivo} Não há recorte por estado nessas tabelas: o IBGE as publica só para o Brasil.</p>
        </div>
      </details>

      <div className="mt-4 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
        <p>
          Fonte: IBGE, PNAD Contínua, Segurança alimentar, tabelas SIDRA{" "}
          {s.manifesto.fontes.map((f, i) => {
            const r = s.recortes.find((x) => x.fonte_id === f.id)!;
            return <span key={f.id}>{i ? ", " : ""}<a href={f.pagina} className="text-obee-dark underline underline-offset-2">{r.tabela}</a> ({r.rotulo.toLowerCase()})</span>;
          })}
          , capturadas em {captura} pela API do SIDRA. Período: 2023 e 2024. Território: Brasil. Unidade: % dos domicílios particulares permanentes e mil domicílios. A tabela 9561 não existe.
        </p>
        <p className="mt-1 flex flex-wrap gap-x-5">
          <Link href={`${METODOS}#san.ebia.social.composicao`} className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-2">Fichas das medidas →</Link>
          <a href={`${BASE_COMPLEMENTOS}/ebia-grupos-sociais.csv`} download className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-2">Baixar os nove recortes · CSV ↓</a>
        </p>
      </div>
    </>
  );
}

const dec2 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
