/**
 * Painel completo "Conectividade" (com conta). Seções por pergunta, na ordem da procura: a cidade do leitor, onde a
 * fibra chegou, onde o 4G e o 5G alcançam os moradores, como a internet cresceu, os estados lado a lado, o que cada
 * medida conta (modelo didático) e o método recolhido no fim. Tudo desenhado no servidor a partir da gold; nenhum número
 * escrito à mão.
 */
import type { ReactNode } from "react";
import { BuscaConectividade } from "./BuscaConectividade";
import { ListadasLogo } from "@/components/energia/ListadasLogo";
import { anoDecimal, GraficoLinhas, marcasAnos, type Serie } from "./Graficos";
import { cobertos, faixaNaDistribuicao, linhaEstado, pontosAnuais, serieCobertura, ufsPor, type ConsultaMunicipio } from "@/lib/conectividade/dados";
import { logosConectividade, type LogoDaOperadora } from "@/lib/conectividade/logos";
import { dataBr, dataCaptura, frequenciaSerie, mesAcessos, mesCurto, mesExtenso, milhoes, num, pct, plural, posicao, SEM_DADO } from "@/lib/conectividade/formato";
import { DO_ESTADO, DOWNLOADS, hrefMunicipio, MEIOS, nomeGrupo, ROTA_CONECTIVIDADE, TECNOLOGIAS, VELOCIDADES } from "@/lib/conectividade/paginas";
import type { ArquivoUf, GoldConectividade, MunicipioGold, UfGold } from "@/lib/conectividade/tipos";

type Logos = Map<string, LogoDaOperadora>;

export function PainelConectividade({ g, consulta, ferramentas }: { g: GoldConectividade; consulta: ConsultaMunicipio; ferramentas?: ReactNode }) {
  // símbolos oficiais das operadoras (contrato de identidade da plataforma): manifesto em public/conectividade/logos
  const logos = logosConectividade();
  return (
    <>
      <Abertura g={g} />
      {ferramentas}
      <SecaoMunicipio g={g} c={consulta} logos={logos} />
      <SecaoFibra g={g} />
      <SecaoCobertura g={g} logos={logos} />
      <SecaoEvolucao g={g} />
      <SecaoEstados g={g} escolhida={consulta.estado === "ok" ? consulta.uf : null} />
      <Mecanismo />
      <Metodo g={g} logos={logos} />
    </>
  );
}

/* --------------------------------------------------------------------------------------------- abertura */

/**
 * A maior prestadora do lugar. "OUTROS" é a categoria em que a Anatel soma os provedores regionais e locais que não
 * nomeia (é o maior_grupo de 4.806 dos 5.571 municípios e do Brasil): não é uma empresa, e a frase diz isso em vez de
 * apresentar a soma como líder única.
 */
function fraseMaiorGrupo(grupo: string | null, parte: number | null): string {
  if (!grupo) return "Sem dado.";
  if (grupo === "OUTROS") return `Provedores regionais e locais, somados, têm ${pct(parte)} dos acessos; nenhum grande grupo lidera sozinho.`;
  return `A maior, ${nomeGrupo(grupo)}, tem ${pct(parte)} dos acessos.`;
}

function Abertura({ g }: { g: GoldConectividade }) {
  const f = g.brasil.fixa;
  const m = g.brasil.movel;
  const c = g.brasil.cobertura;
  const r = g.referencia;
  return (
    <>
      <p className="cn-achado">
        Em {mesExtenso(r.fixa)}, o Brasil tinha <strong>{milhoes(f.acessos)} de acessos de banda larga fixa</strong>, {num(f.densidade, 1)} para cada 100 habitantes, e{" "}
        <strong>{pct(f.fibra_pct)} deles por fibra óptica</strong>. Nas redes móveis{r.movel !== r.fixa ? `, em ${mesExtenso(r.movel)}` : ""}, {milhoes(m.linhas)} de linhas ativas, {pct(m.g5_pct)} já em 5G. Em {mesExtenso(r.cobertura)},{" "}
        <strong>{pct(c.tecnologias.g5?.[0])} dos moradores</strong> do país estavam dentro da cobertura 5G declarada pelas operadoras, e em {num(g.destaques.sem_5g)} dos{" "}
        {num(g.destaques.municipios_com_5g_publicado)} municípios com cobertura 5G publicada menos de 1% dos moradores estavam dentro de alguma cobertura 5G.
      </p>
      <dl className="cn-numeros" aria-label="O tema em quatro números">
        <div className="cn-lider">
          <dt>Acessos de banda larga fixa por 100 habitantes</dt>
          <dd className="cn-valor">{num(f.densidade, 1)}</dd>
          <dd className="cn-prova">{mesExtenso(r.fixa)} · {milhoes(f.acessos)} de acessos · Anatel, acessos de banda larga fixa</dd>
        </div>
        <div>
          <dt>Acessos fixos por fibra óptica</dt>
          <dd className="cn-valor">{pct(f.fibra_pct)}</dd>
          <dd className="cn-prova">{mesExtenso(r.fixa)} · meio de acesso declarado pela prestadora · Anatel</dd>
        </div>
        <div>
          <dt>Moradores dentro da cobertura 5G</dt>
          <dd className="cn-valor">{pct(c.tecnologias.g5?.[0])}</dd>
          <dd className="cn-prova">{mesExtenso(r.cobertura)} · qualquer operadora · Censo 2022 · Anatel, cobertura móvel</dd>
        </div>
        <div>
          <dt>Municípios ainda sem 5G</dt>
          <dd className="cn-valor">{num(g.destaques.sem_5g)}<span className="cn-unidade">de {num(g.destaques.municipios_com_5g_publicado)}</span></dd>
          <dd className="cn-prova">{mesExtenso(r.cobertura)} · menos de 1% dos moradores cobertos · municípios com cobertura 5G publicada · Anatel</dd>
        </div>
      </dl>
    </>
  );
}

