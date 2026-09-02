# ORCA Core Restructure

## Problem Statement

How might we restrukturisasi ORCA menjadi `orca-core` (Go data plane + Python AI layer, modular monolith dua service) dan `orca-frontend`, sehingga puluhan sumber input (armada internal, mitra 3PL, kargo udara, traffic, weather, mock) mengalir lewat SATU pipeline event kanonik, demo tetap deterministik, arsitektur live-ready, tanpa overengineering?

## Recommended Direction

**Event Spine + two-tier intelligence + cost atlas + scenario engine.** Redis Streams menjadi tulang punggung: hanya ada 6 tipe event kanonik (`shipment_created`, `pickup`, `hub_in`, `hub_out`, `transit_scan`, `delivery_attempt`). Setiap sumber hanyalah adapter kecil yang menulis ke skema ini; model dan dashboard buta terhadap sumber. Pipeline satu, adapter N.

Intelligence dibagi dua tier: **Go fast tier** (rule-based SLA watcher, carbon calc GLEC, COD flag, agregat bottleneck hub, murni SQL, sub-detik, selalu hidup) dan **Python deep tier** (LightGBM inference via gRPC, NSGA-II optimizer, SHAP, 16-feature contract dipertahankan) yang meng-upgrade skor secara asinkron. Python boleh lambat atau mati, demo tidak pernah kosong.

Biaya diselesaikan lewat **cost atlas**: reference table berversi (tarif air per lane per kg, road per km per kelas kendaraan, toll, fuel surcharge, rate card mitra). Intelijen biaya = lookup atlas x multiplier traffic. Tidak perlu feed biaya real-time.

**Agentic read-only tipis**: LLM menjelaskan risk driver dan menyarankan playbook intervensi, tidak pernah eksekusi aksi. Fallback deterministik (rule-based) saat API LLM down, jadi klaim "orchestrated by Agentic AI" tetap aman saat demo.

## Cara Kerja Intelligence Layer

- **Biaya pesawat**: air leg = lane tariff (atlas) x berat + fuel surcharge; CO2 pakai GLEC air factor per tonne-km. Tidak perlu feed real-time.
- **Long-haul + traffic adaptif**: travel time = base OSMnx x congestion multiplier (traffic sim per koridor per 15 menit). Reroute terpicu saat multiplier x risk naik. Multiplier divisualisasikan di dashboard agar "adaptif" terlihat hidup.
- **Bottleneck**: dwell p95 + inbound queue per hub (fast tier) + corridor congestion index; alert saat threshold.
- **COD failure**: rule flag di fast tier (COD order + riwayat failed attempt + risiko remitansi mitra) -> alert.
- **Hub expansion gap**: agregat SQL demand vs kapasitas per coverage area + heuristic gap, bukan model ML.

## Struktur Repo

```
ORCA/
├── orca-core/
│   ├── proto/orca/v1/          # satu sumber kontrak (Go ⇄ Python, gRPC)
│   ├── services/gateway/       # Go: API, auth, ingest adapters, fast tier,
│   │   └── internal/{api,ingest,store,score,mock,broadcast}
│   ├── services/ai/            # Python: inference, optimizer, features, agent
│   ├── infra/                  # docker-compose, migrasi schema, init-db
│   ├── Makefile
│   └── .env.example
└── orca-frontend/              # Next.js, hanya bicara ke gateway (satu base URL)
```

Dua folder, dua git remote, tanpa CI terpisah untuk kompetisi.

## Checklist Data Mitra (kontrak desain, bukan integrasi nyata)

Per mitra 3PL (J&T, JNE, Wahana, SiCepat, dan sejenisnya):

1. **Master data**: partner id, service tier (ekonomi/reguler/next-day/same-day), coverage kode pos, komitmen SLA per tier, limit berat/dimensi, dukungan COD + siklus remitansi
2. **Rate card**: base + per kg + multiplier zona + fuel surcharge + surcharge remote area -> masuk cost atlas
3. **Event operasional**: manifest/AWB, pickup, scan sortasi, out-for-delivery, delivered/failed + reason code, return-to-origin -> satu mapping ke 6 event kanonik per mitra
4. **Agregat performa**: on-time rate per lane/tier, dwell rata-rata per hub, first-attempt success rate -> fitur historis model (`historical_hub_delay_rate` sudah ada)
5. **Kapasitas**: kapasitas harian per hub/lane, utilisasi -> input hub expansion gap

Sumber lain:

- **Armada internal**: vehicle master (kelas -> GLEC factor), driver, GPS ping (simulasi), hub master, manifest
- **Eksternal**: traffic index (dari scenario engine), weather (Open-Meteo, existing), jadwal + tarif kargo udara per lane + cutoff time, indeks harga BBM, kalender Indonesia (4 fitur existing)
- **GLEC**: faktor emisi per kelas kendaraan sudah ada di tabel; tambah kelas `air_short`/`air_long` untuk leg udara

## Key Assumptions to Validate

- [ ] 6 tipe event cukup untuk semua cerita demo. Test: petakan semua skenario ke 6 tipe; yang tak muat dicatat, tipe tidak ditambah.
- [ ] Traffic sim deterministik terasa adaptif. Test: ETA berubah live saat insiden skenario dipicu.
- [ ] Python service boleh mati tanpa merusak demo. Test: kill service di tengah demo; fast tier tetap memberi skor, UI tetap jalan.
- [ ] LLM fallback mulus. Test: demo dengan API key dicabut.
- [ ] Mock Olist-style cukup meyakinkan. Sudah terbukti di repo lama; jaga kualitas skenario.

## MVP Scope

In: Go gateway (API, auth, ingest, fast tier, scenario engine, persist, broadcast) + Python AI (inference gRPC, optimizer, features) + 6 event kanonik + cost atlas (seed data) + traffic sim + relokasi frontend + agent read-only slice.

## Not Doing (and Why)

- **Per-partner schema lengkap** — maintenance berat; adapter ke 6 event sudah menjual cerita
- **Live traffic API (TomTom/HERE)** — biaya + kerapuhan saat demo; arsitektur tetap live-ready lewat adapter yang sama
- **Agent dengan aksi eksekusi** — guardrail dan scope terlalu besar; read-only sudah membenarkan klaim agentic
- **Migrasi bertahap mempertahankan API FastAPI lama** — rewrite gateway di Go lebih cepat daripada merawat dua kontrak
- **Hub expansion sebagai model ML** — agregat SQL + heuristic gap (demand vs kapasitas) cukup untuk cerita

## Open Questions

- Strategi versioning event schema (cukup satu kolom `schema_version`?)
- SSE atau pertahankan SWR polling di frontend?
- Bahasa output agent (EN/ID)?
- Nama proto package dan module path Go?
