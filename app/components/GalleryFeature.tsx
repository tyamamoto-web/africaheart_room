"use client";

/* ============================================================
   ギャラリー：当日の写真・動画を見る／保存する／（運営は）入れる
   ------------------------------------------------------------
   ・見るのは誰でも。入れる・消すのは合言葉（役員）のうしろ。
   ・並びは撮影シーンごと（lib/eventRound.ts が回ごとに持つ SCENES＝その日の進行）。
   ・上の行で回を選べる。前の回は見るだけで、追加はいまの回にしかできない。
   ・一覧は小さい画像（thumbs/）を読む。原寸は拡げたときだけ読む。
   ・色はグレーだけにして、写真そのものが主役になるようにしている。
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent as RDragEvent } from "react";
import {
  listGalleryFor,
  uploadToGallery,
  deleteFromGallery,
  GallerySetupError,
  GALLERY_EVENT,
  SCENES,
  sceneLabel,
  type GalleryItem,
} from "@/lib/gallery";
import { ROUNDS, CURRENT_ROUND, roundWhen } from "@/lib/eventRound";
import { readVoiceBoard, type Voice, type Reply } from "@/lib/voices";

/** その1件がどの回のものか。置き場所は <回>/<シーン>/<名前> なので、先頭を見る。 */
function roundKeyOf(item: GalleryItem): string {
  return item.path.split("/")[0] || GALLERY_EVENT;
}
import {
  prepareFile,
  isVideoFile,
  probeVideoCodec,
  downloadFile,
  humanSize,
  isIOS,
  MAX_UPLOAD_BYTES,
  type VideoCodec,
} from "@/lib/media";
import { isOfficerUnlocked, unlockOfficer } from "@/lib/officerGate";

/* ── 色（グレーだけ）──────────────────────────── */
const INK = "#2c2c2a"; // 濃い文字・押せるもの
const SUB = "#5f5e5a"; // ふつうの文字
const DIM = "#8d8b84"; // 補足
const LINE = "#e3e0d9"; // 罫線
const FACE = "#f3f1ec"; // 面
const TILE = "#e7e4dc"; // 写真の下地

type Filter = "all" | "photo" | "video";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "すべて" },
  { id: "photo", label: "写真" },
  { id: "video", label: "動画" },
];

function PlayMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="rgba(44,44,42,0.55)" />
      <path d="M9.5 7.5 L17 12 L9.5 16.5 Z" fill="#fff" />
    </svg>
  );
}

function errText(e: unknown): string {
  if (e instanceof GallerySetupError) return e.message;
  return e instanceof Error ? e.message : "うまくいきませんでした";
}

/* ── サムネイル1枚 ────────────────────────────── */
function Tile({
  item,
  selected,
  selecting,
  onClick,
}: {
  item: GalleryItem;
  selected: boolean;
  selecting: boolean;
  onClick: () => void;
}) {
  // 小さい画像がまだ無い（作れなかった）とき、写真は原寸に落とす。
  // 動画の原寸は動画ファイルなので <img> では描けない（落とすと無駄に読むだけ）。
  const [src, setSrc] = useState(item.thumbUrl);
  const [dead, setDead] = useState(false);
  useEffect(() => {
    setSrc(item.thumbUrl);
    setDead(false);
  }, [item.thumbUrl]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full aspect-square overflow-hidden"
      style={{
        background: TILE,
        borderRadius: 3,
        outline: selected ? `2px solid ${INK}` : "none",
        outlineOffset: -2,
      }}
      aria-label={item.kind === "video" ? "動画を開く" : "写真を開く"}
    >
      {!dead && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
          onError={() => {
            if (item.kind === "photo" && src === item.thumbUrl) setSrc(item.url);
            else setDead(true);
          }}
        />
      )}
      {item.kind === "video" && (
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <PlayMark />
        </span>
      )}
      {selecting && (
        <span
          className="absolute right-1 top-1 flex items-center justify-center"
          style={{
            width: 18,
            height: 18,
            borderRadius: 999,
            border: `1.5px solid ${selected ? INK : "#fff"}`,
            background: selected ? INK : "rgba(44,44,42,0.18)",
          }}
        >
          {selected && (
            <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12.5 L9.5 18 L20 6.5" stroke="#fff" strokeWidth="3.4" fill="none" />
            </svg>
          )}
        </span>
      )}
    </button>
  );
}

