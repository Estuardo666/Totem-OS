import re

# Corrigir dashboard/page.tsx
with open('src/app/(dashboard)/page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Linha 358 (índice 357)
old_line = lines[357]
# Usar o caractere real de aspa dupla
new_line = old_line.replace('"{feedback.comment}"', '"{feedback.comment}"')
lines[357] = new_line

with open('src/app/(dashboard)/page.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

# Corrigir ai-config-form.tsx
with open('src/components/features/admin/ai-config-form.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Linha 301 (índice 300)
old_line = lines[300]
# Usar o caractere real de aspa dupla
new_line = old_line.replace('"use server"', '"use server"')
lines[300] = new_line

with open('src/components/features/admin/ai-config-form.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Concluído!")
