// ============================================
// TON Connect Integration
// https://docs.ton.org/ecosystem/ton-connect/overview
// SDK: @tonconnect/sdk v3
// ============================================

import { TonConnect, WalletInfoRemote, isWalletInfoRemote } from '@tonconnect/sdk';
import { beginCell, Address } from '@ton/core';
import { getMemoryManager } from './db/memory';
import {
  PostgresTonConnectStorage,
  ensureTonConnectTable,
  initTonConnectStorage,
} from './db/ton-connect-storage';
import { Pool } from 'pg';

// ── Manifest URL ────────────────────────────────────────────
// Для Telegram-бота используем публичный manifest
// В продакшне задайте TON_CONNECT_MANIFEST_URL в .env
const TON_CONNECT_MANIFEST_URL =
  process.env.TON_CONNECT_MANIFEST_URL ||
  'https://raw.githubusercontent.com/ton-community/tutorials/main/03-client/test/public/tonconnect-manifest.json';

const TONCENTER_API = 'https://toncenter.com/api/v2';
const TONCENTER_KEY = process.env.TONCENTER_API_KEY || '';

// ── Типы ─────────────────────────────────────────────────────
export interface WalletConnection {
  address: string;         // raw hex адрес (0:abc...)
  friendlyAddress: string; // user-friendly (UQ...)
  publicKey: string;
  walletName: string;
  connectedAt: Date;
}

// ── TON Connect Manager ──────────────────────────────────────
// Паттерн из OpenClaw: один менеджер соединений на весь процесс,
// изолированные сессии на пользователя, персистентное хранение
export class TonConnectManager {
  private connectors = new Map<number, TonConnect>();
  private wallets    = new Map<number, WalletConnection>();
  private connectCallbacks = new Map<number, (w: WalletConnection | null) => void>();

  // ── Инициализация: создаём таблицу и восстанавливаем сессии ─
  async init(pool: Pool): Promise<void> {
    initTonConnectStorage(pool);
    await ensureTonConnectTable(pool);

    // Восстанавливаем сессии всех пользователей у которых есть сохранённые данные
    const userIds = await PostgresTonConnectStorage.getAllUserIds(pool);
    let restored = 0;
    for (const uid of userIds) {
      const ok = await this.restoreSession(uid);
      if (ok) restored++;
    }
    if (userIds.length > 0) {
      console.log(`🔗 TON Connect: restored ${restored}/${userIds.length} sessions`);
    }
  }

  // ── Создать коннектор с PostgreSQL storage ───────────────────
  private getConnector(userId: number): TonConnect {
    if (!this.connectors.has(userId)) {
      const storage = new PostgresTonConnectStorage(userId);

      const connector = new TonConnect({
        manifestUrl: TON_CONNECT_MANIFEST_URL,
        storage,
      });

      connector.onStatusChange((wallet) => {
        if (wallet) {
          const conn: WalletConnection = {
            address: wallet.account.address,
            friendlyAddress: this.toFriendly(wallet.account.address),
            publicKey: wallet.account.publicKey ?? '',
            walletName: wallet.device.appName,
            connectedAt: new Date(),
          };
          this.wallets.set(userId, conn);
          console.log(`✅ TON Connect [${userId}]: ${conn.friendlyAddress} via ${conn.walletName}`);
          this.connectCallbacks.get(userId)?.(conn);
        } else {
          this.wallets.delete(userId);
          console.log(`🔌 TON Connect [${userId}]: disconnected`);
          this.connectCallbacks.get(userId)?.(null);
        }
      });

      this.connectors.set(userId, connector);
    }
    return this.connectors.get(userId)!;
  }

