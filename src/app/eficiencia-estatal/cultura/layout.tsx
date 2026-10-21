import {CabecalhoEntrada} from '@/components/eficiencia/CabecalhoEntrada';
const ABAS:[string,string][]=[['','Panorama'],['rede','Equipamentos'],['acesso','Acesso digital'],['atividades','Atividades'],['acervos','Acervos'],['recursos','Recursos']];
export default function Layout({children}:{children:React.ReactNode}){
 return <><CabecalhoEntrada tema={{nome:'Cultura',rota:'/eficiencia-estatal/cultura',abas:ABAS,acoes:[['metodos','Dados e métodos']]}}/><main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-8 sm:px-6 md:pt-10">{children}</main></>;
}
