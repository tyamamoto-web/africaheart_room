"use client";

/* ============================================================
   ギャラリー：Supabase Storage のデータ層（依存ライブラリ不要）
   ------------------------------------------------------------
   オフ会当日の写真・動画を、運営スタッフが各自の端末から入れて、
   参加者が自分の端末で見る／保存するための土台。

   ★ 置き場所
     本体は Supabase Storage の `gallery` バケット。GoogleDriveは控え（手で入れる）。
     バケットは画面からは作れないので、初回だけダッシュボードで作る（README代わりに
     下の「準備」を参照）。SQLは実行しない・新しいテーブルも作らない。

   ★ 撮影シーンはフォルダで表す（DBを使わずに並び順と見出しを作るため）
       gallery/2026-08-22/koma1/1755840000000-a1b2c3.jpg
               ~~~~~~~~~~ 回      ~~~~~ シーン  ~~~~~~~~~~~~~ 撮影時刻-乱数
     ファイル名の先頭に撮影時刻(ms)を入れてあるので、名前順＝時刻順になる。
     乱数は、同じ瞬間に撮った別々の写真がぶつからないようにするため。

   ★ 準備（初回だけ・Supabaseのダッシュボードで）
     1. Storage → New bucket → 名前 `gallery` / Public bucket を ON
     2. そのバケットのポリシーで anon に select/insert/delete を許可
     ポリシーが無いと、見るのも入れるのもできない（画面には「準備がまだ」と出る）。

   ※ service_role は使わない。publishable key はクライアントに置く前提（公開されている）。
   ※ 公開バケットなので、URLを知っていれば誰でも見られる。人に見せたくないものは置かない。
   ============================================================ */

import { nextEvent, karaokeRooms } from "./data";

const SUPA_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://klwfhpyftnirkxxcmjff.supabase.co";
const SUPA_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_7xk88rvHPopcdMd9MyyE_A_XKvS1MIi";

/** Storageのバケット名。ダッシュボードで作る名前とそろえること。 */
export const GALLERY_BUCKET = "gallery";

const OBJECT = `${SUPA_URL}/storage/v1/object`;

export function isGalleryConfigured(): boolean {
  return !!(SUPA_URL && SUPA_KEY);
}

/* ── 回（イベント）ごとのフォルダ ───────────────────── */

// "2026年8月22日（土）" → "2026-08-22"。フォルダ名に使うのでASCIIに直す。
// lib/data.ts の nextEvent.date から作るので、回が変わればフォルダも自動で変わる
// （前回の写真が次回に混ざらない）。日付の書式が変わって読めないときは misc へ逃がす。
function eventKeyFrom(label: string): string {
  const m = label.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) return "misc";
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}
export const GALLERY_EVENT = eventKeyFrom(nextEvent.date);

/* ── 撮影シーン（一覧の見出し＝フォルダ）───────────── */

export type Scene = { id: string; label: string };

/**
 * 並び順がそのまま一覧の並び順になる。カラオケの枠は lib/data.ts の
 * karaokeRooms.slots から作るので、予定を直せばギャラリーの見出しも一緒に変わる。
 */
export const SCENES: Scene[] = [
  { id: "meet", label: "集合" },
  ...karaokeRooms.slots.map((s) => ({ id: s.id, label: s.label })),
  { id: "yakiniku", label: "焼肉パーティー" },
  { id: "hanabi", label: "サマーナイト花火" },
  { id: "bar", label: "カラオケバー ミルユッテ" },
  { id: "other", label: "その他" },
];

export function sceneLabel(id: string): string {
  return SCENES.find((s) => s.id === id)?.label ?? "その他";
}

// 一覧の並び替えに使う。SCENESに無いフォルダ（手で足したものなど）は最後へ。
function sceneOrder(id: string): number {
  const i = SCENES.findIndex((s) => s.id === id);
  return i < 0 ? SCENES.length : i;
}

/* ── 中身の型 ───────────────────────────────────── */

