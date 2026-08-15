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

const ROW_ID = SHARED_ROW.survey;

/** 設問の型。いまは自由記入だけ。選択肢などは、そういう設問が決まってから足す。 */
export type SurveyQuestion = {
  id: string; // 保存キー。一度決めたら変えない（変えると過去の答えとつながらなくなる）
  label: string; // 画面に出す設問文
  kind: "text";
  required: boolean;
  max: number; // 文字数の上限
};

/** 設問一覧。並んでいる順に画面へ出る。 */
export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  { id: "q1", label: "あなたの名前を教えてください", kind: "text", required: true, max: 40 },
];

/** 1人ぶんの回答。id はこの端末を見分けるための不変値。 */
export type SurveyAnswer = {
  id: string;
  values: Record<string, string>; // 設問id → 答え
  at: string; // 最後に書いた時刻（ISO）
};

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

export function emptyValues(): Record<string, string> {
  const v: Record<string, string> = {};
  for (const q of SURVEY_QUESTIONS) v[q.id] = "";
  return v;
}

/** 未回答・書き足りない設問があるか（送る前の確認に使う）。 */
export function missingRequired(values: Record<string, string>): SurveyQuestion[] {
  return SURVEY_QUESTIONS.filter((q) => q.required && !(values[q.id] ?? "").trim());
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

  const values: Record<string, string> = {};
  const src = (r.values ?? {}) as Record<string, unknown>;
  for (const q of SURVEY_QUESTIONS) {
    const v = src[q.id];
    values[q.id] = typeof v === "string" ? v.slice(0, q.max) : "";
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
  values: Record<string, string>
): Promise<SurveyAnswer[]> {
  // 上限までで切り、知らない設問の答えは持ち込まない
  const clean: Record<string, string> = {};
  for (const q of SURVEY_QUESTIONS) clean[q.id] = (values[q.id] ?? "").slice(0, q.max);
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
