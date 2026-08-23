"use client";

/* ============================================================
   メンバープロフィール（自己紹介・近況）：Supabase(REST) データ層（依存ライブラリ不要）
   ------------------------------------------------------------
   メンバーの自己紹介と近況コメントを全員で共有・永続化する。
   テーブル: member_profiles（SQLは supabase/setup.sql）
   端末ID・ニックネームのユーティリティは lib/duet.ts のものを流用。
   ============================================================ */

const SUPA_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gdajpgbfngvigrdbiwsw.supabase.co";
const SUPA_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_MBRlmw3t4j58uDQkWJ92Ng_xglG2rB0";

const ENDPOINT = `${SUPA_URL}/rest/v1/member_profiles`;

export function isProfilesConfigured(): boolean {
  return !!(SUPA_URL && SUPA_KEY);
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPA_KEY ?? "",
    Authorization: `Bearer ${SUPA_KEY ?? ""}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export type Profile = {
  id: string;
  name: string;
  intro: string; // 自己紹介
  fav: string; // 好きな曲・アーティスト（任意）
  status: string; // 近況コメント
  birth_month: number | null; // 誕生月（任意・1〜12）。未設定は null
  updated_at: string;
};

/** テーブル未作成（セットアップ未実施）を表すエラー */
export class ProfileSetupError extends Error {
  constructor(message = "member_profiles テーブルが未作成です") {
    super(message);
    this.name = "ProfileSetupError";
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

/** 全メンバーのプロフィールを取得（登録順） */
export async function listProfiles(): Promise<Profile[]> {
  const order = "&order=created_at.asc";
  let res = await fetch(
    `${ENDPOINT}?select=id,name,intro,fav,status,birth_month,updated_at${order}`,
    { headers: headers(), cache: "no-store" }
  );
  // birth_month 列が未追加でも壊れないよう、その列だけ外して再取得
  // 注意: 列欠落エラー文にも "does not exist" が含まれるため、列判定を先に行う
  if (!res.ok) {
    const txt = await readText(res);
    if (/birth_month/i.test(txt)) {
      res = await fetch(
        `${ENDPOINT}?select=id,name,intro,fav,status,updated_at${order}`,
        { headers: headers(), cache: "no-store" }
      );
    } else if (looksMissingTable(res.status, txt)) {
      throw new ProfileSetupError();
    }
  }
  if (!res.ok) {
    const txt = await readText(res);
    if (looksMissingTable(res.status, txt)) throw new ProfileSetupError();
    throw new Error(`プロフィールの取得に失敗しました (${res.status})`);
  }
  const rows = (await res.json()) as Array<Partial<Profile>>;
  return Array.isArray(rows)
    ? rows.map((r) => ({
        id: String(r.id ?? ""),
        name: r.name ?? "",
        intro: r.intro ?? "",
        fav: r.fav ?? "",
        status: r.status ?? "",
        birth_month: typeof r.birth_month === "number" ? r.birth_month : null,
        updated_at: r.updated_at ?? "",
      }))
    : [];
}

/** 直近の更新時刻（＝最後に誰かがプロフィールを追加/編集した時刻）を取得。無ければ "" */
export async function getLatestUpdatedAt(): Promise<string> {
  const res = await fetch(`${ENDPOINT}?select=updated_at&order=updated_at.desc&limit=1`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await readText(res);
    if (looksMissingTable(res.status, txt)) throw new ProfileSetupError();
    throw new Error(`更新状況の取得に失敗しました (${res.status})`);
  }
  const rows = (await res.json()) as Array<{ updated_at?: string }>;
  return Array.isArray(rows) && rows[0]?.updated_at ? rows[0].updated_at : "";
}

// birth_month 列が未作成でも壊れないよう、エラー時はその列を外して再送する
async function sendWithBirthFallback(
  method: "POST" | "PATCH",
  url: string,
  body: Record<string, unknown>,
  failMsg: string
): Promise<void> {
  const send = (b: Record<string, unknown>) =>
    fetch(url, { method, headers: headers({ Prefer: "return=minimal" }), body: JSON.stringify(b) });
  let res = await send(body);
  // 注意: 列欠落エラー文にも "does not exist" が含まれるため、列判定を先に行う
  if (!res.ok && "birth_month" in body) {
    const txt = await readText(res);
    if (/birth_month/i.test(txt)) {
      const { birth_month: _omit, ...rest } = body;
      void _omit;
      res = await send(rest);
    } else if (looksMissingTable(res.status, txt)) {
      throw new ProfileSetupError();
    }
  }
  if (!res.ok) {
    const txt = await readText(res);
    if (looksMissingTable(res.status, txt)) throw new ProfileSetupError();
    throw new Error(`${failMsg} (${res.status})`);
  }
}

/** メンバーを追加 */
export async function addProfile(input: {
  name: string;
  intro: string;
  fav: string;
  status: string;
  birth_month: number | null;
  owner_id: string;
}): Promise<void> {
  await sendWithBirthFallback("POST", ENDPOINT, { ...input }, "プロフィールの追加に失敗しました");
}

/** プロフィールを更新（自己紹介・近況・誕生月など） */
export async function updateProfile(
  id: string,
  patch: Partial<Pick<Profile, "name" | "intro" | "fav" | "status" | "birth_month">>
): Promise<void> {
  await sendWithBirthFallback(
    "PATCH",
    `${ENDPOINT}?id=eq.${id}`,
    { ...patch, updated_at: new Date().toISOString() },
    "プロフィールの更新に失敗しました"
  );
}

/** メンバーを削除 */
export async function deleteProfile(id: string): Promise<void> {
  const res = await fetch(`${ENDPOINT}?id=eq.${id}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) {
    const txt = await readText(res);
    if (looksMissingTable(res.status, txt)) throw new ProfileSetupError();
    throw new Error(`プロフィールの削除に失敗しました (${res.status})`);
  }
}
