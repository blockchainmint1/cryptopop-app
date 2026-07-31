import { createFileRoute } from "@tanstack/react-router";
import { MarketPage, marketQuery } from "@/components/market-page";

export const Route = createFileRoute("/nashville")({
  head: () => ({
    meta: [
      { title: "Nashville POP Market — CryptoPOP" },
      { name: "description", content: "CryptoPOP Nashville: Music City small business support, events, merchants and market news." },
      { property: "og:title", content: "Nashville POP Market — CryptoPOP" },
      { property: "og:description", content: "Music City small business support — earn POP where you already go." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(marketQuery("nashville")),
  component: () => <MarketPage slug="nashville" />,
  errorComponent: () => <div className="p-10">Couldn't load the Nashville market.</div>,
  notFoundComponent: () => <div className="p-10">Market not found.</div>,
});
