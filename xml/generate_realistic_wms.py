import os
import random
import csv
from datetime import datetime, timedelta

path = "/home/leonamramosfoli/wms-teste/docs/xml/samples"
os.makedirs(path, exist_ok=True)

products = [
    {"name": "Arroz Integral 5kg", "shelf_life": 365},
    {"name": "Feijão Carioca 1kg", "shelf_life": 180},
    {"name": "Açúcar Refinado 1kg", "shelf_life": 730},
    {"name": "Óleo de Soja 900ml", "shelf_life": 365},
    {"name": "Leite Integral 1L", "shelf_life": 120},
    {"name": "Iogurte Natural 200ml", "shelf_life": 30},
    {"name": "Pão de Forma 500g", "shelf_life": 10},
    {"name": "Suco de Uva 1L", "shelf_life": 240}
]

suppliers = ["12345678000101", "23456789000102", "34567890000103"]

recebimentos = []

for i in range(1, 2401):
    prod = random.choice(products)
    # Data de Emissão (NF)
    dt_emissao = datetime(2025, 1, 1) + timedelta(seconds=random.randint(0, 31536000))
    # Data de Entrada (Bipagem no WMS) - 1 a 3 dias depois
    dt_entrada = dt_emissao + timedelta(days=random.randint(1, 3), hours=random.randint(0, 8))
    
    nNF = 10000 + i
    filename = f"nfe_entrada_{i}.xml"
    
    # Decide se terá tag rastro (50% de chance)
    tem_rastro = random.random() > 0.5
    rastro_xml = ""
    if tem_rastro:
        dt_val = dt_emissao + timedelta(days=prod['shelf_life'])
        rastro_xml = f"""
                    <rastro>
                        <nLote>LOT{random.randint(100,999)}</nLote>
                        <qLote>100.0000</qLote>
                        <dFab>{dt_emissao.strftime('%Y-%m-%d')}</dFab>
                        <dVal>{dt_val.strftime('%Y-%m-%d')}</dVal>
                    </rastro>"""

    xml_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
    <NFe>
        <infNFe Id="NFe{random.randint(10**43, 10**44-1)}" versao="4.00">
            <ide>
                <cUF>35</cUF>
                <nNF>{nNF}</nNF>
                <dhEmi>{dt_emissao.isoformat()}-03:00</dhEmi>
                <mod>55</mod>
            </ide>
            <emit><CNPJ>{random.choice(suppliers)}</CNPJ><xNome>DOCA FORNECEDORA</xNome></emit>
            <det nItem="1">
                <prod>
                    <cProd>SKU{random.randint(100,999)}</cProd>
                    <xProd>{prod['name']}</xProd>
                    <qCom>50.0000</qCom>
                    <uCom>UN</uCom>{rastro_xml}
                </prod>
            </det>
        </infNFe>
    </NFe>
</nfeProc>"""
    
    with open(os.path.join(path, filename), 'w') as f:
        f.write(xml_content)
    
    recebimentos.append([filename, nNF, prod['name'], dt_emissao.strftime('%Y-%m-%d %H:%M'), dt_entrada.strftime('%Y-%m-%d %H:%M'), "SIM" if tem_rastro else "NÃO"])

# Salva o cronograma para conferência do usuário
with open("/home/leonamramosfoli/wms-teste/docs/xml/cronograma_recebimento.csv", "w", newline='') as f:
    writer = csv.writer(f)
    writer.writerow(["Arquivo", "Numero_NF", "Produto", "Data_Emissao_NF", "Data_Entrada_WMS_SIMULADA", "Tem_Tag_Rastro"])
    writer.writerows(recebimentos)

print("2400 XMLs e Cronograma de Recebimento gerados.")
