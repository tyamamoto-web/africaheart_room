"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { timeSlots, defaultMembers, type Member, type MemberRole } from "@/lib/data";
import { getMembers, addMember, updateMember, deleteMember, resetToDefault } from "@/lib/memberStore";
import { getEventSetup, setAttendance, setMemberRoom } from "@/lib/eventStore";
import type { RoomKey } from "@/lib/eventStore";
import { getRoomNumbers, saveRoomNumbers, RoomNumbersSetupError } from "@/lib/roomNumbers";
import { getOfficerPlan, setOfficerPriority, clearOfficerPlan, seedOfficerPlan } from "@/lib/officerPlan";
import {
  getOfficerRaci, setOfficerRaci, clearOfficerRaci, raciKey,
  RACI_PEOPLE, type OfficerRaci, type RaciRole,
} from "@/lib/officerRaci";

const roomCfg = {
  A: { gradient: "linear-gradient(135deg,#8E1252,#A8175F)", color: "#A8175F", bg: "#F6E1EB" },
  B: { gradient: "linear-gradient(135deg,#A8175F,#C81E77)", color: "#C81E77", bg: "#F9E6EF" },
  C: { gradient: "linear-gradient(135deg,#C0246F,#D6478E)", color: "#C0246F", bg: "#FCEDF4" },
} as const;

const roleConfig: Record<MemberRole, { label: string; bg: string; text: string }> = {
  leader:    { label: "リーダー", bg: "#fff0f0", text: "#ff6b6b" },
  subleader: { label: "サブ",     bg: "#f5f0ff", text: "#845ef7" },
  regular:   { label: "メンバー", bg: "#f4f0ea", text: "#888" },
  guest:     { label: "ゲスト",   bg: "#fffbe6", text: "#f59e0b" },
};
const roleOrder: MemberRole[] = ["leader", "subleader", "regular", "guest"];

const rotationSlots = timeSlots.filter((s) => s.type === "rotation");

// ── 役員専用ページ：オフ会運営タスクの優先度づけ（MoSCoW法）──────────
// リストの全項目を表にして、役員が自分たちで各タスクの優先度を手動で設定する。
// 専門用語は使わず、平易な日本語ラベルで4段階に分ける。
// 参考：MoSCoW法（Must / Should / Could / Won't）
type Priority = "must" | "should" | "could" | "wont";

// 4段階の優先度。ラベル・説明はすべて平易な言葉づかいに統一。
const priorityDefs: { key: Priority; label: string; hint: string; accent: string; tint: string }[] = [
  { key: "must",   label: "必ずやる",       hint: "これが無いとオフ会が成り立たない", accent: "#1c1a17", tint: "rgba(28,26,23,0.05)"  },
  { key: "should", label: "なるべくやる",   hint: "あると良い。無くても開催はできる", accent: "#a9823f", tint: "rgba(169,130,63,0.09)" },
  { key: "could",  label: "できたらやる",   hint: "あればもっと良い。優先度は低め",   accent: "#9c917d", tint: "rgba(156,145,125,0.10)"},
  { key: "wont",   label: "今回はやらない", hint: "今回は見送り（次回以降に考える）", accent: "#b4a992", tint: "rgba(180,169,146,0.10)"},
];

// ── 担当（だれが・どう関わるか）──────────────────────────────
// 役割分担の考え方（RACI法）を、聞き馴染みのない語や記号を出さず「平易な言葉」に翻訳して表示する。
// 意味・ルールはそのまま：R=やる人 / A=責任者 / C=相談役 / I=お知らせ（Iの表示名は共有機能と紛らわしいため「お知らせ」。値は i）。
//   ・責任者(A) は1つのやることにつき1人（最後に決めて責任を持つ）。
//   ・やる人(R) は実際に手を動かす人（何人でもよい）。責任者が自分でやってもよい。
//   ・相談役(C) は決める前に意見を聞く相手、お知らせ(I) は決めた後に知らせるだけの相手。
// 「RACI」という言葉はフッターの注記で一度だけ触れ、表・凡例・プルダウンには出さない。
// 齟齬を避けるための工夫：
//  ・R↔A は「作業する／決める」、C↔I は「決める前に意見をもらう／決めた後に知らせるだけ」で対比。
//  ・各役割にカラオケ予約の具体例を添える。
//  ・I の名称は、共有機能の「みんなで共有」と紛らわしいため「お知らせ」に変更（値は i のまま）。
const raciDefs: { key: RaciRole; short: string; label: string; hint: string; example: string; accent: string; tint: string }[] = [
  {
    key: "r", short: "やる人", label: "やる人",
    hint: "決まったことを実際に進める人。連絡・予約・準備など、手を動かして作業します。何人いてもOK。最終判断は「責任者」にまかせます。",
    example: "お店に予約の電話をする／会場までの地図をつくる",
    accent: "#a9823f", tint: "rgba(169,130,63,0.10)",
  },
  {
    key: "a", short: "責任者", label: "責任者",
    hint: "最終的に決めて、結果に責任を持つ人。1つのやることにつき必ず1人だけ。自分で作業もするときも、これを選べばOK（「やる人」に重ねて選ばなくてよい）。",
    example: "どのお店にするかを最終的に決める・その担当をとりまとめる",
    accent: "#1c1a17", tint: "rgba(28,26,23,0.06)",
  },
  {
    key: "c", short: "相談役", label: "相談役",
    hint: "決める前に意見を聞いておく相手。相談は受けますが、決める人でも作業する人でもありません。反対や心配があればこの段階で伝えます。",
    example: "日程やお店の希望を、決める前に聞いておく",
    accent: "#8a7f6a", tint: "rgba(138,127,106,0.10)",
  },
  {
    key: "i", short: "お知らせ", label: "お知らせ",
    hint: "決めた後・終わった後に、結果を知らせておく相手。意見を求めるのではなく、知っておいてもらうだけ。",
    example: "予約が取れたことを、後から伝える",
    accent: "#b1a68f", tint: "rgba(177,166,143,0.12)",
  },
];

// リストのやることを 大分類 → 中分類 → 小分類（やること）に体系化。
// 元リスト（先方提供）の全項目を漏れなく収録。重複しやすいものは同じグループにまとめている。
// ※ サブリーダーMTGは第4土曜ではないと確認済みのため曜日表記を削除。定例会議に「役員会議」を上に追加。
//   「オフ会の日程を決める」の（第4土曜）は元リストの記述を暫定で残置（要確認）。
type OfficerTask = { id: string; label: string };
type OfficerTaxonomy = { no: string; major: string; groups: { mid: string; tasks: OfficerTask[] }[] }[];

