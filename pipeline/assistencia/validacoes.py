"""Gate do recorte: integridade, universos, estados e fichas antes da publicação."""
import collections,re
CAMPOS=('id','name','definition','universe','period','frequency','formula','numerator','denominator','unit','source','record','coverage','missing','breaks','score_role','reference','limitations','publication')

def valida(data,manifest):
 units=data['units'];monthly=data['monthly'];catalog=data['catalog']
 if dict(collections.Counter(u['kind'] for u in units))!=manifest['counts']:raise ValueError('Cobertura SUAS divergente')
 if len(set((u['kind'],u['id']) for u in units))!=len(units):raise ValueError('Unidade duplicada')
 if len(monthly)!=manifest['rma_rows'] or len(set((r[0],r[3]) for r in monthly))!=len(monthly):raise ValueError('RMA duplicado ou incompleto')
 if len({c['id'] for c in catalog})!=29:raise ValueError('Catálogo incompleto')
 for c in catalog:
  if any(k not in c for k in CAMPOS):raise ValueError('Ficha incompleta')
 uf=set(u['uf'] for u in units)
 if len(uf)!=27:raise ValueError('UF inválida')
 for u in units:
  if u['scope'] not in ('Regional','Estadual') and not re.fullmatch(r'\d{7}',u['code'] or ''):raise ValueError('Código local inválido')
  if u['scope'] in ('Regional','Estadual') and u['code'] is not None:raise ValueError('Rede não municipal com código inferido')
  for key,v in u['values'].items():
   if not any(c['id']==u['kind']+'.'+key for c in catalog):raise ValueError('Observação sem ficha')
   if v['status'] not in ('OBSERVADO','NAO_INFORMADO','NAO_APLICAVEL'):raise ValueError('Estado desconhecido')
   if (v['status']=='OBSERVADO')!=(v['value'] is not None):raise ValueError('Ausência com valor')
 for r in monthly:
  if len(r)!=12 or r[2] not in uf or not re.fullmatch(r'\d{7}',r[1]) or r[3] not in range(1,13):raise ValueError('Recorte RMA inválido')
  if any(v is not None and (not isinstance(v,int) or v<0) for v in r[4:]):raise ValueError('Contagem RMA inválida')
 return {'units':len(units),'rma':len(monthly),'catalog':len(catalog),'regional_creas':sum(u['kind']=='CREAS' and u['scope']=='Regional' for u in units),'state_day':sum(u['kind']=='DIA' and u['scope']=='Estadual' for u in units)}
