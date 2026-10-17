import Link from "@/components/energia/LinkSemPrefetch";
import { Nome } from "@/components/i18n/Nome";
import { cnpjFormatado, nomeOuCnpj, textoArvore, textoSocios, type ArvoreSocietaria } from "@/lib/energia/empresas";
import { num } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
import { SOCIO_GENERICO_EN, comNomes, temTraducao, traduzir } from "@/lib/energia/i18n/empresas-leiloes";

/**
 * Árvore societária de um CNPJ como listas semânticas (não desenho): a cadeia de controladores
 * únicos declarada à ANEEL de baixo para cima, com o motivo da parada no topo; os sócios diretos
 * com o percentual direto quando a fonte o define; e as empresas de que ele é sócio controlador.
 *
 * Sem estado: no painel de controle (componente cliente) cada nó é um botão que troca a árvore
 * (`ir`); na ficha da distribuidora (servidor) cada nó é um link para a árvore daquele CNPJ no
 * painel de controle (`href`). Nome de pessoa nunca aparece: o arquivo da cadeia já traz
 * "pessoa física" ou "sócio sem documento" no lugar.
 *
 * Idioma: textos por tx() (serve ao servidor e ao cliente, sem hook); nomes de empresa como
 * nome próprio; os dois rótulos genéricos do arquivo ("pessoa física", "sócio sem documento") em
 * inglês pela tabela do grupo.
 */