const officerTaxonomy: OfficerTaxonomy = [
  {
    no: "01", major: "会の運営・体制",
    groups: [
      { mid: "定例会議", tasks: [
        { id: "t36", label: "役員MTG（リーダー・サブリーダー）" },
        { id: "t01", label: "役員MTG（サブリーダー）" },
      ] },
      { mid: "ルール・決め方", tasks: [
        { id: "t02", label: "ルールづくり" },
        { id: "t03", label: "物事の決め方（意思決定）" },
      ] },
      { mid: "アプリ・ツール",  tasks: [{ id: "t04", label: "アプリの運用" }] },
    ],
  },
  {
    no: "02", major: "オフ会の準備・当日",
    groups: [
      { mid: "日程・会場を決める", tasks: [
        { id: "t05", label: "オフ会の日程を決める（第4土曜）" },
        { id: "t06", label: "会場を松本駅前へ変更（JOYJOY・カラオケ館）" },
      ] },
      { mid: "予約・部屋の準備", tasks: [
        { id: "t07", label: "カラオケの予約" },
        { id: "t08", label: "部屋の準備（張り紙）" },
      ] },
      { mid: "案内・出欠（アプリ）", tasks: [
        { id: "t09", label: "イベントの作成（アプリ）" },
        { id: "t10", label: "締め切りの1週間前に案内" },
        { id: "t11", label: "出欠の管理" },
      ] },
      { mid: "当日の進行", tasks: [{ id: "t12", label: "タイムテーブル・部屋割り" }] },
    ],
  },
  {
    no: "03", major: "お金（会計）",
    groups: [
      { mid: "管理", tasks: [{ id: "t13", label: "お金の管理・出納帳" }] },
      { mid: "報告", tasks: [{ id: "t14", label: "会計報告" }] },
    ],
  },
  {
    no: "04", major: "企画・盛り上げ",
    groups: [
      { mid: "誕生日のお祝い", tasks: [
        { id: "t15", label: "誕生日プレゼントの手配" },
        { id: "t16", label: "ケーキ・イントロクイズ" },
      ] },
      { mid: "当日の楽しみ",       tasks: [{ id: "t17", label: "フリー部屋" }] },
      { mid: "季節・単発イベント", tasks: [{ id: "t18", label: "塩尻ハロウィン" }] },
      { mid: "ゲリラ企画", tasks: [
        { id: "t19", label: "ゲリライベント" },
        { id: "t20", label: "ゲリラ開催のオフ会" },
        { id: "t21", label: "中島みゆき ゲリラオフ会" },
      ] },
    ],
  },
  {
    no: "05", major: "交流・情報発信",
    groups: [
      { mid: "メンバー間の交流", tasks: [
        { id: "t22", label: "他メンバーの紹介・本人からの自己紹介" },
        { id: "t23", label: "メンバー同士の交流を活発にする" },
      ] },
      { mid: "グループLINE（グルチャ）", tasks: [
        { id: "t24", label: "グルチャを部屋分け（雑談・イベントなど）" },
        { id: "t25", label: "グルチャ投稿の役割分担" },
        { id: "t26", label: "LINEスタンプ" },
      ] },
    ],
  },
  {
    no: "06", major: "記録（写真・動画）",
    groups: [
      { mid: "撮影・管理", tasks: [
        { id: "t27", label: "イベントの写真・動画の撮影" },
        { id: "t28", label: "集合写真・動画の管理" },
      ] },
      { mid: "共有ルール", tasks: [{ id: "t29", label: "写真・動画の共有ルールの案内" }] },
    ],
  },
  {
    no: "07", major: "新規メンバー募集（ジモティ）",
    groups: [
      { mid: "出稿の準備", tasks: [
        { id: "t30", label: "ジモティのイベント作成" },
        { id: "t31", label: "ジモティの紹介文の作成" },
      ] },
      { mid: "対応・ルール", tasks: [
        { id: "t32", label: "ジモティ経由の新規希望者とのやりとり" },
        { id: "t33", label: "ジモティの年齢制限" },
      ] },
    ],
  },
  {
    no: "08", major: "安全・トラブル対応",
    groups: [
      { mid: "注意喚起",       tasks: [{ id: "t34", label: "お酒の飲みすぎ注意の案内" }] },
      { mid: "困りごと対応",   tasks: [{ id: "t35", label: "トラブル対応" }] },
    ],
  },
];

// フラットなやること一覧（件数集計に使用）
const officerTasks: OfficerTask[] = officerTaxonomy.flatMap((m) => m.groups.flatMap((g) => g.tasks));

// 表の行データ（大分類・中分類のセル結合＝rowSpan 用のフラグつき）
type OfficerRow = {
  task: OfficerTask;
  majorNo?: string; major?: string; majorSpan?: number;
  mid?: string; midSpan?: number;
};
const officerRows: OfficerRow[] = officerTaxonomy.flatMap((m) => {
  const majorSpan = m.groups.reduce((s, g) => s + g.tasks.length, 0);
  let firstOfMajor = true;
  return m.groups.flatMap((g) =>
    g.tasks.map((task, ti) => {
      const row: OfficerRow = {
        task,
        majorNo:   firstOfMajor ? m.no : undefined,
        major:     firstOfMajor ? m.major : undefined,
        majorSpan: firstOfMajor ? majorSpan : undefined,
        mid:     ti === 0 ? g.mid : undefined,
        midSpan: ti === 0 ? g.tasks.length : undefined,
      };
      firstOfMajor = false;
      return row;
    })
  );
});

// 役員が設定した優先度の保存キー（この端末に保存）。体系化に伴い版数を v2 に更新。
const OFFICER_MOSCOW_KEY = "africaheart-officer-moscow-v2";

type FormState = { nickname: string; role: MemberRole };

