import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {executar} from '../../scripts/cobertura-i18n.mjs';

const temporarios: string[] = [];
afterEach(() => temporarios.splice(0).forEach(p => rmSync(p, {recursive:true, force:true})));
function fixture() {
  const root=mkdtempSync(join(tmpdir(),'i18n-codigo-'));temporarios.push(root);
  const put=(path:string,text:string)=>{mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),text);};
  execFileSync('git',['init','--quiet'],{cwd:root});
  put('src/page.tsx','export default () => <h1>Dados</h1>;');
  put('gold/base.json','{"titulo":"Energia","valor":10}');
  put('gold/report.html','<h1>Publicação diária</h1>');
  put('config/i18n-inventario.json',JSON.stringify({schema_version:1,ui:{raizes:['src']},dominios:[{id:'plataforma',nome:'Plataforma',ui:['src'],gold:['gold']}],observar:['src','gold'],conteudo:[{path:'gold/report.html',dominio:'plataforma',formato:'html'}]}));
  return {root,put,report:()=>readFileSync(join(root,'docs/i18n/cobertura.json'),'utf8')};
}
describe('contrato de cobertura versionada somente de código',()=>{
  it('não muda com valor, texto, quantidade, exclusão ou sintaxe da gold',()=>{
    const f=fixture();executar([],f.root);const before=f.report();
    f.put('gold/base.json','{"titulo":"Novo texto","valor":999,"aviso":"Outro campo"}');
    f.put('gold/novo.json','{"titulo":"Nova publicação"}');
    f.put('gold/report.html','<h2>Novo relatório e novos números: 100</h2>');
    expect(executar(['--comparar','docs/i18n/cobertura.json'],f.root)).toContain('confere');
    f.put('gold/base.json','{JSON incompleto');
    expect(executar(['--comparar','docs/i18n/cobertura.json'],f.root)).toContain('confere');
    rmSync(join(f.root,'gold'),{recursive:true});
    expect(executar(['--comparar','docs/i18n/cobertura.json'],f.root)).toContain('confere');
    expect(f.report()).toBe(before);
    expect(JSON.parse(before).dominios.plataforma).not.toHaveProperty('gold');
  });
  it('mede a gold atual só no diagnóstico e não modifica a saída versionada',()=>{
    const f=fixture();executar([],f.root);const before=f.report();
    const old=JSON.parse(executar(['--gold'],f.root));
    f.put('gold/novo.json','{"titulo":"Nova publicação"}');
    const now=JSON.parse(executar(['--gold'],f.root));
    expect(now.dominios.plataforma.arquivos).toBe(old.dominios.plataforma.arquivos+1);
    expect(now.escopo.fontes_sha256).not.toBe(old.escopo.fontes_sha256);
    expect(f.report()).toBe(before);
  });
  it('continua rejeitando alteração da interface e de modelos de frase',()=>{
    const f=fixture();executar([],f.root);
    f.put('src/page.tsx','export default () => <h1>Outro título</h1>;');
    expect(()=>executar(['--comparar','docs/i18n/cobertura.json'],f.root)).toThrow('desatualizada');
    executar([],f.root);
    f.put('pipeline/i18n/templates/plataforma.json','{"mensagem":"Dados de {ano}"}');
    expect(()=>executar(['--comparar','docs/i18n/cobertura.json'],f.root)).toThrow('desatualizada');
  });
  it('não exige materializações para conferir código, mas diagnostica sua ausência no --gold',()=>{
    const f=fixture();const path=join(f.root,'config/i18n-inventario.json');
    const m=JSON.parse(readFileSync(path,'utf8'));m.materializados=[{dominio:'plataforma',origem:'seed-ausente.gz'}];writeFileSync(path,JSON.stringify(m));
    executar([],f.root);expect(executar(['--comparar','docs/i18n/cobertura.json'],f.root)).toContain('confere');
    expect(()=>executar(['--gold'],f.root)).toThrow();
  });
});