/** Nome de sócio ou empresa: rótulo genérico do arquivo no idioma da página; nome declarado como nome próprio. */
function NomeSocio({ nome }: { nome: string }) {
  if (temTraducao(SOCIO_GENERICO_EN, nome)) return <>{traduzir(SOCIO_GENERICO_EN, nome)}</>;
  return <Nome>{nome}</Nome>;
}

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
  const semNome = tx("sem nome publicado", "no name published");
  // controladores sem CNPJ acima do topo, reunidos por nome: sete "pessoa física" viram uma linha com os sete percentuais
  const acima: { nome: string; n: number; pcts: string[] }[] = [];
  for (const s of a.acimaDoTopo) {
    const nome = s.nome ?? semNome;
    const g = acima.find((x) => x.nome === nome) ?? acima[acima.push({ nome, n: 0, pcts: [] }) - 1];
    g.n += 1;
    if (s.pct !== null) g.pcts.push(`${num(s.pct, 2)}%`);
  }
  const no = (cnpj: string, nome: string | null, atual = false) => {
    const classe = `inline-flex min-h-[44px] items-center text-left underline underline-offset-4 ${atual ? "font-medium text-carvao" : "text-energia-dark hover:text-carvao"}`;
    const rotulo = <NomeSocio nome={nomeOuCnpj(nome, cnpj)} />;
    if (ir)
      return (
        <button type="button" onClick={() => ir(cnpj)} aria-current={atual ? "true" : undefined} className={classe}>
          {rotulo}
        </button>
      );
    if (href && !atual)
      return (
        <Link href={href(cnpj)} className={classe}>
          {rotulo}
        </Link>
      );
    return <span className={atual ? "font-medium text-carvao" : "text-carvao"}>{rotulo}</span>;
  };
  const direto = tx("direto", "direct");
  const indefinido = tx("percentual direto indefinido na fonte", "direct percentage undefined in the source");
  return (
    <div className="space-y-4 text-sm" aria-live={ir ? "polite" : undefined}>
      {resumo && <p className="text-carvao">{comNomes(textoArvore(a, motivos), [a.raiz.nome, ...a.cadeia.map((c) => c.nome)])}</p>}
      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <p className="rotulo text-mineral">{tx("Cadeia de controle, de baixo para cima", "Control chain, from the bottom up")}</p>
          <ol className="mt-1 space-y-1 border-l-2 border-energia pl-3">
            {a.cadeia.map((n, i) => (
              <li key={n.cnpj}>
                <span className="mr-1 text-xs text-mineral">{i === 0 ? tx("escolhida", "chosen") : tx(`nível ${i}`, `level ${i}`)}</span>
                {no(n.cnpj, n.nome, i === 0)}
                <span className="block text-xs text-carvao-muted">CNPJ {cnpjFormatado(n.cnpj)}</span>
              </li>
            ))}
            {acima.map((g) => (
              <li key={`acima-${g.nome}`} className="text-carvao-muted">
                <span className="mr-1 text-xs text-mineral">{tx("controlador acima do topo, sem CNPJ", "controlling shareholder above the top, without CNPJ")}</span>
                {g.n > 1 ? `${g.n} × ` : ""}
                {g.nome === semNome ? g.nome : <NomeSocio nome={g.nome} />}
                {g.pcts.length ? ` (${g.pcts.join("; ")})` : ""}
              </li>
            ))}
          </ol>
          <p className="mt-1 text-xs text-carvao-muted" data-nomes-cnpj="">
            {tx(
              "O nome de cada nível é a razão social registrada para o CNPJ; o nome de um sócio é o que o declarante escreveu à ANEEL. O mesmo CNPJ pode aparecer com nomes diferentes: o CNPJ é o que identifica a empresa.",
              "The name at each level is the legal name registered for the CNPJ; a shareholder's name is what the declarant wrote to ANEEL. The same CNPJ can appear with different names: the CNPJ is what identifies the company.",
            )}
          </p>
        </div>
        <div>
          <p className="rotulo text-mineral">{tx("Sócios diretos declarados", "Declared direct shareholders")}</p>
          {a.socios.length > 0 && (
            <p className="mt-1 text-xs text-carvao-muted" data-resumo-socios="">
              {textoSocios(a.socios)}{" "}
              {tx(
                <>&ldquo;Controlador&rdquo; é a marca que a própria declaração põe no sócio; o observatório não a deduz do percentual.</>,
                <>&ldquo;Controlling&rdquo; is the mark that the declaration itself puts on the shareholder; the observatory does not infer it from the percentage.</>,
              )}
            </p>
          )}
          {a.socios.length ? (
            <ul className="mt-1 max-h-80 space-y-1 overflow-y-auto" tabIndex={0} aria-label={tx("Sócios diretos declarados (lista rolável)", "Declared direct shareholders (scrollable list)")}>
              {a.socios.map((s, i) => {
                const nivel = s.cnpj ? nivelDoCnpj.get(s.cnpj) : undefined;
                const mesmo =
                  s.cnpj && nivel !== undefined
                    ? tx(`, o mesmo do ${nivel === 0 ? "nível escolhido" : `nível ${nivel}`}`, `, the same as ${nivel === 0 ? "the chosen level" : `level ${nivel}`}`)
                    : "";
                return (
                  <li key={`${s.cnpj ?? "s"}-${i}`} className="flex flex-wrap items-baseline gap-x-2">
                    {s.cnpj ? no(s.cnpj, s.nome) : <span className="text-carvao-muted">{s.nome ? <NomeSocio nome={s.nome} /> : semNome}</span>}
                    <span className="text-xs text-carvao-muted">
                      {s.cnpj ? `CNPJ ${cnpjFormatado(s.cnpj)}${mesmo} · ` : ""}
                      {s.pct !== null ? `${num(s.pct, 2)}% ${direto}` : indefinido}
                      {s.controlador ? tx(" · controlador", " · controlling") : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-1 text-carvao-muted">{tx("Nenhum sócio declarado na janela vigente.", "No shareholder declared in the current window.")}</p>
          )}
        </div>
        <div>
          <p className="rotulo text-mineral">{tx("Empresas em que é sócia controladora", "Companies in which it is the controlling shareholder")}</p>
          {a.controladas.length ? (
            <ul className="mt-1 max-h-80 space-y-1 overflow-y-auto" tabIndex={0} aria-label={tx("Empresas controladas (lista rolável)", "Controlled companies (scrollable list)")}>
              {a.controladas.map((c) => (
                <li key={c.cnpj} className="flex flex-wrap items-baseline gap-x-2">
                  {no(c.cnpj, c.nome)}
                  <span className="text-xs text-carvao-muted">{c.pct !== null ? `${num(c.pct, 2)}% ${direto}` : indefinido}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-carvao-muted">{tx("Não aparece como sócia controladora de nenhuma empresa declarada.", "It does not appear as the controlling shareholder of any declared company.")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
