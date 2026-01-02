# Codificar as entidades HTML diretamente usando
# " que é o equivalente HTML para "

print("Fixing files...")

# Dashboard
with open('src/app/(dashboard)/page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Linha 358: usar " no código Python para gerar aspas HTML
old = lines[357]
# Construir a nova linha com CÓDIGO HTML
lines[357] = '                        "{feedback.comment}"\n'
# Agora substituir as aspas reais usando replace
lines[357] = lines[357].replace('"', '"')

with open('src/app/(dashboard)/page.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"Linha 358 corrigida: {repr(lines[357])}")

# AI Config
with open('src/components/features/admin/ai-config-form.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

old = lines[300]
lines[300] = '                  <p className="text-xs text-muted-foreground"><strong>Seguridad:</strong> Las API Keys se almacenan de forma segura en el servidor y solo se usan dentro de funciones "use server". Nunca se utilizan directamente en el navegador para hacer llamadas a APIs externas.</p>\n'
lines[300] = lines[300].replace('"use server"', '"use server"')

with open('src/components/features/admin/ai-config-form.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"Linha 301 corrigida: {repr(lines[300])}")
print("Concluído!")
