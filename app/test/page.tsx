"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import {
  isDuetConfigured,
  listSongs,
  addSong,
  updateSong,
  deleteSong,
  getDeviceId,
  getNickname,
  setNickname,
  keyLabel,
  makeLike,
  likeName,
  getLikes,
  type DuetSong,
} from "@/lib/duet";
import {
  getHomework,
  saveHomework,
  HomeworkSetupError,
  listThemes,
  addTheme as apiAddTheme,
  deleteTheme as apiDeleteTheme,
  type ThemeRow,
} from "@/lib/homework";
import {
  isProfilesConfigured,
  listProfiles,
  addProfile,
  updateProfile,
  deleteProfile,
  getLatestUpdatedAt,
  ProfileSetupError,
  type Profile,
} from "@/lib/profiles";

/* ============================================================
   動作確認ページ（タブ切り替え式）
   ------------------------------------------------------------
   新しい機能を試すためのページです。
   機能を追加するには：
     1) 下に機能用のコンポーネントを作る
     2) 末尾の features 配列に
        { id, tab, title, description, render } を追加する
   これだけでタブが1つ増え、切り替えて表示できます。
   ============================================================ */

type RenderCtx = {
  sinceSeen: string; // この時刻より後に更新されたプロフィールを「新着」扱いにする基準
  onLatest: (iso: string) => void; // 表示中に判明したDBの最終更新時刻を親へ通知（未読判定を即時化）
};
type Feature = {
  id: string;
  tab: string;          // タブに表示する短い名前
  title: string;        // 機能の正式名称
  description: string;  // 機能の説明
  render: (ctx: RenderCtx) => ReactNode;
};

/* ── デュエット：歌いたいデュエット曲を登録・いいね ──── */
const KEY_OPTS = [3, 2, 1, 0, -1, -2, -3];
const MAX_ROWS = 5;
type Row = { title: string; artist: string; key: number; part: string };
const emptyRow = (): Row => ({ title: "", artist: "", key: 0, part: "" });

