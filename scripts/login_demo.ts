import { randomUUID } from "node:crypto";
import { infrai } from "../src/infrai_sms.js";
import { createOrderAccess } from "../src/order_access.js";

const phone = process.env.DEMO_PHONE;
if (!phone) throw new Error("DEMO_PHONE is required in E.164 format");

const access = createOrderAccess({
  otp: (to, idempotencyKey) => infrai.sms.otp(to, idempotencyKey),
  verify: (to, value, idempotencyKey) => infrai.sms.verify(to, value, idempotencyKey)
});
const sent = await access.requestCode(phone, randomUUID());
console.log("Code sent:", sent);

const code = await new Promise<string>((resolve) => {
  process.stdout.write("Enter the SMS code: ");
  process.stdin.once("data", (data) => resolve(data.toString().trim()));
});

const decision = await access.verifyCode(phone, code, randomUUID());
console.log("Login decision:", decision);
if (decision.verified) console.log("Order timeline:", access.readOrder(phone));
