import sys

# Debug dashboard/page.tsx
print("=== DEBUG dashboard/page.tsx ===")
lines = open('src/app/(dashboard)/page.tsx', 'r', encoding='utf-8').readlines()
line = lines[357]
print(f"Linha 358: {repr(line)}")
print(f"Bytes: {[hex(ord(c)) for c in line]}")

# Verificar se tem as aspas que queremos
if '"' in line and '{feedback.comment}' in line:
    print("Tem as aspas e o template string")
    # Substituir usando unicode escape
    new_line = line.replace('"', '"')
    print(f"Depois do replace: {repr(new_line)}")
    lines[357] = new_line
    with open('src/app/(dashboard)/page.tsx', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Escrito!")
else:
    print("Não tem o padrão esperado")

# Debug ai-config-form.tsx
print("\n=== DEBUG ai-config-form.tsx ===")
lines = open('src/components/features/admin/ai-config-form.tsx', 'r', encoding='utf-8').readlines()
line = lines[300]
print(f"Linha 301: {repr(line[:100])}")
print(f"Has 'use server': {'use server' in line}")

if '"use server"' in line:
    new_line = line.replace('"use server"', '"use server"')
    print(f"Depois: {repr(new_line[:100])}")
    lines[300] = new_line
    with open('src/components/features/admin/ai-config-form.tsx', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Escrito!")

print("\n=== FEITO ===")
