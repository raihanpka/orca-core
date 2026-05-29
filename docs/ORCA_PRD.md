**ORCA**

Optimized Route and Carbon Analytics

# **1. Ringkasan Eksekutif**

ORCA adalah platform logistics intelligence untuk operasi logistik skala Blibli. Platform ini membantu tim operasional untuk:

* Memprediksi risiko SLA pada level per-shipment

* Memantau kesehatan pengiriman aktif secara real-time

* Membandingkan opsi rute dengan multi-objective tradeoff

* Mendapatkan alert otomatis untuk shipment berisiko tinggi

* Mengukur carbon footprint logistik

MVP dibangun sebagai operational decision-support system, bukan sebagai full Transportation Management System (TMS). Nilai utama ORCA adalah mengkonversi fragmented logistics events menjadi early risk signals yang dapat ditindaklanjuti sebelum keterlambatan terlihat oleh pelanggan.

Pada rilis pertama, ORCA memprioritaskan kesiapan backend dan API. Tim UI/UX dapat menggunakan PRD ini untuk mendesain dashboard screens, table states, forms, charts, badges, alert flows, dan shipment detail views. Tim ML dapat menggunakan PRD ini untuk memahami di mana output model harus muncul dan hasil produk apa yang harus didukung model.

# **2. Konteks Produk**

Jaringan logistik Indonesia menghadapi tekanan dari meningkatnya permintaan e-commerce, biaya logistik yang tinggi, bottleneck infrastruktur, kemacetan perkotaan, dan ekspektasi keberlanjutan (sustainability) yang semakin tinggi. Tim pengiriman sering harus mengoordinasikan gudang, fulfillment hub, mitra pengiriman, dan sumber daya last-mile sembari memenuhi komitmen SLA Same-Day dan Next-Day.

Saat ini, banyak keputusan logistik bersifat reaktif. Operator mengetahui bahwa sebuah shipment berisiko setelah dwell time meningkat, kondisi rute memburuk, atau pengiriman melewati service window yang direncanakan. ORCA mengatasi kesenjangan ini dengan menyediakan predictive risk visibility dan rekomendasi route tradeoff.

# **3. Problem Statement**

Sektor logistik Indonesia menghadapi kompleksitas operasional yang terus meningkat akibat tingginya permintaan e-commerce, bottleneck infrastruktur, dan tekanan sustainability. Kondisi ini menciptakan keterlambatan pengiriman, turunnya kepatuhan SLA, utilisasi armada yang tidak efisien, dan emisi yang lebih tinggi di seluruh jaringan pengiriman multi-hub dan last-mile.

Validasi riset mendukung arah masalah ini:

