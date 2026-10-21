// Executar da raiz: node docs/obee/calibracao/verificar-laboratorio.cjs
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('docs/obee/calibracao/laboratorio-interativo.html','utf8');
const fixture=JSON.parse(fs.readFileSync('docs/obee/calibracao/hierarquia-sintetica.json','utf8'));
const context=vm.createContext({});
vm.runInContext(html.match(/<script id="model">([\s\S]*?)<\/script>/)[1],context);
const run=code=>vm.runInContext(code,context);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
run('var a=[95,50,70,70,70].map(v=>[v,v,v]),b=Array.from({length:5},()=>[70,70,70]);');
near(run('calculate(a).value'),fixture.baseline.a.aggregate.value);
near(run('calculate(b).value'),fixture.baseline.b.aggregate.value);
const scenarios=run('sensitivity(a,b)');assert.equal(scenarios.length,16);
scenarios.forEach((s,i)=>{const expected=fixture.scenarios[i];near(s.a,expected.a.aggregate.value);near(s.b,expected.b.aggregate.value);assert.equal(s.flip,expected.order_reversal);});
assert.equal(scenarios.filter(s=>s.flip).length,2);
run('a[0][0]=null');assert.equal(run('calculate(a).value'),null);assert.ok(run('sensitivity(a,b).every(s=>s.relation==="incomparavel")'));
run('a[0][0]=0');assert.equal(run('calculate(a).value'),0);assert.equal(run('relation(70,70)'), 'empate');
console.log('OK: referência e 16 cenários equivalentes ao Python; ausência, zero e empate preservados.');
