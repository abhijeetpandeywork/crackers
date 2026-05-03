import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  useGetSiteContent,
  useUpdateSiteContent,
} from "@workspace/api-client-react";

export default function SiteContent() {
  const { data, isLoading, refetch } = useGetSiteContent();
  const update = useUpdateSiteContent();
  const { toast } = useToast();
  const [text, setText] = useState("");

  useEffect(() => {
    if (data?.data) setText(JSON.stringify(data.data, null, 2));
  }, [data]);

  const handleSave = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      toast({ title: "Invalid JSON", description: "Please fix the JSON before saving.", variant: "destructive" });
      return;
    }
    try {
      await update.mutateAsync({ data: parsed as any });
      toast({ title: "Saved", description: "Website content updated." });
      refetch();
    } catch {
      toast({ title: "Save failed", description: "Could not update content.", variant: "destructive" });
    }
  };

  const handleReset = () => {
    if (data?.data) setText(JSON.stringify(data.data, null, 2));
  };

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Website content (CMS)</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Edit homepage occasions, categories, stats, testimonials, press,
          how-it-works, why-us, FAQs, help sections, product FAQs and contact details.
          Changes appear instantly on the public website.
        </p>
        <div className="rounded border bg-white">
          <textarea
            className="w-full h-[60vh] p-4 font-mono text-xs"
            value={text}
            disabled={isLoading}
            onChange={(e) => setText(e.target.value)}
            data-testid="site-content-editor"
          />
        </div>
        <div className="flex gap-3 mt-4">
          <Button onClick={handleSave} disabled={update.isPending} data-testid="site-content-save">
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Button variant="outline" onClick={handleReset} data-testid="site-content-reset">
            Reset
          </Button>
        </div>
      </div>
    </Layout>
  );
}
