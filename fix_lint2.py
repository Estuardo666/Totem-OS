import re

# Corrigir dashboard/page.tsx
with open('src/app/(dashboard)/page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Linha 358 (índice 357) tem as comillas que precisam ser escapadas
# Substituir a linha exata
for i, line in enumerate(lines):
    if i == 357 and '"{feedback.comment}"' in line:
        lines[i] = line.replace('"{feedback.comment}"', '"{feedback.comment}"')
        print(f"Substituída linha {i+1}")

with open('src/app/(dashboard)/page.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

# Corrigir ai-config-form.tsx
with open('src/components/features/admin/ai-config-form.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Linha 301 (índice 300) tem as comillas que precisam ser escapadas
for i, line in enumerate(lines):
    if i == 300 and '"use server"' in line:
        lines[i] = line.replace('"use server"', '"use server"')
        print(f"Substituída linha {i+1} em ai-config-form")

with open('src/components/features/admin/ai-config-form.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Concluído!")
