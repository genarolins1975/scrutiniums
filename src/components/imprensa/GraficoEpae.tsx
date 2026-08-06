import Link from "next/link";

/**
 * Gráfico da EPAE (Banco Central) para a página de imprensa.
 *
 * Renderizado no servidor como SVG inline: zero JavaScript no cliente, o que
 * mantém a página leve e permite que a imagem seja copiada, impressa ou salva
 * direto do navegador por quem for citar o dado.
 *
 * A regra editorial da série viaja com ela: isto é o fluxo Pix da SEÇÃO
 * INTEIRA de artes, cultura, esporte e recreação da CNAE — academias, clubes,
 * cinemas, parques, loterias e bets juntos. Nenhuma parcela é atribuída a
 * apostas aqui. O valor que um estudo de terceiro atribui aparece rotulado
 * como tal, ao lado do observado, para que a diferença entre medição e modelo
 * fique explícita para o jornalista.
 *
 * Cores em hexadecimal literal porque atributos SVG não herdam tokens do
 * Tailwind — mesma exceção já adotada em components/dados/GraficoSerie.tsx.
 */

const CARVAO = "#1A1D21";
const MINERAL = "#6B6D6A";
const BRONZE = "#966B48";
const LINHA = "#D8D2C6";

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */
type ObsEpae = {
  ref: string;
  pf_para_secao: number;
  secao_para_pf: number;
  liquido: number;
};

export type DadosEpae = {
  aviso: string;
  revisao: string;
  fonte: { nome: string; pagina: string; url: string };
  secao: { rotulo: string; abrange: string };
  taxonomia: {
    explicacao: string;
    granularidade: string;
    fonte: string;
    url: string;
    divisoes: Array<{ codigo: string; nome: string; jogos: boolean }>;
  };
  leitura: { permite: string[]; nao_permite: string[] };
  cobertura: { inicio: string; fim: string; meses: number };
  serie: { obs: ObsEpae[] };
  anuais: Array<{
    ano: number;
    meses: number;
    completo: boolean;
    pf_para_secao: number;
    secao_para_pf: number;
    liquido: number;
    participacao: number | null;
  }>;
  comparacao: {
    ano: number;
    observado: { valor: number; rotulo: string; derivacao: string; nivel: string };
    atribuido_estudo: { valor: number; rotulo: string; derivacao: string; nivel: string; url: string };
    leitura: string;
  } | null;
};

const n1 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const mesAno = (ref: string) => `${ref.slice(5, 7)}/${ref.slice(0, 4)}`;

const W = 900;
const H = 330;
const M = { t: 16, r: 122, b: 30, l: 44 };

