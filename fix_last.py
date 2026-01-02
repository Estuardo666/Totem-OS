# Correção final - usar o conteúdo exato

# Dashboard
lines = open('src/app/(dashboard)/page.tsx', 'r', encoding='utf-8').readlines()
# Linha 358 (índice 357)
lines[357] = '                        "{feedback.comment}"\n'
open('src/app/(dashboard)/page.tsx', 'w', encoding='utf-8').writelines(lines)
print("Dashboard fixado!")

# AI Config
lines = open('src/components/features/admin/ai-config-form.tsx', 'r', encoding='utf-8').readlines()
# Linha 301 (índice 300)
lines[300] = '                  <p className="text-xs text-muted-foreground"><strong>Seguridad:</strong> Las API Keys se almacenan de forma segura en el servidor y solo se usan dentro de funciones "use server". Nunca se utilizan directamente en el navegador para hacer llamadas a APIs externas.</p>\n'
open('src/components/features/admin/ai-config-form.tsx', 'w', encoding='utf-8').writelines(lines)
print("AI Config fixado!")

print("Feito! Agora rodando lint...")
