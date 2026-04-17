import { SOPHOS_TOKEN_URL } from "./constants";

export async function fetchAccessToken(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "token",
  });

  const res = await fetch(SOPHOS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const json = (await res.json()) as {
    access_token?: string;
    message?: string;
    errorCode?: string;
  };

  if (!res.ok || !json.access_token) {
    throw new Error(
      json.message ?? `Sophos token isteği başarısız (${res.status})`,
    );
  }

  return json.access_token;
}
