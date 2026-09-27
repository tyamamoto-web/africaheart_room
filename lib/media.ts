"use client";

/* ============================================================
   写真・動画を「iPhoneでもアンドロイドでも開ける形」にそろえる
   ------------------------------------------------------------
   運営スタッフはそれぞれ違う端末で撮る。そのまま置くと片方の端末で開けない。
   よくある詰まりどころは2つで、それぞれ対処が違う。

   ① 写真：iPhoneの既定は HEIC。アンドロイドやWindowsでは開けない。
      → 入れる前にブラウザの中で JPEG に焼き直す（下の prepareImage）。
        撮った端末（iPhone/Mac）はHEICを読めるので、そこで変換すれば必ず通る。
        ついでに長辺2560pxまで縮めるので、通信量も置き場所も軽くなる。
        向き（EXIF）もこのときに焼き込まれるので、横倒しにならない。

   ② 動画：iPhoneの既定は HEVC(H.265)。これはブラウザの中では直せない（作り直しになる）。
      → 入れるのは止めない（9/27に方針を変えた。それまでは弾いていたので、
        iPhoneからは動画を1本も入れられなかった）。
        いまのアンドロイドは HEVC を再生できる端末が多い。再生できない端末でも、
        拡大した画面から保存すれば、端末の動画アプリで見られる。
        中身が H.264 か HEVC かは下の probeVideoCodec で分かるので、
        入れる人への案内にだけ使う。
        撮る前に設定しておくと、そもそも起きない：
          iPhone → 設定 → カメラ → フォーマット → 「互換性優先」
        これにすると写真はJPEG・動画はH.264で撮れるので、①②とも起きなくなる。

   ※ 外部ライブラリは使わない（この土台に合わせて依存を増やさない）。
   ============================================================ */

/** 長辺の上限。これより大きい写真は縮める（画質は十分・容量は1/4以下になる）。 */
const MAX_EDGE = 2560;
/** JPEGの画質。0.85は見た目の劣化がほぼ分からない範囲。 */
const JPEG_QUALITY = 0.85;

/**
 * 一覧用の小さい画像（サムネイル）の長辺と画質。
 * 一覧で原寸を並べると、100枚で数十MBを読み込むことになって
 * スマホの通信量を食う。入れるときに小さいものも一緒に作っておく。
 */
const THUMB_EDGE = 480;
const THUMB_QUALITY = 0.72;

/**
 * 1ファイルの上限。
 * 30分ほどの動画を入れられるようにするため、4GBまでにしてある
 * （iPhoneの1080p/30fpsで約65MB/分＝30分で約2GB。60fpsでも収まる大きさ）。
 *
 * ※ この数字だけ変えても入らない。Supabase側の上限も同じだけ必要：
 *    ・プランがPro以上であること（無料プランは1ファイル50MBが上限）
 *    ・ダッシュボード → Storage → Settings の
 *      「Upload file size limit」を5GBなどに上げておくこと
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 * 1024;

export type VideoCodec = "h264" | "hevc" | "unknown";

export type Prepared = {
  blob: Blob;
  ext: string; // 拡張子（ドット無し）
  contentType: string; // 配信時のMIME
  takenAt: number; // 撮影時刻(ms)。並び順に使う
  kind: "photo" | "video";
  codec?: VideoCodec; // 動画のときだけ
  thumb?: Blob; // 一覧用の小さいJPEG（作れなかったときは無し）
  /** 焼き直さず、撮ったそのままを置くとき。この端末では中身を開けなかった印。 */
  asIs?: boolean;
};

/* ── 写真：JPEGに焼き直す ───────────────────────── */

type Decoded = { src: CanvasImageSource; w: number; h: number; close: () => void };

// 読み込みは2通り試す。<img> を先にするのは「向き（EXIF）」のため。
// createImageBitmap は速いが、向きを反映するかがブラウザの版で違う
// （古いSafariは imageOrientation:"from-image" を無視して横倒しのまま焼ける）。
// <img> はどのブラウザでも向きを反映して描くので、写真が回らないほうを既定にする。
async function decodeViaImg(file: File): Promise<Decoded> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });
    if (!img.naturalWidth || !img.naturalHeight) throw new Error("decode failed");
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

