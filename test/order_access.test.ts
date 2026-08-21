import assert from "node:assert/strict";
import test from "node:test";
import { createOrderAccess, type OtpGateway } from "../src/order_access.js";

test("an order timeline is released only after a valid phone code", async () => {
  const gateway: OtpGateway = {
    async otp() { return { message_id: "msg_test_1042" }; },
    async verify(_phone, code) { return { verified: code === "482913" }; }
  };
  const access = createOrderAccess(gateway);
  const phone = "+14155550123";

  assert.equal(access.readOrder(phone), null);
  const rejected = await access.verifyCode(phone, "000000", "attempt-1");
  assert.deepEqual(rejected, { verified: false, next: "verify_code" });
  assert.equal(access.readOrder(phone), null);

  const accepted = await access.verifyCode(phone, "482913", "attempt-2");
  assert.deepEqual(accepted, { verified: true, next: "read_order" });
  assert.equal(access.readOrder(phone)?.fulfillment.status, "packing");
  assert.equal(access.readOrder(phone)?.receipt.number, "R-1042");
});
