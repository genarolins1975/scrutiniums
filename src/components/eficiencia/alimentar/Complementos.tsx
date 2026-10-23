/**
 * Medidas das bases complementares de Segurança alimentar (21/10/2026) no molde de painel (Iniciativa 1 do parecer de UX de
 * 23/10/2026). Componentes de servidor: leem a gold já validada pelo pipeline e só formatam. Toda medida sai com unidade, período,
 * território, fonte e ressalva; ausência aparece escrita, nunca como zero.
 *
 * As que têm gráfico são FiguraAnalitica do kit (alunos e repasses do PNAE, acompanhamento do SISVAN), com a tabela equivalente, a
 * ficha "Sobre este dado" e o que não é possível concluir; as que são só tabela (EBIA urbano e rural, CadINSAN e PAA por estado) são
 * TabelaDados à vista, na fatia `tabelas`, como estavam à vista antes. A linha de procedência de cada medida (FonteDaMedida) continua
 * junto do dado, com o período, a unidade, a ressalva, a ficha completa e o arquivo.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { FaixaNumeros, FiguraAnalitica, GraficoBarras, LeituraGuiada, NumeroIndicador, TabelaDados, type NumeroProps } from "@/components/painel";
import type { Natureza, Proveniencia } from "@/lib/painel/tipos";
import { provenienciaObee } from "@/lib/eficiencia/proveniencia";
import {
  BASE_COMPLEMENTOS,
  competencia,
  dec,
  ficha as fichaDe,
  fonte,
  int,
  milhoes,
  pct1,
  reais,
  type Complementos,
  type LinhaPnae,
  type SomaPaa,
} from "@/lib/eficiencia/alimentar/complementos";
import { reaisExtenso } from "@/lib/eficiencia/formato";

export const METODOS = "/eficiencia-estatal/seguranca-alimentar/metodos";
const link = "inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-2";

/**
 * Natureza que a gold declara para a medida no recorte que a página mostra (Brasil, região e estado): "Observado" é valor publicado
 * pela fonte; "UF e Brasil calculados aqui" e "Calculado pelo painel" são somas ou razões do pipeline.
 */
export function naturezaDaFicha(c: Complementos, id: string): Natureza {
  const e = fichaDe(c, id).estado_do_dado;
  return /calculad/i.test(e) ? "CALCULADO" : "OBSERVADO";
}

/**
 * A ficha "Sobre este dado" de uma medida complementar, montada pelo adaptador do OBEE com o que a gold registra: a fonte (página e
 * arquivo oficiais, hash da captura), a ficha do catálogo (definição, universo, fórmula, ausências e limitações) e o período mostrado.
 */
export function provenienciaAlimentar(c: Complementos, fichaId: string, periodo: { inicio: string; fim: string }, fonteId?: string): Proveniencia {
  const f = fichaDe(c, fichaId);
  const src = fonte(c, fonteId ?? f.fonte_id);
  const [orgao, ...resto] = src.nome.split(" · ");
  return provenienciaObee({
    indicador: f.nome,
    natureza: naturezaDaFicha(c, fichaId),
    orgao,
    dataset: resto.join(", ") || src.nome,
    recurso: src.nome,
    url: src.pagina,
    urlPrimaria: src.url,
    unidade: f.unidade,
    frequencia: f.frequencia,
    inicio: periodo.inicio,
    fim: periodo.fim,
    capturadoEm: c.manifesto.capturado_em,
    formula: f.formula,
    transformacoes: [f.estado_do_dado, `Ausências: ${f.ausencias}`],
    limitacoes: [f.limitacoes, `Universo: ${f.universo}`],
    notas: f.definicao,
    snapshot: { id: src.id, sha256: src.sha256 ?? src.sha256_bytes ?? null },
  });
}

type PropsFonte = { c: Complementos; fonteId: string; periodo: string; unidade: string; ressalva: string; csv?: string; ficha: string };

/**
 * Linha de procedência ao pé de cada medida: fonte com link, período, unidade, ressalva, a ficha completa e o arquivo. `inline` escreve a
 * mesma linha em texto corrido, para a nota da TabelaDados (um parágrafo).
 */
