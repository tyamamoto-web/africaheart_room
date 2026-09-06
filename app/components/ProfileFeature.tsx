"use client";

/* ============================================================
   メンバープロフィール：自己紹介と近況を全員で共有
   ------------------------------------------------------------
   もとは会員メニュー（app/test/page.tsx）の中に直接書いてあったものを、
   9/6 にこのファイルへそのまま切り出した（中身は変えていない）。
   会員メニューと、管理画面 ＞ 社長室 ＞ 設定 の両方から同じものを出す
   （一覧は app/components/memberFeatures.tsx）。
   保存の場所（Supabase のテーブル・localStorage のキー）はそのまま。変えないこと。
   ============================================================ */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getDeviceId, getNickname, setNickname } from "@/lib/duet";
import {
  isProfilesConfigured,
  listProfiles,
  addProfile,
  updateProfile,
  deleteProfile,
  ProfileSetupError,
  type Profile,
} from "@/lib/profiles";
import {
  listReactions,
  addReaction,
  removeReaction,
  clearReactions,
  REACTION_MAX_LEN,
  type Reaction,
} from "@/lib/reactions";

/* ── メンバープロフィール：自己紹介と近況を全員で共有 ──── */
// プロフィールの「最後に見た時刻」をこの端末に記録し、それ以降の更新を新着として扱う
const PROFILE_SEEN_KEY = "africaheart_profile_seen_v1";
// 新着判定の基準（下限）。この時刻【以前】の更新は新着扱いしない。
// 既存の登録済みプロフィール（2026-07-09の一括登録・最新 updated_at は 01:17:26Z）を
// 新着にしないため、その直後をベースラインに固定。保存値が無い/これより古い端末でも
// 既存分は新着にならず、この時刻より後の追加・編集だけが新着になる。
export const PROFILE_NEW_BASELINE = "2026-07-09T01:20:00.000+00:00";
export function loadProfileSeen(): string {
  try {
    return localStorage.getItem(PROFILE_SEEN_KEY) || "";
  } catch {
    return "";
  }
}
export function saveProfileSeen(iso: string) {
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
export function isNewer(a: string, b: string): boolean {
  return tMs(a) > tMs(b);
}
// 新着マークの表示期間。更新から2週間(14日)を過ぎたら新着扱いを解除する。
const PROFILE_NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
// updated_at が現在時刻から2週間以内なら true（それより古い更新・未設定は新着にしない）。
export function withinNewWindow(iso: string, nowMs: number): boolean {
  const t = tMs(iso);
  if (t === -Infinity) return false;
  return nowMs - t <= PROFILE_NEW_WINDOW_MS;
}
const BIRTH_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1); // 1〜12月

