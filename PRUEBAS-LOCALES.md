ACADEMIA INDRHACK - GUÍA PARA PROBAR LOCALMENTE
================================================

Esta guía te ayudará a probar el proyecto en tu computadora antes 
de desplegarlo en GitHub Pages.


OPCIÓN 1: ABRIR DIRECTAMENTE (Simple)
=======================================

1. Descarga el proyecto
2. Ve a la carpeta academia-indrhack
3. Haz doble clic en index.html
4. Se abrirá en tu navegador por defecto

⚠️ Limitación: Algunos módulos (como Firebase) podrían tener 
restricciones de seguridad del navegador.


OPCIÓN 2: SERVIDOR LOCAL CON PYTHON (Recomendado)
===================================================

Python 3.x:
-----------
1. Abre terminal/cmd
2. Ve a la carpeta del proyecto:
   cd ruta/a/academia-indrhack

3. Inicia el servidor:
   python3 -m http.server 8000

4. Abre navegador:
   http://localhost:8000

5. Para detener: Presiona Ctrl+C

Python 2.x (antiguo):
---------------------
python -m SimpleHTTPServer 8000


OPCIÓN 3: SERVIDOR CON NODE.JS
===============================

1. Instala Node.js desde nodejs.org

2. Abre terminal en la carpeta del proyecto

3. Instala http-server globalmente:
   npm install -g http-server

4. Inicia el servidor:
   http-server

5. Abre navegador:
   http://localhost:8080

6. Para detener: Presiona Ctrl+C


OPCIÓN 4: VISUAL STUDIO CODE (VS Code)
=======================================

1. Instala VS Code desde code.visualstudio.com

2. Abre la carpeta academia-indrhack en VS Code

3. Instala extensión "Live Server":
   - Click en extensiones (Ctrl+Shift+X)
   - Busca "Live Server"
   - Instala de Ritwick Dey

4. Haz clic derecho en index.html

5. Selecciona "Open with Live Server"

6. Se abrirá automáticamente en http://localhost:5500


OPCIÓN 5: OTROS SERVIDORES
===========================

Con PHP:
--------
php -S localhost:8000

Con Ruby:
--------
ruby -run -ehttpd . -p8000

Con Docker:
----------
docker run -it --rm -p 8000:80 -v $(pwd):/usr/share/nginx/html nginx


VERIFICAR QUE FUNCIONA
======================

1. Página carga correctamente
2. Ver el logo "ACADEMIA INDRHACK"
3. Ver las partículas animadas en el fondo
4. Botones "INICIAR SESIÓN" y "REGISTRARTE"
5. Barra de navegación en la parte superior
6. Responsive: reduce tamaño del navegador
7. Sin errores en consola (F12)


ABRIR CONSOLA (Para debugging)
================================

Chrome/Edge:
- Presiona F12
- Click en "Console"

Firefox:
- Presiona F12
- Click en "Console"

Safari:
- Desarrollador → Show JavaScript Console

Qué ver:
- Mensaje: "🔐 ACADEMIA INDRHACK - Sistema Iniciado"
- Mensaje: "Inicializando ACADEMIA INDRHACK..."
- Ningún error en rojo


NAVEGAR EL PROYECTO
===================

Desde la página principal:

1. Haz clic en "INICIAR SESIÓN"
   → Irá a pages/login.html (no existe aún, error esperado)

2. Haz clic en "REGISTRARTE"
   → Irá a pages/register.html (no existe aún, error esperado)

3. Haz clic en "CURSOS" en la navbar
   → Irá a pages/courses.html (no existe aún, error esperado)

4. Haz clic en "REDES"
   → Irá a pages/networks.html (no existe aún, error esperado)

5. Haz clic en "CONFIGURACIÓN"
   → Irá a pages/settings.html (no existe aún, error esperado)

Esto es normal en Fase 1. Las páginas se crearán en las siguientes fases.


VERIFICAR ARCHIVOS CARGADOS
=============================

Abre DevTools (F12) → Network (pestaña)

