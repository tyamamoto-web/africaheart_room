"use client";

/* ============================================================
   会員名簿の表（設定 ＞ 会員名簿。TOPと、管理画面 ＞ 社長室 の両方に出る）
   ------------------------------------------------------------
   線だけで組んだ表。面の色はほとんど使わず、グレーの罫線で区切る。
   列の見出しも、中身のマスも、そのまま手で打ち込んで直せる。

   【1列目は名前】
     1列目に入れた名前を、参加状況のチェックに使う（lib/attendance.ts）。
     2列目から先は自由に増やしてよい（ふりがな・誕生月など）。

   【名前の元】
     「プロフィールから入れる」は member_profiles（会員が自分で登録したもの）
     を元にする。lib/data.ts の defaultMembers ではない。
     あちらは部屋割りのために手で書いた一覧で、実際の登録者より少ない。

   【保存】（9/6 に自動保存へ変えた）
     打ち込むと自動で残る。ボタンを押す必要はない。
     置き場所は lib/roster.ts（新しいテーブルは作らず、共有テーブルの1行を間借りしている）。

     打つたびに送ると通信が多くなりすぎるので、打ち終わってから少し待って送る。
     待っている間に画面を離れるとき（設定の別の項目へ移る・タブを裏にする・ページを閉じる）は、
     待たずにその場で送る。それまでは「保存して全員に共有」を押さないと残らず、
     ページを移ると打ち込んだものが消えていた。

     読み込んでいる間はマスに打ち込めないようにしてある。
     読み終わる前に打てると、まだ空のままの表を保存してしまい、
     すでに入っていた名簿を消してしまうため。
   ============================================================ */

import { useCallback, useEffect, useRef, useState } from "react";
import { listProfiles } from "@/lib/profiles";
import { EMPTY_ROSTER, readRoster, saveRoster, type Roster } from "@/lib/roster";

const LINE = "#DFE1E4"; // 罫線
const HEAD = "#F4F5F6"; // 見出しの行だけ、ごくうすい面

const COL_MIN_W = 150;
const NUM_W = 48; // いちばん左の、行番号だけの列

/* 打ち終わってから送るまでの待ち時間。
   短くするほど取りこぼしにくいが、そのぶん通信が増える。 */
const SAVE_DELAY_MS = 800;

type Msg = { kind: "ok" | "ng"; text: string } | null;

/* 保存の様子。画面の下に1行で出す。 */
type SaveState =
  | { kind: "idle" }                    // まだ何も触っていない
  | { kind: "pending" }                 // 変更あり・まだ送っていない
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "error"; text: string };

