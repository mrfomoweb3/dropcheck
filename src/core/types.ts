// Shared types. Account ids are 32-byte hex strings ("0x" + 64 hex) internally.

export type Severity = 'red' | 'amber' | 'info' | 'green';

export type IssueCode =
  | 'ADDR_INVALID'
  | 'ADDR_WRONG_PREFIX'
  | 'ADDR_EVM'
  | 'AMOUNT_INVALID'
  | 'DUPLICATE'
  | 'NO_PROVIDER'
  | 'BELOW_MIN_BALANCE'
  | 'RECIPIENT_FROZEN'
  | 'ASSET_FROZEN'
  | 'DECIMAL_SUSPECT'
  | 'SENDER_SHORT_ASSET'
  | 'SENDER_SHORT_NATIVE'
  | 'EVM_VISIBILITY'
  | 'OK';

export interface Issue {
  code: IssueCode;
  severity: Severity;
  /** Plain-English reason shown in the table. */
  message: string;
  /** What Dropcheck will do about it (empty if nothing). */
  fix?: string;
  /** Technical detail for the expandable "Why?". */
  why?: string;
}

export interface RawRow {
  line: number;
  addressInput: string;
  amountInput: string;
}

export interface AssetInfo {
  id: string;
  exists: boolean;
  name: string;
  symbol: string;
  decimals: number;
  minBalance: bigint;
  isSufficient: boolean;
  /** 'Live' | 'Frozen' | 'Destroying' */
  status: string;
  owner?: string;
  supply?: bigint;
}

export interface AccountState {
  nativeFree: bigint;
  providers: number;
  consumers: number;
  sufficients: number;
  /** null = no Assets.Account entry for this asset. */
  assetBalance: bigint | null;
  /** 'Liquid' | 'Frozen' | 'Blocked' | null */
  assetStatus: string | null;
}

export interface ChainSnapshot {
  ss58: number;
  nativeDecimals: number;
  nativeSymbol: string;
  ed: bigint;
  asset: AssetInfo;
  /** keyed by account hex */
  accounts: Record<string, AccountState>;
  /** h160 (lowercase) -> account hex, from ReviveApi.account_id */
  evmMap: Record<string, string>;
  sender?: { account: string; state: AccountState };
  /** Fee estimate for the full plan, planck. */
  feeEstimate?: bigint;
  topupBufferBps: bigint;
}

export type RowAction = 'send' | 'topup+send' | 'excluded' | 'merged';

export interface CheckedRow {
  line: number;
  addressInput: string;
  amountInput: string;
  /** Resolved 32-byte account, hex. */
  account?: string;
  /** Resolved account in the chain's SS58 format. */
  resolved?: string;
  amount?: bigint;
  issues: Issue[];
  severity: Severity;
  action: RowAction;
  /** For merged rows, the line they were merged into. */
  mergedInto?: number;
  /** Lines merged into this one. */
  mergedFrom?: number[];
}

export interface RunIssue extends Issue {
  /** If true, Fix & Send is disabled. */
  blocking: boolean;
}

export interface CheckResult {
  rows: CheckedRow[];
  runIssues: RunIssue[];
  summary: {
    recipients: number;
    ok: number;
    autoFixable: number;
    blocked: number;
    totalAsset: bigint;
    totalTopup: bigint;
    topups: number;
    transfers: number;
    fee?: bigint;
  };
}
