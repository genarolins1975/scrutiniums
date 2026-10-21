/** Build-only materialization from a hash-checked, preserved official snapshot. */
import { readFileSync,writeFileSync,mkdirSync,renameSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root));
const manifest=JSON.parse(read('pipeline/eficiencia_alimentar/seed/manifesto.json'));
const seed=read('pipeline/eficiencia_alimentar/seed/recorte_ibge.json.gz');
if(createHash('sha256').update(seed).digest('hex')!==manifest.seed_sha256)throw Error('Seed alimentar com hash divergente');
const data=JSON.parse(gunzipSync(seed));
const towns=new Map(data.towns.map(t=>[t.code,t]));
if(towns.size!==5570||data.towns.length!==5570||data.metrics.length!==10||data.needs.length!==12||new Set(data.needs.map(r=>r.territory+':'+r.year)).size!==12)throw Error('Cobertura alimentar inválida');
const indexed=new Map();
for(const m of data.metrics){const map=new Map(m.rows.map(r=>[r.code,r]));if(map.size!==5570||m.rows.length!==5570||m.rows.some(r=>!towns.has(r.code)||!r.status||(['-',null,'Não sabe informar'].includes(r.raw)&&r.status==='OBSERVADO')))throw Error('Registros alimentares inválidos');indexed.set(m.id,map);}
const files=new Map();
const quote=v=>{const s=String(v??'');return /[;"\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s};
const csv=(head,rows)=>'\ufeff'+[head,...rows].map(r=>r.map(quote).join(';')).join('\r\n')+'\r\n';
files.set('municipios.csv',csv(['codigo_ibge','municipio','uf','variavel','indicador','periodo','unidade','valor_original','status','papel_escore','fonte','registro'],data.metrics.flatMap(m=>m.rows.map(r=>[r.code,towns.get(r.code).city,towns.get(r.code).uf,m.id,m.name,m.period,m.unit,r.raw,r.status,m.role,'IBGE MUNIC 2024',m.sheet+' / '+m.id]))));
files.set('pnad.csv',csv(['territorio','ano','seguranca_pct','inseguranca_pct','leve_pct','moderada_pct','grave_pct','fonte','pagina'],data.needs.map(r=>[r.territory,r.year,r.secure,r.insecure,r.mild,r.moderate,r.severe,'IBGE PNADC 2024',6])));
for(const uf of new Set(data.towns.map(t=>t.uf))){files.set(`uf-${uf}.json`,JSON.stringify(data.towns.filter(t=>t.uf===uf).map(t=>({...t,values:Object.fromEntries(data.metrics.map(m=>[m.id,indexed.get(m.id).get(t.code)]))}))));}
const out=new URL('public/eficiencia/seguranca-alimentar/',root);mkdirSync(out,{recursive:true});
for(const [name,body] of files){const temp=new URL(name+'.tmp',out);writeFileSync(temp,body);renameSync(temp,new URL(name,out));}
console.log('Segurança alimentar: 5570 municípios, 55700 respostas e 12 recortes PNADC materializados.');

/*
 * Bases complementares (integração de 21/10/2026): CadINSAN, PAA e PNAE por município, em um
 * arquivo por UF, e os CSV de todas as bases. O seed tem SHA-256 fixado no manifesto; a gold
 * agregada (complementos.json, versionada) precisa ser do mesmo seed. Nada é recalculado aqui:
 * o script só reparte e exporta o que o pipeline validou.
 */
const manComp = JSON.parse(read('pipeline/eficiencia_alimentar/seed/complementos-manifesto.json'));
const seedComp = read('pipeline/eficiencia_alimentar/seed/complementos.json.gz');
if (createHash('sha256').update(seedComp).digest('hex') !== manComp.seed_sha256) throw Error('Seed complementar com hash divergente');
const comp = JSON.parse(gunzipSync(seedComp));
const gold = JSON.parse(read('public/eficiencia/seguranca-alimentar/complementos.json'));
if (gold.versao !== comp.versao || gold.manifesto.seed_sha256 !== manComp.seed_sha256) {
  throw Error('Gold complementar de outro seed: rode python3 -m pipeline.eficiencia_alimentar.complementos');
}
const muni = new Map(comp.municipios.map(([codigo, nome, uf]) => [codigo, { codigo, nome, uf }]));
if (muni.size < 5570 || comp.cadinsan.length !== 5570) throw Error('Cobertura complementar inválida');
const cadMun = new Map(comp.cadinsan.map((r) => [r[0], r.slice(1, 6)]));
const paaMun = Object.fromEntries(Object.entries(comp.paa).map(([ano, rows]) => [ano, new Map(rows.map((r) => [r[0], [r[1], r[2]]]))]));
const pnaeMun = new Map(comp.pnae.municipal_2025.map((r) => [r[0], r.slice(1)]));
const extras = new Map();
for (const uf of new Set([...muni.values()].map((m) => m.uf))) {
  const linhas = [...muni.values()]
    .filter((m) => m.uf === uf)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((m) => ({
      codigo: m.codigo,
      nome: m.nome,
      cadinsan: cadMun.get(m.codigo) ?? null,
      paa: Object.fromEntries(Object.entries(paaMun).map(([ano, mapa]) => [ano, mapa.get(m.codigo) ?? null])),
      pnae2025: pnaeMun.get(m.codigo) ?? null,
    }));
  extras.set(`complementos-uf-${uf}.json`, JSON.stringify(linhas));
}
const porUf = Object.fromEntries(gold.ufs.map((u) => [u.sigla, u]));
const camposCad = ['com_pbf', 'sem_pbf', 'cadastros', 'pct_com_pbf', 'pct_sem_pbf'];
const fonteCad = 'MDS CadINSAN 2025, anexo municipal';
extras.set('ebia-territorios.csv', csv(
  ['nivel', 'codigo_ibge', 'territorio', 'ano', 'situacao_domicilio', 'classe_ebia', 'percentual_domicilios', 'cv_percentual', 'mil_domicilios', 'cv_mil_domicilios', 'estado', 'fonte'],
  gold.ebia.flatMap((e) => Object.entries(e.classes).map(([classe, v]) => [e.nivel, e.codigo, e.territorio, e.ano, e.situacao, classe, v.pct, v.cv_pct, v.mil_domicilios, v.cv_domicilios, 'publicado', 'IBGE SIDRA 9552'])),
));
extras.set('cadinsan.csv', csv(
  ['nivel', 'codigo_ibge', 'territorio', 'uf', 'familias_risco_com_pbf', 'familias_risco_sem_pbf', 'familias_analisadas', 'pct_com_pbf', 'pct_sem_pbf', 'estado', 'pagina_pdf', 'fonte'],
  [
    ['brasil', '1', 'Brasil', '', ...camposCad.map((k) => gold.cadinsan.brasil[k]), 'calculado: soma do anexo municipal', '', fonteCad],
    ...gold.ufs.map((u) => ['uf', u.codigo, u.nome, u.sigla, ...camposCad.map((k) => gold.cadinsan.ufs[u.sigla][k]), 'calculado: soma do anexo municipal', '', fonteCad]),
    ...comp.cadinsan.map((r) => ['municipio', r[0], muni.get(r[0]).nome, muni.get(r[0]).uf, ...r.slice(1, 6), 'publicado', r[6], fonteCad]),
  ],
));
extras.set('paa.csv', csv(
  ['ano', 'nivel', 'codigo_ibge', 'territorio', 'uf', 'fornecedores', 'pagamentos_rs_nominais', 'municipios_com_dado', 'municipios_universo', 'estado', 'fonte'],
  Object.entries(comp.paa).flatMap(([ano, rows]) => [
    ...[{ nivel: 'brasil', codigo: '1', nome: 'Brasil', sigla: '', a: gold.paa[ano].brasil },
      ...gold.ufs.map((u) => ({ nivel: 'uf', codigo: u.codigo, nome: u.nome, sigla: u.sigla, a: gold.paa[ano].ufs[u.sigla] }))]
      .map(({ nivel, codigo, nome, sigla, a }) => [ano, nivel, codigo, nome, sigla, a.fornecedores.soma, a.pagamentos.soma, a.fornecedores.municipios_com_dado, a.municipios_universo, 'calculado: soma dos municípios com dado', 'MDS MI Social']),
    ...rows.map((r) => [ano, 'municipio', r[0], muni.get(r[0]).nome, muni.get(r[0]).uf, r[1], r[2], '', '', r[1] === null && r[2] === null ? 'sem dado no extrato' : 'publicado', 'MDS MI Social']),
  ]),
));
extras.set('pnae.csv', csv(
  ['ano', 'nivel', 'codigo_ibge', 'territorio', 'rede', 'entidades', 'entidades_com_repasse', 'alunos', 'escolas', 'repasse_rs_nominais', 'estado', 'fonte'],
  [
    ...gold.pnae.linhas.map((l) => [l.ano, l.territorio === 'BR' ? 'brasil' : 'uf', l.territorio === 'BR' ? '1' : porUf[l.territorio].codigo, l.territorio === 'BR' ? 'Brasil' : porUf[l.territorio].nome, l.rede, l.entidades, l.entidades_com_repasse, l.alunos, l.escolas, l.repasse, l.ano === 2026 ? 'calculado; exercício em curso' : 'calculado', 'FNDE PNAE, produto 82']),
    ...comp.pnae.municipal_2025.map((r) => [2025, 'municipio', r[0], `${muni.get(r[0]).nome} (${muni.get(r[0]).uf})`, 'municipal', 1, r[3] === null ? 0 : 1, r[1], r[2], r[3], 'publicado', 'FNDE PNAE, produto 82']),
  ],
));
extras.set('ipca-alimentacao.csv', csv(['medida', 'categoria', 'periodo', 'variacao_pct', 'estado', 'fonte'], gold.ipca.map((x) => [x.medida, x.categoria, x.periodo, x.valor, 'publicado', 'IBGE IPCA, tabela 7060'])));
extras.set('sisvan.csv', csv(['fase_da_vida', 'individuos_avaliados', 'cobertura_pct', 'periodo', 'estado', 'fonte'], gold.sisvan.map((s) => [s.fase, s.avaliados, s.cobertura, '2025 preliminar', 'publicado', 'MS Relatório de Gestão Integrado 2025, tabela 10'])));
for (const [name, body] of extras) { const temp = new URL(name + '.tmp', out); writeFileSync(temp, body); renameSync(temp, new URL(name, out)); }
console.log(`Segurança alimentar, bases complementares: ${muni.size} municípios em arquivos por UF e seis CSV materializados.`);
