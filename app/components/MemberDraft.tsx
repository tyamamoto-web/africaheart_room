"use client";

/* ============================================================
   社長室：会員画面の下書き（見た目だけ）
   ------------------------------------------------------------
   何のための画面か：
     方針として出した「オフ会の一か月に合わせる」を、言葉ではなく
     形で確かめるための下書き。会員がスマホで見る画面を、そのまま
     置いてある。

   【ここで作っているのは外見だけ】
     中身（データ）はまだつないでいない。名前・部屋番号のような値が
     入る場所には、灰色の帯を置いてある。
     帯の位置と大きさが、そのまま「そこに何が入るか」を表す。

     ただし開催の概要（開催日・時間・場所・部屋数・会費）だけは、
     「次回のオフ会」の右の「編集」から手で入れられるようにしてある。
     押すと、そのすぐ下に入力欄が開く。「保存」を押すと入力欄が閉じ、
     そのまま概要として出る。押さずに「やめる」で閉じたぶんは残らない。
     この「編集」は役員だけのもので、本番の会員の画面には出さない。

   【入れた値がどこに残るか】
     「保存」を押したときに Supabase の event_overview に入る（lib/eventOverview.ts）。
     端末の中ではなく共有の置き場所なので、会員がそれぞれの端末から同じものを見られる。
     読み書きの部分は画面から切り離してあるので、この画面がTOPページに移っても
     lib/eventOverview.ts はそのまま使える。

   【切り替えについて】
     「準備 → 当日 → ふりかえり」は、今日の日付と開催日を見て
     ひとりでに決まる。会員は何も選ばない。ここが案の要。
     基準にする開催日は、上で入れた開催日。入れていなければ
     lib/data.ts が持っているものを使う。

     下に付いている切り替えは、下書きを見てもらうための寄り道。
     今日の日付で選ばれたものには「今日」の印が付く。本番にこれは無い。

   【色】
     グレーだけで組み、オレンジは「いま押すところ」「いまの場面」に
     だけ差す。差し色を1か所に絞ると、次にすることが自然に目に入る。
     余白は広めに取る（＝呼吸感）。線を減らして、間で区切る。

   【文字の大きさ】
     本文16px・補助13px。いまの会員メニューは11〜12pxが中心で、
     老眼が始まる年齢には小さすぎる。その差もここで見えるようにした。
   ============================================================ */

import { useEffect, useMemo, useState } from "react";
import { eventInfo, eventStatus, nextEvent } from "@/lib/data";
import {
  EMPTY_OVERVIEW,
  EventOverviewSetupError,
  readEventOverview,
  saveEventOverview,
  type EventOverview,
  type OverviewField,
} from "@/lib/eventOverview";

/* ── 今日の日付から、出す場面をきめる ───────────────────────
   会員に選ばせないための、いちばん大事なところ。
   基準にする開催日は lib/data.ts が持っているものをそのまま使う
   （告知中なら nextEvent、それ以外は eventInfo）。
   開催日を書き換えれば、この画面の判定もついてくる。 */

/** どの開催日を基準にするか。告知中の回があるならそちらを見る。 */
const BASE_DATE_TEXT = eventStatus === "announced" ? nextEvent.date : eventInfo.date;

type Ymd = { y: number; m: number; d: number };

