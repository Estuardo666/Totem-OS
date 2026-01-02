#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import html

# Corrigir dashboard/page.tsx
with open('src/app/(dashboard)/page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Encontrar a linha 358 (índice 357) e usar html.escape
# Primeiro, remover apenas as comillas que precisam ser escapadas
for i, line in enumerate(lines):
    if i == 357 and '"{feedback.comment}"' in line:
        # Substituir as comillas duplas por " dentro do conteúdo
        lines[i] = line.replace('"{feedback.comment}"', '"{feedback.comment}"')
        print(f"Linha 358 alterada")

with open('src/app/(dashboard)/page.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

# Corrigir ai-config-form.tsx
with open('src/components/features/admin/ai-config-form.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if i == 300 and '"use server"' in line:
        # Substituir as comillas duplas por " dentro do conteúdo
        lines[i] = line.replace('"use server"', '"use server"')
        print(f"Linha 301 alterada")

with open('src/components/features/admin/ai-config-form.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Feito!")
