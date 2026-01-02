#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import codecs
import re

def fix_file(filepath, line_number, search_pattern, replace_with):
    """Corrige entidades não escapadas em uma linha específica"""
    
    # Ler o arquivo com codificação UTF-8
    with codecs.open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    if line_number <= len(lines):
        idx = line_number - 1
        original = lines[idx]
        
        # Verificar se o padrão existe
        if search_pattern in original:
            # Substituir
            new_line = original.replace(search_pattern, replace_with)
            lines[idx] = new_line
            print(f"✓ Corrigido {filepath}:{line_number}")
            print(f"  De: {original.strip()}")
            print(f"  Para: {new_line.strip()}")
            
            # Escrever de volta com UTF-8
            with codecs.open(filepath, 'w', encoding='utf-8') as f:
                f.writelines(lines)
            return True
        else:
            print(f"⚠ Padrão não encontrado em {filepath}:{line_number}")
            print(f"  Conteúdo atual: {original.strip()}")
            return False
    else:
        print(f"❌ Linha {line_number} não existe em {filepath}")
        return False

# Fix dashboard/page.tsx
fix_file(
    'src/app/(dashboard)/page.tsx',
    358,
    '"{feedback.comment}"',
    '"{feedback.comment}"'
)

# Fix ai-config-form.tsx
fix_file(
    'src/components/features/admin/ai-config-form.tsx',
    301,
    '"use server"',
    '"use server"'
)

print("\nConcluído!")