/** 「2026年8月22日（土）」のような書き方から年月日を取り出す。読めなければ null。 */
function parseJpDate(text: string): Ymd | null {
  const m = text.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/* いまの日本時間の年月日。
   置いてあるサーバーは世界時で動くので、そのまま日付を読むと
   日本の早朝に1日ずれる。時計の値を9時間ずらしてから読むことで、
   サーバーでも手元の端末でも同じ日付になる。 */
function jstYmd(nowMs: number): Ymd {
  const t = new Date(nowMs + 9 * 60 * 60 * 1000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/* 日数の差（後 − 前）。時刻を持たない年月日どうしで数えるので、
   時差でも夏時間でもずれない。 */
function daysBetween(from: Ymd, to: Ymd): number {
  const a = Date.UTC(from.y, from.m - 1, from.d);
  const b = Date.UTC(to.y, to.m - 1, to.d);
  return Math.round((b - a) / 86_400_000);
}

/** 開催日まであと何日か（＋なら未来、0なら当日、−なら過ぎている）から場面をきめる。 */
function phaseFromDays(daysUntil: number): Phase {
  if (daysUntil > 0) return "before";
  if (daysUntil === 0) return "day";
  return "after";
}

/* 色。グレーは社長室のメニューと同じ並びから取っている（新しい灰色を足さない）。 */
const INK   = "#1B1C1E"; // 主要な文字
const SUB   = "#63666C"; // 補助の文字
const DIM   = "#8B8E94"; // いちばん控えめな文字
const LINE  = "#E4E5E8"; // 細い区切り
const SKEL  = "#ECEDEF"; // データが入る場所を示す帯
const FACE  = "#F6F7F8"; // わずかに沈ませた面
const WHITE = "#FFFFFF";

/* 差し色はエルメスオレンジ（Pantone 1448 / #F37021）。
   このオレンジは鮮やかなぶん、白地に小さな字で置くと薄れて読めない
   （白との明暗差は2.9倍しかなく、読みやすさの目安4.5倍に届かない）。
   エルメス自身も、オレンジは箱の「面」に使い、文字は濃い色で刷っている。
   ここでも同じ分け方にした。

     ACC      … 線や小さな面に置くとき（ボタンの枠、タブの下線、点、
                「今日」の印）。そのままの色を使う。
     ACC_TEXT … 白地に字として置くとき。同じ色みのまま暗さだけ足したもの
                （色相はどちらも22度でそろえてある）。
     ACC_TINT … ごく薄く敷くとき。 */
const ACC      = "#F37021"; // エルメスオレンジそのもの（面に塗る用）
const ACC_TEXT = "#B24809"; // 同じ色みの、白地でも薄いオレンジの上でも読める濃さ（字に使う用）
const ACC_TINT = "rgba(243,112,33,0.09)";

/* ── 開催の概要（手入力）───────────────────
   これまで開催日や場所は lib/data.ts に書いてあり、書き換えられるのは
   作った人だけだった。ここで役員が直接入れられるようにしている。
   読み書きは lib/eventOverview.ts（Supabase の event_overview 表）。
   保存すると、会員それぞれの端末から同じものが見られる。 */

/* 入力欄の並び。wide が付いているものは横いっぱいに広がる。 */
const FIELDS: {
  key: OverviewField;
  label: string;
  type: string;
  wide?: boolean;
  placeholder?: string;
  min?: string;
}[] = [
  { key: "date",  label: "開催日",     type: "date", wide: true },
  { key: "start", label: "開始",       type: "time" },
  { key: "end",   label: "終了",       type: "time" },
  { key: "place", label: "場所",       type: "text", wide: true, placeholder: "会場の名前" },
  { key: "rooms", label: "部屋数",     type: "number", min: "1" },
  { key: "fee",   label: "会費（円）", type: "number", min: "0" },
];

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

/** 入力欄の「2026-08-22」から年月日を取り出す。空や書きかけなら null。 */
function isoYmd(iso: string): Ymd | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** 「2026年8月22日（土）」の形にする。曜日は世界時で数えるのでずれない。 */
function formatDate(iso: string): string | null {
  const d = isoYmd(iso);
  if (!d) return null;
  const w = WEEK[new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay()];
  return `${d.y}年${d.m}月${d.d}日（${w}）`;
}

/** 4000 → 4,000。端末の設定で書き方が変わらないように、自前で入れる。 */
function comma(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

type Phase = "before" | "day" | "after";

const PHASES: { id: Phase; label: string; when: string }[] = [
  { id: "before", label: "準備",       when: "告知 〜 前日" },
  { id: "day",    label: "当日",       when: "開催日" },
  { id: "after",  label: "ふりかえり", when: "翌日 〜 次の告知" },
];

/* 実際のデータが入る場所を示す帯。中身を作らずに、形だけを見せるためのもの。 */
function Bar({ w, h = 13 }: { w: number | string; h?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "block",
        width: typeof w === "number" ? w : w,
        maxWidth: "100%",
        height: h,
        borderRadius: h / 2,
        background: SKEL,
      }}
    />
  );
}

/* 画面の中の小さな見出し。 */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: DIM, letterSpacing: "0.06em" }}>
      {children}
    </p>
  );
}

