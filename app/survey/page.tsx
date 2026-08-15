"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { nextEvent } from "@/lib/data";
import { OFFICER_UNLOCK_KEY, isOfficerUnlocked, unlockOfficer, lockOfficer } from "@/lib/officerGate";
import {
  SURVEY_QUESTIONS, getSurveyAnswers, saveSurveyAnswer, deleteSurveyAnswer,
  surveyDeviceId, emptyValues, missingRequired, answerText, AGREED, estimateFee, yenText,
  type SurveyAnswer, type SurveyValue,
} from "@/lib/survey";

/* ============================================================
   参加者アンケート
   ------------------------------------------------------------
   参加する方に、事前の確認と運営からのお願いへ答えてもらうページ。
   答えは全員ぶんが集まり、運営だけが一覧で見られる。

   画面は2つ。
     回答する　　：参加する方が自分の答えを書く（だれでも入れる）
     みんなの回答：運営が全員の答えを見る（合言葉が要る）
   「みんなの回答」に合言葉を掛けているのは、体調や連絡先など、
   人に見られたくない答えが混じりうるため。合言葉は役員専用タブと共通（lib/officerGate.ts）。

   回答はこの端末に紐づく（lib/survey.ts の端末id）。一度出したあとでも書き換えられ、
   何度出しても一覧に増えない。保存先は共有テーブルの id=9（lib/sharedRow.ts）。

   ※ 設問は指示があったものだけ。ここで勝手に足さないこと（設問一覧は lib/survey.ts）。
   ※ 以前このURL（/manual）にあったイベント運営マニュアルは役目を終えた。
     やること320件と2日前のLINE文面の下書きは lib/eventTasks.ts に残してある。
   ※ 絵文字は使わない（アプリ全体の方針）。
   ============================================================ */

// 白を地に、濃さの違う灰だけで組む（役員専用2の表と同じ配色）。
const S = {
  paper: "#ffffff",
  soft: "#faf9f6", // ひとつ沈んだ白
  band: "#f2f0eb", // 帯
  hair: "#e6e3dc", // 細い罫
  rule: "#cbc7be", // 外枠・区切り
  ink: "#33302a", // 本文・見出し
  sub: "#57544d",
  cap: "#6b6860", // 添え書き
  faint: "#8a867d",
  warn: "#7a5a2e",
};

const PAGE_CSS = `
.svy input:hover, .svy textarea:hover { background:${S.soft}; }
.svy input:focus, .svy textarea:focus {
  background:${S.paper}; border-color:${S.cap}; box-shadow:0 0 0 3px rgba(51,48,42,0.10);
}
.svy .primary:hover:not(:disabled) { background:#4a463e; }
.svy .quiet:hover { color:${S.ink}; }
.svy .check:hover { background:${S.soft}; }
`;

type View = "answer" | "results";

