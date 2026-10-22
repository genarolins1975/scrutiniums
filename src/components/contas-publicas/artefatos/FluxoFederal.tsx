'use client';
import { useMemo } from 'react';
import { DiagramaFluxo } from '@/components/fluxo/DiagramaFluxo';
import { FLUXO_FEDERAL as F, diagramaFederal } from '@/lib/contas-publicas/fluxo';
import { reaisCurto, parcela } from '@/lib/fluxo/formato';
import { Proveniencia } from './Proveniencia';
import { DADOS } from '@/lib/contas-publicas/dados';

const MI = 1e6;
const mes = (iso: string) => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + '-01T00:00:00Z'));

export function FluxoFederal() {
  const d = useMemo(() => diagramaFederal(), []);
  const inss = F.usos.find(u => u.id === 'inss')!;
  const saudeLivre = F.usos.find(u => u.id === 'discricionarias')!.partes.find(p => p[0] === 'Saúde');
  const resultado = F.resultado < 0 ? `déficit primário de ${reaisCurto(-F.resultado * MI)}` : `superávit primário de ${reaisCurto(F.resultado * MI)}`;
  return (
    <DiagramaFluxo
      id="fluxo-federal"
      titulo={`O caminho do dinheiro federal em ${F.ano}`}
      subtitulo={<>Governo Central · janeiro a dezembro de {F.ano} · R$ correntes, sem juros da dívida · Tesouro Nacional, RTN de {mes(F.referenciaRTN)}.</>}
      leitura={<>Em {F.ano} entraram <strong>{reaisCurto(F.arrecadacao * MI)}</strong>. Saíram <strong>{reaisCurto(F.repasse.valor * MI)}</strong> para estados e municípios, e com os <strong>{reaisCurto(F.receita_liquida * MI)}</strong> que ficaram a União pagou <strong>{reaisCurto(F.gasto * MI)}</strong>: {resultado}. Aposentadorias e pensões do INSS foram <strong>{parcela(inss.valor, F.gasto)}</strong> do gasto.</>}
      resumo={`Diagrama de fluxo. Arrecadação de ${reaisCurto(F.arrecadacao * MI)} em ${F.ano}, vinda de ${F.fontes.length} grupos de receita; ${reaisCurto(F.repasse.valor * MI)} repassados a estados e municípios; receita líquida de ${reaisCurto(F.receita_liquida * MI)}; gasto primário de ${reaisCurto(F.gasto * MI)}, repartido em ${F.usos.length} grupos; ${resultado}. A tabela de valores exatos está logo abaixo.`}
      nos={d.nos}
      elos={d.elos}
      colunas={d.colunas}
      referencia={F.arrecadacao * MI}
      rotuloReferencia="a arrecadação"
      ressalvas={<>
        <p>Os juros da dívida, {reaisCurto(-F.juros_nominais * MI)} em {F.ano}, ficam fora deste fluxo: o fluxo mede o resultado primário, e os juros nominais são apurados pelo Banco Central pelo critério abaixo da linha.</p>
        {saudeLivre && <p>A saúde aparece em dois lugares: a parte obrigatória ({reaisCurto(F.usos.find(u => u.id === 'saude')!.valor * MI)}) e {reaisCurto(Number(saudeLivre[1]) * MI)} dentro dos gastos discricionários. Valores nominais, sem correção pela inflação.</p>}
      </>}
      metodo={<>
        <p><strong>Fonte.</strong> Tesouro Nacional, Resultado do Tesouro Nacional, série histórica, {F.tabela}, edição de {mes(F.referenciaRTN)}, a mesma dos demais números deste capítulo (SHA-256 {F.sha256.slice(0, 12)}…). O ano de {F.ano} está encerrado; boletins seguintes podem revisar valores.</p>
        <p><strong>Critério.</strong> {F.criterio} Arrecadação é a linha 1 (receita total); repasse é a linha 2 (transferências por repartição de receita: FPM, FPE, IPI-Exportação, royalties, salário-educação e fundos constitucionais); receita líquida é a linha 3; gasto é a linha 4; o resultado é a linha 5.</p>
        <p><strong>Agrupamentos.</strong> Cada grupo soma linhas do próprio demonstrativo e foi conferido contra o total que ele declara. “Saúde (parte obrigatória)” e “Bolsa Família” são despesas obrigatórias com controle de fluxo (linha 4.4.1); “Outras obrigatórias” reúne o restante das linhas 4.3 e 4.4.1; “Gastos discricionários” é a linha 4.4.2. A composição de cada grupo está na tabela.</p>
        <p><strong>O que não se compara.</strong> O fluxo dos estados, no painel estadual, usa receita realizada e despesa empenhada e inclui juros dentro dos encargos; aqui é caixa e pagamento, sem juros.</p>
      </>}
      rodape={<Proveniencia fonte="Tesouro Nacional · RTN · tabela 2.2" url={F.fonte} referencia={`janeiro a dezembro de ${F.ano}`} publicacao={DADOS.publicacaoRTN} captura={DADOS.captura} perimetro="Governo Central" unidade={F.unidade} natureza="Resultado primário acima da linha, nominal; receita por caixa, despesa por pagamento" download="/contas-publicas/fluxo.json" />}
    />
  );
}