/* まだ済んでいないことを表す、空の丸。ここに印が付くと「済んだ」になる。 */
function Circle() {
  return (
    <span
      aria-hidden="true"
      style={{
        flexShrink: 0,
        width: 20,
        height: 20,
        borderRadius: "50%",
        border: `1.5px solid ${LINE}`,
        background: WHITE,
      }}
    />
  );
}

/* 準備の画面でならべる、やることの1行。 */
function TodoRow({ text, last }: { text: string; last?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px 0",
        borderBottom: last ? "none" : `1px solid ${LINE}`,
      }}
    >
      <Circle />
      <span style={{ fontSize: 16, color: INK, lineHeight: 1.6 }}>{text}</span>
    </div>
  );
}

/* 押すところ。地は塗らず、外枠だけで示す。
   その画面でいちばんしてほしいこと1つだけ枠をオレンジにして、
   ほかは薄いグレーの枠にする。太さは同じ1pxのままにしてあるので、
   並べたときに高さも字の位置もそろい、色の違いだけが伝わる。 */
function Button({ children, tone = "quiet" }: { children: React.ReactNode; tone?: "accent" | "quiet" }) {
  const accent = tone === "accent";
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 54,
        borderRadius: 12,
        fontSize: 16,
        fontWeight: 700,
        background: WHITE,
        // 白地に置く字なので、オレンジは濃いほう（ACC_TEXT）を使う
        color: accent ? ACC_TEXT : SUB,
        border: `1px solid ${accent ? ACC : LINE}`,
      }}
    >
      {children}
    </span>
  );
}

/* ── 準備の画面 ─────────────────────────────
   出欠はLINEのオープンチャットで決まる。前日24時までの表明を、
   役員が名簿から登録する運用。だからこの画面では参加・不参加を
   選ばせない。会員にとってここは「押すところ」ではなく、
   「自分がどうなっているかを見て安心するところ」。 */
function BeforeScreen({
  draft,
  saving,
  error,
  onSave,
}: {
  draft: EventOverview;
  saving: boolean;
  error: string;
  onSave: (next: EventOverview) => Promise<boolean>;
}) {
  /* 概要を書き換えているところかどうか。役員だけが使う。
     本番の会員の画面には、この「編集」は出さない。 */
  const [editing, setEditing] = useState(false);

  const dateText = formatDate(draft.date);
  const timeText = draft.start && draft.end ? `${draft.start} 〜 ${draft.end}` : draft.start || draft.end;
  const footText = [
    draft.rooms && `${draft.rooms}部屋`,
    draft.fee && `会費 ${comma(draft.fee)}円`,
  ].filter(Boolean).join(" ・ ");

  return (
    <>
      {/* 見出しの右に「編集」。押すと、すぐ下に入力欄が開く。
          出るところと入れるところが同じなので、直したものがその場で見える。 */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <Label>次回のオフ会</Label>
        <button
          type="button"
          className="md-edit"
          aria-expanded={editing}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "やめる" : "編集"}
        </button>
      </div>

      {editing && (
        <OverviewFields
          draft={draft}
          saving={saving}
          error={error}
          onSave={async (next) => {
            // 保存できたときだけ閉じる。失敗したら開いたままにして、
            // 打ち直しにならないようにする。
            if (await onSave(next)) setEditing(false);
          }}
        />
      )}

      {/* 入れてあるものは文字で、まだのものは帯のままで出す。
          何を入れればこの画面が埋まるのかが、そのまま見てわかる。 */}
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {dateText
          ? <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: INK, lineHeight: 1.4 }}>{dateText}</p>
          : <Bar w={190} h={27} />}
        {timeText
          ? <p style={{ margin: 0, fontSize: 16, color: SUB, lineHeight: 1.6 }}>{timeText}</p>
          : <Bar w={120} h={16} />}
        {draft.place
          ? <p style={{ margin: 0, fontSize: 16, color: SUB, lineHeight: 1.6 }}>{draft.place}</p>
          : <Bar w={170} h={16} />}
        {footText
          ? <p style={{ margin: 0, fontSize: 13, color: DIM, lineHeight: 1.6 }}>{footText}</p>
          : <Bar w={96} h={14} />}
      </div>

      {/* 出欠そのものはLINEで決まるので、この画面に残る操作は
          「誰が来るのか見る」だけ。準備の間はこれが一番知りたいこと。 */}
      <div style={{ marginTop: 36 }}>
        <Button tone="accent">参加状況</Button>
      </div>

      <div style={{ marginTop: 44 }}>
        <Label>このあとの準備</Label>
        <div style={{ marginTop: 6 }}>
          <TodoRow text="宿題の曲を決める" />
          <TodoRow text="デュエットの相手をさがす" />
          <TodoRow text="会費と持ち物をみる" last />
        </div>
      </div>
    </>
  );
}

