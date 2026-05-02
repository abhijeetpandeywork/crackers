import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { usePinLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Delete } from "lucide-react";

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
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[#0d0d0d]">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-5xl font-black tracking-tighter text-primary">RATHINAM</h1>
          <p className="mt-2 text-zinc-400 font-medium">Cashier Login</p>
        </div>

        <div className="space-y-4">
          <Select onValueChange={setUserId} value={userId}>
            <SelectTrigger className="w-full h-14 bg-zinc-900 border-zinc-800 text-lg">
              <SelectValue placeholder="Select Cashier" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              {cashiers.map(c => (
                <SelectItem key={c.id} value={c.id} className="h-12">{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex justify-center gap-4 py-8">
            {[0, 1, 2, 3].map(i => (
              <div 
                key={i} 
                className={`w-4 h-4 rounded-full border-2 border-primary ${pin.length > i ? 'bg-primary' : 'bg-transparent'}`}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <Button
                key={num}
                variant="outline"
                className="h-20 text-2xl font-bold bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:text-primary active:scale-95"
                onClick={() => handleNumberClick(num.toString())}
              >
                {num}
              </Button>
            ))}
            <Button
              variant="outline"
              className="h-20 text-2xl font-bold bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-primary"
              onClick={() => setPin("")}
            >
              C
            </Button>
            <Button
              variant="outline"
              className="h-20 text-2xl font-bold bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:text-primary active:scale-95"
              onClick={() => handleNumberClick("0")}
            >
              0
            </Button>
            <Button
              variant="outline"
              className="h-20 text-2xl font-bold bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-red-500"
              onClick={handleDelete}
            >
              <Delete className="w-8 h-8" />
            </Button>
          </div>

          <Button 
            className="w-full h-16 text-xl font-bold mt-4" 
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
