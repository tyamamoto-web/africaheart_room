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

/** 読んでもらう確認事項のひとかたまり（見出しと、その中の箇条書き）。 */
export type SurveyNotice = { title: string; lines: string[] };

/** 了承のチェックが入っているときに保存する値。 */
export const AGREED = "yes";

/**
 * 設問の型。
 *   text   … 自由記入（答えは文字列）
 *   checks … あてはまるものすべてにチェック（答えは選んだ value の配列）
 *   choice … どれか1つをえらぶ（答えはえらんだ value の文字列）
 *   agree  … 確認事項を読んで了承のチェックを入れる（答えは AGREED か空）
 */
export type SurveyQuestion =
  | { id: string; label: string; kind: "text"; required: boolean; max: number }
  | { id: string; label: string; kind: "checks"; required: boolean; options: SurveyOption[] }
  | { id: string; label: string; kind: "choice"; required: boolean; options: SurveyOption[] }
  | {
      id: string;
      label: string;
      kind: "agree";
      required: boolean;
      notices: SurveyNotice[];
      confirmLabel: string;
    };

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

/* 当日までの確認事項。
   ・中身は運営（LINEでのやりとり）で決まったことと、トップページの告知（lib/data.ts の nextEvent）から取っている。
     金額・集合・雨天は data.ts の数字と合わせてあるので、あちらを直したらここも見直すこと。
   ・まだ決まっていないこと（湖岸公園でお酒を飲んでよいか、カラオケ店のゴミの扱い、駅からの送迎の割り当て）は
     わざと載せていない。決まってから足す。 */
const EVENT_NOTICES: SurveyNotice[] = [
  {
    title: "集合と当日の流れ",
    lines: [
      "集合は11:50、JOYJOY 諏訪インター店のロビーです。12:00に始めます。",
      "解散は23:05ごろ。上諏訪駅まで徒歩5分、松本行の終電に間に合う時間です。",
      "遅れそうなとき、先に帰る予定があるときは、前もって運営までご連絡ください。やむを得ず途中でお帰りになる場合も、まず運営にご相談ください。",
      "体調が悪くなったときは、無理をせず、その場で運営にお声がけください。",
      "やむなく予定や料金が変わることがあります。ご了承ください。",
    ],
  },
  {
    title: "会費とお支払い",
    lines: [
      "集合のときに、1日ぶんの全額を会計のくるちゃんへお渡しください。各会場への支払いは運営がまとめて行います。",
      "目安は、お酒を飲む方 11,000円／飲まない方 10,400円です（車を出してくれた方へのお礼300円を含みます）。",
      "確定した金額は、8月21日に改めてお知らせします。",
      "カラオケバー（ミルユッテ）で料金に含まれないお酒を頼むときは、マスターに値段を確かめ、先に会計のくるちゃんへ代金をお渡しください（ハイボールは＋500円）。",
    ],
  },
  {
    title: "お休み・キャンセルのこと",
    lines: [
      "体調が悪いときは、無理をせずお休みしてください。",
      "キャンセル料がかかるのは焼肉屋だけです。ほかの会場は、当日のお休みでも費用はかかりません。",
      "焼肉屋のキャンセルは、8月20日までにお知らせいただければ無料です。予定があやしいと感じた時点で、早めにお声がけください。",
      "8月21日から当日のお休みは、お店にキャンセル料がかかった場合、その分のご負担をお願いします。",
      "急な体調不良など、やむを得ない事情のときは、この限りではありません。まずは運営にご連絡ください。事情をうかがったうえで、オフ会の貯金からお出しします。",
    ],
  },
  {
    title: "持ち物",
    lines: [
      "お昼ごはんは各自でお持ちください。",
      "みんなで分けるお菓子を、ひとつお持ちよりください。",
      "夕立の可能性があります。折りたたみ傘かカッパをお持ちください。レジャーシートは運営で用意します。",
    ],
  },
  {
    title: "お酒と行き帰り",
    lines: [
      "お酒を飲まれる方は、量にお気をつけください。",
      "車で来られる方は、お酒を飲まないでください。",
      "行き帰りも安全にお願いします。駅からの送り迎えが必要な方は、早めに運営へご相談ください。",
    ],
  },
  {
    title: "当日の責任者",
    lines: [
      "リーダー よしのすけ ／ サブリーダー しゃちょー ／ 会計 くるちゃん",
      "スケジュールも細かい段取りも、この3人が把握しています。分からないことは何なりとお声がけください。",
    ],
  },
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
  {
    id: "q5",
    label: "当日までの確認事項",
    kind: "agree",
    required: true,
    notices: EVENT_NOTICES,
    confirmLabel: "上の確認事項をすべて読み、了承しました",
  },
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
  if (q.kind === "agree") {
    return v === AGREED ? "了承" : "";
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
    if (q.kind === "agree") return v !== AGREED;
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
    } else if (q.kind === "agree") {
      values[q.id] = v === AGREED ? AGREED : "";
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
    } else if (q.kind === "agree") {
      clean[q.id] = v === AGREED ? AGREED : "";
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
