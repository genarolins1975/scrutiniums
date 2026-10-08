import Link from "next/link";
import { cnpjFormatado, nomeOuCnpj, textoArvore, textoSocios, type ArvoreSocietaria } from "@/lib/energia/empresas";
import { num } from "@/lib/energia/formato";

/**
 * Árvore societária de um CNPJ como listas semânticas (não desenho): a cadeia de controladores
 * únicos declarada à ANEEL de baixo para cima, com o motivo da parada no topo; os sócios diretos
 * com o percentual direto quando a fonte o define; e as empresas de que ele é sócio controlador.
 *
 * Sem estado: no painel de controle (componente cliente) cada nó é um botão que troca a árvore
 * (`ir`); na ficha da distribuidora (servidor) cada nó é um link para a árvore daquele CNPJ no
 * painel de controle (`href`). Nome de pessoa nunca aparece: o arquivo da cadeia já traz
 * "pessoa física" ou "sócio sem documento" no lugar.
 */
export function EmpresasArvore({
  a,
  ir,
  href,
  motivos = [],
  resumo = true,
}: {
  a: ArvoreSocietaria;
  ir?: (cnpj: string) => void;
  href?: (cnpj: string) => string;
  /** Frase-resumo da árvore no alto; na ficha, a frase da própria seção já diz o topo e o motivo. */
  resumo?: boolean;
  /** Motivos de parada com a explicação que a gold publica (controle.cobertura.motivos_parada). */
  motivos?: readonly { motivo: string; rotulo: string }[];
}) {
  const nivelDoCnpj = new Map(a.cadeia.map((n, i) => [n.cnpj, i]));
  // controladores sem CNPJ acima do topo, reunidos por nome: sete "pessoa física" viram uma linha com os sete percentuais
  const acima: { nome: string; n: number; pcts: string[] }[] = [];
  for (const s of a.acimaDoTopo) {
    const nome = s.nome ?? "sem nome publicado";
    const g = acima.find((x) => x.nome === nome) ?? acima[acima.push({ nome, n: 0, pcts: [] }) - 1];
    g.n += 1;
    if (s.pct !== null) g.pcts.push(`${num(s.pct, 2)}%`);
  }
  const no = (cnpj: string, nome: string | null, atual = false) => {
    const classe = `inline-flex min-h-[44px] items-center text-left underline underline-offset-4 ${atual ? "font-medium text-carvao" : "text-energia-dark hover:text-carvao"}`;
    if (ir)
      return (
        <button type="button" onClick={() => ir(cnpj)} aria-current={atual ? "true" : undefined} className={classe}>
          {nomeOuCnpj(nome, cnpj)}
        </button>
      );
    if (href && !atual)
      return (
        <Link href={href(cnpj)} className={classe}>
          {nomeOuCnpj(nome, cnpj)}
        </Link>
      );
    return <span className={atual ? "font-medium text-carvao" : "text-carvao"}>{nomeOuCnpj(nome, cnpj)}</span>;
  };
  return (
    <div className="space-y-4 text-sm" aria-live={ir ? "polite" : undefined}>
      {resumo && <p className="text-carvao">{textoArvore(a, motivos)}</p>}
      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <p className="rotulo text-mineral">Cadeia de controle, de baixo para cima</p>
          <ol className="mt-1 space-y-1 border-l-2 border-energia pl-3">
            {a.cadeia.map((n, i) => (
              <li key={n.cnpj}>
                <span className="mr-1 text-xs text-mineral">{i === 0 ? "escolhida" : `nível ${i}`}</span>
                {no(n.cnpj, n.nome, i === 0)}
                <span className="block text-xs text-carvao-muted">CNPJ {cnpjFormatado(n.cnpj)}</span>
              </li>
            ))}
            {acima.map((g) => (
              <li key={`acima-${g.nome}`} className="text-carvao-muted">
                <span className="mr-1 text-xs text-mineral">controlador acima do topo, sem CNPJ</span>
                {g.n > 1 ? `${g.n} × ` : ""}
                {g.nome}
                {g.pcts.length ? ` (${g.pcts.join("; ")})` : ""}
              </li>
            ))}
          </ol>
          <p className="mt-1 text-xs text-carvao-muted" data-nomes-cnpj="">
            O nome de cada nível é a razão social registrada para o CNPJ; o nome de um sócio é o que o declarante escreveu à ANEEL. O mesmo CNPJ pode aparecer com nomes diferentes: o CNPJ é o que identifica a empresa.
          </p>
        </div>
        <div>
          <p className="rotulo text-mineral">Sócios diretos declarados</p>
          {a.socios.length > 0 && (
            <p className="mt-1 text-xs text-carvao-muted" data-resumo-socios="">
              {textoSocios(a.socios)} &ldquo;Controlador&rdquo; é a marca que a própria declaração põe no sócio; o observatório não a deduz do percentual.
            </p>
          )}
          {a.socios.length ? (
            <ul className="mt-1 max-h-80 space-y-1 overflow-y-auto" tabIndex={0} aria-label="Sócios diretos declarados (lista rolável)">
              {a.socios.map((s, i) => (
                <li key={`${s.cnpj ?? "s"}-${i}`} className="flex flex-wrap items-baseline gap-x-2">
                  {s.cnpj ? no(s.cnpj, s.nome) : <span className="text-carvao-muted">{s.nome ?? "sem nome publicado"}</span>}
                  <span className="text-xs text-carvao-muted">
                    {s.cnpj ? `CNPJ ${cnpjFormatado(s.cnpj)}${nivelDoCnpj.has(s.cnpj) ? `, o mesmo do ${nivelDoCnpj.get(s.cnpj) === 0 ? "nível escolhido" : `nível ${nivelDoCnpj.get(s.cnpj)}`}` : ""} · ` : ""}
                    {s.pct !== null ? `${num(s.pct, 2)}% direto` : "percentual direto indefinido na fonte"}
                    {s.controlador ? " · controlador" : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-carvao-muted">Nenhum sócio declarado na janela vigente.</p>
          )}
        </div>
        <div>
          <p className="rotulo text-mineral">Empresas em que é sócia controladora</p>
          {a.controladas.length ? (
            <ul className="mt-1 max-h-80 space-y-1 overflow-y-auto" tabIndex={0} aria-label="Empresas controladas (lista rolável)">
              {a.controladas.map((c) => (
                <li key={c.cnpj} className="flex flex-wrap items-baseline gap-x-2">
                  {no(c.cnpj, c.nome)}
                  <span className="text-xs text-carvao-muted">{c.pct !== null ? `${num(c.pct, 2)}% direto` : "percentual direto indefinido na fonte"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-carvao-muted">Não aparece como sócia controladora de nenhuma empresa declarada.</p>
          )}
        </div>
      </div>
    </div>
  );
}
