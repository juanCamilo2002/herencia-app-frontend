# Formato del código frontend

El frontend utiliza Prettier con la configuración existente en `.prettierrc`:

- Indentación de dos espacios.
- Comillas simples en TypeScript.
- Ancho objetivo de 100 caracteres.
- Parser Angular para las plantillas HTML.
- Finales de línea LF y salto final de archivo.

Desde `frontend/`:

```powershell
npm run format
npm run format:check
```

Los comandos incluyen TypeScript, HTML, SCSS y JSON de `src/`, además de las
configuraciones TypeScript/JSON/JSONC de la raíz y `.prettierrc`.
`.prettierignore` excluye dependencias, compilados, caché de Angular y cobertura.

Prettier organiza el formato, no aplica reglas de lint ni cambia automáticamente la lógica
o el orden de imports de TypeScript. Usar la configuración del proyecto también al guardar desde el editor.
