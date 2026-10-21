/**
 * Método das bases complementares (21/10/2026): fontes com hash, fichas de cada medida, o que não
 * foi integrado e por quê, e downloads. A página de método é aberta (METODOS_EFICIENCIA); por isso
 * aqui só há definição e procedência, sem valores dos dados. Os downloads continuam com conta.
 */
import { BASE_COMPLEMENTOS, type Complementos } from "@/lib/eficiencia/alimentar/complementos";
import { dataBr } from "@/lib/eficiencia/formato";
import { SeloComConta } from "@/components/acesso/SeloComConta";

const CAPITULOS: Record<string, string> = { necessidades: "Necessidades", acesso: "Acesso", qualidade: "Qualidade e continuidade", recursos: "Recursos e estrutura" };

const DOWNLOADS: [string, string][] = [
  ["ebia-territorios.csv", "EBIA por Brasil, região e estado, com coeficiente de variação · CSV"],
  ["cadinsan.csv", "CadINSAN por município, estado e Brasil · CSV"],
  ["pnae.csv", "PNAE por exercício, estado e rede, e por município em 2025 · CSV"],
  ["paa.csv", "PAA por ano, município, estado e Brasil · CSV"],
  ["ipca-alimentacao.csv", "IPCA dos alimentos, mensal e em 12 meses · CSV"],
  ["sisvan.csv", "Acompanhamento nutricional por fase da vida · CSV"],
  ["complementos.json", "Todas as bases complementares agregadas, fichas e manifesto · JSON"],
];

export function MetodosComplementares({ c }: { c: Complementos }) {
  const captura = dataBr(c.manifesto.capturado_em);
  return (
    <>
      <section id="bases-complementares" className="mt-8 border-t border-linha pt-6">
        <h2 className="font-serif text-2xl">Bases complementares</h2>
        <p className="mt-3 max-w-prose2 text-sm leading-relaxed">
          EBIA por estado, CadINSAN, alimentação escolar (PNAE), aquisição de alimentos (PAA), inflação dos alimentos (IPCA) e acompanhamento nutricional (SISVAN). Cada original foi baixado da fonte oficial em {captura}, conferido pelo SHA-256 abaixo e extraído pelo pipeline do painel.
        </p>
        <p className="mt-3 max-w-prose2 text-sm leading-relaxed">
          Regras comuns: o valor publicado pela fonte é mantido como está; quando o painel soma municípios para formar o estado ou o Brasil, o resultado é marcado como calculado e diz quantos municípios entraram. Campo vazio na fonte continua vazio, nunca zero. Valores em reais são nominais. Nenhuma dessas medidas gera ponto no escore de serviço.
        </p>
        <ul className="mt-5 space-y-4 text-sm">
          {c.manifesto.fontes.map((f) => (
            <li key={f.id} className="border-t border-linha pt-4">
              <a href={f.pagina} className="text-obee-dark underline underline-offset-2">{f.nome}</a>
              <p className="mt-1">Período: {f.periodo}. Captura: {captura}. <a href={f.url} className="text-obee-dark underline underline-offset-2">Consulta exata usada na captura</a>.</p>
              {f.sha256 && <p className="mt-1 break-all text-xs text-carvao-muted">SHA-256 do arquivo: {f.sha256}</p>}
              {f.conteudo && (
                <p className="mt-1 break-all text-xs text-carvao-muted">
                  SHA-256 dos registros, ordenados por código do município: {f.conteudo}. O serviço do MDS muda o tempo de resposta no cabeçalho a cada consulta, então o hash do arquivo inteiro ({f.sha256_bytes}) só identifica a cópia baixada.
                </p>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
          Reprodução: <code>python3 -m pipeline.eficiencia_alimentar.complementos --originais pasta --coletar</code> baixa os originais, confere os hashes e compara a reextração com o recorte versionado; sem argumentos, o mesmo módulo valida o recorte e gera a base agregada. SHA-256 do recorte versionado: <span className="break-all">{c.manifesto.seed_sha256}</span>.
        </p>
      </section>

      <section className="mt-8 border-t border-linha pt-6">
        <h2 className="font-serif text-2xl">Fichas das bases complementares</h2>
        {c.fichas.map((f) => (
          <details key={f.id} id={f.id} className="mt-3 border-b border-linha py-3">
            <summary className="min-h-[44px] cursor-pointer text-sm font-medium">{f.nome} · {f.grupo} · capítulo {CAPITULOS[f.capitulo]}</summary>
            <dl className="space-y-2 pb-4 text-sm">
              {([
                ["O que mede", f.definicao],
                ["Universo", f.universo],
                ["Período", f.periodo],
                ["Unidade", f.unidade],
                ["Território", f.territorio],
                ["Frequência", f.frequencia],
                ["Fórmula", f.formula],
                ["Estado do dado", f.estado_do_dado],
                ["Ausências", f.ausencias],
                ["Limites", f.limitacoes],
              ] as [string, string][]).map(([dt, dd]) => (
                <div key={dt}><dt className="font-medium">{dt}</dt><dd className="mt-1 text-carvao-muted">{dd}</dd></div>
              ))}
              <div>
                <dt className="font-medium">Fonte</dt>
                <dd className="mt-1">
                  {(() => {
                    const fonte = c.manifesto.fontes.find((x) => x.id === f.fonte_id)!;
                    return <a href={fonte.pagina} className="text-obee-dark underline underline-offset-2">{fonte.nome}</a>;
                  })()}
                </dd>
              </div>
            </dl>
          </details>
        ))}
      </section>

      <section id="nao-integrado" className="mt-8 border-t border-linha pt-6">
        <h2 className="font-serif text-2xl">Não integrado</h2>
        <p className="mt-3 max-w-prose2 text-sm leading-relaxed">Bases ou recortes que um leitor poderia esperar aqui e que ficaram de fora, com o motivo. Nada foi estimado para ocupar o lugar deles.</p>
        <ul className="mt-4 space-y-3 text-sm">
          {c.nao_integrados.map((n) => (
            <li key={n.base} className="border-t border-linha pt-3">
              <p className="font-medium">{n.base}: não integrado.</p>
              <p className="mt-1 text-carvao-muted">{n.motivo}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 border-t border-linha pt-6">
        <h2 className="font-serif text-2xl">Arquivos das bases complementares</h2>
        <p className="mt-3 max-w-prose2 text-sm leading-relaxed">Os arquivos acompanham o painel e pedem conta gratuita.</p>
        <ul className="mt-4 space-y-2 text-sm">
          {DOWNLOADS.map(([arq, nome]) => (
            <li key={arq}><a href={`${BASE_COMPLEMENTOS}/${arq}`} download className="inline-flex min-h-[44px] items-center text-obee-dark underline">{nome} ↓<SeloComConta href={`${BASE_COMPLEMENTOS}/${arq}`} /></a></li>
          ))}
        </ul>
      </section>
    </>
  );
}
