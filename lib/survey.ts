"use client";

/* ============================================================
   参加者アンケート：設問と、みんなの回答：Supabase(REST) データ層
   ------------------------------------------------------------
   参加する方に事前の確認へ答えてもらい、答えは全員ぶんが集まって運営だけが見られる。

   ★ SQL不要（新テーブルを作らない）:
     共有テーブル `homework_result` の id=9 を間借りする（行の割り当ては lib/sharedRow.ts）。
     themes(text[]) の1要素＝1人ぶんの回答（JSON文字列）。
     同時保存で消し合わないための版くらべは lib/sharedRow.ts が受け持つ。

   ※ 設問はユーザーの指示があったものだけを並べる。ここで勝手に足さないこと。
   ============================================================ */

import { SHARED_ROW, readSharedLenient, writeSharedRow } from "./sharedRow";
import { nextEvent } from "./data";

const ROW_ID = SHARED_ROW.survey;

/** 選ぶ形の設問の選択肢。value は保存キーなので、一度決めたら変えない。 */
export type SurveyOption = {
  value: string;
  label: string; // 回答する画面に出す（長くてよい）
  short: string; // 運営の一覧に出す（短く）
};

/**
 * 設問の型。
 *   text   … 自由記入（答えは文字列）
 *   checks … あてはまるものすべてにチェック（答えは選んだ value の配列）
 *   choice … どれか1つをえらぶ（答えはえらんだ value の文字列）
 */
export type SurveyQuestion =
  | { id: string; label: string; kind: "text"; required: boolean; max: number }
  | { id: string; label: string; kind: "checks"; required: boolean; options: SurveyOption[] }
  | { id: string; label: string; kind: "choice"; required: boolean; options: SurveyOption[] };

/* 参加するところを選ぶ選択肢は、イベントの予定（lib/data.ts）から作る。
   joinKey が付いている項目だけが並ぶ（集合・移動・解散は参加の単位ではないので付いていない）。
   予定の時刻や名前を data.ts で直せば、この選択肢もそのまま追いかける。 */
const SCHEDULE_OPTIONS: SurveyOption[] = nextEvent.schedule
  .filter((s) => !!s.joinKey)
  .map((s) => ({ value: s.joinKey as string, label: `${s.time}　${s.title}`, short: s.title }));

/* 行き帰りの移動。運営で送迎はできないので、当日までに手当てが要る方を先に見つけるための設問。
   「できますか／できませんか」だけだと答えにくいので、行きと帰りを分けて言い切れる形にした。 */
const TRANSPORT_OPTIONS: SurveyOption[] = [
  { value: "both", label: "行き・帰りとも、自分で移動できます", short: "行き帰りとも自分で" },
  { value: "backOnly", label: "行きは自分で来られますが、帰りがまだ決まっていません", short: "帰りが未定" },
  { value: "goOnly", label: "帰りは自分で帰れますが、行きがまだ決まっていません", short: "行きが未定" },
  { value: "neither", label: "行き・帰りとも、まだ決まっていません", short: "行き帰りとも未定" },
];

/* お酒。少しでも飲めば「飲みます」なので、途中の段は作らず2つに分ける。
   飲まない方が答えにくくならないよう、飲めない／飲まない理由は聞かない。 */
const DRINK_OPTIONS: SurveyOption[] = [
  { value: "yes", label: "飲みます", short: "飲む" },
  { value: "no", label: "飲みません", short: "飲まない" },
];

/** 設問一覧。並んでいる順に画面へ出る。 */
export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  { id: "q1", label: "あなたの名前を教えてください", kind: "text", required: true, max: 40 },
  { id: "q2", label: "参加されるスケジュールにチェックをしてください", kind: "checks", required: true, options: SCHEDULE_OPTIONS },
  {
    id: "q3",
    label: "集合場所までの行きと、解散後の帰りは、ご自分で移動手段を用意できますか",
    kind: "choice",
    required: true,
    options: TRANSPORT_OPTIONS,
  },
  { id: "q4", label: "当日、お酒を飲まれますか", kind: "choice", required: true, options: DRINK_OPTIONS },
];

/** 答えの形。自由記入は文字列、チェックは選んだ value の配列。 */
export type SurveyValue = string | string[];

/** 1人ぶんの回答。id はこの端末を見分けるための不変値。 */
export type SurveyAnswer = {
  id: string;
  values: Record<string, SurveyValue>; // 設問id → 答え
  at: string; // 最後に書いた時刻（ISO）
};

/** 答えを画面に出す形にそろえる（一覧の表示と、書けているかの判定で使う）。 */
export function answerText(q: SurveyQuestion, v: SurveyValue | undefined): string {
  if (q.kind === "checks") {
    const chosen = Array.isArray(v) ? v : [];
    return q.options.filter((o) => chosen.includes(o.value)).map((o) => o.short).join("・");
  }
  if (q.kind === "choice") {
    return q.options.find((o) => o.value === v)?.short ?? "";
  }
  return typeof v === "string" ? v : "";
}

