# Clases en Vivo — Chat dinámico por pasos

Nueva sección dentro de `chat.html`: **🔴 Clases en vivo**.

## Qué resuelve

- Vos (admin) precargás los pasos/temas de la clase **antes** de la sesión.
- Durante la llamada de WhatsApp, con **un solo toque** enviás el paso 1, luego el 2, etc.
- Si alguien entra a la clase **después** de haber empezado (por ejemplo, ya vamos en el paso 2),
  esa persona:
  - Solo ve el contenido y los mensajes del **paso 1** (todo lo que se envió durante esa sección).
  - No ve el paso 2 (ni siguientes) hasta que toque **"Ya completé este paso"**.
  - Al completar el paso 1, se le desbloquea el paso 2 (si ya fue enviado por vos), y así sucesivamente.

## Cómo usarlo (admin)

1. En `chat.html`, tocá el botón **"🔴 En vivo"** (solo lo ves si tu cuenta tiene `rol: "administrador"`).
2. Escribí el título de la clase y agregá los pasos: título breve + contenido/instrucciones de cada uno.
3. Al crear la clase, se abre automáticamente su chat.
4. Arriba del chat vas a ver los "chips" de cada paso. Tocá el que dice **"▶ Enviar"** para publicarlo
   en el chat (siempre en orden, uno a la vez).
5. Podés seguir chateando normalmente ahí (preguntas, avisos) mientras dura la clase.
6. Cuando termine, tocá **"Finalizar clase"**.

## Cómo lo ve un alumno

1. Entra a la sección "🔴 Clases en vivo" y toca la clase (aunque ya haya empezado).
2. Ve únicamente el contenido/chat del paso que tiene desbloqueado (empieza siempre en el paso 1,
   sin importar en qué paso vaya la clase en ese momento).
3. Cuando termina ese paso, toca **"✅ Ya completé este paso"** y se le habilita el siguiente
   (si vos ya lo enviaste; si no, ve un mensaje de "esperando al instructor").

## Estructura en Firestore

- `live_classes/{sessionId}`: título, categoría, estado (`programada` / `en-vivo` / `finalizada`),
  `currentStep` (último paso enviado por el admin), `totalSteps`.
- `live_classes/{sessionId}/steps/{stepId}`: pasos precargados (`order`, `titulo`, `contenido`).
- `live_progress/{sessionId}_{uid}`: progreso individual de cada alumno (`unlockedStep`).
- `chat_messages`: se reutiliza la misma colección del chat. Los mensajes de una clase en vivo
  llevan `roomId = sessionId` y un campo `step` (más `isStepContent: true` si es contenido
  precargado enviado por el admin). El chat filtra en el cliente qué mensajes mostrar según el
  `unlockedStep` de cada usuario.

Recordá pegar las reglas actualizadas de `FIRESTORE_CHAT_RULES.js` en la consola de Firebase
(se agregaron las reglas para `live_classes` y `live_progress`), y crear el índice compuesto
`order (Ascendente)` para la subcolección `steps`.
