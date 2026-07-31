import { createFileRoute } from "@tanstack/react-router";
import { MarketPage, marketQuery } from "@/components/market-page";

export const Route = createFileRoute("/lax")({
  head: () => ({
    meta: [
      { title: "Los Angeles POP Market — CryptoPOP" },
      { name: "description", content: "CryptoPOP Los Angeles: POPups across LA neighborhoods, events, merchants and market news." },
      { property: "og:title", content: "Los Angeles POP Market — CryptoPOP" },
      { property: "og:description", content: "POPups across LA neighborhoods — events, merchants and POP rewards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(marketQuery("lax")),
  component: () => <MarketPage slug="lax" />,
  errorComponent: () => <div className="p-10">Couldn't load the Los Angeles market.</div>,
  notFoundComponent: () => <div className="p-10">Market not found.</div>,
});
