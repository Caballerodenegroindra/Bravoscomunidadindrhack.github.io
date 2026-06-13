# ACADEMIA INDRHACK

Plataforma web educativa para formación en informática, ciberseguridad,
hacking ético y privacidad digital. Estilo oscuro y futurista, con sistema
de registro por aprobación manual, panel administrador y catálogo de cursos.

> ⚘️ EL CONOCIMIENTO ES LA BASE ⚘️

## Estructura del proyecto

```
academia-indrhack/
├── index.html              Pantalla de inicio
├── registro.html           Registro de nuevas cuentas (queda "pendiente")
├── login.html              Inicio de sesión (solo cuentas "aprobado")
├── panel-usuario.html       Panel del miembro
├── panel-admin.html         Panel del administrador (solicitudes, miembros, cursos)
├── cursos.html              Catálogo de cursos
├── perfil.html              Perfil del usuario (foto, motivaciones, gustos)
├── redes.html               Redes sociales y comunidad
├── configuracion.html       Configuración de cuenta y del sitio (admin)
├── css/
│   └── style.css            Tokens de diseño, layout y componentes
├── js/
│   ├── firebase-config.js   Inicialización de Firebase (RELLENA TUS CLAVES)
│   ├── auth.js              Registro, login, sesión y aprobación
│   ├── admin.js              Lógica del panel administrador
│   ├── main.js               Navegación y estado de sesión en la barra superior
│   └── particles.js          Fondo animado de partículas
└── assets/
    └── img/avatar-placeholder.svg
```

## Identidad visual

| Token            | Valor      |
| ---------------- | ---------- |
| Fondo            | `#070707`  |
| Color principal  | `#8B0000`  |
| Texto            | `#E8E8E8`  |
| Detalles         | `#2B2B2B`  |
| Acento neón      | `#00BFFF`  |
| Tipografía título| Orbitron   |
| Tipografía texto | Inter      |

## Configurar Firebase

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com).
2. Activa **Authentication** → método **Correo electrónico/contraseña**.
3. Activa **Firestore Database** (modo producción).
4. Activa **Storage** (para fotos de perfil e imágenes de cursos).
5. En *Configuración del proyecto → General → Tus apps → Web*, copia el
   objeto `firebaseConfig` y pégalo en `js/firebase-config.js`.

### Por qué "usuario" en vez de correo

El registro pide **usuario y contraseña**, no correo. Para usar
Authentication de Firebase (que requiere correo), `firebase-config.js`
convierte el usuario en un correo interno: `usuario@indrhack.local`.
Esto es transparente para la persona que usa el sitio.

### Crear el primer administrador

El sistema de aprobación es manual y no hay administradores por defecto.
Para crear el primero:

1. Regístrate normalmente desde `registro.html` (la cuenta quedará
   "pendiente").
2. En Firestore, abre la colección `users` y busca el documento con tu
   `username`.
3. Cambia manualmente:
   - `estado`: `"aprobado"`
   - `rol`: `"administrador"`
4. Inicia sesión: serás redirigido a `panel-admin.html`.

Desde ahí podrás aprobar, rechazar o suspender al resto de cuentas.

## Reglas de seguridad recomendadas (Firestore)

Ajusta según tus necesidades, pero como punto de partida:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth.uid == userId;
      // Solo el propio usuario edita su perfil; estado y rol
      // solo deben cambiarse por un administrador (vía panel).
      allow update: if request.auth.uid == userId
        || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.rol == 'administrador';
      allow delete: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.rol == 'administrador';
    }

    match /courses/{courseId} {
      allow read: if true;
      allow write: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.rol == 'administrador';
    }

    match /config/{docId} {
      allow read: if true;
      allow write: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.rol == 'administrador';
    }
  }
}
```

> Nota: las reglas anteriores asumen que el campo `rol` no puede ser
> modificado por el propio usuario en su `update`. Para reforzarlo,
> separa la actualización de perfil y la de `estado`/`rol` en
> documentos o colecciones distintas, o usa una Cloud Function.

## Colección `courses`

Cada documento representa un curso:

```js
{
  titulo: "Fundamentos de redes",
  descripcion: "Introducción a TCP/IP, subredes y protocolos.",
  imagen: "https://...",
  nivel: "Básico",
  material: "PDF + video",
  descarga: "https://drive.google.com/...",
  publicado: true
}
```

- `cursos.html` solo muestra cursos con `publicado: true`.
- El botón **Descargar** solo aparece para cuentas con `estado: "aprobado"`.
- Los visitantes ven el curso pero ven "Inicia sesión para acceder" en
  lugar del botón de descarga.

## Despliegue en GitHub Pages

1. Sube esta carpeta a un repositorio de GitHub.
2. En **Settings → Pages**, selecciona la rama (`main`) y la carpeta raíz (`/`).
3. Espera a que se publique la URL `https://tu-usuario.github.io/tu-repo/`.
4. Verifica que `js/firebase-config.js` tenga las claves correctas antes
   de publicar.

## Próximos pasos sugeridos

- Conectar el formulario "Crear curso" del panel administrador con
  Firestore + Storage para subir imágenes y archivos.
- Implementar "Editar textos / enlaces / apariencia" leyendo y
  escribiendo el documento `config/site` (ya usado en `configuracion.html`)
  desde `index.html` y `redes.html`.
- Añadir una Cloud Function para eliminar por completo cuentas de
  Authentication cuando el administrador presiona "Eliminar".
- Sustituir `assets/img/avatar-placeholder.svg` por el logo definitivo
  de Academia Indrhack.
