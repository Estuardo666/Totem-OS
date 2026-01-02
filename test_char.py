import sys

# Testar qual caractere está sendo usado
line = '                        "{feedback.comment}"'
print("Linha:", repr(line))
print("Char 26:", repr(line[26]), "code:", ord(line[26]))
print("Char 27:", repr(line[27]), "code:", ord(line[27]))
print("Char 43:", repr(line[43]), "code:", ord(line[43]))

# Tentar substituir usando código
char_quote = chr(34)
print("\nChar de aspa (34):", repr(char_quote))

if char_quote in line:
    print("A aspa está na linha")
    new = line.replace(char_quote, '"')
    print("Substituído:", repr(new))
else:
    print("A aspa NÃO está na linha")
