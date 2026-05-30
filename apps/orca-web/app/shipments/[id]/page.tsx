import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ShipmentDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-slate-50/50 min-h-screen">
      <div>
        <Link href="/" className="inline-flex items-center text-sm text-[#005A8C] hover:underline mb-4 font-medium">
          <ArrowLeftIcon className="mr-1.5 h-4 w-4" /> Back to Operations
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Shipment Details</h1>
        <p className="text-sm text-slate-500 mt-1">Detailed routing and risk analysis for ID: {params.id}</p>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>Shipment Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center border-2 border-dashed border-slate-200 rounded-md bg-slate-50 text-slate-400">
            <p>Detailed telemetry and route progression will appear here.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
