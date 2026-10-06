# DevPlay — Red Social para Desarrolladores de Videojuegos Indie

Plataforma social tipo YouTube diseñada para desarrolladores y testers de videojuegos independientes. Permite compartir publicaciones, betas de juegos, videos, encuestas, chatear en tiempo real y descubrir nuevo contenido de la comunidad.

## Inicio Rápido

### Opción A: Script automático (recomendado)

```bash
# 1. Descomprime el ZIP
unzip devplay.zip
cd devplay

# 2. Ejecuta el script de configuración
./start.sh

# 3. Inicia el servidor
bun run dev

# 4. En otra terminal, inicia el chat en tiempo real
cd mini-services/realtime-service
bun run dev

# 5. Abre http://localhost:3000
```

### Opción B: Instalación manual

```bash
bun install
bun run db:push
bun run dev
```

Abrir `http://localhost:3000` en el navegador.

## Funcionalidades Principales

### Autenticación y Usuarios
- Registro e inicio de sesión con NextAuth.js (JWT)
- Modo invitado para explorar sin cuenta
- 29 tags predefinidos para identidad profesional (Dev 2D, Tester, Pixel Artist, etc.)
- 9 redes sociales vinculables (X, Instagram, YouTube, Twitch, GitHub, etc.)
- Perfil completo con 9 pestañas: Inicio, Información, Publicaciones, Fotos, Favoritos, Compartidos, Logros, Estadísticas y Seguridad

