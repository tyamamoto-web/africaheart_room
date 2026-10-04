"use client";

/* ============================================================
   オフ会の「回」
   ------------------------------------------------------------
   これまで「いまはどの回か」は2か所に別々の直書きがあった。
     ・写真の入れ先  … lib/gallery.ts の GALLERY_EVENT（lib/data.ts の nextEvent.date 由来）
     ・ふりかえりの読み先 … app/components/MemberDraft.tsx の LAST_GALLERY
   2つがそろっていないと「入れたのに出てこない」「ふりかえりだけ前の回のまま」に
   なるので、まずこのファイルに一本化した。

   それでも、回が変わるたびにこのファイルを書き換えてデプロイする必要が残っていた。
   書き換えを忘れたまま当日を迎えると、その日の写真は前の回のフォルダへ無言で入り、
   その日のひとことは前の回の自分の文を上から消してしまう（1人1件のため）。
   当日に気づいても、デプロイしないと直せない。

   そこで 10/4 から、いまの回は開催の概要（Supabase の event_overview）から決める
   （lib/currentRound.ts）。役員が社長室で開催日を入れれば、写真の入れ先も
   ふりかえりの読み先も、ひとりでに新しい回へ移る。このファイルを触る必要はない。

   ★ このファイルに残す役目は2つ
     1) 済んだ回の撮影シーン（フォルダ名）を、そのときのまま固定しておくこと。
        シーンはその日の進行そのものなので、回が変われば中身も変わる。
        ここに残しておかないと、前の回の写真の見出しが「その他」になってしまう
        （フォルダ名だけ残って、読み方が分からなくなる）。
        ここに書く id は Storage のフォルダ名そのものなので、
        一度使った id は変えないこと（変えると前の写真が迷子になる）。
     2) まだシーンを決めていない回に、ひとまず使う既定の並び（DEFAULT_SCENES）。
        あとからこのファイルに書き足せば、見出しだけが正しくなる（写真は動かない）。

   ★ 回が変わっても、前の回のものは消えない
     写真・動画は Supabase Storage の gallery/<回>/ という別フォルダに入っている。
     ひとことは共有の1行の中に、1件ずつ日付（d）を持って並んでいる（lib/voices.ts）。
     当日の部屋割りだけは1か所を使い回すので、記録に写してから次の回に進む
     （lib/roundArchive.ts）。
   ============================================================ */

export type Scene = { id: string; label: string };

export type Round = {
  /** 開催日。Storage のフォルダ名と、ひとことの d に使う。"YYYY-MM-DD" */
  key: string;
  /** 画面に出す短い場所の名前（「8月22日 諏訪」の「諏訪」） */
  place: string;
  /** 撮影シーン。並び順がそのまま一覧の見出しの順になる */
  scenes: Scene[];
};

/**
 * まだシーンを決めていない回に使う並び。
 * どの回でもだいたい同じ骨組みになるので、これで足りる。
 * 足りなければ、終わったあとに下の ROUNDS へその回を書き足せばよい。
 */
export const DEFAULT_SCENES: Scene[] = [
  { id: "meet", label: "集合" },
  { id: "intro", label: "自己紹介・課題曲" },
  { id: "koma1", label: "コマ①" },
  { id: "koma2", label: "コマ②" },
  { id: "koma3", label: "コマ③" },
  { id: "koma4", label: "コマ④" },
  { id: "koma5", label: "コマ⑤" },
  { id: "chorus", label: "合唱" },
  { id: "end", label: "片付け" },
  { id: "other", label: "その他" },
];

/** シーンを固定してある回。新しいほうを先に置く。 */
export const ROUNDS: Round[] = [
  {
    key: "2026-09-26",
    place: "松本",
    scenes: [
      { id: "meet", label: "集合" },
      { id: "intro", label: "自己紹介・課題曲" },
      { id: "intro2", label: "課題曲つづき" },
      { id: "quiz", label: "イントロクイズ" },
      { id: "koma1", label: "コマ①" },
      { id: "koma2", label: "コマ②" },
      { id: "koma3", label: "コマ③" },
      { id: "koma4", label: "コマ④" },
      { id: "koma5", label: "コマ⑤" },
      { id: "chorus", label: "合唱" },
      { id: "end", label: "片付け" },
      { id: "other", label: "その他" },
    ],
  },
  {
    // 8/22 諏訪。シーンは lib/data.ts の karaokeRooms から作っていたものを、
    // そのまま写して固定してある（lib/data.ts を直しても、前の回の見出しが変わらないように）。
    key: "2026-08-22",
    place: "諏訪",
    scenes: [
      { id: "meet", label: "集合" },
      { id: "open", label: "オープニング・お誕生日会" },
      { id: "intro", label: "自己紹介＋宿題の曲" },
      { id: "koma1", label: "コマ①" },
      { id: "koma2", label: "コマ②" },
      { id: "koma3", label: "コマ③" },
      { id: "koma4", label: "コマ④（ラスト）" },
      { id: "chorus", label: "合唱タイム" },
      { id: "end", label: "片付け・移動の準備" },
      { id: "yakiniku", label: "焼肉パーティー" },
      { id: "hanabi", label: "サマーナイト花火" },
      { id: "bar", label: "カラオケバー ミルユッテ" },
      { id: "other", label: "その他" },
    ],
  },
];

/** 開催の概要が読めないときに頼る回（いちばん新しい、シーンを固定してある回）。 */
export const FALLBACK_ROUND: Round = ROUNDS[0];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 開催日から回を引く。ここに書いていない回は、既定のシーンで組み立てる。
 * place は、知らない回のときだけ使う（書いてある回は、書いてあるほうを採る）。
 */
export function roundOf(key: string, place = ""): Round {
  const known = ROUNDS.find((r) => r.key === key);
  if (known) return known;
  return { key, place, scenes: DEFAULT_SCENES };
}

/** その回の撮影シーンの一覧。 */
export function scenesOf(key: string): Scene[] {
  return roundOf(key).scenes;
}

/** 「8月22日」のような見出しの日付。読めなければ開催日をそのまま返す。 */
export function roundWhen(key: string): string {
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[2])}月${Number(m[3])}日` : key;
}

/**
 * いまの回の開催日を決める。
 *
 *   開催日が今日か、もう過ぎている … その回（当日とふりかえり）
 *   開催日がまだ先、または未設定   … いちばん新しい「終わった回」
 *
 * 準備のあいだも、ふりかえりと写真は前の回のまま見えていてほしいので、
 * 新しい開催日に移るのは当日の朝からにしてある。
 *
 * known には、分かっている回の開催日を渡す（Storage のフォルダ名、記録に残した回、
 * このファイルの ROUNDS）。並びは問わない。
 */
export function pickRoundKey(overviewDate: string, todayKey: string, known: string[]): string {
  // "YYYY-MM-DD" どうしは、文字として比べれば日付として比べたことになる
  if (DATE_ONLY.test(overviewDate) && overviewDate <= todayKey) return overviewDate;
  const past = known
    .filter((k) => DATE_ONLY.test(k) && k <= todayKey)
    .sort()
    .reverse();
  return past[0] ?? FALLBACK_ROUND.key;
}

/** 選べる回の一覧（新しい回が先）。同じ開催日は1つにまとめる。 */
export function listRounds(keys: string[], places: Record<string, string> = {}): Round[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of keys) {
    if (!DATE_ONLY.test(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out
    .sort()
    .reverse()
    .map((k) => roundOf(k, places[k] ?? ""));
}
