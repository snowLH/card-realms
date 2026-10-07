/** Read an API response without leaking HTML error pages into JSON parse errors. */
export async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const body = await response.text();

  if (!contentType.includes("json")) {
    if (response.status === 404) {
      throw new Error("O serviço da expedição não foi encontrado no servidor (HTTP 404). Atualize o jogo e tente novamente.");
    }
    if (response.status >= 500) {
      throw new Error(`O servidor da expedição está indisponível (HTTP ${response.status}). Tente novamente em instantes.`);
    }
    throw new Error(`O servidor retornou uma resposta inválida (HTTP ${response.status}). Atualize o jogo e tente novamente.`);
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(fallbackMessage);
  }
}
