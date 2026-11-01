"use client";

/* ============================================================
   この回を記録に残す（設定 ＞ アーカイブ の上に出るひと枠）
   ------------------------------------------------------------
   当日の部屋割り（lib/timetable.ts）は回ごとに分かれていない。次の回の準備で
   書き換えると、その日どのコマで誰がどちらの部屋にいたかは、どこにも残らない。
   これまでは終わるたびに手で写していたので、押すだけで済むようにした。

   【押すと何が起きるか】
     いまの回の概要（lib/eventOverview.ts）と部屋割りを読んで、
     終わった回の記録（lib/roundArchive.ts ＝ 設定 ＞ アーカイブ）へ1件足す。
     足したものは、当日の表を書き換えても消えない。

   【合言葉】
     参加者が間違えて押さないように、保存の前に合言葉を聞く（lib/officerGate.ts）。
     役員専用タブと同じ合言葉で、どれか1つを開ければ、そのタブのあいだは聞き直さない。
     ※ 目隠しであって鍵ではない（このページの中身を見れば分かってしまう）。
        押せるのが役員だけであればよい、という決め方。

   【残せないとき】
     次の4つのどれかに当たるあいだは、理由だけ出してボタンを出さない。
       ・開催日が入っていない
       ・開催日がまだ先（終わっていない回を、前の回の表で埋めてしまわないため）
       ・部屋割りが1行も無い
       ・リポジトリに凍結してある回（6/27・7/26・8/22。書いても画面には出ない）

   【すでに残っているとき】
     上書きになるので、ボタンは出すが二度押しにする。
     手で直した補足や参加者を、下書きで黙って塗りつぶさないため。
     押す直前にもう一度、読めるかどうかを確かめてから書く（findRoundRecord）。

   【参加者】
     部屋割りに名前が出てくる人を、出てくる順に残す（lib/roundArchive.ts の namesInRows）。
     アーカイブの「参加 N名」と表の顔ぶれが食い違わないように、表のほうを元にする。
     出欠で「参加」と出したのに表に名前が無い人がいるときだけ、その名前を出して、
     入れるかどうかを選べるようにする（ふだんは出ない）。

   【補足】
     9/26・10/31 と同じ調子の下書きを作って入れておく（そのまま直せる）。
     来る時間・帰る時間（lib/attendanceTime.ts）から、部屋割りの時間に照らして
     「遅れて参加」「途中退席」だけを拾う。表に名前が無い人のぶんは拾わない。
   ============================================================ */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { readAttendance, type AttendanceMap } from "@/lib/attendance";
import {
  TIME_UNKNOWN,
  parseWhenHour,
  readAttendanceTimes,
  type AttendanceTimeMap,
} from "@/lib/attendanceTime";
import { readEventOverview, type EventOverview } from "@/lib/eventOverview";
import { todayKey } from "@/lib/currentRound";
import { OFFICER_PASSCODE, isOfficerUnlocked, unlockOfficer } from "@/lib/officerGate";
import {
  findRoundRecord,
  isFrozenRound,
  namesInRows,
  saveRoundRecord,
  type RoundRecord,
} from "@/lib/roundArchive";
import { readTimetable, type TimetableRow } from "@/lib/timetable";

const INK = "#1B1C1E";
const SUB = "#63666C";
const DIM = "#8B8E94";
const LINE = "#DFE1E4";
const MARK = "#35373C";

/* ---- 下書きを作るための小さな道具 ------------------------------------- */

/** "15:00〜16:00" を [はじまり, おわり]（時の小数）に。読めなければ null。 */
function spanOf(time: string): [number, number] | null {
  const [a, b] = time.split(/[〜~]/);
  const s = parseWhenHour(a ?? "");
  const e = parseWhenHour(b ?? "");
  return s === null || e === null ? null : [s, e];
}

/** 部屋割り全体の、いちばん早い時刻といちばん遅い時刻。読めない行は飛ばす。 */
function wholeSpan(rows: TimetableRow[]): [number, number] | null {
  let s = Number.POSITIVE_INFINITY;
  let e = Number.NEGATIVE_INFINITY;
  for (const r of rows) {
    const sp = spanOf(r.time);
    if (!sp) continue;
    s = Math.min(s, sp[0]);
    e = Math.max(e, sp[1]);
  }
  return Number.isFinite(s) && Number.isFinite(e) ? [s, e] : null;
}

