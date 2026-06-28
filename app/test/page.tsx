"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
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
  hasLiked,
  likeId,
  likerNames,
  type DuetSong,
} from "@/lib/duet";

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

type Feature = {
  id: string;
  tab: string;          // タブに表示する短い名前
  title: string;        // 機能の正式名称
  description: string;  // 機能の説明
  render: () => ReactNode;
};

/* ── サンプル機能①：カウンター ───────────────────────── */
function SampleCounter() {
  const [n, setN] = useState(0);
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => setN((v) => v - 1)}
        className="w-11 h-11 rounded-xl text-xl font-black"
        style={{ background: "#f0ece5", color: "#555" }}
      >
        −
      </button>
      <span className="text-2xl font-black w-16 text-center" style={{ color: "#2c2c2c" }}>
        {n}
      </span>
      <button
        onClick={() => setN((v) => v + 1)}
        className="w-11 h-11 rounded-xl text-xl font-black text-white"
        style={{ background: "linear-gradient(135deg,#FF6B9D,#FF4FA3)" }}
      >
        ＋
      </button>
    </div>
  );
}

/* ── サンプル機能②：現在時刻 ─────────────────────────── */
function SampleClock() {
  const [now, setNow] = useState<string>("—");
  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <p className="text-3xl font-black tabular-nums" style={{ color: "#2c2c2c" }}>
      {now}
    </p>
  );
}

/* ── デュエット：歌いたいデュエット曲を登録・いいね ──── */
const KEY_OPTS = [3, 2, 1, 0, -1, -2, -3];
const MAX_ROWS = 5;
type Row = { title: string; artist: string; key: number };
const emptyRow = (): Row => ({ title: "", artist: "", key: 0 });

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

  async function toggleLike(s: DuetSong) {
    const liked = hasLiked(s.likes, me);
    let next: string[];
    if (liked) {
      next = s.likes.filter((e) => likeId(e) !== me);
    } else {
      const def = getNickname() || name.trim();
      const input = window.prompt("「歌える！」を表明します。お名前を入力してください", def);
      if (input === null) return;
      const who = input.trim();
      if (!who) return;
      setNickname(who);
      setName(who);
      next = [...s.likes, makeLike(me, who)];
    }
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
  }
  async function saveEdit(id: string) {
    const t = eTitle.trim();
    if (!t) return;
    try {
      await updateSong(id, { title: t, artist: eArtist.trim(), key_offset: eKey });
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
              <div className="flex gap-1.5 pl-6">
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
                  const mine = s.owner_id === me;
                  const liked = hasLiked(s.likes, me);
                  const names = likerNames(s.likes);
                  if (editId === s.id) {
                    return (
                      <div key={s.id} className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: "#fff", border: "2px solid #FF6B9D55" }}>
                        <input value={eTitle} onChange={(e) => setETitle(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={inputStyle} placeholder="曲名" />
                        <input value={eArtist} onChange={(e) => setEArtist(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={inputStyle} placeholder="アーティスト名" />
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
                        </div>
                        <button
                          onClick={() => toggleLike(s)}
                          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-2 rounded-xl transition-all"
                          style={{ background: liked ? "#ffe8f1" : "#f4f0ea", border: `1.5px solid ${liked ? "#FF6B9D" : "transparent"}` }}
                          title="歌える！（いいね）"
                        >
                          <span className="text-sm">{liked ? "🎤" : "🎙️"}</span>
                          <span className="text-xs font-black" style={{ color: liked ? "#FF4FA3" : "#aaa" }}>{s.likes.length}</span>
                        </button>
                        {mine && (
                          <div className="flex-shrink-0 flex gap-1">
                            <button onClick={() => startEdit(s)} className="p-2 rounded-lg" style={{ background: "#f4f0ea", color: "#888" }}>✏️</button>
                            <button onClick={() => handleDelete(s.id)} className="p-2 rounded-lg" style={{ background: "#fff0f0", color: "#ff6b6b" }}>🗑️</button>
                          </div>
                        )}
                      </div>
                      {names.length > 0 && (
                        <p className="text-[11px] mt-2 pl-1 leading-relaxed" style={{ color: "#FF4FA3" }}>
                          🎤 歌える：{names.join("・")}
                        </p>
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
        🎙️を押して名前を入れると「歌える！」を表明できます。自分が登録した曲は ✏️編集・🗑️削除できます。内容は全員に共有され、約4秒ごとに自動更新されます。
      </p>
    </div>
  );
}

/* ── 機能一覧（ここに追加していく）──────────────────── */
const features: Feature[] = [
  {
    id: "sample-counter",
    tab: "カウンター",
    title: "サンプル：カウンター",
    description: "動作確認用のサンプルです。ボタンで数字が増減します。",
    render: () => <SampleCounter />,
  },
  {
    id: "sample-clock",
    tab: "現在時刻",
    title: "サンプル：現在時刻",
    description: "1秒ごとに現在時刻を更新して表示します。",
    render: () => <SampleClock />,
  },
  {
    id: "duet",
    tab: "デュエット",
    title: "デュエット曲リスト",
    description: "歌いたいデュエット曲を登録し、歌える曲に❤️。全員で共有されます。",
    render: () => <DuetFeature />,
  },
];

export default function TestPage() {
  const [activeId, setActiveId] = useState<string>(features[0]?.id ?? "");
  const active = features.find((f) => f.id === activeId);

  return (
    <main className="min-h-screen fun-bg pb-16">
      {/* Top bar */}
      <div className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3" style={{ background: "#f0ece5" }}>
        <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl card" style={{ color: "#555" }}>
          ← 戻る
        </Link>
        <h1 className="text-base font-black" style={{ color: "#2c2c2c" }}>🧪 動作確認</h1>
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
            新しい機能を試すためのページです。上のタブで機能を切り替えて動作を確認できます。
          </p>
        </div>

        {features.length === 0 ? (
          <div className="card px-4 py-10 text-center">
            <p className="text-3xl mb-2">🧩</p>
            <p className="text-sm" style={{ color: "#aaa" }}>まだ機能がありません</p>
          </div>
        ) : (
          <>
            {/* 機能タブ */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {features.map((f) => {
                const sel = f.id === activeId;
                return (
                  <button
                    key={f.id}
                    onClick={() => setActiveId(f.id)}
                    className="flex-shrink-0 px-4 py-2.5 rounded-2xl text-sm font-black transition-all"
                    style={{
                      background: sel ? "linear-gradient(135deg,#FF6B9D,#FF4FA3)" : "#f0ece5",
                      color: sel ? "#fff" : "#aaa",
                      boxShadow: sel ? "0 3px 10px rgba(255,107,157,0.3)" : "none",
                    }}
                  >
                    {f.tab}
                  </button>
                );
              })}
            </div>

            {/* 選択中の機能 */}
            {active && (
              <div className="card overflow-hidden animate-fade-up">
                <div className="px-4 py-3 border-b" style={{ borderColor: "#f4f0ea" }}>
                  <p className="text-sm font-black" style={{ color: "#2c2c2c" }}>{active.title}</p>
                  <p className="text-xs mt-1" style={{ color: "#aaa" }}>{active.description}</p>
                </div>
                <div className="px-4 py-6 flex justify-center">{active.render()}</div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
