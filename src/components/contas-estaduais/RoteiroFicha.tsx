import { execucaoPrimaria } from '@/lib/contas-estaduais/dados';

export default function RoteiroFicha({ uf, ano }: { uf: string; ano: number }) {
 const temExecucao = Boolean(execucaoPrimaria(uf, ano));
 const caminhos = [
  ['divida-estadual', 'Dívida', 'Dívida líquida, receita e trajetória'],
  ['execucao-estadual', 'Execução', temExecucao ? 'Da autorização ao pagamento' : 'Consultar cobertura deste ano'],
  ...(temExecucao ? [
   ['saldos-execucao', 'Saldos', 'Parcelas da autorização e sua mudança'],
   ['composicao-despesa', 'Despesas', 'Pessoal, juros e despesas de capital'],
   ['financiamento', 'Receitas', 'Composição e margem corrente'],
  ] : []),
  ['educacao-estadual', 'Educação', 'Disponibilidade de gasto, matrículas e resultados'],
 ];
 return <nav className="ce-ficha-guide" aria-label={`Explorar ficha de ${uf}, ${ano}`}>
  <p className="rotulo ce-kicker">Explore a ficha · {uf} · {ano}</p>
  <ul>{caminhos.map(([id, titulo, descricao]) => <li key={id}><a href={`#${id}`}><strong>{titulo} <span aria-hidden="true">↘</span></strong><span>{descricao}</span></a></li>)}</ul>
  {!temExecucao && <p className="ce-note">Execução, saldos, despesas e receitas têm cobertura conferida em 2025. Selecione esse ano para explorá-los.</p>}
 </nav>;
}
