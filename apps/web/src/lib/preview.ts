export function previewFromCipher(ciphertext?: string | null, deleted?: string | Date | null, messageType?: string) {
  if (deleted) return "Message deleted";
  if (!ciphertext) {
    if (messageType === "image") return "Photo";
    if (messageType === "file") return "File";
    return "";
  }
  try {
    const env = JSON.parse(ciphertext) as { mode?: string; plaintext?: string };
    if (typeof env.plaintext === "string" && env.plaintext) return env.plaintext;
  } catch {
    /* ignore */
  }
  if (messageType === "image") return "Photo";
  if (messageType === "file") return "File";
  return "Message";
}
