"use client"

import { use } from "react"
import useSWR from "swr"
import { CarbonFootprintCard } from "@/components/shipments/carbon-footprint-card"
import { InterventionActions } from "@/components/shipments/intervention-actions"
import { PredictionMetrics } from "@/components/shipments/prediction-metrics"
import { ShapContributionsCard } from "@/components/shipments/shap-contributions"
import { ShipmentDetailHeader } from "@/components/shipments/shipment-detail-header"
import { ShipmentProfileCard } from "@/components/shipments/shipment-profile-card"
import { SlaRiskGauge } from "@/components/shipments/sla-risk-gauge"
import { apiFetch, type PredictionDetail, type ShipmentDetail } from "@/lib/api"

export default function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const { data: shipment, isLoading: loadingShipment } = useSWR<ShipmentDetail>(
    `/shipments/${id}`,
    apiFetch,
    { refreshInterval: 30000 },
  )

  const {
    data: prediction,
    isLoading: loadingPrediction,
    error: predictionError,
  } = useSWR<PredictionDetail>(`/shipments/${id}/prediction`, apiFetch, { refreshInterval: 30000 })

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-slate-50/50 min-h-screen">
      <ShipmentDetailHeader id={id} shipment={shipment} loading={loadingShipment} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SlaRiskGauge
          score={prediction?.sla_risk_score}
          loading={loadingPrediction}
          error={predictionError}
        />
        <PredictionMetrics
          prediction={prediction}
          loading={loadingPrediction}
          error={predictionError}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ShipmentProfileCard shipment={shipment} loading={loadingShipment} />
        <CarbonFootprintCard carbon={shipment?.carbon} loading={loadingShipment} />
      </div>

      <ShapContributionsCard
        contributions={prediction?.shap_contributions}
        modelVersion={prediction?.model_version}
        loading={loadingPrediction}
      />

      <InterventionActions options={prediction?.intervention_options} />
    </div>
  )
}
