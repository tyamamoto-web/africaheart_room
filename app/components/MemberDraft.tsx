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

     もうひとつ、「ふりかえり」の写真と動画は、前回（8月22日・諏訪）に実際に
     入れたものを Supabase Storage から読んで出している（lib/gallery.ts）。
     マスを押すと拡げて見られ、「すべて見る」で場面ごとの一覧が開く。

     「当日」の部屋割（時間｜部屋番号｜企画｜名前）も、役員が「編集」から手で入れる。
     表の描き方は app/components/PlanTable.tsx（設定 ＞ アーカイブと共通）。
     保存先は共有の置き場所（lib/timetable.ts）なので、会員全員が同じものを見る。

   【入れた値がどこに残るか】
     「保存」を押したときに Supabase の event_overview に入る（lib/eventOverview.ts）。
     端末の中ではなく共有の置き場所なので、会員がそれぞれの端末から同じものを見られる。
     読み書きの部分は画面から切り離してあるので、この画面がTOPページに移っても
     lib/eventOverview.ts はそのまま使える。

   【切り替えについて】
     「準備 → 当日 → ふりかえり」は、今日の日付と概要を見て
     ひとりでに決まる。会員は何も選ばない。ここが案の要。
       準備       … 告知が済んでいて、開催日の前日まで
       当日       … 開催日
       ふりかえり … 開催日の翌日から、次の回が告知されるまで
     「準備・当日・ふりかえり」は催しの運営でいちばん通りのよい三つ組。
     役員側にも「準備」のやること一覧があるが、会員はそちらを見ないので
     言葉がぶつかることはない。
     名前は会員がふだん使う言葉のまま。比喩や「フェーズ」「段階」のような
     言葉は使わない（凝った名前は、かえって分かりにくくなる）。
     「告知が済んだ」は、開催日と開始時刻の両方が入ったとき。
     判定そのものは lib/eventOverview.ts の eventPhase にある。

     開いた瞬間にどこにいるかが分かるよう、枠の中のいちばん上に帯を置いた。
     三つの場面を1本の線でつなぎ、いまの場面の点だけをオレンジに灯して、
     その下に「D-23」のように開催日までの日数を大きく出す（当日は D-DAY、
     過ぎたら D+〇）。「今日」のような札を貼らなくても、光っている点と数字で伝わる。
     本番でもこの帯はそのまま使う。

     下に付いている切り替えは、下書きを見てもらうための寄り道。
     いまの場面には小さな灯りが付く。本番にこれは無い（帯が同じことを伝える）。
     別の場面を見ているあいだは、帯の点はその場面に合わせ、日数は出さない
     （その日にならないと本当の数が無いので、うそを出さない）。

   【色】
     グレーだけで組み、オレンジは「いま押すところ」「いまの場面」に
     だけ差す。差し色を1か所に絞ると、次にすることが自然に目に入る。
     余白は広めに取る（＝呼吸感）。線を減らして、間で区切る。

   【文字の大きさ】
     本文16px・補助13px。いまの会員メニューは11〜12pxが中心で、
     老眼が始まる年齢には小さすぎる。その差もここで見えるようにした。
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { eventInfo, eventStatus, nextEvent } from "@/lib/data";
import {
  EMPTY_OVERVIEW,
  EventOverviewSetupError,
  readEventOverview,
  saveEventOverview,
  daysBetween,
  eventPhase,
  isAnnounced,
  isoYmd,
  type EventOverview,
  type EventPhase,
  type OverviewField,
  type Ymd,
} from "@/lib/eventOverview";
import { readAttendance, setAttendance } from "@/lib/attendance";
import { readRoster, rosterNames } from "@/lib/roster";
import { listGalleryFor, sceneLabel, type GalleryItem } from "@/lib/gallery";
import {
  blankTimetableRow,
  joinNames,
  readTimetable,
  saveTimetable,
  splitNames,
  type TimetableRow,
} from "@/lib/timetable";
import PlanTable from "@/app/components/PlanTable";

/* ── 日付まわりの小道具 ───────────────────────
   場面の判定そのものは lib/eventOverview.ts（eventPhase）にある。
   ここにあるのは「今日は何日か」を出すものと、参加状況の置き場所の鍵に使う
   lib/data.ts の日付の読み取りだけ。 */

