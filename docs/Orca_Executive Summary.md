# Blibli AI-Powered Logistics - Executive Summary

## 1. Technical Architecture Diagram

Berikut adalah rincian arsitektur teknis sistem logistik yang telah dibangun (Orca AI) menyesuaikan skala *enterprise* dan visi "Green & Resilient Logistics Network":

```mermaid
graph TD
    %% Frontend & Clients
    subgraph "Client Applications"
        Web[("ORCA Web Dashboard\n(Next.js / React)")]
        Mobile[("Driver / Hub App\n(React Native / Flutter)")]
    end

    %% API Gateway & Backend
    subgraph "Core Backend Services"
        API[("API Gateway\n(FastAPI)") ]
        Auth[("Auth Service")]
        RouteOpt[("Route Optimization Engine\n(NSGA-II Algorithm)")]
        DelayPred[("SLA Delay Prediction\n(CatBoost / XGBoost)")]
    end

    %% Data Processing & Workers
    subgraph "Asynchronous Workers & Queues"
        Queue[("Message Broker\n(Redis / ARQ / Celery)")]
        Worker1[("Routing Worker")]
        Worker2[("Notification Worker")]
    end

    %% Data Storage
    subgraph "Data Persistence"
        Relational[(PostgreSQL\n(Shipments, Hubs, SLAs))]
        Cache[(Redis Cache)]
    end

    %% External APIs
    subgraph "External Providers"
        Maps[("Stadia Maps / OSMnx\n(Valhalla Routing)")]
        Traffic[("Traffic API")]
        Weather[("Weather API")]
        Comms[("WhatsApp/SMS API\n(Fonnte / Twilio)")]
    end

    %% Connections
    Web -->|HTTPS| API
    Mobile -->|HTTPS| API
    API --> Auth
    API --> RouteOpt
    API --> DelayPred
    
    API -->|Produce Jobs| Queue
    Queue -->|Consume Jobs| Worker1
    Queue -->|Consume Jobs| Worker2
    
    RouteOpt --> Maps
    DelayPred --> Traffic
    DelayPred --> Weather
    Worker2 --> Comms
    
    API --> Relational
    API --> Cache
    Worker1 --> Relational
```

---

## 2. Business Impact Estimation

Berdasarkan benchmark industri dari implementasi AI dalam sektor logistik (*case studies* dari penyedia terkemuka), penerapan Orca AI Routing Optimization diproyeksikan memberikan hasil terukur pada tiga pilar utama Blibli:

### A. Cost Reduction (Optimalisasi Biaya Operasional)
- **15% - 30% Penghematan Bahan Bakar:** Dengan meminimalkan rute kosong (*empty miles*) dan menemukan lintasan terpendek, konsumsi bahan bakar armada dapat ditekan secara signifikan.
- **10% - 25% Reduksi Jarak Tempuh (Mileage):** Berdampak langsung pada penurunan biaya pemeliharaan (*wear and tear*) kendaraan.
- **Efisiensi Perencanaan Rute (30% - 50% lebih cepat):** Proses yang sebelumnya manual oleh dispatcher kini diotomatisasi, mengurangi biaya administratif dan lembur (*overtime*).
- **Proyeksi ROI:** Investasi infrastruktur sistem diprediksi kembali (*Break-Even*) dalam **6 hingga 8 bulan** sejak *rollout* penuh.

### B. Carbon Emission Reduction (Dampak Lingkungan)
- **Penurunan CO2 Sebesar 10% - 30%:** Rute yang optimal berarti mesin lebih jarang *idling* (menyala tanpa jalan) dan jarak lebih pendek, berkontribusi langsung pada target ESG (Environmental, Social, and Governance) Blibli.
- **Pelacakan GLEC Framework:** Sistem telah mengadopsi kalkulasi emisi (kg CO2) per rute dan per tipe kendaraan, memberikan laporan keberlanjutan (*sustainability report*) yang transparan dan *auditable*.

### C. SLA & Customer Service Improvement (Ketahanan & Risiko)
- **Peningkatan On-Time Delivery hingga 25%:** Fitur prediksi SLA Delay membantu mem-flag risiko lebih awal (*proactive alerts*) sehingga manajer hub bisa merespons sebelum kegagalan terjadi.
- **Penurunan Delivery Failures hingga 20%:** Melalui geocoding presisi dari Stadia Maps, akurasi alamat dan pengantaran *first-attempt* akan meningkat drastis.

---

## 3. Rekomendasi Tindakan Selanjutnya

Untuk memaksimalkan *Business Impact* dan menyelesaikan sisa validasi:
1. **Peningkatan Fleet Utilization di Analytics:** Menambahkan matriks visual untuk melihat utilitas kapasitas kargo armada (Volume/Berat yang dibawa vs Kapasitas Maksimal) ke Dashboard Utama (Halaman `/analytics`).
2. **Dashboard Executive Summary Khusus:** Membuat satu layer tab baru bertajuk "Executive Impact" di UI ORCA Web yang otomatis mengkonversi jarak tempuh (km) dan bahan bakar (liter) yang dihemat ke dalam kurs **Rupiah** (*Real-time Savings*).
3. **Penerapan Sistem Queue Penuh (ARQ/Celery):** Memastikan proses *background task* seperti pengiriman notifikasi (SMS/WhatsApp) dan re-routing batch skala besar masuk ke *Message Broker* (Redis) agar tidak memblokir respon *API Gateway*.
