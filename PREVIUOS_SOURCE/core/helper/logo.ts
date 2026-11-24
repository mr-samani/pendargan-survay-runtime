import { PaymentGatewayType } from '@core/models/backend-dto/PaymentGatewayType';

export abstract class Logo {
  static appLogo(lang: string) {
    return 'assets/images/logo-' + lang + '.png';
  }
}

export function getGatewayLogoFileName(gatewayType: PaymentGatewayType) {
  switch (gatewayType) {
    case PaymentGatewayType.Paypal:
      return 'Paypal';
    case PaymentGatewayType.ZarrinPal:
      return 'ZarrinPal';
    case PaymentGatewayType.Sadad:
      return 'Sadad';
    case PaymentGatewayType.Pasargad:
      return 'Pasargad';
    case PaymentGatewayType.Yekpay:
      return 'Yekpay';
    case PaymentGatewayType.Shepa:
      return 'Shepa';
    case PaymentGatewayType.Stripe:
      return 'Stripe';
    default:
      return 'Unknown';
  }
}
