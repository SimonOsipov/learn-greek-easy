import { useEffect, useMemo, useState } from 'react';

import { AlertTriangle, CheckCircle, Clock, Gauge } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AdminCardErrorSection } from '@/components/admin/AdminCardErrorSection';
import { StatCard } from '@/components/ui/stat-card';
import { adminAPI } from '@/services/adminAPI';
import type { AdminCardErrorResponse } from '@/types/cardError';

// ─── sparkline helpers ───────────────────────────────────────────────────────

const BUCKET_COUNT = 9;
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Bucket reports whose `created_at` falls in the last 30 days into 9 equal
 * time slices.  Returns an array of exactly BUCKET_COUNT non-NaN integers.
 */
function bucketByCreatedAt(
  reports: AdminCardErrorResponse[],
  predicate: (r: AdminCardErrorResponse) => boolean,
  now: number
): number[] {
  const buckets = new Array<number>(BUCKET_COUNT).fill(0);
  const windowStart = now - WINDOW_MS;
  const bucketMs = WINDOW_MS / BUCKET_COUNT;
  for (const r of reports) {
    if (!predicate(r)) continue;
    const t = new Date(r.created_at).getTime();
    if (Number.isNaN(t) || t < windowStart || t > now) continue;
    const idx = Math.min(BUCKET_COUNT - 1, Math.floor((t - windowStart) / bucketMs));
    buckets[idx]++;
  }
  return buckets;
}

// ─── median helper ────────────────────────────────────────────────────────────

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function formatMedianTimeToFix(ms: number | null): string {
  if (ms === null) return '—';
  if (ms >= DAY_MS) return `${Math.round(ms / DAY_MS)}d`;
  return `${Math.round(ms / HOUR_MS)}h`;
}

// ─── subline helpers ──────────────────────────────────────────────────────────