// プロフィール一覧の並び替え
type ProfileSort = "name" | "birthEarly" | "birthLate";
const PROFILE_SORTS: { id: ProfileSort; label: string }[] = [
  { id: "name", label: "名前（50音順）" },
  { id: "birthEarly", label: "誕生月が早い順" },
  { id: "birthLate", label: "誕生月が遅い順" },
];
// 50音順の読み補正：表示名のままでは正しい位置に並ばない人（漢字/ローマ字/一部カナ）の読み。
// 未登録の名前は表示名そのままで比較（かな名はこれで正しく並ぶ）。新規メンバーで
// 読みがズレる場合はここに追記する。
const NAME_YOMI: Record<string, string> = {
  Take: "たけ",
  ノリ: "のり",
  ハッシー: "はっしー",
  ヒィ: "ひぃ",
  次元: "じげん",
  青空: "あおぞら",
};
function nameSortKey(p: Profile): string {
  const n = p.name.trim();
  return NAME_YOMI[n] ?? n;
}
// 名前の50音順。NAME_YOMI に読みがあればそれで、無ければ表示名で比較。
function byName(a: Profile, b: Profile): number {
  return nameSortKey(a).localeCompare(nameSortKey(b), "ja");
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

/* ── 近況への「リアクション」（匿名・YouTubeコメント風）──── */
// 投稿時刻を「たった今／n分前／n時間前／n日前／M月D日」の相対表記へ
function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "たった今";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}日前`;
  const dt = new Date(t);
  return `${dt.getMonth() + 1}月${dt.getDate()}日`;
}
const REACTION_VISIBLE = 4; // 既定で見せる件数（それ以上は「以前のリアクション…」で展開）

// 匿名アバター（絵文字は使わずSVGの人型シルエット）
function AnonAvatar() {
  return (
    <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#efe7f2" }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#a487ba" aria-hidden>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6v1H4z" />
      </svg>
    </span>
  );
}
// 見出しの吹き出しアイコン（SVG）
function BubbleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#C81E77" aria-hidden>
      <path d="M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V5a1 1 0 0 1 1-1z" />
    </svg>
  );
}

function ReactionThread({
  list,
  myId,
  onAdd,
  onRemove,
}: {
  list: Reaction[]; // 古い→新しい順で渡す
  myId: string;
  onAdd: (text: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [openInput, setOpenInput] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const shown = showAll ? list : list.slice(-REACTION_VISIBLE);
  const hidden = list.length - shown.length;
  const canPost = !!text.trim() && !posting;

  async function submit() {
    const t = text.trim();
    if (!t || posting) return;
    setPosting(true);
    try {
      await onAdd(t);
      setText("");
      setOpenInput(false);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="mt-2 pl-1">
      {/* 見出し */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <BubbleIcon />
        <span className="text-[11px] font-black tracking-wide" style={{ color: "#C81E77" }}>リアクション</span>
        {list.length > 0 && (
          <span className="text-[11px] font-bold" style={{ color: "#c98aae" }}>{list.length}</span>
        )}
      </div>

      {/* 一覧（YouTubeコメント風） */}
      {hidden > 0 && (
        <button onClick={() => setShowAll(true)} className="block text-[11px] font-bold mb-1.5" style={{ color: "#999" }}>
          以前のリアクション{hidden}件を表示
        </button>
      )}
      {shown.length > 0 && (
        <div className="flex flex-col gap-2 mb-2">
          {shown.map((r) => {
            const mine = !!myId && r.by === myId;
            return (
              <div key={r.id} className="flex items-start gap-2">
                <AnonAvatar />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold" style={{ color: "#999" }}>匿名さん</span>
                    {mine && (
                      <span className="text-[9px] font-black px-1 py-0.5 rounded" style={{ background: "#FBEAF2", color: "#C81E77" }}>あなた</span>
                    )}
                    {r.at && <span className="text-[10px]" style={{ color: "#ccc" }}>{timeAgo(r.at)}</span>}
                  </div>
                  <p className="text-sm leading-snug break-words whitespace-pre-wrap" style={{ color: "#2c2c2c" }}>{r.text}</p>
                </div>
                <button
                  onClick={() => {
                    if (confirm("このリアクションを削除しますか？")) onRemove(r.id);
                  }}
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm"
                  style={{ background: "transparent", color: "#ccc" }}
                  aria-label="リアクションを削除"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 入力（開閉式） */}
      {openInput ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <input
              value={text}
              onChange={(e) => setText(e.target.value.replace(/\n/g, "").slice(0, REACTION_MAX_LEN))}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              maxLength={REACTION_MAX_LEN}
              autoFocus
              placeholder="あたたかいひとことを（匿名）"
              className="flex-1 min-w-0 rounded-full px-3 py-2 text-sm focus:outline-none"
              style={{ background: "#f4f0ea", color: "#2c2c2c", border: "2px solid transparent" }}
            />
            <button
              onClick={submit}
              disabled={!canPost}
              className="flex-shrink-0 px-3.5 py-2 rounded-full text-xs font-black text-white transition-opacity"
              style={{ background: "linear-gradient(135deg,#A8175F,#C81E77)", opacity: canPost ? 1 : 0.4 }}
            >
              {posting ? "送信中" : "送信"}
            </button>
          </div>
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px]" style={{ color: "#c98aae" }}>相手が笑顔になるリアクションで（匿名で送られます）</span>
            <span className="text-[10px] font-bold" style={{ color: REACTION_MAX_LEN - text.length <= 3 ? "#ff6b6b" : "#ccc" }}>
              {text.length}/{REACTION_MAX_LEN}
            </span>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpenInput(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold"
          style={{ background: "#f4f0ea", color: "#888" }}
        >
          ＋ リアクションを入れる
        </button>
      )}
    </div>
  );
}

export default function ProfileFeature({ sinceSeen, onLatest }: { sinceSeen: string; onLatest: (iso: string) => void }) {
  const [me, setMe] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<ProfileSort>("name"); // 並び替え（既定：名前50音順）

  // 近況へのリアクション（匿名・全員分をまとめて取得し pid で振り分け）
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const reactionsByPid = useMemo(() => {
    const m = new Map<string, Reaction[]>();
    for (const r of reactions) {
      if (!m.has(r.pid)) m.set(r.pid, []);
      m.get(r.pid)!.push(r);
    }
    m.forEach((arr) => {
      arr.sort((a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0)); // 古い→新しい
    });
    return m;
  }, [reactions]);

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

  // リアクションの取得（失敗時は既存表示を維持＝プロフィール表示を妨げない）
  const refreshReactions = useCallback(async () => {
    try {
      setReactions(await listReactions());
    } catch {
      /* no-op */
    }
  }, []);

  useEffect(() => {
    if (!isProfilesConfigured()) {
      setLoading(false);
      return;
    }
    setMe(getDeviceId());
    setAName(getNickname());
    refresh();
    refreshReactions();
    const id = setInterval(() => refresh(), 5000); // 背景ポーリング（他メンバーの追加・近況更新を反映）
    const rid = setInterval(() => refreshReactions(), 5000); // リアクションも最新へ
    return () => {
      clearInterval(id);
      clearInterval(rid);
    };
  }, [refresh, refreshReactions]);

  // リアクションを追加（匿名）。楽観更新→サーバの全件で確定。
  const addReactionTo = useCallback(
    async (pid: string, body: string) => {
      const temp: Reaction = {
        id: `temp-${Date.now()}`,
        pid,
        text: body.trim().slice(0, REACTION_MAX_LEN),
        by: me,
        at: new Date().toISOString(),
      };
      setReactions((prev) => [...prev, temp]);
      try {
        setReactions(await addReaction(pid, body, me));
      } catch (e) {
        setError(e instanceof Error ? e.message : "リアクションの送信に失敗しました");
        refreshReactions(); // 楽観分を戻す
      }
    },
    [me, refreshReactions]
  );

  // リアクションを削除（誰でも可＝不適切なものを消せる。楽観更新→サーバの全件で確定）
  const removeReactionById = useCallback(
    async (rid: string) => {
      setReactions((prev) => prev.filter((r) => r.id !== rid));
      try {
        setReactions(await removeReaction(rid));
      } catch (e) {
        setError(e instanceof Error ? e.message : "リアクションの削除に失敗しました");
        refreshReactions();
      }
    },
    [refreshReactions]
  );

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
    // 近況(status)を変更する場合、その近況に付いた（＝前の内容への）リアクションはリセットする。
    // 消える件数がある時だけ確認する（勝手に消えて驚かないよう、本人の同意を取る）。
    const statusChanged = patch.status !== undefined;
    const reactionCount = statusChanged ? reactionsByPid.get(id)?.length ?? 0 : 0;
    if (
      reactionCount > 0 &&
      !confirm(`近況を更新すると、今の近況へのリアクション${reactionCount}件もリセットされます。よろしいですか？`)
    ) {
      return; // 中止（編集は開いたまま）
    }
    setSaving(true);
    try {
      await updateProfile(id, patch);
      // 近況を更新したので、前の近況へのリアクションを消す（更新＝リセット）
      if (statusChanged) {
        setReactions((prev) => prev.filter((r) => r.pid !== id)); // 楽観的に消す
        try {
          await clearReactions(id);
        } catch {
          refreshReactions(); // 失敗時はサーバ状態に戻す
        }
      }
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
      // プロフィール削除に合わせて、そのリアクションも後片付け（孤立データを残さない）
      setReactions((prev) => prev.filter((r) => r.pid !== id));
      clearReactions(id).catch(() => {});
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
          <span className="text-xs font-black" style={{ color: "#C81E77" }}>
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
                background: "linear-gradient(135deg,#A8175F,#C81E77)",
                boxShadow: "0 3px 10px rgba(168,23,95,0.3)",
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
                    background: on ? "linear-gradient(135deg,#A8175F,#C81E77)" : "#f0ece5",
                    color: on ? "#fff" : "#999",
                    boxShadow: on ? "0 2px 6px rgba(168,23,95,0.3)" : "none",
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
                <div key={p.id} className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: "#fff", border: "2px solid #C81E7755" }}>
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
                  {(reactionsByPid.get(p.id)?.length ?? 0) > 0 && (
                    <p className="text-[10px] leading-snug -mt-1" style={{ color: "#c98aae" }}>
                      近況を更新すると、今のリアクション{reactionsByPid.get(p.id)!.length}件はリセットされます。
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <button onClick={() => saveEdit(p.id)} disabled={saving || !eName.trim()} className="flex-1 py-2 rounded-lg text-sm font-bold text-white transition-opacity" style={{ background: "linear-gradient(135deg,#A8175F,#C81E77)", opacity: saving || !eName.trim() ? 0.4 : 1 }}>
                      {saving ? "保存中…" : "保存"}
                    </button>
                    <button onClick={() => setEditId(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "#f4f0ea", color: "#888" }}>取消</button>
                  </div>
                </div>
              );
            }
            // 新着＝未読 かつ 更新から2週間以内（2週間を過ぎたらマークを消す）
            const isNew = isNewer(p.updated_at, sinceSeen) && withinNewWindow(p.updated_at, Date.now());
            const birthLabel = p.birth_month ? `${p.birth_month}月` : "";
            return (
              <div key={p.id} className="rounded-2xl p-3.5" style={{ background: "#fff", border: isNew ? "1.5px solid #EFC9DD" : "1px solid #efe9e1" }}>
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-base font-black text-white" style={{ background: "linear-gradient(135deg,#A8175F,#C81E77)" }}>
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
                        <span className="text-xs font-bold" style={{ color: "#C81E77" }}>{birthLabel}</span>
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
                  <>
                    <div className="mt-2.5 rounded-xl px-3 py-2" style={{ background: "#FCEFF5", border: "1px solid #ffd9e9" }}>
                      <p className="text-[10px] font-black tracking-widest uppercase mb-0.5" style={{ color: "#C81E77" }}>近況</p>
                      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap" style={{ color: "#2c2c2c" }}>
                        {p.status.trim()}
                      </p>
                    </div>
                    {/* 近況へのリアクション（匿名・YouTubeコメント風） */}
                    <ReactionThread
                      list={reactionsByPid.get(p.id) ?? []}
                      myId={me}
                      onAdd={(t) => addReactionTo(p.id, t)}
                      onRemove={(rid) => removeReactionById(rid)}
                    />
                  </>
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
          自己紹介と近況は全員に共有され、約5秒ごとに自動更新されます。どなたでも編集・削除できます（みんなで管理）。近況には匿名でリアクションを付けられます（あたたかいひとことで）。
        </p>
      )}
    </div>
  );
}
