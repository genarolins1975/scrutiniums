import { dataBr } from "@/lib/varejo/formato";
import { NOME_CURTO_ATIVIDADE } from "@/lib/varejo/paginas";
import type { FonteCuradoria, SegmentoCuradoria } from "@/lib/varejo/tipos";
import { LINK } from "./comum";

const EQUIVALENCIA: Record<SegmentoCuradoria["equivalencia"], string> = {
  direta: "Equivalência direta com a pesquisa do IBGE",
  parcial: "Equivalência parcial com a pesquisa do IBGE",
  sem_equivalencia: "Sem atividade equivalente na pesquisa do IBGE",
};

const TIPO: Record<string, string> = { nacional: "rede nacional", regional: "rede regional", independentes: "lojas independentes" };

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function Fonte({ f }: Readonly<{ f: FonteCuradoria }>) {
  const titulo = texto(f.titulo) ?? texto(f.nome);
  if (!titulo) return null;
  const url = texto(f.url);
  const consulta = texto(f.consultado_em);
  return (
    <li>
      {url ? (
        <a href={url} rel="noopener noreferrer" target="_blank" className={LINK}>
          {titulo}
        </a>
      ) : (
        titulo
      )}
      {f.pagina ? `, ${/^\d/.test(String(f.pagina)) ? "página " : ""}${f.pagina}` : ""}
      {texto(f.periodo) ? `. Período: ${f.periodo}` : ""}
      {consulta ? `. Consultado em ${/^\d{4}-\d{2}-\d{2}/.test(consulta) ? dataBr(`${consulta.slice(0, 10)}T12:00:00Z`) : consulta}` : ""}.
    </li>
  );
}

/**
 * Um segmento empresarial da curadoria (pipeline/varejo/curadoria/segmentos.json): o que se vende, quem compra, por onde se
 * vende, o que move a demanda, onde se forma a margem, quem concorre e o indicador operacional que vale acompanhar, com a
 * equivalência entre o segmento e as atividades da pesquisa do IBGE dita antes de tudo. Texto escrito à mão a partir de
 * documentos públicos, com as fontes no fim; campo que a curadoria não preencheu não aparece (nunca vira texto inventado).
 */
export function SegmentoCurado({ s }: Readonly<{ s: SegmentoCuradoria }>) {
  const blocos: [string, string | null][] = [
    ["O que se vende", texto(s.o_que_se_vende)],
    ["Quem compra", texto(s.quem_compra)],
    ["Por onde se vende", texto(s.canais)],
    ["O que determina a demanda", texto(s.o_que_determina_a_demanda)],
    ["Onde se forma a margem", texto(s.onde_se_forma_a_margem)],
  ];
  const concorrentes = (s.concorrentes ?? []).filter((c) => texto(c.nome));
  const io = s.indicador_operacional;
  const atividades = (s.atividades_pmc ?? []).map((a) => NOME_CURTO_ATIVIDADE[a] ?? a);
  return (
    <article data-segmento-curado={s.slug} className="border-t border-linha pt-5">
      <h3 className="t-h3 text-carvao">{s.nome}</h3>
      <p className="t-meta mt-2 max-w-prose2 text-carvao">
        <span className="font-medium">{EQUIVALENCIA[s.equivalencia] ?? "Equivalência não informada"}.</span>{" "}
        {atividades.length > 0 ? <>Atividades da pesquisa mensal ligadas a este segmento: {atividades.join("; ").toLowerCase()}.</> : <>A pesquisa mensal de comércio não mede este segmento.</>}
      </p>
      {texto(s.nota_equivalencia) && <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">{s.nota_equivalencia}</p>}
      <dl className="mt-5 grid gap-x-10 gap-y-5 md:grid-cols-2">
        {blocos
          .filter(([, v]) => v)
          .map(([rotulo, v]) => (
            <div key={rotulo} className="min-w-0">
              <dt className="rotulo text-mineral">{rotulo}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-carvao">{v}</dd>
            </div>
          ))}
        {io && texto(io.nome) && (
          <div className="min-w-0">
            <dt className="rotulo text-mineral">Indicador operacional para acompanhar</dt>
            <dd className="mt-1 text-sm leading-relaxed text-carvao">
              <span className="font-medium">{io.nome}.</span> {texto(io.por_que)}
              {texto(io.formula) && <span className="mt-1 block text-carvao-muted">Fórmula: {io.formula}.</span>}
            </dd>
          </div>
        )}
      </dl>
      {concorrentes.length > 0 && (
        <div className="mt-5">
          <h4 className="rotulo text-mineral">Quem concorre</h4>
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-carvao">
            {concorrentes.map((c) => (
              <li key={c.nome}>
                {c.nome}
                {c.tipo && TIPO[c.tipo] ? <span className="text-carvao-muted"> ({TIPO[c.tipo]})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(s.fontes ?? []).length > 0 && (
        <details className="mt-4">
          <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">Fontes deste texto ({s.fontes!.length})</summary>
          <ul className="t-meta mt-1 max-w-prose2 list-disc space-y-1.5 pl-5 text-carvao-muted">
            {s.fontes!.map((f, i) => (
              <Fonte key={i} f={f} />
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

/** Estado "em apuração": a curadoria do segmento ainda não chegou. Diz o que falta e o que continua utilizável. */
export function SegmentoEmApuracao({ atividade }: Readonly<{ atividade: string }>) {
  return (
    <p className="t-meta max-w-prose2 border-t border-linha pt-4 text-carvao-muted" data-segmento-em-apuracao="">
      A descrição do segmento empresarial ligado a {atividade.toLowerCase()} (o que se vende, quem compra, canais, margem e concorrentes) está em apuração e ainda não foi publicada. As séries do IBGE acima não dependem dela.
    </p>
  );
}
