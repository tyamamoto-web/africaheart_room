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
   ※ 表示専用。部屋割り(誰がどの部屋か=rotations)や同席計算には影響しない。
   ============================================================ */

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
};

export const EMPTY_ROOM_NUMBERS: RoomNumbers = {
  A: "",
  B: "",
  C: "",
  updatedBy: "",
  updatedAt: "",
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

// themes(text[]) の [A,B,C] を {A,B,C} へ復号（欠けている要素は空文字）
function decode(themes: unknown): { A: string; B: string; C: string } {
  const arr = Array.isArray(themes) ? themes : [];
  const at = (i: number) => (typeof arr[i] === "string" ? (arr[i] as string).trim() : "");
  return { A: at(0), B: at(1), C: at(2) };
}

/**
 * 共有中の部屋番号を取得。
 * 表示側（全メンバー）で使うため、未設定・失敗時も例外を投げず空で返す
 * （＝ヘッダーには A/B/C だけ表示される）。
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
  const { A, B, C } = decode(row?.themes);
  return { A, B, C, updatedBy: row?.updated_by ?? "", updatedAt: row?.updated_at ?? "" };
}

/**
 * 部屋番号を保存（id=2 を upsert。全員に共有される）。管理画面から呼ぶ。
 * A/B/C を themes=[A,B,C] として保存する。
 */
export async function saveRoomNumbers(
  next: { A: string; B: string; C: string },
  by: string
): Promise<void> {
  const body = {
    id: ROW_ID,
    themes: [next.A.trim(), next.B.trim(), next.C.trim()],
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
