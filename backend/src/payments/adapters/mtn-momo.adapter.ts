import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentAdapter, InitiateResult, WebhookParseResult } from './payment-adapter.interface';

/**
 * MTN Mobile Money Rwanda (Collections API) adapter skeleton. Fill in the
 * real request-to-pay / status-check calls once API credentials are issued;
 * the interface contract (initiate/verifySignature/parseWebhook) is what the
 * rest of the app depends on, so this can be completed without touching any
 * other module. Kept intentionally free of a live HTTP call so the
 * repository has no hidden runtime dependency on secrets that don't exist yet.
 */
@Injectable()
export class MtnMomoAdapter implements PaymentAdapter {
  code = 'MTN_MOMO';

  constructor(private config: ConfigService) {}

  async initiate(params: {
    reference: string;
    amount: number;
    currency: string;
    phoneOrAccount?: string;
  }): Promise<InitiateResult> {
    // TODO: call MTN MoMo "request to pay" with this.config.get('MTN_MOMO_API_KEY') etc.
    // Left unimplemented deliberately -- requires a live MoMo merchant contract.
    return { providerReference: `MTN-${params.reference}`, status: 'PENDING' };
  }

  verifySignature(_payload: unknown, _signatureHeader?: string): boolean {
    // TODO: verify MTN webhook signature per their API docs.
    return false;
  }

  parseWebhook(payload: any): WebhookParseResult {
    return { providerReference: payload.externalId, status: payload.status };
  }
}
