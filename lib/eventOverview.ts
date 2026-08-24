"use client";

/* ============================================================
   オフ会の概要（開催日・時間・場所・部屋数・会費）：Supabase(REST) データ層
   ------------------------------------------------------------
   テーブル: event_overview（SQLは supabase/setup.sql）

   何のためのものか：
     これまで開催日や場所は lib/data.ts に直接書いてあり、書き換えられるのは
     作った人だけだった。ここに移すことで、役員が画面から書き換えられ、
     その結果を会員全員が、それぞれの端末で見られるようになる。

   【置き場所についての注意】
     いまこれを使っているのは社長室の「会員画面（案）」だけ。
     ただしそこは今後のUIUXを試すための場所で、いずれTOPページに移る。
     だからこのファイルは、どの画面から呼ばれるかを一切知らないようにしてある。
     移すときは、呼ぶ側を差し替えるだけでよい（このファイルは触らない）。

   値の持ち方：
     画面の入力欄にそのまま渡せるよう、すべて文字列で出し入れする。
     未入力は空文字。データベース側の null や "18:00:00" との行き来は
     このファイルの中だけで済ませる。

   ※ service_role は使わない。publishable key はクライアントに置く前提（公開されている）。
   ============================================================ */

const SUPA_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gdajpgbfngvigrdbiwsw.supabase.co";
const SUPA_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_MBRlmw3t4j58uDQkWJ92Ng_xglG2rB0";

const ENDPOINT = `${SUPA_URL}/rest/v1/event_overview`;

/** 画面で入れ替えられる項目。入力欄の並びもこの名前で作る。 */
export type OverviewField = "date" | "start" | "end" | "place" | "rooms" | "fee";

export type EventOverview = {
  /** 保存してある行の番号。まだ1行も無ければ null。 */
  id: number | null;
  date: string; // "2026-09-20"
  start: string; // "18:00"
  end: string; // "21:30"
  place: string;
  rooms: string; // "3"
  fee: string; // "4000"
};

export const EMPTY_OVERVIEW: EventOverview = {
  id: null,
  date: "",
  start: "",
  end: "",
  place: "",
  rooms: "",
  fee: "",
};

/** テーブルがまだ作られていないことを表すエラー（setup.sql の実行前）。 */
export class EventOverviewSetupError extends Error {
  constructor(message = "event_overview テーブルが未作成です") {
    super(message);
    this.name = "EventOverviewSetupError";
  }
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPA_KEY ?? "",
    Authorization: `Bearer ${SUPA_KEY ?? ""}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function readText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

// テーブルが無いときの典型的なレスポンスを判定（lib/profiles.ts と同じ見分け方）。
function looksMissingTable(status: number, txt: string): boolean {
  return (
    status === 404 ||
    /42P01|does not exist|Could not find the table|relation .* does not exist/i.test(txt)
  );
}

/** データベースの time（"18:00:00"）を、入力欄の形（"18:00"）にする。 */
function toInputTime(v: unknown): string {
  return typeof v === "string" ? v.slice(0, 5) : "";
}

/** 入力欄の空文字は、データベースには null で入れる（0 や空文字と区別するため）。 */
function orNull(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

/** 数を入れる欄の空文字も null に。数として読めないものも入れない。 */
function toIntOrNull(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function fromRow(row: Record<string, unknown>): EventOverview {
  return {
    id: typeof row.id === "number" ? row.id : null,
    date: typeof row.event_date === "string" ? row.event_date : "",
    start: toInputTime(row.start_time),
    end: toInputTime(row.end_time),
    place: typeof row.place === "string" ? row.place : "",
    rooms: row.rooms == null ? "" : String(row.rooms),
    fee: row.fee == null ? "" : String(row.fee),
  };
}

function toRow(v: EventOverview): Record<string, unknown> {
  return {
    event_date: v.date,
    start_time: orNull(v.start),
    end_time: orNull(v.end),
    place: v.place.trim(),
    rooms: toIntOrNull(v.rooms),
    fee: toIntOrNull(v.fee),
    updated_at: new Date().toISOString(),
  };
}

const SELECT = "id,event_date,start_time,end_time,place,rooms,fee";

/**
 * いま出すべき1回ぶんの概要を読む。
 * 開催日がいちばん新しい行を「今回のぶん」として扱う。
 * まだ1行も無ければ、空のものを返す（エラーにはしない）。
 */
export async function readEventOverview(): Promise<EventOverview> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?select=${SELECT}&order=event_date.desc&limit=1`, {
      headers: headers(),
      cache: "no-store",
    });
  } catch {
    throw new Error("概要の取得に失敗しました（通信を確認してください）");
  }
  if (!res.ok) {
    const txt = await readText(res);
    if (looksMissingTable(res.status, txt)) throw new EventOverviewSetupError();
    throw new Error(`概要の取得に失敗しました (${res.status})`);
  }
  const rows = (await res.json()) as Array<Record<string, unknown>>;
  const row = Array.isArray(rows) ? rows[0] : undefined;
  return row ? fromRow(row) : EMPTY_OVERVIEW;
}

/**
 * 概要を保存する。すでに行があればその行を書き換え、無ければ1行作る。
 * 開催日を変えたときも、行を増やさずその行を書き換える（同じ回のことなので）。
 * 戻り値は、保存した結果（新しく作った場合は行の番号が入る）。
 */
export async function saveEventOverview(v: EventOverview): Promise<EventOverview> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) {
    throw new Error("開催日を入れてください");
  }

  const url = v.id == null ? ENDPOINT : `${ENDPOINT}?id=eq.${v.id}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: v.id == null ? "POST" : "PATCH",
      headers: headers({ Prefer: "return=representation" }),
      body: JSON.stringify(toRow(v)),
    });
  } catch {
    throw new Error("保存に失敗しました（通信を確認してください）");
  }
  if (!res.ok) {
    const txt = await readText(res);
    if (looksMissingTable(res.status, txt)) throw new EventOverviewSetupError();
    throw new Error(`保存に失敗しました (${res.status}) ${txt.slice(0, 120)}`);
  }

  const rows = (await res.json()) as Array<Record<string, unknown>>;
  const row = Array.isArray(rows) ? rows[0] : undefined;
  // 書けたのに中身が返らないときは、送ったものをそのまま返す（画面を止めない）。
  return row ? fromRow(row) : v;
}