/* -------------------------------------------------------------------------------------------- município */

function ComoLerMunicipio() {
  return (
    <div className="cn-ler" aria-label="Como ler os números por município">
      <p>
        <strong>Acesso contratado, não pessoa conectada.</strong> A Anatel conta os contratos de banda larga fixa e as linhas móveis ativas que as prestadoras declaram em cada
        município. Uma casa com um contrato e cinco moradores conta um acesso; uma empresa com cem linhas conta cem.
      </p>
      <p>
        <strong>Cobertura é a mancha declarada pela operadora, não a velocidade que chega.</strong> A parte dos moradores coberta sai do cruzamento entre os mapas de
        cobertura das operadoras e os setores do Censo 2022. Estar dentro da mancha não garante sinal dentro de casa nem velocidade.
      </p>
    </div>
  );
}

function SecaoMunicipio({ g, c, logos }: { g: GoldConectividade; c: ConsultaMunicipio; logos: Logos }) {
  return (
    <section className="cn-secao" id="municipio" aria-labelledby="municipio-titulo">
      <h2 id="municipio-titulo">Como é a internet na sua cidade?</h2>
      <p className="cn-intro">
        Para os {num(g.destaques.municipios)} municípios do país: os acessos de banda larga fixa e por qual meio chegam e quantas empresas atendem; as linhas móveis por geração e
        a parte dos moradores dentro da cobertura 4G e 5G nos municípios que a Anatel publica (nesta edição, {num(g.destaques.sem_dado.movel.length)} sem telefonia móvel e{" "}
        {num(g.destaques.sem_dado.cobertura.length)} sem cobertura); a posição no estado e no país em cada medida, entre os municípios com o valor publicado.
      </p>
      <div className="cn-busca">
        <BuscaConectividade rotulo={c.estado === "ok" ? "Escolher outro município" : "Escolha o município"} ancora="municipio" />
      </div>
      {c.estado === "invalida" && (
        <p role="status" className="cn-aviso">
          {c.codigo ? `Nenhum município da base da Anatel tem o código IBGE ${c.codigo}.` : "O endereço não traz um código IBGE de município, que tem sete dígitos."} Busque pelo nome.
        </p>
      )}
      {c.estado === "ok" ? <Municipio g={g} m={c.m} uf={c.uf} arquivo={c.arquivo} logos={logos} /> : <Distribuicao g={g} />}
    </section>
  );
}

