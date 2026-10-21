import { CabecalhoPlataforma } from '@/components/layout/CabecalhoPlataforma';
import { NavegacaoAgro } from './Navegacao';
import s from './Agro.module.css';

/** Cabeçalho do Agronegócio: a barra comum da plataforma (marca, seletor, abas dos seis observatórios e conta) e, abaixo dela, a navegação do observatório. */
export function CabecalhoAgro() { return <><header className={s.platform}><CabecalhoPlataforma colecao="agro" destinoConta="/agronegocio" /></header><NavegacaoAgro /></>; }
