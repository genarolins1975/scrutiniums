"use client";

import Link from "next/link";
import { TabelaDados } from "@/components/painel/TabelaDados";
import { useEffect, useMemo, useState } from "react";
import { MapaCoropletico } from "@/components/energia/MapaCoropletico";
import { URL_GEO, caixaDeFeatures, comFolga, textoViewBox, validaCamada, type CamadaGeo } from "@/lib/energia/geo";
import { quebrasFixas, quebrasQuantis } from "@/lib/energia/escalas";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { ETAPAS, MOTIVOS, type MapaEducacaoGold } from "@/lib/educacao/tipos";
import { NOME_ETAPA, ROTULO_MOTIVO, TEXTO_MOTIVO, hrefFichaMunicipio } from "@/lib/educacao/paginas";
import { DO_ESTADO } from "@/lib/previdencia/paginas";
import { num, ideb } from "@/lib/educacao/formato";

/**
 * Cinco classes na rampa sequencial comum dos mapas (a do Saneamento e do Gás), por quintis nacionais da etapa. Eram vinte faixas de
 * meio ponto em vinte cinzas: quase todos os municípios caíam em seis faixas vizinhas e o mapa se lia como uma mancha (auditoria de
 * layout de 10/11/2026, reprovação R3). As faixas são calculadas com o país inteiro e não mudam ao escolher um estado, para que a
 * mesma cor diga o mesmo em qualquer recorte; o valor exato de cada cidade continua na tabela e no clique.
 */
const RAMPA = [1,2,3,4,5].map(i => `var(--escala-seq-${i})`);
/** Com empates o país pode render menos de cinco classes: as cores continuam indo do tom mais claro ao mais escuro. */
const coresPara = (n: number) => n >= RAMPA.length ? RAMPA : n <= 1 ? [RAMPA[2]] : Array.from({length:n}, (_,i) => RAMPA[Math.round(i*(RAMPA.length-1)/(n-1))]);
const controle = "min-h-[44px] border border-mineral bg-superficie px-3 text-carvao";
const nomeUf = (u: string) => (DO_ESTADO[u] ?? u).replace(/^(do|da|de|dos|das) /, "");

