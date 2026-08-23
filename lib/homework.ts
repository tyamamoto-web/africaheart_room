"use client";

/* ============================================================
   宿題ルーレットの抽選結果：Supabase(REST) データ層（依存ライブラリ不要）
   ------------------------------------------------------------
   抽選で選ばれた3テーマを全員で共有・永続化するための単一行テーブル。
   テーブル: homework_result（id=1 の1行だけを使う / SQLは supabase/setup.sql）
   ※ 宿題リスト（候補）の方は各端末の localStorage に保存（共有しない）。
   ============================================================ */

const SUPA_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gdajpgbfngvigrdbiwsw.supabase.co";
const SUPA_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_MBRlmw3t4j58uDQkWJ92Ng_xglG2rB0";

const ENDPOINT = `${SUPA_URL}/rest/v1/homework_result`;
const ROW_ID = 1; // 共有する結果は常にこの1行を読み書きする

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPA_KEY ?? "",
    Authorization: `Bearer ${SUPA_KEY ?? ""}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export type Homework = { themes: string[]; updatedBy: string; updatedAt: string };

/** テーブル未作成（セットアップ未実施）を表すエラー */
export class HomeworkSetupError extends Error {
  constructor(message = "homework_result テーブルが未作成です") {
    super(message);
    this.name = "HomeworkSetupError";
  }
}

async function readText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
// テーブルが無いときの典型的なレスポンスを判定
function looksMissingTable(status: number, txt: string): boolean {
  return (
    status === 404 ||
    /42P01|does not exist|Could not find the table|relation .* does not exist/i.test(txt)
  );
}

/** 共有中の抽選結果を取得（未設定時は空配列の Homework を返さず例外） */
export async function getHomework(): Promise<Homework> {
  const res = await fetch(`${ENDPOINT}?id=eq.${ROW_ID}&select=themes,updated_by,updated_at`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await readText(res);
    if (looksMissingTable(res.status, txt)) throw new HomeworkSetupError();
    throw new Error(`宿題結果の取得に失敗しました (${res.status})`);
  }
  const rows = (await res.json()) as Array<{
    themes?: string[];
    updated_by?: string;
    updated_at?: string;
  }>;
  const row = Array.isArray(rows) ? rows[0] : undefined;
  return {
    themes: row?.themes ?? [],
    updatedBy: row?.updated_by ?? "",
    updatedAt: row?.updated_at ?? "",
  };
}

/** 抽選結果を保存（id=1 を upsert。全員に共有される） */
export async function saveHomework(themes: string[], by: string): Promise<void> {
  const body = {
    id: ROW_ID,
    themes,
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
    if (looksMissingTable(res.status, txt)) throw new HomeworkSetupError();
    throw new Error(`宿題結果の保存に失敗しました (${res.status})`);
  }
}

/* ── 宿題リスト（候補テーマ）：全員で共有・追加する行ごとのテーブル ──
   テーブル: homework_themes（id uuid, month smallint 1-12, text text, created_at）。
   (month, text) に unique を付け、同じ月の同じテーマは重複しない（月が違えば同名OK）。 */
const THEMES_ENDPOINT = `${SUPA_URL}/rest/v1/homework_themes`;

export type ThemeRow = { month: number; text: string };

export async function listThemes(): Promise<ThemeRow[]> {
  const res = await fetch(`${THEMES_ENDPOINT}?select=month,text&order=month.asc,created_at.asc`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await readText(res);
    if (looksMissingTable(res.status, txt)) throw new HomeworkSetupError();
    throw new Error(`宿題リストの取得に失敗しました (${res.status})`);
  }
  const rows = (await res.json()) as Array<{ month?: number; text?: string }>;
  return Array.isArray(rows)
    ? rows
        .filter((r) => typeof r.month === "number" && !!r.text)
        .map((r) => ({ month: r.month as number, text: r.text as string }))
    : [];
}

export async function addTheme(month: number, text: string): Promise<void> {
  // 衝突時は何もしない（ignore-duplicates）。merge=UPDATE は homework_themes に
  // UPDATE ポリシーが無く RLS で弾かれるため使わない（テーマは挿入/削除のみ）。
  const res = await fetch(`${THEMES_ENDPOINT}?on_conflict=month,text`, {
    method: "POST",
    headers: headers({ Prefer: "resolution=ignore-duplicates,return=minimal" }),
    body: JSON.stringify({ month, text }),
  });
  if (!res.ok) {
    const t = await readText(res);
    if (looksMissingTable(res.status, t)) throw new HomeworkSetupError();
    throw new Error(`テーマの追加に失敗しました (${res.status})`);
  }
}

export async function deleteTheme(month: number, text: string): Promise<void> {
  const res = await fetch(`${THEMES_ENDPOINT}?month=eq.${month}&text=eq.${encodeURIComponent(text)}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) {
    const t = await readText(res);
    if (looksMissingTable(res.status, t)) throw new HomeworkSetupError();
    throw new Error(`テーマの削除に失敗しました (${res.status})`);
  }
}
