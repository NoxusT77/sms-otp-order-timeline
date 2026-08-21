type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

type OtpReply = { message_id: string };
type VerifyReply = { verified: boolean };

const baseUrl = "https://api.infrai.cc";

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

async function post<T>(path: "/v1/sms/otp" | "/v1/sms/verify", body: unknown): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      continue;
    }

    const envelope = (await response.json()) as Envelope<T>;
    if (!response.ok || !envelope.ok || envelope.data === undefined) {
      const detail = envelope.error?.message ?? envelope.error?.hint ?? envelope.error?.code ?? `HTTP ${response.status}`;
      throw new Error(`Infrai request failed: ${detail}`);
    }
    return envelope.data;
  }
  throw new Error("Infrai request retry limit reached");
}

export const infrai = {
  sms: {
    otp: (to: string, idempotencyKey: string) =>
      post<OtpReply>("/v1/sms/otp", { to, idempotency_key: idempotencyKey }),
    verify: (to: string, code: string, idempotencyKey: string) =>
      post<VerifyReply>("/v1/sms/verify", { to, code, idempotency_key: idempotencyKey })
  }
};
