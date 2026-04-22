import os
import random
from datetime import datetime, timedelta

path = "/home/leonamramosfoli/wms-teste/docs/xml/samples"
products = [
    "Arroz Integral 5kg", "Feijão Carioca 1kg", "Açúcar Refinado 1kg", "Óleo de Soja 900ml",
    "Café Torrado 500g", "Macarrão Espaguete 500g", "Leite Integral 1L", "Detergente 500ml",
    "Sabão em Pó 1kg", "Papel Higiênico 12un", "Shampoo 400ml", "Sabonete 90g",
    "Creme Dental 90g", "Desinfetante 1L", "Água Sanitária 2L", "Esponja de Aço 3un",
    "Biscoito Recheado 140g", "Suco de Uva 1L", "Achocolatado 400g", "Farinha de Trigo 1kg"
]
suppliers = [
    "12345678000101", "23456789000102", "34567890000103", "45678901000104", "56789012000105",
    "67890123000106", "78901234000107", "89012345000108", "90123456000109", "01234567000100"
]

def random_date(year):
    start = datetime(year, 1, 1)
    end = datetime(year, 12, 31)
    return start + timedelta(seconds=random.randint(0, int((end - start).total_seconds())))

files = [f for f in os.listdir(path) if f.endswith('.xml')]
for i, filename in enumerate(files):
    file_path = os.path.join(path, filename)
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Injeta data de 2025
    new_date = random_date(2025).isoformat() + "-03:00"
    content = content.replace("<dhEmi>", f"<dhEmi_OLD>").replace("</dhEmi>", "</dhEmi_OLD>") # Placeholder
    import re
    content = re.sub(r"<dhEmi_OLD>.*?</dhEmi_OLD>", f"<dhEmi>{new_date}</dhEmi>", content)
    
    # Injeta fornecedor fixo
    new_cnpj = random.choice(suppliers)
    content = re.sub(r"<emit>.*?<CNPJ>.*?</CNPJ>", f"<emit><CNPJ>{new_cnpj}</CNPJ>", content, flags=re.DOTALL)
    
    # Injeta produto repetido
    new_prod = random.choice(products)
    content = re.sub(r"<xProd>.*?</xProd>", f"<xProd>{new_prod}</xProd>", content)

    with open(file_path, 'w') as f:
        f.write(content)
