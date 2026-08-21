export type OrderTimeline = {
  orderId: string;
  checkout: { status: "paid"; total: string };
  fulfillment: { status: "packing" | "shipped"; carrier?: string };
  receipt: { number: string; issuedAt: string };
  customerUpdate: string;
};

export type OtpGateway = {
  otp(to: string, idempotencyKey: string): Promise<{ message_id: string }>;
  verify(to: string, code: string, idempotencyKey: string): Promise<{ verified: boolean }>;
};

const sampleOrder: OrderTimeline = {
  orderId: "ord_creator-kit-1042",
  checkout: { status: "paid", total: "USD 84.00" },
  fulfillment: { status: "packing" },
  receipt: { number: "R-1042", issuedAt: "2026-08-13T09:30:00Z" },
  customerUpdate: "Your creator kit is being packed for dispatch."
};

export function createOrderAccess(gateway: OtpGateway) {
  const verifiedPhones = new Set<string>();

  return {
    async requestCode(phone: string, requestId: string) {
      const result = await gateway.otp(phone, `login:${requestId}`);
      return { challengeId: result.message_id, next: "verify_code" as const };
    },
    async verifyCode(phone: string, code: string, requestId: string) {
      const result = await gateway.verify(phone, code, `verify:${requestId}`);
      if (result.verified) verifiedPhones.add(phone);
      return { verified: result.verified, next: result.verified ? "read_order" as const : "verify_code" as const };
    },
    readOrder(phone: string): OrderTimeline | null {
      return verifiedPhones.has(phone) ? sampleOrder : null;
    }
  };
}
