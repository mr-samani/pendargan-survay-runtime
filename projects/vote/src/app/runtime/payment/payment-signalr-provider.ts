export type PaymentSignalRConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface PaymentSignalRClientOptions {
  readonly withCredentials?: boolean;
  readonly accessTokenFactory?: () => string | Promise<string>;
  readonly reconnectDelays?: readonly number[];
  readonly initialStartRetryDelays?: readonly number[];
  readonly onStateChange?: (state: PaymentSignalRConnectionState, error?: Error) => void;
}
