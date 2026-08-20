"use client";

/* ============================================================
   実際の部屋番号（当日の会場のルーム番号）：Supabase(REST) データ層
   ------------------------------------------------------------
   A/B/C の3部屋に、当日リーダーが実際の部屋番号（例「305」「大部屋」）を
   登録して全員で共有する。会場のA/B/Cは終日同じ物理部屋なので、
   コマに依らず1つの割当を全コマ表のヘッダーに表示する。

   ★ SQL不要（新テーブルを作らない）:
     既存の共有テーブル `homework_result` を間借りする。宿題機能は id=1 の
     1行しか読み書きしないため、本機能は別の行 id=2 を使う（衝突しない）。
     A/B/C の番号は既存の themes(text[]) 列に [A, B, C] の3要素で保存する。

   ★ 前回の番号が次回に出てしまわないように、4要素目へ「どの回の番号か」を書く:
     themes = [A, B, C, その回の日付]。読むときに今回の日付と違えば番号は空で返す。
     （行は1つしか無いので、書き換えないかぎり先月の番号が残り続けるため。
       4要素目が無い古いデータは「どの回か不明」＝空扱いになる。列は増やしていない）
   ※ 表示専用。部屋割り(誰がどの部屋か=rotations)や同席計算には影響しない。
   ============================================================ */

import { nextEvent } from "./data";

/** いま募集している回の識別子。日付の文字列をそのまま使う（回が変われば自動で変わる）。 */
const EVENT_KEY = nextEvent.date;

const SUPA_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://klwfhpyftnirkxxcmjff.supabase.co";
const SUPA_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_7xk88rvHPopcdMd9MyyE_A_XKvS1MIi";

// 宿題結果と同じテーブルを共用。宿題は id=1、部屋番号は id=2。
const ENDPOINT = `${SUPA_URL}/rest/v1/homework_result`;
const ROW_ID = 2; // 部屋番号は常にこの行を読み書きする（宿題の id=1 とは別）

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPA_KEY ?? "",
    Authorization: `Bearer ${SUPA_KEY ?? ""}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export type RoomNumbers = {
  A: string;
  B: string;
  C: string;
  updatedBy: string;
  updatedAt: string;
  /** 保存されていた番号がどの回のものか。今回のものでなければ A/B/C は空で返す。 */
  eventKey: string;
};

export const EMPTY_ROOM_NUMBERS: RoomNumbers = {
  A: "",
  B: "",
  C: "",
  updatedBy: "",
  updatedAt: "",
  eventKey: "",
};

/**
 * 互換のため残置。SQL不要（既存テーブル利用）になったため通常は投げられない。
 * 管理画面が import しているので export は維持する。
 */
export class RoomNumbersSetupError extends Error {
  constructor(message = "共有テーブルが利用できません") {
    super(message);
    this.name = "RoomNumbersSetupError";
  }
}

async function readText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

// themes(text[]) の [A,B,C,回] を復号（欠けている要素は空文字）
function decode(themes: unknown): { A: string; B: string; C: string; eventKey: string } {
  const arr = Array.isArray(themes) ? themes : [];
  const at = (i: number) => (typeof arr[i] === "string" ? (arr[i] as string).trim() : "");
  return { A: at(0), B: at(1), C: at(2), eventKey: at(3) };
}

/**
 * 共有中の部屋番号を取得。
 * 表示側（全メンバー）で使うため、未設定・失敗時も例外を投げず空で返す
 * （＝ヘッダーには A/B/C だけ表示される）。
 * 保存されているのが前回の回の番号だった場合も、A/B/C は空で返す
 * （前回の部屋番号を今回のものとして読まれないようにするため）。
 */
export async function getRoomNumbers(): Promise<RoomNumbers> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?id=eq.${ROW_ID}&select=themes,updated_by,updated_at`, {
      headers: headers(),
      cache: "no-store",
    });
  } catch {
    return EMPTY_ROOM_NUMBERS; // ネットワーク不通時も表示は維持
  }
  if (!res.ok) return EMPTY_ROOM_NUMBERS; // 失敗時も表示優先で空返し
  const rows = (await res.json()) as Array<{
    themes?: unknown;
    updated_by?: string;
    updated_at?: string;
  }>;
  const row = Array.isArray(rows) ? rows[0] : undefined;
  const { A, B, C, eventKey } = decode(row?.themes);
  // 今回の回として保存されたものだけを番号として返す（前回の番号は空にする）
  const mine = eventKey === EVENT_KEY;
  return {
    A: mine ? A : "",
    B: mine ? B : "",
    C: mine ? C : "",
    updatedBy: row?.updated_by ?? "",
    updatedAt: row?.updated_at ?? "",
    eventKey,
  };
}

/**
 * 部屋番号を保存（id=2 を upsert。全員に共有される）。管理画面とTOPの部屋割り表から呼ぶ。
 * A/B/C に加えて「どの回の番号か」を themes=[A,B,C,回] の4要素目として保存する。
 */
export async function saveRoomNumbers(
  next: { A: string; B: string; C: string },
  by: string
): Promise<void> {
  const body = {
    id: ROW_ID,
    themes: [next.A.trim(), next.B.trim(), next.C.trim(), EVENT_KEY],
    updated_by: by,
    updated_at: new Date().toISOString(),
  };
  const res = await fetch(`${ENDPOINT}?on_conflict=id`, {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await readText(res);
    throw new Error(`部屋番号の保存に失敗しました (${res.status}) ${txt.slice(0, 120)}`);
  }
}
