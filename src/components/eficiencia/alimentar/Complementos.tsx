/**
 * Seções das bases complementares de Segurança alimentar (21/10/2026). Componentes de servidor:
 * leem a gold já validada pelo pipeline e só formatam. Toda medida sai com unidade, período,
 * território, fonte e ressalva; ausência aparece escrita, nunca como zero.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { TabelaSimples } from "@/components/eficiencia/TabelaSimples";
import {
  BASE_COMPLEMENTOS,
  competencia,
  dec,
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

const METODOS = "/eficiencia-estatal/seguranca-alimentar/metodos";

/** Abertura de seção: pergunta, contexto curto e o conteúdo. */
export function SecaoComplementar({ id, pergunta, children, contexto }: { id: string; pergunta: string; contexto: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="mt-12 border-t border-linha pt-8">
      <h2 id={`${id}-titulo`} className="max-w-3xl font-serif text-3xl leading-tight">{pergunta}</h2>
      <div className="mt-3 max-w-prose2 text-sm leading-relaxed">{contexto}</div>
      {children}
    </section>
  );
}

/** Linha de procedência ao pé de cada medida: fonte com link, período, unidade, ressalva e download. */
export function FonteDaMedida({ c, fonteId, periodo, unidade, ressalva, csv, ficha }: {
  c: Complementos; fonteId: string; periodo: string; unidade: string; ressalva: string; csv?: string; ficha: string;
}) {
  const f = fonte(c, fonteId);
  return (
    <div className="mt-4 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
      <p>
        Fonte: <a href={f.pagina} className="text-obee-dark underline underline-offset-2">{f.nome}</a>. Período: {periodo}. Unidade: {unidade}. {ressalva}
      </p>
      <p className="mt-1 flex flex-wrap gap-x-5">
        <Link href={`${METODOS}#${ficha}`} className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-2">Ficha completa da medida →</Link>
        {csv && <a href={`${BASE_COMPLEMENTOS}/${csv}`} download className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-2">Baixar dados · CSV ↓</a>}
      </p>
    </div>
  );
}

/** Barra horizontal desde zero, com rótulo e valor alinhados; o valor nulo vira texto de ausência. */
function Barra({ rotulo, valor, maximo, texto }: { rotulo: string; valor: number | null; maximo: number; texto: string }) {
  // No celular, rótulo e valor ficam numa linha e a barra ocupa a largura toda embaixo; do sm em diante, três colunas fixas,
  // para que todas as barras tenham o mesmo comprimento de trilho.
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-1 text-sm sm:grid-cols-[9rem_1fr_7.5rem]">
      <span className="order-1 truncate" title={rotulo}>{rotulo}</span>
      <div className="order-3 col-span-2 h-3 bg-obee-fundo sm:order-2 sm:col-span-1" aria-hidden="true">
        {valor !== null && <div className="h-full bg-obee" style={{ width: `${(100 * valor) / maximo}%` }} />}
      </div>
      <span className="order-2 text-right tabular-nums sm:order-3">{texto}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ EBIA urbano e rural */

export function EbiaUrbanoRural({ c }: { c: Complementos }) {
  const anos = [2024, 2023];
  const linhas = c.ebia.filter((e) => e.nivel !== "uf" && e.situacao !== "total");
  const territorios = [...new Set(linhas.map((e) => e.territorio))];
  const valor = (t: string, ano: number, s: "urbana" | "rural", k: "insegura" | "grave") => {
    const v = linhas.find((e) => e.territorio === t && e.ano === ano && e.situacao === s)?.classes[k].pct;
    return v === null || v === undefined ? "Não publicado" : pct1(v);
  };
  return (
    <>
      {anos.map((ano) => (
        <div key={ano} className="mt-6">
          <TabelaSimples
            legenda={`Domicílios com insegurança alimentar em áreas urbanas e rurais, ${ano}, % dos domicílios de cada situação`}
            cabecalho={[`Território · ${ano}`, "Urbana: insegurança total", "Rural: insegurança total", "Urbana: grave", "Rural: grave"]}
            linhas={territorios.map((t) => [t, valor(t, ano, "urbana", "insegura"), valor(t, ano, "rural", "insegura"), valor(t, ano, "urbana", "grave"), valor(t, ano, "rural", "grave")])}
          />
        </div>
      ))}
      <FonteDaMedida c={c} fonteId="sidra-9552-percentual" ficha="san.ebia.uf.percentual" periodo="2023 e 2024" unidade="% dos domicílios particulares de cada situação" csv="ebia-territorios.csv"
        ressalva="Percentuais publicados pelo IBGE, sem recálculo. O IBGE não publica a divisão urbana e rural por estado nesta tabela; a comparação fica em Brasil e Grandes Regiões. Estimativa amostral: diferenças pequenas podem estar dentro do erro." />
    </>
  );
}

/* ------------------------------------------------------------------ CadINSAN por estado */

export function CadinsanEstados({ c }: { c: Complementos }) {
  const br = c.cadinsan.brasil;
  const ufs = [...c.ufs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return (
    <>
      <dl className="mt-6 grid gap-6 border-y border-linha py-6 sm:grid-cols-3">
        <div>
          <dd className="font-serif text-4xl tabular-nums">{milhoes(br.com_pbf)}</dd>
          <dt className="mt-2 text-sm">famílias do Cadastro Único em risco estimado de insegurança alimentar grave</dt>
          <dd className="mt-1 text-xs text-carvao-muted">Brasil · janeiro de 2025 · soma dos {int(br.municipios)} municípios do anexo</dd>
        </div>
        <div>
          <dd className="font-serif text-4xl tabular-nums">{pct1(br.pct_com_pbf)}</dd>
          <dt className="mt-2 text-sm">dos {milhoes(br.cadastros)} de famílias analisadas</dt>
          <dd className="mt-1 text-xs text-carvao-muted">Calculado: soma das famílias em risco ÷ soma das analisadas</dd>
        </div>
        <div>
          <dd className="font-serif text-4xl tabular-nums">{milhoes(br.sem_pbf)}</dd>
          <dt className="mt-2 text-sm">famílias no cenário de modelagem sem a renda do Bolsa Família</dt>
          <dd className="mt-1 text-xs text-carvao-muted">Cenário do modelo, não efeito observado</dd>
        </div>
      </dl>
      <div className="mt-6">
        <TabelaSimples
          legenda="CadINSAN por estado, janeiro de 2025: famílias do Cadastro Único em risco estimado de insegurança alimentar grave, somas calculadas do anexo municipal"
          cabecalho={["Estado", "Famílias em risco, com Bolsa Família", "% das analisadas", "Famílias analisadas", "% no cenário sem o programa"]}
          linhas={[
            ["Brasil", int(br.com_pbf), pct1(br.pct_com_pbf), int(br.cadastros), pct1(br.pct_sem_pbf)],
            ...ufs.map((u) => {
              const s = c.cadinsan.ufs[u.sigla];
              return [u.nome, int(s.com_pbf), pct1(s.pct_com_pbf), int(s.cadastros), pct1(s.pct_sem_pbf)];
            }),
          ]}
        />
      </div>
      <FonteDaMedida c={c} fonteId="mds-cadinsan-2025" ficha="san.cadinsan.risco" periodo="Cadastro Único de janeiro de 2025, relatório publicado em 2026" unidade="famílias e % das famílias analisadas" csv="cadinsan.csv"
        ressalva={`Município como publicado pelo MDS; estado e Brasil somados do anexo municipal, que totaliza ${int(br.cadastros)} famílias analisadas, enquanto o corpo do relatório cita 21.460.006 famílias atualizadas: a diferença não foi distribuída. É risco estimado por modelo entre famílias cadastradas, não a EBIA nem a situação de toda a população. Em ${int(c.cadinsan.divergencias_cenario)} municípios o cenário sem o programa traz valor menor que o cenário com o programa, como publicado.`} />
    </>
  );
}

/* ------------------------------------------------------------------ PNAE */

const pnae = (c: Complementos, territorio: string, rede: LinhaPnae["rede"], ano: number) =>
  c.pnae.linhas.find((l) => l.territorio === territorio && l.rede === rede && l.ano === ano);

function anosPnae(c: Complementos) {
  return [...new Set(c.pnae.linhas.map((l) => l.ano))].sort((a, b) => a - b);
}

export function PnaeAtendimento({ c }: { c: Complementos }) {
  const anos = anosPnae(c);
  const ultimoCompleto = 2025;
  const br = pnae(c, "BR", "todas", ultimoCompleto)!;
  const serie = anos.map((ano) => pnae(c, "BR", "todas", ano)!);
  const maximo = Math.max(...serie.map((l) => l.alunos));
  const ufs = [...c.ufs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return (
    <>
      <p className="mt-6 max-w-prose2 text-base leading-relaxed">
        Em {ultimoCompleto}, o FNDE registrou <strong className="tabular-nums">{milhoes(br.alunos)}</strong> de alunos e <strong className="tabular-nums">{int(br.escolas)}</strong> escolas
        nas {int(br.entidades)} entidades executoras do PNAE: prefeituras e secretarias estaduais de educação.
      </p>
      <figure className="mt-6" aria-label={`Alunos registrados no PNAE, Brasil, ${anos[0]} a ${anos[anos.length - 1]}, redes municipais e estaduais somadas`}>
        <figcaption className="mb-3 text-sm">Alunos registrados no PNAE · Brasil · redes municipais e estaduais · {anos[0]} a {anos[anos.length - 1]}</figcaption>
        {serie.map((l) => (
          <Barra key={l.ano} rotulo={l.ano === 2026 ? "2026 (em curso)" : String(l.ano)} valor={l.alunos} maximo={maximo} texto={milhoes(l.alunos)} />
        ))}
        <p className="mt-2 text-xs text-carvao-muted">Barras desde zero. 2026 é exercício em curso e não se compara a um ano encerrado.</p>
      </figure>
      <details className="mt-4 border-y border-linha py-2">
        <summary className="min-h-[44px] cursor-pointer py-3 text-sm font-medium">Tabela da série por rede</summary>
        <TabelaSimples
          legenda="Alunos e escolas registrados no PNAE por rede, Brasil, por exercício"
          cabecalho={["Exercício", "Alunos, rede municipal", "Alunos, rede estadual", "Alunos, total", "Escolas, total"]}
          linhas={anos.map((ano) => [ano === 2026 ? "2026 (em curso)" : String(ano), int(pnae(c, "BR", "municipal", ano)!.alunos), (pnae(c, "BR", "estadual", ano) ? int(pnae(c, "BR", "estadual", ano)!.alunos) : "Sem entidade estadual no arquivo"), int(pnae(c, "BR", "todas", ano)!.alunos), int(pnae(c, "BR", "todas", ano)!.escolas)])}
        />
      </details>
      <h3 className="mt-8 font-serif text-xl">Por estado, {ultimoCompleto}</h3>
      <div className="mt-3">
        <TabelaSimples
          legenda={`Alunos e escolas registrados no PNAE por estado e rede, ${ultimoCompleto}`}
          cabecalho={["Estado", "Alunos, rede municipal", "Alunos, rede estadual", "Alunos, total", "Escolas, total"]}
          linhas={ufs.map((u) => {
            const m = pnae(c, u.sigla, "municipal", ultimoCompleto);
            const e = pnae(c, u.sigla, "estadual", ultimoCompleto);
            const t = pnae(c, u.sigla, "todas", ultimoCompleto)!;
            return [u.nome, m ? int(m.alunos) : "Sem rede municipal no arquivo", e ? int(e.alunos) : "Sem entidade estadual no arquivo", int(t.alunos), int(t.escolas)];
          })}
        />
      </div>
      <FonteDaMedida c={c} fonteId="fnde-pnae" ficha="san.pnae.alunos" periodo={`exercícios de ${anos[0]} a ${anos[anos.length - 1]}; 2026 em curso`} unidade="alunos e escolas registrados" csv="pnae.csv"
        ressalva="Somas das entidades executoras de cada rede. Aluno registrado não comprova refeição servida, frequência à alimentação nem pessoa única; escola registrada não comprova oferta diária." />
    </>
  );
}

export function PnaeRepasses({ c }: { c: Complementos }) {
  const anos = anosPnae(c);
  const ultimoCompleto = 2025;
  const serie = anos.map((ano) => pnae(c, "BR", "todas", ano)!);
  const maximo = Math.max(...serie.map((l) => l.repasse ?? 0));
  const br = pnae(c, "BR", "todas", ultimoCompleto)!;
  const ufs = [...c.ufs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const cobertura = (l: LinhaPnae) => `${int(l.entidades_com_repasse)} de ${int(l.entidades)}`;
  return (
    <>
      <p className="mt-6 max-w-prose2 text-base leading-relaxed">
        Em {ultimoCompleto}, os repasses federais informados para a alimentação escolar somaram <strong className="tabular-nums">{br.repasse === null ? "valor não informado" : reaisExtenso(br.repasse)}</strong> em valores nominais,
        em {cobertura(br)} entidades executoras com valor informado.
      </p>
      <figure className="mt-6" aria-label={`Repasses federais do PNAE, Brasil, ${anos[0]} a ${anos[anos.length - 1]}, reais nominais`}>
        <figcaption className="mb-3 text-sm">Repasses federais informados · Brasil · R$ nominais de cada exercício · {anos[0]} a {anos[anos.length - 1]}</figcaption>
        {serie.map((l) => (
          <Barra key={l.ano} rotulo={l.ano === 2026 ? "2026 (em curso)" : String(l.ano)} valor={l.repasse} maximo={maximo} texto={l.repasse === null ? "Sem valor informado" : reaisExtenso(l.repasse)} />
        ))}
        <p className="mt-2 text-xs text-carvao-muted">Barras desde zero, sem correção pela inflação: valores de anos diferentes não têm o mesmo poder de compra. 2026 acumula só o que foi repassado até a captura.</p>
      </figure>
      <details className="mt-4 border-y border-linha py-2">
        <summary className="min-h-[44px] cursor-pointer py-3 text-sm font-medium">Tabela da série com a cobertura de cada ano</summary>
        <TabelaSimples
          legenda="Repasses federais do PNAE, Brasil, por exercício, com entidades que têm valor informado"
          cabecalho={["Exercício", "Repasse, rede municipal", "Repasse, rede estadual", "Repasse, total", "Entidades com valor / total"]}
          linhas={anos.map((ano) => {
            const m = pnae(c, "BR", "municipal", ano)!;
            const e = pnae(c, "BR", "estadual", ano);
            const t = pnae(c, "BR", "todas", ano)!;
            const r = (l?: LinhaPnae) => (l?.repasse == null ? "Sem valor informado" : reais(l.repasse));
            return [ano === 2026 ? "2026 (em curso)" : String(ano), r(m), r(e), r(t), cobertura(t)];
          })}
        />
      </details>
      <h3 className="mt-8 font-serif text-xl">Por estado, {ultimoCompleto}</h3>
      <div className="mt-3">
        <TabelaSimples
          legenda={`Repasses federais do PNAE por estado e rede, ${ultimoCompleto}, R$ nominais`}
          cabecalho={["Estado", "Rede municipal", "Rede estadual", "Total", "Entidades com valor / total"]}
          linhas={ufs.map((u) => {
            const m = pnae(c, u.sigla, "municipal", ultimoCompleto);
            const e = pnae(c, u.sigla, "estadual", ultimoCompleto);
            const t = pnae(c, u.sigla, "todas", ultimoCompleto)!;
            const r = (l?: LinhaPnae) => (!l ? "Sem entidade no arquivo" : l.repasse === null ? "Sem valor informado" : reaisExtenso(l.repasse));
            return [u.nome, r(m), r(e), r(t), cobertura(t)];
          })}
        />
      </div>
      <FonteDaMedida c={c} fonteId="fnde-pnae" ficha="san.pnae.repasses" periodo={`exercícios de ${anos[0]} a ${anos[anos.length - 1]}; 2026 em curso`} unidade="R$ nominais do exercício" csv="pnae.csv"
        ressalva={`Transferência federal não é a despesa total do ente com alimentação escolar, que inclui recursos próprios, nem custo por refeição. ${int(c.pnae.repasses_ausentes)} dos ${int(c.pnae.registros)} registros do arquivo não trazem valor de repasse e ficam fora da soma, que informa quantas entidades entraram.`} />
    </>
  );
}

/* ------------------------------------------------------------------ PAA */

const textoPaa = (s: SomaPaa, campo: "fornecedores" | "pagamentos") => {
  const v = s[campo].soma;
  if (v === null) return "Sem dado no extrato";
  return campo === "pagamentos" ? reaisExtenso(v) : int(v);
};

export function PaaEstados({ c }: { c: Complementos }) {
  const anos = Object.keys(c.paa).sort();
  const ultimo = anos[anos.length - 1];
  const ufs = [...c.ufs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const br = c.paa[ultimo].brasil;
  return (
    <>
      <p className="mt-6 max-w-prose2 text-base leading-relaxed">
        Em {ultimo}, os registros municipais do MDS somam <strong className="tabular-nums">{textoPaa(br, "fornecedores")}</strong> agricultores familiares fornecedores e{" "}
        <strong className="tabular-nums">{textoPaa(br, "pagamentos")}</strong> pagos a eles, em valores nominais. Só {int(br.fornecedores.municipios_com_dado)} dos {int(br.municipios_universo)} municípios têm o campo preenchido.
      </p>
      <div className="mt-6">
        <TabelaSimples
          legenda="PAA no Brasil por ano: agricultores familiares fornecedores, valor pago e municípios com dado no extrato"
          cabecalho={["Ano", "Agricultores fornecedores", "Valor pago, R$ nominais", "Municípios com dado / total"]}
          linhas={anos.map((ano) => {
            const s = c.paa[ano].brasil;
            return [ano, textoPaa(s, "fornecedores"), s.pagamentos.soma === null ? "Sem dado no extrato" : reais(s.pagamentos.soma), `${int(s.fornecedores.municipios_com_dado)} de ${int(s.municipios_universo)}`];
          })}
        />
      </div>
      <h3 className="mt-8 font-serif text-xl">Por estado, {ultimo}</h3>
      <div className="mt-3">
        <TabelaSimples
          legenda={`PAA por estado, ${ultimo}: agricultores fornecedores, valor pago e municípios com dado`}
          cabecalho={["Estado", "Agricultores fornecedores", "Valor pago", "Municípios com dado / total"]}
          linhas={ufs.map((u) => {
            const s = c.paa[ultimo].ufs[u.sigla];
            return [u.nome, textoPaa(s, "fornecedores"), textoPaa(s, "pagamentos"), `${int(s.fornecedores.municipios_com_dado)} de ${int(s.municipios_universo)}`];
          })}
        />
      </div>
      <FonteDaMedida c={c} fonteId={`mds-paa-${ultimo}`} ficha="san.paa.fornecedores" periodo={`${anos.join(", ")}; referência dezembro de cada ano`} unidade="agricultores fornecedores (pessoas) e R$ nominais do ano" csv="paa.csv"
        ressalva="Modalidades Compra com Doação Simultânea e PAA Leite (fichas IN002 e IN003 do MDS). Município sem o campo fica sem dado: não significa zero nem ausência do programa, e por isso as somas valem só para os municípios com dado. Fornecedores não são pessoas atendidas com os alimentos; o valor pago não é orçamento do programa nem quantidade de alimentos." />
    </>
  );
}

/* ------------------------------------------------------------------ SISVAN */

export function SisvanFases({ c }: { c: Complementos }) {
  return (
    <>
      <figure className="mt-6" aria-label="Cobertura do acompanhamento do estado nutricional na atenção primária por fase da vida, Brasil, 2025, dados preliminares">
        <figcaption className="mb-3 text-sm">Cobertura do acompanhamento · Brasil · 2025, preliminar · % (escala de 0 a 100)</figcaption>
        {c.sisvan.map((s) => (
          <Barra key={s.fase} rotulo={s.fase.replace(/^Crianças menores de 5 anos$/, "Menores de 5 anos").replace(/^Crianças entre 5 e 9 anos$/, "De 5 a 9 anos")} valor={s.cobertura} maximo={100} texto={pct1(s.cobertura)} />
        ))}
      </figure>
      <div className="mt-5">
        <TabelaSimples
          legenda="Indivíduos com peso e altura avaliados na atenção primária e cobertura do acompanhamento, por fase da vida, Brasil, 2025, preliminar"
          cabecalho={["Fase da vida", "Indivíduos avaliados", "Cobertura"]}
          linhas={c.sisvan.map((s) => [s.fase, int(s.avaliados), pct1(s.cobertura)])}
        />
      </div>
      <FonteDaMedida c={c} fonteId="ms-rgi-2025" ficha="san.sisvan.acompanhamento" periodo="2025, dados preliminares sujeitos a alteração" unidade="indivíduos avaliados e % de cobertura"
        csv="sisvan.csv"
        ressalva="Tabela 10 do relatório, página impressa 56. Gestantes não estão contabilizadas. Mede quantas pessoas tiveram peso e altura avaliados, não quantas têm desnutrição ou obesidade; o relatório não documenta na tabela o denominador da cobertura, que por isso não é recalculado." />
    </>
  );
}

/* ------------------------------------------------------------------ números para o panorama */

export function numerosComplementares(c: Complementos) {
  const ipca = c.ipca.filter((p) => p.medida === "doze_meses" && p.categoria === "alimentacao_domicilio").sort((a, b) => a.periodo.localeCompare(b.periodo));
  const ultimoIpca = ipca[ipca.length - 1];
  const pnae2025 = pnae(c, "BR", "todas", 2025)!;
  return {
    cadinsan: { valor: milhoes(c.cadinsan.brasil.com_pbf), nota: "Brasil · janeiro de 2025 · MDS, CadINSAN" },
    pnae: { valor: milhoes(pnae2025.alunos), nota: "Brasil · 2025 · FNDE, PNAE" },
    ipca: { valor: ultimoIpca.valor === null ? "Sem valor publicado" : `${dec(ultimoIpca.valor, 2)}%`, nota: `Brasil · 12 meses até ${competencia(ultimoIpca.periodo)} · IBGE, IPCA` },
  };
}
