import { describe, expect, it } from "vitest";
import { readJsonResponse } from "./read-json-response";

describe("readJsonResponse", () => {
  it("parses JSON API responses", async () => {
    const response = new Response(JSON.stringify({ token: "run-token" }), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });

    await expect(readJsonResponse<{ token: string }>(response, "Resposta inválida.")).resolves.toEqual({
      token: "run-token",
    });
  });

  it("turns an HTML not-found page into a localized server message", async () => {
    const response = new Response("<!DOCTYPE html><html><body>Not found</body></html>", {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    });

    await expect(readJsonResponse(response, "Resposta inválida.")).rejects.toThrow(
      "O serviço da expedição não foi encontrado no servidor (HTTP 404).",
    );
  });

  it("turns an HTML server failure into a retryable message", async () => {
    const response = new Response("<!DOCTYPE html><html><body>Internal server error</body></html>", {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });

    await expect(readJsonResponse(response, "Resposta inválida.")).rejects.toThrow(
      "O servidor da expedição está indisponível (HTTP 500).",
    );
  });
});