Deberías ver cargados:
✅ index.html
✅ global.css
✅ home.css
✅ particles.js
✅ navbar.js
✅ main.js
✅ utilities.js
✅ Fonts de Google

Si alguno falta o tiene error (404), revisar rutas relativas.


PROBAR RESPONSIVE
=================

1. Abre DevTools (F12)
2. Haz clic en icono de móvil (esquina superior izquierda)
3. Selecciona diferentes dispositivos:
   - iPhone SE
   - iPad
   - Pixel 5
   - Etc.

4. Verifica que:
   - Texto se ve correctamente
   - Botones son clickeables
   - Navbar se adapta
   - Partículas se ven bien
   - No hay scroll horizontal no deseado


PROBAR MODO OSCURO
===================

El proyecto ya está en modo oscuro. Para verlo en modo claro 
(si necesitas), edita css/global.css:

Busca :root { y cambia los colores:
--color-bg: #FFFFFF
--color-text: #000000
etc.


SOLUCIONAR PROBLEMAS
====================

ERROR: "Cannot find module"
  → Asegurate que todos los archivos están en el lugar correcto
  → Verifica rutas en los links href="" y src=""

ERROR: Partículas no se ven
  → Verifica que particles.js se carga (F12 → Network)
  → Abre consola (F12), busca errores

ERROR: Estilos no se aplican
  → Limpia cache (Ctrl+Shift+Supr)
  → Recarga página (Ctrl+Shift+R)

ERROR: CORS o de servidor
  → Usa servidor local, no abras directamente HTML
  → Usa Opción 2, 3, 4 o 5

ERROR: Navbar no responde
  → Abre consola
  → Verifica que navbar.js se cargo correctamente
  → Sin errores JavaScript


LIMPIAR CACHE DEL NAVEGADOR
============================

Chrome:
1. Presiona Ctrl+Shift+Supr
2. Selecciona "Desde siempre"
3. Marca: Cookies, Imágenes, Archivos
4. Click "Borrar datos"

Firefox:
1. Presiona Ctrl+Shift+Supr
2. Selecciona "Todo"
3. Click "Borrar ahora"

Safari:
1. Ir a Preferencias
2. "Privacidad"
3. Click "Administrar datos del sitio"
4. Selecciona el sitio, click "Quitar"


CONECTAR FIREBASE
=================

Cuando llegues a Fase 2:

1. Crear proyecto en Firebase Console
2. Copiar credenciales
3. Actualizar firebase/config.js
4. Descomentar líneas en config.js
5. Agregar scripts de Firebase en HTML

Ver archivo GITHUB_PAGES.md para más detalles


COMMIT Y PUSH A GITHUB
======================

Cuando todo funcione localmente:

1. Abre terminal en la carpeta
2. Inicializa git:
   git init

3. Agrega archivos:
   git add .

4. Commit:
   git commit -m "Estructura inicial - Fase 1 completada"

5. Agrega remote (reemplaza con tu usuario):
   git remote add origin https://github.com/TU_USUARIO/academia-indrhack.git

6. Cambia a main:
   git branch -M main

7. Push:
   git push -u origin main

8. Espera 5 minutos

9. Tu sitio estará en:
   https://TU_USUARIO.github.io/academia-indrhack/


ARCHIVOS IMPORTANTES PARA ESTA FASE
====================================

Revisar estos archivos para entender la estructura:

1. README.md - Documentación general
2. ARQUITECTURA.txt - Estructura técnica
3. ESTRUCTURA.txt - Plan de desarrollo
4. FASE-1-COMPLETADA.txt - Lo que se hizo
5. GITHUB_PAGES.md - Cómo desplegar


SIGUIENTES PASOS
================

Una vez que verifies que index.html funciona:

1. Avanza a Punto 2: Crear páginas de autenticación
2. Crear pages/login.html
3. Crear pages/register.html
4. Crear js/auth.js
5. Crear css/auth.css

¡Felicidades! 🎉 Fase 1 completada exitosamente.
