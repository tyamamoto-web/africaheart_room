"use client";

/* ============================================================
   メンバープロフィール（自己紹介・近況）：Supabase(REST) データ層（依存ライブラリ不要）
   ------------------------------------------------------------
   メンバーの自己紹介と近況コメントを全員で共有・永続化する。
   テーブル: member_profiles（SQLは supabase/setup.sql）
   端末ID・ニックネームのユーティリティは lib/duet.ts のものを流用。
   ============================================================ */

const SUPA_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://klwfhpyftnirkxxcmjff.supabase.co";
const SUPA_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_7xk88rvHPopcdMd9MyyE_A_XKvS1MIi";

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
  const res = await fetch(
    `${ENDPOINT}?select=id,name,intro,fav,status,updated_at&order=created_at.asc`,
    { headers: headers(), cache: "no-store" }
  );
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
        updated_at: r.updated_at ?? "",
      }))
    : [];
}

/** メンバーを追加 */
export async function addProfile(input: {
  name: string;
  intro: string;
  fav: string;
  status: string;
  owner_id: string;
}): Promise<void> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const txt = await readText(res);
    if (looksMissingTable(res.status, txt)) throw new ProfileSetupError();
    throw new Error(`プロフィールの追加に失敗しました (${res.status})`);
  }
}

/** プロフィールを更新（自己紹介・近況など） */
export async function updateProfile(
  id: string,
  patch: Partial<Pick<Profile, "name" | "intro" | "fav" | "status">>
): Promise<void> {
  const res = await fetch(`${ENDPOINT}?id=eq.${id}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    const txt = await readText(res);
    if (looksMissingTable(res.status, txt)) throw new ProfileSetupError();
    throw new Error(`プロフィールの更新に失敗しました (${res.status})`);
  }
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
