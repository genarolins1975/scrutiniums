"use client";
import { useEffect, useState } from 'react';
import {
  disponibilidadeEducacao, ETAPAS_EDUCACAO, ETAPA_PADRAO,
  lerEtapa, STATUS_EDUCACAO, type EtapaEducacao,
} from '@/lib/contas-estaduais/educacao';

export default function EducacaoEstadual({ uf, ano }: { uf: string; ano: number }) {
  const [etapa, setEtapa] = useState<EtapaEducacao>(ETAPA_PADRAO);
  useEffect(() => {
    const restaurar = () => setEtapa(lerEtapa(new URLSearchParams(window.location.search).get('etapa_educacao')));
    restaurar();
    window.addEventListener('popstate', restaurar);
    return () => window.removeEventListener('popstate', restaurar);
  }, []);
  const d = disponibilidadeEducacao(uf, ano, etapa);
  if (!d) return null;
  function selecionar(valor: string) {
    const proxima = lerEtapa(valor);
    setEtapa(proxima);
    const url = new URL(window.location.href);
    url.searchParams.set('etapa_educacao', proxima);
    window.history.pushState(null, '', url);
  }
  const consulta = new URLSearchParams({ uf, ano: String(ano), etapa }).toString();
  return <section id="educacao-estadual" tabIndex={-1} className="ce-education" aria-labelledby="educacao-titulo">
    <div className="ce-section-heading">
      <div><p className="rotulo ce-kicker">Educação / {uf} / {ano} / rede estadual</p><h3 id="educacao-titulo">Do gasto à aprendizagem.</h3></div>
      <a className="ce-download" href={'/contas-publicas-estaduais/educacao.csv?' + consulta}>Baixar disponibilidade · CSV ↓</a>
    </div>
    <p className="ce-education-lead">Quanto se gasta por matrícula? As metas foram cumpridas? O que mudou na aprendizagem? Para responder, orçamento, atendimento e resultados precisam descrever o mesmo universo.</p>
    <div className="ce-filters"><label>Etapa de ensino<select value={etapa} onChange={e => selecionar(e.target.value)}>{Object.entries(ETAPAS_EDUCACAO).map(([id, nome]) => <option value={id} key={id}>{nome}</option>)}</select></label></div>
    <p className="ce-education-scope">UF inteira · {d.etapa_nome} · referência {ano}. A seleção acompanha o estado e o ano da ficha; a etapa vale apenas para educação.</p>
    <div className="ce-education-status" role="status"><strong>Sem observações educacionais conferidas neste recorte.</strong><p>Os valores ainda não foram incorporados ao observatório. Isso não significa que a fonte não os tenha publicado, nem informa o desempenho do governo.</p></div>
    <div className="ce-table-scroll" role="region" tabIndex={0} aria-label="Disponibilidade das evidências educacionais">
      <table><caption>O que falta para analisar {uf} · {ano} · {d.etapa_nome}</caption>
        <thead><tr><th scope="col">Evidência</th><th scope="col">Situação no observatório</th><th scope="col">Condição para comparar</th><th scope="col">Fonte</th></tr></thead>
        <tbody>{d.evidencias.map(e => <tr key={e.id}><th scope="row">{e.nome}</th><td>{STATUS_EDUCACAO[e.status]}</td><td>{e.requisito}</td><td>{e.url ? <a href={e.url}>{e.fonte} ↗</a> : e.fonte}</td></tr>)}</tbody>
      </table>
    </div>
    <dl className="ce-education-readings">
      <div><dt>CE-34 · despesa por matrícula</dt><dd>Não calculável<p>Exige despesa e matrículas com perímetros conciliados. A despesa total da função Educação não substitui essa conciliação.</p></dd></div>
      <div><dt>CE-35 · Ideb da rede estadual</dt><dd>Sem observação conferida<p>Não se substitui a rede estadual pela rede pública total, por capitais ou por outro ano. Metas físicas precisam de evidência própria.</p></dd></div>
    </dl>
    <p className="ce-budget-caution">Despesa por matrícula é uma razão contábil, não uma medida isolada de eficiência. O Ideb descreve um resultado educacional; a associação com o gasto não demonstra causalidade. Eficácia exige confrontar a meta formal com a entrega observada.</p>
    <details><summary>Entender o recorte e as condições de publicação</summary>
      <p>As fontes devem coincidir em UF, ano, rede, etapa e abrangência, com documentação das diferenças de universo. Recursos de outras redes, ensino superior ou etapas distintas não podem ser atribuídos automaticamente às matrículas selecionadas.</p>
      <p>O calendário dos resultados é próprio de cada fonte. Não se transporta um resultado de outro ano para preencher a seleção. Zero observado, supressão e ausência devem permanecer distintos.</p>
      {d.tentativa_fontes ? <p>Há registro de tentativa de obtenção dos arquivos de 2025 em 12/10/2026, sem incorporação de observações. <a href={d.tentativa_fontes.manifesto}>Consultar o registro da tentativa ↗</a></p> : <p>Não há levantamento educacional registrado nesta ficha para {ano}. Os arquivos de 2025 não preenchem este ano.</p>}
      {uf === 'DF' && <p>O Distrito Federal reúne competências estaduais e municipais; seu perímetro deve ser examinado antes de qualquer comparação entre redes.</p>}
      <p><a href={'/contas-publicas-estaduais/educacao.json?' + consulta}>Baixar disponibilidade e requisitos · JSON ↓</a>. Esses arquivos contêm situações e requisitos, não notas ou resultados educacionais.</p>
    </details>
  </section>;
}