export function GraficoEpae({ dados }: { dados: DadosEpae }) {
  const obs = dados.serie.obs;
  if (obs.length < 2) return null;

  const valores = obs.flatMap((o) => [o.pf_para_secao, o.secao_para_pf, o.liquido]);
  const bruto = { lo: Math.min(...valores), hi: Math.max(...valores) };
  const folga = (bruto.hi - bruto.lo) * 0.08;
  const lo = Math.min(0, bruto.lo - folga);
  const hi = bruto.hi + folga;

  const x = (i: number) => M.l + (i / (obs.length - 1)) * (W - M.l - M.r);
  const y = (v: number) => M.t + (1 - (v - lo) / (hi - lo)) * (H - M.t - M.b);

  const linhas = [
    { chave: "pf_para_secao" as const, rotulo: "pessoas → seção", cor: CARVAO, largura: 1.8 },
    { chave: "secao_para_pf" as const, rotulo: "seção → pessoas", cor: MINERAL, largura: 1.8 },
    { chave: "liquido" as const, rotulo: "líquido", cor: BRONZE, largura: 2.2 },
  ];

  // rótulos de fim de linha com anticolisão vertical simples
  const fins = linhas
    .map((l) => ({ ...l, py: y(obs[obs.length - 1][l.chave]) }))
    .sort((a, b) => a.py - b.py);
  for (let i = 1; i < fins.length; i++) {
    if (fins[i].py - fins[i - 1].py < 13) fins[i].py = fins[i - 1].py + 13;
  }

  const marcas = [lo, lo + (hi - lo) / 2, hi];
  const anos = obs
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => o.ref.slice(5, 7) === "01");

  const ult = obs[obs.length - 1];
  const c = dados.comparacao;

  return (
    <figure className="mt-16 border-t border-linha pt-12">
      <figcaption>
        <h3 className="font-serif text-2xl tracking-[-0.012em] text-carvao">
          Pagamentos Pix da seção de artes, cultura, esporte e recreação
        </h3>
        <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          <strong className="font-medium text-carvao">Esta não é uma série de apostas.</strong>{" "}
          {dados.aviso} É a base sobre a qual estudos de terceiros estimam a parcela das bets —
          publicamos o dado do Banco Central sem atribuir parcela alguma.
        </p>
      </figcaption>

      {/* Sem a taxonomia o leitor não entende por que a série está aqui: as
          casas de apostas se registram na divisão 92 desta seção. */}
      <div className="mt-8 border-l-2 border-linha pl-5">
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          {dados.taxonomia.explicacao}
        </p>
        <ul className="mt-4 space-y-1 text-sm">
          {dados.taxonomia.divisoes.map((d) => (
            <li key={d.codigo} className={d.jogos ? "text-carvao" : "text-carvao-muted"}>
              <span className="tabular-nums">{d.codigo}</span> — {d.nome}
              {d.jogos && (
                <strong className="font-medium text-bronze"> ← as bets se registram aqui</strong>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          {dados.taxonomia.granularidade}{" "}
          <a
            href={dados.taxonomia.url}
            rel="noopener noreferrer"
            target="_blank"
            className="underline decoration-linha underline-offset-4 hover:text-bronze"
          >
            {dados.taxonomia.fonte}
          </a>
          .
        </p>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-8 w-full"
        role="img"
        aria-label={`Fluxos mensais de Pix, em bilhões de reais, entre pessoas físicas e a seção de artes, cultura, esporte e recreação da CNAE, de ${mesAno(dados.cobertura.inicio)} a ${mesAno(dados.cobertura.fim)}. No último mês publicado, pessoas pagaram ${n1(ult.pf_para_secao)} bilhões ao setor, receberam ${n1(ult.secao_para_pf)} bilhões e o líquido foi de ${n1(ult.liquido)} bilhões. Os valores anuais estão na tabela abaixo.`}
      >
        {marcas.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke={LINHA} strokeWidth="0.8" />
            <text x={M.l - 7} y={y(v) + 3.5} fontSize="11" fill={MINERAL} textAnchor="end">
              {n1(v)}
            </text>
          </g>
        ))}
        {lo < 0 && (
          <line x1={M.l} x2={W - M.r} y1={y(0)} y2={y(0)} stroke={MINERAL} strokeWidth="0.9" />
        )}
        {anos.map(({ o, i }) => (
          <text key={o.ref} x={x(i)} y={H - 9} fontSize="11" fill={MINERAL} textAnchor="middle">
            {o.ref.slice(0, 4)}
          </text>
        ))}
        {linhas.map((l) => (
          <path
            key={l.chave}
            d={obs.map((o, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(o[l.chave]).toFixed(1)}`).join("")}
            fill="none"
            stroke={l.cor}
            strokeWidth={l.largura}
            strokeLinejoin="round"
          />
        ))}
        {fins.map((l) => (
          <text key={l.chave} x={W - M.r + 8} y={l.py + 3.5} fontSize="11.5" fill={l.cor}>
            {l.rotulo}
          </text>
        ))}
      </svg>

      <p className="rotulo mt-4 text-mineral">
        fonte:{" "}
        <a
          href={dados.fonte.pagina}
          rel="noopener noreferrer"
          target="_blank"
          className="underline decoration-linha underline-offset-4 hover:text-bronze"
        >
          {dados.fonte.nome}
        </a>{" "}
        · nível A, dado administrativo oficial · {mesAno(dados.cobertura.inicio)} a{" "}
        {mesAno(dados.cobertura.fim)} · R$ bilhões por mês
      </p>

      <h4 className="mt-12 font-serif text-lg text-carvao">
        Por ano civil, em R$ bilhões (soma dos meses publicados)
      </h4>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-linha text-left">
              <th className="rotulo py-2 pr-4 font-normal text-mineral">ano</th>
              <th className="rotulo py-2 pr-4 text-right font-normal text-mineral">pessoas → seção</th>
              <th className="rotulo py-2 pr-4 text-right font-normal text-mineral">seção → pessoas</th>
              <th className="rotulo py-2 pr-4 text-right font-normal text-mineral">líquido</th>
              <th className="rotulo py-2 pr-4 text-right font-normal text-mineral">% do Pix PF→PJ</th>
              <th className="rotulo py-2 font-normal text-mineral">meses publicados</th>
            </tr>
          </thead>
          <tbody>
            {dados.anuais.map((a) => (
              <tr key={a.ano} className="border-b border-linha/60">
                <td className="py-2 pr-4 text-carvao">{a.ano}</td>
                <td className="py-2 pr-4 text-right tabular-nums text-carvao-muted">{n1(a.pf_para_secao)}</td>
                <td className="py-2 pr-4 text-right tabular-nums text-carvao-muted">{n1(a.secao_para_pf)}</td>
                <td className="py-2 pr-4 text-right font-medium tabular-nums text-carvao">{n1(a.liquido)}</td>
                <td className="py-2 pr-4 text-right tabular-nums text-carvao-muted">
                  {a.participacao == null ? "–" : `${n1(a.participacao)}%`}
                </td>
                <td className="py-2 text-carvao-muted">
                  {a.meses}
                  {a.completo ? "" : " · ano incompleto, sem anualização"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        Duas mudanças de patamar acontecem em 2025. O sinal do líquido se inverte: até 2024 a seção
        devolvia às pessoas mais do que recebia; a partir de janeiro de 2025 passa a absorver saldo.
        E o peso da seção salta de cerca de dois para cerca de doze por cento de tudo o que pessoas
        físicas pagam a empresas via Pix — as demais divisões da seção não crescem nesse ritmo. A
        coincidência com o início do mercado regulado de apostas é factual, mas a EPAE não permite
        atribuir a inversão às bets: a seção inteira se move junto, e nenhuma transação vem
        carimbada.
      </p>

      <div className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
        <div>
          <h4 className="font-serif text-lg text-carvao">O que esta série permite dizer</h4>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-carvao-muted">
            {dados.leitura.permite.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-serif text-lg text-carvao">O que ela não permite dizer</h4>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-carvao-muted">
            {dados.leitura.nao_permite.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      </div>

      {c && (
        <>
          <h4 className="mt-12 font-serif text-lg text-carvao">
            O observado e o atribuído não são a mesma grandeza ({c.ano})
          </h4>
          <div className="mt-6 grid gap-x-10 gap-y-8 md:grid-cols-2">
            <div>
              <p className="font-serif text-[2rem] leading-none tracking-[-0.02em] text-carvao">
                R$ {n1(c.observado.valor)} bi
              </p>
              <h5 className="mt-3 text-sm font-medium text-carvao">{c.observado.rotulo}</h5>
              <p className="mt-2 text-sm leading-relaxed text-carvao-muted">{c.observado.derivacao}</p>
              <p className="rotulo mt-3 text-mineral">nível {c.observado.nivel} · dado calculado</p>
            </div>
            <div>
              <p className="font-serif text-[2rem] leading-none tracking-[-0.02em] text-carvao">
                R$ {n1(c.atribuido_estudo.valor)} bi
              </p>
              <h5 className="mt-3 text-sm font-medium text-carvao">{c.atribuido_estudo.rotulo}</h5>
              <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                {c.atribuido_estudo.derivacao}
              </p>
              <p className="rotulo mt-3 text-mineral">nível {c.atribuido_estudo.nivel} · estimativa</p>
              <p className="mt-1 text-xs text-carvao-muted">
                <a
                  href={c.atribuido_estudo.url}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="underline decoration-linha underline-offset-4 hover:text-bronze"
                >
                  estudo original — documento
                </a>
              </p>
            </div>
          </div>
          <p className="mt-8 max-w-prose2 border-l-2 border-bronze pl-5 text-sm leading-relaxed text-carvao">
            {c.leitura}
          </p>
        </>
      )}

      <p className="rotulo mt-10 text-mineral">
        {dados.revisao} ·{" "}
        <Link
          href="/observatorio/bets-financial-risk"
          className="underline decoration-linha underline-offset-4 hover:text-bronze"
        >
          série mensal completa no painel
        </Link>{" "}
        ·{" "}
        <a
          href="/obs/data/gold/epae.json"
          className="underline decoration-linha underline-offset-4 hover:text-bronze"
        >
          dados em JSON
        </a>
      </p>
    </figure>
  );
}
