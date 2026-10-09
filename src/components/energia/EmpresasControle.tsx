"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { EmpresasArvore } from "@/components/energia/EmpresasArvore";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { COLUNAS_GRUPOS, COR_MEDIDA, ESQUEMA_CONTROLE, ROTULO_MOTIVO, arvoreDe, carregarJson, cnpjFormatado, entidadesCadeia, inteiro, type ArvoreSocietaria } from "@/lib/energia/empresas";
import { SIGLAS } from "@/lib/energia/siglas";
import { buscarEntidades, type EntidadeBuscavel, type LinhaTabela } from "@/lib/energia/tabela";
import type { CadeiaSocietaria } from "@/lib/energia/tipos-empresas";

/**
 * P039: os maiores grupos de controle, com a capacidade proporcional e a capacidade sob controle
 * lado a lado (duas medidas distintas, nunca somadas), e a árvore societária do CNPJ escolhido:
 * a cadeia de controladores únicos declarada à ANEEL até o topo (e por que para ali), os sócios
 * diretos com o percentual direto quando a fonte o define, e as empresas que ele controla.
 *
 * Seleção sincronizada: escolher um grupo nas barras, na tabela ou na busca abre a árvore dele;
 * clicar num nó da árvore navega até ele. O CNPJ fica na URL (?ctl.e=), e o voltar refaz o
 * caminho. A árvore do maior grupo chega com a página; as demais vêm do arquivo da cadeia
 * (cerca de 1,1 MB), buscado no navegador na primeira troca.
 */
export type EmpresasControleProps = {
  linhasGrupos: LinhaTabela[];
  barras: { id: string; rotulo: string; mw_proporcional: number | null; mw_controle: number | null }[];
  entidades: EntidadeBuscavel[];
  padrao: string;
  arvoreInicial: ArvoreSocietaria | null;
  urlCadeia: string;
  /** Motivos de parada da cadeia com a explicação que a gold publica (controle.cobertura.motivos_parada). */
  motivos: { motivo: string; rotulo: string; proprietarios: number }[];
  /** Grupos de controle da base inteira, para dizer quantos o gráfico e a tabela deixam de fora. */
  totalGrupos: number | null;
  /** Arquivo com a lista inteira dos grupos. */
  csv: { rotulo: string; url: string } | null;
  /** Recorte e notas do painel, logo depois do gráfico e da tabela dos grupos (a figura principal) e antes da árvore. */
  aposFigura?: ReactNode;
  fonte: string;
  versao: string;
};