/** 表に出てくる部屋を、出てくる順に1つずつ（同じ部屋は1回だけ）。 */
function roomsInRows(rows: TimetableRow[]): { room: string; roomNo: string }[] {
  const out: { room: string; roomNo: string }[] = [];
  for (const r of rows) {
    const room = r.room.trim();
    if (!room) continue;
    if (out.some((x) => x.room === room)) continue;
    out.push({ room, roomNo: (r.roomNo ?? "").trim() });
  }
  return out;
}

/** 「A室202／B室201の2部屋。」。部屋が1つで番号も無ければ空。 */
function roomsSentence(rooms: { room: string; roomNo: string }[]): string {
  if (rooms.length === 0) return "";
  if (rooms.length === 1 && !rooms[0].roomNo) return "";
  const label = rooms.map((x) => (x.roomNo ? `${x.room}室${x.roomNo}` : `${x.room}室`)).join("／");
  return `${label}の${rooms.length}部屋。`;
}

/** 「じゅり 15時半ころ」。本人が「未定」としか出していなければ名前だけ。 */
function whenLabel(name: string, value: string): string {
  return value === TIME_UNKNOWN ? name : `${name} ${value}`;
}

/**
 * 補足の下書き。
 * 「遅れて参加」「途中退席」は、部屋割りの時間に照らして、はっきり後に来た／
 * 先に帰ったと読めた人だけ拾う（読めない字は、分からないので拾う）。
 * 部屋割りが15:00からの回で、15:00に来た人まで「遅れて参加」にしないため。
 */
function draftNote(rows: TimetableRow[], names: string[], times: AttendanceTimeMap): string {
  const span = wholeSpan(rows);
  const late: string[] = [];
  const early: string[] = [];
  for (const n of names) {
    const t = times[n];
    if (!t) continue;
    if (t.in) {
      const h = parseWhenHour(t.in);
      if (!span || h === null || h > span[0]) late.push(whenLabel(n, t.in));
    }
    if (t.out) {
      const h = parseWhenHour(t.out);
      if (!span || h === null || h < span[1]) early.push(whenLabel(n, t.out));
    }
  }
  return [
    `参加${names.length}名。`,
    roomsSentence(roomsInRows(rows)),
    late.length > 0 ? `遅れて参加：${late.join("／")}。` : "",
    early.length > 0 ? `途中退席：${early.join("／")}。` : "",
  ].join("");
}

/** "2026-10-31" → "2026.10.31（土）"。読めなければそのまま。 */
function dateLabel(key: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return key;
  const [, y, mo, d] = m;
  const w = "日月火水木金土"[new Date(Number(y), Number(mo) - 1, Number(d)).getDay()] ?? "";
  return `${y}.${mo}.${d}${w ? `（${w}）` : ""}`;
}

/* ---- 画面 ------------------------------------------------------------- */

/** 読み込んだもの。そろって初めてボタンを出す。 */
type Loaded = {
  overview: EventOverview;
  rows: TimetableRow[];
  names: string[];
  /** 出欠で参加なのに、部屋割りに名前が無い人 */
  extras: string[];
  /** 来る時間・帰る時間。補足の下書きを作り直すのに要る */
  times: AttendanceTimeMap;
};

