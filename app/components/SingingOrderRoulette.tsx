"use client";

/* ============================================================
   歌唱順ルーレット：参加者からスタート者をスロットで抽選＋進行方向
   ------------------------------------------------------------
   もとは会員メニュー（app/test/page.tsx）の中に直接書いてあったものを、
   9/6 にこのファイルへそのまま切り出した（中身は変えていない）。
   会員メニューと、管理画面 ＞ 社長室 ＞ 設定 の両方から同じものを出す
   （一覧は app/components/memberFeatures.tsx）。
   保存の場所（Supabase のテーブル・localStorage のキー）はそのまま。変えないこと。
   ============================================================ */

import { useState, useEffect, useRef } from "react";
import { karaokeRooms } from "@/lib/data";

/* ── 歌唱順ルーレット：参加者からスタート者をスロットで抽選＋進行方向 ── */
const SING_KEY = "africaheart_singers_v8"; // 参加者（席順・この端末）
const SING_DIR_KEY = "africaheart_sing_dir_v1"; // 進行方向（right/left）
const CELL_H = 52; // スロット1行の高さ(px)
// 初期の参加者は今回のオフ会の参加者（lib/data.ts の karaokeRooms.attendees＝部屋割りの顔ぶれ）。
// 当日の増減はこの端末で追加/削除して調整できる（並びは席順のつもりで。抽選自体は順番に無関係）。
// ここを変えたら SING_KEY の版数を上げる（各端末に残った前回の名簿を新しい既定へ入れ替えるため）。
const DEFAULT_SINGERS = [...karaokeRooms.attendees];