export type GalleryItem = {
  path: string; // バケット内のフルパス（削除に使う）
  name: string; // ファイル名
  sceneId: string;
  kind: "photo" | "video";
  url: string; // 公開URL（そのまま img/video のsrcに使える）
  thumbUrl: string; // 一覧用の小さいJPEGのURL（無いときは url に落とす）
  takenAt: number; // 撮影時刻(ms)。ファイル名の先頭から読む
  size: number; // バイト数
};

/** バケットやポリシーがまだ無いことを表すエラー（画面で案内を出し分ける） */
export class GallerySetupError extends Error {
  constructor(message = "ギャラリーの置き場所（gallery バケット）がまだありません") {
    super(message);
    this.name = "GallerySetupError";
  }
}

const VIDEO_EXT = new Set(["mp4", "mov", "m4v", "webm", "3gp"]);

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPA_KEY ?? "",
    Authorization: `Bearer ${SUPA_KEY ?? ""}`,
    ...extra,
  };
}

export function publicUrl(path: string): string {
  return `${OBJECT}/public/${GALLERY_BUCKET}/${path}`;
}

/**
 * 一覧用の小さい画像の置き場所。中身のとなりの thumbs/ に、拡張子を .jpg にして置く。
 * 動画も1コマ取り出して同じところに置くので、一覧では写真も動画も同じ扱いで並べられる。
 * thumbs はフォルダなので、一覧を読むときは自動で除かれる（フォルダは id=null で返るため）。
 */
function thumbPathFor(sceneId: string, name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return `${GALLERY_EVENT}/${sceneId}/thumbs/${base}.jpg`;
}

async function readText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function looksMissingBucket(txt: string): boolean {
  return /NoSuchBucket|Bucket not found/i.test(txt);
}

/* ── 読む ───────────────────────────────────────── */

type ListRow = {
  name: string;
  id: string | null; // フォルダは null で返る（ファイルだけを拾うのに使う）
  metadata?: { size?: number; mimetype?: string } | null;
};

