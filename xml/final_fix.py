import os
import random
import subprocess
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

path = "/home/leonamramosfoli/wms-teste/docs/xml/samples"
os.makedirs(path, exist_ok=True)
products = ["Arroz Integral 5kg", "Feijão Carioca 1kg", "Açúcar Refinado 1kg", "Óleo de Soja 900ml", "Café Torrado 500g", "Macarrão Espaguete 500g", "Leite Integral 1L", "Detergente 500ml", "Sabão em Pó 1kg", "Papel Higiênico 12un", "Shampoo 400ml", "Sabonete 90g", "Creme Dental 90g", "Desinfetante 1L", "Água Sanitária 2L", "Esponja de Aço 3un", "Biscoito Recheado 140g", "Suco de Uva 1L", "Achocolatado 400g", "Farinha de Trigo 1kg"]
suppliers = ["12345678000101", "23456789000102", "34567890000103", "45678901000104", "56789012000105", "67890123000106", "78901234000107", "89012345000108", "90123456000109", "01234567000100"]

ns = {'nfe': 'http://www.portalfiscal.inf.br/nfe'}

def random_date(year):
    start = datetime(year, 1, 1)
    end = datetime(year, 12, 31)
    return (start + timedelta(seconds=random.randint(0, int((end - start).total_seconds())))).isoformat() + "-03:00"

def fix_xml(xml_bytes):
    # Remove qualquer lixo antes do <?xml ou do <nfeProc
    content = xml_bytes.decode('utf-8', errors='ignore')
    start_idx = content.find('<nfeProc')
    if start_idx == -1: start_idx = content.find('<NFe')
    if start_idx == -1: return None
    
    clean_xml = content[start_idx:]
    # Tenta parsear
    root = ET.fromstring(clean_xml)
    
    # Ajustes
    ide = root.find('.//nfe:ide', ns)
    if ide is not None:
        dhEmi = ide.find('nfe:dhEmi', ns)
        if dhEmi is not None: dhEmi.text = random_date(2025)
    
    emit = root.find('.//nfe:emit', ns)
    if emit is not None:
        cnpj = emit.find('nfe:CNPJ', ns)
        if cnpj is not None: cnpj.text = random.choice(suppliers)
        
    for det in root.findall('.//nfe:det', ns):
        prod = det.find('nfe:prod', ns)
        if prod is not None:
            xProd = prod.find('nfe:xProd', ns)
            if xProd is not None: xProd.text = random.choice(products)
    
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)

count = 0
while count < 2400:
    try:
        proc = subprocess.run(["/home/leonamramosfoli/go/bin/brfiscalfaker", "--type", "NFe"], capture_output=True)
        fixed = fix_xml(proc.stdout)
        if fixed:
            count += 1
            with open(os.path.join(path, f"nfe_entrada_{count}.xml"), 'wb') as f:
                f.write(fixed)
    except:
        continue

print(f"Finalizado: {count} arquivos.")