function nowText(): string {
  return new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

export default function PresidentTable() {
  const [columns, setColumns] = useState<string[]>(EMPTY_ROSTER.columns);
  const [rows, setRows] = useState<string[][]>(EMPTY_ROSTER.rows);
  const [loading, setLoading] = useState(true);
  const [filling, setFilling] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });

  /* 自動保存のための控え（画面の描き直しをまたいで残す）。
     latest … いま表に出ている中身。送るときはここから取る
     dirty  … まだ送っていない変更があるか
     loaded … 保存してあるものを読み終えたか（読む前に送ると空で上書きしてしまう）
     alive  … この画面がまだ出ているか（閉じたあとに表示を触らないため） */
  const latest = useRef<Roster>({ columns: EMPTY_ROSTER.columns, rows: EMPTY_ROSTER.rows });
  const dirty = useRef(false);
  const loaded = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /* まだ送っていない変更を、いますぐ送る。
     控えだけを見て動くので、いつ呼んでも今の中身が送られる。 */
  const flush = useCallback(async () => {
    if (!loaded.current || !dirty.current) return;
    dirty.current = false;
    const body = latest.current;
    if (alive.current) setSave({ kind: "saving" });
    try {
      await saveRoster(body);
      if (alive.current) setSave({ kind: "saved", at: nowText() });
    } catch (e) {
      dirty.current = true; // 送れなかったぶんは、次のときにもう一度
      if (alive.current) {
        setSave({ kind: "error", text: e instanceof Error ? e.message : "保存に失敗しました" });
      }
    }
  }, []);

  /* 保存してあるものを読む。まだ何も無ければ空の表のまま。 */
  useEffect(() => {
    let on = true;
    readRoster()
      .then((r) => {
        if (!on || !r) return;
        setColumns(r.columns);
        setRows(r.rows);
      })
      .finally(() => {
        loaded.current = true;
        if (on) setLoading(false);
      });
    return () => {
      on = false;
    };
  }, []);

  /* 打ち終わってから少し待って送る。
     待っている間に次を打てば、そのたびに待ち直す（下の後始末で前の待ちを取り消す）。
     読み込みで入っただけのぶんは送らない（dirty が立っていない）。 */
  useEffect(() => {
    latest.current = { columns, rows };
    if (loading || !dirty.current) return;
    const t = setTimeout(() => {
      void flush();
    }, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [columns, rows, loading, flush]);

  /* 画面を離れるときは、待たずにその場で送る。
     ・設定の別の項目へ移った／別のページへ行った … この画面が閉じるので、下の後始末で送る
     ・タブを裏にした／アプリを閉じた           … visibilitychange・pagehide で送る
     ※ ブラウザごと閉じた瞬間だけは、送信が間に合わないことがある
       （そのぶん上の待ち時間を短くしてある）。 */
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onPageHide = () => {
      void flush();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
      void flush();
    };
  }, [flush]);

  /* 手を入れた印。これが立っている変更だけを送る。 */
  function touch() {
    dirty.current = true;
    setSave((s) => (s.kind === "pending" ? s : { kind: "pending" }));
  }

  function setColumn(i: number, v: string) {
    touch();
    setColumns((cs) => cs.map((c, n) => (n === i ? v : c)));
  }

  function setCell(r: number, c: number, v: string) {
    touch();
    setRows((rs) => rs.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row)));
  }

  function addRow() {
    touch();
    setRows((rs) => [...rs, Array(columns.length).fill("")]);
  }

  function addColumn() {
    touch();
    setColumns((cs) => [...cs, ""]);
    setRows((rs) => rs.map((r) => [...r, ""]));
  }

  /* プロフィールを登録している人の名前を、1列目に流し込む。
     元にするのは member_profiles（会員が自分で登録したもの）。
     lib/data.ts の一覧ではない。あちらは部屋割りのために手で書いたもので、
     いま実際に登録している人より少ない。
     いま入っている名前は消さず、まだ載っていないぶんだけ下に足す。 */
  async function fillFromProfiles() {
    setFilling(true);
    setMsg(null);
    try {
      const profiles = await listProfiles();
      const names = profiles.map((p) => p.name.trim()).filter(Boolean);

      /* 何名足すかは、ここで数えておく。
         setRows の中で数えると、知らせを出すときにはまだ入っていない
         （React は渡した関数をあとで走らせるため）。 */
      const have = new Set(rows.map((r) => (r[0] ?? "").trim()).filter(Boolean));
      const add = names.filter((n) => !have.has(n));

      if (add.length > 0) {
        touch();
        setRows((rs) => {
          const next = rs.slice();
          // まず空いている行を上から埋め、足りなければ行を足す
          for (const name of add) {
            // 読み込んでいる間に手で入れられたぶんも、二重にしない
            if (next.some((r) => (r[0] ?? "").trim() === name)) continue;
            const blank = next.findIndex((r) => (r[0] ?? "").trim() === "");
            if (blank >= 0) {
              next[blank] = next[blank].map((c, i) => (i === 0 ? name : c));
            } else {
              next.push([name, ...Array(Math.max(columns.length - 1, 0)).fill("")]);
            }
          }
          return next;
        });
      }

      setMsg(
        add.length === 0
          ? { kind: "ok", text: `登録している${names.length}名は、すべて名簿に載っています` }
          : { kind: "ok", text: `${add.length}名を足しました（登録者は全${names.length}名）` }
      );
    } catch (e) {
      setMsg({ kind: "ng", text: e instanceof Error ? e.message : "プロフィールの読み込みに失敗しました" });
    } finally {
      setFilling(false);
    }
  }

  /* 送れなかったときの「もう一度」。中身は自動保存と同じ道を通る。 */
  function retry() {
    dirty.current = true;
    void flush();
  }

  const saveText =
    loading ? "読み込んでいます"
    : save.kind === "saving" ? "保存しています"
    : save.kind === "pending" ? "まだ保存していません"
    : save.kind === "saved" ? `自動で保存しました（${save.at}）`
    : save.kind === "error" ? save.text
    : "打ち込むと自動で保存し、全員に共有されます";

  const nameCount = rows.filter((r) => (r[0] ?? "").trim() !== "").length;
  const cellStyle = { border: `1px solid ${LINE}`, padding: 0 } as const;

  return (
    <div style={{ padding: "28px 28px 40px" }}>

      {/* 横に長くなったときは、この枠の中だけが横に動く */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: columns.length * COL_MIN_W + NUM_W }}>
          <thead>
            <tr>
              {/* 行番号の列の、見出しのところ。数えるためだけの列なので中身は空。 */}
              <th
                scope="col"
                style={{ ...cellStyle, background: HEAD, width: NUM_W, minWidth: NUM_W }}
              >
                <span className="sr-only">番号</span>
              </th>
              {columns.map((c, i) => (
                <th key={i} scope="col" style={{ ...cellStyle, background: HEAD, minWidth: COL_MIN_W }}>
                  <input
                    className="pr-cell pr-cell--head"
                    value={c}
                    onChange={(e) => setColumn(i, e.target.value)}
                    readOnly={loading}
                    placeholder="列名"
                    aria-label={`${i + 1}列目の見出し`}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {/* 何人目かが目で数えられるように。打ち込む場所ではないので入力欄にしない。
                    列の数には入れない（名前はこれまで通り、その右の1列目のまま）。 */}
                <th
                  scope="row"
                  style={{
                    ...cellStyle,
                    background: HEAD,
                    width: NUM_W,
                    minWidth: NUM_W,
                    padding: "0 8px",
                    textAlign: "right",
                    fontSize: 13,
                    fontWeight: 400,
                    color: "#8B8E94",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {ri + 1}
                </th>
                {row.map((cell, ci) => (
                  <td key={ci} style={cellStyle}>
                    <input
                      className="pr-cell"
                      value={cell}
                      onChange={(e) => setCell(ri, ci, e.target.value)}
                      readOnly={loading}
                      aria-label={`${ri + 1}行${ci + 1}列`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="pr-addbtn" onClick={addRow} disabled={loading}>行を追加</button>
        <button type="button" className="pr-addbtn" onClick={addColumn} disabled={loading}>列を追加</button>
        <button type="button" className="pr-addbtn" onClick={fillFromProfiles} disabled={filling || loading}>
          {filling ? "読み込んでいます" : "プロフィールから入れる"}
        </button>
        {/* 送れなかったときだけ出す。うまくいっている間は、押すものを置かない。 */}
        {save.kind === "error" && (
          <button type="button" className="pr-addbtn" onClick={retry}>もう一度保存する</button>
        )}
      </div>

      <p style={{ margin: "14px 0 0", fontSize: 13, lineHeight: 1.9, color: "#8B8E94" }}>
        1列目に入れた名前を、参加状況のチェックに使います（いま{nameCount}名）。
      </p>
      <p
        aria-live="polite"
        style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.9, color: save.kind === "error" ? "#B24809" : "#8B8E94" }}
      >
        {saveText}
      </p>
      {msg && (
        <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.9, color: msg.kind === "ok" ? "#63666C" : "#B24809" }}>
          {msg.text}
        </p>
      )}

    </div>
  );
}
