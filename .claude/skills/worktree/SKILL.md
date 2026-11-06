---
name: worktree
description: Crea un git worktree aislado en .trees/[nombre] y ejecuta ahí, de forma independiente del código principal, las instrucciones recibidas. Úsala siempre que el usuario invoque /worktree o pida trabajar en un worktree, en una copia aislada del repo, o implementar algo "aparte" sin tocar el código principal (por ejemplo "hazlo en un worktree", "prueba esto aislado", "trabaja en paralelo en otra carpeta").
---

# /worktree

Ejecuta un requerimiento dentro de un worktree de git aislado, para que el árbol de trabajo principal quede intacto.

Los argumentos de la invocación son el **requerimiento**: lo que hay que implementar o ejecutar dentro del worktree.

## Pasos

1. **Elegir el nombre.** Deriva un nombre corto en kebab-case (minúsculas, sin tildes ni espacios, 2–4 palabras) a partir del requerimiento, p. ej. "agregar sonido al hacer hard drop" → `sonido-hard-drop`. Si `.trees/<nombre>` ya existe, añade un sufijo (`-2`) en vez de reutilizarlo, porque puede contener trabajo de otra tarea.

2. **Asegurar que `.trees/` no ensucie el repo.** Si `.trees/` no aparece en `.gitignore`, agrégalo (el worktree vive dentro del repo y de lo contrario aparecería como archivos sin seguimiento).

3. **Crear el worktree** desde la raíz del repo, exactamente así:

   ```bash
   git worktree add .trees/<nombre>
   ```

   Esto crea también una rama llamada `<nombre>` a partir de HEAD. Si falla (p. ej. la rama ya existe), explica el error y elige otro nombre; no uses `--force`.

4. **Ejecutar el requerimiento solo dentro del worktree.** Lanza un subagente (Agent, `general-purpose`) cuyo prompt incluya:
   - la ruta absoluta del worktree (`<raíz>/.trees/<nombre>`),
   - el requerimiento completo, literal,
   - la regla de que **todas** las lecturas, ediciones y comandos usan rutas dentro de esa carpeta y que no debe tocar el árbol principal (otro lugar de la ruta absoluta = otro checkout, y los cambios se mezclarían),
   - que respete el CLAUDE.md del proyecto (existe también dentro del worktree),
   - que haga commit en la rama del worktree al terminar solo si el requerimiento lo pide, y que reporte qué cambió.

   Si el requerimiento es trivial y no justifica un subagente, puedes trabajar tú mismo, pero siempre con rutas absolutas dentro del worktree.

5. **Reportar** al usuario: nombre y ruta del worktree, rama creada, resumen de lo hecho y cómo continuar:
   - revisar/probar: `cd .trees/<nombre>`
   - integrar: merge o PR de la rama `<nombre>`
   - limpiar: `git worktree remove .trees/<nombre>` (y `git branch -d <nombre>`)

   No elimines el worktree por tu cuenta: el usuario puede querer revisarlo.

## Notas

- Si no hay requerimiento (invocación sin argumentos), pregunta qué ejecutar antes de crear nada.
- Este proyecto no tiene dependencias ni build: el worktree se prueba abriendo su `index.html`.
