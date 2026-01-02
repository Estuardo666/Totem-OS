import re

# Corrigir dashboard/page.tsx
with open('src/app/(dashboard)/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Substituir as comillas com "
content = content.replace('"{feedback.comment}"', '"{feedback.comment}"')

with open('src/app/(dashboard)/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

# Corrigir ai-config-form.tsx
with open('src/components/features/admin/ai-config-form.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Substituir as comillas com "
content = content.replace('"use server"', '"use server"')

with open('src/components/features/admin/ai-config-form.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Concluído!")