function formatDistanceToNow(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diffMs / DAY_MS);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(diffMs / HOUR_MS);
  return `${hours}h`;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function CardErrorsView() {
  const { t } = useTranslation('admin');

  // Fetch the full (unfiltered) list for stats — capped at 1 000 rows.
  const [allReports, setAllReports] = useState<AdminCardErrorResponse[]>([]);

  useEffect(() => {
    let cancelled = false;
    adminAPI
      .listCardErrors({ page: 1, page_size: 1000 })
      .then((res) => {
        if (!cancelled) setAllReports(res.items);
      })
      .catch(() => {
        // Silently fall back to empty — stat tiles stay at 0
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── derived stats ─────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const now = Date.now();

    // Counts
    const total = allReports.length;
    const awaitingReview = allReports.filter((r) => r.status === 'PENDING').length;
    const fixedAllTime = allReports.filter((r) => r.status === 'FIXED').length;

    // Median time-to-fix (FIXED rows with both timestamps)
    const fixedDurationsMs = allReports
      .filter((r) => r.status === 'FIXED' && r.resolved_at)
      .map((r) => new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime())
      .filter((ms) => !Number.isNaN(ms) && ms >= 0);
    const medianMs = median(fixedDurationsMs);

    // Sparklines
    const sparkTotal = bucketByCreatedAt(allReports, () => true, now);
    const sparkAwaiting = bucketByCreatedAt(allReports, (r) => r.status === 'PENDING', now);
    const sparkFixed = bucketByCreatedAt(allReports, (r) => r.status === 'FIXED', now);
    // Median tile sparkline: daily trend of all fixed durations bucketed by resolved_at
    const sparkMedian = bucketByCreatedAt(
      allReports,
      (r) => r.status === 'FIXED' && Boolean(r.resolved_at),
      now
    );

    // ── subline vars (CER-08) ────────────────────────────────────────────────

    // Tile #1: distinct deck count
    const distinctDecks = new Set(allReports.map((r) => r.deck?.id).filter(Boolean)).size;

    // Tile #2: oldest pending + culture/word split
    const pending = allReports.filter((r) => r.status === 'PENDING');
    const oldestPending = pending.reduce<AdminCardErrorResponse | null>(
      (acc, r) => (!acc || new Date(r.created_at) < new Date(acc.created_at) ? r : acc),
      null
    );
    const oldestAge = oldestPending ? formatDistanceToNow(oldestPending.created_at) : '—';
    const cultureCount = pending.filter((r) => r.card_type === 'CULTURE').length;
    const wordCount = pending.filter((r) => r.card_type === 'WORD').length;

    // Tile #3: dismissed count
    const dismissedCount = allReports.filter((r) => r.status === 'DISMISSED').length;

    // Tile #4 delta: prior 30-day window median
    const now30 = new Date(now);
    const win30Start = new Date(now - WINDOW_MS);
    const win60Start = new Date(now - 2 * WINDOW_MS);

    const fixedRows = allReports.filter((r) => r.status === 'FIXED' && r.resolved_at);
    const fixedDates = fixedRows.map((r) => new Date(r.resolved_at!).getTime());
    const spanDays =
      fixedDates.length > 0 ? (Math.max(...fixedDates) - Math.min(...fixedDates)) / DAY_MS : 0;

    const prevWindowRows = fixedRows.filter((r) => {
      const t2 = new Date(r.resolved_at!);
      return t2 >= win60Start && t2 < win30Start;
    });
    const prevWindowDurations = prevWindowRows
      .map((r) => new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime())
      .filter((ms) => !Number.isNaN(ms) && ms >= 0);
    const prevMedianMs = median(prevWindowDurations);
    const showDelta = spanDays >= 30 && prevMedianMs !== null;
    const prevDays = prevMedianMs !== null ? Math.round(prevMedianMs / DAY_MS) : null;

    // Suppress unused variable warnings
    void now30;

    return {
      total,
      awaitingReview,
      fixedAllTime,
      medianDisplay: formatMedianTimeToFix(medianMs),
      sparkTotal,
      sparkAwaiting,
      sparkFixed,
      sparkMedian,
      sublines: {
        totalReports: { N: distinctDecks },
        awaitingReview: { age: oldestAge, K: cultureCount, W: wordCount },
        fixedAllTime: { D: dismissedCount },
        medianTimeToFix: { prev: prevDays, showDelta },
      },
    };
  }, [allReports]);

  // ─── subline strings ───────────────────────────────────────────────────────

  const sublineTotal = t('cardErrors.stats.totalReports.subline', {
    N: stats.sublines.totalReports.N,
  });

  const sublineAwaiting = t('cardErrors.stats.awaitingReview.subline', {
    age: stats.sublines.awaitingReview.age,
    K: stats.sublines.awaitingReview.K,
    W: stats.sublines.awaitingReview.W,
  });

  const sublineFixed = t('cardErrors.stats.fixedAllTime.subline', {
    D: stats.sublines.fixedAllTime.D,
  });

  const sublineMedian = stats.sublines.medianTimeToFix.showDelta
    ? t('cardErrors.stats.medianTimeToFix.subline_withDelta', {
        prev: stats.sublines.medianTimeToFix.prev,
      })
    : t('cardErrors.stats.medianTimeToFix.subline_window');

  return (
    <div>
      <section className="stat-grid">
        <StatCard
          title={t('cardErrors.stats.totalReports.label')}
          n={allReports.length > 0 ? stats.total : '—'}
          sub={sublineTotal}
          tone="cyan"
          icon={<AlertTriangle />}
          bars={stats.sparkTotal}
          footerLabel={t('cardErrors.stats.footerWindow')}
        />
        <StatCard
          title={t('cardErrors.stats.awaitingReview.label')}
          n={allReports.length > 0 ? stats.awaitingReview : '—'}
          sub={sublineAwaiting}
          tone="amber"
          icon={<Clock />}
          bars={stats.sparkAwaiting}
          footerLabel={t('cardErrors.stats.footerWindow')}
        />
        <StatCard
          title={t('cardErrors.stats.fixedAllTime.label')}
          n={allReports.length > 0 ? stats.fixedAllTime : '—'}
          sub={sublineFixed}
          tone="green"
          icon={<CheckCircle />}
          bars={stats.sparkFixed}
          footerLabel={t('cardErrors.stats.footerWindow')}
        />
        <StatCard
          title={t('cardErrors.stats.medianTimeToFix.label')}
          n={allReports.length > 0 ? stats.medianDisplay : '—'}
          sub={sublineMedian}
          tone="violet"
          icon={<Gauge />}
          bars={stats.sparkMedian}
          footerLabel={t('cardErrors.stats.footerWindow')}
        />
      </section>

      <AdminCardErrorSection />
    </div>
  );
}
