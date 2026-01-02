import re

# Corrigir dashboard/page.tsx
with open('src/app/(dashboard)/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Substituir usando o código HTML entity
old_text = '"{feedback.comment}"'
new_text = '"{feedback.comment}"'
content = content.replace(old_text, new_text)

with open('src/app/(dashboard)/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

# Corrigir ai-config-form.tsx
with open('src/components/features/admin/ai-config-form.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Substituir usando o código HTML entity
old_text = '"use server"'
new_text = '"use server"'
content = content.replace(old_text, new_text)

with open('src/components/features/admin/ai-config-form.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Concluído!")