export default function ArchiveSaveCard({
  stored,
  onSaved,
}: {
  /** 記録に残っている回（親が読んだもの）。読み終わるまでは null。 */
  stored: RoundRecord[] | null;
  /** 残せたときに、親の一覧を入れ替えてもらう。 */
  onSaved: (list: RoundRecord[]) => void;
}) {
  const [data, setData] = useState<Loaded | null>(null);
  const [note, setNote] = useState("");
  /* 役員が補足に手を入れたか。入れたあとは、下書きで上書きしない。 */
  const [edited, setEdited] = useState(false);
  const [withExtras, setWithExtras] = useState(false);
  /* 合言葉が済んでいるか。sessionStorage を押すたびに見に行かない ──
     保存が例外になる端末（すべてのCookieをブロックなど）では unlockOfficer が
     true を返しても読み出しは false のままで、確かめから先へ進めなくなる。
     ほかの役員画面（OfficerGate・SurveyFeature・GalleryFeature）と同じ持ち方。 */
  const [unlocked, setUnlocked] = useState(false);
  /* ボタンの段取り。"" ＝ ふだん／"ask" ＝ 合言葉を聞いている／"confirm" ＝ 上書きの確かめ */
  const [step, setStep] = useState<"" | "ask" | "confirm">("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const today = todayKey();

  /* 画面に出てから読む（描く前に読むと、サーバーが作った画面と食い違う）。 */
  useEffect(() => {
    let alive = true;
    (async () => {
      const overview = await readEventOverview().catch(() => null);
      if (!alive || !overview) return;
      const rows = await readTimetable();
      if (!alive) return;
      const names = namesInRows(rows);
      /* 出欠と出入りは、開催日が読めているときだけ。読めなくても画面は止めない。 */
      const [going, times]: [AttendanceMap, AttendanceTimeMap] = overview.date
        ? await Promise.all([
            readAttendance(overview.date).catch((): AttendanceMap => ({})),
            readAttendanceTimes(overview.date).catch((): AttendanceTimeMap => ({})),
          ])
        : [{}, {}];
      if (!alive) return;
      const extras = Object.keys(going)
        .filter((n) => going[n] === "going" && !names.includes(n))
        .sort();
      setData({ overview, rows, names, extras, times });
      setUnlocked(isOfficerUnlocked());
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* 記録に残す顔ぶれ。アーカイブの「参加 N名」はこれを数えて出る。 */
  const people = useMemo(
    () => (withExtras && data ? [...data.names, ...data.extras] : (data?.names ?? [])),
    [withExtras, data]
  );

  /* 補足の下書き。参加者と同じ顔ぶれから作るので、「部屋割りに名前が無い人も
     入れる」を切り替えると人数も遅刻・早退も付いてくる。
     役員が手を入れたあとは触らない（書いたものを消さない）。 */
  const draft = useMemo(
    () => (data ? draftNote(data.rows, people, data.times) : ""),
    [data, people]
  );
  useEffect(() => {
    if (!edited) setNote(draft);
  }, [draft, edited]);

  /* 残せない理由。空なら残せる。 */
  const blocked = useMemo(() => {
    if (!data) return "";
    const { overview, rows } = data;
    if (!overview.date) return "開催日がまだ入っていません。先に「開催について」で入れてください。";
    if (overview.date > today) return `開催日（${dateLabel(overview.date)}）はまだ先です。終わってから残せます。`;
    if (isFrozenRound(overview.date)) return "この回は、もともとアプリに入っている回です。残す必要はありません。";
    if (rows.length === 0) return "当日の部屋割りが1行も入っていません。";
    return "";
  }, [data, today]);

  if (!data) return null;

  const { overview, rows, extras } = data;
  /* この回がもう記録にあるか。親がまだ読み終わっていなければ、無いものとして出す
     （押したときに findRoundRecord でもう一度、はっきり確かめる）。 */
  const saved = stored?.some((r) => r.key === overview.date) ?? false;

  /** 実際に書く。合言葉はここへ来る前に済ませてある。 */
  async function save() {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      /* 押す直前にもう一度、はっきり確かめる。読めなければここで止まる
         （読めないのを「まだ無い」と取り違えて、直した記録を塗りつぶさないため）。 */
      const already = await findRoundRecord(data.overview.date);
      if (already && step !== "confirm") {
        setStep("confirm");
        return;
      }
      const list = await saveRoundRecord({
        key: data.overview.date,
        place: data.overview.place,
        note: note.trim(),
        start: data.overview.start,
        end: data.overview.end,
        rooms: String(roomsInRows(data.rows).length),
        fee: data.overview.fee,
        rows: data.rows,
        participants: people,
        at: Date.now(),
      });
      onSaved(list);
      setDone(already ? "上書きしました。" : "記録に残しました。");
      setStep("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  /** ボタンを押したとき。合言葉がまだなら聞く。 */
  function press() {
    setError("");
    setDone("");
    if (!unlocked && !isOfficerUnlocked()) {
      setStep("ask");
      return;
    }
    if (saved && step !== "confirm") {
      setStep("confirm");
      return;
    }
    void save();
  }

  /** 合言葉を入れ終えたとき。 */
  function submitPass(e: FormEvent) {
    e.preventDefault();
    if (!unlockOfficer(pass)) {
      setError("合言葉が違います。");
      setPass("");
      return;
    }
    setUnlocked(true);
    setPass("");
    setError("");
    if (saved) {
      setStep("confirm");
      return;
    }
    setStep("");
    void save();
  }

  const label = saved ? "上書きして残す" : "記録に残す";

  return (
    <section
      style={{
        border: `1px solid ${LINE}`,
        borderRadius: 10,
        background: "#FFFFFF",
        padding: "16px 18px 18px",
        marginTop: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", color: INK }}>
          この回を記録に残す
        </h3>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: DIM }}>役員用</span>
      </div>

      {blocked ? (
        <p style={{ margin: "10px 0 0", fontSize: 12.5, lineHeight: 1.9, color: SUB }}>{blocked}</p>
      ) : (
        <>
          <p style={{ margin: "10px 0 0", fontSize: 12.5, lineHeight: 1.9, color: SUB }}>
            {dateLabel(overview.date)}
            {overview.place ? `／${overview.place}` : ""}
            <br />
            {"当日の部屋割り "}
            <span style={{ fontWeight: 700, color: MARK, fontVariantNumeric: "tabular-nums" }}>{rows.length}</span>
            {"行・参加者 "}
            <span style={{ fontWeight: 700, color: MARK, fontVariantNumeric: "tabular-nums" }}>{people.length}</span>
            {"名を、下のアーカイブに残します。次の回の準備で当日の表を書き換えても消えません。"}
          </p>

          <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.8, color: DIM }}>
            {people.join("・")}
          </p>

          {extras.length > 0 && (
            <label
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                margin: "10px 0 0",
                fontSize: 12,
                lineHeight: 1.8,
                color: SUB,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={withExtras}
                onChange={(e) => setWithExtras(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                出欠では参加だが、部屋割りに名前が無い人（{extras.join("・")}）も参加者に入れる
              </span>
            </label>
          )}

          <div style={{ marginTop: 14 }}>
            <label
              htmlFor="as-note"
              style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: DIM }}
            >
              補足（アーカイブの見出しの下に出ます。直せます）
            </label>
            <textarea
              id="as-note"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setEdited(true);
              }}
              rows={3}
              className="as-note"
            />
          </div>

          {saved && (
            <p style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.8, color: SUB }}>
              この回はすでに記録にあります。押すと、いまの中身で上書きします。
            </p>
          )}

          {step === "ask" ? (
            <form onSubmit={submitPass} style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                value={pass}
                onChange={(e) => {
                  setPass(e.target.value);
                  setError("");
                }}
                placeholder="合言葉"
                aria-label="合言葉"
                maxLength={OFFICER_PASSCODE.length + 8}
                className="as-pass"
              />
              <button type="submit" className="as-go">
                確かめる
              </button>
              <button
                type="button"
                className="as-cancel"
                onClick={() => {
                  setStep("");
                  setPass("");
                  setError("");
                }}
              >
                やめる
              </button>
            </form>
          ) : (
            <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button type="button" className="as-go" onClick={press} disabled={busy}>
                {busy ? "保存中…" : step === "confirm" ? "もう一度押すと上書きします" : label}
              </button>
              {step === "confirm" && (
                <button type="button" className="as-cancel" onClick={() => setStep("")}>
                  やめる
                </button>
              )}
            </div>
          )}

          {error && (
            <p style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.8, color: "#B25A5A" }}>{error}</p>
          )}
          {done && (
            <p style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.8, color: MARK }}>{done}</p>
          )}
        </>
      )}
    </section>
  );
}