  // ── Восстановить сессию из PostgreSQL storage ────────────────
  async restoreSession(userId: number): Promise<boolean> {
    try {
      const connector = this.getConnector(userId);
      await connector.restoreConnection();
      if (connector.connected) {
        // Синхронизируем wallets Map из connector state
        const wallet = connector.wallet;
        if (wallet) {
          this.wallets.set(userId, {
            address: wallet.account.address,
            friendlyAddress: this.toFriendly(wallet.account.address),
            publicKey: wallet.account.publicKey ?? '',
            walletName: wallet.device.appName,
            connectedAt: new Date(),
          });
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // ── Генерация ссылки для подключения Tonkeeper ───────────────
  async generateConnectLink(userId: number): Promise<{
    universalLink: string;
    deepLink: string;
    error?: string;
  }> {
    try {
      const connector = this.getConnector(userId);
      const wallets = await TonConnect.getWallets();

      const tonkeeper = wallets.find(
        w => isWalletInfoRemote(w) && w.name.toLowerCase().includes('tonkeeper')
      ) as WalletInfoRemote | undefined;

      if (!tonkeeper) throw new Error('Tonkeeper not found in wallet registry');

      const universalLink = connector.connect({
        universalLink: tonkeeper.universalLink,
        bridgeUrl: tonkeeper.bridgeUrl,
      });

      const deepLink = universalLink.replace('https://app.tonkeeper.com', 'tonkeeper://');
      return { universalLink, deepLink };
    } catch (error) {
      console.error('[TonConnect] generateConnectLink error:', error);
      return {
        universalLink: '',
        deepLink: '',
        error: error instanceof Error ? error.message : 'Ошибка генерации ссылки',
      };
    }
  }

  onConnect(userId: number, cb: (w: WalletConnection | null) => void): void {
    this.connectCallbacks.set(userId, cb);
  }

  // ── Отключить кошелёк ────────────────────────────────────────
  async disconnect(userId: number): Promise<boolean> {
    const connector = this.connectors.get(userId);
    if (connector) {
      try { await connector.disconnect(); } catch { /* ignore */ }
    }
    // Очищаем PostgreSQL storage
    try {
      const storage = new PostgresTonConnectStorage(userId);
      await storage.clearAll();
    } catch { /* ignore */ }

    this.connectors.delete(userId);
    this.wallets.delete(userId);
    this.connectCallbacks.delete(userId);
    return true;
  }

  // ── Проверки состояния ───────────────────────────────────────
  isConnected(userId: number): boolean {
    return this.connectors.get(userId)?.connected ?? false;
  }

  getWallet(userId: number): WalletConnection | null {
    return this.wallets.get(userId) ?? null;
  }

  getAddress(userId: number): string | null {
    return this.wallets.get(userId)?.friendlyAddress ?? null;
  }

  // ── Баланс через TonCenter ───────────────────────────────────
  async getBalance(userId: number): Promise<{ ton: string; nano: string; error?: string }> {
    const address = this.wallets.get(userId)?.address;
    if (!address) return { ton: '0', nano: '0', error: 'Кошелёк не подключён' };

    try {
      const apiKey = TONCENTER_KEY ? `&api_key=${TONCENTER_KEY}` : '';
      const res = await fetch(
        `${TONCENTER_API}/getAddressBalance?address=${encodeURIComponent(address)}${apiKey}`
      );
      const data = await res.json() as any;
      if (!data.ok) throw new Error(data.error || 'TonCenter error');
      const nano: string = data.result;
      return { ton: (parseInt(nano) / 1e9).toFixed(4), nano };
    } catch (e) {
      return { ton: '0', nano: '0', error: String(e) };
    }
  }

  // ── Отправить TON через Tonkeeper ────────────────────────────
  // Паттерн: restore → send → retry on stale session
  async sendTon(
    userId: number,
    to: string,
    amountTon: number,
    comment?: string
  ): Promise<{ success: boolean; boc?: string; error?: string; needsReconnect?: boolean }> {

    let connector = this.connectors.get(userId);

    // Если нет коннектора или не подключён — пробуем восстановить из PG
    if (!connector?.connected) {
      console.log(`[TonConnect] sendTon: trying to restore session for user ${userId}...`);
      const restored = await this.restoreSession(userId);
      connector = this.connectors.get(userId);

      if (!restored || !connector?.connected) {
        return {
          success: false,
          error: 'Кошелёк не подключён. Подключите через 💎 TON Connect',
          needsReconnect: true,
        };
      }
    }

    try {
      const amountNano = Math.floor(amountTon * 1e9).toString();
      const payload = comment ? this.encodeComment(comment) : undefined;

      console.log(`[TonConnect] sendTransaction: ${amountTon} TON → ${to}`);

      const result = await connector.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600, // 10 минут (больше времени подтвердить)
        messages: [{
          address: to,
          amount: amountNano,
          payload,
        }],
      });

      await getMemoryManager().addMessage(
        userId, 'system',
        `TON sent: ${amountTon} TON → ${to}`,
        { type: 'ton_tx', amount: amountTon, to, boc: result.boc }
      ).catch(() => {});

      return { success: true, boc: result.boc };

    } catch (e: any) {
      const msg: string = e?.message || String(e);
      console.error(`[TonConnect] sendTransaction error for user ${userId}:`, msg);

      // Классифицируем ошибку
      if (msg.includes('declined') || msg.includes('rejected') || msg.includes('cancel')) {
        return { success: false, error: 'Транзакция отклонена в Tonkeeper' };
      }
      if (msg.includes('expired') || msg.includes('timeout')) {
        return { success: false, error: 'Время подтверждения истекло (10 мин). Попробуйте снова' };
      }
      if (
        msg.includes('Wallet is not connected') ||
        msg.includes('bridge') ||
        msg.includes('SSE') ||
        msg.includes('disconnect')
      ) {
        // Сессия устарела — сбрасываем и просим переподключиться
        await this.disconnect(userId);
        return {
          success: false,
          error: 'Соединение с Tonkeeper разорвано. Нажмите 💎 TON Connect и подключитесь заново',
          needsReconnect: true,
        };
      }

      return { success: false, error: msg.slice(0, 200) };
    }
  }

  // ── Пакетная отправка (до 4 получателей) ─────────────────────
  async sendBatch(
    userId: number,
    recipients: Array<{ to: string; amountTon: number; comment?: string }>
  ): Promise<{ success: boolean; boc?: string; sent?: number; error?: string }> {
    if (recipients.length > 4) {
      return { success: false, error: 'TON Connect: максимум 4 получателя в одной транзакции' };
    }

    let connector = this.connectors.get(userId);
    if (!connector?.connected) {
      await this.restoreSession(userId);
      connector = this.connectors.get(userId);
    }
    if (!connector?.connected) {
      return { success: false, error: 'Кошелёк не подключён' };
    }

    try {
      const messages = recipients.map(r => ({
        address: r.to,
        amount: Math.floor(r.amountTon * 1e9).toString(),
        payload: r.comment ? this.encodeComment(r.comment) : undefined,
      }));

      const result = await connector.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages,
      });

      return { success: true, boc: result.boc, sent: recipients.length };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Ошибка пакетной транзакции' };
    }
  }

