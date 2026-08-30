import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { formatTime } from "../lib/format";
import { isSongLink, SONG_STATUS_LABEL, songStatusClass } from "../lib/songRequest";
import type { SongRequest } from "../types";

export function GuestMusicPanel({
  tableNumber,
  canRequest,
  browseMessage,
}: {
  tableNumber: number;
  canRequest: boolean;
  browseMessage: string;
}) {
  const [title, setTitle] = useState("");
  const [songs, setSongs] = useState<SongRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadSongs() {
    if (!Number.isInteger(tableNumber) || tableNumber < 1) {
      setSongs([]);
      setLoading(false);
      return;
    }
    try {
      setSongs(await api.getSongs(tableNumber));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ໂຫຼດຄຳຮ້ອງເພງບໍ່ສຳເລັດ.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void loadSongs();
    const poll = window.setInterval(() => void loadSongs(), 4000);
    return () => window.clearInterval(poll);
  }, [tableNumber]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canRequest) {
      setError(browseMessage);
      return;
    }
    const next = title.trim();
    if (!next) {
      setError("ກະລຸນາໃສ່ຊື່ເພງ, ລິງກ໌ YouTube ຫຼື ຊື່ນັກຮ້ອງ.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const created = await api.createSong({ tableNumber, title: next });
      setSongs((current) => [created, ...current.filter((song) => song.id !== created.id)]);
      setTitle("");
      setNotice("ສົ່ງຄຳຮ້ອງເພງແລ້ວ.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ສົ່ງຄຳຮ້ອງເພງບໍ່ສຳເລັດ.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <article className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-3xl">🎵</p>
        <h2 className="font-display mt-2 text-2xl text-stone-900">ຂໍເພງ</h2>
        <p className="mt-1 text-sm text-stone-500">ໃສ່ຊື່ເພງ, ລິງກ໌ YouTube ຫຼື ຊື່ນັກຮ້ອງ.</p>
        <form className="mt-4 space-y-3" onSubmit={(event) => void onSubmit(event)}>
          <input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setError("");
            }}
            maxLength={200}
            placeholder="ຕົວຢ່າງ: ລາວສວຍ / YouTube / ຊື່ນັກຮ້ອງ"
            disabled={!canRequest || sending}
            className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-orange-500 disabled:bg-stone-50"
          />
          <button
            type="submit"
            disabled={!canRequest || sending || !title.trim()}
            className="w-full rounded-2xl bg-orange-600 py-3 font-semibold text-white disabled:opacity-50"
          >
            {sending ? "ກຳລັງສົ່ງ..." : "ສົ່ງຄຳຮ້ອງຂໍ"}
          </button>
        </form>
        {!canRequest && <p className="mt-3 text-sm text-amber-700">{browseMessage}</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {notice && <p className="mt-3 text-sm text-emerald-700">{notice}</p>}
      </article>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-stone-500">ເພງທີ່ໂຕະນີ້ສົ່ງແລ້ວ</h3>
        {loading && <p className="py-6 text-center text-sm text-stone-500">ກຳລັງໂຫຼດ...</p>}
        {!loading && songs.length === 0 && (
          <p className="rounded-3xl bg-white p-8 text-center text-stone-500">ຍັງບໍ່ມີຄຳຮ້ອງເພງ.</p>
        )}
        <div className="space-y-3">
          {songs.map((song) => (
            <article key={song.id} className="rounded-3xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {isSongLink(song.title) ? (
                    <a
                      href={song.title}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all font-semibold text-orange-700 underline"
                    >
                      {song.title}
                    </a>
                  ) : (
                    <p className="font-semibold text-stone-900">{song.title}</p>
                  )}
                  <p className="mt-1 text-sm text-stone-500">{formatTime(song.createdAt)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${songStatusClass(song.status)}`}>
                  {SONG_STATUS_LABEL[song.status]}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
