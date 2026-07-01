// ═══════════════════════════════════════════════════════════
// REGLAS DE FIRESTORE — Colecciones de Chat
// Academia Indrhack
//
// Pegá estas reglas en Firebase Console →
// Firestore Database → Reglas
// (agregalas DENTRO del bloque match /databases/{database}/documents)
// ═══════════════════════════════════════════════════════════

// Salas de chat (chat_rooms)
// - Cualquier usuario aprobado puede leer
// - Solo crear si el usuario está autenticado
// - No se puede borrar desde el cliente
match /chat_rooms/{roomId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null;
  allow delete: if false; // solo desde admin SDK
}

// Mensajes principales (chat_messages)
// - Cualquier usuario autenticado puede leer y crear
// - Solo el autor puede editar (o el campo threadCount por sistema)
match /chat_messages/{msgId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.uid == request.auth.uid
    && request.resource.data.text.size() > 0
    && request.resource.data.text.size() <= 2000;
  allow update: if request.auth != null; // permite incrementar threadCount
  allow delete: if request.auth.uid == resource.data.uid; // solo el autor
}

// Respuestas en hilos (chat_replies)
match /chat_replies/{replyId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.uid == request.auth.uid
    && request.resource.data.text.size() > 0
    && request.resource.data.text.size() <= 1000;
  allow update: if false;
  allow delete: if request.auth.uid == resource.data.uid;
}

// ═══════════════════════════════════════════════════════════
// CLASES EN VIVO
// ═══════════════════════════════════════════════════════════

// Sesiones de clase en vivo (live_classes)
// - Cualquier usuario aprobado puede leer
// - Solo un administrador puede crear/editar (crear la clase, avanzar
//   de paso, finalizarla). El campo "rol" vive en /users/{uid}.
match /live_classes/{sessionId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.rol == 'administrador';
  allow update: if request.auth != null
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.rol == 'administrador';
  allow delete: if false; // solo desde admin SDK

  // Pasos precargados de la clase (solo el admin los crea/edita)
  match /steps/{stepId} {
    allow read: if request.auth != null;
    allow create, update: if request.auth != null
      && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.rol == 'administrador';
    allow delete: if false;
  }
}

// Progreso de cada usuario dentro de una clase en vivo (live_progress)
// - El id del documento es "{sessionId}_{uid}"
// - Cada usuario solo puede leer/escribir su propio progreso
match /live_progress/{progressId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.uid == request.auth.uid;
  allow update: if request.auth != null
    && resource.data.uid == request.auth.uid;
  allow delete: if false;
}

// ═══════════════════════════════════════════════════════════
// ÍNDICES requeridos en Firestore (Firebase Console →
// Firestore → Índices → Índices compuestos):
//
// Colección: chat_messages
//   roomId (Ascendente) + createdAt (Ascendente)
//
// Colección: chat_replies
//   parentId (Ascendente) + createdAt (Ascendente)
//
// Colección: chat_rooms
//   lastAt (Descendente)    ← índice de colección única
//
// Colección: live_classes/{sessionId}/steps
//   order (Ascendente)      ← índice de colección única
// ═══════════════════════════════════════════════════════════