/* ── 拡げて見る ───────────────────────────────── */
function Lightbox({
  items,
  index,
  canDelete,
  onIndex,
  onClose,
  onDeleted,
}: {
  items: GalleryItem[];
  index: number;
  canDelete: boolean;
  onIndex: (i: number) => void;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const item = items[index];
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [playFailed, setPlayFailed] = useState(false);
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (d: number) => {
      const n = index + d;
      if (n >= 0 && n < items.length) onIndex(n);
    },
    [index, items.length, onIndex]
  );

  // 開いているあいだは後ろの一覧が動かないようにする
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    setPlayFailed(false);
    setMsg("");
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  if (!item) return null;

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const ext = item.name.split(".").pop() || "jpg";
      await downloadFile(item.url, `africaheart-${roundKeyOf(item)}-${item.sceneId}-${index + 1}.${ext}`);
      setMsg(isIOS() ? "「ファイル」アプリに保存しました" : "保存しました");
    } catch (e) {
      setMsg(errText(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("この1件を消します。元に戻せません。")) return;
    try {
      await deleteFromGallery(item);
      onDeleted();
    } catch (e) {
      setMsg(errText(e));
    }
  }

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: "#1f1f1e", zIndex: 100 }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start == null || end == null) return;
        if (Math.abs(end - start) > 48) go(end < start ? 1 : -1);
      }}
    >
      {/* 上の帯 */}
      <div className="flex items-center justify-between px-3 py-3 shrink-0">
        <button type="button" onClick={onClose} className="p-2 -m-2" aria-label="閉じる">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 5 L19 19 M19 5 L5 19" stroke="#d3d1c7" strokeWidth="2" fill="none" />
          </svg>
        </button>
        <p className="text-xs" style={{ color: "#d3d1c7" }}>
          {sceneLabel(item.sceneId, roundKeyOf(item))}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="p-2 -m-2"
          aria-label="この端末に保存"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3 L12 15 M6.5 10 L12 15.5 L17.5 10 M4 19.5 L20 19.5" stroke="#d3d1c7" strokeWidth="2" fill="none" />
          </svg>
        </button>
      </div>

      {/* 中身 */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center px-2">
        {index > 0 && (
          <button type="button" onClick={() => go(-1)} className="absolute left-1 p-3" aria-label="前へ">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 4 L7 12 L15 20" stroke="#b4b2a9" strokeWidth="2" fill="none" />
            </svg>
          </button>
        )}
        {item.kind === "video" ? (
          playFailed ? (
            <div className="text-center px-6">
              <p className="text-sm" style={{ color: "#d3d1c7" }}>この端末では再生できない形式です</p>
              <p className="text-xs mt-2 leading-relaxed" style={{ color: "#8d8b84" }}>
                保存してから、端末の動画アプリで再生してください。
              </p>
            </div>
          ) : (
            <video
              key={item.path}
              src={item.url}
              poster={item.thumbUrl}
              controls
              playsInline
              preload="metadata"
              className="max-w-full"
              style={{ maxHeight: "70vh" }}
              onError={() => setPlayFailed(true)}
            />
          )
        ) : (
          <img
            key={item.path}
            src={item.url}
            alt=""
            className="max-w-full object-contain"
            style={{ maxHeight: "70vh" }}
          />
        )}
        {index < items.length - 1 && (
          <button type="button" onClick={() => go(1)} className="absolute right-1 p-3" aria-label="次へ">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 4 L17 12 L9 20" stroke="#b4b2a9" strokeWidth="2" fill="none" />
            </svg>
          </button>
        )}
      </div>

      {/* 下の帯 */}
      <div className="px-4 pb-6 pt-3 shrink-0">
        <div className="flex items-center justify-between text-xs" style={{ color: "#8d8b84" }}>
          <span>{item.takenAt ? new Date(item.takenAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</span>
          <span>{index + 1} / {items.length}</span>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full mt-3 py-2.5 text-sm font-bold"
          style={{ background: "#f1efe8", color: INK, borderRadius: 8, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "保存中…" : item.kind === "video" ? "この動画を保存" : "この写真を保存"}
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={remove}
            className="w-full mt-2 py-2 text-xs"
            style={{ color: "#8d8b84" }}
          >
            この1件を消す（運営）
          </button>
        )}
        {msg && <p className="text-xs text-center mt-2" style={{ color: "#d3d1c7" }}>{msg}</p>}
      </div>
    </div>
  );
}