function Distribuicao({ g }: { g: GoldConectividade }) {
  const d = g.distribuicao;
  const linhas: { rotulo: string; q: typeof d.fixa_densidade; casas: number; unidade: string }[] = [
    { rotulo: "Acessos fixos por 100 habitantes", q: d.fixa_densidade, casas: 1, unidade: "" },
    { rotulo: "Acessos fixos por fibra óptica", q: d.fixa_fibra_pct, casas: 1, unidade: "%" },
    { rotulo: "Acessos fixos com 100 Mbps ou mais", q: d.fixa_vel_100_mais_pct, casas: 1, unidade: "%" },
    { rotulo: "Linhas móveis em 5G", q: d.movel_g5_pct, casas: 1, unidade: "%" },
    { rotulo: "Moradores dentro da cobertura 4G", q: d.cobertura_g4_moradores, casas: 1, unidade: "%" },
    { rotulo: "Moradores dentro da cobertura 5G", q: d.cobertura_g5_moradores, casas: 1, unidade: "%" },
  ];
  return (
    <>
      <h3>Enquanto você não escolhe: como os municípios se distribuem</h3>
      <p className="cn-intro mt-2 max-w-[68ch] text-[15px] leading-relaxed">
        Em cada medida, o valor abaixo do qual ficam 10%, um quarto, a metade, três quartos e 90% dos municípios. A sua cidade entra nessa régua quando você a escolhe.
      </p>
      <div className="cn-tabela-rolagem" tabIndex={0}>
        <table className="cn-tabela">
          <caption>
            Distribuição por medida, cada uma no seu universo e mês: acessos fixos entre {num(d.fixa_densidade?.n)} municípios ({mesExtenso(g.referencia.fixa)}), linhas móveis entre{" "}
            {num(d.movel_g5_pct?.n)} ({mesExtenso(g.referencia.movel)}), cobertura entre {num(d.cobertura_g5_moradores?.n)} ({mesExtenso(g.referencia.cobertura)}). Cálculo da Scrutiniums
            sobre os dados da Anatel.
          </caption>
          <thead>
            <tr>
              <th scope="col">Medida</th>
              <th scope="col">10% abaixo de</th>
              <th scope="col">Um quarto abaixo de</th>
              <th scope="col">Metade abaixo de</th>
              <th scope="col">Três quartos abaixo de</th>
              <th scope="col">90% abaixo de</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.rotulo}>
                <th scope="row">{l.rotulo}</th>
                {(["p10", "p25", "p50", "p75", "p90"] as const).map((p) => (
                  <td key={p}>{l.q ? `${num(l.q[p], l.casas)}${l.unidade}` : SEM_DADO}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ComoLerMunicipio />
    </>
  );
}

function Regua({ m }: { m: MunicipioGold }) {
  const c = m.cobertura;
  if (!c) return null;
  return (
    <div className="cn-regua" role="list" aria-label="Parte dos moradores dentro da cobertura de cada geração">
      {TECNOLOGIAS.map((t) => {
        const v = c.tecnologias[t.id]?.[0] ?? null;
        return (
          <div key={t.id} className={`cn-regua-linha${t.id === "g4" || t.id === "g5" ? " cn-forte" : ""}`} role="listitem">
            <span>{t.rotulo}</span>
            <span className="cn-regua-trilho" aria-hidden="true">{v !== null && <i style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />}</span>
            <span>{pct(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Municipio({ g, m, uf, arquivo, logos }: { g: GoldConectividade; m: MunicipioGold; uf: string; arquivo: ArquivoUf; logos: Logos }) {
  const f = m.fixa;
  const mv = m.movel;
  const c = m.cobertura;
  const u = g.ufs.find((x) => x.uf === uf)!;
  const r = g.referencia;
  // denominador de cada posição: só os municípios ranqueados naquela medida (sem valor não entra no ranking)
  const nUf = u.ranqueados.fixa_densidade;
  const nBr = g.destaques.ranqueados.fixa_densidade;
  const tri = arquivo.trimestres_cobertura;
  // da operadora que mais alcança à que não tem rede na cidade (0%)
  const ops = arquivo.operadoras.filter((o) => c?.operadoras[o]).sort((a, b) => (c!.operadoras[b].g4g5_moradores ?? 0) - (c!.operadoras[a].g4g5_moradores ?? 0));
  const serie4: Serie = { nome: "4G", classe: "cn-linha-suave", pontos: tri.map((t, i) => ({ x: i, y: c?.serie_g4_moradores[i] ?? null })) };
  const serie5: Serie = { nome: "5G", classe: "cn-linha", pontos: tri.map((t, i) => ({ x: i, y: c?.serie_g5_moradores[i] ?? null })) };
  const marcas = tri.map((t, i) => ({ x: i, rotulo: mesCurto(t) })).filter((_x, i) => i === 0 || i === tri.length - 1 || i % 4 === 0);
  return (
    <>
      <section className="cn-retrato" aria-labelledby="retrato-titulo" data-resultado-municipio="">
        <header>
          <h3 id="retrato-titulo">
            {m.nome} <span className="cn-unidade">{arquivo.nome_uf} ({uf})</span>
          </h3>
          <span className="cn-competencia">código IBGE {m.id} · {mesAcessos(r)} · cobertura de {mesExtenso(r.cobertura)}</span>
        </header>
        <dl>
          <div>
            <dt>Acessos de banda larga fixa por 100 habitantes</dt>
            <dd className="cn-valor cn-valor-acento">{f ? num(f.densidade, 1) : SEM_DADO}</dd>
            <dd className="cn-detalhe">
              {f ? `${num(f.acessos)} acessos · ${posicao(m.posicao.fixa_densidade.uf, nUf)} no estado, ${posicao(m.posicao.fixa_densidade.brasil, nBr)} no país` : "A Anatel não registra acessos fixos neste município."}
            </dd>
          </div>
          <div>
            <dt>Acessos fixos por fibra óptica</dt>
            <dd className="cn-valor">{f ? pct(f.fibra_pct) : SEM_DADO}</dd>
            <dd className="cn-detalhe">{f ? `${faixaNaDistribuicao(f.fibra_pct, g.distribuicao.fixa_fibra_pct) ?? SEM_DADO} · ${pct(f.vel_100_mais_pct)} com 100 Mbps ou mais contratados` : "Sem dado."}</dd>
          </div>
          <div>
            <dt>Empresas que vendem banda larga fixa</dt>
            <dd className="cn-valor">{f ? num(f.prestadoras) : SEM_DADO}</dd>
            <dd className="cn-detalhe">{f ? fraseMaiorGrupo(f.maior_grupo, f.maior_grupo_pct) : "Sem dado."}</dd>
          </div>
          <div>
            <dt>Moradores dentro da cobertura 4G</dt>
            <dd className="cn-valor">{pct(cobertos(m, "g4"))}</dd>
            <dd className="cn-detalhe">{c ? `${posicao(m.posicao.cobertura_g4_moradores.uf, u.ranqueados.cobertura_g4_moradores)} no estado · ${pct(c.tecnologias.todas?.[0])} com qualquer geração` : "A Anatel não publica a cobertura deste município nesta edição; o motivo não vem na fonte."}</dd>
          </div>
          <div>
            <dt>Moradores dentro da cobertura 5G</dt>
            <dd className="cn-valor cn-valor-acento">{pct(cobertos(m, "g5"))}</dd>
            <dd className="cn-detalhe">{c ? `${faixaNaDistribuicao(cobertos(m, "g5"), g.distribuicao.cobertura_g5_moradores) ?? SEM_DADO} · ${pct(c.tecnologias.g5?.[2])} da área do município` : "Sem dado."}</dd>
          </div>
          <div>
            <dt>Acessos móveis por 100 habitantes</dt>
            <dd className="cn-valor">{mv ? num(mv.densidade, 1) : SEM_DADO}</dd>
            <dd className="cn-detalhe">{mv ? `${num(mv.acessos)} acessos, sem máquinas e pontos de serviço · das ${num(mv.linhas)} linhas ativas, ${pct(mv.g5_pct)} em 5G e ${pct(mv.pre_pct)} pré-pagas` : "A Anatel não registra linhas móveis neste município."}</dd>
          </div>
        </dl>
        {c && (
          <>
            <h3 className="cn-subtitulo">Quem a cobertura alcança, geração a geração</h3>
            <Regua m={m} />
            <p className="cn-regua-nota -mt-1">Cada barra é a parte dos {num(c.moradores)} moradores (Censo 2022) dentro da mancha de cobertura de qualquer operadora em {mesExtenso(r.cobertura)}.{" "}
              {g.brasil.cobertura.g5_acima_do_4g.trimestre_atual === 0
                ? "Neste trimestre, em nenhum município a Anatel publica o 5G acima do 4G."
                : `Neste trimestre, a Anatel publica o 5G acima do 4G em ${num(g.brasil.cobertura.g5_acima_do_4g.trimestre_atual)} municípios; os valores ficam como publicados.`}
            </p>
            {ops.length > 0 && (
              <div className="cn-tabela-rolagem" tabIndex={0}>
                <table className="cn-tabela">
                  <caption>Moradores de {m.nome} dentro da cobertura de cada operadora, em {mesExtenso(r.cobertura)}. Operadora sem rede na cidade aparece com 0%.</caption>
                  <thead>
                    <tr>
                      <th scope="col">Operadora</th>
                      <th scope="col">4G ou 5G</th>
                      <th scope="col">Qualquer geração</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ops.map((o) => (
                      <tr key={o}>
                        <th scope="row"><span className="cn-operadora"><ListadasLogo logo={logos.get(o)} nome={nomeGrupo(o)} tamanho="sm" decorativo />{nomeGrupo(o)}</span></th>
                        <td>{pct(c.operadoras[o].g4g5_moradores)}</td>
                        <td>{pct(c.operadoras[o].todas_moradores)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <figure className="cn-figura">
              <GraficoLinhas
                series={[serie4, serie5]}
                marcasX={marcas}
                unidade="% dos moradores"
                maximo={100}
                altura={220}
                descricao={`Parte dos moradores de ${m.nome} dentro da cobertura 4G e 5G por trimestre, de ${mesCurto(tri[0])} a ${mesCurto(tri[tri.length - 1])}: 4G de ${pct(c.serie_g4_moradores.find((v) => v !== null))} a ${pct(cobertos(m, "g4"))}; 5G de ${pct(c.serie_g5_moradores.find((v) => v !== null))} a ${pct(cobertos(m, "g5"))}.`}
              />
              <figcaption>
                Cobertura 4G e 5G de {m.nome} trimestre a trimestre, em % dos moradores. Até 2024 a Anatel usava os setores do Censo 2010; a partir de 2025, os do Censo 2022, o que pode
                mover a linha sem que a rede tenha mudado. Trimestre sem publicação fica em branco.
                {c.trimestres_5g_acima_do_4g.length > 0 &&
                  ` Em ${c.trimestres_5g_acima_do_4g.map(mesCurto).join(", ")} a Anatel publicou o 5G acima do 4G neste município; o gráfico mostra os valores como publicados.`}
              </figcaption>
            </figure>
          </>
        )}
        <ComoLerMunicipio />
        <p className="cn-fonte">
          Fontes: Anatel, acessos de banda larga fixa ({mesExtenso(r.fixa)}), telefonia móvel ({mesExtenso(r.movel)}) e cobertura das redes móveis ({mesExtenso(r.cobertura)}), dados capturados em{" "}
          {dataCaptura(g.fontes, ["fixa", "movel", "cobertura"])}. Densidades como a Anatel publica (acessos por 100 habitantes). Partes em %, posições e faixas: cálculo da Scrutiniums.
        </p>
      </section>
      <MaioresDaUf arquivo={arquivo} uf={uf} escolhido={m.id} />
    </>
  );
}

function MaioresDaUf({ arquivo, uf, escolhido }: { arquivo: ArquivoUf; uf: string; escolhido: string }) {
  const lista = [...arquivo.municipios].filter((x) => x.fixa?.densidade != null).sort((a, b) => b.fixa!.densidade! - a.fixa!.densidade!).slice(0, 10);
  if (!lista.length) return null;
  const max = lista[0].fixa!.densidade!;
  return (
    <>
      <h3>Os dez municípios {DO_ESTADO[uf]} com mais acessos fixos por 100 habitantes</h3>
      <div className="cn-barras" role="list">
        {lista.map((x) => (
          <div key={x.id} className={`cn-barra${x.id === escolhido ? " cn-escolhido" : ""}`} role="listitem">
            <span>
              <a href={`${hrefMunicipio(x.id)}#municipio`} className="cn-toque cn-link">{x.nome}</a>
            </span>
            <span className="cn-barra-trilho" aria-hidden="true"><i style={{ width: `${(100 * x.fixa!.densidade!) / max}%` }} /></span>
            <span>{num(x.fixa!.densidade, 1)}</span>
          </div>
        ))}
      </div>
      <p className="cn-fonte">Acessos por 100 habitantes. Cidades pequenas com contratos de empresas ou de veranistas passam de 100: o número conta contratos, não moradores conectados.</p>
    </>
  );
}

/* ------------------------------------------------------------------------------------------------ fibra */

function Barras({ itens, max, unidade = "%", casas = 1, referencia }: { itens: { rotulo: string; v: number | null; forte?: boolean; href?: string; logo?: LogoDaOperadora }[]; max: number; unidade?: string; casas?: number; referencia?: number | null }) {
  return (
    <div className="cn-barras" role="list">
      {itens.map((it) => (
        <div key={it.rotulo} className={`cn-barra${it.forte ? " cn-escolhido" : ""}`} role="listitem">
          <span className={it.logo !== undefined ? "cn-operadora" : undefined}>
            {it.logo !== undefined && <ListadasLogo logo={it.logo} nome={it.rotulo} tamanho="sm" decorativo />}
            {it.href ? <a href={it.href} className="cn-toque cn-link">{it.rotulo}</a> : it.rotulo}
          </span>
          <span className="cn-barra-trilho" aria-hidden="true">
            {it.v !== null && <i style={{ width: `${Math.max(0, Math.min(100, (100 * it.v) / max))}%` }} />}
            {referencia != null && <b style={{ left: `${Math.max(0, Math.min(100, (100 * referencia) / max))}%` }} />}
          </span>
          <span>{it.v === null ? SEM_DADO : `${num(it.v, casas)}${unidade}`}</span>
        </div>
      ))}
    </div>
  );
}

function SecaoFibra({ g }: { g: GoldConectividade }) {
  const f = g.brasil.fixa;
  const ufs = ufsPor(g, (u) => u.fixa?.fibra_pct ?? null);
  const semFibra = g.ufs.filter((u) => u.sem_fibra > 0).sort((a, b) => b.sem_fibra - a.sem_fibra);
  return (
    <section className="cn-secao" id="fibra" aria-labelledby="fibra-titulo">
      <h2 id="fibra-titulo">A fibra chegou a todo lugar?</h2>
      <p className="cn-intro">
        Por onde a banda larga fixa chega a cada casa e a cada empresa, e com que velocidade contratada. A fibra é o meio que entrega mais velocidade; rádio e satélite atendem onde
        o cabo não chega.
      </p>
      <div className="cn-graficos-dois">
        <div>
          <h3>Meio de acesso no Brasil, {mesExtenso(g.referencia.fixa)}</h3>
          <Barras itens={MEIOS.map((m) => ({ rotulo: m.rotulo, v: f[m.id], forte: m.id === "fibra_pct" }))} max={100} />
        </div>
        <div>
          <h3>Velocidade contratada no Brasil, {mesExtenso(g.referencia.fixa)}</h3>
          <Barras itens={VELOCIDADES.map((v) => ({ rotulo: v.rotulo, v: f[v.id], forte: v.id === "vel_100_mais_pct" }))} max={100} />
        </div>
      </div>
      <p className="cn-fonte">
        Parte dos {milhoes(f.acessos)} de acessos de banda larga fixa, pelo meio de acesso e pela velocidade que cada prestadora declara à Anatel. {pct(f.pessoa_fisica_pct)} dos
        acessos são de pessoas físicas; {num(f.prestadoras)} prestadoras atendem o país. {fraseMaiorGrupo(f.maior_grupo, f.maior_grupo_pct)}
      </p>
      <h3>Acessos por fibra em cada estado</h3>
      <Barras itens={ufs.map((x) => ({ rotulo: x.u.nome, v: x.v }))} max={100} referencia={f.fibra_pct} />
      <div className="cn-legenda" aria-hidden="true">
        <span><i className="cn-bloco" style={{ background: "var(--cn-acento)" }} />parte dos acessos do estado por fibra</span>
        <span><i style={{ background: "#182B36", height: 12, width: 2 }} />Brasil, {pct(f.fibra_pct)}</span>
      </div>
      <p className="cn-fonte">
        Em {mesExtenso(g.referencia.fixa)}, {g.destaques.sem_fibra ? `${plural(g.destaques.sem_fibra, "município não tinha", "municípios não tinham")} nenhum acesso por fibra` : "todos os municípios tinham algum acesso por fibra"}
        {semFibra.length > 0 ? ` (${semFibra.map((u) => `${u.sem_fibra} ${DO_ESTADO[u.uf].replace(/^d[aeo]s? /, "em ")}`).join(", ")})` : ""}, e{" "}
        {g.destaques.uma_prestadora ? plural(g.destaques.uma_prestadora, "município era atendido", "municípios eram atendidos") : "nenhum município era atendido"} por uma única prestadora.
      </p>
    </section>
  );
}

/* --------------------------------------------------------------------------------------------- cobertura */

function SecaoCobertura({ g, logos }: { g: GoldConectividade; logos: Logos }) {
  const c = g.brasil.cobertura;
  const tri = c.trimestres;
  const ufs5 = ufsPor(g, (u) => u.cobertura.g5_moradores);
  const series: Serie[] = (["todas", "g4", "g5"] as const).map((tec) => ({
    nome: tec === "todas" ? "Qualquer geração" : tec === "g4" ? "4G" : "5G",
    classe: tec === "g5" ? "cn-linha" : tec === "g4" ? "cn-linha-suave" : "cn-linha-ref",
    pontos: serieCobertura(g, tec).map((p, i) => ({ x: i, y: p.v })),
  }));
  const marcas = tri.map((t, i) => ({ x: i, rotulo: mesCurto(t) })).filter((_x, i) => i === 0 || i === tri.length - 1 || i % 4 === 0);
  const ops = Object.entries(c.operadoras).sort((a, b) => (b[1].g4g5_moradores ?? 0) - (a[1].g4g5_moradores ?? 0));
  return (
    <section className="cn-secao" id="cobertura" aria-labelledby="cobertura-titulo">
      <h2 id="cobertura-titulo">Onde o 4G e o 5G alcançam os moradores?</h2>
      <p className="cn-intro">
        A parte da população que vive dentro da mancha de cobertura declarada pelas operadoras, por geração da rede, por operadora e por estado, e como ela avançou trimestre a
        trimestre.
      </p>
      <div className="cn-graficos-dois">
        <div>
          <h3>Brasil, {mesExtenso(g.referencia.cobertura)}: moradores dentro da cobertura</h3>
          <Barras itens={TECNOLOGIAS.map((t) => ({ rotulo: t.rotulo, v: c.tecnologias[t.id]?.[0] ?? null, forte: t.id === "g4" || t.id === "g5" }))} max={100} />
          <p className="cn-fonte">
            De {num(c.populacao?.moradores)} moradores (Censo {c.populacao?.censo}). Pela área do país, a cobertura 4G alcança {pct(c.tecnologias.g4?.[2])} e a 5G, {pct(c.tecnologias.g5?.[2])}:
            as redes concentram-se onde as pessoas moram.
          </p>
        </div>
        <div>
          <h3>Por operadora, 4G ou 5G</h3>
          <Barras itens={ops.map(([o, v]) => ({ rotulo: nomeGrupo(o), logo: logos.get(o), v: v.g4g5_moradores }))} max={100} />
          <p className="cn-fonte">Parte dos moradores do país dentro da cobertura 4G ou 5G de cada operadora. As regionais cobrem partes de poucos estados.</p>
        </div>
      </div>
      <figure className="cn-figura">
        <GraficoLinhas
          series={series}
          marcasX={marcas}
          unidade="% dos moradores"
          maximo={100}
          descricao={`Parte dos moradores do Brasil dentro da cobertura móvel por trimestre, de ${mesCurto(tri[0])} a ${mesCurto(tri[tri.length - 1])}: 5G de ${pct(c.serie.g5.find((v) => v !== null))} a ${pct(c.tecnologias.g5?.[0])}; 4G de ${pct(c.serie.g4[0])} a ${pct(c.tecnologias.g4?.[0])}.`}
        />
        <figcaption>
          Cobertura no Brasil trimestre a trimestre, em % dos moradores, por qualquer operadora. Até 2024 a Anatel cruzava as manchas com os setores do Censo 2010; desde 2025, com
          os do Censo 2022. Trimestre que a Anatel não publicou fica em branco.
        </figcaption>
      </figure>
      <h3>Moradores dentro da cobertura 5G em cada estado</h3>
      <Barras itens={ufs5.map((x) => ({ rotulo: x.u.nome, v: x.v }))} max={100} referencia={c.tecnologias.g5?.[0] ?? null} />
      <div className="cn-legenda" aria-hidden="true">
        <span><i className="cn-bloco" style={{ background: "var(--cn-acento)" }} />moradores do estado dentro da cobertura 5G</span>
        <span><i style={{ background: "#182B36", height: 12, width: 2 }} />Brasil, {pct(c.tecnologias.g5?.[0])}</span>
      </div>
      <p className="cn-fonte">
        Média dos municípios de cada estado ponderada pelos moradores (cálculo da Scrutiniums). Em {mesExtenso(g.referencia.cobertura)}, dos {num(g.destaques.municipios_com_5g_publicado)} municípios com cobertura 5G publicada, {num(g.destaques.sem_5g)} tinham
        menos de 1% dos moradores dentro de alguma cobertura 5G, e em {num(g.destaques.g4_abaixo_50)} dos {num(g.destaques.municipios_com_4g_publicado)} com cobertura 4G publicada a
        cobertura 4G alcançava menos da metade dos moradores.
      </p>
    </section>
  );
}

/* ---------------------------------------------------------------------------------------------- evolução */

function SecaoEvolucao({ g }: { g: GoldConectividade }) {
  const f = pontosAnuais(g.brasil.fixa.acessos_mensal);
  const m = pontosAnuais(g.brasil.movel.acessos_mensal);
  const anosF = f.map((p) => Number(p.mes.slice(0, 4)));
  const anosM = m.map((p) => Number(p.mes.slice(0, 4)));
  // mês que a Anatel entregou vazio parte a linha (ausência nunca vira zero)
  const mi = (v: number | null) => (v === null ? null : v / 1e6);
  const serieF: Serie = { nome: "Banda larga fixa", classe: "cn-linha", pontos: f.map((p) => ({ x: anoDecimal(p.mes), y: mi(p.acessos) })), rotuloFim: `${num(mi(f[f.length - 1].acessos), 1)} mi` };
  const serieM: Serie = { nome: "Acessos móveis", classe: "cn-linha", pontos: m.map((p) => ({ x: anoDecimal(p.mes), y: mi(p.acessos) })), rotuloFim: `${num(mi(m[m.length - 1].acessos), 1)} mi` };
  return (
    <section className="cn-secao" id="evolucao" aria-labelledby="evolucao-titulo">
      <h2 id="evolucao-titulo">Como a internet cresceu no Brasil?</h2>
      <p className="cn-intro">
        Os acessos de banda larga fixa ({frequenciaSerie(g.brasil.fixa.acessos_mensal.meses)}) e os acessos de telefonia móvel, sem máquinas e pontos de serviço (
        {frequenciaSerie(g.brasil.movel.acessos_mensal.meses)}), pela série de totais da Anatel: o gráfico mostra dezembro de cada ano e o mês mais recente.
      </p>
      <div className="cn-graficos-dois">
        <figure className="cn-figura">
          <GraficoLinhas
            series={[serieF]}
            marcasX={marcasAnos([...new Set(anosF)])}
            unidade="milhões de acessos"
            altura={220}
            descricao={`Acessos de banda larga fixa no Brasil, de ${num(mi(f[0].acessos), 1)} milhões em ${mesExtenso(f[0].mes)} a ${num(mi(f[f.length - 1].acessos), 1)} milhões em ${mesExtenso(f[f.length - 1].mes)}.`}
          />
          <figcaption>Banda larga fixa: acessos em serviço, dezembro de cada ano e {mesExtenso(f[f.length - 1].mes)}. Anatel, série de totais.</figcaption>
        </figure>
        <figure className="cn-figura">
          <GraficoLinhas
            series={[serieM]}
            marcasX={marcasAnos([...new Set(anosM)])}
            unidade="milhões de acessos"
            altura={220}
            descricao={`Acessos de telefonia móvel no Brasil (sem máquinas e pontos de serviço), de ${num(mi(m[0].acessos), 1)} milhões em ${mesExtenso(m[0].mes)} a ${num(mi(m[m.length - 1].acessos), 1)} milhões em ${mesExtenso(m[m.length - 1].mes)}.`}
          />
          <figcaption>Telefonia móvel: acessos em operação, sem M2M e pontos de serviço (o total que a Anatel usa na densidade), dezembro de cada ano e {mesExtenso(m[m.length - 1].mes)}. Anatel, série de totais.</figcaption>
        </figure>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ estados */

function SecaoEstados({ g, escolhida }: { g: GoldConectividade; escolhida: string | null }) {
  const r = g.referencia;
  const linha = (u: UfGold | null, nome: string, uf: string, forte = false) => {
    // fonte ausente num estado fica "Sem dado" (o Brasil só entra na própria linha); a contagem de 5G sai ao lado do seu universo
    const { fixa: f, movel: m, cobertura: cob, universo } = linhaEstado(g, u);
    return (
      <tr key={uf} className={`${forte ? "cn-forte" : ""}${escolhida === uf ? " cn-escolhido" : ""}`}>
        <th scope="row">{nome}</th>
        <td>{universo}</td>
        <td>{f ? num(f.densidade, 1) : SEM_DADO}</td>
        <td>{f ? pct(f.fibra_pct) : SEM_DADO}</td>
        <td>{f ? pct(f.vel_100_mais_pct) : SEM_DADO}</td>
        <td>{f ? num(f.prestadoras) : SEM_DADO}</td>
        <td>{m ? num(m.densidade, 1) : SEM_DADO}</td>
        <td>{m ? pct(m.g5_pct) : SEM_DADO}</td>
        <td>{pct(cob.g4)}</td>
        <td>{pct(cob.g5)}</td>
        <td>{num(cob.sem5)} de {num(cob.com5)}</td>
      </tr>
    );
  };
  return (
    <section className="cn-secao" id="estados" aria-labelledby="estados-titulo">
      <h2 id="estados-titulo">Os estados lado a lado</h2>
      <p className="cn-intro">As mesmas medidas da sua cidade para cada estado e para o Brasil. A cobertura por estado é a média dos municípios ponderada pelos moradores.</p>
      <p className="cn-legenda-tabela">
        {mesAcessos(r, true)}; cobertura de {mesExtenso(r.cobertura)}. Acessos móveis por 100 habitantes: o total da Anatel sem máquinas e pontos de serviço; linhas em 5G como parte de todas as linhas ativas. Prestadoras: empresas com ao menos um acesso fixo no estado. Municípios na base: cada coluna agrega só os municípios que a sua fonte traz no estado (a cobertura 4G e a 5G, cada uma só os municípios com o valor daquela geração publicado), e a célula diz a contagem de cada uma quando alguma fica abaixo do total. Municípios sem 5G: menos de 1% dos moradores cobertos, entre os municípios com cobertura 5G publicada.
      </p>
      <div className="cn-tabela-rolagem" tabIndex={0}>
        <table className="cn-tabela cn-tabela-larga">
          <caption>Conectividade por estado e no Brasil. Anatel; partes em % e médias por estado calculadas pela Scrutiniums.</caption>
          <thead>
            <tr>
              <th scope="col">Estado</th>
              <th scope="col">Municípios na base</th>
              <th scope="col">Acessos fixos por 100 hab.</th>
              <th scope="col">Por fibra</th>
              <th scope="col">100 Mbps ou mais</th>
              <th scope="col">Prestadoras</th>
              <th scope="col">Acessos móveis por 100 hab.</th>
              <th scope="col">Linhas em 5G</th>
              <th scope="col">Moradores com 4G</th>
              <th scope="col">Moradores com 5G</th>
              <th scope="col">Municípios sem 5G, de quantos com 5G publicado</th>
            </tr>
          </thead>
          <tbody>
            {g.ufs.map((u) => linha(u, u.nome, u.uf))}
            {linha(null, "Brasil", "BR", true)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------------------------- mecanismo */

function Mecanismo() {
  return (
    <section className="cn-secao" id="mecanismo" aria-labelledby="mecanismo-titulo">
      <h2 id="mecanismo-titulo">O que cada medida conta</h2>
      <p className="cn-intro">Três contagens diferentes que costumam ser lidas como se fossem uma. Modelo didático: descreve o que a Anatel mede, não avalia qualidade nem preço.</p>
      <div className="cn-mecanismo">
        <div>
          <h3>Acesso de banda larga fixa</h3>
          <p>Um contrato de internet por cabo, fibra, rádio ou satélite num endereço. A prestadora declara à Anatel, todo mês, quantos contratos tem em cada município, por meio e velocidade.</p>
          <p className="cn-mede">Mede a demanda atendida com fio. Não diz quantas pessoas usam o contrato nem a velocidade entregue.</p>
        </div>
        <div>
          <h3>Linha móvel</h3>
          <p>
            Um chip ativo, pré ou pós-pago. A Anatel publica dois totais: as linhas ativas, que somam tudo o que está registrado no município, inclusive as de máquinas (M2M,
            como medidores e rastreadores) e os pontos de serviço; e os acessos, que deixam essas duas categorias de fora e são a base da densidade por 100 habitantes. As
            partes por geração e por modalidade são calculadas sobre todas as linhas ativas.
          </p>
          <p className="cn-mede">Mede chips, não pessoas: uma pessoa pode ter dois, e a linha é contada no município do cadastro.</p>
        </div>
        <div>
          <h3>Cobertura</h3>
          <p>A mancha no mapa onde cada operadora declara ter sinal, por geração. A Anatel cruza a mancha com os setores do Censo e calcula a parte dos moradores, dos domicílios e da área dentro dela.</p>
          <p className="cn-mede">Mede alcance declarado, não sinal dentro de casa, nem velocidade, nem preço.</p>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------------------------------- método */

/** Operadoras sem símbolo oficial obtido, com o motivo do manifesto: a ausência fica dita na página, nunca escondida. */
function semSimbolo(g: GoldConectividade, logos: Logos): string {
  const sem = g.operadoras.filter((o) => !logos.get(o)?.arquivo);
  if (!sem.length) return " Todas as operadoras da cobertura têm o símbolo oficial.";
  return ` Sem símbolo oficial, só o nome: ${sem.map((o) => `${nomeGrupo(o)} (${logos.get(o)?.motivo ?? "fora do manifesto"})`).join("; ")}.`;
}

function Metodo({ g, logos }: { g: GoldConectividade; logos: Logos }) {
  const f = g.fontes;
  return (
    <details className="cn-metodo" id="metodo">
      <summary>Método, fontes e arquivos para baixar</summary>
      <div className="cn-metodo-corpo">
        <div>
          <h3>Fontes</h3>
          <ul>
            {(["fixa", "movel", "cobertura"] as const).map((k) => (
              <li key={k}>
                <a href={f[k].pagina}>{f[k].orgao}, {f[k].nome.toLowerCase()}</a>: referência {mesExtenso(f[k].referencia)}, arquivo publicado pela Anatel em{" "}
                {dataBr(f[k].zip_modificado_em)}, capturado em {dataBr(f[k].capturado_em)}. Membros lidos do zip:{" "}
                {f[k].membros.map((m) => (
                  <span key={m.membro}>
                    <code>{m.membro}</code> ({num(m.bytes / 1e6, 1)} MB, sha256 <code>{m.sha256.slice(0, 12)}…</code>);{" "}
                  </span>
                ))}
                {f[k].licenca}.
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>O que é da Anatel e o que é cálculo da Scrutiniums</h3>
          <ul>
            <li>{g.notas.densidade}</li>
            <li>{g.notas.movel_acessos}</li>
            <li>{g.notas.cobertura}</li>
            <li>{g.notas.ausencia} Municípios sem dado nesta publicação: banda larga fixa {num(g.destaques.sem_dado.fixa.length)}, telefonia móvel {num(g.destaques.sem_dado.movel.length)}, cobertura {num(g.destaques.sem_dado.cobertura.length)}.</li>
            <li>
              Símbolos das operadoras: arquivo oficial do site de cada companhia, ligado ao nome da cobertura da Anatel pelo CNPJ do cadastro da Anatel (manifesto em{" "}
              <code>/conectividade/logos/manifesto.json</code>).
              {semSimbolo(g, logos)}
            </li>
            <li>
              Partes em % (fibra, velocidade, geração, pré-pago), posições no estado e no país e faixas da distribuição (quantis) são cálculos da Scrutiniums sobre os números
              publicados. Nada é estimado nem interpolado; trimestre ou mês sem publicação fica em branco.
            </li>
            <li>
              A publicação é retida se alguma fonte vier com estrutura diferente, se a contagem de municípios sair de 5.565 a 5.575, se duas das bases diferirem entre si em mais de
              três municípios (fixa e móvel, fixa e cobertura, móvel e cobertura; a diferença tolerada fica declarada acima, em municípios sem dado), se as partes de um município não somarem o total, se o Brasil do mês não for
              o do arquivo de totais da Anatel, se a cobertura passar de 100% ou se uma geração passar da união que a contém (4G e 5G nunca acima de &quot;todas&quot;, 5G nunca acima de &quot;4G ou 5G&quot;), no município, na série histórica
              ou na série nacional (pipeline/conectividade/validacoes.py). O 5G acima do 4G não retém: é contado e declarado (item acima).
              Hash dos dados: <code>{g.hash_dados.slice(0, 16)}</code>.
            </li>
          </ul>
        </div>
        <div>
          <h3>Arquivos para baixar</h3>
          <div className="cn-arquivos">
            {DOWNLOADS.map((d) => (
              <a key={d.arquivo} href={`${ROTA_CONECTIVIDADE}/${d.arquivo}`} className="cn-toque">
                {d.rotulo} (CSV): {d.descricao}
              </a>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}
