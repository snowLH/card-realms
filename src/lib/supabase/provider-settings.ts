type AuthProviderSettings = {
  external?: {
    google?: boolean;
  };
};

export async function isGoogleOAuthEnabled(
  supabaseUrl: string,
  publishableKey: string,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/settings`, {
    headers: { apikey: publishableKey },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Não foi possível consultar a configuração de autenticação (${response.status}).`);
  }

  const settings = await response.json() as AuthProviderSettings;
  return settings.external?.google === true;
}