function DuetFeature() {
  const [me, setMe] = useState("");
  const [songs, setSongs] = useState<DuetSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 一括登録フォーム
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [adding, setAdding] = useState(false);

  // 編集
  const [editId, setEditId] = useState<string | null>(null);
  const [eTitle, setETitle] = useState("");
  const [eArtist, setEArtist] = useState("");
  const [eKey, setEKey] = useState(0);
  const [ePart, setEPart] = useState("");

  const refresh = useCallback(async () => {
    try {
      const data = await listSongs();
      setSongs(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isDuetConfigured()) {
      setLoading(false);
      return;
    }
    setMe(getDeviceId());
    setName(getNickname());
    refresh();
    const id = setInterval(refresh, 4000); // 常に最新を反映
    return () => clearInterval(id);
  }, [refresh]);

  // 名前ごとにグループ化
  const groups = useMemo(() => {
    const m = new Map<string, DuetSong[]>();
    for (const s of songs) {
      const key = s.owner_name.trim() || "（名前なし）";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(s);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], "ja"));
  }, [songs]);

  // 未接続：セットアップ案内
  if (!isDuetConfigured()) {
    return (
      <div className="w-full">
        <div className="rounded-xl px-4 py-4" style={{ background: "#fffbe6" }}>
          <p className="text-sm font-bold mb-1" style={{ color: "#92400e" }}>データベース未接続</p>
          <p className="text-xs leading-relaxed" style={{ color: "#a16207" }}>
            みんなで共有するには Supabase の接続設定が必要です。
          </p>
        </div>
      </div>
    );
  }

  const filledRows = rows.filter((r) => r.title.trim());
  const canSubmit = !!name.trim() && filledRows.length > 0 && !adding;

  function setRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => (prev.length < MAX_ROWS ? [...prev, emptyRow()] : prev));
  }
  function removeRow(i: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  async function handleAdd() {
    if (!canSubmit) return;
    setAdding(true);
    try {
      const who = name.trim();
      setNickname(who);
      for (const r of filledRows) {
        await addSong({
          title: r.title.trim(),
          artist: r.artist.trim(),
          key_offset: r.key,
          part: r.part.trim(),
          owner_id: me,
          owner_name: who,
        });
      }
      setRows([emptyRow()]);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登録に失敗しました");
    } finally {
      setAdding(false);
    }
  }

  // 「歌える」を1つ追加（複数メンバーが名前付きでスタンプ可能）
  async function addLike(s: DuetSong) {
    const def = getNickname() || name.trim();
    const input = window.prompt("「歌える！」を表明します。お名前を入力してください", def);
    if (input === null) return;
    const who = input.trim();
    if (!who) return;
    setNickname(who);
    setName(who);
    const entry = makeLike(me, who); // 端末ID＋名前で一意（同名でも別端末なら別スタンプ）
    // 同時押しでの取りこぼしを防ぐため、書き込み直前に最新のlikesを取得
    let base: string[];
    try {
      base = await getLikes(s.id);
    } catch {
      // 取得に失敗したら古いスナップショットで配列全体を上書きしない（他メンバーのスタンプを消さない）
      setError("通信が不安定なため反映できませんでした。もう一度お試しください。");
      return;
    }
    if (base.includes(entry)) {
      // 同じ端末＆同名は既にスタンプ済み。最新を反映して終了（重複させない）
      setSongs((prev) => prev.map((x) => (x.id === s.id ? { ...x, likes: base } : x)));
      return;
    }
    const next = [...base, entry];
    setSongs((prev) => prev.map((x) => (x.id === s.id ? { ...x, likes: next } : x))); // 楽観更新
    try {
      await updateSong(s.id, { likes: next });
    } catch {
      refresh();
    }
  }

  // 特定のスタンプ（entry）だけを取り消し（同名が別にいても巻き込まない）
  async function removeLike(s: DuetSong, entry: string) {
    let base: string[];
    try {
      base = await getLikes(s.id);
    } catch {
      // 取得に失敗したら配列全体を上書きしない（他メンバーのスタンプを巻き込まない）
      setError("通信が不安定なため取り消せませんでした。もう一度お試しください。");
      return;
    }
    const next = base.filter((e) => e !== entry);
    setSongs((prev) => prev.map((x) => (x.id === s.id ? { ...x, likes: next } : x))); // 楽観更新
    try {
      await updateSong(s.id, { likes: next });
    } catch {
      refresh();
    }
  }

  function startEdit(s: DuetSong) {
    setEditId(s.id);
    setETitle(s.title);
    setEArtist(s.artist);
    setEKey(s.key_offset);
    setEPart(s.part ?? "");
  }
  async function saveEdit(id: string) {
    const t = eTitle.trim();
    if (!t) return;
    try {
      await updateSong(id, { title: t, artist: eArtist.trim(), key_offset: eKey, part: ePart.trim() });
      setEditId(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました");
    }
  }
  async function handleDelete(id: string) {
    if (!confirm("この曲を削除しますか？")) return;
    try {
      await deleteSong(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    }
  }

  const inputStyle = { background: "#f4f0ea", color: "#2c2c2c", border: "2px solid transparent" } as const;

  return (
    <div className="w-full flex flex-col gap-4">
      {error && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "#fff0f0", color: "#c0392b" }}>
          {error}
        </p>
      )}

      {/* 一括登録フォーム */}
      <div className="rounded-2xl p-3.5" style={{ background: "#faf8f5", border: "1px solid #efe9e1" }}>
        <p className="text-xs font-bold tracking-widest uppercase mb-2.5" style={{ color: "#bbb" }}>
          歌いたいデュエット曲を登録（最大{MAX_ROWS}曲）
        </p>
        <input
          value={name} onChange={(e) => setName(e.target.value)} placeholder="あなたの名前（必須）"
          className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none mb-2" style={inputStyle}
        />
        <div className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <div key={i} className="rounded-xl p-2" style={{ background: "#fff", border: "1px solid #efe9e1" }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black text-white" style={{ background: "#FF6B9D" }}>{i + 1}</span>
                <input
                  value={r.title} onChange={(e) => setRow(i, { title: e.target.value })} placeholder="曲名"
                  className="flex-1 min-w-0 rounded-lg px-2.5 py-2 text-sm focus:outline-none" style={inputStyle}
                />
                {rows.length > 1 && (
                  <button onClick={() => removeRow(i)} className="flex-shrink-0 w-7 h-7 rounded-lg text-sm" style={{ background: "#fff0f0", color: "#ff6b6b" }}>×</button>
                )}
              </div>
              <div className="flex gap-1.5 pl-6 mb-1.5">
                <input
                  value={r.artist} onChange={(e) => setRow(i, { artist: e.target.value })} placeholder="アーティスト名"
                  className="flex-1 min-w-0 rounded-lg px-2.5 py-2 text-sm focus:outline-none" style={inputStyle}
                />
                <div className="flex items-center gap-1 rounded-lg px-2.5 flex-shrink-0" style={{ background: "#f4f0ea" }}>
                  <span className="text-[11px] font-bold" style={{ color: "#888" }}>キー</span>
                  <select value={r.key} onChange={(e) => setRow(i, { key: Number(e.target.value) })} className="text-sm font-black bg-transparent py-2 focus:outline-none" style={{ color: "#2c2c2c" }}>
                    {KEY_OPTS.map((k) => <option key={k} value={k}>{keyLabel(k)}</option>)}
                  </select>
                </div>
              </div>
              <div className="pl-6">
                <input
                  value={r.part} onChange={(e) => setRow(i, { part: e.target.value })} placeholder="歌ってほしいパート（任意）例：高音/男性パート"
                  className="w-full rounded-lg px-2.5 py-2 text-sm focus:outline-none" style={inputStyle}
                />
              </div>
            </div>
          ))}
        </div>

        {rows.length < MAX_ROWS && (
          <button onClick={addRow} className="w-full mt-2 py-2 rounded-xl text-xs font-bold" style={{ background: "#f0ece5", color: "#888" }}>
            ＋ 曲を追加（{rows.length}/{MAX_ROWS}）
          </button>
        )}
        <button
          onClick={handleAdd} disabled={!canSubmit}
          className="w-full mt-2 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity"
          style={{
            background: "linear-gradient(135deg,#FF6B9D,#FF4FA3)",
            boxShadow: "0 3px 10px rgba(255,107,157,0.3)",
            opacity: canSubmit ? 1 : 0.4,
          }}
        >
          {adding ? "登録中…" : `＋ ${filledRows.length || ""}曲を登録する`}
        </button>
      </div>

      {/* 一覧（名前ごと） */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "#bbb" }}>みんなのデュエット曲</p>
        <span className="text-[11px]" style={{ color: "#ccc" }}>{songs.length}曲</span>
      </div>

      {loading ? (
        <p className="text-sm text-center py-6" style={{ color: "#bbb" }}>読み込み中…</p>
      ) : songs.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: "#bbb" }}>まだ登録がありません。最初の1曲を登録しましょう！</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([owner, list]) => (
            <div key={owner}>
              {/* 名前セクション見出し */}
              <div className="flex items-center gap-2 mb-2">
                <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white" style={{ background: "linear-gradient(135deg,#FF6B9D,#FF4FA3)" }}>
                  {owner.charAt(0)}
                </span>
                <p className="text-sm font-black" style={{ color: "#2c2c2c" }}>{owner}</p>
                <span className="text-[11px]" style={{ color: "#ccc" }}>{list.length}曲</span>
              </div>

              <div className="flex flex-col gap-2">
                {list.map((s) => {
                  const likeEntries = s.likes.filter((e) => likeName(e).trim()); // 名前ありのスタンプ

                  if (editId === s.id) {
                    return (
                      <div key={s.id} className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: "#fff", border: "2px solid #FF6B9D55" }}>
                        <input value={eTitle} onChange={(e) => setETitle(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={inputStyle} placeholder="曲名" />
                        <input value={eArtist} onChange={(e) => setEArtist(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={inputStyle} placeholder="アーティスト名" />
                        <input value={ePart} onChange={(e) => setEPart(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={inputStyle} placeholder="歌ってほしいパート（任意）" />
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 rounded-lg px-3" style={{ background: "#f4f0ea" }}>
                            <span className="text-xs font-bold" style={{ color: "#888" }}>キー</span>
                            <select value={eKey} onChange={(e) => setEKey(Number(e.target.value))} className="text-sm font-black bg-transparent py-2 focus:outline-none" style={{ color: "#2c2c2c" }}>
                              {KEY_OPTS.map((k) => <option key={k} value={k}>{keyLabel(k)}</option>)}
                            </select>
                          </div>
                          <button onClick={() => saveEdit(s.id)} className="flex-1 py-2 rounded-lg text-sm font-bold text-white" style={{ background: "linear-gradient(135deg,#FF6B9D,#FF4FA3)" }}>保存</button>
                          <button onClick={() => setEditId(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "#f4f0ea", color: "#888" }}>取消</button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={s.id} className="rounded-2xl p-3" style={{ background: "#fff", border: "1px solid #efe9e1" }}>
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center" style={{ background: "#f4f0ea" }}>
                          <span className="text-sm font-black leading-none" style={{ color: "#FF4FA3" }}>{keyLabel(s.key_offset)}</span>
                          <span className="text-[8px] font-bold mt-0.5" style={{ color: "#bbb" }}>キー</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate" style={{ color: "#2c2c2c" }}>{s.title}</p>
                          <p className="text-xs truncate" style={{ color: "#999" }}>{s.artist || "—"}</p>
                          {s.part && s.part.trim() && (
                            <p className="text-[11px] font-semibold mt-0.5 leading-relaxed break-words" style={{ color: "#845ef7" }}>
                              {s.part.trim()} を歌ってほしい
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => addLike(s)}
                          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all"
                          style={{ background: likeEntries.length ? "#ffe8f1" : "#f4f0ea", border: `1.5px solid ${likeEntries.length ? "#FF6B9D" : "transparent"}` }}
                          title="「歌える！」を表明（複数人OK）"
                        >
                          <span className="text-xs font-black" style={{ color: likeEntries.length ? "#FF4FA3" : "#888" }}>歌える</span>
                          <span className="text-xs font-black" style={{ color: likeEntries.length ? "#FF4FA3" : "#bbb" }}>{likeEntries.length}</span>
                        </button>
                        <div className="flex-shrink-0 flex gap-1">
                          <button onClick={() => startEdit(s)} className="px-2 py-2 rounded-lg text-[11px] font-bold" style={{ background: "#f4f0ea", color: "#888" }}>編集</button>
                          <button onClick={() => handleDelete(s.id)} className="px-2 py-2 rounded-lg text-[11px] font-bold" style={{ background: "#fff0f0", color: "#ff6b6b" }}>削除</button>
                        </div>
                      </div>
                      {likeEntries.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2 pl-1">
                          <span className="text-[11px] font-bold" style={{ color: "#bbb" }}>歌える</span>
                          {likeEntries.map((e) => {
                            const n = likeName(e).trim();
                            return (
                              <span
                                key={e}
                                className="inline-flex items-center gap-0.5 rounded-full pl-2.5 pr-0.5 py-1 text-[11px] font-bold"
                                style={{ background: "#ffe8f1", color: "#FF4FA3" }}
                              >
                                {n}
                                <button
                                  onClick={() => removeLike(s, e)}
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                                  style={{ background: "transparent", color: "#FF6B9D" }}
                                  aria-label={`${n}の歌えるを取り消し`}
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] leading-relaxed" style={{ color: "#bbb" }}>
        「歌える」を押して名前を入れると意思表示できます。曲はどなたでも編集・削除できます（みんなで管理）。内容は全員に共有され、約4秒ごとに自動更新されます。
      </p>
    </div>
  );
}

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
const CONFETTI_COLORS = ["#FF6B9D", "#845ef7", "#339af0", "#f59e0b", "#10b981", "#FF4FA3"];

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

function HomeworkRoulette() {
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
                  background: sel ? "linear-gradient(135deg,#FF6B9D,#FF4FA3)" : "#f0ece5",
                  color: sel ? "#fff" : "#aaa",
                  boxShadow: sel ? "0 3px 10px rgba(255,107,157,0.3)" : "none",
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
                  ? { background: "linear-gradient(135deg,#FF6B9D,#FF4FA3)", boxShadow: "0 4px 12px rgba(255,107,157,0.3)" }
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
              ? "linear-gradient(135deg,#fff0f6,#ffe3ef)"
              : "linear-gradient(135deg,#faf8f5,#f4f0ea)",
            border: `2px solid ${landed ? "#FF6B9D" : "#efe9e1"}`,
          }}
        >
          {display ? (
            <>
              <span
                className="text-[11px] font-bold tracking-widest uppercase mb-1"
                style={{ color: spinning ? "#cbb" : "#FF4FA3" }}
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
              次回の宿題テーマを決めよう
            </span>
          )}
        </div>
      </div>

      {/* 操作ボタン */}
      {done ? (
        <div className="flex flex-col gap-2">
          <div
            className="rounded-2xl px-4 py-3 text-center"
            style={{ background: "#fff0f6", border: "1.5px solid #ffd0e4" }}
          >
            <p className="text-sm font-black" style={{ color: "#FF4FA3" }}>
              次回の宿題テーマが決定しました
            </p>
            <p className="text-base font-black mt-1.5" style={{ color: "#2c2c2c" }}>
              {decided.join(" / ")}
            </p>
            <p className="text-xs mt-2 leading-relaxed" style={{ color: "#c98aae" }}>
              次回のオフ会までに、各テーマに合う持ち歌を1曲ずつ準備してきてください。
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
              background: "linear-gradient(135deg,#FF6B9D,#FF4FA3)",
              boxShadow: "0 4px 14px rgba(255,107,157,0.35)",
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
          <span className="text-xs font-black" style={{ color: "#FF4FA3" }}>
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
                style={{ background: "linear-gradient(135deg,#FF6B9D,#FF4FA3)", opacity: newTheme.trim() && !needsSetup && !monthFull ? 1 : 0.4 }}
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

/* ── 歌唱順ルーレット：参加者からスタート者をスロットで抽選＋進行方向 ── */
const SING_KEY = "africaheart_singers_v1"; // 参加者（席順・この端末）
const SING_DIR_KEY = "africaheart_sing_dir_v1"; // 進行方向（right/left）
const CELL_H = 52; // スロット1行の高さ(px)
// 実名が未確定のため、初期は「参加者1〜6」を仮置き（後日リネームして使う）
const DEFAULT_SINGERS = Array.from({ length: 6 }, (_, i) => `参加者${i + 1}`);

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
        style={{ top: CELL_H, height: CELL_H, border: "2px solid #FF6B9D", background: "rgba(255,107,157,0.07)" }}
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

function SingingOrderRoulette() {
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
    background: active ? "linear-gradient(135deg,#FF6B9D,#FF4FA3)" : "#f0ece5",
    color: active ? "#fff" : "#aaa",
    boxShadow: active ? "0 3px 10px rgba(255,107,157,0.3)" : "none",
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
        style={{ background: "linear-gradient(135deg,#FF6B9D,#FF4FA3)", boxShadow: "0 4px 14px rgba(255,107,157,0.35)", opacity: canSpin ? 1 : 0.4 }}
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
        <div className="rounded-2xl p-4 slot-pop text-center" style={{ background: "#fff0f6", border: "1.5px solid #ffd0e4" }}>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "#FF4FA3" }}>
            最初に歌う人
          </p>
          <p className="text-2xl font-black mb-3" style={{ color: "#2c2c2c" }}>
            {starter}
          </p>
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-2" style={{ background: "#fff", border: "1px solid #ffd0e4" }}>
            <span className="text-xs font-bold" style={{ color: "#c98aae" }}>このあとの進行</span>
            <span className="text-sm font-black" style={{ color: "#FF4FA3" }}>
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
          <span className="text-xs font-black" style={{ color: "#FF4FA3" }}>
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
              <button onClick={addName} disabled={!newName.trim()} className="px-4 rounded-xl text-sm font-bold text-white transition-opacity" style={{ background: "linear-gradient(135deg,#FF6B9D,#FF4FA3)", opacity: newName.trim() ? 1 : 0.4 }}>
                追加
              </button>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: "#bbb" }}>
              抽選で出た人が「最初に歌う人」です。並び順は関係ありません。実名が決まったら「参加者◯」を消して名前を追加してください。この内容はこの端末に保存されます。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── メンバープロフィール：自己紹介と近況を全員で共有 ──── */
// プロフィールの「最後に見た時刻」をこの端末に記録し、それ以降の更新を新着として扱う
const PROFILE_SEEN_KEY = "africaheart_profile_seen_v1";
// 新着判定の基準（下限）。この時刻【以前】の更新は新着扱いしない。
// 既存の登録済みプロフィール（2026-07-09の一括登録・最新 updated_at は 01:17:26Z）を
// 新着にしないため、その直後をベースラインに固定。保存値が無い/これより古い端末でも
// 既存分は新着にならず、この時刻より後の追加・編集だけが新着になる。
const PROFILE_NEW_BASELINE = "2026-07-09T01:20:00.000+00:00";
function loadProfileSeen(): string {
  try {
    return localStorage.getItem(PROFILE_SEEN_KEY) || "";
  } catch {
    return "";
  }
}
function saveProfileSeen(iso: string) {
  try {
    localStorage.setItem(PROFILE_SEEN_KEY, iso);
  } catch {
    /* 保存できなくても続行 */
  }
}
// ISO文字列を数値(ms)に。未設定("")や不正値は -Infinity（＝常に「それより新しい」）
function tMs(s: string): number {
  const t = Date.parse(s);
  return Number.isNaN(t) ? -Infinity : t;
}
function isNewer(a: string, b: string): boolean {
  return tMs(a) > tMs(b);
}
const BIRTH_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1); // 1〜12月

// プロフィール一覧の並び替え
type ProfileSort = "name" | "birthEarly" | "birthLate";
const PROFILE_SORTS: { id: ProfileSort; label: string }[] = [
  { id: "name", label: "名前（50音順）" },
  { id: "birthEarly", label: "誕生月が早い順" },
  { id: "birthLate", label: "誕生月が遅い順" },
];
// 名前の50音順（近似）。かな・カナは正しく並ぶ。漢字/ローマ字は読みが無いため近似。
function byName(a: Profile, b: Profile): number {
  return a.name.localeCompare(b.name, "ja");
}
// 並び替え結果を返す（元配列は変更しない）。誕生月・未設定(null)は常に末尾。同月内は名前で安定化。
function sortProfiles(list: Profile[], sort: ProfileSort): Profile[] {
  const arr = [...list];
  if (sort === "name") {
    arr.sort(byName);
    return arr;
  }
  arr.sort((a, b) => {
    const na = a.birth_month == null;
    const nb = b.birth_month == null;
    if (na && nb) return byName(a, b);
    if (na) return 1; // 未設定は後ろ
    if (nb) return -1;
    const ma = a.birth_month as number;
    const mb = b.birth_month as number;
    if (ma !== mb) return sort === "birthEarly" ? ma - mb : mb - ma;
    return byName(a, b);
  });
  return arr;
}

function ProfileFeature({ sinceSeen, onLatest }: { sinceSeen: string; onLatest: (iso: string) => void }) {
  const [me, setMe] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<ProfileSort>("name"); // 並び替え（既定：名前50音順）

  // 追加フォーム（開閉式）
  const [showAdd, setShowAdd] = useState(false);
  const [aName, setAName] = useState("");
  const [aIntro, setAIntro] = useState("");
  const [aFav, setAFav] = useState("");
  const [aStatus, setAStatus] = useState("");
  const [aBirth, setABirth] = useState(0); // 0=未設定, 1〜12
  const [adding, setAdding] = useState(false);

  // 編集
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eIntro, setEIntro] = useState("");
  const [eFav, setEFav] = useState("");
  const [eStatus, setEStatus] = useState("");
  const [eBirth, setEBirth] = useState(0); // 0=未設定, 1〜12
  const [saving, setSaving] = useState(false);
  const editOrigRef = useRef<Profile | null>(null); // 編集開始時のスナップショット（差分だけ保存するため）

  // 入力中はポーリングで一覧を上書きしない（編集・保存中の巻き込み防止）
  const busyRef = useRef(false);
  useEffect(() => {
    busyRef.current = editId !== null || saving || adding;
  }, [editId, saving, adding]);

  const refresh = useCallback(async (force = false) => {
    try {
      const data = await listProfiles();
      // 明示的な再取得(force=追加/保存/削除の直後)は編集中でも反映する。
      // 背景ポーリングだけを busyRef でガードし、入力中の一覧上書きを防ぐ。
      if (force || !busyRef.current) {
        setProfiles(data);
        // 実際に表示した内容の最終更新時刻を親へ通知（未読ドットの即時解消に使う）
        const maxU = data.reduce((m, p) => (isNewer(p.updated_at, m) ? p.updated_at : m), "");
        if (maxU) onLatest(maxU);
      }
      setNeedsSetup(false);
      setError(null);
    } catch (e) {
      if (e instanceof ProfileSetupError) setNeedsSetup(true);
      else setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [onLatest]);

  useEffect(() => {
    if (!isProfilesConfigured()) {
      setLoading(false);
      return;
    }
    setMe(getDeviceId());
    setAName(getNickname());
    refresh();
    const id = setInterval(() => refresh(), 5000); // 背景ポーリング（他メンバーの追加・近況更新を反映）
    return () => clearInterval(id);
  }, [refresh]);

  const canAdd = !!aName.trim() && !adding && !needsSetup;

  async function handleAdd() {
    if (!canAdd) return;
    setAdding(true);
    try {
      const who = aName.trim();
      setNickname(who);
      await addProfile({
        name: who,
        intro: aIntro.trim(),
        fav: aFav.trim(),
        status: aStatus.trim(),
        birth_month: aBirth || null,
        owner_id: me,
      });
      setAIntro("");
      setAFav("");
      setAStatus("");
      setABirth(0);
      setShowAdd(false);
      await refresh(true);
    } catch (e) {
      if (e instanceof ProfileSetupError) setNeedsSetup(true);
      else setError(e instanceof Error ? e.message : "追加に失敗しました");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(p: Profile) {
    editOrigRef.current = p; // 編集開始時点のスナップショットを保持
    setEditId(p.id);
    setEName(p.name);
    setEIntro(p.intro);
    setEFav(p.fav);
    setEStatus(p.status);
    setEBirth(p.birth_month ?? 0);
  }
  async function saveEdit(id: string) {
    const n = eName.trim();
    if (!n) return;
    // 変更した項目だけを送る（未変更項目は送らない＝他メンバーの同時編集を上書きしない）
    const orig = editOrigRef.current;
    const birth = eBirth || null;
    const patch: Partial<Pick<Profile, "name" | "intro" | "fav" | "status" | "birth_month">> = {};
    if (!orig || n !== orig.name) patch.name = n;
    if (!orig || eIntro.trim() !== orig.intro) patch.intro = eIntro.trim();
    if (!orig || eFav.trim() !== orig.fav) patch.fav = eFav.trim();
    if (!orig || eStatus.trim() !== orig.status) patch.status = eStatus.trim();
    if (!orig || birth !== (orig.birth_month ?? null)) patch.birth_month = birth;
    if (Object.keys(patch).length === 0) {
      setEditId(null); // 変更なしなら書き込まない
      return;
    }
    setSaving(true);
    try {
      await updateProfile(id, patch);
      setEditId(null);
      await refresh(true);
    } catch (e) {
      if (e instanceof ProfileSetupError) setNeedsSetup(true);
      else setError(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setSaving(false);
    }
  }
  async function handleDelete(id: string, name: string) {
    if (!confirm(`「${name || "このメンバー"}」のプロフィールを削除しますか？`)) return;
    try {
      await deleteProfile(id);
      if (editId === id) setEditId(null);
      await refresh(true);
    } catch (e) {
      if (e instanceof ProfileSetupError) setNeedsSetup(true);
      else setError(e instanceof Error ? e.message : "削除に失敗しました");
    }
  }

  const inputStyle = { background: "#f4f0ea", color: "#2c2c2c", border: "2px solid transparent" } as const;

  // 表示用に並び替えた一覧（元の profiles は保持）
  const shown = useMemo(() => sortProfiles(profiles, sortBy), [profiles, sortBy]);

  // 未接続：セットアップ案内
  if (!isProfilesConfigured()) {
    return (
      <div className="w-full">
        <div className="rounded-xl px-4 py-4" style={{ background: "#fffbe6" }}>
          <p className="text-sm font-bold mb-1" style={{ color: "#92400e" }}>データベース未接続</p>
          <p className="text-xs leading-relaxed" style={{ color: "#a16207" }}>
            みんなで共有するには Supabase の接続設定が必要です。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4">
      {error && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "#fff0f0", color: "#c0392b" }}>
          {error}
        </p>
      )}

      {/* 追加フォーム（開閉式） */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #efe9e1" }}>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3"
          style={{ background: "#faf8f5" }}
        >
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#bbb" }}>
            自己紹介を追加する
          </span>
          <span className="text-xs font-black" style={{ color: "#FF4FA3" }}>
            {showAdd ? "閉じる" : "開く"}
          </span>
        </button>
        {showAdd && (
          <div className="px-4 py-3 flex flex-col gap-2" style={{ background: "#fff" }}>
            <input
              value={aName}
              onChange={(e) => setAName(e.target.value)}
              placeholder="お名前（必須）"
              disabled={needsSetup}
              className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
              style={inputStyle}
            />
            <textarea
              value={aIntro}
              onChange={(e) => setAIntro(e.target.value)}
              placeholder="自己紹介（カラオケ歴・好きなジャンルなど）"
              rows={2}
              disabled={needsSetup}
              className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none"
              style={inputStyle}
            />
            <input
              value={aFav}
              onChange={(e) => setAFav(e.target.value)}
              placeholder="好きな曲・アーティスト（任意）"
              disabled={needsSetup}
              className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
              style={inputStyle}
            />
            <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={inputStyle}>
              <span className="text-xs font-bold flex-shrink-0" style={{ color: "#888" }}>誕生月（任意）</span>
              <select
                value={aBirth}
                onChange={(e) => setABirth(Number(e.target.value))}
                disabled={needsSetup}
                className="flex-1 text-sm font-bold bg-transparent focus:outline-none"
                style={{ color: "#2c2c2c" }}
              >
                <option value={0}>未設定</option>
                {BIRTH_MONTHS.map((m) => (
                  <option key={m} value={m}>{m}月</option>
                ))}
              </select>
            </div>
            <textarea
              value={aStatus}
              onChange={(e) => setAStatus(e.target.value)}
              placeholder="近況（最近ハマっている曲・ひとことなど）"
              rows={2}
              disabled={needsSetup}
              className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none"
              style={inputStyle}
            />
            <button
              onClick={handleAdd}
              disabled={!canAdd}
              className="w-full mt-1 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity"
              style={{
                background: "linear-gradient(135deg,#FF6B9D,#FF4FA3)",
                boxShadow: "0 3px 10px rgba(255,107,157,0.3)",
                opacity: canAdd ? 1 : 0.4,
              }}
            >
              {adding ? "追加中…" : "＋ メンバーを追加"}
            </button>
          </div>
        )}
      </div>

      {/* 一覧 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "#bbb" }}>メンバー</p>
          <span className="text-[11px]" style={{ color: "#ccc" }}>{profiles.length}人</span>
        </div>
        {profiles.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold flex-shrink-0" style={{ color: "#ccc" }}>並び替え</span>
            {PROFILE_SORTS.map((s) => {
              const on = sortBy === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSortBy(s.id)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-bold transition-all"
                  style={{
                    background: on ? "linear-gradient(135deg,#FF6B9D,#FF4FA3)" : "#f0ece5",
                    color: on ? "#fff" : "#999",
                    boxShadow: on ? "0 2px 6px rgba(255,107,157,0.3)" : "none",
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-center py-6" style={{ color: "#bbb" }}>読み込み中…</p>
      ) : profiles.length === 0 ? (
        needsSetup ? (
          <p className="text-sm text-center py-6 leading-relaxed" style={{ color: "#bbb" }}>
            共有設定が完了すると、ここにメンバーの自己紹介が表示されます。
          </p>
        ) : (
          <p className="text-sm text-center py-6 leading-relaxed" style={{ color: "#bbb" }}>
            まだメンバーがいません。
            <br />
            上の「自己紹介を追加する」から登録しましょう。
          </p>
        )
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((p) => {
            if (editId === p.id) {
              return (
                <div key={p.id} className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: "#fff", border: "2px solid #FF6B9D55" }}>
                  <input value={eName} onChange={(e) => setEName(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={inputStyle} placeholder="お名前（必須）" />
                  <textarea value={eIntro} onChange={(e) => setEIntro(e.target.value)} rows={2} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" style={inputStyle} placeholder="自己紹介" />
                  <input value={eFav} onChange={(e) => setEFav(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={inputStyle} placeholder="好きな曲・アーティスト（任意）" />
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={inputStyle}>
                    <span className="text-xs font-bold flex-shrink-0" style={{ color: "#888" }}>誕生月（任意）</span>
                    <select value={eBirth} onChange={(e) => setEBirth(Number(e.target.value))} className="flex-1 text-sm font-bold bg-transparent focus:outline-none" style={{ color: "#2c2c2c" }}>
                      <option value={0}>未設定</option>
                      {BIRTH_MONTHS.map((m) => (
                        <option key={m} value={m}>{m}月</option>
                      ))}
                    </select>
                  </div>
                  <textarea value={eStatus} onChange={(e) => setEStatus(e.target.value)} rows={2} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" style={inputStyle} placeholder="近況" />
                  <div className="flex items-center gap-2">
                    <button onClick={() => saveEdit(p.id)} disabled={saving || !eName.trim()} className="flex-1 py-2 rounded-lg text-sm font-bold text-white transition-opacity" style={{ background: "linear-gradient(135deg,#FF6B9D,#FF4FA3)", opacity: saving || !eName.trim() ? 0.4 : 1 }}>
                      {saving ? "保存中…" : "保存"}
                    </button>
                    <button onClick={() => setEditId(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "#f4f0ea", color: "#888" }}>取消</button>
                  </div>
                </div>
              );
            }
            const isNew = isNewer(p.updated_at, sinceSeen);
            const birthLabel = p.birth_month ? `${p.birth_month}月` : "";
            return (
              <div key={p.id} className="rounded-2xl p-3.5" style={{ background: "#fff", border: isNew ? "1.5px solid #ffb3d1" : "1px solid #efe9e1" }}>
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-base font-black text-white" style={{ background: "linear-gradient(135deg,#FF6B9D,#FF4FA3)" }}>
                    {(p.name.trim() || "?").charAt(0)}
                  </span>
                  <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                    <p className="text-base font-black break-words" style={{ color: "#2c2c2c" }}>
                      {p.name.trim() || "（名前なし）"}
                    </p>
                    {isNew && (
                      <span className="flex-shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full text-white" style={{ background: "#ff3b6b" }}>
                        新着
                      </span>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex gap-1">
                    <button onClick={() => startEdit(p)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold" style={{ background: "#f4f0ea", color: "#888" }}>編集</button>
                    <button onClick={() => handleDelete(p.id, p.name)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold" style={{ background: "#fff0f0", color: "#ff6b6b" }}>削除</button>
                  </div>
                </div>

                {p.intro.trim() && (
                  <p className="text-sm mt-2.5 leading-relaxed break-words whitespace-pre-wrap" style={{ color: "#555" }}>
                    {p.intro.trim()}
                  </p>
                )}

                {(birthLabel || p.fav.trim()) && (
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mt-2">
                    {birthLabel && (
                      <span className="inline-flex items-baseline gap-1.5">
                        <span className="text-[10px] font-black tracking-wider" style={{ color: "#bbb" }}>誕生月</span>
                        <span className="text-xs font-bold" style={{ color: "#FF4FA3" }}>{birthLabel}</span>
                      </span>
                    )}
                    {p.fav.trim() && (
                      <span className="inline-flex items-baseline gap-1.5 min-w-0">
                        <span className="flex-shrink-0 text-[10px] font-black tracking-wider" style={{ color: "#bbb" }}>好き</span>
                        <span className="text-xs font-bold break-words" style={{ color: "#845ef7" }}>{p.fav.trim()}</span>
                      </span>
                    )}
                  </div>
                )}

                {p.status.trim() && (
                  <div className="mt-2.5 rounded-xl px-3 py-2" style={{ background: "#fff0f6", border: "1px solid #ffd9e9" }}>
                    <p className="text-[10px] font-black tracking-widest uppercase mb-0.5" style={{ color: "#FF4FA3" }}>近況</p>
                    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap" style={{ color: "#2c2c2c" }}>
                      {p.status.trim()}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {needsSetup ? (
        <p className="text-[11px] text-center leading-relaxed" style={{ color: "#bbb" }}>
          共有設定が未完了です（プロフィールを全員で共有するには member_profiles テーブルの作成が必要です）
        </p>
      ) : (
        <p className="text-[11px] leading-relaxed" style={{ color: "#bbb" }}>
          自己紹介と近況は全員に共有され、約5秒ごとに自動更新されます。どなたでも編集・削除できます（みんなで管理）。
        </p>
      )}
    </div>
  );
}

/* ── 機能一覧（ここに追加していく）──────────────────── */
const features: Feature[] = [
  {
    id: "duet",
    tab: "デュエット",
    title: "デュエット曲リスト",
    description: "歌いたいデュエット曲を登録し、歌える曲にいいね。全員で共有されます。",
    render: () => <DuetFeature />,
  },
  {
    id: "homework",
    tab: "宿題ルーレット",
    title: "宿題ルーレット",
    description: "ここで決まった3つが次回の宿題テーマです。各テーマに合う持ち歌を1曲ずつ、次回のオフ会までに準備してきてください。",
    render: () => <HomeworkRoulette />,
  },
  {
    id: "singorder",
    tab: "歌唱順ルーレット",
    title: "歌唱順ルーレット",
    description: "参加者からスロット形式で最初に歌う人を抽選し、右回り／左回りの進行方向を決めます。",
    render: () => <SingingOrderRoulette />,
  },
  {
    id: "profile",
    tab: "プロフィール",
    title: "メンバープロフィール",
    description: "",
    render: (ctx) => <ProfileFeature sinceSeen={ctx.sinceSeen} onLatest={ctx.onLatest} />,
  },
];

export default function TestPage() {
  const [activeId, setActiveId] = useState<string>(features[0]?.id ?? "");
  const active = features.find((f) => f.id === activeId);

  // プロフィールの新着（未読）検知：この端末が最後に見た時刻と、DB上の最終更新時刻を比較
  const [seenAt, setSeenAt] = useState(""); // この端末が確認済みの最終更新時刻
  const [latestAt, setLatestAt] = useState(""); // DB上の最終更新時刻（ポーリング）
  const [sinceSeen, setSinceSeen] = useState(""); // カードの「新着」判定基準（タブを開いた時点でスナップショット）

  // 端末の保存値を読み込み（初回）。基準時刻（PROFILE_NEW_BASELINE）を下限にして、
  // 既存プロフィールが新着扱いにならないようにする（保存値が無い初回端末でも既存分は非新着）。
  useEffect(() => {
    const stored = loadProfileSeen();
    const base = isNewer(PROFILE_NEW_BASELINE, stored) ? PROFILE_NEW_BASELINE : stored;
    setSeenAt(base);
    setSinceSeen(base);
  }, []);

  // DBの最終更新時刻を定期取得（他メンバーの追加/編集を検知）
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const latest = await getLatestUpdatedAt();
        if (alive) setLatestAt(latest);
      } catch {
        /* 未設定/一時的な失敗は無視（ドットを出さない） */
      }
    };
    check();
    const id = setInterval(check, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // プロフィールタブを見ている間は「確認済み」を最新へ追従（離れても未読ドットが残らない）
  useEffect(() => {
    if (activeId === "profile" && isNewer(latestAt, seenAt)) {
      setSeenAt(latestAt);
      saveProfileSeen(latestAt);
    }
  }, [activeId, latestAt, seenAt]);

  // プロフィール表示中(5秒ポーリング)に判明した最終更新時刻を即時反映（15秒待ちの隙で未読が誤点灯するのを防ぐ）
  const reportLatest = useCallback((iso: string) => {
    setLatestAt((prev) => (isNewer(iso, prev) ? iso : prev));
  }, []);

  // 未読の更新があるか（タブのドット用。プロフィール表示中は出さない）
  const profileUnseen = isNewer(latestAt, seenAt);

  function selectTab(id: string) {
    // プロフィールを開く瞬間に「新着」判定の基準を確定（開いた後の追従で消えないように）
    if (id === "profile") setSinceSeen(seenAt);
    setActiveId(id);
  }

  return (
    <main className="min-h-screen fun-bg pb-16">
      {/* Top bar */}
      <div className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3" style={{ background: "#f0ece5" }}>
        <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl card" style={{ color: "#555" }}>
          ← 戻る
        </Link>
        <h1 className="text-base font-black" style={{ color: "#2c2c2c" }}>会員メニュー</h1>
        <Link
          href="/admin"
          className="ml-auto text-sm font-semibold px-3 py-2 rounded-xl card"
          style={{ color: "#555" }}
        >
          管理画面
        </Link>
      </div>

      <div className="px-4 pt-3 max-w-lg mx-auto flex flex-col gap-4">
        {/* 説明 */}
        <div className="card px-4 py-4">
          <p className="text-sm leading-relaxed" style={{ color: "#666" }}>
            アフリカハートの会員メニューです。{features.length > 1 ? "下のメニューから各機能を切り替えられます。" : ""}
          </p>
        </div>

        {features.length === 0 ? (
          <div className="card px-4 py-10 text-center">
            <p className="text-sm" style={{ color: "#aaa" }}>まだ機能がありません</p>
          </div>
        ) : (
          <>
            {/* 機能メニュー（2つ以上のときだけ表示）。横スクロールで隠れないよう2列グリッドで全部見せる */}
            {features.length > 1 && (
            <div className="grid grid-cols-2 gap-2">
              {features.map((f) => {
                const sel = f.id === activeId;
                const showDot = f.id === "profile" && profileUnseen && activeId !== "profile";
                return (
                  <button
                    key={f.id}
                    onClick={() => selectTab(f.id)}
                    className="relative w-full px-3 py-3 rounded-2xl text-sm font-black transition-all text-center"
                    style={{
                      background: sel ? "linear-gradient(135deg,#FF6B9D,#FF4FA3)" : "#f0ece5",
                      color: sel ? "#fff" : "#aaa",
                      boxShadow: sel ? "0 3px 10px rgba(255,107,157,0.3)" : "none",
                    }}
                  >
                    {f.tab}
                    {showDot && (
                      <span
                        className="absolute top-1.5 right-2 w-2.5 h-2.5 rounded-full"
                        style={{ background: "#ff3b6b", border: "1.5px solid #f0ece5" }}
                        aria-label="新着あり"
                      />
                    )}
                  </button>
                );
              })}
            </div>
            )}

            {/* 選択中の機能 */}
            {active && (
              <div className="card overflow-hidden animate-fade-up">
                <div className="px-4 py-3 border-b" style={{ borderColor: "#f4f0ea" }}>
                  <p className="text-sm font-black" style={{ color: "#2c2c2c" }}>{active.title}</p>
                  {active.description && (
                    <p className="text-xs mt-1" style={{ color: "#aaa" }}>{active.description}</p>
                  )}
                </div>
                <div className="px-4 py-6 flex justify-center">{active.render({ sinceSeen, onLatest: reportLatest })}</div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
