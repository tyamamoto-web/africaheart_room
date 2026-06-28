"use client";

/* ============================================================
   デュエット曲リスト：Supabase(REST) データ層（依存ライブラリ不要）
   環境変数:
     NEXT_PUBLIC_SUPABASE_URL
     NEXT_PUBLIC_SUPABASE_ANON_KEY
   テーブル: duet_songs（SQLはセットアップ手順参照）
   ============================================================ */

export type DuetSong = {
  id: string;
  title: string;
  artist: string;
  key_offset: number; // -3 〜 +3
  owner_id: string;
  owner_name: string;
  likes: string[]; // いいねした端末IDの配列
  created_at: string;
};

// Supabase 接続情報。環境変数があれば優先、なければ既定値（公開用キー）を使用。
// ※ sb_publishable_ キーはクライアントに公開される前提のキー。アクセス制御はRLSで担保。
const SUPA_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://klwfhpyftnirkxxcmjff.supabase.co";
const SUPA_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_7xk88rvHPopcdMd9MyyE_A_XKvS1MIi";

export function isDuetConfigured(): boolean {
  return !!(SUPA_URL && SUPA_KEY);
}

const endpoint = () => `${SUPA_URL}/rest/v1/duet_songs`;
function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPA_KEY ?? "",
    Authorization: `Bearer ${SUPA_KEY ?? ""}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function listSongs(): Promise<DuetSong[]> {
  const res = await fetch(`${endpoint()}?select=*&order=created_at.asc`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`一覧の取得に失敗しました (${res.status})`);
  return res.json();
}

export async function addSong(input: {
  title: string;
  artist: string;
  key_offset: number;
  owner_id: string;
  owner_name: string;
}): Promise<void> {
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify({ ...input, likes: [] }),
  });
  if (!res.ok) throw new Error(`追加に失敗しました (${res.status})`);
}

export async function updateSong(
  id: string,
  patch: Partial<Pick<DuetSong, "title" | "artist" | "key_offset" | "likes">>
): Promise<void> {
  const res = await fetch(`${endpoint()}?id=eq.${id}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`更新に失敗しました (${res.status})`);
}

export async function deleteSong(id: string): Promise<void> {
  const res = await fetch(`${endpoint()}?id=eq.${id}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) throw new Error(`削除に失敗しました (${res.status})`);
}

/* ── 端末ID・ニックネーム（localStorage）──────────────── */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("africaheart_device_id");
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `d_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("africaheart_device_id", id);
  }
  return id;
}

export function getNickname(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("africaheart_nickname") ?? "";
}
export function setNickname(name: string): void {
  if (typeof window !== "undefined") localStorage.setItem("africaheart_nickname", name);
}

export function keyLabel(n: number): string {
  if (n === 0) return "±0";
  return n > 0 ? `+${n}` : `${n}`;
}
