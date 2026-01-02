import re

# Ler arquivo
lines = []
with open('src/app/(dashboard)/page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Linha 358 tem o conteúdo abaixo
target = '{feedback.comment}' 
for i, line in enumerate(lines):
    if i == 357:
        # Encontrar as aspas e substituir
        if '"{feedback.comment}"' in line:
            lines[i] = line.replace('"{feedback.comment}"', '"{feedback.comment}"')

with open('src/app/(dashboard)/page.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

# AI Config
lines = []
with open('src/components/features/admin/ai-config-form.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if i == 300:
        if '"use server"' in line:
            lines[i] = line.replace('"use server"', '"use server"')

with open('src/components/features/admin/ai-config-form.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Correções aplicadas!")
