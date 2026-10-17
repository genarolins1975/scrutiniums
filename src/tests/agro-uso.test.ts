import {beforeEach,describe,expect,it,vi} from 'vitest';
const auth=vi.hoisted(()=>({user:null as {id:string}|null}));
const track=vi.hoisted(()=>vi.fn());
const limit=vi.hoisted(()=>vi.fn(()=>({allowed:true})));
vi.mock('@/lib/session',()=>({getSessionUser:vi.fn(async()=>auth.user)}));
vi.mock('@/lib/events',()=>({trackEvent:track}));
vi.mock('@/lib/ratelimit',()=>({checkRateLimit:limit,POLICIES:{viewsPerUser:{windowMs:60000,max:40}}}));
import {POST} from '@/app/api/agro/eventos/route';
function request(body:unknown,origin='https://scrutiniums.com'){return new Request('https://scrutiniums.com/api/agro/eventos',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});}
beforeEach(()=>{auth.user={id:'fixture-local'};track.mockReset();limit.mockReset();limit.mockReturnValue({allowed:true});});
describe('uso mínimo do Agro sem parâmetros ou identificação no evento',()=>{
 it('não grava visita anônima',async()=>{auth.user=null;expect((await POST(request({acao:'simulacao'}))).status).toBe(204);expect(track).not.toHaveBeenCalled();});
 it.each([['simulacao','agro_simulacao_calculada'],['download','agro_exportacao_solicitada'],['percurso','agro_percurso_trocado']])('aceita somente o tipo %s, sem userId',async(acao,nome)=>{expect((await POST(request({acao}))).status).toBe(204);expect(track).toHaveBeenCalledExactlyOnceWith(nome);});
 it('recusa valores financeiros e campos de identificação',async()=>{for(const extra of [{preco:100},{cpf:'fixture'},{userId:'alguem'},{parametros:{custo:2000}}])expect((await POST(request({acao:'simulacao',...extra}))).status).toBe(400);expect(track).not.toHaveBeenCalled();});
 it('recusa origem externa e nome arbitrário',async()=>{expect((await POST(request({acao:'download'},'https://outro.example'))).status).toBe(403);expect((await POST(request({acao:'evento-arbitrario'}))).status).toBe(400);expect(track).not.toHaveBeenCalled();});
 it('respeita o limite de uso sem gravar um evento recusado',async()=>{limit.mockReturnValue({allowed:false});expect((await POST(request({acao:'download'}))).status).toBe(429);expect(track).not.toHaveBeenCalled();});
});
