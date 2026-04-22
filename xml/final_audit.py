import os
import xml.etree.ElementTree as ET
from datetime import datetime

path = "/home/leonamramosfoli/wms-teste/docs/xml/samples"
ns = {'n': 'http://www.portalfiscal.inf.br/nfe'}

cnpjs = set()
dates = []
products = set()
ids = set()
errors = []

files = [f for f in os.listdir(path) if f.endswith('.xml')]

for f in files:
    try:
        tree = ET.parse(os.path.join(path, f))
        root = tree.getroot()
        
        # CNPJ Emitente
        cnpj = root.find('.//n:emit/n:CNPJ', ns)
        if cnpj is not None: cnpjs.add(cnpj.text)
        else: errors.append(f"{f}: CNPJ emitente não encontrado")
        
        # Data Emissão
        data = root.find('.//n:ide/n:dhEmi', ns)
        if data is not None:
            dates.append(datetime.fromisoformat(data.text.replace("-03:00", "")))
        
        # Produtos
        for p in root.findall('.//n:det/n:prod/n:xProd', ns):
            products.add(p.text)
            
        # Chave de Acesso (ID)
        infNFe = root.find('.//n:infNFe', ns)
        if infNFe is not None:
            ids.add(infNFe.get('Id'))
            
    except Exception as e:
        errors.append(f"{f}: Erro de parse - {str(e)}")

print(f"--- RELATÓRIO DE AUDITORIA ---")
print(f"Total de arquivos: {len(files)}")
print(f"Erros encontrados: {len(errors)}")
if errors: print(f"Primeiros erros: {errors[:5]}")
print(f"CNPJs únicos (Fornecedores): {len(cnpjs)}")
print(f"Produtos únicos (SKUs): {len(products)}")
print(f"Chaves únicas (IDs): {len(ids)}")
if dates:
    print(f"Período: {min(dates).strftime('%d/%m/%Y')} até {max(dates).strftime('%d/%m/%Y')}")
