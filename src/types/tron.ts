export interface TronWebInstance {
  defaultAddress?: {
    base58?: string;
  };
  trx: {
    getBalance: (address: string) => Promise<number>;
    getAccount: (address: string) => Promise<any>;
    sendTrx: (to: string, amount: number, from: string) => Promise<any>;
    multiSign: (transaction: any, privateKey: string, permissionId: number) => Promise<any>;
    sign: (transaction: any, privateKey?: string, permissionId?: number) => Promise<any>;
    sendRawTransaction: (signedTransaction: any) => Promise<any>;
  };
  address: {
    fromPrivateKey: (privateKey: string) => string;
  };
  toSun: (trx: number) => number;
  fromSun: (sun: number) => number;
  isAddress: (address: string) => boolean;
  transactionBuilder: {
    sendTrx: (to: string, amount: number, from: string) => Promise<any>;
  };
}

export interface TronLinkWindow extends Window {
  tronWeb?: TronWebInstance;
  tronLink?: {
    request: (params: { method: string }) => Promise<any>;
    ready: boolean;
  };
}

export interface ForwardingConfig {
  receivingPrivateKey: string;
  receivingAddress: string;
  destinationAddress: string;
  feeReserve: number;
  pollInterval: number;
  tronFullHost: string;
  apiKey: string;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'DETECTION' | 'SIGNATURE' | 'BROADCAST' | 'BALANCE';
  message: string;
  details?: Record<string, any>;
}

export interface ForwardingStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  timestamp?: Date;
  details?: string;
}

export interface MultisigStatus {
  isConfigured: boolean;
  threshold: number;
  keyCount: number;
  hasReceivingKey: boolean;
  hasApprovingKey: boolean;
}