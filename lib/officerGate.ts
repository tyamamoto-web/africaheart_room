"use client";

/* ============================================================
   役員だけに見せたい画面の合言葉
   ------------------------------------------------------------
   役員専用タブ・役員専用2タブ・参加者アンケートの「みんなの回答」で共通に使う。
   どれか1つを開ければ、同じタブのあいだは他も開く。

   ※ 画面を出す前の目隠しであって、本格的な鍵ではない
     （このページの中身を見れば合言葉が分かってしまう）。
     人に見られたくない内容や、お金・個人情報そのものはここに置かないこと。
   ※ 解錠状態はタブを閉じるまで（sessionStorage）。ブラウザを閉じればまた合言葉を聞く。
   ============================================================ */

export const OFFICER_PASSCODE = "810";
export const OFFICER_UNLOCK_KEY = "africaheart-officer-unlocked";

/** すでに解錠しているか（読めないときは未解錠として扱う）。 */
export function isOfficerUnlocked(): boolean {
  try {
    return sessionStorage.getItem(OFFICER_UNLOCK_KEY) === "1";
  } catch {
    return false; // 読めなくても続行（合言葉を聞くだけ）
  }
}

/** 合言葉が合っていれば解錠して true。保存できなくても解錠は有効。 */
export function unlockOfficer(input: string): boolean {
  if (input.trim() !== OFFICER_PASSCODE) return false;
  try {
    sessionStorage.setItem(OFFICER_UNLOCK_KEY, "1");
  } catch {
    /* 保存できなくても解錠は有効 */
  }
  return true;
}

/** 合言葉の入力に戻す。 */
export function lockOfficer(): void {
  try {
    sessionStorage.removeItem(OFFICER_UNLOCK_KEY);
  } catch {
    /* no-op */
  }
}
