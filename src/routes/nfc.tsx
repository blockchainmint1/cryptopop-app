import { createFileRoute } from "@tanstack/react-router";
import { NfcPage } from "@/components/nfc/nfc-page";

export const Route = createFileRoute("/nfc")({
  head: () => ({
    meta: [
      { title: "Tap to Pay cards — CryptoPOP" },
      { name: "description", content: "Link tap-to-pay NFC cards to TSD pockets in your CryptoPOP wallet." },
      { property: "og:title", content: "Tap to Pay — CryptoPOP" },
      { property: "og:description", content: "Link tap-to-pay NFC cards to TSD pockets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <NfcPage />,
});
