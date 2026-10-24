// El back no guarda un título por conversación (ConversationOut solo trae id y fechas).
// Para no mostrar UUIDs, se recuerda la primera pregunta de cada conversación en
// este navegador. Si el back agrega un campo "title", este archivo sobra.

const KEY = "si_conv_titles";

function readAll(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function getTitle(conversationId: string): string | null {
  return readAll()[conversationId] ?? null;
}

export function rememberTitle(conversationId: string, question: string) {
  try {
    const all = readAll();
    if (all[conversationId]) return;
    all[conversationId] = question.replace(/\s+/g, " ").trim().slice(0, 90);
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* sin almacenamiento: se mostrará la fecha */
  }
}
