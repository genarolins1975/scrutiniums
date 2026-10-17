import type { Metadata } from 'next';
import { dadosAgro, malhaAgro } from '@/lib/agro/dados';
import type { CamadaGeo } from '@/lib/energia/geo';
import { AberturaAgro, LimiteAgro } from '@/components/agro/Editorial';
import { ExploracaoTerritorialAgro } from '@/components/agro/ExploracaoTerritorial';
export const metadata: Metadata = { title: 'Atlas territorial', alternates: { canonical: '/agronegocio/atlas' } };
export default function AtlasAgro() { return <><AberturaAgro rotulo="Agronegócio / Atlas territorial" titulo="De onde vem o que o país produz?" texto="Escolha uma cadeia e veja a produção de cada estado, ou troque para crédito rural por finalidade e o grupo ocupacional do Censo 2022. Cada medida preserva seu universo, calendário e denominador."/><LimiteAgro titulo="Cada medida tem seu universo">Produção é a medida física do IBGE de cada cadeia; o abate é o local do frigorífico, não a origem do animal, e estados sob sigilo ficam sem valor. Crédito não é produção; grupo ocupacional não é emprego formal de toda a cadeia.</LimiteAgro><ExploracaoTerritorialAgro dados={dadosAgro} geometria={malhaAgro as unknown as CamadaGeo}/></>; }
