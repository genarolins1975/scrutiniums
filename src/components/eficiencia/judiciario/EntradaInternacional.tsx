import Link from 'next/link';
import {internacionalJudiciario as d} from '@/lib/eficiencia/judiciario/internacional-dados';
import {escore} from '@/lib/eficiencia/judiciario/internacional';
import {BASE_JUDICIARIO} from '@/lib/eficiencia/judiciario/modelo';
import {n} from '@/lib/eficiencia/justica/modelo';
import {SetaJudiciario} from './Editoria';
import s from './Judiciario.module.css';

export function EntradaInternacionalJudiciario(){
 const brasil=d.paises.find(p=>p.iso3==='BRA')!,portugal=d.paises.find(p=>p.iso3==='PRT')!;
 return <section className={s.internationalTeaser} aria-labelledby="entrada-internacional-titulo"><div><p className={s.eyebrow}>Brasil e outros países</p><h2 id="entrada-internacional-titulo">O que a Justiça<br/>entrega às pessoas?</h2><p>Compare experiências de acesso, demora e cumprimento em {d.cobertura.paises} países e jurisdições. Mesmas perguntas, referências regionais e países que você escolhe.</p><Link className={s.primaryButton} href={BASE_JUDICIARIO+'/internacional'}>Explorar a comparação internacional<SetaJudiciario/></Link></div><figure><figcaption>Mesma edição. Dimensões diferentes.<span>Escores WJP · {d.edicao} · escala de 0 a 1</span></figcaption><table><thead><tr><th scope="col">Justiça civil</th><th scope="col">Brasil</th><th scope="col">Portugal</th></tr></thead><tbody>{([['f_7_1','Acesso e custo'],['f_7_5','Resposta sem demora excessiva'],['f_7_6','Cumprimento das decisões']] as const).map(([id,nome])=><tr key={id}><th scope="row">{nome}</th><td>{n(escore(brasil,id),3)}</td><td>{n(escore(portugal,id),3)}</td></tr>)}</tbody></table><p>Quanto mais perto de 1, maior a aderência ao critério. Não são percentuais de pessoas, meses de espera ou taxas administrativas.</p><p><a href={d.fonte.url}>Fonte: World Justice Project, edição {d.edicao}.</a></p></figure></section>;
}