/** 参加状況の鍵に使う、lib/data.ts の開催日（概要に開催日が無いときの控え）。 */
const BASE_DATE_TEXT = eventStatus === "announced" ? nextEvent.date : eventInfo.date;

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

type Phase = EventPhase;

/* 三つの場面の名前。会員がふだん使う言葉のままにしてある。
   when は範囲の説明で、名前だけで迷わないための添え。
   境目は「日時確定」＝開催日と開始時刻の両方が入った時点（lib/eventOverview.ts の isAnnounced）。
   「告知」と書くと、告知の前から始まるのか後から始まるのかが読めないので、この言い方にした。
   「前日」「翌日」も、何の前後かが読めるよう「開催前日」「開催翌日」と書く。 */
const PHASES: { id: Phase; label: string; when: string }[] = [
  { id: "before", label: "準備",       when: "日時確定 〜 開催前日" },
  { id: "day",    label: "当日",       when: "開催日" },
  { id: "after",  label: "ふりかえり", when: "開催翌日 〜 次の日時確定" },
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

/* ── 参加状況（ポップアップ）─────────────────
   「参加状況」を押すと、画面の手前にこれが開く。
   名前は会員名簿（設定 ＞ 会員名簿）の1列目から引いてくる。ここでは名前を
   打ち込ませない。名簿と食い違うと、部屋割りにも会費にも響くため。

   丸を押すと参加・不参加が入れ替わる。これは役員の操作で、
   本番の会員の画面では押せないようにする（見るだけにする）。

   置き場所は画面のいちばん外（document.body）。スマホの枠の中に入れると
   枠に切られてしまうので、外に出して手前に重ねている。 */
function AttendanceDialog({
  names,
  attending,
  busy,
  onToggle,
  onClose,
}: {
  names: string[];
  attending: Set<string>;
  busy: string;
  onToggle: (name: string, on: boolean) => void;
  onClose: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Esc で閉じる。開いている間は、後ろの画面を動かさない。
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // 開いたらここに来たことが分かるように、枠そのものに焦点を移す。
    boxRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    // 外の暗いところを押しても閉じる。
    <div className="md-scrim" role="presentation" onClick={onClose}>
      <div
        ref={boxRef}
        className="md-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="md-dialog-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md-dialog-head">
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <p id="md-dialog-title" style={{ margin: 0, fontSize: 17, fontWeight: 700, color: INK }}>
              参加状況
            </p>
            <button type="button" className="md-edit" onClick={onClose}>
              閉じる
            </button>
          </div>
          {names.length > 0 && (
            <p style={{ margin: "8px 0 0", fontSize: 13, color: DIM }}>
              参加 {attending.size}名 / 全{names.length}名
            </p>
          )}
        </div>

        <div className="md-dialog-body">
          {names.length === 0 ? (
            <p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.9, color: SUB }}>
              会員名簿にまだ名前がありません。設定 ＞ 会員名簿 の1列目に入れてください。
            </p>
          ) : (
            names.map((name, i) => {
              const on = attending.has(name);
              return (
                <button
                  key={name}
                  type="button"
                  className="md-row"
                  aria-pressed={on}
                  disabled={busy === name}
                  onClick={() => onToggle(name, !on)}
                  style={{ borderBottom: i === names.length - 1 ? "none" : `1px solid ${LINE}` }}
                >
                  {/* 参加している人は、丸をオレンジで塗る。
                      色だけに頼らないよう、名前も濃さを変える。 */}
                  <span
                    aria-hidden="true"
                    style={{
                      flexShrink: 0,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      border: `1.5px solid ${on ? ACC : LINE}`,
                      background: on ? ACC : WHITE,
                    }}
                  />
                  <span style={{ fontSize: 16, lineHeight: 1.6, color: on ? INK : DIM }}>{name}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── いまの位置を示す帯（枠の中のいちばん上）───────────
   三つの場面を1本の線でつなぎ、いまの場面の点だけをオレンジに灯す。
   済んだ場面の点は薄く塗り、まだの場面の点は輪だけ。線も、いまの点までをオレンジで引く。
   その下に「D-23」のように開催日までの日数を大きく出す。
   「今日」のような札を貼らなくても、開いた瞬間にどこにいるかが分かるようにするため。
   見た目は globals.css の .md-rail 〜 .md-readout。 */
type Readout = { big: string; caption: string };

/** 帯に出す日数。開催日までなら D-〇、当日は D-DAY、過ぎていれば D+〇。
    告知前（日にちか開始時刻が無い）は数を出さず、待っている旨だけ。 */
function readoutFor(v: EventOverview, today: Ymd): Readout {
  const event = isoYmd(v.date);
  if (!event || !isAnnounced(v)) return { big: "", caption: "次回の告知を待っています" };
  const n = daysBetween(today, event);
  if (n > 0) return { big: `D-${n}`, caption: `開催まで ${n}日` };
  if (n === 0) return { big: "D-DAY", caption: "きょうが開催日" };
  return { big: `D+${-n}`, caption: `開催から ${-n}日` };
}

function TimingRail({ phase, readout }: { phase: Phase; readout: Readout | null }) {
  const idx = Math.max(PHASES.findIndex((p) => p.id === phase), 0);
  return (
    <div className="md-rail" role="group" aria-label="いまの場面">
      <div className="md-rail-line" aria-hidden="true">
        <span className="md-rail-track" />
        <span className="md-rail-fill" style={{ width: `${(idx / (PHASES.length - 1)) * 100}%` }} />
      </div>
      <ol className="md-rail-steps">
        {PHASES.map((p, i) => {
          const state = i < idx ? "done" : i === idx ? "now" : "next";
          return (
            <li key={p.id} className={`md-step is-${state}`} aria-current={state === "now" ? "step" : undefined}>
              <span className="md-step-dot" aria-hidden="true" />
              <span className="md-step-label">{p.label}</span>
            </li>
          );
        })}
      </ol>
      {readout && (
        <div className="md-readout">
          {readout.big && <span className="md-readout-num">{readout.big}</span>}
          <span className="md-readout-cap">{readout.caption}</span>
        </div>
      )}
    </div>
  );
}

/* ── 準備の画面（日時確定 〜 開催前日）───────────
   出欠はLINEのオープンチャットで決まる。前日24時までの表明を、
   役員が名簿から登録する運用。だからこの画面では参加・不参加を
   選ばせない。会員にとってここは「押すところ」ではなく、
   「自分がどうなっているかを見て安心するところ」。 */
function BeforeScreen({
  draft,
  saving,
  error,
  onSave,
  names,
  attending,
  busyName,
  onToggleAttendance,
}: {
  draft: EventOverview;
  saving: boolean;
  error: string;
  onSave: (next: EventOverview) => Promise<boolean>;
  names: string[];
  attending: Set<string>;
  busyName: string;
  onToggleAttendance: (name: string, on: boolean) => void;
}) {
  /* 概要を書き換えているところかどうか。役員だけが使う。
     本番の会員の画面には、この「編集」は出さない。 */
  const [editing, setEditing] = useState(false);

  /* 参加状況のポップアップを開いているかどうか。
     （準備の画面でまず知りたいのは日にちと自分のすることなので、
       名前の一覧は押したときだけ手前に出す） */
  const [showList, setShowList] = useState(false);

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
        <button
          type="button"
          className="md-cta"
          aria-expanded={showList}
          onClick={() => setShowList((v) => !v)}
        >
          参加状況
        </button>
        {showList && (
          <AttendanceDialog
            names={names}
            attending={attending}
            busy={busyName}
            onToggle={onToggleAttendance}
            onClose={() => setShowList(false)}
          />
        )}
      </div>

      <div style={{ marginTop: 44 }}>
        <Label>このあとの準備</Label>
        <div style={{ marginTop: 6 }}>
          {/* 宿題は抽選で決まるので、会員がすることは
              候補を出すことと、決まった結果を見にくること。 */}
          <TodoRow text="宿題の曲を追加・確認する" />
          <TodoRow text="デュエットの相手をさがす" />
          {/* 会費は概要のほうに出るようになったので、ここには置かない。
              代わりに、当日の会話のきっかけになるものを1つ。 */}
          <TodoRow text="近況をひとこと書く" last />
        </div>
      </div>
    </>
  );
}

/* ── 当日の画面 ───────────────────────────── */
/* ── 部屋割（当日）────────────────────────────
   列は 時間｜部屋番号｜企画｜名前 の4つ。
   1行が「その時間に、その部屋で、何をして、誰がいるか」（lib/timetable.ts）。
   コマを2部屋でやるときは、同じ時間の行を部屋のぶんだけ書く。
   表の上では同じ時間の行がまとまり、企画も同じなら企画のマスもつながる。
   名前が空の行は「全員」として出る（オープニングや合唱など）。

   表そのものの描き方は app/components/PlanTable.tsx にあり、
   設定 ＞ アーカイブの過去の回の表と同じ形（色だけ、この画面の白地に合わせてある）。

   中身は役員が「編集」から手で入れる（時間・部屋番号・企画・名前）。
   保存先は共有の置き場所（lib/timetable.ts）。まだ何も無いときは空のマスを4行出す。
   この「編集」は役員だけのもので、本番の会員の画面には出さない。 */
const HAIR = `1px solid ${LINE}`;
const EMPTY_PLAN_ROWS = 4;

/* 入力欄に出すための形。名前は「、」区切りの文字のまま持つ。 */
type PlanDraft = { time: string; room: string; title: string; names: string };
const toDraft = (r: TimetableRow): PlanDraft => ({ time: r.time, room: r.room, title: r.title, names: joinNames(r.names) });
const fromDraft = (d: PlanDraft): TimetableRow => ({ time: d.time, room: d.room, title: d.title, names: splitNames(d.names) });
const blankDraft = (): PlanDraft => ({ time: "", room: "", title: "", names: "" });

function RoomPlan({ attendeeCount }: { attendeeCount: number }) {
  // null は「まだ読んでいる」。読めたら配列（0行もありうる）。
  const [rows, setRows] = useState<TimetableRow[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<PlanDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    readTimetable()
      .then((r) => {
        if (alive) setRows(r);
      })
      .catch(() => {
        if (alive) setRows([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const startEdit = () => {
    const base = (rows ?? []).map(toDraft);
    // 空なら空の行を4つ。あれば末尾に空の行を1つ足して、続きを打てるようにする。
    setEdit(base.length ? [...base, blankDraft()] : Array.from({ length: EMPTY_PLAN_ROWS }, blankDraft));
    setError("");
    setEditing(true);
  };
  const setField = (i: number, key: keyof PlanDraft, v: string) =>
    setEdit((ds) => ds.map((d, n) => (n === i ? { ...d, [key]: v } : d)));
  const removeRow = (i: number) => setEdit((ds) => ds.filter((_, n) => n !== i));
  const addRow = () => setEdit((ds) => [...ds, blankDraft()]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      setRows(await saveTimetable(edit.map(fromDraft)));
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // 全員の人数。参加状況に入っていればそれ、無ければ表に出てくる名前の数。
  const seen = new Set<string>();
  for (const r of rows ?? []) for (const n of r.names) seen.add(n);
  const total = attendeeCount > 0 ? attendeeCount : seen.size;

  const view: TimetableRow[] =
    rows && rows.length ? rows : Array.from({ length: EMPTY_PLAN_ROWS }, blankTimetableRow);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* いまの場面であることを、差し色の点ひとつで示す */}
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: ACC }} />
          <Label>部屋割</Label>
        </div>
        <button
          type="button"
          className="md-edit"
          aria-expanded={editing}
          disabled={rows === null}
          onClick={() => (editing ? setEditing(false) : startEdit())}
        >
          {editing ? "やめる" : "編集"}
        </button>
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

      {editing ? (
        /* 打ち込む形。1行ごとに、時間・部屋番号・企画・名前。 */
        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          {edit.map((d, i) => (
            <div key={i} style={{ padding: 14, border: HAIR, borderRadius: 12, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: DIM, letterSpacing: "0.06em" }}>{i + 1}行目</span>
                <button type="button" className="md-rowx" aria-label={`${i + 1}行目を消す`} onClick={() => removeRow(i)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                  </svg>
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  className="md-field"
                  value={d.time}
                  placeholder="12:00〜12:20"
                  aria-label={`${i + 1}行目の時間`}
                  onChange={(e) => setField(i, "time", e.target.value)}
                />
                <input
                  className="md-field"
                  value={d.room}
                  placeholder="部屋番号"
                  aria-label={`${i + 1}行目の部屋番号`}
                  onChange={(e) => setField(i, "room", e.target.value)}
                />
              </div>
              <input
                className="md-field"
                value={d.title}
                placeholder="企画"
                aria-label={`${i + 1}行目の企画`}
                onChange={(e) => setField(i, "title", e.target.value)}
              />
              <textarea
                className="md-field md-field--area"
                value={d.names}
                rows={2}
                placeholder="名前（「、」で区切る。空なら全員）"
                aria-label={`${i + 1}行目の名前`}
                onChange={(e) => setField(i, "names", e.target.value)}
              />
            </div>
          ))}
          <button type="button" className="md-addrow" onClick={addRow}>
            行を追加
          </button>
          <button type="button" className="md-save" disabled={saving} onClick={save}>
            {saving ? "保存しています" : "保存"}
          </button>
          {error ? (
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.8, color: ACC_TEXT }}>{error}</p>
          ) : (
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.8, color: DIM }}>
              名前が空の行は「全員」として出ます。同じ時間の行は、表では1つの時間にまとまります。
              何も入っていない行は残りません。保存すると、会員それぞれの端末から同じものが見られます。
            </p>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <PlanTable rows={view} total={total} variant="day" />
        </div>
      )}
    </div>
  );
}

/* ── 当日の画面 ─────────────────────────────── */
function DayScreen({ attendeeCount }: { attendeeCount: number }) {
  return (
    <>
      {/* 部屋割と当日の流れは一体なので、ひとつの表にまとめてある。
          次のコマも表に載るので、「このあと」のような別の欄は置かない。 */}
      <RoomPlan attendeeCount={attendeeCount} />
    </>
  );
}

/* ── 前回の写真と動画 ─────────────────────────
   ふりかえりの画面に出す写真と動画。前回（8月22日・諏訪）に運営が入れたものを、
   Supabase Storage の gallery/2026-08-22/ から読む（lib/gallery.ts）。
   本番では「いま終わったばかりの回」の日付にする。ここは下書きなので、
   諏訪の回に決め打ちしてある。

   一覧用の小さい画像は、写真には全部あるが、動画には1本も無い
   （動画は1本が100MBを超え、端末で1コマ取り出せなかった）。
   だから動画のマスは、暗い面に再生の印を置くだけにしている。
   9マスの見本には写真を先に出し、動画はそのあとに回す。暗いマスが
   並ぶより、その日の様子が一目で伝わるほうを取った。 */
const LAST_GALLERY = { key: "2026-08-22", place: "諏訪" };
const PREVIEW_COUNT = 9; // 見本のマスの数（3列×3段）

function PlayMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="rgba(255,255,255,0.92)" />
      <path d="M9.5 7.5 L17 12 L9.5 16.5 Z" fill={INK} />
    </svg>
  );
}

/* 写真か動画の1マス。more を渡すと「残り○件」のマスになる。 */
function MediaTile({ item, more, onClick }: { item: GalleryItem; more?: number; onClick: () => void }) {
  // 動画は一覧用の画像が無いので、はじめから何も読まない（原寸は動画ファイルなので img では描けない）。
  const [src, setSrc] = useState(item.kind === "photo" ? item.thumbUrl : "");
  const label = more ? `残り${more}件をすべて見る` : item.kind === "video" ? "動画を開く" : "写真を開く";
  return (
    <button
      type="button"
      className="md-tile"
      onClick={onClick}
      aria-label={label}
      style={{ background: item.kind === "video" ? INK : SKEL }}
    >
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          // 小さい画像が無ければ原寸に落とす。それも無ければ灰色のまま。
          onError={() => setSrc(src === item.thumbUrl ? item.url : "")}
        />
      )}
      {item.kind === "video" && !more && (
        <span className="md-tile-mark">
          <PlayMark />
        </span>
      )}
      {more ? <span className="md-tile-more">+{more}</span> : null}
    </button>
  );
}

/* 場面（フォルダ）ごとにまとめる。listGalleryFor が場面順→時刻順に並べて返すので、
   となり合うものを束ねるだけでよい。 */
function groupByScene(items: GalleryItem[]): { sceneId: string; items: GalleryItem[] }[] {
  const out: { sceneId: string; items: GalleryItem[] }[] = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (last && last.sceneId === it.sceneId) last.items.push(it);
    else out.push({ sceneId: it.sceneId, items: [it] });
  }
  return out;
}

/* 1枚を拡げて見る。暗い面に1枚だけ置き、左右で前後に動く。
   置き場所は参加状況と同じく画面のいちばん外（document.body）。 */
function MediaViewer({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: GalleryItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const item = items[index];
  const boxRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const [playFailed, setPlayFailed] = useState(false);

  useEffect(() => {
    setPlayFailed(false);
  }, [item.path]);

  useEffect(() => {
    const go = (d: number) => {
      const n = index + d;
      if (n >= 0 && n < items.length) onIndex(n);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // 後ろに「すべて見る」の一覧が開いていても、それは閉じない（こちらだけ閉じる）。
        // 同じ document に付いている一覧の Esc も止めるので Immediate のほう。
        e.stopImmediatePropagation();
        onClose();
      } else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    // 捕捉の段で受けるので、後ろの一覧の Esc より先に届く。
    document.addEventListener("keydown", onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    boxRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, items.length, onIndex, onClose]);

  const go = (d: number) => {
    const n = index + d;
    if (n >= 0 && n < items.length) onIndex(n);
  };

  return createPortal(
    <div
      ref={boxRef}
      className="md-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={item.kind === "video" ? "動画" : "写真"}
      tabIndex={-1}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const s = touchX.current;
        touchX.current = null;
        if (s == null) return;
        const d = (e.changedTouches[0]?.clientX ?? s) - s;
        if (Math.abs(d) > 48) go(d < 0 ? 1 : -1);
      }}
    >
      <div className="md-viewer-head">
        <button type="button" className="md-viewer-btn" onClick={onClose} aria-label="閉じる">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 5 L19 19 M19 5 L5 19" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        </button>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", opacity: 0.85 }}>
          {sceneLabel(item.sceneId)}
        </p>
        <span style={{ minWidth: 44, textAlign: "right", fontSize: 13, opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>
          {index + 1} / {items.length}
        </span>
      </div>

      <div className="md-viewer-body">
        {index > 0 && (
          <button type="button" className="md-viewer-btn md-viewer-nav is-prev" onClick={() => go(-1)} aria-label="前へ">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 4 L7 12 L15 20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {item.kind === "video" ? (
          playFailed ? (
            <div style={{ textAlign: "center", padding: "0 24px" }}>
              <p style={{ margin: 0, fontSize: 14 }}>この端末では再生できない形式です</p>
            </div>
          ) : (
            <video
              key={item.path}
              src={item.url}
              controls
              playsInline
              preload="metadata"
              onError={() => setPlayFailed(true)}
            />
          )
        ) : (
          <img key={item.path} src={item.url} alt="" />
        )}
        {index < items.length - 1 && (
          <button type="button" className="md-viewer-btn md-viewer-nav is-next" onClick={() => go(1)} aria-label="次へ">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 4 L17 12 L9 20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}

/* 「すべて見る」で開く一覧。場面ごとに見出しを付けて3列に並べる。
   枠の作りは参加状況のポップアップと同じ（md-scrim / md-dialog）。 */
function GalleryDialog({
  items,
  onOpen,
  onClose,
}: {
  items: GalleryItem[];
  onOpen: (index: number) => void;
  onClose: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    boxRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const groups = groupByScene(items);
  const photos = items.filter((i) => i.kind === "photo").length;

  return createPortal(
    <div className="md-scrim" role="presentation" onClick={onClose}>
      <div
        ref={boxRef}
        className="md-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="md-gallery-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md-dialog-head">
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <p id="md-gallery-title" style={{ margin: 0, fontSize: 17, fontWeight: 700, color: INK }}>
              今回の写真と動画
            </p>
            <button type="button" className="md-edit" onClick={onClose}>
              閉じる
            </button>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: DIM }}>
            写真 {photos}枚 ・ 動画 {items.length - photos}本
          </p>
        </div>

        <div className="md-dialog-body">
          {groups.map((g) => (
            <div key={g.sceneId} style={{ marginTop: 18 }}>
              <Label>{sceneLabel(g.sceneId)}</Label>
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {g.items.map((it) => (
                  <MediaTile key={it.path} item={it} onClick={() => onOpen(items.indexOf(it))} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── ふりかえりの画面 ─────────────────────── */
function AfterScreen() {
  // null は「まだ読んでいる」。読めたら配列（0件もありうる）。
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [view, setView] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    listGalleryFor(LAST_GALLERY.key)
      .then((list) => {
        if (alive) setItems(list);
      })
      .catch((e) => {
        if (!alive) return;
        setItems([]);
        setError(e instanceof Error ? e.message : "写真の読み込みに失敗しました");
      });
    return () => {
      alive = false;
    };
  }, []);

  // 見本のマスは写真を先に。動画は一覧用の画像が無く、暗いマスにしかならないため。
  const preview = useMemo(() => {
    if (!items) return [];
    return [...items.filter((i) => i.kind === "photo"), ...items.filter((i) => i.kind === "video")];
  }, [items]);

  const total = items?.length ?? 0;
  const photos = items ? items.filter((i) => i.kind === "photo").length : 0;
  // 9マスに収まらないときは、9マス目を「残り○件」にする。
  const spill = total > PREVIEW_COUNT;
  const shown = spill ? preview.slice(0, PREVIEW_COUNT - 1) : preview;
  const moreTile = spill ? preview[PREVIEW_COUNT - 1] : null;
  const rest = spill ? total - (PREVIEW_COUNT - 1) : 0;

  const closeAll = useCallback(() => setShowAll(false), []);
  const closeView = useCallback(() => setView(null), []);

  const d = isoYmd(LAST_GALLERY.key);
  const when = d ? `${d.m}月${d.d}日` : LAST_GALLERY.key;

  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <Label>今回の写真と動画</Label>
        {total > 0 && (
          <button type="button" className="md-edit" onClick={() => setShowAll(true)}>
            すべて見る
          </button>
        )}
      </div>

      {items === null ? (
        // 読んでいる間は、これまでどおり灰色の枠を出しておく（形は同じなので画面が跳ねない）。
        <div
          aria-hidden="true"
          style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}
        >
          {Array.from({ length: PREVIEW_COUNT }, (_, i) => (
            <span key={i} style={{ display: "block", aspectRatio: "1 / 1", borderRadius: 8, background: SKEL }} />
          ))}
        </div>
      ) : total === 0 ? (
        <p style={{ margin: "16px 0 0", fontSize: 14, lineHeight: 1.9, color: error ? ACC_TEXT : SUB }}>
          {error || "まだ写真が入っていません。"}
        </p>
      ) : (
        <>
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {shown.map((it) => (
              <MediaTile key={it.path} item={it} onClick={() => setView(items.indexOf(it))} />
            ))}
            {moreTile && <MediaTile key="more" item={moreTile} more={rest} onClick={() => setShowAll(true)} />}
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 13, color: DIM }}>
            {when} {LAST_GALLERY.place} ・ 写真 {photos}枚 ・ 動画 {total - photos}本
          </p>
        </>
      )}

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

      {showAll && items && <GalleryDialog items={items} onOpen={setView} onClose={closeAll} />}
      {view !== null && items && items[view] && (
        <MediaViewer items={items} index={view} onIndex={setView} onClose={closeView} />
      )}
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
          開催日と開始の両方が入ると告知済みになり、画面が「準備」に変わります。
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let alive = true;
    readEventOverview()
      .then((v) => {
        if (alive) setDraft(v);
      })
      .catch(() => {
        // 読めなくても空のままにして、画面は止めない。
        // 表そのものが無いときは、保存を押したときに入力欄の中で伝える。
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
     見るのは手で入れた概要だけ。開催日と開始時刻の両方が入って「告知済み」、
     それまでは前の回のふりかえりが続く（決まりは lib/eventOverview.ts）。 */
  const autoPhase = useMemo<Phase>(() => eventPhase(draft, jstYmd(nowMs)), [nowMs, draft]);

  /* 会員名簿の名前と、今回の回の参加状況。
     どちらも画面に出てから読みにいく（描く前に読むと食い違いが出る）。 */
  const [names, setNames] = useState<string[]>([]);
  const [attending, setAttending] = useState<Set<string>>(() => new Set());
  const [busyName, setBusyName] = useState("");

  useEffect(() => {
    let alive = true;
    readRoster()
      .then((r) => {
        if (alive) setNames(rosterNames(r));
      })
      .catch(() => {
        // 読めなくても画面は止めない（名簿が空のときと同じ出し方になる）
      });
    return () => {
      alive = false;
    };
  }, []);

  /* どの回のぶんかは開催日で決める。まだ入れていなければ lib/data.ts のもの。 */
  const eventKey = useMemo(() => {
    const d = isoYmd(draft.date) ?? parseJpDate(BASE_DATE_TEXT);
    if (!d) return "";
    const two = (n: number) => String(n).padStart(2, "0");
    return `${d.y}-${two(d.m)}-${two(d.d)}`;
  }, [draft.date]);

  useEffect(() => {
    if (!eventKey) return;
    let alive = true;
    readAttendance(eventKey)
      .then((list) => {
        if (alive) setAttending(new Set(list));
      })
      .catch(() => {
        // 読めなければ、誰もチェックされていない状態で出す
      });
    return () => {
      alive = false;
    };
  }, [eventKey]);

  /* 丸を押したとき。押した1人ぶんだけを足し引きするので、
     同じ回を別の役員がさわっていても、相手のチェックを消さない。 */
  const toggleAttendance = async (name: string, on: boolean) => {
    if (!eventKey) return;
    setBusyName(name);
    // 先に画面だけ変えて、押した手ごたえを待たせない
    setAttending((prev) => {
      const next = new Set(prev);
      if (on) next.add(name);
      else next.delete(name);
      return next;
    });
    try {
      setAttending(new Set(await setAttendance(eventKey, name, on)));
    } catch {
      // 書けなかったときは、保存されているほうに戻す
      try {
        setAttending(new Set(await readAttendance(eventKey)));
      } catch {
        /* 取り直しにも失敗したら、そのままにしておく */
      }
    } finally {
      setBusyName("");
    }
  };

  /* 下書きを見てもらうためだけの寄り道。
     本番にはこの切り替えは無く、上の判定だけで決まる。 */
  const [look, setLook] = useState<Phase | null>(null);
  const phase = look ?? autoPhase;

  /* 帯の日数。いまの場面を見ているときだけ本当の数を出す。
     別の場面を見ているあいだは出さない（その日の数はまだ無いので、うそを出さない）。 */
  const readout = useMemo<Readout | null>(
    () => (phase === autoPhase ? readoutFor(draft, jstYmd(nowMs)) : null),
    [phase, autoPhase, draft, nowMs]
  );

  return (
    <div style={{ padding: "48px 32px 96px", maxWidth: 760, margin: "0 auto" }}>

      {/* ── 下書きを見てもらうための寄り道（本番にはこの切り替えは無い）── */}
      {/* 下の線は外側に持たせ、3つの幅は globals.css の .md-tabs でそろえる */}
      <div style={{ borderBottom: `1px solid ${LINE}` }}>
        <div role="tablist" aria-label="場面の切り替え（確認用）" className="md-tabs">
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
                  // 余白は globals.css の .md-tab が持つ（狭い画面で詰めるため、ここには書かない）
                  border: "none",
                  // 選んでいるところだけ差し色。下の線1本で示し、面は塗らない。
                  // （外側の線との重なりは .md-tabs の margin-bottom が受け持つ）
                  borderBottom: `2px solid ${on ? ACC : "transparent"}`,
                  // 地と、選んでいないときの色は globals.css の .md-tab が持つ。
                  // ここに書くとインライン指定が勝ってしまい、CSSのホバーが効かなくなる。
                  color: on ? ACC_TEXT : undefined,
                  fontSize: 15,
                  fontWeight: on ? 700 : 500,
                  cursor: "pointer",
                  // 名前と説明を上下2段に分ける。横に並べると、どこまでが名前か
                  // 一目で分かりにくかったため。
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 5,
                  textAlign: "left",
                  // 狭い画面で1字ずつ折り返さないようにする
                  whiteSpace: "nowrap",
                }}
              >
                {/* 上段：名前。今日の日付で選ばれたものには小さな灯りを添える（札は貼らない）。
                    本番にはこの切り替えごと無く、枠の中の帯が同じことを伝える。 */}
                <span style={{ display: "flex", alignItems: "center", gap: 8, lineHeight: 1.3 }}>
                  {isToday && <span className="md-live" aria-hidden="true" />}
                  <span>{p.label}</span>
                </span>
                {/* 下段：いつの場面かの説明。名前より小さく、色も落とす。
                    狭い画面では globals.css で隠す（無くても意味は通る） */}
                <span
                  className="md-tab-when"
                  style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3, letterSpacing: "0.02em", color: on ? SUB : DIM }}
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
          {/* 開いた瞬間に、いまどこにいるかが分かる帯。本番でもこのまま。 */}
          <TimingRail phase={phase} readout={readout} />

          {phase === "before" && (
            <BeforeScreen
              draft={draft}
              saving={saving}
              error={saveError}
              onSave={saveDraft}
              names={names}
              attending={attending}
              busyName={busyName}
              onToggleAttendance={toggleAttendance}
            />
          )}
          {phase === "day"    && <DayScreen attendeeCount={attending.size} />}
          {phase === "after"  && <AfterScreen />}
        </div>
      </div>

    </div>
  );
}