// この端末の見分け。名前ではなく端末につけるので、書き直すたびに増えず、同じ回答を上書きできる。
const DEVICE_KEY = "africaheart-survey-device";

export function surveyDeviceId(): string {
  try {
    const saved = localStorage.getItem(DEVICE_KEY);
    if (saved) return saved;
    const made = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(DEVICE_KEY, made);
    return made;
  } catch {
    // 保存できないときは、その場かぎりの見分け（書き直すと別の回答になる）
    return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}

export function emptyValues(): Record<string, SurveyValue> {
  const v: Record<string, SurveyValue> = {};
  for (const q of SURVEY_QUESTIONS) v[q.id] = q.kind === "checks" ? [] : "";
  return v;
}

/** 未回答・書き足りない設問（送る前の確認に使う）。チェックは1つも選んでいなければ未回答。 */
export function missingRequired(values: Record<string, SurveyValue>): SurveyQuestion[] {
  return SURVEY_QUESTIONS.filter((q) => {
    if (!q.required) return false;
    const v = values[q.id];
    if (q.kind === "checks") return !(Array.isArray(v) && v.length > 0);
    if (q.kind === "choice") return !(typeof v === "string" && q.options.some((o) => o.value === v));
    return !(typeof v === "string" && v.trim());
  });
}

// themes の1要素（JSON文字列）を1人ぶんの回答へ復号。壊れていたら null＝その要素は無視。
function parseAnswer(s: unknown): SurveyAnswer | null {
  if (typeof s !== "string") return null;
  let o: unknown;
  try {
    o = JSON.parse(s);
  } catch {
    return null;
  }
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.slice(0, 40) : "";
  if (!id) return null;

  const values: Record<string, SurveyValue> = {};
  const src = (r.values ?? {}) as Record<string, unknown>;
  for (const q of SURVEY_QUESTIONS) {
    const v = src[q.id];
    if (q.kind === "checks") {
      const allowed = new Set(q.options.map((o) => o.value));
      const arr = Array.isArray(v) ? v : [];
      // 選択肢に無い値は捨てる（設問を直したあとの古い答えが混ざらないように）
      values[q.id] = arr.filter((x): x is string => typeof x === "string" && allowed.has(x));
    } else if (q.kind === "choice") {
      values[q.id] = q.options.some((o) => o.value === v) ? (v as string) : "";
    } else {
      values[q.id] = typeof v === "string" ? v.slice(0, q.max) : "";
    }
  }
  return { id, values, at: typeof r.at === "string" ? r.at : "" };
}

function rawToAnswers(raw: string[]): SurveyAnswer[] {
  const out: SurveyAnswer[] = [];
  const seen = new Set<string>();
  for (const s of raw) {
    const a = parseAnswer(s);
    if (!a || seen.has(a.id)) continue; // 同じidが2件あれば先のほうを採用
    seen.add(a.id);
    out.push(a);
  }
  return out;
}

/** 全員ぶんの回答を取得（未設定・失敗時も例外を投げず空で返す）。 */
export async function getSurveyAnswers(): Promise<SurveyAnswer[]> {
  return rawToAnswers(await readSharedLenient(ROW_ID));
}

/**
 * この端末の回答を保存（全員に共有）。すでに出していれば同じ位置のまま書き換える。
 * 書き込み直前に最新を取り直すので、同じ時間に別の人が出した回答を消してしまうことがない。
 */
export async function saveSurveyAnswer(
  id: string,
  values: Record<string, SurveyValue>
): Promise<SurveyAnswer[]> {
  // 上限までで切り、知らない設問・知らない選択肢は持ち込まない
  const clean: Record<string, SurveyValue> = {};
  for (const q of SURVEY_QUESTIONS) {
    const v = values[q.id];
    if (q.kind === "checks") {
      const allowed = new Set(q.options.map((o) => o.value));
      const arr = Array.isArray(v) ? v : [];
      clean[q.id] = q.options.map((o) => o.value).filter((x) => arr.includes(x) && allowed.has(x));
    } else if (q.kind === "choice") {
      clean[q.id] = q.options.some((o) => o.value === v) ? (v as string) : "";
    } else {
      clean[q.id] = (typeof v === "string" ? v : "").slice(0, q.max);
    }
  }
  const mine: SurveyAnswer = { id, values: clean, at: new Date().toISOString() };

  const raw = await writeSharedRow(ROW_ID, (cur) => {
    const list = rawToAnswers(cur);
    const at = list.findIndex((a) => a.id === id);
    if (at >= 0) list[at] = mine;
    else list.push(mine);
    return list.map((a) => JSON.stringify(a));
  });
  return rawToAnswers(raw);
}

/** この端末の回答を取り下げる（全員の一覧からも消える）。 */
export async function deleteSurveyAnswer(id: string): Promise<SurveyAnswer[]> {
  const raw = await writeSharedRow(ROW_ID, (cur) =>
    rawToAnswers(cur)
      .filter((a) => a.id !== id)
      .map((a) => JSON.stringify(a))
  );
  return rawToAnswers(raw);
}