export function FonteDaMedida({ c, fonteId, periodo, unidade, ressalva, csv, ficha, inline = false }: PropsFonte & { inline?: boolean }) {
  const f = fonte(c, fonteId);
  const texto = (
    <>
      Fonte: <a href={f.pagina} className="text-obee-dark underline underline-offset-2">{f.nome}</a>. Período: {periodo}. Unidade: {unidade}. {ressalva}
    </>
  );
  const links = (
    <>
      <Link href={`${METODOS}#${ficha}`} className={link}>Ficha completa da medida →</Link>
      {csv && (
        <a href={`${BASE_COMPLEMENTOS}/${csv}`} download className={`${link} ml-5`}>
          Baixar dados · CSV ↓
        </a>
      )}
    </>
  );
  if (inline)
    return (
      <>
        {texto} {links}
      </>
    );
  return (
    <div className="t-meta max-w-prose2 text-carvao-muted" data-fonte-medida="">
      <p>{texto}</p>
      <p className="mt-1 flex flex-wrap">{links}</p>
    </div>
  );
}

/** O contexto da medida (o que é o programa ou a fonte), antes do gráfico, como era antes a abertura de cada seção. */
export function Contexto({ children }: { children?: ReactNode }) {
  return children ? <div className="t-corpo mb-6 max-w-prose2 space-y-2 text-carvao">{children}</div> : null;
}

/* ------------------------------------------------------------------ EBIA urbano e rural */

