# Script para escapar comillas en archivos específicos usando código HTML entity

# Arquivo 1: dashboard/page.tsx
with open('src/app/(dashboard)/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Substituir as comillas na linha 358
# A linha atual tem: "{feedback.comment}"
# Precisamos substituir por: "{feedback.comment}"
old_text = '"{feedback.comment}"'
new_text = '"{feedback.comment}"'
content = content.replace(old_text, new_text)

with open('src/app/(dashboard)/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Arquivo 1 corrigido!")

# Arquivo 2: ai-config-form.tsx
with open('src/components/features/admin/ai-config-form.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Substituir as comillas na linha 301
# A linha atual tem: "...funciones "use server"..."
# Precisamos substituir por: "...funciones "use server"..."
old_text = '"use server"'
new_text = '"use server"'
content = content.replace(old_text, new_text)

with open('src/components/features/admin/ai-config-form.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Arquivo 2 corrigido!")
print("Concluído!")