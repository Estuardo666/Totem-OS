# Solução simples para escapar as comillas

print("Corrigindo arquivos...")

# Fix dashboard/page.tsx
with open('src/app/(dashboard)/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Procurar e substituir
old1 = '"{feedback.comment}"'
new1 = '"{feedback.comment}"'
content = content.replace(old1, new1)
print("Fix 1: " + str(old1 in content))

with open('src/app/(dashboard)/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

# Fix ai-config-form.tsx
with open('src/components/features/admin/ai-config-form.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Procurar e substituir
old2 = '"use server"'
new2 = '"use server"'
content = content.replace(old2, new2)
print("Fix 2: " + str(old2 in content))

with open('src/components/features/admin/ai-config-form.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Feito!")