async function decodeImage(file: File): Promise<Decoded> {
  try {
    return await decodeViaImg(file);
  } catch {
    /* 下の createImageBitmap で読み直す */
  }
  if (typeof createImageBitmap === "function") {
    const opts = { imageOrientation: "from-image" } as unknown as ImageBitmapOptions;
    const bmp = await createImageBitmap(file, opts);
    return { src: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
  }
  throw new Error("decode failed");
}

// 読み込んだ画像を、長辺 maxEdge に収めたJPEGにする。
async function toJpeg(d: Decoded, maxEdge: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(d.w, d.h, 1));
  const w = Math.max(1, Math.round(d.w * scale));
  const h = Math.max(1, Math.round(d.h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("この端末では写真を変換できませんでした");
  ctx.drawImage(d.src, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
  if (!blob) throw new Error("この端末では写真を変換できませんでした");
  return blob;
}

/** 焼き直せなかった写真を、そのまま置くときのMIME。 */
function imageContentType(ext: string, given: string): string {
  if (given.startsWith("image/")) return given;
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

/** 焼き直さずに、撮ったそのままを置く形。thumb は作れていれば付ける。 */
function asIsPhoto(file: File, thumb?: Blob): Prepared {
  const raw = (file.name.split(".").pop() || "").toLowerCase();
  const ext = /^[a-z0-9]{1,5}$/.test(raw) ? raw : "jpg";
  return {
    blob: file,
    ext,
    contentType: imageContentType(ext, file.type || ""),
    takenAt: file.lastModified || Date.now(),
    kind: "photo",
    thumb,
    asIs: true,
  };
}

/**
 * 写真を入れられる形にする。
 *
 * 9/27まではここで断ることがあり、そうすると写真が1枚も入らなかった。
 * いまは、うまくいかなくても撮ったそのままを入れる。断るより残すほうがよい。
 * 詰まりどころは2つあって、どちらも「そのまま入れる」で抜ける。
 *   ・この端末では中身を開けない（WindowsやアンドロイドでのHEICなど）
 *   ・開けたが、焼き直しの途中で端末の持ち物が足りなくなった
 *     （大きい動画を何本も入れたあとのiPhoneで起きる）
 *
 * 小さい画像（一覧用）は先に作る。こちらは長辺480pxで軽いので、
 * 原寸の焼き直しが持ち物不足で落ちても、一覧の絵だけは残ることが多い。
 */
export async function prepareImage(file: File): Promise<Prepared> {
  let d: Decoded | null = null;
  try {
    d = await decodeImage(file);
  } catch {
    d = null;
  }
  if (!d) return asIsPhoto(file);

  try {
    const thumb = await toJpeg(d, THUMB_EDGE, THUMB_QUALITY).catch(() => undefined);
    let blob: Blob;
    try {
      blob = await toJpeg(d, MAX_EDGE, JPEG_QUALITY);
    } catch {
      return asIsPhoto(file, thumb);
    }
    return {
      blob,
      ext: "jpg",
      contentType: "image/jpeg",
      takenAt: file.lastModified || Date.now(),
      kind: "photo",
      thumb,
    };
  } finally {
    d.close();
  }
}

/* ── 動画：中身のコーデックを覗く ─────────────────── */

// mp4/mov は「4バイトの長さ＋4文字の名前」の箱が入れ子になっただけの造り。
// 映像の種類は moov という箱の奥（stsd）に "avc1"(H.264) / "hvc1"(HEVC) の
// 4文字で書いてある。iPhoneは moov を末尾に置くので、頭から箱をたどって探す。
// 箱の位置だけを読むので、何百MBの動画でも実際に読むのは moov のぶんだけ。
const MAX_MOOV_BYTES = 32 * 1024 * 1024;

// まっとうなmp4/movの一番外側の箱は ftyp/moov/mdat/free など数個しかない。
// 壊れたファイルや別形式で、でたらめな長さを拾って延々とたどらないよう上限を置く。
const MAX_TOP_BOXES = 64;

async function findMoov(file: File): Promise<ArrayBuffer | null> {
  let off = 0;
  for (let seen = 0; seen < MAX_TOP_BOXES && off + 8 <= file.size; seen++) {
    const head = await file.slice(off, off + 16).arrayBuffer();
    if (head.byteLength < 8) return null;
    const dv = new DataView(head);
    let size = dv.getUint32(0);
    const type = String.fromCharCode(dv.getUint8(4), dv.getUint8(5), dv.getUint8(6), dv.getUint8(7));
    let headerLen = 8;
    if (size === 1) {
      // 4GB超の箱は長さが64bitで別に書いてある（BigIntを使わずに上下32bitで組み立てる）
      if (head.byteLength < 16) return null;
      size = dv.getUint32(8) * 4294967296 + dv.getUint32(12);
      headerLen = 16;
    } else if (size === 0) {
      size = file.size - off; // 「最後まで」の意味
    }
    if (size < headerLen) return null; // 壊れている（無限ループを避ける）
    if (type === "moov") {
      const end = Math.min(off + Math.min(size, MAX_MOOV_BYTES), file.size);
      return file.slice(off, end).arrayBuffer();
    }
    off += size;
  }
  return null;
}

function containsAscii(buf: ArrayBuffer, needle: string): boolean {
  const b = new Uint8Array(buf);
  const n = needle.length;
  outer: for (let i = 0; i + n <= b.length; i++) {
    for (let j = 0; j < n; j++) {
      if (b[i + j] !== needle.charCodeAt(j)) continue outer;
    }
    return true;
  }
  return false;
}

/** H.264（どちらの端末でも再生できる）か、HEVC（iPhone専用）かを見分ける。 */
export async function probeVideoCodec(file: File): Promise<VideoCodec> {
  try {
    const moov = await findMoov(file);
    if (!moov) return "unknown";
    if (containsAscii(moov, "hvc1") || containsAscii(moov, "hev1")) return "hevc";
    if (containsAscii(moov, "avc1") || containsAscii(moov, "avc3")) return "h264";
    return "unknown";
  } catch {
    return "unknown"; // 判定できなくても止めない（見る側で再生できなければ保存を案内する）
  }
}

/**
 * 動画の1コマを取り出して、一覧用の静止画にする。
 * 入れる端末は自分で撮った動画を再生できるので、ここで作れば
 * 見る側の端末が再生できない形式でも、一覧にはちゃんと絵が出る。
 * 取り出せなくても止めない（一覧では灰色のコマに再生マークを出す）。
 */
async function makeVideoPoster(file: File): Promise<Blob | undefined> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  try {
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      const fail = () => reject(new Error("poster"));
      const timer = setTimeout(fail, 8000); // 開けない形式で待ち続けない
      video.onloadeddata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        fail();
      };
    });
    // 冒頭は暗いことが多いので、少しだけ進めたところを使う
    const at = Math.min(0.5, (video.duration || 1) / 2);
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = at;
      setTimeout(resolve, 4000); // 動かない端末でも先へ進む
    });
    const d: Decoded = {
      src: video,
      w: video.videoWidth,
      h: video.videoHeight,
      close: () => undefined,
    };
    if (!d.w || !d.h) return undefined;
    return await toJpeg(d, THUMB_EDGE, THUMB_QUALITY);
  } catch {
    return undefined;
  } finally {
    video.removeAttribute("src");
    URL.revokeObjectURL(url);
  }
}

