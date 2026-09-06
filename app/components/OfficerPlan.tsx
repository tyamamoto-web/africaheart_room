"use client";

/* ============================================================
   役員専用：オフ会運営のやること一覧（優先度と担当）
   ------------------------------------------------------------
   9/6 に app/admin/page.tsx から、中身も見た目も変えずに切り出した。
   同じものを 管理画面 ＞ 役員専用 と TOP ＞ 設定 ＞ 役員専用 の両方から出す。
   どちらから開いても、書いたものは同じ置き場所（Supabase）に入る。
   前に置く合言葉は app/components/OfficerGate.tsx。

   保存先は lib/officerPlan.ts（優先度）と lib/officerRaci.ts（担当・役割）。
   ほかの人の変更は約6秒ごとに入ってくる（この画面を開いているあいだだけ）。
   ============================================================ */

import { useState, useEffect, useRef } from "react";
import { getOfficerPlan, setOfficerPriority, clearOfficerPlan, seedOfficerPlan } from "@/lib/officerPlan";
import {
  getOfficerRaci, setOfficerRaci, clearOfficerRaci, raciKey,
  RACI_PEOPLE, type OfficerRaci, type RaciRole,
} from "@/lib/officerRaci";
import { raciDefs, raciPersonSubLabel } from "@/lib/raciDefs";

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

// ── 役割（だれが・どう関わるか）──────────────────────────────
// 定義・言葉づかいは lib/raciDefs.ts に集約（イベント運営マニュアルと共通）。
// 保存先の行だけが別（役員専用＝id5 ／ マニュアル＝id7）で、入力内容は互いに影響しない。

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

/* ── 係（大分類をだれの持ち場としてまとめるか）──────────────────
   大分類が8つあると「これは誰の持ち場か」が一目で言えないので、その上に係の列をかぶせる。
   区分はサークル運営の一般的な5つの係に合わせた
   （主催者／イベント担当（企画・進行）／広報担当（SNS・告知）／会計担当（予算管理）／
     コミュニケーション担当（参加者フォロー））。
   ※ 大分類・中分類・やることの中身と並び順は一切変えていない。この列は上にかぶせる見出しだけ。
     並びを変えていないので、同じ係が離れて2回出ることがある（イベント担当・コミュニケーション担当）。
     並べ替えて1か所にまとめることもできるが、大分類の通し番号（01〜08）が飛ぶので今回は見送った。 */
type OfficerDept = { key: string; label: string; note: string };
const officerDepts: OfficerDept[] = [
  { key: "lead",  label: "主催",                     note: "会の舵取り" },
  { key: "event", label: "イベント担当",             note: "企画・進行" },
  { key: "money", label: "会計担当",                 note: "お金の管理" },
  { key: "pr",    label: "広報担当",                 note: "募集・記録" },
  { key: "comm",  label: "コミュニケーション担当",   note: "参加者フォロー" },
];
// 大分類の通し番号 → 係
const officerDeptOfMajor: Record<string, string> = {
  "01": "lead",  // 会の運営・体制（役員MTG・ルール・意思決定・アプリ）
  "02": "event", // オフ会の準備・当日（日程/会場・予約・案内/出欠・進行）
  "03": "money", // お金（会計）
  "04": "event", // 企画・盛り上げ（誕生日・フリー部屋・季節/ゲリラ）
  "05": "comm",  // 交流・情報発信（メンバー紹介・グルチャ運用）
  "06": "pr",    // 記録（写真・動画）
  "07": "pr",    // 新規メンバー募集（ジモティ）
  "08": "comm",  // 安全・トラブル対応
};
// 表の行データ（係・大分類・中分類のセル結合＝rowSpan 用のフラグつき）
type OfficerRow = {
  task: OfficerTask;
  dept?: string; deptSpan?: number;
  majorNo?: string; major?: string; majorSpan?: number;
  mid?: string; midSpan?: number;
};
const officerRows: OfficerRow[] = (() => {
  // 隣り合う大分類が同じ係なら、係のセルを縦に結合する
  const blocks: { dept: string; majors: OfficerTaxonomy }[] = [];
  for (const m of officerTaxonomy) {
    const dept = officerDeptOfMajor[m.no] ?? "";
    const last = blocks[blocks.length - 1];
    if (last && last.dept === dept) last.majors.push(m);
    else blocks.push({ dept, majors: [m] });
  }
  const rows: OfficerRow[] = [];
  for (const b of blocks) {
    const deptSpan = b.majors.reduce(
      (s, m) => s + m.groups.reduce((t, g) => t + g.tasks.length, 0), 0
    );
    let firstOfDept = true;
    for (const m of b.majors) {
      const majorSpan = m.groups.reduce((s, g) => s + g.tasks.length, 0);
      let firstOfMajor = true;
      for (const g of m.groups) {
        g.tasks.forEach((task, ti) => {
          rows.push({
            task,
            dept:      firstOfDept ? b.dept : undefined,
            deptSpan:  firstOfDept ? deptSpan : undefined,
            majorNo:   firstOfMajor ? m.no : undefined,
            major:     firstOfMajor ? m.major : undefined,
            majorSpan: firstOfMajor ? majorSpan : undefined,
            mid:     ti === 0 ? g.mid : undefined,
            midSpan: ti === 0 ? g.tasks.length : undefined,
          });
          firstOfDept = false;
          firstOfMajor = false;
        });
      }
    }
  }
  return rows;
})();