export default function AdminPage() {
  const [members,      setMembers]      = useState<Member[]>([]);
  const [attendance,   setAttState]     = useState<Set<string>>(new Set());
  const [rotations,    setRotations]    = useState<Record<string, Record<string, RoomKey>>>({});
  const [activeSlot,   setActiveSlot]   = useState<string>(rotationSlots[0]?.id ?? "");
  const [modal,        setModal]        = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null });
  const [form,         setForm]         = useState<FormState>({ nickname: "", role: "regular" });
  const [confirmReset, setConfirmReset] = useState(false);
  // 当日の実部屋番号（A/B/C→番号）。Supabaseで全員共有。
  const [roomNos,      setRoomNos]      = useState<{ A: string; B: string; C: string }>({ A: "", B: "", C: "" });
  const [roomSaving,   setRoomSaving]   = useState(false);
  const [roomMsg,      setRoomMsg]      = useState<{ kind: "ok" | "err" | "setup"; text: string } | null>(null);
  // 管理画面のタブ（左=部屋割り・メンバー / 右=役員専用）。ロックなし＝URLを知っていれば切替可。既定は左。
  const [tab, setTab] = useState<"officer" | "admin">("admin");
  // 役員専用：各タスクに手動でつけた優先度（この端末に保存）
  const [priorities, setPriorities] = useState<Record<string, Priority>>({});
  // 役員専用：各やることの担当・役割（RACI）。全員でSupabase共有。キーは `taskId|personId`。
  const [raci, setRaci] = useState<OfficerRaci>({});
  const [confirmMoscowReset, setConfirmMoscowReset] = useState(false);
  // 役員専用：保存失敗などの一時メッセージ（成功や次回同期で自動的に消える）
  const [officerMsg, setOfficerMsg] = useState<string | null>(null);
  // 共有書き込み中／直近の編集を検知し、ポーリングが「自分の入力」を巻き戻さないためのガード
  const pendingWrites = useRef(0);
  const editSeq = useRef(0);

  useEffect(() => {
    const m = getMembers();
    setMembers(m);
    const setup = getEventSetup();
    setAttState(new Set(setup.attendanceIds));
    setRotations(setup.rotations);
    getRoomNumbers()
      .then((r) => setRoomNos({ A: r.A, B: r.B, C: r.C }))
      .catch(() => {});
    // 役員RACI（担当・役割）も全員で共有（Supabase）。初期表示ぶんを取り込む。
    getOfficerRaci()
      .then(setRaci)
      .catch(() => {});
    // 役員プランは全員で共有（Supabase）。初回だけ、この端末に残っていた旧入力を共有へ移行する。
    (async () => {
      let local: Record<string, Priority> = {};
      try {
        const raw = localStorage.getItem(OFFICER_MOSCOW_KEY);
        if (raw) local = JSON.parse(raw);
      } catch { /* 読めなくても続行 */ }
      const migratedKey = OFFICER_MOSCOW_KEY + "-migrated";
      let migrated = false;
      try { migrated = !!localStorage.getItem(migratedKey); } catch { /* no-op */ }
      try {
        let plan;
        if (Object.keys(local).length && !migrated) {
          plan = await seedOfficerPlan(local);              // 端末の入力を共有へ吸い上げ（既存は尊重）
          try { localStorage.setItem(migratedKey, "1"); } catch { /* no-op */ }
        } else {
          plan = await getOfficerPlan();                    // 以降は共有が正
        }
        setPriorities(plan);
      } catch { /* 取得失敗時は空のまま（表示優先） */ }
    })();
  }, []);

  // 役員専用タブを開いている間は、他メンバーの入力を約6秒ごとに取り込む（共有・同期）。
  useEffect(() => {
    if (tab !== "officer") return;
    let alive = true;
    const iv = setInterval(async () => {
      if (pendingWrites.current > 0) return; // 書き込み中はスキップ（自分の入力の巻き戻り防止）
      const seqAtStart = editSeq.current;
      try {
        const [plan, r] = await Promise.all([getOfficerPlan(), getOfficerRaci()]);
        // 取得中に自分が編集/保存していたら適用しない（巻き戻り防止・次回のポーリングで整合）
        if (alive && pendingWrites.current === 0 && editSeq.current === seqAtStart) {
          setPriorities(plan); setRaci(r); setOfficerMsg(null);
        }
      } catch { /* 一時的な失敗は無視して次回に */ }
    }, 6000);
    return () => { alive = false; clearInterval(iv); };
  }, [tab]);

  // タスクの優先度を設定（同じものを再度押すと解除）。全員に共有（Supabase）。
  function setTaskPriority(taskId: string, p: Priority) {
    const cleared = priorities[taskId] === p;
    editSeq.current++;
    // まず画面を即更新（体感を良く）。
    setPriorities((prev) => {
      const next = { ...prev };
      if (cleared) delete next[taskId];
      else next[taskId] = p;
      return next;
    });
    // 共有へ保存（サーバ側で最新にマージ）→ 返ってきた全マップで確定させる。
    pendingWrites.current++;
    setOfficerPriority(taskId, cleared ? null : p)
      .then((plan) => { setPriorities(plan); setOfficerMsg(null); })
      .catch(() => { setOfficerMsg("保存に失敗しました。通信状況をご確認ください（数秒後に自動でやり直します）"); })
      .finally(() => { pendingWrites.current--; });
  }
  // やること×人 の役割（RACI）を設定（空欄を選ぶと解除）。全員に共有（Supabase）。
  function setTaskAssignee(taskId: string, personId: string, role: RaciRole | null) {
    const key = raciKey(taskId, personId);
    editSeq.current++;
    // まず画面を即更新（体感を良く）。
    setRaci((prev) => {
      const next = { ...prev };
      if (role === null) delete next[key];
      else next[key] = role;
      return next;
    });
    // 共有へ保存（サーバ側で最新にマージ）→ 返ってきた全マップで確定させる。
    pendingWrites.current++;
    setOfficerRaci(taskId, personId, role)
      .then((map) => { setRaci(map); setOfficerMsg(null); })
      .catch(() => { setOfficerMsg("保存に失敗しました。通信状況をご確認ください（数秒後に自動でやり直します）"); })
      .finally(() => { pendingWrites.current--; });
  }
  function resetPriorities() {
    setPriorities({});
    setRaci({});
    clearOfficerPlan().catch(() => { /* 失敗時は次回のポーリングで整合 */ });
    clearOfficerRaci().catch(() => { /* 失敗時は次回のポーリングで整合 */ });
    try { localStorage.removeItem(OFFICER_MOSCOW_KEY); } catch { /* no-op */ }
    setConfirmMoscowReset(false);
  }

  async function handleSaveRoomNumbers() {
    setRoomSaving(true);
    setRoomMsg(null);
    try {
      await saveRoomNumbers(roomNos, "管理");
      setRoomMsg({ kind: "ok", text: "保存しました（TOPの部屋割り表に反映・全員に共有）" });
    } catch (e) {
      if (e instanceof RoomNumbersSetupError) {
        setRoomMsg({ kind: "setup", text: "room_numbers テーブルが未作成です。Supabaseのセットアップが必要です。" });
      } else {
        setRoomMsg({ kind: "err", text: "保存に失敗しました。通信状況をご確認ください。" });
      }
    } finally {
      setRoomSaving(false);
    }
  }

  function refreshMembers() { setMembers(getMembers()); }

  function openAdd() {
    setForm({ nickname: "", role: "regular" });
    setModal({ open: true, editId: null });
  }
  function openEdit(m: Member) {
    setForm({ nickname: m.nickname, role: m.role });
    setModal({ open: true, editId: m.id });
  }
  function closeModal() { setModal({ open: false, editId: null }); }

  function handleSubmit() {
    const nickname = form.nickname.trim();
    if (!nickname) return;
    if (modal.editId) updateMember(modal.editId, { nickname, role: form.role });
    else addMember({ nickname, role: form.role });
    refreshMembers();
    closeModal();
  }
  function handleDelete(id: string) {
    if (!confirm("削除しますか？")) return;
    deleteMember(id);
    refreshMembers();
  }
  function handleReset() {
    resetToDefault();
    refreshMembers();
    setConfirmReset(false);
  }

  function toggleAttendance(id: string) {
    const next = new Set(attendance);
    if (next.has(id)) next.delete(id); else next.add(id);
    setAttState(next);
    setAttendance(Array.from(next));
  }
  function setAll(val: boolean) {
    const ids = val ? members.map((m) => m.id) : [];
    setAttState(new Set(ids));
    setAttendance(ids);
  }

  function handleRoomChange(slotId: string, memberId: string, val: string) {
    const room = val ? (val as RoomKey) : null;
    setMemberRoom(slotId, memberId, room);
    setRotations((prev) => {
      const slot = { ...(prev[slotId] ?? {}) };
      if (!room) delete slot[memberId];
      else slot[memberId] = room;
      return { ...prev, [slotId]: slot };
    });
  }

  const sorted        = [...members].sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));
  const attendingCount = members.filter((m) => attendance.has(m.id)).length;
  const attendingList  = sorted.filter((m) => attendance.has(m.id));
  const activeAssign   = rotations[activeSlot] ?? {};
  const assignedCount  = attendingList.filter((m) => activeAssign[m.id]).length;
  const moscowSetCount = officerTasks.filter((t) => priorities[t.id]).length;
  // 担当（RACI）を1人でも決めた「やること」の数
  const raciTaskCount  = officerTasks.filter((t) => RACI_PEOPLE.some((p) => raci[raciKey(t.id, p.id)])).length;

  return (
    <main className="min-h-screen pb-16" style={{ background: "#ffffff" }}>
      {/* Top bar */}
      <div className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3" style={{ background: "#ffffff", borderBottom: "1px solid #eee" }}>
        <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl card" style={{ color: "#555" }}>
          ← 戻る
        </Link>
        <h1 className="text-base font-black" style={{ color: "#2c2c2c" }}>管理画面</h1>
        {tab === "admin" && (
          <button
            onClick={openAdd}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg,#A8175F,#C81E77)", boxShadow: "0 3px 10px rgba(168,23,95,0.3)" }}
          >
            ＋ 追加
          </button>
        )}
      </div>

      {/* ── タブ切替（役員専用 / 部屋割り・メンバー）── */}
      <div className="px-4 pt-3 max-w-lg mx-auto">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "#f4f0ea" }}>
          {([
            { key: "admin", label: "部屋割り・メンバー" },
            { key: "officer", label: "役員専用" },
          ] as const).map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors"
                style={
                  active
                    ? { background: "linear-gradient(135deg,#A8175F,#C81E77)", color: "#fff", boxShadow: "0 2px 8px rgba(168,23,95,0.25)" }
                    : { background: "transparent", color: "#888" }
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 役員専用タブ（ロックなし）── */}
      {/* このタブのみ高級感のある白基調・ミニマムなUI。全スタイルをインラインで自己完結させ、
          他画面のピンク系テーマを継承しない。優先度は役員が表で手動設定する。 */}
      {tab === "officer" && (
        <div className="px-4 pt-5 pb-8 max-w-5xl mx-auto">
          <div
            style={{
              background: "linear-gradient(180deg,#ffffff,#fdfcfa)",
              border: "1px solid #eee7db",
              borderRadius: 22,
              padding: "30px 26px 26px",
              boxShadow: "0 18px 50px -30px rgba(70,58,34,0.35)",
            }}
          >
            {/* ヘッダー（読みやすさのため横幅を抑える）*/}
            <div style={{ maxWidth: 660 }}>
              <p style={{ fontSize: 10.5, letterSpacing: "0.30em", color: "#bcb09c", fontWeight: 600, textTransform: "uppercase" }}>
                Officers Only
              </p>
              <h2 style={{ marginTop: 12, fontSize: 23, fontWeight: 600, color: "#1c1a16", letterSpacing: "0.01em", lineHeight: 1.3 }}>
                オフ会運営タスク
              </h2>
              <p style={{ marginTop: 7, fontSize: 12.5, color: "#a2988a", letterSpacing: "0.05em" }}>
                やることリスト　｜　分類して、みんなで優先度を決める
              </p>

              <div style={{ height: 1, background: "#efe8dc", margin: "20px 0 16px" }} />

              {/* 優先度の説明（凡例）*/}
              <div>
                {priorityDefs.map((d) => (
                  <div key={d.key} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "6px 0" }}>
                    <span style={{ flexShrink: 0, width: 11, height: 11, borderRadius: "50%", background: d.accent, transform: "translateY(1px)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#33302a" }}>{d.label}</span>
                      <span style={{ fontSize: 11.5, color: "#9c927f", marginLeft: 8 }}>{d.hint}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 進み具合（優先度）*/}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 16, marginBottom: 10 }}>
                <span style={{ fontSize: 11.5, color: "#a2988a" }}>各行で1つ選ぶ・みんなで共有</span>
                <span style={{ fontSize: 12, color: "#8b8274" }}>
                  設定済み <b style={{ fontFamily: "Georgia,serif", fontWeight: 400, color: "#5f5747" }}>{moscowSetCount}</b>
                  <span style={{ color: "#bcb09c" }}> / {officerTasks.length}</span>
                </span>
              </div>

              {/* ── 担当・役割（RACIチャート）の説明 ── */}
              <div style={{ height: 1, background: "#efe8dc", margin: "20px 0 14px" }} />
              <p style={{ fontSize: 12.5, fontWeight: 700, color: "#33302a", letterSpacing: "0.04em" }}>担当（だれが・どう関わるか）</p>
              <p style={{ marginTop: 6, fontSize: 11.5, color: "#a2988a", lineHeight: 1.7 }}>
                表の右側で、やることごとに「だれが担当し、どう関わるか」を、次の4つの関わり方から決めます。名前ごとにプルダウンで選ぶだけ・みんなで共有されます。
              </p>
              <div style={{ marginTop: 10 }}>
                {raciDefs.map((d) => (
                  <div key={d.key} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0" }}>
                    <span style={{ flexShrink: 0, width: 11, height: 11, borderRadius: "50%", background: d.accent, transform: "translateY(4px)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#33302a" }}>{d.label}</span>
                      <div style={{ marginTop: 3, fontSize: 11.5, color: "#9c927f", lineHeight: 1.65 }}>{d.hint}</div>
                      <div style={{ marginTop: 3, fontSize: 11, color: "#b3a794", lineHeight: 1.6 }}>
                        <span style={{ color: "#c0a469", fontWeight: 700 }}>例</span>　{d.example}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 10, fontSize: 11.5, color: "#8b8274", lineHeight: 1.7 }}>
                担当できる人：
                {RACI_PEOPLE.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && "・"}
                    <b style={{ color: "#5c5646" }}>{p.name}</b>
                    <span style={{ color: "#b3a794" }}>（{p.role === "leader" ? "リーダー" : "サブ"}）</span>
                  </span>
                ))}
              </p>

              {/* 進み具合（担当）*/}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 12, marginBottom: 2 }}>
                <span style={{ fontSize: 11.5, color: "#a2988a" }}>「責任者」は1つにつき1人・「やる人」は何人でも・みんなで共有</span>
                <span style={{ fontSize: 12, color: "#8b8274" }}>
                  担当を決めた数 <b style={{ fontFamily: "Georgia,serif", fontWeight: 400, color: "#5f5747" }}>{raciTaskCount}</b>
                  <span style={{ color: "#bcb09c" }}> / {officerTasks.length}</span>
                </span>
              </div>

              {/* ── 役員の役割・権限・責任（リーダー・サブリーダー）──
                  解釈が分かれないよう、対象・相手・タイミングを具体語で言い切る（「大事なこと」「早めに」等の曖昧語は使わない）。
                  上の表の定義（責任者＝最終的に決めて結果に責任を持つ人・1つにつき1人）と矛盾させない：
                  決めるのは表の責任者。リーダーは責任者が未定のとき・意見が分かれたままのときに決める。 */}
              <div style={{ height: 1, background: "#efe8dc", margin: "22px 0 14px" }} />
              <p style={{ fontSize: 12.5, fontWeight: 700, color: "#33302a", letterSpacing: "0.04em" }}>
                役員の役割・権限・責任（リーダー・サブリーダー）
              </p>
              <p style={{ marginTop: 6, fontSize: 11.5, color: "#a2988a", lineHeight: 1.7 }}>
                お金・ルール・日程・会場・役員の担当・新しいメンバーの受け入れ（以下「この6つ」）は、役員3人が役員MTGで、上の表に責任者（1人）・相談役・お知らせを記入してから動きます。決めるのは表の責任者、決める前に相談役へ相談、決めた内容と理由は責任者がメンバーへ伝えます。
              </p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
                {/* リーダー */}
                <div style={{ flex: "1 1 260px", minWidth: 240, border: "1px solid #eadfce", borderRadius: 12, background: "#fffdf9", padding: "13px 15px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#1c1a16" }}>リーダー</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#a9823f", background: "rgba(169,130,63,0.10)", border: "1px solid #e7d8bf", borderRadius: 999, padding: "2px 8px" }}>
                      {RACI_PEOPLE.filter((p) => p.role === "leader").map((p) => p.name).join("・")}
                    </span>
                  </div>
                  <ul style={{ margin: "9px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 7 }}>
                    <li style={{ fontSize: 11.5, color: "#6f6757", lineHeight: 1.7 }}>
                      <b style={{ color: "#5c5646" }}>役割</b>：役員MTGを開いて進行し、表で自分が責任者になった項目を決めます。
                    </li>
                    <li style={{ fontSize: 11.5, color: "#6f6757", lineHeight: 1.7 }}>
                      <b style={{ color: "#5c5646" }}>権限</b>：表に責任者が入っていない項目と、役員MTGで意見が分かれたままの項目は、その場でリーダーが決めます。サブリーダーが責任者の項目は、そのサブリーダーが決めます。
                    </li>
                    <li style={{ fontSize: 11.5, color: "#6f6757", lineHeight: 1.7 }}>
                      <b style={{ color: "#5c5646" }}>責任</b>：自分が決めたことは、次のオフ会の案内を出すまでに、内容と理由をメンバー全員へ伝えます。その決定への質問にもリーダーが答えます。
                    </li>
                    <li style={{ fontSize: 11.5, color: "#6f6757", lineHeight: 1.7 }}>
                      <b style={{ color: "#b08948" }}>進め方</b>：決める前にサブリーダー2人へ案を伝える／反対意見は理由まで聞いてから決める／サブリーダーが責任者の項目は任せて、結果の報告を役員MTGで受ける。
                    </li>
                  </ul>
                </div>

                {/* サブリーダー */}
                <div style={{ flex: "1 1 260px", minWidth: 240, border: "1px solid #eadfce", borderRadius: 12, background: "#fffdf9", padding: "13px 15px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#1c1a16" }}>サブリーダー</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#8a7f6a", background: "rgba(138,127,106,0.12)", border: "1px solid #e2d8c7", borderRadius: 999, padding: "2px 8px" }}>
                      {RACI_PEOPLE.filter((p) => p.role === "subleader").map((p) => p.name).join("・")}
                    </span>
                  </div>
                  <ul style={{ margin: "9px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 7 }}>
                    <li style={{ fontSize: 11.5, color: "#6f6757", lineHeight: 1.7 }}>
                      <b style={{ color: "#5c5646" }}>役割</b>：リーダーが決める前の相談を受け、表で自分が責任者・やる人になった項目を進めます。
                    </li>
                    <li style={{ fontSize: 11.5, color: "#6f6757", lineHeight: 1.7 }}>
                      <b style={{ color: "#5c5646" }}>権限</b>：この6つは、決まる前に意見を言えます。表で責任者（1人）になった項目は、自分が決めます。
                    </li>
                    <li style={{ fontSize: 11.5, color: "#6f6757", lineHeight: 1.7 }}>
                      <b style={{ color: "#5c5646" }}>責任</b>：反対意見や心配は、決まる前にリーダーへ伝えます。メンバーから聞いた要望は、内容を削らず伝えます。自分が責任者の項目は、進み具合と結果を役員MTGで報告します。
                    </li>
                    <li style={{ fontSize: 11.5, color: "#6f6757", lineHeight: 1.7 }}>
                      <b style={{ color: "#b08948" }}>進め方</b>：反対意見や別の案は、決まる前の役員MTGで伝える／次の役員MTGまで待てないときはリーダーへ個別に伝える／決まった後に気づいた改善案は、次の役員MTGで提案する。
                    </li>
                  </ul>
                </div>
              </div>

              <p style={{ marginTop: 11, fontSize: 11, color: "#a2988a", lineHeight: 1.7 }}>
                ※ 役職の上下はありません。この分担を変えたいときは役員MTGで話し、決まったらリーダーがこのページを直します。
              </p>
            </div>

            {officerMsg && (
              <div style={{ margin: "4px 0 12px", padding: "8px 12px", borderRadius: 10, background: "rgba(176,137,72,0.10)", border: "1px solid #e7d8bf", fontSize: 11.5, color: "#8a6b32", lineHeight: 1.6 }}>
                {officerMsg}
              </div>
            )}
            {/* 大きな横長の表：スマホは横スクロール／PCは大きく表示 */}
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", minWidth: 1180, borderCollapse: "collapse" }}>
                <colgroup>
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "24%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "9%" }} />
                </colgroup>
                <thead>
                  {/* 1段目：セクションの見出し（優先度／担当）*/}
                  <tr style={{ background: "#faf6ef" }}>
                    <th rowSpan={2} style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #e7dfd1", borderRight: "1px solid #eadfce", fontSize: 12, fontWeight: 700, color: "#8b8274", verticalAlign: "middle" }}>大分類</th>
                    <th rowSpan={2} style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #e7dfd1", borderRight: "1px solid #f0ebe1", fontSize: 12, fontWeight: 700, color: "#8b8274", verticalAlign: "middle" }}>中分類</th>
                    <th rowSpan={2} style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #e7dfd1", fontSize: 12, fontWeight: 700, color: "#8b8274", verticalAlign: "middle" }}>やること（小分類）</th>
                    <th colSpan={4} style={{ textAlign: "center", padding: "8px 6px", borderBottom: "1px solid #eadfce", borderLeft: "2px solid #eee3d2", fontSize: 11, fontWeight: 700, color: "#8b8274", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>優先度（どれか1つ）</th>
                    <th colSpan={3} style={{ textAlign: "center", padding: "8px 6px", borderBottom: "1px solid #eadfce", borderLeft: "2px solid #e3d7c2", fontSize: 11, fontWeight: 700, color: "#8b8274", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>担当（だれが・どう関わる）</th>
                  </tr>
                  {/* 2段目：各列の見出し */}
                  <tr style={{ background: "#fbf8f3" }}>
                    {priorityDefs.map((d, di) => (
                      <th key={d.key} style={{ textAlign: "center", padding: "10px 4px", borderBottom: "2px solid #e7dfd1", borderLeft: di === 0 ? "2px solid #eee3d2" : undefined, fontSize: 11, fontWeight: 700, color: d.accent, whiteSpace: "nowrap" }}>
                        {d.label}
                      </th>
                    ))}
                    {RACI_PEOPLE.map((p, pi) => (
                      <th key={p.id} style={{ textAlign: "center", padding: "10px 6px", borderBottom: "2px solid #e7dfd1", borderLeft: pi === 0 ? "2px solid #e3d7c2" : "1px solid #f0ebe1", fontSize: 11.5, fontWeight: 700, color: "#5c5646", whiteSpace: "nowrap" }}>
                        {p.name}
                        <div style={{ marginTop: 2, fontSize: 9.5, fontWeight: 600, color: "#b3a794", letterSpacing: "0.04em" }}>{p.role === "leader" ? "リーダー" : "サブ"}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {officerRows.map((row, i) => {
                    const task = row.task;
                    const cur = priorities[task.id];
                    const curDef = priorityDefs.find((d) => d.key === cur);
                    const majorEnd = i === officerRows.length - 1 || Boolean(officerRows[i + 1].major);
                    const rowBorder = majorEnd ? "1px solid #e7dfd1" : "1px solid #f4efe6";
                    // 「A 責任者」が複数ついている行は注意表示（1人が目安）
                    const aCount = RACI_PEOPLE.filter((p) => raci[raciKey(task.id, p.id)] === "a").length;
                    return (
                      <tr key={task.id} style={{ background: curDef ? curDef.tint : "transparent" }}>
                        {row.major && (
                          <td rowSpan={row.majorSpan} style={{ background: "#faf6ef", borderRight: "1px solid #eadfce", borderBottom: "1px solid #e7dfd1", verticalAlign: "middle", padding: "14px 12px" }}>
                            <div style={{ fontFamily: "Georgia,serif", fontSize: 12, color: "#c3b48f", letterSpacing: "0.06em", marginBottom: 5 }}>{row.majorNo}</div>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#2e2a22", lineHeight: 1.45 }}>{row.major}</div>
                          </td>
                        )}
                        {row.mid && (
                          <td rowSpan={row.midSpan} style={{ background: "#fdfbf6", borderRight: "1px solid #f0ebe1", borderBottom: "1px solid #efe6d6", verticalAlign: "middle", padding: "12px 12px" }}>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#5c5646", lineHeight: 1.5 }}>{row.mid}</span>
                          </td>
                        )}
                        <td style={{ padding: "12px 12px", borderBottom: rowBorder, verticalAlign: "middle" }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#241f18", lineHeight: 1.5 }}>{task.label}</span>
                          {aCount >= 2 && (
                            <div style={{ marginTop: 4, fontSize: 10.5, color: "#b08948", lineHeight: 1.5 }}>※「責任者」が複数います。1人にしぼるのがおすすめ</div>
                          )}
                        </td>
                        {priorityDefs.map((d, di) => {
                          const on = cur === d.key;
                          return (
                            <td key={d.key} style={{ textAlign: "center", padding: "9px 4px", borderBottom: rowBorder, borderLeft: di === 0 ? "2px solid #eee3d2" : undefined, verticalAlign: "middle" }}>
                              <button
                                type="button"
                                onClick={() => setTaskPriority(task.id, d.key)}
                                aria-label={`「${task.label}」を「${d.label}」にする`}
                                aria-pressed={on}
                                style={{
                                  width: 26, height: 26, borderRadius: "50%", padding: 0, cursor: "pointer",
                                  border: on ? `1.5px solid ${d.accent}` : "1.5px solid #dad2c4",
                                  background: on ? d.accent : "transparent",
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  transition: "background .12s, border-color .12s",
                                }}
                              >
                                {on && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                              </button>
                            </td>
                          );
                        })}
                        {/* 担当・役割（RACI）：名前ごとにプルダウンで選ぶ・全員で共有 */}
                        {RACI_PEOPLE.map((p, pi) => {
                          const role = raci[raciKey(task.id, p.id)];
                          const def = raciDefs.find((d) => d.key === role);
                          return (
                            <td key={p.id} style={{ textAlign: "center", padding: "8px 6px", borderBottom: rowBorder, borderLeft: pi === 0 ? "2px solid #e3d7c2" : "1px solid #f4efe6", verticalAlign: "middle" }}>
                              <select
                                value={role ?? ""}
                                onChange={(e) => setTaskAssignee(task.id, p.id, e.target.value ? (e.target.value as RaciRole) : null)}
                                aria-label={`「${task.label}」の${p.name}さんの役割`}
                                style={{
                                  width: "100%", maxWidth: 98, fontSize: 11.5, padding: "5px 4px", borderRadius: 8, cursor: "pointer",
                                  border: def ? `1.5px solid ${def.accent}` : "1px solid #dad2c4",
                                  background: def ? def.tint : "#fff",
                                  color: def ? def.accent : "#8b8274",
                                  fontWeight: def ? 700 : 500,
                                }}
                              >
                                <option value="">—</option>
                                {raciDefs.map((d) => (
                                  <option key={d.key} value={d.key}>{d.short}</option>
                                ))}
                              </select>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 集計 */}
            <div style={{ maxWidth: 660, display: "flex", flexWrap: "wrap", gap: "7px 16px", marginTop: 18, paddingTop: 14, borderTop: "1px solid #efe8dc" }}>
              {priorityDefs.map((d) => {
                const n = officerTasks.filter((t) => priorities[t.id] === d.key).length;
                return (
                  <span key={d.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#7d7568" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.accent }} />
                    {d.label}
                    <b style={{ fontFamily: "Georgia,serif", fontWeight: 400, color: d.accent }}>{n}</b>
                  </span>
                );
              })}
              <span style={{ fontSize: 11.5, color: "#b3a794" }}>未設定 {officerTasks.length - moscowSetCount}</span>
            </div>

            {/* 集計（担当・RACI：だれが何件の「担当(R)」か）*/}
            <div style={{ maxWidth: 660, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "7px 16px", marginTop: 10 }}>
              <span style={{ fontSize: 11.5, color: "#a2988a" }}>「やる人」の数：</span>
              {RACI_PEOPLE.map((p) => {
                const n = officerTasks.filter((t) => raci[raciKey(t.id, p.id)] === "r").length;
                return (
                  <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#7d7568" }}>
                    {p.name}
                    <b style={{ fontFamily: "Georgia,serif", fontWeight: 400, color: "#a9823f" }}>{n}</b>
                  </span>
                );
              })}
            </div>

            {/* リセット */}
            <div style={{ marginTop: 20 }}>
              {!confirmMoscowReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmMoscowReset(true)}
                  style={{ fontSize: 11.5, color: "#b0a794", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, padding: 0 }}
                >
                  入力をすべてリセット（優先度・担当）
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <span style={{ fontSize: 12, color: "#8b8274" }}>全員ぶんの優先度と担当をすべて消しますか？（元に戻せません）</span>
                  <button type="button" onClick={() => setConfirmMoscowReset(false)} style={{ fontSize: 12, padding: "6px 13px", borderRadius: 9, border: "1px solid #e3dccf", background: "#fff", color: "#8b8274", cursor: "pointer" }}>
                    やめる
                  </button>
                  <button type="button" onClick={resetPriorities} style={{ fontSize: 12, padding: "6px 13px", borderRadius: 9, border: "none", background: "#1c1a17", color: "#fff", cursor: "pointer" }}>
                    リセット
                  </button>
                </div>
              )}
            </div>

            {/* フッター注記 */}
            <p style={{ maxWidth: 660, marginTop: 18, fontSize: 11, lineHeight: 1.9, color: "#b3a794" }}>
              ※ 左側は「必ず／なるべく／できたら／今回はやらない」の4段階で優先度をつける進め方（MoSCoW法を参考）、右側は「やる人／責任者／相談役／お知らせ」の4つで担当を分ける表（RACIという役割分担の考え方を参考）です。分類は内容から推し量った暫定です。役員MTGで話しながら見直していきましょう。
            </p>
          </div>
        </div>
      )}

      {tab === "admin" && (
      <div className="px-4 pt-3 max-w-lg mx-auto flex flex-col gap-4">

        {/* ── 部屋番号（当日の実部屋番号を全員に共有）── */}
        <div className="card overflow-hidden">
          <div className="px-4 py-4 border-b" style={{ borderColor: "#f4f0ea" }}>
            <p className="text-base font-black" style={{ color: "#2c2c2c" }}>部屋番号（当日）</p>
            <p className="text-sm mt-0.5 leading-relaxed" style={{ color: "#aaa" }}>
              A / B / C の実際の部屋番号を入力して保存すると、TOPの部屋割り表に表示され、全員がこのアプリから確認できます。
            </p>
          </div>
          <div className="px-4 py-4 flex flex-col gap-3">
            {(["A", "B", "C"] as const).map((r) => (
              <div key={r} className="flex items-center gap-3">
                <span
                  className="flex-shrink-0 inline-flex items-center justify-center rounded-lg text-white text-sm font-black"
                  style={{ width: 40, height: 40, background: roomCfg[r].gradient }}
                >
                  {r}
                </span>
                <input
                  value={roomNos[r]}
                  onChange={(e) => setRoomNos((p) => ({ ...p, [r]: e.target.value }))}
                  placeholder="例：305号室 / 大部屋 など"
                  maxLength={20}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-sm"
                  style={{ border: "1px solid #e5e7eb", background: "#fff", color: "#2c2c2c" }}
                />
              </div>
            ))}
            <button
              onClick={handleSaveRoomNumbers}
              disabled={roomSaving}
              className="mt-1 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg,#A8175F,#C81E77)", opacity: roomSaving ? 0.6 : 1 }}
            >
              {roomSaving ? "保存中…" : "保存して全員に共有"}
            </button>
            {roomMsg && (
              <p
                className="text-xs font-bold leading-relaxed"
                style={{ color: roomMsg.kind === "ok" ? "#10b981" : roomMsg.kind === "setup" ? "#A8175F" : "#ff6b6b" }}
              >
                {roomMsg.text}
              </p>
            )}
          </div>
        </div>

        {/* ── 出欠確認 ── */}
        <div className="card overflow-hidden">
          <div className="px-4 py-4 flex items-center justify-between border-b" style={{ borderColor: "#f4f0ea" }}>
            <div>
              <p className="text-base font-black" style={{ color: "#2c2c2c" }}>出欠確認</p>
              <p className="text-sm mt-0.5" style={{ color: "#aaa" }}>参加：{attendingCount}名 / 全{members.length}名</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAll(true)}  className="text-sm px-3 py-2.5 rounded-xl font-bold" style={{ background: "#f3f4f6", color: "#6b7280" }}>全員参加</button>
              <button onClick={() => setAll(false)} className="text-sm px-3 py-2.5 rounded-xl font-bold" style={{ background: "#fff0f0", color: "#ff6b6b" }}>全員不参加</button>
            </div>
          </div>
          <div className="px-3 py-3 grid grid-cols-2 gap-2">
            {sorted.map((m) => {
              const isAtt = attendance.has(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggleAttendance(m.id)}
                  className="flex items-center gap-2.5 px-3 py-3.5 rounded-2xl text-left transition-all duration-150"
                  style={{
                    background: isAtt ? "#ffffff" : "#f4f4f4",
                    border: `2px solid ${isAtt ? "#6b7280" : "transparent"}`,
                  }}
                >
                  <span
                    className="flex-shrink-0 inline-block rounded-md"
                    style={{
                      width: 18,
                      height: 18,
                      background: isAtt ? "#6b7280" : "transparent",
                      border: `2px solid ${isAtt ? "#6b7280" : "#cfcfcf"}`,
                    }}
                  />
                  <span className="text-sm font-semibold truncate" style={{ color: isAtt ? "#374151" : "#888" }}>
                    {m.nickname}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 部屋割り設定 ── */}
        <div className="card overflow-hidden">
          <div className="px-4 py-4 border-b" style={{ borderColor: "#f4f0ea" }}>
            <p className="text-base font-black" style={{ color: "#2c2c2c" }}>部屋割り設定</p>
            <p className="text-sm mt-0.5" style={{ color: "#aaa" }}>ローテーションごとに部屋を選んでください</p>
          </div>

          {/* Slot selector tabs */}
          {rotationSlots.length > 0 && (
            <div className="px-3 pt-3 pb-2 flex gap-2 overflow-x-auto">
              {rotationSlots.map((slot) => {
                const isSel = activeSlot === slot.id;
                return (
                  <button
                    key={slot.id}
                    onClick={() => setActiveSlot(slot.id)}
                    className="flex-shrink-0 px-4 py-2.5 rounded-2xl text-sm font-black transition-all"
                    style={{
                      background: isSel ? "linear-gradient(135deg,#A8175F,#C81E77)" : "#f0ece5",
                      color: isSel ? "white" : "#aaa",
                      boxShadow: isSel ? "0 3px 10px rgba(168,23,95,0.3)" : "none",
                    }}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Active slot info bar */}
          {rotationSlots.length > 0 && (
            <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: "#fafaf8" }}>
              <p className="text-sm font-semibold" style={{ color: "#888" }}>
                {rotationSlots.find((s) => s.id === activeSlot)?.startTime}〜
                {rotationSlots.find((s) => s.id === activeSlot)?.endTime}
              </p>
              <p className="text-sm font-bold" style={{ color: assignedCount === attendingList.length && attendingList.length > 0 ? "#10b981" : "#aaa" }}>
                {assignedCount}/{attendingList.length}名 設定済み
              </p>
            </div>
          )}

          {/* Member assignment list */}
          {attendingList.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-base" style={{ color: "#ccc" }}>出欠確認で参加者を選択してください</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "#f4f0ea" }}>
              {attendingList.map((m) => {
                const current = activeAssign[m.id] ?? "";
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3.5">
                    <p className="text-base font-bold flex-1" style={{ color: "#2c2c2c" }}>{m.nickname}</p>
                    <div className="flex gap-2">
                      {(["", "A", "B", "C"] as const).map((val) => {
                        const isCur = current === val;
                        const label = val || "未";
                        const cfgKey = val as RoomKey;
                        const btnBg = isCur
                          ? (val ? roomCfg[cfgKey].gradient : "linear-gradient(135deg,#888,#aaa)")
                          : "#f0ece5";
                        return (
                          <button
                            key={val}
                            onClick={() => handleRoomChange(activeSlot, m.id, val)}
                            className="rounded-2xl font-black text-sm transition-all"
                            style={{
                              background: btnBg,
                              color: isCur ? "white" : "#bbb",
                              width: "48px",
                              height: "44px",
                              flexShrink: 0,
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── メンバー一覧 ── */}
        <div className="card overflow-hidden">
          <div className="px-4 py-4 border-b" style={{ borderColor: "#f4f0ea" }}>
            <p className="text-base font-black" style={{ color: "#2c2c2c" }}>メンバー一覧</p>
          </div>
          {sorted.length === 0 ? (
            <div className="py-12 text-center" style={{ color: "#bbb" }}>
              <p className="text-base">メンバーがいません</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "#f4f0ea" }}>
              {sorted.map((m) => {
                const cfg = roleConfig[m.role];
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-base font-black" style={{ background: cfg.bg, color: cfg.text }}>
                      {m.nickname.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold truncate" style={{ color: "#2c2c2c" }}>{m.nickname}</p>
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md" style={{ background: cfg.bg, color: cfg.text }}>
                        {cfg.label}
                      </span>
                    </div>
                    <button onClick={() => openEdit(m)} className="px-3 py-2 rounded-xl text-xs font-bold" style={{ background: "#f4f0ea", color: "#888" }}>編集</button>
                    <button onClick={() => handleDelete(m.id)} className="px-3 py-2 rounded-xl text-xs font-bold" style={{ background: "#fff0f0", color: "#ff6b6b" }}>削除</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* アーカイブ・動作確認ページへ */}
        <div className="flex gap-2">
          <Link
            href="/archive"
            className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-center"
            style={{ background: "#f4f0ea", color: "#888" }}
          >
            部屋割りアーカイブ
          </Link>
          <Link
            href="/test"
            className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-center"
            style={{ background: "#f4f0ea", color: "#888" }}
          >
            会員メニュー
          </Link>
        </div>

        {/* Reset */}
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="w-full py-3.5 rounded-xl text-sm font-semibold" style={{ background: "#f4f0ea", color: "#aaa" }}>
            デフォルトメンバーに戻す
          </button>
        ) : (
          <div className="card p-4 text-center">
            <p className="text-base font-semibold mb-3" style={{ color: "#555" }}>本当にリセットしますか？</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmReset(false)} className="flex-1 py-3 rounded-xl text-base font-semibold" style={{ background: "#f4f0ea", color: "#888" }}>キャンセル</button>
              <button onClick={handleReset} className="flex-1 py-3 rounded-xl text-base font-bold text-white" style={{ background: "#ff6b6b" }}>リセット</button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {modal.open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="w-full max-w-lg rounded-t-3xl p-6 pop-in" style={{ background: "#fff" }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "#e0e0e0" }} />
            <h2 className="text-lg font-black mb-5" style={{ color: "#2c2c2c" }}>
              {modal.editId ? "メンバーを編集" : "メンバーを追加"}
            </h2>
            <div className="mb-4">
              <label className="text-sm font-bold mb-2 block" style={{ color: "#888" }}>ニックネーム</label>
              <input
                type="text"
                value={form.nickname}
                onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
                placeholder="例：よしの助"
                className="w-full rounded-xl px-4 py-3.5 text-base font-medium focus:outline-none"
                style={{ background: "#f4f0ea", color: "#2c2c2c", border: "2px solid transparent" }}
                onFocus={(e) => (e.target.style.border = "2px solid #C81E7760")}
                onBlur={(e)  => (e.target.style.border = "2px solid transparent")}
                autoFocus
              />
            </div>
            <div className="mb-6">
              <label className="text-sm font-bold mb-2 block" style={{ color: "#888" }}>ロール</label>
              <div className="grid grid-cols-4 gap-2">
                {roleOrder.map((role) => {
                  const cfg = roleConfig[role];
                  const selected = form.role === role;
                  return (
                    <button
                      key={role}
                      onClick={() => setForm((f) => ({ ...f, role }))}
                      className="py-3 rounded-xl text-sm font-bold transition-all"
                      style={{
                        background: selected ? cfg.bg : "#f4f0ea",
                        color:      selected ? cfg.text : "#aaa",
                        border:     selected ? `2px solid ${cfg.text}40` : "2px solid transparent",
                      }}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={closeModal} className="flex-1 py-3.5 rounded-xl text-base font-semibold" style={{ background: "#f4f0ea", color: "#888" }}>
                キャンセル
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.nickname.trim()}
                className="flex-1 py-3.5 rounded-xl text-base font-bold text-white transition-opacity"
                style={{
                  background: "linear-gradient(135deg,#A8175F,#C81E77)",
                  boxShadow: "0 3px 10px rgba(168,23,95,0.3)",
                  opacity: form.nickname.trim() ? 1 : 0.4,
                }}
              >
                {modal.editId ? "保存" : "追加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