// 「8/14 19:52」の形にする（見るのは運営だけなので、年は出さない）
function shortTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function SurveyPage() {
  const [view, setView] = useState<View>("answer");

  return (
    <main className="svy min-h-screen pb-16" style={{ background: S.paper }}>
      <style>{PAGE_CSS}</style>

      {/* 上部バー */}
      <div
        className="sticky top-0 z-50 px-4 py-3 flex items-center gap-3"
        style={{ background: S.paper, borderBottom: `1px solid ${S.hair}` }}
      >
        <Link
          href="/"
          className="text-xs font-bold px-3 py-2 rounded"
          style={{ color: S.cap, border: `1px solid ${S.hair}`, letterSpacing: "0.04em" }}
        >
          ← 戻る
        </Link>
        <h1 className="text-sm font-black" style={{ color: S.ink, letterSpacing: "0.02em" }}>
          参加者アンケート
        </h1>
      </div>

      <div className="px-4 pt-4 max-w-xl mx-auto">
        {/* どのイベントについての回答か */}
        <div style={{ borderLeft: `2px solid ${S.rule}`, paddingLeft: 12 }}>
          <p className="text-[13px] font-black" style={{ color: S.ink, letterSpacing: "0.02em" }}>
            {nextEvent.title}
          </p>
          <p className="text-[11px] mt-1" style={{ color: S.cap, letterSpacing: "0.02em" }}>
            {nextEvent.date}　{nextEvent.timeRange}　{nextEvent.place}
          </p>
        </div>

        {/* 画面の切り替え */}
        <div
          className="flex mt-5"
          style={{ border: `1px solid ${S.hair}`, borderRadius: 4, overflow: "hidden" }}
        >
          {([
            { key: "answer", label: "回答する" },
            { key: "results", label: "みんなの回答" },
          ] as { key: View; label: string }[]).map((t) => {
            const on = view === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setView(t.key)}
                className="flex-1 text-[11px] font-bold"
                style={{
                  padding: "9px 8px",
                  letterSpacing: "0.04em",
                  background: on ? S.ink : S.paper,
                  color: on ? S.paper : S.cap,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {view === "answer" ? <AnswerView /> : <ResultsView />}
      </div>
    </main>
  );
}

/* ── 回答する（参加する方の画面）───────────────────────────── */
function AnswerView() {
  const [values, setValues] = useState<Record<string, SurveyValue>>(emptyValues);
  const [deviceId, setDeviceId] = useState("");
  const [sent, setSent] = useState(false); // すでに出したことがあるか
  const [dirty, setDirty] = useState(false); // 出したあとに書き換えたか
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const feeRef = useRef<HTMLDivElement | null>(null);

  // 自分が前に出した回答があれば読み込んで、書き換えられるようにする
  useEffect(() => {
    let alive = true;
    const id = surveyDeviceId();
    setDeviceId(id);
    (async () => {
      const all = await getSurveyAnswers();
      if (!alive) return;
      const mine = all.find((a) => a.id === id);
      if (mine) {
        setValues(mine.values);
        setSent(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function change(qid: string, v: SurveyValue) {
    setValues((prev) => ({ ...prev, [qid]: v }));
    setDirty(true);
    setMissing((m) => m.filter((x) => x !== qid));
  }

  // チェックの入り切り。選択肢の並び順は lib/survey.ts 側でそろえるので、ここでは足し引きだけ。
  function toggle(qid: string, value: string) {
    const cur = values[qid];
    const list = Array.isArray(cur) ? cur : [];
    change(qid, list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  async function submit() {
    const lack = missingRequired(values);
    if (lack.length > 0) {
      setMissing(lack.map((q) => q.id));
      setErr(null);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await saveSurveyAnswer(deviceId, values);
      setSent(true);
      setDirty(false);
      // 送ったあとに出る参加費は、長い設問の下に隠れる。自分から見せに行く。
      requestAnimationFrame(() => feeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!window.confirm("この端末から出した回答を取り下げます。運営の一覧からも消えます。よろしいですか。")) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteSurveyAnswer(deviceId);
      setValues(emptyValues());
      setSent(false);
      setDirty(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "取り下げに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  // 参加費は回答から自動で出す（計算は lib/survey.ts、金額の出どころは lib/data.ts の予定表）
  const fee = estimateFee(values);
  const picksCourse = fee.lines.some((l) => !!l.note); // 焼肉のように当日えらぶ会場に参加するか

  return (
    <div className="mt-5">
      {SURVEY_QUESTIONS.map((q, i) => {
        const lacking = missing.includes(q.id);
        return (
          <div key={q.id} className="mb-5">
            <label
              htmlFor={`sv-${q.id}`}
              className="block text-[12px] font-bold"
              style={{ color: S.ink, lineHeight: 1.6 }}
            >
              <span style={{ color: S.faint, marginRight: 8, fontVariantNumeric: "tabular-nums" }}>
                Q{i + 1}
              </span>
              {q.label}
            </label>
            {q.kind === "text" ? (
              <input
                id={`sv-${q.id}`}
                type="text"
                value={typeof values[q.id] === "string" ? (values[q.id] as string) : ""}
                maxLength={q.max}
                onChange={(e) => change(q.id, e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 8,
                  border: `1px solid ${lacking ? S.warn : S.rule}`,
                  borderRadius: 3,
                  background: S.paper,
                  color: S.ink,
                  fontSize: 14,
                  padding: "10px 12px",
                  outline: "none",
                  fontFamily: "inherit",
                  transition: "background .12s, border-color .12s, box-shadow .12s",
                }}
              />
            ) : q.kind === "agree" ? (
              <>
                {/* 読んでもらう確認事項。長いので、見出しごとに細い罫で区切る。 */}
                <div
                  style={{
                    marginTop: 8,
                    border: `1px solid ${S.rule}`,
                    borderRadius: 3,
                    background: S.paper,
                    overflow: "hidden",
                  }}
                >
                  {q.notices.map((n, ni) => (
                    <div
                      key={n.title}
                      style={{ padding: "13px 12px 14px", borderTop: ni === 0 ? "none" : `1px solid ${S.hair}` }}
                    >
                      <p className="text-[10.5px] font-bold" style={{ color: S.cap, letterSpacing: "0.1em" }}>
                        {n.title}
                      </p>
                      <ul style={{ marginTop: 7, display: "flex", flexDirection: "column", gap: 6 }}>
                        {n.lines.map((line, li) => (
                          <li
                            key={li}
                            style={{
                              fontSize: 12.5,
                              color: S.ink,
                              lineHeight: 1.75,
                              paddingLeft: 13,
                              textIndent: -13,
                            }}
                          >
                            <span style={{ color: S.faint }}>・</span>
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {/* 了承のチェック。1つだけ。 */}
                {(() => {
                  const on = values[q.id] === AGREED;
                  return (
                    <label
                      className="check flex items-center gap-3"
                      style={{
                        marginTop: 8,
                        border: `1px solid ${lacking ? S.warn : S.rule}`,
                        borderRadius: 3,
                        padding: "13px 12px",
                        background: on ? S.soft : S.paper,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => change(q.id, on ? "" : AGREED)}
                        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                      />
                      <span
                        aria-hidden
                        className="flex items-center justify-center"
                        style={{
                          width: 17,
                          height: 17,
                          flex: "0 0 auto",
                          borderRadius: 3,
                          border: `1px solid ${on ? S.ink : S.rule}`,
                          background: on ? S.ink : S.paper,
                          color: S.paper,
                          fontSize: 11,
                          lineHeight: 1,
                        }}
                      >
                        {on ? "✓" : ""}
                      </span>
                      <span
                        style={{ fontSize: 13, fontWeight: 700, color: S.ink, letterSpacing: "0.01em", lineHeight: 1.5 }}
                      >
                        {q.confirmLabel}
                      </span>
                    </label>
                  );
                })()}
              </>
            ) : (
              <div
                style={{
                  marginTop: 8,
                  border: `1px solid ${lacking ? S.warn : S.rule}`,
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                {q.options.map((o, oi) => {
                  // checks は「あてはまるものすべて」、choice は「どれか1つ」。印の形も四角と丸で変える。
                  const many = q.kind === "checks";
                  const cur = values[q.id];
                  const on = many ? Array.isArray(cur) && cur.includes(o.value) : cur === o.value;
                  return (
                    <label
                      key={o.value}
                      className="check flex items-center gap-3"
                      style={{
                        padding: "12px 12px",
                        borderTop: oi === 0 ? "none" : `1px solid ${S.hair}`,
                        background: on ? S.soft : S.paper,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type={many ? "checkbox" : "radio"}
                        name={`sv-${q.id}`}
                        checked={on}
                        onChange={() => (many ? toggle(q.id, o.value) : change(q.id, o.value))}
                        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                      />
                      {/* 印は自分で描く（環境ごとの見た目の差をなくす） */}
                      <span
                        aria-hidden
                        className="flex items-center justify-center"
                        style={{
                          width: 17,
                          height: 17,
                          flex: "0 0 auto",
                          borderRadius: many ? 3 : 999,
                          border: `1px solid ${on ? S.ink : S.rule}`,
                          background: many && on ? S.ink : S.paper,
                          color: S.paper,
                          fontSize: 11,
                          lineHeight: 1,
                        }}
                      >
                        {many ? (
                          on ? "✓" : ""
                        ) : on ? (
                          <span style={{ width: 9, height: 9, borderRadius: 999, background: S.ink }} />
                        ) : null}
                      </span>
                      <span style={{ fontSize: 13, color: S.ink, letterSpacing: "0.01em", lineHeight: 1.5 }}>
                        {o.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            {lacking && (
              <p className="text-[11px] mt-1.5" style={{ color: S.warn }}>
                {q.kind === "checks"
                  ? "1つ以上えらんでください。"
                  : q.kind === "choice"
                    ? "どれか1つをえらんでください。"
                    : q.kind === "agree"
                      ? "内容をご確認のうえ、チェックを入れてください。"
                      : "こちらは必ず入れてください。"}
              </p>
            )}
          </div>
        );
      })}

      <button
        onClick={submit}
        disabled={busy || (sent && !dirty)}
        className="primary w-full text-[12px] font-bold"
        style={{
          background: busy || (sent && !dirty) ? S.band : S.ink,
          color: busy || (sent && !dirty) ? S.faint : S.paper,
          border: "none",
          borderRadius: 3,
          padding: "12px 16px",
          letterSpacing: "0.04em",
          cursor: busy || (sent && !dirty) ? "default" : "pointer",
          transition: "background .12s",
        }}
      >
        {busy ? "送っています" : sent ? (dirty ? "回答を更新する" : "回答ずみ") : "回答を送る"}
      </button>

      {err && (
        <p className="text-[11px] mt-2" style={{ color: S.warn }}>
          {err}
        </p>
      )}

      {sent && !dirty && !err && (
        <p className="text-[11px] mt-2 leading-relaxed" style={{ color: S.cap }}>
          回答を受け取りました。締め切りまでは、この画面でいつでも書き換えられます。
        </p>
      )}

      {/* 回答から出した参加費。集金の場でもめないよう、内訳を出してから合計を見せる。 */}
      {sent && (
        <div
          ref={feeRef}
          className="mt-4"
          style={{ border: `1px solid ${S.rule}`, borderRadius: 3, overflow: "hidden", background: S.paper }}
        >
          <div style={{ background: S.band, padding: "9px 12px", borderBottom: `1px solid ${S.hair}` }}>
            <p className="text-[10.5px] font-bold" style={{ color: S.cap, letterSpacing: "0.1em" }}>
              あなたの参加費（目安）
            </p>
          </div>
          <div style={{ padding: "4px 12px 14px" }}>
            {fee.lines.map((l, li) => (
              <div
                key={l.label}
                className="flex items-baseline justify-between"
                style={{ padding: "9px 0", borderTop: li === 0 ? "none" : `1px solid ${S.hair}` }}
              >
                <span style={{ fontSize: 12.5, color: S.ink }}>
                  {l.label}
                  {l.note && (
                    <span style={{ fontSize: 11, color: S.faint, marginLeft: 7 }}>{l.note}</span>
                  )}
                </span>
                <span
                  style={{
                    fontSize: 12.5,
                    color: l.yen === 0 ? S.faint : S.ink,
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                    paddingLeft: 10,
                  }}
                >
                  {yenText(l.yen)}
                </span>
              </div>
            ))}
            <div
              className="flex items-baseline justify-between"
              style={{ marginTop: 3, paddingTop: 10, borderTop: `2px solid ${S.ink}` }}
            >
              <span className="font-bold" style={{ fontSize: 11.5, color: S.cap, letterSpacing: "0.08em" }}>
                合計
              </span>
              <span className="font-black" style={{ fontSize: 22, color: S.ink, fontVariantNumeric: "tabular-nums" }}>
                {fee.total.toLocaleString("ja-JP")}
                <span style={{ fontSize: 12, marginLeft: 2 }}>円</span>
              </span>
            </div>

            <p className="text-[11px] mt-3 leading-relaxed" style={{ color: S.cap }}>
              集合のときに、この金額を会計のくるちゃんへお渡しください。お釣りのないようにご用意いただけると助かります。
            </p>
            {picksCourse && (
              <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: S.cap }}>
                焼肉のコースは当日えらびます。上と違うほうをえらんだ場合は、その場で差額600円をやり取りします。
              </p>
            )}
            <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: S.cap }}>
              コンビニでの買い物代と、ミルユッテでの追加注文は、この金額とは別に手元にご用意ください。
            </p>
            <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: S.faint }}>
              あくまで目安です。確定した金額は8月21日にお知らせします。
              {dirty ? "いまは書きかえ中の内容で計算しています。" : ""}
            </p>
          </div>
        </div>
      )}

      {sent && (
        <button
          onClick={withdraw}
          disabled={busy}
          className="quiet mt-4 text-[11px] underline"
          style={{ color: S.faint, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          回答を取り下げる
        </button>
      )}
    </div>
  );
}

/* ── みんなの回答（運営の画面。合言葉が要る）───────────────────── */
function ResultsView() {
  const [unlocked, setUnlocked] = useState(false);
  const [pass, setPass] = useState("");
  const [passError, setPassError] = useState(false);
  const [answers, setAnswers] = useState<SurveyAnswer[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setUnlocked(isOfficerUnlocked());
  }, []);

  // 開いているあいだは、ほかの人の回答を取り込み続ける（約8秒ごと）。
  // 「まだ画面が在るか」の目印はこの中で持つ。外に置くと、画面が作り直されたときに
  // 消えたままになって二度と読み込まなくなる。
  useEffect(() => {
    if (!unlocked) return;
    let on = true;
    const load = async () => {
      const list = await getSurveyAnswers();
      if (!on) return;
      setAnswers(list);
      setLoaded(true);
    };
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => {
      on = false;
      clearInterval(t);
    };
  }, [unlocked]);

  function submitPasscode(e: React.FormEvent) {
    e.preventDefault();
    if (!unlockOfficer(pass)) {
      setPassError(true);
      setPass("");
      return;
    }
    setUnlocked(true);
    setPassError(false);
    setPass("");
  }

  if (!unlocked) {
    return (
      <div
        className="mt-4"
        style={{ border: `1px solid ${S.hair}`, borderRadius: 4, padding: "20px 18px", background: S.soft }}
      >
        <p className="text-[10px] font-bold" style={{ color: S.faint, letterSpacing: "0.16em" }}>
          OFFICER
        </p>
        <p className="text-[13px] font-black mt-2" style={{ color: S.ink }}>
          合言葉を入れてください
        </p>
        <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: S.cap }}>
          ここから先は運営だけが見る画面です。人に見られたくない答えが混じることがあるため、合言葉を掛けています。
        </p>
        <form onSubmit={submitPasscode} className="flex gap-2 mt-3">
          <input
            type="password"
            inputMode="numeric"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            aria-label="合言葉"
            className="flex-1"
            style={{
              border: `1px solid ${S.rule}`,
              borderRadius: 3,
              background: S.paper,
              color: S.ink,
              fontSize: 13,
              padding: "9px 10px",
              outline: "none",
              letterSpacing: "0.3em",
              fontFamily: "inherit",
            }}
          />
          <button
            type="submit"
            className="text-[11px] font-bold"
            style={{
              background: S.ink,
              color: S.paper,
              border: "none",
              borderRadius: 3,
              padding: "9px 20px",
              letterSpacing: "0.04em",
              cursor: "pointer",
            }}
          >
            開く
          </button>
        </form>
        {passError && (
          <p className="text-[11px] mt-2" style={{ color: S.warn }}>
            合言葉が違います。もう一度入れてください。
          </p>
        )}
        <p className="text-[10px] mt-3 leading-relaxed" style={{ color: S.faint }}>
          一度入れると、このタブを閉じるまで聞き直しません（{OFFICER_UNLOCK_KEY} に保存）。
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-[11px]" style={{ color: S.cap, letterSpacing: "0.02em" }}>
        {!loaded ? "読み込んでいます" : `${answers.length}人が回答しています`}
      </p>

      {loaded && answers.length === 0 ? (
        <div
          className="mt-3 text-center"
          style={{ border: `1px dashed ${S.rule}`, borderRadius: 4, padding: "34px 20px", background: S.soft }}
        >
          <p className="text-[12px] font-bold" style={{ color: S.sub }}>
            まだ回答はありません
          </p>
        </div>
      ) : (
        <div
          className="mt-3"
          style={{ border: `1px solid ${S.rule}`, borderRadius: 4, overflowX: "auto", background: S.paper }}
        >
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <colgroup>
              <col style={{ width: 34 }} />
              {SURVEY_QUESTIONS.map((q) => (
                <col key={q.id} />
              ))}
              <col style={{ width: 88 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "center", padding: "10px 0 8px", background: S.band }}>No</th>
                {SURVEY_QUESTIONS.map((q, i) => (
                  <th key={q.id} style={th}>
                    Q{i + 1}　{q.label}
                  </th>
                ))}
                <th style={{ ...th, textAlign: "right" }}>回答した時刻</th>
              </tr>
            </thead>
            <tbody>
              {answers.map((a, i) => (
                <tr key={a.id}>
                  <td
                    style={{
                      ...td,
                      textAlign: "center",
                      background: S.band,
                      color: S.sub,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {i + 1}
                  </td>
                  {SURVEY_QUESTIONS.map((q) => (
                    <td key={q.id} style={{ ...td, color: S.ink }}>
                      {answerText(q, a.values[q.id]) || "—"}
                    </td>
                  ))}
                  <td style={{ ...td, textAlign: "right", color: S.faint, fontVariantNumeric: "tabular-nums" }}>
                    {shortTime(a.at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        onClick={() => {
          lockOfficer();
          setUnlocked(false);
        }}
        className="quiet mt-4 text-[11px] underline"
        style={{ color: S.faint, background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        合言葉の入力に戻す
      </button>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 10px 8px",
  borderBottom: `2px solid ${S.ink}`,
  fontSize: 10.5,
  fontWeight: 700,
  color: S.cap,
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "10px 10px",
  borderBottom: `1px solid ${S.hair}`,
  fontSize: 12.5,
  verticalAlign: "top",
};
