"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, MapPinIcon, TruckIcon, CalendarIcon, PackageIcon, AlertCircleIcon, Loader2Icon, CheckCircle2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { API_BASE, API_TOKEN } from "@/lib/api"

export default function NewShipmentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    origin_hub_id: "hub_jakarta_selatan",
    destination_zone: "",
    customer_lat: "-6.5960",
    customer_lng: "106.7970",
    vehicle_type: "van_diesel",
    load_weight_kg: "50",
    item_count: "2",
    sla_deadline: "",
  })

  // Pre-fill SLA deadline to +2 days from now to ensure valid input
  useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 2)
    // format as YYYY-MM-DDThh:mm
    const tzoffset = d.getTimezoneOffset() * 60000; //offset in milliseconds
    const localISOTime = (new Date(d.getTime() - tzoffset)).toISOString().slice(0,16);
    setFormData(prev => ({ ...prev, sla_deadline: localISOTime }))
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validate SLA is not in the past
    const sla = new Date(formData.sla_deadline)
    if (sla <= new Date()) {
      setError("SLA Deadline must be in the future.")
      setLoading(false)
      return
    }

    try {
      const payload = {
        origin_hub_id: formData.origin_hub_id,
        destination_zone: formData.destination_zone,
        customer_lat: parseFloat(formData.customer_lat),
        customer_lng: parseFloat(formData.customer_lng),
        vehicle_type: formData.vehicle_type,
        load_weight_kg: parseFloat(formData.load_weight_kg),
        item_count: parseInt(formData.item_count),
        sla_deadline: new Date(formData.sla_deadline).toISOString()
      }

      const res = await fetch(`${API_BASE}/shipments/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_TOKEN}`
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "Failed to create shipment")
      }

      setSuccess(true)
      setTimeout(() => {
        router.push("/")
      }, 2000)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Manual Entry: Add Shipment</h2>
        <Button variant="outline" onClick={() => router.push("/")}>
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
      
      <p className="text-muted-foreground">
        Masukkan data pengiriman manual. ORCA AI akan otomatis menghitung jarak asli di jalan raya (menggunakan GraphML Peta), memprediksi delay, dan menghitung emisi karbon GLEC.
      </p>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md flex items-center gap-2">
          <AlertCircleIcon className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 text-green-700 border border-green-200 rounded-md flex items-center gap-2">
          <CheckCircle2Icon className="w-5 h-5" />
          <span>Shipment successfully created! Model is generating predictions. Redirecting...</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Shipment Details</CardTitle>
          <CardDescription>All fields are required to run the AI delay predictor and route calculator.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-8">
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><MapPinIcon className="w-4 h-4 text-blue-500" /> Origin Hub</Label>
                <Select value={formData.origin_hub_id} onValueChange={(v) => v && setFormData({...formData, origin_hub_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Origin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hub_jakarta_selatan">Hub Jakarta Selatan</SelectItem>
                    <SelectItem value="hub_jakarta_utara">Hub Jakarta Utara</SelectItem>
                    <SelectItem value="hub_bogor">Hub Bogor</SelectItem>
                    <SelectItem value="hub_depok">Hub Depok</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><MapPinIcon className="w-4 h-4 text-green-500" /> Destination Label (Desa/Kecamatan)</Label>
                <Input required placeholder="e.g. Dramaga, Bogor" value={formData.destination_zone} onChange={(e) => setFormData({...formData, destination_zone: e.target.value})} />
              </div>

              <div className="space-y-2">
                <Label>Destination Latitude (LU/LS)</Label>
                <Input required type="number" step="any" placeholder="-6.5960" value={formData.customer_lat} onChange={(e) => setFormData({...formData, customer_lat: e.target.value})} />
              </div>

              <div className="space-y-2">
                <Label>Destination Longitude (BT/BB)</Label>
                <Input required type="number" step="any" placeholder="106.7970" value={formData.customer_lng} onChange={(e) => setFormData({...formData, customer_lng: e.target.value})} />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><TruckIcon className="w-4 h-4 text-amber-500" /> Vehicle Type</Label>
                <Select value={formData.vehicle_type} onValueChange={(v) => v && setFormData({...formData, vehicle_type: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="van_diesel">Diesel Van (&lt; 3.5t)</SelectItem>
                    <SelectItem value="truck_lt35t">Light Truck (&lt; 3.5t)</SelectItem>
                    <SelectItem value="truck_35_75t">Medium Truck (3.5 - 7.5t)</SelectItem>
                    <SelectItem value="truck_gt75t">Heavy Truck (&gt; 7.5t)</SelectItem>
                    <SelectItem value="scooter_electric">EV Scooter (Last Mile)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><CalendarIcon className="w-4 h-4 text-purple-500" /> SLA Deadline</Label>
                <Input required type="datetime-local" value={formData.sla_deadline} onChange={(e) => setFormData({...formData, sla_deadline: e.target.value})} />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><PackageIcon className="w-4 h-4 text-slate-500" /> Total Weight (kg)</Label>
                <Input required type="number" min="0.1" step="0.1" value={formData.load_weight_kg} onChange={(e) => setFormData({...formData, load_weight_kg: e.target.value})} />
              </div>

              <div className="space-y-2">
                <Label>Item Count (boxes/packages)</Label>
                <Input required type="number" min="1" step="1" value={formData.item_count} onChange={(e) => setFormData({...formData, item_count: e.target.value})} />
              </div>

            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-4 border-t p-6 mt-8 bg-slate-50/50">
            <Button variant="ghost" type="button" onClick={() => router.push("/")} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? <Loader2Icon className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2Icon className="w-4 h-4 mr-2" />}
              Save & Calculate AI Metrics
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
