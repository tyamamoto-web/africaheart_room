"use client";

/* ============================================================
   宿題ルーレット：宿題リストからテーマを3つ抽選
   ------------------------------------------------------------
   もとは会員メニュー（app/test/page.tsx）の中に直接書いてあったものを、
   9/6 にこのファイルへそのまま切り出した（中身は変えていない）。
   会員メニューと、管理画面 ＞ 社長室 ＞ 設定 の両方から同じものを出す
   （一覧は app/components/memberFeatures.tsx）。
   保存の場所（Supabase のテーブル・localStorage のキー）はそのまま。変えないこと。
   ============================================================ */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getNickname } from "@/lib/duet";
import {
  getHomework,
  saveHomework,
  HomeworkSetupError,
  listThemes,
  addTheme as apiAddTheme,
  deleteTheme as apiDeleteTheme,
  type ThemeRow,
} from "@/lib/homework";

/* ── 宿題ルーレット：宿題リストからテーマを3つ抽選 ──── */
// 候補テーマは Supabase(homework_themes) で全員共有。月ごとに区分け（1〜12月）、各月 MAX_PER_MONTH 件まで。
// DEFAULT_THEMES は未設定時のフォールバック表示用（テーブルが無いときだけ現在の月に出す）。
const HW_RESULT_KEY = "africaheart_homework_result_v1"; // 抽選結果（DB未設定時のローカル控え）
const PICK_COUNT = 3;
const MAX_PER_MONTH = 20; // 1ヶ月あたりの登録上限
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1); // 1〜12月
function currentMonth(): number {
  return new Date().getMonth() + 1;
}
const DEFAULT_THEMES = [
  "アニメソング",
  "90年代の名曲",
  "心に響くバラード",
  "ボカロ曲",
  "洋楽",
  "アイドルソング",
  "高音チャレンジ",
  "盛り上がる曲",
  "泣ける曲",
  "最近ハマっている曲",
  "ドラマ・映画の主題歌",
  "自分の十八番",
  "懐かしのJ-POP",
  "デュエット曲",
];
const CONFETTI_COLORS = ["#C81E77", "#845ef7", "#339af0", "#f59e0b", "#10b981", "#E0559A"];

// 抽選結果のローカル控え（DB未設定でも端末内で結果を保持・表示できる）
function loadLocalResult(): string[] {
  try {
    const raw = localStorage.getItem(HW_RESULT_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.every((x) => typeof x === "string")) return arr;
    }
  } catch {
    /* 読めなくても空で続行 */
  }
  return [];
}
function saveLocalResult(themes: string[]) {
  try {
    localStorage.setItem(HW_RESULT_KEY, JSON.stringify(themes));
  } catch {
    /* 保存できなくても続行 */
  }
}