async function listPrefix(prefix: string): Promise<ListRow[]> {
  const res = await fetch(`${SUPA_URL}/storage/v1/object/list/${GALLERY_BUCKET}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    cache: "no-store",
    body: JSON.stringify({
      prefix,
      limit: 1000,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    }),
  });
  if (!res.ok) {
    const txt = await readText(res);
    if (looksMissingBucket(txt)) throw new GallerySetupError();
    throw new Error(`一覧の取得に失敗しました (${res.status})`);
  }
  const body = (await res.json()) as unknown;
  return Array.isArray(body) ? (body as ListRow[]) : [];
}

function toItem(sceneId: string, row: ListRow): GalleryItem {
  const ext = (row.name.split(".").pop() || "").toLowerCase();
  const mime = row.metadata?.mimetype || "";
  const kind: GalleryItem["kind"] =
    mime.startsWith("video/") || VIDEO_EXT.has(ext) ? "video" : "photo";
  const ts = Number(row.name.split("-")[0]);
  const path = `${GALLERY_EVENT}/${sceneId}/${row.name}`;
  return {
    path,
    name: row.name,
    sceneId,
    kind,
    url: publicUrl(path),
    thumbUrl: publicUrl(thumbPathFor(sceneId, row.name)),
    takenAt: Number.isFinite(ts) && ts > 0 ? ts : 0,
    size: row.metadata?.size ?? 0,
  };
}

/**
 * 今回の回のぶんを全部読む。
 * Storageの一覧は1階層ずつしか返らないので、まずシーンのフォルダを調べ、
 * つぎに各フォルダの中身をまとめて取りにいく（フォルダの数だけ並列）。
 */
export async function listGallery(): Promise<GalleryItem[]> {
  const folders = await listPrefix(`${GALLERY_EVENT}/`);
  const sceneIds = folders.filter((r) => r.id === null).map((r) => r.name);
  const chunks = await Promise.all(
    sceneIds.map(async (sid) => {
      const rows = await listPrefix(`${GALLERY_EVENT}/${sid}/`);
      // Supabaseが空フォルダを保つために置く .emptyFolderPlaceholder は除く
      return rows
        .filter((r) => r.id !== null && !r.name.startsWith("."))
        .map((r) => toItem(sid, r));
    })
  );
  return chunks.flat().sort((a, b) => {
    const s = sceneOrder(a.sceneId) - sceneOrder(b.sceneId);
    return s !== 0 ? s : a.takenAt - b.takenAt;
  });
}

/* ── 書く ───────────────────────────────────────── */

function randomTag(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 6);
  }
  return Math.random().toString(36).slice(2, 8);
}

export type UploadInput = {
  blob: Blob;
  ext: string; // 拡張子（ドット無し）
  contentType: string; // 配信時のMIME。動画は video/mp4 にそろえる（下の説明を参照）
  takenAt: number; // 撮影時刻(ms)。並び順に使う
  sceneId: string;
  thumb?: Blob; // 一覧用の小さいJPEG（作れていれば一緒に置く）
};

/**
 * 1件アップロードする。進み具合を出したいので fetch ではなく XHR を使う
 * （fetch はアップロードの進捗を取れない）。
 */
function putObject(
  path: string,
  blob: Blob,
  contentType: string,
  onProgress?: (ratio: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${OBJECT}/${GALLERY_BUCKET}/${path}`);
    xhr.setRequestHeader("apikey", SUPA_KEY ?? "");
    xhr.setRequestHeader("Authorization", `Bearer ${SUPA_KEY ?? ""}`);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.setRequestHeader("x-upsert", "false");
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
        return;
      }
      if (looksMissingBucket(xhr.responseText || "")) {
        reject(new GallerySetupError());
        return;
      }
      reject(new Error(`アップロードに失敗しました (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("アップロードに失敗しました（通信を確認してください）"));
    xhr.send(blob);
  });
}

/**
 * 1件アップロードする。進み具合を出したいので fetch ではなく XHR を使う
 * （fetch はアップロードの進捗を取れない）。
 * 一覧用の小さい画像は、本体が入ってから続けて置く。こちらは失敗しても
 * 全体を失敗にしない（一覧では本体を縮めて表示すればよいだけなので）。
 */
export async function uploadToGallery(
  input: UploadInput,
  onProgress?: (ratio: number) => void
): Promise<GalleryItem> {
  const name = `${input.takenAt}-${randomTag()}.${input.ext}`;
  const path = `${GALLERY_EVENT}/${input.sceneId}/${name}`;
  await putObject(path, input.blob, input.contentType, onProgress);
  if (input.thumb) {
    try {
      await putObject(thumbPathFor(input.sceneId, name), input.thumb, "image/jpeg");
    } catch {
      /* 小さい画像だけ失敗しても、本体は入っているので続行 */
    }
  }
  return {
    path,
    name,
    sceneId: input.sceneId,
    kind: input.contentType.startsWith("video/") ? "video" : "photo",
    url: publicUrl(path),
    thumbUrl: publicUrl(thumbPathFor(input.sceneId, name)),
    takenAt: input.takenAt,
    size: input.blob.size,
  };
}

async function removeObject(path: string): Promise<Response> {
  return fetch(`${OBJECT}/${GALLERY_BUCKET}/${path}`, {
    method: "DELETE",
    headers: headers(),
  });
}

/** 1件消す（運営が入れ間違えたときのため）。一覧用の小さい画像も一緒に消す。 */
export async function deleteFromGallery(item: GalleryItem): Promise<void> {
  const res = await removeObject(item.path);
  if (!res.ok) {
    const txt = await readText(res);
    if (looksMissingBucket(txt)) throw new GallerySetupError();
    throw new Error(`削除に失敗しました (${res.status})`);
  }
  try {
    await removeObject(thumbPathFor(item.sceneId, item.name));
  } catch {
    /* 小さい画像が残っても表示には出ない */
  }
}
