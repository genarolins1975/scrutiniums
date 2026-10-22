'use client';
import { useMemo } from 'react';
import { DiagramaFluxo } from '@/components/fluxo/DiagramaFluxo';
import { FLUXO_ESTADUAL as B, diagramaEstadual, doEstado, fluxoDaUF } from '@/lib/contas-estaduais/fluxo';
import { parcela, reaisCurto } from '@/lib/fluxo/formato';

const data = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z'));

export default function FluxoEstadual({ uf, ano, selecionar }: { uf: string; ano: number; selecionar: (uf: string, ano: number) => void }) {
  const u = fluxoDaUF(uf);
  const d = useMemo(() => (u ? diagramaEstadual(u) : null), [u]);
  if (!u || !d) return null;
  if (ano !== B.exercicio) {
    return (
      <aside id="fluxo-estadual" className="ce-budget-empty">
        <h3>O caminho do dinheiro {doEstado(u)}</h3>
        <p>O fluxo da arrecadação ao gasto cobre o encerramento de {B.exercicio}. Para {ano}, ainda não há fluxo conferido; ausência no painel não significa ausência na fonte.</p>
        <p><button type="button" className="ce-inline-button" onClick={() => selecionar(uf, B.exercicio)}>Ver o fluxo de {B.exercicio}</button></p>
      </aside>
    );
  }
  const maior = [...u.usos].sort((a, b) => b.valor - a.valor)[0];
  const areas = u.usos.reduce((s, a) => s + a.valor, 0);
  const resultado = u.resultado < 0 ? `déficit de ${reaisCurto(-u.resultado)}` : `superávit de ${reaisCurto(u.resultado)}`;
  const saiu = u.repasse > 0
    ? <>Saíram <strong>{reaisCurto(u.repasse)}</strong> para os municípios e <strong>{reaisCurto(u.fundeb)}</strong> para o Fundeb</>
    : <>Saíram <strong>{reaisCurto(u.fundeb)}</strong> para o Fundeb</>;
  const diferencas = [u.diferenca_receita, u.diferenca_gasto].filter(v => v !== 0);
  return (
    <DiagramaFluxo
      id="fluxo-estadual"
      nivel="h3"
      titulo={`O caminho do dinheiro ${doEstado(u)} em ${u.ano}`}
      subtitulo={<>Governo {u.uf === 'DF' ? 'do Distrito Federal' : 'estadual'} · janeiro a dezembro de {u.ano} · R$ correntes · receita realizada e despesa empenhada · Siconfi, RREO do 6º bimestre, captura de {data(B.captura)}.</>}
      leitura={<>Em {u.ano} o governo {u.uf === 'DF' ? 'do Distrito Federal' : 'estadual'} arrecadou <strong>{reaisCurto(u.arrecadacao)}</strong>. {saiu}; ficaram <strong>{reaisCurto(u.receita_disponivel)}</strong>. O gasto foi de <strong>{reaisCurto(u.gasto)}</strong>: {resultado}. A maior área foi {maior.nome.toLowerCase()}, com <strong>{parcela(maior.valor, areas)}</strong> do gasto por área.{u.diferenca_gasto < 0 && <> A soma por área (Anexo 02) chega a <strong>{reaisCurto(areas)}</strong>, acima do gasto do balanço (Anexo 01); a diferença aparece em cinza.</>}</>}
      resumo={`Diagrama de fluxo ${doEstado(u)} em ${u.ano}. Arrecadação de ${reaisCurto(u.arrecadacao)}; repasse a municípios de ${reaisCurto(u.repasse)}; retenção para o Fundeb de ${reaisCurto(u.fundeb)}; receita disponível de ${reaisCurto(u.receita_disponivel)}; gasto de ${reaisCurto(u.gasto)}; ${resultado}. A tabela de valores exatos está logo abaixo.`}
      nos={d.nos}
      elos={d.elos}
      colunas={d.colunas}
      referencia={u.arrecadacao}
      rotuloReferencia="a arrecadação"
      ressalvas={<>
        {u.registro_repasse === 'despesa' && <p>{u.nome} registra a cota dos municípios como despesa, e não como dedução da receita. Para desenhar todos os estados do mesmo jeito, esse valor ({reaisCurto(u.repasse)}) saiu da receita e do gasto, dentro de encargos especiais.</p>}
        {diferencas.length > 0 && <p>Os demonstrativos do próprio ente não fecham entre si: a diferença aparece como faixa própria, em cinza, e não foi redistribuída entre as áreas.</p>}
        {u.uf === 'DF' && <p>O Distrito Federal reúne competências estaduais e municipais e não tem municípios para repassar. A segurança, a saúde e a educação pagas pela União por meio do Fundo Constitucional do DF não passam por este orçamento.</p>}
        <p>Dívida e encargos especiais é a função Encargos Especiais: serviço da dívida (juros e amortização) e outros encargos que não pertencem a uma área de governo. Valores nominais, sem correção pela inflação.</p>
      </>}
      metodo={<>
        <p><strong>Fonte.</strong> Tesouro Nacional, Siconfi, Relatório Resumido da Execução Orçamentária do 6º bimestre de {u.ano}, esfera estadual: Anexo 01 (balanço orçamentário), Anexo 02 (despesa por função) e Anexo 03 (receita corrente líquida). As respostas da API foram arquivadas byte a byte e o fluxo é reproduzido só a partir delas. O 6º bimestre acumula o exercício inteiro.</p>
        <p><strong>Arrecadação.</strong> Receitas correntes brutas do Anexo 03, antes das deduções (ICMS, IPVA, demais tributos, FPE, Fundeb recebido, SUS e convênios, contribuições, rendimentos e outras), mais as receitas de capital do Anexo 01 (operações de crédito, alienações e transferências de capital).</p>
        <p><strong>O que sai antes.</strong> “Repasse a municípios” é a dedução de transferências constitucionais e legais do Anexo 03 (cota do ICMS, do IPVA e do IPI-Exportação). “Retido para o Fundeb” é a dedução para formação do fundo; o que o fundo devolve ao estado está na entrada “Fundeb, SUS e convênios”. “Receita disponível” é a receita realizada do Anexo 01, exceto intra-orçamentárias.</p>
        <p><strong>Gasto.</strong> Despesa empenhada do Anexo 01, exceto intra-orçamentárias; áreas pela despesa empenhada por função do Anexo 02. Aposentadorias de servidores é a função Previdência Social; “Judiciário, MP e Legislativo” soma as funções Judiciária, Essencial à Justiça e Legislativa. Quando o total por função difere do Anexo 01, a diferença vira faixa própria. O resultado é receita disponível menos gasto, pelo critério orçamentário, com juros e amortização dentro do gasto.</p>
        <p><strong>O que não se compara.</strong> O fluxo federal, no capítulo Panorama de Contas Públicas, usa caixa e pagamento e exclui juros; aqui é receita realizada e despesa empenhada. Empenho é compromisso assumido no ano, pago ou não.</p>
        <p>{B.escopo_conferencia}</p>
      </>}
      rodape={<p className="ce-source-links"><a href="/contas-publicas-estaduais/fluxo.json" download>Baixar o fluxo das 27 unidades · JSON ↓</a>{u.evidencias.map(e => <a key={e.sha256} href={e.arquivo} download>Resposta original preservada ({e.arquivo.includes('rreo02') ? 'Anexo 02' : e.arquivo.includes('rreo03') ? 'Anexo 03' : 'Anexo 01'}) · JSON ↓</a>)}</p>}
    />
  );
}
