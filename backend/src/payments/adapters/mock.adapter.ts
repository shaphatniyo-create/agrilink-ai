import { Injectable } from '@nestjs/common';
import { PaymentAdapter, InitiateResult, WebhookParseResult } from './payment-adapter.interface';

/**
 * Sandbox/dev adapter -- simulates an instant-success mobile money charge so
 * the whole order -> payment -> commission -> settlement chain can be
 * exercised end-to-end without a live MTN MoMo / Airtel Money contract.
 * Swap PaymentProvider.code to MTN_MOMO/AIRTEL_MONEY/BANK_CARD in production
 * and register the corresponding real adapter (same interface).
 */
@Injectable()
export class MockPaymentAdapter implements PaymentAdapter {
  code = 'MOCK';

  async initiate(params: { reference: string; amount: number }): Promise<InitiateResult> {
    return {
      providerReference: `MOCK-${params.reference}`,
      status: 'SUCCESSFUL',
      raw: { simulated: true },
    };
  }

  verifySignature(): boolean {
    return true; // sandbox only
  }

  parseWebhook(payload: any): WebhookParseResult {
    return {
      providerReference: payload.providerReference,
      status: payload.status ?? 'SUCCESSFUL',
      amount: payload.amount,
    };
  }
}
