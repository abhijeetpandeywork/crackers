import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { usePinLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Delete } from "lucide-react";
import logoUrl from "@assets/rathinam_logo.png";

const PinLogin = () => {
  const [pin, setPin] = useState("");
  const [userId, setUserId] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { mutate: login, isPending } = usePinLogin();

  const cashiers = [
    { id: "usr-admin", name: "Admin", username: "admin" },
    { id: "usr-cashier", name: "POS Cashier", username: "cashier" },
  ];

  const handleNumberClick = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  useEffect(() => {
    if (pin.length === 4 && userId) {
      handleLogin();
    }
  }, [pin, userId]);

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
      } else if (e.key === "Enter" && pin.length === 4 && userId) {
        e.preventDefault();
        handleLogin();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, userId]);

  const handleLogin = () => {
    const cashier = cashiers.find(c => c.id === userId);
    if (!cashier) {
      toast({ title: "Please select a cashier", variant: "destructive" });
      return;
    }
    login(
      { data: { pin, username: cashier.username, locationId: "loc1" } }, // locationId is required
      {
        onSuccess: (res) => {
          if (res.data?.accessToken) {
            localStorage.setItem("pos_token", res.data.accessToken);
            setLocation("/sale");
          }
        },
        onError: () => {
          toast({ title: "Invalid PIN", variant: "destructive" });
          setPin("");
        },
      }
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-[hsl(197,65%,12%)] via-[hsl(200,35%,7%)] to-[hsl(200,35%,5%)]">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 inline-flex items-center justify-center h-28 w-28 rounded-3xl bg-white/95 p-3 shadow-2xl shadow-black/40 ring-1 ring-amber-300/40">
            <img src={logoUrl} alt="Rathinam Crackers" className="h-full w-full object-contain" />
          </div>
          <p className="mt-1 text-amber-300 font-semibold tracking-[0.25em] uppercase text-xs">Cashier Login</p>
        </div>

        <div className="space-y-4">
          <Select onValueChange={setUserId} value={userId}>
            <SelectTrigger className="w-full h-14 bg-[hsl(200,30%,10%)] border-[hsl(197,50%,22%)] text-lg text-zinc-100">
              <SelectValue placeholder="Select Cashier" />
            </SelectTrigger>
            <SelectContent className="bg-[hsl(200,30%,10%)] border-[hsl(197,50%,22%)]">
              {cashiers.map(c => (
                <SelectItem key={c.id} value={c.id} className="h-12">{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex justify-center gap-4 py-6">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 border-amber-400 transition-colors ${pin.length > i ? 'bg-amber-400' : 'bg-transparent'}`}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
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
            disabled={pin.length < 4 || !userId || isPending}
            onClick={handleLogin}
          >
            {isPending ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : "LOGIN"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PinLogin;
