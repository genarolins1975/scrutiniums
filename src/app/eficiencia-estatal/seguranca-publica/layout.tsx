import {CabecalhoEntrada} from '@/components/eficiencia/CabecalhoEntrada';

const BASE = '/eficiencia-estatal/seguranca-publica';
/** Navegação do painel, na ordem da procura: a comparação por estado logo depois da visão geral. */
const ABAS_SEGURANCA: [string, string][] = [['', 'Panorama'], ['estados', 'Por estado'], ['letalidade', 'Violência letal'], ['mulheres', 'Mulheres'], ['patrimonio', 'Patrimônio'], ['resposta', 'Busca e atividade'], ['recursos', 'Recursos'], ['metodos', 'Dados e métodos']];

export default function Layout({children}: {children: React.ReactNode}) {
  // subcabeçalho único da Eficiência Estatal (diagnóstico de 20/10/2026, item 10): caminho e abas no cabeçalho; métodos à direita
  return <><CabecalhoEntrada tema={{nome: 'Segurança pública', rota: BASE, abas: ABAS_SEGURANCA.filter(([slug]) => slug !== 'metodos'), acoes: ABAS_SEGURANCA.filter(([slug]) => slug === 'metodos')}}/><main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-8 sm:px-6 md:pt-10">{children}</main></>;
}
