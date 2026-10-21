import type {Metadata} from 'next';
import {CabecalhoEntrada} from '@/components/eficiencia/CabecalhoEntrada';
import {MinhaCapitalAperitivo} from '@/components/eficiencia/entrada/MinhaCapitalAperitivo';
import {RotuloContexto} from '@/components/layout/RotuloContexto';
import entradaStyles from '@/components/eficiencia/entrada/MinhaCapitalAperitivo.module.css';
import {Footer} from '@/components/layout/Footer';
import {montarRetrato} from '@/lib/eficiencia/entrada';
import {montarAperitivoCapital} from '@/lib/eficiencia/aperitivo-capital';

/**
 * Versão aperitivo de /eficiencia-estatal (princípio do aperitivo, decisão do dono de 20/10/2026): quem acessa o
 * endereço público sem sessão recebe esta página por rewrite (src/middleware.ts); quem tem conta recebe a entrada
 * completa (src/app/eficiencia-estatal/page.tsx). Mostra só quatro condições de 2022 da capital escolhida, com
 * valor, ano, posição entre as 26 e fonte, recortadas do mesmo retrato da entrada completa. Fica de fora tudo o
 * que é do painel: atlas, mapa de cobertura, tabela e faixa das 26 capitais, recursos, índice, temas e arquivos.
 *
 * A casca repete a do domínio (src/app/eficiencia-estatal/layout.tsx), que não envolve o caminho interno: o mesmo
 * fundo e anel de foco, o atalho para o conteúdo e o rodapé; sem o bloco de outras páginas, como nas demais versões
 * aperitivo.
 */
export const dynamic = 'force-static';
export const metadata: Metadata = {
  title: 'Como está a minha capital? · Eficiência Estatal',
  description: 'Escolha uma das 26 capitais estaduais e veja quatro resultados na vida dos moradores em 2022: renda por pessoa, crianças de 4 e 5 anos na escola, tempo até o trabalho e homicídios, cada um com fonte, ano e posição entre as capitais.',
  alternates: {canonical: '/eficiencia-estatal'},
};

/** O que o observatório completo mostra a quem tem conta (fecho da página, em ConviteAperitivo). */
const COM_CONTA = [
  'As sete condições e os três recursos da prefeitura das 26 capitais, lado a lado, com a faixa de todas as capitais e a comparação com outra capital',
  'O atlas da capital e o mapa de cobertura do que se sabe e do que ainda não se sabe em cada tema',
  'O índice de resultados, com faixa, contribuições e estabilidade de cada comparação',
  'Os 13 temas do observatório, com painéis, comparações e métodos',
  'Em Segurança alimentar, quem passa fome no Brasil: os domicílios em insegurança grave por sexo, cor ou raça, escolaridade e trabalho da pessoa responsável e por moradores, e os em insegurança moderada ou grave por renda, em nove tabelas do IBGE de 2023 e 2024',
  'Os arquivos para baixar, com os valores das 26 capitais',
] as const;

export default function AperitivoMinhaCapital() {
  const dados = montarAperitivoCapital(montarRetrato());
  return <div className="dominio-obee flex min-h-screen flex-col bg-papel text-obee-tinta">
    <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:border focus:border-obee focus:bg-superficie focus:px-4 focus:text-sm focus:text-obee-tinta">Pular para o conteúdo</a>
    <div className="flex-1"><CabecalhoEntrada/>
      <main id="conteudo" className="pb-12">
        {/* fecho obrigatório: ConviteAperitivo com rota="/eficiencia-estatal", dentro do componente cliente */}
        <MinhaCapitalAperitivo dados={dados} comConta={COM_CONTA} rotulo={<RotuloContexto rota="/eficiencia-estatal" pagina="Minha capital" className={entradaStyles.kicker}/>}/>
      </main>
    </div>
    <Footer/>
  </div>;
}
