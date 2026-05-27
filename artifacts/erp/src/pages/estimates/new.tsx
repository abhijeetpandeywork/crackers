import { useState, useEffect } from "react";
import { formatVariantLabel } from "@/lib/variant-label";
import { 
  useListCustomers, 
  useListAgents, 
  useListProducts, 
  useResolveProductPrice, 
  useCreateEstimate,
  type Product,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Loader2, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, ChevronRight, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://api.localhost:8000";

type MatchedItem = {
  productId: string;
  productName: string;
  variantId: string;
  variantSize: string;
  qty: number;
  resolvedPrice: number;
  resolutionReason: string;
  bulkRateApplied: boolean;
  amount: number;
  gstRate: number | null;
  hsnCode: string | null;
};

type UnmatchedItem = {
  code: string;
  name: string;
  qty: number;
  reason: string;
};

export default function NewEstimate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [customerId, setCustomerId] = useState<string>("");
  const [agentId, setAgentId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [taxMode, setTaxMode] = useState<"inclusive" | "exclusive">("exclusive");
  const [activeTab, setActiveTab] = useState<"single" | "bulk">("single");

  type EstimateLine = {
    productId: string;
    variantId: string;
    qty: number;
    unitPrice: number;
    total: number;
    variantLabel: string;
    tier?: string;
  };
  const [items, setItems] = useState<EstimateLine[]>([]);

  // Bulk Importer State
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [bulkFormat, setBulkFormat] = useState<"brochure" | "mapping">("brochure");
  
  // Custom Mapping columns
  const [codeCol, setCodeCol] = useState<string>("");
  const [qtyCol, setQtyCol] = useState<string>("");

  // Final Parsed Items
  const [parsedMatched, setParsedMatched] = useState<MatchedItem[]>([]);
  const [parsedUnmatched, setParsedUnmatched] = useState<UnmatchedItem[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  const { data: customers } = useListCustomers({ limit: 100 });
  const { data: agents } = useListAgents({ limit: 100 });
  const { data: products } = useListProducts({ limit: 1000 });

  const createEstimateMutation = useCreateEstimate();

  const addItem = () => {
    setItems([...items, { productId: "", variantId: "", qty: 1, unitPrice: 0, total: 0, variantLabel: "", tier: "" }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const replaceItem = (index: number, value: EstimateLine) => {
    const newItems = [...items];
    newItems[index] = value;
    setItems(newItems);
  };

  // Tax calculations for Manual Cart
  const getProductGst = (productId: string) => {
    const p = products?.data?.find(x => x.id === productId);
    return (p as any)?.gstRate ?? 18; // default rate
  };

  const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
  
  // Calculated taxable, cgst, sgst, total
  let finalTaxable = 0;
  let finalCgst = 0;
  let finalSgst = 0;
  let finalTotal = 0;

  if (taxMode === "inclusive") {
    finalTotal = subtotal;
    items.forEach(item => {
      const gst = getProductGst(item.productId);
      const lineTaxable = item.total / (1 + gst / 100);
      finalTaxable += lineTaxable;
    });
    finalCgst = (finalTotal - finalTaxable) / 2;
    finalSgst = (finalTotal - finalTaxable) / 2;
  } else {
    items.forEach(item => {
      const gst = getProductGst(item.productId);
      finalTaxable += item.total;
      const lineTax = item.total * (gst / 100);
      finalCgst += lineTax / 2;
      finalSgst += lineTax / 2;
    });
    finalTotal = finalTaxable + finalCgst + finalSgst;
  }

  // File Upload Handlers
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const droppedFile = e.target.files?.[0];
    if (!droppedFile) return;

    setFile(droppedFile);
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append("file", droppedFile);

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/estimates/bulk-parse?headers=true`, {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      const data = await res.json();
      if (data.success) {
        setSheetNames(data.sheets || []);
        setSelectedSheet(data.selectedSheet || "");
        setSheetHeaders(data.headers || []);
        
        // Auto-detect columns
        const detectedCode = data.headers.find((h: string) => h.toLowerCase().includes("code"));
        const detectedQty = data.headers.find((h: string) => h.toLowerCase().includes("qty") || h.toLowerCase().includes("needed") || h.toLowerCase().includes("quantity"));
        
        if (detectedCode) setCodeCol(detectedCode);
        if (detectedQty) setQtyCol(detectedQty);

        toast({ title: "File uploaded successfully", description: `Found ${data.sheets.length} worksheets.` });
      } else {
        toast({ title: "Failed to read file headers", description: data.error?.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Network error", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleParseSheet = async () => {
    if (!file) return;

    setIsParsing(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("format", bulkFormat);
    formData.append("sheetName", selectedSheet);
    
    const selectedCust = customers?.data?.find(c => c.id === customerId);
    formData.append("type", selectedCust?.customerType === "WHOLESALE" ? "WHOLESALE" : selectedCust?.customerType === "AGENT_CUSTOMER" ? "AGENT" : "RETAIL");

    if (bulkFormat === "mapping") {
      formData.append("codeColumn", codeCol);
      formData.append("qtyColumn", qtyCol);
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/estimates/bulk-parse`, {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      const data = await res.json();
      if (data.success) {
        setParsedMatched(data.matchedItems || []);
        setParsedUnmatched(data.unmatchedItems || []);
        toast({ title: "Parsing complete", description: `Matched ${data.matchedItems.length} lines, unmatched ${data.unmatchedItems.length} lines.` });
      } else {
        toast({ title: "Parsing failed", description: data.error?.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Network error", description: err.message, variant: "destructive" });
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      toast({ title: "Error", description: "Please select a customer", variant: "destructive" });
      return;
    }

    const payloadItems = activeTab === "single"
      ? items.map(item => ({ productId: item.productId, variantId: item.variantId, qty: item.qty }))
      : parsedMatched.map(item => ({ productId: item.productId, variantId: item.variantId, qty: item.qty }));

    if (payloadItems.length === 0) {
      toast({ title: "Error", description: "Cart is empty. Please add items or parse spreadsheet first.", variant: "destructive" });
      return;
    }

    const selectedCust = customers?.data?.find(c => c.id === customerId);
    const estType = selectedCust?.customerType === "WHOLESALE" ? "WHOLESALE" : selectedCust?.customerType === "AGENT_CUSTOMER" ? "AGENT" : "RETAIL";

    try {
      await createEstimateMutation.mutateAsync({
        data: {
          type: estType,
          customerId,
          agentId: agentId || undefined,
          items: payloadItems,
          taxMode,
          notes,
        } as any
      });
      toast({ title: "Success", description: "Estimate created successfully" });
      setLocation("/estimates");
    } catch (error) {
      toast({ title: "Error", description: "Failed to create estimate", variant: "destructive" });
    }
  };

  const downloadBrochureTemplate = () => {
    const rows = [
      ["Product Code", "Product Name", "Category", "Brand", "Unit Price (₹)", "Quantity Required"]
    ];

    if (products?.data && products.data.length > 0) {
      products.data.forEach(p => {
        const variants = (p.variants ?? []) as any[];
        const variant = variants[0]; // first variant
        const brand = variant?.brand || "Standard";
        const price = variant?.prices?.retailEst || 0;
        
        rows.push([
          p.code ?? "",
          p.name ?? "",
          p.category ?? "",
          brand,
          price.toFixed(2),
          "0" // Default quantity is 0
        ]);
      });
    } else {
      // Fallback dummy data if products aren't loaded yet
      rows.push(
        ["ARL001", "Sky Shot 60 Shells", "Aerial", "Standard", "150.00", "50"],
        ["ARL002", "Multi Colour Aerial", "Aerial", "Sri Kaliswari", "200.00", "20"],
        ["SPK001", "Silver Sparkler 30cm", "Sparkler", "Standard", "30.00", "100"],
        ["SPK002", "Golden Sparkler 50cm", "Sparkler", "Coronation", "45.00", "50"],
        ["GND001", "Classic Flower Pot", "Ground", "Standard", "50.00", "30"]
      );
    }

    const csvContent = rows
      .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Rathinam_Brochure_Order_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadCustomTemplate = () => {
    const rows = [
      ["Item Code", "Product Name", "Quantity Needed"]
    ];

    if (products?.data && products.data.length > 0) {
      products.data.slice(0, 5).forEach(p => {
        rows.push([
          p.code ?? "",
          p.name ?? "",
          "10" // Some dummy quantity
        ]);
      });
    } else {
      rows.push(
        ["ARL001", "Sky Shot 60 Shells", "10"],
        ["ARL002", "Multi Colour Aerial", "5"],
        ["SPK001", "Silver Sparkler 30cm", "15"]
      );
    }

    const csvContent = rows
      .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Rathinam_Custom_Order_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bulk parsed totals
  const bulkSubtotal = parsedMatched.reduce((s, i) => s + i.amount, 0);
  let bulkTaxable = 0;
  let bulkCgst = 0;
  let bulkSgst = 0;
  let bulkTotal = 0;

  if (taxMode === "inclusive") {
    bulkTotal = bulkSubtotal;
    parsedMatched.forEach(item => {
      const lineTaxable = item.amount / (1 + (item.gstRate ?? 18) / 100);
      bulkTaxable += lineTaxable;
    });
    bulkCgst = (bulkTotal - bulkTaxable) / 2;
    bulkSgst = (bulkTotal - bulkTaxable) / 2;
  } else {
    parsedMatched.forEach(item => {
      bulkTaxable += item.amount;
      const lineTax = item.amount * ((item.gstRate ?? 18) / 100);
      bulkCgst += lineTax / 2;
      bulkSgst += lineTax / 2;
    });
    bulkTotal = bulkTaxable + bulkCgst + bulkSgst;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            New Estimate
          </h2>
          <p className="text-muted-foreground text-xs">Configure client details, tax structures, and catalog item matrices.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Tax Mode segmented Toggle */}
          <div className="flex items-center bg-muted p-1 rounded-lg border border-border shadow-inner">
            <button
              type="button"
              onClick={() => setTaxMode("exclusive")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                taxMode === "exclusive"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              GST Exclusive
            </button>
            <button
              type="button"
              onClick={() => setTaxMode("inclusive")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                taxMode === "inclusive"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              GST Inclusive
            </button>
          </div>
          <Button variant="outline" onClick={() => setLocation("/estimates")}>Cancel</Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Customer Selection */}
          <Card className="border border-border/80 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer">Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger className="border-border">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.data?.map((c) => (
                      <SelectItem key={c.id} value={c.id!}>
                        {c.name} ({c.customerType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent">Agent (Optional)</Label>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger className="border-border">
                    <SelectValue placeholder="Select Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents?.data?.map((a) => (
                      <SelectItem key={a.id} value={a.id!}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Notes and validity */}
          <Card className="border border-border/80 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Validity & Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea 
                  id="notes" 
                  placeholder="Terms, logistics details, packing remarks, etc..." 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[105px] border-border"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Workspace Mode Tab Switcher */}
        <div className="flex border-b border-border space-x-6 pb-0">
          <button
            type="button"
            onClick={() => setActiveTab("single")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all duration-200 ${
              activeTab === "single"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Create single Estimate
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bulk")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all duration-200 ${
              activeTab === "bulk"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Create Bulk Estimate
          </button>
        </div>

        {activeTab === "single" ? (
          /* Tab 1: Single Manual cart */
          <Card className="border border-border/80 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg">Item Cart</CardTitle>
              <Button type="button" size="sm" onClick={addItem} className="h-8 shadow-sm">
                <Plus className="h-4 w-4 mr-2" /> Add Item
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-[300px]">Product</TableHead>
                    <TableHead className="w-[200px]">Variant</TableHead>
                    <TableHead className="w-[100px]">Qty</TableHead>
                    <TableHead>Price {taxMode === "inclusive" && "(Inclusive)"}</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <LineItemRow 
                      key={index} 
                      item={item} 
                      products={products?.data || []}
                      customerId={customerId}
                      taxMode={taxMode}
                      onChange={(updatedItem: EstimateLine) => replaceItem(index, updatedItem)}
                      onRemove={() => removeItem(index)}
                    />
                  ))}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        Your manual cart is empty. Click "Add Item" to start building.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {items.length > 0 && (
                <div className="mt-6 flex flex-col items-end space-y-2 border-t border-border pt-4">
                  <div className="flex justify-between w-[300px] text-sm text-muted-foreground">
                    <span>Taxable Subtotal:</span>
                    <span>₹{finalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between w-[300px] text-sm text-muted-foreground">
                    <span>CGST:</span>
                    <span>₹{finalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between w-[300px] text-sm text-muted-foreground">
                    <span>SGST:</span>
                    <span>₹{finalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between w-[300px] text-lg font-extrabold text-foreground pt-2 border-t border-border">
                    <span>Total Amount:</span>
                    <span className="text-primary">₹{finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Tab 2: Bulk File Importer */
          <div className="space-y-6">
            {!file ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border/80 hover:border-primary/50 transition-all rounded-xl p-12 text-center bg-card/60 cursor-pointer shadow-sm relative group">
                  <input 
                    type="file" 
                    accept=".xlsx,.xls,.csv" 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isUploading || !customerId}
                  />
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 bg-primary/10 rounded-full group-hover:scale-110 transition-transform">
                      <Upload className="h-8 w-8 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-lg text-foreground">Upload your client order spreadsheet</h3>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        {!customerId 
                          ? "⚠️ Select customer first to configure layout pricing maps"
                          : "Supports brochure formats (Col A Code + Col F Needed Qty), custom columns maps & standard sheets"}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="default" 
                    onClick={downloadBrochureTemplate}
                    className="border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-500/10 text-foreground text-sm font-semibold flex items-center gap-3 px-5 py-6 rounded-xl transition-all duration-300 shadow-sm hover:shadow-emerald-500/10 h-auto"
                  >
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                      <FileSpreadsheet className="h-5 w-5 animate-pulse" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-foreground">Brochure Order Sheet</p>
                      <p className="text-xs text-muted-foreground">Pre-filled with database product codes</p>
                    </div>
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="default" 
                    onClick={downloadCustomTemplate}
                    className="border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/10 text-foreground text-sm font-semibold flex items-center gap-3 px-5 py-6 rounded-xl transition-all duration-300 shadow-sm hover:shadow-amber-500/10 h-auto"
                  >
                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-foreground">Custom Column Template</p>
                      <p className="text-xs text-muted-foreground">Standard format for custom column mapping</p>
                    </div>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-3">
                {/* Left controls mapping column */}
                <Card className="border border-border/80 shadow-md md:col-span-1">
                  <CardHeader className="pb-3 flex flex-row items-center gap-2">
                    <Settings className="h-4 w-4 text-primary" />
                    <CardTitle className="text-lg">Import Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-muted/50 p-3 rounded-lg border border-border space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground">Active File</p>
                      <p className="text-sm font-bold truncate text-foreground flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-500 shrink-0" />
                        {file.name}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Worksheet Selection</Label>
                      <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                        <SelectTrigger className="border-border">
                          <SelectValue placeholder="Select worksheet" />
                        </SelectTrigger>
                        <SelectContent>
                          {sheetNames.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Select Spreadsheet Format</Label>
                      <Select value={bulkFormat} onValueChange={(val: any) => setBulkFormat(val)}>
                        <SelectTrigger className="border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="brochure">Sivakasi Brochure Layout (Col A + F)</SelectItem>
                          <SelectItem value="mapping">Generic Custom Column Mapping</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {bulkFormat === "mapping" && (
                      <div className="space-y-3 pt-2 border-t border-border">
                        <div className="space-y-2">
                          <Label>Product Code Column</Label>
                          <Select value={codeCol} onValueChange={setCodeCol}>
                            <SelectTrigger className="border-border">
                              <SelectValue placeholder="Select Code column" />
                            </SelectTrigger>
                            <SelectContent>
                              {sheetHeaders.map(h => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Quantity Column</Label>
                          <Select value={qtyCol} onValueChange={setQtyCol}>
                            <SelectTrigger className="border-border">
                              <SelectValue placeholder="Select Qty column" />
                            </SelectTrigger>
                            <SelectContent>
                              {sheetHeaders.map(h => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => { setFile(null); setParsedMatched([]); setParsedUnmatched([]); }} 
                        className="w-1/2"
                      >
                        Reset File
                      </Button>
                      <Button 
                        type="button" 
                        onClick={handleParseSheet} 
                        disabled={isParsing} 
                        className="w-1/2 shadow-sm"
                      >
                        {isParsing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                        Parse sheet
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Right Matched results and Warning consoles */}
                <div className="md:col-span-2 space-y-6">
                  {parsedMatched.length > 0 && (
                    <Card className="border border-border/80 shadow-md">
                      <CardHeader className="pb-3 flex flex-row items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          Resolved Matched Lines ({parsedMatched.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="max-h-[300px] overflow-y-auto border border-border rounded-lg">
                          <Table>
                            <TableHeader className="bg-muted/40 sticky top-0">
                              <TableRow className="border-border hover:bg-transparent">
                                <TableHead>Product Code</TableHead>
                                <TableHead>Product Name</TableHead>
                                <TableHead>Qty</TableHead>
                                <TableHead>UnitPrice</TableHead>
                                <TableHead>Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {parsedMatched.map((item, idx) => (
                                <TableRow key={idx} className="border-border">
                                  <TableCell className="font-mono text-xs text-foreground font-semibold">{item.productId ? products?.data?.find(x => x.id === item.productId)?.code : "—"}</TableCell>
                                  <TableCell className="max-w-[200px] truncate">{item.productName}</TableCell>
                                  <TableCell className="font-bold">{item.qty}</TableCell>
                                  <TableCell>₹{item.resolvedPrice.toLocaleString('en-IN')}</TableCell>
                                  <TableCell className="font-semibold text-primary">₹{item.amount.toLocaleString('en-IN')}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        <div className="mt-6 flex flex-col items-end space-y-2 border-t border-border pt-4">
                          <div className="flex justify-between w-[300px] text-sm text-muted-foreground">
                            <span>Taxable Subtotal:</span>
                            <span>₹{bulkTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between w-[300px] text-sm text-muted-foreground">
                            <span>CGST:</span>
                            <span>₹{bulkCgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between w-[300px] text-sm text-muted-foreground">
                            <span>SGST:</span>
                            <span>₹{bulkSgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between w-[300px] text-lg font-extrabold text-foreground pt-2 border-t border-border">
                            <span>Total Amount:</span>
                            <span className="text-primary">₹{bulkTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {parsedUnmatched.length > 0 && (
                    <Card className="border border-red-200/60 bg-red-50/20 shadow-md">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg text-red-700 flex items-center gap-2 font-bold">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                          Unmatched Brochure Product Codes ({parsedUnmatched.length})
                        </CardTitle>
                        <p className="text-xs text-red-600">The following product codes were mapped from your sheet but were not found or lack active variants in the ERP database catalog.</p>
                      </CardHeader>
                      <CardContent>
                        <div className="max-h-[220px] overflow-y-auto border border-red-100 rounded-lg">
                          <Table>
                            <TableHeader className="bg-red-50 sticky top-0">
                              <TableRow className="border-red-100 hover:bg-transparent">
                                <TableHead className="text-red-700">Code</TableHead>
                                <TableHead className="text-red-700">Original Row Name</TableHead>
                                <TableHead className="text-red-700">Import Qty</TableHead>
                                <TableHead className="text-red-700">Mismatched Reason</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {parsedUnmatched.map((item, idx) => (
                                <TableRow key={idx} className="border-red-50/80 bg-white">
                                  <TableCell className="font-mono text-xs text-red-800 font-bold">{item.code}</TableCell>
                                  <TableCell className="max-w-[200px] truncate text-muted-foreground">{item.name}</TableCell>
                                  <TableCell className="font-bold text-red-800">{item.qty}</TableCell>
                                  <TableCell className="text-xs text-amber-700 font-semibold">{item.reason}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => setLocation("/estimates")}>Cancel</Button>
          <Button 
            type="submit" 
            disabled={createEstimateMutation.isPending || (activeTab === "single" ? items.length === 0 : parsedMatched.length === 0)}
            className="shadow-sm"
          >
            {createEstimateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Estimate
          </Button>
        </div>
      </form>
    </div>
  );
}

type LineItemRowProps = {
  item: {
    productId: string;
    variantId: string;
    qty: number;
    unitPrice: number;
    total: number;
    variantLabel: string;
    tier?: string;
  };
  products: Product[];
  customerId: string;
  taxMode: "inclusive" | "exclusive";
  onChange: (updated: LineItemRowProps["item"]) => void;
  onRemove: () => void;
};

function LineItemRow({ item, products, customerId, taxMode, onChange, onRemove }: LineItemRowProps) {
  const selectedProduct = products.find((p) => p.id === item.productId);
  
  const { data: priceData, isFetching: isResolving } = useResolveProductPrice(
    item.productId,
    { 
      variantId: item.variantId,
      customerId,
      qty: item.qty,
      channel: "estimate",
    },
    { query: { enabled: !!(item.productId && item.variantId && customerId), queryKey: ["resolvePrice", item.productId, item.variantId, item.qty, customerId] } }
  );

  useEffect(() => {
    if (priceData?.data) {
      const basePrice = priceData.data.resolvedPrice ?? 0;
      const gst = (selectedProduct as any)?.gstRate ?? 18;
      
      const finalUnitPrice = taxMode === "inclusive"
        ? basePrice * (1 + gst / 100)
        : basePrice;
        
      onChange({ 
        ...item, 
        unitPrice: finalUnitPrice, 
        total: finalUnitPrice * item.qty,
        tier: priceData.data.tier
      });
    }
  }, [priceData, taxMode]);

  return (
    <TableRow className="border-border hover:bg-transparent">
      <TableCell>
        <Select 
          value={item.productId} 
          onValueChange={(val) => onChange({ ...item, productId: val, variantId: "", unitPrice: 0, total: 0 })}
        >
          <SelectTrigger className="border-border">
            <SelectValue placeholder="Select Product" />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id!}>{p.name} ({p.code})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select 
          value={item.variantId} 
          onValueChange={(val) => onChange({ ...item, variantId: val })}
          disabled={!item.productId}
        >
          <SelectTrigger className="border-border">
            <SelectValue placeholder="Select Variant" />
          </SelectTrigger>
          <SelectContent>
            {selectedProduct?.variants?.map((v, _i, all) => (
              <SelectItem key={v.variantId} value={v.variantId!}>{formatVariantLabel(v, all)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input 
          type="number" 
          min="1" 
          value={item.qty} 
          onChange={(e) => onChange({ ...item, qty: parseInt(e.target.value) || 1 })}
          className="border-border"
        />
      </TableCell>
      <TableCell>
        {isResolving ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">₹{item.unitPrice?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            {item.tier && <span className="text-[9px] text-primary font-bold uppercase tracking-wider mt-0.5">{item.tier}</span>}
          </div>
        )}
      </TableCell>
      <TableCell className="font-bold text-foreground">
        ₹{item.total?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="sm" onClick={onRemove} className="text-destructive hover:text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