| Fakta | Detail |
| :---- | :---- |
| Ekonomi digital Indonesia (GMV 2024. | Sekitar USD 90 miliar, dengan e-commerce sekitar USD 65 miliar (sumber: e-Conomy SEA) |
| Biaya logistik | Sekitar 14,3% dari PDB (sumber: Bappenas dan media). Catatan: riset makro historis menunjukkan angka yang lebih tinggi sekitar 23% |
| World Bank LPI 2023 | Indonesia peringkat 61 secara keseluruhan, peringkat 59 untuk timeliness |
| Kerugian kemacetan Jakarta | Sekitar USD 6,1 miliar per tahun (sumber: media) |
| Emisi transport global | Sekitar 8 Gt CO2 pada 2022 (sumber: IEA) |

Product gap yang ada bukan hanya soal perencanaan rute. Gap yang lebih besar adalah tidak adanya logistics intelligence yang bersifat predictive, carbon-aware, dan operator-friendly, yang membantu tim bertindak sebelum risiko SLA menjadi kegagalan yang terlihat oleh pelanggan.

# **4. Kesesuaian Enterprise**

| Kebutuhan Enterprise | Respons ORCA |
| :---- | :---- |
| Kebutuhan visibilitas operasional | Active shipment dashboard, hub metrics, alert list |
| Perlindungan SLA | Delay probability dan risk score per shipment |
| Decision support | Alternatif rute berdasarkan speed, cost, CO2, dan SLA risk |
| Auditability | Prediksi, alert, dan carbon record yang tersimpan |
| ESG reporting | Shipment dan aggregate CO2 analytics |
| Controlled access | Public API token untuk endpoint yang diekspos; internal token untuk engine-only routes |
| Integrasi yang scalable | REST API, SWR polling event stream, Redis event ingestion |
| Cross-functional alignment | Kontrak API yang stabil untuk backend, web, ML, dan product design |

# **5. Goals**

| Goal | Success Metric | MVP Target |
| :---- | :---- | :---- |
| Prediksi risiko pengiriman lebih awal | Shipment aktif menyertakan delay probability dan SLA risk score | 100% baris aktif memiliki nilai risiko (model atau fallback) |
| Kurangi upaya monitoring manual | Operator dapat mengidentifikasi shipment berisiko tinggi dari dashboard | Shipment berisiko tinggi terlihat di halaman pertama |
| Dukung keputusan route tradeoff | Route API mengembalikan beberapa alternatif rute | Minimal 2 alternatif Pareto |
| Tingkatkan visibilitas carbon | Carbon dashboard menampilkan total, rata-rata, harian, dan breakdown per kendaraan | Semua simulated events dapat menghasilkan carbon record |
| Dukung kesiapan UI mockup | Tim product memiliki screen map, data states, dan persyaratan komponen | PRD mencakup persyaratan per screen |
| Lindungi public API | REST API yang diekspos menolak panggilan tanpa token | X-API-Token wajib kecuali health dan docs |

# **6. Non-Goals (Di Luar Cakupan)**

| Non-Goal | Alasan |
| :---- | :---- |
| Full production-grade machine learning | Peran ML akan melatih dan mengkalibrasi model final setelah fondasi backend selesai |
| Full TMS replacement | ORCA adalah decision-support layer, bukan sistem eksekusi dispatch |
| Integrasi carrier nyata | MVP menggunakan simulasi dan API contract |
| Live map-grade routing di skala besar | MVP dapat menggunakan HERE Maps jika dikonfigurasi, dengan fallback logic untuk demo |
| Role-based access control | MVP menggunakan environment token auth sebelum integrasi enterprise identity |
| Full mobile app | Fokus produk adalah web dashboard terlebih dahulu |
| Notifikasi pelanggan otomatis | Alert MVP bersifat operasional dan internal |

# 

# **7. Target Pengguna**

| Pengguna | Pekerjaan Utama | Pain Point | Kebutuhan Produk |
| :---- | :---- | :---- | :---- |
| Manajer Operasional | Monitor SLA jaringan dan risiko exception | Tidak dapat melihat risiko lebih awal dari banyak shipment | Executive dashboard, risk queue, hub status |
| Dispatcher | Memutuskan rute atau intervensi untuk shipment aktif | Keputusan rute manual dan tradeoff tidak jelas | Route optimization screen, shipment detail, risk driver view |
| Supervisor Hub | Mengelola dwell time dan kemacetan lokal | Sulit memisahkan bottleneck lokal dari masalah rute | Hub analytics, congestion badge, dwell indicators |
| Sustainability Officer | Melaporkan dan mengurangi emisi logistik | Carbon tidak terlihat di level shipment | Carbon analytics, vehicle breakdown, daily trend |
| Tim Engineering | Mengintegrasikan event dan API layer | Membutuhkan contract dan aturan environment yang stabil | API summary, auth rules, event flow |
| Tim ML | Melatih model delay produksi | Butuh ekspektasi fitur dan output | Seksi ML handoff dan acceptance criteria |
| UI/UX Designer | Membuat mockup produk | Butuh screens, states, dan user intent yang jelas | Screen requirements, information hierarchy, data states |

# **8. User Personas**

## **8.1 Operations Manager**

| Atribut | Detail |
| :---- | :---- |
| Goal | Menjaga performa SLA tetap stabil di seluruh shipment aktif |
| Frekuensi | Beberapa kali per hari |
| Screen utama | Dashboard |
| Keputusan kunci | Area risiko mana yang perlu perhatian pertama |
| Kondisi sukses | Dapat mengidentifikasi shipment atau masalah hub berisiko tinggi dalam 30 detik |

## **8.2 Dispatcher**

| Atribut | Detail |
| :---- | :---- |
| Goal | Memilih intervensi terbaik untuk shipment berisiko |
| Frekuensi | Terus-menerus selama jam operasional |
| Screen utama | Shipment detail dan route optimizer |
| Keputusan kunci | Apakah perlu reroute, eskalasi masalah hub, atau lanjut rute normal |
| Kondisi sukses | Dapat membandingkan route tradeoff tanpa membaca JSON mentah |

## **8.3 Sustainability Officer**

| Atribut | Detail |
| :---- | :---- |
| Goal | Melacak carbon footprint logistik dan tren |
| Frekuensi | Harian atau mingguan |
| Screen utama | Carbon analytics |
| Keputusan kunci | Tipe kendaraan, tanggal, atau pola rute mana yang berkontribusi CO2 terbesar |
| Kondisi sukses | Dapat mengekspor atau screenshot ringkasan carbon yang jelas untuk pelaporan |

# **9. Key User Journeys**

| Journey | Trigger | Langkah | Hasil yang Diharapkan |
| :---- | :---- | :---- | :---- |
| Monitor risiko aktif | Operator membuka dashboard | Lihat ringkasan, scan tabel, filter high risk, buka detail | Shipment berisiko teridentifikasi |
| Investigasi shipment | Baris high-risk dipilih | Lihat score, risk drivers, event terbaru, suggested action | Operator memahami mengapa shipment berisiko |
| Bandingkan rute | Dispatcher membuka route optimizer | Masukkan stop, submit, review alternatif, pilih rute | Rute terbaik dipilih berdasarkan prioritas bisnis |
| Review carbon | Sustainability officer membuka analytics | Review total CO2, grafik harian, vehicle breakdown | Pola emisi terlihat jelas |
| Terima live alert | Engine mendeteksi high risk | Alert muncul di list atau SWR polling banner | Operator bereaksi tanpa refresh manual |

# **10. Scope**

## **10.1 In Scope**

| Area | Yang Termasuk |
| :---- | :---- |
| Backend API | FastAPI service dengan public dan internal routers |
| Engine | Python service dengan Redis subscription, DB persistence, SWR polling |
| Database | PostgreSQL schema untuk shipments, predictions, alerts, carbon, hub metrics |
| Cache dan events | Redis streams atau pubsub simulation flow |
| Optimization | NSGA-II route optimization melalui pymoo |
| Carbon | Perhitungan carbon berbasis GLEC-aligned |
| Auth | Public API token dan internal API token |
| Rate limit | In-memory public endpoint rate limit untuk MVP |
| Dokumentasi | README, development roadmap, agent guide, PRD |
| Dataset handoff | Lokasi dataset Olist didokumentasikan untuk download manual |

## **10.2 Out of Scope**

| Area | Dikecualikan untuk MVP |
| :---- | :---- |
| Enterprise SSO | OAuth, SAML, LDAP, dan user provisioning |
| Fine-grained roles | Per-user access control dan permission groups |
| Production alert provider hardening | Provider retry queue, template approval, cost governance |
| Real-time driver mobile tracking | GPS mobile app dan driver workflow |
| Carrier settlement | Rekonsiliasi biaya dan alur invoice |
| Customer-facing tracking | Halaman shipment pelanggan yang publik |
| Model retraining automation | Scheduled pipeline dan model governance |

# **11. Asumsi**

| Asumsi | Dampak jika Salah | Rencana Validasi |
| :---- | :---- | :---- |
| Data shipment simulasi bergaya Olist dapat diterima untuk demo MVP | Demo mungkin tidak mencerminkan operasional internal | Ganti dengan data internal yang dianonimkan setelahnya |
| Operator membutuhkan risk ranking lebih dari probabilitas prediksi mentah | UI mungkin menampilkan prioritas yang salah | Validasi dengan product dan operations reviewer |
| Estimasi carbon dapat diterima untuk lapisan visibilitas pertama | Tim ESG mungkin membutuhkan metodologi yang lebih ketat | Tandai sumber faktor GLEC dan metode perhitungan dengan jelas |
| UI akan menjadi web dashboard terlebih dahulu | Kebutuhan mobile mungkin terlewat | Pertahankan responsive layout tapi prioritaskan desktop operations |

# **12. Constraints**

| Constraint | Detail |
| :---- | :---- |
| Waktu | MVP harus memprioritaskan backend yang berjalan dan API siap demo daripada enterprise hardening penuh |
| Data | Dataset harus diunduh secara manual dan tidak boleh di-commit jika besar |
| ML | Pelatihan dan kalibrasi model final ditangani oleh peran ML |
| Security | REST API dan frontend harus tetap dapat diakses, tapi API call memerlukan token |
| Network | PostgreSQL dan Redis tetap internal pada Docker network |
| Tooling | Workflow Python dan ML menggunakan uv, frontend menggunakan pnpm, engine menggunakan Python 3.11 |
| UI design | Mockup harus dapat digunakan untuk review enterprise dashboard, bukan landing page marketing |

# **13. Functional Requirements**

## **13.1 Active Shipment Dashboard**

| ID | Requirement | Priority | Acceptance Criteria |
| :---- | :---- | :---- | :---- |
| FR-001 | Tampilkan active shipments | Must | GET /shipments/active mengembalikan baris shipment dengan status, route fields, ETA, SLA deadline, latest risk, dan carbon |
| FR-002 | Dukung cursor pagination | Must | API menerima cursor dan limit, respons menyertakan next cursor ketika ada baris berikutnya |
| FR-003 | Generate fallback prediction secara batch | Must | Baris prediksi yang hilang ditangani tanpa perilaku write-per-row |
| FR-004 | Tampilkan total jumlah at-risk | Should | Respons menyertakan count atau metadata untuk mendukung summary card |
| FR-005 | Wajib public token | Must | Request tanpa X-API-Token ditolak |

## 

## 

## **13.2 Shipment Detail dan Explainability**

| ID | Requirement | Priority | Acceptance Criteria |
| :---- | :---- | :---- | :---- |
| FR-006 | Tampilkan prediksi terbaru | Must | Detail endpoint mengembalikan delay probability, SLA risk score, prediction time, dan model version |
| FR-007 | Tampilkan risk drivers | Should | Endpoint mengembalikan SHAP-style contributions bila tersedia, fallback deterministik jika tidak |
| FR-008 | Tampilkan recommended action | Should | UI dapat memetakan risk level ke panduan operasional |
| FR-009 | Tampilkan carbon record terbaru | Should | Detail screen dapat menampilkan estimasi CO2 bila tersedia |

## **13.3 Internal Prediction**

| ID | Requirement | Priority | Acceptance Criteria |
| :---- | :---- | :---- | :---- |
| FR-010 | Prediksi dari shipment event | Must | POST /internal/predict menerima event payload dan mengembalikan probability dan risk |
| FR-011 | Lindungi internal endpoint | Must | Endpoint memerlukan X-Internal-Token |
| FR-012 | Hindari duplikasi persistence | Must | Engine adalah writer untuk real-time prediction persistence |
| FR-013 | Fallback ketika MLflow model tidak ada | Must | Service mengembalikan fallback prediksi deterministik alih-alih gagal saat startup |

## **13.4 Real-Time Engine**

| ID | Requirement | Priority | Acceptance Criteria |
| :---- | :---- | :---- | :---- |
| FR-014 | Subscribe ke Redis shipment events | Must | Engine menerima simulation events dari Redis |
| FR-015 | Upsert live shipment sebelum prediction insert | Must | Prediction insert tidak gagal karena shipment FK yang hilang |
| FR-016 | Simpan prediksi sekali | Must | Satu baris prediksi ditulis per event yang diproses |
| FR-017 | Simpan carbon record | Must | Event flow membuat carbon record untuk analytics |
| FR-018 | Broadcast SWR polling event | Must | UI dapat menerima update prediksi atau alert secara live |
| FR-019 | Publish hub metrics | Should | Hub dashboard dapat menampilkan metrik dwell dan congestion |

## **13.5 Route Optimization**

| ID | Requirement | Priority | Acceptance Criteria |
| :---- | :---- | :---- | :---- |
| FR-020 | Optimasi alternatif rute | Must | POST /optimize/route mengembalikan alternatif rute |
| FR-021 | Gunakan multi-objective optimization | Must | Implementasi menggunakan NSGA-II melalui pymoo |
| FR-022 | Bandingkan objectives | Must | Setiap alternatif mencakup ETA, fuel cost, CO2, SLA risk, dan label |
| FR-023 | Dukung demo fallback | Should | API tetap dapat merespons ketika external map provider tidak tersedia |

## **13.6 Carbon Analytics**

| ID | Requirement | Priority | Acceptance Criteria |
| :---- | :---- | :---- | :---- |
| FR-024 | Hitung CO2 shipment | Must | Formula carbon menggunakan jarak, muatan, dan emission factor |
| FR-025 | Agregasi carbon | Must | API mengembalikan total CO2, rata-rata CO2, breakdown harian, dan breakdown per kendaraan |
| FR-026 | Dukung charting dashboard | Should | Bentuk respons dapat langsung mendukung line chart dan breakdown table |

## **13.7 Alerts**

| ID | Requirement | Priority | Acceptance Criteria |
| :---- | :---- | :---- | :---- |
| FR-027 | Dispatch alert high-risk | Must | Engine memanggil alert dispatch saat risk threshold terpenuhi |
| FR-028 | Lindungi dispatch endpoint | Must | POST /alerts/dispatch memerlukan internal token |
| FR-029 | Cegah duplicate alerts | Must | Shipment yang sama tidak di-alert berulang dalam dedupe window |
| FR-030 | Simpan alert tanpa provider credentials | Must | Kredensial Fonnte yang hilang tidak merusak pembuatan alert record |

# **14. Non-Functional Requirements**

| Kategori | Requirement | MVP Target |
| :---- | :---- | :---- |
| Performance | Dashboard query harus menghindari perilaku N+1 | Active shipment list menggunakan batched prediction dan carbon lookup |
| Reliability | Engine tidak boleh mem-broadcast kegagalan DB write sebagai event sukses | Broadcast terjadi setelah persistence yang diperlukan berhasil |
| Security | REST API yang diekspos tidak boleh anonim | X-API-Token wajib untuk public endpoints |
| Security | Internal routes tidak boleh dapat dipanggil tanpa internal token | X-Internal-Token wajib |
| Maintainability | Tooling harus konsisten | uv untuk Python, pnpm untuk frontend, Go modules untuk engine |
| Observability | Services harus mengekspos status health | GET /health tetap terbuka |
| UX readiness | Respons API harus cukup stabil untuk mockup | Endpoint summary dan data objects terdokumentasi |
| Accessibility | Dashboard harus terbaca tanpa mengandalkan warna saja | Badge membutuhkan label teks dan dukungan icon di UI |

# **15. Ringkasan Data Model**

| Entity | Tujuan | Key Fields untuk UI |
| :---- | :---- | :---- |
| Shipment | Unit operasional utama | id, origin, destination, status, ETA, SLA deadline, vehicle type |
| Prediction | Output risiko | delay probability, SLA risk score, risk level, model version, created at |
| Carbon record | Estimasi emisi | CO2 kg, distance km, load ton, vehicle type, factor source |
| Alert | Eskalasi operasional | shipment id, risk score, channel, status, message, sent at |
| Hub metric | Kesehatan hub lokal | hub id, inbound volume, dwell time, congestion score |
| Route alternative | Opsi yang dioptimasi | stop order, ETA, distance, cost, CO2, SLA risk, label |

# **16. Ringkasan API Contract**

| Endpoint | Method | Access | Penggunaan UI |
| :---- | :---- | :---- | :---- |
| /health | GET | Open | Indikator kesehatan service |
| /shipments/active | GET | Public token | Tabel shipment dashboard |
| /shipments/{id}/prediction | GET | Public token | Risk panel pada shipment detail |
| /optimize/route | POST | Public token | Screen route optimizer |
| /analytics/carbon | GET | Public token | Carbon analytics dashboard |
| /analytics/hubs | GET | Public token | Hub health dashboard |
| /alerts/recent | GET | Public token | Alert list dan alert banner |
| /alerts/dispatch | POST | Internal token | Engine alert workflow |
| /internal/predict | POST | Internal token | Engine prediction workflow |

# **17. UI Information Architecture**

| Navigation Item | Screen | Pertanyaan Utama yang Dijawab |
| :---- | :---- | :---- |
| Dashboard | Shipment overview | Shipment mana yang perlu perhatian sekarang? |
| Optimizer | Route Optimizer | Rute mana yang memiliki tradeoff terbaik untuk SLA, Cost, dan CO2? |
| Analytics | Carbon Dashboard | Seberapa besar emisi logistik kita hari ini? |
| Hubs | Hub Status | Bagaimana kondisi antrean dan kepadatan hub lokal? |

(Catatan: UI difokuskan pada 4 halaman utama untuk MVP: Dashboard, Hubs, Route Optimizer, dan Carbon Analytics. Layar tambahan seperti Shipment Detail view atau Alert view khusus ditiadakan/disederhanakan untuk MVP.)

# **18. Screen Requirements untuk UI/UX**

## **18.1 Dashboard**

| Component | Konten | Perilaku |
| :---- | :---- | :---- |
| Summary metric row | Active shipments, high-risk shipments, average risk, total CO2 | Update saat refresh dan SWR polling events |
| Risk queue table | Shipment id, origin, destination, ETA, SLA deadline, risk badge, status | Sort berdasarkan risk tertinggi secara default |
| Alert banner | Alert high-risk terbaru | Muncul hanya ketika alert terbaru ada |
| Hub status strip | Hub id, dwell time, congestion score | Link ke hub analytics |

**Panduan desain Dashboard:**

| Item | Panduan |
| :---- | :---- |
| Layout | Enterprise operations dashboard, padat tapi mudah dibaca |
| Visual style | Minimal, black and white base, warna status yang terkendali |
| Prioritas | Item berisiko tinggi harus terlihat tanpa scroll di desktop |
| Empty state | "No active shipments" dengan aksi refresh |
| Error state | Tampilkan error API atau token secara ringkas |

## **18.2 Shipment Detail**

| Component | Konten | Perilaku |
| :---- | :---- | :---- |
| Shipment header | Shipment id, rute, status, SLA deadline | Fixed top section |
| Risk panel | Delay probability, SLA risk score, risk level | Menggunakan label dan warna bersamaan |
| Risk drivers | Daftar kontribusi fitur | Tampilkan kontributor teratas terlebih dahulu |
| Event timeline | Created, picked up, hub update, in transit, predicted risk | Kronologis |
| Intervention panel | Suggested action | Berdasarkan risk level dan kondisi rute |
| Carbon panel | CO2 kg, jarak, vehicle type | Link ke carbon dashboard |

## **18.3 Route Optimizer**

| Component | Konten | Perilaku |
| :---- | :---- | :---- |
| Stop input | Origin, destination, optional waypoints | Mendukung jumlah stop demo yang kecil |
| Objective selector | Fastest, lowest cost, lowest CO2, balanced | Mengubah rute yang di-highlight |
| Route table | Label, ETA, jarak, cost, CO2, SLA risk | Diurutkan berdasarkan objective yang dipilih |
| Pareto chart | Cost vs CO2 atau ETA vs risk | Membantu membandingkan tradeoff |
| Selected route detail | Stop order dan ringkasan metrik | Ringkasan keputusan yang jelas |

## **18.4 Carbon Analytics**

| Component | Konten | Perilaku |
| :---- | :---- | :---- |
| Carbon summary | Total CO2, rata-rata CO2 per shipment | Memperhatikan date filter |
| Daily trend | CO2 per hari | Line atau bar chart |
| Vehicle breakdown | Vehicle type, jumlah shipment, CO2 | Tabel dan chart |
| Method note | Formula dan sumber emission factor | Catatan teknis singkat |

## **18.5 Hub Analytics**

| Component | Konten | Perilaku |
| :---- | :---- | :---- |
| Hub grid | Hub id, inbound count, dwell time, congestion score | Sort berdasarkan congestion |
| Congestion badge | Low, medium, high | Label tidak boleh mengandalkan warna saja |
| Hub detail panel | Tren dan shipment yang terpengaruh | Dibuka dari hub yang dipilih |

## **18.6 Alerts**

| Component | Konten | Perilaku |
| :---- | :---- | :---- |
| Alert list | Shipment id, risk score, channel, status, waktu created | Terbaru pertama |
| Alert detail | Message, dedupe state, provider result | Membantu debugging |
| Filter | Status dan risk level | Berguna untuk operations review |

# **19. UI States**

| State | Requirement |
| :---- | :---- |
| Loading | Gunakan skeleton rows atau compact loading state |
| Empty | Jelaskan bahwa tidak ada data untuk filter yang dipilih |
| Unauthorized | Minta pengguna memeriksa environment API token |
| Rate limited | Tampilkan pesan retry tanpa merusak layout |
| Partial data | Tampilkan field yang tersedia dan tandai nilai yang hilang sebagai "N/A" |
| High risk | Gunakan label teks, icon, dan prioritas visual yang kuat |
| Offline API polling | Tampilkan indikator error network/terputus |

# **20. Design Principles**

| Prinsip | Detail |
| :---- | :---- |
| Operational first | Prioritaskan scanning, comparison, dan action daripada dekorasi |
| Minimal visual system | Gunakan hitam, putih, abu-abu, dan warna semantik yang terbatas |
| Dense but readable | Tabel dan panel harus mendukung monitoring yang sering |
| Explainable AI | Risk score harus dipasangkan dengan alasan dan timestamp |
| Decision clarity | Alternatif rute harus menampilkan tradeoff, bukan hanya satu jawaban "terbaik" |
| Trustworthy data | Tampilkan model version, prediction time, dan missing data state |
| Accessible status | Jangan hanya mengandalkan merah, kuning, dan hijau |

# **21. Contoh UI**

| Konteks | Copy |
| :---- | :---- |
| Judul dashboard | Operations Dashboard |
| Badge high-risk | High Risk |
| Badge medium-risk | Medium Risk |
| Badge low-risk | Low Risk |
| Tabel shipment kosong | No active shipments found |
| API tidak terotorisasi | API token is missing or invalid |
| Heading hasil rute | Route Alternatives |
| Catatan metode carbon | CO2 is estimated from distance, load, and vehicle emission factor |

# **22. Security dan Network Requirements**

| Area | Requirement |
| :---- | :---- |
| REST API | Diekspos untuk Postman dan browser testing, tapi dilindungi oleh X-API-Token |
| Frontend | Menggunakan NEXT.PUBLIC.API.TOKEN untuk akses API MVP |
| Internal API | Engine-only routes memerlukan X-Internal-Token |
| Redis | Hanya internal Docker network, tidak ada host port exposure |
| PostgreSQL | Hanya internal Docker network, tidak ada host port exposure |
| HTTP CORS | Permisif di development, origin allowlist di non-development |
| CORS | Tetap permisif untuk fleksibilitas frontend MVP |
| Secrets | Hanya root .env, secret nyata tidak boleh di-commit |

# **23. Data dan Dataset Requirements**

| Area Dataset | Requirement |
| :---- | :---- |
| Raw Olist data | Tempatkan file CSV yang diunduh di bawah data/raw/olist/ |
| Tracked files | Simpan hanya README atau placeholder di raw data folder |
| Large CSV | Jangan commit raw CSV ke Git |
| Seeded data | Seed database dari data yang di-ingest dan di-transform |
| Simulation | Replay shipment events dari baris fitur yang sudah disiapkan |
| Internal data (masa depan) | Ganti data proxy publik dengan data operasional yang dianonimkan setelah MVP |

# **24. ML Handoff Requirements**

| Item | Requirement untuk Tim ML |
| :---- | :---- |
| Model type | Latih model prediksi keterlambatan yang dikalibrasi; LightGBM baseline dapat diterima |
| Target | Prediksi delay probability dan SLA risk shipment |
| Features | Gunakan jarak shipment, timing, rute, hub, vehicle, dan fitur turunan event |
| Output | delay.probability, sla.risk.score, risk.level, model.version |
| Explainability | Hasilkan nilai kontribusi SHAP yang kompatibel dengan shipment detail UI |
| Calibration | Validasi kalibrasi probabilitas dan risk threshold |
| Registry | Daftarkan model produksi melalui MLflow saat siap |
| Evaluation | Laporkan AUC, precision/recall untuk high-risk class, calibration metric, dan confusion matrix |
| Product test | Konfirmasi bahwa output model menghasilkan ranking yang berguna untuk operations dashboard |

# **25. Analytics Requirements**

| Metrik | Definisi | Screen |
| :---- | :---- | :---- |
| Active shipments | Jumlah shipment yang saat ini berstatus aktif | Dashboard |
| High-risk shipments | Jumlah shipment aktif di atas threshold high-risk | Dashboard |
| Average SLA risk | Rata-rata risk score di seluruh shipment aktif | Dashboard |
| Total CO2 | Jumlah carbon record dalam periode yang dipilih | Carbon |
| Average CO2 per shipment | Total CO2 dibagi jumlah shipment | Carbon |
| Hub congestion score | Score dari sinyal dwell dan inbound | Hubs |
| Alert count | Jumlah alert dalam periode yang dipilih | Alerts |

# **26. Ringkasan Acceptance Criteria**

| Area | MVP Acceptance Criteria |
| :---- | :---- |
| API | Public endpoints berfungsi dengan token dan menolak token yang hilang |
| Engine | Redis event dapat membuat shipment upsert, prediction row, carbon row, dan SWR polling broadcast |
| Prediction | Internal prediction mengembalikan output deterministik bahkan jika production model tidak ada |
| Dashboard data | Active shipment endpoint menghindari pola N+1 dan mendukung batch fallback |
| Route | Route optimizer mengembalikan beberapa alternatif dengan tradeoff yang terukur |
| Carbon | Analytics endpoint mengembalikan total, rata-rata, daily trend, dan vehicle breakdown |
| Alerts | Alert dispatch terlindungi, idempoten, dan dapat persist tanpa provider credentials |
| Docs | README dan .docs menjelaskan setup dengan uv, pnpm, Go, root .env, dan lokasi dataset |

# **27. Risiko dan Mitigasi**

| Risiko | Dampak | Mitigasi |
| :---- | :---- | :---- |
| Data proxy publik tidak mencerminkan logistik internal | Model dan demo mungkin tidak mencerminkan operasional nyata | Tandai sebagai keterbatasan MVP, ganti dengan data anonim setelahnya |
| Token auth tidak cukup untuk enterprise production | Security review dapat memblokir deployment produksi | Tambahkan SSO, RBAC, audit log, secret manager di post-MVP |
| Route optimization kurang akurasi traffic live | Rekomendasi mungkin kurang realistis | Integrasikan HERE Maps atau data routing internal bila tersedia |
| Estimasi carbon bersifat perkiraan | ESG reporting mungkin memerlukan metodologi yang lebih ketat | Dokumentasikan formula, sumber faktor, dan asumsi |
| Statistik churn konsumen tidak bersumber primer | Klaim proposal bisa dipertanyakan | Gunakan insight reliabilitas yang terverifikasi atau temukan sumber langsung sebelum pitch |
| Konfigurasi CORS asal memblokir lingkungan non-dev | Frontend mungkin gagal di staging | Pertahankan konfigurasi ALLOWED_ORIGINS yang eksplisit di root .env |

# **28. Validasi Riset dan Kesenjangan**

| Klaim | Status | Keputusan Produk |
| :---- | :---- | :---- |
| Ekonomi digital Indonesia mencapai sekitar USD 90B GMV pada 2024 | Divalidasi oleh sumber e-Conomy SEA | Gunakan untuk membenarkan meningkatnya permintaan logistik |
| E-commerce berkontribusi sekitar USD 65B GMV | Divalidasi oleh sumber e-Conomy SEA | Gunakan untuk menghubungkan pertumbuhan digital commerce dengan beban logistik |
| Biaya logistik sekitar 14,3% dari PDB | Divalidasi oleh Bappenas dan sumber media | Gunakan framing kebijakan terkini |
| Biaya logistik sekitar 23% dari PDB | Konteks riset historis | Hindari menyajikan sebagai angka tahun yang sama |
| Indonesia LPI 2023 kelemahan timeliness | Divalidasi dengan koreksi | Gunakan timeliness rank 59 bukan 62 |
| Kerugian kemacetan Jakarta sekitar USD 6,1B per tahun | Divalidasi oleh sumber media | Gunakan sebagai konteks risiko operasional urban |
| Emisi transport bersifat material | Divalidasi oleh IEA | Gunakan sebagai motivasi ESG |
| 25% berhenti membeli setelah satu keterlambatan | Butuh sumber langsung yang lebih kuat | Jangan gunakan sebagai klaim keras final sampai diverifikasi |

# 

# 

# **29. Open Questions**

| Pertanyaan | Owner | Dibutuhkan Sebelum |
| :---- | :---- | :---- |
| Threshold SLA apa yang harus mendefinisikan risiko low, medium, dan high? | Product dan operations | UI final dan kalibrasi model |
| Label intervensi operasional mana yang valid untuk workflow Blibli? | Product dan operations | Desain shipment detail |
| Sumber carbon factor mana yang harus digunakan untuk pelaporan final? | Sustainability dan ML | Output ESG |
| Apakah route optimizer harus menampilkan map preview di MVP atau tabel terlebih dahulu? | Product dan UI/UX | Implementasi frontend |
| Data apa yang dapat dianonimkan dengan aman untuk validasi post-MVP? | Engineering dan stakeholder | Peningkatan model |

