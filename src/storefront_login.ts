import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { infrai } from "./infrai_sms.js";
import { createOrderAccess } from "./order_access.js";

const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, "Use an E.164 phone number");
const requestCodeBody = z.object({ phone: phoneSchema }).strict();
const verifyCodeBody = z.object({ phone: phoneSchema, code: z.string().regex(/^\d{4,8}$/) }).strict();
const orderAccess = createOrderAccess({
  otp: (to, idempotencyKey) => infrai.sms.otp(to, idempotencyKey),
  verify: (to, code, idempotencyKey) => infrai.sms.verify(to, code, idempotencyKey)
});

async function jsonBody(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function reply(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

export const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/login/code") {
      const body = requestCodeBody.parse(await jsonBody(request));
      return reply(response, 202, await orderAccess.requestCode(body.phone, randomUUID()));
    }
    if (request.method === "POST" && request.url === "/login/verify") {
      const body = verifyCodeBody.parse(await jsonBody(request));
      return reply(response, 200, await orderAccess.verifyCode(body.phone, body.code, randomUUID()));
    }
    if (request.method === "GET" && request.url?.startsWith("/orders/current?phone=")) {
      const phone = phoneSchema.parse(new URL(request.url, "http://localhost").searchParams.get("phone"));
      const order = orderAccess.readOrder(phone);
      return reply(response, order ? 200 : 401, order ?? { error: "phone_verification_required" });
    }
    return reply(response, 404, { error: "route_not_found" });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return reply(response, 400, { error: "invalid_request" });
    }
    console.error(error);
    return reply(response, 502, { error: "delivery_request_failed" });
  }
});

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => console.log(`Storefront login listening on http://localhost:${port}`));
}
