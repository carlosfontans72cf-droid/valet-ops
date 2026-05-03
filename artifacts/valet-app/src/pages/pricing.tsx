import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Price {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
}

interface Product {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: Price[];
}

function getToken() {
  return localStorage.getItem("valet_token") ?? "";
}

async function fetchProducts(): Promise<Product[]> {
  const res = await fetch("/api/stripe/products", {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Error al cargar planes");
  const data = await res.json();
  return data.data as Product[];
}

async function startCheckout(priceId: string, mode: "subscription" | "payment"): Promise<string> {
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ priceId, mode }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error al iniciar pago");
  }
  const data = await res.json();
  return data.url;
}

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(amount / 100);
}

export default function PricingPage() {
  const [, navigate] = useLocation();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch((e) => setError(e.message))
      .finally(() => setPageLoading(false));
  }, []);

  const handlePay = async (price: Price) => {
    try {
      setLoadingPriceId(price.id);
      const mode = price.recurring ? "subscription" : "payment";
      const url = await startCheckout(price.id, mode);
      window.location.href = url;
    } catch (e: any) {
      toast.error(e.message);
      setLoadingPriceId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Planes Valet Ops</h1>
          <p className="text-muted-foreground">
            Elegí el plan que mejor se adapta a tu negocio
          </p>
        </div>

        {pageLoading && (
          <div className="text-center text-muted-foreground py-12">Cargando planes...</div>
        )}

        {error && (
          <div className="text-center text-destructive py-12">{error}</div>
        )}

        {!pageLoading && !error && products?.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            No hay planes disponibles aún.
          </div>
        )}

        <div className="grid gap-4">
          {products?.map((product) =>
            product.prices.map((price) => {
              const isSubscription = !!price.recurring;
              const isLoading = loadingPriceId === price.id;
              return (
                <Card key={price.id} className="border-2 hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-xl">{product.name}</CardTitle>
                        {product.description && (
                          <CardDescription className="mt-1">{product.description}</CardDescription>
                        )}
                      </div>
                      <Badge variant={isSubscription ? "default" : "secondary"} className="shrink-0">
                        {isSubscription ? "Mensual" : "Por evento"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <div>
                      <span className="text-3xl font-bold">
                        {formatPrice(price.unit_amount, price.currency)}
                      </span>
                      {isSubscription && (
                        <span className="text-muted-foreground text-sm ml-1">
                          / {price.recurring?.interval === "month" ? "mes" : "año"}
                        </span>
                      )}
                    </div>
                    <Button
                      onClick={() => handlePay(price)}
                      disabled={isLoading}
                      size="lg"
                    >
                      {isLoading ? "Redirigiendo..." : "Contratar"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <div className="text-center">
          <Button variant="ghost" onClick={() => navigate("/")}>
            Volver al inicio
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Pagos procesados de forma segura por Stripe. Podés cancelar en cualquier momento.
        </p>
      </div>
    </div>
  );
}
