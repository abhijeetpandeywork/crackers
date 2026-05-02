import { useState } from "react";
import { useListEstimates, useConvertEstimateToInvoice } from "@workspace/api-client-react";
import { Link } from "wouter";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FileText, Eye, ArrowRightLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function EstimatesList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const queryParams: any = { page, limit: 50 };
  if (search) queryParams.search = search;
  if (status !== "ALL") queryParams.status = status;

  const { data, isLoading, refetch } = useListEstimates(queryParams);
  const convertMutation = useConvertEstimateToInvoice();

  const handleConvert = async (id: string) => {
    try {
      await convertMutation.mutateAsync({ 
        estimateId: id,
        data: {} // Empty body as per common pattern if not specified
      });
      toast({
        title: "Success",
        description: "Estimate converted to invoice successfully",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to convert estimate to invoice",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Draft": return <Badge variant="secondary">{status}</Badge>;
      case "Sent": return <Badge variant="default" className="bg-blue-500">{status}</Badge>;
      case "Converted": return <Badge variant="default" className="bg-green-500">{status}</Badge>;
      case "Expired": return <Badge variant="destructive">{status}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Estimates</h2>
          <p className="text-muted-foreground">Manage and convert customer estimates.</p>
        </div>
        <Button asChild>
          <Link href="/estimates/new">
            <Plus className="mr-2 h-4 w-4" /> New Estimate
          </Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-lg border">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by customer or estimate #..."
            className="pl-9 w-full bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-[200px]">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Sent">Sent</SelectItem>
              <SelectItem value="Converted">Converted</SelectItem>
              <SelectItem value="Expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : data?.data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-32 text-muted-foreground">
                  No estimates found.
                </TableCell>
              </TableRow>
            ) : (
              data?.data?.map((estimate: any) => (
                <TableRow key={estimate.id}>
                  <TableCell className="font-mono text-sm">{estimate.estimateNumber || estimate.id.slice(0,8)}</TableCell>
                  <TableCell className="font-medium">{estimate.customerName}</TableCell>
                  <TableCell>{new Date(estimate.createdAt).toLocaleDateString('en-IN')}</TableCell>
                  <TableCell>₹{estimate.totalAmount?.toLocaleString('en-IN')}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{estimate.channel || 'Manual'}</Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(estimate.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" asChild title="View">
                        <Link href={`/estimates/${estimate.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      {estimate.status !== 'Converted' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          title="Convert to Invoice"
                          onClick={() => handleConvert(estimate.id)}
                          disabled={convertMutation.isPending}
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
