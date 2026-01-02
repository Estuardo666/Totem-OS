import re

# Corrigir dashboard/page.tsx
with open('src/app/(dashboard)/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Substituir as comillas com "
new_content = content.replace('"{feedback.comment}"', '"{feedback.comment}"')
print(f"Substituiu: {content != new_content}")

with open('src/app/(dashboard)/page.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

# Verificar
with open('src/app/(dashboard)/page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    print(f"Linha 358: {repr(lines[357])}")

# Corrigir ai-config-form.tsx
with open('src/components/features/admin/ai-config-form.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Substituir as comillas com "
new_content = content.replace('"use server"', '"use server"')
print(f"Substituiu ai-config: {content != new_content}")

with open('src/components/features/admin/ai-config-form.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

# Verificar
with open('src/components/features/admin/ai-config-form.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    print(f"Linha 301: {repr(lines[300])}")

print("Concluído!")