/* ── 運営：入れる ─────────────────────────────── */
type PendStatus = "checking" | "ready" | "toobig" | "uploading" | "done" | "error";
type Pending = {
  key: string;
  file: File;
  kind: "photo" | "video";
  codec?: VideoCodec;
  status: PendStatus;
  progress: number;
  note: string;
};

const STATUS_LABEL: Record<PendStatus, string> = {
  checking: "確認中",
  ready: "待機",
  toobig: "大きすぎ",
  uploading: "",
  done: "完了",
  error: "失敗",
};

function UploadPanel({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState("");
  const [scene, setScene] = useState(SCENES[0]?.id ?? "other");
  const [pend, setPend] = useState<Pending[]>([]);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState("");
  // 「選ぶ」を押してから、端末がファイルを渡してくるまでのあいだ
  const [picking, setPicking] = useState(false);
  // 待っても渡ってこなかった（＝端末側で止まっている）
  const [stuck, setStuck] = useState(false);
  // マウスのある画面か（＝パソコン）。ドラッグの案内を出すかどうかに使う。
  const [canDrop, setCanDrop] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const waitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setUnlocked(isOfficerUnlocked());
    setCanDrop(
      typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(hover: hover) and (pointer: fine)").matches
    );
  }, []);

  /* ── 端末が動画を渡せずに止まるのを、画面に出す ──────────────
     スマホは、写真アプリの動画をブラウザに渡すとき、いったん丸ごと
     書き出す。30分の動画は1〜2GBあるので、ここで数分かかるか、
     本体の空きが足りずに無言で失敗する。どちらも見た目は
     「押しても何も起きない」で区別がつかないので、
     ・待っているあいだは「書き出し中」と言う
     ・0件で戻ってきた／待っても来ないときは、直し方を出す
     の2つを出す。合言葉やアップロードの処理には触らない。 */
  const stopWaiting = useCallback(() => {
    if (waitTimer.current) {
      clearTimeout(waitTimer.current);
      waitTimer.current = null;
    }
    setPicking(false);
  }, []);

  const openPicker = useCallback(() => {
    setStuck(false);
    setPicking(true);
    if (waitTimer.current) clearTimeout(waitTimer.current);
    // 2分半。大きい動画の書き出しは本当に数分かかるので、短くしすぎない。
    waitTimer.current = setTimeout(() => {
      waitTimer.current = null;
      setPicking(false);
      setStuck(true);
    }, 150_000);
    fileRef.current?.click();
  }, []);

  // 自分で「キャンセル」して閉じたときは、失敗ではないので何も出さない。
  useEffect(() => {
    const el = fileRef.current;
    if (!el) return;
    const onCancel = () => stopWaiting();
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [stopWaiting, unlocked]);

  useEffect(
    () => () => {
      if (waitTimer.current) clearTimeout(waitTimer.current);
    },
    []
  );

  // パソコンから落とされたぶん。写真アプリの書き出しを通っているので、
  // ここに来る動画は「渡せずに止まる」ことがない。
  function onDrop(e: RDragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setDragOver(false);
    stopWaiting();
    setStuck(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) void onPick(files);
  }

  /* 並んでいるものの、いまの中身。
     追加の途中は何分も待つので、そのあいだに増えたぶんも拾えるように、
     画面の state とは別に「いまの一覧」を持っておく（state は次の描画まで古いまま）。 */
  const pendRef = useRef<Pending[]>([]);
  const editPend = useCallback((fn: (prev: Pending[]) => Pending[]) => {
    pendRef.current = fn(pendRef.current);
    setPend(pendRef.current);
  }, []);
  const patch = useCallback(
    (key: string, next: Partial<Pending>) => {
      editPend((prev) => prev.map((p) => (p.key === key ? { ...p, ...next } : p)));
    },
    [editPend]
  );

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr("");
    const added: Pending[] = Array.from(files).map((file, i) => ({
      key: `${Date.now()}-${i}-${file.name}`,
      file,
      kind: isVideoFile(file) ? "video" : "photo",
      status: "checking",
      progress: 0,
      note: humanSize(file.size),
    }));
    editPend((prev) => [...prev, ...added]);

    // 動画だけ、入れる前に中身の形式と大きさを見る（写真はこのあと必ずJPEGに焼き直す）
    for (const p of added) {
      if (p.kind !== "video") {
        patch(p.key, { status: "ready" });
        continue;
      }
      if (p.file.size > MAX_UPLOAD_BYTES) {
        patch(p.key, {
          status: "toobig",
          note: `${humanSize(p.file.size)}（1件${humanSize(MAX_UPLOAD_BYTES)}まで）`,
        });
        continue;
      }
      // HEVC（iPhoneの既定）も止めない。9/27まではここで弾いていたが、
      // そうするとiPhoneからは動画をひとつも入れられなかった。
      // いまのアンドロイドはHEVCを再生できる端末が多く、できない端末でも
      // 拡大した画面から保存すれば端末の動画アプリで見られる。
      // 入れられないより、入れたうえで見方を案内するほうがよい。
      const codec = await probeVideoCodec(p.file);
      patch(p.key, {
        codec,
        status: "ready",
        note:
          codec === "hevc"
            ? `${humanSize(p.file.size)}・iPhoneの形式（HEVC）`
            : humanSize(p.file.size),
      });
    }
  }

  const hasHevc = pend.some((p) => p.codec === "hevc");
  const queued = pend.filter((p) => p.status === "ready");
  const nowUploading = pend.find((p) => p.status === "uploading");
  // 大きいものが混ざっているときは、待ち時間を先に言っておく（途中で閉じられると消える）
  const hasBig = queued.some((p) => p.file.size > 200 * 1024 * 1024);

  /* 1件ずつ、待機しているものが無くなるまで続ける。
     9/27まではボタンを押した時点の一覧をそのまま回していたので、
     1件目に何分もかかるあいだに画面が描き直されると、2件目から先へ進まなかった
     （2.0GBを1本入れたあと、残り2本が待機のまま止まった）。
     いまは「そのとき待機しているもの」を毎回取り直す。追加の途中で足したものも拾う。
     一度手を付けたものは done に控えて、二度回さない。 */
  async function run() {
    if (running) return;
    setRunning(true);
    setErr("");
    let ok = 0;
    const seen = new Set<string>();
    try {
      for (;;) {
        const p = pendRef.current.find((x) => x.status === "ready" && !seen.has(x.key));
        if (!p) break;
        seen.add(p.key);
        patch(p.key, { status: "uploading", progress: 0, note: "" });
        try {
          const prep = await prepareFile(p.file);
          if (prep.blob.size > MAX_UPLOAD_BYTES) {
            patch(p.key, {
              status: "toobig",
              note: `${humanSize(prep.blob.size)}（1件${humanSize(MAX_UPLOAD_BYTES)}まで）`,
            });
            continue;
          }
          await uploadToGallery(
            {
              blob: prep.blob,
              ext: prep.ext,
              contentType: prep.contentType,
              takenAt: prep.takenAt,
              sceneId: scene,
              thumb: prep.thumb,
            },
            (r) => patch(p.key, { progress: r })
          );
          patch(p.key, {
            status: "done",
            progress: 1,
            // 焼き直せなかったものは、一覧に絵が出ないことを伝える
            note: prep.asIs
              ? `${humanSize(prep.blob.size)}・焼き直せなかったので、撮ったそのまま入れました${
                  prep.thumb ? "" : "（一覧に絵が出ません）"
                }`
              : humanSize(prep.blob.size),
          });
          ok++;
        } catch (e) {
          patch(p.key, { status: "error", note: errText(e) });
          if (e instanceof GallerySetupError) {
            setErr(e.message);
            break;
          }
        }
      }
    } finally {
      // 途中で何が起きても、押せない状態のままにしない
      setRunning(false);
    }
    if (ok > 0) onDone();
  }

  if (!unlocked) {
    return (
      <div className="w-full">
        <p className="text-sm font-bold" style={{ color: INK }}>写真・動画を追加</p>
        <p className="text-xs mt-1 mb-3" style={{ color: DIM }}>運営スタッフ用です。合言葉を入れてください。</p>
        <div className="flex gap-2">
          <input
            type="password"
            inputMode="numeric"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setCodeErr("");
            }}
            placeholder="合言葉"
            className="flex-1 px-3 py-2 text-sm"
            style={{ border: `1px solid ${LINE}`, borderRadius: 8, color: INK }}
          />
          <button
            type="button"
            onClick={() => (unlockOfficer(code) ? setUnlocked(true) : setCodeErr("合言葉が違います"))}
            className="px-4 py-2 text-sm font-bold"
            style={{ background: INK, color: "#f1efe8", borderRadius: 8 }}
          >
            開く
          </button>
        </div>
        {codeErr && <p className="text-xs mt-2" style={{ color: "#a33" }}>{codeErr}</p>}
        <button type="button" onClick={onClose} className="w-full mt-4 py-2 text-xs" style={{ color: DIM }}>
          もどる
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold" style={{ color: INK }}>写真・動画を追加</p>
        <button type="button" onClick={onClose} className="text-xs" style={{ color: DIM }}>もどる</button>
      </div>

      <p className="text-xs mt-2 leading-relaxed" style={{ color: DIM }}>
        iPhoneの写真（HEIC）も動画（HEVC）も、そのまま追加できます。撮る前に 設定 → カメラ → フォーマット → 「互換性優先」にしておくと、どの端末でもその場で再生できる形で撮れます。
      </p>
      <p className="text-xs mt-1.5 leading-relaxed" style={{ color: DIM }}>
        長い動画（10分以上）は、パソコンから入れてください。スマホからだと、動画をブラウザに渡す途中で止まり、選んでも何も起きないことがあります。iPhoneはパソコンにつないで写真アプリから書き出し、その動画をこの画面に入れてください。
      </p>

      <label className="block text-xs mt-4 mb-1" style={{ color: SUB }}>撮影シーン</label>
      <select
        value={scene}
        onChange={(e) => setScene(e.target.value)}
        className="w-full px-3 py-2 text-sm"
        style={{ border: `1px solid ${LINE}`, borderRadius: 8, background: "#fff", color: INK }}
      >
        {SCENES.map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>

      {/* パソコンからはドラッグでも入る。長い動画はこちらが確実なので、
          選ぶボタンそのものを落とし場所にしてある（別のボタンを増やさない）。 */}
      <button
        type="button"
        onClick={openPicker}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragOver) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className="w-full mt-3 py-6 text-sm"
        style={{
          border: `1px dashed ${dragOver ? INK : "#b4b2a9"}`,
          borderRadius: 10,
          color: SUB,
          background: dragOver ? FACE : "#fff",
        }}
      >
        {dragOver ? "ここに落とす" : canDrop ? "パソコンから選ぶ" : "スマホから選ぶ"}
        {/* 中の文字の上を通るたびに dragleave が飛んで枠がちらつくので、拾わせない */}
        <span className="block text-xs mt-1" style={{ color: DIM, pointerEvents: "none" }}>
          {canDrop ? "ここにドラッグしても入ります。まとめて選べます" : "まとめて選べます"}
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          stopWaiting();
          // 選んだはずなのに0件で戻ってくる＝端末が渡せていない
          if (!files || files.length === 0) setStuck(true);
          else void onPick(files);
          e.target.value = "";
        }}
      />

      {picking && (
        <p className="text-xs mt-2 leading-relaxed" style={{ color: DIM }}>
          選んだものを、いま端末が書き出しています。長い動画だと数分かかります。この画面のままお待ちください。
        </p>
      )}

      {stuck && (
        <div className="mt-3 px-3 py-3" style={{ border: `1px solid ${LINE}`, borderRadius: 10 }}>
          <p className="text-xs font-bold" style={{ color: INK }}>まだ動画が入ってきていません</p>
          <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: SUB }}>
            長い動画は、スマホがブラウザに渡しきれないことがあります。パソコンから入れるのが確実です。
          </p>
          <ol className="text-[11px] mt-2 leading-relaxed list-decimal pl-4" style={{ color: SUB }}>
            <li>パソコンから入れる。iPhoneをつないで写真アプリで書き出し、その動画をこの画面にドラッグする（これが一番確実です）</li>
            <li>スマホで続けるなら、まず10秒くらいの短い動画で試す。これが入るなら、原因は動画の長さです</li>
            <li>本体の空き容量を見る（iPhoneは 設定 → 一般 → iPhoneストレージ）。動画と同じだけの空きが要ります</li>
            <li>iPhoneは 設定 → 写真 →「オリジナルをダウンロード」にする（iCloudに預けたままだと渡せません）</li>
          </ol>
          <button
            type="button"
            onClick={() => setStuck(false)}
            className="mt-2 text-[11px]"
            style={{ color: DIM }}
          >
            閉じる
          </button>
        </div>
      )}

      {pend.length > 0 && (
        <div className="mt-3" style={{ border: `1px solid ${LINE}`, borderRadius: 10 }}>
          {pend.map((p, i) => (
            <div
              key={p.key}
              className="px-3 py-2"
              style={{ borderTop: i === 0 ? "none" : `1px solid ${LINE}` }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs truncate flex-1" style={{ color: SUB }}>{p.file.name}</span>
                <span className="text-xs shrink-0" style={{ color: p.status === "error" || p.status === "toobig" ? "#a33" : DIM }}>
                  {p.status === "uploading" ? `${Math.round(p.progress * 100)}%` : STATUS_LABEL[p.status]}
                </span>
              </div>
              {p.status === "uploading" && (
                <div className="mt-1.5 h-[3px] w-full overflow-hidden" style={{ background: LINE, borderRadius: 2 }}>
                  <div style={{ width: `${Math.round(p.progress * 100)}%`, height: "100%", background: INK }} />
                </div>
              )}
              {p.note && <p className="text-[11px] mt-0.5" style={{ color: DIM }}>{p.note}</p>}
            </div>
          ))}
        </div>
      )}

      {hasHevc && (
        <p className="text-[11px] mt-3 leading-relaxed" style={{ color: DIM }}>
          iPhoneの形式（HEVC）の動画が入っています。そのまま追加できます。開いてもその場で再生できない端末では、拡大した画面から保存すれば、端末の動画アプリで見られます。
        </p>
      )}

      <button
        type="button"
        onClick={() => void run()}
        disabled={running || queued.length === 0}
        className="w-full mt-4 py-3 text-sm font-bold"
        style={{
          background: INK,
          color: "#f1efe8",
          borderRadius: 8,
          opacity: running || queued.length === 0 ? 0.45 : 1,
        }}
      >
        {running ? "追加しています…" : queued.length > 0 ? `${queued.length}件を追加する` : "追加する"}
      </button>
      {/* 1件に何分もかかるので、止まっているのか進んでいるのかが分かるようにする */}
      {running && nowUploading && (
        <p className="text-[11px] mt-2 leading-relaxed" style={{ color: SUB }}>
          いま「{nowUploading.file.name}」を追加しています
          {queued.length > 0 ? `（このあと あと${queued.length}件）` : "（これで最後です）"}
        </p>
      )}
      {hasBig && (
        <p className="text-[11px] mt-2 leading-relaxed" style={{ color: DIM }}>
          大きい動画は、追加し終わるまでに10分以上かかることがあります。終わるまで、この画面を閉じないでください。途中で閉じると、その1件は入りません。
        </p>
      )}
      {err && <p className="text-xs mt-2 leading-relaxed" style={{ color: "#a33" }}>{err}</p>}
      <p className="text-[11px] mt-3 leading-relaxed" style={{ color: DIM }}>
        写真はこの端末の中でJPEGに直してから入れます（iPhoneのHEICでも、どの端末でも開けます）。入れたものは、あとでGoogleドライブにも控えを取ってください。
      </p>
    </div>
  );
}