/* ── 当日の画面 ───────────────────────────── */
function DayScreen() {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* いまの場面であることを、差し色の点ひとつで示す */}
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: ACC }} />
        <Label>いまの時間</Label>
      </div>

      {/* 当日いちばん知りたいのは「自分がどの部屋か」。ここだけ大きく取る。 */}
      <div
        style={{
          marginTop: 16,
          padding: "34px 26px",
          borderRadius: 16,
          background: ACC_TINT,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: ACC_TEXT, letterSpacing: "0.06em" }}>
          あなたの部屋
        </span>
        {/* 部屋の記号が入る場所 */}
        <Bar w={128} h={44} />
        {/* 部屋番号が入る場所 */}
        <Bar w={92} h={16} />
      </div>

      <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 14 }}>
        <Label>このあと</Label>
        {/* 次のコマの時間と部屋が入る場所 */}
        <Bar w="72%" h={16} />
        <Bar w="52%" h={16} />
      </div>

      <div style={{ marginTop: 40 }}>
        <Button>歌う順番をきめる</Button>
      </div>

      <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 12 }}>
        <Label>困ったときの連絡先</Label>
        <Bar w="60%" h={16} />
      </div>
    </>
  );
}

/* ── ふりかえりの画面 ─────────────────────── */
function AfterScreen() {
  return (
    <>
      <Label>今回の写真と動画</Label>

      {/* 写真が並ぶ場所。3列に並ぶことだけが分かればよい。 */}
      <div
        aria-hidden="true"
        style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}
      >
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} style={{ display: "block", aspectRatio: "1 / 1", borderRadius: 8, background: SKEL }} />
        ))}
      </div>

      <div style={{ marginTop: 40 }}>
        <Label>ひとこと</Label>
        {/* 書き込む場所。1行でよい、と分かる高さにしてある。 */}
        <div
          style={{
            marginTop: 14,
            height: 88,
            borderRadius: 12,
            border: `1px solid ${LINE}`,
            background: FACE,
          }}
        />
        <div style={{ marginTop: 12 }}>
          <Button tone="accent">送る</Button>
        </div>
      </div>

      <div style={{ marginTop: 42, display: "flex", flexDirection: "column", gap: 14 }}>
        <Label>次回のオフ会</Label>
        <Bar w="66%" h={16} />
      </div>
    </>
  );
}

/* ── 開催の概要を入れるところ ─────────────
   「次回のオフ会」のすぐ下で開く。別の画面に行かせず、
   出るところと入れるところを同じ場所にしてある。 */
