"use client";

/* ============================================================
   いまの回を決める
   ------------------------------------------------------------
   写真の入れ先と、ふりかえりの読み先は「いまの回」で決まる。
   10/4 までは lib/eventRound.ts の先頭に書いた回がそれで、
   回が変わるたびにソースを書き換えてデプロイする必要があった。
   忘れたまま当日を迎えると、その日の写真は前の回のフォルダへ無言で入り、
   ひとことは前の回の自分の文を上から消してしまう（1人1件のため）。

   いまは、役員が社長室で入れる開催日（Supabase の event_overview）から決める。
   場面（準備・当日・ふりかえり）も同じところから決まっているので、
   出どころがひとつになり、片方だけ古いということが起きない。

   決め方は lib/eventRound.ts の pickRoundKey にある。
     開催日が今日か、もう過ぎている … その回
     開催日がまだ先、または未設定   … いちばん新しい「終わった回」
   準備のあいだも、ふりかえりと写真は前の回のまま見えていてほしいので、
   新しい回へ移るのは当日の朝からにしてある。

   「分かっている回」は4つを合わせる。
     ・Storage に写真が1件でも入っている回（lib/gallery.ts の listRoundKeys）
     ・ひとことが1件でも書かれた回（lib/voices.ts の readVoiceDates）
     ・記録に残した回（lib/roundArchive.ts）
     ・lib/eventRound.ts の ROUNDS（シーンを固定してある回）
   写真だけ、ひとことだけ、という回もあるので、いくつかの道から拾う。

   ★ 読み終わるまでは ready が false。
     false のあいだ round は前の回を指しているので、画面はこれを見て待つこと。
     待たずに書くと、前の回の自分のひとことを上書きしてしまう。
     読み取りに失敗した道があったときは ready を立てない（stale のまま）。
     中途半端な顔ぶれで「いちばん新しい終わった回」を決めると、
     直近の回が漏れて前の回へ巻き戻るため。
   ============================================================ */

import { useCallback, useEffect, useState } from "react";
import { readEventOverview } from "./eventOverview";
import { listRoundKeys } from "./gallery";
import { readRoundArchive } from "./roundArchive";
import { readVoiceDates } from "./voices";
import { FALLBACK_ROUND, ROUNDS, listRounds, pickRoundKey, roundOf, type Round } from "./eventRound";

export type CurrentRound = {
  /** いまの回。読み込み中は ROUNDS の先頭（前の回）。 */
  round: Round;
  /** 選べる回。新しい回が先。いまの回は必ず入っている。 */
  rounds: Round[];
  /** 開催日と分かっている回がそろったか。false のあいだは書かせない。 */
  ready: boolean;
  /** もう一度決め直す（日付をまたいで開きっぱなしのときのため）。 */
  refresh: () => void;
};

/**
 * 今日の年月日を "YYYY-MM-DD" に。
 * 日本時間で数える。場面（準備・当日・ふりかえり）の判定も日本時間なので、
 * 端末の時計に合わせると、境目の日に場面と回が1日ずれる。
 */
export function todayKey(nowMs: number = Date.now()): string {
  const t = new Date(nowMs + 9 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
}

/**
 * ボタンに出す短い場所の名前。
 * 概要の場所は「カラオケ館 (長野県松本市中央１丁目５−１８)」のように住所まで入るので、
 * 括弧から後ろを落として、長ければ切る。見出しに出すのはここまででよい。
 */
export function shortPlace(place: string): string {
  const head = place.split(/[(（]/)[0].trim();
  return head.length > 10 ? `${head.slice(0, 10)}…` : head;
}

const REPO_KEYS = ROUNDS.map((r) => r.key);
const REPO_PLACES: Record<string, string> = Object.fromEntries(ROUNDS.map((r) => [r.key, r.place]));

export function useCurrentRound(): CurrentRound {
  const [state, setState] = useState<Omit<CurrentRound, "refresh">>({
    round: FALLBACK_ROUND,
    rounds: listRounds(REPO_KEYS, REPO_PLACES),
    ready: false,
  });
  const [turn, setTurn] = useState(0);
  const refresh = useCallback(() => setTurn((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    const failed = { hit: false };
    const guard = <T,>(fallback: T) => (): T => {
      failed.hit = true;
      return fallback;
    };
    Promise.all([
      readEventOverview().catch(guard<{ date: string; place: string } | null>(null)),
      listRoundKeys().catch(guard<string[]>([])),
      readRoundArchive().catch(guard<{ key: string; place: string }[]>([])),
      readVoiceDates().catch(guard<string[]>([])),
    ])
      .then(([overview, stored, archived, spoken]) => {
        if (!alive) return;
        const places: Record<string, string> = { ...REPO_PLACES };
        for (const a of archived) {
          if (a.place) places[a.key] = shortPlace(a.place);
        }
        if (overview?.date && overview.place) places[overview.date] = shortPlace(overview.place);

        const known = [...stored, ...spoken, ...archived.map((a) => a.key), ...REPO_KEYS];
        const today = todayKey();
        const date = overview?.date ?? "";
        const key = pickRoundKey(date, today, known);

        /* 開催日がもう過ぎていれば、その回だけで決まる（分かっている回を見ない）。
           それ以外は顔ぶれから「いちばん新しい終わった回」を選ぶので、
           どこか1つでも読めていないと、直近の回が漏れて前の回へ巻き戻る。
           そのときは決めずに待つ（画面は書かせないままになる）。 */
        const decidedByDate = key === date;
        if (failed.hit && !decidedByDate) {
          setState((s) => ({ ...s, ready: false }));
          return;
        }
        setState({
          round: roundOf(key, places[key] ?? ""),
          // いまの回は、まだ1枚も入っていなくても必ず選べるようにする
          rounds: listRounds([key, ...known], places),
          ready: true,
        });
      })
      .catch(() => {
        /* Promise.all そのものは失敗しない（1本ずつ受けている）。
           万一ここへ来たときは、決まっていないままにする。 */
      });
    return () => {
      alive = false;
    };
  }, [turn]);

  return { ...state, refresh };
}