// 役員が設定した優先度の保存キー（この端末に保存）。体系化に伴い版数を v2 に更新。
const OFFICER_MOSCOW_KEY = "africaheart-officer-moscow-v2";

export default function OfficerPlan() {
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

  // この画面を開いているあいだは、他メンバーの入力を約6秒ごとに取り込む（共有・同期）。
  // 合言葉の前では描かれないので、施錠中はそもそもここまで来ない。
  useEffect(() => {
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
  }, []);

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

  const moscowSetCount = officerTasks.filter((t) => priorities[t.id]).length;
  // 担当（RACI）を1人でも決めた「やること」の数
  const raciTaskCount  = officerTasks.filter((t) => RACI_PEOPLE.some((p) => raci[raciKey(t.id, p.id)])).length;

  return (
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
          <p style={{ fontSize: 12.5, fontWeight: 700, color: "#33302a", letterSpacing: "0.04em" }}>役割（だれが・どう関わるか）</p>
          <p style={{ marginTop: 6, fontSize: 11.5, color: "#a2988a", lineHeight: 1.7 }}>
            表の右側で、やることごとに「だれが、どう関わるか」を、次の4つの役割から決めます。名前ごとにプルダウンで選ぶだけ・みんなで共有されます。
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
            役割をつける人：
            {RACI_PEOPLE.map((p, i) => (
              <span key={p.id}>
                {i > 0 && "・"}
                <b style={{ color: "#5c5646" }}>{p.name}</b>
                <span style={{ color: "#b3a794" }}>（{raciPersonSubLabel(p.role)}）</span>
              </span>
            ))}
          </p>

          {/* 進み具合（役割）*/}
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 12, marginBottom: 2 }}>
            <span style={{ fontSize: 11.5, color: "#a2988a" }}>「責任者」は1つにつき1人・「担当者」は何人でも・みんなで共有</span>
            <span style={{ fontSize: 12, color: "#8b8274" }}>
              役割を決めた数 <b style={{ fontFamily: "Georgia,serif", fontWeight: 400, color: "#5f5747" }}>{raciTaskCount}</b>
              <span style={{ color: "#bcb09c" }}> / {officerTasks.length}</span>
            </span>
          </div>

        </div>

        {officerMsg && (
          <div style={{ margin: "4px 0 12px", padding: "8px 12px", borderRadius: 10, background: "rgba(176,137,72,0.10)", border: "1px solid #e7d8bf", fontSize: 11.5, color: "#8a6b32", lineHeight: 1.6 }}>
            {officerMsg}
          </div>
        )}
        {/* 大きな横長の表：スマホは横スクロール／PCは大きく表示 */}
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          {/* 折り返しをやめたぶん、全列が潰れない幅を確保（狭い画面では従来どおり横スクロール） */}
          <table style={{ width: "100%", minWidth: 1600, borderCollapse: "collapse" }}>
            <colgroup>
              <col style={{ width: "11%" }} />
              <col style={{ width: "12.5%" }} />
              <col style={{ width: "10.5%" }} />
              <col style={{ width: "19%" }} />
              <col style={{ width: "5.5%" }} />
              <col style={{ width: "5.5%" }} />
              <col style={{ width: "5.5%" }} />
              <col style={{ width: "5.5%" }} />
              <col style={{ width: "6.25%" }} />
              <col style={{ width: "6.25%" }} />
              <col style={{ width: "6.25%" }} />
              <col style={{ width: "6.25%" }} />
            </colgroup>
            <thead>
              {/* 1段目：セクションの見出し（優先度／担当）*/}
              <tr style={{ background: "#fff" }}>
                <th rowSpan={2} style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #e7dfd1", borderRight: "2px solid #e3d7c2", fontSize: 12, fontWeight: 700, color: "#8b8274", verticalAlign: "middle" }}>係（持ち場）</th>
                <th rowSpan={2} style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #e7dfd1", borderRight: "1px solid #eadfce", fontSize: 12, fontWeight: 700, color: "#8b8274", verticalAlign: "middle" }}>大分類</th>
                <th rowSpan={2} style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #e7dfd1", borderRight: "1px solid #f0ebe1", fontSize: 12, fontWeight: 700, color: "#8b8274", verticalAlign: "middle" }}>中分類</th>
                <th rowSpan={2} style={{ textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #e7dfd1", fontSize: 12, fontWeight: 700, color: "#8b8274", verticalAlign: "middle" }}>やること（小分類）</th>
                <th colSpan={4} style={{ textAlign: "center", padding: "8px 6px", borderBottom: "1px solid #eadfce", borderLeft: "2px solid #eee3d2", fontSize: 11, fontWeight: 700, color: "#8b8274", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>優先度（どれか1つ）</th>
                <th colSpan={RACI_PEOPLE.length} style={{ textAlign: "center", padding: "8px 6px", borderBottom: "1px solid #eadfce", borderLeft: "2px solid #e3d7c2", fontSize: 11, fontWeight: 700, color: "#8b8274", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>役割（だれが・どう関わる）</th>
              </tr>
              {/* 2段目：各列の見出し */}
              <tr style={{ background: "#fff" }}>
                {priorityDefs.map((d, di) => (
                  <th key={d.key} style={{ textAlign: "center", padding: "10px 4px", borderBottom: "2px solid #e7dfd1", borderLeft: di === 0 ? "2px solid #eee3d2" : undefined, fontSize: 11, fontWeight: 700, color: d.accent, whiteSpace: "nowrap" }}>
                    {d.label}
                  </th>
                ))}
                {RACI_PEOPLE.map((p, pi) => (
                  <th key={p.id} style={{ textAlign: "center", padding: "10px 6px", borderBottom: "2px solid #e7dfd1", borderLeft: pi === 0 ? "2px solid #e3d7c2" : "1px solid #f0ebe1", fontSize: 11.5, fontWeight: 700, color: "#5c5646", whiteSpace: "nowrap" }}>
                    {p.name}
                    <div style={{ marginTop: 2, fontSize: 9.5, fontWeight: 600, color: "#b3a794", letterSpacing: "0.04em" }}>{raciPersonSubLabel(p.role)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {officerRows.map((row, i) => {
                const task = row.task;
                const cur = priorities[task.id];
                const dept = row.dept ? officerDepts.find((d) => d.key === row.dept) : undefined;
                const majorEnd = i === officerRows.length - 1 || Boolean(officerRows[i + 1].major);
                const rowBorder = majorEnd ? "1px solid #e7dfd1" : "1px solid #f4efe6";
                // 「A 責任者」が複数ついている行は注意表示（1人が目安）
                const aCount = RACI_PEOPLE.filter((p) => raci[raciKey(task.id, p.id)] === "a").length;
                // 表の背景は全行とも白で統一（優先度による色分けはしない）。区切りは罫線のみ。
                return (
                  <tr key={task.id} style={{ background: "#fff" }}>
                    {row.dept && (
                      <td rowSpan={row.deptSpan} style={{ background: "#fdfbf7", borderRight: "2px solid #e3d7c2", borderBottom: "1px solid #e3d7c2", verticalAlign: "middle", padding: "14px 12px" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#5c5646", lineHeight: 1.45 }}>
                          {dept?.label}
                        </div>
                        <div style={{ marginTop: 3, fontSize: 10.5, fontWeight: 600, color: "#b3a794", letterSpacing: "0.04em" }}>
                          {dept?.note}
                        </div>
                      </td>
                    )}
                    {row.major && (
                      <td rowSpan={row.majorSpan} style={{ background: "#fff", borderRight: "1px solid #eadfce", borderBottom: "1px solid #e7dfd1", verticalAlign: "middle", padding: "14px 12px" }}>
                        <div style={{ fontFamily: "Georgia,serif", fontSize: 12, color: "#c3b48f", letterSpacing: "0.06em", marginBottom: 5 }}>{row.majorNo}</div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#2e2a22", lineHeight: 1.45, whiteSpace: "nowrap" }}>{row.major}</div>
                      </td>
                    )}
                    {row.mid && (
                      <td rowSpan={row.midSpan} style={{ background: "#fff", borderRight: "1px solid #f0ebe1", borderBottom: "1px solid #efe6d6", verticalAlign: "middle", padding: "12px 12px" }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#5c5646", lineHeight: 1.5, whiteSpace: "nowrap" }}>{row.mid}</span>
                      </td>
                    )}
                    {/* やること名は折り返さない（2行になると結合セルとの高さが崩れるため）。列幅は内容に合わせて伸びる（表は横スクロール可） */}
                    <td style={{ padding: "12px 12px", borderBottom: rowBorder, verticalAlign: "middle" }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#241f18", lineHeight: 1.5, whiteSpace: "nowrap" }}>{task.label}</span>
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
          <span style={{ fontSize: 11.5, color: "#a2988a" }}>「担当者」の数：</span>
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
              入力をすべてリセット（優先度・役割）
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <span style={{ fontSize: 12, color: "#8b8274" }}>全員ぶんの優先度と役割をすべて消しますか？（元に戻せません）</span>
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
          ※ 左側は「必ず／なるべく／できたら／今回はやらない」の4段階で優先度をつける進め方（MoSCoW法を参考）、右側は「担当者／責任者／相談役／お知らせ」の4つで役割を分ける表（RACIという役割分担の考え方を参考）です。分類は内容から推し量った暫定です。役員MTGで話しながら見直していきましょう。
        </p>
      </div>
    </div>
  );
}
