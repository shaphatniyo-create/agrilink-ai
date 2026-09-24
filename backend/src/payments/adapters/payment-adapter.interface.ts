export interface InitiateResult {
  providerReference: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  redirectUrl?: string;
  raw?: unknown;
}

export interface WebhookParseResult {
  providerReference: string;
  status: 'SUCCESSFUL' | 'FAILED' | 'REFUNDED' | 'REVERSED';
  amount?: number;
}

/**
 * Every payment provider (MTN MoMo, Airtel Money, bank card via RSwitch,
 * bank transfer, ...) implements this interface so the rest of the app never
 * depends on a specific provider's SDK/API shape. Swapping or adding a
 * provider means adding one adapter + a PaymentProvider row -- no changes
 * to marketplace/transport/subscription code.
 */
export interface PaymentAdapter {
  code: string;
  initiate(params: {
    reference: string;
    amount: number;
    currency: string;
    phoneOrAccount?: string;
    purpose: string;
  }): Promise<InitiateResult>;
  verifySignature(payload: unknown, signatureHeader?: string): boolean;
  parseWebhook(payload: unknown): WebhookParseResult;
}
