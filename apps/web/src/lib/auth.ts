import { API_BASE_URL } from "../config";

export type MutationAuthEnvelope = {
  ownerEoa: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  signature: string;
};

type NonceChallenge = {
  ownerEoa: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  statement: string;
  message: string;
};

type SignMessage = (message: string) => Promise<string>;

const fetchJson = async <T>(url: string, options?: RequestInit) => {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${response.status} ${response.statusText}: ${text}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Network request failed for ${url}. Check the deployed API/executor URL and CORS settings.`);
    }

    throw error;
  }
};

export async function signMutation(ownerEoa: string, signMessage: SignMessage) {
  const nonceResponse = await fetchJson<{ success: boolean; challenge: NonceChallenge }>(`${API_BASE_URL}/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerEoa }),
  });

  const signature = await signMessage(nonceResponse.challenge.message);
  return {
    ownerEoa: nonceResponse.challenge.ownerEoa,
    nonce: nonceResponse.challenge.nonce,
    issuedAt: nonceResponse.challenge.issuedAt,
    expiresAt: nonceResponse.challenge.expiresAt,
    signature,
  } satisfies MutationAuthEnvelope;
}

export async function signedJsonFetch<T>(args: {
  ownerEoa: string;
  signMessage: SignMessage;
  url: string;
  method: "POST" | "PATCH";
  body: Record<string, unknown>;
}) {
  const auth = await signMutation(args.ownerEoa, args.signMessage);
  return fetchJson<T>(args.url, {
    method: args.method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...args.body,
      auth,
    }),
  });
}
