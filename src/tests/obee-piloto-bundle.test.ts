import {describe,expect,it} from 'vitest';
import {existsSync,readdirSync,readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';

/**
 * O piloto v2 e a candidata v3 são experimentais: a trava de produção não pode
 * depender só de não renderizar. Nenhum dado pode chegar ao JavaScript público.
 */
const raiz=process.cwd();
const EXIGIR=process.env.EXIGIR_BUILD_HTML==='1';
const ESTATICO=join(raiz,'.next','static');
// Marcas de DADOS (versões e escores com muitas casas), não nomes de campos do código.
const versoes=['irc-piloto-2022','cesta-conjunta-diagnostico','sensibilidade-pares-v3','robustez-ampliada-v3'];
const lerJson=(f:string)=>JSON.parse(readFileSync(join(raiz,'docs/obee/resultados',f),'utf8'));
const longos=(valores:number[])=>valores.map(v=>String(v)).filter(t=>/\.\d{10,}/.test(t));
const piloto=lerJson('piloto-2022-v2.json') as {rows:{pilot_five:{score:number}}[]};
const cesta=lerJson('cesta-conjunta.json') as {scenarios:{rows:{scenario_score:number}[]}[]};
const MARCAS=[...versoes,...longos(piloto.rows.map(r=>r.pilot_five.score)),
 ...longos(cesta.scenarios.flatMap(s=>s.rows.map(r=>r.scenario_score))).slice(0,60)];

function arquivos(dir:string):string[]{
 return readdirSync(dir).flatMap(nome=>{const p=join(dir,nome);return statSync(p).isDirectory()?arquivos(p):[p];});
}

describe('OBEE: dados experimentais fora do bundle público',()=>{
 it('nenhum módulo cliente importa o snapshot do piloto ou a fachada com dados',()=>{
  const fontes=arquivos(join(raiz,'src')).filter(p=>/\.(ts|tsx)$/.test(p)&&!p.includes(`${join('src','tests')}`));
  const clientes=fontes.filter(p=>/^\s*['"]use client['"]/.test(readFileSync(p,'utf8')));
  expect(clientes.length).toBeGreaterThan(0);
  for(const p of clientes){
   const texto=readFileSync(p,'utf8');
   // Somente importações: links para o GitHub com o nome do arquivo são legítimos.
   expect(texto,p).not.toMatch(/(?:from|import\()\s*['"][^'"]*(?:piloto-2022-v2\.json|eficiencia\/piloto-resultados|cesta-conjunta\.json|sensibilidade-pares-v3\.json)['"]/);
  }
  const nucleo=readFileSync(join(raiz,'src/lib/eficiencia/piloto-nucleo.ts'),'utf8');
  expect(nucleo).toMatch(/import type snapshotType from/);
  expect(nucleo).not.toMatch(/^import snapshot/m);
 });

 it('o build não contém dados do piloto nem da candidata em .next/static',()=>{
  expect(MARCAS.length).toBeGreaterThan(40);
  if(!existsSync(ESTATICO)){
   if(EXIGIR)throw new Error('Build ausente: rode npm run build antes desta verificação');
   return;
  }
  const encontrados=arquivos(ESTATICO).filter(p=>/\.(js|json|html|txt)$/.test(p)).flatMap(p=>{
   const texto=readFileSync(p,'utf8');
   return MARCAS.filter(m=>texto.includes(m)).map(m=>`${p.slice(raiz.length+1)}: ${m}`);
  });
  expect(encontrados).toEqual([]);
 });
});
