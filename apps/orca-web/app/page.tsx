"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Page() {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
  const {data, error, isLoading} = useSWR(`${base}/shipments/active`, fetcher, {
    refreshInterval: Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? 15000)
  });

  if (isLoading) return <p>Loading active shipments...</p>;
  if (error) return <p>Failed to load active shipments.</p>;

  return (
    <section>
      <h1 className="mb-4 text-2xl font-semibold">Active Shipments</h1>
      <pre className="overflow-auto rounded border border-slate-200 bg-white p-4 text-xs">
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  );
}
