import Link from "next/link";
import { ROTULO_MOTIVO, cnpjFormatado, nomeOuCnpj, textoArvore, type ArvoreSocietaria } from "@/lib/energia/empresas";
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
export function EmpresasArvore({ a, ir, href }: { a: ArvoreSocietaria; ir?: (cnpj: string) => void; href?: (cnpj: string) => string }) {
  const topo = a.cadeia[a.cadeia.length - 1];
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
      <p className="text-carvao">{textoArvore(a)}</p>
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
            {a.acimaDoTopo.map((s, i) => (
              <li key={`acima-${i}`} className="text-carvao-muted">
                <span className="mr-1 text-xs text-mineral">acima do topo, sem CNPJ</span>
                {s.nome ?? "sem nome publicado"}
                {s.pct !== null ? ` (${num(s.pct, 2)}%)` : ""}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-carvao-muted">
            A cadeia para em {nomeOuCnpj(topo.nome, topo.cnpj)}: {a.motivoTopo ? ROTULO_MOTIVO[a.motivoTopo] : "motivo não publicado"}.
          </p>
        </div>
        <div>
          <p className="rotulo text-mineral">Sócios diretos declarados</p>
          {a.socios.length ? (
            <ul className="mt-1 max-h-80 space-y-1 overflow-y-auto">
              {a.socios.map((s, i) => (
                <li key={`${s.cnpj ?? "s"}-${i}`} className="flex flex-wrap items-baseline gap-x-2">
                  {s.cnpj ? no(s.cnpj, s.nome) : <span className="text-carvao-muted">{s.nome ?? "sem nome publicado"}</span>}
                  <span className="text-xs text-carvao-muted">
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
            <ul className="mt-1 max-h-80 space-y-1 overflow-y-auto">
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