  // ── История транзакций ───────────────────────────────────────
  async getTransactions(userId: number, limit = 10): Promise<{
    ok: boolean;
    txs?: Array<{
      hash: string; from: string; to: string;
      amount: string; isOutgoing: boolean; time: number; comment?: string;
    }>;
    error?: string;
  }> {
    const address = this.wallets.get(userId)?.address;
    if (!address) return { ok: false, error: 'Кошелёк не подключён' };

    try {
      const apiKey = TONCENTER_KEY ? `&api_key=${TONCENTER_KEY}` : '';
      const res = await fetch(
        `${TONCENTER_API}/getTransactions?address=${encodeURIComponent(address)}&limit=${limit}&archival=false${apiKey}`
      );
      const data = await res.json() as any;
      if (!data.ok) throw new Error(data.error || 'TonCenter error');

      const txs = data.result.map((tx: any) => {
        const inVal  = parseInt(tx.in_msg?.value  || '0');
        const outVal = parseInt(tx.out_msgs?.[0]?.value || '0');
        const hasInSource = !!(tx.in_msg?.source);
        const isOutgoing  = outVal > 0 && !hasInSource;
        const amount = ((isOutgoing ? outVal : (inVal || outVal)) / 1e9).toFixed(4);

        return {
          hash: tx.transaction_id?.hash ?? '',
          from: tx.in_msg?.source ?? '',
          to: tx.out_msgs?.[0]?.destination ?? '',
          amount,
          isOutgoing,
          time: tx.utime,
          comment: this.decodeComment(tx.in_msg?.msg_data) || this.decodeComment(tx.out_msgs?.[0]?.msg_data),
        };
      });

      return { ok: true, txs };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  // ── Утилиты ──────────────────────────────────────────────────

  // Правильное кодирование комментария как TVM Cell BOC (op=0)
  private encodeComment(text: string): string {
    const body = beginCell()
      .storeUint(0, 32)       // op = 0 → текстовый комментарий
      .storeStringTail(text)  // текст UTF-8
      .endCell();
    return body.toBoc().toString('base64');
  }

  private decodeComment(msgData: any): string | undefined {
    try {
      if (!msgData?.text) return undefined;
      return Buffer.from(msgData.text, 'base64').toString('utf8').slice(4) || undefined;
    } catch { return undefined; }
  }

  // Raw hex/raw address → user-friendly UQ... через @ton/core
  private toFriendly(rawAddr: string): string {
    try {
      const addr = Address.parse(rawAddr);
      return addr.toString({ bounceable: false, testOnly: false });
    } catch {
      if (rawAddr.includes(':')) {
        const hex = rawAddr.split(':')[1] ?? rawAddr;
        return `UQ${hex.slice(0, 6)}...${hex.slice(-4)}`;
      }
      return rawAddr.slice(0, 10) + '...' + rawAddr.slice(-6);
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────
let _manager: TonConnectManager | null = null;

export function getTonConnectManager(): TonConnectManager {
  if (!_manager) _manager = new TonConnectManager();
  return _manager;
}

// Вызывается при старте бота из db/index.ts
export async function initTonConnect(pool: Pool): Promise<void> {
  const mgr = getTonConnectManager();
  await mgr.init(pool);
}

export default getTonConnectManager;
