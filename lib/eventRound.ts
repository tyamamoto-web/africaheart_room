"use client";

/* ============================================================
   オフ会の「回」
   ------------------------------------------------------------
   これまで「いまはどの回か」は2か所に別々の直書きがあった。
     ・写真の入れ先  … lib/gallery.ts の GALLERY_EVENT（lib/data.ts の nextEvent.date 由来）
     ・ふりかえりの読み先 … app/components/MemberDraft.tsx の LAST_GALLERY
   2つがそろっていないと「入れたのに出てこない」「ふりかえりだけ前の回のまま」に
   なるので、回はこのファイルだけで持つことにした。切り替えるときは下の ROUNDS の
   先頭に1件足すだけでよい。

   ★ 回が変わっても、前の回のものは消えない
     写真・動画は Supabase Storage の gallery/<回>/ という別フォルダに入っている。
     ひとことは共有の1行の中に、1件ずつ日付（d）を持って並んでいる（lib/voices.ts）。
     どちらも回ごとに分かれているので、回を進めても前の回はそのまま残る。
     残ったものは、ギャラリーの画面で回を選べば見られる。

   ★ 撮影シーン（フォルダ名）は回ごとに持つ
     シーンはその日の進行そのものなので、回が変われば中身も変わる。
     過去の回のシーンもここに残しておかないと、前の回の写真の見出しが
     「その他」になってしまう（フォルダ名だけ残って、読み方が分からなくなる）。
     ここに書く id は Storage のフォルダ名そのものなので、
     一度使った id は変えないこと（変えると前の写真が迷子になる）。
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

/** いちばん新しい回を先頭に置く。回が終わったら、ここに1件足す。 */
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

/** いまの回。写真の入れ先と、ふりかえりの読み先は、どちらもこれ。 */
export const CURRENT_ROUND: Round = ROUNDS[0];

/** 開催日から回を引く。知らない回なら、いまの回のシーンで読む。 */
export function roundOf(key: string): Round {
  return ROUNDS.find((r) => r.key === key) ?? CURRENT_ROUND;
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
