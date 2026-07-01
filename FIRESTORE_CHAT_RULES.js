// ═══════════════════════════════════════════════════════════
// REGLAS DE FIRESTORE — Colecciones de Chat
// Academia Indrhack
//
// ⚠️ Si ya estás usando "firestore.rules" (el archivo con TODAS las
// reglas del proyecto), ese archivo ya incluye todo lo de aquí más
// actualizado y con la función auxiliar "canAccessRoom()" ya definida.
// Usá ESTE archivo (FIRESTORE_CHAT_RULES.js) solo como referencia si
// preferís pegar las reglas de chat a mano dentro de un ruleset propio.
//
// Pegá estas reglas en Firebase Console →
// Firestore Database → Reglas
// (agregalas DENTRO del bloque match /databases/{database}/documents)
// ═══════════════════════════════════════════════════════════

// Salas de chat (chat_rooms)
// - Canales y hilos de clase (type != 'dm'): cualquier usuario logueado
//   puede leer/crear/editar, como antes.
// - Mensajes directos (type == 'dm', participants == [uidA, uidB]): solo
//   los dos participantes pueden leer/editar esa sala.
// - No se puede borrar desde el cliente
match /chat_rooms/{roomId} {
  allow read: if request.auth != null &&
    (resource.data.type != 'dm' || request.auth.uid in resource.data.participants);
  allow create: if request.auth != null && (
    request.resource.data.type != 'dm' ||
    (request.auth.uid in request.resource.data.participants &&
     request.resource.data.participants.size() == 2)
  );
  allow update: if request.auth != null &&
    (resource.data.type != 'dm' || request.auth.uid in resource.data.participants);
  allow delete: if false; // solo desde admin SDK
}

// Mensajes principales (chat_messages)
// - Cualquier usuario autenticado puede leer y crear, salvo que el
//   mensaje pertenezca a una sala de mensaje directo (dm): ahí solo
//   pueden leerlo/escribirlo los dos participantes de esa sala.
// - Solo el autor puede editar (o el campo threadCount por sistema)
match /chat_messages/{msgId} {
  allow read: if request.auth != null && canAccessDmRoom(resource.data.roomId);
  allow create: if request.auth != null
    && request.resource.data.uid == request.auth.uid
    && request.resource.data.text.size() > 0
    && request.resource.data.text.size() <= 2000
    && canAccessDmRoom(request.resource.data.roomId);
  allow update: if request.auth != null && canAccessDmRoom(resource.data.roomId); // permite incrementar threadCount
  allow delete: if request.auth.uid == resource.data.uid; // solo el autor
}

// Respuestas en hilos (chat_replies)
match /chat_replies/{replyId} {
  allow read: if request.auth != null && canAccessDmRoom(resource.data.roomId);
  allow create: if request.auth != null
    && request.resource.data.uid == request.auth.uid
    && request.resource.data.text.size() > 0
    && request.resource.data.text.size() <= 1000
    && canAccessDmRoom(request.resource.data.roomId);
  allow update: if false;
  allow delete: if request.auth.uid == resource.data.uid;
}

// Función auxiliar: si la sala no existe (ej. clases en vivo) o no es de
// tipo "dm", se permite; si es "dm", solo sus participantes.
// Pegala junto a las demás funciones del bloque principal de tus reglas:
//
// function canAccessDmRoom(roomId) {
//   let roomPath = /databases/$(database)/documents/chat_rooms/$(roomId);
//   return !exists(roomPath) ||
//     get(roomPath).data.type != 'dm' ||
//     request.auth.uid in get(roomPath).data.participants;
// }

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
// PRESENCIA POR SALA (quién está conectado ahora mismo)
// ═══════════════════════════════════════════════════════════

// El id del documento es "{roomId}_{uid}". Cada usuario solo puede
// crear/actualizar/borrar SU PROPIO documento de presencia. El admin
// puede leer la lista completa para ver quién está conectado en cada
// sala o clase en vivo desde chat.html.
match /room_presence/{presenceId} {
  allow read: if request.auth != null;
  allow create, update: if request.auth != null
    && request.resource.data.uid == request.auth.uid
    && presenceId == request.resource.data.roomId + '_' + request.auth.uid;
  allow delete: if request.auth != null &&
    (presenceId == resource.data.roomId + '_' + request.auth.uid ||
     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.rol == 'administrador');
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
// Colección: chat_rooms (mensajes directos)
//   participants (Arrays) + type (Ascendente)
//
// Colección: live_classes/{sessionId}/steps
//   order (Ascendente)      ← índice de colección única
// ═══════════════════════════════════════════════════════════
