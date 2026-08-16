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
  /* ラベルの前に置く文字（時刻など）。桁をそろえた別の欄に出すので、行をまたいで縦にそろう。
     無ければラベルだけを出す（時刻を持たない設問はこちら）。 */
  lead?: string;
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
  .map((s) => ({ value: s.joinKey as string, lead: s.time, label: s.title, short: s.title }));

/* 行き帰りの移動。運営で送迎はできないので、当日までに手当てが要る方を先に見つけるための設問。
   「できますか／できませんか」だけだと答えにくいので、行きと帰りを分けて言い切れる形にした。 */
const TRANSPORT_OPTIONS: SurveyOption[] = [
  { value: "both", label: "行き・帰りとも、自分で移動できます", short: "行き帰りとも自分で" },
  { value: "backOnly", label: "行きは自分で来られますが、帰りがまだ決まっていません", short: "帰りが未定" },
  { value: "goOnly", label: "帰りは自分で帰れますが、行きがまだ決まっていません", short: "行きが未定" },
  { value: "neither", label: "行き・帰りとも、まだ決まっていません", short: "行き帰りとも未定" },
];

/* 当日の足。車で来る方が分かると、乗り合いの席数と停める場所、そしてお酒の可否が見える。
   電車の方が分かると、駅の送り迎えと終電の心配を先に拾える。 */
const TRAVEL_OPTIONS: SurveyOption[] = [
  { value: "carSelf", label: "自家用車で行きます（自分で運転します）", short: "車・自分で運転" },
  { value: "carRide", label: "自家用車で行きます（ほかの方に乗せてもらいます）", short: "車・乗せてもらう" },
  { value: "transit", label: "電車やバスなど、公共交通機関で行きます", short: "電車・バス" },
  { value: "undecided", label: "まだ決めていません", short: "未定" },
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
      "解散は22:50ごろ。ミルユッテから上諏訪駅まで徒歩5分です。上諏訪駅発 松本行きの終電は23:05です。",
      "ほかの方面へお帰りの方は、ご自分の路線の終電をお確かめください。間に合わないときは、早めに運営へご相談ください。",
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
      "確定した金額は、8月21日にLINEグループでお知らせします。",
      "カラオケバー（ミルユッテ）で料金に含まれないお酒を頼むときは、マスターに値段を確かめ、先に会計のくるちゃんへ代金をお渡しください（ハイボールは＋500円）。",
    ],
  },
  {
    title: "お休み・キャンセルのこと",
    lines: [
      "お店の予約が人数で決まるため、直前のお休みは基本としてご遠慮いただいています。",
      "とはいえ、体調が悪いときは無理をせずお休みしてください。",
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
      "暑い時期です。こまめに水分をとってください。",
      "カラオケ（JOYJOY）は、どのプランでもソフトドリンクが飲み放題です（セルフでお取りください）。屋外で過ごす時間ぶんの飲みものは、各自でご用意ください。",
      "20:00からの花火は、湖のそばの公園です。虫が出ますので、虫よけをお持ちください。",
      "夕立の可能性があります。折りたたみ傘かカッパをお持ちください。レジャーシートは運営で用意します。",
      "雨でも花火は行う予定です。20:00からの40分ほどは、屋根のない諏訪湖岸公園で過ごします。",
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
    title: "当日の責任者と連絡先",
    lines: [
      "リーダー よしのすけ ／ サブリーダー しゃちょー・くるちゃん（会計はくるちゃんが担当します）",
      "スケジュールも細かい段取りも、この3人が把握しています。分からないことは何なりとお声がけください。",
      "ご連絡は、アフリカハートのLINEグループへお願いします。当日の急ぎのご用は、しゃちょー（070-4377-5439）までお電話ください。",
    ],
  },
];

/** アンケートの回答期限。表示にだけ使う（この日を過ぎても画面は閉じない）。 */
export const SURVEY_DEADLINE = "8月20日（木）";

/**
 * 設問一覧。並んでいる順に画面へ出る。
 * ※ id は答えの保存キー。画面に出る「Q番号」は並び順から作るだけなので、
 *   途中に設問を差しこんでも id は変えないこと（変えると前の答えが読めなくなる）。
 */