### Feed y Publicaciones
- Crear publicaciones de texto, imágenes y videos
- 5 filtros de feed: Para ti, Siguiendo, Todos, Devlogs y Noticias
- Editar y eliminar publicaciones propias
- Likes, comentarios, guardados y reposts
- Menciones (@usuario) y hashtags (#tema) clicables
- Reposts con crédito al autor original

### Betas de Juegos
- Formulario completo para subir betas (tipo itch.io)
- 7 estados de beta: Alpha, Beta Cerrada, Beta Abierta, Prueba Técnica, Acceso Anticipado, Finalizada, Próximamente
- Página de detalle estilo Play Store con screenshots, timeline de desarrollo, changelog y requisitos técnicos
- Descarga directa o enlace externo
- Centro de Betas con búsqueda y filtros por estado, género y plataforma

### Videos
- Sección de videos estilo YouTube
- Reproductor con controles nativos
- Filtros: Recientes, Populares, Tendencia
- Video destacado en la parte superior

### Encuestas
- Crear encuestas con 2-8 opciones
- Votación de opción única o múltiple
- Resultados en tiempo real con barras de progreso animadas
- Fecha de cierre opcional

### Chat Mundial en Tiempo Real
- Chat global con Socket.io
- Contador de usuarios conectados
- Reportar mensajes
- Copiar mensajes al portapapeles

### Descubrir y Buscar
- Sección Descubrir con trending, usuarios recomendados, betas populares y tags
- Buscador global de usuarios y publicaciones
- Historial de búsqueda

### Sistema de Seguridad y Privacidad
- Bloquear y desbloquear usuarios
- Filtrado automático de contenido bloqueado en feed, discover y tendencias
- Reportar publicaciones, comentarios y mensajes
- Panel de seguridad con score, cambio de contraseña y eventos de login
- Perfil público/privado
- Eliminar cuenta

### Notificaciones
- Notificaciones de likes, comentarios, seguimientos y directos
- Notificaciones en tiempo real vía WebSocket
- Marcar como leídas

### Temas y Personalización
- 7 temas de color: Original, Bosque, Atardecer, Aurora, Océano, Mono y Neutral
- Modo claro/oscuro
- Menú móvil rediseñado con animaciones
- Página 404 animada con efecto glitch
- Tour guiado para nuevos usuarios

## Arquitectura

### Stack Tecnológico
- **Framework**: Next.js 16 con App Router
- **Lenguaje**: TypeScript 5
- **Base de datos**: Prisma ORM + SQLite
- **Autenticación**: NextAuth.js v4 (JWT)
- **Tiempo real**: Socket.io (mini-servicio en puerto 3003)
- **Estado**: Zustand + React Query (TanStack Query)
- **Estilos**: Tailwind CSS 4 + shadcn/ui
- **Iconografía**: Lucide React
- **Animaciones**: Framer Motion

### Estructura del Proyecto

```
src/
├── app/                    # App Router de Next.js
│   ├── api/devplay/       # 38 endpoints de API REST
│   ├── globals.css        # Estilos globales + 7 temas
│   ├── layout.tsx         # Layout raíz
│   ├── not-found.tsx      # Página 404 animada
│   └── page.tsx           # Página principal
├── components/
│   ├── devplay/           # 76 componentes de la app
│   │   ├── layout/        # Header, Sidebar, ChatPanel
│   │   ├── views/         # 7 vistas principales
│   │   ├── modals/        # Diálogos (share, report, block, etc.)
│   │   ├── post/          # PostCard, PollWidget
│   │   └── shared/        # Componentes reutilizables
│   └── ui/                # Componentes shadcn/ui
├── hooks/                 # Hooks personalizados
├── lib/                   # Utilidades, stores, config
├── services/              # Capa de servicios (API client)
└── types/                 # Tipos de dominio

mini-services/
└── realtime-service/      # Servidor Socket.io (chat + notificaciones)

prisma/
└── schema.prisma          # 16 modelos de base de datos
```

### Modelos de Base de Datos
- **User** — usuarios con tags, redes sociales y privacidad
- **Post** — publicaciones (POST, BETA, STREAM, POLL)
- **Beta** — betas de juegos con detalle completo
- **Poll / PollOption / PollVote** — sistema de encuestas
- **Stream** — transmisiones en vivo
- **Comment / Like / Bookmark** — interacciones
- **Follow** — seguimiento entre usuarios
- **Block** — bloqueo de usuarios
- **Notification** — notificaciones
- **ChatMessage** — mensajes del chat mundial
- **Report** — reportes de contenido
- **LoginEvent** — eventos de inicio de sesión

### Capa de API REST
La aplicación expone 38 endpoints REST bajo `/api/devplay/`:

- `POST /auth/register`, `POST /auth/guest`
- `GET /posts`, `POST /posts`, `GET /posts/[id]`, `PATCH /posts/[id]`, `DELETE /posts/[id]`
- `POST /posts/[id]/likes`, `DELETE /posts/[id]/likes`
- `GET /posts/[id]/comments`, `POST /posts/[id]/comments`
- `POST /posts/[id]/repost`, `POST /posts/[id]/bookmarks`
- `GET /posts/[id]/poll`, `POST /posts/[id]/poll`
- `GET /betas/[id]/edit`, `GET /betas/[id]/download`
- `GET /streams`, `POST /streams/go-live`, `POST /streams/go-offline`
- `GET /users/[id]`, `GET /users/by-username/[username]`, `PATCH /users/me/profile`
- `POST /follow`, `DELETE /follow`
- `GET /notifications`, `PATCH /notifications`
- `POST /security/block`, `DELETE /security/block`, `GET /security/block/list`
- `POST /security/report`, `POST /security/password`, `PATCH /security/privacy`
- `GET /discover`, `GET /search`
- `POST /upload`
- Y más...

## Comandos

```bash
bun install          # Instalar dependencias
bun run dev          # Iniciar servidor de desarrollo (puerto 3000)
bun run lint         # Verificar código con ESLint
bun run db:push      # Aplicar schema de Prisma a la base de datos
bun run build        # Construir para producción
```

Para iniciar el servicio de chat en tiempo real:

```bash
cd mini-services/realtime-service
bun install
bun run dev          # Inicia en puerto 3003
```

## Reglas de Negocio

- Las URLs externas se validan con HEAD request y lista negra de dominios
- El sistema de bloqueo filtra contenido en servidor (posts, comentarios, likes)
- Los reposts siempre apuntan al post original para mantener el crédito
- Las encuestas requieren mínimo 2 opciones
- No se pueden modificar las opciones de una encuesta si ya tiene votos
- Las notificaciones de like/comentario no se generan para usuarios bloqueados
- El modo invitado no puede interactuar (comentar, dar like, chatear)

## Accesibilidad

- Navegación por teclado
- Soporte para lectores de pantalla (ARIA labels)
- `prefers-reduced-motion` respetado
- Alto contraste en temas oscuros
- Diseño responsive (móvil, tablet, desktop)

## Licencia

Proyecto educativo — SENA ADSO.

---

Desarrollado con Next.js 16, TypeScript y Prisma.