// 縦スクロールのスロット。key(=spin回数)で張り替え、マウント時に一度だけ回す。
function SlotReel({
  names,
  targetIndex,
  onLanded,
}: {
  names: string[];
  targetIndex: number; // 当選者の index（-1なら静止して names[0] を中央表示）
  onLanded: () => void;
}) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const len = names.length;
  const REPEATS = 9;

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || len === 0) return;
    const y = (idx: number) => (1 - idx) * CELL_H; // strip index idx を中央行に合わせる
    if (targetIndex < 0) {
      strip.style.transform = `translateY(${y(len)}px)`; // names[0] を中央に
      return;
    }
    const loops = 4 + Math.floor(Math.random() * 3); // 4〜6周まわす
    const endIdx = len + loops * len + targetIndex; // 数周してから当選者に着地
    strip.style.transform = `translateY(${y(len)}px)`; // names[0] から開始（答えを先見せしない）
    const anim = strip.animate(
      [{ transform: `translateY(${y(len)}px)` }, { transform: `translateY(${y(endIdx)}px)` }],
      {
        duration: 3600 + Math.floor(Math.random() * 700),
        easing: "cubic-bezier(0.08,0.62,0.12,1)", // 高速→減速
        fill: "forwards",
      }
    );
    anim.onfinish = () => {
      try {
        anim.commitStyles();
        anim.cancel();
      } catch {
        /* 失敗時も当選者は中央のまま */
      }
      onLanded();
    };
    return () => {
      try {
        anim.cancel();
      } catch {
        /* no-op */
      }
    };
    // マウント毎（key=spinで張り替え）に一度だけ実行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cells = Array.from({ length: REPEATS * Math.max(len, 1) }, (_, k) => names[k % Math.max(len, 1)]);

  return (
    <div
      className="relative overflow-hidden rounded-3xl"
      style={{ height: 3 * CELL_H, background: "linear-gradient(135deg,#faf8f5,#f4f0ea)", border: "2px solid #efe9e1" }}
    >
      {/* 中央のセレクトライン */}
      <div
        className="absolute left-2 right-2 rounded-2xl pointer-events-none"
        style={{ top: CELL_H, height: CELL_H, border: "2px solid #C81E77", background: "rgba(168,23,95,0.07)" }}
      />
      {/* 上下フェード（スロットらしさ） */}
      <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: CELL_H, background: "linear-gradient(#f6f2ec,rgba(246,242,236,0))" }} />
      <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: CELL_H, background: "linear-gradient(rgba(246,242,236,0),#f6f2ec)" }} />
      <div ref={stripRef} style={{ willChange: "transform" }}>
        {cells.map((name, k) => (
          <div key={k} className="flex items-center justify-center" style={{ height: CELL_H }}>
            <span className="text-lg font-black truncate px-3" style={{ color: "#2c2c2c" }}>
              {name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SingingOrderRoulette() {
  const [singers, setSingers] = useState<string[]>(DEFAULT_SINGERS);
  const [dir, setDir] = useState<"right" | "left">("right");
  const [starterIndex, setStarterIndex] = useState<number>(-1);
  const [spinKey, setSpinKey] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(false);
  const [newName, setNewName] = useState("");
  const [showList, setShowList] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SING_KEY);
      if (raw) {
        const a = JSON.parse(raw);
        if (Array.isArray(a) && a.every((x) => typeof x === "string")) setSingers(a);
      }
    } catch {
      /* 端末に無ければ空で開始 */
    }
    try {
      const d = localStorage.getItem(SING_DIR_KEY);
      if (d === "left" || d === "right") setDir(d);
    } catch {
      /* no-op */
    }
  }, []);

  function persist(next: string[]) {
    setSingers(next);
    try {
      localStorage.setItem(SING_KEY, JSON.stringify(next));
    } catch {
      /* 保存できなくても続行 */
    }
  }
  function chooseDir(d: "right" | "left") {
    setDir(d);
    try {
      localStorage.setItem(SING_DIR_KEY, d);
    } catch {
      /* no-op */
    }
  }
  // 名簿が変わったら抽選結果は作り直す（スロットも静止状態へ張り替え）
  function resetResult() {
    setStarterIndex(-1);
    setLanded(false);
    setSpinning(false);
    setSpinKey((k) => k + 1);
  }

  function addName() {
    const t = newName.trim();
    if (!t || singers.includes(t)) {
      setNewName("");
      return;
    }
    persist([...singers, t]);
    setNewName("");
    resetResult();
  }
  function removeName(n: string) {
    persist(singers.filter((x) => x !== n));
    resetResult();
  }

  const canSpin = !spinning && singers.length >= 2;

  function spin() {
    if (!canSpin) return;
    setStarterIndex(Math.floor(Math.random() * singers.length));
    setLanded(false);
    setSpinning(true);
    setSpinKey((k) => k + 1);
  }
  function onLanded() {
    setSpinning(false);
    setLanded(true);
  }

  // 抽選で出た「最初に歌う人」だけ分かればよい（席順・歌唱順は作らない）
  const starter = starterIndex >= 0 && starterIndex < singers.length ? singers[starterIndex] : "";

  const inputStyle = { background: "#f4f0ea", color: "#2c2c2c", border: "2px solid transparent" } as const;
  const dirBtnStyle = (active: boolean) => ({
    background: active ? "linear-gradient(135deg,#A8175F,#C81E77)" : "#f0ece5",
    color: active ? "#fff" : "#aaa",
    boxShadow: active ? "0 3px 10px rgba(168,23,95,0.3)" : "none",
  });

  return (
    <div className="w-full flex flex-col gap-4">
      {/* 進行方向 */}
      <div className="rounded-2xl p-3" style={{ background: "#faf8f5", border: "1px solid #efe9e1" }}>
        <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "#bbb" }}>
          進行方向（どちら回りで回すか）
        </p>
        <div className="flex gap-2">
          <button onClick={() => chooseDir("right")} className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all" style={dirBtnStyle(dir === "right")}>
            右回り（右へ）
          </button>
          <button onClick={() => chooseDir("left")} className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all" style={dirBtnStyle(dir === "left")}>
            左回り（左へ）
          </button>
        </div>
      </div>

      {/* スロット */}
      <div>
        <p className="text-xs font-bold tracking-widest uppercase mb-2 text-center" style={{ color: "#bbb" }}>
          スタートする人を抽選
        </p>
        {singers.length >= 1 ? (
          <SlotReel key={spinKey} names={singers} targetIndex={starterIndex} onLanded={onLanded} />
        ) : (
          <div
            className="rounded-3xl flex items-center justify-center text-center px-4"
            style={{ height: 3 * CELL_H, background: "#faf8f5", border: "2px dashed #e7ddd1" }}
          >
            <span className="text-sm font-bold leading-relaxed" style={{ color: "#c2b6a6" }}>
              下の欄に参加者を追加してください
              <br />
              （2人以上で抽選できます）
            </span>
          </div>
        )}
      </div>

      {/* 操作 */}
      <button
        onClick={spin}
        disabled={!canSpin}
        className="w-full py-3.5 rounded-2xl text-sm font-black text-white transition-opacity"
        style={{ background: "linear-gradient(135deg,#A8175F,#C81E77)", boxShadow: "0 4px 14px rgba(168,23,95,0.34)", opacity: canSpin ? 1 : 0.4 }}
      >
        {spinning ? "抽選中…" : landed ? "もう一度ルーレット" : "ルーレット開始"}
      </button>
      {singers.length < 2 && (
        <p className="text-xs text-center" style={{ color: "#c0392b" }}>
          抽選には参加者が2人以上必要です。
        </p>
      )}

      {/* 結果：最初に歌う人と進行方向 */}
      {landed && starter && (
        <div className="rounded-2xl p-4 slot-pop text-center" style={{ background: "#FCEFF5", border: "1.5px solid #F3CFE1" }}>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "#C81E77" }}>
            最初に歌う人
          </p>
          <p className="text-2xl font-black mb-3" style={{ color: "#2c2c2c" }}>
            {starter}
          </p>
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-2" style={{ background: "#fff", border: "1px solid #F3CFE1" }}>
            <span className="text-xs font-bold" style={{ color: "#c98aae" }}>このあとの進行</span>
            <span className="text-sm font-black" style={{ color: "#C81E77" }}>
              {dir === "right" ? "右回り（右へ）" : "左回り（左へ）"}
            </span>
          </div>
        </div>
      )}

      {/* 参加者リスト（順序は不要・抽選対象の名前だけ管理） */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #efe9e1" }}>
        <button onClick={() => setShowList((v) => !v)} className="w-full flex items-center justify-between px-4 py-3" style={{ background: "#faf8f5" }}>
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#bbb" }}>
            参加者（{singers.length}人）
          </span>
          <span className="text-xs font-black" style={{ color: "#C81E77" }}>
            {showList ? "閉じる" : "開く"}
          </span>
        </button>
        {showList && (
          <div className="px-4 py-3 flex flex-col gap-3" style={{ background: "#fff" }}>
            <div className="flex flex-wrap gap-2">
              {singers.map((n) => (
                <span
                  key={n}
                  className="inline-flex items-center gap-1.5 rounded-full pl-3 pr-1.5 py-1.5 text-xs font-bold"
                  style={{ background: "#f4f0ea", color: "#555" }}
                >
                  {n}
                  <button
                    onClick={() => removeName(n)}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-sm"
                    style={{ background: "#fff0f0", color: "#ff6b6b" }}
                    aria-label={`${n}を削除`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {singers.length === 0 && (
                <span className="text-xs" style={{ color: "#bbb" }}>まだ参加者がいません。下から追加してください。</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addName();
                }}
                placeholder="参加者の名前を追加"
                className="flex-1 min-w-0 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                style={inputStyle}
              />
              <button onClick={addName} disabled={!newName.trim()} className="px-4 rounded-xl text-sm font-bold text-white transition-opacity" style={{ background: "linear-gradient(135deg,#A8175F,#C81E77)", opacity: newName.trim() ? 1 : 0.4 }}>
                追加
              </button>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: "#bbb" }}>
              抽選で出た人が「最初に歌う人」です。並び順は関係ありません。はじめは今回のオフ会の参加9名が入っています。当日の増減はここで消したり足したりしてください。この内容はこの端末に保存されます。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
