import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "API Access",
  description:
    "Integrate PromptGallery image transformation APIs for ecommerce, creator tools, and marketing workflows.",
  path: "/api-access",
  keywords: ["AI API", "image transformation API", "prompt API", "developer API"],
});

const API_PLANS = [
  { name: "Starter", price: "₹999/month", calls: "500 transformations/month" },
  { name: "Growth", price: "₹2999/month", calls: "2,500 transformations/month" },
  { name: "Enterprise", price: "₹7999/month", calls: "10,000 transformations/month" },
];

export default function ApiAccessPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-10 space-y-3">
        <h1 className="font-display text-4xl font-bold tracking-tight">PromptGallery API</h1>
        <p className="max-w-3xl text-muted-foreground">
          Transform images at scale for ecommerce, real estate, marketing agencies, and creator tools.
        </p>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {API_PLANS.map((plan) => (
          <Card key={plan.name} className="border-border/60 bg-card/70">
            <CardHeader>
              <CardTitle className="font-display">{plan.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-bold">{plan.price}</p>
              <p className="text-sm text-muted-foreground">{plan.calls}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-6 border-border/60 bg-card/70">
        <CardHeader>
          <CardTitle className="font-display text-xl">Quickstart</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <pre className="overflow-x-auto rounded-md bg-background/80 p-3 text-xs">
{`curl -X POST "$APP_URL/api/v1/transform" \\
  -H "X-API-Key: your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt_id":"uuid","image_url":"https://...","strength":0.7}'`}
          </pre>
          <pre className="overflow-x-auto rounded-md bg-background/80 p-3 text-xs">
{`import requests
r = requests.post(
  f"{APP_URL}/api/v1/transform",
  headers={"X-API-Key": API_KEY},
  json={"prompt_id": prompt_id, "image_url": image_url, "strength": 0.7},
)
print(r.json())`}
          </pre>
          <pre className="overflow-x-auto rounded-md bg-background/80 p-3 text-xs">
{`const res = await fetch(\`\${APP_URL}/api/v1/transform\`, {
  method: "POST",
  headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ prompt_id, image_url, strength: 0.7 }),
});
console.log(await res.json());`}
          </pre>
        </CardContent>
      </Card>

      <Button asChild>
        <Link href="/dashboard/api">Get API Key</Link>
      </Button>
    </div>
  );
}
