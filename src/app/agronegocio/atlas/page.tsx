import type { Metadata } from 'next';
import { dadosAgro, malhaAgro } from '@/lib/agro/dados';
import type { CamadaGeo } from '@/lib/energia/geo';
import { AberturaAgro, LimiteAgro } from '@/components/agro/Editorial';
import { ExploracaoTerritorialAgro } from '@/components/agro/ExploracaoTerritorial';
export const metadata: Metadata = { title: 'Atlas territorial', alternates: { canonical: '/agronegocio/atlas' } };
export default function AtlasAgro() { return <><AberturaAgro rotulo="Agronegócio / Atlas territorial" titulo="O mesmo país, diferentes contextos." texto="Explore crédito rural por finalidade e o grupo ocupacional qualificado do Censo 2022. Cada medida preserva seu universo, calendário e denominador."/><LimiteAgro titulo="Atlas com cobertura parcial">A produção física por cultura ainda não tem base validada. Crédito não é produção; grupo ocupacional não é emprego formal de toda a cadeia. Não existem filtros de produto ou perfil familiar para fontes que não trazem essa identificação conjunta.</LimiteAgro><ExploracaoTerritorialAgro dados={dadosAgro} geometria={malhaAgro as unknown as CamadaGeo}/></>; }
