# Academia INDRHACK - GitHub Pages Config

## Para desplegar en GitHub Pages:

1. Crear repositorio en GitHub: `academia-indrhack`

2. Clonar localmente:
```bash
git clone https://github.com/tu-usuario/academia-indrhack.git
cd academia-indrhack
```

3. Inicializar git (si no está ya):
```bash
git init
git add .
git commit -m "Estructura inicial del proyecto"
```

4. Agregar remote:
```bash
git remote add origin https://github.com/tu-usuario/academia-indrhack.git
```

5. Pushear a main:
```bash
git branch -M main
git push -u origin main
```

6. Configurar GitHub Pages:
   - Ir a Settings del repositorio
   - Sección "Pages"
   - Source: main branch
   - La página se publicará en: https://tu-usuario.github.io/academia-indrhack/

## Estructura para GitHub Pages:

- ✅ index.html en la raíz
- ✅ Todas las rutas relativas
- ✅ Sin servidor backend requerido
- ✅ Funciona completamente en el cliente

## URLs después del despliegue:

- Principal: https://tu-usuario.github.io/academia-indrhack/
- Login: https://tu-usuario.github.io/academia-indrhack/pages/login.html
- Register: https://tu-usuario.github.io/academia-indrhack/pages/register.html
- etc...

## Actualizar el sitio:

```bash
# Hacer cambios locales
# ...

# Commitear cambios
git add .
git commit -m "Descripción de cambios"

# Pushear
git push origin main
```

El sitio se actualizará automáticamente en unos minutos.
