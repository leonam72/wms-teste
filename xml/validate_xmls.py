import os
import re
from datetime import datetime

path = "/home/leonamramosfoli/wms-teste/docs/xml/samples"
files = [f for f in os.listdir(path) if f.endswith('.xml')]

errors = []
dates = []
products = set()
cnpjs = set()
total_files = len(files)

for filename in files:
    with open(os.path.join(path, filename), 'r') as f:
        content = f.read()
    
    # Validação básica de fechamento de tags (Well-formedness simples)
    if not content.startswith("<?xml") or not content.strip().endswith("</nfeProc>"):
        errors.append(f"{filename}: XML mal formado ou incompleto")
        continue

    # Extração para estatísticas
    date_match = re.search(r"<dhEmi>(.*?)</dhEmi>", content)
    prod_match = re.search(r"<xProd>(.*?)</xProd>", content)
    cnpj_match = re.search(r"<emit><CNPJ>(.*?)</CNPJ>", content)

    if date_match:
        try:
            dt = datetime.fromisoformat(date_match.group(1).replace("-03:00", ""))
            dates.append(dt)
        except:
            errors.append(f"{filename}: Data inválida {date_match.group(1)}")
    
    if prod_match: products.add(prod_match.group(1))
    if cnpj_match: cnpjs.add(cnpj_match.group(1))

if errors:
    print("ERROS ENCONTRADOS:")
    for err in errors[:10]: print(err)
else:
    print(f"Validação concluída para {total_files} arquivos.")
    if dates:
        print(f"Intervalo de datas: {min(dates)} até {max(dates)}")
    print(f"Produtos únicos: {len(products)}")
    print(f"CNPJs de emitentes únicos: {len(cnpjs)}")
