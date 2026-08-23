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
  part?: string; // 歌ってほしいパート（任意）。DB列 part が必要
  owner_id: string;
  owner_name: string;
  likes: string[]; // "端末ID<US>名前" 形式の配列
  created_at: string;
};

// Supabase 接続情報。環境変数があれば優先、なければ既定値（公開用キー）を使用。
// ※ sb_publishable_ キーはクライアントに公開される前提のキー。アクセス制御はRLSで担保。
const SUPA_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gdajpgbfngvigrdbiwsw.supabase.co";
const SUPA_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_MBRlmw3t4j58uDQkWJ92Ng_xglG2rB0";

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

// part列が未作成でも壊れないよう、エラー時はpartを外して再送する
async function sendWithPartFallback(
  method: "POST" | "PATCH",
  url: string,
  body: Record<string, unknown>
): Promise<void> {
  const send = (b: Record<string, unknown>) =>
    fetch(url, { method, headers: headers({ Prefer: "return=minimal" }), body: JSON.stringify(b) });
  let res = await send(body);
  if (!res.ok && "part" in body) {
    let txt = "";
    try {
      txt = await res.text();
    } catch {}
    if (/part/i.test(txt)) {
      const { part: _omit, ...rest } = body;
      void _omit;
      res = await send(rest);
    }
  }
  if (!res.ok) throw new Error(`保存に失敗しました (${res.status})`);
}

export async function addSong(input: {
  title: string;
  artist: string;
  key_offset: number;
  owner_id: string;
  owner_name: string;
  part?: string;
}): Promise<void> {
  await sendWithPartFallback("POST", endpoint(), { ...input, part: input.part ?? "", likes: [] });
}

export async function updateSong(
  id: string,
  patch: Partial<Pick<DuetSong, "title" | "artist" | "key_offset" | "likes" | "part">>
): Promise<void> {
  await sendWithPartFallback("PATCH", `${endpoint()}?id=eq.${id}`, patch);
}

export async function deleteSong(id: string): Promise<void> {
  const res = await fetch(`${endpoint()}?id=eq.${id}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) throw new Error(`削除に失敗しました (${res.status})`);
}

// 1曲の最新 likes を取得（同時押しでの取りこぼし防止のため、更新直前に読む）
export async function getLikes(id: string): Promise<string[]> {
  const res = await fetch(`${endpoint()}?id=eq.${id}&select=likes`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`いいねの取得に失敗しました (${res.status})`);
  const rows = (await res.json()) as Array<{ likes?: string[] }>;
  return Array.isArray(rows) && rows[0] ? rows[0].likes ?? [] : [];
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

/* ── いいね（端末ID＋名前を1要素にエンコードして text[] に保存）──
   1要素 = "端末ID<US>名前"。スキーマ変更不要で「誰がいいねしたか」を保持。 */
const LIKE_SEP = String.fromCharCode(31); // Unit Separator（名前に出現しない区切り）

export function makeLike(id: string, name: string): string {
  const clean = (name || "").split(LIKE_SEP).join("").trim();
  return `${id}${LIKE_SEP}${clean}`;
}
export function likeId(entry: string): string {
  return entry.split(LIKE_SEP)[0];
}
export function likeName(entry: string): string {
  return entry.split(LIKE_SEP).slice(1).join(LIKE_SEP);
}
export function hasLiked(likes: string[], id: string): boolean {
  return likes.some((e) => likeId(e) === id);
}
export function likerNames(likes: string[]): string[] {
  return likes.map(likeName).map((n) => n.trim()).filter(Boolean);
}