function Confetti({ burst }: { burst: number }) {
  return (
    <div key={burst} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      {Array.from({ length: 18 }).map((_, i) => {
        const left = 5 + (i / 18) * 90;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        const delay = (i % 6) * 45;
        const dur = 750 + (i % 4) * 180;
        const w = i % 3 === 0 ? 6 : 8;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${left}%`,
              top: 0,
              width: w,
              height: w + 4,
              background: color,
              borderRadius: 2,
              animation: `confetti-fall ${dur}ms ease-in ${delay}ms forwards`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function HomeworkRoulette() {
  const [allThemes, setAllThemes] = useState<ThemeRow[]>([]);
  const [selMonth, setSelMonth] = useState<number>(1); // マウント後に現在の月へ
  const [decided, setDecided] = useState<string[]>([]);
  const [display, setDisplay] = useState<string>("");
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(false);
  const [burst, setBurst] = useState(0);
  const [showEdit, setShowEdit] = useState(false);
  const [newTheme, setNewTheme] = useState("");

  // 抽選結果のDB同期
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [syncErr, setSyncErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastBy, setLastBy] = useState("");

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const landRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false); // スピン中・保存中はポーリングで上書きしない

  // 現在の月を初期選択（ハイドレーション差異を避けるためマウント後に設定）
  useEffect(() => {
    setSelMonth(currentMonth());
  }, []);

  // 抽選結果をローカル＋（可能なら）DBへ保存
  const saveResult = useCallback(async (next: string[]) => {
    saveLocalResult(next); // まず端末に控える（DBが無くても結果は残る）
    busyRef.current = true;
    setSaving(true);
    try {
      const by = getNickname() || "";
      await saveHomework(next, by);
      setLastBy(by);
      setNeedsSetup(false);
      setSyncErr(null);
    } catch (e) {
      if (e instanceof HomeworkSetupError) setNeedsSetup(true);
      else setSyncErr(e instanceof Error ? e.message : "結果の保存に失敗しました");
    } finally {
      setSaving(false);
      busyRef.current = false;
    }
  }, []);

  // 候補テーマと抽選結果を共有DBから取得（ポーリングで他端末の追加も反映）
  const refresh = useCallback(async () => {
    let setupMissing = false;
    let errMsg: string | null = null;

    // 候補テーマ（全員で共有・追加・月別）
    try {
      const rows = await listThemes();
      if (!busyRef.current) setAllThemes(rows);
    } catch (e) {
      if (e instanceof HomeworkSetupError) {
        setupMissing = true;
        // 未設定時は現在の月にだけ初期リストを出して抽選だけは可能に（追加/削除は無効）
        setAllThemes(DEFAULT_THEMES.map((text) => ({ month: currentMonth(), text })));
      } else {
        errMsg = e instanceof Error ? e.message : "宿題リストの同期に失敗しました";
      }
    }

    // 抽選結果（全員で共有）
    try {
      const hw = await getHomework();
      setLastBy(hw.updatedBy);
      if (!busyRef.current) {
        // 共有DBの結果を常に正とする。端末の控えはDBに追従させるだけで、
        // 端末に残った古い結果をDBへ再アップロードしない（リセットの巻き戻し防止）。
        setDecided(hw.themes);
        saveLocalResult(hw.themes);
      }
    } catch (e) {
      if (e instanceof HomeworkSetupError) setupMissing = true;
      else errMsg = e instanceof Error ? e.message : "同期に失敗しました";
    }

    setNeedsSetup(setupMissing);
    setSyncErr(errMsg);
    setLoading(false);
  }, []);

  useEffect(() => {
    // 端末に残る前回結果を即時表示（DB取得前でも表示が崩れない）
    const local = loadLocalResult();
    if (local.length > 0) setDecided(local);
    refresh();
    const poll = setInterval(refresh, 5000); // 候補テーマ・結果を最新へ
    return () => {
      clearInterval(poll);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (landRef.current) clearTimeout(landRef.current);
    };
  }, [refresh]);

  // 選択中の月の候補曲
  const monthThemes = useMemo(
    () => allThemes.filter((t) => t.month === selMonth).map((t) => t.text),
    [allThemes, selMonth]
  );
  const monthFull = monthThemes.length >= MAX_PER_MONTH;
  const pool = monthThemes.filter((t) => !decided.includes(t));
  const done = decided.length >= PICK_COUNT;
  const canSpin = !spinning && !done && pool.length > 0 && !loading && !saving;

  function spin() {
    if (!canSpin) return;
    const winner = pool[Math.floor(Math.random() * pool.length)];
    const base = decided; // 抽選開始時点の確定リスト
    busyRef.current = true; // スピン中はポーリングで上書きしない
    setSpinning(true);
    setLanded(false);
    let i = Math.floor(Math.random() * pool.length);
    let ticks = 0;
    const total = 26 + Math.floor(Math.random() * 10); // スピン量をランダム化
    const step = () => {
      ticks++;
      if (ticks >= total) {
        const next = [...base, winner];
        setDisplay(winner);
        setSpinning(false);
        setLanded(true);
        setBurst((b) => b + 1);
        setDecided(next);
        landRef.current = setTimeout(() => setLanded(false), 1100);
        saveResult(next); // DBへ保存（busyRef は saveResult 内で解除）
        return;
      }
      i = (i + 1) % pool.length;
      setDisplay(pool[i]);
      const p = ticks / total;
      const delay = 45 + Math.pow(p, 2.4) * 280; // 45ms→約325msへ減速（ease-out）
      timerRef.current = setTimeout(step, delay);
    };
    step();
  }

  async function reset() {
    if (decided.length > 0 && !confirm("みんなで共有している宿題結果をリセットします。よろしいですか？")) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (landRef.current) clearTimeout(landRef.current);
    setDecided([]);
    setDisplay("");
    setSpinning(false);
    setLanded(false);
    await saveResult([]);
  }

  // 選択中の月へ追加（全員に共有）。楽観更新してからDBへ保存。
  async function addTheme() {
    const t = newTheme.trim();
    setNewTheme("");
    if (!t || monthThemes.includes(t)) return;
    if (monthThemes.length >= MAX_PER_MONTH) {
      setSyncErr(`${selMonth}月は${MAX_PER_MONTH}件まで登録できます`);
      return;
    }
    busyRef.current = true; // 楽観更新中はポーリングで一覧を上書きしない（追加チップの一瞬消え防止）
    setAllThemes((prev) => [...prev, { month: selMonth, text: t }]);
    try {
      await apiAddTheme(selMonth, t);
    } catch (e) {
      if (e instanceof HomeworkSetupError) setNeedsSetup(true);
      else setSyncErr(e instanceof Error ? e.message : "テーマの追加に失敗しました");
    } finally {
      busyRef.current = false;
    }
    refresh();
  }
  async function removeTheme(t: string) {
    busyRef.current = true; // 楽観更新中はポーリングで一覧を上書きしない
    setAllThemes((prev) => prev.filter((x) => !(x.month === selMonth && x.text === t)));
    try {
      await apiDeleteTheme(selMonth, t);
    } catch (e) {
      if (e instanceof HomeworkSetupError) setNeedsSetup(true);
      else setSyncErr(e instanceof Error ? e.message : "テーマの削除に失敗しました");
    } finally {
      busyRef.current = false;
    }
    refresh();
  }

  const spinLabel = spinning
    ? "抽選中…"
    : saving
    ? "保存中…"
    : loading
    ? "読み込み中…"
    : decided.length === 0
    ? "ルーレット開始"
    : `ルーレット開始（${decided.length + 1}つ目）`;

  return (
    <div className="w-full flex flex-col gap-4">
      {syncErr && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "#fff0f0", color: "#c0392b" }}>
          {syncErr}
        </p>
      )}

      {/* 対象の月を選択（1〜12月） */}
      <div>
        <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "#bbb" }}>
          対象の月（{selMonth}月・{monthThemes.length}/{MAX_PER_MONTH}曲）
        </p>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {MONTHS.map((m) => {
            const sel = m === selMonth;
            const count = allThemes.filter((t) => t.month === m).length;
            return (
              <button
                key={m}
                onClick={() => setSelMonth(m)}
                className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-black transition-all"
                style={{
                  background: sel ? "linear-gradient(135deg,#A8175F,#C81E77)" : "#f0ece5",
                  color: sel ? "#fff" : "#aaa",
                  boxShadow: sel ? "0 3px 10px rgba(168,23,95,0.3)" : "none",
                }}
              >
                {m}月{count > 0 ? `・${count}` : ""}
              </button>
            );
          })}
        </div>
      </div>

      {/* 決定枠（3つ） */}
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: PICK_COUNT }).map((_, idx) => {
          const t = decided[idx];
          return (
            <div
              key={idx}
              className={`rounded-2xl px-2 py-3 flex flex-col items-center justify-center text-center min-h-[78px] ${t ? "slot-pop" : ""}`}
              style={
                t
                  ? { background: "linear-gradient(135deg,#A8175F,#C81E77)", boxShadow: "0 4px 12px rgba(168,23,95,0.3)" }
                  : { background: "#faf8f5", border: "1.5px dashed #e7ddd1" }
              }
            >
              <span
                className="text-[10px] font-black mb-1"
                style={{ color: t ? "rgba(255,255,255,0.85)" : "#cdbfae" }}
              >
                {idx + 1}つ目
              </span>
              <span
                className="text-xs font-black leading-tight"
                style={{ color: t ? "#fff" : "#d8ccbb" }}
              >
                {t ?? "？"}
              </span>
            </div>
          );
        })}
      </div>

      {/* ルーレット表示 */}
      <div className="relative">
        <Confetti burst={burst} />
        <div
          className={`rounded-3xl px-4 flex flex-col items-center justify-center text-center min-h-[140px] ${
            spinning ? "reel-spinning" : landed ? "reel-land" : ""
          }`}
          style={{
            background: landed
              ? "linear-gradient(135deg,#FCEFF5,#F9E6EF)"
              : "linear-gradient(135deg,#faf8f5,#f4f0ea)",
            border: `2px solid ${landed ? "#C81E77" : "#efe9e1"}`,
          }}
        >
          {display ? (
            <>
              <span
                className="text-[11px] font-bold tracking-widest uppercase mb-1"
                style={{ color: spinning ? "#cbb" : "#C81E77" }}
              >
                {spinning ? "抽選中" : landed ? "決定" : "前回のテーマ"}
              </span>
              <span
                className="text-2xl font-black leading-tight"
                style={{ color: "#2c2c2c" }}
              >
                {display}
              </span>
            </>
          ) : (
            <span className="text-sm font-bold" style={{ color: "#c2b6a6" }}>
              ボタンを押して
              <br />
              今回の宿題テーマを決めよう
            </span>
          )}
        </div>
      </div>

      {/* 操作ボタン */}
      {done ? (
        <div className="flex flex-col gap-2">
          <div
            className="rounded-2xl px-4 py-3 text-center"
            style={{ background: "#FCEFF5", border: "1.5px solid #F3CFE1" }}
          >
            <p className="text-sm font-black" style={{ color: "#C81E77" }}>
              今回の宿題テーマが決定しました
            </p>
            <p className="text-base font-black mt-1.5" style={{ color: "#2c2c2c" }}>
              {decided.join(" / ")}
            </p>
            <p className="text-xs mt-2 leading-relaxed" style={{ color: "#c98aae" }}>
              今回のオフ会までに、各テーマに合う持ち歌を1曲ずつ準備してきてください。
            </p>
          </div>
          <button
            onClick={reset}
            disabled={saving}
            className="w-full py-3 rounded-2xl text-sm font-black"
            style={{ background: "#f0ece5", color: "#888", opacity: saving ? 0.4 : 1 }}
          >
            {saving ? "保存中…" : "もう一度引き直す"}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={spin}
            disabled={!canSpin}
            className="flex-1 py-3.5 rounded-2xl text-sm font-black text-white transition-opacity"
            style={{
              background: "linear-gradient(135deg,#A8175F,#C81E77)",
              boxShadow: "0 4px 14px rgba(168,23,95,0.34)",
              opacity: canSpin ? 1 : 0.4,
            }}
          >
            {spinLabel}
          </button>
          {decided.length > 0 && (
            <button
              onClick={reset}
              disabled={spinning}
              className="px-4 py-3.5 rounded-2xl text-sm font-bold"
              style={{ background: "#f0ece5", color: "#888", opacity: spinning ? 0.4 : 1 }}
            >
              やり直す
            </button>
          )}
        </div>
      )}

      {pool.length === 0 && !done && (
        <p className="text-xs text-center" style={{ color: "#c0392b" }}>
          {selMonth}月の候補曲がありません。下のリストに追加してください。
        </p>
      )}

      {needsSetup ? (
        <p className="text-[11px] text-center leading-relaxed" style={{ color: "#bbb" }}>
          共有設定が未完了のため、初期リストを表示中です（宿題リストと結果を全員で共有するには設定が必要です）
        </p>
      ) : (
        <p className="text-[11px] text-center" style={{ color: "#bbb" }}>
          {lastBy ? `最終更新: ${lastBy}・` : ""}宿題リストも結果も全員で共有・保存されます
        </p>
      )}

      {/* 宿題リストの編集 */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #efe9e1" }}>
        <button
          onClick={() => setShowEdit((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3"
          style={{ background: "#faf8f5" }}
        >
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#bbb" }}>
            {selMonth}月の宿題リスト（{monthThemes.length}/{MAX_PER_MONTH}）
          </span>
          <span className="text-xs font-black" style={{ color: "#C81E77" }}>
            {showEdit ? "閉じる" : "開く"}
          </span>
        </button>
        {showEdit && (
          <div className="px-4 py-3 flex flex-col gap-3" style={{ background: "#fff" }}>
            <div className="flex flex-wrap gap-2">
              {monthThemes.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 rounded-full pl-3 pr-1.5 py-1.5 text-xs font-bold"
                  style={{ background: "#f4f0ea", color: "#555" }}
                >
                  {t}
                  <button
                    onClick={() => removeTheme(t)}
                    disabled={needsSetup}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-sm"
                    style={{ background: "#fff0f0", color: "#ff6b6b", opacity: needsSetup ? 0.4 : 1 }}
                    aria-label={`${t}を削除`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {monthThemes.length === 0 && (
                <span className="text-xs" style={{ color: "#bbb" }}>{selMonth}月はまだ登録がありません。下から追加してください。</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={newTheme}
                onChange={(e) => setNewTheme(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTheme();
                }}
                disabled={needsSetup || monthFull}
                placeholder={needsSetup ? "共有設定が必要です" : monthFull ? `${selMonth}月は登録上限（${MAX_PER_MONTH}件）です` : `${selMonth}月に曲を追加`}
                className="flex-1 min-w-0 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "#f4f0ea", color: "#2c2c2c", border: "2px solid transparent", opacity: needsSetup || monthFull ? 0.6 : 1 }}
              />
              <button
                onClick={addTheme}
                disabled={!newTheme.trim() || needsSetup || monthFull}
                className="px-4 rounded-xl text-sm font-bold text-white transition-opacity"
                style={{ background: "linear-gradient(135deg,#A8175F,#C81E77)", opacity: newTheme.trim() && !needsSetup && !monthFull ? 1 : 0.4 }}
              >
                追加
              </button>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: "#bbb" }}>
              宿題リストは12ヶ月分、各月{MAX_PER_MONTH}曲まで登録できます。全員で共有され、約5秒ごとに最新へ更新（同じ月の重複は防止）。抽選は選択中の月の曲から行われ、決定済みは除外されます。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