/**
 * 置くときのMIME。入れ物（拡張子）に合わせる。
 * .mov は QuickTime だが、中の箱の造りは mp4 と同じなので video/mp4 として配る。
 * video/quicktime で配ると、その場で再生せずに落とすだけになる端末がある。
 * webm・3gp は造りが別なので、それぞれの名前で配らないと再生できない。
 */
function videoContentType(ext: string): string {
  if (ext === "webm") return "video/webm";
  if (ext === "3gp" || ext === "3gpp") return "video/3gpp";
  return "video/mp4"; // mp4 / m4v / mov / 分からないもの
}

export async function prepareVideo(file: File): Promise<Prepared> {
  const codec = await probeVideoCodec(file);
  const thumb = await makeVideoPoster(file);
  const raw = (file.name.split(".").pop() || "").toLowerCase();
  const ext = /^[a-z0-9]{1,5}$/.test(raw) ? raw : "mp4";
  return {
    blob: file,
    ext,
    contentType: videoContentType(ext),
    takenAt: file.lastModified || Date.now(),
    kind: "video",
    codec,
    thumb,
  };
}

export function isVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  return ["mp4", "mov", "m4v", "webm", "3gp"].includes(ext);
}

/** 選ばれた1ファイルを、そのまま入れられる形にする。 */
export function prepareFile(file: File): Promise<Prepared> {
  return isVideoFile(file) ? prepareVideo(file) : prepareImage(file);
}

/* ── 端末に保存する ─────────────────────────────── */

/** iPhone・iPadか（まとめて保存の可否や案内の出し分けに使う）。 */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOSはMacintoshを名乗るので、タッチの有無でも見る
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * 端末に保存する。別ドメイン（Supabase）のURLをそのまま <a download> にしても
 * ダウンロードにならないので、いったん取り込んでから保存する。
 *
 * ただし大きい動画は、まるごと取り込む途中でスマホの持ち物が足りなくなって
 * 落ちることがある。そのときは、その動画だけを別のタブで開く。
 * そこから iPhone は共有 → ビデオを保存、アンドロイドは長押し → ダウンロードで保存できる。
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 10_000);
  } catch {
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) {
      throw new Error(
        "保存できませんでした。この動画だけを別のタブで開こうとしましたが、ブラウザに止められました。ポップアップを許可してから、もう一度お試しください"
      );
    }
  }
}

/** 見やすい容量表示（「12.4MB」など）。 */
export function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}