function OverviewFields({
  draft,
  saving,
  error,
  onSave,
}: {
  draft: EventOverview;
  saving: boolean;
  error: string;
  onSave: (next: EventOverview) => void;
}) {
  /* 書きかけの控え。保存を押すまでは、ここだけが変わる。
     押さずに閉じれば元のまま。開くたびに、いまの値から作りなおす。 */
  const [edit, setEdit] = useState<EventOverview>(draft);

  return (
    <div
      style={{
        marginTop: 14,
        background: FACE,
        borderRadius: 12,
        padding: "18px 16px 16px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 14,
      }}
    >
      {FIELDS.map((f) => (
        <label
          key={f.key}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 7,
            minWidth: 0,
            gridColumn: f.wide ? "1 / -1" : undefined,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: SUB }}>{f.label}</span>
          <input
            className="md-field"
            type={f.type}
            min={f.min}
            placeholder={f.placeholder}
            inputMode={f.type === "number" ? "numeric" : undefined}
            disabled={saving}
            value={edit[f.key]}
            onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })}
          />
        </label>
      ))}

      <button type="button" className="md-save" disabled={saving} onClick={() => onSave(edit)}>
        {saving ? "保存しています" : "保存"}
      </button>

      {error ? (
        <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: 12, lineHeight: 1.8, color: ACC_TEXT }}>
          {error}
        </p>
      ) : (
        <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: 12, lineHeight: 1.8, color: DIM }}>
          保存すると、会員それぞれの端末から同じものが見られます。
        </p>
      )}
    </div>
  );
}

