"use client";

/* ============================================================
   デュエット：歌いたいデュエット曲を登録・いいね
   ------------------------------------------------------------
   もとは会員メニュー（app/test/page.tsx）の中に直接書いてあったものを、
   9/6 にこのファイルへそのまま切り出した（中身は変えていない）。
   会員メニューと、管理画面 ＞ 社長室 ＞ 設定 の両方から同じものを出す
   （一覧は app/components/memberFeatures.tsx）。
   保存の場所（Supabase のテーブル・localStorage のキー）はそのまま。変えないこと。
   ============================================================ */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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

/* ── デュエット：歌いたいデュエット曲を登録・いいね ──── */
const KEY_OPTS = [3, 2, 1, 0, -1, -2, -3];
const MAX_ROWS = 5;
type Row = { title: string; artist: string; key: number; part: string };
const emptyRow = (): Row => ({ title: "", artist: "", key: 0, part: "" });

export default function DuetFeature() {
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

  // 表示の折りたたみ（登録が増えてページが縦長になり過ぎないように）
  const [showAdd, setShowAdd] = useState(false); // 登録フォームの開閉（既定：閉じる）
  const [openOwners, setOpenOwners] = useState<Set<string>>(new Set()); // 開いている人（名前）
  const [myName, setMyName] = useState(""); // この端末の名前（自分の曲を先頭・自動で開く）
  const didInitOpenRef = useRef(false); // 自分の曲を一度だけ自動オープン

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
    setMyName(getNickname().trim());
    refresh();
    const id = setInterval(refresh, 4000); // 常に最新を反映
    return () => clearInterval(id);
  }, [refresh]);

  // 名前ごとにグループ化（自分の曲を先頭に固定）
  const groups = useMemo(() => {
    const m = new Map<string, DuetSong[]>();
    for (const s of songs) {
      const key = s.owner_name.trim() || "（名前なし）";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(s);
    }
    return Array.from(m.entries()).sort((a, b) => {
      const aMine = a[0] === myName;
      const bMine = b[0] === myName;
      if (aMine && !bMine) return -1; // 自分の曲を先頭へ
      if (bMine && !aMine) return 1;
      return a[0].localeCompare(b[0], "ja");
    });
  }, [songs, myName]);

  // 自分の曲だけ最初から開いておく（1回だけ）。他の人は閉じた状態＝ページを短く保つ。
  useEffect(() => {
    if (didInitOpenRef.current || songs.length === 0) return;
    didInitOpenRef.current = true;
    const my = getNickname().trim();
    if (!my) return;
    const owners = new Set(songs.map((s) => s.owner_name.trim() || "（名前なし）"));
    if (owners.has(my)) setOpenOwners(new Set([my]));
  }, [songs]);

  // 開閉トグル
  function toggleOwner(key: string) {
    setOpenOwners((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  const allKeys = groups.map(([k]) => k);
  const allOpen = allKeys.length > 0 && allKeys.every((k) => openOwners.has(k));
  function toggleAll() {
    setOpenOwners(allOpen ? new Set() : new Set(allKeys));
  }

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
      setMyName(who);
      setOpenOwners((prev) => new Set(prev).add(who)); // 登録後は自分の曲を開いて見せる
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

      {/* 登録フォーム（開閉式・既定は閉じてページを短く保つ） */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #efe9e1" }}>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3.5"
          style={{ background: showAdd ? "#faf8f5" : "linear-gradient(135deg,#A8175F,#C81E77)" }}
        >
          <span className="text-sm font-black" style={{ color: showAdd ? "#888" : "#fff" }}>＋ 歌いたいデュエット曲を登録</span>
          <span className="text-xs font-black" style={{ color: showAdd ? "#C81E77" : "rgba(255,255,255,0.95)" }}>{showAdd ? "閉じる" : "開く"}</span>
        </button>
        {showAdd && (
          <div className="px-3.5 pb-3.5 pt-2" style={{ background: "#faf8f5" }}>
            <p className="text-[11px] mb-2.5 leading-relaxed" style={{ color: "#bbb" }}>お名前と、歌いたい曲（最大{MAX_ROWS}曲）を入力してください。</p>
        <input
          value={name} onChange={(e) => setName(e.target.value)} placeholder="あなたの名前（必須）"
          className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none mb-2" style={inputStyle}
        />
        <div className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <div key={i} className="rounded-xl p-2" style={{ background: "#fff", border: "1px solid #efe9e1" }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black text-white" style={{ background: "#C81E77" }}>{i + 1}</span>
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
            background: "linear-gradient(135deg,#A8175F,#C81E77)",
            boxShadow: "0 3px 10px rgba(168,23,95,0.3)",
            opacity: canSubmit ? 1 : 0.4,
          }}
        >
          {adding ? "登録中…" : `＋ ${filledRows.length || ""}曲を登録する`}
        </button>
          </div>
        )}
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
        <>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] leading-snug" style={{ color: "#aaa" }}>名前をタップすると、その人の曲が開きます</span>
          <button onClick={toggleAll} className="flex-shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "#f0ece5", color: "#888" }}>
            {allOpen ? "すべて閉じる" : "すべて開く"}
          </button>
        </div>
        <div className="flex flex-col gap-2.5">
          {groups.map(([owner, list]) => {
            const isMine = owner === myName;
            const open = openOwners.has(owner);
            return (
            <div key={owner} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${isMine ? "#EFC9DD" : "#efe9e1"}` }}>
              {/* 名前セクション見出し（タップで開閉） */}
              <button
                onClick={() => toggleOwner(owner)}
                className="w-full flex items-center gap-3 px-3 py-3"
                style={{ background: open ? "#FBEAF2" : "#fff" }}
              >
                <span className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white" style={{ background: "linear-gradient(135deg,#A8175F,#C81E77)" }}>
                  {owner.charAt(0)}
                </span>
                <span className="flex-1 min-w-0 flex items-center gap-2 flex-wrap text-left">
                  <span className="text-sm font-black" style={{ color: "#2c2c2c" }}>{owner}</span>
                  {isMine && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full text-white" style={{ background: "#C81E77" }}>あなたの曲</span>
                  )}
                  <span className="text-[11px] font-bold" style={{ color: "#c98aae" }}>{list.length}曲</span>
                </span>
                <span className="flex-shrink-0 text-xs font-black" style={{ color: "#C81E77" }}>{open ? "閉じる" : "開く"}</span>
              </button>

              {open && (
              <div className="flex flex-col gap-2 px-3 pb-3 pt-1">
                {list.map((s) => {
                  const likeEntries = s.likes.filter((e) => likeName(e).trim()); // 名前ありのスタンプ

                  if (editId === s.id) {
                    return (
                      <div key={s.id} className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: "#fff", border: "2px solid #C81E7755" }}>
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
                          <button onClick={() => saveEdit(s.id)} className="flex-1 py-2 rounded-lg text-sm font-bold text-white" style={{ background: "linear-gradient(135deg,#A8175F,#C81E77)" }}>保存</button>
                          <button onClick={() => setEditId(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "#f4f0ea", color: "#888" }}>取消</button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={s.id} className="rounded-2xl p-3" style={{ background: "#fff", border: "1px solid #efe9e1" }}>
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center" style={{ background: "#f4f0ea" }}>
                          <span className="text-sm font-black leading-none" style={{ color: "#C81E77" }}>{keyLabel(s.key_offset)}</span>
                          <span className="text-[8px] font-bold mt-0.5" style={{ color: "#bbb" }}>キー</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold break-words" style={{ color: "#2c2c2c" }}>{s.title}</p>
                          <p className="text-xs break-words" style={{ color: "#999" }}>{s.artist || "—"}</p>
                          {s.part && s.part.trim() && (
                            <p className="text-[11px] font-semibold mt-0.5 leading-relaxed break-words" style={{ color: "#A8175F" }}>
                              {s.part.trim()} を歌ってほしい
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => addLike(s)}
                          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all"
                          style={{ background: likeEntries.length ? "#FBEAF2" : "#f4f0ea", border: `1.5px solid ${likeEntries.length ? "#C81E77" : "transparent"}` }}
                          title="「歌える！」を表明（複数人OK）"
                        >
                          <span className="text-xs font-black" style={{ color: likeEntries.length ? "#C81E77" : "#888" }}>歌える</span>
                          <span className="text-xs font-black" style={{ color: likeEntries.length ? "#C81E77" : "#bbb" }}>{likeEntries.length}</span>
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
                                style={{ background: "#FBEAF2", color: "#C81E77" }}
                              >
                                {n}
                                <button
                                  onClick={() => removeLike(s, e)}
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                                  style={{ background: "transparent", color: "#C81E77" }}
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
              )}
            </div>
            );
          })}
        </div>
        </>
      )}
      <p className="text-[11px] leading-relaxed" style={{ color: "#bbb" }}>
        「歌える」を押して名前を入れると意思表示できます。曲はどなたでも編集・削除できます（みんなで管理）。内容は全員に共有され、約4秒ごとに自動更新されます。名前をタップすると、その人の曲を開けます。
      </p>
    </div>
  );
}
