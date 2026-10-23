import type {Metadata} from 'next';
import {PainelPrincipal} from '@/components/observatorios/PainelPrincipal';
import {PaginaServico} from '@/components/eficiencia/saneamento/PaginaServico';
export const dynamic='force-static';
export const metadata:Metadata={"title": "Quanto se declara em despesas e investimentos? — Saneamento", "alternates": {"canonical": "/eficiencia-estatal/saneamento/recursos"}};
// molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): o corpo comum das páginas de serviço; textos e números são os de antes
export default function Pagina(){return <PaginaServico slug="recursos" aviso={<PainelPrincipal rota="/eficiencia-estatal/saneamento/recursos"/>} titulo="Quanto se declara em despesas e investimentos?"
 lead="Os registros financeiros acompanham serviços prestados por organizações públicas e privadas. Valores totais mostram a escala; razões por residente oferecem uma referência de tamanho com o universo de cada módulo."
 limite="gasto público, gasto por usuário atendido ou tarifa: os valores são autodeclarados ao SINISA por prestadores de diferentes naturezas, sem conferência com demonstrações financeiras auditadas."
 numeros={["AG_DESPESA", "AG_INVESTIMENTO", "ES_INVESTIMENTO"]}
 complementoNumero=" Autodeclarado ao SINISA, sem conferência com demonstrações financeiras auditadas."
 notaNumeros="Em esgoto, o relatório de participação informa 173.640.502 residentes e a planilha financeira usa 188.255.906 (DFE0001). As razões desta página preservam a segunda base. Não somamos despesas e investimentos."
 secao={{titulo:"Recursos de água e esgoto",texto:"Reais correntes de 2024. Compare totais e valores por residente selecionando o indicador."}}
 explicacao={{titulo:"Como ler os valores por residente",corpo:<><p>O OBEE divide o total financeiro pela população residente consolidada na própria planilha do módulo. Não é gasto por usuário atendido, tarifa ou gasto do orçamento público. Ausência de declaração financeira pode afetar a razão. Não há uma série temporal harmonizada nesta edição.</p><p>Despesas e investimentos são autodeclarados ao SINISA, sem conferência com demonstrações financeiras auditadas: o prestador informa os valores no formulário de gestão financeira e o Ministério das Cidades os publica como declarados.</p></>}}
/>}