export default function MemberDraft() {
  /* 時計。最初に描くときと、画面に出たあとの両方で同じ数え方をする。
     日付をまたいだまま開きっぱなしにされても、次に開いたときには正しくなる。 */
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => setNowMs(Date.now()), []);

  /* 開催の概要。Supabase に置いてあるものを、画面に出てから読みにいく。
     （描く前に読むと、サーバーが作った画面と食い違って警告が出る） */
  const [draft, setDraft] = useState<EventOverview>(EMPTY_OVERVIEW);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let alive = true;
    readEventOverview()
      .then((v) => {
        if (alive) setDraft(v);
      })
      .catch((e) => {
        // 表そのものが無いときだけは、直し方が決まっているので画面に出す。
        // それ以外（通信の失敗など）は空のままにして、画面は止めない。
        if (alive && e instanceof EventOverviewSetupError) setNeedsSetup(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  /* 保存を押されたとき。書けたら true を返し、入力欄を閉じてもらう。 */
  const saveDraft = async (next: EventOverview): Promise<boolean> => {
    setSaving(true);
    setSaveError("");
    try {
      setDraft(await saveEventOverview(next));
      setNeedsSetup(false);
      return true;
    } catch (e) {
      setSaveError(
        e instanceof EventOverviewSetupError
          ? "共有用の表がまだありません。Supabase で setup.sql の event_overview を実行してください。"
          : e instanceof Error
            ? e.message
            : "保存に失敗しました"
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  /* 今日の日付から、出す場面をきめる。ここが「会員に選ばせない」の中身。
     基準にするのは手で入れた開催日。入れていなければ lib/data.ts のもの。 */
  const autoPhase = useMemo<Phase>(() => {
    const event = isoYmd(draft.date) ?? parseJpDate(BASE_DATE_TEXT);
    // 開催日が読み取れないときだけ、判定をあきらめて「準備」を出す。
    if (!event) return "before";
    return phaseFromDays(daysBetween(jstYmd(nowMs), event));
  }, [nowMs, draft.date]);

  /* 下書きを見てもらうためだけの寄り道。
     本番にはこの切り替えは無く、上の判定だけで決まる。 */
  const [look, setLook] = useState<Phase | null>(null);
  const phase = look ?? autoPhase;

  return (
    <div style={{ padding: "48px 32px 96px", maxWidth: 760, margin: "0 auto" }}>

      {/* ── この画面が何なのかの説明 ── */}
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: ACC_TEXT, letterSpacing: "0.1em" }}>
        下書き・見た目のみ
      </p>
      <h1 style={{ margin: "18px 0 0", fontSize: 27, fontWeight: 600, color: INK, lineHeight: 1.5 }}>
        会員がスマホで見る画面
      </h1>
      <p style={{ margin: "18px 0 0", fontSize: 16, lineHeight: 1.95, color: SUB, maxWidth: "40em" }}>
        メニューを選ばせるのをやめて、開催日からの日数で中身が変わる形にした案です。
        会員は何も選ばず、開いたら「いま自分がすること」だけが出ています。
      </p>
      <p style={{ margin: "14px 0 0", fontSize: 13, lineHeight: 1.9, color: DIM, maxWidth: "40em" }}>
        灰色の帯は、まだ入っていない場所です。開催の概要だけは「次回のオフ会」の右の「編集」から入れられます。
      </p>
      {needsSetup && (
        <p style={{ margin: "14px 0 0", fontSize: 13, lineHeight: 1.9, color: ACC_TEXT, maxWidth: "40em" }}>
          共有用の表がまだありません。Supabase の SQL Editor で supabase/setup.sql の
          event_overview のところを実行すると、入れた概要が会員全員に届くようになります。
        </p>
      )}

      {/* ── 下書きを見てもらうための寄り道（本番にはこの切り替えは無い）── */}
      <div style={{ marginTop: 40 }}>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: DIM }}>
          確認用に、ほかの場面も見る
        </p>
        <div
          role="tablist"
          aria-label="場面の切り替え（確認用）"
          style={{ display: "flex", gap: 4, borderBottom: `1px solid ${LINE}` }}
        >
          {PHASES.map((p) => {
            const on = p.id === phase;
            const isToday = p.id === autoPhase;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setLook(p.id === autoPhase ? null : p.id)}
                className="md-tab"
                style={{
                  padding: "14px 20px 15px",
                  border: "none",
                  // 選んでいるところだけ差し色。下の線1本で示し、面は塗らない。
                  borderBottom: `2px solid ${on ? ACC : "transparent"}`,
                  marginBottom: -1,
                  // 地と、選んでいないときの色は globals.css の .md-tab が持つ。
                  // ここに書くとインライン指定が勝ってしまい、CSSのホバーが効かなくなる。
                  color: on ? ACC_TEXT : undefined,
                  fontSize: 15,
                  fontWeight: on ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  // 狭い画面で1字ずつ折り返さないようにする
                  whiteSpace: "nowrap",
                }}
              >
                {p.label}
                {/* 今日の日付で選ばれたのがどれかを示す。狭い画面でもこれだけは残す。 */}
                {isToday && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      // 小さい字なので、薄く敷くと読みづらい。
                      // ボタンと同じく「オレンジの面に濃い字」にして、はっきり見せる。
                      color: INK,
                      background: ACC,
                      borderRadius: 999,
                      padding: "2px 8px",
                    }}
                  >
                    今日
                  </span>
                )}
                {/* いつの場面かの説明。狭い画面では globals.css で隠す（無くても意味は通る） */}
                <span
                  className="md-tab-when"
                  style={{ fontSize: 12, fontWeight: 500, color: on ? ACC_TEXT : DIM, opacity: on ? 0.75 : 1 }}
                >
                  {p.when}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── スマホの枠 ── */}
      <div style={{ display: "flex", justifyContent: "center", padding: "56px 0 0" }}>
        <div
          style={{
            width: 356,
            maxWidth: "100%",
            borderRadius: 30,
            border: `1px solid ${LINE}`,
            background: WHITE,
            padding: "40px 28px 48px",
            boxShadow: "0 1px 3px rgba(27,28,30,0.04), 0 12px 32px -18px rgba(27,28,30,0.20)",
          }}
        >
          {phase === "before" && (
            <BeforeScreen draft={draft} saving={saving} error={saveError} onSave={saveDraft} />
          )}
          {phase === "day"    && <DayScreen />}
          {phase === "after"  && <AfterScreen />}
        </div>
      </div>

      {/* ── 補足 ── */}
      <p style={{ margin: "48px 0 0", fontSize: 13, lineHeight: 1.9, color: DIM, textAlign: "center" }}>
        文字は本文16px・補助13px。いまの会員メニューは11〜12pxが中心です。
      </p>
    </div>
  );
}
