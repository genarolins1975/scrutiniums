"use client";

import { useMemo } from "react";
import { ModeloDidatico } from "@/components/observatorios/ModeloDidatico";
import { RecursoResultado } from "@/components/observatorios/RecursoResultado";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { Indice, MEDIDA, ROTULO_STATUS, componente, etapaDaMedida, fonteLegivel, formata, ficha, comparar, type DadosPainel, type MedidaId } from "@/lib/eficiencia/consulta";
import { hrefTema } from "@/lib/eficiencia/visao";
import type { ContextoFicha } from "./FichaConteudo";
import { PonteDaRazao } from "./DetalhesMedida";

const controle = "min-h-[44px] border border-mineral bg-superficie px-3 text-carvao";
const MEDIDAS = ["despesa_hab", "despesa_mat", "atu", "aprovacao", "ideb"] as const;
const TITULOS = ["Despesa por habitante", "Aplicação direta por matrícula", "Alunos por turma", "Aprovação", "Ideb"];
const UNIDADES = ["correntes por habitante", "correntes por matrícula", "alunos por turma", "dos alunos da etapa", "pontos, de 0 a 10"];

/** Os valores e perímetros são os mesmos do ExploradorTema; o panorama só aproxima as perguntas. */
export function LaboratoriosCapitais({ dados, contextos }: { dados: DadosPainel; contextos: Record<string,ContextoFicha> }) {
  const ix = useMemo(()=>new Indice(dados),[dados]);
  const esquema = useMemo(()=>({cap:campo(tiposUrl.texto({max:40}),""), ponte_ano:campo(tiposUrl.opcao(dados.anos.financeiros.map(String)),String(dados.anos.financeiros.at(-1))), ponte_etapa:campo(tiposUrl.opcao(["anos_iniciais","anos_finais"] as const),"anos_iniciais")}),[dados]);
  const [s,set] = useEstadoUrl(esquema);
  const cap = dados.capitais.find(c=>c.id===s.cap);
  const ano=Number(s.ponte_ano);
  if(!cap) return <section className="mt-12 border-t border-linha pt-6"><h2 className="font-serif text-2xl">Da despesa ao resultado da sua capital</h2><p className="mt-3 max-w-prose2 text-carvao-muted">Escolha uma capital em “Destacar capital”, no alto da página, para percorrer os cinco elos e abrir a ponte da despesa por matrícula com os dados dela.</p><a href="#panorama-cap" className="inline-flex min-h-[44px] items-center text-obee-dark underline">Escolher capital</a></section>;
  const ponto=(med:MedidaId)=> {
    const md=MEDIDA[med];
    const edicao=md.anos==="financeiros" ? ano : dados.anos[md.anos].at(-1)!;
    return {edicao,p:ix.ponto(md.indicador,cap.cod,edicao,etapaDaMedida(med,s.ponte_etapa),componente(med,"nominal","matematica")),f:ficha(dados,md.indicador)};
  };
  const sequencia=MEDIDAS.map((med,i)=>{
    const {edicao,p,f}=ponto(med);
    return {titulo:TITULOS[i],texto:f.universo_curto,numero:{rotulo:f.nome,valor:p.valor===null ? null : formata(med,p.valor,true),unidade:UNIDADES[i],periodo:String(edicao),fonte:fonteLegivel(dados,MEDIDA[med].indicador,edicao),href:hrefTema(MEDIDA[med].familia==="recursos" ? "gastos" : MEDIDA[med].familia==="atendimento" ? "atendimento" : "resultados",{cap:cap.id,med,ano:edicao,etapa:s.ponte_etapa}),nota:[ROTULO_STATUS[p.status], !p.elegivel && p.valor !== null ? "Fora da comparação" : null, p.motivo, p.nota && p.nota !== p.motivo ? p.nota : null].filter(Boolean).join(". ")}};
  });
  const posicao=(med:"despesa_hab"|"despesa_mat")=>{
    const c=comparar(ix,med,ano,s.ponte_etapa,"nominal","matematica","todas",cap,"valor_desc");
    const p=c.incluidas.find(x=>x.cap.id===cap.id);
    return p ? `${c.incluidas.filter(x=>x.valor>p.valor).length+1}ª entre ${c.incluidas.length} capitais com dado comparável` : "Sem posição: dado ausente ou fora da comparação";
  };
  return <section className="mt-12" aria-label="Laboratórios da capital">
    <div className="mb-6 flex flex-wrap gap-6"><div className="grid gap-2"><label htmlFor="ponte-exercicio">Exercício financeiro</label><select id="ponte-exercicio" className={controle} value={s.ponte_ano} onChange={e=>set({ponte_ano:e.target.value})}>{dados.anos.financeiros.map(a=><option key={a}>{a}</option>)}</select></div><div className="grid gap-2"><label htmlFor="ponte-etapa">Etapa para atendimento e resultados</label><select id="ponte-etapa" className={controle} value={s.ponte_etapa} onChange={e=>set({ponte_etapa:e.target.value as typeof s.ponte_etapa})}><option value="anos_iniciais">Anos iniciais</option><option value="anos_finais">Anos finais</option></select></div></div>
    <RecursoResultado sequencia={sequencia} descricao={`${cap.nome} (${cap.uf}). Os cinco elos organizam a leitura. Cada um conserva seu universo e seu período, indicados junto do valor.`}/>
    <ModeloDidatico id="laboratorio-ponte" titulo="Por que a ordem muda quando a razão muda?"
      descricao={`Compare as duas razões de ${cap.nome} em ${ano} e acompanhe a ponte contábil que delimita o gasto por matrícula.`}
      deixaDeFora={["Posição por valor não avalia a gestão", "Habitantes e matrículas têm universos distintos; uma matrícula não é um estudante único", "Os numeradores também diferem: a razão por matrícula usa o perímetro de aplicação direta", "Despesa por matrícula não mede custo integral nem custo marginal"]}>
      <p className="mt-4 max-w-prose2">As duas razões usam numeradores e denominadores diferentes. A despesa por habitante divide o total da função Educação pela população; a razão por matrícula usa a parcela de aplicação direta da ponte abaixo e as matrículas municipais.</p>
      <dl className="mt-6 grid gap-6 md:grid-cols-2"><div><dt className="font-medium">Despesa por habitante</dt><dd className="mt-2">{posicao("despesa_hab")}</dd></div><div><dt className="font-medium">Aplicação direta por matrícula</dt><dd className="mt-2">{posicao("despesa_mat")}</dd></div></dl>
      <p className="mt-3 text-sm text-carvao-muted">Ordem do maior valor para o menor, com a mesma posição para valores empatados. Perímetros e conjuntos comparáveis próprios de cada razão; não é classificação de eficiência. Fonte: Siconfi, INEP e IBGE, exercício {ano}.</p>
      <div className="mt-8"><PonteDaRazao ix={ix} cap={cap} ano={ano} razao={ponto("despesa_mat").p} ficha={ficha(dados,"edu.despesa.ponte_matricula")} ctx={contextos["edu.despesa.ponte_matricula"]}/></div>
    </ModeloDidatico>
  </section>;
}