/** Domicílios com insegurança em áreas urbanas e rurais, Brasil e Grandes Regiões: duas tabelas à vista (2024 e 2023), como antes. */
export function EbiaUrbanoRural({ c, id, titulo, lead }: { c: Complementos; id: string; titulo: string; lead: ReactNode }) {
  const anos = [2024, 2023];
  const linhas = c.ebia.filter((e) => e.nivel !== "uf" && e.situacao !== "total");
  const territorios = [...new Set(linhas.map((e) => e.territorio))];
  const valor = (t: string, ano: number, s: "urbana" | "rural", k: "insegura" | "grave") => {
    const v = linhas.find((e) => e.territorio === t && e.ano === ano && e.situacao === s)?.classes[k].pct;
    return v === null || v === undefined ? "Não publicado" : pct1(v);
  };
  return (
    <>
      {anos.map((ano, i) => (
        <TabelaDados
          key={ano}
          idioma="pt"
          recolhida={false}
          id={i === 0 ? id : undefined}
          tituloVisivel={i === 0 ? titulo : undefined}
          lead={i === 0 ? lead : undefined}
          titulo={`Domicílios com insegurança alimentar em áreas urbanas e rurais, ${ano}, % dos domicílios de cada situação`}
          colunas={[`Território · ${ano}`, "Urbana: insegurança total", "Rural: insegurança total", "Urbana: grave", "Rural: grave"]}
          linhas={territorios.map((t) => [t, valor(t, ano, "urbana", "insegura"), valor(t, ano, "rural", "insegura"), valor(t, ano, "urbana", "grave"), valor(t, ano, "rural", "grave")])}
          nota={
            i === anos.length - 1 ? (
              <FonteDaMedida inline c={c} fonteId="sidra-9552-percentual" ficha="san.ebia.uf.percentual" periodo="2023 e 2024" unidade="% dos domicílios particulares de cada situação" csv="ebia-territorios.csv"
                ressalva="Percentuais publicados pelo IBGE, sem recálculo. O IBGE não publica a divisão urbana e rural por estado nesta tabela; a comparação fica em Brasil e Grandes Regiões. Estimativa amostral: diferenças pequenas podem estar dentro do erro." />
            ) : undefined
          }
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ CadINSAN por estado */

/** Os três números do CadINSAN no Brasil, no componente de número do kit: as mesmas somas e a mesma razão da tabela por estado. */
export function numerosCadinsan(c: Complementos): NumeroProps[] {
  const br = c.cadinsan.brasil;
  const base = { periodo: "janeiro de 2025", recorte: "Brasil", fonte: "MDS, CadINSAN 2025", natureza: "CALCULADO" as const };
  return [
    { ...base, rotulo: "Famílias do Cadastro Único em risco estimado de insegurança alimentar grave", valor: br.com_pbf, valorTexto: milhoes(br.com_pbf), unidade: "de famílias", nota: `Soma dos ${int(br.municipios)} municípios do anexo.` },
    { ...base, rotulo: `Parcela das ${milhoes(br.cadastros)} de famílias analisadas`, valor: br.pct_com_pbf, valorTexto: pct1(br.pct_com_pbf), unidade: "", nota: "Calculado: soma das famílias em risco ÷ soma das analisadas." },
    { ...base, rotulo: "Famílias no cenário de modelagem sem a renda do Bolsa Família", valor: br.sem_pbf, valorTexto: milhoes(br.sem_pbf), unidade: "de famílias", nota: "Cenário do modelo, não efeito observado." },
  ];
}

export function CadinsanEstados({ c, id, titulo, lead }: { c: Complementos; id: string; titulo: string; lead: ReactNode }) {
  const br = c.cadinsan.brasil;
  const ufs = [...c.ufs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return (
    <TabelaDados
      idioma="pt"
      recolhida={false}
      id={id}
      tituloVisivel={titulo}
      lead={
        <>
          {lead}
          <div className="mt-5">
            <FaixaNumeros rotulo="CadINSAN no Brasil" idioma="pt">
              {numerosCadinsan(c).map((n, i) => (
                <NumeroIndicador key={n.rotulo} {...n} tamanho={i === 0 ? "g" : "m"} idioma="pt" />
              ))}
            </FaixaNumeros>
          </div>
        </>
      }
      titulo="CadINSAN por estado, janeiro de 2025: famílias do Cadastro Único em risco estimado de insegurança alimentar grave, somas calculadas do anexo municipal"
      colunas={["Estado", "Famílias em risco, com Bolsa Família", "% das analisadas", "Famílias analisadas", "% no cenário sem o programa"]}
      linhas={[
        ["Brasil", br.com_pbf, pct1(br.pct_com_pbf), br.cadastros, pct1(br.pct_sem_pbf)],
        ...ufs.map((u) => {
          const s = c.cadinsan.ufs[u.sigla];
          return [u.nome, s.com_pbf, pct1(s.pct_com_pbf), s.cadastros, pct1(s.pct_sem_pbf)];
        }),
      ]}
      casas={[null, 0, null, 0, null]}
      limite={100}
      nota={
        <FonteDaMedida inline c={c} fonteId="mds-cadinsan-2025" ficha="san.cadinsan.risco" periodo="Cadastro Único de janeiro de 2025, relatório publicado em 2026" unidade="famílias e % das famílias analisadas" csv="cadinsan.csv"
          ressalva={`Município como publicado pelo MDS; estado e Brasil somados do anexo municipal, que totaliza ${int(br.cadastros)} famílias analisadas, enquanto o corpo do relatório cita 21.460.006 famílias atualizadas: a diferença não foi distribuída. É risco estimado por modelo entre famílias cadastradas, não a EBIA nem a situação de toda a população. Em ${int(c.cadinsan.divergencias_cenario)} municípios o cenário sem o programa traz valor menor que o cenário com o programa, como publicado.`} />
      }
    />
  );
}

/* ------------------------------------------------------------------ PNAE */

const pnae = (c: Complementos, territorio: string, rede: LinhaPnae["rede"], ano: number) =>
  c.pnae.linhas.find((l) => l.territorio === territorio && l.rede === rede && l.ano === ano);

export function anosPnae(c: Complementos) {
  return [...new Set(c.pnae.linhas.map((l) => l.ano))].sort((a, b) => a - b);
}
const nomeAno = (ano: number) => (ano === 2026 ? "2026 (em curso)" : String(ano));

/** Alunos registrados no PNAE: a série do Brasil em barras, a tabela por rede (equivalente), a tabela por estado e a procedência. */
export function FiguraPnaeAtendimento({ c, depois, contexto }: { c: Complementos; depois?: ReactNode; contexto?: ReactNode }) {
  const anos = anosPnae(c);
  const ultimoCompleto = 2025;
  const br = pnae(c, "BR", "todas", ultimoCompleto)!;
  const serie = anos.map((ano) => pnae(c, "BR", "todas", ano)!);
  const ufs = [...c.ufs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return (
    <FiguraAnalitica
      id="escolar"
      idioma="pt"
      pergunta="Quantos alunos estão cobertos pela alimentação escolar?"
      subtitulo={`Alunos registrados no PNAE · milhões de alunos · Brasil · redes municipais e estaduais · ${anos[0]} a ${anos[anos.length - 1]}`}
      natureza={naturezaDaFicha(c, "san.pnae.alunos")}
      proveniencia={provenienciaAlimentar(c, "san.pnae.alunos", { inicio: String(anos[0]), fim: String(anos[anos.length - 1]) })}
      leitura={
        <LeituraGuiada>
          Em {ultimoCompleto}, o FNDE registrou <strong className="tabular-nums">{milhoes(br.alunos)}</strong> de alunos e <strong className="tabular-nums">{int(br.escolas)}</strong> escolas nas {int(br.entidades)} entidades executoras do PNAE: prefeituras e secretarias estaduais de educação.
        </LeituraGuiada>
      }
      comoInterpretar="Barras desde zero. 2026 é exercício em curso e não se compara a um ano encerrado."
      naoConcluir="Aluno registrado não comprova refeição servida, frequência à alimentação nem pessoa única; escola registrada não comprova oferta diária."
      tabela={{
        titulo: "Alunos e escolas registrados no PNAE por rede, Brasil, por exercício",
        colunas: ["Exercício", "Alunos, rede municipal", "Alunos, rede estadual", "Alunos, total", "Escolas, total"],
        linhas: anos.map((ano) => [nomeAno(ano), pnae(c, "BR", "municipal", ano)!.alunos, pnae(c, "BR", "estadual", ano)?.alunos ?? "Sem entidade estadual no arquivo", pnae(c, "BR", "todas", ano)!.alunos, pnae(c, "BR", "todas", ano)!.escolas]),
        casas: [null, 0, 0, 0, 0],
        limite: 100,
      }}
      complemento={
        <FonteDaMedida c={c} fonteId="fnde-pnae" ficha="san.pnae.alunos" periodo={`exercícios de ${anos[0]} a ${anos[anos.length - 1]}; 2026 em curso`} unidade="alunos e escolas registrados" csv="pnae.csv"
          ressalva="Somas das entidades executoras de cada rede. Aluno registrado não comprova refeição servida, frequência à alimentação nem pessoa única; escola registrada não comprova oferta diária." />
      }
      depois={
        <>
          <TabelaDados
            idioma="pt"
            recolhida={false}
            tituloVisivel={`Por estado, ${ultimoCompleto}`}
            titulo={`Alunos e escolas registrados no PNAE por estado e rede, ${ultimoCompleto}`}
            colunas={["Estado", "Alunos, rede municipal", "Alunos, rede estadual", "Alunos, total", "Escolas, total"]}
            linhas={ufs.map((u) => {
              const m = pnae(c, u.sigla, "municipal", ultimoCompleto);
              const e = pnae(c, u.sigla, "estadual", ultimoCompleto);
              const t = pnae(c, u.sigla, "todas", ultimoCompleto)!;
              return [u.nome, m ? m.alunos : "Sem rede municipal no arquivo", e ? e.alunos : "Sem entidade estadual no arquivo", t.alunos, t.escolas];
            })}
            casas={[null, 0, 0, 0, 0]}
            limite={100}
          />
          {depois}
        </>
      }
    >
      <Contexto>{contexto}</Contexto>
      <GraficoBarras
        titulo={`Alunos registrados no PNAE, Brasil, ${anos[0]} a ${anos[anos.length - 1]}, redes municipais e estaduais somadas`}
        series={[{ id: "alunos", nome: "Alunos registrados", pontos: serie.map((l) => ({ x: String(l.ano), rotulo: nomeAno(l.ano), y: l.alunos / 1e6 })) }]}
        eixoY={{ unidade: "milhões de alunos", zero: true, casas: 1 }}
        orientacao="horizontal"
        rotulosValor
      />
    </FiguraAnalitica>
  );
}

/** Repasses federais do PNAE: a série do Brasil em barras (bilhões de reais nominais), a tabela com a cobertura de cada ano e a por estado. */
export function FiguraPnaeRepasses({ c, contexto }: { c: Complementos; contexto?: ReactNode }) {
  const anos = anosPnae(c);
  const ultimoCompleto = 2025;
  const serie = anos.map((ano) => pnae(c, "BR", "todas", ano)!);
  const br = pnae(c, "BR", "todas", ultimoCompleto)!;
  const ufs = [...c.ufs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const cobertura = (l: LinhaPnae) => `${int(l.entidades_com_repasse)} de ${int(l.entidades)}`;
  return (
    <FiguraAnalitica
      id="pnae-repasses"
      idioma="pt"
      pergunta="Quanto o governo federal repassa para a alimentação escolar?"
      subtitulo={`Repasses federais informados · R$ bilhões nominais de cada exercício · Brasil · ${anos[0]} a ${anos[anos.length - 1]}`}
      natureza={naturezaDaFicha(c, "san.pnae.repasses")}
      proveniencia={provenienciaAlimentar(c, "san.pnae.repasses", { inicio: String(anos[0]), fim: String(anos[anos.length - 1]) })}
      leitura={
        <LeituraGuiada>
          Em {ultimoCompleto}, os repasses federais informados para a alimentação escolar somaram <strong className="tabular-nums">{br.repasse === null ? "valor não informado" : reaisExtenso(br.repasse)}</strong> em valores nominais, em {cobertura(br)} entidades executoras com valor informado.
        </LeituraGuiada>
      }
      comoInterpretar="Barras desde zero, sem correção pela inflação: valores de anos diferentes não têm o mesmo poder de compra. 2026 acumula só o que foi repassado até a captura."
      naoConcluir="Transferência federal não é a despesa total do ente com alimentação escolar, que inclui recursos próprios, nem custo por refeição."
      tabela={{
        titulo: "Repasses federais do PNAE, Brasil, por exercício, com entidades que têm valor informado",
        colunas: ["Exercício", "Repasse, rede municipal", "Repasse, rede estadual", "Repasse, total", "Entidades com valor / total"],
        linhas: anos.map((ano) => {
          const r = (l?: LinhaPnae) => (l?.repasse == null ? "Sem valor informado" : reais(l.repasse));
          return [nomeAno(ano), r(pnae(c, "BR", "municipal", ano)), r(pnae(c, "BR", "estadual", ano)), r(pnae(c, "BR", "todas", ano)), cobertura(pnae(c, "BR", "todas", ano)!)];
        }),
        limite: 100,
      }}
      complemento={
        <FonteDaMedida c={c} fonteId="fnde-pnae" ficha="san.pnae.repasses" periodo={`exercícios de ${anos[0]} a ${anos[anos.length - 1]}; 2026 em curso`} unidade="R$ nominais do exercício" csv="pnae.csv"
          ressalva={`Transferência federal não é a despesa total do ente com alimentação escolar, que inclui recursos próprios, nem custo por refeição. ${int(c.pnae.repasses_ausentes)} dos ${int(c.pnae.registros)} registros do arquivo não trazem valor de repasse e ficam fora da soma, que informa quantas entidades entraram.`} />
      }
      depois={
        <TabelaDados
          idioma="pt"
          recolhida={false}
          tituloVisivel={`Por estado, ${ultimoCompleto}`}
          titulo={`Repasses federais do PNAE por estado e rede, ${ultimoCompleto}, R$ nominais`}
          colunas={["Estado", "Rede municipal", "Rede estadual", "Total", "Entidades com valor / total"]}
          linhas={ufs.map((u) => {
            const r = (l?: LinhaPnae) => (!l ? "Sem entidade no arquivo" : l.repasse === null ? "Sem valor informado" : reaisExtenso(l.repasse));
            const t = pnae(c, u.sigla, "todas", ultimoCompleto)!;
            return [u.nome, r(pnae(c, u.sigla, "municipal", ultimoCompleto)), r(pnae(c, u.sigla, "estadual", ultimoCompleto)), r(t), cobertura(t)];
          })}
          limite={100}
        />
      }
    >
      <Contexto>{contexto}</Contexto>
      <GraficoBarras
        titulo={`Repasses federais do PNAE, Brasil, ${anos[0]} a ${anos[anos.length - 1]}, reais nominais`}
        series={[{ id: "repasse", nome: "Repasses federais informados", pontos: serie.map((l) => ({ x: String(l.ano), rotulo: nomeAno(l.ano), y: l.repasse === null ? null : l.repasse / 1e9 })) }]}
        eixoY={{ unidade: "R$ bilhões", zero: true, casas: 2 }}
        orientacao="horizontal"
        rotulosValor
      />
    </FiguraAnalitica>
  );
}

/* ------------------------------------------------------------------ PAA */

const textoPaa = (s: SomaPaa, campo: "fornecedores" | "pagamentos") => {
  const v = s[campo].soma;
  if (v === null) return "Sem dado no extrato";
  return campo === "pagamentos" ? reaisExtenso(v) : int(v);
};

/** PAA: a série do Brasil e a tabela por estado, à vista como antes, na fatia `tabelas`. */
export function PaaEstados({ c, id, titulo, contexto }: { c: Complementos; id: string; titulo: string; contexto: ReactNode }) {
  const anos = Object.keys(c.paa).sort();
  const ultimo = anos[anos.length - 1];
  const ufs = [...c.ufs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const br = c.paa[ultimo].brasil;
  return (
    <>
      <TabelaDados
        idioma="pt"
        recolhida={false}
        id={id}
        tituloVisivel={titulo}
        lead={
          <>
            {contexto}
            <p className="t-corpo mt-3 text-carvao">
              Em {ultimo}, os registros municipais do MDS somam <strong className="tabular-nums">{textoPaa(br, "fornecedores")}</strong> agricultores familiares fornecedores e{" "}
              <strong className="tabular-nums">{textoPaa(br, "pagamentos")}</strong> pagos a eles, em valores nominais. Só {int(br.fornecedores.municipios_com_dado)} dos {int(br.municipios_universo)} municípios têm o campo preenchido.
            </p>
          </>
        }
        titulo="PAA no Brasil por ano: agricultores familiares fornecedores, valor pago e municípios com dado no extrato"
        colunas={["Ano", "Agricultores fornecedores", "Valor pago, R$ nominais", "Municípios com dado / total"]}
        linhas={anos.map((ano) => {
          const s = c.paa[ano].brasil;
          return [ano, textoPaa(s, "fornecedores"), s.pagamentos.soma === null ? "Sem dado no extrato" : reais(s.pagamentos.soma), `${int(s.fornecedores.municipios_com_dado)} de ${int(s.municipios_universo)}`];
        })}
      />
      <TabelaDados
        idioma="pt"
        recolhida={false}
        tituloVisivel={`Por estado, ${ultimo}`}
        titulo={`PAA por estado, ${ultimo}: agricultores fornecedores, valor pago e municípios com dado`}
        colunas={["Estado", "Agricultores fornecedores", "Valor pago", "Municípios com dado / total"]}
        linhas={ufs.map((u) => {
          const s = c.paa[ultimo].ufs[u.sigla];
          return [u.nome, textoPaa(s, "fornecedores"), textoPaa(s, "pagamentos"), `${int(s.fornecedores.municipios_com_dado)} de ${int(s.municipios_universo)}`];
        })}
        limite={100}
        nota={
          <FonteDaMedida inline c={c} fonteId={`mds-paa-${ultimo}`} ficha="san.paa.fornecedores" periodo={`${anos.join(", ")}; referência dezembro de cada ano`} unidade="agricultores fornecedores (pessoas) e R$ nominais do ano" csv="paa.csv"
            ressalva="Modalidades Compra com Doação Simultânea e PAA Leite (fichas IN002 e IN003 do MDS). Município sem o campo fica sem dado: não significa zero nem ausência do programa, e por isso as somas valem só para os municípios com dado. Fornecedores não são pessoas atendidas com os alimentos; o valor pago não é orçamento do programa nem quantidade de alimentos." />
        }
      />
    </>
  );
}

/* ------------------------------------------------------------------ SISVAN */

const faseCurta = (f: string) => f.replace(/^Crianças menores de 5 anos$/, "Menores de 5 anos").replace(/^Crianças entre 5 e 9 anos$/, "De 5 a 9 anos");

export function FiguraSisvan({ c, contexto }: { c: Complementos; contexto?: ReactNode }) {
  return (
    <FiguraAnalitica
      id="acompanhamento-nutricional"
      idioma="pt"
      pergunta="A saúde pública acompanha o estado nutricional da população?"
      subtitulo="Cobertura do acompanhamento · % · Brasil · 2025, preliminar"
      natureza={naturezaDaFicha(c, "san.sisvan.acompanhamento")}
      proveniencia={provenienciaAlimentar(c, "san.sisvan.acompanhamento", { inicio: "2025", fim: "2025" })}
      comoInterpretar="Escala de 0 a 100%, com a referência no total; barras desde zero."
      naoConcluir="Mede quantas pessoas tiveram peso e altura avaliados, não quantas têm desnutrição ou obesidade: o resultado nutricional não está integrado."
      tabela={{ naFigura: "a tabela com os indivíduos avaliados e a cobertura de cada fase da vida, logo abaixo do gráfico." }}
      complemento={
        <>
          <TabelaDados
            idioma="pt"
            recolhida={false}
            titulo="Indivíduos com peso e altura avaliados na atenção primária e cobertura do acompanhamento, por fase da vida, Brasil, 2025, preliminar"
            colunas={["Fase da vida", "Indivíduos avaliados", "Cobertura"]}
            linhas={c.sisvan.map((s) => [s.fase, s.avaliados, pct1(s.cobertura)])}
            casas={[null, 0, null]}
          />
          <FonteDaMedida c={c} fonteId="ms-rgi-2025" ficha="san.sisvan.acompanhamento" periodo="2025, dados preliminares sujeitos a alteração" unidade="indivíduos avaliados e % de cobertura" csv="sisvan.csv"
            ressalva="Tabela 10 do relatório, página impressa 56. Gestantes não estão contabilizadas. Mede quantas pessoas tiveram peso e altura avaliados, não quantas têm desnutrição ou obesidade; o relatório não documenta na tabela o denominador da cobertura, que por isso não é recalculado." />
        </>
      }
    >
      <Contexto>{contexto}</Contexto>
      <GraficoBarras
        titulo="Cobertura do acompanhamento do estado nutricional na atenção primária por fase da vida, Brasil, 2025, dados preliminares"
        series={[{ id: "cobertura", nome: "Cobertura do acompanhamento", pontos: c.sisvan.map((s) => ({ x: s.fase, rotulo: faseCurta(s.fase), y: s.cobertura })) }]}
        eixoY={{ unidade: "%", zero: true, casas: 1 }}
        orientacao="horizontal"
        rotulosValor
        referencias={[{ valor: 100, rotulo: "Total" }]}
      />
    </FiguraAnalitica>
  );
}

/* ------------------------------------------------------------------ números para o panorama */

export function numerosComplementares(c: Complementos) {
  const ipca = c.ipca.filter((p) => p.medida === "doze_meses" && p.categoria === "alimentacao_domicilio").sort((a, b) => a.periodo.localeCompare(b.periodo));
  const ultimoIpca = ipca[ipca.length - 1];
  const pnae2025 = pnae(c, "BR", "todas", 2025)!;
  return {
    cadinsan: { valor: milhoes(c.cadinsan.brasil.com_pbf), bruto: c.cadinsan.brasil.com_pbf, nota: "Brasil · janeiro de 2025 · MDS, CadINSAN" },
    pnae: { valor: milhoes(pnae2025.alunos), bruto: pnae2025.alunos, nota: "Brasil · 2025 · FNDE, PNAE" },
    ipca: {
      valor: ultimoIpca.valor === null ? "Sem valor publicado" : `${dec(ultimoIpca.valor, 2)}%`,
      bruto: ultimoIpca.valor,
      periodo: `12 meses até ${competencia(ultimoIpca.periodo)}`,
      nota: `Brasil · 12 meses até ${competencia(ultimoIpca.periodo)} · IBGE, IPCA`,
    },
  };
}
