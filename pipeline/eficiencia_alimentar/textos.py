"""Human-readable source notes only: never changes observations, identifiers, formulas or URLs."""
import re
KEYS={'nome','universo','limitacao','limitacoes','transformacoes','notas','periodoNome','nota','perimetro'}
def normalize_text(s):
 s=re.sub(r'([A-Za-zÀ-ÿ])(?=\d)',r'\1 ',s)
 s=re.sub(r'(\d)(?=[A-Za-zÀ-ÿ])',r'\1 ',s)
 s=s.replace('sem PBFnão','sem PBF não').replace('páginaPDF','página PDF')
 return s
def normalizar_textos(obj):
 if isinstance(obj,dict):
  for k,v in obj.items():
   if k in KEYS and isinstance(v,str):obj[k]=normalize_text(v)
   elif k in KEYS and isinstance(v,list):obj[k]=[normalize_text(x) if isinstance(x,str) else x for x in v]
   else:normalizar_textos(v)
 elif isinstance(obj,list):
  for item in obj:normalizar_textos(item)
 return obj
