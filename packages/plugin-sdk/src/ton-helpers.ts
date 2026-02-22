export class TonHelpers {
  static formatAmount(nanotons: number): string {
    return (nanotons / 1e9).toFixed(4) + ' TON';
  }

  static toNano(tons: number): number {
    return Math.floor(tons * 1e9);
  }

  static fromNano(nanotons: number): number {
    return nanotons / 1e9;
  }

  static isValidAddress(address: string): boolean {
    return /^[A-Za-z0-9_-]{48}$/.test(address);
  }
}