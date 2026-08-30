import { formatTime } from "../lib/format";
import { isSongLink, SONG_STATUS_LABEL, songStatusClass } from "../lib/songRequest";
import type { SongRequest } from "../types";

export function SongRequestsBoard({
  songs,
  loading = false,
  compact = false,
  onApprove,
  onDelete,
  onRefresh,
}: {
  songs: SongRequest[];
  loading?: boolean;
  compact?: boolean;
  onApprove: (id: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onRefresh?: () => void;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl text-stone-900">ຄຳຮ້ອງເພງ</h2>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium"
          >
            ໂຫຼດໃໝ່
          </button>
        )}
      </div>
      {loading && <p className="py-8 text-center text-stone-500">ກຳລັງໂຫຼດ...</p>}
      {!loading && songs.length === 0 && (
        <p className="rounded-3xl bg-white p-8 text-center text-stone-500">ຍັງບໍ່ມີຄຳຮ້ອງເພງ.</p>
      )}
      <div className="space-y-3">
        {songs.map((song) => (
          <article
            key={song.id}
            className={`rounded-3xl bg-white shadow-sm ${
              song.status === "pending" ? "ring-2 ring-orange-400" : "opacity-80"
            } ${compact ? "p-4" : "p-5"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-2xl text-stone-900">ໂຕະ {song.tableNumber}</p>
                {isSongLink(song.title) ? (
                  <a
                    href={song.title}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block break-all text-lg font-semibold text-orange-700 underline"
                  >
                    {song.title}
                  </a>
                ) : (
                  <p className="mt-1 text-lg font-semibold text-orange-700">{song.title}</p>
                )}
                <p className="text-sm text-stone-500">{formatTime(song.createdAt)}</p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${songStatusClass(song.status)}`}>
                {SONG_STATUS_LABEL[song.status]}
              </span>
            </div>
            <div className={`mt-4 flex gap-2 ${compact ? "flex-col" : "flex-wrap"}`}>
              {song.status === "pending" && (
                <button
                  type="button"
                  onClick={() => void onApprove(song.id)}
                  className={`rounded-2xl bg-emerald-600 font-semibold text-white ${compact ? "w-full py-3" : "px-4 py-2"}`}
                >
                  ອະນຸມັດ / ຫຼິ້ນແລ້ວ
                </button>
              )}
              <button
                type="button"
                onClick={() => void onDelete(song.id)}
                className={`rounded-2xl bg-red-600 font-semibold text-white ${compact ? "w-full py-3" : "px-4 py-2"}`}
              >
                ລຶບ
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
