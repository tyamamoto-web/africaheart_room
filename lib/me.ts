"use client";

/* ============================================================
   この端末を使っている人の名前（＝会員名簿の中の自分）
   ------------------------------------------------------------
   出欠席を自分で出すには、まず「自分がどの名前か」が要る。
   このアプリにログインは無いので、名簿から一度選んでもらい、
   その端末に覚えておく。ほかの人には送らない（共有しない）。

   デュエットのニックネーム（africaheart_nickname）とは別に持つ。
   あちらは自由に打つ名前で、こちらは名簿にある名前そのものだから。
   ただし、打ってある名前が名簿とぴったり同じなら、選ぶ手間を
   省けるので最初の候補として使う（覚え直しはしない）。
   ============================================================ */

import { getNickname } from "./duet";

const ME_KEY = "africaheart_me_v1";

/** 覚えてある自分の名前。まだ選んでいなければ空。 */
export function readMe(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(ME_KEY) ?? "";
  } catch {
    return "";
  }
}

/** 自分の名前を覚える。空を渡すと忘れる。 */
export function saveMe(name: string): void {
  if (typeof window === "undefined") return;
  try {
    const t = name.trim();
    if (t) localStorage.setItem(ME_KEY, t);
    else localStorage.removeItem(ME_KEY);
  } catch {
    /* 端末が覚えられない設定でも、画面は止めない */
  }
}

/**
 * 名簿を見て、自分の名前を決める。
 * 覚えてあるものが名簿にまだ居ればそれ。居なければ（名簿から消えた・
 * 名前が変わった）空に戻す。覚えていないときは、デュエットに打ってある
 * 名前が名簿とぴったり同じ場合だけ、それを候補にする。
 */
export function resolveMe(names: string[]): string {
  const saved = readMe();
  if (saved && names.includes(saved)) return saved;
  const nick = getNickname().trim();
  if (nick && names.includes(nick)) return nick;
  return "";
}
