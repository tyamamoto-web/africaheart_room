"use client";

/* ============================================================
   イベント運営マニュアル：やること別の「役割」(RACI)を全員で共有：Supabase(REST) データ層
   ------------------------------------------------------------
   役員専用ページの表（lib/officerRaci.ts）と同じ考え方・同じ役割名を使う。
   違いは保存先の行だけ。役員専用＝id5 ／ このマニュアル＝id7 で、互いに影響しない。
   役割の定義（担当者/責任者/相談役/お知らせ）と対象の4人は officerRaci から読み込んで共通化する。

   ★ SQL不要（新テーブルを作らない）:
     既存の共有テーブル `homework_result` を間借りする。
     宿題=1 / 部屋番号=2 / リアクション=3 / MoSCoW=4 / 役員RACI=5 / 予備=6 / マニュアルRACI=7。
     各セルを themes(text[]) に「1件＝"taskId|person=role"」の文字列で格納する。
   ※ 書き込みは毎回「最新を再取得→該当セルだけ差し替え」でマージするため、
     同時に別のセルへ入力した他メンバーの変更を巻き込まない。
   ============================================================ */

import { RACI_PEOPLE, raciKey, type RaciRole } from "./officerRaci";

const SUPA_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gdajpgbfngvigrdbiwsw.supabase.co";
const SUPA_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_MBRlmw3t4j58uDQkWJ92Ng_xglG2rB0";

const ENDPOINT = `${SUPA_URL}/rest/v1/homework_result`;
const ROW_ID = 7; // マニュアルの役割（RACI）専用の行

/** キーは `${taskId}|${personId}`。値はその人のそのやることでの役割。 */
export type EventRaci = Record<string, RaciRole>;

const VALID_ROLE: RaciRole[] = ["r", "a", "c", "i"];
const VALID_PERSON = new Set(RACI_PEOPLE.map((p) => p.id));

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPA_KEY ?? "",
    Authorization: `Bearer ${SUPA_KEY ?? ""}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

// themes の1要素 "taskId|person=role" を [key, role] へ復号（不正はnull＝無視）
function parseEntry(s: unknown): [string, RaciRole] | null {
  if (typeof s !== "string") return null;
  const eq = s.indexOf("=");
  if (eq <= 0) return null;
  const left = s.slice(0, eq).trim();
  const role = s.slice(eq + 1).trim() as RaciRole;
  const bar = left.indexOf("|");
  if (bar <= 0) return null;
  const taskId = left.slice(0, bar).trim();
  const person = left.slice(bar + 1).trim();
  if (!taskId || !VALID_PERSON.has(person) || !VALID_ROLE.includes(role)) return null;
  return [raciKey(taskId, person), role];
}

function rawToRaci(raw: string[]): EventRaci {
  const map: EventRaci = {};
  for (const s of raw) {
    const e = parseEntry(s);
    if (e) map[e[0]] = e[1]; // 重複時は後の要素を採用
  }
  return map;
}
function raciToRaw(map: EventRaci): string[] {
  return Object.entries(map).map(([key, role]) => `${key}=${role}`);
}

// id=7 の themes を取得。失敗時は空配列（表示優先で例外を投げない）。
async function fetchRaw(): Promise<string[]> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?id=eq.${ROW_ID}&select=themes`, {
      headers: headers(),
      cache: "no-store",
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];
  const rows = (await res.json()) as Array<{ themes?: unknown }>;
  const arr =
    Array.isArray(rows) && Array.isArray(rows[0]?.themes) ? (rows[0]!.themes as unknown[]) : [];
  return arr.filter((x): x is string => typeof x === "string");
}

// 書き込みの土台に使う厳密版。読み取りに失敗したら例外を投げる（空を土台にして全消しする事故を防ぐ）。
async function fetchRawStrict(): Promise<string[]> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?id=eq.${ROW_ID}&select=themes`, {
      headers: headers(),
      cache: "no-store",
    });
  } catch {
    throw new Error("最新の取得に失敗しました（保存を中止しました）");
  }
  if (!res.ok) throw new Error(`最新の取得に失敗しました (${res.status})（保存を中止しました）`);
  const rows = (await res.json()) as Array<{ themes?: unknown }>;
  const arr =
    Array.isArray(rows) && Array.isArray(rows[0]?.themes) ? (rows[0]!.themes as unknown[]) : [];
  return arr.filter((x): x is string => typeof x === "string");
}

async function upsert(raw: string[]): Promise<void> {
  const body = {
    id: ROW_ID,
    themes: raw,
    updated_by: "",
    updated_at: new Date().toISOString(),
  };
  const res = await fetch(`${ENDPOINT}?on_conflict=id`, {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let txt = "";
    try {
      txt = await res.text();
    } catch {
      /* no-op */
    }
    throw new Error(`役割の保存に失敗しました (${res.status}) ${txt.slice(0, 120)}`);
  }
}

// 書き込みを直列化するキュー（officerPlan / officerRaci と同じ考え方）。
let writeChain: Promise<unknown> = Promise.resolve();
function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = writeChain.then(work, work);
  writeChain = run.then(() => undefined, () => undefined);
  return run;
}

/** 共有中の役割マップを取得（未設定・失敗時も例外を投げず空で返す）。 */
export async function getEventRaci(): Promise<EventRaci> {
  return rawToRaci(await fetchRaw());
}

/**
 * 1人×1つのやることの役割を設定/解除（全員に共有）。書き込み直前に最新を再取得してから
 * 該当セルだけ差し替えるため、他メンバーが別セルに付けた変更を巻き込まない。
 * role が null のときは解除。更新後の全マップを返す。
 */
export function setEventRaci(
  taskId: string,
  personId: string,
  role: RaciRole | null
): Promise<EventRaci> {
  return enqueue(async () => {
    const map = rawToRaci(await fetchRawStrict());
    const key = raciKey(taskId, personId);
    if (role === null) delete map[key];
    else map[key] = role;
    await upsert(raciToRaw(map));
    return map;
  });
}

/** 全員ぶんの役割をすべて消去（リセット）。 */
export function clearEventRaci(): Promise<void> {
  return enqueue(async () => {
    await upsert([]);
  });
}