export function EmpresasControle({ linhasGrupos, barras, entidades, padrao, arvoreInicial, urlCadeia, motivos, totalGrupos, csv, aposFigura, fonte, versao }: EmpresasControleProps) {
  const [v, definir] = useEstadoUrl(ESQUEMA_CONTROLE);
  const alvo = v.e || padrao;
  const [cadeia, setCadeia] = useState<CadeiaSocietaria | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const precisaArquivo = alvo !== padrao || !arvoreInicial;

  useEffect(() => {
    if (!precisaArquivo || cadeia) return;
    let vivo = true;
    carregarJson<CadeiaSocietaria>(urlCadeia).then(
      (c) => vivo && setCadeia(c),
      (e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [precisaArquivo, cadeia, urlCadeia]);

  const arvore = useMemo(() => (alvo === padrao && arvoreInicial ? arvoreInicial : cadeia ? arvoreDe(cadeia, alvo) : null), [alvo, padrao, arvoreInicial, cadeia]);
  const opcoes = useMemo(() => (cadeia ? entidadesCadeia(cadeia) : entidades), [cadeia, entidades]);
  const ir = (cnpj: string | null) => cnpj && definir({ e: cnpj === padrao ? "" : cnpj });

  return (
    <div className="space-y-6">
      <GraficoBarras
        titulo="Os maiores grupos: capacidade proporcional e capacidade sob controle"
        dados={barras}
        chaveCategoria="id"
        chaveRotulo="rotulo"
        series={[
          { id: "mw_proporcional", rotulo: "Capacidade proporcional", cor: COR_MEDIDA.proporcional },
          { id: "mw_controle", rotulo: "Capacidade sob controle", cor: COR_MEDIDA.controle },
        ]}
        unidade="MW"
        casas={1}
        orientacao="horizontal"
        alturaCategoria={56}
        alturaMaxima={barras.length * 56}
        selecionado={alvo}
        onSelecionar={ir}
      />
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-universo-parcial="grupos">
        O gráfico mostra {inteiro(barras.length)} dos {inteiro(linhasGrupos.length)} maiores grupos de controle{totalGrupos ? `, de ${inteiro(totalGrupos)} grupos na base` : ""}; cada grupo é identificado pelo CNPJ ({SIGLAS.CNPJ}) de quem está no topo da cadeia declarada. A tabela abaixo traz os{" "}
        {inteiro(linhasGrupos.length)}, e a lista inteira está no{" "}
        {csv ? (
          <a href={csv.url} download className="text-energia-dark underline underline-offset-4 hover:text-carvao">
            {csv.rotulo}
          </a>
        ) : (
          "CSV de grupos"
        )}
        . Capacidade proporcional soma as participações diretas das empresas do grupo; capacidade sob controle conta a usina inteira quando o dono majoritário está no grupo. As duas não se somam.
      </p>
      <TabelaInterativa
        titulo={`Os ${linhasGrupos.length} maiores grupos de controle por capacidade proporcional`}
        colunas={COLUNAS_GRUPOS}
        linhas={linhasGrupos}
        chaveLinha="id"
        colunaRotulo="nome"
        fonte={fonte}
        versao={versao}
        nomeArquivo="empresas-grupos-maiores"
        chaveUrl="ctl.tab"
        ordemInicial={{ coluna: "mw_proporcional", direcao: "desc" }}
        selecionado={alvo}
        onSelecionar={ir}
        dicaBusca="Nome ou CNPJ"
        nota="Escolher uma linha abre a árvore societária do grupo abaixo. A lista inteira está no CSV de grupos."
      />
      <details className="text-sm" data-legenda-motivos="">
        <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4">O que significa cada motivo em &ldquo;Por que a cadeia para aqui&rdquo;</summary>
        <dl className="mt-1 space-y-1 border-l-2 border-linha pl-3 text-carvao-muted">
          {motivos.map((m) => (
            <div key={m.motivo}>
              <dt className="inline font-medium text-carvao">{ROTULO_MOTIVO[m.motivo as keyof typeof ROTULO_MOTIVO] ?? m.motivo}: </dt>
              <dd className="inline">{m.rotulo}.</dd>
            </div>
          ))}
        </dl>
      </details>

      {aposFigura}

      <SecaoDoPainel id="arvore" titulo="Qual é a árvore societária declarada à ANEEL?">
        <BuscaEntidade
          opcoes={opcoes}
          aoEscolher={ir}
          dica={cadeia ? "Nome ou CNPJ de qualquer empresa do arquivo da cadeia" : "Nome ou CNPJ de grupos, proprietários e distribuidoras (as demais empresas entram quando o arquivo da cadeia chega)"}
        />
        {erro && (
          <p role="alert" className="text-sm text-carvao">
            Não foi possível carregar o arquivo da cadeia ({erro}). A cadeia vigente está no CSV da cadeia societária.
          </p>
        )}
        {!arvore && !erro && (
          <p role="status" className="text-sm text-carvao-muted">
            {cadeia ? `O CNPJ ${cnpjFormatado(alvo)} não aparece na composição societária declarada na janela vigente.` : "Carregando o arquivo da cadeia societária…"}
          </p>
        )}
        {arvore && <EmpresasArvore a={arvore} ir={ir} motivos={motivos} />}
      </SecaoDoPainel>
    </div>
  );
}

/**
 * Busca de uma empresa para a árvore: campo de texto e até oito resultados como botões (sem
 * acento e sem caixa, por nome, CNPJ com ou sem pontuação). Cada resultado é um alvo de 44 px
 * alcançável pelo Tab; a contagem fica numa região aria-live.
 */
function BuscaEntidade({ opcoes, aoEscolher, dica }: { opcoes: EntidadeBuscavel[]; aoEscolher: (cnpj: string) => void; dica: string }) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const r = useMemo(() => (texto.trim().length >= 2 ? buscarEntidades(opcoes, texto, 8) : null), [opcoes, texto]);
  return (
    <div role="search" className="space-y-2 text-sm">
      <label htmlFor={id} className="block text-carvao-muted">
        Abrir a árvore de outra empresa
      </label>
      <input
        id={id}
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={dica}
        className="min-h-[44px] w-full max-w-xl border border-linha bg-superficie px-3 text-carvao"
        autoComplete="off"
      />
      <p role="status" aria-live="polite" className="text-xs text-carvao-muted">
        {r ? (r.total ? `${r.total} ${r.total === 1 ? "empresa encontrada" : "empresas encontradas"}${r.total > r.itens.length ? `; mostrando ${r.itens.length}, refine a busca` : ""}.` : "Nenhuma empresa com esse nome ou CNPJ.") : ""}
      </p>
      {r && r.itens.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {r.itens.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => {
                  aoEscolher(e.id);
                  setTexto("");
                }}
                className="inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-left text-carvao hover:border-energia"
              >
                {e.rotulo}
                {e.detalhe ? <span className="ml-2 text-xs text-carvao-muted">{e.detalhe}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
