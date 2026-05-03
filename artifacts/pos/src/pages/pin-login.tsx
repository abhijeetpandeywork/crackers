import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { usePinLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Delete } from "lucide-react";
import logoUrl from "@assets/rathinam_logo.png";

type Cashier = { id: string; name: string; username: string; role: string; locationIds?: string[] | null };
type Shop = { id: string; name: string; type: string; city?: string | null };

const PinLogin = () => {
  const [pin, setPin] = useState("");
  const [userId, setUserId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { mutate: login, isPending } = usePinLogin();

  // Load real cashiers and shops from the bootstrap endpoint. Cashier/admin
  // names are not secret in a POS context — they're printed on receipts.
  useEffect(() => {
    fetch("/api/v1/auth/pos-bootstrap")
      .then((r) => r.json())
      .then((res) => {
        if (res?.success) {
          const list: Cashier[] = res.data?.cashiers ?? [];
          setCashiers(list);
          setShops(res.data?.shops ?? []);
          // Restore last-used selections so cashiers don't have to re-pick
          // every shift change.
          const lastUser = localStorage.getItem("pos_user_id");
          if (lastUser && list.some((c) => c.id === lastUser)) setUserId(lastUser);
          const lastLoc = localStorage.getItem("pos_location_id");
          if (lastLoc) setLocationId(lastLoc);
        }
      })
      .catch(() => toast({ title: "Could not load login info", description: "Check your network and refresh.", variant: "destructive" }));
  }, [toast]);

  // Locations available to the selected cashier. Privileged roles see all
  // shops; cashiers see only their assigned ones.
  const availableShops = useMemo(() => {
    const cashier = cashiers.find((c) => c.id === userId);
    if (!cashier) return shops;
    if (cashier.role === "SUPER_ADMIN" || cashier.role === "ERP_MANAGER") return shops;
    const allowed = new Set(cashier.locationIds ?? []);
    return shops.filter((s) => allowed.has(s.id));
  }, [cashiers, shops, userId]);

  // Whenever the cashier changes, snap the location to the only legal choice
  // (or clear it if the previous one is no longer valid for them).
  useEffect(() => {
    if (!userId) return;
    if (availableShops.length === 1) {
      setLocationId(availableShops[0].id);
    } else if (locationId && !availableShops.some((s) => s.id === locationId)) {
      setLocationId("");
    }
  }, [userId, availableShops, locationId]);

  const handleNumberClick = (num: string) => {
    if (pin.length < 4) setPin((prev) => prev + num);
  };
  const handleDelete = () => setPin((prev) => prev.slice(0, -1));

  const handleLogin = () => {
    const cashier = cashiers.find((c) => c.id === userId);
    if (!cashier) {
      toast({ title: "Please select a cashier", variant: "destructive" });
      return;
    }
    if (!locationId) {
      toast({ title: "Please pick a shop", variant: "destructive" });
      return;
    }
    login(
      { data: { pin, username: cashier.username, locationId } },
      {
        onSuccess: (res) => {
          if (res.data?.accessToken) {
            const shop = shops.find((s) => s.id === locationId);
            localStorage.setItem("pos_token", res.data.accessToken);
            localStorage.setItem("pos_user_id", cashier.id);
            localStorage.setItem("pos_user_name", cashier.name);
            localStorage.setItem("pos_user_role", cashier.role);
            localStorage.setItem("pos_location_id", locationId);
            if (shop?.name) localStorage.setItem("pos_location_name", shop.name);
            setLocation("/sale");
          }
        },
        onError: () => {
          toast({ title: "Invalid PIN", variant: "destructive" });
          setPin("");
        },
      },
    );
  };

  useEffect(() => {
    if (pin.length === 4 && userId && locationId) handleLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, userId, locationId]);

  // Physical keyboard support: 0-9, Backspace, Enter, Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT") return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleNumberClick(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleDelete();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setPin("");
      } else if (e.key === "Enter" && pin.length === 4 && userId && locationId) {
        e.preventDefault();
        handleLogin();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, userId, locationId]);

  const canSubmit = pin.length === 4 && !!userId && !!locationId && !isPending;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-[hsl(197,65%,12%)] via-[hsl(200,35%,7%)] to-[hsl(200,35%,5%)]">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 inline-flex items-center justify-center h-28 w-28 rounded-3xl bg-white/95 p-3 shadow-2xl shadow-black/40 ring-1 ring-amber-300/40">
            <img src={logoUrl} alt="Rathinam Crackers" className="h-full w-full object-contain" />
          </div>
          <p className="mt-1 text-amber-300 font-semibold tracking-[0.25em] uppercase text-xs">Cashier Login</p>
        </div>

        <div className="space-y-3">
          <Select onValueChange={setUserId} value={userId}>
            <SelectTrigger className="w-full h-14 bg-[hsl(200,30%,10%)] border-[hsl(197,50%,22%)] text-lg text-zinc-100" data-testid="pos-cashier-select">
              <SelectValue placeholder="Select Cashier" />
            </SelectTrigger>
            <SelectContent className="bg-[hsl(200,30%,10%)] border-[hsl(197,50%,22%)]">
              {cashiers.length === 0 ? (
                <div className="px-3 py-2 text-sm text-zinc-500">Loading…</div>
              ) : (
                cashiers.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="h-12">
                    {c.name} <span className="ml-2 text-xs text-zinc-500">{c.role.replace(/_/g, " ").toLowerCase()}</span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          <Select onValueChange={setLocationId} value={locationId} disabled={!userId || availableShops.length <= 1}>
            <SelectTrigger className="w-full h-14 bg-[hsl(200,30%,10%)] border-[hsl(197,50%,22%)] text-lg text-zinc-100" data-testid="pos-location-select">
              <SelectValue placeholder={userId ? (availableShops.length === 0 ? "No shops assigned" : "Select Shop") : "Pick a cashier first"} />
            </SelectTrigger>
            <SelectContent className="bg-[hsl(200,30%,10%)] border-[hsl(197,50%,22%)]">
              {availableShops.map((s) => (
                <SelectItem key={s.id} value={s.id} className="h-12">
                  {s.name}
                  {s.city ? <span className="ml-2 text-xs text-zinc-500">{s.city}</span> : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex justify-center gap-4 py-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 border-amber-400 transition-colors ${pin.length > i ? "bg-amber-400" : "bg-transparent"}`}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <Button
                key={num}
                variant="outline"
                className="h-20 text-2xl font-bold bg-[hsl(200,30%,10%)] border-[hsl(197,50%,22%)] text-zinc-100 hover:bg-[hsl(197,55%,24%)] hover:text-amber-300 active:scale-95"
                onClick={() => handleNumberClick(num.toString())}
              >
                {num}
              </Button>
            ))}
            <Button
              variant="outline"
              className="h-20 text-2xl font-bold bg-[hsl(200,30%,10%)] border-[hsl(197,50%,22%)] hover:bg-[hsl(197,55%,24%)] text-amber-300"
              onClick={() => setPin("")}
            >
              C
            </Button>
            <Button
              variant="outline"
              className="h-20 text-2xl font-bold bg-[hsl(200,30%,10%)] border-[hsl(197,50%,22%)] text-zinc-100 hover:bg-[hsl(197,55%,24%)] hover:text-amber-300 active:scale-95"
              onClick={() => handleNumberClick("0")}
            >
              0
            </Button>
            <Button
              variant="outline"
              className="h-20 text-2xl font-bold bg-[hsl(200,30%,10%)] border-[hsl(197,50%,22%)] hover:bg-[hsl(197,55%,24%)] text-red-400"
              onClick={handleDelete}
            >
              <Delete className="w-8 h-8" />
            </Button>
          </div>

          <Button
            className="w-full h-16 text-xl font-bold mt-4 bg-amber-400 text-[hsl(197,65%,12%)] hover:bg-amber-300 disabled:opacity-50"
            disabled={!canSubmit}
            onClick={handleLogin}
            data-testid="pos-login-submit"
          >
            {isPending ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : "LOGIN"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PinLogin;