/* ── 本体 ─────────────────────────────────────── */
export default function GalleryFeature() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [viewIdx, setViewIdx] = useState<number | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [panel, setPanel] = useState<"view" | "upload">("view");
  const [officer, setOfficer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [reloading, setReloading] = useState(false);
  /* 見ている回。はじめはいまの回。前の回に切り替えると、そのフォルダを読む。
     前の回は見るだけ（追加はできない）にしてある。入れ先を選べるようにすると、
     終わった回に新しい写真が混ざる事故が起きるため。 */
  const [round, setRound] = useState(CURRENT_ROUND.key);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);

  const load = useCallback(async () => {
    setErr("");
    try {
      setItems(await listGalleryFor(round));
    } catch (e) {
      setErr(errText(e));
    } finally {
      setLoading(false);
    }
  }, [round]);

  // 運営があとから足したぶんを、開いたまま取り直す。
  // 常時ポーリングにしないのは、画像の一覧は1回が重く、当日以外はまず増えないから。
  const reload = useCallback(async () => {
    setReloading(true);
    await load();
    setReloading(false);
  }, [load]);

  useEffect(() => {
    void load();
    setOfficer(isOfficerUnlocked());
  }, [load]);

  /* 前の回を見ているときだけ、その日のひとことも一緒に出す。
     いまの回のひとことは「ふりかえり」の画面にあるので、ここでは重ねない。
     読めなくても写真の一覧は出したいので、失敗は黙って無いものとして扱う。 */
  useEffect(() => {
    if (round === CURRENT_ROUND.key) {
      setVoices([]);
      setReplies([]);
      return;
    }
    let alive = true;
    readVoiceBoard(round)
      .then((board) => {
        if (!alive) return;
        setVoices(board.voices);
        setReplies(board.replies);
      })
      .catch(() => {
        if (alive) {
          setVoices([]);
          setReplies([]);
        }
      });
    return () => {
      alive = false;
    };
  }, [round]);

  /* 回を切り替える。前の回のものを選んだまま残すと、数と中身が食い違うので捨てる。 */
  const pickRound = (key: string) => {
    if (key === round) return;
    setLoading(true);
    setItems([]);
    setSelecting(false);
    setPicked([]);
    setSaveMsg("");
    setViewIdx(null);
    setRound(key);
  };
  const isCurrent = round === CURRENT_ROUND.key;

  const shown = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.kind === filter)),
    [items, filter]
  );

  // 見出し（シーン）ごとにまとめる。並び順は listGalleryFor がその回のシーン順に整えている。
  const groups = useMemo(() => {
    const out: { sceneId: string; items: GalleryItem[] }[] = [];
    for (const it of shown) {
      const last = out[out.length - 1];
      if (last && last.sceneId === it.sceneId) last.items.push(it);
      else out.push({ sceneId: it.sceneId, items: [it] });
    }
    return out;
  }, [shown]);

  function toggle(path: string) {
    setPicked((prev) => (prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]));
  }

  // しぼりこみを切り替えると、選んだものが画面から消えることがある。
  // 消えているものまで数に入れると「3件」と出して2件しか落とさない、という食い違いが出るので
  // 件数もボタンの有効・無効も、いま見えているものだけで決める。
  const pickedShown = useMemo(
    () => shown.filter((i) => picked.includes(i.path)),
    [shown, picked]
  );

  async function savePicked() {
    setSaving(true);
    setSaveMsg("");
    const targets = pickedShown;
    let ok = 0;
    for (let n = 0; n < targets.length; n++) {
      const it = targets[n];
      try {
        const ext = it.name.split(".").pop() || "jpg";
        await downloadFile(it.url, `africaheart-${roundKeyOf(it)}-${it.sceneId}-${n + 1}.${ext}`);
        ok++;
        // 続けて何件も落とすとブラウザに止められるので、少し間をあける
        await new Promise((r) => setTimeout(r, 400));
      } catch {
        /* 1件だめでも次へ */
      }
    }
    setSaving(false);
    setSaveMsg(`${ok}件を保存しました`);
  }

  /* 回の選び分け。回が1つしか無いうちは出さない。
     読み込み中も出しておく（切り替えた直後に消えると、戻る手が無くなるため）。 */
  const roundBar =
    ROUNDS.length < 2 ? null : (
      <div className="flex gap-1 mb-3" role="group" aria-label="どの回を見るか">
        {ROUNDS.map((r) => {
          const on = r.key === round;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => pickRound(r.key)}
              aria-pressed={on}
              className="flex-1 py-1.5 text-xs font-bold"
              style={{
                background: on ? FACE : "transparent",
                color: on ? INK : DIM,
                border: `1px solid ${on ? "transparent" : LINE}`,
                borderRadius: 7,
              }}
            >
              {roundWhen(r.key)} {r.place}
            </button>
          );
        })}
      </div>
    );

  if (loading) {
    return (
      <div className="w-full">
        {roundBar}
        <p className="text-sm" style={{ color: DIM }}>読み込んでいます…</p>
      </div>
    );
  }

  if (panel === "upload") {
    return (
      <UploadPanel
        onClose={() => {
          setPanel("view");
          setOfficer(isOfficerUnlocked());
        }}
        onDone={() => void load()}
      />
    );
  }

  return (
    <div className="w-full">
      {roundBar}
      {/* 上の行 */}
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: DIM }}>
          {items.length > 0 ? `${items.length}件` : ""}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void reload()}
            disabled={reloading}
            className="text-xs font-bold"
            style={{ color: SUB, opacity: reloading ? 0.5 : 1 }}
          >
            {reloading ? "更新中" : "更新"}
          </button>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelecting((v) => !v);
                setPicked([]);
                setSaveMsg("");
              }}
              className="text-xs font-bold"
              style={{ color: SUB }}
            >
              {selecting ? "やめる" : "選ぶ"}
            </button>
          )}
          {/* 追加はいまの回だけ。終わった回に新しい写真が混ざらないようにする */}
          {isCurrent && (
            <button
              type="button"
              onClick={() => setPanel("upload")}
              className="text-xs font-bold px-3 py-1.5"
              style={{ background: FACE, color: SUB, borderRadius: 7 }}
            >
              追加（運営）
            </button>
          )}
        </div>
      </div>

      {/* しぼりこみ */}
      {items.length > 0 && (
        <div className="flex gap-1 mt-3">
          {FILTERS.map((f) => {
            const on = f.id === filter;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className="flex-1 py-1.5 text-xs font-bold"
                style={{
                  background: on ? INK : FACE,
                  color: on ? "#f1efe8" : SUB,
                  borderRadius: 7,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {err && <p className="text-xs mt-3 leading-relaxed" style={{ color: "#a33" }}>{err}</p>}

      {shown.length === 0 ? (
        // 読めなかったときは「まだありません」と言わない（上のエラー文と食い違うため）
        err ? null : (
        <div className="py-12 text-center">
          <p className="text-sm" style={{ color: SUB }}>
            {items.length === 0 ? "この回の写真はまだありません" : "この種類はまだありません"}
          </p>
          {items.length === 0 && (
            <p className="text-xs mt-2 leading-relaxed" style={{ color: DIM }}>
              {isCurrent
                ? "運営が撮った写真と動画を、ここに載せていきます。"
                : `${roundWhen(round)}のぶんは、まだ入っていません。`}
            </p>
          )}
        </div>
        )
      ) : (
        <div className="mt-4">
          {groups.map((g) => (
            <div key={`${g.sceneId}-${g.items[0]?.path ?? ""}`} className="mb-4">
              <p className="text-[11px] mb-1.5 tracking-wide" style={{ color: DIM }}>
                {sceneLabel(g.sceneId, round)}
              </p>
              <div className="grid grid-cols-3 gap-[3px]">
                {g.items.map((it) => (
                  <Tile
                    key={it.path}
                    item={it}
                    selecting={selecting}
                    selected={picked.includes(it.path)}
                    onClick={() =>
                      selecting ? toggle(it.path) : setViewIdx(shown.findIndex((x) => x.path === it.path))
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* その日のひとこと（前の回を見ているときだけ。読むだけで、書き足しはできない） */}
      {!isCurrent && voices.length > 0 && (
        <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${LINE}` }}>
          <p className="text-[11px] mb-2 tracking-wide" style={{ color: DIM }}>
            {roundWhen(round)}のひとこと
          </p>
          {voices.map((v) => (
            <div key={`${v.name}-${v.at}`} className="mb-3">
              <p className="text-xs font-bold" style={{ color: SUB }}>{v.name}</p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: INK, whiteSpace: "pre-line", wordBreak: "break-word" }}
              >
                {v.text}
              </p>
              {/* その回に付いた返信も読めるようにする（ここは読むだけ） */}
              {replies
                .filter((r) => r.to === v.name)
                .map((r) => (
                  <div key={r.id} className="mt-2 pl-3" style={{ borderLeft: `2px solid ${LINE}` }}>
                    <p className="text-[11px] font-bold" style={{ color: DIM }}>{r.name}</p>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: INK, whiteSpace: "pre-line", wordBreak: "break-word" }}
                    >
                      {r.text}
                    </p>
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}

      {/* まとめて保存 */}
      {selecting && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => void savePicked()}
            disabled={saving || pickedShown.length === 0}
            className="w-full py-3 text-sm font-bold"
            style={{
              background: INK,
              color: "#f1efe8",
              borderRadius: 8,
              opacity: saving || pickedShown.length === 0 ? 0.45 : 1,
            }}
          >
            {saving ? "保存しています…" : `${pickedShown.length}件をまとめて保存`}
          </button>
          {isIOS() && (
            <p className="text-[11px] mt-2 leading-relaxed" style={{ color: DIM }}>
              iPhoneはまとめて保存が止められることがあります。うまくいかないときは、1枚ずつ開いて保存してください。
            </p>
          )}
          {saveMsg && <p className="text-xs mt-2 text-center" style={{ color: SUB }}>{saveMsg}</p>}
        </div>
      )}

      {viewIdx !== null && shown[viewIdx] && (
        <Lightbox
          items={shown}
          index={viewIdx}
          canDelete={officer}
          onIndex={setViewIdx}
          onClose={() => setViewIdx(null)}
          onDeleted={() => {
            setViewIdx(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