export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  { id: "q1", label: "あなたの名前を教えてください", kind: "text", required: true, max: 40 },
  // 1つだけ選んで終わりにされないよう、「あてはまるものすべて」を設問文に添える。
  {
    id: "q2",
    label: "参加されるスケジュールにチェックをしてください（あてはまるものすべて）",
    kind: "checks",
    required: true,
    options: SCHEDULE_OPTIONS,
  },
  {
    id: "q3",
    label: "集合場所までの行きと、解散後の帰りは、ご自分で移動手段を用意できますか",
    kind: "choice",
    required: true,
    options: TRANSPORT_OPTIONS,
  },
  // 並びは3番目と4番目のあいだだが、id は空いている q6 を使う（上の注意書きのとおり）
  {
    id: "q6",
    label: "当日は、どちらでお越しになりますか",
    kind: "choice",
    required: true,
    options: TRAVEL_OPTIONS,
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

/* ── 参加費の自動計算 ────────────────────────────────────────
   回答（どこに参加するか・お酒を飲むか）から、その人が集合時に払う額を組み立てる。
   金額は lib/data.ts の予定表から取る。ここに数字を書かない（二重管理にすると必ずずれる）。 */

// 計算に使う設問。設問の id を変えたらここも直すこと。
const Q_JOIN = "q2"; // 参加するスケジュール
export const Q_DRINK = "q4"; // お酒を飲むか（画面のQ番号は並び順で変わるので id で指す）

/** 画面に出る設問の番号（Q1…）。並び順から作るので、途中に設問を差しこんでもついてくる。 */
export function questionNo(id: string): string {
  const i = SURVEY_QUESTIONS.findIndex((q) => q.id === id);
  return i >= 0 ? `Q${i + 1}` : "";
}

export type FeeLine = { label: string; yen: number; note?: string };
/** incomplete＝金額の分からない会場が混じっている（合計をそのまま信じてはいけない）。 */
export type FeeEstimate = { lines: FeeLine[]; total: number; incomplete: boolean };

/** 回答から参加費の目安を出す。1つも参加しない場合は空（合計0円）。 */
export function estimateFee(values: Record<string, SurveyValue>): FeeEstimate {
  const joined = Array.isArray(values[Q_JOIN]) ? (values[Q_JOIN] as string[]) : [];
  const drinks = values[Q_DRINK] === "yes";

  const lines: FeeLine[] = [];
  const known = new Set<string>();
  let incomplete = false;

  for (const s of nextEvent.schedule) {
    if (!s.joinKey) continue; // 集合・移動・解散は費用なし
    known.add(s.joinKey);
    if (!joined.includes(s.joinKey)) continue;

    // 当日どちらかを選ぶ会場（焼肉）は、お酒の回答でどちらの額かが決まる
    const split = s.feeDrink !== undefined && s.feeSoft !== undefined;
    // 予定表に金額が入っていない会場。0円として黙って足すと集金が狂うので、印を立てる。
    if (!split && s.fee === undefined) incomplete = true;

    lines.push({
      label: s.title,
      yen: split ? (drinks ? (s.feeDrink as number) : (s.feeSoft as number)) : (s.fee ?? 0),
      note: split ? (drinks ? "飲み放題" : "ソフトドリンク") : undefined,
    });
  }
  // 予定表に無いものを選んでいる＝設問と予定表がずれている
  if (joined.some((k) => !known.has(k))) incomplete = true;

  // お礼は参加する方みんなで出し合うぶん。1か所でも参加するなら入れる。
  if (lines.length > 0) {
    lines.push({ label: "車を出してくれた方へのお礼", yen: nextEvent.driverThanksFee });
  }

  return { lines, total: lines.reduce((sum, l) => sum + l.yen, 0), incomplete };
}

/** 金額の見せ方をそろえる（0円は「無料」）。 */
export function yenText(yen: number): string {
  return yen === 0 ? "無料" : `${yen.toLocaleString("ja-JP")}円`;
}

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

// 保存したい人の要素だけを差し替え、ほかの人の要素は文字列のまま置いておくための道具。
//  ・読めない要素（壊れたJSON）も、そのまま残す＝誰かの保存で消えることがない
//  ・いまの設問に無い項目（設問を直す前の答え）も、その人の要素の中に残す
function idOfRaw(s: string): string | null {
  try {
    const o = JSON.parse(s) as { id?: unknown };
    return typeof o.id === "string" && o.id ? o.id.slice(0, 40) : null;
  } catch {
    return null; // 読めないものは誰のものか分からない＝触らない
  }
}

function extraValues(rawText: string | undefined): Record<string, SurveyValue> {
  if (!rawText) return {};
  const known = new Set(SURVEY_QUESTIONS.map((q) => q.id));
  const keep: Record<string, SurveyValue> = {};
  try {
    const o = JSON.parse(rawText) as { values?: Record<string, unknown> };
    for (const [k, v] of Object.entries(o.values ?? {})) {
      if (known.has(k)) continue; // いまの設問はこのあと上書きする
      if (typeof v === "string") keep[k] = v;
      else if (Array.isArray(v)) keep[k] = v.filter((x): x is string => typeof x === "string");
    }
  } catch {
    /* 読めなければ引き継がない */
  }
  return keep;
}

/**
 * この端末の回答を保存（全員に共有）。すでに出していれば同じ位置のまま書き換える。
 * 書き込み直前に最新を取り直すので、同じ時間に別の人が出した回答を消してしまうことがない。
 * 触るのは自分の要素だけ。ほかの人の要素は一字も書き換えない。
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
  const savedAt = new Date().toISOString();

  const raw = await writeSharedRow(ROW_ID, (cur) => {
    const next = cur.slice(); // ほかの人の要素はこの配列のまま持ち回る
    const at = next.findIndex((s) => idOfRaw(s) === id);
    const mine: SurveyAnswer = {
      id,
      // 設問を直す前の答えも残したうえで、いまの設問の答えを上書きする
      values: { ...extraValues(at >= 0 ? next[at] : undefined), ...clean },
      at: savedAt,
    };
    const text = JSON.stringify(mine);
    if (at >= 0) next[at] = text;
    else next.push(text);
    return next;
  });
  return rawToAnswers(raw);
}

/** この端末の回答を取り下げる（全員の一覧からも消える）。消すのは自分の要素だけ。 */
export async function deleteSurveyAnswer(id: string): Promise<SurveyAnswer[]> {
  const raw = await writeSharedRow(ROW_ID, (cur) => cur.filter((s) => idOfRaw(s) !== id));
  return rawToAnswers(raw);
}