export function MapaEducacao({ dados }: { dados: MapaEducacaoGold }) {
  const ufs = useMemo(() => Object.keys(dados.cobertura).filter(u=>u!=="BR").sort((a,b)=>nomeUf(a).localeCompare(nomeUf(b),"pt-BR")), [dados]);
  const esquema = useMemo(() => ({ etapa: campo(tiposUrl.opcao(ETAPAS), "ai"), uf: campo(tiposUrl.opcao(["BR",...ufs]), "BR"), m: campo(tiposUrl.texto({max:7}), "") }), [ufs]);
  const [s,set] = useEstadoUrl(esquema);
  const [geo,setGeo] = useState<CamadaGeo|null>(null);
  const [erro,setErro] = useState(false);
  useEffect(() => {
    const abortar = new AbortController();
    fetch(URL_GEO.municipios, {signal:abortar.signal}).then(async r => {
      if(!r.ok) throw new Error("Malha indisponível");
      const j: unknown = await r.json();
      if(validaCamada(j).length) throw new Error("Malha inválida");
      setGeo(j as CamadaGeo);
    }).catch(()=> { if(!abortar.signal.aborted) setErro(true); });
    return ()=>abortar.abort();
  },[]);
  const lista = useMemo(() => dados.municipios.filter(m=>s.uf==="BR" || m.uf===s.uf).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR") || a.id.localeCompare(b.id)), [dados,s.uf]);
  const porId = useMemo(()=>new Map(lista.map(m=>[m.id,m])),[lista]);
  const valores = useMemo(()=> Object.fromEntries(lista.map(m=>[m.id,m[s.etapa]])),[lista,s.etapa]);
  const nacional = useMemo(()=>quebrasQuantis(dados.municipios.map(m=>m[s.etapa]),5,{casas:1}),[dados,s.etapa]);
  // os cortes são os do país; a contagem de cada classe é a do recorte na tela
  const classificacao = useMemo(()=>nacional.cortes.length ? {...quebrasFixas(nacional.cortes,Object.values(valores),{casas:1}), metodo:"quantis" as const} : nacional,[nacional,valores]);
  const cores = useMemo(()=>coresPara(classificacao.classes.length),[classificacao]);
  const geometria = useMemo(()=> {
    if(!geo || s.uf==="BR") return geo;
    const features=geo.features.filter(f=>f.uf===s.uf);
    const caixa=caixaDeFeatures(features);
    return caixa ? {...geo, features, viewBox:textoViewBox(comFolga(caixa)), contornos:{uf:geo.contornos?.uf.filter(c=>c.uf===s.uf) ?? []}, contagem:{...geo.contagem,features:features.length}} : geo;
  },[geo,s.uf]);
  const selecionado=lista.find(m=>m.id===s.m);
  const cobertura=dados.cobertura[s.uf];
  const motivo=(id:string)=> { const m=porId.get(id); const mot=m?.[s.etapa==="ai" ? "motivo_ai" : "motivo_af"]; return mot ? TEXTO_MOTIVO[mot] : null; };
  return <div data-mapa-educacao="" data-grafico="mapa-educacao">
    <div className="mt-6 flex flex-wrap gap-6">
      <div className="grid gap-2"><label htmlFor="mapa-educacao-etapa">Etapa</label><select id="mapa-educacao-etapa" className={controle} value={s.etapa} onChange={e=>set({etapa:e.target.value as typeof s.etapa})}>{ETAPAS.map(e=><option key={e} value={e}>{NOME_ETAPA[e]}</option>)}</select></div>
      <div className="grid gap-2"><label htmlFor="mapa-educacao-territorio">Território</label><select id="mapa-educacao-territorio" className={controle} value={s.uf} onChange={e=>set({uf:e.target.value,m:""})}><option value="BR">Brasil</option>{ufs.map(u=><option key={u} value={u}>{nomeUf(u)}</option>)}</select></div>
    </div>
    <p className="edm-intro">{NOME_ETAPA[s.etapa]}, rede municipal, Ideb {dados.ano}, de 0 a 10. {num(cobertura[s.etapa].com_ideb)} de {num(cobertura.total)} municípios com resultado neste recorte. Fonte: {dados.fonte}.</p>
    <p className="edm-aviso">O mapa mostra resultado, não causa. Cidades pequenas podem oscilar mais entre edições. As classes são quintis nacionais da etapa: cada uma reúne cerca de um quinto dos municípios do país com resultado, e as faixas não mudam quando você escolhe um estado. O valor de cada cidade está na tabela. Ausência tem textura própria e não recebe valor zero.</p>
    <div className="mt-6 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="min-w-0">{geometria ? <MapaCoropletico key={s.uf} titulo={`Ideb ${dados.ano} das redes municipais`} geometria={geometria} valores={valores} cores={cores} classificacao={classificacao} unidade="Ideb, de 0 a 10" casas={1} periodo={String(dados.ano)} selecionado={selecionado?.id ?? null} onSelecionar={m=>set({m:m ?? ""})} detalheRegiao={motivo} semTabela contornos altura={580} alturaCelular={430} /> : <p role="status">{erro ? "Não foi possível carregar a malha. Os mesmos resultados estão na tabela." : "Carregando a malha municipal do IBGE…"}</p>}
        {selecionado && <p className="edm-intro" aria-live="polite">{selecionado.nome} ({selecionado.uf}): {selecionado[s.etapa] === null ? motivo(selecionado.id) : `Ideb ${ideb(selecionado[s.etapa])}`}. <Link className="edm-link inline-flex min-h-[44px] items-center" href={hrefFichaMunicipio(selecionado.id)} prefetch={false}>Ficha completa da cidade</Link></p>}
        <h2 className="mt-6">Sem Ideb, por motivo</h2><dl className="edm-placar-metas">{MOTIVOS.map(mot=><div key={mot}><dt>{num(cobertura[s.etapa].motivos[mot])}</dt><dd>{ROTULO_MOTIVO[mot]}</dd></div>)}</dl>
      </div>
      <section className="min-w-0"><h2>Tabela dos municípios do recorte</h2><p className="edm-fonte">Ordem por nome. Selecione um estado para aproximar o mapa e restringir a tabela. Fonte: INEP, Ideb {dados.ano}; rede municipal, {NOME_ETAPA[s.etapa].toLowerCase()}.</p>
        <div className="edm-mapa-tabela mt-4"><TabelaDados idioma="pt" recolhida={false} limite={lista.length} titulo={`Ideb ${dados.ano}, ${s.uf}, rede municipal, ${NOME_ETAPA[s.etapa]}`} colunas={["Município","Ideb","Ausência"]} linhas={lista.map(m=>[<button key={m.id} type="button" aria-pressed={m.id===s.m} className={`min-h-[44px] text-left underline underline-offset-4 ${m.id===s.m ? "font-semibold" : ""}`} onClick={()=>set({m:m.id})}>{m.nome} ({m.uf})</button>,ideb(m[s.etapa]),motivo(m.id) ?? "Não se aplica: tem Ideb"])}/></div>
      </section>
    </div>
  </div>;
}
