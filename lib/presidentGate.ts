"use client";

/* ============================================================
   社長室の暗証番号
   ------------------------------------------------------------
   管理画面の「社長室」タブだけで使う。役員専用の合言葉とは別物で、
   役員専用を開けても社長室は開かない（逆も同じ）。

   ※ 画面を出す前の目隠しであって、本格的な鍵ではない
     （このページの中身を見れば番号が分かってしまう）。
     人に見られたくない内容や、お金・個人情報そのものはここに置かないこと。
   ※ 解錠状態はタブを閉じるまで（sessionStorage）。ブラウザを閉じればまた番号を聞く。
   ============================================================ */

export const PRESIDENT_PASSCODE = "000";
export const PRESIDENT_CODE_LENGTH = PRESIDENT_PASSCODE.length;
export const PRESIDENT_UNLOCK_KEY = "africaheart-president-unlocked";

/** すでに解錠しているか（読めないときは未解錠として扱う）。 */
export function isPresidentUnlocked(): boolean {
  try {
    return sessionStorage.getItem(PRESIDENT_UNLOCK_KEY) === "1";
  } catch {
    return false; // 読めなくても続行（番号を聞くだけ）
  }
}

/** 番号が合っていれば解錠して true。保存できなくても解錠は有効。 */
export function unlockPresident(input: string): boolean {
  if (input.trim() !== PRESIDENT_PASSCODE) return false;
  try {
    sessionStorage.setItem(PRESIDENT_UNLOCK_KEY, "1");
  } catch {
    /* 保存できなくても解錠は有効 */
  }
  return true;
}

/** 番号の入力に戻す。 */
export function lockPresident(): void {
  try {
    sessionStorage.removeItem(PRESIDENT_UNLOCK_KEY);
  } catch {
    /* no-op */
  }
}
