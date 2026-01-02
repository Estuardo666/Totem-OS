import codecs

# Escrever dashboard/page.tsx - linha 358 escapada
with codecs.open('src/app/(dashboard)/page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Construir a linha com entidades HTML usando " (código decimal para ")
# ou " (entidade HTML)
lines[357] = '                        "{feedback.comment}"\n'

with codecs.open('src/app/(dashboard)/page.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"Dashboard linha 358: {repr(lines[357])}")

# Escrever ai-config-form.tsx - linha 301 escapada
with codecs.open('src/components/features/admin/ai-config-form.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Linha 301 com entidade HTML
lines[300] = '                  <p className="text-xs text-muted-foreground"><strong>Seguridad:</strong> Las API Keys se almacenan de forma segura en el servidor y solo se usan dentro de funciones "use server". Nunca se utilizan directamente en el navegador para hacer llamadas a APIs externas.</p>\n'

with codecs.open('src/components/features/admin/ai-config-form.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"AI Config linha 301: {repr(lines[300][:80])}")

print("Concluído!")
