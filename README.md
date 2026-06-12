# 🎓 ACADEMIA INDRHACK - Documentación de Estructura

## 📋 Descripción General

ACADEMIA INDRHACK es una plataforma educativa web moderna para la enseñanza de informática, ciberseguridad y hacking ético.

## 📁 Estructura del Proyecto

```
academia-indrhack/
├── index.html                 # Página principal (landing)
├── README.md                  # Este archivo
│
├── css/
│   ├── global.css            # Estilos globales y variables
│   ├── home.css              # Estilos de la página de inicio
│   ├── auth.css              # Estilos para login/registro
│   ├── dashboard.css         # Estilos del panel de usuario
│   ├── admin.css             # Estilos del panel admin
│   └── courses.css           # Estilos de cursos
│
├── js/
│   ├── main.js               # Script principal y objeto app
│   ├── particles.js          # Sistema de partículas animadas
│   ├── navbar.js             # Funcionalidad de navegación
│   ├── auth.js               # Lógica de autenticación
│   ├── dashboard.js          # Funcionalidad del panel
│   └── admin.js              # Funcionalidad del panel admin
│
├── firebase/
│   └── config.js             # Configuración de Firebase
│
├── utils/
│   └── utilities.js          # Funciones utilitarias
│
├── pages/
│   ├── login.html            # Página de inicio de sesión
│   ├── register.html         # Página de registro
│   ├── dashboard.html        # Panel del usuario
│   ├── courses.html          # Página de cursos
│   ├── course-detail.html    # Detalle de un curso
│   ├── networks.html         # Página de redes sociales
│   ├── profile.html          # Perfil del usuario
│   └── settings.html         # Configuración
│
├── admin/
│   ├── index.html            # Panel de administrador
│   └── pages/
│       ├── requests.html     # Solicitudes de registro
│       ├── members.html      # Gestión de miembros
│       ├── courses.html      # Gestión de cursos
│       ├── settings.html     # Configuración del sistema
│       └── activity.html     # Registro de actividad
│
└── assets/
    ├── images/               # Imágenes y logos
    ├── icons/                # Iconos SVG
    └── fonts/                # Fuentes personalizadas
```

## 🎨 Identidad Visual

### Colores
- **Fondo Principal**: `#070707` (Negro profundo)
- **Color Primario**: `#8B0000` (Rojo oscuro)
- **Texto**: `#E8E8E8` (Blanco frío)
- **Detalles**: `#2B2B2B` (Gris metálico)
- **Efectos Neón**: `#00BFFF` (Azul neón)

### Tipografía
- **Títulos**: Orbitron (Bold, 700-900)
- **Texto**: Inter (300-700)

### Animaciones
- Transiciones suaves (0.3s)
- Efectos de partículas
- Efectos neón y glow
- Animaciones elegantes

## 🔧 Tecnología

### Frontend
- HTML5
- CSS3 (Flexbox, Grid, Animaciones)
- JavaScript Vanilla (ES6+)

### Backend
- Firebase Firestore (Base de datos)
- Firebase Storage (Almacenamiento de archivos)
- Firebase Auth (Autenticación - opcional)

### Despliegue
- GitHub Pages
- Git para control de versiones

## 📝 Archivos Principales

### `index.html`
- Landing page con efecto de partículas
- Botones principales: INICIAR SESIÓN y REGISTRARSE
- Barra de navegación

### `css/global.css`
- Variables CSS (:root)
- Estilos de navbar
- Estilos de botones
- Estilos de formularios
- Responsive design

### `js/main.js`
- Objeto `app` global con métodos:
  - `init()`: Inicialización
  - `checkAuth()`: Verificar autenticación
  - `setAuth()`: Guardar autenticación
  - `logout()`: Cerrar sesión
  - `notify()`: Mostrar notificaciones
  - Métodos de validación

### `firebase/config.js`
- Configuración de Firebase
- Servicios para usuarios, cursos, storage
- Métodos CRUD para base de datos

### `utils/utilities.js`
- Validadores (email, contraseña, username, etc.)
- Utilidades de almacenamiento local
- Utilidades de fecha
- Utilidades de cadena
- Utilidades de API
- Utilidades de DOM

## 🚀 Cómo Empezar

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/academia-indrhack.git
cd academia-indrhack
```

### 2. Configurar Firebase
- Crear proyecto en Firebase Console
- Copiar credenciales en `firebase/config.js`
- Habilitar Firestore y Storage
- Configurar reglas de seguridad

### 3. Abrir en navegador
- Abrir `index.html` en el navegador
- O usar un servidor local: `python -m http.server 8000`

### 4. Desplegar en GitHub Pages
```bash
git add .
git commit -m "Cambios iniciales"
git push origin main
```

## 📚 Sistema de Usuarios

### Estados de Usuario
- **Pending**: Esperando aprobación del admin
- **Approved**: Usuario aprobado, puede acceder
- **Suspended**: Cuenta suspendida
- **Rejected**: Solicitud rechazada

### Roles
- **User**: Usuario normal
- **Admin**: Administrador del sistema

### Datos del Usuario
- ID único
- Username
- Teléfono
- Email (opcional)
- Contraseña (hasheada)
- Foto de perfil
- Fecha de registro
- Estado
- Rol

## 🔐 Seguridad

- Contraseñas hasheadas con SHA-256
- No mostrar teléfonos en vistas públicas
- Panel admin restringido
- Enlaces privados bloqueados
- Sistema de tokens JWT (opcional)
- CORS configurado

## 📱 Responsive Design

- **Mobile**: < 480px
- **Tablet**: 480px - 768px
- **Desktop**: > 768px

Todos los elementos son responsive usando Flexbox y Media Queries.

## 🎯 Próximos Pasos

1. Crear páginas de autenticación (login, register)
2. Implementar panel de usuario
3. Implementar panel de administrador
4. Crear sistema de cursos
5. Integrar Firebase
6. Agregar sistema de comentarios
7. Implementar búsqueda y filtros
8. Agregar notificaciones en tiempo real

## 📞 Soporte

Para problemas o preguntas, crear un issue en GitHub.

## 📄 Licencia

Proyecto educativo. Todos los derechos reservados.

---

**Última actualización**: 2024
**Estado**: En desarrollo ⚙️
